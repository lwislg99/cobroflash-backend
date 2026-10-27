// docs/master/evidencias/scrum1529c/aplicado.cjs — SCRUM-1529c
//
// ¿ESTÁN APLICADAS A LA PARTE L DEL MÁSTER LAS DIEZ DECISIONES DEL FUNDADOR (SCRUM-1529 c.19228 y
// c.19273), Y SÓLO ESO? Se contesta LEYENDO LAS LÍNEAS RESULTANTES, no mirando que exista un commit.
//
// Compara el máster del árbol con el de la BASE (el commit de `main` sobre el que se aplicó) y mira:
//   ① que el fichero tiene las mismas líneas y que sólo cambian las que las decisiones nombran;
//   ② un POSITIVO por decisión: el valor nuevo está en SU línea, entre comillas invertidas;
//   ③ un CERO por decisión: lo que NO tenía que entrar no está (`facturado` en la lista del parte,
//      una flecha en las listas que entran sin flechas, `VfSubmission` como máquina);
//   ④ que ninguna cita `YAQU_MASTER.md:<n>` del repositorio apunta ahora a otra cosa: el censo de
//      citas es el mismo y las líneas citadas que no son de las tocadas son idénticas byte a byte.
//
// EL CONTROL DEL INSTRUMENTO: las mismas preguntas sobre la BASE tienen que CAER todas las de ②.
// Si la base también pasa, el instrumento no distingue aplicado de sin aplicar: CIEGO, salida 2.
//
// QUÉ NO HACE: no mira `src/` (los valores del código los midieron `scrum1529/siete.cjs` y
// `scrum1529b/tres.cjs`), ni las transiciones, ni ninguna base de datos. Sólo lee; no escribe nada.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const RAIZ = path.resolve(__dirname, '..', '..', '..', '..');
const BASE = process.argv[2] || '3bf6163bb5708e174af74ea2266412eab2f586be';
const RUTA = 'docs/YAQU_MASTER.md';
const git = (...a) => execFileSync('git', ['-C', RAIZ, ...a], { encoding: 'utf8', maxBuffer: 1 << 28 });

// Las líneas que las decisiones nombran. La 397 estaba en blanco: se usa para las cuatro entidades
// que entran sin flechas, y así no se añade ninguna línea.
const TOCADAS = [397, 398, 399, 400, 401, 403];
const INTACTAS_VIGILADAS = [396, 402, 404, 405, 406, 407, 408, 409, 410, 411, 309];

// Los tramos entre comillas invertidas de una línea (los trozos impares de partirla por ellas).
const tramos = (l) => l.split('`').filter((_, i) => i % 2 === 1);
const tiene = (l, v) => tramos(l).includes(v);
// La lista que sigue a `**Nombre:** `: el primer tramo detrás del rótulo.
const listaDe = (l, rotulo) => { const i = l.indexOf(`**${rotulo}:** \``); if (i < 0) return null; const r = l.slice(i + rotulo.length + 7); return r.slice(0, r.indexOf('`')); };
const valores = (lista) => lista.split(/\||→/).map((t) => t.replace(/\([^)]*\)/g, '').trim()).filter(Boolean);

