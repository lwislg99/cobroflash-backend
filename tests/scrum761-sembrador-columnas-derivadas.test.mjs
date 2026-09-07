// tests/scrum761-sembrador-columnas-derivadas.test.mjs — SCRUM-761
//
// EL CATÁLOGO DE LA DEMO ERA INVISIBLE AL AUTOCOMPLETADO.
//
// `seed-demo.mjs` creaba los 8 productos con `prisma.product.create({ merchantId, name, price })`
// y se dejaba `nameSearch`, que es por donde `searchProducts` FILTRA. Medido sobre la BD de
// desarrollo antes de tocar nada (8/8 filas con `name_search` NULL):
//
//     «sustitución de» → 0 · «desatasco de» → 0 · «instalación de» → 0
//     y, control positivo, un producto dado de alta por `createProduct` → 1 ✅
//
// El segundo daño iba debajo: en Postgres los NULL no chocan entre sí, así que sobre esas 8
// filas `@@unique([merchantId, nameSearch])` no vigilaba nada — duplicar un producto sembrado
// NO lanzaba P2002, mientras dos altas por el camino real SÍ. Una base de desarrollo cuyo estado
// deja inoperante la restricción que se está midiendo no es una base de pruebas.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// QUÉ VIGILA ESTE GUARD, Y QUÉ NO
//
// NO comprueba que la búsqueda devuelva filas: eso necesita una BD y se midió a mano (arriba).
// Vigila la CAUSA, que es estática y no caduca: que ningún sembrador escriba a mano un modelo
// cuyo alta real deriva columnas. Mientras `seed-demo` llame a `createProduct`, una columna
// derivada NUEVA entra en el demo el día que entra en el alta, sin que nadie se acuerde — que
// es justo lo que este defecto demostró que no pasa solo.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { columnasDerivadas, escriturasDeSembrador } from './_censo-columnas-derivadas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const SEMBRADORES = ['scripts/seed-demo.mjs', 'scripts/seed-video.mjs'];

/**
 * HUECOS DECLARADOS — columnas derivadas que un sembrador NO escribe, y por qué está bien.
 *
 * 🔴 CADA EXENCIÓN TRAE SU COMPROBACIÓN, y no es adorno. Una lista de excepciones escrita a mano
 * es una PREDICCIÓN sobre código que se mueve: el día que `normalizarModoDireccionObra` gane un
 * valor por defecto, omitir el campo dejará de dar la misma fila y esta lista seguiría diciendo
 * que sí, en silencio y para siempre. Así que el motivo se EJECUTA (test de más abajo): si deja
 * de ser cierto, el guard se pone rojo por la exención, no por el sembrador.
 *
 * `ausenteEsNull`: el motivo es que el camino real, ante una entrada AUSENTE, escribe `null` —
 * exactamente lo que produce omitir el campo. La fila sembrada y la real son la misma fila.
 * `muestra` es el CONTROL POSITIVO de esa comprobación: una función clavada en `null` pasaría
 * el `f(undefined) === null` sin ser cierto el motivo, y justificaría cualquier hueco.
 */
const HUECOS_DECLARADOS = [
  {
    modelo: 'quote',
    campo: 'shippingAddressMode',
    motivo: 'El alta real ante entrada ausente escribe null; omitirlo produce LA MISMA fila.',
    ausenteEsNull: { modulo: 'dist/core/documentos/direccionObra.js', fn: 'normalizarModoDireccionObra', muestra: 'no_mostrar' },
  },
  {
    modelo: 'quote',
    campo: 'shippingAddress',
    motivo: 'Ídem: un presupuesto sin dirección de obra la tiene a null por el camino real.',
    ausenteEsNull: { modulo: 'dist/core/documentos/direccionObra.js', fn: 'normalizarDireccionObra', muestra: 'C/ Mayor 5' },
  },
  {
    modelo: 'albaran',
    campo: 'lugarEntrega',
    motivo: 'Ídem: un albarán nace sin lugar de entrega y el camino real le pone null.',
    ausenteEsNull: { modulo: 'dist/modules/jobs/domain/albaranFirmante.js', fn: 'normalizarLugarEntrega', muestra: 'Nave 3' },
  },
  {
    modelo: 'customer',
    campo: 'portalToken',
    // 🔴 ÉSTE SÍ ES UN HUECO DE VERDAD, y se declara para que quede ESCRITO, no para taparlo.
    motivo:
      'El alta real (`createCustomer`) escribe siempre un token y el sembrador no: los clientes ' +
      'del demo nacen con `portal_token` NULL. No se arregla en SCRUM-761 porque el árbol tiene ' +
      'camino de curación —`ensurePortalToken` genera el token la primera vez que se pide— y ' +
      'arreglarlo de paso, sin decisión del fundador, es el «arreglo al margen» que este ticket ' +
      'vino a no repetir. Lo comprobable es que ese camino de curación SIGA existiendo: si ' +
      'desaparece, el hueco deja de ser benigno y este guard tiene que enterarse.',
    curadoPor: { modulo: 'dist/modules/system/customerAdmin.js', fn: 'ensurePortalToken' },
  },
];

test('SCRUM-761 · el censo de columnas derivadas VE su caso de respuesta conocida', () => {
  const { derivadas, campos, ficheros, controlPositivo } = columnasDerivadas(RAIZ);

  // CERO SOBRE POBLACIÓN VACÍA NO ES UN CERO. Si no se leyó ningún fichero ni ningún campo, lo
  // que sigue no mide nada y hay que decirlo, no aprobarlo.
  assert.ok(ficheros > 0, `población vacía: 0 ficheros .ts bajo src/ → NO MEDIBLE`);
  assert.ok(campos > 0, `población vacía: 0 campos de create/upsert → NO MEDIBLE`);

  assert.ok(
    controlPositivo,
    'CENSO CIEGO: no ve `product.nameSearch`, que es la columna derivada de respuesta conocida ' +
      '(`createProduct` la escribe). Con el control positivo caído, una lista vacía significaría ' +
      '«no supe mirar», no «no hay ninguna» — y las dos se escriben igual.',
  );
  assert.ok(derivadas.length > 0, 'sin columnas derivadas y con el control positivo en pie: imposible');
});

