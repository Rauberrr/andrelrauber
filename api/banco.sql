-- Estrutura do banco de medidas. Importe este arquivo pelo phpMyAdmin.

CREATE TABLE IF NOT EXISTS medidas_clientes (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  nome VARCHAR(120) NOT NULL,
  telefone VARCHAR(11) NOT NULL,
  cidade VARCHAR(120) NOT NULL,
  parte_cima TINYINT(1) NOT NULL DEFAULT 0,
  parte_baixo TINYINT(1) NOT NULL DEFAULT 0,

  altura DECIMAL(4,1) NULL,
  peso DECIMAL(4,1) NULL,
  tamanho VARCHAR(60) NOT NULL DEFAULT '',

  pescoco DECIMAL(4,1) NULL,
  ombro DECIMAL(4,1) NULL,
  torax DECIMAL(4,1) NULL,
  cintura_cima DECIMAL(4,1) NULL,
  manga DECIMAL(4,1) NULL,
  braco DECIMAL(4,1) NULL,
  punho DECIMAL(4,1) NULL,
  comprimento_peca DECIMAL(4,1) NULL,

  cintura_baixo DECIMAL(4,1) NULL,
  quadril DECIMAL(4,1) NULL,
  gancho DECIMAL(4,1) NULL,
  coxa DECIMAL(4,1) NULL,
  joelho DECIMAL(4,1) NULL,
  boca DECIMAL(4,1) NULL,
  comprimento_total DECIMAL(4,1) NULL,

  cor VARCHAR(80) NOT NULL DEFAULT '',
  tecido VARCHAR(80) NOT NULL DEFAULT '',
  caimento VARCHAR(40) NOT NULL DEFAULT '',
  data_desejada DATE NULL,
  observacoes TEXT NULL,

  ip_resumo CHAR(64) NOT NULL DEFAULT '',

  PRIMARY KEY (id),
  KEY idx_telefone (telefone),
  KEY idx_limite (ip_resumo, criado_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
