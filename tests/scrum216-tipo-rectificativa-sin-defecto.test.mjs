// SCRUM-216 (ampliación) · UNA RECTIFICATIVA NO PUEDE SALIR CON UN TipoRectificativa POR DEFECTO.
//
// POR QUÉ ESTE GUARD EXISTE, Y POR QUÉ ES PEOR QUE EL DE OMITIR
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

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..');
const FUENTE = path.join(RAIZ, 'src', 'modules', 'fiscal', 'verifactu', 'registro.builder.ts');
const CAMPO = 'tipoRectificativa';

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
  // Los dos valores, para que el guard no quede atado a ninguno: si alguien cableara un
  // defecto 'I', este caso con 'S' seguiría pasando y sería ① quien lo cazara arriba.
  // SCRUM-209 (29-jul-2026): el prefijo pasa de `sf:` a `sum1:` al unificar el alias del
  // namespace en `registro.builder.ts` — ese fichero declara `xmlns:sum1` en sus TRES raíces
  // y no declaraba `xmlns:sf` en ninguna, o sea que `sf:` salía SIN VINCULAR (XML mal
  // formado). Este test CAZÓ el cambio al resolver el conflicto 209↔main, que es exactamente
  // lo que se le pide. Lo que se ajusta aquí es la ASERCIÓN, no el guard: la capa ① (la R1
  // sin tipo sigue lanzando) y la capa ② (AST, no suple con ningún literal) están intactas y
  // son las que protegen de verdad contra el defecto inventado.
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
