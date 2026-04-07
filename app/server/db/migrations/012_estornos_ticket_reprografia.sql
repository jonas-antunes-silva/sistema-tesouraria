-- Migration 012: Estorno de entregas de ticket e baixas de reprografia com auditoria

ALTER TABLE ticket_entregas
    ADD COLUMN IF NOT EXISTS estornado BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS estornado_em TIMESTAMP,
    ADD COLUMN IF NOT EXISTS estornado_por UUID REFERENCES usuarios(id),
    ADD COLUMN IF NOT EXISTS estorno_motivo TEXT;

ALTER TABLE reprografia_usos
    ADD COLUMN IF NOT EXISTS estornado BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS estornado_em TIMESTAMP,
    ADD COLUMN IF NOT EXISTS estornado_por UUID REFERENCES usuarios(id),
    ADD COLUMN IF NOT EXISTS estorno_motivo TEXT;

CREATE INDEX IF NOT EXISTS idx_ticket_entregas_estornado
    ON ticket_entregas(estornado);

CREATE INDEX IF NOT EXISTS idx_reprografia_usos_estornado
    ON reprografia_usos(estornado);

INSERT INTO _migrations (nome, aplicado_em)
VALUES ('012_estornos_ticket_reprografia', NOW())
ON CONFLICT DO NOTHING;