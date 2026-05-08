// Threat patterns - direct threats and harassment keywords

export const THREAT_PATTERNS = [
  // Direct threats
  /\b(kill|murder|die|death)\b/gi,
  /\b(beat (you|up)|hurt (you|him|her))/gi,
  /\b(rape|sexually|assault)/gi,
  /\b(bomb|explosive|attack)/gi,
  /\b(weapon|gun|knife|stab|shoot)/gi,
  /\b(poison|drugs?| overdose)/gi,

  // Severe harassment
  /\b(slur|racist|bigot)/gi,
  /\b(nazi|fasci|supremac)/gi,

  // Doxxing patterns
  /\b(dox|doxx|leak|expose)\b.*\b(address|phone|email|location)/gi,
  /\bfind (you|him|her)|know where.*\byou live|address|live/gi,
  /\b(post (your|his|her)|share)\b.*\b(info|address|phone|real name)/gi,

  // Suicide/self-harm
  /\b(kill yourself|end it all|suicide)/gi,
  /\b(self.?harm|cutting myself)/gi,
];

// Check if text contains threat patterns
export function containsThreatPattern(text: string): boolean {
  if (!text) return false;

  const normalized = normalizeTextForThreat(text);

  for (const pattern of THREAT_PATTERNS) {
    if (pattern.test(normalized)) {
      return true;
    }
  }

  return false;
}

// Normalize text for matching
function normalizeTextForThreat(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

// Moderately harassment keywords (less severe)
export const HARASSMENT_KEYWORDS = [
  'idiot', 'stupid', 'dumb', 'ugly', 'fat', 'loser',
  'worthless', 'pathetic', 'disgusting', 'hate you',
];

export function containsHarassment(text: string): boolean {
  if (!text) return false;

  const normalized = normalizeTextForThreat(text);

  for (const keyword of HARASSMENT_KEYWORDS) {
    if (normalized.includes(keyword)) {
      return true;
    }
  }

  return false;
}
