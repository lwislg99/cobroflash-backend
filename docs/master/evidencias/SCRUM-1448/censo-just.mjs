// docs/master/evidencias/SCRUM-1448/censo-just.mjs — SCRUM-1448a
//
// ¿Algún camino de `src/` crea HOY un documento de tipo JUST, o con número `J-`?
// (Decisión del fundador, SCRUM-1448 c.20918: «antes de decidir nada, se mide si algún camino lo
// crea hoy».) SÓLO LEE: no importa nada de `src/` ni de `dist/`, no toca la base.
//
// AST de TypeScript, no grep (SCRUM-203). Cuatro preguntas, cada una con su población:
//
//   A · CREACIONES de `Invoice`. La población la da el censo de la casa (`analizarFuente` de
//       `tests/_embudo-factura.mjs`), y esta pasada la vuelve a sacar sola: los dos conjuntos
//       (ruta:línea) tienen que ser IGUALES, o sale CIEGO. De cada una se lee qué `type` y qué
//       `number` escribe. Si el `type` es un parámetro, se sigue a sus llamadores (`emitInvoice`).
//   B · ESCRITURAS sobre una fila ya creada (`invoice.update|updateMany|upsert`): ¿alguna pone
//       `type` o `number`? (Convertir una F1 en JUST no pasa por ningún `create`.)
//   C · CRUCE POR EL NOMBRE DEL CAMPO (A10, SCRUM-1401): todo `type: 'JUST'` y todo literal
//       'JUST' de `src/`, esté donde esté el objeto; así un `data` construido en otro fichero
//       también sale.
//   D · EL PREFIJO: todo literal de código que empiece por `J-` y toda lectura de
//       `RECEIPT_NUMBER_PREFIX`, para saber si alguien puede COMPONER un número J-.
//
// CONTROL POSITIVO SEMBRADO (cicatriz ② del orquestador): un fuente fabricado aquí abajo, con un
// JUST por cada pregunta, pasa por las MISMAS funciones. Si no salen sus cuatro JUST, el censo es
// CIEGO. `--sin-siembra` quita el sembrado: tiene que salir CIEGO, no verde.
// CONTROL DE OTRO TIPO (lo pide el encargo): el árbol real tiene que dar al menos una creación con
// `type` F1 literal; si no, CIEGO.
//
// Uso: node docs/master/evidencias/SCRUM-1448/censo-just.mjs <raíz del repo> [--sin-siembra]
// Salida: 0 medido · 2 CIEGO.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { analizarFuente, ENVOLTORIO } from '../../../../tests/_embudo-factura.mjs';

const raiz = path.resolve(process.argv[2] || '.');
const sinSiembra = process.argv.includes('--sin-siembra');

const METODOS_CREACION = new Set(['create', 'createMany', 'createManyAndReturn', 'upsert']);
const METODOS_ESCRITURA = new Set(['update', 'updateMany', 'upsert']);
const EMISOR = 'emitInvoice';

const nombreDe = (n) =>
  !n ? null : ts.isIdentifier(n) || ts.isStringLiteralLike(n) ? n.text : null;

function prop(obj, nombre) {
  if (!obj || !ts.isObjectLiteralExpression(obj)) return { estado: 'no-literal' };
  for (const p of obj.properties) {
    if (ts.isPropertyAssignment(p) && nombreDe(p.name) === nombre) return { estado: 'si', nodo: p.initializer };
    if (ts.isShorthandPropertyAssignment(p) && nombreDe(p.name) === nombre) return { estado: 'si', nodo: p.name };
  }
  const hayEspar = obj.properties.some((p) => ts.isSpreadAssignment(p));
  return { estado: hayEspar ? 'espar' : 'ausente' };
}

const receptorEsInvoice = (acc) => {
  const r = acc.expression;
  if (ts.isPropertyAccessExpression(r)) return nombreDe(r.name) === 'invoice';
  if (ts.isElementAccessExpression(r)) return nombreDe(r.argumentExpression) === 'invoice';
  return false;
};

