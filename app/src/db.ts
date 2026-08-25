import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not defined");
}

export const pool = new Pool({
  connectionString: databaseUrl,
});

export async function testDatabaseConnection(): Promise<void> {
  const result = await pool.query("SELECT NOW() AS current_time");

  console.log("Database connected");
  console.log("Database time:", result.rows[0].current_time);
}
