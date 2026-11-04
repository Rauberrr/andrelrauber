<?php
/**
 * Painel do dono da marca: quem se cadastrou, até onde foi e o que respondeu.
 * Só responde para contas marcadas como admin no banco de dados.
 */
declare(strict_types=1);

define('AR_API', true);
require __DIR__ . '/nucleo.php';

$usuario = exigir_login();
if ((int) $usuario['admin'] !== 1) {
    falhar(403, 'Sem permissão.');
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    header('Allow: GET');
    falhar(405, 'Método não permitido.');
}

$id = (int) ($_GET['id'] ?? 0);
if ($id > 0) {
    $pessoa = consultar(
        'SELECT u.id, u.nome, u.email, u.telefone, u.origem, u.criado_em, u.ultimo_acesso_em, u.consentiu_em, c.*
         FROM usuarios u LEFT JOIN cadastros c ON c.usuario_id = u.id WHERE u.id = ?',
        [$id]
    )->fetch();
    if (!$pessoa) {
        falhar(404, 'Pessoa não encontrada.');
    }
    $eventos = consultar('SELECT tipo, etapa, detalhes, criado_em FROM eventos WHERE usuario_id = ? ORDER BY id DESC LIMIT 300', [$id])->fetchAll();
    responder(200, ['pessoa' => $pessoa, 'eventos' => $eventos]);
}

$pessoas = consultar(
    'SELECT u.id, u.nome, u.email, u.telefone, u.origem, u.criado_em, u.ultimo_acesso_em, c.*
     FROM usuarios u LEFT JOIN cadastros c ON c.usuario_id = u.id
     ORDER BY COALESCE(c.atualizado_em, u.criado_em) DESC, u.id DESC
     LIMIT 1000'
)->fetchAll();

responder(200, ['pessoas' => $pessoas]);
