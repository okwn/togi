// tools/load-test/src/run-webhook-load.ts
import Fastify, { FastifyInstance } from 'fastify';
import { UpdateGenerator } from './generate-updates.js';
import { globalMetrics } from './metrics.js';

interface WebhookPayload {
  chatId: string;
  userId: string;
  username: string;
  text?: string;
  links: string[];
  mediaType?: string;
  messageId?: number;
  mentions: string[];
  isNewUser: boolean;
  userMemberSince: number;
  timestamp: number;
}

export async function runWebhookBenchmark(iterations: number): Promise<void> {
  console.log(`\n=== Webhook Load Benchmark (${iterations} iterations) ===`);

  const app: FastifyInstance = await Fastify({ logger: false });

  // Health endpoints
  app.get('/health', async () => ({ status: 'ok', timestamp: Date.now() }));
  app.get('/ready', async () => ({ status: 'ready' }));

  // Minimal webhook simulation endpoint
  app.post('/api/webhook', async (request, reply) => {
    const payload = request.body as WebhookPayload;

    const start = performance.now();

    // Simulate minimal webhook processing
    const isBlockedDomain = payload.links.some(link =>
      ['malware-site.com', 'phishing-123.xyz', 'spam-link.tk'].some(d => link.includes(d))
    );

    const isShortener = payload.links.some(link =>
      ['bit.ly', 'tinyurl.com', 'goo.gl', 't.co', 'ow.ly'].some(d => link.includes(d))
    );

    const hasScamPhrase = payload.text && (
      payload.text.includes('password') ||
      payload.text.includes('click this link to win') ||
      payload.text.includes('account has been compromised') ||
      payload.text.includes('verify your identity') ||
      payload.text.includes('update your payment')
    );

    const mentionCount = payload.mentions?.length || 0;
    const isMentionSpam = mentionCount > 5;

    // Simulated detection result
    let riskScore = 0;
    let action = 'ALLOW';

    if (isBlockedDomain) {
      riskScore += 90;
      action = 'BLOCK';
    } else if (hasScamPhrase) {
      riskScore += 70;
      action = 'WARN';
    } else if (isShortener) {
      riskScore += 45;
    } else if (isMentionSpam) {
      riskScore += 60;
      action = 'WARN';
    }

    const duration = performance.now() - start;
    globalMetrics.record('webhook.latency', duration);
    globalMetrics.record('webhook.processing', duration);
    globalMetrics.record('webhook.risk-score', riskScore);

    return {
      status: 'processed',
      action,
      riskScore,
      processingMs: duration.toFixed(2),
    };
  });

  await app.ready();

  const generator = new UpdateGenerator();

  // Warmup
  console.log('Warming up...');
  for (let i = 0; i < 10; i++) {
    const update = generator.generateUpdate('clean', i);
    await app.inject({
      method: 'POST',
      url: '/api/webhook',
      payload: update,
      headers: { 'content-type': 'application/json' },
    });
  }

  // Benchmark
  console.log('Running benchmark...');
  const timings: number[] = [];
  let errors = 0;

  for (let i = 0; i < iterations; i++) {
    const scenario = i % 3 === 0 ? 'clean' : i % 3 === 1 ? 'shortener' : 'scam-phrase';
    const update = generator.generateUpdate(scenario, i);

    const start = performance.now();
    const response = await app.inject({
      method: 'POST',
      url: '/api/webhook',
      payload: update,
      headers: { 'content-type': 'application/json' },
    });
    const duration = performance.now() - start;

    timings.push(duration);
    if (response.statusCode >= 400) {
      errors++;
    }
  }

  // Calculate percentiles
  const sorted = [...timings].sort((a, b) => a - b);
  const p50 = sorted[Math.floor(sorted.length * 0.5)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const p99 = sorted[Math.floor(sorted.length * 0.99)];

  console.log('\n=== Webhook Results ===');
  console.log(`Total requests: ${iterations}`);
  console.log(`Errors: ${errors} (${((errors / iterations) * 100).toFixed(1)}%)`);
  console.log(`p50: ${p50.toFixed(2)}ms`);
  console.log(`p95: ${p95.toFixed(2)}ms`);
  console.log(`p99: ${p99.toFixed(2)}ms`);
  console.log(`Min: ${sorted[0].toFixed(2)}ms`);
  console.log(`Max: ${sorted[sorted.length - 1].toFixed(2)}ms`);

  globalMetrics.record('webhook.p50', p50);
  globalMetrics.record('webhook.p95', p95);
  globalMetrics.record('webhook.p99', p99);

  await app.close();
}