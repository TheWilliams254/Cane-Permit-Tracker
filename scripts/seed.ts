import "dotenv/config";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../src/lib/db/schema";
import { hashPassword } from "../src/lib/auth/password";
import cbcs from "../data/cbcs.json";
import banks from "../data/banks.json";
import harvesters from "../data/harvesters.json";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const pool = new Pool({ connectionString: url, ssl: url.includes("localhost") ? undefined : { rejectUnauthorized: false } });
  const db = drizzle(pool, { schema });

  // Reference data: insert what is missing, never overwrite edits made in the app.
  for (const c of cbcs) {
    await db.insert(schema.cbcs).values(c).onConflictDoNothing({ target: schema.cbcs.name });
  }
  for (const h of harvesters) {
    await db.insert(schema.harvesters).values(h).onConflictDoNothing({ target: schema.harvesters.code });
  }
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(schema.banks);
  if (count === 0) await db.insert(schema.banks).values(banks);

  // First administrator.
  const username = (process.env.SEED_ADMIN_USERNAME || "admin").toLowerCase();
  const existing = await db.query.users.findFirst({ where: eq(schema.users.username, username) });
  if (!existing) {
    const password = process.env.SEED_ADMIN_PASSWORD || "ChangeMe-2026";
    await db.insert(schema.users).values({
      username,
      name: process.env.SEED_ADMIN_NAME || "System Administrator",
      role: "ADMIN",
      passwordHash: await hashPassword(password),
      mustChangePassword: true,
    });
    console.log(`Created administrator "${username}". Sign in with the SEED_ADMIN_PASSWORD and change it immediately.`);
  } else {
    console.log(`Administrator "${username}" already exists — left unchanged.`);
  }

  const [h] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.harvesters);
  const [b] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.banks);
  const [c] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.cbcs);
  console.log(`Reference data: ${c.n} CBCs, ${h.n} harvesters, ${b.n} banks.`);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
