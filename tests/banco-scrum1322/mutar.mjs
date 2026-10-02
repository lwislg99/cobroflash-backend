// Mutaciones de SCRUM-1322. Cada una: se aplica (y se comprueba que SE APLICO), build entero,
// se corre el test, se apunta que casos caen, y se restaura. Al final: build limpio + arbol limpio.
//
// ⚠️ MUTA `src/` y reescribe `dist/` (un build ENTERO por mutacion: minutos). Se lanza a mano, con
// el arbol comiteado, y mientras corre no se mide nada mas en este arbol:
//   node tests/banco-scrum1322/mutar.mjs            (las 10)
//   node tests/banco-scrum1322/mutar.mjs M5,M8      (solo esas)
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const RAIZ = path.resolve(import.meta.dirname, '../..');
const MOD = path.join(RAIZ, 'src/modules/whatsappBot/domain/decisionPorTexto.ts');
const RUTA = path.join(RAIZ, 'src/modules/whatsappBot/app/routes/whatsappIncoming.routes.ts');
const TILDES = path.join(RAIZ, 'src/core/texto/sinTildes.ts');
const TEST = 'tests/scrum1322-el-bot-entiende-lo-que-pide.test.mjs';

const MUTACIONES = [
  { id: 'M1 sin el corte de la pregunta', f: MOD,
    de: "if (/[?¿]/.test(text)) return 'unknown';", a: '' },
  { id: 'M2 la coma ya no parte el tramo', f: MOD,
    de: '.split(/[,.;:!¡()\\n]+/)', a: '.split(/[;]+/)' },
  { id: 'M3 la palabra desconocida se salta (vuelve el «en cualquier parte»)', f: MOD,
    de: "if (!clase) return 'unknown';", a: 'if (!clase) { i += 1; continue; }' },
  { id: 'M4 una palabra mas en la cortesia', f: MOD,
    de: "  'hola': ", a: "  'pero': 'colada a proposito por la mutacion',\n  'hola': " },
  // SCRUM-1325: quitar las tildes ya no vive en el modulo, sino en el helper unico de la casa.
  { id: 'M5 sin quitar las tildes', f: TILDES,
    de: ".replace(/\\p{M}/gu, '')", a: '' },
  { id: 'M6 con las dos direcciones gana el rechazo, como antes', f: MOD,
    de: "if (acepta === rechaza) return 'unknown';", a: "if (rechaza) return 'reject'; if (!acepta) return 'unknown';" },
  { id: 'M7 gana la entrada mas CORTA', f: MOD,
    de: 'let largo = Math.min(PALABRAS_DE_LA_MAS_LARGA, palabras.length - i);\n      for (; largo >= 1; largo--) {',
    a: 'let largo = 1;\n      for (; largo <= Math.min(PALABRAS_DE_LA_MAS_LARGA, palabras.length - i); largo++) {' },
  { id: 'M8 la ruta deja de preguntar a parseDecision al decidir', f: RUTA,
    de: 'const decision = parseDecision(text);', a: "const decision = /acept/i.test(text) ? 'accept' : parseDecision(text);" },
  { id: 'M9 la puerta del bot deja pasar lo que no es decision', f: RUTA,
    de: "if (text && parseDecision(text) !== 'unknown' && !(await isMidIntake(phone))) {", a: 'if (text && !(await isMidIntake(phone))) {' },
  { id: 'M10 «acepto» fuera de la lista (el defecto del ticket)', f: MOD,
    de: "'acepto', 'aceptar',", a: "'aceptar'," },
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
  const veces = original.split(m.de).length - 1;
  if (veces !== 1) { filas.push(`${m.id}: CIEGO — el ancla aparece ${veces} veces, no se aplico`); continue; }
  try {
    fs.writeFileSync(m.f, original.replace(m.de, m.a));
    b = build();
    if (b.status !== 0) { filas.push(`${m.id}: NO COMPILA (${(b.stdout || '').split('\n')[0]})`); continue; }
    const r = leer(correr());
    filas.push(`${m.id}: ${r.caen.length ? 'CAE' : 'MUDA'} · ok=${r.ok} caen=${r.caen.length}` + r.caen.map((c) => `\n      - ${c}`).join(''));
  } finally {
    fs.writeFileSync(m.f, original);
  }
}
b = build();
const fin = leer(correr());
console.log(filas.join('\n'));
console.log(`\nFINAL: build=${b.status} ok=${fin.ok} caen=${fin.caen.length}`);
const st = spawnSync('git', ['status', '--porcelain'], { cwd: RAIZ, encoding: 'utf8' });
console.log('git status --porcelain: ' + JSON.stringify(st.stdout));
console.log(`POBLACION=${ELEGIDAS.length} mutaciones corridas de ${MUTACIONES.length}`);
