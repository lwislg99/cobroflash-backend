// Mutaciones de SCRUM-1326. Cada una: se aplica (y se comprueba que SE APLICO), build entero, se
// corre el test, se apunta que casos caen, y se restaura. Al final: build limpio + arbol limpio.
// Mismo motor que tests/banco-scrum1322/mutar.mjs.
//
// ⚠️ MUTA `src/` y reescribe `dist/` (un build ENTERO por mutacion: minutos). Se lanza a mano, con
// el arbol comiteado, y mientras corre no se mide nada mas en este arbol:
//   node docs/master/evidencias/scrum1326/mutar.mjs            (todas)
//   node docs/master/evidencias/scrum1326/mutar.mjs M2,M5      (solo esas)
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const RAIZ = path.resolve(import.meta.dirname, '../../../..');
const MOD = path.join(RAIZ, 'src/modules/whatsappBot/domain/decisionPorTexto.ts');
const RUTA = path.join(RAIZ, 'src/modules/whatsappBot/app/routes/whatsappIncoming.routes.ts');
const TEST = 'tests/scrum1326-vale-pregunta-una-vez.test.mjs';
const SALIDA = path.join(import.meta.dirname, 'mutaciones.json');

const MUTACIONES = [
  { id: 'M1 «vale» vuelve a aceptar (el defecto del ticket)', f: MOD,
    de: "const PREGUNTA: readonly string[] = ['vale', 'ok',", a: "const PREGUNTA: readonly string[] = ['ok'," ,
    ademas: { de: "'me interesa', 'quiero', 'lo quiero', 'sale',", a: "'me interesa', 'quiero', 'lo quiero', 'sale', 'vale'," } },
  { id: 'M2 todo pregunta: «Acepto» tambien pasa por la pregunta', f: MOD,
    de: "return acepta ? 'accept' : 'ask';", a: "return 'ask';" },
  { id: 'M3 una de las ocho al lado de una clara mete la pregunta («si, vale»)', f: MOD,
    de: "return acepta ? 'accept' : 'ask';", a: "return pregunta ? 'ask' : 'accept';" },
  { id: 'M4 una de las ocho con un rechazo: gana el rechazo', f: MOD,
    de: "if ((acepta || pregunta) === rechaza) return 'unknown';", a: "if (acepta === rechaza && !pregunta) return 'unknown';" },
  { id: 'M5 la ruta trata la pregunta como aceptacion', f: RUTA,
    de: "if (decision === 'ask') {", a: "if (decision === 'ask' && false) {",
    ademas: { de: "if (decision === 'accept') {", a: "if (decision === 'accept' || decision === 'ask') {" } },
  { id: 'M6 la pregunta deja una marca en el presupuesto (un estado intermedio)', f: RUTA,
    de: "  if (decision === 'ask') {\n    await sendWhatsAppText({",
    a: "  if (decision === 'ask') {\n    await prisma.quote.update({ where: { id: quote.id }, data: { decisionChannel: 'pendiente_de_confirmar' } });\n    await sendWhatsAppText({" },
  { id: 'M7 la pregunta apunta que pregunto en OTRA tabla', f: RUTA,
    de: "  if (decision === 'ask') {\n    await sendWhatsAppText({",
    a: "  if (decision === 'ask') {\n    await (prisma as any).botSession.upsert({ where: { phone }, create: { phone }, update: {} });\n    await sendWhatsAppText({" },
  { id: 'M8 una palabra distinta en el texto firmado', f: RUTA,
    de: 'y avisamos a tu profesional, o *No*', a: 'y avisaremos a tu profesional, o *No*' },
  { id: 'M9 sin el arranque «Entendido»', f: RUTA,
    de: 'text: `Entendido 🙌 Para que no haya dudas', a: 'text: `Para que no haya dudas' },
  { id: 'M10 las negritas de WhatsApp se pierden', f: RUTA,
    de: 'escribe *Acepto* y avisamos', a: 'escribe Acepto y avisamos' },
  { id: 'M11 otro numero: el id aunque haya quoteNumber', f: RUTA,
    de: 'dudas sobre el presupuesto #${(quote as any).quoteNumber ?? quote.id}:', a: 'dudas sobre el presupuesto #${quote.id}:' },
  { id: 'M12 la pregunta avisa TAMBIEN al profesional', f: RUTA,
    de: "  if (decision === 'ask') {\n    await sendWhatsAppText({",
    a: "  if (decision === 'ask') {\n    await sendWhatsAppText({ merchantId: quote.merchantId, to: '34600111222', text: 'tu cliente ha dicho vale' });\n    await sendWhatsAppText({" },
  { id: 'M13 la pregunta deja de declararse respuesta a un entrante', f: RUTA,
    de: "exentoDelDemo: 'respuesta-a-entrante', exentoDeLaBaja: 'respuesta-a-entrante', // responde a quien acaba de escribir", a: '' },
  { id: 'M14 con el bot encendido, la pregunta se la queda el menu del bot', f: RUTA,
    de: "if (text && parseDecision(text) !== 'unknown' && !(await isMidIntake(phone))) {",
    a: "if (text && !['unknown', 'ask'].includes(parseDecision(text)) && !(await isMidIntake(phone))) {" },
  { id: 'M15 a mitad de captacion, «vale» decide sobre el presupuesto viejo', f: RUTA,
    de: "if (text && parseDecision(text) !== 'unknown' && !(await isMidIntake(phone))) {",
    a: "if (text && parseDecision(text) !== 'unknown') {" },
  { id: 'M16 una novena palabra que pregunta: «sale», la que el fundador decidio que acepta', f: MOD,
    de: "const PREGUNTA: readonly string[] = ['vale',", a: "const PREGUNTA: readonly string[] = ['sale', 'vale',",
    ademas: { de: "'lo quiero', 'sale',", a: "'lo quiero'," } },
  { id: 'M18 «va» vuelve a aceptar', f: MOD,
    de: "'listo', 'claro', 'va'];", a: "'listo', 'claro'];",
    ademas: { de: "'lo quiero', 'sale',", a: "'lo quiero', 'va', 'sale'," } },
  { id: 'M19 «okay» vuelve a aceptar y «ok» sigue preguntando', f: MOD,
    de: "['vale', 'ok', 'okay', 'okey',", a: "['vale', 'ok', 'okey',",
    ademas: { de: "'lo quiero', 'sale',", a: "'lo quiero', 'okay', 'sale'," } },
  { id: 'M20 una flexion deja de aceptar («lo confirmo» pregunta)', f: MOD,
    de: "const PREGUNTA: readonly string[] = ['vale',", a: "const PREGUNTA: readonly string[] = ['lo confirmo', 'vale',",
    ademas: { de: "'confirmamos', 'lo confirmo',", a: "'confirmamos'," } },
  { id: 'M17 sin quitar las tildes', f: MOD,
    de: ".replace(/\\p{M}/gu, '')", a: '' },
];

