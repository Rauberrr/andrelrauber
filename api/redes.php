<?php
/**
 * Publicar vídeos nas redes: Instagram (Reels), Facebook (Reels da Página), YouTube (Shorts) e TikTok.
 *
 * Cada rede tem um "app de desenvolvedor" criado pelo dono da marca, com as chaves no config.php.
 * A conta de cada rede é ligada pelo login da própria rede (OAuth): a senha nunca passa por aqui.
 * Os tokens ficam cifrados no banco, na tabela redes_contas.
 *
 * Cada publicação anda em etapas (enviar o vídeo, esperar a rede processar, publicar).
 * processar_publicacao() avança o que dá dentro do tempo disponível e guarda onde parou,
 * para o próximo pedido do painel ou a tarefa agendada continuar dali.
 */
declare(strict_types=1);

if (!defined('AR_API')) {
    http_response_code(404);
    exit;
}

const REDES = ['instagram', 'facebook', 'youtube', 'tiktok'];
// Quem faz o login: a Meta liga o Instagram e o Facebook de uma vez
const REDES_LOGIN = ['meta' => ['instagram', 'facebook'], 'google' => ['youtube'], 'tiktok' => ['tiktok']];
const REDES_NOMES = ['instagram' => 'Instagram', 'facebook' => 'Facebook', 'youtube' => 'YouTube', 'tiktok' => 'TikTok'];
const VIDEO_MAXIMO = 500 * 1024 * 1024;
const PEDACO_YOUTUBE = 8 * 1024 * 1024;
const PEDACO_TIKTOK = 10 * 1024 * 1024;

/* --- Endereços (os testes trocam por um servidor falso) ---------------------------------------- */

function base_rede(string $nome): string
{
    $versao = (string) (config()['meta_versao'] ?? 'v23.0');
    $padrao = [
        'graph' => 'https://graph.facebook.com/' . $versao,
        'rupload' => 'https://rupload.facebook.com',
        'meta_dialogo' => 'https://www.facebook.com/' . $versao . '/dialog/oauth',
        'google_auth' => 'https://accounts.google.com/o/oauth2/v2/auth',
        'google_token' => 'https://oauth2.googleapis.com/token',
        'youtube' => 'https://www.googleapis.com/youtube/v3',
        'youtube_upload' => 'https://www.googleapis.com/upload/youtube/v3/videos',
        'tiktok_auth' => 'https://www.tiktok.com/v2/auth/authorize/',
        'tiktok' => 'https://open.tiktokapis.com/v2',
    ];
    return (string) ((config()['redes_bases'] ?? [])[$nome] ?? $padrao[$nome]);
}

function retorno_oauth(): string
{
    return rtrim((string) (config()['site_url'] ?? ''), '/') . '/api/conectar.php';
}

/** As chaves de cada login, ou null se ainda não foram configuradas */
function chaves_login(string $login): ?array
{
    $c = config();
    $chaves = [
        'meta' => [$c['meta_app_id'] ?? '', $c['meta_app_secret'] ?? ''],
        'google' => [$c['youtube_client_id'] ?? '', $c['youtube_client_secret'] ?? ''],
        'tiktok' => [$c['tiktok_client_key'] ?? '', $c['tiktok_client_secret'] ?? ''],
    ][$login] ?? ['', ''];
    return $chaves[0] !== '' && $chaves[1] !== '' ? ['id' => (string) $chaves[0], 'segredo' => (string) $chaves[1]] : null;
}

/* --- Tokens cifrados ----------------------------------------------------------------------- */

function chave_cifra(): string
{
    return hash('sha256', 'redes|' . (string) (config()['segredo'] ?? ''), true);
}

function cifrar(array $dados): string
{
    $iv = random_bytes(12);
    $cifrado = openssl_encrypt(json_encode($dados), 'aes-256-gcm', chave_cifra(), OPENSSL_RAW_DATA, $iv, $tag);
    return base64_encode($iv . $tag . $cifrado);
}

