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
