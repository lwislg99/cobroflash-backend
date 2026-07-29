// SCRUM-226 (guard estructural · sin gate: corre en `npm test`, no toca BD ni red).
//
// NADIE PARSEA UNA URL DE BASE DE DATOS A MANO.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// UN DEFECTO, TRES INCIDENTES — y la regla ya existía las tres veces:
//
//   · #14 — un script leyó `DATABASE_URL` sin quitarle las comillas del `.env`, `new URL()`
//     lanzó, y el volcado del error publicó la URL de PRODUCCIÓN con su contraseña.
//   · SCRUM-223 — el `sed` de `db-push-prod` extraía la URL CON las comillas, Prisma recibía
//     algo inválido, y el wrapper de la operación más peligrosa del repo moría en silencio.
//   · 29-jul — un `sed` de redacción escrito a mano dejó usuario y contraseña a la vista.
//
// `parseBDSegura` existía en las tres. Estaba en la skill. La sesión que filtró la credencial
// la había leído quince minutos antes. **Recordar no es un mecanismo**; esto sí.
//
// 🚨 LO QUE ESTE GUARD **NO** CUBRE, dicho aquí y no en el ticket, para que se lea donde se
// trabaja: el tercer incidente vivía en un comando escrito en el chat, **fuera del repo**.
// Ningún guard de ficheros lo habría parado y este tampoco pararía al siguiente. Esa
// superficie necesita un hook `PreToolUse` (estilo `guard-dangerous`) y NO está construida.
// SCRUM-226 se queda ABIERTO por eso: cerrarlo sería declarar tapado justo el camino por el
// que llegó la fuga que lo originó.
// ─────────────────────────────────────────────────────────────────────────────────────────
//
// DOS SUPERFICIES, DOS TÉCNICAS, y la segunda es la que faltaba:
//
//   1 · JS  — AST. `new URL(algo-que-huele-a-BD)`. El guard de SCRUM-195 ya cubre esto; aquí
//             se cubre igual porque 195 sigue sin mergear y el hueco es real en `main`.
//   2 · SHELL — el hueco que nadie tenía. El guard de 195 solo mira JavaScript, así que el
//             `sed` de `db-push-prod` le pasó por delante EN VERDE (medido, no supuesto). Y
//             es la superficie que más duele: en shell viven los wrappers, las semillas y los
//             runbooks, o sea el código con más privilegio del repo.
//
// ⚠️ LA TRAMPA DEL SHELL, que casi me come: un guard de texto se caza a sí mismo en el
// comentario que explica la prohibición, y por eso existe `leerFuente`. Pero `leerFuente`
// decide si `#` es comentario **por la EXTENSIÓN del fichero** (`almohadillaComenta`), y
// `scripts/db-push-prod` —el fichero más privilegiado que hay— **no tiene extensión**. Con
// `leerFuente` a secas, sus comentarios NO se filtran y el guard se autodenuncia. Aquí bash
// se detecta por el **shebang**, no por el nombre.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

import { soloEjecutable } from './_guard-texto.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..');
const ARBOLES = ['scripts', 'tests', 'src'];

const rel = (p) => path.relative(RAIZ, p).split(path.sep).join('/');

/** El único sitio autorizado a mirar una URL de BD por dentro. */
const CASA_DEL_PARSEO = 'scripts/_db-guard.mjs';
const FUNCIONES_SEGURAS = /parseBDSegura|describirBD|redactarSecretos|assertSafeStagingUrl/;

/**
 * EXCEPCIONES — justificadas línea a línea. Se van cuando entre SCRUM-195.
 *
 * `backup-dump.mjs` y `seed-video.mjs` hacen `new URL()` sobre la URL de BD. NO se arreglan
 * aquí a propósito: SCRUM-195 ya los arregla en su rama (`d75eb45`), y tocarlos también desde
 * aquí garantiza un conflicto en dos ficheros que nadie quiere resolver a mano. Al mergear
 * 195, estas dos líneas se borran y la lista queda VACÍA — que es como debe quedarse.
 */
const EXCEPCIONES = [
  'scripts/backup-dump.mjs',
  'scripts/seed-video.mjs',
];