function decifrar(string $texto): ?array
{
    $bruto = base64_decode($texto, true);
    if ($bruto === false || strlen($bruto) < 29) {
        return null;
    }
    $claro = openssl_decrypt(substr($bruto, 28), 'aes-256-gcm', chave_cifra(), OPENSSL_RAW_DATA, substr($bruto, 0, 12), substr($bruto, 12, 16));
    $dados = $claro === false ? null : json_decode($claro, true);
    return is_array($dados) ? $dados : null;
}

function conta_da_rede(string $rede): ?array
{
    $linha = consultar('SELECT nome, dados, conectado_em FROM redes_contas WHERE rede = ?', [$rede])->fetch();
    if (!$linha) {
        return null;
    }
    $dados = decifrar((string) $linha['dados']);
    return $dados === null ? null : $dados + ['_nome' => $linha['nome'], '_desde' => $linha['conectado_em']];
}

function guardar_conta(string $rede, string $nome, array $dados): void
{
    consultar('DELETE FROM redes_contas WHERE rede = ?', [$rede]);
    consultar('INSERT INTO redes_contas (rede, nome, dados, conectado_em) VALUES (?, ?, ?, ?)', [$rede, mb_substr($nome, 0, 120), cifrar($dados), agora()]);
}

/* --- HTTP ------------------------------------------------------------------------------------ */

class ErroRede extends RuntimeException
{
}

/**
 * Pedido HTTP. $corpo: array vira formulário, string vai como está.
 * $arquivo: [caminho, início, tamanho] envia esse trecho do arquivo como corpo, sem carregar tudo na memória.
 * Devolve [status, corpo (JSON decodificado ou texto), cabeçalhos em minúsculas].
 */
function http_rede(string $metodo, string $url, array $cabecalhos = [], $corpo = null, ?array $arquivo = null, int $limite = 120): array
{
    $c = curl_init($url);
    $recebidos = [];
    curl_setopt_array($c, [
        CURLOPT_CUSTOMREQUEST => $metodo,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => $limite,
        CURLOPT_CONNECTTIMEOUT => 15,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_HEADERFUNCTION => function ($h, string $linha) use (&$recebidos): int {
            $partes = explode(':', $linha, 2);
            if (count($partes) === 2) {
                $recebidos[strtolower(trim($partes[0]))] = trim($partes[1]);
            }
            return strlen($linha);
        },
    ]);
    if ($arquivo !== null) {
        [$caminho, $inicio, $tamanho] = $arquivo;
        $fonte = fopen($caminho, 'rb');
        fseek($fonte, $inicio);
        curl_setopt_array($c, [
            CURLOPT_UPLOAD => true,
            CURLOPT_INFILE => $fonte,
            CURLOPT_INFILESIZE => $tamanho,
            CURLOPT_READFUNCTION => function ($h, $f, int $quanto) use (&$tamanho): string {
                if ($tamanho <= 0) {
                    return '';
                }
                $dados = (string) fread($f, min($quanto, $tamanho));
                $tamanho -= strlen($dados);
                return $dados;
            },
        ]);
        $cabecalhos[] = 'Expect:';
    } elseif ($corpo !== null) {
        curl_setopt($c, CURLOPT_POSTFIELDS, is_array($corpo) ? http_build_query($corpo) : $corpo);
    }
    curl_setopt($c, CURLOPT_HTTPHEADER, $cabecalhos);
    $resposta = curl_exec($c);
    $status = (int) curl_getinfo($c, CURLINFO_RESPONSE_CODE);
    $falha = curl_error($c);
    curl_close($c);
    if (isset($fonte)) {
        fclose($fonte);
    }
    if ($resposta === false) {
        throw new ErroRede('Sem conexão com a rede: ' . $falha);
    }
    $json = json_decode((string) $resposta, true);
    return [$status, is_array($json) ? $json : (string) $resposta, $recebidos];
}

