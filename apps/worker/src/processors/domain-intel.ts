// Domain Intelligence Processor
import type { DomainIntelJob, DomainAnalysis } from '../types';
import { processDomainIntel as analyzeDomainIntel } from '../domain/intelligence';
import { recordJobComplete, recordJobFailure } from '../metrics';
import { redis } from '@togi/db';

export async function processDomainIntel(job: DomainIntelJob): Promise<{
  analyses: DomainAnalysis[];
  spikes: string[];
  watchCandidates: string[];
}> {
  const startTime = Date.now();

  try {
    console.log(`[DomainIntel] Processing ${job.links.length} links for event ${job.eventId}`);

    // Use redis client for spike detection
    const redisClient = {
      get: async (key: string) => redis.get(key),
      incr: async (key: string) => {
        const val = await redis.incr(key);
        return val;
      },
      expire: async (key: string, seconds: number) => {
        await redis.expire(key, seconds);
      },
    };

    const result = await analyzeDomainIntel(job, redisClient);

    const duration = Date.now() - startTime;
    recordJobComplete(duration);

    console.log(
      `[DomainIntel] Processed in ${duration}ms, found ${result.spikes.length} spikes, ${result.watchCandidates.length} watch candidates`
    );

    return result;
  } catch (error) {
    recordJobFailure();
    const duration = Date.now() - startTime;
    console.error(`[DomainIntel] Failed:`, error);
    throw error;
  }
}