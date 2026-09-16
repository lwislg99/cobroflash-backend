// tests/_bocas-de-emision.mjs — SCRUM-778
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// LA POBLACIÓN DE BOCAS QUE EMITEN, DERIVADA DEL ÁRBOL — EN UN SOLO SITIO.
//
// Una **boca** es un sitio del código desde el que sale una factura: o pide número al embudo
// (`allocateInvoiceNumber`) o llama al emisor compartido (`emitInvoice`). No hay más caminos, y
// que no los haya no es una afirmación de este fichero: lo garantiza el analizador oficial de
// SCRUM-203 (`_embudo-factura.mjs`), que cruza esta población con TODA creación de `Invoice`.
//
// ── POR QUÉ EXISTE ESTE FICHERO ──────────────────────────────────────────────────────────────
//
// 🔴 `LLAMADORES_DE_EMIT` estaba CABLEADA, con dos ficheros, en TRES sitios a la vez:
// `scrum205-un-solo-punto-de-sellado`, `scrum206b-quien-emite-sella` y `scrum246-sin-lineas-no-
// se-emite`. Las tres listas eran idénticas, y las tres se quedaron congeladas el día que se
// escribieron: medido el 6-sep-2026, el árbol tiene TRES ficheros llamando a `emitInvoice`
// —`invoicesAdmin.routes.ts` entró después— y CUATRO llamadas.
//
// 🔴 Y EL DEFECTO DE FORMA ERA PEOR QUE EL DE CONTENIDO. Las tres comprobaban **por fichero**:
// «¿aparece el portón en algún sitio de este fichero?». Con eso, un fichero con dos bocas pasa
// teniendo UNA protegida. Provocado antes de arreglar nada, metiendo una TERCERA llamada a
// `emitInvoice` sin portón en `albaranes.routes.ts` —que ya estaba en la lista—:
//
//     scrum246  → exit 0, 6/6 en verde        scrum205 → exit 0, 6/6        scrum206b → exit 0, 3/3
//
// El AST veía las tres llamadas (líneas 1164, 1378 y la inyectada). Los tres guards, ninguna.
//
// ── SE DERIVA DE SCRUM-771, NO SE COPIA ──────────────────────────────────────────────────────
// Esta función es la `bocas()` que escribió `tests/scrum771-el-emisor-no-valida-el-tipo.test.mjs`,
// extraída aquí y parametrizada por PORTÓN. Aquel guard la usaba y le funcionaba; lo que faltaba
// era que no fuera privada de un test. Ahora la usan los cuatro, y el día que alguien la mejore
// la mejora le llega a todos — que es justo lo que no pasaba con tres listas cableadas iguales.
//
// ⚠️ LA DIRECCIÓN DEL PORTÓN ES UN PARÁMETRO, y no un detalle: SCRUM-246 y SCRUM-771 exigen su
// comprobación ANTES de pedir número (después ya se ha gastado el número de la serie, y las dos
// salidas son malas: modificar una factura numerada o dejar un hueco que justificar). SCRUM-205 y
// SCRUM-206b exigen el sellado DESPUÉS del commit. Un helper que impusiera una sola dirección
// obligaría a la mitad de sus usuarios a mantener su propia copia.
//
// ── ⛔ LO QUE ESTE MÓDULO NO VE, dicho aquí en vez de descubrirse en un rojo raro ─────────────
//   · El portón llamado desde OTRA función (un ayudante que valida por su cuenta). Se busca en
//     las funciones que ENVUELVEN a la boca, no en las que ésta llama. Fallar cerrado: sale como
//     desprotegida y se arregla enseñándole el caso, no bajando el listón.
//   · `emitInvoice` invocado por alias o por referencia (`const f = emitInvoice; f(...)`). Es la
//     misma ceguera declarada de `_embudo-factura.mjs`, y por la misma razón: cerrarla pide el
//     checker de tipos con el proyecto entero en memoria.
//   · Si la ETIQUETA del camino (`camino:` / `origen:`) no se puede leer por AST, la boca sale
//     `ilegible` y NO se da por protegida ni por desprotegida: no se ha podido medir.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

/** El embudo: único asignador de números de factura (SCRUM-203). */
export const EMBUDO = 'allocateInvoiceNumber';
/** El emisor compartido: recibe la transacción y delega en su llamador. */
export const EMISOR = 'emitInvoice';

