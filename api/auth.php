<?php
/**
 * Contas: sessão, registro, login, Google, recuperação de senha e exclusão.
 * O que fazer vem em ?acao=...
 */
declare(strict_types=1);

define('AR_API', true);
require __DIR__ . '/nucleo.php';

$acao = $_GET['acao'] ?? '';

switch ($acao) {
    case 'sessao':
        acao_sessao();
        break;
    case 'registrar':
        acao_registrar();
        break;
    case 'entrar':
        acao_entrar();
        break;
    case 'google':
        acao_google();
        break;
    case 'sair':
        exigir_post();
        encerrar_sessao();
        responder(200);
        break;
    case 'esqueci':
        acao_esqueci();
        break;
    case 'redefinir':
        acao_redefinir();
        break;
    case 'excluir':
        acao_excluir();
        break;
    default:
        falhar(404, 'Ação desconhecida.');
}

function acao_sessao(): void
{
    $usuario = usuario_logado();
    responder(200, [
        'logado' => $usuario !== null,
        'usuario' => $usuario ? dados_publicos($usuario) : null,
        'googleClientId' => (string) (config()['google_client_id'] ?? ''),
    ]);
}

function criar_usuario(string $nome, string $email, string $telefone, ?string $senhaHash, ?string $googleId, bool $consentiu, string $origem): array
{
    $momento = agora();
    consultar(
        'INSERT INTO usuarios (nome, email, telefone, senha_hash, google_id, email_verificado, consentiu_em, origem, criado_em)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [$nome, $email, $telefone, $senhaHash, $googleId, $googleId ? 1 : 0, $consentiu ? $momento : null, $origem, $momento]
    );
    $id = (int) banco()->lastInsertId();
    consultar('INSERT INTO cadastros (usuario_id) VALUES (?)', [$id]);
    registrar_evento($id, 'conta_criada', null, $origem);
    return consultar('SELECT * FROM usuarios WHERE id = ?', [$id])->fetch();
}

function acao_registrar(): void
{
    $dados = exigir_post();

    // Campo escondido: só robôs preenchem. Finge sucesso e não grava nada.
    if (texto($dados, 'website', 200) !== '') {
        responder(200, ['usuario' => null]);
    }

    $chave = chave_limite('registrar');
    exigir_limite($chave, 10, 3600);

    $nome = texto($dados, 'nome', 120);
    $email = mb_strtolower(texto($dados, 'email', 190), 'UTF-8');
    $telefone = so_digitos(texto($dados, 'telefone', 30), 11);
    $senha = is_string($dados['senha'] ?? null) ? $dados['senha'] : '';

    $erros = [];
    if (mb_strlen($nome, 'UTF-8') < 2) {
        $erros['nome'] = 'Informe seu nome completo.';
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $erros['email'] = 'Informe um e-mail válido.';
    }
    if (!telefone_valido($telefone)) {
        $erros['telefone'] = 'Informe seu telefone com DDD.';
    }
    if (strlen($senha) < 8) {
        $erros['senha'] = 'A senha precisa ter pelo menos 8 caracteres.';
    } elseif (strlen($senha) > 200) {
        $erros['senha'] = 'A senha é longa demais.';
    }
    if (empty($dados['consentimento'])) {
        $erros['consentimento'] = 'Para criar a conta, é preciso concordar com a política de privacidade.';
    }
    if ($erros) {
        falhar(422, 'Confira os campos marcados.', ['campos' => $erros]);
    }

    contar_tentativa($chave);

    $existe = consultar('SELECT id FROM usuarios WHERE email = ?', [$email])->fetch();
    if ($existe) {
        falhar(409, 'Este e-mail já tem conta. Entre ou recupere sua senha.', ['campos' => ['email' => 'Este e-mail já tem conta.']]);
    }

    try {
        $usuario = criar_usuario($nome, $email, $telefone, password_hash($senha, PASSWORD_DEFAULT), null, true, 'senha');
    } catch (PDOException $erro) {
        if ((string) $erro->getCode() === '23000') {
            falhar(409, 'Este e-mail já tem conta. Entre ou recupere sua senha.');
        }
        throw $erro;
    }

    abrir_sessao($usuario);
    responder(201, ['usuario' => dados_publicos($usuario)]);
}

