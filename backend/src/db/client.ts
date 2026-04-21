import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from './schema.js';

export type DatabaseClient = ReturnType<typeof createDatabaseClient>;
export type Database = ReturnType<typeof createDatabaseClient>['db'];

export function createDatabaseClient(databaseUrl: string) {
  const sql = postgres(databaseUrl, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  const db = drizzle(sql, { schema });

  return {
    db,
    sql,
    async ping(): Promise<boolean> {
      const result = await sql`select 1 as ok`;
      return result.length === 1 && result[0]?.ok === 1;
    },
    async close(): Promise<void> {
      await sql.end();
    },
  };
}
