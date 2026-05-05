ALTER TABLE webhook_requests
  ADD COLUMN IF NOT EXISTS remark TEXT;
