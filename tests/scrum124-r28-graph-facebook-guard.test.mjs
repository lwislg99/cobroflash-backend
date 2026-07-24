// SCRUM-124 (r28, recon "prohibiciones sin mecanismo" — SIN gate, corre en `npm test`
// normal): ninguna llamada a graph.facebook.com fuera de src/integrations/whatsapp.ts.
//
// Por qué importa: whatsapp.ts es donde viven TODOS los guards de un envío — los topes
// A3.2/J6 (diario por merchant y por cliente), el opt-out J3, el modo demo V0-2, el
// dry-run y el registro WA-0b. Un camino nuevo que hable con Meta directo se salta TODO
// eso a la vez. Y el coste de fallar ahí no es un bug con reintento: es el BAN del número
// de WhatsApp Business — YaQu es WhatsApp-first, así que eso es el producto muerto.
//
// Recorre TODO el repo, no solo src/: el riesgo no es "un módulo nuevo dentro de src/", es
// "cualquier fichero nuevo, en cualquier sitio, que decida hablar con Meta él solo" — un
// script, una herramienta manual, cualquier cosa.
//
// TRAMPA (SCRUM-125): este propio fichero necesita el literal 'graph.facebook.com' escrito
// tal cual para saber qué buscar. Si el barrido se incluyera a sí mismo, se detectaría y
// fallaría SIEMPRE — un guard que nunca puede estar en verde no es un guard, es ruido que
// se acaba ignorando. La solución NO es ocultar el string (partirlo, ofuscarlo): eso
// rompería que se pueda `grep` a mano igual que hace este test. La solución es excluirse a
// sí mismo por RUTA, con el mismo THIS_FILE que ya usa cada `walk()` para saber dónde vive.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const THIS_FILE = fileURLToPath(import.meta.url);
const repoRoot = path.join(path.dirname(THIS_FILE), '..');

// SCRUM-124: hallazgo del propio barrido, no una concesión silenciosa — ver el ticket para
// el razonamiento completo. scripts/wa-test.mjs es una herramienta MANUAL (un humano la
// invoca a mano, con sus propias credenciales, para probar una plantilla antes de que Meta
// la apruebe); no la importa nunca src/, no es un camino alcanzable por la app en marcha.
// Sigue siendo una vía real de saltarse los topes si alguien la scriptase en bucle — por
// eso se declara aquí, visible en el diff, no se enmascara. Pendiente de decisión del
// fundador: aceptarla así, endurecerla con su propio límite, o retirarla.
const ALLOWED = new Set([
  path.join(repoRoot, 'src', 'integrations', 'whatsapp.ts'),
  path.join(repoRoot, 'scripts', 'wa-test.mjs'),
]);

// Directorios que nunca hace falta recorrer: dependencias, build, control de versiones,
// artefactos de otras herramientas.
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'coverage', '.claude', 'storage', '.playwright-mcp']);

// Solo ficheros de código real — nada de arrastrar binarios, capturas de evidencias, etc.
const CODE_EXT = new Set(['.ts', '.js', '.mjs', '.cjs']);

const GRAPH_HOST = 'graph.facebook.com'; // literal, a propósito — ver TRAMPA arriba

function walk(dir, found) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(full, found);
      continue;
    }
    if (full === THIS_FILE) continue; // el propio guard: contiene el host a propósito
    if (ALLOWED.has(full)) continue;
    if (!CODE_EXT.has(path.extname(entry.name))) continue;
    const content = fs.readFileSync(full, 'utf8');
    if (content.includes(GRAPH_HOST)) found.push(full);
  }
  return found;
}

test('SCRUM-124 (r28): ninguna llamada a graph.facebook.com fuera de whatsapp.ts', () => {
  const found = walk(repoRoot, []);
  assert.equal(
    found.length,
    0,
    `🔴 BAN A LA VISTA: ${found.length} fichero(s) hablan con Meta sin pasar por whatsapp.ts ` +
      `(sin topes A3.2/J6, sin opt-out J3, sin dry-run, sin registro WA-0b): ` +
      `${found.map((f) => path.relative(repoRoot, f)).join(', ')}. ` +
      `Todo envío a WhatsApp pasa por src/integrations/whatsapp.ts — SIEMPRE. Si de verdad ` +
      `hace falta otra excepción, se declara arriba en ALLOWED con el motivo, no se apaga este test.`,
  );
});
