// Mutaciones de SCRUM-1325. Cada una: se aplica (y se comprueba que SE APLICO), se compila si toca
// `src/`, se corren los DOS tests del ticket, se apunta que casos caen en cada uno, y se restaura.
// Al final: build limpio + arbol limpio.
//
// ⚠️ MUTA `src/` y `tests/_censo-expresiones-de-texto.mjs`, y reescribe `dist/` (un build ENTERO por
// cada mutacion de `src/`: minutos). Se lanza a mano, con el arbol comiteado, y mientras corre no
// se mide nada mas en este arbol:
//   node tests/banco-scrum1325/mutar.mjs            (todas)
//   node tests/banco-scrum1325/mutar.mjs S1,G4      (solo esas)
//
// Dos familias:
//   S — el CODIGO deja de comparar sin tildes. Tiene que caer por EFECTO (el test del bot) o, donde
//       el efecto no existe (declarado en cada una), por el guard.
//   G — el GUARD se vuelve ciego. Tiene que caer el test del guard.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const RAIZ = path.resolve(import.meta.dirname, '../..');
const en = (rel) => path.join(RAIZ, rel);
const BOT = en('src/modules/whatsappBot/domain/botFlow.service.ts');
const MANT = en('src/modules/maintenance/domain/maintenance.service.ts');
const LAND = en('src/modules/system/app/routes/quoteDecisionLanding.routes.ts');
const TILDES = en('src/core/texto/sinTildes.ts');
const MOTOR = en('tests/_censo-expresiones-de-texto.mjs');
const EFECTO = 'tests/scrum1325-una-tilde-no-rompe-lo-que-entiende.test.mjs';
const GUARD = 'tests/scrum1325b-expresiones-sobre-texto-de-persona.test.mjs';

