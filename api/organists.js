import { sql, ensure, newId, newKey, hash, isAdmin, keyMatches, readBody, clip, send, fail, bad } from "./_lib/db.js";

const PLAYS = ["Pipe organ", "Electronic organ", "Piano", "Keyboard"];
const out = r => ({ id: r.id, name: r.name, phone: r.phone, whatsapp: r.whatsapp, email: r.email, churches: r.churches || [],
  town: r.town, denom: r.denom, plays: r.plays || [], note: r.note, available: r.available || [], updatedAt: Number(r.updated_at) });

function clean(b) {
  const name = clip(b.name, 120), phone = clip(b.phone, 40);
  const churches = (Array.isArray(b.churches) ? b.churches : []).map(c => clip(c, 120)).filter(Boolean).slice(0, 6);
  if (!name) throw bad("Add a name so others know who to ask for.");
  if (phone.replace(/\D/g, "").length < 7) throw bad("Add a phone number with at least 7 digits, including the country code.");
  const email = clip(b.email, 160);
  if (email && !/^\S+@\S+\.\S+$/.test(email)) throw bad("That email address looks incomplete. Fix it or leave it blank.");
  if (!churches.length) throw bad("Add at least one church, so organists can search by church.");
  if (b.consent !== true) throw bad("Listings need the organist's agreement to show their details.");
  const plays = (Array.isArray(b.plays) ? b.plays : []).filter(p => PLAYS.includes(p));
  const available = (Array.isArray(b.available) ? b.available : []).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).slice(0, 26);
  return { name, phone, whatsapp: !!b.whatsapp, email, churches, town: clip(b.town, 80), denom: clip(b.denom, 80), plays, note: clip(b.note, 200), available };
}

export default async function handler(req, res) {
  try {
    await ensure();
    const id = req.query.id ? String(req.query.id) : null;

    if (req.method === "GET") {
      const rows = await sql`select * from organists order by name limit 2000`;
      return send(res, 200, { organists: rows.map(out) });
    }

    if (req.method === "POST") {
      const d = clean(await readBody(req));
      const oid = newId("o"), key = newKey();
      await sql`insert into organists (id,name,phone,whatsapp,email,churches,town,denom,plays,note,available,updated_at,edit_hash)
        values (${oid},${d.name},${d.phone},${d.whatsapp},${d.email},${JSON.stringify(d.churches)}::jsonb,${d.town},${d.denom},
        ${JSON.stringify(d.plays)}::jsonb,${d.note},${JSON.stringify(d.available)}::jsonb,${Date.now()},${hash(key)})`;
      return send(res, 201, { id: oid, editKey: key });
    }

    if ((req.method === "PUT" || req.method === "DELETE") && id) {
      const [row] = await sql`select edit_hash from organists where id = ${id}`;
      if (!row) return send(res, 404, { error: "That listing no longer exists." });
      if (!isAdmin(req) && !keyMatches(req, row.edit_hash)) return send(res, 403, { error: "Only this organist, on the phone they listed from, or an admin can change this listing." });
      if (req.method === "DELETE") { await sql`delete from organists where id = ${id}`; return send(res, 200, { ok: true }); }
      const d = clean(await readBody(req));
      await sql`update organists set name=${d.name}, phone=${d.phone}, whatsapp=${d.whatsapp}, email=${d.email},
        churches=${JSON.stringify(d.churches)}::jsonb, town=${d.town}, denom=${d.denom}, plays=${JSON.stringify(d.plays)}::jsonb,
        note=${d.note}, available=${JSON.stringify(d.available)}::jsonb, updated_at=${Date.now()} where id=${id}`;
      return send(res, 200, { ok: true });
    }

    send(res, 405, { error: "Method not allowed" });
  } catch (err) { fail(res, err); }
}
