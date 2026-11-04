<?php
/**
 * Cadastro da pessoa logada: lê e salva cada resposta assim que ela é dada,
 * mesmo incompleta, para ser possível ver onde cada pessoa parou.
 */
declare(strict_types=1);

define('AR_API', true);
require __DIR__ . '/nucleo.php';

const CAMPOS_TEXTO = [
    'logradouro' => 160, 'numero' => 20, 'complemento' => 80, 'bairro' => 80, 'cidade' => 80,
    'tamanho' => 60, 'cor' => 80, 'tecido' => 80, 'caimento' => 40, 'observacoes' => 800,
];
const MEDIDAS_GERAIS = ['altura', 'peso'];
const MEDIDAS_CIMA = ['pescoco', 'ombro', 'torax', 'cintura_cima', 'manga', 'braco', 'punho', 'comprimento_peca'];
const MEDIDAS_BAIXO = ['cintura_baixo', 'quadril', 'gancho', 'coxa', 'joelho', 'boca', 'comprimento_total'];
const ENDERECO_OBRIGATORIO = ['cep', 'logradouro', 'numero', 'bairro', 'cidade', 'uf'];
const CAIMENTOS = ['', 'Ajustado', 'Regular', 'Amplo', 'Quero orientação'];

$usuario = exigir_login();

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET') {
    responder(200, ['usuario' => dados_publicos($usuario), 'cadastro' => cadastro_de((int) $usuario['id'])]);
}

$dados = exigir_post();
switch ($_GET['acao'] ?? 'salvar') {
    case 'salvar':
        acao_salvar($usuario, $dados);
        break;
    case 'concluir':
        acao_concluir($usuario);
        break;
    default:
        falhar(404, 'Ação desconhecida.');
}

function cadastro_de(int $id): array
{
    $cadastro = consultar('SELECT * FROM cadastros WHERE usuario_id = ?', [$id])->fetch();
    if (!$cadastro) {
        consultar('INSERT INTO cadastros (usuario_id) VALUES (?)', [$id]);
        $cadastro = consultar('SELECT * FROM cadastros WHERE usuario_id = ?', [$id])->fetch();
    }
    return $cadastro;
}

function preenchido($valor): bool
{
    return $valor !== null && $valor !== '';
}

// O que ainda falta para o cadastro estar completo
function pendencias(array $usuario, array $cadastro): array
{
    $faltam = [];
    if (!preenchido($usuario['nome'])) {
        $faltam[] = 'nome';
    }
    if (!telefone_valido((string) $usuario['telefone'])) {
        $faltam[] = 'telefone';
    }
    foreach (ENDERECO_OBRIGATORIO as $campo) {
        if ($campo === 'cep' ? strlen((string) $cadastro['cep']) !== 8 : !preenchido($cadastro[$campo])) {
            $faltam[] = $campo;
        }
    }
    foreach (MEDIDAS_GERAIS as $campo) {
        if (!preenchido($cadastro[$campo])) {
            $faltam[] = $campo;
        }
    }
    foreach ([['parte_cima', MEDIDAS_CIMA], ['parte_baixo', MEDIDAS_BAIXO]] as [$parte, $medidas]) {
        if ($cadastro[$parte] === null) {
            $faltam[] = $parte;
        } elseif ((int) $cadastro[$parte] === 1) {
            foreach ($medidas as $campo) {
                if (!preenchido($cadastro[$campo])) {
                    $faltam[] = $campo;
                }
            }
        }
    }
    if ($cadastro['parte_cima'] !== null && $cadastro['parte_baixo'] !== null
        && (int) $cadastro['parte_cima'] === 0 && (int) $cadastro['parte_baixo'] === 0) {
        $faltam[] = 'parte_cima';
    }
    return $faltam;
}

