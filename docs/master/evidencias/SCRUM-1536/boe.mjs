// Lee el texto consolidado del RD 1007/2023 (BOE-A-2023-24840) y saca los parrafos de territorio.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { veredicto, OK } from './veredicto.mjs';
const f = process.argv[2];
const xml = fs.readFileSync(f, 'utf8');
const bloques = [...xml.matchAll(/<bloque id="([^"]+)" tipo="([^"]+)"(?: titulo="([^"]*)")?[^>]*>([\s\S]*?)<\/bloque>/g)];
console.log(`POBLACION fichero=${f} bytes=${fs.statSync(f).size} sha256=${crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')} bloques=${bloques.length}`);
const plano = (t) => t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const RE = /canari|igic|foral|navarra|vasco|ceuta|melilla|territorio/;
const HOY = '20261013';
let parrafos = 0, hits = 0;
for (const b of bloques) {
  const versiones = [...b[4].matchAll(/<version[^>]*fecha_publicacion="(\d+)"[^>]*fecha_vigencia="(\d+)"[^>]*>([\s\S]*?)<\/version>/g)];
  const vigentes = versiones.filter((v) => v[2] <= HOY);
  const v = vigentes[vigentes.length - 1];
  console.log(`BLOQUE ${b[1]} · ${b[2]} · ${b[3] ?? ''} · versiones=${versiones.length} · vigente pub=${v?.[1]} vig=${v?.[2]}`);
  if (!v) continue;
  const ps = [...v[3].matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)].map((m) => m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim());
  parrafos += ps.length;
  ps.forEach((p, i) => {
    if (b[2] === 'preambulo') return; // el preambulo no es norma; se cuenta aparte abajo
    if (RE.test(plano(p))) { hits++; console.log(`   >> [${b[1]} p${i + 1} · ${p.length}c] ${p}`); }
  });
}
const pre = bloques.find((b) => b[2] === 'preambulo');
const enPre = pre ? [...pre[4].matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)].map((m) => m[1].replace(/<[^>]+>/g, '')).filter((p) => RE.test(plano(p))) : [];
console.log(`PARRAFOS leidos=${parrafos} · con territorio en el ARTICULADO=${hits} · en el preambulo=${enPre.length}`);
enPre.forEach((p) => console.log('   PRE >> ' + p.replace(/\s+/g, ' ').trim()));
// controles
const c1 = /sistemas informaticos de facturacion/.test(plano(xml));
const c0 = /qwzxforalinventado/.test(plano(xml));
// Tres resultados (SCRUM-1536b): no encontrar el centinela solo absuelve si la MISMA busqueda, sobre el
// MISMO texto, encuentra lo que se sabe que esta. Sobre un fichero vacio o que no es el Reglamento, no se sabe.
const vCero = veredicto({ pudoMirar: c1, roto: c0 });
console.log(`CONTROL positivo («sistemas informaticos de facturacion» esta): ${c1} · control de cero: ${vCero}`);
console.log('canari en TODO el fichero:', (plano(xml).match(/canari/g) || []).length, '· igic:', (plano(xml).match(/\bigic\b/g) || []).length, '· foral:', (plano(xml).match(/foral/g) || []).length);
if (vCero !== OK) process.exitCode = 2;
console.log('EXIT=' + (process.exitCode ?? 0));
