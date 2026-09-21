// tests/scrum590-el-destino-pasa-por-el-resolvedor.test.mjs — SCRUM-590 (CONT-19)
//
// EL TRINQUETE: ningún envío al cliente puede volver a resolver su destino desde `.phone`.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ HACE FALTA UN TRINQUETE Y NO BASTA EL TEST DE COMPORTAMIENTO
//
// `scrum590-el-movil-es-el-canal` demuestra que el presupuesto sale al móvil. Demuestra UNA vía.
// El árbol tiene ONCE puntos de resolución y el defecto que este ticket arregla es exactamente el
// de un sitio que se queda atrás: no falla, no avisa, sólo manda el documento al número
// equivocado. El sitio número doce —el que se escriba mañana— es el que este fichero vigila.
//
// 🔴 ANÁLISIS ESTÁTICO DEL ÁRBOL (AST), NO `grep`. Es la regla de SCRUM-203, y aquí hace falta de
// verdad: la prosa de este mismo comentario contiene `.phone` y `customer.phone`, así que un guard
// de texto se cazaría a sí mismo (la trampa de auto-referencia de SCRUM-129).
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LA POBLACIÓN SE DERIVA, NO SE CABLEA
//
// Las funciones de envío salen de los `export` de `src/integrations/whatsapp.ts` y
// `whatsappNotifications.ts`, y **el nombre de su parámetro de destino se lee de su firma**. Una
// lista cableada aquí se congelaría el día que se escribe — que es lo que le pasó a las tres
// copias de `LLAMADORES_DE_EMIT` que SCRUM-778 tuvo que unificar.
//
// ⛔ LO QUE ESTE GUARD **NO** VE, dicho aquí en vez de descubrirse en un rojo raro:
//   · el destino calculado dentro de OTRA función que este fichero no sigue (se resuelven
//     variables locales `const x = …`, no cadenas de llamadas). Falla ABIERTO en ese caso: sale
//     como «no juzgado», no como aprobado — y por eso hay suelo de población abajo;
//   · el envío por alias (`const f = sendWhatsAppTemplate; f(...)`), misma ceguera declarada que
//     `_bocas-de-emision.mjs`;
//   · `src/integrations/` queda FUERA a propósito: es la fontanería, reenvía lo que le dan.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(raiz, 'src');
const INTEGRACIONES = path.join(SRC, 'integrations');
const RESOLVEDOR = 'canalDeWhatsApp';

/** Los nombres que puede tener el parámetro de destino en la firma de un sender. */
const NOMBRES_DE_DESTINO = ['to', 'toPhone', 'merchantPhone'];

function ficherosTs(dir) {
  const fuera = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) fuera.push(...ficherosTs(p));
    else if (e.name.endsWith('.ts')) fuera.push(p);
  }
  return fuera;
}

const leer = (f) => ts.createSourceFile(f, fs.readFileSync(f, 'utf8'), ts.ScriptTarget.ES2022, true);
const desenvolver = (n) => {
  let x = n;
  while (x && (ts.isAsExpression(x) || ts.isParenthesizedExpression(x))) x = x.expression;
  return x;
};

/**
 * Las funciones de envío y CÓMO se llama su parámetro de destino, leído de la firma.
 *
 * Un sender es una función exportada cuyo primer parámetro es un objeto con alguna propiedad de
 * `NOMBRES_DE_DESTINO`. Ese `type` puede ser un literal o una INTERSECCIÓN (`{ … } & DestinoDeEnvio`,
 * SCRUM-245): leer sólo el literal dejaba fuera cuatro vías enteras, y con ellas sus llamadas.
 */
function sendersConDestino() {
  const fuera = new Map();
  for (const nombre of ['whatsapp.ts', 'whatsappNotifications.ts']) {
    const sf = leer(path.join(INTEGRACIONES, nombre));
    const visitar = (n) => {
      if (ts.isFunctionDeclaration(n) && n.name
        && n.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) {
        const p0 = n.parameters[0];
        if (p0?.type) {
          const miembros = [];
          const recoger = (t) => {
            if (ts.isTypeLiteralNode(t)) miembros.push(...t.members);
            else if (ts.isIntersectionTypeNode(t)) t.types.forEach(recoger);
          };
          recoger(p0.type);
          const destino = NOMBRES_DE_DESTINO.find((d) =>
            miembros.some((m) => m.name && m.name.getText(sf) === d));
          if (destino) fuera.set(n.name.text, destino);
        }
      }
      ts.forEachChild(n, visitar);
    };
    ts.forEachChild(sf, visitar);
  }
  return fuera;
}