/**
 * LA ÚNICA EXENCIÓN POR DELEGACIÓN. `emitInvoice` no ve lo que ve su llamador, así que su propia
 * llamada al embudo no se juzga: se juzgan sus llamadores, uno a uno.
 */
export const DELEGA = 'src/modules/invoicing/domain/invoicing.service.ts';

const esFuncion = (n) => ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n)
  || ts.isArrowFunction(n) || ts.isMethodDeclaration(n);

const nombreLlamada = (n) => {
  const c = n.expression;
  return ts.isPropertyAccessExpression(c) ? c.name.text : ts.isIdentifier(c) ? c.text : null;
};

/** Todas las posiciones de una llamada a `nombre` dentro de un nodo. */
function posicionesDe(nodo, nombre) {
  const out = [];
  const v = (n) => {
    if (ts.isCallExpression(n) && nombreLlamada(n) === nombre) out.push(n.getStart());
    ts.forEachChild(n, v);
  };
  ts.forEachChild(nodo, v);
  return out;
}

/**
 * Quita las envolturas que no cambian el valor: `x as T`, `x satisfies T`, `(x)`.
 *
 * 🔴 ESTO ES UN PUNTO CIEGO CORREGIDO, y lo cazó el banco sintético de SCRUM-778 al primer
 * disparo: `emitInvoice(tx, { origen: 'C9' } as any)` NO es un `ObjectLiteralExpression`, es un
 * `AsExpression` que envuelve uno. Sin desenvolverlo, la etiqueta salía `null`, la boca quedaba
 * `ilegible` y el rojo decía «hay una boca sin portón» sin poder decir CUÁL — que es medio rojo.
 *
 * El `as any` es la forma habitual de llamar a estos emisores en este repo, así que la ceguera
 * no era teórica: era la de mañana.
 */
function desenvolver(n) {
  let x = n;
  while (x && (ts.isAsExpression(x) || ts.isParenthesizedExpression(x)
    || (ts.isSatisfiesExpression && ts.isSatisfiesExpression(x)))) x = x.expression;
  return x;
}

/** El texto de una propiedad de un argumento objeto, o `null` si no es legible. */
function propTexto(llamada, indiceArg, clave, sf) {
  const arg = desenvolver(llamada.arguments[indiceArg]);
  if (!arg || !ts.isObjectLiteralExpression(arg)) return null;
  const p = arg.properties.find((x) => x.name && x.name.getText(sf) === clave);
  if (!p || !ts.isPropertyAssignment(p)) return null;
  return desenvolver(p.initializer).getText(sf);
}

/** Todos los `.ts` bajo un directorio. */
export function fuentesTs(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) fuentesTs(p, out);
    else if (e.name.endsWith('.ts')) out.push(p);
  }
  return out;
}

/**
 * CADA BOCA DEL ÁRBOL, UNA POR LLAMADA — nunca una por fichero.
 *
 * @param {object} o
 * @param {string} o.raiz    raíz del repo
 * @param {string} [o.porton] nombre de la función que protege. Sin él, `protegida` es `null`.
 * @param {'antes'|'despues'} [o.cuando] si el portón va antes de la boca o después del commit.
 *
 * `etiqueta` sale del CÓDIGO (`camino:` del embudo, `origen:` del emisor), no de una lista de
 * aquí: si mañana nace un camino nuevo, aparece solo.
 */
