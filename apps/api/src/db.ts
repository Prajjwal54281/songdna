import { Pool } from "pg";
import { env } from "./env.js";

export const pool = new Pool({ connectionString: env.databaseUrl });

pool.on("error", (err) => {
  // Idle client errors (e.g. connection dropped) should not crash the process.
  console.error("Unexpected Postgres pool error", err);
});
