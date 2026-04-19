ALTER TABLE webhooks
  ADD COLUMN IF NOT EXISTS previous_forward_url TEXT;
