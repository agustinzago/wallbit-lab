// Singleton de conexión a Postgres via Drizzle ORM.
// Se inicializa una sola vez al arrancar la app.

import pg from 'pg';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema.js';

export type DbSchema = typeof schema;
export type Db = NodePgDatabase<DbSchema>;

let _db: Db | undefined;

export function createDb(databaseUrl: string): Db {
  const pool = new pg.Pool({ connectionString: databaseUrl });
  return drizzle(pool, { schema });
}

/** Inicializa el singleton de DB. Llamar una sola vez en el entry point. */
export function initDb(databaseUrl: string): Db {
  if (!_db) {
    _db = createDb(databaseUrl);
  }
  return _db;
}