export function bocasDeEmision({ raiz, porton = null, cuando = 'antes' } = {}) {
  const src = path.join(raiz, 'src');
  const rel = (p) => path.relative(raiz, p).split(path.sep).join('/');
  const out = [];

  for (const p of fuentesTs(src)) {
    const sf = ts.createSourceFile(p, fs.readFileSync(p, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const r = rel(p);
    const visitar = (n, pila) => {
      const nueva = esFuncion(n) ? [...pila, n] : pila;
      if (ts.isCallExpression(n)) {
        const nom = nombreLlamada(n);
        const tipo = nom === EMBUDO ? 'embudo' : nom === EMISOR ? 'emisor' : null;
        if (tipo) {
          const pos = n.getStart();
          let protegida = null;
          if (porton) {
            protegida = false;
            for (const fn of nueva) {
              for (const q of posicionesDe(fn, porton)) {
                // 🔴 LA POSICIÓN IMPORTA, Y ES LA MITAD DE LA REGLA. Un portón que se llama
                // DESPUÉS de pedir número no protege nada: el número ya está gastado.
                if (cuando === 'antes' ? q < pos : q > pos) protegida = true;
              }
            }
          }
          const etiqueta = tipo === 'embudo'
            ? propTexto(n, 2, 'camino', sf)
            : propTexto(n, 1, 'origen', sf);
          out.push({
            fichero: r,
            tipo,
            linea: sf.getLineAndCharacterOfPosition(pos).line + 1,
            etiqueta: etiqueta === null ? null : etiqueta.replace(/['"]/g, ''),
            protegida,
            ilegible: etiqueta === null && r !== DELEGA,
          });
        }
      }
      ts.forEachChild(n, (h) => visitar(h, nueva));
    };
    ts.forEachChild(sf, (n) => visitar(n, []));
  }
  return out;
}

/**
 * 🔴 EL SUELO. Una población vacía o ENCOGIDA no es «nadie emite sin portón»: es no haber mirado.
 *
 * Es la peor lectura posible de un cero en este censo, porque el cero se produce exactamente
 * igual si el embudo cambia de nombre, si `src/` no se lee, o si alguien renombra `emitInvoice`.
 *
 * `minimoEmbudo` / `minimoEmisor` son TRINQUETES, no adivinanzas: el número medido hoy. No pueden
 * bajar sin que alguien lo anote — que es la única forma de que un censo no encoja en silencio.
 */
export function motivosParaNoFiarse({ bocas, creaciones = null, minimoEmbudo, minimoEmisor }) {
  const motivos = [];
  const embudo = bocas.filter((b) => b.tipo === 'embudo');
  const emisor = bocas.filter((b) => b.tipo === 'emisor');

  if (bocas.length === 0) {
    motivos.push('CERO bocas de emisión en todo `src/`. Eso no dice «nadie emite sin portón»: '
      + 'dice que el censo no ha visto el árbol, y su verde no significa nada');
  }
  if (embudo.length < minimoEmbudo) {
    motivos.push(`el censo ENCOGIÓ: ${embudo.length} llamadas a \`${EMBUDO}\` y el trinquete dice `
      + `${minimoEmbudo}. O el embudo cambió de nombre, o hay un camino que ya no pasa por él`);
  }
  if (emisor.length < minimoEmisor) {
    motivos.push(`el censo ENCOGIÓ: ${emisor.length} llamadas a \`${EMISOR}\` y el trinquete dice `
      + `${minimoEmisor}. Una boca que desaparece del censo deja de vigilarse en silencio`);
  }
  // El cruce con SCRUM-203: es quien garantiza que esta población es la COMPLETA.
  if (creaciones !== null) {
    if (creaciones.length === 0) {
      motivos.push('el analizador oficial de SCRUM-203 no ve NINGUNA creación de factura: sin ese '
        + 'cruce, esta población no se puede afirmar completa');
    } else if (creaciones.length !== embudo.length) {
      motivos.push(`${embudo.length} llamadas al embudo y ${creaciones.length} creaciones de `
        + 'factura según SCRUM-203. Si no cuadran, hay una creación que no pasa por el embudo — y '
        + 'entonces este censo no ve el árbol entero');
    }
  }
  const ilegibles = bocas.filter((b) => b.ilegible);
  if (ilegibles.length) {
    motivos.push('hay bocas cuya etiqueta de camino no se puede leer por AST y no se dan por '
      + `buenas: ${ilegibles.map((b) => `${b.fichero}:${b.linea}`).join(', ')}`);
  }
  return motivos;
}

/** Las bocas que el portón NO cubre, ya formateadas para el mensaje del rojo. */
export function desprotegidas(bocas, { exentas = [] } = {}) {
  return bocas
    .filter((b) => b.protegida === false)
    .filter((b) => b.fichero !== DELEGA)
    .filter((b) => !exentas.some((e) => e.fichero === b.fichero && e.linea === b.linea))
    .map((b) => `${b.fichero}:${b.linea}  [${b.tipo}${b.etiqueta ? ' · ' + b.etiqueta : ''}]`);
}
