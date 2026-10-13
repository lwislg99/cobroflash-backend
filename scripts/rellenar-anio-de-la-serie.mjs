#!/usr/bin/env node
/**
 * SCRUM-1490 · RELLENO de `quotes.series_year` en las filas anteriores a la columna.
 *
 * Uso:  node scripts/rellenar-anio-de-la-serie.mjs --clave=DATABASE_URL_DEV             (SIMULACRO: no escribe)
 *       node scripts/rellenar-anio-de-la-serie.mjs --clave=DATABASE_URL_DEV --aplicar   (escribe)
 *
 * `--clave` es el NOMBRE de la variable de entorno con la base (DATABASE_URL_DEV, _STAGING, o
 * DATABASE_URL para producción). La URL nunca va en la línea de comandos.
 *
 * ⛔ NO LO EJECUTA UNA SESIÓN contra producción: escribe en filas de producción. Quién lo corre
 * en cada base se decide en el ticket. Va DESPUÉS del ALTER (sin la columna, falla al leer).
 *
 * ── LA REGLA (SCRUM-1490 c.18536, punto 2) ───────────────────────────────────────────────
 *
 * El año sale del `createdAt` de la fila, interpretado en Europe/Madrid.
 *
 * 🔴 EL SUPUESTO, DICHO DENTRO: el relleno asume Europe/Madrid porque hoy ningún negocio puede
 * declarar su zona; el primer negocio de otra zona necesitará revisarlo.
 *
 * ── LO QUE NO SE RELLENA, Y SE CUENTA ────────────────────────────────────────────────────
 *
 *  · sin número: no tiene serie. Se queda a NULL, que es lo que NULL significa.
 *  · `frontera_de_anio`: un original creado en la hora en que Madrid y UTC están en años
 *    distintos (la última hora UTC del 31-dic). Quien lo numeró (`allocateQuoteNumber`) usó la
 *    zona del negocio, que sin declarar es UTC: aquí Madrid diría el año siguiente al que se
 *    numeró. No se elige: se deja a NULL y se lista.
 *  · una REVISIÓN toma el año de su ORIGINAL (su propio `createdAt` puede caer en otro año). Si
 *    en su {negocio, número} no hay exactamente UN original con año, no se adivina
 *    (`revision_sin_original`, `revision_con_varios_originales`). Con un solo original es exacto;
 *    desde el 1-ene-2027 un número puede tener dos, y por eso el relleno va antes.
 *
 * Es idempotente: sólo toca filas con `series_year` a NULL, y al escribir lo vuelve a exigir.
 */
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const ZONA_DEL_RELLENO = 'Europe/Madrid';

const anioEn = (instante, zona) =>
  Number(new Intl.DateTimeFormat('en-CA', { timeZone: zona, year: 'numeric' }).format(instante));

/**
 * Qué se escribiría, sin tocar nada. Función pura: recibe las filas y devuelve el plan.
 *
 * @param {Array<{id:number, merchantId:number, quoteNumber:number|null, revision:number,
 *                seriesYear:number|null, createdAt:Date|string}>} filas
 */