// ── recorrido ─────────────────────────────────────────────────────────────────────────────

function ficheros(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === 'dist') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) ficheros(p, out);
    else out.push(p);
  }
  return out;
}

const TODOS = ARBOLES.flatMap((d) => ficheros(path.join(RAIZ, d)));

const esJs = (p) => /\.(ts|tsx|mjs|cjs|js)$/.test(p);

/** Bash por SHEBANG, no por extensión — `scripts/db-push-prod` no tiene extensión. */
function esShell(ruta) {
  if (/\.(sh|bash)$/.test(ruta)) return true;
  if (path.extname(ruta) !== '') return false;
  try {
    return /^#!.*\b(bash|sh)\b/.test(fs.readFileSync(ruta, 'utf8').split('\n', 1)[0] ?? '');
  } catch {
    return false;
  }
}

// ── superficie 1 · JS (AST) ───────────────────────────────────────────────────────────────

/** ¿La expresión huele a URL de base de datos? */
function pareceUrlDeBD(nodo, sf) {
  const txt = nodo.getText(sf);
  return /DATABASE_URL/.test(txt) || /\b(db|database)_?url\b/i.test(txt);
}

export function infraccionesJs(codigo, ruta) {
  const sf = ts.createSourceFile(ruta, codigo, ts.ScriptTarget.Latest, true,
    /\.ts$/.test(ruta) ? ts.ScriptKind.TS : ts.ScriptKind.JS);
  const out = [];
  const visitar = (n) => {
    if (ts.isNewExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'URL') {
      const arg = n.arguments?.[0];
      if (arg && pareceUrlDeBD(arg, sf)) {
        out.push({
          ruta,
          linea: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1,
          superficie: 'JS',
          texto: n.getText(sf).replace(/\s+/g, ' ').slice(0, 90),
        });
      }
    }
    ts.forEachChild(n, visitar);
  };
  ts.forEachChild(sf, visitar);
  return out;
}

// ── superficie 2 · SHELL (texto, sobre líneas EJECUTABLES) ────────────────────────────────

/** Herramientas de texto que, aplicadas a una URL de BD, son parseo a mano. */
const TROCEADORES = /\b(sed|awk|cut|grep|tr)\b/;

export function infraccionesShell(codigo, ruta) {
  // `#` SÍ es comentario aquí: lo decide el shebang, no la extensión (ver cabecera).
  const ejecutable = soloEjecutable(codigo, { almohadillaEsComentario: true });
  const out = [];
  ejecutable.split('\n').forEach((linea, i) => {
    if (!/DATABASE_URL|\.env\b/.test(linea)) return;
    if (!TROCEADORES.test(linea)) return;
    if (FUNCIONES_SEGURAS.test(linea)) return; // el camino bueno
    out.push({ ruta, linea: i + 1, superficie: 'SHELL', texto: linea.trim().slice(0, 90) });
  });
  return out;
}

function todasLasInfracciones() {
  const out = [];
  for (const p of TODOS) {
    const r = rel(p);
    if (r === CASA_DEL_PARSEO) continue; // es el sitio autorizado
    const codigo = fs.readFileSync(p, 'utf8');
    if (esJs(p)) out.push(...infraccionesJs(codigo, r));
    else if (esShell(p)) out.push(...infraccionesShell(codigo, r));
  }
  return out;
}

// ── el guard ──────────────────────────────────────────────────────────────────────────────