test('SCRUM-761 · ningún sembrador escribe a mano un modelo con columnas derivadas', () => {
  const { derivadas } = columnasDerivadas(RAIZ);

  const declarado = (modelo, campo) =>
    HUECOS_DECLARADOS.some((h) => h.modelo === modelo && h.campo === campo);

  const faltas = [];
  for (const rel of SEMBRADORES) {
    const { porModelo, escrituras } = escriturasDeSembrador(RAIZ, rel);
    assert.ok(escrituras > 0, `población vacía: 0 escrituras en ${rel} → NO MEDIBLE`);

    for (const d of derivadas) {
      // El sembrador no crea ese modelo a mano (o lo crea por el alta real): nada que exigirle.
      if (!porModelo.has(d.modelo)) continue;
      if (porModelo.get(d.modelo).has(d.campo)) continue;
      if (declarado(d.modelo, d.campo)) continue;
      faltas.push(`${rel} → ${d.modelo}.${d.campo}  (el alta real la deriva en ${d.fichero}:${d.linea}: ${d.expr})`);
    }
  }

  assert.deepEqual(
    faltas,
    [],
    'Un sembrador crea a mano un modelo cuyo alta real DERIVA una columna, y no la escribe. La ' +
      'fila sembrada nace distinta de la que crearía el producto. Arréglalo llamando al alta ' +
      'real (escalón 1) o, si una imposibilidad MEDIDA lo impide, derivando el cálculo y ' +
      'declarando el hueco con su motivo en HUECOS_DECLARADOS:\n  ' + faltas.join('\n  '),
  );
});

test('SCRUM-761 · cada hueco declarado sigue mereciendo su exención', async () => {
  assert.ok(HUECOS_DECLARADOS.length > 0, 'población vacía: 0 huecos declarados → nada que comprobar');

  for (const h of HUECOS_DECLARADOS) {
    const quien = `${h.modelo}.${h.campo}`;
    assert.ok(h.motivo && h.motivo.length > 40, `${quien}: un hueco sin motivo escrito no es un hueco declarado`);

    if (h.ausenteEsNull) {
      const { modulo, fn, muestra } = h.ausenteEsNull;
      const m = await import(pathToFileURL(path.join(RAIZ, modulo)).href);
      const f = m[fn];
      assert.equal(typeof f, 'function', `${quien}: la exención cita \`${fn}\` en ${modulo}, y ahí no hay tal función`);

      // CONTROL POSITIVO PRIMERO: una función clavada en `null` pasaría la comprobación de abajo
      // sin que el motivo fuese cierto, y serviría para justificar cualquier hueco del fichero.
      assert.notEqual(
        f(muestra), null,
        `${quien}: CONTROL POSITIVO caído — \`${fn}(${JSON.stringify(muestra)})\` da null. La ` +
          'comprobación de esta exención no distingue «ausente → null» de «siempre null»: no mide.',
      );

      assert.equal(
        f(undefined), null,
        `${quien}: la exención dice que el camino real escribe null cuando la entrada falta, y ya ` +
          `no es cierto (\`${fn}(undefined)\` no da null). Omitir el campo ha dejado de producir la ` +
          'misma fila que el alta real: el sembrador tiene que escribirlo.',
      );
    }

    if (h.curadoPor) {
      const { modulo, fn } = h.curadoPor;
      const m = await import(pathToFileURL(path.join(RAIZ, modulo)).href);
      assert.equal(
        typeof m[fn], 'function',
        `${quien}: la exención se apoya en \`${fn}\` (${modulo}) como camino de curación, y ya no ` +
          'existe. Sin él, la fila sembrada se queda sin el campo para siempre.',
      );
    }
  }
});

test('SCRUM-761 · la normalización del catálogo tiene UNA sola definición en el árbol', () => {
  // El hermano del defecto: `seed-video.mjs` sí escribía `nameSearch`, pero con una SEGUNDA
  // normalización (`p.name.toLowerCase()`) que no quita diacríticos. Sembraba
  // `'sustitución de grifo monomando'` mientras la consulta se normaliza a `'sustitucion …'`,
  // así que teclear sin tilde tampoco encontraba esas filas. Dos definiciones del mismo hecho
  // se desincronizan solas; ésta ya lo estaba el día que se midió.
  //
  // Se pregunta al AST, no al texto: un comentario que EXPLIQUE la normalización vieja —los hay,
  // justo encima de la línea arreglada— sale igual que la normalización vieja ante un `grep`, y
  // dejaría este guard en rojo permanente por su propia documentación.
  const propias = [];
  for (const rel of SEMBRADORES) {
    const { porModelo } = escriturasDeSembrador(RAIZ, rel);
    const expr = porModelo.get('product')?.get('nameSearch');
    if (expr === undefined) continue;                  // no lo escribe a mano: nada que juzgar
    if (/^normalizeSearch\(/.test(expr)) continue;     // deriva de la única del proyecto ✅
    propias.push(`${rel} → nameSearch: ${expr}`);
  }

  assert.deepEqual(
    propias,
    [],
    'Un sembrador normaliza `nameSearch` por su cuenta:\n  ' + propias.join('\n  ') +
      '\nLa única normalización del catálogo es `normalizeSearch` (products.service.ts) — impórtala.',
  );
});