// `espera`: que test TIENE que caer. 'efecto' | 'guard' | 'los dos'. Si cae otra cosa, se dice.
const MUTACIONES = [
  { id: 'S1 «¿Lo envio?» vuelve a mirar el texto crudo', f: BOT, espera: 'los dos',
    de: "const t = sinTildes(text || '').trim();", a: "const t = (text || '').trim().toLowerCase();" },
  { id: 'S2 el saludo suelto vuelve a mirar el texto crudo', f: BOT, espera: 'los dos',
    de: "GREETING_ONLY_RE.test(sinTildes(text || '').trim())", a: "GREETING_ONLY_RE.test((text || '').trim())" },
  { id: 'S3 «cancelar» vuelve a mirar el texto crudo', f: BOT, espera: 'los dos',
    de: "CANCEL_RE.test(sinTildes(text || '').trim())", a: "CANCEL_RE.test((text || '').trim())" },
  { id: 'S4 el saludo que pide el menu vuelve a mirar el texto crudo', f: BOT, espera: 'los dos',
    de: '.test(sinTildes(text))) {', a: '.test(text)) {' },
  // REDUNDANTE, declarado en el registro: `isValidZone` da lo mismo con esta guarda que sin ella.
  { id: 'S5 la zona «no se» vuelve a mirar el texto crudo (SIN efecto posible: solo el guard)', f: BOT, espera: 'guard',
    de: "NO_ZONE_RE.test(sinTildes(text || '').trim())", a: "NO_ZONE_RE.test((text || '').trim())" },
  { id: 'S6 las semillas de mantenimiento vuelven a mirar el concepto crudo', f: MANT, espera: 'los dos',
    de: 'seed.match.test(sinTildes(concept))', a: 'seed.match.test(concept)' },
  { id: 'S7 «bano» sin anclar (casa dentro de «urbano»)', f: MANT, espera: 'los dos',
    de: '/reforma|obra|\\bbano|cocina/i', a: '/reforma|obra|bano|cocina/i' },
  // Sus cuatro patrones cortan la raiz antes de la tilde: normalizar no cambia ningun resultado.
  { id: 'S8 el icono de la linea vuelve a mirar el concepto crudo (SIN efecto posible: solo el guard)', f: LAND, espera: 'guard',
    de: "const c = sinTildes(String(concept || ''));", a: "const c = String(concept || '').toLowerCase();" },
  { id: 'S9 el helper deja de quitar las marcas', f: TILDES, espera: 'los dos',
    de: ".replace(/\\p{M}/gu, '')", a: '' },
  // El guard mira que se QUITEN las marcas, no la caja: esto solo se ve por efecto.
  { id: 'S10 el helper deja de pasar a minusculas', f: TILDES, espera: 'efecto',
    de: ".replace(/\\p{M}/gu, '').toLowerCase();", a: ".replace(/\\p{M}/gu, '');" },
  // Cambia el TEXTO de la expresion, asi que para el guard es otra y esta sin declarar.
  { id: 'S11 la confirmacion pierde el limite de palabra («silla» envia)', f: BOT, espera: 'los dos',
    de: '|adelante|dale|perfecto)\\b/.test(t);', a: '|adelante|dale|perfecto)/.test(t);' },

  { id: 'G1 el detector deja de ver las letras', f: MOTOR, espera: 'guard',
    de: "if (/\\p{L}/u.test(sinEscapes)) porque.push('letras');", a: '' },
  { id: 'G2 todo texto se da por normalizado', f: MOTOR, espera: 'guard',
    de: "  if (cadenaNormalizada(x, normalizadores)) return { ok: true };", a: '  return { ok: true };' },
  { id: 'G3 un parametro se da por normalizado (calla en vez de decir «no se»)', f: MOTOR, espera: 'guard',
    de: "    if (d.motivo) return { ok: false, sabe: false, porque: d.motivo };", a: '    if (d.motivo) return { ok: true };' },
  { id: 'G4 el normalizador se reconoce por el NOMBRE', f: MOTOR, espera: 'guard',
    de: '  if (ts.isIdentifier(x.expression)) return normalizadores.has(x.expression.text);',
    a: "  if (ts.isIdentifier(x.expression)) return normalizadores.has(x.expression.text) || /tildes|normaliz/i.test(x.expression.text);" },
  { id: 'G5 la expresion sin declarar pasa en silencio', f: MOTOR, espera: 'guard',
    de: "      hallazgos.push({ tipo: 'sin-declarar',", a: "      if (false) hallazgos.push({ tipo: 'sin-declarar'," },
  { id: 'G6 la que no se sabe donde se aplica pasa en silencio', f: MOTOR, espera: 'guard',
    de: "    if (a.noSe) {\n      hallazgos.push(", a: '    if (a.noSe) {\n      if (false) hallazgos.push(' },
  { id: 'G7 una entrada del catalogo que sobra pasa en silencio', f: MOTOR, espera: 'guard',
    de: '    if (d.vistas === d.veces) continue;', a: '    if (d.vistas <= d.veces) continue;' },
  { id: "G8 «.normalize('NFD')» a secas ya cuenta como sin tildes", f: MOTOR, espera: 'guard',
    de: "  if (metodo === 'replace' && esNormalizeNFD(receptor)) return true;", a: "  if (esNormalizeNFD(x) || (metodo === 'replace' && esNormalizeNFD(receptor))) return true;" },
  { id: 'G9 la tilde dentro del patron ya no se ve', f: MOTOR, espera: 'guard',
    de: '    if (e.rasgos.letraNoAscii) {', a: '    if (false) {' },
  { id: 'G10 un «RegExp(» que no se puede leer se da por inofensivo', f: MOTOR, espera: 'guard',
    de: "  if (patron === null) return { legible: false, sensible: true,", a: "  if (patron === null) return { legible: false, sensible: false," },
  { id: 'G11 la excepcion deja de contarse: cualquiera puede declararse «sin normalizar»', f: MOTOR, espera: 'guard',
    de: "export const CLASES = ['persona', 'maquina', 'persona-sin-normalizar'];", a: "export const CLASES = ['persona', 'maquina', 'persona-sin-normalizar', 'da-igual'];" },
];

const entorno = { ...process.env };
for (const k of ['FORCE_COLOR', 'NODE_OPTIONS', 'NODE_TEST_CONTEXT']) delete entorno[k];
const tsc = en('node_modules/typescript/bin/tsc');
const build = () => spawnSync(process.execPath, [tsc], { cwd: RAIZ, env: entorno, encoding: 'utf8' });
const correr = (test) => {
  const r = spawnSync(process.execPath, ['--test', '--test-force-exit', '--test-reporter=tap', test], { cwd: RAIZ, env: entorno, encoding: 'utf8' });
  const out = r.stdout || '';
  return { ok: (out.match(/^ok \d+ /gm) || []).length, caen: [...out.matchAll(/^not ok \d+ - (.*)$/gm)].map((m) => m[1]) };
};
const losDos = () => ({ efecto: correr(EFECTO), guard: correr(GUARD) });

