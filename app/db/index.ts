import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

const sql = neon(process.env.DATABASE_URL!);

/** Singleton Drizzle client. Import this for all database access. */
export const db = drizzle({ client: sql, schema });
