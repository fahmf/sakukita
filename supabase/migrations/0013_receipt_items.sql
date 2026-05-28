-- Saku Kita — Add receipt_items column for AI scan persistence (0013)
-- Stores line items extracted from receipt scans as JSONB

ALTER TABLE transactions
  ADD COLUMN receipt_items JSONB DEFAULT NULL;

COMMENT ON COLUMN transactions.receipt_items IS 'JSON array of receipt line items from AI scan: [{name, price}]';
