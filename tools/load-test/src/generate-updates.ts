// tools/load-test/src/generate-updates.ts
import type { DetectionContext } from '@togi/detection-engine';

// Scenario types matching Phase 05 requirements
export type ScenarioType =
  | 'clean'
  | 'flood'
  | 'duplicate'
  | 'shortener'
  | 'blocked-domain'
  | 'new-user-probation-link'
  | 'mention-spam'
  | 'scam-phrase'
  | 'raid-join'
  | 'raid-message'
  | 'mixed';

export interface ScenarioConfig {
  type: ScenarioType;
  count: number;
  userId?: string;
  chatId?: string;
}

const SCAM_PHRASES = [
  'send me your password',
  'click this link to win prize',
  'your account has been compromised',
  'verify your identity now',
  'urgent: update your payment info',
];

const BLOCKED_DOMAINS = ['malware-site.com', 'phishing-123.xyz', 'spam-link.tk'];
const SHORTENER_DOMAINS = ['bit.ly', 'tinyurl.com', 'goo.gl', 't.co', 'ow.ly'];

export class UpdateGenerator {
  private chatId = '-1001234567890';
  private userIdCounter = 1000;
  private messageIdCounter = 1;

  generateScenarios(): ScenarioConfig[] {
    return [
      { type: 'clean', count: 100 },
      { type: 'flood', count: 50 },
      { type: 'duplicate', count: 50 },
      { type: 'shortener', count: 30 },
      { type: 'blocked-domain', count: 30 },
      { type: 'new-user-probation-link', count: 30 },
      { type: 'mention-spam', count: 30 },
      { type: 'scam-phrase', count: 30 },
      { type: 'raid-join', count: 100 },
      { type: 'raid-message', count: 100 },
      { type: 'mixed', count: 200 },
    ];
  }

  generateUpdate(scenario: ScenarioType, index: number): DetectionContext {
    const userId = `user_${(index % 50) + 1}`;
    const username = `user${(index % 50) + 1}`;
    const isNewUser = index % 10 === 0;

    switch (scenario) {
      case 'clean':
        return this.cleanText(userId, username);
      case 'flood':
        return this.floodMessage(userId, username, index);
      case 'duplicate':
        return this.duplicateSpam(userId, username, index);
      case 'shortener':
        return this.shortenerLink(userId, username);
      case 'blocked-domain':
        return this.blockedDomainLink(userId, username);
      case 'new-user-probation-link':
        return this.newUserProbationLink(userId, username, isNewUser);
      case 'mention-spam':
        return this.mentionSpam(userId, username, index);
      case 'scam-phrase':
        return this.scamPhrase(userId, username, index);
      case 'raid-join':
        return this.raidJoin(index);
      case 'raid-message':
        return this.raidMessage(index);
      case 'mixed':
        return this.mixedTraffic(index);
      default:
        return this.cleanText(userId, username);
    }
  }

  private cleanText(userId: string, username: string): DetectionContext {
    return {
      chatId: this.chatId,
      userId,
      username,
      text: 'Hello everyone, how are you today?',
      links: [],
      mediaType: undefined,
      messageId: this.messageIdCounter++,
      mentions: [],
      isNewUser: false,
      userMemberSince: Date.now() - 86400000 * 30,
      timestamp: Date.now(),
    };
  }

  private floodMessage(userId: string, username: string, index: number): DetectionContext {
    return {
      chatId: this.chatId,
      userId,
      username,
      text: `Message number ${index % 20}`,
      links: [],
      mediaType: undefined,
      messageId: this.messageIdCounter++,
      mentions: [],
      isNewUser: false,
      userMemberSince: Date.now() - 86400000,
      timestamp: Date.now(),
    };
  }

  private duplicateSpam(userId: string, username: string, index: number): DetectionContext {
    return {
      chatId: this.chatId,
      userId,
      username,
      text: 'Buy cheap followers click here bit.ly/spam',
      links: index % 3 === 0 ? ['https://bit.ly/spam'] : [],
      mediaType: undefined,
      messageId: this.messageIdCounter++,
      mentions: [],
      isNewUser: false,
      userMemberSince: Date.now() - 86400000,
      timestamp: Date.now(),
    };
  }

