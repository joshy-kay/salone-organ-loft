import { ensure, sql, send } from "./_lib/db.js";
export default async function handler(req, res) {
  try { await ensure(); const [s] = await sql`select count(*)::int as n from scores`; const [o] = await sql`select count(*)::int as n from organists`;
    send(res, 200, { database: "connected", scores: s.n, organists: o.n }); }
  catch (e) { send(res, e.status || 500, { database: e.status === 503 ? "not connected" : "error" }); }
}
