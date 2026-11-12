<?php
/**
 * Ocasiões, Treino e Hábitos: guarda na conta o que a pessoa anotou em cada app.
 *
 * GET  ?app=ocasioes|treino|habitos                 devolve os dados guardados, ou null
 * POST ?app=ocasioes|treino|habitos&acao=salvar     guarda os dados
 * POST ?app=ocasioes|treino|habitos&acao=apagar     apaga os dados da conta
 *
 * O Treino e os Hábitos falam do corpo e da rotina da pessoa: só são guardados com a
 * autorização dela, como a Alimentação. O servidor só aceita os campos e valores que cada
 * página usa.
 */
declare(strict_types=1);

define('AR_API', true);
require __DIR__ . '/nucleo.php';

// Com a cobrança ligada no painel, só quem assina usa os apps
exigir_acesso_apps([]);

const APPS = ['ocasioes', 'treino', 'habitos'];
const APPS_COM_AUTORIZACAO = ['treino', 'habitos'];

// Acompanham assets/js/habitos.js
const HB_MAXIMO = 20;
const HB_DIAS_GUARDADOS = 400;
const HB_SITUACOES = ['feito', 'minimo', 'pulado'];
const HB_CORES = ['bordo', 'ouro', 'oliva', 'azul', 'grafite'];
const HB_MAXIMO_LEMBRETES = 30;
const HB_REPETIR = ['uma', 'diario', 'dias'];
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
const TR_MOTIVOS = ['', 'cansei', 'repetitivo', 'sem_efeito'];
const TR_CUIDADOS = ['joelho', 'ombro', 'lombar'];
const TR_ESFORCOS = ['leve', 'ok', 'pesado'];
const TR_FOCOS = ['peito', 'costas', 'ombros', 'bracos', 'pernas', 'gluteos', 'abdomen'];
const TR_MAXIMO_FOCOS = 2;
const TR_VARIACOES = 3;
const TR_MAXIMO_SESSOES = 500;
const TR_GRUPOS = ['peito', 'costas', 'ombros', 'biceps', 'triceps', 'quadriceps', 'posterior', 'panturrilha', 'abdomen'];
const TR_MAXIMO_PERSONALIZADOS = 30;

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
        // Ajustes da pessoa nas listas da viagem
        $removidos = [];
        foreach ((is_array($e['removidos'] ?? null) ? array_slice($e['removidos'], 0, 80) : []) as $chave) {
            if (codigo_valido($chave) && !in_array($chave, $removidos, true)) {
                $removidos[] = $chave;
            }
        }
        $editados = [];
        foreach ((is_array($e['editados'] ?? null) ? array_slice($e['editados'], 0, 60, true) : []) as $chave => $texto) {
            $texto = is_string($texto) ? linha_de_texto(['t' => $texto], 't', 80) : '';
            if (codigo_valido((string) $chave) && trim($texto) !== '') {
                $editados[(string) $chave] = $texto;
            }
        }
        $extras = [];
        foreach ((is_array($e['extras'] ?? null) ? array_slice($e['extras'], 0, 40) : []) as $x) {
            if (!is_array($x) || !codigo_valido($x['id'] ?? null, 16) || !in_array($x['lista'] ?? '', ['mala', 'lembrar'], true)) {
                continue;
            }
            $texto = linha_de_texto($x, 'texto', 80);
            if (trim($texto) !== '') {
                $extras[] = ['id' => $x['id'], 'texto' => $texto, 'lista' => $x['lista']];
            }
        }
        $malaPecas = [];
        foreach ((is_array($e['malaPecas'] ?? null) ? array_slice($e['malaPecas'], 0, 40) : []) as $peca) {
            if (is_int($peca) && $peca > 0 && !in_array($peca, $malaPecas, true)) {
                $malaPecas[] = $peca;
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
            'removidos' => $removidos,
            'editados' => (object) $editados,
            'extras' => $extras,
            'malaPecas' => $malaPecas,
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
    $foco = [];
    foreach ((is_array($p['foco'] ?? null) ? $p['foco'] : []) as $f) {
        if (in_array($f, TR_FOCOS, true) && !in_array($f, $foco, true) && count($foco) < TR_MAXIMO_FOCOS) {
            $foco[] = $f;
        }
    }

    // Medidas opcionais, nas mesmas faixas da Alimentação
    $m = is_array($p['medidas'] ?? null) ? $p['medidas'] : [];
    $medidas = [];
    if (in_array($m['sexo'] ?? '', ['m', 'f'], true)) {
        $medidas['sexo'] = $m['sexo'];
    }
    if (is_int($m['idade'] ?? null) && $m['idade'] >= 18 && $m['idade'] <= 80) {
        $medidas['idade'] = $m['idade'];
    }
    if (is_int($m['altura'] ?? null) && $m['altura'] >= 140 && $m['altura'] <= 220) {
        $medidas['altura'] = $m['altura'];
    }
    $peso = $m['peso'] ?? null;
    if ((is_int($peso) || is_float($peso)) && $peso >= 40 && $peso <= 250) {
        $medidas['peso'] = round((float) $peso, 1);
    }

    $variacoes = [];
    foreach ((is_array($d['variacoes'] ?? null) ? $d['variacoes'] : []) as $letra => $v) {
        if (preg_match('/^[A-F]$/', (string) $letra) === 1 && is_int($v) && $v >= 0 && $v < TR_VARIACOES) {
            $variacoes[(string) $letra] = $v;
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
        // Séries de cada exercício: [carga em kg ou null, repetições ou null]
        $series = [];
        foreach ((is_array($s['series'] ?? null) ? array_slice($s['series'], 0, 15, true) : []) as $ex => $lista) {
            if (!codigo_valido((string) $ex) || !is_array($lista)) {
                continue;
            }
            $limpas = [];
            foreach (array_slice(array_values($lista), 0, 10) as $serie) {
                if (!is_array($serie)) {
                    continue;
                }
                $serie = array_values($serie);
                $kg = $serie[0] ?? null;
                $reps = $serie[1] ?? null;
                $kg = (is_int($kg) || is_float($kg)) && $kg >= 0 && $kg <= 500 ? round((float) $kg, 1) : null;
                $reps = is_int($reps) && $reps >= 0 && $reps <= 300 ? $reps : null;
                if ($kg !== null || $reps !== null) {
                    $limpas[] = [$kg, $reps];
                }
            }
            if ($limpas) {
                $series[(string) $ex] = $limpas;
            }
        }
        $feitos = $s['feitos'] ?? 0;
        $sessao = [
            'data' => $data,
            'treino' => is_string($s['treino'] ?? null) && preg_match('/^[A-F]$/', $s['treino']) === 1 ? $s['treino'] : 'A',
            'esforco' => uma_de($s['esforco'] ?? '', TR_ESFORCOS, 'ok'),
            'feitos' => is_int($feitos) && $feitos >= 0 && $feitos <= 15 ? $feitos : 0,
            'cargas' => (object) $cargas,
            'series' => (object) $series,
        ];
        $variacao = $s['variacao'] ?? null;
        if (is_int($variacao) && $variacao >= 0 && $variacao < TR_VARIACOES) {
            $sessao['variacao'] = $variacao;
        }
        $faseDaSessao = $s['fase'] ?? null;
        if (is_int($faseDaSessao) && $faseDaSessao >= 0 && $faseDaSessao <= 99) {
            $sessao['fase'] = $faseDaSessao;
        }
        $sessoes[] = $sessao;
    }

    // Exercícios criados pela pessoa: nome, músculo e se usa peso
    $personalizados = [];
    $vistos = [];
    foreach ((is_array($d['personalizados'] ?? null) ? array_slice($d['personalizados'], 0, TR_MAXIMO_PERSONALIZADOS) : []) as $e) {
        if (!is_array($e) || !is_string($e['id'] ?? null) || preg_match('/^p_[a-z0-9]{3,16}$/', $e['id']) !== 1 || isset($vistos[$e['id']])) {
            continue;
        }
        $nome = trim(linha_de_texto($e, 'nome', 50));
        if (mb_strlen($nome) < 2 || !in_array($e['grupo'] ?? '', TR_GRUPOS, true)) {
            continue;
        }
        $vistos[$e['id']] = true;
        $personalizados[] = [
            'id' => $e['id'],
            'nome' => $nome,
            'grupo' => $e['grupo'],
            'carga' => ($e['carga'] ?? true) !== false,
            'tempo' => ($e['tempo'] ?? false) === true,
        ];
    }

    // Trocas de exercício: treino, opção e movimento, como a0-peito
    $trocas = [];
    foreach ((is_array($d['trocas'] ?? null) ? array_slice($d['trocas'], 0, 120, true) : []) as $de => $para) {
        if (preg_match('/^[a-f][0-2]-[a-z_]{1,30}$/', (string) $de) === 1 && codigo_valido($para)) {
            $trocas[(string) $de] = $para;
        }
    }
    $resumo = is_array($d['resumo'] ?? null) ? $d['resumo'] : [];

    // Fase do treino (periodização): número, desde quando, o motivo da troca e as anteriores
    $limparFase = function ($f): ?array {
        if (!is_array($f) || !is_int($f['numero'] ?? null) || $f['numero'] < 0 || $f['numero'] > 99) {
            return null;
        }
        $desde = data_ou_vazia($f['desde'] ?? '');
        return [
            'numero' => $f['numero'],
            'desde' => $desde ?: date('Y-m-d'),
            'motivo' => uma_de($f['motivo'] ?? '', TR_MOTIVOS, ''),
        ];
    };
    $fase = $limparFase($d['fase'] ?? null);
    if ($fase !== null) {
        $fase['anteriores'] = [];
        foreach (array_slice(is_array($d['fase']['anteriores'] ?? null) ? $d['fase']['anteriores'] : [], -20) as $a) {
            $limpa = $limparFase($a);
            if ($limpa !== null) {
                $limpa['ate'] = data_ou_vazia($a['ate'] ?? '') ?: $limpa['desde'];
                $fase['anteriores'][] = $limpa;
            }
        }
    }

    return [
        'perfil' => [
            'objetivo' => uma_de($p['objetivo'] ?? '', TR_OBJETIVOS, 'saude'),
            'nivel' => uma_de($p['nivel'] ?? '', TR_NIVEIS, 'iniciante'),
            'dias' => $dias,
            'local' => uma_de($p['local'] ?? '', TR_LOCAIS, 'academia'),
            'tempo' => uma_de($p['tempo'] ?? 45, TR_TEMPOS, 45),
            'cuidados' => $cuidados,
            'foco' => $foco,
            'medidas' => (object) $medidas,
        ],
        'sessoes' => $sessoes,
        'personalizados' => $personalizados,
        'trocas' => (object) $trocas,
        'variacoes' => (object) $variacoes,
        'alternar' => ($d['alternar'] ?? false) === true,
        'fase' => $fase,
        'resumo' => ['proximo' => linha_de_texto($resumo, 'proximo', 60)],
        'guardarNaConta' => true,
        'alteradoEm' => momento($d['alteradoEm'] ?? 0),
    ];
}

/* --- Hábitos ---------------------------------------------------------------------------------- */

function limpar_habitos($d): ?array
{
    if (!is_array($d) || !is_array($d['habitos'] ?? null) || count($d['habitos']) > HB_MAXIMO) {
        return null;
    }
    $habitos = [];
    $ids = [];
    foreach ($d['habitos'] as $h) {
        if (!is_array($h) || !is_string($h['id'] ?? null) || preg_match('/^h_[a-z0-9]{3,16}$/', $h['id']) !== 1 || isset($ids[$h['id']])) {
            return null;
        }
        $nome = trim(linha_de_texto($h, 'nome', 60));
        if (mb_strlen($nome) < 2) {
            return null;
        }
        $dias = [];
        foreach ((is_array($h['dias'] ?? null) ? $h['dias'] : []) as $dia) {
            if (is_int($dia) && $dia >= 0 && $dia <= 6 && !in_array($dia, $dias, true)) {
                $dias[] = $dia;
            }
        }
        sort($dias);
        $hora = $h['hora'] ?? '';
        $criado = data_ou_vazia($h['criadoEm'] ?? '');
        $ids[$h['id']] = true;
        $habitos[] = [
            'id' => $h['id'],
            'nome' => $nome,
            'identidade' => trim(linha_de_texto($h, 'identidade', 80)),
            'minima' => trim(linha_de_texto($h, 'minima', 80)),
            'ancora' => trim(linha_de_texto($h, 'ancora', 80)),
            'dias' => $dias ?: [0, 1, 2, 3, 4, 5, 6],
            'hora' => is_string($hora) && preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $hora) === 1 ? $hora : '',
            'lembrete' => ($h['lembrete'] ?? false) === true,
            'cor' => uma_de($h['cor'] ?? '', HB_CORES, 'bordo'),
            'criadoEm' => $criado ?: date('Y-m-d'),
        ];
    }

    // Registros por dia, só dos últimos dias e dos hábitos que existem
    $registros = [];
    $origem = is_array($d['registros'] ?? null) ? $d['registros'] : [];
    $datas = array_filter(array_keys($origem), function ($data) {
        $limpa = data_ou_vazia((string) $data);
        return $limpa !== null && $limpa !== '' && $limpa <= date('Y-m-d', time() + 86400);
    });
    rsort($datas);
    foreach (array_slice($datas, 0, HB_DIAS_GUARDADOS) as $data) {
        if (!is_array($origem[$data])) {
            continue;
        }
        $dia = [];
        foreach ($origem[$data] as $hid => $situacao) {
            if (isset($ids[(string) $hid]) && in_array($situacao, HB_SITUACOES, true)) {
                $dia[(string) $hid] = $situacao;
            }
        }
        if ($dia) {
            $registros[(string) $data] = $dia;
        }
    }
    ksort($registros);

    // Lembretes simples: texto, hora e quando repetir
    $lembretes = [];
    $idsLembretes = [];
    foreach (array_slice(is_array($d['lembretes'] ?? null) ? $d['lembretes'] : [], 0, HB_MAXIMO_LEMBRETES) as $l) {
        if (!is_array($l) || !is_string($l['id'] ?? null) || preg_match('/^l_[a-z0-9]{3,16}$/', $l['id']) !== 1 || isset($idsLembretes[$l['id']])) {
            continue;
        }
        $texto = trim(linha_de_texto($l, 'texto', 80));
        $hora = $l['hora'] ?? '';
        if (mb_strlen($texto) < 2 || !is_string($hora) || preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $hora) !== 1) {
            continue;
        }
        $repetir = uma_de($l['repetir'] ?? '', HB_REPETIR, 'uma');
        $dias = [];
        foreach ((is_array($l['dias'] ?? null) ? $l['dias'] : []) as $dia) {
            if (is_int($dia) && $dia >= 0 && $dia <= 6 && !in_array($dia, $dias, true)) {
                $dias[] = $dia;
            }
        }
        sort($dias);
        $data = data_ou_vazia($l['data'] ?? '') ?: '';
        if (($repetir === 'uma' && $data === '') || ($repetir === 'dias' && !$dias)) {
            continue;
        }
        $idsLembretes[$l['id']] = true;
        $lembretes[] = [
            'id' => $l['id'],
            'texto' => $texto,
            'hora' => $hora,
            'repetir' => $repetir,
            'data' => $repetir === 'uma' ? $data : '',
            'dias' => $repetir === 'dias' ? $dias : [],
            'criadoEm' => data_ou_vazia($l['criadoEm'] ?? '') ?: date('Y-m-d'),
        ];
    }

    $fuso = $d['fuso'] ?? '';
    return [
        'habitos' => $habitos,
        'lembretes' => $lembretes,
        'registros' => (object) $registros,
        'fuso' => is_string($fuso) && in_array($fuso, timezone_identifiers_list(), true) ? $fuso : 'America/Sao_Paulo',
        'avisos' => ($d['avisos'] ?? false) === true,
        'guardarNaConta' => true,
        'alteradoEm' => momento($d['alteradoEm'] ?? 0),
    ];
}

/* --- Guardar ---------------------------------------------------------------------------------- */

function salvar_app(int $id, string $app): void
{
    $entrada = exigir_post(600000);
    $limite = chave_limite('apps-' . $app, (string) $id);
    exigir_limite($limite, 300, 3600);
    contar_tentativa($limite);

    $existe = consultar('SELECT consentiu_em FROM apps_dados WHERE usuario_id = ? AND app = ?', [$id, $app])->fetch();
    $precisaAutorizar = in_array($app, APPS_COM_AUTORIZACAO, true);
    if ($precisaAutorizar && !$existe && ($entrada['consentimento'] ?? null) !== true) {
        falhar(403, 'Para guardar na sua conta, é preciso autorizar.');
    }
    $limpar = ['ocasioes' => 'limpar_ocasioes', 'treino' => 'limpar_treino', 'habitos' => 'limpar_habitos'][$app];
    $dados = $limpar($entrada['dados'] ?? null);
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
        registrar_evento($id, ['treino' => 'treino_autorizado', 'habitos' => 'habitos_autorizado', 'ocasioes' => 'ocasioes_comecou'][$app]);
    }
    responder(200, ['atualizadoEm' => $momento]);
}
