-- Migration 015: Livro-caixa para creditos de reprografia e ticket com backfill

CREATE TABLE IF NOT EXISTS financeiro_lancamentos (
    id BIGSERIAL PRIMARY KEY,
    modulo VARCHAR(20) NOT NULL CHECK (modulo IN ('reprografia', 'ticket')),
    cpf VARCHAR(14) NOT NULL,
    nome VARCHAR(255) NOT NULL,
    tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('credito', 'debito')),
    valor NUMERIC(12,2) NOT NULL CHECK (valor > 0),
    origem VARCHAR(40) NOT NULL,
    origem_id VARCHAR(64) NOT NULL,
    chave_idempotencia VARCHAR(128) NOT NULL UNIQUE,
    metadata JSONB,
    criado_em TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_financeiro_lancamentos_modulo_cpf
    ON financeiro_lancamentos(modulo, cpf);

CREATE INDEX IF NOT EXISTS idx_financeiro_lancamentos_criado_em
    ON financeiro_lancamentos(criado_em DESC);

-- Backfill de creditos vindos de pagamentos SISGRU concluidos.
INSERT INTO financeiro_lancamentos (
    modulo,
    cpf,
    nome,
    tipo,
    valor,
    origem,
    origem_id,
    chave_idempotencia,
    metadata,
    criado_em
)
SELECT
    CASE
      WHEN COALESCE(sp.servico_id_retificado, sp.servico_id) = 16279 THEN 'reprografia'
      ELSE 'ticket'
    END AS modulo,
    regexp_replace(sp.codigo_contribuinte, '\\D', '', 'g') AS cpf,
    COALESCE(NULLIF(btrim(sp.nome_contribuinte), ''), 'Nao informado') AS nome,
    'credito' AS tipo,
    sp.valor_total::numeric(12,2) AS valor,
    'sisgru_pagamento' AS origem,
    sp.id::text AS origem_id,
    CASE
      WHEN COALESCE(sp.servico_id_retificado, sp.servico_id) = 16279
        THEN 'reprografia:pagamento:' || sp.id::text
      ELSE 'ticket:pagamento:' || sp.id::text
    END AS chave_idempotencia,
    jsonb_build_object(
      'situacao', sp.situacao,
      'servico_id', COALESCE(sp.servico_id_retificado, sp.servico_id)
    ) AS metadata,
    COALESCE(sp.sincronizado_em, sp.dt_criacao, NOW()) AS criado_em
FROM sisgru_pagamentos sp
WHERE COALESCE(sp.servico_id_retificado, sp.servico_id) IN (16279, 14671)
  AND sp.situacao IN ('CO', 'CG')
  AND regexp_replace(sp.codigo_contribuinte, '\\D', '', 'g') ~ '^\\d{11}$'
  AND sp.valor_total > 0
ON CONFLICT (chave_idempotencia) DO NOTHING;

-- Backfill de debitos de uso de reprografia.
INSERT INTO financeiro_lancamentos (
    modulo,
    cpf,
    nome,
    tipo,
    valor,
    origem,
    origem_id,
    chave_idempotencia,
    metadata,
    criado_em
)
SELECT
    'reprografia' AS modulo,
    regexp_replace(ru.cpf, '\\D', '', 'g') AS cpf,
    COALESCE(NULLIF(btrim(ru.nome), ''), 'Nao informado') AS nome,
    'debito' AS tipo,
    ru.valor_total::numeric(12,2) AS valor,
    'reprografia_uso' AS origem,
    ru.id::text AS origem_id,
    'reprografia:uso:' || ru.id::text AS chave_idempotencia,
    jsonb_build_object('num_copias', ru.num_copias) AS metadata,
    COALESCE(ru.registrado_em, NOW()) AS criado_em
FROM reprografia_usos ru
WHERE regexp_replace(ru.cpf, '\\D', '', 'g') ~ '^\\d{11}$'
  AND ru.valor_total > 0
ON CONFLICT (chave_idempotencia) DO NOTHING;

