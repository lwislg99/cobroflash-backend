// SCRUM-215 (guard estructural · sin gate: corre en `npm test`, no toca BD ni red).
//
// `opts.modoSinDestinatario` ES UNA COSTURA DE TEST, Y TIENE QUE SEGUIR SIÉNDOLO.
//
// El parámetro existe para poder demostrar que las DOS salidas del dictamen P11 se emiten y
// validan ANTES de que el dictamen exista. Es legítimo mientras ningún llamador de producción
// lo pase: entonces solo hay UN comportamiento posible en producción, el de la constante
// `MODO_SIN_DESTINATARIO`.
//
// LA DIFERENCIA CON EL PREFIJO DE SCRUM-209, que se retiró por lo contrario: aquel tenía dos
// llamadores de producción pasando literales DISTINTOS, así que producción emitía de dos
// formas — un constructor con dos salidas vivas. Aquí hay dos call sites (los dos en
// `exports.routes.ts`) y NINGUNO lo pasa: los dos leen la constante. La distinción no es de
// estilo ni de conteo de llamadores, es **«¿cuántos comportamientos puede tener producción?»**.
// Allí, dos. Aquí, uno.
//
// PERO ESO HOY LO SOSTIENE UNA CONVENCIÓN, NO UN MECANISMO. Nada impide que mañana alguien pase
// el modo desde una ruta «para probar una cosa» y la costura de test se convierta en
// configuración viva — eligiendo en una ruta HTTP una calificación fiscal que el dictamen P11
// todavía no ha tomado, y sin que nadie se entere. Este fichero es ese mecanismo.
//
// ⚠️ AST, NO `grep`. `modoSinDestinatario` aparece por fuerza en la DECLARACIÓN del parámetro y
// en los comentarios que lo explican — un guard de texto se cazaría a sí mismo, la trampa que
// mordió cuatro veces en este repo (SCRUM-176/168/3/193) y el motivo de que exista
// `_guard-texto.mjs`. El árbol solo ve nodos: un nombre dentro de un comentario no lo es.
//
// Y LA CONDICIÓN NO ES «que el texto de la llamada mencione el parámetro», sino **cuántos
// argumentos recibe**: `opts` es el 3.º, así que una llamada con 2 o menos NO PUEDE alcanzarlo,
// venga el valor de un literal, de una variable o de donde sea. Mirar el texto solo cazaría el
// literal escrito a mano.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..');
const SRC = path.join(RAIZ, 'src');

const EMISOR = 'buildVerifactuRegistrosXml';
const PARAMETRO = 'modoSinDestinatario';
const DECLARACION = path.join(SRC, 'modules', 'invoicing', 'domain', 'verifactu.service.ts');

/**
 * Posición del parámetro `opts` en la firma del emisor: los argumentos que producción SÍ puede
 * pasar son los que van ANTES (`params` y, como mucho, el cliente de Prisma).
 *
 * ⚠️ Este número NO se cree a sí mismo: el test 1 lo lee de la firma real y comprueba que sigue
 * siendo este. Si alguien reordena la firma y `opts` sube al 2.º puesto, un `2` clavado aquí
 * daría por buena en VERDE exactamente la llamada que este fichero existe para prohibir — la
 * misma clase de agujero que SCRUM-145: un criterio correcto contra la fuente equivocada.
 */
const ARGUMENTOS_PERMITIDOS = 2;

const rel = (p) => path.relative(RAIZ, p).split(path.sep).join('/');

function fuentesTs(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) fuentesTs(p, out);
    else if (e.name.endsWith('.ts')) out.push(p);
  }
  return out;
}