// A mensagem de erro que a própria rede devolveu, curta
function erro_da_rede($corpo, int $status): string
{
    if (is_array($corpo)) {
        $msg = $corpo['error']['message'] ?? $corpo['error_description'] ?? $corpo['error']['errors'][0]['message'] ?? $corpo['message'] ?? null;
        if (is_string($corpo['error'] ?? null) && $msg === null) {
            $msg = $corpo['error'];
        }
        if ($msg === null && is_array($corpo['error'] ?? null)) {
            $msg = $corpo['error']['code'] ?? null;
        }
        if (is_string($msg) && $msg !== '' && $msg !== 'ok') {
            return mb_substr($msg, 0, 240);
        }
    }
    return 'A rede respondeu com o código ' . $status . '.';
}

function exigir_ok(array $r, string $acao): array
{
    [$status, $corpo] = $r;
    // TikTok responde 200 com error.code diferente de "ok"
    $codigoTiktok = is_array($corpo) ? ($corpo['error']['code'] ?? 'ok') : 'ok';
    if ($status < 200 || $status >= 300 || ($codigoTiktok !== 'ok' && $codigoTiktok !== '')) {
        throw new ErroRede($acao . ': ' . erro_da_rede($corpo, $status));
    }
    return is_array($corpo) ? $corpo : [];
}

/* --- Login de cada rede ------------------------------------------------------------------- */

function endereco_de_login(string $login, string $estado): string
{
    $chaves = chaves_login($login);
    if ($chaves === null) {
        throw new ErroRede('Faltam as chaves do app no config.php.');
    }
    $volta = retorno_oauth();
    if ($login === 'meta') {
        $pedido = ['client_id' => $chaves['id'], 'redirect_uri' => $volta, 'state' => $estado, 'response_type' => 'code'];
        // Apps do tipo Empresa (Login do Facebook para Empresas) pedem as permissões pela configuração criada no app.
        $configuracao = trim((string) (config()['meta_config_id'] ?? ''));
        if ($configuracao !== '') {
            $pedido['config_id'] = $configuracao;
        } else {
            $pedido['scope'] = 'pages_show_list,pages_read_engagement,pages_manage_posts,instagram_basic,instagram_content_publish,business_management';
        }
        return base_rede('meta_dialogo') . '?' . http_build_query($pedido);
    }
    if ($login === 'google') {
        return base_rede('google_auth') . '?' . http_build_query([
            'client_id' => $chaves['id'], 'redirect_uri' => $volta, 'state' => $estado, 'response_type' => 'code',
            'scope' => 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly',
            'access_type' => 'offline', 'prompt' => 'consent', 'include_granted_scopes' => 'true',
        ]);
    }
    return base_rede('tiktok_auth') . '?' . http_build_query([
        'client_key' => $chaves['id'], 'redirect_uri' => $volta, 'state' => $estado, 'response_type' => 'code',
        'scope' => 'user.info.basic,video.publish',
    ]);
}

