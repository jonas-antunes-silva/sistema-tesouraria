-- Migration 006: Adicionar campos de tipo e quantidade na entrega de tickets

ALTER TABLE sisgru_pagamentos 
  ADD COLUMN IF NOT EXISTS ticket_tipo VARCHAR(20),
  ADD COLUMN IF NOT EXISTS ticket_quantidade INTEGER;

INSERT INTO _migrations (nome, aplicado_em)
VALUES ('006_ticket_tipo_quantidade', NOW())
ON CONFLICT DO NOTHING;
