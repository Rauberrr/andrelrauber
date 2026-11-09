<?php
/**
 * Ocasiões e Treino: guarda na conta o que a pessoa anotou em cada app.
 *
 * GET  ?app=ocasioes|treino                 devolve os dados guardados, ou null
 * POST ?app=ocasioes|treino&acao=salvar     guarda os dados
 * POST ?app=ocasioes|treino&acao=apagar     apaga os dados da conta
 *
 * O Treino fala do corpo e da rotina da pessoa: só é guardado com a autorização dela,
 * como a Alimentação. O servidor só aceita os campos e valores que cada página usa.
 */
declare(strict_types=1);

define('AR_API', true);
require __DIR__ . '/nucleo.php';

const APPS = ['ocasioes', 'treino'];
const APPS_COM_AUTORIZACAO = ['treino'];
const APPS_UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

// Acompanham as listas de assets/js/ocasioes-dados.js
const OC_TIPOS = ['casamento', 'formatura', 'batizado', 'aniversario', 'jantar', 'entrevista', 'trabalho', 'religioso', 'viagem', 'outro'];
const OC_TRAJES = ['nao_informado', 'black_tie', 'social', 'esporte_fino', 'passeio', 'casual', 'praia'];
const OC_PAPEIS = ['convidado', 'padrinho', 'noivo', 'formando', 'anfitriao', 'candidato'];
const OC_ATIVIDADES = ['passeio', 'trabalho', 'jantar', 'formal', 'praia', 'esporte', 'frio'];
const OC_CLIMAS = ['auto', 'calor', 'meia_estacao', 'frio', 'variado'];
const OC_MAXIMO_EVENTOS = 60;

// Acompanham as listas de assets/js/treino-dados.js
const TR_OBJETIVOS = ['emagrecer', 'massa', 'saude'];
const TR_NIVEIS = ['iniciante', 'intermediario'];
const TR_LOCAIS = ['academia', 'halteres', 'casa'];
const TR_TEMPOS = [30, 45, 60];
const TR_CUIDADOS = ['joelho', 'ombro', 'lombar'];
const TR_ESFORCOS = ['leve', 'ok', 'pesado'];
const TR_MAXIMO_SESSOES = 500;

$app = $_GET['app'] ?? '';
if (!in_array($app, APPS, true)) {
    falhar(404, 'App desconhecido.');
}
$usuario = exigir_login();
$id = (int) $usuario['id'];

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET') {
    $linha = consultar('SELECT dados, atualizado_em FROM apps_dados WHERE usuario_id = ? AND app = ?', [$id, $app])->fetch();
    responder(200, [
        'dados' => $linha ? json_decode((string) $linha['dados'], true) : null,
        'atualizadoEm' => $linha ? $linha['atualizado_em'] : null,
    ]);
}

switch ($_GET['acao'] ?? '') {
    case 'salvar':
        salvar_app($id, $app);
        break;
    case 'apagar':
        exigir_post();
        consultar('DELETE FROM apps_dados WHERE usuario_id = ? AND app = ?', [$id, $app]);
        responder(200);
        break;
    default:
        falhar(404, 'Ação desconhecida.');
}

/* --- Formatos simples ----------------------------------------------------------------- */

function data_ou_vazia($valor): ?string
{
    if ($valor === '' || $valor === null) {
        return '';
    }
    if (!is_string($valor) || preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $valor, $p) !== 1 || !checkdate((int) $p[2], (int) $p[3], (int) $p[1])) {
        return null;
    }
    return $valor;
}

function uma_de($valor, array $permitidos, $padrao)
{
    return in_array($valor, $permitidos, true) ? $valor : $padrao;
}

function linha_de_texto(array $origem, string $chave, int $limite): string
{
    return str_replace(["\r", "\n"], ' ', texto($origem, $chave, $limite));
}

function codigo_valido($valor, int $limite = 40): bool
{
    return is_string($valor) && preg_match('/^[a-z0-9_-]{1,' . $limite . '}$/', $valor) === 1;
}

function momento($valor): float
{
    return is_int($valor) || is_float($valor) ? (float) $valor : 0.0;
}

