<?php
/**
 * Publicar vídeos (painel do gestor, só administrador).
 *
 * GET  ?acao=estado        contas ligadas e as publicações
 * POST ?acao=novo-video    {nome, tamanho, tipo}  abre o envio de um vídeo
 * POST ?acao=pedaco        corpo binário, cabeçalhos X-Video e X-Posicao: um pedaço do vídeo
 * POST ?acao=publicar      {video, titulo, legenda, redes[], quando}  cria uma publicação por rede
 * POST ?acao=processar     {ids[]}  avança as publicações que já estão na hora
 * POST ?acao=tentar        {id}  tenta de novo uma publicação que deu erro
 * POST ?acao=cancelar      {id}  cancela uma publicação agendada
 * POST ?acao=desconectar   {login: meta|google|tiktok}
 *
 * O que está agendado sai pela tarefa api/tarefas/videos.php, no Cron do cPanel.
 */
declare(strict_types=1);

define('AR_API', true);
require __DIR__ . '/nucleo.php';
require __DIR__ . '/redes.php';

const PEDACO_MAXIMO = 4 * 1024 * 1024;
const LEGENDA_MAXIMO = 2200;
const AGENDA_DIAS = 180;
const VIDEO_TIPOS = ['video/mp4' => 'mp4', 'video/quicktime' => 'mov'];

header('Cache-Control: no-store');
$usuario = exigir_login();
if ((int) $usuario['admin'] !== 1) {
    falhar(403, 'Sem permissão.');
}

function publicacao_publica(array $p): array
{
    return [
        'id' => (int) $p['id'],
        'video' => (int) $p['video_id'],
        'nomeVideo' => (string) ($p['nome'] ?? ''),
        'rede' => $p['rede'],
        'titulo' => (string) $p['titulo'],
        'legenda' => (string) $p['legenda'],
        'quando' => strtotime((string) $p['agendado_para']) * 1000,
        'situacao' => $p['situacao'],
        'link' => (string) $p['link'],
        'erro' => (string) $p['erro'],
        'atualizadoEm' => strtotime((string) $p['atualizado_em']) * 1000,
    ];
}

function ids_da_entrada(array $dados): array
{
    $ids = is_array($dados['ids'] ?? null) ? $dados['ids'] : [];
    return array_values(array_unique(array_filter($ids, function ($i) { return is_int($i) && $i > 0; })));
}