/** Qué valor escribe una expresión de `type`: literal, `x ?? 'F1'`, o texto sin resolver. */
function valorDe(r, sf, enEscritura = false) {
  // En un `update`, que falte el campo es «no lo toca»; en un `create`, el default del esquema.
  if (r.estado === 'ausente') return enEscritura ? { clase: 'no lo toca', texto: '' } : { clase: 'default de la BD', texto: '@default("F1")' };
  if (r.estado === 'espar') return { clase: 'sin ver (spread)', texto: '…' };
  if (r.estado === 'no-literal') return { clase: 'sin ver (data no literal)', texto: '…' };
  const n = r.nodo;
  if (ts.isStringLiteralLike(n)) return { clase: 'literal', texto: n.text };
  return { clase: 'expresión', texto: n.getText(sf) };
}

/** Ruta de Express que envuelve al nodo (`router.post('/x', …)`), o la función más interna. */
function contexto(nodo, sf) {
  let fn = null;
  for (let p = nodo.parent; p; p = p.parent) {
    if (!fn && (ts.isFunctionDeclaration(p) || ts.isMethodDeclaration(p)) && p.name) fn = p.name.getText(sf);
    if (!fn && ts.isVariableDeclaration(p) && p.initializer &&
        (ts.isArrowFunction(p.initializer) || ts.isFunctionExpression(p.initializer))) fn = p.name.getText(sf);
    if (ts.isCallExpression(p) && ts.isPropertyAccessExpression(p.expression)) {
      const m = nombreDe(p.expression.name);
      const a0 = p.arguments[0];
      if (/^(get|post|put|patch|delete|all)$/.test(m || '') && a0 && ts.isStringLiteralLike(a0)) {
        return `${m.toUpperCase()} ${a0.text} (${p.expression.expression.getText(sf)})`;
      }
    }
  }
  return fn ? `función ${fn}` : 'módulo';
}

function analizar(codigo, ruta) {
  const sf = ts.createSourceFile(ruta, codigo, ts.ScriptTarget.Latest, true,
    ruta.endsWith('.ts') ? ts.ScriptKind.TS : ts.ScriptKind.JS);
  const lin = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
  const out = { creaciones: [], llamadasEmisor: [], escrituras: [], campoJust: [], literalJust: [], prefijoJ: [], usosPrefijo: [] };

  const visitar = (n) => {
    if (ts.isCallExpression(n)) {
      const c = n.expression;
      const metodo = ts.isPropertyAccessExpression(c) ? nombreDe(c.name) : null;
      const esInv = ts.isPropertyAccessExpression(c) && receptorEsInvoice(c);
      // A · creaciones (misma forma que el embudo de la casa)
      if (esInv && METODOS_CREACION.has(metodo)) {
        const data = n.arguments[0] && prop(n.arguments[0], metodo === 'upsert' ? 'create' : 'data');
        const obj = data && data.estado === 'si' ? data.nodo : null;
        out.creaciones.push({ ruta, linea: lin(n), forma: `invoice.${metodo}`, contexto: contexto(n, sf),
          type: valorDe(prop(obj, 'type'), sf), number: valorDe(prop(obj, 'number'), sf) });
      }
      if (nombreDe(c) === ENVOLTORIO || (ts.isPropertyAccessExpression(c) && metodo === ENVOLTORIO)) {
        const d = n.arguments[3];
        out.creaciones.push({ ruta, linea: lin(n), forma: ENVOLTORIO, contexto: contexto(n, sf),
          type: valorDe(prop(d, 'type'), sf), number: valorDe(prop(d, 'number'), sf) });
      }
      if (nombreDe(c) === EMISOR || (ts.isPropertyAccessExpression(c) && metodo === EMISOR)) {
        const d = n.arguments[1];
        out.llamadasEmisor.push({ ruta, linea: lin(n), contexto: contexto(n, sf), type: valorDe(prop(d, 'type'), sf) });
      }
      // B · escrituras sobre filas ya creadas
      if (esInv && METODOS_ESCRITURA.has(metodo)) {
        const arg = n.arguments[0];
        const objs = metodo === 'upsert' ? ['update'] : ['data'];
        for (const k of objs) {
          const d = prop(arg, k);
          const obj = d.estado === 'si' ? d.nodo : null;
          out.escrituras.push({ ruta, linea: lin(n), forma: `invoice.${metodo}`, contexto: contexto(n, sf),
            type: valorDe(prop(obj, 'type'), sf, true), number: valorDe(prop(obj, 'number'), sf, true) });
        }
      }
    }
    // C · cruce por el nombre del campo
    if (ts.isPropertyAssignment(n) && nombreDe(n.name) === 'type' && ts.isStringLiteralLike(n.initializer) &&
        n.initializer.text === 'JUST') {
      out.campoJust.push({ ruta, linea: lin(n), contexto: contexto(n, sf), texto: n.parent.getText(sf).slice(0, 120).replace(/\s+/g, ' ') });
    }
    if (ts.isStringLiteralLike(n) && n.text === 'JUST') {
      out.literalJust.push({ ruta, linea: lin(n), padre: ts.SyntaxKind[n.parent.kind], texto: n.parent.getText(sf).slice(0, 90).replace(/\s+/g, ' ') });
    }
    // D · el prefijo
    if ((ts.isStringLiteralLike(n) || ts.isTemplateHead(n)) && /^J-/.test(n.text)) {
      out.prefijoJ.push({ ruta, linea: lin(n), padre: ts.SyntaxKind[n.parent.kind], texto: n.parent.getText(sf).slice(0, 90).replace(/\s+/g, ' ') });
    }
    if (ts.isRegularExpressionLiteral(n) && /\^J-/.test(n.text)) {
      out.prefijoJ.push({ ruta, linea: lin(n), padre: 'RegularExpressionLiteral', texto: n.parent.getText(sf).slice(0, 90).replace(/\s+/g, ' ') });
    }
    if (ts.isIdentifier(n) && n.text === 'RECEIPT_NUMBER_PREFIX' && !(ts.isVariableDeclaration(n.parent) && n.parent.name === n)) {
      out.usosPrefijo.push({ ruta, linea: lin(n), padre: ts.SyntaxKind[n.parent.kind], texto: n.parent.parent.getText(sf).slice(0, 90).replace(/\s+/g, ' ') });
    }
    ts.forEachChild(n, visitar);
  };
  ts.forEachChild(sf, visitar);
  return out;
}

