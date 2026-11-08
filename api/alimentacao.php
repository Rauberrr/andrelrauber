<?php
/**
 * Alimentação: guarda na conta o que a pessoa informou, só com a autorização dela.
 *
 * GET                  devolve os dados guardados, ou null
 * POST ?acao=salvar    guarda os dados (a primeira vez exige consentimento)
 * POST ?acao=apagar    apaga os dados da conta
 *
 * São dados de saúde: o servidor só aceita os campos e valores que a página usa,
 * e nada disso aparece no painel da marca.
 */
declare(strict_types=1);

define('AR_API', true);
require __DIR__ . '/nucleo.php';

const ALIM_REFEICOES = ['cafe', 'almoco', 'lanche', 'jantar', 'outros'];
const ALIM_FREQUENCIAS = ['diario', 'quase', 'pouco'];
const ALIM_ATIVIDADES = ['sedentario', 'leve', 'moderado', 'intenso'];
const ALIM_OBJETIVOS = ['perder', 'manter', 'ganhar'];
const ALIM_UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];
const ALIM_MAXIMO_ITENS = 150;
const ALIM_MAXIMO_REGISTROS = 200;
const ALIM_MEDIDAS = ['peso' => [40, 250], 'cintura' => [40, 200], 'torax' => [50, 200], 'braco' => [15, 70], 'coxa' => [30, 100]];

$usuario = exigir_login();
$id = (int) $usuario['id'];

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET') {
    $linha = consultar('SELECT dados, atualizado_em FROM alimentacao WHERE usuario_id = ?', [$id])->fetch();
    responder(200, [
        'dados' => $linha ? json_decode((string) $linha['dados'], true) : null,
        'atualizadoEm' => $linha ? $linha['atualizado_em'] : null,
    ]);
}

switch ($_GET['acao'] ?? '') {
    case 'salvar':
        salvar($id);
        break;
    case 'apagar':
        exigir_post();
        consultar('DELETE FROM alimentacao WHERE usuario_id = ?', [$id]);
        responder(200);
        break;
    default:
        falhar(404, 'Ação desconhecida.');
}

// Número dentro da faixa, ou vazio quando a pessoa ainda não preencheu
function numero_ou_vazio($valor, float $minimo, float $maximo)
{
    if ($valor === '' || $valor === null) {
        return '';
    }
    if (!is_int($valor) && !is_float($valor)) {
        return null;
    }
    return ($valor >= $minimo && $valor <= $maximo) ? $valor : null;
}

function opcao($valor, array $permitidos, string $padrao): string
{
    return is_string($valor) && in_array($valor, $permitidos, true) ? $valor : $padrao;
}

function eh_codigo($valor): bool
{
    return is_string($valor) && preg_match('/^[a-z_]{1,30}$/', $valor) === 1;
}

// Data no formato AAAA-MM-DD, que existe de verdade, ou vazio
function data_ou_vazio($valor): ?string
{
    if ($valor === '' || $valor === null) {
        return '';
    }
    if (!is_string($valor) || preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $valor, $p) !== 1 || !checkdate((int) $p[2], (int) $p[3], (int) $p[1])) {
        return null;
    }
    return $valor;
}

function eh_numero($valor): bool
{
    return is_int($valor) || is_float($valor);
}

// { alimento que a pessoa não gosta: alimento no lugar }
function limpar_trocas($trocas): ?array
{
    if ($trocas === null) {
        return [];
    }
    if (!is_array($trocas) || count($trocas) > 40) {
        return null;
    }
    $saida = [];
    foreach ($trocas as $de => $para) {
        if (!eh_codigo((string) $de) || !eh_codigo($para)) {
            return null;
        }
        $saida[(string) $de] = $para;
    }
    return $saida;
}

// Lista de compras: { produto: { compradoEm, embalagens, gramas, ritmo, acabouEm } }
function limpar_despensa($despensa): ?array
{
    if ($despensa === null) {
        return [];
    }
    if (!is_array($despensa) || count($despensa) > 80) {
        return null;
    }
    $saida = [];
    foreach ($despensa as $produto => $r) {
        if (!eh_codigo((string) $produto) || !is_array($r)) {
            return null;
        }
        $comprado = data_ou_vazio($r['compradoEm'] ?? '');
        $acabou = data_ou_vazio($r['acabouEm'] ?? '');
        $embalagens = $r['embalagens'] ?? 0;
        $gramas = $r['gramas'] ?? 0;
        $ritmo = $r['ritmo'] ?? 1;
        if ($comprado === null || $acabou === null || !is_int($embalagens) || $embalagens < 0 || $embalagens > 30
            || !eh_numero($gramas) || $gramas < 0 || $gramas > 200000 || !eh_numero($ritmo) || $ritmo < 0.5 || $ritmo > 2) {
            return null;
        }
        $saida[(string) $produto] = [
            'compradoEm' => $comprado, 'embalagens' => $embalagens, 'gramas' => (float) $gramas,
            'ritmo' => round((float) $ritmo, 3), 'acabouEm' => $acabou,
        ];
    }
    return $saida;
}

