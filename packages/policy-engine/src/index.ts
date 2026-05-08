import {
  PolicyMode,
  PolicyConfig,
  SecurityScore,
  BotPermissions,
  ActionType,
  ViolationSeverity,
} from './types.js';
import { getDefaultPolicy, policyDefaults } from './policy-defaults.js';
import {
  validatePolicyConfig,
  mergePolicy,
  getEffectivePolicy,
  calculateSecurityScore,
  isValidMode,
} from './engine.js';

export {
  getDefaultPolicy,
  policyDefaults,
  validatePolicyConfig,
  mergePolicy,
  getEffectivePolicy,
  calculateSecurityScore,
  isValidMode,
};

export const policyEngine = {
  getDefaultPolicy,
  validatePolicyConfig,
  mergePolicy,
  getEffectivePolicy,
  calculateSecurityScore,
  isValidMode,
};

export type PolicyEngine = typeof policyEngine;

export type {
  PolicyMode,
  PolicyConfig,
  SecurityScore,
  BotPermissions,
  ActionType,
  ViolationSeverity,
};
