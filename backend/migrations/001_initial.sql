CREATE TABLE IF NOT EXISTS services (
  id SERIAL PRIMARY KEY,
  name VARCHAR(80) NOT NULL UNIQUE,
  owner VARCHAR(80) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'healthy' CHECK (status IN ('healthy', 'degraded', 'down')),
  uptime NUMERIC(5,2) NOT NULL DEFAULT 99.90,
  latency_ms INTEGER NOT NULL DEFAULT 120,
  last_checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS incidents (
  id SERIAL PRIMARY KEY,
  service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  title VARCHAR(160) NOT NULL,
  severity VARCHAR(12) NOT NULL CHECK (severity IN ('sev1', 'sev2', 'sev3')),
  status VARCHAR(20) NOT NULL DEFAULT 'investigating' CHECK (status IN ('investigating', 'identified', 'monitoring', 'resolved')),
  summary TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS deployments (
  id SERIAL PRIMARY KEY,
  service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  version VARCHAR(40) NOT NULL,
  environment VARCHAR(20) NOT NULL CHECK (environment IN ('production', 'staging')),
  status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'failed', 'running')),
  deployed_by VARCHAR(80) NOT NULL,
  deployed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO services (name, owner, status, uptime, latency_ms) VALUES
  ('api-gateway', 'Platform', 'healthy', 99.98, 84),
  ('checkout', 'Commerce', 'degraded', 99.61, 412),
  ('notifications', 'Core Apps', 'healthy', 99.94, 107),
  ('worker-pool', 'Platform', 'healthy', 99.88, 156)
ON CONFLICT (name) DO NOTHING;

INSERT INTO incidents (service_id, title, severity, status, summary)
SELECT id, 'Elevated checkout latency', 'sev2', 'investigating', 'Checkout requests are breaching the 350ms target in two regions.'
FROM services WHERE name = 'checkout'
AND NOT EXISTS (SELECT 1 FROM incidents WHERE title = 'Elevated checkout latency');

INSERT INTO deployments (service_id, version, environment, status, deployed_by)
SELECT id, 'v2.18.0', 'production', 'success', 'maya@platform'
FROM services WHERE name = 'api-gateway'
AND NOT EXISTS (SELECT 1 FROM deployments WHERE version = 'v2.18.0');
