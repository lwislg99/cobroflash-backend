// Sonda S4 · 23-oct · SOLO GET. Baja /admin/evidencias.zip (2026 T4) de la cuenta QA y lo guarda.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const [repo, salida] = process.argv.slice(2);
const { peticion, RUTA_SESION } = await import(pathToFileURL(path.join(repo, 'scripts/qa/sesion-panel.mjs')).href);
const cookie = fs.readFileSync(RUTA_SESION, 'utf8').trim();
const r = await peticion(fetch, 'GET', '/admin/evidencias.zip?year=2026&quarter=4', { cookie });
const buf = Buffer.from(await r.arrayBuffer());
fs.writeFileSync(salida, buf);
console.log(`GET evidencias.zip → ${r.status} · ${r.headers.get('content-type')} · ${buf.length} B · Date ${r.headers.get('date')}`);
process.exit(r.ok ? 0 : 1);
