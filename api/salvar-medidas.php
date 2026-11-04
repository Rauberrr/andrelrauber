<?php
/**
 * Recebe as medidas do formulário e grava no banco de dados MySQL.
 * Só é chamado quando salvarNoBanco está true em assets/js/config.js.
 * Compatível com PHP 7.4 ou superior.
 */
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

function responder(int $status, array $dados): void
{
    http_response_code($status);
    echo json_encode($dados, JSON_UNESCAPED_UNICODE);
    exit;
}

function texto(array $origem, string $chave, int $limite): string
{
    $valor = $origem[$chave] ?? '';
    if (!is_string($valor)) {
        return '';
    }
    return mb_substr(trim($valor), 0, $limite, 'UTF-8');
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    responder(405, ['ok' => false, 'erro' => 'Método não permitido.']);
}

// Aceita pedidos vindos apenas do próprio site
$origem = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origem !== '' && parse_url($origem, PHP_URL_HOST) !== parse_url('//' . ($_SERVER['HTTP_HOST'] ?? ''), PHP_URL_HOST)) {
    responder(403, ['ok' => false, 'erro' => 'Origem não permitida.']);
}

$bruto = file_get_contents('php://input', false, null, 0, 20000);
$dados = json_decode($bruto === false ? '' : $bruto, true);
if (!is_array($dados)) {
    responder(400, ['ok' => false, 'erro' => 'Dados inválidos.']);
}

// Campo escondido: só robôs preenchem. Responde ok e não grava nada.
if (texto($dados, 'website', 200) !== '') {
    responder(200, ['ok' => true]);
}

$nome = texto($dados, 'nome', 120);
$telefone = preg_replace('/\D/', '', texto($dados, 'telefone', 30));
$cidade = texto($dados, 'cidade', 120);
$parteCima = !empty($dados['parte_cima']);
$parteBaixo = !empty($dados['parte_baixo']);

if ($nome === '' || strlen((string) $telefone) < 10 || strlen((string) $telefone) > 11 || $cidade === '' || (!$parteCima && !$parteBaixo)) {
    responder(422, ['ok' => false, 'erro' => 'Preencha os campos obrigatórios.']);
}

// Lista fechada de medidas: nada fora dela chega ao SQL
$colunasMedidas = [
    'altura', 'peso',
    'pescoco', 'ombro', 'torax', 'cintura_cima', 'manga', 'braco', 'punho', 'comprimento_peca',
    'cintura_baixo', 'quadril', 'gancho', 'coxa', 'joelho', 'boca', 'comprimento_total',
];
$medidas = is_array($dados['medidas'] ?? null) ? $dados['medidas'] : [];
$valoresMedidas = [];
foreach ($colunasMedidas as $coluna) {
    $valor = $medidas[$coluna] ?? null;
    $valoresMedidas[$coluna] = (is_numeric($valor) && $valor > 0 && $valor < 1000) ? round((float) $valor, 1) : null;
}

$dataDesejada = texto($dados, 'data_desejada', 10);
$data = DateTime::createFromFormat('Y-m-d', $dataDesejada);
if (!$data || $data->format('Y-m-d') !== $dataDesejada) {
    $dataDesejada = null;
}

$caminhoConfig = __DIR__ . '/config.php';
if (!is_file($caminhoConfig)) {
    error_log('Andre Rauber: api/config.php não encontrado.');
    responder(503, ['ok' => false, 'erro' => 'Serviço indisponível.']);
}
$config = require $caminhoConfig;

try {
    $pdo = new PDO(
        'mysql:host=' . $config['host'] . ';dbname=' . $config['banco'] . ';charset=utf8mb4',
        $config['usuario'],
        $config['senha'],
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_EMULATE_PREPARES => false]
    );

    // Limite por conexão. Guarda só um resumo do IP, nunca o IP em si.
    $resumoIp = hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . $config['segredo']);
    $consulta = $pdo->prepare('SELECT COUNT(*) FROM medidas_clientes WHERE ip_resumo = ? AND criado_em > (NOW() - INTERVAL 1 HOUR)');
    $consulta->execute([$resumoIp]);
    if ((int) $consulta->fetchColumn() >= 10) {
        responder(429, ['ok' => false, 'erro' => 'Muitos envios. Tente mais tarde.']);
    }

    $colunas = array_merge(
        ['nome', 'telefone', 'cidade', 'parte_cima', 'parte_baixo', 'tamanho', 'cor', 'tecido', 'caimento', 'data_desejada', 'observacoes', 'ip_resumo'],
        $colunasMedidas
    );
    $valores = array_merge(
        [
            $nome, $telefone, $cidade, $parteCima ? 1 : 0, $parteBaixo ? 1 : 0,
            texto($dados, 'tamanho', 60), texto($dados, 'cor', 80), texto($dados, 'tecido', 80),
            texto($dados, 'caimento', 40), $dataDesejada, texto($dados, 'observacoes', 800), $resumoIp,
        ],
        array_values($valoresMedidas)
    );

    $sql = 'INSERT INTO medidas_clientes (' . implode(', ', $colunas) . ') VALUES (' . implode(', ', array_fill(0, count($colunas), '?')) . ')';
    $pdo->prepare($sql)->execute($valores);

    responder(201, ['ok' => true]);
} catch (Throwable $erro) {
    error_log('Andre Rauber: ' . $erro->getMessage());
    responder(500, ['ok' => false, 'erro' => 'Não foi possível salvar.']);
}
