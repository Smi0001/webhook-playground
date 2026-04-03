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
  console.error('  webhook-play              Start the server');
  console.error('  webhook-play start        Start the server');
  console.error('  webhook-play migrate      Run database migrations');
  process.exit(1);
}