// Percentual preenchido. Enquanto a parte não foi respondida, conta como se fosse sim.
function calcular_progresso(array $usuario, array $cadastro): int
{
    $total = 2 + count(ENDERECO_OBRIGATORIO) + count(MEDIDAS_GERAIS) + 2;
    foreach ([['parte_cima', MEDIDAS_CIMA], ['parte_baixo', MEDIDAS_BAIXO]] as [$parte, $medidas]) {
        if ($cadastro[$parte] === null || (int) $cadastro[$parte] === 1) {
            $total += count($medidas);
        }
    }
    $faltam = count(array_unique(array_merge(
        pendencias($usuario, $cadastro),
        // Partes sem resposta ainda escondem as medidas delas
        $cadastro['parte_cima'] === null ? MEDIDAS_CIMA : [],
        $cadastro['parte_baixo'] === null ? MEDIDAS_BAIXO : []
    )));
    return (int) max(0, min(100, floor(($total - $faltam) * 100 / $total)));
}

function normalizar_medida($valor): ?float
{
    if (is_string($valor)) {
        $valor = str_replace(',', '.', trim($valor));
    }
    // A coluna guarda até 999,9: um valor maior daria erro ao gravar
    if (!is_numeric($valor) || $valor <= 0 || $valor > 999.9) {
        return null;
    }
    return round((float) $valor, 1);
}

function acao_salvar(array $usuario, array $dados): void
{
    $id = (int) $usuario['id'];
    $cadastro = cadastro_de($id);
    $campos = is_array($dados['campos'] ?? null) ? $dados['campos'] : [];
    $etapa = texto($dados, 'etapa', 30);
    if ($etapa !== '' && !preg_match('/^[a-z_]+$/', $etapa)) {
        $etapa = '';
    }

    $alterarConta = [];
    if (array_key_exists('consentimento', $campos) && $campos['consentimento'] === true && $usuario['consentiu_em'] === null) {
        $alterarConta['consentiu_em'] = agora();
        $usuario['consentiu_em'] = $alterarConta['consentiu_em'];
    }
    // Sem o aceite da política, nenhum dado pessoal é gravado
    if ($usuario['consentiu_em'] === null) {
        falhar(403, 'Para continuar, é preciso concordar com a política de privacidade.', ['campos' => ['consentimento' => 'É preciso concordar para continuar.']]);
    }

    if (array_key_exists('nome', $campos)) {
        $alterarConta['nome'] = texto($campos, 'nome', 120);
    }
    if (array_key_exists('telefone', $campos)) {
        $alterarConta['telefone'] = so_digitos(texto($campos, 'telefone', 30), 11);
    }

    $alterar = [];
    foreach (CAMPOS_TEXTO as $campo => $limite) {
        if (array_key_exists($campo, $campos)) {
            $alterar[$campo] = texto($campos, $campo, $limite);
        }
    }
    if (isset($alterar['caimento']) && !in_array($alterar['caimento'], CAIMENTOS, true)) {
        unset($alterar['caimento']);
    }
    if (array_key_exists('cep', $campos)) {
        $alterar['cep'] = so_digitos(texto($campos, 'cep', 12), 8);
    }
    if (array_key_exists('uf', $campos)) {
        $alterar['uf'] = substr((string) preg_replace('/[^A-Z]/', '', strtoupper(texto($campos, 'uf', 2))), 0, 2);
    }
    if (array_key_exists('data_desejada', $campos)) {
        $data = texto($campos, 'data_desejada', 10);
        $lida = DateTime::createFromFormat('Y-m-d', $data);
        $alterar['data_desejada'] = ($lida && $lida->format('Y-m-d') === $data) ? $data : null;
    }
    foreach (['parte_cima', 'parte_baixo'] as $parte) {
        if (array_key_exists($parte, $campos)) {
            $alterar[$parte] = $campos[$parte] === null ? null : ($campos[$parte] ? 1 : 0);
        }
    }
    foreach (array_merge(MEDIDAS_GERAIS, MEDIDAS_CIMA, MEDIDAS_BAIXO) as $medida) {
        if (array_key_exists($medida, $campos)) {
            $alterar[$medida] = $campos[$medida] === null || $campos[$medida] === '' ? null : normalizar_medida($campos[$medida]);
        }
    }

    // Só registra o que mudou de verdade
    $mudaram = [];
    foreach ($alterar as $campo => $valor) {
        $antes = $cadastro[$campo];
        $igual = is_float($valor)
            ? ($antes !== null && abs((float) $antes - $valor) < 0.001)
            : (($antes === null) === ($valor === null) && (string) $antes === (string) $valor);
        if ($igual) {
            unset($alterar[$campo]);
        } else {
            $mudaram[] = $campo;
            $cadastro[$campo] = $valor;
        }
    }
    foreach ($alterarConta as $campo => $valor) {
        if ((string) ($usuario[$campo] ?? '') !== (string) $valor || $campo === 'consentiu_em') {
            $mudaram[] = $campo;
        } else {
            unset($alterarConta[$campo]);
        }
        $usuario[$campo] = $valor;
    }

    $momento = agora();
    if ($alterarConta) {
        $partes = implode(', ', array_map(function (string $c): string { return $c . ' = ?'; }, array_keys($alterarConta)));
        consultar("UPDATE usuarios SET {$partes} WHERE id = ?", array_merge(array_values($alterarConta), [$id]));
    }

    $etapaMudou = $etapa !== '' && $etapa !== (string) ($cadastro['etapa_atual'] ?? '');
    if ($etapaMudou) {
        $alterar['etapa_atual'] = $etapa;
        $cadastro['etapa_atual'] = $etapa;
    }
    if ($mudaram || $etapaMudou) {
        $progresso = calcular_progresso($usuario, $cadastro);
        $alterar['progresso'] = $progresso;
        $alterar['atualizado_em'] = $momento;
        if ($cadastro['iniciado_em'] === null) {
            $alterar['iniciado_em'] = $momento;
        }
        $partes = implode(', ', array_map(function (string $c): string { return $c . ' = ?'; }, array_keys($alterar)));
        consultar("UPDATE cadastros SET {$partes} WHERE usuario_id = ?", array_merge(array_values($alterar), [$id]));
    } else {
        $progresso = (int) $cadastro['progresso'];
    }

    consultar('UPDATE usuarios SET ultimo_acesso_em = ? WHERE id = ?', [$momento, $id]);
    if ($etapaMudou) {
        registrar_evento($id, 'etapa', $etapa);
    }
    if ($mudaram) {
        registrar_evento($id, 'respostas', $etapa !== '' ? $etapa : null, implode(', ', $mudaram));
    }

    responder(200, ['progresso' => $progresso]);
}

