import express from 'express';
import cors from 'cors';
import { query } from './db.js';

const app = express();
const port = Number(process.env.PORT || 8000);
app.use(cors());
app.use(express.json());

app.get('/api/health', async (_request, response) => {
  try {
    await query('SELECT 1');
    response.json({ status: 'ok', database: 'connected', checkedAt: new Date().toISOString() });
  } catch (error) {
    response.status(503).json({ status: 'degraded', database: 'unavailable', detail: error.message });
  }
});

app.get('/api/dashboard', async (_request, response, next) => {
  try {
    const [services, incidents, deployments] = await Promise.all([
      query('SELECT id, name, owner, status, uptime, latency_ms, last_checked_at FROM services ORDER BY name'),
      query(`SELECT i.id, i.title, i.severity, i.status, i.summary, i.created_at, s.name AS service
        FROM incidents i JOIN services s ON s.id = i.service_id
        WHERE i.status <> 'resolved' ORDER BY i.created_at DESC`),
      query(`SELECT d.id, d.version, d.environment, d.status, d.deployed_by, d.deployed_at, s.name AS service
        FROM deployments d JOIN services s ON s.id = d.service_id ORDER BY d.deployed_at DESC LIMIT 8`),
    ]);
    response.json({ services: services.rows, incidents: incidents.rows, deployments: deployments.rows });
  } catch (error) {
    next(error);
  }
});

app.patch('/api/incidents/:id', async (request, response, next) => {
  const allowed = ['investigating', 'identified', 'monitoring', 'resolved'];
  const { status } = request.body;
  if (!allowed.includes(status)) return response.status(400).json({ error: 'Invalid incident status' });
  try {
    const result = await query(`UPDATE incidents SET status = $1,
      resolved_at = CASE WHEN $1 = 'resolved' THEN NOW() ELSE NULL END
      WHERE id = $2 RETURNING id, status, resolved_at`, [status, request.params.id]);
    if (!result.rowCount) return response.status(404).json({ error: 'Incident not found' });
    response.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(500).json({ error: 'Internal server error' });
});

app.listen(port, () => console.log(`Opsboard API listening on port ${port}`));