// ── el árbol real: `src/` ───────────────────────────────────────────────────────────────────
const ficheros = [];
(function recorrer(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) recorrer(p);
    else if (/\.(ts|mjs|js)$/.test(e.name)) ficheros.push(p);
  }
})(path.join(raiz, 'src'));

const rel = (p) => path.relative(raiz, p).split(path.sep).join('/');
const total = { creaciones: [], llamadasEmisor: [], escrituras: [], campoJust: [], literalJust: [], prefijoJ: [], usosPrefijo: [] };
const casa = [];
for (const f of ficheros) {
  const cod = fs.readFileSync(f, 'utf8');
  const r = analizar(cod, rel(f));
  for (const k of Object.keys(total)) total[k].push(...r[k]);
  casa.push(...analizarFuente(cod, rel(f)).filter((c) => !c.forma.includes('anidado') && c.forma !== 'SQL en crudo'));
  // Los anidados y el SQL en crudo los cuenta aparte el embudo: si hubiera alguno, se dice abajo.
}
const anidadosOsql = ficheros.flatMap((f) => analizarFuente(fs.readFileSync(f, 'utf8'), rel(f)))
  .filter((c) => c.forma.includes('anidado') || c.forma === 'SQL en crudo');

// ── control: las dos sondas de la población A tienen que dar el MISMO conjunto ───────────────
const clave = (c) => `${c.ruta}:${c.linea}`;
const mias = new Set(total.creaciones.map(clave));
const deCasa = new Set(casa.map(clave));
const soloMias = [...mias].filter((k) => !deCasa.has(k));
const soloCasa = [...deCasa].filter((k) => !mias.has(k));

// ── siembra: un JUST por pregunta, fabricado aquí ────────────────────────────────────────────
const SEMBRADO = `
  router.post('/sembrado', async (req, res) => {
    await crearFacturaEmitida(tx, c, e, { number: 'J-20261027-0001', type: 'JUST' });
    await emitInvoice(tx, { type: 'JUST' });
    await tx.invoice.update({ where: { id: 1 }, data: { type: 'JUST' } });
    const n = RECEIPT_NUMBER_PREFIX + '0001';
  });`;
