/* Alimentação: a tela. Os dados ficam só neste aparelho, guardados no navegador. */
(function () {
  'use strict';

  var D = window.AR_ALIM;
  var C = window.AR_ALIM_CALC;
  var api = window.AR_API;
  var CHAVE = 'ar-alimentacao-v1';
  var PASSOS = ['voce', 'comida', 'plano', 'compras'];

  var estado = carregar() || {
    perfil: { sexo: 'm', idade: '', altura: '', peso: '', atividade: 'leve', objetivo: 'manter', uf: '' },
    itens: [],
    modo: 'ajustar',
    listaDe: 'plano'
  };

  function $(id) { return document.getElementById(id); }

  function criar(tag, classe, texto) {
    var e = document.createElement(tag);
    if (classe) e.className = classe;
    if (texto !== undefined && texto !== null) e.textContent = texto;
    return e;
  }

  function carregar() {
    try { return JSON.parse(localStorage.getItem(CHAVE)); } catch (e) { return null; }
  }

  function salvar() {
    try { localStorage.setItem(CHAVE, JSON.stringify(estado)); } catch (e) { /* segue sem guardar */ }
  }

  function reais(v) {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function kcal(v) { return Math.round(v).toLocaleString('pt-BR') + ' kcal'; }

  /* --- Passos ------------------------------------------------------------------------- */

  function irPara(passo) {
    PASSOS.forEach(function (p) {
      $('passo-' + p).hidden = p !== passo;
      var botao = $('ir-' + p);
      botao.setAttribute('aria-current', p === passo ? 'step' : 'false');
    });
    if (passo === 'plano') desenharPlano();
    if (passo === 'compras') desenharCompras();
    $('passo-' + passo).focus();
    window.scrollTo(0, $('alim-topo').offsetTop - 90);
  }

  function liberarPassos() {
    var perfilOk = perfilValido();
    $('ir-comida').disabled = !perfilOk;
    $('ir-plano').disabled = !perfilOk;
    $('ir-compras').disabled = !perfilOk;
  }

  PASSOS.forEach(function (p) {
    $('ir-' + p).addEventListener('click', function () { irPara(p); });
  });

  /* --- Passo 1: você -------------------------------------------------------------------- */

  function preencherOpcoes() {
    var estados = $('alim-uf');
    estados.appendChild(new Option('Escolha', ''));
    D.ESTADOS.forEach(function (e) { estados.appendChild(new Option(e.nome, e.uf)); });

    function radios(caixaId, nome, lista) {
      var caixa = $(caixaId);
      lista.forEach(function (op) {
        var rotulo = criar('label', 'campo-marcar');
        var r = document.createElement('input');
        r.type = 'radio';
        r.name = nome;
        r.value = op.id;
        rotulo.appendChild(r);
        rotulo.appendChild(criar('span', '', op.rotulo));
        caixa.appendChild(rotulo);
      });
    }
    radios('alim-atividade', 'atividade', C.ATIVIDADES);
    radios('alim-objetivo', 'objetivo', C.OBJETIVOS);
  }

  function mostrarPerfil() {
    var p = estado.perfil;
    var form = $('passo-voce');
    form.elements.sexo.value = p.sexo;
    $('alim-idade').value = p.idade;
    $('alim-altura').value = p.altura;
    $('alim-peso').value = p.peso;
    form.elements.atividade.value = p.atividade;
    form.elements.objetivo.value = p.objetivo;
    $('alim-uf').value = p.uf;
  }

  function lerPerfil() {
    var form = $('passo-voce');
    estado.perfil = {
      sexo: form.elements.sexo.value || 'm',
      idade: Number($('alim-idade').value) || '',
      altura: Number(String($('alim-altura').value).replace(',', '.')) || '',
      peso: Number(String($('alim-peso').value).replace(',', '.')) || '',
      atividade: form.elements.atividade.value || 'leve',
      objetivo: form.elements.objetivo.value || 'manter',
      uf: $('alim-uf').value
    };
    salvar();
    liberarPassos();
  }

  function problemasDoPerfil() {
    var p = estado.perfil;
    var erros = {};
    if (!(p.idade >= 18 && p.idade <= 80)) erros.idade = 'Esta ferramenta é para adultos de 18 a 80 anos.';
    if (!(p.altura >= 140 && p.altura <= 220)) erros.altura = 'Informe a altura em centímetros, como 178.';
    if (!(p.peso >= 40 && p.peso <= 250)) erros.peso = 'Informe o peso em quilos, como 82.';
    if (!p.uf) erros.uf = 'Escolha o estado, para calcularmos os preços da sua região.';
    return erros;
  }

  function perfilValido() { return Object.keys(problemasDoPerfil()).length === 0; }

  $('passo-voce').addEventListener('input', lerPerfil);
  $('passo-voce').addEventListener('change', lerPerfil);
  $('passo-voce').addEventListener('submit', function (e) {
    e.preventDefault();
    lerPerfil();
    var erros = problemasDoPerfil();
    ['idade', 'altura', 'peso', 'uf'].forEach(function (c) { $('erro-alim-' + c).textContent = erros[c] || ''; });
    var primeiro = Object.keys(erros)[0];
    if (primeiro) { $('alim-' + primeiro).focus(); return; }
    irPara('comida');
  });

  // Quem tem conta não precisa digitar de novo a altura, o peso e o estado
  function puxarDaConta() {
    if (!api) return;
    api.get('api/perfil.php').then(function (r) {
      if (!r.ok) return;
      var c = r.dados.cadastro || {};
      var p = estado.perfil;
      var usou = false;
      if (!p.altura && c.altura) { p.altura = Math.round(Number(c.altura)); usou = true; }
      if (!p.peso && c.peso) { p.peso = Math.round(Number(c.peso) * 10) / 10; usou = true; }
      if (!p.uf && c.uf && D.porEstado[c.uf]) { p.uf = c.uf; usou = true; }
      if (usou) {
        mostrarPerfil();
        salvar();
        liberarPassos();
        $('alim-da-conta').hidden = false;
      }
    });
  }

  /* --- Passo 2: o que você come ------------------------------------------------------------- */

  var SUGESTOES = {
    cafe: [['pao_frances', 1], ['manteiga', 1], ['cafe', 1], ['leite', 1, 1], ['acucar', 2], ['ovo', 2], ['banana', 1], ['cuscuz', 1], ['tapioca', 1]],
    almoco: [['arroz', 4], ['feijao', 1], ['frango', 1], ['carne', 1], ['salada', 1], ['macarrao', 1], ['batata_frita', 1], ['refrigerante', 1], ['marmita', 1]],
    lanche: [['pao_frances', 1], ['cafe', 1], ['biscoito', 4], ['iogurte', 1], ['banana', 1], ['salgado', 1], ['suco_caixa', 1]],
    jantar: [['arroz', 3], ['feijao', 1], ['carne', 1], ['ovo', 2], ['macarrao', 1], ['pizza', 2], ['lanche', 1], ['salada', 1]],
    outros: [['oleo', 2], ['refrigerante', 1], ['cerveja', 2], ['chocolate', 3], ['biscoito', 4], ['agua', 6]]
  };

  function opcoesDeAlimentos(select) {
    select.appendChild(new Option('Escolha um alimento', ''));
    D.GRUPOS.forEach(function (g) {
      var grupo = document.createElement('optgroup');
      grupo.label = g.rotulo;
      D.ALIMENTOS.filter(function (a) { return a.grupo === g.id; }).forEach(function (a) {
        grupo.appendChild(new Option(a.nome, a.id));
      });
      select.appendChild(grupo);
    });
  }

  function opcoesDeMedidas(select, alimentoId) {
    select.textContent = '';
    var a = D.porAlimento[alimentoId];
    if (!a) { select.appendChild(new Option('—', '0')); return; }
    a.medidas.forEach(function (m, i) { select.appendChild(new Option(m.rotulo + ' (' + m.g + (a.grupo === 'bebidas' ? ' ml' : ' g') + ')', String(i))); });
  }

  function montarRefeicoes() {
    var caixa = $('alim-refeicoes');
    C.REFEICOES.forEach(function (ref) {
      var bloco = criar('fieldset', 'alim-refeicao');
      bloco.appendChild(criar('legend', 'titulo-s', ref.rotulo));
      var lista = criar('ul', 'alim-itens');
      lista.id = 'itens-' + ref.id;
      bloco.appendChild(lista);

      var atalhos = criar('div', 'alim-atalhos');
      atalhos.appendChild(criar('span', 'alim-atalhos-rotulo', 'Toque para incluir:'));
      SUGESTOES[ref.id].forEach(function (s) {
        var a = D.porAlimento[s[0]];
        var b = criar('button', 'alim-atalho', a.nome);
        b.type = 'button';
        b.addEventListener('click', function () {
          estado.itens.push(C.novoItem(ref.id, s[0], s[1], s[2] || 0));
          salvar();
          desenharItens();
        });
        atalhos.appendChild(b);
      });
      bloco.appendChild(atalhos);

      var form = criar('div', 'alim-novo');
      var alimento = document.createElement('select');
      alimento.setAttribute('aria-label', 'Alimento do ' + ref.rotulo.toLowerCase());
      opcoesDeAlimentos(alimento);
      var qtd = document.createElement('input');
      qtd.type = 'number';
      qtd.min = '0.5';
      qtd.step = '0.5';
      qtd.value = '1';
      qtd.inputMode = 'decimal';
      qtd.setAttribute('aria-label', 'Quantidade');
      var medida = document.createElement('select');
      medida.setAttribute('aria-label', 'Medida');
      opcoesDeMedidas(medida, '');
      var freq = document.createElement('select');
      freq.setAttribute('aria-label', 'Com que frequência');
      C.FREQUENCIAS.forEach(function (f) { freq.appendChild(new Option(f.rotulo, f.id)); });
      alimento.addEventListener('change', function () { opcoesDeMedidas(medida, alimento.value); });
      var incluir = criar('button', 'botao', 'Incluir');
      incluir.type = 'button';
      incluir.addEventListener('click', function () {
        var n = Number(String(qtd.value).replace(',', '.'));
        if (!alimento.value || !(n > 0)) { alimento.focus(); return; }
        estado.itens.push(C.novoItem(ref.id, alimento.value, Math.min(n, 30), Number(medida.value), { freq: freq.value }));
        alimento.value = '';
        qtd.value = '1';
        freq.value = 'diario';
        opcoesDeMedidas(medida, '');
        salvar();
        desenharItens();
      });
      [['Alimento', alimento], ['Quantidade', qtd], ['Medida', medida], ['Frequência', freq]].forEach(function (par) {
        var campo = criar('label', 'alim-campo');
        campo.appendChild(criar('span', '', par[0]));
        campo.appendChild(par[1]);
        form.appendChild(campo);
      });
      form.appendChild(incluir);
      bloco.appendChild(form);
      caixa.appendChild(bloco);
    });
  }

  function desenharItens() {
    C.REFEICOES.forEach(function (ref) {
      var lista = $('itens-' + ref.id);
      lista.textContent = '';
      estado.itens.forEach(function (item, indice) {
        if (item.refeicao !== ref.id) return;
        var li = criar('li', 'alim-item');
        var freq = C.FREQUENCIAS.filter(function (f) { return f.id === item.freq; })[0];
        li.appendChild(criar('span', '', C.descreverItem(item) + (item.freq !== 'diario' ? ' · ' + freq.rotulo.toLowerCase() : '')));
        var tirar = criar('button', 'texto-botao', 'Tirar');
        tirar.type = 'button';
        tirar.setAttribute('aria-label', 'Tirar ' + C.descreverItem(item));
        tirar.addEventListener('click', function () {
          estado.itens.splice(indice, 1);
          salvar();
          desenharItens();
        });
        li.appendChild(tirar);
        lista.appendChild(li);
      });
    });
    var n = C.nutrientes(estado.itens);
    $('alim-total-hoje').textContent = estado.itens.length
      ? 'Pelo que você marcou, são cerca de ' + kcal(n.kcal) + ' por dia.'
      : 'Nada marcado ainda.';
  }

  $('alim-ir-plano').addEventListener('click', function () { irPara('plano'); });
  $('alim-limpar').addEventListener('click', function () {
    if (!estado.itens.length || !window.confirm('Apagar tudo o que você marcou?')) return;
    estado.itens = [];
    salvar();
    desenharItens();
  });

  /* --- Passo 3: plano ------------------------------------------------------------------------ */

  function planoAtual(metas) {
    if (estado.modo === 'novo' || !estado.itens.length) return C.planoNovo(metas);
    return C.planoAjustado(estado.itens, metas);
  }

  function numeroDestaque(rotulo, valor, detalhe) {
    var bloco = criar('div', 'alim-numero');
    bloco.appendChild(criar('dt', 'etiqueta', rotulo));
    bloco.appendChild(criar('dd', 'titulo-m', valor));
    if (detalhe) bloco.appendChild(criar('dd', 'alim-numero-detalhe', detalhe));
    return bloco;
  }

  function desenharPlano() {
    var metas = C.gasto(estado.perfil);
    var hoje = C.nutrientes(estado.itens);
    var plano = planoAtual(metas);
    var noPlano = C.nutrientes(plano);

    var numeros = $('alim-numeros');
    numeros.textContent = '';
    numeros.appendChild(numeroDestaque('Seu gasto por dia', kcal(metas.total), 'Em repouso, ' + kcal(metas.basal) + '.'));
    numeros.appendChild(numeroDestaque('Meta para o seu objetivo', kcal(metas.meta), C.OBJETIVOS.filter(function (o) { return o.id === estado.perfil.objetivo; })[0].rotulo + '.'));
    if (estado.itens.length) {
      var dif = hoje.kcal - metas.meta;
      numeros.appendChild(numeroDestaque('O que você come hoje', kcal(hoje.kcal),
        Math.abs(dif) < 100 ? 'Perto da meta.' : (dif > 0 ? kcal(dif) + ' acima da meta.'
          : kcal(-dif) + ' abaixo da meta. É comum esquecer beliscos e o óleo da comida: confira se marcou tudo.')));
    }
    numeros.appendChild(numeroDestaque('Proteína no plano', noPlano.p + ' g', 'Meta: cerca de ' + metas.proteina + ' g por dia.'));

    var temItens = estado.itens.length > 0;
    $('alim-modo').hidden = !temItens;
    $('alim-modo-ajustar').setAttribute('aria-pressed', String(estado.modo !== 'novo'));
    $('alim-modo-novo').setAttribute('aria-pressed', String(estado.modo === 'novo' || !temItens));
    $('alim-plano-titulo').textContent = estado.modo === 'novo' || !temItens
      ? 'Plano novo, montado para a sua meta'
      : 'O que você já come, com ajustes';

    var caixa = $('alim-plano');
    caixa.textContent = '';
    C.REFEICOES.forEach(function (ref) {
      var itens = plano.filter(function (i) { return i.refeicao === ref.id; });
      if (!itens.length) return;
      var bloco = criar('section', 'alim-plano-refeicao');
      var n = C.nutrientes(itens);
      var cab = criar('header', 'alim-plano-cab');
      cab.appendChild(criar('h3', 'titulo-s', ref.rotulo));
      cab.appendChild(criar('span', 'etiqueta', kcal(n.kcal)));
      bloco.appendChild(cab);
      var lista = criar('ul', 'alim-plano-itens');
      itens.forEach(function (item) {
        var li = criar('li');
        var linha = criar('p', 'alim-plano-linha');
        linha.appendChild(criar('span', '', C.descreverItem(item)));
        if (item.freq && item.freq !== 'diario') {
          linha.appendChild(criar('span', 'alim-suave', ' · ' + C.FREQUENCIAS.filter(function (f) { return f.id === item.freq; })[0].rotulo.toLowerCase()));
        }
        if (item.novo) linha.appendChild(criar('span', 'alim-selo', 'Novo'));
        else if (item.antes) linha.appendChild(criar('span', 'alim-selo', 'Trocado'));
        else if (item.porcao) linha.appendChild(criar('span', 'alim-selo alim-selo-claro', item.porcao === 'menos' ? 'Porção menor' : 'Porção maior'));
        li.appendChild(linha);
        if (item.antes) li.appendChild(criar('p', 'alim-suave', 'Antes: ' + item.antes + '.'));
        if (item.motivo) li.appendChild(criar('p', 'alim-suave', item.motivo));
        lista.appendChild(li);
      });
      bloco.appendChild(lista);
      caixa.appendChild(bloco);
    });

    var dif2 = noPlano.kcal - metas.meta;
    var fim = ', perto da meta.';
    if (dif2 > 150) {
      fim = ', ' + kcal(dif2) + ' acima da meta. Para chegar mais perto, diminua um pouco o arroz, o pão ou a massa.';
    } else if (dif2 < -150 && estado.perfil.objetivo === 'perder' && noPlano.kcal >= metas.basal) {
      fim = ', ' + kcal(-dif2) + ' abaixo da meta, o que também funciona para perder peso. Se bater fome, aumente um pouco o arroz, o pão ou a massa.';
    } else if (dif2 < -150) {
      fim = ', ' + kcal(-dif2) + ' abaixo da meta. Para chegar mais perto, aumente um pouco o arroz, o pão ou a massa.';
    }
    $('alim-plano-total').textContent = 'Total do plano: ' + kcal(noPlano.kcal) + ' por dia' + fim;
  }

  $('alim-modo-ajustar').addEventListener('click', function () { estado.modo = 'ajustar'; salvar(); desenharPlano(); });
  $('alim-modo-novo').addEventListener('click', function () { estado.modo = 'novo'; salvar(); desenharPlano(); });
  $('alim-ir-compras').addEventListener('click', function () { irPara('compras'); });

  /* --- Passo 4: compras ---------------------------------------------------------------------- */

  var FREQ_COMPRA = [
    { id: 'mes', rotulo: 'Compra do mês' },
    { id: 'quinzena', rotulo: 'A cada 15 dias, mais ou menos' },
    { id: 'semana', rotulo: 'Toda semana' },
    { id: 'dias', rotulo: 'A cada 2 ou 3 dias' },
    { id: 'fora', rotulo: 'Comida pronta, comprada na hora' }
  ];

  // Alternativas mais baratas com o mesmo papel no prato
  var ECONOMIAS = [
    ['frango', 'coxa', 'Coxa e sobrecoxa no lugar do peito de frango'],
    ['carne', 'coxa', 'Frango no lugar da carne bovina em parte dos dias'],
    ['peixe', 'sardinha', 'Sardinha no lugar do filé de peixe'],
    ['maca', 'banana', 'Banana no lugar da maçã'],
    ['azeite', 'oleo', 'Óleo para cozinhar e azeite só para temperar'],
    ['pao_integral', 'pao_frances', 'Pão francês em parte dos dias, se o orçamento apertar']
  ];

  function quantidadeLegivel(gramas, produto) {
    var bebida = /litro|ml/.test(produto.embalagem);
    function contar(n, um, varios) {
      var arredondado = Math.round(n * 2) / 2;
      return arredondado.toLocaleString('pt-BR') + ' ' + (arredondado <= 1 ? um : varios);
    }
    if (produto.id === 'ovos') return contar(gramas / 50, 'ovo', 'ovos');
    if (produto.id === 'banana') return contar(gramas / 70, 'banana', 'bananas');
    if (gramas >= 1000) return (gramas / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + (bebida ? ' litro' : ' kg');
    return Math.round(gramas) + (bebida ? ' ml' : ' g');
  }

  function textoIntervalo(dias) {
    if (dias < 1) {
      var porSemana = Math.round(7 / dias);
      return porSemana + ' por semana';
    }
    var d = Math.round(dias);
    if (d <= 1) return 'todo dia';
    if (d < 14) return 'a cada ' + d + ' dias';
    if (d < 45) return 'a cada ' + Math.round(d / 7) + ' semanas';
    return 'a cada ' + Math.round(d / 30) + ' meses';
  }

  function linhaDeCompra(l) {
    var li = criar('li', 'alim-compra');
    var cab = criar('div', 'alim-compra-cab');
    var nome = criar('p', 'alim-compra-nome', l.produto.nome);
    nome.appendChild(criar('span', 'alim-suave', ' · ' + l.produto.embalagem));
    cab.appendChild(nome);
    cab.appendChild(criar('p', 'alim-compra-valor', reais(l.custoMes) + ' por mês'));
    li.appendChild(cab);

    var detalhes = [];
    if (l.granel) {
      detalhes.push(reais(l.preco.valor) + ' por ' + l.produto.embalagem.replace(/^1 /, ''));
      detalhes.push('você usa ' + quantidadeLegivel(l.porDia, l.produto) + ' por dia');
      detalhes.push('leve cerca de ' + quantidadeLegivel(l.porCompra, l.produto) + ' por semana');
    } else if (l.pronto) {
      detalhes.push(reais(l.preco.valor) + ' cada');
      detalhes.push('cerca de ' + Math.round(l.porcoesMes) + ' por mês');
    } else {
      detalhes.push(reais(l.preco.valor) + ' cada');
      detalhes.push('você usa ' + quantidadeLegivel(l.porDia, l.produto) + ' por dia');
      var dias = Math.round(l.diasParaAcabar);
      detalhes.push(l.diasParaAcabar >= 1
        ? 'uma embalagem dá para ' + (dias === 1 ? '1 dia' : dias + ' dias')
        : 'uma embalagem dá para menos de um dia');
      detalhes.push('compre ' + textoIntervalo(l.intervalo));
    }
    li.appendChild(criar('p', 'alim-suave', detalhes.join(' · ') + '.'));
    if (l.perda > 0.15) {
      li.appendChild(criar('p', 'alim-alerta', 'Estraga antes de acabar: cerca de ' + Math.round(l.perda * 100) +
        '% vai para o lixo. Prefira embalagens menores ou congele em porções.'));
    }
    li.appendChild(criar('p', 'alim-fonte', l.preco.fonte === 'dieese' ? 'Preço médio do DIEESE' : 'Preço estimado para a região'));
    return li;
  }

  function desenharCompras() {
    var metas = C.gasto(estado.perfil);
    var uf = estado.perfil.uf;
    var estadoNome = D.porEstado[uf];
    var plano = planoAtual(metas);
    var doPlano = C.compras(plano, uf);
    var temAtual = estado.itens.length > 0;
    var deHoje = temAtual ? C.compras(estado.itens, uf) : null;

    // Resumo: o plano pesa no bolso?
    var resumo = $('alim-custo');
    resumo.textContent = '';
    if (deHoje) resumo.appendChild(numeroDestaque('O que você come hoje', reais(deHoje.totalMes), reais(deHoje.totalDia) + ' por dia.'));
    resumo.appendChild(numeroDestaque('Com o plano', reais(doPlano.totalMes), reais(doPlano.totalDia) + ' por dia.'));
    resumo.appendChild(numeroDestaque('Do salário mínimo', Math.round(doPlano.totalMes / D.SALARIO_MINIMO * 100) + '%',
      'O mínimo de 2026 é ' + reais(D.SALARIO_MINIMO) + '.'));

    var veredito = $('alim-veredito');
    if (deHoje) {
      var dif = doPlano.totalMes - deHoje.totalMes;
      var pct = deHoje.totalMes ? dif / deHoje.totalMes : 0;
      if (pct <= -0.05) {
        veredito.textContent = 'Comer melhor sai mais barato: você economiza ' + reais(-dif) + ' por mês, ou ' + reais(-dif / 30) + ' por dia.';
      } else if (pct < 0.05) {
        veredito.textContent = 'O plano custa praticamente o mesmo que você gasta hoje: diferença de ' + reais(Math.abs(dif)) + ' por mês.';
      } else {
        veredito.textContent = 'O plano custa ' + reais(dif) + ' a mais por mês, ' + reais(dif / 30) + ' por dia. Veja abaixo onde dá para economizar.';
      }
    } else {
      veredito.textContent = 'Marque o que você come hoje, no passo anterior, para comparar com o que gasta atualmente.';
    }

    // Onde economizar no plano
    var dicas = $('alim-economia');
    dicas.textContent = '';
    var porProduto = {};
    doPlano.lista.forEach(function (l) { porProduto[l.produto.id] = l; });
    ECONOMIAS.forEach(function (e) {
      var linha = porProduto[e[0]];
      if (!linha || linha.pronto) return;
      var caro = C.precoDe(D.porProduto[e[0]], uf).valor / D.porProduto[e[0]].qtd;
      var barato = C.precoDe(D.porProduto[e[1]], uf).valor / D.porProduto[e[1]].qtd;
      var economia = (caro - barato) * linha.porDia * 30;
      if (economia >= 5) {
        dicas.appendChild(criar('li', '', e[2] + ': cerca de ' + reais(economia) + ' a menos por mês.'));
      }
    });
    $('alim-economia-bloco').hidden = !dicas.children.length;

    // Lista de compras
    var lista = estado.listaDe === 'hoje' && deHoje ? deHoje : doPlano;
    $('alim-lista-hoje').hidden = !temAtual;
    $('alim-lista-plano').setAttribute('aria-pressed', String(lista === doPlano));
    $('alim-lista-hoje').setAttribute('aria-pressed', String(lista !== doPlano));
    var caixa = $('alim-compras');
    caixa.textContent = '';
    FREQ_COMPRA.forEach(function (f) {
      var linhas = lista.lista.filter(function (l) { return C.frequenciaDeCompra(l) === f.id; });
      if (!linhas.length) return;
      var bloco = criar('section', 'alim-compras-grupo');
      var total = linhas.reduce(function (t, l) { return t + l.custoMes; }, 0);
      var cab = criar('header', 'alim-plano-cab');
      cab.appendChild(criar('h3', 'titulo-s', f.rotulo));
      cab.appendChild(criar('span', 'etiqueta', reais(total) + ' por mês'));
      bloco.appendChild(cab);
      var ul = criar('ul', 'alim-compras-lista');
      linhas.forEach(function (l) { ul.appendChild(linhaDeCompra(l)); });
      bloco.appendChild(ul);
      caixa.appendChild(bloco);
    });

    var indice = C.indiceRegional(uf);
    var diferenca = Math.round((indice - 1) * 100);
    $('alim-fontes').textContent = 'Preços de ' + estadoNome.capital + '. Arroz, feijão, carne, leite, tomate, batata, pão francês, café, banana, açúcar, óleo e manteiga usam o preço médio do DIEESE de ' +
      D.DIEESE_DATA + ', coletado em supermercados, sem promoções. Os demais usam um preço comum de prateleira, ajustado para ' + estadoNome.capital +
      (diferenca === 0 ? ', que está na média das capitais.' : ', onde a comida custa cerca de ' + Math.abs(diferenca) + '% ' + (diferenca > 0 ? 'a mais' : 'a menos') + ' que a média das capitais.') +
      ' No interior, os preços podem ser diferentes. Tudo é estimativa para uma pessoa.';
  }

  $('alim-lista-plano').addEventListener('click', function () { estado.listaDe = 'plano'; salvar(); desenharCompras(); });
  $('alim-lista-hoje').addEventListener('click', function () { estado.listaDe = 'hoje'; salvar(); desenharCompras(); });
  $('alim-voltar-plano').addEventListener('click', function () { irPara('plano'); });

  $('alim-apagar').addEventListener('click', function () {
    if (!window.confirm('Apagar os seus dados desta página deste aparelho?')) return;
    try { localStorage.removeItem(CHAVE); } catch (e) { /* nada guardado */ }
    location.reload();
  });

  /* --- Início --------------------------------------------------------------------------------- */

  preencherOpcoes();
  montarRefeicoes();
  mostrarPerfil();
  desenharItens();
  liberarPassos();
  puxarDaConta();
})();
