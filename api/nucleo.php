<?php
/**
 * Base de todos os endereços da API: banco, sessão, respostas e proteções.
 * Compatível com PHP 7.4 ou superior.
 */
declare(strict_types=1);

if (!defined('AR_API')) {
    http_response_code(403);
    exit;
}

date_default_timezone_set('America/Sao_Paulo');
ini_set('display_errors', '0');

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

set_exception_handler(function (Throwable $erro): void {
    error_log('Andre Rauber: ' . $erro->getMessage() . ' em ' . $erro->getFile() . ':' . $erro->getLine());
    if (!headers_sent()) {
        http_response_code(500);
    }
    echo json_encode(['ok' => false, 'erro' => 'Algo deu errado. Tente novamente em instantes.'], JSON_UNESCAPED_UNICODE);
});

/* --- Respostas ------------------------------------------------------------ */

function responder(int $status, array $dados = []): void
{
    http_response_code($status);
    echo json_encode(array_merge(['ok' => $status < 400], $dados), JSON_UNESCAPED_UNICODE);
    exit;
}

function falhar(int $status, string $mensagem, array $extra = []): void
{
    responder($status, array_merge(['erro' => $mensagem], $extra));
}

/* --- Configuração e banco -------------------------------------------------- */

function config(): array
{
    static $config = null;
    if ($config === null) {
        $caminho = __DIR__ . '/config.php';
        if (!is_file($caminho)) {
            error_log('Andre Rauber: api/config.php não encontrado.');
            falhar(503, 'O sistema de contas ainda não está disponível.');
        }
        $config = require $caminho;
    }
    return $config;
}

function banco(): PDO
{
    static $pdo = null;
    if ($pdo === null) {
        $c = config();
        $dsn = $c['dsn'] ?? ('mysql:host=' . $c['host'] . ';dbname=' . $c['banco'] . ';charset=utf8mb4');
        $pdo = new PDO($dsn, $c['usuario'] ?? null, $c['senha'] ?? null, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
    }
    return $pdo;
}

function consultar(string $sql, array $valores = []): PDOStatement
{
    $comando = banco()->prepare($sql);
    $comando->execute($valores);
    return $comando;
}

function agora(): string
{
    return date('Y-m-d H:i:s');
}

/* --- Entrada --------------------------------------------------------------- */

// Só aceita POST em JSON vindo do próprio site. Outro site não consegue enviar
// esse formato sem permissão do navegador, o que bloqueia ações forjadas.
// $limite: o tamanho máximo do pedido. Os apps, que guardam históricos, pedem mais.
function exigir_post(int $limite = 64000): array
{
    conferir_post_do_site();
    if (stripos($_SERVER['CONTENT_TYPE'] ?? '', 'application/json') !== 0) {
        falhar(415, 'Formato não aceito.');
    }
    $bruto = file_get_contents('php://input', false, null, 0, $limite + 1);
    if ($bruto !== false && strlen($bruto) > $limite) {
        falhar(413, 'Informações demais para guardar. Apague registros antigos e tente de novo.');
    }
    $dados = json_decode($bruto === false ? '' : $bruto, true);
    if (!is_array($dados)) {
        falhar(400, 'Dados inválidos.');
    }
    return $dados;
}

function conferir_post_do_site(): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        header('Allow: POST');
        falhar(405, 'Método não permitido.');
    }
    $origem = $_SERVER['HTTP_ORIGIN'] ?? '';
    $host = parse_url('//' . ($_SERVER['HTTP_HOST'] ?? ''), PHP_URL_HOST);
    if ($origem !== '' && parse_url($origem, PHP_URL_HOST) !== $host) {
        falhar(403, 'Origem não permitida.');
    }
}

