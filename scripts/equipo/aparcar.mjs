#!/usr/bin/env node
// SCRUM-1357e · APARCAR — la marca con la que el orquestador dice «este puesto lo he parado YO».
//
//   node scripts/equipo/aparcar.mjs S1,S2,S3 --hasta 2026-10-18T09:00Z --motivo "gasto: ventana de 5 h al 75 %"
//   node scripts/equipo/aparcar.mjs S3 --hasta 30h --motivo "gasto"     (la duración cuenta desde ahora)
//   node scripts/equipo/aparcar.mjs --quitar S3          (o `--quitar todos`)
//   node scripts/equipo/aparcar.mjs                      → las marcas que hay, y si valen
//   … --fichero <ruta>                                   → otra marca (así lo doblan los tests)
//
// POR QUÉ EXISTE. El 16-oct-2026 el orquestador paró al equipo por gasto y el panel del fundador pintó
// cinco puestos «SIN CUBRIR» en rojo. Era verdad, y aun así el fundador preguntó DOS VECES si pasaba
// algo. Un chivato que alarma de más gasta la atención de quien lo mira, y la próxima vez no mira.
//
// POR QUÉ UNA MARCA Y NO UNA DEDUCCIÓN. La alternativa era leer el último estado del puesto: si su
// última sesión acabó `stopped`, alguien la paró. Se descarta porque calla justo el caso peligroso: el
// relevo PARA la sesión vieja antes de lanzar la nueva (`sesion.mjs relevar`), y si la nueva no arranca
// el puesto queda con un `stopped` encima y SIN CUBRIR de verdad. Deducido, eso sería «aparcado».
// La intención no se deduce: la escribe quien la tiene.
//
// LO QUE HACE QUE UNA MARCA NO CALLE A UN PUESTO CAÍDO (lo juzga `juzgarAparcado`, y lo lee `parados.mjs`):
//   · `--hasta` es OBLIGATORIO. Una marca sin fin calla para siempre; quien aparca dice hasta cuándo.
//     Vencida, el puesto vuelve a salir SIN CUBRIR, con la marca nombrada.
//   · Una sesión del puesto LANZADA DESPUÉS de la marca la anula: el puesto se reabrió, y si luego cae,
//     se avisa. Se mira el `createdAt` del registro, no `updatedAt`: parar una sesión la toca después de
//     aparcar y eso NO es un relanzamiento.
//   · Lo que no se puede comprobar no vale: sin registro, o una sesión del puesto que no dice cuándo
//     nació y se movió después de la marca → la marca NO vale y se dice por qué.
//   · Una marca ilegible es una AVERÍA (parados sale 2), nunca «sin marcas».
//
// SALIDA: 0 = hecho (o listado) · 1 = la orden no se entiende · 2 = no pude leer o escribir la marca.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { puestoDe } from './latido.mjs';

const MIN = 60_000;
const horaDe = (ms) => `${new Date(ms).toISOString().slice(0, 16)}Z`;

/** Donde vive la marca: junto al resto del estado del equipo (`latido.mjs`, `cierre-sin-clic.mjs`). */
export function ficheroDeAparcados(env = process.env) {
  const base = env.LOCALAPPDATA ? path.join(env.LOCALAPPDATA, 'yaqu-equipo') : path.join(os.homedir(), '.yaqu-equipo');
  return path.join(base, 'aparcados.json');
}

/**
 * Lee las marcas. O devuelve las marcas, o devuelve POR QUÉ no: un fichero ilegible no es «sin marcas».
 * Que no exista sí lo es (nadie ha aparcado nunca).
 * @returns {{marcas: Record<string, {desde:string, hasta:string, motivo:string}>, motivo?: undefined} | {marcas: null, motivo: string}}
 */
export function leerAparcados(fichero) {
  let crudo;
  try { crudo = fs.readFileSync(fichero, 'utf8'); } catch (e) {
    if (e && e.code === 'ENOENT') return { marcas: {} };
    return { marcas: null, motivo: `no pude leer ${fichero} (${e && e.code ? e.code : 'error'})` };
  }
  let m; try { m = JSON.parse(crudo.replace(/^﻿/, '')); } catch { return { marcas: null, motivo: `${fichero} no es JSON` }; }
  if (!m || typeof m !== 'object' || Array.isArray(m)) return { marcas: null, motivo: `${fichero} no es un objeto puesto → marca` };
  return { marcas: m };
}

/**
 * ¿Vale la marca de este puesto AHORA? Ante la duda, NO: un aparcado que no vale sale como lo que es,
 * un puesto sin cubrir.
 * @param {{puesto:string, marca:object, sesiones:object[]|null, ahora:number}} e  `sesiones` = las del
 *   registro (`leerTrabajos`), o `null` si no se pudo leer.
 * @returns {{vale:true, desde:number, hasta:number, motivo:string} | {vale:false, porque:string}}
 */
