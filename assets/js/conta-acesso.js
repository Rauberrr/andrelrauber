/* Páginas de acesso: criar conta, entrar, Google e recuperação de senha */
(function () {
  'use strict';

  var api = window.AR_API;
  var AUTH = 'api/auth.php?acao=';

  var registro = document.getElementById('form-registro');
  var entrar = document.getElementById('form-entrar');
  var esqueci = document.getElementById('form-esqueci');
  var redefinir = document.getElementById('form-redefinir');

  /* --- Mensagens ---------------------------------------------------------------- */

  function erroCampo(form, nome, mensagem) {
    var entrada = form.elements[nome];
    var caixa = document.getElementById('erro-' + nome);
    if (caixa) caixa.textContent = mensagem || '';
    if (entrada && entrada.setAttribute) {
      if (mensagem) entrada.setAttribute('aria-invalid', 'true');
      else entrada.removeAttribute('aria-invalid');
    }
  }

  function limparErros(form) {
    form.querySelectorAll('.erro').forEach(function (el) { el.textContent = ''; });
    form.querySelectorAll('[aria-invalid]').forEach(function (el) { el.removeAttribute('aria-invalid'); });
  }

  function erroGeral(form, mensagem) {
    var caixa = form.querySelector('.acesso-erro');
    if (caixa) caixa.textContent = mensagem || '';
  }

  function ocupado(form, sim) {
    var botao = form.querySelector('button[type="submit"]');
    if (!botao) return;
    botao.disabled = sim;
    if (sim) {
      botao.setAttribute('data-texto', botao.textContent);
      botao.textContent = 'Aguarde...';
    } else if (botao.getAttribute('data-texto')) {
      botao.textContent = botao.getAttribute('data-texto');
    }
  }

  function focarPrimeiroErro(form) {
    var campo = form.querySelector('[aria-invalid="true"]');
    if (campo) campo.focus();
  }

  function mostrarErrosServidor(form, resposta) {
    var campos = resposta.dados.campos || {};
    Object.keys(campos).forEach(function (nome) { erroCampo(form, nome, campos[nome]); });
    erroGeral(form, resposta.erro);
    focarPrimeiroErro(form);
  }

  /* --- Mostrar senha ----------------------------------------------------------------- */

  document.querySelectorAll('[data-ver-senha]').forEach(function (botao) {
    botao.addEventListener('click', function () {
      var campo = document.getElementById(botao.getAttribute('data-ver-senha'));
      var visivel = campo.type === 'text';
      campo.type = visivel ? 'password' : 'text';
      botao.textContent = visivel ? 'Mostrar' : 'Ocultar';
      botao.setAttribute('aria-pressed', String(!visivel));
    });
  });

  /* --- Criar conta -------------------------------------------------------------------- */

  if (registro) {
    registro.elements.telefone.addEventListener('input', function () {
      this.value = api.mascaraTelefone(this.value);
    });

    registro.addEventListener('submit', function (e) {
      e.preventDefault();
      limparErros(registro);
      erroGeral(registro, '');
      var f = registro.elements;
      var valido = true;
      function checar(condicao, nome, mensagem) {
        if (!condicao) { erroCampo(registro, nome, mensagem); valido = false; }
      }
      var digitos = f.telefone.value.replace(/\D/g, '');
      checar(f.nome.value.trim().length >= 2, 'nome', 'Informe seu nome completo.');
      checar(/^\S+@\S+\.\S+$/.test(f.email.value.trim()), 'email', 'Informe um e-mail válido.');
      checar(digitos.length === 10 || digitos.length === 11, 'telefone', 'Informe seu telefone com DDD.');
      checar(f.senha.value.length >= 8, 'senha', 'A senha precisa ter pelo menos 8 caracteres.');
      checar(f.consentimento.checked, 'consentimento', 'Para criar a conta, é preciso concordar com a política de privacidade.');
      if (!valido) { focarPrimeiroErro(registro); return; }

      ocupado(registro, true);
      api.post(AUTH + 'registrar', {
        nome: f.nome.value, email: f.email.value, telefone: f.telefone.value, senha: f.senha.value,
        consentimento: f.consentimento.checked, website: f.website.value
      }).then(function (r) {
        if (r.ok) { location.replace(api.destino('medidas.html')); return; }
        ocupado(registro, false);
        mostrarErrosServidor(registro, r);
      });
    });
  }

  /* --- Entrar -------------------------------------------------------------------------- */

  if (entrar) {
    entrar.addEventListener('submit', function (e) {
      e.preventDefault();
      limparErros(entrar);
      erroGeral(entrar, '');
      var f = entrar.elements;
      if (!f.email.value.trim() || !f.senha.value) {
        erroGeral(entrar, 'Informe seu e-mail e sua senha.');
        return;
      }
      ocupado(entrar, true);
      api.post(AUTH + 'entrar', { email: f.email.value, senha: f.senha.value }).then(function (r) {
        if (r.ok) { location.replace(api.destino('minha-conta.html')); return; }
        ocupado(entrar, false);
        erroGeral(entrar, r.erro);
      });
    });
  }

  /* --- Esqueci a senha --------------------------------------------------------------------- */

  if (esqueci) {
    esqueci.addEventListener('submit', function (e) {
      e.preventDefault();
      erroGeral(esqueci, '');
      var email = esqueci.elements.email.value.trim();
      if (!/^\S+@\S+\.\S+$/.test(email)) {
        erroGeral(esqueci, 'Informe um e-mail válido.');
        return;
      }
      ocupado(esqueci, true);
      api.post(AUTH + 'esqueci', { email: email }).then(function (r) {
        ocupado(esqueci, false);
        if (!r.ok) { erroGeral(esqueci, r.erro); return; }
        esqueci.hidden = true;
        document.getElementById('esqueci-feito').hidden = false;
      });
    });
  }

  /* --- Nova senha ------------------------------------------------------------------------------ */

  if (redefinir) {
    var token = new URLSearchParams(location.search).get('token') || '';
    if (!token) erroGeral(redefinir, 'Este link está incompleto. Peça um novo em "Esqueci minha senha".');

    redefinir.addEventListener('submit', function (e) {
      e.preventDefault();
      limparErros(redefinir);
      erroGeral(redefinir, '');
      var senha = redefinir.elements.senha.value;
      if (senha.length < 8) {
        erroCampo(redefinir, 'senha', 'A senha precisa ter pelo menos 8 caracteres.');
        focarPrimeiroErro(redefinir);
        return;
      }
      ocupado(redefinir, true);
      api.post(AUTH + 'redefinir', { token: token, senha: senha }).then(function (r) {
        if (r.ok) { location.replace('minha-conta.html'); return; }
        ocupado(redefinir, false);
        mostrarErrosServidor(redefinir, r);
      });
    });
  }

  /* --- Sessão e Google --------------------------------------------------------------------------- */

  var caixaGoogle = document.getElementById('acesso-google');

  function respostaGoogle(resposta) {
    var form = registro || entrar;
    erroGeral(form, '');
    api.post(AUTH + 'google', { credencial: resposta.credential }).then(function (r) {
      if (r.ok) {
        var padrao = r.dados.novo ? 'medidas.html' : 'minha-conta.html';
        location.replace(api.destino(registro ? 'medidas.html' : padrao));
        return;
      }
      erroGeral(form, r.erro);
    });
  }

  function carregarGoogle(clienteId) {
    var script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = function () {
      window.google.accounts.id.initialize({ client_id: clienteId, callback: respostaGoogle });
      var alvo = document.getElementById('google-botao');
      window.google.accounts.id.renderButton(alvo, {
        theme: 'outline', size: 'large', shape: 'rectangular', logo_alignment: 'center',
        text: registro ? 'signup_with' : 'signin_with', locale: 'pt-BR',
        width: Math.min(alvo.offsetWidth || 340, 400)
      });
    };
    document.head.appendChild(script);
    caixaGoogle.hidden = false;
  }

  api.get(AUTH + 'sessao').then(function (r) {
    if (r.status === 0 || !r.ok) {
      var form = registro || entrar || esqueci || redefinir;
      if (form) erroGeral(form, 'O sistema de contas não está disponível neste momento. Tente novamente mais tarde.');
      return;
    }
    if (r.dados.logado && (registro || entrar)) {
      location.replace(api.destino('minha-conta.html'));
      return;
    }
    if (caixaGoogle && r.dados.googleClientId) carregarGoogle(r.dados.googleClientId);
  });
})();
