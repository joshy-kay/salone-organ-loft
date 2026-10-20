import { del } from "@vercel/blob";
import { sql, ensure, newId, newKey, hash, isAdmin, keyMatches, readBody, clip, send, fail, bad, BLOB_HOST } from "./_lib/db.js";

const KINDS = ["Hymn", "Voluntary", "March", "Descant or reharmonization", "Service music", "Anthem"];
const RIGHTS = ["Public domain", "My own work", "Shared with permission"];

const out = r => ({ id: r.id, title: r.title, kind: r.kind, firstLine: r.first_line, tune: r.tune, composer: r.composer,
  meter: r.meter, meterKey: r.meter_key, key: r.key, hymnal: r.hymnal, link: r.link, rights: r.rights,
  source: r.source, notes: r.notes, reported: r.reported, pages: r.pages || [], createdAt: Number(r.created_at) });

export default async function handler(req, res) {
  try {
    await ensure();
    const id = req.query.id ? String(req.query.id) : null;

    if (req.method === "GET") {
      const rows = await sql`select * from scores order by created_at desc limit 5000`;
      return send(res, 200, { scores: rows.map(out) });
    }

    if (req.method === "POST" && id && req.query.action === "report") {
      await sql`update scores set reported = true where id = ${id}`;
      return send(res, 200, { ok: true });
    }

    if (req.method === "POST") {
      const b = await readBody(req);
      const pages = (Array.isArray(b.pages) ? b.pages : []).map(u => clip(u, 600)).filter(u => BLOB_HOST.test(u)).slice(0, 8);
      const title = clip(b.title, 200), link = pages[0] || clip(b.link, 600), rights = clip(b.rights, 60);
      if (!title) throw bad("Add a title so others can find the score.");
      if (!/^https:\/\/\S+\.\S+$/.test(link)) throw bad("Upload the score, or paste a link that starts with https:// and that anyone can open.");
      if (!RIGHTS.includes(rights)) throw bad("Choose who owns the rights to this score.");
      const kind = KINDS.includes(b.kind) ? b.kind : "Hymn";
      const sid = newId("u"), key = newKey();
      await sql`insert into scores (id,title,kind,first_line,tune,composer,meter,meter_key,key,hymnal,link,rights,source,notes,created_at,edit_hash,pages)
        values (${sid},${title},${kind},${clip(b.firstLine,200)},${clip(b.tune,80)},${clip(b.composer,160)},${clip(b.meter,40)},
        ${clip(b.meterKey,80)},${clip(b.key,40)},${clip(b.hymnal,160)},${link},${rights},${pages.length ? "Uploaded by an organist" : "Shared by an organist"},'',${Date.now()},${hash(key)},${JSON.stringify(pages)}::jsonb)`;
      return send(res, 201, { id: sid, editKey: key });
    }

    if (req.method === "DELETE" && id) {
      const [row] = await sql`select edit_hash, link, pages from scores where id = ${id}`;
      if (!row) return send(res, 404, { error: "That score no longer exists." });
      if (!isAdmin(req) && !keyMatches(req, row.edit_hash)) return send(res, 403, { error: "Only the person who added this score, or an admin, can remove it." });
      await sql`delete from scores where id = ${id}`;
      const files = [...new Set([...(row.pages || []), row.link])].filter(u => BLOB_HOST.test(u || ""));
      if (files.length) { try { await del(files); } catch (e) { console.error("blob delete failed", e); } }
      return send(res, 200, { ok: true });
    }

    send(res, 405, { error: "Method not allowed" });
  } catch (err) { fail(res, err); }
}
