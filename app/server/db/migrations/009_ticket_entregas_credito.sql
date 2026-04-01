-- Migration 009: Controle de crédito acumulado e baixa parcial de tickets

CREATE TABLE IF NOT EXISTS ticket_entregas (
    id SERIAL PRIMARY KEY,
    cpf VARCHAR(20) NOT NULL,
    nome VARCHAR(255) NOT NULL,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('estudante', 'servidor', 'visitante')),
    quantidade INTEGER NOT NULL CHECK (quantidade > 0),
    valor_unitario NUMERIC(12,2) NOT NULL CHECK (valor_unitario > 0),
    valor_consumido NUMERIC(12,2) NOT NULL CHECK (valor_consumido > 0),
    saldo_antes NUMERIC(12,2) NOT NULL CHECK (saldo_antes >= 0),
    saldo_depois NUMERIC(12,2) NOT NULL CHECK (saldo_depois >= 0),
    responsavel_id UUID NOT NULL REFERENCES usuarios(id),
    criado_em TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticket_entregas_cpf
    ON ticket_entregas(cpf);

CREATE INDEX IF NOT EXISTS idx_ticket_entregas_criado_em
    ON ticket_entregas(criado_em DESC);

INSERT INTO _migrations (nome, aplicado_em)
VALUES ('009_ticket_entregas_credito', NOW())
ON CONFLICT DO NOTHING;