-- Backfill de creditos por estorno de uso de reprografia.
INSERT INTO financeiro_lancamentos (
    modulo,
    cpf,
    nome,
    tipo,
    valor,
    origem,
    origem_id,
    chave_idempotencia,
    metadata,
    criado_em
)
SELECT
    'reprografia' AS modulo,
    regexp_replace(ru.cpf, '\\D', '', 'g') AS cpf,
    COALESCE(NULLIF(btrim(ru.nome), ''), 'Nao informado') AS nome,
    'credito' AS tipo,
    ru.valor_total::numeric(12,2) AS valor,
    'reprografia_estorno' AS origem,
    ru.id::text AS origem_id,
    'reprografia:uso_estorno:' || ru.id::text AS chave_idempotencia,
    jsonb_build_object('motivo', ru.estorno_motivo) AS metadata,
    COALESCE(ru.estornado_em, NOW()) AS criado_em
FROM reprografia_usos ru
WHERE ru.estornado = true
  AND regexp_replace(ru.cpf, '\\D', '', 'g') ~ '^\\d{11}$'
  AND ru.valor_total > 0
ON CONFLICT (chave_idempotencia) DO NOTHING;

-- Backfill de debitos de entregas de ticket.
INSERT INTO financeiro_lancamentos (
    modulo,
    cpf,
    nome,
    tipo,
    valor,
    origem,
    origem_id,
    chave_idempotencia,
    metadata,
    criado_em
)
SELECT
    'ticket' AS modulo,
    regexp_replace(te.cpf, '\\D', '', 'g') AS cpf,
    COALESCE(NULLIF(btrim(te.nome), ''), 'Nao informado') AS nome,
    'debito' AS tipo,
    te.valor_consumido::numeric(12,2) AS valor,
    'ticket_entrega' AS origem,
    te.id::text AS origem_id,
    'ticket:entrega:' || te.id::text AS chave_idempotencia,
    jsonb_build_object('tipo', te.tipo, 'quantidade', te.quantidade) AS metadata,
    COALESCE(te.criado_em, NOW()) AS criado_em
FROM ticket_entregas te
WHERE regexp_replace(te.cpf, '\\D', '', 'g') ~ '^\\d{11}$'
  AND te.valor_consumido > 0
ON CONFLICT (chave_idempotencia) DO NOTHING;

-- Backfill de creditos por estorno de ticket.
INSERT INTO financeiro_lancamentos (
    modulo,
    cpf,
    nome,
    tipo,
    valor,
    origem,
    origem_id,
    chave_idempotencia,
    metadata,
    criado_em
)
SELECT
    'ticket' AS modulo,
    regexp_replace(te.cpf, '\\D', '', 'g') AS cpf,
    COALESCE(NULLIF(btrim(te.nome), ''), 'Nao informado') AS nome,
    'credito' AS tipo,
    te.valor_consumido::numeric(12,2) AS valor,
    'ticket_estorno' AS origem,
    te.id::text AS origem_id,
    'ticket:entrega_estorno:' || te.id::text AS chave_idempotencia,
    jsonb_build_object('motivo', te.estorno_motivo) AS metadata,
    COALESCE(te.estornado_em, NOW()) AS criado_em
FROM ticket_entregas te
WHERE te.estornado = true
  AND regexp_replace(te.cpf, '\\D', '', 'g') ~ '^\\d{11}$'
  AND te.valor_consumido > 0
ON CONFLICT (chave_idempotencia) DO NOTHING;

-- Sincroniza saldo materializado de reprografia com o livro-caixa.
WITH saldo AS (
  SELECT
    regexp_replace(fl.cpf, '\\D', '', 'g') AS cpf,
    MAX(fl.nome) AS nome,
    SUM(CASE WHEN fl.tipo = 'credito' THEN fl.valor ELSE -fl.valor END)::numeric(10,2) AS saldo
  FROM financeiro_lancamentos fl
  WHERE fl.modulo = 'reprografia'
  GROUP BY regexp_replace(fl.cpf, '\\D', '', 'g')
)
INSERT INTO reprografia_creditos (cpf, nome, saldo, atualizado_em)
SELECT
  saldo.cpf,
  COALESCE(NULLIF(btrim(saldo.nome), ''), 'Nao informado') AS nome,
  GREATEST(saldo.saldo, 0)::numeric(10,2) AS saldo,
  NOW()
FROM saldo
ON CONFLICT (cpf) DO UPDATE
SET nome = EXCLUDED.nome,
    saldo = EXCLUDED.saldo,
    atualizado_em = NOW();

INSERT INTO _migrations (nome, aplicado_em)
VALUES ('015_livro_caixa_creditos', NOW())
ON CONFLICT DO NOTHING;
