// Text normalizer for Turkish and English patterns
// Handles obfuscation, normalization, and text processing

// Turkish-specific character mappings
const TURKISH_MAP: Record<string, string> = {
  'ı': 'i',
  'İ': 'I',
  'ğ': 'g',
  'Ğ': 'G',
  'ü': 'u',
  'Ü': 'U',
  'ş': 's',
  'Ş': 'S',
  'ö': 'o',
  'Ö': 'O',
  'ç': 'c',
  'Ç': 'C',
};

// Leetspeak substitutions
const LEET_MAP: Record<string, string> = {
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '0': 'o',
  '@': 'a',
  '$': 's',
  '!': 'i',
  '|': 'l',
  ']': 't',
  '[': 't',
};

// Common obfuscation patterns - simplified to avoid regex issues
const ZALGO_CHARS = /[̀-ͯ҉]/g;
const REGIONAL_INDICATORS = /[\u{1F1E6}-\u{1F1FF}]/gu;
const ZERO_WIDTH_CHARS = /[​-‏﻿]/g;

export interface NormalizedText {
  original: string;
  normalized: string;
  isObfuscated: boolean;
  obfuscationType: string | null;
}

export function normalizeText(text: string): NormalizedText {
  if (!text) {
    return { original: '', normalized: '', isObfuscated: false, obfuscationType: null };
  }

  let normalized = text;

  // 1. Remove zero-width and combining characters
  normalized = normalized.replace(ZERO_WIDTH_CHARS, '');
  normalized = normalized.replace(ZALGO_CHARS, '');
  normalized = normalized.replace(REGIONAL_INDICATORS, '');

  // 2. Normalize Unicode (NFD -> NFC)
  normalized = normalized.normalize('NFC');

  // 3. Convert Turkish characters
  for (const [turkish, ascii] of Object.entries(TURKISH_MAP)) {
    normalized = normalized.replace(new RegExp(turkish, 'g'), ascii);
  }

  // 4. Convert leetspeak
  for (const [leet, ascii] of Object.entries(LEET_MAP)) {
    normalized = normalized.replace(new RegExp(leet, 'g'), ascii);
  }

  // 5. Lowercase
  normalized = normalized.toLowerCase();

  // 6. Remove repeated letters (e.g., "hellooo" -> "hello")
  normalized = normalized.replace(/(.)\1{2,}/g, '$1$1');

  // 7. Handle spaces between letters (e.g., "h e l l o" -> "hello")
  normalized = normalized.replace(/\b\w(?:\s+\w){1,}\b/g, (match) => {
    return match.replace(/\s+/g, '');
  });

  // 8. Handle mixed symbols (e.g., "h3||o" -> "hello")
  normalized = normalizeMixedSymbols(normalized);

  // 9. Remove URLs for pattern matching (but keep for checking)
  // normalized = normalized.replace(/https?:\/\/[^\s]+/gi, '');

  const isObfuscated = detectObfuscation(text, normalized);
  const obfuscationType = isObfuscated ? classifyObfuscation(text, normalized) : null;

  return {
    original: text,
    normalized,
    isObfuscated,
    obfuscationType,
  };
}

function normalizeMixedSymbols(text: string): string {
  // Handle common symbol substitutions
  return text
    .replace(/\|{2,}/g, 'l')
    .replace(/!{2,}/g, 'i')
    .replace(/[{[][}\]]/g, 't')
    .replace(/\${2,}/g, 's')
    .replace(/0{2,}/g, 'o')
    .replace(/5{2,}/g, 's')
    .replace(/3{2,}/g, 'e')
    .replace(/4{2,}/g, 'a');
}

function detectObfuscation(original: string, normalized: string): boolean {
  if (!original || !normalized) return false;

  // Significant length reduction suggests heavy obfuscation
  const lengthRatio = normalized.length / original.length;
  if (lengthRatio < 0.5) return true;

  // Contains unusual Unicode
  if (/[​-‏﻿]/.test(original)) return true;

  // Leetspeak detection: many numbers in short text
  const numberDensity = (original.match(/[0-9]/g) || []).length / original.length;
  if (numberDensity > 0.3) return true;

  // Spaces between single characters
  const spacesBetweenLetters = /\b\w(?:\s\w){2,}\b/.test(original);
  if (spacesBetweenLetters) return true;

  return false;
}

function classifyObfuscation(original: string, normalized: string): string | null {
  if (/[​-‏﻿]/.test(original)) return 'zero-width';
  if (/\b\w(?:\s\w){2,}\b/.test(original)) return 'spaced-letters';
  if (/[1!|{@$]/.test(original)) return 'leet-speak';
  if (/[̀-ͯ]/.test(original)) return 'combining-accents';
  if (normalized.length / original.length < 0.5) return 'heavy-obfuscation';
  return 'unknown';
}

export function extractWords(text: string): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 1);
}

export function calculateTextSimilarity(text1: string, text2: string): number {
  if (!text1 || !text2) return 0;

  const words1 = new Set(extractWords(text1));
  const words2 = new Set(extractWords(text2));

  const intersection = new Set([...words1].filter((x) => words2.has(x)));
  const union = new Set([...words1, ...words2]);

  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

export function hashText(text: string): string {
  if (!text) return '';

  let hash = 0;
  const normalized = normalizeText(text).normalized;

  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }

  return Math.abs(hash).toString(16);
}
