-- Migration 010: Migrar consumo legado de tickets e remover estruturas antigas

-- Garante rastreabilidade idempotente por pagamento legado
ALTER TABLE ticket_entregas
  ADD COLUMN IF NOT EXISTS origem_pagamento_id BIGINT UNIQUE;

-- Migra pagamentos antigos marcados como retirados para o ledger novo
INSERT INTO ticket_entregas (
  cpf,
  nome,
  tipo,
  quantidade,
  valor_unitario,
  valor_consumido,
  saldo_antes,
  saldo_depois,
  responsavel_id,
  criado_em,
  origem_pagamento_id
)
SELECT
  sp.codigo_contribuinte,
  COALESCE(NULLIF(TRIM(sp.nome_contribuinte), ''), 'Nao informado') AS nome,
  COALESCE(tt.tipo, 'servidor')::VARCHAR(20) AS tipo,
  1 AS quantidade,
  sp.valor_total::NUMERIC(12,2) AS valor_unitario,
  sp.valor_total::NUMERIC(12,2) AS valor_consumido,
  0::NUMERIC(12,2) AS saldo_antes,
  0::NUMERIC(12,2) AS saldo_depois,
  COALESCE(
    sp.ticket_retirado_por,
    (SELECT u.id FROM usuarios u ORDER BY u.id LIMIT 1)
  ) AS responsavel_id,
  COALESCE(sp.ticket_retirado_em, NOW()) AS criado_em,
  sp.id AS origem_pagamento_id
FROM sisgru_pagamentos sp
LEFT JOIN ticket_transacoes tt ON tt.id = sp.ticket_transacao_id
WHERE sp.servico_id = 14671
  AND sp.situacao = 'CO'
  AND COALESCE(sp.ticket_retirado, false) = true
  AND EXISTS (SELECT 1 FROM usuarios)
  AND NOT EXISTS (
    SELECT 1
    FROM ticket_entregas te
    WHERE te.origem_pagamento_id = sp.id
  );

-- Remove índice legado
DROP INDEX IF EXISTS idx_sisgru_pagamentos_ticket_retirado;

-- Remove colunas legadas de controle de retirada por pagamento
ALTER TABLE sisgru_pagamentos
  DROP COLUMN IF EXISTS ticket_retirado,
  DROP COLUMN IF EXISTS ticket_retirado_em,
  DROP COLUMN IF EXISTS ticket_retirado_por,
  DROP COLUMN IF EXISTS ticket_transacao_id;

-- Remove estrutura de transações antiga
DROP INDEX IF EXISTS idx_ticket_transacoes_responsavel;
DROP TABLE IF EXISTS ticket_transacoes;
