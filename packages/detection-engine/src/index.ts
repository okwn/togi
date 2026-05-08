// Re-export types explicitly to avoid naming conflicts
export type {
  DetectionLabel,
  Severity,
  RecommendedAction,
  DetectionResult,
  DetectionContext,
  PolicyContext,
  DetectorConfig,
  RateLimitEntry,
  DuplicateEntry,
} from './types.js';

export * from './text-normalizer.js';
export * from './risk-score.js';
export * from './decision-engine.js';
export * from './fast-path-engine.js';

import * as detectors from './detectors/index.js';
export { detectors };

import * as staticLists from './static-lists/index.js';
export { staticLists };