  private shortenerLink(userId: string, username: string): DetectionContext {
    const domains = SHORTENER_DOMAINS;
    return {
      chatId: this.chatId,
      userId,
      username,
      text: `Check this out https://${domains[Math.floor(Math.random() * domains.length)]}/ promo`,
      links: [`https://${domains[Math.floor(Math.random() * domains.length)]}/promo`],
      mediaType: undefined,
      messageId: this.messageIdCounter++,
      mentions: [],
      isNewUser: false,
      userMemberSince: Date.now() - 86400000,
      timestamp: Date.now(),
    };
  }

  private blockedDomainLink(userId: string, username: string): DetectionContext {
    const domains = BLOCKED_DOMAINS;
    return {
      chatId: this.chatId,
      userId,
      username,
      text: `Visit ${domains[Math.floor(Math.random() * domains.length)]} for more`,
      links: [`https://${domains[Math.floor(Math.random() * domains.length)]}`],
      mediaType: undefined,
      messageId: this.messageIdCounter++,
      mentions: [],
      isNewUser: false,
      userMemberSince: Date.now() - 86400000,
      timestamp: Date.now(),
    };
  }

  private newUserProbationLink(userId: string, username: string, isNewUser: boolean): DetectionContext {
    return {
      chatId: this.chatId,
      userId,
      username,
      text: 'New member here, check my website example.com',
      links: ['https://example.com'],
      mediaType: undefined,
      messageId: this.messageIdCounter++,
      mentions: [],
      isNewUser,
      userMemberSince: isNewUser ? Date.now() - 60000 : Date.now() - 86400000 * 30,
      timestamp: Date.now(),
    };
  }

  private mentionSpam(userId: string, username: string, index: number): DetectionContext {
    const mentionCount = (index % 10) + 5;
    const mentions = Array.from({ length: mentionCount }, (_, i) => `user${i + 1}`);
    return {
      chatId: this.chatId,
      userId,
      username,
      text: `Hey ${mentions.join(' @')} check this out!`,
      links: [],
      mediaType: undefined,
      messageId: this.messageIdCounter++,
      mentions,
      isNewUser: false,
      userMemberSince: Date.now() - 86400000,
      timestamp: Date.now(),
    };
  }

  private scamPhrase(userId: string, username: string, index: number): DetectionContext {
    return {
      chatId: this.chatId,
      userId,
      username,
      text: SCAM_PHRASES[index % SCAM_PHRASES.length],
      links: [],
      mediaType: undefined,
      messageId: this.messageIdCounter++,
      mentions: [],
      isNewUser: false,
      userMemberSince: Date.now() - 86400000,
      timestamp: Date.now(),
    };
  }

  private raidJoin(index: number): DetectionContext {
    return {
      chatId: this.chatId,
      userId: `raid_user_${index}`,
      username: `raiduser${index}`,
      text: undefined,
      links: [],
      mediaType: undefined,
      messageId: undefined,
      mentions: [],
      isNewUser: true,
      userMemberSince: Date.now(),
      timestamp: Date.now(),
    };
  }

  private raidMessage(index: number): DetectionContext {
    return {
      chatId: this.chatId,
      userId: `raid_user_${index % 20}`,
      username: `raiduser${index % 20}`,
      text: `Raid message ${index % 15}`,
      links: [],
      mediaType: undefined,
      messageId: this.messageIdCounter++,
      mentions: [],
      isNewUser: true,
      userMemberSince: Date.now() - 300000,
      timestamp: Date.now(),
    };
  }

  private mixedTraffic(index: number): DetectionContext {
    const scenarios: ScenarioType[] = ['clean', 'flood', 'duplicate', 'shortener', 'scam-phrase'];
    return this.generateUpdate(scenarios[index % scenarios.length], index);
  }

  getScenarioName(scenario: ScenarioType): string {
    const names: Record<ScenarioType, string> = {
      clean: 'Clean Text Messages',
      flood: 'Flood Messages',
      duplicate: 'Duplicate Spam',
      shortener: 'Shortener Links',
      'blocked-domain': 'Blocklisted Domain Links',
      'new-user-probation-link': 'New User Probation Link',
      'mention-spam': 'Mention Spam',
      'scam-phrase': 'Scam Phrase',
      'raid-join': 'Raid Simulation (Joins)',
      'raid-message': 'Raid Simulation (Messages)',
      mixed: 'Mixed Realistic Traffic',
    };
    return names[scenario];
  }
}