export function planDelRelleno(filas) {
  if (!Array.isArray(filas)) throw new Error('planDelRelleno: no he recibido filas — no he podido mirar');
  const rellenar = [];
  const sinAnio = [];
  const anioDelOriginal = new Map(); // `${merchantId}:${quoteNumber}` → [años de sus originales]
  const clave = (f) => `${f.merchantId}:${f.quoteNumber}`;
  let yaTenian = 0;
  let sinNumero = 0;

  const numeradas = [];
  for (const f of filas) {
    if (f.quoteNumber == null) { sinNumero += 1; continue; }
    numeradas.push(f);
  }

  // ① Los originales: su año es el del día en que se numeraron.
  for (const f of numeradas) {
    if (Number(f.revision) !== 0) continue;
    let anio = f.seriesYear;
    if (anio == null) {
      const d = new Date(f.createdAt);
      if (Number.isNaN(d.getTime())) { sinAnio.push({ id: f.id, motivo: 'created_at_ilegible' }); continue; }
      const enMadrid = anioEn(d, ZONA_DEL_RELLENO);
      if (enMadrid !== anioEn(d, 'UTC')) { sinAnio.push({ id: f.id, motivo: 'frontera_de_anio' }); continue; }
      anio = enMadrid;
      rellenar.push({ id: f.id, seriesYear: anio });
    } else {
      yaTenian += 1;
    }
    if (!anioDelOriginal.has(clave(f))) anioDelOriginal.set(clave(f), []);
    anioDelOriginal.get(clave(f)).push(anio);
  }

  // ② Las revisiones: el año de su ÚNICO original.
  for (const f of numeradas) {
    if (Number(f.revision) === 0) continue;
    if (f.seriesYear != null) { yaTenian += 1; continue; }
    const candidatos = anioDelOriginal.get(clave(f)) ?? [];
    if (candidatos.length === 1) rellenar.push({ id: f.id, seriesYear: candidatos[0] });
    else sinAnio.push({ id: f.id, motivo: candidatos.length === 0 ? 'revision_sin_original' : 'revision_con_varios_originales' });
  }

  const poblacion = { filas: filas.length, sinNumero, yaTenian, rellenar: rellenar.length, sinAnio: sinAnio.length };
  if (sinNumero + yaTenian + rellenar.length + sinAnio.length !== filas.length) {
    throw new Error(`planDelRelleno: la población no cuadra (${JSON.stringify(poblacion)}) — hay filas sin clasificar`);
  }
  return { rellenar, sinAnio, poblacion };
}

async function main() {
  const aplicar = process.argv.includes('--aplicar');
  // 🔴 EL DESTINO SE COMPRUEBA CON EL MECANISMO, NO CON LA VISTA (SCRUM-383/746). La base se elige
  // por el NOMBRE de su clave —nunca por una URL en `argv`, que queda en `ps` y en el historial— y
  // `exigirDestinoCorrecto` LANZA si esa clave no apunta a donde promete su nombre.
  const clave = (process.argv.find((a) => a.startsWith('--clave=')) ?? '').slice('--clave='.length);
  if (!clave) throw new Error('Falta --clave=<nombre de la variable con la base>: DATABASE_URL_DEV, DATABASE_URL_STAGING o DATABASE_URL.');
  await import('dotenv/config');
  const { exigirDestinoCorrecto } = await import('./_clave-vs-destino.mjs');
  const url = process.env[clave];
  exigirDestinoCorrecto(clave, url, path.basename(process.cwd()));

  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    const [{ base }] = await prisma.$queryRaw`SELECT current_database() AS base`;
    const filas = await prisma.quote.findMany({
      select: { id: true, merchantId: true, quoteNumber: true, revision: true, seriesYear: true, createdAt: true },
      orderBy: { id: 'asc' },
    });
    const { rellenar, sinAnio, poblacion } = planDelRelleno(filas);
    console.log(`POBLACION · base «${base}» · ${JSON.stringify(poblacion)}`);
    console.log(`SUPUESTO · el relleno asume ${ZONA_DEL_RELLENO} porque hoy ningún negocio puede declarar su zona; el primer negocio de otra zona necesitará revisarlo.`);
    for (const f of sinAnio) console.log(`SIN AÑO · quote ${f.id} · ${f.motivo}`);

    let escritas = 0;
    if (aplicar) {
      const porAnio = new Map();
      for (const f of rellenar) {
        if (!porAnio.has(f.seriesYear)) porAnio.set(f.seriesYear, []);
        porAnio.get(f.seriesYear).push(f.id);
      }
      for (const [seriesYear, ids] of porAnio) {
        const r = await prisma.quote.updateMany({ where: { id: { in: ids }, seriesYear: null }, data: { seriesYear } });
        escritas += r.count;
        console.log(`ESCRITO · ${seriesYear} · ${r.count} de ${ids.length}`);
      }
    }
    console.log(`${aplicar ? 'APLICADO' : 'SIMULACRO (no se ha escrito nada; --aplicar para escribir)'} · a rellenar ${rellenar.length} · escritas ${escritas} · sin año ${sinAnio.length}`);
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then(() => { console.log('EXIT=0'); }, (e) => { console.error(e); console.log('EXIT=1'); process.exitCode = 1; });
}
