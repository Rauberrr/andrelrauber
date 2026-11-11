-- Estrutura do banco de dados. Importe este arquivo pelo phpMyAdmin.

CREATE TABLE IF NOT EXISTS usuarios (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome VARCHAR(120) NOT NULL DEFAULT '',
  email VARCHAR(190) NOT NULL,
  telefone VARCHAR(11) NOT NULL DEFAULT '',
  senha_hash VARCHAR(255) NULL,
  google_id VARCHAR(64) NULL,
  email_verificado TINYINT(1) NOT NULL DEFAULT 0,
  admin TINYINT(1) NOT NULL DEFAULT 0,
  sessao_versao INT UNSIGNED NOT NULL DEFAULT 1,
  consentiu_em DATETIME NULL,
  origem VARCHAR(20) NOT NULL DEFAULT 'senha',
  criado_em DATETIME NOT NULL,
  ultimo_acesso_em DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_email (email),
  UNIQUE KEY uq_google (google_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cadastros (
  usuario_id INT UNSIGNED NOT NULL,

  cep VARCHAR(8) NOT NULL DEFAULT '',
  logradouro VARCHAR(160) NOT NULL DEFAULT '',
  numero VARCHAR(20) NOT NULL DEFAULT '',
  complemento VARCHAR(80) NOT NULL DEFAULT '',
  bairro VARCHAR(80) NOT NULL DEFAULT '',
  cidade VARCHAR(80) NOT NULL DEFAULT '',
  uf VARCHAR(2) NOT NULL DEFAULT '',

  altura DECIMAL(4,1) NULL,
  peso DECIMAL(4,1) NULL,
  tamanho VARCHAR(60) NOT NULL DEFAULT '',

  cor VARCHAR(80) NOT NULL DEFAULT '',
  tecido VARCHAR(80) NOT NULL DEFAULT '',
  caimento VARCHAR(40) NOT NULL DEFAULT '',
  data_desejada DATE NULL,
  observacoes VARCHAR(800) NOT NULL DEFAULT '',

  parte_cima TINYINT(1) NULL,
  pescoco DECIMAL(4,1) NULL,
  ombro DECIMAL(4,1) NULL,
  torax DECIMAL(4,1) NULL,
  cintura_cima DECIMAL(4,1) NULL,
  manga DECIMAL(4,1) NULL,
  braco DECIMAL(4,1) NULL,
  punho DECIMAL(4,1) NULL,
  comprimento_peca DECIMAL(4,1) NULL,

  parte_baixo TINYINT(1) NULL,
  cintura_baixo DECIMAL(4,1) NULL,
  quadril DECIMAL(4,1) NULL,
  gancho DECIMAL(4,1) NULL,
  coxa DECIMAL(4,1) NULL,
  joelho DECIMAL(4,1) NULL,
  boca DECIMAL(4,1) NULL,
  comprimento_total DECIMAL(4,1) NULL,

  etapa_atual VARCHAR(30) NULL,
  progresso TINYINT UNSIGNED NOT NULL DEFAULT 0,
  iniciado_em DATETIME NULL,
  atualizado_em DATETIME NULL,
  concluido_em DATETIME NULL,

  PRIMARY KEY (usuario_id),
  CONSTRAINT fk_cadastro_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Linha do tempo de cada pessoa: etapas vistas, respostas salvas, acessos
CREATE TABLE IF NOT EXISTS eventos (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario_id INT UNSIGNED NOT NULL,
  tipo VARCHAR(30) NOT NULL,
  etapa VARCHAR(30) NULL,
  detalhes VARCHAR(500) NULL,
  criado_em DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY idx_evento_usuario (usuario_id, id),
  CONSTRAINT fk_evento_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS redefinicoes_senha (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario_id INT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expira_em DATETIME NOT NULL,
  usado_em DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_token (token_hash),
  CONSTRAINT fk_redefinicao_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Links de confirmação de e-mail: só o hash do código fica guardado
CREATE TABLE IF NOT EXISTS confirmacoes_email (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario_id INT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expira_em DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_confirmacao_token (token_hash),
  CONSTRAINT fk_confirmacao_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Guarda-roupa: cada peça tem uma foto e uma descrição
CREATE TABLE IF NOT EXISTS pecas (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario_id INT UNSIGNED NOT NULL,
  tipo VARCHAR(30) NOT NULL,
  cor VARCHAR(30) NOT NULL,
  corte VARCHAR(30) NOT NULL DEFAULT '',
  tecido VARCHAR(30) NOT NULL DEFAULT '',
  formalidade VARCHAR(20) NOT NULL DEFAULT 'casual',
  clima VARCHAR(20) NOT NULL DEFAULT 'qualquer',
  apelido VARCHAR(60) NOT NULL DEFAULT '',
  arquivo VARCHAR(64) NOT NULL,
  fundo_removido TINYINT(1) NOT NULL DEFAULT 0,
  criado_em DATETIME NOT NULL,
  atualizado_em DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY idx_peca_usuario (usuario_id, id),
  CONSTRAINT fk_peca_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Looks que a pessoa salvou ou descartou. A chave são os números das peças em ordem.
CREATE TABLE IF NOT EXISTS looks (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario_id INT UNSIGNED NOT NULL,
  chave VARCHAR(120) NOT NULL,
  situacao VARCHAR(12) NOT NULL,
  criado_em DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_look (usuario_id, chave),
  CONSTRAINT fk_look_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Peças que a pessoa excluiu e pode adicionar de novo
CREATE TABLE IF NOT EXISTS pecas_excluidas (
  peca_id INT UNSIGNED NOT NULL,
  usuario_id INT UNSIGNED NOT NULL,
  excluida_em DATETIME NOT NULL,
  PRIMARY KEY (peca_id),
  KEY idx_excluida_usuario (usuario_id),
  CONSTRAINT fk_excluida_peca FOREIGN KEY (peca_id) REFERENCES pecas (id) ON DELETE CASCADE,
  CONSTRAINT fk_excluida_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Peças sugeridas pela marca que a pessoa já recebeu. Impede que voltem depois de excluídas.
CREATE TABLE IF NOT EXISTS pecas_sugeridas_recebidas (
  usuario_id INT UNSIGNED NOT NULL,
  codigo VARCHAR(60) NOT NULL,
  PRIMARY KEY (usuario_id, codigo),
  CONSTRAINT fk_sugerida_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- "Esporte fino" passou a se chamar "Misto". Importar de novo não muda mais nada.
UPDATE pecas SET formalidade = 'misto' WHERE formalidade = 'esporte_fino';

-- Nome e observação que a pessoa dá a um look, como "Jantar de sexta"
CREATE TABLE IF NOT EXISTS looks_notas (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario_id INT UNSIGNED NOT NULL,
  chave VARCHAR(120) NOT NULL,
  nome VARCHAR(60) NOT NULL DEFAULT '',
  observacao VARCHAR(300) NOT NULL DEFAULT '',
  atualizado_em DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_look_nota (usuario_id, chave),
  CONSTRAINT fk_look_nota_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Pedidos criados no painel e pagos pelo Mercado Pago. Valores em centavos.
-- Nenhum dado de cartão é guardado aqui.
CREATE TABLE IF NOT EXISTS pedidos (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario_id INT UNSIGNED NOT NULL,
  codigo CHAR(32) NOT NULL,
  descricao VARCHAR(160) NOT NULL,
  valor_centavos INT UNSIGNED NOT NULL,
  frete_centavos INT UNSIGNED NOT NULL DEFAULT 0,
  situacao VARCHAR(12) NOT NULL DEFAULT 'aguardando',
  mp_pagamento_id VARCHAR(30) NOT NULL DEFAULT '',
  metodo VARCHAR(30) NOT NULL DEFAULT '',
  parcelas INT UNSIGNED NOT NULL DEFAULT 0,
  aceitou_condicoes_em DATETIME NULL,
  pago_em DATETIME NULL,
  criado_em DATETIME NOT NULL,
  atualizado_em DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_pedido_codigo (codigo),
  KEY idx_pedido_usuario (usuario_id, id),
  CONSTRAINT fk_pedido_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Alimentação: o que a pessoa informou e o plano, guardados só com a autorização dela.
-- São dados de saúde: não aparecem no painel da marca.
CREATE TABLE IF NOT EXISTS alimentacao (
  usuario_id INT UNSIGNED NOT NULL,
  dados TEXT NOT NULL,
  consentiu_em DATETIME NOT NULL,
  atualizado_em DATETIME NOT NULL,
  PRIMARY KEY (usuario_id),
  CONSTRAINT fk_alimentacao_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Diário do guarda-roupa: o que a pessoa vestiu, em que dia e onde.
-- A chave são os números das peças em ordem, como nos looks.
CREATE TABLE IF NOT EXISTS usos_pecas (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario_id INT UNSIGNED NOT NULL,
  dia DATE NOT NULL,
  chave VARCHAR(120) NOT NULL,
  ocasiao VARCHAR(60) NOT NULL DEFAULT '',
  observacao VARCHAR(200) NOT NULL DEFAULT '',
  criado_em DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY idx_uso_usuario (usuario_id, dia),
  CONSTRAINT fk_uso_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Quanto a pessoa pagou em cada peça, para a conta do custo por uso. Em centavos.
CREATE TABLE IF NOT EXISTS pecas_valores (
  peca_id INT UNSIGNED NOT NULL,
  usuario_id INT UNSIGNED NOT NULL,
  preco_centavos INT UNSIGNED NOT NULL,
  PRIMARY KEY (peca_id),
  KEY idx_valor_usuario (usuario_id),
  CONSTRAINT fk_valor_peca FOREIGN KEY (peca_id) REFERENCES pecas (id) ON DELETE CASCADE,
  CONSTRAINT fk_valor_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Ocasiões e Treino: o que a pessoa anotou em cada app.
-- O Treino só é guardado com a autorização dela, registrada em consentiu_em.
CREATE TABLE IF NOT EXISTS apps_dados (
  usuario_id INT UNSIGNED NOT NULL,
  app VARCHAR(20) NOT NULL,
  dados MEDIUMTEXT NOT NULL,
  consentiu_em DATETIME NULL,
  atualizado_em DATETIME NOT NULL,
  PRIMARY KEY (usuario_id, app),
  CONSTRAINT fk_apps_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Lembretes por e-mail já enviados, para o mesmo aviso não chegar duas vezes
CREATE TABLE IF NOT EXISTS lembretes_enviados (
  usuario_id INT UNSIGNED NOT NULL,
  chave VARCHAR(100) NOT NULL,
  enviado_em DATETIME NOT NULL,
  PRIMARY KEY (usuario_id, chave),
  CONSTRAINT fk_lembrete_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Limite de tentativas de login, registro e recuperação de senha
CREATE TABLE IF NOT EXISTS tentativas (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  chave CHAR(64) NOT NULL,
  criado_em DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY idx_tentativa (chave, criado_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Coleções agendadas: os produtos ligados a elas só aparecem na data do lançamento
CREATE TABLE IF NOT EXISTS colecoes (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome VARCHAR(80) NOT NULL,
  descricao VARCHAR(600) NOT NULL DEFAULT '',
  lanca_em DATETIME NOT NULL,
  criado_em DATETIME NOT NULL,
  atualizado_em DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY idx_colecao_lanca (lanca_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Produtos da coleção, cadastrados no painel. cores, detalhes e fotos são listas em JSON.
CREATE TABLE IF NOT EXISTS produtos (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  slug VARCHAR(90) NOT NULL,
  nome VARCHAR(90) NOT NULL,
  categoria VARCHAR(20) NOT NULL,
  resumo VARCHAR(200) NOT NULL DEFAULT '',
  descricao TEXT NOT NULL,
  preco_centavos INT UNSIGNED NOT NULL,
  frete_centavos INT UNSIGNED NOT NULL DEFAULT 0,
  tecido VARCHAR(80) NOT NULL DEFAULT '',
  composicao VARCHAR(120) NOT NULL DEFAULT '',
  gramatura VARCHAR(40) NOT NULL DEFAULT '',
  modelagem VARCHAR(12) NOT NULL DEFAULT 'regular',
  cores TEXT NOT NULL,
  detalhes TEXT NOT NULL,
  cuidados VARCHAR(300) NOT NULL DEFAULT '',
  prazo_dias SMALLINT UNSIGNED NOT NULL DEFAULT 20,
  fotos TEXT NOT NULL,
  situacao VARCHAR(12) NOT NULL DEFAULT 'rascunho',
  colecao_id INT UNSIGNED NULL,
  ordem INT NOT NULL DEFAULT 0,
  criado_em DATETIME NOT NULL,
  atualizado_em DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_produto_slug (slug),
  KEY idx_produto_situacao (situacao, ordem),
  CONSTRAINT fk_produto_colecao FOREIGN KEY (colecao_id) REFERENCES colecoes (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Pedidos exclusivos: a pessoa descreve a peça que quer, e a marca responde com valor e prazo
CREATE TABLE IF NOT EXISTS pedidos_exclusivos (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario_id INT UNSIGNED NOT NULL,
  peca VARCHAR(20) NOT NULL,
  ocasiao VARCHAR(20) NOT NULL DEFAULT '',
  tecido VARCHAR(20) NOT NULL DEFAULT '',
  cor VARCHAR(60) NOT NULL DEFAULT '',
  caimento VARCHAR(12) NOT NULL DEFAULT '',
  detalhes TEXT NOT NULL,
  referencia VARCHAR(300) NOT NULL DEFAULT '',
  observacoes VARCHAR(1000) NOT NULL DEFAULT '',
  orcamento VARCHAR(20) NOT NULL DEFAULT '',
  quantidade TINYINT UNSIGNED NOT NULL DEFAULT 1,
  prazo DATE NULL,
  situacao VARCHAR(12) NOT NULL DEFAULT 'novo',
  criado_em DATETIME NOT NULL,
  atualizado_em DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY idx_exclusivo_usuario (usuario_id, id),
  CONSTRAINT fk_exclusivo_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Manter conectado: um token por aparelho. O banco guarda só o resumo (hash) do segredo.
CREATE TABLE IF NOT EXISTS sessoes_lembradas (
  seletor CHAR(24) NOT NULL,
  segredo_hash CHAR(64) NOT NULL,
  usuario_id INT UNSIGNED NOT NULL,
  sessao_versao INT UNSIGNED NOT NULL DEFAULT 0,
  expira_em DATETIME NOT NULL,
  criado_em DATETIME NOT NULL,
  PRIMARY KEY (seletor),
  KEY idx_lembrada_usuario (usuario_id),
  CONSTRAINT fk_lembrada_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Hábitos: aparelhos que recebem lembretes no navegador (Web Push).
-- Guarda só o endereço que o navegador entrega; o aviso em si fica em avisos_push.
CREATE TABLE IF NOT EXISTS push_inscricoes (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario_id INT UNSIGNED NOT NULL,
  endpoint VARCHAR(800) NOT NULL,
  endpoint_hash CHAR(64) NOT NULL,
  criado_em DATETIME NOT NULL,
  usado_em DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_push_endpoint (endpoint_hash),
  KEY idx_push_usuario (usuario_id),
  CONSTRAINT fk_push_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Avisos esperando o navegador buscar (o toque do Web Push vai sem conteúdo)
CREATE TABLE IF NOT EXISTS avisos_push (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario_id INT UNSIGNED NOT NULL,
  titulo VARCHAR(80) NOT NULL,
  texto VARCHAR(200) NOT NULL,
  marca VARCHAR(40) NOT NULL,
  criado_em DATETIME NOT NULL,
  entregue_em DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_aviso_usuario (usuario_id, entregue_em),
  CONSTRAINT fk_aviso_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Vídeos do painel: contas ligadas em cada rede, com os tokens cifrados pelo segredo do config.php
CREATE TABLE IF NOT EXISTS redes_contas (
  rede VARCHAR(20) NOT NULL,
  nome VARCHAR(120) NOT NULL,
  dados TEXT NOT NULL,
  conectado_em DATETIME NOT NULL,
  PRIMARY KEY (rede)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Vídeos enviados pelo painel. O arquivo fica em api/privado/videos e sai depois de publicado.
CREATE TABLE IF NOT EXISTS videos (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  arquivo VARCHAR(80) NOT NULL,
  nome VARCHAR(160) NOT NULL,
  tamanho BIGINT UNSIGNED NOT NULL,
  recebido BIGINT UNSIGNED NOT NULL DEFAULT 0,
  tipo VARCHAR(40) NOT NULL,
  criado_em DATETIME NOT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Uma linha por vídeo e por rede: agendada, enviando, processando, publicada, erro ou cancelada
CREATE TABLE IF NOT EXISTS publicacoes (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  video_id INT UNSIGNED NOT NULL,
  rede VARCHAR(20) NOT NULL,
  titulo VARCHAR(100) NOT NULL,
  legenda TEXT NOT NULL,
  agendado_para DATETIME NOT NULL,
  situacao VARCHAR(20) NOT NULL,
  estado TEXT NOT NULL,
  link VARCHAR(300) NOT NULL,
  erro VARCHAR(300) NOT NULL,
  tentativas INT UNSIGNED NOT NULL DEFAULT 0,
  travada_em DATETIME NULL,
  criado_em DATETIME NOT NULL,
  atualizado_em DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY idx_publicacao_fila (situacao, agendado_para),
  CONSTRAINT fk_publicacao_video FOREIGN KEY (video_id) REFERENCES videos (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
