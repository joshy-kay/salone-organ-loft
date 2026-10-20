import { put } from "@vercel/blob";
import { send, fail, bad } from "./_lib/db.js";

const MAX = 4 * 1024 * 1024;
const TYPES = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

function sniff(buf) {
  if (buf.length > 4 && buf.slice(0, 4).toString("latin1") === "%PDF") return "application/pdf";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf[0] === 0x89 && buf.slice(1, 4).toString("latin1") === "PNG") return "image/png";
  if (buf.slice(0, 4).toString("latin1") === "RIFF" && buf.slice(8, 12).toString("latin1") === "WEBP") return "image/webp";
  return null;
}
async function rawBody(req) {
  if (Buffer.isBuffer(req.body)) return req.body;
  const chunks = []; let size = 0;
  for await (const c of req) { size += c.length; if (size > MAX + 1024) throw Object.assign(bad("That file is larger than 4 MB."), { status: 413 }); chunks.push(c); }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
    if (!process.env.BLOB_READ_WRITE_TOKEN) return send(res, 503, { error: "File storage isn't connected yet. Paste a link instead for now." });
    const buf = await rawBody(req);
    if (!buf.length) throw bad("The file was empty. Choose it again.");
    if (buf.length > MAX) throw Object.assign(bad("That file is larger than 4 MB. Save a smaller copy, or share a link instead."), { status: 413 });
    const type = sniff(buf);
    if (!type) throw bad("Only PDF, JPG, PNG or WebP files can be uploaded.");
    let fname = String(req.headers["x-file-name"] || "score"); try { fname = decodeURIComponent(fname); } catch {}
    const base = fname.replace(/\.[a-z0-9]+$/i, "").normalize("NFD").replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60).toLowerCase() || "score";
    const blob = await put(`scores/${base}.${TYPES[type]}`, buf, { access: "public", contentType: type, addRandomSuffix: true });
    send(res, 201, { url: blob.url, type, size: buf.length });
  } catch (err) { fail(res, err); }
}
