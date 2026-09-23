// scripts/censo-escritores-invoice.mjs — SCRUM-1099
//
//   node scripts/censo-escritores-invoice.mjs
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// ¿QUIÉN ESCRIBE LA TABLA `invoices`, EN TODO `src/` Y `scripts/`?
//
// Nace del hueco (d) que SCRUM-1097 dejó declarado sin medir: el censo de vías de emisión se
// ancló a dos puntos únicos ya confirmados (`getEmissionMode` y `allocateInvoiceNumber`) y a un
// barrido manual de `scripts/`/cron/exports — pero un censo anclado a una premisa no comprobada
// acredita la premisa, no el hecho. Esto cierra esa premisa: censa TODA escritura al modelo
// `Invoice` (tabla `invoices`, prisma/schema.prisma:926) por AST, no por `grep` de una palabra.
//
// ── QUÉ CUENTA COMO «ESCRIBE `Invoice`» ─────────────────────────────────────────────────────
// (1) Una llamada `<algo>.invoice.<método>(…)` con `<método>` ∈ {create, createMany, upsert,
//     update, updateMany, delete, deleteMany} — la cadena LITERAL `.invoice.<método>`, sin
//     resolver alias (ver «lo que este instrumento NO ve», abajo).
// (2) SQL crudo: `$executeRaw` / `$executeRawUnsafe` / `$queryRaw` / `$queryRawUnsafe` cuyo texto
//     (plantilla o primer argumento string) nombra la tabla `invoices`.
//
// De (1) sólo {create, createMany, upsert} son EMISIÓN (traen una fila nueva a existir); update/
// delete son objeto de la regla 29 (una factura emitida no se edita ni borra), no de la regla 24
// (censo aparte, no es lo que pide este ticket) — pero se listan igual, declarados, para no
// tener que releer el árbol si algún día hace falta esa pregunta.
//
// ── LO QUE ESTE INSTRUMENTO NO VE, Y POR QUÉ SE DECLARA EN VEZ DE OCULTARSE ─────────────────
// Un nivel de indirección es el límite (mismo criterio que `censo-escritores-del-arbol.mjs`,
// SCRUM-808): `const m = tx.invoice; m.create(…)` no se resuelve. Lo que SÍ se detecta y se
// declara aparte es la superficie más simple de ese hueco — notación de corchete
// (`tx['invoice']`) y desestructuración (`const { invoice } = tx`) — como NO CONCLUYENTE, nunca
// como «no escribe»: un cero por no haber sabido mirar es la peor cifra posible.
//
// SALIDAS: 0 censo completo (con o sin hallazgos nuevos, indicados aparte) · 2 CIEGO (población
// bajo el suelo, o el control positivo no aparece).
// ═════════════════════════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { ejecutadoDirectamente } from './_puerta-de-entrada.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Suelo de población: hoy `src/` + `scripts/` pasan de 500 ficheros entre los dos. */
export const MINIMO_POBLACION = 400;

/** El escritor que YA sabemos que existe — si el censo no lo encuentra, está ciego. */
export const CONTROL_POSITIVO = { fichero: 'src/modules/invoicing/domain/crearFacturaEmitida.ts', metodo: 'create' };

export const METODOS_EMISION = new Set(['create', 'createMany', 'upsert']);
export const METODOS_ESCRITURA = new Set(['create', 'createMany', 'upsert', 'update', 'updateMany', 'delete', 'deleteMany']);
const METODOS_SQL_CRUDO = new Set(['$executeRaw', '$executeRawUnsafe', '$queryRaw', '$queryRawUnsafe']);
const TABLA = /\binvoices\b/i;

function ficherosRecursivos(dirAbs, ext) {
  const out = [];
  if (!fs.existsSync(dirAbs)) return out;
  for (const entrada of fs.readdirSync(dirAbs, { withFileTypes: true })) {
    if (entrada.name === 'node_modules' || entrada.name.startsWith('.')) continue;
    const abs = path.join(dirAbs, entrada.name);
    if (entrada.isDirectory()) out.push(...ficherosRecursivos(abs, ext));
    else if (entrada.name.endsWith(ext)) out.push(abs);
  }
  return out;
}

export function poblacion(raiz = RAIZ) {
  const src = ficherosRecursivos(path.join(raiz, 'src'), '.ts').map((a) => path.relative(raiz, a).replace(/\\/g, '/'));
  const scripts = ficherosRecursivos(path.join(raiz, 'scripts'), '.mjs').map((a) => path.relative(raiz, a).replace(/\\/g, '/'));
  return [...src, ...scripts];
}

/** Texto de un SQL crudo: plantilla etiquetada (`` tag`…` ``) o primer argumento string de `tag(…)`. */
function textoSql(n, sf) {
  if (ts.isTaggedTemplateExpression(n)) return n.template.getText(sf);
  if (ts.isCallExpression(n) && n.arguments[0]) return n.arguments[0].getText(sf);
  return '';
}

