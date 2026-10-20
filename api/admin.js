import { isAdmin, send } from "./_lib/db.js";
export default function handler(req, res) {
  if (!process.env.ADMIN_PIN) return send(res, 503, { error: "Admin PIN isn't set up yet." });
  return isAdmin(req) ? send(res, 200, { ok: true }) : send(res, 401, { error: "That PIN didn't work." });
}
