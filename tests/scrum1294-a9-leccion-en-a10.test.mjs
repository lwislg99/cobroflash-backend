// SCRUM-1294 · La A9 cierra el círculo: un fallo no se convierte en una nota, se convierte en una
// COMPROBACIÓN; y si no se puede, en un aviso escrito donde lo lean todas (A10) o donde lo lea la
// siguiente sesión del puesto (sus cicatrices) — sin fingir que apuntarlo lo arregla.
//
// Texto canónico: docs/equipo/00-normas-siempre.md, que CLAUDE.md importa con `@`. Este guard exige:
//   · todo tramo de registro `docs/master/SCRUM-*.md` bajo un ancla fechada desde CORTE lleva UNA
//     línea `A9:` con uno de los cuatro formatos de la A9;
//   · `comprobación → \`ruta\`` apunta a un fichero que EXISTE;
//   · `aviso → A10 «…»` / `aviso → cicatriz SN «…»` está LITERAL donde dice, y lleva su motivo;
//   · toda cicatriz de docs/equipo/cicatrices/*.md lleva comprobación que existe, o motivo.
// Y como «una operación que no se ejecutó se lee igual que un éxito», vigila la tubería: que CLAUDE.md
// siga importando el fichero (un import roto no avisa) y que el fichero no crezca sin tope (se carga
// en TODA sesión: lo que pesa, lo arrastra cada turno).
//
// Población declarada: registros, anclas, anclas bajo la norma, líneas A9 por tipo, frases, cicatrices.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SIEMPRE = 'docs/equipo/00-normas-siempre.md';
const CICATRICES = 'docs/equipo/cicatrices';
const PUESTOS = ['S0', 'S1', 'S2', 'S3', 'S4', 'S5', 'J1', 'J2', 'J3', 'J4', 'J5', 'J6'];
const CORTE = '2026-09-30';
const TOPE_BYTES = 16 * 1024;

