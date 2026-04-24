// Factory para crear el FxService con la store de Postgres inyectada.

import { FxService } from '@wallbit-lab/fx-ars';
import { PostgresFxStore } from '../db/fx-store.js';
import type { Db } from '../db/client.js';
import type { Logger } from '../logger.js';

export function createFxService(db: Db, logger?: Logger): FxService {
  const store = new PostgresFxStore(db);
  return new FxService(logger !== undefined ? { store, logger } : { store });
}
