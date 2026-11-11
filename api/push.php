<?php
/**
 * Notificações no navegador (Web Push), sem conteúdo no envio.
 *
 * O servidor só "cutuca" o navegador da pessoa. Quem decide o que mostrar é o sw.js, que
 * busca os avisos em api/habitos.php?acao=avisos com a própria conta. Assim nada do que a
 * pessoa anotou passa pelos serviços de notificação do Google, da Apple ou da Mozilla.
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

/** Cutuca um navegador. Devolve o código HTTP do serviço (0 sem conexão). */
function enviar_push(string $endereco): int
{
    if (!endereco_de_push_valido($endereco) || !function_exists('curl_init')) {
        return 0;
    }
    $chaves = chaves_vapid();
    $c = curl_init($endereco);
    curl_setopt_array($c, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => '',
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 10,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_HTTPHEADER => [
            'TTL: 3600',
            'Urgency: high',
            'Content-Length: 0',
            'Authorization: vapid t=' . token_vapid($endereco, $chaves) . ', k=' . $chaves['publica'],
        ],
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
    return cutucar_aparelhos($usuarioId);
}

function cutucar_aparelhos(int $usuarioId): int
{
    $aceitos = 0;
    $inscricoes = consultar('SELECT id, endpoint FROM push_inscricoes WHERE usuario_id = ?', [$usuarioId])->fetchAll();
    foreach ($inscricoes as $i) {
        $codigo = enviar_push((string) $i['endpoint']);
        if ($codigo >= 200 && $codigo < 300) {
            $aceitos++;
            consultar('UPDATE push_inscricoes SET usado_em = ? WHERE id = ?', [agora(), $i['id']]);
        } elseif ($codigo === 404 || $codigo === 410) {
            // O navegador desfez a inscrição: não adianta mais avisar por ali
            consultar('DELETE FROM push_inscricoes WHERE id = ?', [$i['id']]);
        }
    }
    return $aceitos;
}
