// @wallbit-lab/wallbit-ingest
//
// TODO: Polling de `/transactions` contra la API de Wallbit con dedup por id,
// cursor persistido (filesystem / postgres según adapter) y emisión de eventos
// hacia consumidores downstream (recurrence-engine, merchant-classifier, etc.).
// Pensado como long-running process o cron, configurable por intervalo.

export const WALLBIT_INGEST_PLACEHOLDER = true;
