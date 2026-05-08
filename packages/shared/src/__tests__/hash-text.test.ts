import { hashText } from '../security/hash-text';

describe('hash-text', () => {
  describe('hashText', () => {
    it('should produce consistent hashes', () => {
      const text = 'Hello, World!';
      const hash1 = hashText(text);
      const hash2 = hashText(text);
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different texts', () => {
      const hash1 = hashText('Hello');
      const hash2 = hashText('World');
      expect(hash1).not.toBe(hash2);
    });

    it('should produce 64 character hex hash (SHA-256)', () => {
      const hash = hashText('test');
      expect(hash).toHaveLength(64);
    });

    it('should handle empty string', () => {
      const hash = hashText('');
      expect(hash).toHaveLength(64);
    });
  });
});
