const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');
const db = require('../config/database');
const sse = require('../sse');

// ---------- Webhooks CRUD ----------

// Create a new webhook URL
router.post('/webhooks', async (req, res) => {
  const { name, basic_auth_enabled, basic_auth_username, basic_auth_password,
          forward_enabled, forward_url } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }
  if (forward_enabled && !forward_url) {
    return res.status(400).json({ error: 'forward_url is required when forwarding is enabled' });
  }
  try {
    const uuid = uuidv4();
    let hashedPw = null;
    if (basic_auth_enabled && basic_auth_password) {
      hashedPw = await bcrypt.hash(basic_auth_password, 10);
    }
    const { rows } = await db.query(
      `INSERT INTO webhooks (uuid, name, basic_auth_enabled, basic_auth_username, basic_auth_password,
                             forward_enabled, forward_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, uuid, name, basic_auth_enabled, basic_auth_username,
                 forward_enabled, forward_url, created_at`,
      [uuid, name.trim(), !!basic_auth_enabled, basic_auth_username || null, hashedPw,
       !!forward_enabled, forward_enabled ? forward_url.trim() : null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('POST /api/webhooks:', err.message);
    res.status(500).json({ error: 'Failed to create webhook' });
  }
});

// List all webhooks (newest first)
router.get('/webhooks', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, uuid, name, basic_auth_enabled, basic_auth_username,
              forward_enabled, forward_url, created_at
       FROM webhooks ORDER BY created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /api/webhooks:', err.message);
    res.status(500).json({ error: 'Failed to fetch webhooks' });
  }
});

// Get single webhook info
router.get('/webhooks/:uuid', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, uuid, name, basic_auth_enabled, basic_auth_username,
              forward_enabled, forward_url, created_at
       FROM webhooks WHERE uuid = $1`,
      [req.params.uuid]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('GET /api/webhooks/:uuid:', err.message);
    res.status(500).json({ error: 'Failed to fetch webhook' });
  }
});

// Update webhook (name / auth / forwarding settings)
router.put('/webhooks/:uuid', async (req, res) => {
  const { name, basic_auth_enabled, basic_auth_username, basic_auth_password,
          forward_enabled, forward_url } = req.body;
  try {
    const existing = await db.query('SELECT * FROM webhooks WHERE uuid = $1', [req.params.uuid]);
    if (!existing.rows.length) return res.status(404).json({ error: 'Not found' });

    let hashedPw = existing.rows[0].basic_auth_password;
    if (basic_auth_enabled && basic_auth_password) {
      hashedPw = await bcrypt.hash(basic_auth_password, 10);
    } else if (!basic_auth_enabled) {
      hashedPw = null;
    }

    const { rows } = await db.query(
      `UPDATE webhooks
       SET name                = COALESCE($1, name),
           basic_auth_enabled  = $2,
           basic_auth_username = $3,
           basic_auth_password = $4,
           forward_enabled     = $5,
           forward_url         = $6
       WHERE uuid = $7
       RETURNING id, uuid, name, basic_auth_enabled, basic_auth_username,
                 forward_enabled, forward_url, created_at`,
      [
        name ? name.trim() : null,
        !!basic_auth_enabled,
        basic_auth_enabled ? (basic_auth_username || existing.rows[0].basic_auth_username) : null,
        hashedPw,
        !!forward_enabled,
        forward_enabled ? (forward_url?.trim() || existing.rows[0].forward_url) : null,
        req.params.uuid,
      ]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error('PUT /api/webhooks/:uuid:', err.message);
    res.status(500).json({ error: 'Failed to update webhook' });
  }
});

// Delete a webhook (cascades to requests)
router.delete('/webhooks/:uuid', async (req, res) => {
  try {
    const { rowCount } = await db.query('DELETE FROM webhooks WHERE uuid = $1', [req.params.uuid]);
    if (!rowCount) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/webhooks/:uuid:', err.message);
    res.status(500).json({ error: 'Failed to delete webhook' });
  }
});

// ---------- Webhook Requests ----------

// Get all requests for a webhook (newest first, max 200)
router.get('/webhooks/:uuid/requests', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT wr.*
       FROM webhook_requests wr
       JOIN webhooks w ON w.id = wr.webhook_id
       WHERE w.uuid = $1
       ORDER BY wr.received_at DESC
       LIMIT 200`,
      [req.params.uuid]
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /api/webhooks/:uuid/requests:', err.message);
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

// Get a single request
router.get('/webhooks/:uuid/requests/:id', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT wr.*
       FROM webhook_requests wr
       JOIN webhooks w ON w.id = wr.webhook_id
       WHERE w.uuid = $1 AND wr.id = $2`,
      [req.params.uuid, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('GET /api/webhooks/:uuid/requests/:id:', err.message);
    res.status(500).json({ error: 'Failed to fetch request' });
  }
});

// Delete a single request
router.delete('/webhooks/:uuid/requests/:id', async (req, res) => {
  try {
    const { rowCount } = await db.query(
      `DELETE FROM webhook_requests
       WHERE id = $1
         AND webhook_id = (SELECT id FROM webhooks WHERE uuid = $2)`,
      [req.params.id, req.params.uuid]
    );
    if (!rowCount) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/webhooks/:uuid/requests/:id:', err.message);
    res.status(500).json({ error: 'Failed to delete request' });
  }
});

// Clear all requests for a webhook
router.delete('/webhooks/:uuid/requests', async (req, res) => {
  try {
    await db.query(
      `DELETE FROM webhook_requests
       WHERE webhook_id = (SELECT id FROM webhooks WHERE uuid = $1)`,
      [req.params.uuid]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/webhooks/:uuid/requests:', err.message);
    res.status(500).json({ error: 'Failed to clear requests' });
  }
});

// ---------- SSE Stream ----------

router.get('/webhooks/:uuid/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering if behind proxy
  res.flushHeaders();

  // Initial ping so the client knows connection is live
  res.write('data: {"type":"connected"}\n\n');

  const { uuid } = req.params;
  sse.addClient(uuid, res);

  // Heartbeat every 25s to keep connection alive through proxies
  const hb = setInterval(() => {
    try { res.write(': heartbeat\n\n'); } catch (_) {}
  }, 25000);

  req.on('close', () => {
    clearInterval(hb);
    sse.removeClient(uuid, res);
  });
});

module.exports = router;
