// Async Analysis Processor
import type { AsyncAnalysisJob } from '../types';
import { enrichClassification } from '../ai';
import { analyzeLinks, checkDomainSpike } from '../domain/intelligence';
import { recordJobComplete, recordJobFailure } from '../metrics';

export async function processAsyncAnalysis(job: AsyncAnalysisJob): Promise<{
  finalRisk: number;
  finalLabels: string[];
  enriched: boolean;
  domainSpikes: string[];
}> {
  const startTime = Date.now();

  try {
    // AI enrichment (if text is available)
    let finalRisk = job.initialRisk;
    let finalLabels = [...job.labels];
    let enriched = false;
    const domainSpikes: string[] = [];

    if (job.text && job.links.length > 0) {
      // Enrich with AI
      const aiResult = await enrichClassification(
        job.initialRisk,
        job.labels,
        job.text,
        job.links
      );

      finalRisk = aiResult.finalRisk;
      finalLabels = aiResult.finalLabels;
      enriched = true;

      // Check for domain spikes
      for (const link of job.links) {
        const domain = extractDomainFromLink(link);
        // Use mock redis client for now - in real impl would be injected
        // This is just for type compatibility
      }
    }

    // Check for domain spikes even without AI
    if (job.links.length > 0) {
      const analyses = analyzeLinks(job.links);
      for (const analysis of analyses) {
        if (analysis.threatLevel === 'HIGH') {
          domainSpikes.push(analysis.domain);
        }
      }
    }

    const duration = Date.now() - startTime;
    recordJobComplete(duration);

    console.log(`[AsyncAnalysis] Processed event ${job.eventId} in ${duration}ms, risk: ${finalRisk}`);

    return { finalRisk, finalLabels, enriched, domainSpikes };
  } catch (error) {
    recordJobFailure();
    console.error(`[AsyncAnalysis] Failed to process event ${job.eventId}:`, error);
    throw error;
  }
}

function extractDomainFromLink(link: string): string {
  try {
    const url = new URL(link);
    return url.hostname;
  } catch {
    return link;
  }
}