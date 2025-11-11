#!/usr/bin/env node
const { spawn } = require('node:child_process');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/';
const env = { ...process.env, BASE_URL };

const child = spawn('pnpm', ['-s', 'dlx', '@lhci/cli', 'autorun', '--config=./lhci.config.js'], {
  stdio: 'inherit',
  env
});

child.on('exit', code => process.exit(code));
