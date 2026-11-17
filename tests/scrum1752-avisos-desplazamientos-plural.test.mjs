// SCRUM-1752 · LOS TRES AVISOS DE LA CASILLA LA LLAMAN COMO SU RÓTULO: «Desplazamientos».
//
// Desde SCRUM-1746 la casilla se rotula «Desplazamientos (nº de viajes)». Sus tres avisos seguían
// diciendo «Desplazamiento», en singular: el profesional leía un nombre encima de la casilla y otro en
// el aviso de la misma casilla. Cada aviso tenía firma propia (SCRUM-1491 y SCRUM-1492) y por eso
// SCRUM-1746 no los tocó.
//
// FIRMA: el orquestador, por delegación del fundador, el 17-nov-2026 — SCRUM-1752 comentario 21987.
// Consta en `docs/microcopy/2026-11-17-SCRUM-1752-avisos-desplazamientos-plural.md`.
//
// EL CAMBIO ES UNA LETRA POR AVISO. El verbo se queda en «es», como en los gemelos de Kilómetros
// («Kilómetros es 0 o más»): nombra la casilla, no cuenta viajes.
//
// Lo que se fija aquí:
//   ① los tres literales aprobados, letra a letra;
//   ② ningún texto de la hoja del parte nombra la casilla en singular;
//   ③ lo que NO cambia: el rótulo y los tres gemelos de Kilómetros;
//   ④ la firma tiene su ficha, con los tres literales y la línea de la delegación;
//   ⑤ el rótulo del par reparte sus dos líneas (el paréntesis no se parte a 390): la regla de CSS está.
//
// ⚠️ LO QUE ⑤ NO MIDE: dónde cae el salto de línea. Eso sólo lo sabe un navegador, y está medido en
// yaqu.app con `docs/master/evidencias/SCRUM-1752/c1752-parentesis.mjs` (registro del ticket). ⑤ sólo
// avisa si alguien quita la regla.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard } from './_banco-vistas.mjs';
import { soloEjecutable } from './_guard-texto.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FICHA = path.join(RAIZ, 'docs', 'microcopy', '2026-11-17-SCRUM-1752-avisos-desplazamientos-plural.md');
const CSS = path.join(RAIZ, 'public', 'dashboard', 'css', 'styles.css');

const ES_ENTERO = 'No se ha guardado. Desplazamientos es un número entero, como 1 o 2 — no el tiempo de viaje';
const ES_CERO_O_MAS = 'No se ha guardado. Desplazamientos es 0 o más';
const DEMASIADO_GRANDE = 'No se ha guardado. Ese número es demasiado grande para Desplazamientos';

const textos = () => cargarDashboard(RAIZ).ctx.PARTE_TEXTOS;

test('SCRUM-1752 ① los tres avisos dicen «Desplazamientos», con el literal aprobado', () => {
  const T = textos();
  assert.equal(T.desplazamientoEsEntero, ES_ENTERO);
  assert.equal(T.desplazamientoEsCeroOMas, ES_CERO_O_MAS);
  assert.equal(T.desplazamientoDemasiadoGrande, DEMASIADO_GRANDE);
});

test('SCRUM-1752 ② ningún texto de la hoja del parte nombra la casilla en singular', () => {
  const T = textos();
  const cadenas = Object.entries(T).filter(([, v]) => typeof v === 'string');
  // SUELO: si `PARTE_TEXTOS` cambia de forma y deja de traer cadenas, «ninguno en singular» sería un
  // cero sobre el vacío.
  assert.ok(cadenas.length >= 20, `🔴 SUELO: PARTE_TEXTOS trae ${cadenas.length} cadenas (se esperaban 20 o más)`);
  const enPlural = cadenas.filter(([, v]) => /Desplazamientos/.test(v)).map(([k]) => k).sort();
  assert.deepEqual(
    enPlural,
    ['desplazamiento', 'desplazamientoDemasiadoGrande', 'desplazamientoEsCeroOMas', 'desplazamientoEsEntero'],
    'el rótulo y los tres avisos son los cuatro que nombran la casilla',
  );
  // «Desplazamiento» con mayúscula es el NOMBRE de la casilla. «Horas y desplazamiento» (el título del
  // paso, en minúscula) es otra cosa y no entra.
  const enSingular = cadenas.filter(([, v]) => /Desplazamiento(?!s)/.test(v)).map(([k, v]) => `${k}: «${v}»`);
  assert.deepEqual(enSingular, [], '🔴 queda un texto que llama «Desplazamiento» a la casilla «Desplazamientos»');
});

test('SCRUM-1752 ③ no cambian el rótulo ni los tres gemelos de Kilómetros', () => {
  const T = textos();
  assert.equal(T.desplazamiento, 'Desplazamientos (nº de viajes)');
  assert.equal(T.kilometrosEsUnNumero, 'No se ha guardado. Kilómetros es un número, como 12 o 12,5');
  assert.equal(T.kilometrosEsCeroOMas, 'No se ha guardado. Kilómetros es 0 o más');
  assert.equal(T.kilometrosDemasiadoGrande, 'No se ha guardado. Ese número es demasiado grande para Kilómetros');
});

test('SCRUM-1752 ④ la firma tiene su ficha, con los tres literales y la línea de la delegación', () => {
  assert.ok(fs.existsSync(FICHA), '🔴 falta la ficha de la firma en docs/microcopy/');
  const lineas = fs.readFileSync(FICHA, 'utf8').split(/\r?\n/);
  assert.ok(lineas.includes('> ' + ES_ENTERO), '🔴 la ficha no cita el primer literal en su propia línea de cita');
  assert.ok(lineas.includes('> ' + ES_CERO_O_MAS), '🔴 la ficha no cita el segundo literal en su propia línea de cita');
  assert.ok(lineas.includes('> ' + DEMASIADO_GRANDE), '🔴 la ficha no cita el tercer literal en su propia línea de cita');
  assert.ok(
    lineas.includes('**Aprobado por el orquestador por delegación del fundador** el 17-nov-2026 — SCRUM-1752 comentario 21987.'),
    '🔴 la ficha no lleva la línea de la firma delegada (docs/microcopy/README.md), fuera de cita',
  );
});

test('SCRUM-1752 ⑤ el rótulo del par de las horas reparte sus líneas (la regla de CSS está)', () => {
  const css = fs.readFileSync(CSS, 'utf8').replace(/\r\n/g, '\n');
  // Sin comentarios: el que explica la regla la nombra (A23, casilla 2). Y anclado a principio de línea.
  // El filtro es el de la casa (SCRUM-700: un solo sitio); en CSS la almohadilla es un color o un id.
  const sinComentarios = soloEjecutable(css, { almohadillaEsComentario: false });
  assert.ok(sinComentarios.length > 100000, `🔴 SUELO: styles.css sin comentarios mide ${sinComentarios.length} caracteres`);
  const m = sinComentarios.match(/\n\.parte-horas-par \.parte-campo-rotulo \{([^}]*)\}/);
  assert.ok(m, '🔴 falta la regla `.parte-horas-par .parte-campo-rotulo { … }` en styles.css');
  assert.match(m[1], /text-wrap:\s*balance;/, '🔴 la regla no reparte las líneas del rótulo (`text-wrap: balance`)');
});
