import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Use connection string from env
const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || '';

// Connection for standard environments (Node.js/Deno)
const client = postgres(connectionString, {
  prepare: false, // Disable prepared statements for Supabase/PgBouncer
});

export const db = drizzle(client, { schema });

// Export the client for direct access if needed
export { client };
