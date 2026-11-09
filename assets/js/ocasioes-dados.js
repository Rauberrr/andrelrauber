/* Ocasiões: tipos de evento, trajes explicados e prazos de confecção.
   As listas acompanham as de api/apps.php. */
window.AR_OC = (function () {
  'use strict';

  // traje: o mais comum quando o convite não diz nada, de dia e à noite
  var TIPOS = [
    { id: 'casamento', rotulo: 'Casamento', traje: { dia: 'esporte_fino', noite: 'social' }, artigo: 'um casamento' },
    { id: 'formatura', rotulo: 'Formatura', traje: { dia: 'esporte_fino', noite: 'social' }, artigo: 'uma formatura',
      dica: 'Na colação, a beca vai por cima: prefira roupa escura e sapato social. No baile, vale o traje do convite.' },
    { id: 'batizado', rotulo: 'Batizado ou festa de família', traje: { dia: 'esporte_fino', noite: 'esporte_fino' }, artigo: 'um batizado' },
    { id: 'aniversario', rotulo: 'Aniversário ou festa', traje: { dia: 'passeio', noite: 'passeio' }, artigo: 'uma festa' },
    { id: 'jantar', rotulo: 'Jantar', traje: { dia: 'passeio', noite: 'passeio' }, artigo: 'um jantar' },
    { id: 'entrevista', rotulo: 'Entrevista de emprego', traje: { dia: 'esporte_fino', noite: 'esporte_fino' }, artigo: 'uma entrevista',
      dica: 'Na dúvida, vá um nível acima do que as pessoas usam no dia a dia da empresa. Roupa bem passada e sapato limpo contam mais que a marca.' },
    { id: 'trabalho', rotulo: 'Evento de trabalho ou reunião', traje: { dia: 'esporte_fino', noite: 'esporte_fino' }, artigo: 'um evento de trabalho' },
    { id: 'religioso', rotulo: 'Cerimônia religiosa', traje: { dia: 'esporte_fino', noite: 'esporte_fino' }, artigo: 'uma cerimônia',
      dica: 'Prefira cores sóbrias e evite peças muito justas ou chamativas.' },
    { id: 'viagem', rotulo: 'Viagem', traje: null, artigo: 'uma viagem' },
    { id: 'outro', rotulo: 'Outro evento', traje: { dia: 'passeio', noite: 'passeio' }, artigo: 'um evento' }
  ];

  // nivel: faixa de formalidade dos looks do guarda-roupa que servem (0 esportivo a 3 social)
  var TRAJES = [
    {
      id: 'black_tie', rotulo: 'Black tie (traje a rigor)', curto: 'Black tie', min: 2.4, max: 3,
      resumo: 'O traje mais formal de todos. Aparece em casamentos à noite, bailes e jantares de gala.',
      usar: ['Smoking preto ou azul-marinho, com lapela de cetim', 'Camisa branca, de preferência com punho duplo', 'Gravata-borboleta preta', 'Sapato social preto, bem engraxado ou de verniz', 'Meias pretas finas'],
      evitar: ['Terno de cor clara', 'Gravata comum no lugar da borboleta', 'Relógio esportivo'],
      exige: ['conjunto', 'gravata', 'sapato_social'], principal: 'smoking'
    },
    {
      id: 'social', rotulo: 'Social (passeio completo)', curto: 'Social', min: 2.4, max: 3,
      resumo: 'Terno completo e gravata. É o traje mais pedido em casamentos à noite e formaturas.',
      usar: ['Terno escuro: azul-marinho, grafite ou preto à noite', 'Camisa clara, branca ou azul-clara', 'Gravata', 'Sapato social preto ou marrom-escuro, com cinto da mesma cor', 'Meias escuras, da cor da calça'],
      evitar: ['Tênis ou mocassim muito casual', 'Calça sem o paletó', 'Camisa de manga curta'],
      exige: ['conjunto', 'gravata', 'sapato_social'], principal: 'terno'
    },
    {
      id: 'esporte_fino', rotulo: 'Esporte fino', curto: 'Esporte fino', min: 2, max: 3,
      resumo: 'Arrumado, mas sem gravata obrigatória. O blazer ou o terno é o que mais conta.',
      usar: ['Blazer ou terno, com ou sem gravata', 'Calça de alfaiataria ou de sarja', 'Camisa social, ou polo de malha fina de dia', 'Mocassim ou sapato'],
      evitar: ['Jeans desbotado ou rasgado', 'Tênis esportivo', 'Bermuda'],
      exige: ['camada_arrumada', 'calcado_arrumado'], principal: 'blazer'
    },
    {
      id: 'passeio', rotulo: 'Passeio (casual arrumado)', curto: 'Passeio', min: 1.4, max: 2.6,
      resumo: 'A roupa do dia a dia, só que mais caprichada. Paletó não é obrigatório.',
      usar: ['Camisa ou polo', 'Calça de sarja, de alfaiataria ou jeans escuro', 'Mocassim, bota ou tênis de couro limpo', 'Um blazer, se a noite pedir'],
      evitar: ['Camiseta de time ou com estampa grande', 'Chinelo', 'Roupa de academia'],
      exige: ['sem_esportivo'], principal: 'camisa'
    },
    {
      id: 'casual', rotulo: 'Casual', curto: 'Casual', min: 0.8, max: 2.1,
      resumo: 'Confortável e descontraído, mas bem cuidado.',
      usar: ['Camiseta lisa, polo ou camisa de manga curta', 'Jeans ou sarja', 'Tênis limpo'],
      evitar: ['Roupa amassada', 'Peças de academia'],
      exige: [], principal: ''
    },
    {
      id: 'praia', rotulo: 'Praia ou ao ar livre', curto: 'Praia', min: 1.4, max: 2.6,
      resumo: 'Tecidos leves e cores claras. Comum em casamentos na praia ou no campo, de dia.',
      usar: ['Linho ou algodão leve', 'Camisa de linho, de manga longa dobrada', 'Calça clara de linho ou sarja', 'Mocassim sem meia ou alpargata'],
      evitar: ['Terno escuro de lã', 'Sapato social pesado', 'Gravata'],
      exige: ['sem_esportivo'], principal: 'camisa'
    }
  ];

  var PAPEIS = [
    { id: 'convidado', rotulo: 'Convidado' },
    { id: 'padrinho', rotulo: 'Padrinho', dica: 'Padrinhos costumam combinar a cor do traje com os noivos. Pergunte antes de escolher.', sobMedida: true },
    { id: 'noivo', rotulo: 'Noivo', dica: 'O traje do noivo é o mais especial da festa: vale fazer sob medida, com tempo para as provas.', sobMedida: true, folgaExtra: 14 },
    { id: 'formando', rotulo: 'Formando' },
    { id: 'anfitriao', rotulo: 'Anfitrião', dica: 'Quem recebe pode ficar um pouco mais arrumado que os convidados, nunca menos.' },
    { id: 'candidato', rotulo: 'Candidato' }
  ];

  // Prazos estimados, em dias, para cada peça sob medida. O prazo de verdade é combinado
  // na conversa com a marca: ajuste estes números quando quiser.
  var SOB_MEDIDA = {
    smoking: { rotulo: 'smoking', dias: 42 },
    terno: { rotulo: 'terno', dias: 35 },
    blazer: { rotulo: 'blazer', dias: 28 },
    calca: { rotulo: 'calça de alfaiataria', dias: 21 },
    camisa: { rotulo: 'camisa social', dias: 21 },
    colete: { rotulo: 'colete', dias: 21 }
  };
  // Dias a mais para a prova, os ajustes e o envio
  var FOLGA = 10;

  var ATIVIDADES = [
    { id: 'passeio', rotulo: 'Passeios' },
    { id: 'trabalho', rotulo: 'Trabalho ou reuniões' },
    { id: 'jantar', rotulo: 'Jantar ou noite' },
    { id: 'formal', rotulo: 'Evento formal' },
    { id: 'praia', rotulo: 'Praia ou piscina' },
    { id: 'esporte', rotulo: 'Academia ou corrida' }
  ];

  var CLIMAS = [
    { id: 'auto', rotulo: 'Descobrir pela data e o lugar' },
    { id: 'calor', rotulo: 'Calor' },
    { id: 'meia_estacao', rotulo: 'Meia-estação' },
    { id: 'frio', rotulo: 'Frio' },
    { id: 'variado', rotulo: 'Varia muito' }
  ];

  var UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

  function indice(lista) {
    var mapa = {};
    lista.forEach(function (i) { mapa[i.id] = i; });
    return mapa;
  }

  // Clima provável pelo mês e pela região, quando a previsão ainda não existe
  function climaProvavel(uf, iso, periodo) {
    var mes = Number(String(iso).split('-')[1]);
    var sul = ['RS', 'SC', 'PR'].indexOf(uf) !== -1;
    var centroSudeste = ['SP', 'RJ', 'MG', 'ES', 'DF', 'GO', 'MS', 'MT'].indexOf(uf) !== -1;
    var clima;
    if (sul) {
      if (mes >= 6 && mes <= 8) clima = 'frio';
      else if (mes === 5 || mes === 9 || mes === 10 || mes === 4) clima = 'meia_estacao';
      else clima = 'calor';
    } else if (centroSudeste) {
      clima = mes >= 5 && mes <= 8 ? 'meia_estacao' : 'calor';
    } else if (uf) {
      clima = 'calor';
    } else {
      clima = 'meia_estacao';
    }
    if (periodo === 'noite' && clima === 'calor' && sul) clima = 'meia_estacao';
    return clima;
  }

  return {
    TIPOS: TIPOS, TRAJES: TRAJES, PAPEIS: PAPEIS, SOB_MEDIDA: SOB_MEDIDA, FOLGA: FOLGA,
    ATIVIDADES: ATIVIDADES, CLIMAS: CLIMAS, UFS: UFS,
    porTipo: indice(TIPOS), porTraje: indice(TRAJES), porPapel: indice(PAPEIS),
    climaProvavel: climaProvavel
  };
})();
