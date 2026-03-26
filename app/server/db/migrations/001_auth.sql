-- Migration 001: Autenticação e RBAC
-- Requisitos: 1.5, 1.6, 3.6

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS usuarios (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome          VARCHAR(255) NOT NULL,
    email         VARCHAR(255) UNIQUE NOT NULL,
    senha_hash    VARCHAR(255) NOT NULL,
    ativo         BOOLEAN DEFAULT true,
    criado_em     TIMESTAMP DEFAULT NOW(),
    atualizado_em TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS grupos (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome        VARCHAR(100) UNIQUE NOT NULL,
    descricao   TEXT,
    criado_em   TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS permissoes (
    id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome      VARCHAR(100) UNIQUE NOT NULL,
    descricao TEXT
);

CREATE TABLE IF NOT EXISTS usuario_grupos (
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    grupo_id   UUID NOT NULL REFERENCES grupos(id) ON DELETE CASCADE,
    PRIMARY KEY (usuario_id, grupo_id)
);

CREATE TABLE IF NOT EXISTS grupo_permissoes (
    grupo_id     UUID NOT NULL REFERENCES grupos(id) ON DELETE CASCADE,
    permissao_id UUID NOT NULL REFERENCES permissoes(id) ON DELETE CASCADE,
    PRIMARY KEY (grupo_id, permissao_id)
);

CREATE TABLE IF NOT EXISTS sessoes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id  UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    token_hash  VARCHAR(64) NOT NULL,
    expira_em   TIMESTAMP NOT NULL,
    criado_em   TIMESTAMP DEFAULT NOW(),
    ip_origem   INET
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_usuarios_email       ON usuarios(email);
CREATE INDEX IF NOT EXISTS idx_sessoes_token_hash   ON sessoes(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessoes_expira_em    ON sessoes(expira_em);
CREATE INDEX IF NOT EXISTS idx_sessoes_usuario_id   ON sessoes(usuario_id);
