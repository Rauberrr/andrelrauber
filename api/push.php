<?php
/**
 * Notificações no navegador (Web Push).
 *
 * O aviso vai dentro da própria notificação, cifrado de ponta a ponta (RFC 8291, aes128gcm)
 * com as chaves que o navegador entregou ao se inscrever: o serviço de notificação do Google,
 * da Apple ou da Mozilla só transporta, sem conseguir ler. Assim o aviso chega mesmo com o site
 * fechado e sem a conta conectada no navegador. Aparelhos inscritos antes das chaves recebem
 * um toque vazio, e o sw.js busca o aviso em api/habitos.php?acao=avisos.
 *
 * As chaves (VAPID) são criadas no primeiro uso e ficam em api/privado, bloqueada ao acesso
 * direto e fora do repositório. Trocar as chaves desliga os lembretes de todo mundo.
 */
declare(strict_types=1);

if (!defined('AR_API')) {
    http_response_code(404);
    exit;
}

// Só os serviços de notificação dos navegadores. Evita que o servidor seja usado para chamar outros endereços.
const PUSH_HOSTS = ['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'push.services.mozilla.com', 'web.push.apple.com'];
const PUSH_SUFIXOS = ['.push.apple.com', '.notify.windows.com'];

// Opções do OpenSSL: no Windows, ele precisa do arquivo de configuração para criar chaves
function opcoes_openssl(array $extra = []): array
{
    $cnf = getenv('OPENSSL_CONF');
    if (!$cnf && PHP_OS_FAMILY === 'Windows') {
        $candidato = dirname(PHP_BINARY) . '/extras/ssl/openssl.cnf';
        if (is_file($candidato)) {
            $extra['config'] = $candidato;
        }
    }
    return $extra;
}

/** @return array{publica: string, privada: string} */
function chaves_vapid(): array
{
    $arquivo = pasta_privada() . '/vapid.json';
    if (is_file($arquivo)) {
        $dados = json_decode((string) file_get_contents($arquivo), true);
        if (is_array($dados) && is_string($dados['publica'] ?? null) && is_string($dados['privada'] ?? null)) {
            return $dados;
        }
    }
    $opcoes = opcoes_openssl(['private_key_type' => OPENSSL_KEYTYPE_EC, 'curve_name' => 'prime256v1']);
    $chave = openssl_pkey_new($opcoes);
    if ($chave === false || !openssl_pkey_export($chave, $pem, null, opcoes_openssl())) {
        throw new RuntimeException('Não foi possível criar as chaves de notificação.');
    }
    $detalhes = openssl_pkey_get_details($chave);
    $x = str_pad($detalhes['ec']['x'], 32, "\0", STR_PAD_LEFT);
    $y = str_pad($detalhes['ec']['y'], 32, "\0", STR_PAD_LEFT);
    $dados = ['publica' => base64url("\x04" . $x . $y), 'privada' => $pem];
    file_put_contents($arquivo . '.tmp', json_encode($dados));
    chmod($arquivo . '.tmp', 0600);
    rename($arquivo . '.tmp', $arquivo);
    return $dados;
}

function endereco_de_push_valido($endereco): bool
{
    if (!is_string($endereco) || strlen($endereco) > 800 || preg_match('/[\s"\'<>]/', $endereco)) {
        return false;
    }
    $partes = parse_url($endereco);
    $host = strtolower((string) ($partes['host'] ?? ''));
    if (($partes['scheme'] ?? '') !== 'https' || $host === '' || isset($partes['user']) || isset($partes['port'])) {
        // Ambiente de testes: um endereço local configurado à parte
        $extra = config()['push_teste'] ?? '';
        return $extra !== '' && strpos($endereco, (string) $extra) === 0;
    }
    if (in_array($host, PUSH_HOSTS, true)) {
        return true;
    }
    foreach (PUSH_SUFIXOS as $sufixo) {
        if (substr($host, -strlen($sufixo)) === $sufixo) {
            return true;
        }
    }
    return false;
}

// Assinatura ES256: o OpenSSL devolve no formato DER, o JWT pede os 64 bytes de r e s
function der_para_bruto(string $der): string
{
    $pos = 2;
    if (ord($der[1]) & 0x80) {
        $pos += ord($der[1]) & 0x7f;
    }
    $pos++;
    $tamanhoR = ord($der[$pos++]);
    $r = substr($der, $pos, $tamanhoR);
    $pos += $tamanhoR + 1;
    $tamanhoS = ord($der[$pos++]);
    $s = substr($der, $pos, $tamanhoS);
    return str_pad(ltrim($r, "\0"), 32, "\0", STR_PAD_LEFT) . str_pad(ltrim($s, "\0"), 32, "\0", STR_PAD_LEFT);
}

function token_vapid(string $endereco, array $chaves): string
{
    $partes = parse_url($endereco);
    $publico = ($partes['scheme'] ?? 'https') . '://' . ($partes['host'] ?? '') . (isset($partes['port']) ? ':' . $partes['port'] : '');
    $site = rtrim((string) (config()['site_url'] ?? 'https://andrerauber.com'), '/');
    $cabecalho = base64url(json_encode(['typ' => 'JWT', 'alg' => 'ES256']));
    $corpo = base64url(json_encode(['aud' => $publico, 'exp' => time() + 12 * 3600, 'sub' => $site]));
    $assinado = $cabecalho . '.' . $corpo;
    if (!openssl_sign($assinado, $der, $chaves['privada'], OPENSSL_ALGO_SHA256)) {
        throw new RuntimeException('Não foi possível assinar o aviso.');
    }
    return $assinado . '.' . base64url(der_para_bruto($der));
}

function base64url_decode(string $texto): string
{
    $b = strtr($texto, '-_', '+/');
    return (string) base64_decode($b . str_repeat('=', (4 - strlen($b) % 4) % 4), true);
}

// Chave pública P-256 crua (65 bytes) no formato que o OpenSSL entende
function chave_publica_pem(string $bruta): string
{
    $der = hex2bin('3059301306072a8648ce3d020106082a8648ce3d030107034200') . $bruta;
    return "-----BEGIN PUBLIC KEY-----\n" . chunk_split(base64_encode($der), 64, "\n") . "-----END PUBLIC KEY-----\n";
}

function chaves_do_navegador_validas($p256dh, $auth): bool
{
    if (!is_string($p256dh) || !is_string($auth) || strlen($p256dh) > 120 || strlen($auth) > 40) {
        return false;
    }
    $publica = base64url_decode($p256dh);
    return strlen($publica) === 65 && $publica[0] === "\x04" && strlen(base64url_decode($auth)) === 16;
}

/** Cifra o aviso para um navegador (RFC 8291 e RFC 8188, aes128gcm, um registro só). */
function cifrar_push(string $mensagem, string $p256dh, string $auth): string
{
    $publicaNavegador = base64url_decode($p256dh);
    $segredo = base64url_decode($auth);
    $temporaria = openssl_pkey_new(opcoes_openssl(['private_key_type' => OPENSSL_KEYTYPE_EC, 'curve_name' => 'prime256v1']));
    if ($temporaria === false) {
        throw new RuntimeException('Não foi possível criar a chave do aviso.');
    }
    $detalhes = openssl_pkey_get_details($temporaria);
    $publicaServidor = "\x04" . str_pad($detalhes['ec']['x'], 32, "\0", STR_PAD_LEFT) . str_pad($detalhes['ec']['y'], 32, "\0", STR_PAD_LEFT);
    $par = openssl_pkey_get_public(chave_publica_pem($publicaNavegador));
    $compartilhado = $par === false ? false : openssl_pkey_derive($par, $temporaria, 32);
    if ($compartilhado === false) {
        throw new RuntimeException('Chave do navegador inválida.');
    }
    $ikm = hash_hkdf('sha256', $compartilhado, 32, "WebPush: info\0" . $publicaNavegador . $publicaServidor, $segredo);
    $sal = random_bytes(16);
    $cek = hash_hkdf('sha256', $ikm, 16, "Content-Encoding: aes128gcm\0", $sal);
    $nonce = hash_hkdf('sha256', $ikm, 12, "Content-Encoding: nonce\0", $sal);
    $cifrado = openssl_encrypt($mensagem . "\x02", 'aes-128-gcm', $cek, OPENSSL_RAW_DATA, $nonce, $tag);
    return $sal . pack('N', 4096) . chr(65) . $publicaServidor . $cifrado . $tag;
}

/**
 * Manda a notificação a um navegador. Com as chaves dele, o aviso vai cifrado dentro dela;
 * sem as chaves, vai um toque vazio. Devolve o código HTTP do serviço (0 sem conexão).
 */
function enviar_push(string $endereco, ?array $aviso = null, string $p256dh = '', string $auth = ''): int
{
    if (!endereco_de_push_valido($endereco) || !function_exists('curl_init')) {
        return 0;
    }
    $chaves = chaves_vapid();
    $corpo = '';
    $cabecalhos = ['TTL: 43200', 'Urgency: high', 'Authorization: vapid t=' . token_vapid($endereco, $chaves) . ', k=' . $chaves['publica']];
    if ($aviso !== null && chaves_do_navegador_validas($p256dh, $auth)) {
        $corpo = cifrar_push((string) json_encode($aviso, JSON_UNESCAPED_UNICODE), $p256dh, $auth);
        $cabecalhos[] = 'Content-Encoding: aes128gcm';
        $cabecalhos[] = 'Content-Type: application/octet-stream';
    }
    $cabecalhos[] = 'Content-Length: ' . strlen($corpo);
    $c = curl_init($endereco);
    curl_setopt_array($c, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $corpo,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 10,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_HTTPHEADER => $cabecalhos,
    ]);
    curl_exec($c);
    $codigo = (int) curl_getinfo($c, CURLINFO_RESPONSE_CODE);
    curl_close($c);
    return $codigo;
}