const DECISIONES = [
  { n: '①', linea: 401, que: 'QuoteRequest adopta pending → read → done', ok: (l) => listaDe(l, 'QuoteRequest') === 'pending → read → done',
    cero: (l) => ['new', 'seen', 'converted', 'discarded'].every((v) => !tramos(l).some((t) => valores(t).includes(v))) },
  { n: '②', linea: 397, que: 'ParteTrabajo.estado entra con borrador y firmado', ok: (l) => listaDe(l, 'ParteTrabajo.estado') === 'borrador | firmado',
    cero: (l) => { const x = listaDe(l, 'ParteTrabajo.estado'); return x !== null && !valores(x).includes('facturado') && !x.includes('→'); } },
  { n: '③', linea: 397, que: 'TeamMember.status entra con sus tres valores', ok: (l) => listaDe(l, 'TeamMember.status') === 'invited | active | suspended',
    cero: (l) => { const x = listaDe(l, 'TeamMember.status'); return x !== null && !x.includes('→'); } },
  { n: '④', linea: 398, que: 'Quote gana pending_approval', ok: (l) => tiene(l, 'pending_approval') && listaDe(l, 'Quote') === 'draft → sent → accepted | rejected',
    cero: (l) => !tramos(l).some((t) => t.includes('→') && t.includes('pending_approval')) },
  { n: '⑤', linea: 399, que: 'Invoice gana expired', ok: (l) => tiene(l, 'expired'),
    cero: (l) => !tramos(l).some((t) => t.includes('→') && t.includes('expired')) },
  { n: '⑥a', linea: 400, que: 'Charge gana failed y expired', ok: (l) => tiene(l, 'failed') && tiene(l, 'expired'),
    cero: (l) => !tramos(l).some((t) => t.includes('→') && (t.includes('failed') || t.includes('expired'))) },
  { n: '⑥b', linea: 400, que: 'Charge conserva cancelled', ok: (l) => tramos(l).includes('pending → cancelled'),
    cero: (l) => !/cancelled[^.]*se retira\b/.test(l.replace('no se retira', '')) },
  { n: '⑦', linea: 403, que: 'WhatsAppMessage gana received', ok: (l) => tiene(l, 'received'),
    cero: (l) => !tramos(l).some((t) => t.includes('→') && t.includes('received')) },
  { n: '⑧', linea: 397, que: 'Merchant.status entra con active', ok: (l) => listaDe(l, 'Merchant.status') === 'active',
    cero: (l) => { const x = listaDe(l, 'Merchant.status'); return x !== null && !x.includes('→') && !x.includes('|'); } },
  { n: '⑨', linea: 397, que: 'EmailMessage.status entra con sus seis valores',
    ok: (l) => listaDe(l, 'EmailMessage.status') === 'aceptado_sin_confirmacion | aceptado_sin_identificador | fallo_envio | entregado | rebotado | reclamado',
    cero: (l) => { const x = listaDe(l, 'EmailMessage.status'); return x !== null && !x.includes('→') && valores(x).length === 6; } },
];

function positivos(lineas) {
  return DECISIONES.map((d) => ({ n: d.n, linea: d.linea, que: d.que, ok: !!d.ok(lineas[d.linea - 1]), cero: !!d.cero(lineas[d.linea - 1]) }));
}

function citas() {
  const ficheros = git('ls-files', '-z').split('\0').filter(Boolean);
  const re = /YAQU_MASTER\.md:(\d+)(?:-(\d+))?/g;
  const out = [];
  let leidos = 0;
  for (const f of ficheros) {
    let t;
    try { t = fs.readFileSync(path.join(RAIZ, f), 'utf8'); } catch { continue; }
    leidos += 1;
    if (!t.includes('YAQU_MASTER.md:')) continue;
    for (const [i, l] of t.split('\n').entries()) for (const m of l.matchAll(re)) out.push({ f, en: i + 1, n: Number(m[1]), hasta: m[2] ? Number(m[2]) : Number(m[1]) });
  }
  return { ficheros: ficheros.length, leidos, citas: out };
}