const entorno = { ...process.env };
for (const k of ['FORCE_COLOR', 'NODE_OPTIONS', 'NODE_TEST_CONTEXT']) delete entorno[k];
const tsc = path.join(RAIZ, 'node_modules/typescript/bin/tsc');
const build = () => spawnSync(process.execPath, [tsc], { cwd: RAIZ, env: entorno, encoding: 'utf8' });
const correr = () => spawnSync(process.execPath, ['--test', '--test-force-exit', '--test-reporter=tap', TEST], { cwd: RAIZ, env: entorno, encoding: 'utf8' });
const leer = (r) => {
  const out = r.stdout || '';
  const ok = (out.match(/^ok \d+ /gm) || []).length;
  const caen = [...out.matchAll(/^not ok \d+ - (.*)$/gm)].map((m) => m[1]);
  return { ok, caen };
};

/** Aplica UN reemplazo y dice si el ancla estaba exactamente una vez. */
function aplicar(texto, { de, a }) {
  const veces = texto.split(de).length - 1;
  return veces === 1 ? texto.replace(de, () => a) : null;
}

// BASE sin mutar, primero.
let b = build(); if (b.status !== 0) { console.log('CIEGO: el build base falla\n' + b.stdout); process.exit(2); }
const base = leer(correr());
console.log(`BASE: ok=${base.ok} caen=${base.caen.length}`);
if (base.caen.length !== 0 || base.ok === 0) { console.log('CIEGO: la base no esta verde'); process.exit(2); }

const SOLO = (process.argv[2] || '').split(',').filter(Boolean);
const ELEGIDAS = MUTACIONES.filter((x) => !SOLO.length || SOLO.some((p) => x.id.startsWith(p + ' ')));
const filas = [];
for (const m of ELEGIDAS) {
  const original = fs.readFileSync(m.f, 'utf8');
  let mutado = aplicar(original, m);
  if (mutado !== null && m.ademas) mutado = aplicar(mutado, m.ademas);
  if (mutado === null) { filas.push({ id: m.id, veredicto: 'CIEGO', porque: 'un ancla no aparece exactamente una vez: no se aplico' }); continue; }
  try {
    fs.writeFileSync(m.f, mutado);
    b = build();
    if (b.status !== 0) { filas.push({ id: m.id, veredicto: 'NO COMPILA', porque: (b.stdout || '').split('\n')[0] }); continue; }
    const r = leer(correr());
    if (r.ok + r.caen.length === 0) { filas.push({ id: m.id, veredicto: 'CIEGO', porque: 'el test no produjo ni un resultado' }); continue; }
    filas.push({ id: m.id, veredicto: r.caen.length ? 'CAE' : 'MUDA', ok: r.ok, caen: r.caen });
  } finally {
    fs.writeFileSync(m.f, original);
  }
}
b = build();
const fin = leer(correr());
const st = spawnSync('git', ['status', '--porcelain', '--', 'src'], { cwd: RAIZ, encoding: 'utf8' });
const informe = {
  poblacion: `${ELEGIDAS.length} mutaciones corridas de ${MUTACIONES.length}`,
  base: { ok: base.ok, caen: base.caen.length },
  filas,
  final: { build: b.status, ok: fin.ok, caen: fin.caen.length, srcSucio: st.stdout },
};
if (!SOLO.length) fs.writeFileSync(SALIDA, JSON.stringify(informe, null, 2) + '\n');
for (const f of filas) console.log(`${f.id}: ${f.veredicto}` + (f.caen ? ` · ok=${f.ok} caen=${f.caen.length}` + f.caen.map((c) => `\n      - ${c}`).join('') : ` — ${f.porque}`));
console.log(`\nFINAL: build=${b.status} ok=${fin.ok} caen=${fin.caen.length} · src sucio: ${JSON.stringify(st.stdout)}`);
console.log(`POBLACION=${informe.poblacion}`);
