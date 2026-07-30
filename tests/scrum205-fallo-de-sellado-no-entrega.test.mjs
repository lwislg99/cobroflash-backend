// SCRUM-205 · RE-ANCLAJE del guard de SCRUM-206 (sin gate; AST y texto sobre `src/`).
//
// LA PROPIEDAD, que es la que se vigila y no el mecanismo:
//
//     UN FALLO DE SELLADO NO PUEDE ACABAR EN UN DOCUMENTO ENTREGADO.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ HAY QUE RE-ANCLARLO, Y POR QUÉ EN UN COMMIT PROPIO
//
// El guard de SCRUM-206 exigía el par «registro + `throw`» dentro de `lib/invoicing.ts`. Eso
// era la FORMA de expresar la propiedad cuando ese fichero sellaba y, al fallar, seguía
// entregando: la única manera de cortar era lanzar.
//
// SCRUM-205 mueve el sellado al punto único (`sellarTrasEmision`), y ahí `throw` sería
// incorrecto: obligaría a cada llamador a decidir qué hacer con un número YA consumido, y la
// respuesta correcta es siempre la misma —dejar la factura pendiente y reintentar—. Así que la
// forma cambia: se registra el fallo y se DEVUELVE un estado que el portón bloquea.
//
// El commit va aparte de la resolución del conflicto a propósito: un guard fiscal movido de
// sitio dentro de un merge es un guard del que ya no se puede afirmar nada.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL AGUJERO NUEVO QUE EL CAMBIO DE MECANISMO INTRODUCE
//
// **Un `throw` no se puede ignorar; un valor devuelto SÍ.** Ese modo de fallo no existía antes
// y es el que de verdad importa aquí: alguien puede sellar, tirar el resultado a la basura y
// entregar el documento igual. Por eso la afirmación 3 no es un extra — es la que sustituye al
// `throw`, y es la razón de que este guard sea MÁS estricto que el de 206 y no más laxo.
//
// Las tres afirmaciones están ATADAS: por separado, cada una se puede satisfacer sin que la
// propiedad se cumpla.
//   ① un `sellado_fallido` que no devuelva estado bloqueante → el fallo se pierde;
//   ② un estado bloqueante que el portón no bloquee → el estado es decorativo;
//   ③ un llamador que descarte el resultado y entregue → el estado nunca se consulta.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(RAIZ, 'src');

const PUERTA = 'sellarTrasEmision';
const ESTADO_BLOQUEANTE = 'SELLADO_PENDIENTE';
const PREDICADO = 'puedeProducirDocumento';
/** Lo que cuenta como ENTREGAR BYTES: producir el documento o volcarlo a la respuesta. */
const PRODUCE_BYTES = ['generateInvoicePdf', 'ensureInvoicePdf', 'createReadStream'];
/** Los porteros: cualquiera de los dos corta antes de producir. */
const PORTEROS = ['exigirDocumentoEmitible', PREDICADO];

