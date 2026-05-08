// AI Classifier - Optional AI-based message classification
import type { AIClassificationResult, AILabel, AISeverity, AIRecommendedAction } from '../types';

const AI_PROVIDER = process.env.AI_PROVIDER || 'none';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const AI_TIMEOUT_MS = 1200;

// In-memory timeout counter (for metrics)
let aiTimeoutCount = 0;

export function getAiTimeoutCount(): number {
  return aiTimeoutCount;
}

// Local heuristic classifier fallback
function localClassification(
  text: string,
  links: string[]
): AIClassificationResult {
  const lowerText = text.toLowerCase();
  const flags: string[] = [];

  // Check for scam patterns
  const scamPatterns = [
    /airdrop|free crypto|double your (?:bitcoin|eth|token)/i,
    /send (?:0\.\d+ )?(?:btc|eth|usdt) to/i,
    /giveaway|win (?:bitcoin|eth|crypto)/i,
  ];

  const hasScam = scamPatterns.some((p) => p.test(text));
  if (hasScam) {
    flags.push('scam_pattern');
  }

  // Check for threat patterns
  const threatPatterns = [
    /kill|death threat|will (?:hurt|kill|destroy)/i,
    /(?:i[' ]?m (?:going to|about to)|i will)/,
  ];

  const hasThreat = threatPatterns.some((p) => p.test(text));
  if (hasThreat) {
    flags.push('threat_pattern');
  }

  // Check for spam patterns
  const spamPatterns = [
    /click here|buy now|limited time|act now/i,
    /(?:free|discount|save) (?:money|cash|bitcoin)/i,
  ];

  const hasSpam = spamPatterns.some((p) => p.test(text));
  if (hasSpam) {
    flags.push('spam_pattern');
  }

  // Check for suspicious links
  const suspiciousTLDs = ['.xyz', '.top', '.buzz', '.cyou', '.sbs', '.tk'];
  const hasSuspiciousLink = links.some((link) =>
    suspiciousTLDs.some((tld) => link.toLowerCase().includes(tld))
  );
  if (hasSuspiciousLink) {
    flags.push('suspicious_tld');
  }

  // Check for impersonation
  const impersonationPatterns = [
    /(?:official|real|verified) (?:admin|mod|support)/i,
    /(?:don'?t|do not) trust (?:anyone|other)/i,
  ];

  const hasImpersonation = impersonationPatterns.some((p) => p.test(text));
  if (hasImpersonation) {
    flags.push('impersonation');
  }

  // Determine label and severity
  let label: AILabel = 'NORMAL';
  let severity: AISeverity = 'LOW';
  let recommendedAction: AIRecommendedAction = 'NO_ACTION';
  let explanation = 'Message appears to be normal content.';

  if (hasScam) {
    label = 'SCAM';
    severity = 'CRITICAL';
    recommendedAction = 'DELETE_BAN';
    explanation = 'Scam pattern detected: ' + flags.join(', ');
  } else if (hasThreat) {
    label = 'THREAT';
    severity = 'HIGH';
    recommendedAction = 'DELETE_MUTE';
    explanation = 'Potential threat detected: ' + flags.join(', ');
  } else if (hasImpersonation) {
    label = 'IMPERSONATION';
    severity = 'HIGH';
    recommendedAction = 'DELETE_MUTE';
    explanation = 'Possible impersonation detected: ' + flags.join(', ');
  } else if (hasSpam) {
    label = 'SPAM';
    severity = 'MEDIUM';
    recommendedAction = 'DELETE';
    explanation = 'Spam pattern detected: ' + flags.join(', ');
  } else if (hasSuspiciousLink) {
    label = 'PHISHING';
    severity = 'MEDIUM';
    recommendedAction = 'REVIEW';
    explanation = 'Suspicious link TLD detected: ' + flags.join(', ');
  }

  return {
    label,
    confidence: label === 'NORMAL' ? 0.95 : 0.75,
    severity,
    recommendedAction,
    explanation,
  };
}

// OpenAI classification
async function openAiClassification(
  text: string,
  links: string[]
): Promise<AIClassificationResult> {
  const { OpenAI } = await import('openai');

  const client = new OpenAI({
    apiKey: OPENAI_API_KEY,
    timeout: AI_TIMEOUT_MS,
  });

  const linkContext = links.length > 0 ? `Links in message: ${links.join(', ')}` : '';

  const response = await client.chat.completions.create({
    model: OPENAI_MODEL,
    messages: [
      {
        role: 'system',
        content: `You are a Telegram group content classifier. Classify the message and respond with JSON.

Labels: NORMAL, SPAM, SCAM, PHISHING, THREAT, HARASSMENT, HATE, DOXXING, NSFW, IMPERSONATION

Response format:
{
  "label": "LABEL",
  "confidence": 0.0-1.0,
  "severity": "LOW|MEDIUM|HIGH|CRITICAL",
  "recommendedAction": "NO_ACTION|REVIEW|DELETE|DELETE_MUTE|DELETE_BAN",
  "explanation": "brief explanation"
}`,
      },
      {
        role: 'user',
        content: `Classify this Telegram message:\n\n${text}\n\n${linkContext}`,
      },
    ],
    temperature: 0.1,
    max_tokens: 200,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from OpenAI');
  }

  const result = JSON.parse(content) as AIClassificationResult;
  return result;
}

// Main classification function
export async function classifyMessage(
  text: string,
  links: string[] = []
): Promise<AIClassificationResult> {
  // If AI is disabled or no API key, use local fallback
  if (AI_PROVIDER === 'none' || !OPENAI_API_KEY) {
    console.log('[AI] Provider disabled or no API key - using local fallback');
    return localClassification(text, links);
  }

  // Use OpenAI if configured
  if (AI_PROVIDER === 'openai') {
    try {
      const result = await Promise.race([
        openAiClassification(text, links),
        new Promise<AIClassificationResult>((_, reject) =>
          setTimeout(() => reject(new Error('AI_TIMEOUT')), AI_TIMEOUT_MS)
        ),
      ]);

      return result;
    } catch (error) {
      if ((error as Error).message === 'AI_TIMEOUT') {
        aiTimeoutCount++;
        console.warn('[AI] OpenAI timeout - falling back to local classification');
        return localClassification(text, links);
      }

      console.error('[AI] OpenAI error:', error);
      return localClassification(text, links);
    }
  }

  // Unknown provider, use local
  return localClassification(text, links);
}

// Combined classification (fast path + AI)
export async function enrichClassification(
  initialRisk: number,
  initialLabels: string[],
  text: string,
  links: string[]
): Promise<{ finalRisk: number; finalLabels: string[]; aiResult?: AIClassificationResult }> {
  // Skip AI if text is empty and initial risk is low
  if (!text && initialRisk < 40) {
    return { finalRisk: initialRisk, finalLabels: initialLabels };
  }

  // Run AI classification
  const aiResult = await classifyMessage(text, links);

  // Combine initial risk with AI confidence
  let finalRisk = initialRisk;
  if (aiResult.confidence > 0.7) {
    // Adjust risk based on AI severity
    const severityMultiplier: Record<AISeverity, number> = {
      LOW: 0.9,
      MEDIUM: 1.2,
      HIGH: 1.5,
      CRITICAL: 2.0,
    };

    finalRisk = Math.min(
      100,
      Math.round(initialRisk * severityMultiplier[aiResult.severity])
    );
  }

  const finalLabels = [...initialLabels];
  if (aiResult.label !== 'NORMAL') {
    finalLabels.push(`AI_${aiResult.label}`);
  }

  return { finalRisk, finalLabels, aiResult };
}