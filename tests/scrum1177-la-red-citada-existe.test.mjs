// tests/scrum1177-la-red-citada-existe.test.mjs — SCRUM-1177
//
// Un comentario que dice «esto se mide en scripts/guard-tal.mjs» es una promesa de red. Si ese
// fichero no existe, la promesa la lee un humano, se la cree, y nadie va a comprobar nunca lo que
// dice que se comprueba. Medido sobre 73e41ab0 (15-oct-2026): 3 citas así en `tests/` y
// `scripts/`, y ninguna de las tres había existido jamás (`git log --all` vacío). Dos venían en el
// ticket; la tercera (`scrum832`: «el atrás de verdad se mide en…») la encontró este censo.
//
// QUÉ MIRA: las líneas de COMENTARIO (empiezan por `//`, `*` o `/*`) de los `.mjs/.js/.cjs` de
// `tests/` y `scripts/` seguidos por git, y dentro de ellas, entre comillas de código:
//   · una ruta `tests/…` o `scripts/…` (.mjs/.js/.cjs/.ts/.json) → tiene que existir;
//   · un id de test (`scrum652d`) → tiene que haber un fichero en `tests/` o `scripts/` que empiece
//     por él;
//   · `npm run <x>` → `<x>` tiene que estar en los scripts de package.json.
//
// QUÉ NO MIRA, declarado: un comentario al final de una línea de código; una cita sin comillas de
// código; los `.md`. Y no dice si lo citado CORRE en el check obligatorio: eso es SCRUM-1178.
//
// Las citas que no existen A PROPÓSITO van en `DECLARADAS`, una a una y con su motivo: ejemplos de
// una API y ficheros retirados que se nombran como historia. Es un trinquete de DOS mitades: una
// cita nueva sin declarar cae, y una declarada que ya no aparece también (sobra, y mientras esté,
// esa cita podría volver sin que nadie lo viera).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const MARCADOR = 'ejemplo o marcador de sitio en la explicación de una API: no promete ninguna red';
const RETIRADO_773 = 'retirado en SCRUM-773 (PR #1484) y nombrado como historia, no como red';

/** `fichero citante` → `cita` → motivo. Una entrada por par, no por línea: las líneas se mueven. */
export const DECLARADAS = [
  ['scripts/_arbol-quieto.mjs', 'tests/x.mjs', MARCADOR],
  ['scripts/_censo-de-censos.mjs', 'X', MARCADOR],
  ['scripts/_censo-mkdtemp.mjs', 'tests/x.test.mjs', MARCADOR],
  ['scripts/puerta-claude-empuje.mjs', 'tests/x.test.mjs', MARCADOR],
  ['tests/scrum1339d-senal-de-nombres.test.mjs', 'tests/a.test.mjs', MARCADOR],
  ['tests/scrum711-guards-sin-sitio.test.mjs', 'scripts/X.mjs', MARCADOR],
  ['tests/scrum846c-trinquete-instrumentos-con-caso.test.mjs', 'tests/_censo-algo.mjs', MARCADOR],
  ['tests/scrum740-carrera-por-el-arbol.test.mjs', 'tests/__tmp-emite-sin-sellar.ts', 'temporal que crea y borra `scrum206b` mientras corre: existe sólo durante la tanda'],
  ['scripts/_puerta-de-entrada.mjs', 'scripts/backfill-job-assignees.mjs', RETIRADO_773],
  ['scripts/_suelo-contra-main.mjs', 'scripts/backfill-job-assignees.mjs', RETIRADO_773],
  ['scripts/_suelo-contra-main.mjs', 'tests/scrum650c-backfill-equivalencia.test.mjs', RETIRADO_773],
  ['scripts/censo-migraciones.mjs', 'scripts/backfill-job-assignees.mjs', RETIRADO_773],
  ['tests/scrum765-la-puerta-y-el-suelo.test.mjs', 'scripts/backfill-job-assignees.mjs', RETIRADO_773],
];

const RUTA = /`((?:scripts|tests)\/[\w./-]+\.(?:mjs|js|cjs|ts|json))`/g;
const IDTEST = /`(scrum\d+[a-z]*\d*)`/g;
const NPM = /npm run ([\w:.-]+)/g;
const esComentario = (l) => { const t = l.trim(); return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*'); };

/**
 * Las citas rotas de UN fichero. `existe(ruta)`, `hayId(id)` y `npm` vienen de fuera para poder
 * probar el detector con un árbol fabricado (control positivo y negativo, abajo).
 */
export function citasRotas(fichero, texto, { existe, hayId, npm }) {
  const out = [];
  texto.split(/\r?\n/).forEach((l, i) => {
    if (!esComentario(l)) return;
    for (const m of l.matchAll(RUTA)) if (!existe(m[1])) out.push({ fichero, linea: i + 1, cita: m[1] });
    for (const m of l.matchAll(IDTEST)) if (!hayId(m[1])) out.push({ fichero, linea: i + 1, cita: m[1] });
    for (const m of l.matchAll(NPM)) {
      const s = m[1].replace(/[.,;:)]+$/, '');
      if (!npm.has(s)) out.push({ fichero, linea: i + 1, cita: s });
    }
  });
  return out;
}

