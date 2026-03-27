-- Migration 003: Adicionar dt_criacao para rastrear quando o registro foi criado
-- Track when records were first inserted vs last synchronized

ALTER TABLE sisgru_grus ADD COLUMN IF NOT EXISTS dt_criacao TIMESTAMP;
ALTER TABLE sisgru_pagamentos ADD COLUMN IF NOT EXISTS dt_criacao TIMESTAMP;

INSERT INTO _migrations (nome, aplicado_em)
VALUES ('003_dt_criacao', NOW())
ON CONFLICT DO NOTHING;
