-- Migration 007: Tabela de transações de tickets

CREATE TABLE IF NOT EXISTS ticket_transacoes (
    id SERIAL PRIMARY KEY,
    tipo VARCHAR(20) NOT NULL,
    quantidade INTEGER NOT NULL,
    responsavel_id UUID NOT NULL REFERENCES usuarios(id),
    criado_em TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticket_transacoes_responsavel
    ON ticket_transacoes(responsavel_id);

INSERT INTO _migrations (nome, aplicado_em)
VALUES ('007_ticket_transacoes', NOW())
ON CONFLICT DO NOTHING;