function acao_concluir(array $usuario): void
{
    $id = (int) $usuario['id'];
    $cadastro = cadastro_de($id);
    $faltam = pendencias($usuario, $cadastro);
    if ($faltam) {
        falhar(422, 'Ainda faltam algumas informações.', ['pendentes' => array_values(array_unique($faltam))]);
    }

    $primeiraVez = $cadastro['concluido_em'] === null;
    $momento = agora();
    consultar(
        'UPDATE cadastros SET concluido_em = ?, atualizado_em = ?, progresso = 100, etapa_atual = ? WHERE usuario_id = ?',
        [$primeiraVez ? $momento : $cadastro['concluido_em'], $momento, 'revisao', $id]
    );
    registrar_evento($id, $primeiraVez ? 'concluido' : 'atualizado');

    $aviso = (string) (config()['email_aviso'] ?? '');
    if ($aviso !== '') {
        $titulo = $primeiraVez ? 'Novo cadastro concluído' : 'Cadastro atualizado';
        $telefone = (string) $usuario['telefone'];
        enviar_email(
            $aviso,
            $titulo . ': ' . $usuario['nome'],
            "{$titulo}.\n\nNome: {$usuario['nome']}\nTelefone: {$telefone}\nE-mail: {$usuario['email']}\n\nVeja tudo no painel:\n" .
            rtrim((string) config()['site_url'], '/') . '/painel.html'
        );
    }

    responder(200, ['primeiraVez' => $primeiraVez]);
}