const s = sinSiembra ? null : analizar(SEMBRADO, 'SEMBRADO.ts');
const esJust = (v) => v.clase === 'literal' && v.texto === 'JUST';
const siembraVista = !!s &&
  s.creaciones.some((c) => esJust(c.type)) &&
  s.llamadasEmisor.some((c) => esJust(c.type)) &&
  s.escrituras.some((c) => esJust(c.type)) &&
  s.campoJust.length === 3 && s.prefijoJ.length >= 1 && s.usosPrefijo.length === 1;

// ── informe ───────────────────────────────────────────────────────────────────────────────
const pinta = (v) => `${v.clase}${v.texto ? ` «${v.texto}»` : ''}`;
console.log(`censo-just · raíz ${raiz}`);
console.log(`población · ${ficheros.length} ficheros de src/ (.ts/.mjs/.js) leídos por AST`);
console.log(`\nA · CREACIONES de Invoice: ${total.creaciones.length} (censo de la casa: ${casa.length}; solo mías ${soloMias.length}, solo de la casa ${soloCasa.length})`);
for (const c of total.creaciones) console.log(`  ${clave(c)} · ${c.forma} · ${c.contexto}\n      type = ${pinta(c.type)} · number = ${pinta(c.number)}`);
console.log(`  anidadas o SQL en crudo (embudo de la casa): ${anidadosOsql.length}`);
console.log(`\nA' · LLAMADAS a ${EMISOR} (su type entra como input.type ?? 'F1'): ${total.llamadasEmisor.length}`);
for (const c of total.llamadasEmisor) console.log(`  ${clave(c)} · ${c.contexto} · type = ${pinta(c.type)}`);
console.log(`\nB · ESCRITURAS sobre filas de Invoice (update/updateMany/upsert.update): ${total.escrituras.length}`);
for (const c of total.escrituras) console.log(`  ${clave(c)} · ${c.forma} · ${c.contexto} · type = ${pinta(c.type)} · number = ${pinta(c.number)}`);
console.log(`\nC · CRUCE por el campo: propiedades \`type: 'JUST'\` en src/: ${total.campoJust.length}`);
for (const c of total.campoJust) console.log(`  ${clave(c)} · ${c.contexto} · ${c.texto}`);
console.log(`  literales 'JUST' de código en src/ (cualquier sitio): ${total.literalJust.length}`);
for (const c of total.literalJust) console.log(`  ${clave(c)} · ${c.padre} · ${c.texto}`);
console.log(`\nD · PREFIJO J-: literales/regex de código que empiezan por J-: ${total.prefijoJ.length}`);
for (const c of total.prefijoJ) console.log(`  ${clave(c)} · ${c.padre} · ${c.texto}`);
console.log(`  lecturas de RECEIPT_NUMBER_PREFIX: ${total.usosPrefijo.length}`);
for (const c of total.usosPrefijo) console.log(`  ${clave(c)} · ${c.padre} · ${c.texto}`);

const creanJust = total.creaciones.filter((c) => esJust(c.type)).length +
  total.llamadasEmisor.filter((c) => esJust(c.type)).length;
const escribenJust = total.escrituras.filter((c) => esJust(c.type)).length;
const sinVer = [...total.creaciones, ...total.llamadasEmisor, ...total.escrituras]
  .filter((c) => c.type.clase.startsWith('sin ver')).length;
const hayF1 = [...total.creaciones, ...total.llamadasEmisor].some((c) => c.type.clase === 'literal' && c.type.texto === 'F1');

console.log(`\nCONTROLES`);
console.log(`  siembra (4 preguntas): ${sinSiembra ? 'QUITADA' : siembraVista ? 'vista' : 'NO VISTA'}`);
console.log(`  otro tipo en el árbol real (type F1 literal): ${hayF1 ? 'visto' : 'NO VISTO'}`);
console.log(`  dos sondas de la población A: ${soloMias.length + soloCasa.length === 0 ? 'mismo conjunto' : `DISCREPAN ${JSON.stringify({ soloMias, soloCasa })}`}`);
const ciego = !siembraVista || !hayF1 || soloMias.length + soloCasa.length > 0 || ficheros.length === 0;
console.log(`\nVEREDICTO · ${ciego ? 'CIEGO' : 'MEDIDO'} · creaciones con type JUST literal: ${creanJust} · escrituras con type JUST: ${escribenJust} · sitios con type sin ver: ${sinVer}`);
process.exit(ciego ? 2 : 0);
