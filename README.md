# Salone Organ Loft

Free hymn and organ scores, a meter-based tune finder and a directory of organists in Sierra Leone.
Installable on phones as a web app.

- `index.html` – the app (static, works offline for the tune index and meter finder)
- `api/` – Vercel functions: `scores`, `organists`, `upload`, `admin`, `health`
- File storage: Vercel Blob (`BLOB_READ_WRITE_TOKEN`). PDFs up to 4 MB, or up to 8 photos per score (shrunk in the browser before upload).
- Database: Neon Postgres via `DATABASE_URL`. Tables are created and the starter library (153 public-domain scores) is loaded on first request.
- `ADMIN_PIN` – environment variable for admin mode (remove any score or listing, add organists on someone's behalf).