// BASE sin mutar, primero.
let b = build();
if (b.status !== 0) { console.log('CIEGO: el build base falla\n' + b.stdout); process.exit(2); }
const base = losDos();
console.log(`BASE: efecto ok=${base.efecto.ok} caen=${base.efecto.caen.length} · guard ok=${base.guard.ok} caen=${base.guard.caen.length}`);
if (base.efecto.caen.length || base.guard.caen.length || !base.efecto.ok || !base.guard.ok) { console.log('CIEGO: la base no esta verde'); process.exit(2); }

const SOLO = (process.argv[2] || '').split(',').filter(Boolean);
const ELEGIDAS = MUTACIONES.filter((x) => !SOLO.length || SOLO.some((p) => x.id.startsWith(p + ' ')));
const filas = [];
let mudas = 0;
// Una mutacion de `src/` deja su build en `dist/` aunque el fuente se restaure. La siguiente de
// `src/` lo pisa con el suyo, pero una del MOTOR no compila: correria el test de efecto contra el
// `dist/` de la mutacion anterior y lo veria caer sin tener nada que ver.
let distMutado = false;
for (const m of ELEGIDAS) {
  const original = fs.readFileSync(m.f, 'utf8');
  const veces = original.split(m.de).length - 1;
  if (veces !== 1) { filas.push(`${m.id}: CIEGO — el ancla aparece ${veces} veces, no se aplico`); mudas++; continue; }
  try {
    fs.writeFileSync(m.f, original.replace(m.de, () => m.a));
    if (m.f !== MOTOR || distMutado) {
      if (m.f === MOTOR) fs.writeFileSync(m.f, original);
      b = build();
      distMutado = m.f !== MOTOR;
      if (m.f === MOTOR) fs.writeFileSync(m.f, original.replace(m.de, () => m.a));
      if (b.status !== 0) { filas.push(`${m.id}: NO COMPILA (${(b.stdout || '').split('\n')[0]})`); mudas++; continue; }
    }
    const r = losDos();
    const cayo = { efecto: r.efecto.caen.length > 0, guard: r.guard.caen.length > 0 };
    const cumple = m.espera === 'los dos' ? cayo.efecto && cayo.guard : cayo[m.espera];
    if (!cumple) mudas++;
    const deMas = m.espera !== 'los dos' && cayo[m.espera === 'efecto' ? 'guard' : 'efecto'];
    filas.push(`${m.id}: ${cumple ? 'CAE' : 'MUDA'} (se esperaba: ${m.espera}${deMas ? '; cae ademas el otro' : ''})`
      + ` · efecto ok=${r.efecto.ok} caen=${r.efecto.caen.length} · guard ok=${r.guard.ok} caen=${r.guard.caen.length}`
      + [...r.efecto.caen.map((c) => `\n      - efecto: ${c}`), ...r.guard.caen.map((c) => `\n      - guard: ${c}`)].join(''));
  } finally {
    fs.writeFileSync(m.f, original);
  }
}
b = build();
const fin = losDos();
console.log(filas.join('\n'));
console.log(`\nPOBLACION: ${ELEGIDAS.length} mutaciones de ${MUTACIONES.length} · mudas o ciegas: ${mudas}`);
console.log(`FINAL: build=${b.status} · efecto ok=${fin.efecto.ok} caen=${fin.efecto.caen.length} · guard ok=${fin.guard.ok} caen=${fin.guard.caen.length}`);
const st = spawnSync('git', ['status', '--porcelain'], { cwd: RAIZ, encoding: 'utf8' });
console.log(`ARBOL: ${st.stdout.trim() === '' ? 'limpio' : 'SUCIO\n' + st.stdout}`);
process.exit(mudas === 0 && b.status === 0 && fin.efecto.caen.length === 0 && fin.guard.caen.length === 0 && st.stdout.trim() === '' ? 0 : 1);
