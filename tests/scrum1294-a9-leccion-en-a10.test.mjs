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
//
// SCRUM-1731 (A3 de 00-normas-comunes, «Una mutación que afirmas se puede repetir, o no cuenta»):
// desde CORTE_MUTACIONES, una línea `Mutaciones: catálogo → \`<test>\`` exige que el test EXISTA y
// declare `MUTACIONES_QUE_ME_TUMBAN` (leído por AST con el lector del meta-guard, no por texto), y una
// `Mutaciones: una vez → \`<guion>\`` exige que el guion esté en git. Sólo ve la línea que EXISTE: la
// que falta la ve quien cierra (la norma lo dice así, y no se finge aquí lo contrario).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mutacionesDeclaradas } from '../scripts/meta-guard-mutaciones.mjs';

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
// SCRUM-1731 · la línea se reconoce por su CLAVE (con o sin viñeta y negrita, como se escriben los
// registros); detrás de la flecha va UNA ruta, con o sin comillas invertidas (la norma firmada la
// escribe `→ <test>`, y quien la copie tal cual no tiene por qué caer), y después lo que se quiera.
const CORTE_MUTACIONES = '2026-11-18';
const RE_MUT_CLAVE = /^\s*(?:- )?(?:\*\*)?Mutaciones:(?:\*\*)? (catálogo|una vez) →(.*)$/;
const RE_MUT_RUTA = /^ +(?:`([^`\s]+)`|([^`\s]+))/;

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
 * @param {{a10:string[], cicatrices:Record<string,string[]>, existe:(ruta:string)=>boolean,
 *          declara?:(ruta:string)=>number|null, enGit?:(ruta:string)=>boolean}} ctx
 *   `declara`: cuántas mutaciones declara el test en MUTACIONES_QUE_ME_TUMBAN (null si no existe).
 */
