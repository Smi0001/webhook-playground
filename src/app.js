require('dotenv').config();
const express = require('express');
const path = require('path');

const apiRoutes = require('./routes/api');
const webhookReceiverRoutes = require('./routes/webhookReceiver');

const app = express();

// Raw body capture for the webhook receiver endpoints (must come before any json parser)
app.use('/microservices/webhook', express.raw({ type: '*/*', limit: '10mb' }));

// JSON + form parser for the REST API only
app.use('/api', express.json({ limit: '1mb' }));
app.use('/api', express.urlencoded({ extended: true, limit: '1mb' }));

// Static assets
app.use(express.static(path.join(__dirname, '../public')));

// Routes
app.use('/api', apiRoutes);
app.use('/microservices/webhook', webhookReceiverRoutes);

// Root → landing page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Webhook microservice running at http://localhost:${PORT}`);
});

module.exports = app;
