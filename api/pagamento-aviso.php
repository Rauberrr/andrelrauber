<?php
/**
 * Recebe os avisos de pagamento do Mercado Pago.
 *
 * A assinatura impede avisos falsos, e o site ainda consulta o pagamento no
 * Mercado Pago antes de mudar qualquer pedido.
 */
declare(strict_types=1);

define('AR_API', true);
require __DIR__ . '/nucleo.php';
require __DIR__ . '/mercadopago.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    falhar(405, 'Método não permitido.');
}

$segredo = trim((string) (config()['mercadopago_assinatura'] ?? ''));
if ($segredo === '' || !mp_ativo()) {
    falhar(503, 'Pagamentos não configurados.');
}

$bruto = file_get_contents('php://input', false, null, 0, 64000);
$aviso = json_decode($bruto === false ? '' : $bruto, true);
$aviso = is_array($aviso) ? $aviso : [];

// O PHP troca o ponto de data.id por sublinhado ao ler o endereço
$dadoId = (string) ($_GET['data_id'] ?? '');
if (!mp_assinatura_valida(
    (string) ($_SERVER['HTTP_X_SIGNATURE'] ?? ''),
    (string) ($_SERVER['HTTP_X_REQUEST_ID'] ?? ''),
    $dadoId,
    $segredo
)) {
    falhar(401, 'Assinatura inválida.');
}

$tipo = (string) ($aviso['type'] ?? ($_GET['type'] ?? ''));
$avisoId = $dadoId !== '' ? $dadoId : (string) ($aviso['data']['id'] ?? '');
// Assinatura dos apps: criada, autorizada, pausada ou cancelada
if ($tipo === 'subscription_preapproval') {
    if (!mp_sincronizar_assinatura($avisoId)) {
        falhar(503, 'Assinatura não consultada.');
    }
    responder(200);
}
// Cada cobrança mensal da assinatura
if ($tipo === 'subscription_authorized_payment') {
    if (!mp_sincronizar_cobranca_da_assinatura($avisoId)) {
        falhar(503, 'Cobrança não consultada.');
    }
    responder(200);
}
if ($tipo !== 'payment') {
    responder(200);
}

$pagamentoId = $dadoId !== '' ? $dadoId : (string) ($aviso['data']['id'] ?? '');
$pagamento = mp_consultar_pagamento($pagamentoId);
if ($pagamento === null) {
    // Faz o Mercado Pago tentar de novo mais tarde
    falhar(503, 'Pagamento não consultado.');
}
mp_aplicar_pagamento($pagamento);
responder(200);