export function analizar(codigo, nombre) {
  const kind = nombre.endsWith('.ts') ? ts.ScriptKind.TS : ts.ScriptKind.JS;
  const sf = ts.createSourceFile(nombre, codigo, ts.ScriptTarget.Latest, true, kind);

  const escrituras = [];
  const sqlCrudo = [];
  const noConcluyentes = [];

  const linea = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;

  const v = (n) => {
    // ① `<algo>.invoice.<método>(…)` — la cadena LITERAL, sin resolver alias.
    if (
      ts.isCallExpression(n) &&
      ts.isPropertyAccessExpression(n.expression) &&
      METODOS_ESCRITURA.has(n.expression.name.text) &&
      ts.isPropertyAccessExpression(n.expression.expression) &&
      n.expression.expression.name.text === 'invoice'
    ) {
      escrituras.push({
        fichero: nombre,
        linea: linea(n),
        metodo: n.expression.name.text,
        emision: METODOS_EMISION.has(n.expression.name.text),
        base: n.expression.expression.expression.getText(sf).slice(0, 30),
      });
    }

    // ② SQL crudo que nombra `invoices`.
    // 🔴 `TaggedTemplateExpression` guarda el "callee" en `.tag`, NO en `.expression` (ése es
    // `CallExpression`). Confundirlos revienta con `undefined.kind` en TODO fichero que use la
    // forma con plantilla (`` prisma.$queryRaw`…` ``) — que es la mitad de los sitios reales.
    const calleeSql = ts.isTaggedTemplateExpression(n) ? n.tag : ts.isCallExpression(n) ? n.expression : undefined;
    if (calleeSql && ts.isPropertyAccessExpression(calleeSql) && METODOS_SQL_CRUDO.has(calleeSql.name.text)) {
      const txt = textoSql(n, sf);
      if (TABLA.test(txt)) {
        sqlCrudo.push({ fichero: nombre, linea: linea(n), metodo: calleeSql.name.text, texto: txt.slice(0, 90).replace(/\s+/g, ' ') });
      }
    }

    // NO CONCLUYENTE: notación de corchete sobre 'invoice' — `algo['invoice']` / `algo["invoice"]`.
    if (ts.isElementAccessExpression(n) && n.argumentExpression && ts.isStringLiteralLike(n.argumentExpression) && n.argumentExpression.text === 'invoice') {
      noConcluyentes.push({ fichero: nombre, linea: linea(n), forma: 'corchete', texto: n.getText(sf).slice(0, 60) });
    }
    // NO CONCLUYENTE: desestructuración `const { invoice } = …` / `const { invoice, … }`.
    if (ts.isBindingElement(n) && ts.isIdentifier(n.name) && n.name.text === 'invoice' && n.parent && ts.isObjectBindingPattern(n.parent)) {
      noConcluyentes.push({ fichero: nombre, linea: linea(n), forma: 'desestructuración', texto: n.getText(sf).slice(0, 60) });
    }

    ts.forEachChild(n, v);
  };
  v(sf);

  return { escrituras, sqlCrudo, noConcluyentes };
}

export function censar({ raiz = RAIZ } = {}) {
  const pobl = poblacion(raiz);
  if (pobl.length < MINIMO_POBLACION) {
    return { motivo: `sólo ${pobl.length} ficheros en la población y el suelo son ${MINIMO_POBLACION}` };
  }
  const escritores = [];
  const sqlCrudo = [];
  const opacos = [];
  for (const rel of pobl) {
    const a = analizar(fs.readFileSync(path.join(raiz, rel), 'utf8'), rel);
    if (a.escrituras.length) escritores.push(...a.escrituras);
    if (a.sqlCrudo.length) sqlCrudo.push(...a.sqlCrudo);
    if (a.noConcluyentes.length) opacos.push(...a.noConcluyentes);
  }
  return { motivo: null, poblacion: pobl.length, escritores, sqlCrudo, opacos };
}

// ═════════════════════════════════════════════════════════════════════════════════════════════

function principal() {
  const c = censar();
  if (c.motivo) {
    console.error(`🔴 CIEGO: ${c.motivo}. No se imprime censo: un cero por no haber mirado es la peor cifra.`);
    return 2;
  }

  console.log('═══ LA POBLACIÓN ═══');
  console.log(`   ficheros .ts (src/) + .mjs (scripts/) barridos : ${c.poblacion}`);
  console.log(`   llamadas \`.invoice.<método>(…)\` literales      : ${c.escritores.length}`);
  console.log(`   SQL crudo que nombra \`invoices\`                : ${c.sqlCrudo.length}`);
  console.log(`   NO CONCLUYENTES (corchete / desestructuración) : ${c.opacos.length}`);

  console.log('\n═══ ESCRITURAS `.invoice.<método>(…)` — por fichero ═══');
  for (const e of c.escritores) {
    console.log(`   ${e.emision ? '🔴 EMISIÓN' : '   (edita/borra)'} ${e.fichero}:${e.linea} → ${e.base}.invoice.${e.metodo}(…)`);
  }

  console.log(`\n═══ SQL CRUDO sobre \`invoices\` (${c.sqlCrudo.length}) ═══`);
  for (const s of c.sqlCrudo) console.log(`   ${s.fichero}:${s.linea} ${s.metodo} → ${s.texto}…`);

  console.log(`\n═══ ⚠️ NO CONCLUYENTES (${c.opacos.length}) ═══`);
  console.log('   Un nivel de indirección es el límite de este instrumento. NO se cuentan como');
  console.log('   «no escriben»: se nombran para que alguien las mire a mano.');
  for (const o of c.opacos) console.log(`   · ${o.fichero}:${o.linea} (${o.forma}) ${o.texto}`);

  console.log('\n═══ ✅ CONTROL POSITIVO DEL INSTRUMENTO ═══');
  const yo = c.escritores.find((e) => e.fichero === CONTROL_POSITIVO.fichero && e.metodo === CONTROL_POSITIVO.metodo);
  if (!yo) {
    console.error(`   🔴 el censo NO encuentra \`${CONTROL_POSITIVO.fichero}\` (.invoice.${CONTROL_POSITIVO.metodo}), y ES el escritor `
      + 'que ya sabíamos que existe. El instrumento no está viendo.');
    return 2;
  }
  console.log(`   \`${CONTROL_POSITIVO.fichero}:${yo.linea}\` sale como escritor de emisión. El instrumento ve.`);
  return 0;
}

if (ejecutadoDirectamente(import.meta.url)) process.exit(principal());
