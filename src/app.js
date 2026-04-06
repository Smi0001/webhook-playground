require('dotenv').config();
const express = require('express');
const path = require('path');

const apiRoutes = require('./routes/api');
const webhookReceiverRoutes = require('./routes/webhookReceiver');

const app = express();
const BASE_PATH = process.env.BASE_PATH || ''; // e.g. '/webhook' or ''

// Serve runtime config so frontend JS knows the base path
const serveConfig = (req, res) => {
  res.type('application/javascript');
  res.send(`window.APP_BASE = ${JSON.stringify(BASE_PATH)};`);
};
app.get('/app-config.js', serveConfig);
if (BASE_PATH) app.get(`${BASE_PATH}/app-config.js`, serveConfig);

// Raw body capture for the webhook receiver endpoints (must come before any json parser)
app.use(`${BASE_PATH}/microservices/webhook`, express.raw({ type: '*/*', limit: '10mb' }));

// JSON + form parser for the REST API only
app.use(`${BASE_PATH}/api`, express.json({ limit: '1mb' }));
app.use(`${BASE_PATH}/api`, express.urlencoded({ extended: true, limit: '1mb' }));

// Static assets
app.use(BASE_PATH || '/', express.static(path.join(__dirname, '../public')));

// Routes
app.use(`${BASE_PATH}/api`, apiRoutes);
app.use(`${BASE_PATH}/microservices/webhook`, webhookReceiverRoutes);

// Root → landing page
app.get(BASE_PATH || '/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Webhook microservice running at http://localhost:${PORT}${BASE_PATH}`);
});

module.exports = app;
