// SCRUM-1100 — reproducción aislada. Vive como evidencia, no se enchufa a `npm test`.
// Repite el ciclo limpia→(mutar,correr,restaurar) para tests/vigia-atascados.test.mjs
// N veces, para medir la tasa de fallo del mecanismo del meta-guard sobre ESE fichero
// sin pagar las otras ~319 declaraciones del árbol completo. Correr desde la raíz del repo:
//   node docs/master/evidencias/scrum1100/repro-vigia-atascados.mjs [N]
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const MOD = pathToFileURL(path.join(RAIZ, 'scripts/meta-guard-mutaciones.mjs')).href;
const {
  correr, aplicarUna, censoDeDeclaraciones, cayo, murioElFichero,
} = await import(MOD);

const DIR_TESTS = path.join(RAIZ, 'tests');
const GUARD = 'vigia-atascados.test.mjs';
const N = Number(process.argv[2] || 10);

const censo = [...censoDeDeclaraciones(DIR_TESTS)].find((c) => c.guard === GUARD);
if (!censo) { console.error('no encontré las declaraciones de', GUARD); process.exit(2); }
console.log(`${censo.mutaciones.length} mutaciones declaradas en ${GUARD}. ${N} rondas.`);

const resumen = { limpiaMuerta: 0, limpiaOk: 0, porMutacion: censo.mutaciones.map((m) => ({
  cae: m.cae, ok: 0, muerto: 0, ciego: 0, otros: 0,
})) };

for (let ronda = 1; ronda <= N; ronda++) {
  const t0 = Date.now();
  const limpia = await correr(GUARD, null);
  const limpiaMurio = murioElFichero(limpia, GUARD, DIR_TESTS);
  if (limpiaMurio) resumen.limpiaMuerta++; else resumen.limpiaOk++;
  const detalle = [];
  for (let i = 0; i < censo.mutaciones.length; i++) {
    const mut = censo.mutaciones[i];
    const r = await aplicarUna(mut, GUARD, limpia);
    const slot = resumen.porMutacion[i];
    if (r.muerto) { slot.muerto++; detalle.push(`MUERTO:${i}`); }
    else if (r.ciego) { slot.ciego++; detalle.push(`CIEGO:${i}`); }
    else if (r.ok) { slot.ok++; }
    else { slot.otros++; detalle.push(`OTRO:${i}:${JSON.stringify(r).slice(0,120)}`); }
  }
  const estadoLimpia = limpiaMurio ? 'MUERTA' : 'viva';
  console.log(`ronda ${ronda}/${N} · ${Date.now() - t0}ms · limpia=${estadoLimpia} · ` + (detalle.length ? detalle.join(' ') : 'todas ok'));
}

console.log('\n=== RESUMEN ===');
console.log('limpia: ok=%d muerta=%d', resumen.limpiaOk, resumen.limpiaMuerta);
for (const s of resumen.porMutacion) {
  console.log(`«${s.cae.slice(0, 60)}» → ok=${s.ok} muerto=${s.muerto} ciego=${s.ciego} otros=${s.otros}`);
}