/** Troca o código do login pelos tokens e guarda as contas. Devolve os nomes ligados. */
function concluir_login(string $login, string $codigo): array
{
    $chaves = chaves_login($login);
    if ($chaves === null) {
        throw new ErroRede('Faltam as chaves do app no config.php.');
    }
    $volta = retorno_oauth();
    if ($login === 'meta') {
        $curto = exigir_ok(http_rede('GET', base_rede('graph') . '/oauth/access_token?' . http_build_query([
            'client_id' => $chaves['id'], 'client_secret' => $chaves['segredo'], 'redirect_uri' => $volta, 'code' => $codigo,
        ])), 'Login da Meta');
        // Token longo: dele saem os tokens das Páginas, que não vencem
        $longo = exigir_ok(http_rede('GET', base_rede('graph') . '/oauth/access_token?' . http_build_query([
            'grant_type' => 'fb_exchange_token', 'client_id' => $chaves['id'], 'client_secret' => $chaves['segredo'],
            'fb_exchange_token' => $curto['access_token'] ?? '',
        ])), 'Login da Meta');
        $paginas = exigir_ok(http_rede('GET', base_rede('graph') . '/me/accounts?' . http_build_query([
            'fields' => 'id,name,access_token,instagram_business_account{id,username}', 'access_token' => $longo['access_token'] ?? '',
        ])), 'Páginas do Facebook');
        $lista = $paginas['data'] ?? [];
        if (!$lista) {
            throw new ErroRede('Nenhuma Página do Facebook nesta conta. O Instagram precisa estar ligado a uma Página.');
        }
        // A primeira Página com Instagram ligado; sem nenhuma, a primeira Página
        usort($lista, function ($a, $b) { return isset($b['instagram_business_account']) <=> isset($a['instagram_business_account']); });
        $pagina = $lista[0];
        guardar_conta('facebook', (string) $pagina['name'], ['pagina' => (string) $pagina['id'], 'token' => (string) $pagina['access_token']]);
        $ligados = ['Facebook: ' . $pagina['name']];
        $ig = $pagina['instagram_business_account'] ?? null;
        if (is_array($ig) && isset($ig['id'])) {
            guardar_conta('instagram', '@' . ($ig['username'] ?? $ig['id']), ['conta' => (string) $ig['id'], 'token' => (string) $pagina['access_token']]);
            $ligados[] = 'Instagram: @' . ($ig['username'] ?? $ig['id']);
        } else {
            consultar("DELETE FROM redes_contas WHERE rede = 'instagram'");
        }
        return $ligados;
    }
    if ($login === 'google') {
        $t = exigir_ok(http_rede('POST', base_rede('google_token'), ['Content-Type: application/x-www-form-urlencoded'], [
            'code' => $codigo, 'client_id' => $chaves['id'], 'client_secret' => $chaves['segredo'], 'redirect_uri' => $volta, 'grant_type' => 'authorization_code',
        ]), 'Login do Google');
        if (empty($t['refresh_token'])) {
            throw new ErroRede('O Google não devolveu a permissão permanente. Tire o acesso do app na sua conta Google e conecte de novo.');
        }
        $canais = exigir_ok(http_rede('GET', base_rede('youtube') . '/channels?part=snippet&mine=true', ['Authorization: Bearer ' . $t['access_token']]), 'Canal do YouTube');
        $canal = $canais['items'][0] ?? null;
        if (!$canal) {
            throw new ErroRede('Esta conta Google não tem canal no YouTube.');
        }
        guardar_conta('youtube', (string) ($canal['snippet']['title'] ?? 'Canal'), [
            'token' => $t['access_token'], 'renovar' => $t['refresh_token'], 'vence' => time() + (int) ($t['expires_in'] ?? 3600) - 120,
        ]);
        return ['YouTube: ' . ($canal['snippet']['title'] ?? 'canal')];
    }
    $t = exigir_ok(http_rede('POST', base_rede('tiktok') . '/oauth/token/', ['Content-Type: application/x-www-form-urlencoded'], [
        'client_key' => $chaves['id'], 'client_secret' => $chaves['segredo'], 'code' => $codigo, 'grant_type' => 'authorization_code', 'redirect_uri' => $volta,
    ]), 'Login do TikTok');
    $perfil = exigir_ok(http_rede('GET', base_rede('tiktok') . '/user/info/?fields=display_name', ['Authorization: Bearer ' . $t['access_token']]), 'Perfil do TikTok');
    $nome = (string) ($perfil['data']['user']['display_name'] ?? 'TikTok');
    guardar_conta('tiktok', $nome, [
        'token' => $t['access_token'], 'renovar' => $t['refresh_token'] ?? '', 'vence' => time() + (int) ($t['expires_in'] ?? 86400) - 120,
    ]);
    return ['TikTok: ' . $nome];
}