export function juzgarAparcado({ puesto, marca, sesiones, ahora }) {
  const desde = Date.parse(marca && marca.desde);
  const hasta = Date.parse(marca && marca.hasta);
  if (!Number.isFinite(desde) || !Number.isFinite(hasta)) return { vale: false, porque: 'la marca no trae «desde» y «hasta» legibles' };
  if (ahora > hasta) return { vale: false, porque: `la marca venció a las ${horaDe(hasta)}` };
  if (!Array.isArray(sesiones)) return { vale: false, porque: 'sin registro no puedo comprobar que nadie lo relanzara después' };
  const n = Number(String(puesto).slice(1));
  for (const s of sesiones) {
    if (puestoDe(s.nombre) !== n) continue;
    if (Number.isFinite(s.creado)) {
      if (s.creado > desde) return { vale: false, porque: `${s.nombre} se lanzó después de aparcarlo (${horaDe(s.creado)})` };
    } else if (Number.isFinite(s.actualizado) && s.actualizado > desde) {
      return { vale: false, porque: `${s.nombre} no dice cuándo nació y se movió después de aparcarlo: no sé si es un relanzamiento` };
    }
  }
  return { vale: true, desde, hasta, motivo: String((marca && marca.motivo) || '') };
}

/** `--hasta`: un instante ISO con huso, o una duración desde ahora (`30h`, `2d`, `90min`). */
export function leerHasta(texto, ahora) {
  const t = String(texto || '').trim();
  const d = /^(\d+)\s*(min|h|d)$/i.exec(t);
  if (d) return ahora + Number(d[1]) * { min: MIN, h: 60 * MIN, d: 1440 * MIN }[d[2].toLowerCase()];
  // Sin huso, la misma cadena es otra hora según la máquina: no se adivina.
  if (!/(Z|[+-]\d{2}:?\d{2})$/i.test(t)) return null;
  const ms = Date.parse(t);
  return Number.isFinite(ms) ? ms : null;
}

const PUESTO = /^S\d$/;

/**
 * La orden, ya decidida y sin tocar disco. Devuelve las marcas nuevas, o el error.
 * @returns {{marcas: object, dice: string} | {error: string}}
 */
export function aplicarOrden({ argv, marcas, ahora }) {
  const arg = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
  const nuevas = { ...marcas };
  const quitar = arg('--quitar');
  if (quitar !== undefined) {
    const lista = quitar === 'todos' ? Object.keys(nuevas) : String(quitar).split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
    if (!lista.length || lista.some((p) => !PUESTO.test(p))) return { error: `--quitar no se deja leer («${quitar}»): se esperan puestos como S1,S3, o «todos»` };
    for (const p of lista) delete nuevas[p];
    return { marcas: nuevas, dice: `quitada la marca de ${lista.join(', ') || 'ninguno'}` };
  }
  const primero = argv.find((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--')));
  if (!primero) return { marcas: nuevas, dice: null };
  const puestos = primero.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
  if (!puestos.length || puestos.some((p) => !PUESTO.test(p))) return { error: `los puestos no se dejan leer («${primero}»): se esperan como S1,S3` };
  const hasta = leerHasta(arg('--hasta'), ahora);
  if (hasta === null) return { error: '--hasta es obligatorio: un instante ISO CON huso (2026-10-18T09:00Z) o una duración (30h, 2d, 90min). Una marca sin fin callaría el puesto para siempre.' };
  if (hasta <= ahora) return { error: `--hasta ya pasó (${horaDe(hasta)})` };
  const motivo = String(arg('--motivo') || '').trim();
  if (!motivo) return { error: '--motivo es obligatorio: es lo que lee el fundador en el panel en vez de «SIN CUBRIR»' };
  for (const p of puestos) nuevas[p] = { desde: new Date(ahora).toISOString(), hasta: new Date(hasta).toISOString(), motivo };
  return { marcas: nuevas, dice: `aparcados ${puestos.join(', ')} hasta ${horaDe(hasta)} («${motivo}»)` };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  const i = argv.indexOf('--fichero');
  const fichero = i >= 0 ? argv[i + 1] : ficheroDeAparcados();
  const leido = leerAparcados(fichero);
  if (!leido.marcas) { console.error(`NO PUDE LEER LA MARCA: ${leido.motivo}. No escribo encima de algo que no sé leer.`); process.exit(2); }
  const ahora = Date.now();
  const r = aplicarOrden({ argv, marcas: leido.marcas, ahora });
  if (r.error) { console.error(r.error); process.exit(1); }
  if (r.dice) {
    try {
      fs.mkdirSync(path.dirname(fichero), { recursive: true });
      fs.writeFileSync(fichero, `${JSON.stringify(r.marcas, null, 2)}\n`);
    } catch (e) { console.error(`NO PUDE ESCRIBIR ${fichero} (${e && e.code ? e.code : e})`); process.exit(2); }
    console.log(r.dice);
  }
  const claves = Object.keys(r.marcas).sort();
  console.log(claves.length ? `marcas en ${fichero}:` : `ninguna marca en ${fichero}`);
  for (const p of claves) {
    const m = r.marcas[p];
    console.log(`  ${p} · desde ${m.desde} · hasta ${m.hasta} · «${m.motivo}»${Date.parse(m.hasta) < ahora ? ' · VENCIDA: el panel lo vuelve a dar SIN CUBRIR' : ''}`);
  }
  console.log('Una sesión del puesto lanzada después de la marca la anula sola. `parados.mjs` dice cuál vale y por qué.');
  process.exit(0);
}
