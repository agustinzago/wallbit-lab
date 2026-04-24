// Re-exports públicos del merchant-classifier.

export { MerchantClassifier } from './classifier.js';
export type {
  ClassifierStats,
  MerchantClassifierOptions,
} from './classifier.js';
export type {
  ConfidenceLevel,
  Logger,
  MerchantInfo,
  ServiceCategory,
} from './types.js';
export { MerchantClassifierError } from './errors.js';
export { MERCHANT_DICTIONARY, lookupMerchant } from './dictionary.js';
export type { DictionaryEntry } from './dictionary.js';