// Google e TikTok dão tokens curtos: renova antes de usar
function token_valido(string $rede, array $conta): string
{
    if ($rede === 'instagram' || $rede === 'facebook' || (int) ($conta['vence'] ?? 0) > time()) {
        return (string) $conta['token'];
    }
    $login = $rede === 'youtube' ? 'google' : 'tiktok';
    $chaves = chaves_login($login);
    if ($chaves === null || empty($conta['renovar'])) {
        throw new ErroRede('A conexão venceu. Conecte a conta de novo.');
    }
    if ($rede === 'youtube') {
        $t = exigir_ok(http_rede('POST', base_rede('google_token'), ['Content-Type: application/x-www-form-urlencoded'], [
            'client_id' => $chaves['id'], 'client_secret' => $chaves['segredo'], 'refresh_token' => $conta['renovar'], 'grant_type' => 'refresh_token',
        ]), 'Renovar o acesso ao YouTube');
    } else {
        $t = exigir_ok(http_rede('POST', base_rede('tiktok') . '/oauth/token/', ['Content-Type: application/x-www-form-urlencoded'], [
            'client_key' => $chaves['id'], 'client_secret' => $chaves['segredo'], 'refresh_token' => $conta['renovar'], 'grant_type' => 'refresh_token',
        ]), 'Renovar o acesso ao TikTok');
    }
    $conta['token'] = (string) $t['access_token'];
    $conta['renovar'] = (string) ($t['refresh_token'] ?? $conta['renovar']);
    $conta['vence'] = time() + (int) ($t['expires_in'] ?? 3600) - 120;
    $nome = (string) $conta['_nome'];
    unset($conta['_nome'], $conta['_desde']);
    guardar_conta($rede, $nome, $conta);
    return $conta['token'];
}

/* --- Vídeos ------------------------------------------------------------------------------------ */

function pasta_videos(): string
{
    $pasta = pasta_privada() . '/videos';
    if (!is_dir($pasta)) {
        mkdir($pasta, 0700, true);
    }
    return $pasta;
}

function caminho_do_video(array $video): string
{
    return pasta_videos() . '/' . basename((string) $video['arquivo']);
}

/* --- Publicar: cada rede em etapas ------------------------------------------------------------ */

/**
 * Avança uma publicação até onde der em $segundos. Muda situação, etapa e estado no banco.
 * Situações: agendada, enviando, processando, publicada, erro.
 */
function processar_publicacao(int $id, int $segundos = 40): array
{
    $p = consultar('SELECT * FROM publicacoes WHERE id = ?', [$id])->fetch();
    if (!$p || in_array($p['situacao'], ['publicada', 'erro', 'cancelada'], true)) {
        return $p ?: [];
    }
    // Uma vez só por vez: outro pedido que chegue junto não mexe nesta
    $trava = consultar(
        'UPDATE publicacoes SET travada_em = ? WHERE id = ? AND (travada_em IS NULL OR travada_em < ?)',
        [agora(), $id, date('Y-m-d H:i:s', time() - 15 * 60)]
    );
    if ($trava->rowCount() === 0) {
        return $p;
    }
    $estado = json_decode((string) ($p['estado'] ?? ''), true) ?: [];
    $situacao = $p['situacao'] === 'agendada' ? 'enviando' : $p['situacao'];
    $link = (string) ($p['link'] ?? '');
    $erro = '';
    try {
        $video = consultar('SELECT * FROM videos WHERE id = ?', [$p['video_id']])->fetch();
        $conta = conta_da_rede((string) $p['rede']);
        if (!$video || !is_file(caminho_do_video($video))) {
            throw new ErroRede('O arquivo do vídeo não está mais no servidor. Envie de novo.');
        }
        if ($conta === null) {
            throw new ErroRede('A conta do ' . REDES_NOMES[$p['rede']] . ' não está conectada.');
        }
        $fim = time() + $segundos;
        $funcao = 'publicar_' . $p['rede'];
        [$situacao, $link] = $funcao($p, $video, $conta, $estado, $fim);
    } catch (Throwable $e) {
        $erro = $e instanceof ErroRede ? $e->getMessage() : 'Erro inesperado: ' . mb_substr($e->getMessage(), 0, 160);
        $situacao = 'erro';
        if (!($e instanceof ErroRede)) {
            error_log('Rauber vídeos: ' . $e->getMessage());
        }
    }
    consultar(
        'UPDATE publicacoes SET situacao = ?, estado = ?, link = ?, erro = ?, tentativas = tentativas + 1, travada_em = NULL, atualizado_em = ? WHERE id = ?',
        [$situacao, json_encode($estado), mb_substr($link, 0, 300), mb_substr($erro, 0, 300), agora(), $id]
    );
    return consultar('SELECT * FROM publicacoes WHERE id = ?', [$id])->fetch();
}

