import * as net from 'net';

export interface PortConfig {
  readonly name: string;
  readonly preferred: number;
  readonly min: number;
  readonly max: number;
}

export interface PortResult extends PortConfig {
  readonly selected: number;
  readonly foundFree: boolean;
}

const PORT_CONFIGS: PortConfig[] = [
  { name: 'API_PORT', preferred: 4310, min: 4000, max: 6000 },
  { name: 'WEB_PORT', preferred: 4320, min: 4000, max: 6000 },
  { name: 'POSTGRES_PORT', preferred: 5543, min: 5000, max: 7000 },
  { name: 'REDIS_PORT', preferred: 6388, min: 6000, max: 7000 },
  { name: 'WORKER_METRICS_PORT', preferred: 4390, min: 4000, max: 5000 },
];

async function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => {
      resolve(false);
    });
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, '127.0.0.1');
  });
}

async function findFreePort(config: PortConfig): Promise<PortResult> {
  // First try the preferred port
  if (await isPortFree(config.preferred)) {
    return {
      ...config,
      selected: config.preferred,
      foundFree: true,
    };
  }

  // Search from preferred+1 to max
  for (let port = config.preferred + 1; port <= config.max; port++) {
    if (await isPortFree(port)) {
      return {
        ...config,
        selected: port,
        foundFree: true,
      };
    }
  }

  // Search from min to preferred-1
  for (let port = config.min; port < config.preferred; port++) {
    if (await isPortFree(port)) {
      return {
        ...config,
        selected: port,
        foundFree: true,
      };
    }
  }

  // Fallback: return preferred even if not free (shouldn't happen)
  return {
    ...config,
    selected: config.preferred,
    foundFree: false,
  };
}

export async function findFreePorts(): Promise<Record<string, number>> {
  const results = await Promise.all(PORT_CONFIGS.map(findFreePort));

  const ports: Record<string, number> = {};
  for (const result of results) {
    ports[result.name] = result.selected;
  }

  return ports;
}

async function main() {
  console.log('\n=== TOGI Port Detection ===\n');

  const ports = await findFreePorts();

  console.log('Selected ports:\n');
  for (const [name, port] of Object.entries(ports)) {
    const config = PORT_CONFIGS.find((c) => c.name === name);
    const status = port === config?.preferred ? '(preferred)' : '(fallback)';
    console.log(`  ${name.padEnd(24)} ${port}  ${status}`);
  }

  console.log('\n' + JSON.stringify(ports, null, 2));
}

main().catch(console.error);
