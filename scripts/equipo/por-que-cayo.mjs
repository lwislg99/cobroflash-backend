// scripts/equipo/por-que-cayo.mjs — SCRUM-1289 · el «por qué cayó» del check obligatorio.
//
//   node scripts/equipo/por-que-cayo.mjs <tanda.tap> <tanda-spec.log>
//
// Hasta SCRUM-1289 el paso hacía un `awk '/^not ok /'` sobre el TAP, y ese TAP llevaba semanas
// ROTO en TODAS las tandas, verdes incluidas: medido el 29-sep-2026 en los cuatro rojos del ticket (runs
// 36558271547, 36466769679, 36171412632 y 36443916358), un 94 % de bytes NUL en un solo tramo,
// una cabeza de 112 tests de otro `node --test` y la cola del padre. Un `not ok` que cayera en el
// tramo de NUL no salía, y el paso imprimía su cabecera y NADA: se leía como «no cayó nada».
//
// Por eso esto NO se fía del TAP: primero mira si se puede leer, y si no, lo dice y va al log
// `spec` de la tanda. Tres salidas que no se confunden entre sí:
//   · CAYERON        — hay nombres de tests caídos (y dice de qué fuente salen);
//   · SIN_FALLOS     — TAP legible, con su resumen y `fail 0`: el rojo viene de OTRO paso;
//   · NO_SUPE_MIRAR  — ni TAP legible ni sección de fallos en el log. Nunca se lee como verde.
//
// 🔴 EL DIAGNÓSTICO SALE SIEMPRE 0. Vive dentro del job obligatorio y su trabajo es explicar un
// rojo, no ponerlo: cualquier error propio se imprime como NO_SUPE_MIRAR y termina en 0.
// (`--integridad`, el paso informativo, sí sale 1: ver `lineaDeIntegridad`.)
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

export const VEREDICTO = Object.freeze({
  CAYERON: 'CAYERON',
  SIN_FALLOS: 'SIN_FALLOS',
  NO_SUPE_MIRAR: 'NO_SUPE_MIRAR',
});

/** Tope de líneas que se imprimen: un rojo de 40 ficheros no puede enterrar el resto del log. */
export const MAX_LINEAS = 400;

/**
 * ¿Se puede leer este TAP como el de UNA tanda? Devuelve `{ ok, motivo, resumen }`.
 * Un TAP con NUL, sin resumen o con DOS resúmenes es la huella de dos procesos escribiendo el
 * mismo fichero (SCRUM-1289): lo que haya dentro puede faltar, así que no vale para decir «nada».
 */