function legenda_completa(array $p): string
{
    return trim((string) $p['legenda']);
}

/* Instagram: contêiner de Reels, envio do arquivo, espera o processamento, publica */
function publicar_instagram(array $p, array $video, array $conta, array &$estado, int $fim): array
{
    $token = $conta['token'];
    $graph = base_rede('graph');
    if (empty($estado['conteiner'])) {
        $r = exigir_ok(http_rede('POST', $graph . '/' . $conta['conta'] . '/media', [], [
            'media_type' => 'REELS', 'upload_type' => 'resumable', 'caption' => mb_substr(legenda_completa($p), 0, 2200),
            'share_to_feed' => 'true', 'access_token' => $token,
        ]), 'Instagram');
        $estado['conteiner'] = (string) $r['id'];
    }
    if (empty($estado['enviado'])) {
        $versao = (string) (config()['meta_versao'] ?? 'v23.0');
        $tamanho = (int) $video['tamanho'];
        exigir_ok(http_rede('POST', base_rede('rupload') . '/ig-api-upload/' . $versao . '/' . $estado['conteiner'], [
            'Authorization: OAuth ' . $token, 'offset: 0', 'file_size: ' . $tamanho, 'Content-Type: application/octet-stream',
        ], null, [caminho_do_video($video), 0, $tamanho], 600), 'Envio ao Instagram');
        $estado['enviado'] = true;
    }
    // O Instagram processa o vídeo antes de deixar publicar
    while (true) {
        $s = exigir_ok(http_rede('GET', $graph . '/' . $estado['conteiner'] . '?fields=status_code,status&access_token=' . urlencode($token)), 'Instagram');
        $codigo = $s['status_code'] ?? '';
        if ($codigo === 'FINISHED') {
            break;
        }
        if ($codigo === 'ERROR' || $codigo === 'EXPIRED') {
            throw new ErroRede('O Instagram recusou o vídeo: ' . ($s['status'] ?? $codigo) . '. Reels pedem vídeo vertical, de 3 segundos a 15 minutos.');
        }
        if (time() + 5 > $fim) {
            return ['processando', ''];
        }
        sleep(4);
    }
    $r = exigir_ok(http_rede('POST', $graph . '/' . $conta['conta'] . '/media_publish', [], ['creation_id' => $estado['conteiner'], 'access_token' => $token]), 'Publicar no Instagram');
    $link = '';
    $m = http_rede('GET', $graph . '/' . $r['id'] . '?fields=permalink&access_token=' . urlencode($token));
    if ($m[0] === 200 && is_array($m[1])) {
        $link = (string) ($m[1]['permalink'] ?? '');
    }
    return ['publicada', $link ?: 'https://www.instagram.com/'];
}