function texto(array $origem, string $chave, int $limite): string
{
    $valor = $origem[$chave] ?? '';
    if (is_int($valor) || is_float($valor)) {
        $valor = (string) $valor;
    }
    if (!is_string($valor)) {
        return '';
    }
    // Remove caracteres de controle, mantendo quebras de linha
    $valor = preg_replace('/[^\P{C}\n]/u', '', $valor) ?? '';
    return mb_substr(trim($valor), 0, $limite, 'UTF-8');
}

// Erros de digitação comuns nos provedores mais usados no Brasil
const EMAIL_DOMINIOS_TROCADOS = [
    'gmail.con' => 'gmail.com', 'gmail.co' => 'gmail.com', 'gmail.cm' => 'gmail.com', 'gmail.om' => 'gmail.com',
    'gmail.com.br' => 'gmail.com', 'gmial.com' => 'gmail.com', 'gamil.com' => 'gmail.com', 'gmai.com' => 'gmail.com',
    'gmal.com' => 'gmail.com', 'gnail.com' => 'gmail.com', 'gmaill.com' => 'gmail.com',
    'hotmail.con' => 'hotmail.com', 'hotmail.co' => 'hotmail.com', 'hotmial.com' => 'hotmail.com',
    'hotmal.com' => 'hotmail.com', 'hotamil.com' => 'hotmail.com', 'homail.com' => 'hotmail.com',
    'outlook.con' => 'outlook.com', 'outlok.com' => 'outlook.com', 'outloo.com' => 'outlook.com',
    'yahoo.con' => 'yahoo.com', 'yaho.com' => 'yahoo.com', 'yahoo.com.bt' => 'yahoo.com.br',
    'icloud.con' => 'icloud.com', 'icoud.com' => 'icloud.com',
];

// Devolve o motivo de recusa, ou null se o e-mail parece bom. Só o link de confirmação
// prova que a caixa existe: aqui são barrados o formato errado e o domínio impossível.
function problema_no_email(string $email): ?string
{
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        return 'Informe um e-mail válido.';
    }
    $partes = explode('@', $email);
    $dominio = (string) end($partes);
    if (isset(EMAIL_DOMINIOS_TROCADOS[$dominio])) {
        return 'Confira o e-mail. Você quis dizer ' . $partes[0] . '@' . EMAIL_DOMINIOS_TROCADOS[$dominio] . '?';
    }
    if ((config()['email_checar_dominio'] ?? true) && !dominio_recebe_email($dominio)) {
        return 'Não encontramos o domínio deste e-mail. Confira se digitou certo.';
    }
    return null;
}

function dominio_recebe_email(string $dominio): bool
{
    if (!function_exists('checkdnsrr')) {
        return true;
    }
    $nome = $dominio . '.';
    if (@checkdnsrr($nome, 'MX') || @checkdnsrr($nome, 'A') || @checkdnsrr($nome, 'AAAA')) {
        return true;
    }
    // Se nem o Gmail responde, o problema é a consulta, e a pessoa não pode ser barrada
    return !@checkdnsrr('gmail.com.', 'MX');
}

function so_digitos(string $valor, int $limite): string
{
    return substr((string) preg_replace('/\D/', '', $valor), 0, $limite);
}

function telefone_valido(string $telefone): bool
{
    $tamanho = strlen($telefone);
    return $tamanho === 10 || $tamanho === 11;
}

/* --- Sessão ---------------------------------------------------------------- */

