// tests/scrum297-fuentes-selladas.test.mjs — SCRUM-297 (A7) · la rueda que obliga a acordarse.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// UN AVISO ESCRITO EN UNA ENTRADA NO IMPIDE NADA
//
// Al entregar A7 declaré esto: «`lugarEntrega` no se selecciona porque no existe todavía en el
// esquema; cuando C5 entre hay que añadirlo aquí Y en el barrido a la vez, o los sobres v:2 se
// declararán manipulados». El día que C5 entre, **nadie va a releer esa entrada**. Esto lo
// convierte en mecanismo.
//
// LA REGLA: cada fuente que el SELLADOR mete en el contenido canónico tiene que llegar al
// paquete de evidencias. Si el sellador gana una fuente y el paquete no la trae, el hash se
// recalcula con un hueco y el paquete declara **manipulados documentos intactos** — sobre la
// población entera a la vez. Es la peor salida posible de esta herramienta.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ ESTE GUARD NO ES EL ⑥ DE SCRUM-371 (medido antes de escribirlo)
//
// El ⑥ compara **cómo RESUELVE** cada fuente el adaptador frente al sellador (`job?.direccion ||
// null` contra `job?.direccion || null`). No mira si la CONSULTA trae la columna: su `PAREJAS`
// deja fuera `lugarEntrega` a propósito y ni siquiera lee un `select`.
//
// Este mira lo otro: **que el `select` del paquete traiga las columnas que el adaptador va a
// leer**. Dos afirmaciones distintas sobre el mismo camino; ninguna repite a la otra.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// ⚠️ HOY TIENE QUE ESTAR VERDE, Y PONERSE ROJO SOLO CUANDO C5 ENTRE
//
// El adaptador ya lee `a.lugarEntrega`, pero esa columna NO EXISTE en el esquema: pedirla en el
// `select` reventaría la consulta entera. Por eso la exigencia se condiciona al ESQUEMA, que es
// el hecho que cambia con C5: en cuanto `lugarEntrega` aparezca en `prisma/schema.prisma`, este
// guard se pone rojo hasta que el paquete la seleccione. Esa es la rueda.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const RAIZ = path.resolve(import.meta.dirname, '..');
const F_SELLADOR = path.join(RAIZ, 'src/modules/jobs/domain/albaran.service.ts');
const F_ADAPTADOR = path.join(RAIZ, 'src/modules/jobs/domain/albaranBarrido.ts');
const F_PAQUETE = path.join(RAIZ, 'src/modules/fiscal/evidencias/paquete.repo.ts');
const F_SCHEMA = path.join(RAIZ, 'prisma/schema.prisma');