test('SCRUM-226 · nadie parsea una URL de BD a mano (JS y shell)', () => {
  const todas = todasLasInfracciones();

  // Guarda de presencia: si el escáner deja de ver ficheros, el assert pasaría en vacío.
  assert.ok(
    TODOS.filter((p) => esJs(p) || esShell(p)).length > 50,
    `🔴 ESCÁNER CIEGO: solo ${TODOS.length} ficheros bajo ${ARBOLES.join('/, ')}. Comprueba que ` +
      'los árboles siguen donde estaban antes de creerte el verde.',
  );
  // Y que la superficie SHELL no esté vacía: es la que nadie cubría, y la que se pierde en
  // silencio si `esShell` deja de reconocer los ficheros sin extensión.
  assert.ok(
    TODOS.some((p) => esShell(p)),
    '🔴 ESCÁNER CIEGO EN SHELL: ningún fichero detectado como bash. `scripts/db-push-prod` no ' +
      'tiene extensión y se reconoce por shebang — si eso se rompe, el hueco que este ticket ' +
      'vino a tapar vuelve a estar abierto y en VERDE.',
  );

  const vivas = todas.filter((x) => !EXCEPCIONES.includes(x.ruta));
  assert.deepEqual(
    vivas.map((x) => `${x.ruta}:${x.linea} [${x.superficie}]`),
    [],
    '🔴 PARSEO DE URL DE BD A MANO:\n' +
      vivas.map((x) => `    ${x.ruta}:${x.linea} [${x.superficie}]\n      ${x.texto}`).join('\n') +
      '\n\n  Una URL de BD lleva la contraseña dentro. `new URL()` no redacta: cuando la cadena\n' +
      '  viene con las comillas del `.env` lanza y la lleva ENTERA en el objeto de error, y el\n' +
      '  primer `console.error(e)` la publica. Ya pasó dos veces con producción.\n\n' +
      `  Usa \`parseBDSegura\` de ${CASA_DEL_PARSEO}: quita las comillas y NO tiene forma de\n` +
      '  devolver la cadena. Para imprimir un error ajeno, `redactarSecretos`.',
  );
});

// ── autoprueba: el guard tiene que poder ver a los tres casos reales ──────────────────────
//
// «Una capa de verificación solo detecta lo que es capaz de recibir.» El guard de SCRUM-195
// estaba bien escrito y aun así dejó pasar el `sed` del wrapper, porque solo leía JavaScript.
// Estos casos son los REALES, copiados de los incidentes.

test('SCRUM-226 (autoprueba) · caso #14: `new URL()` sobre la URL de BD', () => {
  assert.equal(infraccionesJs('const u = new URL(process.env.DATABASE_URL);', 'x.mjs').length, 1);
  assert.equal(infraccionesJs('let host = new URL(dbUrl).hostname;', 'x.mjs').length, 1);
});

test('SCRUM-226 (autoprueba) · caso SCRUM-223: el `sed` del wrapper, en shell', () => {
  const wrapperViejo = `#!/usr/bin/env bash
URL="$(grep -E '^DATABASE_URL=' .env | head -1 | sed -E 's|^DATABASE_URL=||')"`;
  const inf = infraccionesShell(wrapperViejo, 'scripts/db-push-prod');
  assert.equal(inf.length, 1, '🔴 el guard NO ve el caso que originó SCRUM-223');
  assert.match(inf[0].texto, /sed|grep/);
});

test('SCRUM-226 (autoprueba) · el camino BUENO no se marca', () => {
  assert.deepEqual(infraccionesJs('const p = parseBDSegura(process.env.DATABASE_URL);', 'x.mjs'), []);
  assert.deepEqual(
    infraccionesShell('#!/usr/bin/env bash\nHOST="$(node -e \'parseBDSegura(x)\' )"', 'scripts/w'),
    [],
  );
});

test('SCRUM-226 (autoprueba) · un COMENTARIO que explica la prohibición no dispara el guard', () => {
  // La trampa que mordió cuatro veces en este repo — y en shell, además, con el agravante de
  // que `leerFuente` no habría filtrado un fichero sin extensión.
  const conComentarios = `#!/usr/bin/env bash
# PROHIBIDO: no saques DATABASE_URL del .env con sed, usa parseBDSegura.
echo hola`;
  assert.deepEqual(infraccionesShell(conComentarios, 'scripts/db-push-prod'), []);
  assert.deepEqual(
    infraccionesJs('// nunca hagas new URL(process.env.DATABASE_URL) a pelo\nconst a = 1;', 'x.mjs'),
    [],
  );
});

test('SCRUM-226 (autoprueba) · bash se reconoce por SHEBANG, no por extensión', () => {
  // `scripts/db-push-prod` no tiene extensión: si esto se rompe, el hueco vuelve en verde.
  assert.equal(esShell(path.join(RAIZ, 'scripts', 'db-push-prod')), true);
});