const rel = (p) => path.relative(RAIZ, p).split(path.sep).join('/');
const fuentes = (dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) fuentes(p, out);
    else if (e.name.endsWith('.ts')) out.push(p);
  }
  return out;
};
const sf = (p) => ts.createSourceFile(p, fs.readFileSync(p, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const nombreDe = (n) => {
  const c = n.expression;
  return ts.isPropertyAccessExpression(c) ? c.name.text : ts.isIdentifier(c) ? c.text : null;
};
const contiene = (nodo, fuente, nombres) => {
  let visto = false;
  const v = (n) => { if (ts.isCallExpression(n) && nombres.includes(nombreDe(n))) visto = true; ts.forEachChild(n, v); };
  ts.forEachChild(nodo, v);
  return visto;
};
const esFuncion = (n) =>
  ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n) || ts.isMethodDeclaration(n);

const TODOS = fuentes(SRC);

// ── ① Todo `sellado_fallido` devuelve (o lanza) algo que no se puede ignorar en silencio ──

test('SCRUM-205 · ① un `sellado_fallido` registrado va atado a un estado que bloquea', () => {
  const sitios = [];

  for (const p of TODOS) {
    const arbol = sf(p);
    const r = rel(p);
    const visitar = (n, bloques) => {
      const pila = ts.isBlock(n) ? [...bloques, n] : bloques;
      // El registro se reconoce por su propiedad `action: 'sellado_fallido'`, no por el nombre
      // de la función que lo escribe: hay dos puertas de auditoría (SCRUM-207) y puede haber más.
      if (
        ts.isPropertyAssignment(n) && n.name.getText(arbol) === 'action'
        && /'sellado_fallido'|"sellado_fallido"/.test(n.initializer.getText(arbol))
      ) {
        const linea = arbol.getLineAndCharacterOfPosition(n.getStart(arbol)).line + 1;
        // ¿En alguno de los bloques que lo envuelven hay un corte que no se pueda ignorar?
        let corta = false;
        for (const b of pila) {
          const txt = b.getText(arbol);
          // `throw` sirve igual (es MÁS fuerte: no se puede ignorar). `return` con el estado
          // bloqueante también. Lo que no vale es registrar y seguir sin decir nada.
          if (/\bthrow\b/.test(txt)) corta = true;
          if (new RegExp(`return[\\s\\S]{0,200}${ESTADO_BLOQUEANTE}`).test(txt)) corta = true;
        }
        sitios.push({ ref: `${r}:${linea}`, corta });
      }
      ts.forEachChild(n, (h) => visitar(h, pila));
    };
    ts.forEachChild(arbol, (n) => visitar(n, []));
  }

  assert.ok(
    sitios.length > 0,
    '🔴 ESCÁNER CIEGO: ningún registro de `sellado_fallido` en `src/`. O se renombró la acción, o ' +
      'el fallo de sellado dejó de registrarse. En los dos casos este guard no vigila nada.',
  );

  const mudos = sitios.filter((s) => !s.corta).map((s) => s.ref);
  assert.deepEqual(
    mudos, [],
    '🔴 HAY UN `sellado_fallido` QUE NO CORTA:\n' + mudos.map((s) => `    ${s}`).join('\n') +
      '\n\n  Se registra el fallo y la ejecución sigue sin devolver un estado bloqueante ni lanzar.\n' +
      '  Registrar no es impedir: eso es exactamente el fail-open que cerró SCRUM-206, con el\n' +
      `  registro puesto encima. El fallo tiene que salir como \`${ESTADO_BLOQUEANTE}\` (o como\n` +
      '  excepción) para que alguien pueda hacer algo con él.',
  );
});

// ── ② El portón bloquea ese estado. MEDIDO ejecutando el predicado, no leído del nombre ──

test('SCRUM-205 · ② el portón bloquea de verdad `SELLADO_PENDIENTE` (ejecutado, no supuesto)', () => {
  // Se EXTRAEN por AST las constantes y el predicado, se transpilan y se ejecutan. Ni se lee el
  // nombre ni se importa `dist`: la rama no compila hasta que exista el ALTER (el cliente Prisma
  // no conoce `vfEstado`), así que un guard que dependiera de `dist` no se podría correr hoy —
  // y un guard que no se puede correr no es un guard.
  const ruta = path.join(SRC, 'modules/invoicing/domain/selladoEstado.ts');
  assert.ok(fs.existsSync(ruta), '🔴 ESCÁNER CIEGO: no encuentro selladoEstado.ts');
  const arbol = sf(ruta);

  const trozos = [];
  let vistoPredicado = false;
  ts.forEachChild(arbol, (n) => {
    if (ts.isVariableStatement(n)) {
      const txt = n.getText(arbol);
      if (/SELLADO_(PENDIENTE|HECHO|NO_APLICA)\s*=/.test(txt)) trozos.push(txt.replace(/^export\s+/, ''));
    }
    if (ts.isFunctionDeclaration(n) && n.name?.text === PREDICADO) {
      trozos.push(n.getText(arbol).replace(/^export\s+/, ''));
      vistoPredicado = true;
    }
  });

  assert.ok(
    vistoPredicado,
    `🔴 ESCÁNER CIEGO: no encuentro la función \`${PREDICADO}\` en selladoEstado.ts. Si el portón ` +
      'cambió de nombre o de sitio, esta comprobación dejó de medir el portón.',
  );

  const js = ts.transpileModule(
    trozos.join('\n') + `\nreturn { ${PREDICADO}, SELLADO_PENDIENTE, SELLADO_HECHO, SELLADO_NO_APLICA };`,
    { compilerOptions: { target: ts.ScriptTarget.ES2020 } },
  ).outputText;
  // eslint-disable-next-line no-new-func
  const api = new Function(js)();

  assert.equal(
    api[PREDICADO](api.SELLADO_PENDIENTE), false,
    `🔴 EL PORTÓN NO BLOQUEA \`${ESTADO_BLOQUEANTE}\`. Entonces el estado que devuelve un sellado ` +
      'fallido es decorativo: se registra el fallo, se devuelve el estado, y el documento sale igual.',
  );
  assert.equal(api[PREDICADO](api.SELLADO_HECHO), true, '🔴 el portón bloquea una factura SELLADA');
  assert.equal(
    api[PREDICADO](api.SELLADO_NO_APLICA), true,
    '🔴 el portón bloquea `no_aplica`: los justificantes J- y los merchants no-ES no llevan huella ' +
      'y su documento es legítimo. Bloquearlos sería cerrarse sobre facturas correctas.',
  );
});

// ── ③ Nadie descarta el resultado Y entrega bytes. Es lo que sustituye al `throw` ──

test('SCRUM-205 · ③ ningún llamador descarta el resultado del sellado y entrega bytes', () => {
  const llamadores = [];

  for (const p of TODOS) {
    const arbol = sf(p);
    const r = rel(p);
    if (r.endsWith('selladoEstado.ts')) continue; // ahí se DECLARA

    const visitar = (n, pila) => {
      const nueva = esFuncion(n) ? [...pila, n] : pila;
      if (ts.isCallExpression(n) && nombreDe(n) === PUERTA) {
        const linea = arbol.getLineAndCharacterOfPosition(n.getStart(arbol)).line + 1;
        // ¿Se DESCARTA? El valor se descarta si la llamada (o su `await`) es una sentencia de
        // expresión: nadie lee lo que devolvió.
        let sub = n.parent;
        if (sub && ts.isAwaitExpression(sub)) sub = sub.parent;
        const descartado = !!sub && ts.isExpressionStatement(sub);
        // ¿La función que lo envuelve produce bytes? ¿Y pasa por un portero antes?
        const produce = nueva.some((fn) => contiene(fn, arbol, PRODUCE_BYTES));
        const portero = nueva.some((fn) => contiene(fn, arbol, PORTEROS));
        llamadores.push({ ref: `${r}:${linea}`, descartado, produce, portero });
      }
      ts.forEachChild(n, (h) => visitar(h, nueva));
    };
    ts.forEachChild(arbol, (n) => visitar(n, []));
  }

  assert.ok(
    llamadores.length >= 8,
    `🔴 ESCÁNER CIEGO: veo ${llamadores.length} llamadas a \`${PUERTA}\` y los caminos de emisión ` +
      'son 8. Si el punto único cambió de nombre, este guard dejó de vigilar los caminos que dice.',
  );

  // El caso prohibido: tirar el resultado a la basura Y producir el documento sin preguntar.
  const ciegos = llamadores.filter((l) => l.descartado && l.produce && !l.portero).map((l) => l.ref);
  assert.deepEqual(
    ciegos, [],
    '🔴 ALGUIEN SELLA, DESCARTA EL RESULTADO Y ENTREGA:\n' + ciegos.map((s) => `    ${s}`).join('\n') +
      '\n\n  Este es el agujero que abre el cambio de mecanismo, y no existía con el `throw`: una\n' +
      '  excepción no se puede ignorar, un valor devuelto SÍ. Ahí se sella, se tira el resultado,\n' +
      '  y el documento sale sin que nadie haya comprobado que la factura tiene huella.\n\n' +
      `  Dos salidas, las dos válidas: leer el resultado y ramificar, o llamar a un portero\n` +
      `  (${PORTEROS.join(' / ')}) antes de producir. Lo que no vale es ninguna de las dos.`,
  );

  // Y se deja dicho lo que este guard NO exige, para que nadie lo lea como más de lo que es:
  // descartar el resultado en una función que NO produce documento está permitido —la garantía
  // la sostiene el portón aguas abajo—, y cuesta VISIBILIDAD, no corrección.
  const descartadoresSinBytes = llamadores.filter((l) => l.descartado && !l.produce);
  assert.ok(
    descartadoresSinBytes.length <= 2,
    `🔴 RATCHET: ${descartadoresSinBytes.length} llamadores descartan el resultado sin producir ` +
      'documento, y cuando se escribió esto eran 2 (`jobs.routes.ts` y `quotes.routes.ts`). No es ' +
      'incorrecto —el portón aguas abajo sostiene la garantía— pero cada uno de ellos es un sitio ' +
      'donde el usuario NO se entera de que su factura no se selló. Si crecen, decídelo a propósito.',
  );
});