// El ancla es la de `node scripts/equipo/ancla.mjs`, pero hay 1.400 escritas antes, a mano y con
// formatos distintos (con huso, sin segundos, sin fecha): cuenta la PRIMERA fecha de la línea.
const RE_ANCLA = /^\*\*Medido contra:\*\*.*?(\d{4}-\d{2}-\d{2})/;
const RE_A9 = /^\s*A9: (.*)$/;
const RE_COMPROBACION = /^comprobación → `([^`]+)`\s*$/;
const RE_AVISO = /^aviso → (A10|cicatriz (S[0-5]|J[1-6])) «(.+)» — no se pudo comprobar: \S.*$/;
const RE_SIN = /^sin fallo que generalice — \S.*$/;
const RE_CICATRIZ = /^- \d{4}-\d{2}-\d{2} · (.+?) → (?:comprobación: `([^`]+)`|sin comprobación: \S.*)\s*$/;
const RE_ORIGEN = /\s*\(SCRUM-\d+[a-z]?\)\s*$/;

/** Las frases de A10: una por línea física no vacía, sin su `(SCRUM-N)` final. */
export function frasesDeA10(texto) {
  const t = '\n' + texto.replace(/\r\n/g, '\n');
  const i = t.indexOf('\n## A10 · ');
  if (i < 0) return null;
  const cuerpo = t.slice(i + 1).split('\n').slice(1);
  const fin = cuerpo.findIndex((l) => l.startsWith('## '));
  return (fin < 0 ? cuerpo : cuerpo.slice(0, fin))
    .map((l) => l.trim())
    .filter((l) => l !== '')
    .map((l) => l.replace(RE_ORIGEN, ''));
}

/** Las cicatrices de un fichero de puesto: frases válidas y líneas que no cumplen el formato. */
export function leerCicatrices(nombre, texto, existe) {
  const frases = [];
  const fallos = [];
  for (const [n, l] of texto.replace(/\r\n/g, '\n').split('\n').entries()) {
    if (!l.startsWith('- ')) continue;
    const m = RE_CICATRIZ.exec(l);
    if (!m) { fallos.push(`${nombre}:${n + 1} · cicatriz sin «→ comprobación: \`ruta\`» ni «→ sin comprobación: <por qué>»`); continue; }
    if (m[2] && !existe(m[2])) fallos.push(`${nombre}:${n + 1} · la comprobación \`${m[2]}\` no existe`);
    frases.push(m[1].replace(RE_ORIGEN, '').trim());
  }
  return { frases, fallos };
}

/**
 * Parte un registro en tramos por ancla y dice qué le falta a cada uno.
 * @param {{a10:string[], cicatrices:Record<string,string[]>, existe:(ruta:string)=>boolean}} ctx
 */
export function revisarRegistro(nombre, texto, ctx) {
  const tramos = [];
  for (const [n, l] of texto.replace(/\r\n/g, '\n').split('\n').entries()) {
    const m = RE_ANCLA.exec(l);
    if (m) tramos.push({ linea: n + 1, fecha: m[1], a9: [] });
    else if (tramos.length) {
      const a = RE_A9.exec(l);
      if (a) tramos.at(-1).a9.push(a[1].trim());
    }
  }
  const fallos = [];
  const tipos = { comprobación: 0, aviso: 0, sin: 0 };
  let bajoNorma = 0;
  for (const t of tramos) {
    if (t.fecha < CORTE) continue;
    bajoNorma++;
    const donde = `${nombre}:${t.linea}`;
    if (t.a9.length === 0) fallos.push(`${donde} · ancla del ${t.fecha} sin línea «A9:» (A9 de ${SIEMPRE})`);
    for (const a of t.a9) {
      let m;
      if ((m = RE_COMPROBACION.exec(a))) {
        tipos.comprobación++;
        if (!ctx.existe(m[1])) fallos.push(`${donde} · la comprobación \`${m[1]}\` no existe en el repo`);
      } else if ((m = RE_AVISO.exec(a))) {
        tipos.aviso++;
        const lista = m[2] ? ctx.cicatrices[m[2]] ?? [] : ctx.a10;
        const dondeVa = m[2] ? `${CICATRICES}/${m[2]}.md` : `A10 de ${SIEMPRE}`;
        if (!lista.includes(m[3].trim())) fallos.push(`${donde} · el aviso «${m[3]}» no está LITERAL en ${dondeVa}`);
      } else if (RE_SIN.test(a)) tipos.sin++;
      else fallos.push(`${donde} · «A9: ${a}» no es ninguno de los cuatro formatos de la A9`);
    }
  }
  return { anclas: tramos.length, bajoNorma, tipos, fallos };
}

const existeEnRepo = (ruta) => fs.existsSync(path.join(RAIZ, ruta));
const textoSiempre = fs.readFileSync(path.join(RAIZ, SIEMPRE), 'utf8');
const A10 = frasesDeA10(textoSiempre);

test('SCRUM-1294 · control positivo: el revisor SABE fallar por cada una de sus reglas', () => {
  const ctx = { a10: ['Una frase que sí está.'], cicatrices: { S3: ['Una cicatriz de S3.'] }, existe: (r) => r === 'tests/existe.test.mjs' };
  const ancla = (d) => `**Medido contra:** \`origin/main\` = \`${'a'.repeat(40)}\` · ${d}T10:00:00Z`;
  const fallan = (cuerpo, fecha = '2026-10-01') => revisarRegistro('x.md', `${ancla(fecha)}\n${cuerpo}\n`, ctx).fallos.length;
  assert.equal(fallan('texto sin A9'), 1, 'un tramo sin línea A9 tiene que fallar');
  assert.equal(fallan('A9: comprobación → `tests/no-existe.test.mjs`'), 1, 'una comprobación que no existe tiene que fallar');
  assert.equal(fallan('A9: aviso → A10 «Otra frase.» — no se pudo comprobar: x'), 1, 'un aviso fuera de A10 tiene que fallar');
  assert.equal(fallan('A9: aviso → cicatriz S1 «Una cicatriz de S3.» — no se pudo comprobar: x'), 1, 'la cicatriz de otro puesto no cuenta');
  assert.equal(fallan('A9: aviso → A10 «Una frase que sí está.»'), 1, 'un aviso sin motivo tiene que fallar');
  assert.equal(fallan('A9: sin fallo que generalice — '), 1, '«sin fallo» sin motivo tiene que fallar');
  assert.equal(fallan('A9: apuntado en mis notas'), 1, 'un formato inventado tiene que fallar');
  assert.equal(fallan('texto sin A9', '2026-09-29'), 0, 'antes del corte no se exige');
  const bien = revisarRegistro('x.md', [
    ancla('2026-10-01'), 'A9: comprobación → `tests/existe.test.mjs`',
    ancla('2026-10-02'), 'A9: aviso → A10 «Una frase que sí está.» — no se pudo comprobar: es de criterio',
    ancla('2026-10-03'), 'A9: aviso → cicatriz S3 «Una cicatriz de S3.» — no se pudo comprobar: depende del prompt',
    ancla('2026-10-04'), 'A9: sin fallo que generalice — solo docs',
  ].join('\n'), ctx);
  assert.deepEqual([bien.fallos, bien.bajoNorma, bien.tipos], [[], 4, { comprobación: 1, aviso: 2, sin: 1 }]);
  assert.deepEqual(frasesDeA10('## A10 · F\n\nUno. (SCRUM-7)\nDos.\n## A11 · x\nTres.\n'), ['Uno.', 'Dos.']);
  const c = leerCicatrices('c.md', '- 2026-09-29 · Bien. → sin comprobación: criterio\n- 2026-09-29 · Mal.\n- 2026-09-29 · Rota. → comprobación: `no/existe`\n', ctx.existe);
  assert.deepEqual([c.frases, c.fallos.length], [['Bien.', 'Rota.'], 2]);
});

test('SCRUM-1294 · A9 y A10 están donde CLAUDE.md las importa, y el fichero cabe en su tope', () => {
  assert.ok(A10, `${SIEMPRE} no tiene sección «## A10 · »`);
  assert.ok(A10.length >= 30, `A10 con solo ${A10.length} frases: el parser no ve el fichero real`);
  assert.ok(/^## A9 · Cuando algo te sale mal/m.test(textoSiempre), `${SIEMPRE} no tiene la A9`);
  const claude = fs.readFileSync(path.join(RAIZ, 'CLAUDE.md'), 'utf8').replace(/\r\n/g, '\n');
  // Un import solo cuenta a principio de línea y fuera de un bloque de código.
  let enBloque = false;
  let importa = false;
  for (const l of claude.split('\n')) {
    if (l.startsWith('```')) enBloque = !enBloque;
    else if (!enBloque && l.trim() === `@${SIEMPRE}`) importa = true;
  }
  assert.ok(importa, `CLAUDE.md ya no importa @${SIEMPRE}: la A9 y la A10 dejarían de llegar solas, y en silencio`);
  const bytes = Buffer.byteLength(textoSiempre);
  assert.ok(bytes <= TOPE_BYTES, `${SIEMPRE} pesa ${bytes} B (tope ${TOPE_BYTES}): se carga en TODA sesión — poda A10 (A11)`);
});

test('SCRUM-1294 · cada puesto tiene su fichero de cicatrices, y toda cicatriz lleva comprobación o motivo', () => {
  const fallos = [];
  let total = 0;
  for (const p of PUESTOS) {
    const rel = `${CICATRICES}/${p}.md`;
    if (!existeEnRepo(rel)) { fallos.push(`falta ${rel}`); continue; }
    const r = leerCicatrices(rel, fs.readFileSync(path.join(RAIZ, rel), 'utf8'), existeEnRepo);
    total += r.frases.length;
    fallos.push(...r.fallos);
  }
  console.log(`scrum1294 · cicatrices: ${PUESTOS.length} puestos · ${total} cicatrices`);
  assert.deepEqual(fallos, []);
});

test('SCRUM-1294 · todo registro desde el corte lleva su línea A9, y lo que dice se cumple', () => {
  const cicatrices = {};
  for (const p of PUESTOS) {
    const rel = `${CICATRICES}/${p}.md`;
    cicatrices[p] = existeEnRepo(rel) ? leerCicatrices(rel, fs.readFileSync(path.join(RAIZ, rel), 'utf8'), existeEnRepo).frases : [];
  }
  const ctx = { a10: A10, cicatrices, existe: existeEnRepo };
  const dir = path.join(RAIZ, 'docs', 'master');
  const ficheros = fs.readdirSync(dir).filter((f) => /^SCRUM-\d+.*\.md$/.test(f));
  const suma = { anclas: 0, bajoNorma: 0, comprobación: 0, aviso: 0, sin: 0 };
  const fallos = [];
  for (const f of ficheros) {
    const r = revisarRegistro(`docs/master/${f}`, fs.readFileSync(path.join(dir, f), 'utf8'), ctx);
    suma.anclas += r.anclas;
    suma.bajoNorma += r.bajoNorma;
    for (const k of ['comprobación', 'aviso', 'sin']) suma[k] += r.tipos[k];
    fallos.push(...r.fallos);
  }
  console.log(`scrum1294 · población: ${ficheros.length} registros · ${suma.anclas} anclas · ${suma.bajoNorma} desde ${CORTE} · A9: ${suma.comprobación} comprobación, ${suma.aviso} aviso, ${suma.sin} sin fallo · ${A10.length} frases en A10`);
  // Suelo: si el parser del ancla se rompe, «0 anclas» se leería como «nada que exigir».
  assert.ok(ficheros.length >= 800, `solo ${ficheros.length} registros en docs/master`);
  assert.ok(suma.anclas >= 1000, `solo ${suma.anclas} anclas reconocidas: el formato de ancla cambió y el guard ya no mira`);
  assert.deepEqual(fallos, []);
});
