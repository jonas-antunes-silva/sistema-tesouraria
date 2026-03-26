-- Migration 004: Módulo de Reprografia
-- Requisitos: 16.1, 17.6, 18.1

CREATE TABLE IF NOT EXISTS reprografia_creditos (
    cpf           VARCHAR(14) PRIMARY KEY,
    nome          VARCHAR(255) NOT NULL,
    saldo         NUMERIC(10,2) NOT NULL DEFAULT 0,
    atualizado_em TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reprografia_usos (
    id              SERIAL PRIMARY KEY,
    cpf             VARCHAR(14) NOT NULL REFERENCES reprografia_creditos(cpf),
    nome            VARCHAR(255) NOT NULL,
    num_copias      INTEGER NOT NULL CHECK (num_copias > 0),
    valor_por_copia NUMERIC(10,4) NOT NULL,
    valor_total     NUMERIC(10,2) NOT NULL,
    saldo_anterior  NUMERIC(10,2) NOT NULL,
    saldo_posterior NUMERIC(10,2) NOT NULL,
    operador_id     UUID NOT NULL REFERENCES usuarios(id),
    registrado_em   TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reprografia_config (
    chave         VARCHAR(50) PRIMARY KEY,
    valor         VARCHAR(255) NOT NULL,
    descricao     VARCHAR(255),
    atualizado_em TIMESTAMP NOT NULL DEFAULT NOW(),
    atualizado_por UUID REFERENCES usuarios(id)
);

-- Registro inicial do valor por cópia
INSERT INTO reprografia_config (chave, valor, descricao)
VALUES ('valor_por_copia', '0.10', 'Valor cobrado por cópia em R$')
ON CONFLICT DO NOTHING;

-- Índices
CREATE INDEX IF NOT EXISTS idx_reprografia_usos_cpf
    ON reprografia_usos(cpf);

CREATE INDEX IF NOT EXISTS idx_reprografia_usos_registrado_em
    ON reprografia_usos(registrado_em DESC);
