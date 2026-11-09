<?php
/**
 * Clima de um dia, para sugerir looks. A cidade vem do pedido ou do cadastro da pessoa.
 *
 * GET ?cidade=Passo Fundo&uf=RS&data=AAAA-MM-DD   (data: de hoje até 9 dias à frente)
 *
 * Previsão: MET Norway (dados abertos, CC BY 4.0). Localização: OpenStreetMap (ODbL).
 * Os dois serviços são gratuitos e pedem poucas consultas: a localização de cada cidade
 * fica guardada por um ano e a previsão, por uma hora.
 */
declare(strict_types=1);

define('AR_API', true);
require __DIR__ . '/nucleo.php';

const CLIMA_UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];
const CLIMA_DIAS_A_FRENTE = 9;

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    header('Allow: GET');
    falhar(405, 'Método não permitido.');
}

$limite = chave_limite('clima');
exigir_limite($limite, 240, 3600);
contar_tentativa($limite);

$cidade = trim((string) preg_replace('/\s+/u', ' ', texto($_GET, 'cidade', 80)));
$uf = strtoupper(texto($_GET, 'uf', 2));
if ($cidade === '') {
    $usuario = usuario_logado();
    if ($usuario) {
        $cadastro = consultar('SELECT cidade, uf FROM cadastros WHERE usuario_id = ?', [(int) $usuario['id']])->fetch();
        if ($cadastro) {
            $cidade = trim((string) $cadastro['cidade']);
            $uf = strtoupper((string) $cadastro['uf']);
        }
    }
}
if ($cidade === '') {
    falhar(422, 'Informe a sua cidade para ver o clima.', ['semCidade' => true]);
}
if (!in_array($uf, CLIMA_UFS, true)) {
    $uf = '';
}

$hoje = date('Y-m-d');
$dia = texto($_GET, 'data', 10);
if ($dia === '') {
    // À noite, o que importa é a roupa de amanhã
    $dia = (int) date('G') >= 19 ? date('Y-m-d', strtotime($hoje . ' +1 day')) : $hoje;
}
$partes = explode('-', $dia);
if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $dia) !== 1 || !checkdate((int) $partes[1], (int) $partes[2], (int) $partes[0])) {
    falhar(422, 'Data inválida.');
}
if ($dia < $hoje || $dia > date('Y-m-d', strtotime($hoje . ' +' . CLIMA_DIAS_A_FRENTE . ' days'))) {
    falhar(422, 'A previsão só vai até ' . CLIMA_DIAS_A_FRENTE . ' dias à frente.', ['foraDoPrazo' => true]);
}

/* --- Onde fica a cidade ---------------------------------------------------------- */

$chaveLugar = 'lugar-' . substr(hash('sha256', mb_strtolower($cidade, 'UTF-8') . '|' . $uf), 0, 32);
$lugar = ler_cache($chaveLugar, 365 * 86400);
if ($lugar === null) {
    $busca = chave_limite('clima-busca');
    exigir_limite($busca, 30, 3600);
    contar_tentativa($busca);
    $resposta = buscar_json('https://nominatim.openstreetmap.org/search?' . http_build_query([
        'city' => $cidade,
        'state' => $uf,
        'country' => 'Brasil',
        'format' => 'jsonv2',
        'limit' => 1,
        'accept-language' => 'pt-BR',
    ]));
    if ($resposta === null) {
        falhar(503, 'O clima não está disponível agora. Tente de novo mais tarde.');
    }
    if (!isset($resposta[0]['lat'], $resposta[0]['lon'])) {
        falhar(404, 'Não encontramos essa cidade. Confira o nome e o estado.', ['semCidade' => true]);
    }
    $lugar = [
        'lat' => round((float) $resposta[0]['lat'], 2),
        'lon' => round((float) $resposta[0]['lon'], 2),
        'nome' => mb_substr((string) ($resposta[0]['name'] ?? $cidade), 0, 80, 'UTF-8'),
    ];
    gravar_cache($chaveLugar, $lugar);
}

/* --- Previsão --------------------------------------------------------------------- */

$chavePrevisao = 'previsao-' . str_replace(['.', '-'], ['p', 'm'], $lugar['lat'] . '_' . $lugar['lon']);
$previsao = ler_cache($chavePrevisao, 3600);
if ($previsao === null) {
    $busca = chave_limite('clima-busca');
    exigir_limite($busca, 30, 3600);
    contar_tentativa($busca);
    $resposta = buscar_json('https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=' . $lugar['lat'] . '&lon=' . $lugar['lon']);
    if ($resposta === null || !isset($resposta['properties']['timeseries']) || !is_array($resposta['properties']['timeseries'])) {
        falhar(503, 'A previsão do tempo não está disponível agora. Tente de novo mais tarde.');
    }
    // Guarda só a hora, a temperatura e a chuva
    $serie = [];
    foreach ($resposta['properties']['timeseries'] as $ponto) {
        $dados = $ponto['data'] ?? [];
        $temperatura = $dados['instant']['details']['air_temperature'] ?? null;
        if (!is_numeric($temperatura) || !isset($ponto['time'])) {
            continue;
        }
        $chuva = $dados['next_1_hours']['details']['precipitation_amount'] ?? ($dados['next_6_hours']['details']['precipitation_amount'] ?? 0);
        $serie[] = [(string) $ponto['time'], (float) $temperatura, (float) $chuva];
    }
    $previsao = ['serie' => $serie];
    gravar_cache($chavePrevisao, $previsao);
}

// Vale o período em que a pessoa está na rua, das 8h às 21h
$temperaturas = [];
$todas = [];
$chove = false;
$agora = null;
$momento = time();
foreach ($previsao['serie'] as [$hora, $temperatura, $chuva]) {
    $instante = strtotime($hora);
    if ($instante === false || date('Y-m-d', $instante) !== $dia) {
        continue;
    }
    $todas[] = $temperatura;
    $h = (int) date('G', $instante);
    if ($h >= 8 && $h <= 21) {
        $temperaturas[] = $temperatura;
        if ($chuva >= 0.5) {
            $chove = true;
        }
    }
    if ($agora === null && $instante >= $momento - 3600) {
        $agora = $temperatura;
    }
}
if (!$temperaturas) {
    $temperaturas = $todas;
}
if (!$temperaturas) {
    falhar(422, 'Ainda não há previsão para essa data.', ['foraDoPrazo' => true]);
}

$maxima = max($temperaturas);
$minima = min($temperaturas);
// A máxima pesa mais: é ela que decide se a pessoa sente calor ao longo do dia
$referencia = ($maxima * 2 + $minima) / 3;
$categoria = $referencia >= 24 ? 'calor' : ($referencia <= 16 ? 'frio' : 'meia_estacao');

responder(200, [
    'cidade' => $cidade,
    'uf' => $uf,
    'data' => $dia,
    'quando' => $dia === $hoje ? 'hoje' : ($dia === date('Y-m-d', strtotime($hoje . ' +1 day')) ? 'amanhã' : ''),
    'maxima' => round($maxima, 1),
    'minima' => round($minima, 1),
    'agora' => $dia === $hoje && $agora !== null ? round($agora, 1) : null,
    'chuva' => $chove,
    'categoria' => $categoria,
    'fonte' => 'Previsão: MET Norway. Localização: © OpenStreetMap.',
]);
