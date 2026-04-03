import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const checks: Record<string, string> = {
    function: "ok",
    DATABASE_URL: process.env.DATABASE_URL ? "set" : "MISSING",
    JWT_SECRET: process.env.JWT_SECRET ? "set" : "MISSING",
  };

  try {
    const { neon } = await import("@neondatabase/serverless");
    const sql = neon(process.env.DATABASE_URL!);
    await sql`SELECT 1`;
    checks.database = "connected";
  } catch (e: any) {
    checks.database = `error: ${e.message}`;
  }

  try {
    const bcrypt = (await import("bcryptjs")).default;
    await bcrypt.hash("test", 4);
    checks.bcryptjs = "ok";
  } catch (e: any) {
    checks.bcryptjs = `error: ${e.message}`;
  }

  try {
    const jwt = (await import("jsonwebtoken")).default;
    jwt.sign({ test: 1 }, "secret");
    checks.jsonwebtoken = "ok";
  } catch (e: any) {
    checks.jsonwebtoken = `error: ${e.message}`;
  }

  try {
    const { getSql } = await import("./_lib/db");
    const sql = getSql();
    await sql`SELECT 1`;
    checks.getSql = "ok";
  } catch (e: any) {
    checks.getSql = `error: ${e.message}`;
  }

  return res.json(checks);
}