/* Facebook: Reels da Página, em três fases (começar, enviar, terminar publicando) */
function publicar_facebook(array $p, array $video, array $conta, array &$estado, int $fim): array
{
    $token = $conta['token'];
    $graph = base_rede('graph');
    if (empty($estado['video'])) {
        $r = exigir_ok(http_rede('POST', $graph . '/' . $conta['pagina'] . '/video_reels', [], ['upload_phase' => 'start', 'access_token' => $token]), 'Facebook');
        $estado['video'] = (string) $r['video_id'];
        $estado['envio'] = (string) ($r['upload_url'] ?? (base_rede('rupload') . '/video-upload/' . (config()['meta_versao'] ?? 'v23.0') . '/' . $r['video_id']));
    }
    if (empty($estado['enviado'])) {
        $tamanho = (int) $video['tamanho'];
        exigir_ok(http_rede('POST', $estado['envio'], [
            'Authorization: OAuth ' . $token, 'offset: 0', 'file_size: ' . $tamanho, 'Content-Type: application/octet-stream',
        ], null, [caminho_do_video($video), 0, $tamanho], 600), 'Envio ao Facebook');
        $estado['enviado'] = true;
    }
    exigir_ok(http_rede('POST', $graph . '/' . $conta['pagina'] . '/video_reels', [], [
        'upload_phase' => 'finish', 'video_id' => $estado['video'], 'video_state' => 'PUBLISHED',
        'description' => legenda_completa($p), 'access_token' => $token,
    ]), 'Publicar no Facebook');
    return ['publicada', 'https://www.facebook.com/reel/' . $estado['video']];
}

/* YouTube: envio retomável em pedaços. Vídeo vertical de até 3 minutos vira Short. */
function publicar_youtube(array $p, array $video, array $conta, array &$estado, int $fim): array
{
    $token = token_valido('youtube', $conta);
    $tamanho = (int) $video['tamanho'];
    if (empty($estado['sessao'])) {
        $titulo = trim((string) $p['titulo']) ?: mb_substr(strtok(legenda_completa($p), "\n") ?: 'Vídeo', 0, 100);
        $meta = [
            'snippet' => ['title' => mb_substr($titulo, 0, 100), 'description' => mb_substr(legenda_completa($p), 0, 5000), 'categoryId' => '22'],
            'status' => ['privacyStatus' => (string) (config()['youtube_privacidade'] ?? 'public'), 'selfDeclaredMadeForKids' => false],
        ];
        $r = http_rede('POST', base_rede('youtube_upload') . '?uploadType=resumable&part=snippet,status', [
            'Authorization: Bearer ' . $token, 'Content-Type: application/json; charset=UTF-8',
            'X-Upload-Content-Length: ' . $tamanho, 'X-Upload-Content-Type: ' . ($video['tipo'] ?: 'video/mp4'),
        ], json_encode($meta, JSON_UNESCAPED_UNICODE));
        exigir_ok($r, 'YouTube');
        if (empty($r[2]['location'])) {
            throw new ErroRede('O YouTube não abriu o envio.');
        }
        $estado['sessao'] = $r[2]['location'];
        $estado['enviado'] = 0;
    }
    while ($estado['enviado'] < $tamanho) {
        if (time() + 10 > $fim) {
            return ['enviando', ''];
        }
        $inicio = (int) $estado['enviado'];
        $pedaco = min(PEDACO_YOUTUBE, $tamanho - $inicio);
        $r = http_rede('PUT', $estado['sessao'], [
            'Authorization: Bearer ' . $token, 'Content-Length: ' . $pedaco,
            'Content-Range: bytes ' . $inicio . '-' . ($inicio + $pedaco - 1) . '/' . $tamanho,
        ], null, [caminho_do_video($video), $inicio, $pedaco], 300);
        if ($r[0] === 308) {
            // O YouTube diz até onde recebeu
            $faixa = $r[2]['range'] ?? '';
            $estado['enviado'] = preg_match('/-(\d+)$/', $faixa, $m) ? (int) $m[1] + 1 : $inicio + $pedaco;
            continue;
        }
        $corpo = exigir_ok($r, 'Envio ao YouTube');
        $estado['enviado'] = $tamanho;
        $estado['id'] = (string) ($corpo['id'] ?? '');
    }
    return ['publicada', 'https://youtube.com/shorts/' . ($estado['id'] ?? '')];
}