/** Todas las inicializaciones `const X = …` de un fichero, por nombre. */
function inicializaciones(sf) {
  const mapa = new Map();
  const visitar = (n) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) {
      const previo = mapa.get(n.name.text) || [];
      mapa.set(n.name.text, [...previo, desenvolver(n.initializer).getText(sf)]);
    }
    ts.forEachChild(n, visitar);
  };
  ts.forEachChild(sf, visitar);
  return mapa;
}

/** Censo de llamadas de envío en código de PRODUCTO, con su destino resuelto. */
function censoDeDestinos() {
  const senders = sendersConDestino();
  const llamadas = [];
  for (const f of ficherosTs(SRC)) {
    if (f.startsWith(INTEGRACIONES)) continue; // fontanería: reenvía lo que le dan
    const sf = leer(f);
    const consts = inicializaciones(sf);
    const visitar = (n) => {
      if (ts.isCallExpression(n)) {
        const callee = ts.isIdentifier(n.expression) ? n.expression.text
          : ts.isPropertyAccessExpression(n.expression) ? n.expression.name.text : null;
        const clave = callee && senders.get(callee);
        if (clave) {
          const arg = desenvolver(n.arguments[0]);
          let expresion = null;
          if (arg && ts.isObjectLiteralExpression(arg)) {
            const p = arg.properties.find((x) => x.name && x.name.getText(sf) === clave);
            if (p && ts.isPropertyAssignment(p)) expresion = desenvolver(p.initializer).getText(sf);
            else if (p && ts.isShorthandPropertyAssignment(p)) expresion = p.name.text;
          }
          // Si el destino es una variable, se sustituye por lo que se le asignó (todas las
          // asignaciones: si CUALQUIERA leyera `.phone`, el sitio queda marcado).
          let resuelto = expresion;
          if (expresion && /^[A-Za-z_$][\w$]*$/.test(expresion) && consts.has(expresion)) {
            resuelto = consts.get(expresion).join(' || ');
          }
          llamadas.push({
            fichero: path.relative(raiz, f).replace(/\\/g, '/'),
            linea: sf.getLineAndCharacterOfPosition(n.getStart()).line + 1,
            sender: callee,
            expresion,
            resuelto,
          });
        }
      }
      ts.forEachChild(n, visitar);
    };
    ts.forEachChild(sf, visitar);
  }
  return { senders, llamadas };
}

const { senders, llamadas } = censoDeDestinos();

// `.phone` leído de algo — es el patrón que este ticket retira del camino de envío. NO casa con
// `whatsappPhone`, `bizumPhone` ni `proPhone`: el punto y la minúscula inicial son la diferencia.
const LEE_PHONE = /\.\s*phone\b/;

test('SCRUM-590 · SUELO: el censo encuentra los senders y sus llamadas', () => {
  assert.ok(senders.size >= 5,
    `CIEGO: sólo se han derivado ${senders.size} funciones de envío de integrations/. Sabemos que ` +
    'hay más. El censo no está viendo el árbol; NO se puede concluir nada de los tests de abajo.');
  assert.ok(llamadas.length >= 20,
    `CIEGO: sólo ${llamadas.length} llamadas de envío en código de producto. La medición de ` +
    'SCRUM-590 contó 65. Un guard que no ve la población no protege nada.');
});

test('SCRUM-590 · CONTROL POSITIVO: el resolvedor se usa de verdad en el camino de envío', () => {
  const porElResolvedor = llamadas.filter((l) => l.resuelto && l.resuelto.includes(RESOLVEDOR));
  assert.ok(porElResolvedor.length >= 8,
    `sólo ${porElResolvedor.length} llamadas resuelven su destino con ${RESOLVEDOR}(). La medición ` +
    'de SCRUM-590 encontró 13 llamadas que resuelven desde el cliente; si esto baja, es que el ' +
    'cableado se ha deshecho (o que el censo dejó de verlo).\n' +
    llamadas.map((l) => `  ${l.fichero}:${l.linea} → ${l.resuelto}`).join('\n'));
});

test('SCRUM-590 🔴 ningún envío resuelve su destino leyendo `.phone`', () => {
  const infractores = llamadas.filter((l) => l.resuelto && LEE_PHONE.test(l.resuelto));
  assert.deepEqual(infractores.map((l) => `${l.fichero}:${l.linea} (${l.sender}) → ${l.resuelto}`), [],
    'Un envío está resolviendo su destino desde el teléfono FIJO en vez de por el canal del ' +
    `cliente. Tiene que pasar por ${RESOLVEDOR}() (src/core/contacto/canalDeWhatsApp.ts): con dos ` +
    'números, `.phone` es la centralita y el documento se iría a un sitio donde nadie lo abre.');
});
