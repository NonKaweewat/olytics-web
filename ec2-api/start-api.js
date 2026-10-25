'use strict';
const path = require('node:path');
const { spawn } = require('node:child_process');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });
if (!process.env.REDSHIFT_SECRET_ID) { console.error('REDSHIFT_SECRET_ID is required'); process.exit(1); }
const child = spawn('python3', [path.join(__dirname, 'asm-exec'), '--', process.execPath, path.join(__dirname, 'api-server.js')], {
  stdio: 'inherit', env: {
    ...process.env, AWS_REGION: process.env.REDSHIFT_REGION || 'us-east-1',
    OLIST_DB_SECRET: '{{resolve:secretsmanager:' + process.env.REDSHIFT_SECRET_ID + ':SecretString}}',
  },
});
child.on('error', () => { console.error('Unable to start secret resolver'); process.exit(1); });
child.on('exit', code => process.exit(code ?? 1));
// systemd KillMode=control-group delivers signals to the resolver and API too.
