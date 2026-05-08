#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import * as net from 'net';

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';

interface ValidationResult {
  name: string;
  passed: boolean;
  message: string;
  details?: string;
}

const ENV_LOCAL_PATH = path.resolve(process.cwd(), '.env.local');

function log(name: string, passed: boolean, message: string, details?: string) {
  const status = passed ? `${GREEN}PASS${RESET}` : `${RED}FAIL${RESET}`;
  console.log(`  [${status}] ${name}`);
  console.log(`         ${message}`);
  if (details) {
    console.log(`         ${BLUE}${details}${RESET}`);
  }
}

function loadEnvFile(): Record<string, string> {
  if (!fs.existsSync(ENV_LOCAL_PATH)) {
    return {};
  }
  const content = fs.readFileSync(ENV_LOCAL_PATH, 'utf-8');
  const vars: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const match = line.match(/^([A-Z_]+)=(.*)$/);
    if (match) {
      vars[match[1]] = match[2];
    }
  }
  return vars;
}

function checkPort(port: number, service: string): { available: boolean; usedBy?: string } {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1000);
    socket.on('connect', () => {
      socket.destroy();
      // Check what's using the port
      try {
        const output = execSync(`lsof -i :${port} 2>/dev/null || echo ""`, { encoding: 'utf-8' });
        const lines = output.trim().split('\n').filter(Boolean);
        const togiLine = lines.find(l => l.includes('togi'));
        resolve({ available: false, usedBy: togiLine || 'TOGI service' });
      } catch {
        resolve({ available: false, usedBy: 'Unknown' });
      }
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve({ available: true });
    });
    socket.on('error', () => {
      socket.destroy();
      resolve({ available: true });
    });
    socket.connect(port, '127.0.0.1');
  });
}

async function runValidation(): Promise<{ results: ValidationResult[]; allPassed: boolean }> {
  console.log('\n=== TOGI Local Validation ===\n');
  const results: ValidationResult[] = [];

  // 1. Check .env.local exists
  console.log(`${BLUE}1. Environment File Check${RESET}`);
  const envExists = fs.existsSync(ENV_LOCAL_PATH);
  const envValid = envExists;
  results.push({
    name: '.env.local exists',
    passed: envExists,
    message: envExists ? 'Found .env.local' : 'Missing .env.local',
  });

  if (!envExists) {
    console.log(`  ${RED}ERROR: .env.local not found. Run: pnpm setup:local${RESET}`);
    return { results, allPassed: false };
  }

  const env = loadEnvFile();

  // 2. Check required env vars
  console.log(`\n${BLUE}2. Environment Variables${RESET}`);
  const requiredVars = ['TELEGRAM_BOT_TOKEN', 'POSTGRES_HOST', 'POSTGRES_PORT', 'REDIS_HOST', 'REDIS_PORT', 'API_PORT'];
  for (const v of requiredVars) {
    const present = !!env[v];
    results.push({
      name: `ENV: ${v}`,
      passed: present,
      message: present ? `Set to ${env[v]}` : 'Missing',
    });
    if (!present && v !== 'TELEGRAM_BOT_TOKEN') {
      log(v, false, `Missing required environment variable`);
    }
  }

  // 3. Docker check
  console.log(`\n${BLUE}3. Docker Check${RESET}`);
  try {
    execSync('docker info > /dev/null 2>&1', { encoding: 'utf-8' });
    results.push({ name: 'Docker available', passed: true, message: 'Docker is running' });
  } catch {
    results.push({ name: 'Docker available', passed: false, message: 'Docker is not running or not available' });
  }

  // 4. Port availability
  console.log(`\n${BLUE}4. Port Availability${RESET}`);
  const ports = [
    { port: parseInt(env.API_PORT || '4310'), name: 'API' },
    { port: parseInt(env.WEB_PORT || '4320'), name: 'Web' },
    { port: parseInt(env.WORKER_METRICS_PORT || '4390'), name: 'Worker' },
    { port: parseInt(env.POSTGRES_PORT || '5432'), name: 'PostgreSQL' },
    { port: parseInt(env.REDIS_PORT || '6379'), name: 'Redis' },
  ];

  const portResults = await Promise.all(
    ports.map(async ({ port, name }) => {
      const result = await checkPort(port, name);
      return {
        name: `Port ${port} (${name})`,
        available: result.available,
        usedBy: result.usedBy,
      };
    })
  );

  for (const r of portResults) {
    results.push({
      name: r.name,
      passed: r.available,
      message: r.available ? 'Available' : `In use by: ${r.usedBy}`,
      details: r.available ? undefined : 'May cause startup failure',
    });
  }

  // 5. Build check
  console.log(`\n${BLUE}5. Build Check${RESET}`);
  try {
    execSync('pnpm build 2>&1', { encoding: 'utf-8', stdio: 'pipe' });
    results.push({ name: 'Build succeeds', passed: true, message: 'All packages compiled' });
  } catch (e) {
    const output = (e as Error).message || '';
    results.push({ name: 'Build succeeds', passed: false, message: 'Build failed', details: output.slice(-200) });
  }

  // 6. Typecheck
  console.log(`\n${BLUE}6. Typecheck${RESET}`);
  try {
    execSync('pnpm typecheck 2>&1', { encoding: 'utf-8', stdio: 'pipe' });
    results.push({ name: 'Typecheck passes', passed: true, message: 'No type errors' });
  } catch {
    results.push({ name: 'Typecheck passes', passed: false, message: 'Type errors found' });
  }

  // 7. Lint
  console.log(`\n${BLUE}7. Lint${RESET}`);
  try {
    execSync('pnpm lint 2>&1', { encoding: 'utf-8', stdio: 'pipe' });
    results.push({ name: 'Lint passes', passed: true, message: 'No lint errors' });
  } catch {
    results.push({ name: 'Lint passes', passed: false, message: 'Lint errors found' });
  }

  // Summary
  console.log(`\n${BLUE}=== Validation Summary ===${RESET}\n`);
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`  Total: ${results.length} | ${GREEN}Passed: ${passed}${RESET} | ${RED}Failed: ${failed}${RESET}\n`);

  if (failed > 0) {
    console.log(`${RED}Failed checks:${RESET}`);
    for (const r of results.filter((r) => !r.passed)) {
      console.log(`  - ${r.name}: ${r.message}`);
    }
    console.log('');
  }

  return { results, allPassed: failed === 0 };
}

runValidation()
  .then(({ allPassed }) => {
    if (!allPassed) {
      console.log(`${YELLOW}Validation completed with failures. Review the output above.${RESET}\n`);
      process.exit(1);
    }
    console.log(`${GREEN}Validation passed!${RESET}\n`);
    process.exit(0);
  })
  .catch((err) => {
    console.error(`${RED}Validation error:${RESET}`, err);
    process.exit(1);
  });
