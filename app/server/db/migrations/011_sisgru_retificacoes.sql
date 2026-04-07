-- Migration 011: Retificação local de serviço em pagamentos SISGRU com histórico auditável

ALTER TABLE sisgru_pagamentos
    ADD COLUMN IF NOT EXISTS servico_id_retificado BIGINT,
    ADD COLUMN IF NOT EXISTS servico_nome_retificado VARCHAR(255),
    ADD COLUMN IF NOT EXISTS retificado BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS retificado_em TIMESTAMP,
    ADD COLUMN IF NOT EXISTS retificado_por UUID REFERENCES usuarios(id);

CREATE TABLE IF NOT EXISTS sisgru_pagamentos_retificacoes (
    id BIGSERIAL PRIMARY KEY,
    pagamento_id BIGINT NOT NULL REFERENCES sisgru_pagamentos(id) ON DELETE CASCADE,
    servico_id_anterior BIGINT NOT NULL,
    servico_nome_anterior VARCHAR(255) NOT NULL,
    servico_id_novo BIGINT NOT NULL,
    servico_nome_novo VARCHAR(255) NOT NULL,
    retificado_por UUID NOT NULL REFERENCES usuarios(id),
    retificado_em TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sisgru_pagamentos_retificado
    ON sisgru_pagamentos(retificado);

CREATE INDEX IF NOT EXISTS idx_sisgru_pagamentos_retificacoes_pagamento
    ON sisgru_pagamentos_retificacoes(pagamento_id);

CREATE INDEX IF NOT EXISTS idx_sisgru_pagamentos_retificacoes_data
    ON sisgru_pagamentos_retificacoes(retificado_em DESC);

INSERT INTO _migrations (nome, aplicado_em)
VALUES ('011_sisgru_retificacoes', NOW())
ON CONFLICT DO NOTHING;