<?php
/**
 * Liga as contas das redes ao painel de vídeos (só administrador).
 *
 * GET ?login=meta|google|tiktok   leva ao login da própria rede
 * GET ?code=...&state=...         a rede volta para cá; guarda os tokens e volta ao painel
 *
 * Este é o endereço de retorno que vai em cada app de desenvolvedor:
 *   https://andrerauber.com/api/conectar.php
 */
declare(strict_types=1);

define('AR_API', true);
require __DIR__ . '/nucleo.php';
require __DIR__ . '/redes.php';

function voltar_ao_painel(array $parametros): void
{
    header('Location: ' . rtrim((string) (config()['site_url'] ?? ''), '/') . '/painel-videos.html?' . http_build_query($parametros), true, 303);
    exit;
}

$usuario = usuario_logado();
if ($usuario === null || (int) $usuario['admin'] !== 1) {
    http_response_code(403);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Entre na conta de administrador e tente de novo.';
    exit;
}

$login = $_GET['login'] ?? '';
if (is_string($login) && isset(REDES_LOGIN[$login])) {
    $estado = bin2hex(random_bytes(20));
    $_SESSION['oauth_redes'] = ['estado' => $estado, 'login' => $login, 'em' => time()];
    try {
        header('Location: ' . endereco_de_login($login, $estado), true, 302);
    } catch (ErroRede $e) {
        voltar_ao_painel(['erro' => $e->getMessage()]);
    }
    exit;
}

// Volta da rede: o estado prova que o pedido saiu daqui, nesta sessão
$guardado = $_SESSION['oauth_redes'] ?? null;
unset($_SESSION['oauth_redes']);
$estado = $_GET['state'] ?? '';
if (!is_array($guardado) || !is_string($estado) || !hash_equals((string) $guardado['estado'], $estado) || time() - (int) $guardado['em'] > 900) {
    voltar_ao_painel(['erro' => 'O login demorou ou veio de outro lugar. Tente conectar de novo.']);
}
if (isset($_GET['error'])) {
    voltar_ao_painel(['erro' => 'A conexão foi cancelada na própria rede.']);
}
$codigo = $_GET['code'] ?? '';
if (!is_string($codigo) || $codigo === '' || strlen($codigo) > 2000) {
    voltar_ao_painel(['erro' => 'A rede não devolveu a autorização.']);
}
try {
    $ligados = concluir_login((string) $guardado['login'], $codigo);
    registrar_evento((int) $usuario['id'], 'redes_conectou', null, (string) $guardado['login']);
    voltar_ao_painel(['conectado' => implode(' · ', $ligados)]);
} catch (ErroRede $e) {
    voltar_ao_painel(['erro' => $e->getMessage()]);
}
