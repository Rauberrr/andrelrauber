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

-- Limite de tentativas de login, registro e recuperação de senha
CREATE TABLE IF NOT EXISTS tentativas (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  chave CHAR(64) NOT NULL,
  criado_em DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY idx_tentativa (chave, criado_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
