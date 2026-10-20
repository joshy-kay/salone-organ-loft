import { neon } from "@neondatabase/serverless";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import SEED from "./seed-scores.js";

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.NEON_DATABASE_URL;
export const sql = url ? neon(url) : null;

let ready = null;
export function ensure() {
  if (!sql) { const e = new Error("The database isn't connected yet."); e.status = 503; e.code = "no_db"; throw e; }
  if (!ready) ready = setup().catch(err => { ready = null; throw err; });
  return ready;
}

async function setup() {
  await sql`create table if not exists scores (
    id text primary key, title text not null, kind text not null default 'Hymn',
    first_line text default '', tune text default '', composer text default '',
    meter text default '', meter_key text default '', key text default '',
    hymnal text default '', link text not null, rights text default '',
    source text default '', notes text default '', reported boolean default false,
    created_at bigint not null, edit_hash text)`;
  await sql`create table if not exists organists (
    id text primary key, name text not null, phone text not null, whatsapp boolean default false,
    email text default '', churches jsonb default '[]', town text default '', denom text default '',
    plays jsonb default '[]', note text default '', available jsonb default '[]',
    updated_at bigint not null, edit_hash text)`;
  await sql`alter table scores add column if not exists pages jsonb default '[]'`;
  const [{ n }] = await sql`select count(*)::int as n from scores`;
  if (n === 0) {
    await sql(`insert into scores (id,title,kind,first_line,tune,composer,meter,meter_key,key,hymnal,link,rights,source,notes,created_at)
      select id,title,kind,first_line,tune,composer,meter,meter_key,key,hymnal,link,rights,source,notes,created_at
      from jsonb_to_recordset($1::jsonb) as x(id text,title text,kind text,first_line text,tune text,composer text,meter text,
        meter_key text,key text,hymnal text,link text,rights text,source text,notes text,created_at bigint)
      on conflict (id) do nothing`, [JSON.stringify(SEED)]);
  }
}

export const newId = p => p + "-" + randomBytes(6).toString("hex");
export const newKey = () => randomBytes(18).toString("base64url");
export const hash = k => createHash("sha256").update(String(k)).digest("hex");

function safeEq(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}
export function isAdmin(req) {
  const pin = process.env.ADMIN_PIN;
  const got = req.headers["x-admin-pin"];
  return !!(pin && got && safeEq(pin, got));
}
export function keyMatches(req, editHash) {
  const k = req.headers["x-edit-key"];
  return !!(k && editHash && safeEq(hash(k), editHash));
}

export async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") { try { return JSON.parse(req.body); } catch { return {}; } }
  return {};
}

export const clip = (v, n) => String(v ?? "").trim().slice(0, n);

export function send(res, status, data) {
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.status(status).send(JSON.stringify(data));
}
export function fail(res, err) {
  const status = err.status || 500;
  if (status === 500) console.error(err);
  send(res, status, { error: status === 500 ? "Something went wrong on the server." : err.message, code: err.code || null });
}
export function bad(msg) { const e = new Error(msg); e.status = 400; return e; }

export const BLOB_HOST = /^https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\//i;
