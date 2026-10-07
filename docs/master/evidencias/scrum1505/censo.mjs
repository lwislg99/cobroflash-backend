#!/usr/bin/env node
// SCRUM-1505 · ¿cuántos tickets clasifica hoy `ya-esta` en «lo citan» cuando el asunto los ENTREGA?
//
//   node docs/master/evidencias/scrum1505/censo.mjs [<sha o ref>]      (por defecto origin/main)
//
// NO es un segundo censo: la respuesta de cada ticket la da el instrumento real (`mirar` y
// `veredictoDe` de `scripts/equipo/ya-esta.mjs`), sin copiar su criterio. Lo único propio es
// (a) elegir a quién preguntarle —los números que salen en posición NO primera de algún asunto, que es
// la condición necesaria para caer en «lo citan»— y (b) el criterio PROPUESTO, `enCabecera`, que se
// aplica al lado para ver qué cambiaría, sin tocar el instrumento.
//
// Sale por stdout en TSV, con la POBLACIÓN en la primera línea y `EXIT=` en la última. No escribe nada.
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const { mirar, veredictoDe, YA_ESTA, NO_ESTA, NO_PUDE } = await import(pathToFileURL(path.join(RAIZ, 'scripts', 'equipo', 'ya-esta.mjs')).href);

const git = (...a) => execFileSync('git', ['-C', RAIZ, ...a], { encoding: 'utf8', maxBuffer: 1 << 28 });
const sha = git('rev-parse', '--verify', `${process.argv[2] || 'origin/main'}^{commit}`).trim();
const US = String.fromCharCode(31);
const RE_NUM = /SCRUM-0*(\d+)(?![0-9])/gi;
const numeros = (s) => [...String(s).matchAll(RE_NUM)].map((m) => Number(m[1]));

/**
 * El criterio PROPUESTO. Los tickets que el asunto lleva EN CABEZA, como lista: `SCRUM-A · SCRUM-B: …`,
 * `SCRUM-A y SCRUM-B: …`, `SCRUM-A, SCRUM-B + SCRUM-C …`. La lista se corta en la primera cosa que no
 * sea un número de ticket o un conector. Un número que aparece DESPUÉS («… y el ticket abierto
 * (SCRUM-N)») no está en cabeza: sigue siendo una cita.
 */