function acao_entrar(): void
{
    $dados = exigir_post();
    $email = mb_strtolower(texto($dados, 'email', 190), 'UTF-8');
    $senha = is_string($dados['senha'] ?? null) ? $dados['senha'] : '';

    $chaveConta = chave_limite('entrar', $email);
    $chaveIp = chave_limite('entrar-ip');
    exigir_limite($chaveConta, 8, 900);
    exigir_limite($chaveIp, 40, 900);

    $usuario = consultar('SELECT * FROM usuarios WHERE email = ?', [$email])->fetch();

    if ($usuario && $usuario['senha_hash']) {
        $confere = password_verify($senha, $usuario['senha_hash']);
    } else {
        // Gasta o mesmo tempo sem conta, para a demora não revelar quem tem cadastro
        password_hash($senha, PASSWORD_DEFAULT);
        $confere = false;
    }

    if (!$confere) {
        contar_tentativa($chaveConta);
        contar_tentativa($chaveIp);
        falhar(401, 'E-mail ou senha incorretos.');
    }

    if (password_needs_rehash($usuario['senha_hash'], PASSWORD_DEFAULT)) {
        consultar('UPDATE usuarios SET senha_hash = ? WHERE id = ?', [password_hash($senha, PASSWORD_DEFAULT), $usuario['id']]);
    }

    consultar('DELETE FROM tentativas WHERE chave = ?', [$chaveConta]);
    abrir_sessao($usuario);
    registrar_evento((int) $usuario['id'], 'login', null, 'senha');
    responder(200, ['usuario' => dados_publicos($usuario)]);
}

// Pergunta ao Google se o token é verdadeiro e foi emitido para este site
function verificar_token_google(string $credencial): ?array
{
    $c = config();
    $clienteId = (string) ($c['google_client_id'] ?? '');
    if ($clienteId === '' || $credencial === '' || strlen($credencial) > 4096) {
        return null;
    }
    $base = $c['google_tokeninfo'] ?? 'https://oauth2.googleapis.com/tokeninfo';
    $url = $base . '?id_token=' . rawurlencode($credencial);

    if (function_exists('curl_init')) {
        $curl = curl_init($url);
        curl_setopt_array($curl, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 8, CURLOPT_CONNECTTIMEOUT => 5]);
        $resposta = curl_exec($curl);
        $status = (int) curl_getinfo($curl, CURLINFO_HTTP_CODE);
        curl_close($curl);
    } else {
        $contexto = stream_context_create(['http' => ['timeout' => 8, 'ignore_errors' => true]]);
        $resposta = @file_get_contents($url, false, $contexto);
        $status = $resposta === false ? 0 : 200;
    }
    if ($status !== 200 || !is_string($resposta)) {
        return null;
    }

    $info = json_decode($resposta, true);
    if (!is_array($info)
        || ($info['aud'] ?? '') !== $clienteId
        || !in_array($info['iss'] ?? '', ['accounts.google.com', 'https://accounts.google.com'], true)
        || (int) ($info['exp'] ?? 0) < time()
        || ($info['email_verified'] ?? '') !== 'true'
        || empty($info['sub'])
        || !filter_var($info['email'] ?? '', FILTER_VALIDATE_EMAIL)) {
        return null;
    }
    return $info;
}

function acao_google(): void
{
    $dados = exigir_post();
    $chave = chave_limite('google');
    exigir_limite($chave, 30, 900);
    contar_tentativa($chave);

    $info = verificar_token_google(texto($dados, 'credencial', 4096));
    if ($info === null) {
        falhar(401, 'Não foi possível entrar com o Google. Tente novamente.');
    }

    $googleId = (string) $info['sub'];
    $email = mb_strtolower((string) $info['email'], 'UTF-8');
    $nome = mb_substr(trim((string) ($info['name'] ?? '')), 0, 120, 'UTF-8');

    $usuario = consultar('SELECT * FROM usuarios WHERE google_id = ?', [$googleId])->fetch();

    if (!$usuario) {
        $porEmail = consultar('SELECT * FROM usuarios WHERE email = ?', [$email])->fetch();
        if ($porEmail) {
            // Conta com senha cujo e-mail nunca foi confirmado pode ter sido criada por
            // outra pessoa usando este e-mail. O Google confirma o verdadeiro dono, então
            // a senha antiga é cancelada para ninguém mais entrar com ela.
            $verificado = (int) $porEmail['email_verificado'] === 1;
            consultar(
                'UPDATE usuarios SET google_id = ?, email_verificado = 1, senha_hash = ?, sessao_versao = ?, nome = ? WHERE id = ?',
                [
                    $googleId,
                    $verificado ? $porEmail['senha_hash'] : null,
                    (int) $porEmail['sessao_versao'] + ($verificado ? 0 : 1),
                    $porEmail['nome'] !== '' ? $porEmail['nome'] : $nome,
                    $porEmail['id'],
                ]
            );
            registrar_evento((int) $porEmail['id'], 'google_vinculado');
            $usuario = consultar('SELECT * FROM usuarios WHERE id = ?', [$porEmail['id']])->fetch();
        } else {
            $usuario = criar_usuario($nome, $email, '', null, $googleId, false, 'google');
            abrir_sessao($usuario);
            responder(201, ['usuario' => dados_publicos($usuario), 'novo' => true]);
        }
    }

    abrir_sessao($usuario);
    registrar_evento((int) $usuario['id'], 'login', null, 'google');
    responder(200, ['usuario' => dados_publicos($usuario)]);
}

