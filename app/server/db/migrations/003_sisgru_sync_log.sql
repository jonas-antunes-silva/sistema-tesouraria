-- Migration 003: Log de sincronização SISGRU
-- Requisitos: 7.6

CREATE TABLE IF NOT EXISTS sisgru_sync_log (
    id            SERIAL PRIMARY KEY,
    tipo          VARCHAR(20) NOT NULL,   -- 'grus' ou 'pagamentos'
    iniciado_em   TIMESTAMP NOT NULL DEFAULT NOW(),
    finalizado_em TIMESTAMP,
    qtd_novos     INTEGER,
    qtd_total     INTEGER,
    status        VARCHAR(20) NOT NULL,   -- 'sucesso' ou 'erro'
    mensagem_erro TEXT
);
