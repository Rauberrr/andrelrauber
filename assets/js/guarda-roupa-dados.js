/* Guarda-roupa: as opções de cada peça. Acompanham as listas de api/guarda-roupa.php. */
window.AR_GR = (function () {
  'use strict';

  var GRUPOS = [
    { id: 'cima', rotulo: 'Parte de cima' },
    { id: 'camada', rotulo: 'Sobreposição' },
    { id: 'conjunto', rotulo: 'Conjunto' },
    { id: 'baixo', rotulo: 'Parte de baixo' },
    { id: 'calcado', rotulo: 'Calçados' },
    { id: 'acessorio', rotulo: 'Acessórios' }
  ];

  // nivel: 0 esportivo, 1 casual, 2 misto, 3 social. Serve para sugerir a ocasião de cada tipo.
  var TIPOS = [
    { id: 'camiseta', rotulo: 'Camiseta', grupo: 'cima', nivel: 1, clima: 'qualquer' },
    { id: 'regata', rotulo: 'Regata', grupo: 'cima', nivel: 1, clima: 'calor' },
    { id: 'polo', rotulo: 'Polo', grupo: 'cima', nivel: 1, clima: 'qualquer' },
    { id: 'camisa', rotulo: 'Camisa', grupo: 'cima', nivel: 2, clima: 'qualquer' },
    { id: 'camisa_curta', rotulo: 'Camisa de manga curta', grupo: 'cima', nivel: 1, clima: 'calor' },
    { id: 'malha', rotulo: 'Malha ou suéter', grupo: 'cima', nivel: 2, clima: 'frio' },
    { id: 'moletom', rotulo: 'Moletom', grupo: 'cima', nivel: 1, clima: 'frio' },
    { id: 'blazer', rotulo: 'Blazer', grupo: 'camada', nivel: 2, clima: 'qualquer' },
    { id: 'jaqueta', rotulo: 'Jaqueta', grupo: 'camada', nivel: 1, clima: 'frio' },
    { id: 'casaco', rotulo: 'Casaco', grupo: 'camada', nivel: 2, clima: 'frio' },
    { id: 'sobretudo', rotulo: 'Sobretudo', grupo: 'camada', nivel: 3, clima: 'frio' },
    { id: 'cardigan', rotulo: 'Cardigã', grupo: 'camada', nivel: 2, clima: 'meia_estacao' },
    { id: 'colete', rotulo: 'Colete', grupo: 'camada', nivel: 2, clima: 'qualquer' },
    { id: 'terno', rotulo: 'Terno', grupo: 'conjunto', nivel: 3, clima: 'qualquer' },
    { id: 'calca', rotulo: 'Calça social', grupo: 'baixo', nivel: 2, clima: 'qualquer' },
    { id: 'calca_sarja', rotulo: 'Calça de sarja', grupo: 'baixo', nivel: 2, clima: 'qualquer' },
    { id: 'jeans', rotulo: 'Calça jeans', grupo: 'baixo', nivel: 1, clima: 'qualquer' },
    { id: 'calca_moletom', rotulo: 'Calça de moletom', grupo: 'baixo', nivel: 1, clima: 'frio' },
    { id: 'bermuda', rotulo: 'Bermuda', grupo: 'baixo', nivel: 1, clima: 'calor' },
    { id: 'short_esportivo', rotulo: 'Short esportivo', grupo: 'baixo', nivel: 0, clima: 'calor' },
    { id: 'sapato', rotulo: 'Sapato social', grupo: 'calcado', nivel: 3, clima: 'qualquer' },
    { id: 'mocassim', rotulo: 'Mocassim', grupo: 'calcado', nivel: 2, clima: 'qualquer' },
    { id: 'tenis', rotulo: 'Tênis', grupo: 'calcado', nivel: 1, clima: 'qualquer' },
    { id: 'bota', rotulo: 'Bota', grupo: 'calcado', nivel: 2, clima: 'frio' },
    { id: 'sandalia', rotulo: 'Sandália', grupo: 'calcado', nivel: 1, clima: 'calor' },
    { id: 'chinelo', rotulo: 'Chinelo', grupo: 'calcado', nivel: 0, clima: 'calor' },
    { id: 'cinto', rotulo: 'Cinto', grupo: 'acessorio', nivel: 2, clima: 'qualquer' },
    { id: 'gravata', rotulo: 'Gravata', grupo: 'acessorio', nivel: 3, clima: 'qualquer' },
    { id: 'bone', rotulo: 'Boné', grupo: 'acessorio', nivel: 1, clima: 'qualquer' },
    { id: 'oculos', rotulo: 'Óculos', grupo: 'acessorio', nivel: 1, clima: 'qualquer' },
    { id: 'relogio', rotulo: 'Relógio', grupo: 'acessorio', nivel: 2, clima: 'qualquer' },
    { id: 'acessorio', rotulo: 'Outro acessório', grupo: 'acessorio', nivel: 1, clima: 'qualquer' }
  ];

  // nome: como a cor aparece nas frases. descricao: como aparece depois de "cor".
  var CORES = [
    { id: 'preto', rotulo: 'Preto', nome: 'preto', descricao: 'preta', hex: '#141414', neutra: true },
    { id: 'branco', rotulo: 'Branco', nome: 'branco', descricao: 'branca', hex: '#f5f5f3', neutra: true },
    { id: 'off_white', rotulo: 'Off-white', nome: 'off-white', descricao: 'off-white', hex: '#e8e2d2', neutra: true },
    { id: 'cinza', rotulo: 'Cinza', nome: 'cinza', descricao: 'cinza', hex: '#9a9a98', neutra: true },
    { id: 'grafite', rotulo: 'Grafite', nome: 'grafite', descricao: 'grafite', hex: '#44464a', neutra: true },
    { id: 'azul_marinho', rotulo: 'Azul-marinho', nome: 'azul-marinho', descricao: 'azul-marinho', hex: '#1b2a4a', neutra: true },
    { id: 'azul', rotulo: 'Azul', nome: 'azul', descricao: 'azul', hex: '#2f62b0', neutra: false },
    { id: 'azul_claro', rotulo: 'Azul-claro', nome: 'azul-claro', descricao: 'azul-clara', hex: '#a3c3e0', neutra: true },
    { id: 'bege', rotulo: 'Bege', nome: 'bege', descricao: 'bege', hex: '#cdbb9b', neutra: true },
    { id: 'caqui', rotulo: 'Cáqui', nome: 'cáqui', descricao: 'cáqui', hex: '#a39566', neutra: true },
    { id: 'marrom', rotulo: 'Marrom', nome: 'marrom', descricao: 'marrom', hex: '#54392a', neutra: true },
    { id: 'caramelo', rotulo: 'Caramelo', nome: 'caramelo', descricao: 'caramelo', hex: '#a2672f', neutra: true },
    { id: 'verde_oliva', rotulo: 'Verde-oliva', nome: 'verde-oliva', descricao: 'verde-oliva', hex: '#555b38', neutra: true },
    { id: 'verde', rotulo: 'Verde', nome: 'verde', descricao: 'verde', hex: '#2d7a4b', neutra: false },
    { id: 'bordo', rotulo: 'Bordô', nome: 'bordô', descricao: 'bordô', hex: '#5c1322', neutra: false },
    { id: 'vermelho', rotulo: 'Vermelho', nome: 'vermelho', descricao: 'vermelha', hex: '#b5261e', neutra: false },
    { id: 'rosa', rotulo: 'Rosa', nome: 'rosa', descricao: 'rosa', hex: '#e0a3b2', neutra: false },
    { id: 'amarelo', rotulo: 'Amarelo', nome: 'amarelo', descricao: 'amarela', hex: '#e2bd36', neutra: false },
    { id: 'laranja', rotulo: 'Laranja', nome: 'laranja', descricao: 'laranja', hex: '#d9702a', neutra: false },
    { id: 'roxo', rotulo: 'Roxo', nome: 'roxo', descricao: 'roxa', hex: '#5e3a87', neutra: false },
    { id: 'estampado', rotulo: 'Estampado', nome: 'estampado', descricao: 'estampada', hex: null, neutra: false }
  ];

  var CORTES = [
    { id: 'sob_medida', rotulo: 'Sob medida' },
    { id: 'slim', rotulo: 'Slim' },
    { id: 'regular', rotulo: 'Regular' },
    { id: 'reto', rotulo: 'Reto' },
    { id: 'relaxed', rotulo: 'Relaxed' },
    { id: 'oversized', rotulo: 'Oversized' }
  ];

  var TECIDOS = [
    { id: 'algodao', rotulo: 'Algodão' },
    { id: 'linho', rotulo: 'Linho' },
    { id: 'la', rotulo: 'Lã' },
    { id: 'tricot', rotulo: 'Tricô' },
    { id: 'moletom', rotulo: 'Moletom' },
    { id: 'alfaiataria', rotulo: 'Alfaiataria' },
    { id: 'jeans', rotulo: 'Jeans' },
    { id: 'couro', rotulo: 'Couro' },
    { id: 'camurca', rotulo: 'Camurça' },
    { id: 'malha', rotulo: 'Malha' },
    { id: 'sarja', rotulo: 'Sarja' },
    { id: 'veludo', rotulo: 'Veludo' },
    { id: 'seda', rotulo: 'Seda' },
    { id: 'sintetico', rotulo: 'Sintético' },
    { id: 'outro', rotulo: 'Outro' }
  ];

  // nivel: quanto a ocasião é arrumada. Peças com níveis próximos combinam entre si.
  var FORMALIDADES = [
    { id: 'esportivo', rotulo: 'Esportivo', nivel: 0 },
    { id: 'casual', rotulo: 'Casual', nivel: 1 },
    { id: 'misto', rotulo: 'Misto (social e casual)', curto: 'Misto', nivel: 2 },
    { id: 'trabalho', rotulo: 'Trabalho', nivel: 2 },
    { id: 'festa', rotulo: 'Festa e noite', nivel: 2.5 },
    { id: 'social', rotulo: 'Social', nivel: 3 }
  ];

  var CLIMAS = [
    { id: 'qualquer', rotulo: 'Qualquer clima' },
    { id: 'calor', rotulo: 'Calor' },
    { id: 'meia_estacao', rotulo: 'Meia-estação' },
    { id: 'frio', rotulo: 'Frio' }
  ];

  function indice(lista) {
    var mapa = {};
    lista.forEach(function (item) { mapa[item.id] = item; });
    return mapa;
  }

  var porTipo = indice(TIPOS);
  var porCor = indice(CORES);
  var porCorte = indice(CORTES);
  var porTecido = indice(TECIDOS);
  var porFormalidade = indice(FORMALIDADES);

  // "Camiseta; cor preta; corte relaxed"
  function descrever(p) {
    var tipo = porTipo[p.tipo];
    var cor = porCor[p.cor];
    var corte = porCorte[p.corte];
    var tecido = porTecido[p.tecido];
    var partes = [];
    if (tipo) partes.push(tipo.rotulo);
    if (cor) partes.push('cor ' + cor.descricao);
    if (corte) partes.push('corte ' + corte.rotulo.toLowerCase());
    if (tecido && p.tecido !== 'outro') partes.push('tecido ' + tecido.rotulo.toLowerCase());
    return partes.join('; ');
  }

  // Tipo que não tem corte: calçados e acessórios
  function temCorte(tipoId) {
    var tipo = porTipo[tipoId];
    return !tipo || (tipo.grupo !== 'calcado' && tipo.grupo !== 'acessorio');
  }

  function formalidadePadrao(tipoId) {
    var tipo = porTipo[tipoId];
    var nivel = tipo ? tipo.nivel : 1;
    return FORMALIDADES.filter(function (f) { return f.nivel === nivel; })[0].id;
  }

  function climaPadrao(tipoId, tecidoId) {
    if (tecidoId === 'linho') return 'calor';
    if (tecidoId === 'la') return 'frio';
    var tipo = porTipo[tipoId];
    return tipo ? tipo.clima : 'qualquer';
  }

  return {
    GRUPOS: GRUPOS, TIPOS: TIPOS, CORES: CORES, CORTES: CORTES, TECIDOS: TECIDOS,
    FORMALIDADES: FORMALIDADES, CLIMAS: CLIMAS, porTipo: porTipo, porCor: porCor, porFormalidade: porFormalidade,
    descrever: descrever, temCorte: temCorte,
    formalidadePadrao: formalidadePadrao, climaPadrao: climaPadrao
  };
})();