/* TikTok: consulta as opções do criador, abre o envio, manda os pedaços e espera a publicação */
function publicar_tiktok(array $p, array $video, array $conta, array &$estado, int $fim): array
{
    $token = token_valido('tiktok', $conta);
    $api = base_rede('tiktok');
    $json = ['Authorization: Bearer ' . $token, 'Content-Type: application/json; charset=UTF-8'];
    $tamanho = (int) $video['tamanho'];
    if (empty($estado['publicacao'])) {
        $criador = exigir_ok(http_rede('POST', $api . '/post/publish/creator_info/query/', $json, '{}'), 'TikTok');
        $opcoes = $criador['data']['privacy_level_options'] ?? [];
        $desejada = (string) (config()['tiktok_privacidade'] ?? 'SELF_ONLY');
        $privacidade = in_array($desejada, $opcoes, true) ? $desejada : (in_array('SELF_ONLY', $opcoes, true) ? 'SELF_ONLY' : ($opcoes[0] ?? 'SELF_ONLY'));
        // Pedaços entre 5 e 64 MB; o último leva a sobra. Vídeo pequeno vai inteiro.
        $pedaco = $tamanho <= PEDACO_TIKTOK ? $tamanho : PEDACO_TIKTOK;
        $total = max(1, intdiv($tamanho, $pedaco));
        $r = exigir_ok(http_rede('POST', $api . '/post/publish/video/init/', $json, json_encode([
            'post_info' => ['title' => mb_substr(legenda_completa($p), 0, 2200), 'privacy_level' => $privacidade, 'disable_comment' => false, 'disable_duet' => false, 'disable_stitch' => false],
            'source_info' => ['source' => 'FILE_UPLOAD', 'video_size' => $tamanho, 'chunk_size' => $pedaco, 'total_chunk_count' => $total],
        ], JSON_UNESCAPED_UNICODE)), 'TikTok');
        $estado = ['publicacao' => (string) $r['data']['publish_id'], 'envio' => (string) $r['data']['upload_url'], 'pedaco' => $pedaco, 'total' => $total, 'feitos' => 0, 'privacidade' => $privacidade];
    }
    while ($estado['feitos'] < $estado['total']) {
        if (time() + 10 > $fim) {
            return ['enviando', ''];
        }
        $inicio = $estado['feitos'] * $estado['pedaco'];
        $quanto = $estado['feitos'] === $estado['total'] - 1 ? $tamanho - $inicio : $estado['pedaco'];
        exigir_ok(http_rede('PUT', $estado['envio'], [
            'Content-Type: ' . ($video['tipo'] ?: 'video/mp4'), 'Content-Length: ' . $quanto,
            'Content-Range: bytes ' . $inicio . '-' . ($inicio + $quanto - 1) . '/' . $tamanho,
        ], null, [caminho_do_video($video), $inicio, $quanto], 300), 'Envio ao TikTok');
        $estado['feitos']++;
    }
    while (true) {
        $s = exigir_ok(http_rede('POST', $api . '/post/publish/status/fetch/', $json, json_encode(['publish_id' => $estado['publicacao']])), 'TikTok');
        $situacao = $s['data']['status'] ?? '';
        if ($situacao === 'PUBLISH_COMPLETE') {
            $id = $s['data']['publicaly_available_post_id'][0] ?? '';
            return ['publicada', $id ? 'https://www.tiktok.com/video/' . $id : 'https://www.tiktok.com/'];
        }
        if ($situacao === 'FAILED') {
            throw new ErroRede('O TikTok recusou o vídeo: ' . ($s['data']['fail_reason'] ?? 'motivo não informado') . '.');
        }
        if (time() + 5 > $fim) {
            return ['processando', ''];
        }
        sleep(4);
    }
}
