-- MenuReal AR — esquema inicial
-- Arquivos 3D continuam no Netlify Blobs; aqui ficam os dados.

CREATE TABLE lojas (
  slug           TEXT PRIMARY KEY,               -- endereço da loja; '_demo' = página inicial
  nome           TEXT NOT NULL,
  email          TEXT UNIQUE,                    -- login do dono (nulo na demonstração)
  senha_hash     TEXT,                           -- scrypt
  tipo           TEXT NOT NULL DEFAULT 'alimentos' CHECK (tipo IN ('alimentos', 'produtos')),
  slogan         TEXT NOT NULL DEFAULT '',
  abre           TEXT NOT NULL DEFAULT '08:00',
  fecha          TEXT NOT NULL DEFAULT '18:00',
  dias           SMALLINT[] NOT NULL DEFAULT '{1,2,3,4,5,6}',
  whatsapp       TEXT NOT NULL DEFAULT '',
  categorias     TEXT[] NOT NULL DEFAULT '{}',
  criada_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizada_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE produtos (
  loja             TEXT NOT NULL REFERENCES lojas (slug) ON DELETE CASCADE ON UPDATE CASCADE,
  id               TEXT NOT NULL,
  posicao          INTEGER NOT NULL,
  nome             TEXT NOT NULL,
  categoria        TEXT NOT NULL,
  preco            NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (preco >= 0),
  descricao        TEXT NOT NULL DEFAULT '',
  largura_cm       NUMERIC(8, 2) NOT NULL DEFAULT 5,
  profundidade_cm  NUMERIC(8, 2) NOT NULL DEFAULT 5,
  altura_cm        NUMERIC(8, 2) NOT NULL DEFAULT 5,
  modelo           TEXT NOT NULL DEFAULT '',
  ilustrativo      BOOLEAN NOT NULL DEFAULT true,
  ingredientes     TEXT NOT NULL DEFAULT '',
  alergenos        TEXT[] NOT NULL DEFAULT '{}',
  tamanhos         JSONB NOT NULL DEFAULT '[]',  -- [{ id, nome, preco, dim:{largura,profundidade,altura}, modelo }]
  PRIMARY KEY (loja, id)
);
CREATE INDEX produtos_por_loja ON produtos (loja, posicao);

CREATE TABLE tarefas_3d (
  id         TEXT PRIMARY KEY,                   -- id da tarefa na Meshy
  loja       TEXT NOT NULL DEFAULT '',
  resultado  JSONB NOT NULL,
  criada_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE configuracao (
  chave  TEXT PRIMARY KEY,
  valor  JSONB NOT NULL
);