function medirArbol() {
  const seguidos = execFileSync('git', ['-C', RAIZ, 'ls-files', 'tests', 'scripts'], { encoding: 'utf8', maxBuffer: 1 << 26 })
    .split('\n').filter(Boolean);
  const poblacion = seguidos.filter((f) => /\.(mjs|js|cjs)$/.test(f));
  const nombres = [...fs.readdirSync(path.join(RAIZ, 'tests')), ...fs.readdirSync(path.join(RAIZ, 'scripts'))];
  const ctx = {
    existe: (r) => fs.existsSync(path.join(RAIZ, r)),
    hayId: (id) => nombres.some((n) => n.startsWith(id + '-') || n.startsWith(id + '.')),
    npm: new Set(Object.keys(JSON.parse(fs.readFileSync(path.join(RAIZ, 'package.json'), 'utf8')).scripts || {})),
  };
  let lineasDeComentario = 0;
  const rotas = [];
  for (const f of poblacion) {
    const texto = fs.readFileSync(path.join(RAIZ, f), 'utf8');
    lineasDeComentario += texto.split(/\r?\n/).filter(esComentario).length;
    rotas.push(...citasRotas(f, texto, ctx));
  }
  return { poblacion: poblacion.length, lineasDeComentario, rotas };
}

const clave = (fichero, cita) => `${fichero} → ${cita}`;

test('SCRUM-1177 · ✅ CONTROL del detector: caza una cita rota y deja pasar una buena y un código', () => {
  const ctx = { existe: (r) => r === 'tests/esta-si.test.mjs', hayId: (id) => id === 'scrum1', npm: new Set(['test']) };
  const texto = [
    '// se mide en `scripts/guard-que-no-existe.mjs`',
    ' * y en `tests/esta-si.test.mjs`, y en `scrum1` y en `scrum2`',
    "const x = '`scripts/en-codigo-no-cuenta.mjs`';",
    '// corre con npm run test y con npm run no-existe.',
  ].join('\n');
  const r = citasRotas('f.mjs', texto, ctx).map((h) => `${h.linea}:${h.cita}`);
  assert.deepEqual(r, ['1:scripts/guard-que-no-existe.mjs', '2:scrum2', '4:no-existe']);
});

test('SCRUM-1177 · 🔴 ninguna cita de un comentario apunta a una red que no existe (salvo las DECLARADAS)', () => {
  const { poblacion, lineasDeComentario, rotas } = medirArbol();
  // SUELO: un lector que no lee nada da «0 rotas» igual que un árbol limpio.
  assert.ok(poblacion > 1000, `🔴 CIEGO: sólo ${poblacion} ficheros en tests/ y scripts/.`);
  assert.ok(lineasDeComentario > 50000, `🔴 CIEGO: sólo ${lineasDeComentario} líneas de comentario leídas.`);
  const declaradas = new Set(DECLARADAS.map(([f, c]) => clave(f, c)));
  const nuevas = rotas.filter((h) => !declaradas.has(clave(h.fichero, h.cita)));
  assert.deepEqual(nuevas.map((h) => `${h.fichero}:${h.linea} → ${h.cita}`), [],
    '🔴 un comentario cita algo que NO EXISTE. Si es una red («esto se mide en…»), o se escribe esa '
    + 'red o el comentario dice que eso no lo mide nadie. Si es un ejemplo o un fichero retirado que '
    + 'se nombra como historia, va a DECLARADAS con su motivo.');
});

test('SCRUM-1177 · 🔴 y ninguna DECLARADA sobra: la que ya no aparece se borra de la lista', () => {
  const { rotas } = medirArbol();
  const vistas = new Set(rotas.map((h) => clave(h.fichero, h.cita)));
  const sobran = DECLARADAS.filter(([f, c]) => !vistas.has(clave(f, c))).map(([f, c]) => clave(f, c));
  assert.deepEqual(sobran, [],
    '🔴 estas excepciones ya no corresponden a ninguna cita: bórralas. Mientras estén, esa cita '
    + 'podría volver rota y este test no lo vería.');
  for (const [f, , motivo] of DECLARADAS) assert.ok(motivo && motivo.length > 20, `${f}: excepción sin motivo`);
});
