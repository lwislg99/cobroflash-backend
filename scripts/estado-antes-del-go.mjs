// scripts/estado-antes-del-go.mjs — SCRUM-568 · el disparador humano
//
// Imprime, en una línea, cuántas de las afirmaciones publicadas condicionadas a un flag (regla 24:
// tarjeta/Bizum/transferencia) son alcanzables HOY para un merchant nuevo. El mecanismo ya existe
// (`estadoCondicionadas()`, scripts/_afirmaciones-publicadas.mjs:403) y está verificado por
// tests/scrum568-promesa-con-mecanismo.test.mjs; esto es sólo la puerta para correrlo a mano, desde
// `docs/RUNBOOKS.md` § Antes del go, sin abrir un test.
//
// ⚠️ Es un REGISTRO, no una puerta: sale 0 siempre (regla 41 no aplica — no hay guard que relajar).
// Si algún día hace falta que bloquee algo, eso es un ticket nuevo, no un cambio silencioso aquí.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as censoF from './censo-anclas-bloque-f.mjs';
import { leerLanding, estadoCondicionadas } from './_afirmaciones-publicadas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = leerLanding(RAIZ);
const e = estadoCondicionadas(html, RAIZ, censoF);
process.stdout.write(e.linea + '\n');
process.stdout.write(`flags: ${e.flags.join(', ')}\n`);
