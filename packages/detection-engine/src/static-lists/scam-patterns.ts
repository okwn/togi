// Scam patterns - common phrases and keywords used in scams
// These are case-insensitive and support basic obfuscation

export const SCAM_PATTERNS = [
  // Crypto scams
  /\b(airdrop|airdrops)\b/gi,
  /\b(free|giveaway|give away|gift)\b.*\b(crypto|bitcoin|eth|token|coins?|nft)/gi,
  /\b(wallet|metamask|trust wallet|exodus)\b.*\b(connect|verify|seed|private)/gi,
  /\b(private key|seed phrase|recovery phrase)\b/gi,
  /\b(claim|claim now|claim free)\b.*\b(btc|eth|token|nft)/gi,
  /\b(double your|instant|guaranteed)\b.*\b(crypto|bitcoin|invest)/gi,
  /\b(nft minting|whitelist|whitelist spot)/gi,
  /\b(opensea|rariable|looksrare)\b.*\b(free|mint|airdrop)/gi,
  /\b(pump\.fun|raydium|dextools)\b.*\b(guaranteed|insider|signal)/gi,

  // Fake updates
  /\b(your account|account has been|will be deleted)\b.*\b(suspended|limited|deactivated)/gi,
  /\b(verify your|please verify|confirm your)\b.*\b(account|identity|wallet)/gi,
  /\b(unusual activity|suspicious activity|security alert)/gi,

  // Impersonation
  /\b(support team|official team|admin team)\b/gi,
  /\b(pm me|dm me|contact me)\b.*\b(outside|here|privately)/gi,
  /\b(I am (an? )?(admin|mod|official|staff|developer))/gi,

  // General scams
  /\b(you won|congratulations|winner|winning)\b/gi,
  /\b(click (here|now|below|this link))/gi,
  /\b(limited time|expired?|expires?\s+(in|at|today))/gi,
  /\b(act now|don't miss|hurry|instantly)/gi,
  /\b(send (me|\$|USD?T?|ETH?|BTC)|wire|transfer)\b/gi,
];

// Check if text contains scam patterns
export function containsScamPattern(text: string): boolean {
  if (!text) return false;

  const normalized = normalizeText(text);

  for (const pattern of SCAM_PATTERNS) {
    if (pattern.test(normalized)) {
      return true;
    }
  }

  return false;
}

// Extract scam-related keywords found
export function extractScamKeywords(text: string): string[] {
  if (!text) return [];

  const normalized = normalizeText(text);
  const found: string[] = [];

  const keywords = [
    'airdrop', 'free', 'giveaway', 'gift', 'crypto', 'bitcoin',
    'wallet', 'metamask', 'seed', 'private key', 'claim',
    'double', 'guaranteed', 'nft minting', 'whitelist',
    'your account', 'suspended', 'verify', 'unusual activity',
    'support team', 'admin', 'official', 'pm me', 'dm me',
    'you won', 'congratulations', 'winner', 'click here',
    'limited time', 'act now', 'send me'
  ];

  for (const keyword of keywords) {
    if (normalized.includes(keyword)) {
      found.push(keyword);
    }
  }

  return found;
}

// Normalize text for pattern matching
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // Remove accents
    .replace(/1/g, 'i')              // Leetspeak
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5/g, 's')
    .replace(/7/g, 't')
    .replace(/0/g, 'o')
    .replace(/@/g, 'a')
    .replace(/\$/g, 's');
}
