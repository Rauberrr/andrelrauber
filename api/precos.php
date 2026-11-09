<?php
/**
 * Correção mensal dos preços da Alimentação.
 *
 * Os preços da página são do DIEESE de setembro de 2026. Todo mês o IBGE divulga o IPCA,
 * e este endereço devolve quanto a "alimentação no domicílio" subiu ou caiu desde então.
 *
 * GET  →  { fator: 1.0123, base: '2026-09', ate: '2026-11', ateTexto: 'novembro de 2026', fonte }
 *
 * O IBGE é consultado no máximo a cada 12 horas. Se ele não responder, vale a última conta.
 */
declare(strict_types=1);

define('AR_API', true);
require __DIR__ . '/nucleo.php';

// Mês dos preços que estão em assets/js/alimentacao-dados.js. Ao trocar os preços, mude aqui também.
const PRECOS_BASE = '202609';
const PRECOS_MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    header('Allow: GET');
    falhar(405, 'Método não permitido.');
}

function mes_seguinte(string $aaaamm): string
{
    $ano = (int) substr($aaaamm, 0, 4);
    $mes = (int) substr($aaaamm, 4, 2) + 1;
    if ($mes > 12) {
        $mes = 1;
        $ano += 1;
    }
    return sprintf('%04d%02d', $ano, $mes);
}

function consultar_ibge(): ?array
{
    // Tabela 7060 do IBGE, variação mensal do IPCA, grupo 11: alimentação no domicílio
    $url = 'https://apisidra.ibge.gov.br/values/t/7060/n1/all/v/63/p/' . mes_seguinte(PRECOS_BASE) . '-209912/c315/7171';
    $resposta = buscar_json($url, 10);
    if ($resposta === null) {
        return null;
    }
    $fator = 1.0;
    $ate = PRECOS_BASE;
    foreach (array_slice($resposta, 1) as $linha) {
        $mes = (string) ($linha['D3C'] ?? '');
        $valor = $linha['V'] ?? '';
        if (preg_match('/^\d{6}$/', $mes) !== 1 || !is_numeric($valor) || $mes <= PRECOS_BASE) {
            continue;
        }
        $fator *= 1 + ((float) $valor) / 100;
        if ($mes > $ate) {
            $ate = $mes;
        }
    }
    return ['fator' => round($fator, 4), 'ate' => $ate];
}

$conta = ler_cache('precos-ipca', 12 * 3600);
if ($conta === null) {
    $conta = consultar_ibge();
    if ($conta !== null) {
        gravar_cache('precos-ipca', $conta);
    } else {
        $conta = ler_cache('precos-ipca', 400 * 86400) ?? ['fator' => 1.0, 'ate' => PRECOS_BASE];
    }
}

$ate = (string) $conta['ate'];
responder(200, [
    'fator' => (float) $conta['fator'],
    'base' => substr(PRECOS_BASE, 0, 4) . '-' . substr(PRECOS_BASE, 4, 2),
    'ate' => $ate === PRECOS_BASE ? null : substr($ate, 0, 4) . '-' . substr($ate, 4, 2),
    'ateTexto' => PRECOS_MESES[(int) substr($ate, 4, 2) - 1] . ' de ' . substr($ate, 0, 4),
    'fonte' => 'IPCA, alimentação no domicílio (IBGE)',
]);
