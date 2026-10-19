// GUARD · SCRUM-1543 · EL BOT GUARDA `handoff` ANTES DE ENVIAR NADA.
//
// El handoff enviaba «le he avisado» al cliente y guardaba la sesión DESPUÉS. La respuesta del
// cliente podía entrar antes del UPDATE y procesarse en `menu` en vez de en silencio. A8.4 lo vio
// caer 4 veces en 65 logs de CI (`'menu' !== 'handoff'`). El arreglo fue cambiar el orden.
//
// Por qué hace falta este guard y no basta A8.4: A8.4 ahora ESPERA a que la sesión esté en
// `handoff` (es su red, y está bien). Eso lo vuelve ciego al orden: si alguien baja otra vez el
// `setSession` debajo de los envíos, A8.4 sigue verde. Este guard mira el orden.
//
// ⚠️ AST, no `grep`: se busca la LLAMADA, no el texto (un comentario que la nombre no cuenta).
// Regla: en el bloque donde está cada `setSession(…, { state: 'handoff' … })`, ningún envío
// (`send*` o `notifyMerchantAlert`) va antes que ella, y ella va con `await`.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const FICHERO = path.join(AQUI, '..', 'src', 'modules', 'whatsappBot', 'domain', 'botFlow.service.ts');

const esEnvio = (nombre) => /^send[A-Z]/.test(nombre) || nombre === 'notifyMerchantAlert';

function nombreLlamado(call) {
  const e = call.expression;
  if (ts.isIdentifier(e)) return e.text;
  if (ts.isPropertyAccessExpression(e)) return e.name.text;
  return '';
}

function esGuardadoDeHandoff(call) {
  if (nombreLlamado(call) !== 'setSession') return false;
  const patch = call.arguments[1];
  if (!patch || !ts.isObjectLiteralExpression(patch)) return false;
  return patch.properties.some((p) => ts.isPropertyAssignment(p) && p.name.getText() === 'state'
    && ts.isStringLiteralLike(p.initializer) && p.initializer.text === 'handoff');
}

function enviosDentro(nodo) {
  const hallados = [];
  const visitar = (n) => {
    if (ts.isCallExpression(n) && esEnvio(nombreLlamado(n))) hallados.push(nombreLlamado(n));
    ts.forEachChild(n, visitar);
  };
  visitar(nodo);
  return hallados;
}

/** Devuelve { guardados, fallos } sobre un texto TypeScript. */
function revisarOrden(texto, nombre = 'fuente') {
  const sf = ts.createSourceFile(nombre, texto, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const guardados = [];
  const fallos = [];
  const visitar = (n) => {
    if (ts.isCallExpression(n) && esGuardadoDeHandoff(n)) guardados.push(n);
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  for (const call of guardados) {
    const linea = sf.getLineAndCharacterOfPosition(call.getStart()).line + 1;
    if (!ts.isAwaitExpression(call.parent)) fallos.push(`${nombre}:${linea} · el guardado de handoff va sin await`);
    // Sube hasta la sentencia que cuelga directamente de un bloque.
    let sentencia = call;
    while (sentencia.parent && !ts.isBlock(sentencia.parent) && !ts.isSourceFile(sentencia.parent)) sentencia = sentencia.parent;
    const bloque = sentencia.parent;
    const previas = bloque.statements.slice(0, bloque.statements.indexOf(sentencia));
    const envios = previas.flatMap(enviosDentro);
    if (envios.length) fallos.push(`${nombre}:${linea} · el guardado de handoff va DESPUÉS de: ${envios.join(', ')}`);
  }
  return { guardados: guardados.length, fallos };
}

test('SCRUM-1543 · control sembrado: el guard caza el orden viejo y el await que falta, y deja pasar el bueno', () => {
  const viejo = `async function f(){ if (x) { notifyMerchantAlert({}).catch(()=>{}); await sendWhatsAppText({}); await setSession(p, { state: 'handoff' }, s); return true; } }`;
  const sinAwait = `async function f(){ if (x) { setSession(p, { state: 'handoff' }, s); await sendWhatsAppText({}); } }`;
  const bueno = `async function f(){ if (x) { await setSession(p, { state: 'handoff' }, s); notifyMerchantAlert({}); await sendWhatsAppText({}); } }`;
  const otroEstado = `async function f(){ if (x) { await sendWhatsAppText({}); await setSession(p, { state: 'menu' }, s); } }`;
  const r1 = revisarOrden(viejo);
  assert.equal(r1.guardados, 1);
  assert.equal(r1.fallos.length, 1, 'el orden viejo tiene que fallar');
  assert.match(r1.fallos[0], /notifyMerchantAlert, sendWhatsAppText/);
  assert.equal(revisarOrden(sinAwait).fallos.length, 1, 'sin await tiene que fallar');
  assert.deepEqual(revisarOrden(bueno), { guardados: 1, fallos: [] }, 'el orden bueno pasa');
  assert.deepEqual(revisarOrden(otroEstado), { guardados: 0, fallos: [] }, 'un guardado de otro estado no cuenta');
});

test('SCRUM-1543 · botFlow.service.ts guarda handoff antes de cualquier envío, en todos sus handoffs', () => {
  const { guardados, fallos } = revisarOrden(fs.readFileSync(FICHERO, 'utf8'), 'botFlow.service.ts');
  // Población: si el guard no encuentra ningún guardado de handoff, no ha mirado nada (renombrado,
  // fichero movido…): eso es rojo, no verde.
  assert.ok(guardados > 0, 'no encuentro ningún setSession(…, { state: \'handoff\' }) en botFlow.service.ts: el guard está ciego');
  console.log(`# SCRUM-1543 · guardados de handoff mirados: ${guardados}`);
  assert.deepEqual(fallos, [], fallos.join('\n'));
});