const parsear = (codigo, ruta) =>
  ts.createSourceFile(ruta, codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

/** ¿Algún nodo de este subárbol se llama `nombre`? (para buscar la prop dentro del tipo de `opts`). */
function declaraNombre(nodo, nombre) {
  if (!nodo) return false;
  let visto = false;
  const visitar = (n) => {
    if (visto) return;
    if (ts.isIdentifier(n) && n.text === nombre) visto = true;
    else ts.forEachChild(n, visitar);
  };
  visitar(nodo);
  return visto;
}

/** Índice del parámetro de `EMISOR` cuyo TIPO declara `modoSinDestinatario`. -1 si no está. */
function indiceDelParametroOpts() {
  const sf = parsear(fs.readFileSync(DECLARACION, 'utf8'), DECLARACION);
  let indice = -1;
  let firma = null;
  const visitar = (n) => {
    if (ts.isFunctionDeclaration(n) && n.name?.text === EMISOR) {
      firma = n.parameters.map((p) => p.name.getText(sf));
      indice = n.parameters.findIndex((p) => declaraNombre(p.type, PARAMETRO));
    }
    ts.forEachChild(n, visitar);
  };
  ts.forEachChild(sf, visitar);
  return { indice, firma };
}

/**
 * Todas las LLAMADAS a `EMISOR` bajo `src/` — no la declaración, no los comentarios.
 *
 * `spread` se marca aparte: con `f(...args)` el árbol NO sabe cuántos argumentos llegan, así que
 * contar da 1 y la llamada pasaría por inocente. No se puede demostrar que no alcanza a `opts`,
 * y lo que no se puede demostrar aquí se trata como infracción, no como silencio.
 */
function llamadasEn(codigo, ruta) {
  const sf = parsear(codigo, ruta);
  const out = [];
  const visitar = (n) => {
    if (ts.isCallExpression(n)) {
      const c = n.expression;
      const nombre = ts.isPropertyAccessExpression(c) ? c.name.text : ts.isIdentifier(c) ? c.text : null;
      if (nombre === EMISOR) {
        out.push({
          donde: `${ruta}:${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1}`,
          argumentos: n.arguments.length,
          spread: n.arguments.some((a) => ts.isSpreadElement(a)),
          texto: n.getText(sf).replace(/\s+/g, ' '),
        });
      }
    }
    ts.forEachChild(n, visitar);
  };
  ts.forEachChild(sf, visitar);
  return out;
}

const llamadasEnProduccion = () =>
  fuentesTs(SRC).flatMap((ruta) => llamadasEn(fs.readFileSync(ruta, 'utf8'), rel(ruta)));

const infractoras = (llamadas) =>
  llamadas.filter((l) => l.spread || l.argumentos > ARGUMENTOS_PERMITIDOS);

// ── 1 · EL NÚMERO NO ES UNA CONVENCIÓN: SALE DE LA FIRMA ──────────────────────────────────
// Sin esto, `ARGUMENTOS_PERMITIDOS = 2` sería otra costumbre escrita en un sitio distinto de la
// verdad, que es justo la enfermedad que este ticket trata.
test('SCRUM-215 · `opts` sigue siendo el 3.er parámetro del emisor (el umbral sale de la firma)', () => {
  const { indice, firma } = indiceDelParametroOpts();

  assert.notEqual(
    indice, -1,
    `🔴 ESCÁNER CIEGO: no encuentro ningún parámetro de ${EMISOR}() cuyo tipo declare ` +
      `\`${PARAMETRO}\` en ${rel(DECLARACION)}.\n` +
      `  Firma leída: (${(firma ?? []).join(', ')})\n` +
      '  O el parámetro ya no existe —entonces este guard sobra y se retira con su ticket—, o ' +
      'cambió de forma y el guard dejó de vigilar nada.',
  );

  assert.equal(
    indice, ARGUMENTOS_PERMITIDOS,
    `🔴 LA FIRMA SE REORDENÓ: \`${PARAMETRO}\` viaja ahora en el parámetro #${indice + 1} ` +
      `(${(firma ?? []).join(', ')}), no en el #${ARGUMENTOS_PERMITIDOS + 1}.\n\n` +
      '  Mientras esto no cuadre, el guard de abajo aprueba EN VERDE una llamada que sí llega\n' +
      `  a \`${PARAMETRO}\`: contaría ${ARGUMENTOS_PERMITIDOS} argumentos «permitidos» cuando\n` +
      '  con ese orden bastan menos para alcanzarlo. Ajusta ARGUMENTOS_PERMITIDOS al índice\n' +
      '  real ANTES de fiarte del verde.',
  );
});

// ── 2 · CONTROL POSITIVO: EL GUARD ES CAPAZ DE VER AL INFRACTOR ───────────────────────────
// La lección de SCRUM-145, aplicada al propio guard: una capa de verificación solo detecta lo
// que es capaz de RECIBIR. Un guard que nunca ha visto un rojo no ha demostrado que pueda darlo.
test('SCRUM-215 · el escáner caza una llamada infractora sintética (y no se caza a sí mismo)', () => {
  const infractor = `import { ${EMISOR} } from './x';\n` +
    `const r = await ${EMISOR}({ merchantId: 1, year: 2026 }, prisma, { ${PARAMETRO}: 'ART_61D' });`;
  assert.equal(infractoras(llamadasEn(infractor, 'ficticio.ts')).length, 1,
    '🔴 el escáner NO ve una llamada de 3 argumentos: es incapaz de dar rojo, no está limpio');

  // El mismo parámetro, esta vez pasado desde una VARIABLE: el texto de la llamada ya no lo
  // menciona. Un guard de texto lo dejaría pasar; el conteo de argumentos no.
  const porVariable = `const o = { ${PARAMETRO}: 'SIMPLIFICADA_F2' };\nawait ${EMISOR}(p, prisma, o);`;
  assert.equal(infractoras(llamadasEn(porVariable, 'ficticio.ts')).length, 1,
    '🔴 se escapa por variable: el guard está mirando el TEXTO y no la ARIDAD');

  // Y el spread, donde el árbol no puede contar: se trata como infracción, no como silencio.
  assert.equal(infractoras(llamadasEn(`await ${EMISOR}(...args);`, 'ficticio.ts')).length, 1,
    '🔴 un spread pasa por inocente: no se puede demostrar que no alcanza a `opts`');

  // NEGATIVO — la prueba de que esto es AST y no `grep`: el nombre en un comentario, y hasta una
  // llamada entera comentada, no son nodos. Si esto fallara, este fichero se cazaría a sí mismo.
  const soloProsa = `// ojo: nadie debe pasar ${PARAMETRO} aquí\n` +
    `/* ni siquiera así: ${EMISOR}(p, prisma, { ${PARAMETRO}: 'ART_61D' }) */\nconst x = 1;`;
  assert.deepEqual(llamadasEn(soloProsa, 'ficticio.ts'), [],
    '🔴 el guard está mirando TEXTO: cazaría su propia prosa y sería inmantenible');

  // Y la llamada legítima de producción —sin `opts`— NO es infractora.
  assert.deepEqual(infractoras(llamadasEn(`await ${EMISOR}({ merchantId: 1, year: 2026 });`, 'ficticio.ts')), [],
    '🔴 el guard da rojo contra la llamada normal: sería ruido, no protección');
});

// ── 3 · EL GUARD ──────────────────────────────────────────────────────────────────────────
test('SCRUM-215 · ningún llamador de PRODUCCIÓN pasa el modo sin destinatario', () => {
  const llamadas = llamadasEnProduccion();

  // Suelo anti-verde-hueco: cero llamadas no es «nadie lo pasa», es «no he mirado».
  assert.ok(
    llamadas.length > 0,
    `🔴 ESCÁNER CIEGO: ninguna llamada a ${EMISOR}() en src/. Antes de creerte el verde, ` +
      'comprueba que la exportación sigue llamando al emisor — si cambió de nombre, este ' +
      'guard dejó de vigilar nada.',
  );

  const infractores = infractoras(llamadas);

  assert.deepEqual(
    infractores.map((l) => `${l.donde} (${l.argumentos} args${l.spread ? ' + spread' : ''})`),
    [],
    `🔴 UN LLAMADOR DE PRODUCCIÓN ALCANZA \`${PARAMETRO}\`.\n\n` +
      infractores.map((l) => `    ${l.donde}\n      ${l.texto}`).join('\n') +
      '\n\n  Ese parámetro es una COSTURA DE TEST: existe para demostrar que las dos salidas\n' +
      '  del dictamen P11 validan, no para configurar nada. En cuanto producción lo alcanza,\n' +
      '  deja de haber un solo comportamiento posible y la elección fiscal se toma en una\n' +
      '  ruta en vez de en el dictamen — que es exactamente lo que SCRUM-215 evita.\n\n' +
      '  Si de verdad hace falta elegir el modo, se cambia `MODO_SIN_DESTINATARIO` (una\n' +
      '  línea, con el dictamen delante). Si hace falta POR MERCHANT, eso es un flag de la\n' +
      '  Parte P: cambio de máster, no un argumento.',
  );
});
