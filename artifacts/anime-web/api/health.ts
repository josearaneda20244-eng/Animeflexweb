import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const checks: Record<string, string> = {
    function: "ok",
    DATABASE_URL: process.env.DATABASE_URL ? "set" : "MISSING",
    JWT_SECRET: process.env.JWT_SECRET ? "set" : "MISSING",
  };

  if (process.env.DATABASE_URL) {
    try {
      const { neon } = await import("@neondatabase/serverless");
      const sql = neon(process.env.DATABASE_URL);
      await sql`SELECT 1`;
      checks.database = "connected";

      const tables = await sql`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY table_name
      `;
      checks.tables = tables.map((t: any) => t.table_name).join(", ") || "none";
    } catch (err: any) {
      checks.database = `error: ${err.message}`;
    }
  }

  return res.json(checks);
}
