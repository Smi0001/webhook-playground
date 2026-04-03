CREATE TABLE IF NOT EXISTS webhooks (
  id            SERIAL PRIMARY KEY,
  uuid          VARCHAR(36)  UNIQUE NOT NULL,
  name          VARCHAR(255) NOT NULL,
  basic_auth_enabled   BOOLEAN DEFAULT FALSE,
  basic_auth_username  VARCHAR(255),
  basic_auth_password  VARCHAR(255),  -- bcrypt hash when set
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS webhook_requests (
  id           SERIAL PRIMARY KEY,
  webhook_id   INTEGER NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  method       VARCHAR(10)  NOT NULL,
  path         TEXT,
  headers      JSONB,
  body         TEXT,          -- raw body string
  body_parsed  JSONB,         -- parsed JSON body (if applicable)
  query_params JSONB,
  ip_address   VARCHAR(45),
  content_type VARCHAR(255),
  received_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_requests_webhook_id
  ON webhook_requests(webhook_id);

CREATE INDEX IF NOT EXISTS idx_webhook_requests_received_at
  ON webhook_requests(received_at DESC);
