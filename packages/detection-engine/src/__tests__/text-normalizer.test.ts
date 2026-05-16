import { describe, it, expect } from '@jest/globals';
import {
  normalizeText,
  extractWords,
  calculateTextSimilarity,
  hashText,
} from '../text-normalizer';

describe('text-normalizer', () => {
  describe('normalizeText', () => {
    it('normalizes Turkish characters', () => {
      const result = normalizeText('ı İ ğ Ü ş Ö ç');
      expect(result.normalized).toBe('i i g u s o c');
    });

    it('normalizes leetspeak', () => {
      const result = normalizeText('h4ck3r 5p34k');
      expect(result.normalized).toBe('hacker speak');
    });

    it('removes zero-width characters', () => {
      const result = normalizeText('hello​world');
      expect(result.normalized).toBe('helloworld');
    });

    it('collapses repeated letters', () => {
      const result = normalizeText('heeeellloooo');
      expect(result.normalized).toBe('hello');
    });

    it('detects heavy obfuscation with combining accents', () => {
      // Text with combining accent characters (Zalgo text)
      const zalgoText = 'h́̂̃̄llo'; // h with multiple combining accents
      const result = normalizeText(zalgoText);
      expect(result.obfuscationType).toBe('combining-accents');
      expect(result.isObfuscated).toBe(true);
    });

    it('returns proper structure for empty input', () => {
      const result = normalizeText('');
      expect(result).toEqual({
        original: '',
        normalized: '',
        isObfuscated: false,
        obfuscationType: null,
      });
    });
  });

  describe('extractWords', () => {
    it('extracts words from punctuation-separated text', () => {
      const result = extractWords('Hello, world! How are you?');
      expect(result).toEqual(['hello', 'world', 'how', 'are', 'you']);
    });

    it('returns array of lowercase words', () => {
      const result = extractWords('HELLO WORLD');
      expect(result).toEqual(['hello', 'world']);
    });

    it('returns empty array for empty input', () => {
      const result = extractWords('');
      expect(result).toEqual([]);
    });

    it('filters out single-character words', () => {
      const result = extractWords('I am a robot');
      expect(result).toEqual(['am', 'robot']);
    });
  });

  describe('calculateTextSimilarity', () => {
    it('returns 1.0 for identical texts', () => {
      const result = calculateTextSimilarity('hello world', 'hello world');
      expect(result).toBe(1.0);
    });

    it('returns 0 for completely different texts', () => {
      const result = calculateTextSimilarity('hello', 'world');
      expect(result).toBe(0);
    });

    it('returns value between 0 and 1 for similar texts', () => {
      const result = calculateTextSimilarity('hello world', 'hello');
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(1);
    });

    it('handles empty strings', () => {
      const result = calculateTextSimilarity('', '');
      expect(result).toBe(0);
    });

    it('returns 0 when one string is empty', () => {
      const result = calculateTextSimilarity('hello', '');
      expect(result).toBe(0);
    });
  });

  describe('hashText', () => {
    it('returns consistent hash for same input', () => {
      const hash1 = hashText('hello world');
      const hash2 = hashText('hello world');
      expect(hash1).toBe(hash2);
    });

    it('returns different hash for different input', () => {
      const hash1 = hashText('hello');
      const hash2 = hashText('world');
      expect(hash1).not.toBe(hash2);
    });

    it('returns empty string for empty input', () => {
      const result = hashText('');
      expect(result).toBe('');
    });

    it('normalizes text before hashing', () => {
      // Same text in different forms should produce same hash
      const hash1 = hashText('HELLO');
      const hash2 = hashText('hello');
      expect(hash1).toBe(hash2);
    });
  });
});