// scripts/verificar-evidencia-tanda.mjs — SCRUM-161
//
// ¿Hay evidencia de que la tanda gateada corrió contra ESTE árbol, hace poco y en verde?
//
//   node scripts/verificar-evidencia-tanda.mjs
//
// SALIDA: 0 = adelante · 1 = no hay evidencia válida **y el guard está encendido**.
//
// 🔴 HOY EL GUARD ESTÁ APAGADO (`ACTIVO = false`), así que esto SIEMPRE sale 0: imprime el
// veredicto y dice, en la misma pantalla, que no bloquea y por qué. Un mecanismo que declara lo
// que NO hace no engaña a nadie — el mismo principio que el «preflight OMITIDO» del runner.
// Para ensayarlo bloqueando de verdad, una sola ejecución: `YAQU_EVIDENCIA_TANDA=1`.
//
// DÓNDE SE ENGANCHA: en `/yaqu-release-check` (AA1.7), que es el momento en que una tarea se
// declara terminada. NO en `npm test`: exigir evidencia en cada ejecución bloquearía el bucle
// normal de desarrollo y el guard duraría una tarde.
//
// ⚠️ La LÓGICA sí vive bajo `npm test` — `tests/scrum161-evidencia-tanda.test.mjs` la ejercita
// entera sin BD ni disco. La distinción importa: lo que corre en el CI es el validador, no la
// exigencia. Comprobar que HUBO evidencia no necesita staging; solo generarla.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  RUTA_RECIBO,
  estaActivo,
  validarEvidencia,
  mensajeVeredicto,
  mensajeApagado,
  AVISO_ALCANCE,
} from './_evidencia-tanda.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const rutaRecibo = path.join(RAIZ, RUTA_RECIBO);

// Los TRES ficheros que el bloque QA del runner NO corre (van aislados, en su propio proceso).
// Copia a mano de la lista del runner (SCRUM-180 añadió scrum180; SCRUM-199 las unifica): si
// alguien añade un aislado allí sin tocar aquí, el conteo sale ALTO y el guard aprieta de más —
// falla hacia «vuelve a correr la tanda», que es el lado seguro (ruidoso, no silencioso).
const AISLADOS = ['a55-window-quote.test.mjs', 'bot-suite.test.mjs', 'scrum180-fixtures-nunca-a-meta.test.mjs'];
const ficherosEsperados = existsSync(path.join(RAIZ, 'tests'))
  ? readdirSync(path.join(RAIZ, 'tests')).filter((f) => f.endsWith('.test.mjs') && !AISLADOS.includes(f)).length
  : 0;

const commitActual = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: RAIZ, encoding: 'utf8' }).stdout?.trim() || '';
const texto = existsSync(rutaRecibo) ? readFileSync(rutaRecibo, 'utf8') : null;

const activo = estaActivo(process.env);
const res = validarEvidencia({ texto, commitActual, ahoraMs: Date.now(), ficherosEsperados });

process.stdout.write(mensajeVeredicto(res, { activo }));
process.stdout.write(AVISO_ALCANCE);
if (!activo) process.stdout.write(mensajeApagado());

// El `exit` va DESPUÉS de imprimirlo todo, y solo aprieta si el guard está encendido.
process.exit(activo && !res.ok ? 1 : 0);
