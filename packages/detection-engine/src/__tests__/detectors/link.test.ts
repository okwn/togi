import { describe, it, expect } from '@jest/globals';
import { analyzeLinks, LinkConfig } from '../../detectors/link-detector';

describe('analyzeLinks', () => {
  const defaultConfig: LinkConfig = {
    enabled: true,
    shortenerScore: 45,
    blockedDomainScore: 90,
    suspiciousTLDScore: 30,
    newUserLinkScore: 50,
    telegramInviteScore: 20,
    discordInviteScore: 35,
    scamPatternScore: 70,
  };

  describe('returns clean result for no links', () => {
    it('returns NONE level for empty links array', () => {
      const result = analyzeLinks([], 'user123', false, [], [], defaultConfig);

      expect(result.score).toBe(0);
      expect(result.level).toBe('NONE');
      expect(result.links).toHaveLength(0);
    });

    it('returns NONE when config is disabled', () => {
      const disabledConfig: LinkConfig = { ...defaultConfig, enabled: false };
      const result = analyzeLinks(['https://example.com'], 'user123', false, [], [], disabledConfig);

      expect(result.score).toBe(0);
      expect(result.level).toBe('NONE');
    });
  });

  describe('detects shortener links (score: 45)', () => {
    it('detects bit.ly shortener', () => {
      const result = analyzeLinks(['https://bit.ly/test123'], 'user123', false, [], [], defaultConfig);

      expect(result.score).toBe(45);
      expect(result.level).toBe('MEDIUM');
      expect(result.links[0].isShortener).toBe(true);
    });

    it('detects tinyurl.com shortener', () => {
      const result = analyzeLinks(['https://tinyurl.com/abc123'], 'user123', false, [], [], defaultConfig);

      expect(result.score).toBe(45);
      expect(result.links[0].isShortener).toBe(true);
    });

    it('detects goo.gl shortener', () => {
      const result = analyzeLinks(['https://goo.gl/xyz'], 'user123', false, [], [], defaultConfig);

      expect(result.score).toBe(45);
      expect(result.links[0].isShortener).toBe(true);
    });

    it('detects t.co shortener', () => {
      const result = analyzeLinks(['https://t.co/abc'], 'user123', false, [], [], defaultConfig);

      expect(result.score).toBe(45);
      expect(result.links[0].isShortener).toBe(true);
    });

    it('detects ow.ly shortener', () => {
      const result = analyzeLinks(['https://ow.ly/def'], 'user123', false, [], [], defaultConfig);

      expect(result.score).toBe(45);
      expect(result.links[0].isShortener).toBe(true);
    });

    it('accumulates score for multiple shortener links', () => {
      const result = analyzeLinks(
        ['https://bit.ly/abc', 'https://tinyurl.com/def'],
        'user123',
        false,
        [],
        [],
        defaultConfig
      );

      expect(result.score).toBe(90);
      expect(result.level).toBe('CRITICAL');
      expect(result.links).toHaveLength(2);
      expect(result.links[0].isShortener).toBe(true);
      expect(result.links[1].isShortener).toBe(true);
    });
  });

  describe('detects blocked domains (score: 90)', () => {
    it('detects blocked domain', () => {
      const result = analyzeLinks(
        ['https://malicious.com/link'],
        'user123',
        false,
        [],
        ['malicious.com'],
        defaultConfig
      );

      expect(result.score).toBe(90);
      expect(result.level).toBe('CRITICAL');
      expect(result.links[0].isBlocked).toBe(true);
    });

    it('detects blocked domain with subdomain', () => {
      const result = analyzeLinks(
        ['https://evil.malicious.com/page'],
        'user123',
        false,
        [],
        ['malicious.com'],
        defaultConfig
      );

      expect(result.score).toBe(90);
      expect(result.links[0].isBlocked).toBe(true);
    });

    it('returns NONE level for allowed domains even if blocked domain match exists', () => {
      const result = analyzeLinks(
        ['https://example.com'],
        'user123',
        false,
        ['example.com'],
        ['example.com'], // Would be blocked but allowlist takes precedence
        defaultConfig
      );

      // Allowlist takes precedence, so no score
      expect(result.score).toBe(0);
      expect(result.level).toBe('NONE');
    });
  });

  describe('detects suspicious TLDs (score: 30)', () => {
    it('detects .xyz TLD', () => {
      const result = analyzeLinks(['https://site.xyz/page'], 'user123', false, [], [], defaultConfig);

      expect(result.score).toBe(30);
      expect(result.level).toBe('LOW');
      expect(result.links[0].isSuspiciousTLD).toBe(true);
    });

    it('detects .top TLD', () => {
      const result = analyzeLinks(['https://site.top/page'], 'user123', false, [], [], defaultConfig);

      expect(result.score).toBe(30);
      expect(result.links[0].isSuspiciousTLD).toBe(true);
    });

    it('detects .buzz TLD', () => {
      const result = analyzeLinks(['https://site.buzz/page'], 'user123', false, [], [], defaultConfig);

      expect(result.score).toBe(30);
      expect(result.links[0].isSuspiciousTLD).toBe(true);
    });

    it('detects .cyou TLD', () => {
      const result = analyzeLinks(['https://site.cyou/page'], 'user123', false, [], [], defaultConfig);

      expect(result.score).toBe(30);
      expect(result.links[0].isSuspiciousTLD).toBe(true);
    });

    it('accumulates score for multiple suspicious TLDs', () => {
      const result = analyzeLinks(
        ['https://a.xyz', 'https://b.top'],
        'user123',
        false,
        [],
        [],
        defaultConfig
      );

      expect(result.score).toBe(60);
      expect(result.level).toBe('MEDIUM');
    });
  });

  describe('detects Telegram invite links (score: 20)', () => {
    it('detects t.me invite link', () => {
      const result = analyzeLinks(['https://t.me/joinchat/abc'], 'user123', false, [], [], defaultConfig);

      expect(result.score).toBe(20);
      expect(result.level).toBe('LOW');
      expect(result.links[0].isTelegramInvite).toBe(true);
    });

    it('detects telegram.me link', () => {
      const result = analyzeLinks(['https://telegram.me/group123'], 'user123', false, [], [], defaultConfig);

      expect(result.score).toBe(20);
      expect(result.links[0].isTelegramInvite).toBe(true);
    });
  });

  describe('detects Discord invite links (score: 35)', () => {
    it('detects discord.gg invite link', () => {
      const result = analyzeLinks(['https://discord.gg/abc123'], 'user123', false, [], [], defaultConfig);

      expect(result.score).toBe(35);
      expect(result.level).toBe('LOW');
      expect(result.links[0].isDiscordInvite).toBe(true);
    });

    it('detects discord.com invite link', () => {
      const result = analyzeLinks(['https://discord.com/invite/xyz'], 'user123', false, [], [], defaultConfig);

      expect(result.score).toBe(35);
      expect(result.links[0].isDiscordInvite).toBe(true);
    });
  });

  describe('new users with links get higher score (score: 50+)', () => {
    it('adds newUserLinkScore for new user sending any link', () => {
      const result = analyzeLinks(
        ['https://example.com'],
        'user123',
        true, // isNewUser: true
        [],
        [],
        defaultConfig
      );

      // 0 (clean link) + 50 (newUserLinkScore)
      expect(result.score).toBe(50);
      expect(result.isNewUserLink).toBe(true);
    });

    it('combines new user score with shortener score', () => {
      const result = analyzeLinks(
        ['https://bit.ly/abc'],
        'user123',
        true, // isNewUser: true
        [],
        [],
        defaultConfig
      );

      // 45 (shortener) + 50 (newUserLinkScore) = 95
      expect(result.score).toBe(95);
      expect(result.level).toBe('CRITICAL');
      expect(result.isNewUserLink).toBe(true);
    });

    it('new user with multiple links gets only one newUserLinkScore', () => {
      const result = analyzeLinks(
        ['https://bit.ly/abc', 'https://tinyurl.com/def'],
        'user123',
        true,
        [],
        [],
        defaultConfig
      );

      // (45 + 45) shorteners + 50 newUser = 140
      expect(result.score).toBe(140);
      expect(result.isNewUserLink).toBe(true);
    });

    it('old user does not get newUserLinkScore', () => {
      const result = analyzeLinks(
        ['https://bit.ly/abc'],
        'user123',
        false, // isNewUser: false
        [],
        [],
        defaultConfig
      );

      // Just the shortener score
      expect(result.score).toBe(45);
      expect(result.isNewUserLink).toBe(false);
    });
  });

  describe('allows whitelisted domains', () => {
    it('returns 0 score for whitelisted domain', () => {
      const result = analyzeLinks(
        ['https://github.com/user/repo'],
        'user123',
        false,
        ['github.com'], // allowedDomains
        [],
        defaultConfig
      );

      expect(result.score).toBe(0);
      expect(result.level).toBe('NONE');
    });

    it('allows partial domain match in whitelist', () => {
      const result = analyzeLinks(
        ['https://user.github.com/repo'],
        'user123',
        false,
        ['github.com'],
        [],
        defaultConfig
      );

      expect(result.score).toBe(0);
    });

    it('whitelist takes precedence over blocklist', () => {
      const result = analyzeLinks(
        ['https://example.com'],
        'user123',
        false,
        ['example.com'], // allowed
        ['example.com'], // blocked
        defaultConfig
      );

      // Allowlist wins
      expect(result.score).toBe(0);
      expect(result.level).toBe('NONE');
    });

    it('whitelist does not affect other detecting factors', () => {
      // A shortener that is also whitelisted by domain
      const result = analyzeLinks(
        ['https://bit.ly/abc'],
        'user123',
        false,
        ['bit.ly'],
        [],
        defaultConfig
      );

      // bit.ly is in the whitelist, so shortener check is skipped
      expect(result.score).toBe(0);
      expect(result.level).toBe('NONE');
    });
  });

  describe('returns no links result for clean links', () => {
    it('returns NONE level for safe domain links', () => {
      const result = analyzeLinks(
        ['https://google.com/search', 'https://github.com/togi/repo'],
        'user123',
        false,
        [],
        [],
        defaultConfig
      );

      expect(result.score).toBe(0);
      expect(result.level).toBe('NONE');
      expect(result.links.length).toBeGreaterThan(0); // Links are recorded
      expect(result.links[0].isShortener).toBe(false);
      expect(result.links[0].isBlocked).toBe(false);
      expect(result.links[0].isSuspiciousTLD).toBe(false);
    });

    it('safe link with normal TLD gets no score', () => {
      const result = analyzeLinks(
        ['https://example.com', 'https://stackoverflow.com/questions'],
        'user123',
        false,
        [],
        [],
        defaultConfig
      );

      expect(result.score).toBe(0);
      expect(result.level).toBe('NONE');
    });
  });

  describe('level determination', () => {
    it('returns LOW for score 1-44', () => {
      const result = analyzeLinks(
        ['https://t.me/joinchat/test'], // 20 (telegram)
        'user123',
        false,
        [],
        [],
        defaultConfig
      );

      expect(result.level).toBe('LOW');
    });

    it('returns MEDIUM for score 45-69', () => {
      const result = analyzeLinks(
        ['https://bit.ly/abc'], // 45
        'user123',
        false,
        [],
        [],
        defaultConfig
      );

      expect(result.level).toBe('MEDIUM');
    });

    it('returns HIGH for score 70-89', () => {
      const result = analyzeLinks(
        ['https://bit.ly/abc', 'https://site.xyz'], // 45 + 30 = 75
        'user123',
        false,
        [],
        [],
        defaultConfig
      );

      expect(result.level).toBe('HIGH');
    });

    it('returns CRITICAL for score 90+', () => {
      const result = analyzeLinks(
        ['https://malicious.com'], // 90 (blocked)
        'user123',
        false,
        [],
        ['malicious.com'],
        defaultConfig
      );

      expect(result.level).toBe('CRITICAL');
    });
  });

  describe('combines multiple detecting factors', () => {
    it('shortener with suspicious TLD combines scores', () => {
      // Use a URL where the hostname itself ends with a suspicious TLD
      // e.g. https://test.site.xyz - hostname is "test.site.xyz" which ends with .xyz
      const result = analyzeLinks(
        ['https://test.site.xyz/path'], // .xyz = 30
        'user123',
        false,
        [],
        [],
        defaultConfig
      );

      expect(result.score).toBe(30);
      expect(result.level).toBe('LOW');
      expect(result.links[0].isSuspiciousTLD).toBe(true);
    });

    it('new user with telegram and discord links gets combined score', () => {
      const result = analyzeLinks(
        ['https://t.me/abc', 'https://discord.gg/xyz'],
        'user123',
        true,
        [],
        [],
        defaultConfig
      );

      // 20 (telegram) + 35 (discord) + 50 (newUser) = 105
      expect(result.score).toBe(105);
      expect(result.level).toBe('CRITICAL');
      expect(result.isNewUserLink).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('handles invalid URL gracefully', () => {
      const result = analyzeLinks(
        ['not-a-valid-url'],
        'user123',
        false,
        [],
        [],
        defaultConfig
      );

      expect(result.score).toBe(0);
      expect(result.level).toBe('NONE');
      expect(result.links[0].domain).toBe('');
    });

    it('handles mixed valid and invalid URLs', () => {
      const result = analyzeLinks(
        ['https://bit.ly/abc', 'invalid-url', 'https://discord.gg/xyz'],
        'user123',
        false,
        [],
        [],
        defaultConfig
      );

      // 45 (shortener) + 35 (discord) = 80
      expect(result.score).toBe(80);
      expect(result.level).toBe('HIGH');
      expect(result.links).toHaveLength(3);
    });

    it('handles empty userId', () => {
      const result = analyzeLinks(
        ['https://bit.ly/abc'],
        '',
        false,
        [],
        [],
        defaultConfig
      );

      expect(result.score).toBe(45);
      expect(result.level).toBe('MEDIUM');
    });

    it('is case insensitive for domain checks', () => {
      const result = analyzeLinks(
        ['https://BIT.LY/ABC'],
        'user123',
        false,
        [],
        [],
        defaultConfig
      );

      expect(result.score).toBe(45);
      expect(result.links[0].isShortener).toBe(true);
    });

    it('is case insensitive for blocked domain matching', () => {
      const result = analyzeLinks(
        ['https://MALICIOUS.COM'],
        'user123',
        false,
        [],
        ['malicious.com'],
        defaultConfig
      );

      expect(result.score).toBe(90);
      expect(result.links[0].isBlocked).toBe(true);
    });
  });

  describe('custom config scores', () => {
    it('respects custom shortenerScore', () => {
      const customConfig: LinkConfig = { ...defaultConfig, shortenerScore: 60 };
      const result = analyzeLinks(['https://bit.ly/abc'], 'user123', false, [], [], customConfig);

      expect(result.score).toBe(60);
    });

    it('respects custom blockedDomainScore', () => {
      const customConfig: LinkConfig = { ...defaultConfig, blockedDomainScore: 100 };
      const result = analyzeLinks(
        ['https://evil.com'],
        'user123',
        false,
        [],
        ['evil.com'],
        customConfig
      );

      expect(result.score).toBe(100);
      expect(result.level).toBe('CRITICAL');
    });

    it('respects custom telegramInviteScore', () => {
      const customConfig: LinkConfig = { ...defaultConfig, telegramInviteScore: 10 };
      const result = analyzeLinks(['https://t.me/abc'], 'user123', false, [], [], customConfig);

      expect(result.score).toBe(10);
    });

    it('respects custom discordInviteScore', () => {
      const customConfig: LinkConfig = { ...defaultConfig, discordInviteScore: 15 };
      const result = analyzeLinks(['https://discord.gg/abc'], 'user123', false, [], [], customConfig);

      expect(result.score).toBe(15);
    });

    it('respects custom newUserLinkScore', () => {
      const customConfig: LinkConfig = { ...defaultConfig, newUserLinkScore: 25 };
      const result = analyzeLinks(['https://example.com'], 'user123', true, [], [], customConfig);

      expect(result.score).toBe(25);
      expect(result.isNewUserLink).toBe(true);
    });
  });

  });