export function integridadTap(buf) {
  if (!buf || buf.length === 0) return { ok: false, motivo: 'el TAP no existe o está vacío' };
  let nul = 0;
  let primero = -1;
  for (let i = 0; i < buf.length; i++) {
    if (buf[i] === 0) { nul++; if (primero < 0) primero = i; }
  }
  if (nul > 0) {
    const pct = ((100 * nul) / buf.length).toFixed(1);
    return { ok: false, motivo: `el TAP tiene ${nul} bytes NUL de ${buf.length} (${pct} %), desde el byte ${primero}: otro proceso escribió encima` };
  }
  const txt = buf.toString('utf8');
  const tests = [...txt.matchAll(/^# tests (\d+)$/gm)];
  if (tests.length === 0) return { ok: false, motivo: 'el TAP no tiene resumen (`# tests N`): la tanda no terminó' };
  if (tests.length > 1) return { ok: false, motivo: `el TAP tiene ${tests.length} resúmenes (\`# tests N\`): hay más de una tanda dentro` };
  const fail = txt.match(/^# fail (\d+)$/m);
  if (!fail) return { ok: false, motivo: 'el TAP no tiene `# fail N`' };
  const notOk = (txt.match(/^not ok \d+ /gm) ?? []).length;
  const nFail = Number(fail[1]);
  if (nFail > 0 && notOk === 0) {
    return { ok: false, motivo: `el resumen dice fail ${nFail} y no hay ni un \`not ok\` en el TAP` };
  }
  return { ok: true, resumen: { tests: Number(tests[0][1]), fail: nFail } };
}

/** Los bloques `not ok` de primer nivel, con su YAML (`exitCode`, `signal`, `error`…). */
export function fallosDelTap(txt) {
  const out = [];
  let dentro = false;
  for (const l of txt.split(/\r?\n/)) {
    if (/^not ok /.test(l)) dentro = true;
    if (dentro) out.push(l);
    if (dentro && /^ {2}\.\.\.$/.test(l)) dentro = false;
  }
  return out;
}

/** La sección «✖ failing tests:» del reporter `spec`, hasta el final. Vacía si no está. */
export function fallosDelSpec(txt) {
  const lineas = txt.split(/\r?\n/);
  const i = lineas.findIndex((l) => l.includes('✖ failing tests:'));
  if (i < 0) return [];
  return lineas.slice(i + 1).filter((l) => !/^\s+at /.test(l));
}

const leer = (ruta) => {
  try { return ruta && fs.existsSync(ruta) ? fs.readFileSync(ruta) : null; } catch { return null; }
};

export function diagnostico({ tap, spec }) {
  const avisos = [];
  const integ = integridadTap(tap);
  if (integ.ok) {
    const f = fallosDelTap(tap.toString('utf8'));
    if (f.length > 0) return { veredicto: VEREDICTO.CAYERON, fuente: 'TAP', avisos, lineas: f };
    return { veredicto: VEREDICTO.SIN_FALLOS, fuente: 'TAP', avisos, lineas: [],
      resumen: integ.resumen };
  }
  avisos.push(`NO SUPE LEER EL TAP: ${integ.motivo}.`);
  if (!spec || spec.length === 0) {
    avisos.push('Y no hay log `spec` de la tanda para suplirlo.');
    return { veredicto: VEREDICTO.NO_SUPE_MIRAR, avisos, lineas: [] };
  }
  const s = fallosDelSpec(spec.toString('utf8'));
  if (s.length > 0) return { veredicto: VEREDICTO.CAYERON, fuente: 'log spec', avisos, lineas: s };
  avisos.push('Y el log `spec` no tiene sección «✖ failing tests:» (¿la tanda no llegó a su resumen?).');
  return { veredicto: VEREDICTO.NO_SUPE_MIRAR, avisos, lineas: [] };
}

export function informe(d) {
  const out = [];
  for (const a of d.avisos) out.push(`⚠️ ${a}`);
  if (d.veredicto === VEREDICTO.CAYERON) {
    out.push(`── Lo que cayó, con su motivo (fuente: ${d.fuente}) ───────────────────────────`);
    const cortadas = d.lineas.length - MAX_LINEAS;
    out.push(...d.lineas.slice(0, MAX_LINEAS));
    if (cortadas > 0) out.push(`… y ${cortadas} líneas más: el TAP entero está en el artefacto \`tanda-tap\`.`);
  } else if (d.veredicto === VEREDICTO.SIN_FALLOS) {
    out.push(`✅ LA TANDA NO TIENE FALLOS (TAP legible: ${d.resumen.tests} tests, fail 0).`);
    out.push('   El rojo viene de OTRO paso de este job: mira cuál está en rojo arriba.');
  } else {
    out.push('🔴 NO SUPE MIRAR: esto NO quiere decir que no cayera nada. El único dato es el rojo de arriba.');
  }
  return out.join('\n');
}

/**
 * `--integridad <tap>`: la línea del resumen del job. Aquí SÍ sale 1 si el TAP no se puede leer
 * —o si no se pudo comprobar—, porque es un paso informativo (`continue-on-error`) y su rojo es
 * el aviso. Un «no pude mirar» nunca sale en verde.
 */
export function lineaDeIntegridad(buf) {
  const i = integridadTap(buf);
  return i.ok
    ? { codigo: 0, linea: `✅ TAP de la tanda legible: ${i.resumen.tests} tests, fail ${i.resumen.fail} (SCRUM-1289).` }
    : { codigo: 1, linea: `🔴 TAP de la tanda ILEGIBLE: ${i.motivo}. El «por qué cayó» y el suelo de la tanda leen este fichero (SCRUM-1289).` };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1] && process.argv[2] === '--integridad') {
  let codigo = 1;
  try {
    const r = lineaDeIntegridad(leer(process.argv[3]));
    console.log(r.linea);
    codigo = r.codigo;
  } catch (e) {
    console.log(`🔴 NO SUPE MIRAR si el TAP se puede leer (${e?.message ?? e}).`);
  }
  process.exit(codigo);
} else if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const [rutaTap, rutaSpec] = process.argv.slice(2);
    console.log(informe(diagnostico({ tap: leer(rutaTap), spec: leer(rutaSpec) })));
  } catch (e) {
    console.log(`🔴 NO SUPE MIRAR: el diagnóstico reventó (${e?.message ?? e}).`);
  }
  process.exit(0);
}