/** Guarda um aviso para a pessoa e cutuca todos os aparelhos dela. Devolve quantos aceitaram. */
function avisar_por_push(int $usuarioId, string $titulo, string $texto, string $marca = 'habitos'): int
{
    consultar(
        'INSERT INTO avisos_push (usuario_id, titulo, texto, marca, criado_em) VALUES (?, ?, ?, ?, ?)',
        [$usuarioId, mb_substr($titulo, 0, 80), mb_substr($texto, 0, 200), mb_substr($marca, 0, 40), agora()]
    );
    return cutucar_aparelhos($usuarioId, [['titulo' => $titulo, 'texto' => $texto, 'marca' => $marca]]);
}

/**
 * Avisa todos os aparelhos da pessoa. Os que têm chaves recebem o aviso dentro da notificação
 * (mais de um aviso de uma vez viram um resumo); os outros, um toque para buscar.
 * @param array<int, array{titulo: string, texto: string, marca?: string, url?: string}> $avisos
 */
function cutucar_aparelhos(int $usuarioId, array $avisos = []): int
{
    $aceitos = 0;
    $aviso = null;
    if ($avisos) {
        $um = count($avisos) === 1 ? $avisos[0] : [
            'titulo' => count($avisos) . ' lembretes agora',
            'texto' => implode(' · ', array_map(function ($a) { return $a['titulo']; }, $avisos)),
            'marca' => 'varios',
        ];
        $aviso = [
            'titulo' => mb_substr((string) $um['titulo'], 0, 80),
            'texto' => mb_substr((string) $um['texto'], 0, 200),
            'marca' => (string) ($um['marca'] ?? 'habitos'),
            'url' => (string) ($um['url'] ?? '/apps/habitos/'),
        ];
    }
    try {
        $inscricoes = consultar(
            'SELECT i.id, i.endpoint, i.endpoint_hash, c.p256dh, c.auth FROM push_inscricoes i
             LEFT JOIN push_chaves c ON c.endpoint_hash = i.endpoint_hash WHERE i.usuario_id = ?',
            [$usuarioId]
        )->fetchAll();
    } catch (PDOException $erro) {
        // Banco ainda sem a tabela das chaves: vai o toque vazio
        $inscricoes = consultar('SELECT id, endpoint, endpoint_hash FROM push_inscricoes WHERE usuario_id = ?', [$usuarioId])->fetchAll();
    }
    foreach ($inscricoes as $i) {
        $codigo = enviar_push((string) $i['endpoint'], $aviso, (string) ($i['p256dh'] ?? ''), (string) ($i['auth'] ?? ''));
        if ($codigo >= 200 && $codigo < 300) {
            $aceitos++;
            consultar('UPDATE push_inscricoes SET usado_em = ? WHERE id = ?', [agora(), $i['id']]);
        } elseif ($codigo === 404 || $codigo === 410) {
            // O navegador desfez a inscrição: não adianta mais avisar por ali
            consultar('DELETE FROM push_inscricoes WHERE id = ?', [$i['id']]);
            try {
                consultar('DELETE FROM push_chaves WHERE endpoint_hash = ?', [$i['endpoint_hash']]);
            } catch (PDOException $erro) {
                // Sem a tabela das chaves, não há o que apagar
            }
        }
    }
    return $aceitos;
}
