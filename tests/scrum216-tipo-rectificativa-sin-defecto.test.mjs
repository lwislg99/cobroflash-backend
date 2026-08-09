// SCRUM-216 · TODO lo de `TipoRectificativa`, en UN SOLO FICHERO.
//
// ⚠️ CONSOLIDACIÓN (30-jul-2026). Esto vivía en DOS ficheros que se mergearon por caminos
// distintos: éste (guard AST + comportamiento, vía `main`) y `scrum216-tipo-rectificativa.test.mjs`
// (los dos modos, XSD, 1118/1119, orden de elementos y el ratchet, que llegó con SCRUM-215).
// Convivían sin chocar y **los dos pasaban**, así que la duplicación no daba rojo: se quedaba
// callada, que es exactamente el patrón «dos listas que deben cuadrar y nada las ata». El otro
// fichero se ELIMINA en este mismo commit; aquí no se ha perdido ni un assert de los suyos.
//
// LAS CUATRO COSAS QUE VIGILA, y fallan por motivos distintos:
//   ① COMPORTAMIENTO del constructor — una R1 sin tipo LANZA.
//   ② FORMA (AST) — no reaparece un literal por defecto en el módulo.
//   ③ SALIDA REAL — los dos modos emiten lo que dicen, validan contra el XSD de la AEAT y
//     respetan el orden de elementos (1118 / 1119).
//   ④ RATCHET — la constante que decide el modo no se mueve sin que alguien lo vea.
//
// POR QUÉ EL GUARD ① EXISTE, Y POR QUÉ ES PEOR QUE EL DE OMITIR
//
// `buildRegistroAlta` emitía `${p.tipoRectificativa ?? 'I'}`. Nadie lo llamaba desde producción
// —solo un test y `scripts/gen-registros-sample.mjs`—, así que parecía inofensivo. No lo es, y
// la comparación con el hueco hermano lo deja claro:
//
//   · OMITIR el campo garantiza el RECHAZO (AEAT 1114). Un rechazo SE VE: vuelve, se registra,
//     alguien lo mira.
//   · Un DEFECTO cableado INVENTA la calificación fiscal, la AEAT la ACEPTA, y queda sellada en
//     la huella encadenada — que por la regla 29 ya no se edita ni se borra: solo se corrige con
//     otra rectificativa. Una declaración incorrecta ACEPTADA no se ve nunca.
//
// O sea que el `??` no era un atajo cómodo: era la única de las dos salidas malas que no deja
// rastro. Y el valor no es cosmético — `S` (sustitución) e `I` (diferencias) declaran hechos
// distintos y arrastran `ImporteRectificacion` en sentidos opuestos (1118 lo exige para S, 1119
// lo prohíbe para el resto). Cuál procede es el dictamen P12, que hoy además está en
// contradicción con el código.
//
// CÓMO SE VIGILA, en dos capas que fallan por motivos distintos:
//
//   ① COMPORTAMIENTO — construir una R1 sin el tipo tiene que LANZAR. Es la capa que importa:
//     no mira cómo está escrito el código, mira qué hace. Da rojo con `?? 'I'`, con `?? 'S'`,
//     con un ternario o con cualquier otra forma de defecto, porque todas comparten la misma
//     consecuencia observable: devolver un XML en vez de parar.
//   ② FORMA (AST) — que no reaparezca un literal de defecto para `tipoRectificativa` en NINGÚN
//     punto del módulo. Cubre el caso que ① no vería: un defecto escondido dentro del helper
//     que sí lanza en otra rama.
//
// ⚠️ AST y no `grep` en la capa ②: este fichero está lleno de las palabras que vigila
// (`tipoRectificativa`, `'I'`, `??`) porque son las que hay que escribir para explicar la
// prohibición. Un guard de texto se cazaría a sí mismo — SCRUM-176/168/3/193, y el motivo de
// que exista `_guard-texto.mjs`.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { buildRegistroAlta } from '../dist/modules/fiscal/verifactu/registro.builder.js';
import { validarRegistrosXml } from './_xsd-verifactu.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..');
const FUENTE = path.join(RAIZ, 'src', 'modules', 'fiscal', 'verifactu', 'registro.builder.ts');
const CAMPO = 'tipoRectificativa';

