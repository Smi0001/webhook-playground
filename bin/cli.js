#!/usr/bin/env node
'use strict';

const cmd = process.argv[2];

if (cmd === 'migrate') {
  require('dotenv').config();
  require('../migrations/migrate');
} else if (!cmd || cmd === 'start') {
  require('dotenv').config();
  require('../src/app');
} else {
  console.error(`Unknown command: ${cmd}`);
  console.error('');
  console.error('Usage:');
  console.error('  webhook-ms              Start the server');
  console.error('  webhook-ms start        Start the server');
  console.error('  webhook-ms migrate      Run database migrations');
  process.exit(1);
}
