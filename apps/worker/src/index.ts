// TOGI Worker - Async processing pipeline
// This worker handles heavy analysis without blocking Telegram webhook responses

import http from 'http';
import { createWorkers, closeWorkers, logQueueHealth } from './workers/setup';
import { getWorkerMetrics } from './metrics/collector';
import { getQueues, QUEUE_NAMES, closeQueues } from './queues';

const WORKER_METRICS_PORT = parseInt(process.env.WORKER_METRICS_PORT || '9090');

// Graceful shutdown handler
async function gracefulShutdown(signal: string): Promise<void> {
  console.log(`\n[Worker] Received ${signal}, shutting down gracefully...`);

  try {
    // Stop accepting new jobs
    console.log('[Worker] Closing workers...');
    await closeWorkers();

    // Close queues
    console.log('[Worker] Closing queues...');
    await closeQueues();

    console.log('[Worker] Shutdown complete');
    process.exit(0);
  } catch (error) {
    console.error('[Worker] Error during shutdown:', error);
    process.exit(1);
  }
}

// Create metrics HTTP server
function createMetricsServer(): http.Server {
  const server = http.createServer(async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    if (req.method === 'GET' && req.url === '/metrics') {
      try {
        const metrics = await getWorkerMetrics();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(metrics, null, 2));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to get metrics' }));
      }
      return;
    }

    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'healthy', timestamp: new Date().toISOString() }));
      return;
    }

    if (req.method === 'GET' && req.url === '/queues') {
      try {
        const queues = getQueues();
        const queueStatus: Record<string, unknown> = {};

        for (const [name, queue] of Object.entries(queues)) {
          const counts = await queue.getJobCounts();
          queueStatus[name] = counts;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(queueStatus, null, 2));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to get queue status' }));
      }
      return;
    }

    // 404
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  return server;
}

// Main entry point
async function main(): Promise<void> {
  console.log('[Worker] Starting TOGI Worker...');
  console.log(`[Worker] Metrics server on port ${WORKER_METRICS_PORT}`);

  // Validate environment
  const required = ['REDIS_HOST', 'REDIS_PORT'];
  for (const key of required) {
    if (!process.env[key]) {
      console.warn(`[Worker] Warning: ${key} not set, using default`);
    }
  }

  // Initialize queues
  console.log('[Worker] Initializing queues...');
  getQueues();

  // Create workers
  console.log('[Worker] Creating workers...');
  createWorkers();

  // Start metrics server
  const metricsServer = createMetricsServer();
  metricsServer.listen(WORKER_METRICS_PORT, () => {
    console.log(`[Worker] Metrics endpoint: http://localhost:${WORKER_METRICS_PORT}/metrics`);
    console.log(`[Worker] Health endpoint: http://localhost:${WORKER_METRICS_PORT}/health`);
    console.log(`[Worker] Queue status: http://localhost:${WORKER_METRICS_PORT}/queues`);
  });

  // Log queue health periodically
  const healthInterval = setInterval(() => {
    logQueueHealth();
  }, 60000); // Every minute

  // Register shutdown handlers
  process.on('SIGTERM', () => {
    clearInterval(healthInterval);
    gracefulShutdown('SIGTERM');
  });

  process.on('SIGINT', () => {
    clearInterval(healthInterval);
    gracefulShutdown('SIGINT');
  });

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    console.error('[Worker] Uncaught exception:', error);
    gracefulShutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason) => {
    console.error('[Worker] Unhandled rejection:', reason);
    gracefulShutdown('unhandledRejection');
  });

  console.log('[Worker] TOGI Worker started successfully');
  console.log('[Worker] Queues:');
  for (const name of Object.values(QUEUE_NAMES)) {
    console.log(`  - ${name}`);
  }
}

main().catch((error) => {
  console.error('[Worker] Fatal error:', error);
  process.exit(1);
});