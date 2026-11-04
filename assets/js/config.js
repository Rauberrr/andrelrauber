/* ==========================================================================
   Configurações do site — é aqui que você muda número e liga o banco de dados
   ========================================================================== */
window.AR_CONFIG = {
  // WhatsApp que recebe as medidas: 55 (Brasil) + DDD + número, só dígitos
  whatsapp: '5554997096003',

  // false = só envia pelo WhatsApp e nada fica guardado no site.
  // true  = também salva no banco de dados. Antes, siga o passo a passo do README.md.
  salvarNoBanco: false,

  // Arquivo PHP que recebe os dados quando salvarNoBanco é true
  endereco: 'api/salvar-medidas.php'
};
