/* Tira o fundo da foto em segundo plano, no próprio aparelho: a tela não trava,
   a biblioteca não tem acesso à página e a foto não é enviada a nenhum serviço.
   A biblioteca tem licença AGPL. Fonte: https://github.com/imgly/background-removal-js */
import { removeBackground } from 'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/+esm';

var ultimoAviso = 0;

function avisar(chave, atual, total) {
  var agora = Date.now();
  if (agora - ultimoAviso < 150 && atual !== total) return;
  ultimoAviso = agora;
  self.postMessage({ progresso: { chave: chave, atual: atual, total: total } });
}

self.onmessage = function (e) {
  removeBackground(e.data, {
    model: 'isnet_quint8',
    output: { format: 'image/png' },
    progress: avisar
  }).then(function (recorte) {
    self.postMessage({ recorte: recorte });
  }).catch(function (erro) {
    self.postMessage({ erro: String(erro && erro.message || erro) });
  });
};

self.postMessage({ pronto: true });
