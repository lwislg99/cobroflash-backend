#!/usr/bin/env node
// SCRUM-1554c · LA PUERTA DE GO-LIVE, EN UN FICHERO — lo que tiene que ser verdad antes de encender
// INVOICING_ES_ENABLED para el primer negocio real en España (regla 43; decisión del orquestador en
// SCRUM-1554 c.19645).
//
//   node scripts/go-live/puerta.mjs            → el recuento y las abiertas
//   node scripts/go-live/puerta.mjs <fichero>  → otra lista (así la doblan los tests)
//
// SALIDA: 0 = ninguna abierta · 1 = hay abiertas · 2 = NO PUDE LEER la lista o no tiene su forma.
// Un 2 nunca se confunde con un 0: una lista que no se puede leer no dice que la puerta esté libre.
//
// POR QUÉ ES UN FICHERO. Hasta el 19-oct la lista vivía en el cuerpo de SCRUM-1554 y en sus
// comentarios, y dos entradas sólo constaban en registros de otros tickets (1183, 1558). Una lista que
// sólo existe en Jira no la puede leer ningún guard sin credenciales.
//
// 🔴 LO QUE ESTO NO HACE: impedir que se encienda el interruptor. INVOICING_ES_ENABLED se enciende por
// la variable de entorno de Railway o por `merchants.flags` en la BD, y NINGUNO de los dos caminos pasa
// por la CI. Un guard de CI sólo puede avisar. Lo que lo impediría es un cierre en ejecución dentro de
// `isFlagEnabled` (`src/core/flags.ts`), que es un flag global de la Parte P → STOP, con GO del
// fundador. Está propuesto (mitad B de SCRUM-1554c) y NO construido.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PUERTA = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'docs', 'go-live', 'puerta.json');
export const SALIDA_LIBRE = 0;
export const SALIDA_ABIERTAS = 1;
export const SALIDA_NO_PUDE = 2;

const texto = (v) => typeof v === 'string' && v.trim().length > 0;

/**
 * Juzga la lista contra lo que el guard DECLARA: cuántas entradas existen (`total`) y cuáles están
 * cerradas (`cerradas`). Las dos mitades del trinquete: una entrada que desaparece cae, y una que
 * aparece o se cierra sin que el guard lo declare también cae, para que el diff diga cuál fue.
 * @param {unknown} doc  el JSON de la lista, ya parseado
 * @param {{total: number, cerradas: number[]}} declarado
 * @returns {string[]} los fallos; vacío = la lista está bien formada y cuadra con lo declarado
 */