export function enCabecera(asunto) {
  const m = /^\s*SCRUM-0*\d+[a-z]?(?:\s*(?:[·,+&/]|y|e)\s*SCRUM-0*\d+[a-z]?)*/i.exec(String(asunto || ''));
  return m ? [...new Set(numeros(m[0]))] : [];
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const filas = git('log', sha, `--format=%h${US}%cs${US}%s`).split('\n').filter(Boolean).map((l) => l.split(US));
  const noPrimera = new Set(); let conNumero = 0; let multi = 0; let maximo = 0;
  for (const [, , s] of filas) {
    const d = [...new Set(numeros(s))];
    if (d.length === 0) continue;
    conNumero++; for (const n of d) if (n > maximo) maximo = n;
    if (d.length > 1) { multi++; for (const n of d.slice(1)) noPrimera.add(n); }
  }
  const linea = (...c) => console.log(c.join('\t'));
  linea('POBLACION', `main=${sha}`, `commits=${filas.length}`, `con_numero=${conNumero}`, `con_mas_de_un_numero=${multi}`, `tickets_en_posicion_no_primera=${noPrimera.size}`);
  if (filas.length === 0 || multi === 0) { linea('CIEGO', 'la población está vacía: no se ha medido nada'); console.log('EXIT=2'); process.exit(2); }

  // CONTROL DE CERO, derivado: el mayor número que nombra algún asunto, más uno. No lo nombra ningún
  // asunto POR CONSTRUCCIÓN, así que no puede salir en «lo citan». Se pregunta al instrumento real.
  // (No se imprime el número: escrito en un registro, dejaría de dar cero.)
  const cero = await mirar(maximo + 1, { raiz: RAIZ, ref: sha, traer: false });
  const vCero = veredictoDe(cero.h);
  const ceroBien = vCero.respuesta === NO_ESTA && cero.h.commits.length === 0 && cero.h.commitsAjenos.length === 0;
  linea('CONTROL_CERO', 'max+1 de los asuntos', vCero.respuesta, `propios=${cero.h.commits.length}`, `ajenos=${cero.h.commitsAjenos.length}`, ceroBien ? 'OK' : 'FALLA');
  if (!ceroBien) { console.log('EXIT=3'); process.exit(3); }

  linea('#clase', 'ticket', 'respuesta_hoy', 'respuesta_con_cabecera', 'propios', 'ajenos_en_cabecera', 'ajenos_cita', 'registros', 'evidencias', 'ramas_en_main', 'ramas_vivas');
  const cuenta = { CAMBIA: 0, LATENTE: 0, CITA: 0, PROPIO: 0, CIEGO: 0, SIN_AJENOS: 0 };
  const detalle = [];
  for (const n of [...noPrimera].sort((a, b) => a - b)) {
    const { h } = await mirar(n, { raiz: RAIZ, ref: sha, traer: false });
    const v = veredictoDe(h);
    if (v.respuesta === NO_PUDE) { cuenta.CIEGO++; linea('CIEGO', n, v.respuesta, '-', '-', '-', '-', '-', '-', '-', '-', v.porQue.join(' | ')); continue; }
    const cab = h.commitsAjenos.filter((c) => enCabecera(c.asunto).includes(n));
    const cita = h.commitsAjenos.filter((c) => !enCabecera(c.asunto).includes(n));
    const v2 = veredictoDe({ ...h, commits: [...h.commits, ...cab] });
    // CAMBIA   hoy NO ESTÁ y con la cabecera sería YA ESTÁ: el defecto, con víctima.
    // LATENTE  hoy YA ESTÁ pero sin NINGÚN commit propio: lo salva el registro/evidencias/rama, y su
    //          entrega está en «lo citan». Si no tuviera registro, sería un CAMBIA.
    // CITA     todos sus ajenos son citas de pasada: el cajón está bien puesto.
    // PROPIO   tiene commits propios además; lo de cabecera sólo le falta en la cuenta.
    const clase = h.commitsAjenos.length === 0 ? 'SIN_AJENOS'
      : v.respuesta === NO_ESTA && v2.respuesta === YA_ESTA ? 'CAMBIA'
        : cab.length === 0 ? 'CITA'
          : h.commits.length === 0 ? 'LATENTE' : 'PROPIO';
    cuenta[clase]++;
    linea(clase, n, v.respuesta, v2.respuesta, h.commits.length, cab.length, cita.length, h.registros.length, h.evidencias.length, h.ramasEnMain.length, h.ramasVivas.length);
    if (clase === 'CAMBIA' || clase === 'LATENTE') for (const c of cab) detalle.push(['  cabecera', n, c.sha, c.fecha, String(c.asunto).slice(0, 110)]);
    if (v.respuesta === NO_ESTA) for (const c of cita) detalle.push(['  cita', n, c.sha, c.fecha, String(c.asunto).slice(0, 110)]);
  }
  console.log('#detalle: los asuntos de CAMBIA y LATENTE (cabecera), y las citas de los que hoy salen NO ESTÁ');
  for (const d of detalle) linea(...d);
  const suma = Object.values(cuenta).reduce((a, b) => a + b, 0);
  linea('RECUENTO', `preguntados=${noPrimera.size}`, `clasificados=${suma}`, ...Object.entries(cuenta).map(([k, v]) => `${k}=${v}`));
  const salida = suma !== noPrimera.size ? 4 : cuenta.CIEGO > 0 ? 2 : 0;
  console.log(`EXIT=${salida}`);
  process.exit(salida);
}
