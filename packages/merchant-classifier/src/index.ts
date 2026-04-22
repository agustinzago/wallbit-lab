// @wallbit-lab/merchant-classifier
//
// TODO: Clasificación de descriptores de merchants (texto crudo tipo
// "UBER *TRIP 4Z9K") en categorías normalizadas (transporte, delivery,
// streaming, etc.) usando Claude Haiku. Cache en memoria LRU + adapter
// opcional de Redis para compartir entre procesos. Input idempotente:
// misma descripción → misma clasificación.

export const MERCHANT_CLASSIFIER_PLACEHOLDER = true;