/* --- Ocasiões ------------------------------------------------------------------------------ */

function limpar_ocasioes($d): ?array
{
    if (!is_array($d) || !is_array($d['eventos'] ?? null) || count($d['eventos']) > OC_MAXIMO_EVENTOS) {
        return null;
    }
    $eventos = [];
    foreach ($d['eventos'] as $e) {
        if (!is_array($e) || !codigo_valido($e['id'] ?? null, 16)) {
            return null;
        }
        $data = data_ou_vazia($e['data'] ?? '');
        $volta = data_ou_vazia($e['volta'] ?? '');
        $encomendar = data_ou_vazia($e['encomendarAte'] ?? '');
        if ($data === null || $data === '' || $volta === null || $encomendar === null) {
            return null;
        }
        $atividades = [];
        foreach ((is_array($e['atividades'] ?? null) ? $e['atividades'] : []) as $a) {
            if (in_array($a, OC_ATIVIDADES, true) && !in_array($a, $atividades, true)) {
                $atividades[] = $a;
            }
        }
        $look = [];
        foreach ((is_array($e['look'] ?? null) ? array_slice($e['look'], 0, 8) : []) as $peca) {
            if (is_int($peca) && $peca > 0) {
                $look[] = $peca;
            }
        }
        $mala = [];
        foreach ((is_array($e['mala'] ?? null) ? array_slice($e['mala'], 0, 150, true) : []) as $chave => $feito) {
            if (codigo_valido((string) $chave) && $feito === true) {
                $mala[(string) $chave] = true;
            }
        }
        $uf = $e['uf'] ?? '';
        $eventos[] = [
            'id' => $e['id'],
            'tipo' => uma_de($e['tipo'] ?? '', OC_TIPOS, 'outro'),
            'nome' => linha_de_texto($e, 'nome', 60),
            'data' => $data,
            'periodo' => uma_de($e['periodo'] ?? '', ['dia', 'noite'], 'noite'),
            'traje' => uma_de($e['traje'] ?? '', OC_TRAJES, 'nao_informado'),
            'papel' => uma_de($e['papel'] ?? '', OC_PAPEIS, 'convidado'),
            'cidade' => linha_de_texto($e, 'cidade', 80),
            'uf' => in_array($uf, APPS_UFS, true) ? $uf : '',
            'volta' => $volta,
            'atividades' => $atividades,
            'climaViagem' => uma_de($e['climaViagem'] ?? '', OC_CLIMAS, 'auto'),
            'mala' => (object) $mala,
            'look' => $look,
            'encomendarAte' => $encomendar,
            'encomendado' => ($e['encomendado'] ?? false) === true,
            'situacao' => uma_de($e['situacao'] ?? '', ['pronto', 'falta', ''], ''),
            'criadoEm' => momento($e['criadoEm'] ?? 0),
        ];
    }
    return [
        'eventos' => $eventos,
        'lembretes' => ($d['lembretes'] ?? false) === true,
        'alteradoEm' => momento($d['alteradoEm'] ?? 0),
    ];
}

/* --- Treino ---------------------------------------------------------------------------------- */

