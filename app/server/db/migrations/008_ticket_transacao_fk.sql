-- Migration 008: Adicionar foreign key para transação de tickets

ALTER TABLE sisgru_pagamentos 
  ADD COLUMN IF NOT EXISTS ticket_transacao_id INTEGER REFERENCES ticket_transacoes(id);

ALTER TABLE sisgru_pagamentos 
  DROP COLUMN IF EXISTS ticket_tipo,
  DROP COLUMN IF EXISTS ticket_quantidade;

INSERT INTO _migrations (nome, aplicado_em)
VALUES ('008_ticket_transacao_fk', NOW())
ON CONFLICT DO NOTHING;