function main() {
  const fallos = [];
  const di = (t) => { fallos.push(t); console.log(`  ✗ ${t}`); };
  const antes = git('show', `${BASE}:${RUTA}`).split('\n');
  const ahora = fs.readFileSync(path.join(RAIZ, RUTA), 'utf8').split('\n');
  console.log(`POBLACIÓN · máster de la base ${BASE.slice(0, 9)}: ${antes.length} líneas · máster del árbol: ${ahora.length} líneas · decisiones: ${DECISIONES.length} (diez, con la ⑥ en dos)`);

  console.log('\n① LAS LÍNEAS');
  if (antes.length !== ahora.length) di(`el fichero tenía ${antes.length} líneas y tiene ${ahora.length}: se ha movido la numeración`);
  const distintas = [];
  for (let i = 0; i < Math.max(antes.length, ahora.length); i += 1) if (antes[i] !== ahora[i]) distintas.push(i + 1);
  console.log(`  líneas que cambian: ${distintas.join(', ') || '(ninguna)'}`);
  if (distintas.join(',') !== TOCADAS.join(',')) di(`tenían que cambiar ${TOCADAS.join(', ')} y cambian ${distintas.join(', ') || 'ninguna'}`);
  for (const n of INTACTAS_VIGILADAS) if (antes[n - 1] !== ahora[n - 1]) di(`la línea ${n} no se podía tocar y ha cambiado`);
  console.log(`  vigiladas e idénticas: ${INTACTAS_VIGILADAS.filter((n) => antes[n - 1] === ahora[n - 1]).length} de ${INTACTAS_VIGILADAS.length} (la 404 es la de la cola de la AEAT; la 309, la tabla de la Parte J)`);
  // Lo que había no se borra: cada línea tocada conserva ENTERO su texto de antes, salvo la 401,
  // cuya lista cambia y queda citada entre « » con su fecha.
  for (const n of TOCADAS) {
    const a = antes[n - 1]; const d = ahora[n - 1];
    if (n === 401) { if (!d.includes('«new → seen → converted(quoteId) | discarded(reason)»')) di('la 401 no conserva, citado, lo que decía'); } else if (!d.startsWith(a)) di(`la línea ${n} no conserva al principio el texto que tenía`);
    if (!d.includes('13-oct-2026, SCRUM-1529c')) di(`la línea ${n} no dice cuándo cambió`);
  }

  console.log('\n② y ③ UN POSITIVO Y UN CERO POR DECISIÓN (árbol)');
  const p = positivos(ahora);
  for (const x of p) { console.log(`  ${x.ok && x.cero ? '✓' : '✗'} ${x.n} línea ${x.linea} · ${x.que} · positivo ${x.ok ? 'SÍ' : 'NO'} · cero ${x.cero ? 'SÍ' : 'NO'}`); if (!x.ok || !x.cero) fallos.push(`${x.n}: ${x.que}`); }
  const maquina = ahora.filter((l) => /^\*\*VfSubmission/.test(l) || /\*\*VfSubmission(\.status)?:\*\*/.test(l)).length;
  const enTramo = ahora.map((l, i) => [l, i + 1]).filter(([l, n]) => n >= 396 && n <= 412 && l.includes('VfSubmission')).map(([, n]) => n);
  console.log(`  ${maquina === 0 ? '✓' : '✗'} ⑩ VfSubmission NO entra: ${maquina} líneas la rotulan como máquina; «VfSubmission» sale en ${enTramo.length} línea(s) del tramo 396-412 (${enTramo.join(', ')}), que es la que ya lo decía y no se ha tocado`);
  if (enTramo.join(',') !== '404') fallos.push('⑩: el positivo de la 404 no aparece');
  if (maquina !== 0) fallos.push('⑩');
  const sembrado = 'zz1529c_valor_que_no_existe';
  console.log(`  cero derivado: «${sembrado}» sale en ${ahora.filter((l) => l.includes(sembrado)).length} líneas del máster`);

  console.log('\nEL CONTROL DEL INSTRUMENTO: las mismas preguntas sobre la BASE');
  const b = positivos(antes);
  const pasanEnBase = b.filter((x) => x.ok);
  console.log(`  positivos que la base cumple: ${pasanEnBase.length} de ${b.length}${pasanEnBase.length ? ` (${pasanEnBase.map((x) => x.n).join(', ')})` : ''} — tienen que ser 1: ⑥b, que es «se queda»`);
  const ciego = !(pasanEnBase.length === 1 && pasanEnBase[0].n === '⑥b');

  console.log('\n④ LAS CITAS `YAQU_MASTER.md:<n>`');
  const c = citas();
  const debajo = c.citas.filter((x) => x.hasta > 397);
  const aTocadas = c.citas.filter((x) => TOCADAS.some((n) => n >= x.n && n <= x.hasta));
  console.log(`  ficheros seguidos: ${c.ficheros} · leídos: ${c.leidos} · citas: ${c.citas.length} en ${new Set(c.citas.map((x) => x.f)).size} ficheros · por debajo de la 397: ${debajo.length} en ${new Set(debajo.map((x) => x.f)).size} ficheros`);
  if (c.citas.length === 0) di('el censo de citas salió vacío: no he mirado');
  let movidas = 0;
  for (const x of c.citas) for (let n = x.n; n <= x.hasta; n += 1) if (!TOCADAS.includes(n) && antes[n - 1] !== ahora[n - 1]) movidas += 1;
  console.log(`  citas que ahora apuntan a un texto distinto sin ser de una línea tocada: ${movidas}`);
  if (movidas > 0) di(`${movidas} citas apuntan a otra cosa`);
  console.log(`  citas a una línea tocada (su texto de antes sigue ahí; la 401 lo lleva citado): ${aTocadas.length}${aTocadas.length ? ` → ${aTocadas.map((x) => `${x.f}:${x.en} → ${x.n}`).join(' · ')}` : ''}`);

  if (ciego) { console.log('\nCIEGO: la base cumple lo que no debía; el instrumento no distingue aplicado de sin aplicar'); console.log('EXIT=2'); process.exit(2); }
  console.log(`\n${fallos.length === 0 ? 'APLICADAS las diez, y sólo eso' : `NO: ${fallos.length} fallo(s)`}`);
  console.log(`EXIT=${fallos.length === 0 ? 0 : 1}`);
  process.exit(fallos.length === 0 ? 0 : 1);
}

main();