function limpar_treino($d): ?array
{
    if (!is_array($d) || !is_array($d['perfil'] ?? null)) {
        return null;
    }
    $p = $d['perfil'];
    $dias = $p['dias'] ?? 3;
    if (!is_int($dias) || $dias < 2 || $dias > 6) {
        return null;
    }
    $cuidados = [];
    foreach ((is_array($p['cuidados'] ?? null) ? $p['cuidados'] : []) as $c) {
        if (in_array($c, TR_CUIDADOS, true) && !in_array($c, $cuidados, true)) {
            $cuidados[] = $c;
        }
    }

    $sessoes = [];
    $lista = is_array($d['sessoes'] ?? null) ? $d['sessoes'] : [];
    if (count($lista) > TR_MAXIMO_SESSOES) {
        return null;
    }
    foreach ($lista as $s) {
        if (!is_array($s)) {
            return null;
        }
        $data = data_ou_vazia($s['data'] ?? '');
        if ($data === null || $data === '' || $data > date('Y-m-d', time() + 86400)) {
            return null;
        }
        $cargas = [];
        foreach ((is_array($s['cargas'] ?? null) ? array_slice($s['cargas'], 0, 15, true) : []) as $ex => $kg) {
            if (codigo_valido((string) $ex) && (is_int($kg) || is_float($kg)) && $kg >= 0 && $kg <= 500) {
                $cargas[(string) $ex] = round((float) $kg, 1);
            }
        }
        $feitos = $s['feitos'] ?? 0;
        $sessoes[] = [
            'data' => $data,
            'treino' => is_string($s['treino'] ?? null) && preg_match('/^[A-F]$/', $s['treino']) === 1 ? $s['treino'] : 'A',
            'esforco' => uma_de($s['esforco'] ?? '', TR_ESFORCOS, 'ok'),
            'feitos' => is_int($feitos) && $feitos >= 0 && $feitos <= 15 ? $feitos : 0,
            'cargas' => (object) $cargas,
        ];
    }

    $trocas = [];
    foreach ((is_array($d['trocas'] ?? null) ? array_slice($d['trocas'], 0, 30, true) : []) as $de => $para) {
        if (codigo_valido((string) $de) && codigo_valido($para)) {
            $trocas[(string) $de] = $para;
        }
    }
    $resumo = is_array($d['resumo'] ?? null) ? $d['resumo'] : [];

    return [
        'perfil' => [
            'objetivo' => uma_de($p['objetivo'] ?? '', TR_OBJETIVOS, 'saude'),
            'nivel' => uma_de($p['nivel'] ?? '', TR_NIVEIS, 'iniciante'),
            'dias' => $dias,
            'local' => uma_de($p['local'] ?? '', TR_LOCAIS, 'academia'),
            'tempo' => uma_de($p['tempo'] ?? 45, TR_TEMPOS, 45),
            'cuidados' => $cuidados,
        ],
        'sessoes' => $sessoes,
        'trocas' => (object) $trocas,
        'resumo' => ['proximo' => linha_de_texto($resumo, 'proximo', 60)],
        'guardarNaConta' => true,
        'alteradoEm' => momento($d['alteradoEm'] ?? 0),
    ];
}

/* --- Guardar ---------------------------------------------------------------------------------- */

function salvar_app(int $id, string $app): void
{
    $entrada = exigir_post();
    $limite = chave_limite('apps-' . $app, (string) $id);
    exigir_limite($limite, 300, 3600);
    contar_tentativa($limite);

    $existe = consultar('SELECT consentiu_em FROM apps_dados WHERE usuario_id = ? AND app = ?', [$id, $app])->fetch();
    $precisaAutorizar = in_array($app, APPS_COM_AUTORIZACAO, true);
    if ($precisaAutorizar && !$existe && ($entrada['consentimento'] ?? null) !== true) {
        falhar(403, 'Para guardar na sua conta, é preciso autorizar.');
    }
    $dados = $app === 'ocasioes' ? limpar_ocasioes($entrada['dados'] ?? null) : limpar_treino($entrada['dados'] ?? null);
    if ($dados === null) {
        falhar(422, 'Algumas informações vieram num formato inesperado. Atualize a página e tente de novo.');
    }

    $json = json_encode($dados, JSON_UNESCAPED_UNICODE);
    if (strlen($json) > 500000) {
        falhar(413, 'Informações demais para guardar. Apague registros antigos e tente de novo.');
    }
    $momento = agora();
    if ($existe) {
        consultar('UPDATE apps_dados SET dados = ?, atualizado_em = ? WHERE usuario_id = ? AND app = ?', [$json, $momento, $id, $app]);
    } else {
        consultar(
            'INSERT INTO apps_dados (usuario_id, app, dados, consentiu_em, atualizado_em) VALUES (?, ?, ?, ?, ?)',
            [$id, $app, $json, $precisaAutorizar ? $momento : null, $momento]
        );
        registrar_evento($id, $app === 'treino' ? 'treino_autorizado' : 'ocasioes_comecou');
    }
    responder(200, ['atualizadoEm' => $momento]);
}
