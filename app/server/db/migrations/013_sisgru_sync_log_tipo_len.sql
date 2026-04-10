-- Migration 013: ampliar tamanho do tipo no log SISGRU

ALTER TABLE sisgru_sync_log
  ALTER COLUMN tipo TYPE VARCHAR(40);