function arbol(ruta) {
  assert.ok(fs.existsSync(ruta),
    `🔴 no existe ${path.relative(RAIZ, ruta)}: el guard no puede obtener su referencia. Un guard ` +
    'que no puede mirar FALLA y lo dice; nunca pasa por no poder mirar.');
  return ts.createSourceFile(ruta, fs.readFileSync(ruta, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

/**
 * ① LAS FUENTES DEL SELLADOR — de la FIRMA REAL de `computeAlbaranContentHash`, no de una lista.
 * Si mañana el sellador gana un campo, aparece aquí solo.
 */
function fuentesDelSellador(nombreDelSellador = 'computeAlbaranContentHash') {
  const sf = arbol(F_SELLADOR);

  /** Los campos de un tipo literal `{ a: X; b: Y }`. */
  const camposDeLiteral = (tipo) => tipo.members
    .filter((m) => ts.isPropertySignature(m) && m.name)
    .map((m) => m.name.getText(sf));

  /**
   * ⚠️ EL PARÁMETRO PUEDE VENIR DE DOS FORMAS, Y LAS DOS DICEN LO MISMO:
   *
   *     computeAlbaranContentHash(params: { numero: string; … })    ← literal EN LÍNEA
   *     computeAlbaranContentHash(params: AlbaranContenidoParams)   ← tipo CON NOMBRE
   *
   * Esto solo entendía la primera, y SCRUM-300 (C5) pasó a la segunda porque el despacho por
   * versión que exige SCRUM-369 necesitaba dar nombre al tipo. Al mergear C5: cero fuentes
   * derivadas → ninguna columna exigida → este guard habría pasado en VERDE. Y ese verde concreto
   * acusa de MANIPULADOS a albaranes intactos, sobre toda la población a la vez.
   *
   * No llegó a pasar porque el SUELO se plantó. Pero el arreglo no es tocar el suelo: es que el
   * derivador mire el HECHO —qué campos entran al sellador— y no la FORMA de escribirlos.
   *
   * Devuelve `null` cuando NO SUPO leer (nombre sin resolver en este fichero), que no es lo mismo
   * que «no hay campos»: el suelo tiene que poder distinguirlos.
   */
  const camposDelTipo = (tipo) => {
    if (!tipo) return null;
    if (ts.isTypeLiteralNode(tipo)) return camposDeLiteral(tipo);
    if (ts.isTypeReferenceNode(tipo)) {
      const nombre = tipo.typeName.getText(sf);
      let hallado = null;
      const buscar = (n) => {
        if (ts.isInterfaceDeclaration(n) && n.name.text === nombre) {
          hallado = n.members.filter((m) => ts.isPropertySignature(m) && m.name).map((m) => m.name.getText(sf));
          return;
        }
        if (ts.isTypeAliasDeclaration(n) && n.name.text === nombre && ts.isTypeLiteralNode(n.type)) {
          hallado = camposDeLiteral(n.type);
          return;
        }
        ts.forEachChild(n, buscar);
      };
      buscar(sf);
      return hallado;
    }
    return null;
  };

  let campos = null;
  const visitar = (n) => {
    if (ts.isFunctionDeclaration(n) && n.name?.text === nombreDelSellador) {
      campos = camposDelTipo(n.parameters[0]?.type);
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  return campos ?? [];
}

/**
 * ② LO QUE PRODUCE EL ADAPTADOR (`entradaDesdeFilas`, SCRUM-371) y DE DÓNDE lo saca.
 * Devuelve `Map<campoDeContenido, textoDeLaExpresión>`.
 */
function produccionDelAdaptador() {
  const sf = arbol(F_ADAPTADOR);
  const out = new Map();
  const visitar = (n) => {
    if (ts.isFunctionDeclaration(n) && n.name?.text === 'entradaDesdeFilas') {
      const buscarContenido = (x) => {
        if (ts.isPropertyAssignment(x) && x.name.getText(sf) === 'contenido' && ts.isObjectLiteralExpression(x.initializer)) {
          for (const p of x.initializer.properties) {
            if (ts.isPropertyAssignment(p)) out.set(p.name.getText(sf), p.initializer.getText(sf).replace(/\s+/g, ' '));
          }
        }
        ts.forEachChild(x, buscarContenido);
      };
      buscarContenido(n);
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  return out;
}

/** ③ Las columnas del modelo `Albaran` en el esquema. El hecho que cambia con C5. */
function columnasDelAlbaran() {
  assert.ok(fs.existsSync(F_SCHEMA), '🔴 no encuentro prisma/schema.prisma');
  const texto = fs.readFileSync(F_SCHEMA, 'utf8');
  const i = texto.indexOf('model Albaran {');
  assert.notEqual(i, -1, '🔴 no encuentro `model Albaran` en el esquema: el guard no puede medir nada.');
  const bloque = texto.slice(i, texto.indexOf('\n}', i));
  return new Set(
    bloque.split('\n').slice(1)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('//') && !l.startsWith('@@') && !l.startsWith('///'))
      .map((l) => l.split(/\s+/)[0])
      .filter((n) => /^[a-zA-Z_]\w*$/.test(n)),
  );
}

/** ④ El `select` con el que el paquete de evidencias lee los albaranes. */
function selectDelPaquete() {
  const sf = arbol(F_PAQUETE);
  const campos = new Set();
  const visitar = (n) => {
    if (
      ts.isCallExpression(n) &&
      ts.isPropertyAccessExpression(n.expression) &&
      n.expression.name.text === 'findMany' &&
      ts.isPropertyAccessExpression(n.expression.expression) &&
      n.expression.expression.name.text === 'albaran'
    ) {
      const arg = n.arguments[0];
      if (arg && ts.isObjectLiteralExpression(arg)) {
        for (const p of arg.properties) {
          if (ts.isPropertyAssignment(p) && p.name.getText(sf) === 'select' && ts.isObjectLiteralExpression(p.initializer)) {
            for (const s of p.initializer.properties) {
              if (ts.isPropertyAssignment(s)) campos.add(s.name.getText(sf));
            }
          }
        }
      }
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  return campos;
}

/**
 * El ÚNICO sitio donde los dos vocabularios difieren, y por eso está a la vista.
 *
 * El sellador llama `obra` a lo que el adaptador entrega como `jobDireccion` (y, con C5, también
 * como `lugarEntrega`). No es una lista de fuentes —ésas se derivan—: es la traducción entre dos
 * nombres del MISMO dato, y tenerla escrita es lo que permite que todo lo demás sea derivado.
 */
const RENOMBRES = { obra: ['jobDireccion', 'lugarEntrega'] };

// ── SUELO ────────────────────────────────────────────────────────────────────────────────────

test('SCRUM-297 · SUELO: la firma del sellador se lee, y tiene fuentes', () => {
  const fuentes = fuentesDelSellador();
  assert.ok(fuentes.length >= 8,
    `🔴 solo se han derivado ${fuentes.length} fuentes de la firma de \`computeAlbaranContentHash\`.\n\n` +
    '  «Cero fuentes» y «no supe leer la firma» son el MISMO verde, y aquí ese verde acusa de\n' +
    '  manipulación a documentos intactos. Si el sellador cambió de forma, arregla el derivador\n' +
    '  ANTES de creerte nada de lo de abajo.');
});

test('SCRUM-297 · SUELO: el adaptador y el esquema también se leen', () => {
  assert.ok(produccionDelAdaptador().size >= 8, '🔴 el adaptador no se ha podido leer: el guard no compara nada.');
  const cols = columnasDelAlbaran();
  assert.ok(cols.size >= 10, `🔴 solo se han leído ${cols.size} columnas del modelo Albaran.`);
  assert.ok(cols.has('numero') && cols.has('lineas'), '🔴 el lector del esquema no ve columnas que sí existen.');
  assert.ok(selectDelPaquete().size >= 5, '🔴 no se ha encontrado el `select` de albaranes del paquete.');
});

// ── ① TODA FUENTE DEL SELLADOR TIENE QUIEN SE LA DÉ ──────────────────────────────────────────

test('SCRUM-297 · toda fuente del SELLADOR la produce el adaptador', () => {
  const producidas = produccionDelAdaptador();
  const huerfanas = fuentesDelSellador().filter((f) => {
    if (producidas.has(f)) return false;
    const alias = RENOMBRES[f] ?? [];
    return !alias.some((a) => producidas.has(a));
  });

  assert.deepEqual(huerfanas, [],
    `🔴 EL SELLADOR METE FUENTES QUE NADIE LE DA AL VERIFICADOR: ${huerfanas.join(', ')}.\n\n` +
    '  El hash se sella CON esa fuente y se recalcula SIN ella: el paquete de evidencias declarará\n' +
    '  manipulados documentos intactos, y lo hará sobre la población entera a la vez.\n\n' +
    '  Si la fuente es nueva y legítima: dásela al adaptador (`entradaDesdeFilas`) y asegúrate de\n' +
    '  que su columna entra en el `select` del paquete. Si solo cambia de nombre, decláralo en\n' +
    '  `RENOMBRES` con su motivo.');
});

// ── ② LA RUEDA: lo que el adaptador lee del albarán, el paquete lo selecciona ────────────────

test('SCRUM-297 · el paquete SELECCIONA todas las columnas que el adaptador va a leer', () => {
  const producidas = produccionDelAdaptador();
  const columnas = columnasDelAlbaran();
  const seleccionadas = selectDelPaquete();

  // De cada expresión del adaptador se extrae lo que lee de la FILA del albarán (`a.x`).
  const leidasDelAlbaran = new Set();
  for (const expr of producidas.values()) {
    for (const m of expr.matchAll(/\ba\s*[?]?\.\s*(\w+)/g)) leidasDelAlbaran.add(m[1]);
  }
  assert.ok(leidasDelAlbaran.size >= 4,
    `🔴 solo se han extraído ${leidasDelAlbaran.size} lecturas de la fila del albarán: el extractor ` +
    'no está viendo el adaptador y este guard pasaría en verde sin comparar nada.');

  const faltan = [...leidasDelAlbaran]
    // ⚠️ SOLO SE EXIGE LO QUE EXISTE EN EL ESQUEMA. Ésta es la condición que hace de rueda:
    // `lugarEntrega` la lee el adaptador y HOY no existe como columna —pedirla reventaría la
    // consulta—, así que no se exige. En cuanto C5 la añada al esquema, este guard se pone rojo
    // hasta que el paquete la seleccione.
    .filter((c) => columnas.has(c))
    .filter((c) => !seleccionadas.has(c))
    .sort();

  assert.deepEqual(faltan, [],
    `🔴 EL PAQUETE DE EVIDENCIAS NO SELECCIONA: ${faltan.join(', ')}.\n\n` +
    '  El adaptador va a leer esas columnas para recalcular el hash, y va a encontrarlas vacías.\n' +
    '  Resultado: el paquete declara MANIPULADOS albaranes intactos — la peor salida posible de\n' +
    '  esta herramienta, y sobre toda la población a la vez.\n\n' +
    '  Añádelas al `select` de `db.albaran.findMany` en `paquete.repo.ts`. Si acabas de mergear\n' +
    '  SCRUM-300 (C5), esto es exactamente lo que este guard existía para recordarte, y hay que\n' +
    '  hacerlo también en el `lectorPrisma` del barrido (SCRUM-371).');
});

test('SCRUM-297 · CONTROL POSITIVO: con las fuentes de hoy, el paquete está completo', () => {
  // La cara positiva del anterior: sin ella, «no faltan columnas» daría igual de verde si el
  // extractor no encontrara ninguna. Aquí se nombran las que HOY tienen que estar.
  const seleccionadas = selectDelPaquete();
  for (const c of ['numero', 'fecha', 'modoValoracion', 'lineas', 'notas', 'evidenciaFirma']) {
    assert.ok(seleccionadas.has(c),
      `🔴 el paquete no selecciona «${c}», que el adaptador necesita HOY para recalcular el hash.`);
  }
  // Y la condición de la rueda, comprobada como tal: hoy el adaptador lee `lugarEntrega` y la
  // columna no existe. El día que exista, el test de arriba se pone rojo solo.
  const columnas = columnasDelAlbaran();
  const adaptadorLeeLugarEntrega = [...produccionDelAdaptador().values()].some((e) => /\ba\s*[?]?\.\s*lugarEntrega/.test(e));
  assert.equal(adaptadorLeeLugarEntrega, true,
    '🔴 el adaptador ha dejado de leer `lugarEntrega`: la rueda de este guard se apoya en que la lee.');
  if (columnas.has('lugarEntrega')) {
    assert.ok(seleccionadas.has('lugarEntrega'),
      '🔴 SCRUM-300 (C5) ya está en el esquema y el paquete NO selecciona `lugarEntrega`. Es el ' +
      'aviso que dejé escrito en `docs/master/SCRUM-297.md`, ahora exigido: añádela aquí y en el ' +
      '`lectorPrisma` del barrido, o los sobres v:2 saldrán como manipulados.');
  }
});
