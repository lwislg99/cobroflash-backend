// SCRUM-215 (guard estructural · sin gate: corre en `npm test`, no toca BD ni red).
//
// `opts.modoSinDestinatario` ES UNA COSTURA DE TEST, Y TIENE QUE SEGUIR SIÉNDOLO.
//
// El parámetro existe para poder demostrar que las DOS salidas del dictamen P11 se emiten y
// validan antes de que el dictamen exista. Es legítimo mientras **ningún llamador de
// producción lo pase**: entonces solo hay un comportamiento posible, el de la constante.
//
// LA DIFERENCIA CON EL PREFIJO DE SCRUM-209, que se retiró por lo contrario: aquel tenía DOS
// llamadores de producción pasando literales distintos, así que producción emitía de dos
// formas — un constructor con dos salidas. Este tiene UNO que no lo pasa nunca. La distinción
// no es de estilo: es «¿cuántos comportamientos puede tener producción?».
//
// PERO ESO HOY LO SOSTIENE UNA CONVENCIÓN, NO UN MECANISMO. Nada impide que mañana alguien
// pase el modo desde una ruta «para probar una cosa» y la costura de test se convierta en
// configuración viva, sin dictamen y sin que nadie se entere. Este guard es el mecanismo.
//
// Mira el AST, no el texto: `modoSinDestinatario` aparece por fuerza en la DECLARACIÓN del
// parámetro y en los comentarios que lo explican — un guard de texto se cazaría a sí mismo,
// la trampa que mordió cuatro veces en este repo (SCRUM-176/168/3/193).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(AQUI, '..', 'src');

const EMISOR = 'buildVerifactuRegistrosXml';
/** Argumentos que producción SÍ puede pasar: `params` y, como mucho, el cliente de Prisma. */
const ARGUMENTOS_PERMITIDOS = 2;

function fuentesTs(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) fuentesTs(p, out);
    else if (e.name.endsWith('.ts')) out.push(p);
  }
  return out;
}

const rel = (p) => path.relative(path.join(AQUI, '..'), p).split(path.sep).join('/');

/** Todas las LLAMADAS a `buildVerifactuRegistrosXml` en `src/` (no la declaración, no los comentarios). */
function llamadasEnProduccion() {
  const out = [];
  for (const ruta of fuentesTs(SRC)) {
    const sf = ts.createSourceFile(ruta, fs.readFileSync(ruta, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const visitar = (n) => {
      if (ts.isCallExpression(n)) {
        const c = n.expression;
        const nombre = ts.isPropertyAccessExpression(c) ? c.name.text : (ts.isIdentifier(c) ? c.text : null);
        if (nombre === EMISOR) {
          out.push({
            donde: `${rel(ruta)}:${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1}`,
            argumentos: n.arguments.length,
            texto: n.getText(sf).replace(/\s+/g, ' ').slice(0, 120),
          });
        }
      }
      ts.forEachChild(n, visitar);
    };
    ts.forEachChild(sf, visitar);
  }
  return out;
}

test('SCRUM-215 · ningún llamador de PRODUCCIÓN pasa el modo sin destinatario', () => {
  const llamadas = llamadasEnProduccion();

  // Guarda de presencia: si el escáner deja de encontrar llamadas, el assert de abajo pasaría
  // en vacío. Cero llamadas no es «nadie lo pasa», es «no he mirado».
  assert.ok(
    llamadas.length > 0,
    `🔴 ESCÁNER CIEGO: ninguna llamada a ${EMISOR}() en src/. Antes de creerte el verde, ` +
      'comprueba que la exportación sigue llamando al emisor — si cambió de nombre, este ' +
      'guard dejó de vigilar nada.',
  );

  const infractores = llamadas.filter(
    (l) => l.argumentos > ARGUMENTOS_PERMITIDOS || /modoSinDestinatario/.test(l.texto),
  );

  assert.deepEqual(
    infractores.map((l) => `${l.donde} (${l.argumentos} args)`),
    [],
    '🔴 UN LLAMADOR DE PRODUCCIÓN PASA `modoSinDestinatario`.\n\n' +
      infractores.map((l) => `    ${l.donde}\n      ${l.texto}`).join('\n') +
      '\n\n  Ese parámetro es una COSTURA DE TEST: existe para demostrar que las dos salidas\n' +
      '  del dictamen P11 validan, no para configurar nada. En cuanto producción lo pasa,\n' +
      '  deja de haber un solo comportamiento posible y la elección fiscal se toma en una\n' +
      '  ruta en vez de en el dictamen — que es exactamente lo que SCRUM-215 evita.\n\n' +
      '  Si de verdad hace falta elegir el modo, se cambia `MODO_SIN_DESTINATARIO` (una\n' +
      '  línea, con el dictamen delante). Si hace falta POR MERCHANT, eso es un flag de la\n' +
      '  Parte P: cambio de máster, no un argumento.',
  );
});