export function juzgarPuerta(doc, declarado) {
  if (!doc || typeof doc !== 'object' || !Array.isArray(doc.entradas)) {
    return ['la lista no tiene «entradas»: no es la puerta'];
  }
  const fallos = [];
  const entradas = doc.entradas;
  entradas.forEach((e, i) => {
    const quien = e && Number.isInteger(e.numero) ? `la entrada ${e.numero}` : `la posición ${i}`;
    if (!e || typeof e !== 'object') { fallos.push(`${quien} no es un objeto`); return; }
    if (!Number.isInteger(e.numero)) fallos.push(`${quien} no tiene «numero» entero`);
    for (const campo of ['que', 'de_donde', 'consta_en']) {
      if (!texto(e[campo])) fallos.push(`${quien} no dice «${campo}»`);
    }
    if (e.estado === 'abierta') {
      if (e.cerrada !== undefined) fallos.push(`${quien} está abierta y lleva «cerrada»: o una cosa o la otra`);
    } else if (e.estado === 'cerrada') {
      const c = e.cerrada;
      if (!c || typeof c !== 'object') fallos.push(`${quien} está cerrada sin «cerrada: {por, motivo, sha, fecha}»`);
      else {
        if (!texto(c.por)) fallos.push(`${quien} está cerrada sin decir POR QUIÉN`);
        if (!texto(c.motivo)) fallos.push(`${quien} está cerrada sin MOTIVO`);
        if (typeof c.sha !== 'string' || !/^[0-9a-f]{7,40}$/.test(c.sha)) fallos.push(`${quien} está cerrada sin un sha que se pueda buscar`);
        if (typeof c.fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(c.fecha)) fallos.push(`${quien} está cerrada sin fecha`);
      }
    } else {
      fallos.push(`${quien} tiene un estado que no es «abierta» ni «cerrada»: ${JSON.stringify(e.estado)}`);
    }
  });

  // Numeradas 1..n, en orden y sin huecos: un hueco es una entrada BORRADA.
  const numeros = entradas.map((e) => (e ? e.numero : undefined));
  numeros.forEach((n, i) => {
    if (n !== i + 1) fallos.push(`la posición ${i} lleva el número ${JSON.stringify(n)} y le toca el ${i + 1}: las entradas no se renumeran ni se borran`);
  });

  if (entradas.length < declarado.total) {
    const hay = new Set(numeros);
    const faltan = [];
    for (let n = 1; n <= declarado.total; n++) if (!hay.has(n)) faltan.push(n);
    fallos.push(`🔴 faltan ${declarado.total - entradas.length} entrada(s) (${faltan.join(', ') || 'las del final'}): una entrada de la puerta NUNCA se borra, se cierra con «cerrada: {por, motivo, sha, fecha}»`);
  } else if (entradas.length > declarado.total) {
    fallos.push(`hay ${entradas.length - declarado.total} entrada(s) nueva(s): sube TOTAL a ${entradas.length} en el guard, en el mismo cambio`);
  }

  const cerradasDeVerdad = entradas.filter((e) => e && e.estado === 'cerrada').map((e) => e.numero);
  const declaradas = new Set(declarado.cerradas);
  for (const n of cerradasDeVerdad) {
    if (!declaradas.has(n)) fallos.push(`la entrada ${n} está cerrada y el guard no lo declara: añádela a CERRADAS, así el diff dice cuál salió`);
  }
  for (const n of declarado.cerradas) {
    if (!cerradasDeVerdad.includes(n)) fallos.push(`el guard da por cerrada la entrada ${n} y la lista no: o se reabrió, o se declaró sin cerrarla`);
  }
  return fallos;
}

/** Lee la lista. O su contenido, o POR QUÉ no: nunca una lista vacía por un fallo. */
export function leerPuerta(fichero = PUERTA) {
  let crudo;
  try { crudo = fs.readFileSync(fichero, 'utf8'); } catch (e) { return { motivo: `no pude leer ${fichero} (${e.code || e.message})` }; }
  try { return { doc: JSON.parse(crudo.replace(/^﻿/, '')) }; } catch (e) { return { motivo: `${fichero} no es JSON (${e.message})` }; }
}

/** Abiertas y cerradas, para el recuento. */
export function recuento(doc) {
  const entradas = doc && Array.isArray(doc.entradas) ? doc.entradas : [];
  return {
    total: entradas.length,
    abiertas: entradas.filter((e) => e && e.estado === 'abierta'),
    cerradas: entradas.filter((e) => e && e.estado === 'cerrada'),
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const fichero = process.argv[2] ? path.resolve(process.argv[2]) : PUERTA;
  const r = leerPuerta(fichero);
  if (r.motivo) {
    console.log(`PUERTA DE GO-LIVE · NO PUDE MIRAR: ${r.motivo}. Esto no es «puerta libre».`);
    process.exitCode = SALIDA_NO_PUDE;
  } else {
    const { total, abiertas, cerradas } = recuento(r.doc);
    if (!Array.isArray(r.doc.entradas)) {
      console.log('PUERTA DE GO-LIVE · NO PUDE MIRAR: la lista no tiene «entradas». Esto no es «puerta libre».');
      process.exitCode = SALIDA_NO_PUDE;
    } else {
      console.log(`PUERTA DE GO-LIVE · ${abiertas.length} abierta(s) de ${total} · cerradas: ${cerradas.map((e) => e.numero).join(', ') || 'ninguna'}`);
      for (const e of abiertas) console.log(`  ${String(e.numero).padStart(2)} · ${e.que} [${e.de_donde}]`);
      process.exitCode = abiertas.length ? SALIDA_ABIERTAS : SALIDA_LIBRE;
    }
  }
}
