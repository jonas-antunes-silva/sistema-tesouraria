-- Migration 002: Tabelas SISGRU
-- Requisitos: 7.5, 15.5

CREATE TABLE IF NOT EXISTS sisgru_grus (
    id                          VARCHAR(30) PRIMARY KEY,
    exercicio                   INTEGER,
    recolhimento                INTEGER,
    recolhimento_contabilizado  INTEGER,
    ug_emitente                 VARCHAR(20),
    ug_arrecadadora             VARCHAR(20),
    numero_ra                   VARCHAR(30),
    situacao                    VARCHAR(5),
    especie_gr                  INTEGER,
    tipo_registro_gru           INTEGER,
    tipo_recolhedor             INTEGER,
    codigo_recolhedor           VARCHAR(20),
    num_referencia              INTEGER,
    data_vencimento             DATE,
    data_competencia            VARCHAR(10),
    agente_arrecadador          VARCHAR(10),
    meio_pagamento              VARCHAR(5),
    vl_principal                NUMERIC(12,2),
    vl_desconto                 NUMERIC(12,2),
    vl_outra_deducao            NUMERIC(12,2),
    vl_multa                    NUMERIC(12,2),
    vl_juros                    NUMERIC(12,2),
    vl_acrescimo                NUMERIC(12,2),
    vl_total                    NUMERIC(12,2),
    observacao                  TEXT,
    dt_emissao                  DATE,
    dt_transferencia            DATE,
    dt_contabilizacao_siafi     TIMESTAMP,
    origem_arrecadacao          INTEGER,
    especie_ingresso            INTEGER,
    dt_criacao_sisgru           TIMESTAMP,
    codigo_pagamento            VARCHAR(30),
    tipo_servico                INTEGER,
    servico                     INTEGER,
    numero_transacao_psp        VARCHAR(50),
    origem_gru                  INTEGER,
    sincronizado_em             TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sisgru_pagamentos (
    id                                  BIGINT PRIMARY KEY,
    codigo                              VARCHAR(30),
    ug_codigo                           VARCHAR(20),
    ug_exercicio                        BIGINT,
    ug_nome                             VARCHAR(255),
    tipo_servico_codigo                 BIGINT,
    tipo_servico_nome                   VARCHAR(255),
    servico_id                          BIGINT,
    servico_nome                        VARCHAR(255),
    data                                TIMESTAMP,
    data_pagamento_psp                 TIMESTAMP,
    data_vencimento                    DATE,
    competencia                         VARCHAR(10),
    numero_transacao_psp                VARCHAR(50),
    recolhimento_codigo                BIGINT,
    recolhimento_exercicio             BIGINT,
    recolhimento_descricao             VARCHAR(255),
    codigo_contribuinte                VARCHAR(20),
    nome_contribuinte                  VARCHAR(255),
    numero_referencia                   BIGINT,
    tipo_pagamento_codigo             VARCHAR(5),
    tipo_pagamento_nome               VARCHAR(50),
    provedor_pagamento_id             BIGINT,
    provedor_pagamento_nome           VARCHAR(100),
    situacao                           VARCHAR(5),
    valor_total                        NUMERIC(12,2),
    data_alteracao_situacao_pag_tesouro TIMESTAMP,
    ispb                               VARCHAR(10),
    forma_utilizacao_pag_tesouro      BIGINT,
    sincronizado_em                    TIMESTAMP DEFAULT NOW(),
    ticket_retirado                    BOOLEAN DEFAULT false,
    ticket_retirado_em                TIMESTAMP,
    ticket_retirado_por               UUID REFERENCES usuarios(id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_sisgru_grus_dt_emissao
    ON sisgru_grus(dt_emissao);

CREATE INDEX IF NOT EXISTS idx_sisgru_pagamentos_data_alteracao
    ON sisgru_pagamentos(data_alteracao_situacao_pag_tesouro);

CREATE INDEX IF NOT EXISTS idx_sisgru_pagamentos_servico_id
    ON sisgru_pagamentos(servico_id);

CREATE INDEX IF NOT EXISTS idx_sisgru_pagamentos_ticket_retirado
    ON sisgru_pagamentos(ticket_retirado);