// Datos del productor: los exige el guard fail-closed de `verifactu.service.ts` para construir
// el XML. Valores de QA, nunca reales.
// SCRUM-247: aqui se fijaban las cinco `process.env.VERIFACTU_*` del PRODUCTOR. Ya no hacen
// nada: son CONSTANTES del repo (`src/modules/fiscal/verifactu/productor.ts`), no configuracion.
// Llegaron a este fichero con la consolidacion de SCRUM-216, desde el test que se borro.
// Se retiran en vez de dejarlas: una asignacion inerte se lee como si tuviera efecto.

const sistema = {
  nombreRazonProductor: 'PRODUCTOR DEMO SL', nifProductor: 'B12345678',
  nombreSistema: 'YaQu', idSistema: '01', version: '1.0.0', numeroInstalacion: '1',
  soloVerifactu: 'S', multiOT: 'S', indicadorMultiplesOT: 'S',
};

/** Una R1 completa salvo por el tipo, que se decide en cada test. */
const rectificativa = (tipoRectificativa) => ({
  idEmisorFactura: 'B12345678',
  numSerieFactura: '2026-CF-R-001',
  fechaExpedicion: '11-06-2026',
  nombreRazonEmisor: 'Demo SL',
  tipoFactura: 'R1',
  rectifica: { numSerieFactura: '2026-CF-001', fechaExpedicion: '11-06-2026' },
  ...(tipoRectificativa ? { tipoRectificativa } : {}),
  descripcionOperacion: 'Rectificación',
  destinatario: { nombreRazon: 'Cliente', nif: '12345678Z' },
  desglose: [{ claveRegimen: '01', calificacion: 'S1', tipoImpositivo: '21', baseImponible: '-350.00', cuotaRepercutida: '-73.50' }],
  cuotaTotal: '-73.50',
  importeTotal: '-423.50',
  encadenamiento: { primerRegistro: true },
  sistema,
  fechaHoraHusoGenRegistro: '2026-06-11T10:00:00+02:00',
  huella: 'A'.repeat(64),
});

// ── ① COMPORTAMIENTO ──────────────────────────────────────────────────────────────────────
test('SCRUM-216 · una R1 SIN TipoRectificativa no se construye: bloquea', () => {
  assert.throws(
    () => buildRegistroAlta(rectificativa(null)),
    /tipo_rectificativa_ausente/,
    '🔴 UNA RECTIFICATIVA SE HA CONSTRUIDO SIN QUE NADIE DIJERA SU TIPO.\n\n' +
      '  Si esto pasa, en algún punto hay un valor por defecto. Y un defecto aquí no es un\n' +
      '  atajo: es una calificación fiscal inventada que la AEAT ACEPTA y que queda sellada\n' +
      '  en la huella — a diferencia de omitir el campo, que al menos se rechaza y se ve.\n\n' +
      '  El valor se pasa explícitamente o no se construye el registro. Cuál procede (S o I)\n' +
      '  lo decide el dictamen P12, no este constructor.',
  );
});

test('SCRUM-216 · con el tipo dado explícitamente, se emite ESE y no otro', () => {
  // SCRUM-209: el prefijo pasa de `sf:` a `sum1:` al unificar el alias del namespace en
  // `registro.builder.ts` (ese fichero declara `xmlns:sum1` en sus tres raices y no declaraba
  // `xmlns:sf` en ninguna). Se ajusta la ASERCION, no el guard: las capas ① y ② siguen intactas.
  // Los dos valores, para que el guard no quede atado a ninguno: si alguien cableara un
  // defecto 'I', este caso con 'S' seguiría pasando y sería ① quien lo cazara arriba.
  for (const tipo of ['S', 'I']) {
    const xml = buildRegistroAlta(rectificativa(tipo));
    assert.ok(
      xml.includes(`<sum1:TipoRectificativa>${tipo}</sum1:TipoRectificativa>`),
      `🔴 se pidió TipoRectificativa ${tipo} y el XML no lo lleva`,
    );
  }
});

