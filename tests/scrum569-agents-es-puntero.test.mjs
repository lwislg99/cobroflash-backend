// tests/scrum569-agents-es-puntero.test.mjs — SCRUM-569
//
// DOS FICHEROS DE ARRANQUE NO PUEDEN CONTRADECIRSE SI SÓLO UNO TIENE REGLAS.
//
// El 20-ago-2026 `AGENTS.md` mandaba ejecutar `npx prisma migrate diff` y `CLAUDE.md` lo
// PROHIBÍA, sobre una operación que toca el esquema. Una sesión que arrancara por `AGENTS.md`
// recibía instrucciones que la casa prohíbe y no tenía forma de saberlo: el árbitro del repo
// —gana el CÓDIGO— no resuelve un choque de ÓRDENES, porque el código no dice qué está permitido.
//
// ── POR QUÉ ESTE GUARD Y NO EL OBVIO ─────────────────────────────────────────────────────────
// El obvio sería comparar las dos constituciones y saltar cuando se contradigan. Se descartó con
// una medición propia: en SCRUM-566 un criterio léxico sobre documentos dio CUATRO FALSOS DE
// CINCO, y un rojo permanente es el que el segundo que lo ve desactiva (SCRUM-559).
//
// Así que no se vigila la contradicción: se hace IMPOSIBLE. `AGENTS.md` es un puntero a
// `CLAUDE.md` y no lleva reglas propias; lo que este fichero sujeta es esa forma, que se
// comprueba sin vocabulario y sin opinión. Es el camino que el máster ya fijó con el mismo
// espejo cuando `guard-dangerous` dejó de estar duplicado (SCRUM-176).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = (f) => fs.readFileSync(path.join(RAIZ, f), 'utf8').split('\r\n').join('\n');

/**
 * ÓRDENES EJECUTABLES de un documento: el vector exacto del defecto de hoy, que era una línea de
 * comando. Se detecta por FORMA —arranque de la línea y cercas ```bash—, no por vocabulario:
 * nombrar `.codex/hooks.json` en prosa no es mandar ejecutar nada.
 */
export function ordenesEjecutables(texto) {
  const ARRANQUE = /^(npm|npx|node|git|prisma|sh|bash|pnpm|yarn|docker|psql)\s/;
  const out = [];
  let dentroDeBash = false;
  texto.split('\n').forEach((linea, i) => {
    const t = linea.trim();
    if (/^```/.test(t)) { dentroDeBash = /^```(bash|sh|shell|console)/.test(t); return; }
    if (dentroDeBash && t) { out.push({ n: i + 1, linea: t, por: 'dentro de un bloque ```bash' }); return; }
    if (ARRANQUE.test(t)) out.push({ n: i + 1, linea: t, por: 'la línea ES un comando' });
  });
  return out;
}