function iniciar_sessao(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    $seguro = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    session_name('ar_sessao');
    session_set_cookie_params([
        'lifetime' => 60 * 60 * 24 * 30,
        'path' => '/',
        'secure' => $seguro,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    ini_set('session.gc_maxlifetime', (string) (60 * 60 * 24 * 30));
    session_start();
}

function usuario_logado(): ?array
{
    iniciar_sessao();
    $id = (int) ($_SESSION['usuario_id'] ?? 0);
    if ($id === 0) {
        // A hospedagem apaga as sessões paradas depois de alguns minutos.
        // O token de "manter conectado" abre uma sessão nova sem pedir a senha.
        $id = entrar_pelo_token();
        if ($id === 0) {
            return null;
        }
    }
    $usuario = consultar('SELECT * FROM usuarios WHERE id = ?', [$id])->fetch();
    // A versão muda quando a senha é trocada: derruba as sessões antigas
    if (!$usuario || (int) $usuario['sessao_versao'] !== (int) ($_SESSION['sessao_versao'] ?? 0)) {
        encerrar_sessao();
        return null;
    }
    return $usuario;
}

function exigir_login(): array
{
    $usuario = usuario_logado();
    if ($usuario === null) {
        falhar(401, 'Entre na sua conta para continuar.');
    }
    return $usuario;
}

function abrir_sessao(array $usuario, bool $lembrar = true): void
{
    iniciar_sessao();
    session_regenerate_id(true);
    $_SESSION['usuario_id'] = (int) $usuario['id'];
    $_SESSION['sessao_versao'] = (int) $usuario['sessao_versao'];
    consultar('UPDATE usuarios SET ultimo_acesso_em = ? WHERE id = ?', [agora(), $usuario['id']]);
    if ($lembrar) {
        criar_token((int) $usuario['id'], (int) $usuario['sessao_versao']);
    }
}

/* --- Manter conectado -------------------------------------------------------- */

// O cookie leva um seletor e um segredo. O banco guarda só o resumo (hash) do segredo:
// quem ler o banco não consegue entrar na conta de ninguém.
const TOKEN_COOKIE = 'ar_lembrar';
const TOKEN_DIAS = 90;

function cookie_do_token(string $valor, int $expira): void
{
    setcookie(TOKEN_COOKIE, $valor, [
        'expires' => $expira,
        'path' => '/',
        'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}

function criar_token(int $usuarioId, int $versao): void
{
    try {
        $seletor = bin2hex(random_bytes(12));
        $segredo = bin2hex(random_bytes(32));
        $expira = time() + TOKEN_DIAS * 86400;
        consultar(
            'INSERT INTO sessoes_lembradas (seletor, segredo_hash, usuario_id, sessao_versao, expira_em, criado_em) VALUES (?, ?, ?, ?, ?, ?)',
            [$seletor, hash('sha256', $segredo), $usuarioId, $versao, date('Y-m-d H:i:s', $expira), agora()]
        );
        // De vez em quando, limpa os tokens vencidos
        if (random_int(1, 20) === 1) {
            consultar('DELETE FROM sessoes_lembradas WHERE expira_em < ?', [agora()]);
        }
        cookie_do_token($seletor . '.' . $segredo, $expira);
    } catch (Throwable $e) {
        // Sem a tabela, o login segue funcionando como antes
        error_log('Andre Rauber: token de manter conectado não criado: ' . $e->getMessage());
    }
}

function token_do_cookie(): ?array
{
    $valor = (string) ($_COOKIE[TOKEN_COOKIE] ?? '');
    if (preg_match('/^([a-f0-9]{24})\.([a-f0-9]{64})$/', $valor, $partes) !== 1) {
        return null;
    }
    return ['seletor' => $partes[1], 'segredo' => $partes[2]];
}

// Devolve o id da pessoa e abre a sessão, ou 0 quando o token não vale
function entrar_pelo_token(): int
{
    $token = token_do_cookie();
    if ($token === null) {
        return 0;
    }
    try {
        $linha = consultar(
            'SELECT t.*, u.sessao_versao AS versao_atual FROM sessoes_lembradas t JOIN usuarios u ON u.id = t.usuario_id WHERE t.seletor = ?',
            [$token['seletor']]
        )->fetch();
    } catch (Throwable $e) {
        return 0;
    }
    $valido = $linha
        && hash_equals((string) $linha['segredo_hash'], hash('sha256', $token['segredo']))
        && $linha['expira_em'] > agora()
        // Trocar a senha muda a versão e derruba os aparelhos conectados
        && (int) $linha['sessao_versao'] === (int) $linha['versao_atual'];
    if (!$valido) {
        if ($linha) {
            consultar('DELETE FROM sessoes_lembradas WHERE seletor = ?', [$token['seletor']]);
        }
        cookie_do_token('', time() - 3600);
        return 0;
    }
    session_regenerate_id(true);
    $_SESSION['usuario_id'] = (int) $linha['usuario_id'];
    $_SESSION['sessao_versao'] = (int) $linha['versao_atual'];
    // Quem usa o site continua conectado: o prazo recomeça a cada dia de uso
    $expira = time() + TOKEN_DIAS * 86400;
    if (strtotime((string) $linha['expira_em']) < $expira - 86400) {
        consultar('UPDATE sessoes_lembradas SET expira_em = ? WHERE seletor = ?', [date('Y-m-d H:i:s', $expira), $token['seletor']]);
        cookie_do_token($token['seletor'] . '.' . $token['segredo'], $expira);
    }
    consultar('UPDATE usuarios SET ultimo_acesso_em = ? WHERE id = ?', [agora(), $linha['usuario_id']]);
    return (int) $linha['usuario_id'];
}

function esquecer_token(): void
{
    $token = token_do_cookie();
    if ($token !== null) {
        try {
            consultar('DELETE FROM sessoes_lembradas WHERE seletor = ?', [$token['seletor']]);
        } catch (Throwable $e) {
            // Sem a tabela, não há o que apagar
        }
    }
    if (isset($_COOKIE[TOKEN_COOKIE])) {
        cookie_do_token('', time() - 3600);
    }
}

function encerrar_sessao(): void
{
    esquecer_token();
    iniciar_sessao();
    $_SESSION = [];
    $parametros = session_get_cookie_params();
    setcookie(session_name(), '', [
        'expires' => time() - 3600,
        'path' => $parametros['path'],
        'secure' => $parametros['secure'],
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_destroy();
}

function dados_publicos(array $usuario): array
{
    return [
        'nome' => $usuario['nome'],
        'email' => $usuario['email'],
        'telefone' => $usuario['telefone'],
        'admin' => (int) $usuario['admin'] === 1,
        'temSenha' => $usuario['senha_hash'] !== null,
        'consentiu' => $usuario['consentiu_em'] !== null,
        'emailVerificado' => (int) $usuario['email_verificado'] === 1,
    ];
}

/* --- Limite de tentativas ----------------------------------------------------- */

function chave_limite(string $acao, string $extra = ''): string
{
    return hash('sha256', $acao . '|' . ($_SERVER['REMOTE_ADDR'] ?? '') . '|' . $extra . '|' . config()['segredo']);
}

function limite_atingido(string $chave, int $maximo, int $segundos): bool
{
    $desde = date('Y-m-d H:i:s', time() - $segundos);
    $total = consultar('SELECT COUNT(*) FROM tentativas WHERE chave = ? AND criado_em > ?', [$chave, $desde])->fetchColumn();
    return (int) $total >= $maximo;
}

function contar_tentativa(string $chave): void
{
    consultar('INSERT INTO tentativas (chave, criado_em) VALUES (?, ?)', [$chave, agora()]);
    if (random_int(1, 50) === 1) {
        consultar('DELETE FROM tentativas WHERE criado_em < ?', [date('Y-m-d H:i:s', time() - 86400)]);
    }
}

function exigir_limite(string $chave, int $maximo, int $segundos): void
{
    if (limite_atingido($chave, $maximo, $segundos)) {
        falhar(429, 'Muitas tentativas. Aguarde alguns minutos e tente de novo.');
    }
}

/* --- Registro de atividade ------------------------------------------------------ */

function registrar_evento(int $usuarioId, string $tipo, ?string $etapa = null, ?string $detalhes = null): void
{
    consultar(
        'INSERT INTO eventos (usuario_id, tipo, etapa, detalhes, criado_em) VALUES (?, ?, ?, ?, ?)',
        [$usuarioId, $tipo, $etapa, $detalhes === null ? null : mb_substr($detalhes, 0, 500, 'UTF-8'), agora()]
    );
}

/* --- Fotos do guarda-roupa ---------------------------------------------------------- */

// As fotos ficam numa pasta bloqueada ao acesso direto e só saem por api/foto-peca.php,
// que confere se a foto é mesmo de quem está pedindo.
function pasta_fotos(): string
{
    $pasta = (string) (config()['pasta_fotos'] ?? (__DIR__ . '/fotos-pecas'));
    if (!is_dir($pasta) && !mkdir($pasta, 0755, true) && !is_dir($pasta)) {
        throw new RuntimeException('Não foi possível criar a pasta de fotos.');
    }
    $bloqueio = $pasta . '/.htaccess';
    if (!is_file($bloqueio)) {
        file_put_contents($bloqueio, "Require all denied\n");
    }
    return $pasta;
}

function apagar_foto(string $arquivo): void
{
    if (preg_match('/^[a-f0-9]{32}\.(webp|png|jpg)$/', $arquivo) !== 1) {
        return;
    }
    $caminho = pasta_fotos() . '/' . $arquivo;
    if (is_file($caminho) && !unlink($caminho)) {
        error_log('Andre Rauber: não foi possível apagar uma foto.');
    }
}

function apagar_guarda_roupa(int $usuarioId): void
{
    $arquivos = consultar('SELECT arquivo FROM pecas WHERE usuario_id = ?', [$usuarioId])->fetchAll(PDO::FETCH_COLUMN);
    foreach ($arquivos as $arquivo) {
        apagar_foto((string) $arquivo);
    }
    consultar('DELETE FROM usos_pecas WHERE usuario_id = ?', [$usuarioId]);
    consultar('DELETE FROM pecas_valores WHERE usuario_id = ?', [$usuarioId]);
    consultar('DELETE FROM looks_notas WHERE usuario_id = ?', [$usuarioId]);
    consultar('DELETE FROM looks WHERE usuario_id = ?', [$usuarioId]);
    consultar('DELETE FROM pecas_excluidas WHERE usuario_id = ?', [$usuarioId]);
    consultar('DELETE FROM pecas_sugeridas_recebidas WHERE usuario_id = ?', [$usuarioId]);
    consultar('DELETE FROM pecas WHERE usuario_id = ?', [$usuarioId]);
}

/* --- Pedidos --------------------------------------------------------------------- */

// Um pedido pago há menos de 90 dias ainda pode estar em confecção ou em garantia
function tem_pedido_em_andamento(int $usuarioId): bool
{
    $desde = date('Y-m-d H:i:s', time() - 90 * 86400);
    return (int) consultar(
        "SELECT COUNT(*) FROM pedidos WHERE usuario_id = ? AND atualizado_em > ? AND situacao IN ('pago', 'processando', 'contestado')",
        [$usuarioId, $desde]
    )->fetchColumn() > 0;
}

/* --- E-mail --------------------------------------------------------------------- */

function enviar_email(string $para, string $assunto, string $corpo): bool
{
    $c = config();
    if (!filter_var($para, FILTER_VALIDATE_EMAIL)) {
        return false;
    }
    // Só para testes: grava em arquivo em vez de enviar
    if (!empty($c['email_arquivo'])) {
        return file_put_contents($c['email_arquivo'], json_encode([$para, $assunto, $corpo]) . "\n", FILE_APPEND) !== false;
    }
    $remetente = (string) ($c['email_remetente'] ?? '');
    $cabecalhos = [
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        'From: Rauber <' . $remetente . '>',
    ];
    // Sem o -f, a hospedagem envia em nome do servidor, e o Gmail costuma recusar
    $parametros = filter_var($remetente, FILTER_VALIDATE_EMAIL) ? '-f' . $remetente : '';
    $enviado = mail($para, mb_encode_mimeheader($assunto, 'UTF-8'), $corpo, implode("\r\n", $cabecalhos), $parametros);
    if (!$enviado) {
        error_log('Andre Rauber: falha ao enviar e-mail.');
    }
    return $enviado;
}

/* --- Pasta privada ------------------------------------------------------------ */

// Chaves dos lembretes, tokens das redes e vídeos esperando publicação.
// Fica bloqueada ao acesso pelo navegador e fora do repositório.
function pasta_privada(): string
{
    $pasta = (string) (config()['pasta_privada'] ?? (__DIR__ . '/privado'));
    if (!is_dir($pasta) && !mkdir($pasta, 0700, true) && !is_dir($pasta)) {
        throw new RuntimeException('Não foi possível criar a pasta privada.');
    }
    $bloqueio = $pasta . '/.htaccess';
    if (!is_file($bloqueio)) {
        file_put_contents($bloqueio, "Require all denied\n");
    }
    return $pasta;
}

function base64url(string $bytes): string
{
    return rtrim(strtr(base64_encode($bytes), '+/', '-_'), '=');
}

/* --- Ajustes do site (tabela configuracoes) ------------------------------------------ */

function ajuste(string $chave, $padrao = null)
{
    // Antes de importar o banco.sql novo, a tabela não existe: vale o padrão, e os apps seguem funcionando
    try {
        $valor = consultar('SELECT valor FROM configuracoes WHERE chave = ?', [$chave])->fetchColumn();
    } catch (PDOException $erro) {
        return $padrao;
    }
    if ($valor === false) {
        return $padrao;
    }
    $dado = json_decode((string) $valor, true);
    return $dado === null && $valor !== 'null' ? $padrao : $dado;
}

/* --- Assinatura dos apps (api/assinatura.php) ----------------------------------------- */

const ASSINATURA_MODOS = ['oculta', 'aviso', 'cobrando'];
const ASSINATURA_PADRAO = [
    'modo' => 'oculta',
    'nome' => 'Rauber Apps',
    'precoCentavos' => 1990,
    'beneficios' => [
        'Guarda-roupa com looks para o clima do dia',
        'Treino montado para você, com fases e evolução das cargas',
        'Plano alimentar com o custo do mercado da sua região',
        'Hábitos e lembretes no celular, mesmo com o site fechado',
        'Ocasiões: o traje certo para cada evento',
    ],
];

function assinatura_config(): array
{
    $salvo = ajuste('assinatura', []);
    $plano = ASSINATURA_PADRAO;
    if (is_array($salvo)) {
        if (in_array($salvo['modo'] ?? '', ASSINATURA_MODOS, true)) {
            $plano['modo'] = $salvo['modo'];
        }
        if (is_string($salvo['nome'] ?? null) && $salvo['nome'] !== '') {
            $plano['nome'] = $salvo['nome'];
        }
        if (is_int($salvo['precoCentavos'] ?? null)) {
            $plano['precoCentavos'] = $salvo['precoCentavos'];
        }
        if (is_array($salvo['beneficios'] ?? null) && $salvo['beneficios']) {
            $plano['beneficios'] = array_values(array_filter($salvo['beneficios'], 'is_string'));
        }
    }
    return $plano;
}

function assinatura_da_pessoa(int $usuarioId): ?array
{
    try {
        $a = consultar('SELECT * FROM assinaturas WHERE usuario_id = ?', [$usuarioId])->fetch();
    } catch (PDOException $erro) {
        return null;
    }
    return $a ?: null;
}

function assinatura_valida(array $a): bool
{
    return $a['situacao'] === 'ativa' && ($a['valida_ate'] === null || (string) $a['valida_ate'] >= date('Y-m-d H:i:s'));
}

// Fora do modo "cobrando", todo mundo usa. O gestor sempre usa.
function acesso_aos_apps(?array $usuario): bool
{
    if (assinatura_config()['modo'] !== 'cobrando') {
        return true;
    }
    if ($usuario === null) {
        return false;
    }
    if ((int) $usuario['admin'] === 1) {
        return true;
    }
    $a = assinatura_da_pessoa((int) $usuario['id']);
    return $a !== null && assinatura_valida($a);
}

// Para as APIs dos apps: com a cobrança ligada, quem não assina recebe 402
function exigir_acesso_apps(array $liberadas = []): void
{
    $usuario = usuario_logado();
    if ($usuario !== null && !in_array($_GET['acao'] ?? '', $liberadas, true) && !acesso_aos_apps($usuario)) {
        falhar(402, 'Os apps agora são por assinatura. Assine para continuar.', ['assinatura' => true]);
    }
}

function gravar_ajuste(string $chave, $valor): void
{
    $json = json_encode($valor, JSON_UNESCAPED_UNICODE);
    $momento = agora();
    $mudou = consultar('UPDATE configuracoes SET valor = ?, atualizado_em = ? WHERE chave = ?', [$json, $momento, $chave])->rowCount();
    if ($mudou === 0 && consultar('SELECT 1 FROM configuracoes WHERE chave = ?', [$chave])->fetchColumn() === false) {
        consultar('INSERT INTO configuracoes (chave, valor, atualizado_em) VALUES (?, ?, ?)', [$chave, $json, $momento]);
    }
}

/* --- Dados públicos de outros serviços ---------------------------------------------- */

// Pasta para guardar respostas de outros serviços por um tempo. Fica bloqueada ao acesso direto.
function pasta_cache(): string
{
    $pasta = (string) (config()['pasta_cache'] ?? (__DIR__ . '/cache'));
    if (!is_dir($pasta) && !mkdir($pasta, 0755, true) && !is_dir($pasta)) {
        throw new RuntimeException('Não foi possível criar a pasta de cache.');
    }
    $bloqueio = $pasta . '/.htaccess';
    if (!is_file($bloqueio)) {
        file_put_contents($bloqueio, "Require all denied\n");
    }
    return $pasta;
}

function ler_cache(string $nome, int $validadeSegundos): ?array
{
    $caminho = pasta_cache() . '/' . $nome . '.json';
    if (!is_file($caminho) || filemtime($caminho) < time() - $validadeSegundos) {
        return null;
    }
    $dados = json_decode((string) file_get_contents($caminho), true);
    return is_array($dados) ? $dados : null;
}

function gravar_cache(string $nome, array $dados): void
{
    $caminho = pasta_cache() . '/' . $nome . '.json';
    file_put_contents($caminho . '.tmp', json_encode($dados, JSON_UNESCAPED_UNICODE));
    rename($caminho . '.tmp', $caminho);
}

// Busca um endereço que responde em JSON. Os serviços pedem que o site se identifique.
function buscar_json(string $url, int $limiteSegundos = 8): ?array
{
    $agente = 'AndreRauber/1.0 (+' . (string) (config()['site_url'] ?? 'https://andrerauber.com') . ')';
    if (function_exists('curl_init')) {
        $c = curl_init($url);
        curl_setopt_array($c, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => $limiteSegundos,
            CURLOPT_CONNECTTIMEOUT => 4,
            CURLOPT_USERAGENT => $agente,
            CURLOPT_HTTPHEADER => ['Accept: application/json'],
            CURLOPT_FOLLOWLOCATION => false,
        ]);
        $corpo = curl_exec($c);
        $status = (int) curl_getinfo($c, CURLINFO_HTTP_CODE);
        curl_close($c);
    } else {
        $contexto = stream_context_create(['http' => ['timeout' => $limiteSegundos, 'header' => "User-Agent: $agente\r\nAccept: application/json\r\n"]]);
        $corpo = @file_get_contents($url, false, $contexto);
        $status = $corpo === false ? 0 : 200;
    }
    if (!is_string($corpo) || $status < 200 || $status >= 300) {
        return null;
    }
    $dados = json_decode($corpo, true);
    return is_array($dados) ? $dados : null;
}