test('SCRUM-216 · una factura NORMAL (no rectificativa) no exige el campo ni lo emite', () => {
  const xml = buildRegistroAlta({ ...rectificativa(null), tipoFactura: 'F1', rectifica: undefined });
  assert.ok(!xml.includes('TipoRectificativa'),
    '🔴 una F1 no lleva TipoRectificativa; exigirlo aquí sería ruido, no protección');
});

// ── ② FORMA (AST) ─────────────────────────────────────────────────────────────────────────

const sf = ts.createSourceFile(FUENTE, fs.readFileSync(FUENTE, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

/** ¿Menciona este subárbol el campo vigilado? (identificador, no texto). */
function mencionaCampo(nodo) {
  let visto = false;
  const visitar = (n) => {
    if (visto) return;
    if (ts.isIdentifier(n) && n.text === CAMPO) visto = true;
    else ts.forEachChild(n, visitar);
  };
  visitar(nodo);
  return visto;
}

/** ¿Hay un literal de cadena en este subárbol? (el valor que se estaría inventando). */
function tieneLiteral(nodo) {
  let visto = false;
  const visitar = (n) => {
    if (visto) return;
    if (ts.isStringLiteral(n)) visto = true;
    else ts.forEachChild(n, visitar);
  };
  visitar(nodo);
  return visto;
}

/**
 * ¿Es esta expresión un DEFECTO para el campo? — `a ?? 'I'`, `a || 'I'`, `a ? a : 'I'`.
 *
 * La regla mira la ESTRUCTURA, no «menciona el campo y hay un literal cerca», que es la versión
 * ingenua y marca de más: `p.tipoRectificativa === 'S' ? bloque : ''` es una COMPARACIÓN
 * legítima, no un defecto, y un guard que da rojo contra código correcto acaba desactivado —
 * que es la forma más silenciosa de perder un guard.
 *
 * Por eso se exige que el campo esté en el sitio que lo convierte en defecto: a la IZQUIERDA
 * del `??`/`||` (el valor que se está supliendo), o —en el ternario— en la condición Y en una
 * de las ramas, con la otra aportando el literal.
 */
function esDefectoDelCampo(n) {
  if (ts.isBinaryExpression(n)) {
    const op = n.operatorToken.kind;
    if (op !== ts.SyntaxKind.QuestionQuestionToken && op !== ts.SyntaxKind.BarBarToken) return false;
    return mencionaCampo(n.left) && tieneLiteral(n.right);
  }
  if (ts.isConditionalExpression(n)) {
    const ramas = [n.whenTrue, n.whenFalse];
    return mencionaCampo(n.condition)
      && ramas.some((r) => tieneLiteral(r))
      && ramas.some((r) => mencionaCampo(r));
  }
  return false;
}

function defectosParaElCampo(fuente = sf) {
  const out = [];
  const visitar = (n) => {
    if (esDefectoDelCampo(n)) {
      out.push({
        linea: fuente.getLineAndCharacterOfPosition(n.getStart(fuente)).line + 1,
        texto: n.getText(fuente).replace(/\s+/g, ' ').slice(0, 100),
      });
    }
    ts.forEachChild(n, visitar);
  };
  ts.forEachChild(fuente, visitar);
  return out;
}

const parsear = (codigo) =>
  ts.createSourceFile('ficticio.ts', codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

test('SCRUM-216 · el analizador ve los defectos y NO marca lo legítimo (suelo anti-verde-hueco)', () => {
  // ── Control positivo. Sin esto, el día que el parser falle o el campo se renombre, la capa ②
  // devolvería 0 y pasaría en verde sin haber mirado nada. Un verde hueco es peor que un rojo.
  // Las tres formas de suplir el valor, y NINGUNA anclada al literal 'I':
  for (const forma of [
    `const x = p.${CAMPO} ?? 'I';`,
    `const x = p.${CAMPO} || 'S';`,
    `const x = p.${CAMPO} ? p.${CAMPO} : 'X';`,
  ]) {
    assert.equal(defectosParaElCampo(parsear(forma)).length, 1,
      `🔴 el analizador no reconoce este defecto: está ciego → ${forma}`);
  }

  // ── Control NEGATIVO 1: comparar no es suplir. Si esto diera rojo, el guard estorbaría en
  // código correcto y alguien acabaría borrándolo — la forma más silenciosa de perder un guard.
  assert.deepEqual(defectosParaElCampo(parsear(`const b = p.${CAMPO} === 'S' ? bloque : '';`)), [],
    '🔴 marca una COMPARACIÓN legítima como si fuera un defecto');

  // ── Control NEGATIVO 2: el nombre en un COMENTARIO no es un nodo. Si esto fallara, este mismo
  // fichero —lleno de la palabra que vigila— se cazaría a sí mismo.
  assert.deepEqual(defectosParaElCampo(parsear(`// nunca escribas ${CAMPO} ?? 'I' aquí\nconst y = 1;`)), [],
    '🔴 el guard mira TEXTO: se cazaría a sí mismo y sería inmantenible');
});

// ── ③ SALIDA REAL · los dos modos, contra el XSD de la AEAT ───────────────────────────────
// (injertado de `scrum216-tipo-rectificativa.test.mjs` al consolidar — ni un assert perdido)
//
// 🔴 LA CONTRADICCIÓN QUE HAY DETRÁS, porque explica por qué existen los TRES modos:
//   · P12 del expediente: nuestras R1 «consignan el total corregido» → sería **S**.
//   · El código: `invoicesAdmin.routes.ts` crea la R1 con `total: -original.total` y las
//     líneas negadas — el delta, no el total corregido → es **I**.
// El fundador resolvió (30-jul-2026) emitir **`I`**, no eligiendo doctrina fiscal sino haciendo
// que la etiqueta coincida con lo que el documento ya contiene. El máster reserva la
// confirmación al dictamen (`YAQU_MASTER.md:1328-1331`), y de eso se encarga el ratchet de ④.

const merchantXml = {
  id: 1, country: 'ES', taxId: 'B12345678', legalName: 'Fontanería QA S.L.', name: 'Fontanería QA',
};
const CLIENTE = { name: 'Cliente QA', taxId: 'A11111111' }; // con NIF: aquí se prueba la R1, no el 1189

/** La factura ORIGINAL rectificada: 100 € de base al 21 % → cuota 21 €. */
const ORIGINAL = {
  number: '2026-CF-001',
  createdAt: new Date('2026-03-15T10:00:00Z'),
  lines: [{ concept: 'Reparación', qty: 1, price: 100, tax: 0.21 }],
};

/** La R1 tal y como la CREA el producto hoy: el original en negativo (el delta). */
const mkR1 = (over = {}) => ({
  number: '2026-CF-R-001', createdAt: new Date('2026-04-01T10:00:00Z'),
  total: '-121.00', type: 'R1',
  lines: [{ concept: 'Reparación', qty: 1, price: -100, tax: 0.21 }],
  vfHash: 'A'.repeat(64), vfPrevHash: null,
  customer: CLIENTE,
  rectifies: ORIGINAL,
  ...over,
});

const fakePrisma = (invoices) => ({
  merchant: { findUnique: async () => merchantXml },
  invoice: { findMany: async (a) => (a?.where?.vfHash ? invoices.filter((i) => i.vfHash) : invoices) },
});

const build = async (invoices, opts) => {
  const { buildVerifactuRegistrosXml } = await import('../dist/modules/invoicing/domain/verifactu.service.js');
  return buildVerifactuRegistrosXml({ merchantId: 7, year: 2026 }, fakePrisma(invoices), opts);
};

test('SCRUM-216 · POR DEFECTO la R1 se declara, y se declara como I', async () => {
  // El modo por defecto ya no bloquea: `MODO_TIPO_RECTIFICATIVA = 'INCREMENTAL_I'`.
  const { xml, count, excluidos } = await build([mkR1()]);
  assert.equal(count, 1, '🔴 la R1 ya no se excluye: la decisión del fundador es declararla');
  assert.deepEqual(excluidos, []);
  assert.match(xml, /<sum1:TipoRectificativa>I<\/sum1:TipoRectificativa>/);
});

test('SCRUM-216 · el modo SIN_CONFIRMAR sigue existiendo y sigue EXCLUYENDO', async () => {
  // Se conserva el camino de bloqueo aunque ya no sea el de por defecto: si el dictamen
  // obligara a volver a parar, la salida tiene que seguir construida y probada.
  const { count, excluidos } = await build([mkR1()], { modoTipoRectificativa: 'SIN_CONFIRMAR' });
  assert.equal(count, 0);
  assert.equal(excluidos[0].number, '2026-CF-R-001');
  assert.match(excluidos[0].motivo, /1114/, 'el motivo nombra el error que se evita');
  assert.match(excluidos[0].motivo, /P12/, 'y la fuente que tiene que confirmarlo');
});

test('SCRUM-216 · una factura NORMAL no se ve afectada', async () => {
  const f1 = { ...mkR1(), number: '2026-CF-002', type: 'F1', total: '121.00',
    lines: ORIGINAL.lines, rectifies: null };
  const { count, excluidos } = await build([f1]);
  assert.equal(count, 1);
  assert.deepEqual(excluidos, []);
});

test('SCRUM-216 · modo I (incremental): emite TipoRectificativa I y NO ImporteRectificacion', async () => {
  const { xml, count } = await build([mkR1()], { modoTipoRectificativa: 'INCREMENTAL_I' });
  assert.equal(count, 1);
  assert.match(xml, /<sum1:TipoRectificativa>I<\/sum1:TipoRectificativa>/);
  assert.doesNotMatch(xml, /ImporteRectificacion/,
    '🔴 AEAT 1119: si NO es por sustitución, ImporteRectificacion no debe llevar valor');

  const { valido, errores } = await validarRegistrosXml(xml, 'r1-incremental.xml');
  assert.equal(valido, true, `🔴 la R1 incremental no valida:\n${errores.join('\n')}`);
});

test('SCRUM-216 · modo S (sustitutiva): emite TipoRectificativa S CON ImporteRectificacion', async () => {
  const { xml, count } = await build([mkR1()], { modoTipoRectificativa: 'SUSTITUTIVA_S' });
  assert.equal(count, 1);
  assert.match(xml, /<sum1:TipoRectificativa>S<\/sum1:TipoRectificativa>/);
  // AEAT 1118: el bloque es OBLIGATORIO, con la base y cuota SUSTITUIDAS — las de la factura
  // RECTIFICADA (100,00 / 21,00), no las de la R1.
  assert.match(xml, /<sum1:BaseRectificada>100\.00<\/sum1:BaseRectificada>/);
  assert.match(xml, /<sum1:CuotaRectificada>21\.00<\/sum1:CuotaRectificada>/);

  const { valido, errores } = await validarRegistrosXml(xml, 'r1-sustitutiva.xml');
  assert.equal(valido, true, `🔴 la R1 sustitutiva no valida:\n${errores.join('\n')}`);
});

test('SCRUM-216 · el ORDEN del XSD: TipoRectificativa antes de FacturasRectificadas, y el importe después', async () => {
  const { xml } = await build([mkR1()], { modoTipoRectificativa: 'SUSTITUTIVA_S' });
  const i = (t) => xml.indexOf(t);
  assert.ok(i('<sum1:TipoFactura>') < i('<sum1:TipoRectificativa>'), 'TipoRectificativa va tras TipoFactura');
  assert.ok(i('<sum1:TipoRectificativa>') < i('<sum1:FacturasRectificadas>'), 'y antes de FacturasRectificadas');
  assert.ok(i('<sum1:FacturasRectificadas>') < i('<sum1:ImporteRectificacion>'), 'el importe va después');
});

test('SCRUM-216 · modo S sin poder calcular el importe sustituido: BLOQUEA, no emite S a medias', async () => {
  // Si la factura rectificada no tiene líneas, no hay base ni cuota sustituidas. Emitir S sin
  // el bloque es un 1118 seguro; emitirlo con ceros sería inventarse la declaración.
  const sinLineas = mkR1({ rectifies: { ...ORIGINAL, lines: null } });
  const { count, excluidos } = await build([sinLineas], { modoTipoRectificativa: 'SUSTITUTIVA_S' });
  assert.equal(count, 0);
  assert.match(excluidos[0].motivo, /1118/);
});

// ── ④ EL RATCHET ──────────────────────────────────────────────────────────────────────────

test('SCRUM-216 · la constante sigue en INCREMENTAL_I (y moverla exige el dictamen)', async () => {
  const { MODO_TIPO_RECTIFICATIVA } = await import('../dist/modules/fiscal/verifactu/registro.builder.js');
  assert.equal(
    MODO_TIPO_RECTIFICATIVA,
    'INCREMENTAL_I',
    '🔴 SE HA MOVIDO EL MODO DE `TipoRectificativa`.\n\n' +
      '  `I` está puesto por decisión del fundador (30-jul-2026) y NO es una elección de\n' +
      '  doctrina fiscal: el producto ya emite el DELTA (`invoicesAdmin.routes.ts` niega\n' +
      '  líneas y total), y un documento cuyos importes son la diferencia es por definición\n' +
      '  una rectificativa por diferencias. La etiqueta coincide con el contenido.\n\n' +
      '  El máster reserva la confirmación al dictamen del asesor (YAQU_MASTER.md:1328-1331)\n' +
      '  y P12 sigue diciendo lo contrario que el código. Si vienes a poner `SUSTITUTIVA_S`,\n' +
      '  no basta con esta constante: hay que cambiar cómo se CREAN las R1 para que consignen\n' +
      '  el total corregido en vez del negativo. Una S que declare el delta consigna un\n' +
      '  importe que no es el corregido, y eso queda sellado en la huella.',
  );
});

test('SCRUM-216 · el módulo no suple `tipoRectificativa` con ningún literal', () => {
  const defectos = defectosParaElCampo();
  assert.deepEqual(
    defectos.map((d) => `registro.builder.ts:${d.linea}`),
    [],
    '🔴 HA VUELTO UN VALOR POR DEFECTO PARA `TipoRectificativa`.\n\n' +
      defectos.map((d) => `    registro.builder.ts:${d.linea}\n      ${d.texto}`).join('\n') +
      '\n\n  Da igual qué literal sea: el problema no es CUÁL se elige, es que lo elija el\n' +
      '  código. S e I declaran hechos distintos ante la AEAT y arrastran\n' +
      '  `ImporteRectificacion` en sentidos opuestos (1118 lo exige para S, 1119 lo prohíbe\n' +
      '  para el resto).\n\n' +
      '  Si el llamador no sabe el tipo, la salida correcta es BLOQUEAR (que es lo que hace\n' +
      '  `exigirTipoRectificativa`), no rellenarlo. Omitir el campo se rechaza y se ve; un\n' +
      '  defecto se acepta y queda sellado en la huella para siempre.',
  );
});