/** Líneas de contenido (sin encabezados, cercas ni vacías). */
const contenido = (t) => t.split('\n').map((l) => l.trim())
  .filter((l) => l && !/^#{1,6}\s/.test(l) && !/^```/.test(l));

const AGENTS = leer('AGENTS.md');
const CLAUDE = leer('CLAUDE.md');

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ① SUELO · si el lector no ve nada, un cero significaría «todo bien» y sería mentira
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-569 · 🔴 SUELO: el lector VE los dos ficheros y sabría acusar un comando', () => {
  assert.ok(contenido(AGENTS).length >= 10,
    `🔴 CIEGO: sólo veo ${contenido(AGENTS).length} líneas en AGENTS.md. Un cero de comandos`
    + ' sobre un fichero que no se lee no es un verde: es no haber mirado.');
  assert.ok(contenido(CLAUDE).length >= 50, '🔴 CIEGO: CLAUDE.md apenas se lee.');

  // CALIBRACIÓN: el detector tiene que acusar el comando REAL que originó el ticket.
  const elDeVerdad = '```bash\nnpx prisma migrate diff --from-schema-datasource prisma/schema.prisma --script\n```';
  const visto = ordenesEjecutables(elDeVerdad);
  assert.equal(visto.length, 1,
    '🔴 el detector NO ve el comando que originó SCRUM-569. Todo lo que siga da igual.');
  assert.match(visto[0].linea, /npx prisma migrate diff/);

  // Y sabe decir que NO: la prosa que sólo NOMBRA un fichero no es una orden.
  assert.equal(ordenesEjecutables('- Tooling: `.codex/hooks.json` (PreToolUse) delega en el otro.').length, 0,
    '🔴 el detector acusa prosa que sólo nombra un fichero: daría rojos falsos el primer día.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ② 🔴 EL CONTROL QUE DECIDE · AGENTS.md no puede dar una orden que CLAUDE.md contradiga…
//    …porque no puede dar NINGUNA orden ejecutable. La contradicción no se vigila: no cabe.
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-569 · 🔴 AGENTS.md no lleva ni una orden ejecutable propia', () => {
  const ordenes = ordenesEjecutables(AGENTS);
  assert.deepEqual(ordenes.map((o) => `L${o.n}: ${o.linea}`), [],
    '🔴 AGENTS.md HA VUELTO A LLEVAR COMANDOS.\n\n'
    + ordenes.map((o) => `     · L${o.n} (${o.por}): ${o.linea}`).join('\n')
    + '\n\n    Así empezó SCRUM-569: `npx prisma migrate diff` aquí, PROHIBIDO en CLAUDE.md, sobre\n'
    + '    una operación que toca el esquema. Quien arrancaba por aquí no podía saberlo.\n\n'
    + '    SE ARREGLA MOVIENDO EL COMANDO A `CLAUDE.md` y dejando aquí, como mucho, la frase que\n'
    + '    remite a él. Un comando en dos sitios es un comando que un día dirá dos cosas.');
});

test('SCRUM-569 · 🔴 el cuerpo de CLAUDE.md no ha vuelto a copiarse aquí', () => {
  // RECUENTO EXACTO, no umbral con holgura: un umbral sólo caza la copia ENTERA y deja pasar la
  // que empieza por tres reglas (SCRUM-559). La copia se reconoce por líneas literales comunes.
  const enClaude = new Set(contenido(CLAUDE));
  const repetidas = contenido(AGENTS).filter((l) => enClaude.has(l));
  assert.deepEqual(repetidas, [],
    `🔴 ${repetidas.length} línea(s) de AGENTS.md están COPIADAS literalmente de CLAUDE.md:\n\n`
    + repetidas.map((l) => `     · ${l.slice(0, 100)}`).join('\n')
    + '\n\n    AGENTS.md nació así el 29-jun-2026 —copia entera— y no se tocó nunca más mientras\n'
    + '    CLAUDE.md recibía siete commits: acabó con cinco afirmaciones falsas.\n'
    + '    SE ARREGLA BORRÁNDOLAS DE AQUÍ. Lo que haya que decir, se dice en CLAUDE.md.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ③ ✅ CONTROL POSITIVO · lo que AGENTS.md afirma y ES correcto no se denuncia
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-569 · ✅ el puntero remite a CLAUDE.md, y lo que nombra existe', () => {
  assert.ok(AGENTS.includes('`CLAUDE.md`'),
    '🔴 el puntero no nombra su destino: entonces no es un puntero, es un fichero vacío.');

  // Sus afirmaciones sobre el repo se comprueban contra el disco, sin opinión. Y si son ciertas
  // —hoy lo son— NO se denuncian: es lo que separa este guard de uno que sólo sabe decir que no.
  const rutas = [...new Set([...AGENTS.matchAll(/`([^`\s]+)`/g)].map((m) => m[1]))]
    .filter((r) => /^(\.codex|\.claude|\.agents|docs|src|tests|scripts|public|prisma)\//.test(r));
  assert.ok(rutas.length >= 4,
    `🔴 CIEGO: sólo extraigo ${rutas.length} rutas de un fichero que nombra el tooling entero.`);
  const rotas = rutas.filter((r) => !fs.existsSync(path.join(RAIZ, r.replace(/\/$/, ''))));
  assert.deepEqual(rotas, [],
    `🔴 AGENTS.md nombra ${rotas.length} ruta(s) que no existen: ${rotas.join(', ')}.\n`
    + '    Es lo que ya le pasaba con `.Codex/skills/`, que nunca existió.');
});