// Peso e medidas ao longo do tempo
function limpar_registros($registros): ?array
{
    if ($registros === null) {
        return [];
    }
    if (!is_array($registros) || count($registros) > ALIM_MAXIMO_REGISTROS) {
        return null;
    }
    $saida = [];
    foreach ($registros as $r) {
        if (!is_array($r)) {
            return null;
        }
        $data = data_ou_vazio($r['data'] ?? '');
        if ($data === null || $data === '' || $data > date('Y-m-d', time() + 86400)) {
            return null;
        }
        $limpo = ['data' => $data];
        foreach (ALIM_MEDIDAS as $medida => $faixa) {
            $valor = numero_ou_vazio($r[$medida] ?? '', $faixa[0], $faixa[1]);
            if ($valor === null) {
                return null;
            }
            $limpo[$medida] = $valor;
        }
        $saida[] = $limpo;
    }
    return $saida;
}

// Monta uma cópia só com o que a página usa. Devolve null se algo vier fora do formato.
function limpar_dados($d): ?array
{
    if (!is_array($d) || !is_array($d['perfil'] ?? null) || !is_array($d['itens'] ?? null)) {
        return null;
    }
    $p = $d['perfil'];
    $idade = numero_ou_vazio($p['idade'] ?? '', 18, 80);
    $altura = numero_ou_vazio($p['altura'] ?? '', 140, 220);
    $peso = numero_ou_vazio($p['peso'] ?? '', 40, 250);
    if ($idade === null || $altura === null || $peso === null) {
        return null;
    }
    $uf = $p['uf'] ?? '';
    if ($uf !== '' && !in_array($uf, ALIM_UFS, true)) {
        return null;
    }
    if (count($d['itens']) > ALIM_MAXIMO_ITENS) {
        return null;
    }

    $itens = [];
    foreach ($d['itens'] as $item) {
        if (!is_array($item)) {
            return null;
        }
        $alimento = $item['alimento'] ?? '';
        $qtd = $item['qtd'] ?? 0;
        $medida = $item['medida'] ?? 0;
        if (!is_string($alimento) || preg_match('/^[a-z_]{1,30}$/', $alimento) !== 1
            || (!is_int($qtd) && !is_float($qtd)) || $qtd < 0.5 || $qtd > 30
            || !is_int($medida) || $medida < 0 || $medida > 9
            || !in_array($item['refeicao'] ?? '', ALIM_REFEICOES, true)) {
            return null;
        }
        $itens[] = [
            'refeicao' => $item['refeicao'],
            'alimento' => $alimento,
            'qtd' => round((float) $qtd * 2) / 2,
            'medida' => $medida,
            'freq' => opcao($item['freq'] ?? '', ALIM_FREQUENCIAS, 'diario'),
        ];
    }

    $trocas = limpar_trocas($d['trocas'] ?? null);
    $despensa = limpar_despensa($d['despensa'] ?? null);
    $registros = limpar_registros($d['registros'] ?? null);
    $inicio = data_ou_vazio($d['inicioPlano'] ?? '');
    if ($trocas === null || $despensa === null || $registros === null || $inicio === null) {
        return null;
    }

    $alterado = $d['alteradoEm'] ?? 0;
    return [
        'perfil' => [
            'sexo' => opcao($p['sexo'] ?? '', ['m', 'f'], 'm'),
            'idade' => $idade,
            'altura' => $altura,
            'peso' => $peso,
            'atividade' => opcao($p['atividade'] ?? '', ALIM_ATIVIDADES, 'leve'),
            'objetivo' => opcao($p['objetivo'] ?? '', ALIM_OBJETIVOS, 'manter'),
            'uf' => $uf,
        ],
        'itens' => $itens,
        'modo' => opcao($d['modo'] ?? '', ['ajustar', 'novo'], 'ajustar'),
        'listaDe' => opcao($d['listaDe'] ?? '', ['plano', 'hoje'], 'plano'),
        'concluido' => ($d['concluido'] ?? false) === true,
        'guardarNaConta' => true,
        'alteradoEm' => is_int($alterado) || is_float($alterado) ? (float) $alterado : 0,
        // JSON vazio precisa sair como objeto, e não como lista, para a página ler certo
        'trocas' => (object) $trocas,
        'despensa' => (object) $despensa,
        'inicioPlano' => $inicio,
        'registros' => $registros,
    ];
}

function salvar(int $id): void
{
    $entrada = exigir_post();
    $limite = chave_limite('alimentacao', (string) $id);
    exigir_limite($limite, 300, 3600);
    contar_tentativa($limite);

    $existe = consultar('SELECT consentiu_em FROM alimentacao WHERE usuario_id = ?', [$id])->fetch();
    if (!$existe && ($entrada['consentimento'] ?? null) !== true) {
        falhar(403, 'Para guardar na sua conta, é preciso autorizar.');
    }
    $dados = limpar_dados($entrada['dados'] ?? null);
    if ($dados === null) {
        falhar(422, 'Algumas informações vieram num formato inesperado. Atualize a página e tente de novo.');
    }

    $json = json_encode($dados, JSON_UNESCAPED_UNICODE);
    $momento = agora();
    if ($existe) {
        consultar('UPDATE alimentacao SET dados = ?, atualizado_em = ? WHERE usuario_id = ?', [$json, $momento, $id]);
    } else {
        consultar('INSERT INTO alimentacao (usuario_id, dados, consentiu_em, atualizado_em) VALUES (?, ?, ?, ?)', [$id, $json, $momento, $momento]);
        // Só o fato de ter autorizado: nada de saúde vai para o histórico do painel
        registrar_evento($id, 'alimentacao_autorizada');
    }
    responder(200, ['atualizadoEm' => $momento]);
}
