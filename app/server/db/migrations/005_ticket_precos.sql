-- Migration 005: Tabela de configuração de valores de ticket refeição

CREATE TABLE IF NOT EXISTS ticket_precos (
    id SERIAL PRIMARY KEY,
    tipo VARCHAR(20) NOT NULL UNIQUE,
    valor NUMERIC(10,2) NOT NULL,
    criado_em TIMESTAMP DEFAULT NOW(),
    atualizado_em TIMESTAMP DEFAULT NOW()
);

INSERT INTO ticket_precos (tipo, valor) VALUES
    ('estudante', 3.00),
    ('servidor', 10.00),
    ('visitante', 15.00)
ON CONFLICT (tipo) DO NOTHING;

INSERT INTO _migrations (nome, aplicado_em)
VALUES ('005_ticket_precos', NOW())
ON CONFLICT DO NOTHING;