function acao_esqueci(): void
{
    $dados = exigir_post();
    $email = mb_strtolower(texto($dados, 'email', 190), 'UTF-8');

    $chave = chave_limite('esqueci');
    exigir_limite($chave, 5, 3600);
    contar_tentativa($chave);

    $usuario = consultar('SELECT * FROM usuarios WHERE email = ?', [$email])->fetch();
    if ($usuario) {
        $token = bin2hex(random_bytes(32));
        consultar('DELETE FROM redefinicoes_senha WHERE usuario_id = ?', [$usuario['id']]);
        consultar(
            'INSERT INTO redefinicoes_senha (usuario_id, token_hash, expira_em) VALUES (?, ?, ?)',
            [$usuario['id'], hash('sha256', $token), date('Y-m-d H:i:s', time() + 3600)]
        );
        // O endereço vem da configuração, nunca do pedido, para o link não ser falsificado
        $link = rtrim((string) config()['site_url'], '/') . '/redefinir-senha.html?token=' . $token;
        enviar_email(
            $email,
            'Redefinir sua senha | Andre Rauber',
            "Olá!\n\nRecebemos um pedido para redefinir a senha da sua conta. Para criar uma nova senha, abra o link abaixo em até 1 hora:\n\n{$link}\n\nSe não foi você, é só ignorar este e-mail. Sua senha continua a mesma.\n\nAndre Rauber"
        );
        registrar_evento((int) $usuario['id'], 'senha_pedida');
    }
    // A resposta é igual exista a conta ou não, para não revelar quem tem cadastro
    responder(200);
}

function acao_redefinir(): void
{
    $dados = exigir_post();
    $chave = chave_limite('redefinir');
    exigir_limite($chave, 20, 3600);
    contar_tentativa($chave);

    $token = texto($dados, 'token', 128);
    $senha = is_string($dados['senha'] ?? null) ? $dados['senha'] : '';

    if (strlen($senha) < 8 || strlen($senha) > 200) {
        falhar(422, 'A senha precisa ter pelo menos 8 caracteres.', ['campos' => ['senha' => 'A senha precisa ter pelo menos 8 caracteres.']]);
    }

    $pedido = consultar(
        'SELECT * FROM redefinicoes_senha WHERE token_hash = ? AND usado_em IS NULL AND expira_em > ?',
        [hash('sha256', $token), agora()]
    )->fetch();
    if (!$pedido) {
        falhar(400, 'Este link expirou ou já foi usado. Peça um novo.');
    }

    // Quem abriu o link provou ser dono do e-mail, e as sessões antigas caem
    consultar(
        'UPDATE usuarios SET senha_hash = ?, email_verificado = 1, sessao_versao = sessao_versao + 1 WHERE id = ?',
        [password_hash($senha, PASSWORD_DEFAULT), $pedido['usuario_id']]
    );
    consultar('UPDATE redefinicoes_senha SET usado_em = ? WHERE id = ?', [agora(), $pedido['id']]);
    registrar_evento((int) $pedido['usuario_id'], 'senha_redefinida');

    $usuario = consultar('SELECT * FROM usuarios WHERE id = ?', [$pedido['usuario_id']])->fetch();
    abrir_sessao($usuario);
    responder(200, ['usuario' => dados_publicos($usuario)]);
}

function acao_excluir(): void
{
    $dados = exigir_post();
    $usuario = exigir_login();
    if (texto($dados, 'confirmacao', 20) !== 'EXCLUIR') {
        falhar(422, 'Digite EXCLUIR para confirmar.');
    }
    $id = (int) $usuario['id'];
    apagar_guarda_roupa($id);
    consultar('DELETE FROM eventos WHERE usuario_id = ?', [$id]);
    consultar('DELETE FROM redefinicoes_senha WHERE usuario_id = ?', [$id]);
    consultar('DELETE FROM cadastros WHERE usuario_id = ?', [$id]);
    consultar('DELETE FROM usuarios WHERE id = ?', [$id]);
    encerrar_sessao();
    responder(200);
}
