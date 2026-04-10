-- Migration 014: ampliar num_referencia de GRUs para BIGINT

ALTER TABLE sisgru_grus
  ALTER COLUMN num_referencia TYPE BIGINT;