export function revisarRegistro(nombre, texto, ctx) {
  const tramos = [];
  for (const [n, l] of texto.replace(/\r\n/g, '\n').split('\n').entries()) {
    const m = RE_ANCLA.exec(l);
    if (m) tramos.push({ linea: n + 1, fecha: m[1], a9: [], mut: [] });
    else if (tramos.length) {
      const a = RE_A9.exec(l);
      if (a) tramos.at(-1).a9.push(a[1].trim());
      const k = RE_MUT_CLAVE.exec(l);
      if (k) tramos.at(-1).mut.push({ linea: n + 1, clave: k[1], resto: k[2] });
    }
  }
  const fallos = [];
  const tipos = { comprobación: 0, aviso: 0, sin: 0, catálogo: 0, 'una vez': 0 };
  for (const t of tramos) {
    if (t.fecha < CORTE_MUTACIONES) continue;
    for (const { linea, clave, resto } of t.mut) {
      const donde = `${nombre}:${linea}`;
      const r = RE_MUT_RUTA.exec(resto);
      if (!r) { fallos.push(`${donde} · «Mutaciones: ${clave} →» sin ruta detrás de la flecha (A3, SCRUM-1731)`); continue; }
      const ruta = r[1] ?? r[2];
      tipos[clave]++;
      if (clave === 'catálogo') {
        const n = ctx.declara(ruta);
        if (n === null) fallos.push(`${donde} · el test del catálogo \`${ruta}\` no existe en el repo`);
        else if (n === 0) fallos.push(`${donde} · \`${ruta}\` no declara ninguna mutación completa en MUTACIONES_QUE_ME_TUMBAN: la del registro no se puede repetir`);
      } else if (!ctx.enGit(ruta)) fallos.push(`${donde} · el guion \`${ruta}\` no está en git: la mutación no se puede repetir`);
    }
  }
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

// SCRUM-1731 · Las mutaciones de la línea «Mutaciones:», REPETIBLES por el meta-guard (A3: «una mutación
// que afirmas se puede repetir, o no cuenta»). Van DEBAJO del código que mutan: este guard se muta a sí
// mismo, y el ancla de verdad tiene que ser la primera ocurrencia y empezar línea (meta-guard, SCRUM-812c).
// Sustituyen al guion propio que tuvo la rama (`docs/master/evidencias/SCRUM-1731/mutar.mjs`): un banco
// con lista propia queda fuera del catálogo y lo tumba SCRUM-1387.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // El test del catálogo que no existe deja de caer.
    fichero: 'tests/scrum1294-a9-leccion-en-a10.test.mjs',
    de: '        if (n === null) fallos.push(',
    a: '        if (false) fallos.push(',
    cae: 'control positivo: el revisor SABE fallar por cada una de sus reglas',
  },
  {
    // El test que existe pero no declara ninguna mutación deja de caer.
    fichero: 'tests/scrum1294-a9-leccion-en-a10.test.mjs',
    de: '        else if (n === 0) fallos.push(',
    a: '        else if (false) fallos.push(',
    cae: 'control positivo: el revisor SABE fallar por cada una de sus reglas',
  },
  {
    // El guion «una vez» que no está en git deja de caer.
    fichero: 'tests/scrum1294-a9-leccion-en-a10.test.mjs',
    de: '      } else if (!ctx.enGit(ruta)) fallos.push(',
    a: '      } else if (false) fallos.push(',
    cae: 'control positivo: el revisor SABE fallar por cada una de sus reglas',
  },
  {
    // La clave sin ruta detrás de la flecha pasa callada.
    fichero: 'tests/scrum1294-a9-leccion-en-a10.test.mjs',
    de: '      if (!r) { fallos.push(',
    a: '      if (!r) { continue; fallos.push(',
    cae: 'control positivo: el revisor SABE fallar por cada una de sus reglas',
  },
  {
    // El corte deja de respetarse: se exigiría hacia atrás.
    fichero: 'tests/scrum1294-a9-leccion-en-a10.test.mjs',
    de: '    if (t.fecha < CORTE_MUTACIONES) continue;',
    a: '    if (false) continue;',
    cae: 'control positivo: el revisor SABE fallar por cada una de sus reglas',
  },
  {
    // La ruta sin comillas invertidas (la forma literal de la norma firmada) deja de verse.
    fichero: 'tests/scrum1294-a9-leccion-en-a10.test.mjs',
    de: 'const RE_MUT_RUTA = /^ +(?:`([^`\\s]+)`|([^`\\s]+))/;',
    a: 'const RE_MUT_RUTA = /^ +(?:`([^`\\s]+)`)/;',
    cae: 'control positivo: el revisor SABE fallar por cada una de sus reglas',
  },
  {
    // La clave «una vez» deja de reconocerse como la línea (la trajo 34e6d8437, del @claude del CI).
    fichero: 'tests/scrum1294-a9-leccion-en-a10.test.mjs',
    de: 'const RE_MUT_CLAVE = /^\\s*(?:- )?(?:\\*\\*)?Mutaciones:(?:\\*\\*)? (catálogo|una vez) →(.*)$/;',
    a: 'const RE_MUT_CLAVE = /^\\s*(?:- )?(?:\\*\\*)?Mutaciones:(?:\\*\\*)? (catálogo) →(.*)$/;',
    cae: 'control positivo: el revisor SABE fallar por cada una de sus reglas',
  },
];

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
  assert.deepEqual([bien.fallos, bien.bajoNorma, bien.tipos], [[], 4, { comprobación: 1, aviso: 2, sin: 1, catálogo: 0, 'una vez': 0 }]);
  // SCRUM-1731 · la línea «Mutaciones:» — cada regla sabe fallar, y el corte se respeta.
  const ctxM = {
    ...ctx,
    declara: (r) => ({ 'tests/declara.test.mjs': 2, 'tests/no-declara.test.mjs': 0 })[r] ?? null,
    enGit: (r) => r === 'docs/master/evidencias/x/mutar.mjs',
  };
  const A9OK = 'A9: sin fallo que generalice — solo docs';
  const fallanM = (linea, fecha = '2026-11-18') => revisarRegistro('x.md', `${ancla(fecha)}\n${A9OK}\n${linea}\n`, ctxM).fallos;
  assert.equal(fallanM('Mutaciones: catálogo → `tests/no-existe.test.mjs`').length, 1, 'un test del catálogo que no existe tiene que fallar');
  assert.equal(fallanM('Mutaciones: catálogo → `tests/no-declara.test.mjs`').length, 1, 'un test sin MUTACIONES_QUE_ME_TUMBAN tiene que fallar');
  assert.equal(fallanM('- **Mutaciones:** una vez → `/tmp/mutar.mjs`').length, 1, 'un guion fuera de git tiene que fallar, también con viñeta y negrita');
  assert.equal(fallanM('Mutaciones: catálogo → ').length, 1, 'la clave sin ruta detrás tiene que fallar');
  assert.equal(fallanM('Mutaciones: catálogo → tests/no-existe.test.mjs').length, 1, 'sin comillas invertidas también se mira, y también falla');
  assert.equal(fallanM('Mutaciones: catálogo → tests/declara.test.mjs').length, 0, 'la forma literal de la norma firmada (sin comillas) es válida');
  assert.equal(fallanM('Mutaciones: catálogo → `tests/no-existe.test.mjs`', '2026-11-17').length, 0, 'antes de su corte no se exige (solo hacia adelante)');
  assert.equal(fallanM('Mutaciones: 6 de 6 caen').length, 0, 'una línea sin la clave no es «la línea»: no la ve el guard, la ve quien cierra');
  const bienM = revisarRegistro('x.md', [
    ancla('2026-11-18'), A9OK,
    'Mutaciones: catálogo → `tests/declara.test.mjs` (2 de 2 caen)',
    '- **Mutaciones:** una vez → `docs/master/evidencias/x/mutar.mjs`',
  ].join('\n'), ctxM);
  assert.deepEqual([bienM.fallos, bienM.tipos.catálogo, bienM.tipos['una vez']], [[], 1, 1]);
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
  // SCRUM-1731 · «está en git» se pregunta a git, una sola vez. Si git no contesta, el guard es CIEGO
  // para las líneas «una vez» y lo dice: no da por buena una ruta que no ha podido mirar.
  let enGit;
  try {
    const listados = new Set(execFileSync('git', ['ls-files', '-z'], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).split('\0'));
    assert.ok(listados.has('tests/scrum1294-a9-leccion-en-a10.test.mjs'), 'git ls-files no lista ni este mismo fichero');
    enGit = (r) => listados.has(r);
  } catch (e) {
    enGit = (r) => { throw new Error(`CIEGO: no pude preguntar a git si \`${r}\` está en el repo (${e.message})`); };
  }
  const declara = (r) => (existeEnRepo(r) ? mutacionesDeclaradas(fs.readFileSync(path.join(RAIZ, r), 'utf8'), r).length : null);
  const ctx = { a10: A10, cicatrices, existe: existeEnRepo, declara, enGit };
  const dir = path.join(RAIZ, 'docs', 'master');
  const ficheros = fs.readdirSync(dir).filter((f) => /^SCRUM-\d+.*\.md$/.test(f));
  const suma = { anclas: 0, bajoNorma: 0, comprobación: 0, aviso: 0, sin: 0, catálogo: 0, 'una vez': 0 };
  const fallos = [];
  for (const f of ficheros) {
    const r = revisarRegistro(`docs/master/${f}`, fs.readFileSync(path.join(dir, f), 'utf8'), ctx);
    suma.anclas += r.anclas;
    suma.bajoNorma += r.bajoNorma;
    for (const k of ['comprobación', 'aviso', 'sin', 'catálogo', 'una vez']) suma[k] += r.tipos[k];
    fallos.push(...r.fallos);
  }
  console.log(`scrum1294 · población: ${ficheros.length} registros · ${suma.anclas} anclas · ${suma.bajoNorma} desde ${CORTE} · A9: ${suma.comprobación} comprobación, ${suma.aviso} aviso, ${suma.sin} sin fallo · ${A10.length} frases en A10 · Mutaciones (desde ${CORTE_MUTACIONES}): ${suma.catálogo} catálogo, ${suma['una vez']} una vez`);
  // Suelo: si el parser del ancla se rompe, «0 anclas» se leería como «nada que exigir».
  assert.ok(ficheros.length >= 800, `solo ${ficheros.length} registros en docs/master`);
  assert.ok(suma.anclas >= 1000, `solo ${suma.anclas} anclas reconocidas: el formato de ancla cambió y el guard ya no mira`);
  assert.deepEqual(fallos, []);
});
