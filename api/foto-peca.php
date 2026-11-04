<?php
/**
 * Entrega a foto de uma peça, somente para a pessoa dona dela.
 */
declare(strict_types=1);

define('AR_API', true);
require __DIR__ . '/nucleo.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    header('Allow: GET');
    falhar(405, 'Método não permitido.');
}

$usuario = exigir_login();
// A sessão é liberada para várias fotos carregarem ao mesmo tempo
session_write_close();

$peca = consultar(
    'SELECT arquivo FROM pecas WHERE id = ? AND usuario_id = ?',
    [(int) ($_GET['id'] ?? 0), (int) $usuario['id']]
)->fetch();
$arquivo = $peca ? (string) $peca['arquivo'] : '';

if (preg_match('/^[a-f0-9]{32}\.(webp|png|jpg)$/', $arquivo, $partes) !== 1) {
    falhar(404, 'Foto não encontrada.');
}
$caminho = pasta_fotos() . '/' . $arquivo;
if (!is_file($caminho)) {
    falhar(404, 'Foto não encontrada.');
}

$tipos = ['webp' => 'image/webp', 'png' => 'image/png', 'jpg' => 'image/jpeg'];
header('Content-Type: ' . $tipos[$partes[1]]);
header('Content-Length: ' . filesize($caminho));
header('Cache-Control: private, max-age=604800');
header("Content-Security-Policy: default-src 'none'");
readfile($caminho);