switch ($_GET['acao'] ?? '') {
    case 'estado':
        $contas = [];
        foreach (REDES as $rede) {
            $linha = consultar('SELECT nome, conectado_em FROM redes_contas WHERE rede = ?', [$rede])->fetch();
            $contas[$rede] = $linha ? ['nome' => $linha['nome'], 'desde' => $linha['conectado_em']] : null;
        }
        $configurados = [];
        foreach (array_keys(REDES_LOGIN) as $login) {
            $configurados[$login] = chaves_login($login) !== null;
        }
        $lista = consultar(
            'SELECT p.*, v.nome FROM publicacoes p LEFT JOIN videos v ON v.id = p.video_id ORDER BY p.agendado_para DESC, p.id DESC LIMIT 120'
        )->fetchAll();
        responder(200, [
            'contas' => $contas,
            'configurados' => $configurados,
            'retorno' => retorno_oauth(),
            'tiktokPrivacidade' => (string) (config()['tiktok_privacidade'] ?? 'SELF_ONLY'),
            'youtubePrivacidade' => (string) (config()['youtube_privacidade'] ?? 'public'),
            'publicacoes' => array_map('publicacao_publica', $lista),
            'agora' => time() * 1000,
        ]);
        break;

    case 'novo-video':
        $dados = exigir_post();
        $nome = trim(texto($dados, 'nome', 160));
        $tamanho = $dados['tamanho'] ?? 0;
        $tipo = (string) ($dados['tipo'] ?? '');
        if (!isset(VIDEO_TIPOS[$tipo])) {
            falhar(422, 'Envie um vídeo em MP4 ou MOV, os formatos que todas as redes aceitam.');
        }
        if (!is_int($tamanho) || $tamanho < 1000 || $tamanho > VIDEO_MAXIMO) {
            falhar(422, 'O vídeo precisa ter até ' . (VIDEO_MAXIMO / 1024 / 1024) . ' MB.');
        }
        $arquivo = bin2hex(random_bytes(16)) . '.' . VIDEO_TIPOS[$tipo];
        consultar('INSERT INTO videos (arquivo, nome, tamanho, recebido, tipo, criado_em) VALUES (?, ?, ?, 0, ?, ?)', [$arquivo, $nome ?: 'video', $tamanho, $tipo, agora()]);
        touch(pasta_videos() . '/' . $arquivo);
        responder(201, ['id' => (int) banco()->lastInsertId(), 'pedaco' => PEDACO_MAXIMO]);
        break;

    case 'pedaco':
        conferir_post_do_site();
        if (stripos($_SERVER['CONTENT_TYPE'] ?? '', 'application/octet-stream') !== 0) {
            falhar(415, 'Formato não aceito.');
        }
        $id = (int) ($_SERVER['HTTP_X_VIDEO'] ?? 0);
        $posicao = (int) ($_SERVER['HTTP_X_POSICAO'] ?? -1);
        $video = consultar('SELECT * FROM videos WHERE id = ?', [$id])->fetch();
        if (!$video) {
            falhar(404, 'Vídeo não encontrado.');
        }
        if ($posicao !== (int) $video['recebido']) {
            // O navegador continua de onde o servidor parou
            falhar(409, 'Posição fora de ordem.', ['recebido' => (int) $video['recebido']]);
        }
        $bruto = file_get_contents('php://input', false, null, 0, PEDACO_MAXIMO + 1);
        if ($bruto === false || $bruto === '' || strlen($bruto) > PEDACO_MAXIMO || $posicao + strlen($bruto) > (int) $video['tamanho']) {
            falhar(413, 'Pedaço inválido.');
        }
        $caminho = caminho_do_video($video);
        file_put_contents($caminho, $bruto, FILE_APPEND | LOCK_EX);
        $recebido = $posicao + strlen($bruto);
        consultar('UPDATE videos SET recebido = ? WHERE id = ?', [$recebido, $id]);
        if ($recebido === (int) $video['tamanho']) {
            // MP4 e MOV têm a marca "ftyp" logo no começo
            $inicio = (string) file_get_contents($caminho, false, null, 0, 12);
            if (substr($inicio, 4, 4) !== 'ftyp' && substr($inicio, 4, 4) !== 'moov' && substr($inicio, 4, 4) !== 'wide') {
                @unlink($caminho);
                consultar('DELETE FROM videos WHERE id = ?', [$id]);
                falhar(422, 'Este arquivo não parece ser um vídeo MP4 ou MOV.');
            }
        }
        responder(200, ['recebido' => $recebido, 'completo' => $recebido === (int) $video['tamanho']]);
        break;

    case 'publicar':
        $dados = exigir_post();
        $video = consultar('SELECT * FROM videos WHERE id = ?', [(int) ($dados['video'] ?? 0)])->fetch();
        if (!$video || (int) $video['recebido'] !== (int) $video['tamanho']) {
            falhar(422, 'O vídeo ainda não terminou de subir.');
        }
        $redes = is_array($dados['redes'] ?? null) ? array_values(array_unique($dados['redes'])) : [];
        $redes = array_values(array_filter($redes, function ($r) { return in_array($r, REDES, true); }));
        if (!$redes) {
            falhar(422, 'Escolha pelo menos uma rede.', ['campos' => ['redes' => 'Escolha pelo menos uma rede.']]);
        }
        foreach ($redes as $rede) {
            if (!consultar('SELECT 1 FROM redes_contas WHERE rede = ?', [$rede])->fetchColumn()) {
                falhar(422, 'Conecte o ' . REDES_NOMES[$rede] . ' antes de publicar nele.');
            }
        }
        $legenda = trim(str_replace("\r", '', is_string($dados['legenda'] ?? null) ? $dados['legenda'] : ''));
        $titulo = trim(texto($dados, 'titulo', 100));
        if (mb_strlen($legenda) > LEGENDA_MAXIMO) {
            falhar(422, 'A descrição passa de ' . LEGENDA_MAXIMO . ' caracteres, o limite do Instagram e do TikTok.', ['campos' => ['legenda' => 'Até ' . LEGENDA_MAXIMO . ' caracteres.']]);
        }
        if (in_array('youtube', $redes, true) && $titulo === '' && $legenda === '') {
            falhar(422, 'O YouTube pede um título.', ['campos' => ['titulo' => 'Escreva o título do vídeo no YouTube.']]);
        }
        $quando = $dados['quando'] ?? null;
        if ($quando === null) {
            $momento = time();
        } elseif (is_int($quando) && $quando >= time() - 120 && $quando <= time() + AGENDA_DIAS * 86400) {
            $momento = $quando;
        } else {
            falhar(422, 'Escolha uma data entre agora e ' . AGENDA_DIAS . ' dias.', ['campos' => ['quando' => 'Data fora do intervalo.']]);
        }
        $ids = [];
        foreach ($redes as $rede) {
            consultar(
                "INSERT INTO publicacoes (video_id, rede, titulo, legenda, agendado_para, situacao, estado, link, erro, tentativas, criado_em, atualizado_em)
                 VALUES (?, ?, ?, ?, ?, 'agendada', '', '', '', 0, ?, ?)",
                [(int) $video['id'], $rede, $titulo, $legenda, date('Y-m-d H:i:s', $momento), agora(), agora()]
            );
            $ids[] = (int) banco()->lastInsertId();
        }
        responder(201, ['ids' => $ids]);
        break;

    case 'processar':
        $dados = exigir_post();
        ignore_user_abort(true);
        @set_time_limit(300);
        $fim = time() + 50;
        $resultado = [];
        foreach (ids_da_entrada($dados) as $id) {
            $p = consultar('SELECT agendado_para FROM publicacoes WHERE id = ?', [$id])->fetch();
            if ($p && strtotime((string) $p['agendado_para']) <= time() && time() < $fim) {
                processar_publicacao($id, max(10, min(40, $fim - time())));
            }
            $linha = consultar('SELECT p.*, v.nome FROM publicacoes p LEFT JOIN videos v ON v.id = p.video_id WHERE p.id = ?', [$id])->fetch();
            if ($linha) {
                $resultado[] = publicacao_publica($linha);
            }
        }
        responder(200, ['publicacoes' => $resultado]);
        break;

    case 'tentar':
        $dados = exigir_post();
        $id = (int) ($dados['id'] ?? 0);
        consultar(
            "UPDATE publicacoes SET situacao = 'agendada', estado = '', erro = '', travada_em = NULL, agendado_para = ?, atualizado_em = ? WHERE id = ? AND situacao = 'erro'",
            [agora(), agora(), $id]
        );
        responder(200);
        break;

    case 'cancelar':
        $dados = exigir_post();
        $r = consultar("UPDATE publicacoes SET situacao = 'cancelada', atualizado_em = ? WHERE id = ? AND situacao = 'agendada'", [agora(), (int) ($dados['id'] ?? 0)]);
        if ($r->rowCount() === 0) {
            falhar(409, 'Só dá para cancelar o que ainda não começou a subir.');
        }
        responder(200);
        break;

    case 'desconectar':
        $dados = exigir_post();
        $redes = REDES_LOGIN[$dados['login'] ?? ''] ?? null;
        if ($redes === null) {
            falhar(422, 'Rede desconhecida.');
        }
        foreach ($redes as $rede) {
            consultar('DELETE FROM redes_contas WHERE rede = ?', [$rede]);
        }
        responder(200);
        break;

    default:
        falhar(404, 'Ação desconhecida.');
}
