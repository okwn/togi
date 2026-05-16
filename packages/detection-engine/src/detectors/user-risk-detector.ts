export interface UserRiskContext {
  telegramUserId: bigint;
  groupId: string;
  globalRiskScore: number;
  groupTrustScore: number;
  totalViolations: number;
  severeViolations: number;
  isNewUser: boolean;
  hasUsername: boolean;
  firstMessageHasLink: boolean;
  isGroupAdmin: boolean;
  isProbation: boolean;
}

export interface UserRiskResult {
  modifier: number; // Added to final risk score (-30 to +50 range)
  labels: string[];
  riskFactors: string[];
  trustFactors: string[];
}

const RISK_WEIGHTS = {
  newUserBase: 10,
  noUsername: 10,
  firstMessageLink: 5,
  probation: 5,
  violationBase: 5,
  severeViolationMultiplier: 3,
  highGlobalRisk: 15,
  trustedMember: -10,
  highTrustScore: -15,
  noRecentViolations: -5,
};

export function calculateUserRiskModifier(context: UserRiskContext): UserRiskResult {
  let modifier = 0;
  const riskFactors: string[] = [];
  const trustFactors: string[] = [];
  const labels: string[] = [];

  if (context.isNewUser) {
    modifier += RISK_WEIGHTS.newUserBase;
    riskFactors.push('new_user');
    labels.push('new_user');
  }

  if (!context.hasUsername) {
    modifier += RISK_WEIGHTS.noUsername;
    riskFactors.push('no_username');
    labels.push('no_username');
  }

  if (context.firstMessageHasLink) {
    modifier += RISK_WEIGHTS.firstMessageLink;
    riskFactors.push('first_message_link');
    labels.push('first_message_link');
  }

  if (context.isProbation) {
    modifier += RISK_WEIGHTS.probation;
    riskFactors.push('on_probation');
    labels.push('on_probation');
  }

  if (context.isGroupAdmin) {
    modifier += RISK_WEIGHTS.trustedMember;
    trustFactors.push('group_admin');
    labels.push('group_admin');
  }

  if (context.totalViolations > 0) {
    modifier += Math.min(context.totalViolations * RISK_WEIGHTS.violationBase, 30);
    riskFactors.push(`${context.totalViolations}_violations`);
  }

  if (context.severeViolations > 0) {
    modifier += context.severeViolations * RISK_WEIGHTS.severeViolationMultiplier * RISK_WEIGHTS.violationBase;
    riskFactors.push(`${context.severeViolations}_severe`);
  }

  if (context.globalRiskScore >= 70) {
    modifier += RISK_WEIGHTS.highGlobalRisk;
    riskFactors.push('high_global_risk');
    labels.push('high_global_risk');
  } else if (context.globalRiskScore >= 50) {
    modifier += Math.floor(RISK_WEIGHTS.highGlobalRisk / 2);
    riskFactors.push('elevated_global_risk');
    labels.push('elevated_global_risk');
  }

  if (context.groupTrustScore >= 80 && riskFactors.length === 0) {
    modifier += RISK_WEIGHTS.highTrustScore;
    trustFactors.push('high_trust_score');
    labels.push('high_trust_score');
  } else if (context.groupTrustScore >= 50 && riskFactors.length === 0) {
    modifier += RISK_WEIGHTS.trustedMember;
    trustFactors.push('medium_trust_score');
    labels.push('medium_trust_score');
  }

  if (context.totalViolations === 0 && !context.isNewUser && riskFactors.length === 0 && trustFactors.length === 0 && context.globalRiskScore === 0) {
    modifier += RISK_WEIGHTS.noRecentViolations;
    trustFactors.push('clean_record');
    labels.push('clean_record');
  }

  return {
    modifier: Math.max(-30, Math.min(50, modifier)),
    labels,
    riskFactors,
    trustFactors,
  };
}