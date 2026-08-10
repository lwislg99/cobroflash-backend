// tests/scrum358-alta-idempotente.test.mjs — SCRUM-358 (H3)
//
// EL ALTA DE ALBARÁN, IDEMPOTENTE — la mitad de servidor.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// LO QUE ESTE FICHERO CUBRE Y LO QUE NO — declarado, para que no se le suponga más
//
// ✅ Cubre: la clave (validación), la comparación de contenido, el ORDEN dentro de la transacción
//    (cerrojo → constraint → número) y las tres salidas de la ruta.
// ❌ NO cubre: la cola en IndexedDB, el drenado, los reintentos con espera creciente, el tope de
//    50 ni el control negativo del portal cautivo. **Todo eso es la mitad de CLIENTE de H3**, no
//    está construida, y no se finge probada aquí.
//
// Sin base de datos: el dominio es puro y el orden de la ruta se mide sobre el texto ejecutable.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { soloEjecutable } from './_guard-texto.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const DIST = pathToFileURL(path.join(RAIZ, 'dist')).href + '/';
const {
  normalizarClaveIdempotencia,
  compararAlta,
  CLAVE_IDEMPOTENCIA_MAX,
  ClaveIdempotenciaReutilizadaError,
} = await import(DIST + 'modules/jobs/domain/albaranIdempotencia.js');

const RUTA = soloEjecutable(
  fs.readFileSync(path.join(RAIZ, 'src/modules/jobs/app/routes/jobs.routes.ts'), 'utf8'),
  { almohadillaEsComentario: false },
);

/** El cuerpo del `POST /:id/albaranes`, recortado. Todo lo que se mide abajo vive aquí dentro. */
function cuerpoDelAlta() {
  const i = RUTA.indexOf("router.post('/:id/albaranes'");
  assert.ok(i > 0, '🔴 ESCÁNER CIEGO: no encuentro `POST /:id/albaranes`. Si se renombró, TODOS los ' +
    'tests de orden de abajo saldrían verdes sobre un trozo de fichero que no es la ruta.');
  const j = RUTA.indexOf('\nrouter.', i + 1);
  const cuerpo = RUTA.slice(i, j > i ? j : undefined);
  assert.ok(cuerpo.includes('allocateAlbaranNumber') && cuerpo.length > 500,
    `🔴 ESCÁNER CIEGO: el recorte mide ${cuerpo.length} caracteres y no reserva número.`);
  return cuerpo;
}

const ALTA = { jobId: 42, modoValoracion: 'SIN_VALORAR', lineas: [{ concepto: 'Bajante', cantidad: 3 }], notas: 'Patio' };

// ── LA CLAVE ─────────────────────────────────────────────────────────────────────────────────

test('SCRUM-358 · 🔴 una clave demasiado larga se RECHAZA, no se recorta', () => {
  // Recortar a 64 convierte dos claves con el mismo prefijo en LA MISMA, y la segunda alta se
  // tomaría por repetición de la primera: un albarán perdido en silencio. Es el modo de fallo
  // por el que el propio ticket descarta el content hash como clave.
  const larga = 'a'.repeat(CLAVE_IDEMPOTENCIA_MAX + 1);
  const r = normalizarClaveIdempotencia(larga);
  assert.equal(r.ok, false, `🔴 se ACEPTA una clave de ${larga.length} caracteres en una columna de ${CLAVE_IDEMPOTENCIA_MAX}: la base la recortaría y dos claves distintas pasarían a ser una.`);
  assert.match(r.message, /no se recorta/i, '🔴 el mensaje no dice por qué se rechaza en vez de recortar');

  // Control positivo: en el tope EXACTO sí entra, o el rechazo de arriba sería un rechazo de todo.
  const justa = 'a'.repeat(CLAVE_IDEMPOTENCIA_MAX);
  assert.deepEqual(normalizarClaveIdempotencia(justa), { ok: true, clave: justa },
    '🔴 se rechaza una clave del tamaño EXACTO de la columna: entonces el test de arriba no prueba el límite.');
});

test('SCRUM-358 · ausencia de clave: NO falla — pero tampoco es lo mismo que traerla', () => {
  // Los clientes de hoy no la mandan y los albaranes históricos no la tienen: rechazarlas sería
  // romper el producto. Lo que no puede es confundirse con haberla aplicado.
  for (const v of [undefined, null, '', '   ']) {
    const r = normalizarClaveIdempotencia(v);
    assert.equal(r.ok, true, `🔴 ${JSON.stringify(v)} hace fallar el alta. Un alta sin clave es legítima.`);
    assert.equal(r.clave, null, `🔴 ${JSON.stringify(v)} no se normaliza a null: «sin clave» dejaría de ser UN solo estado`);
  }
  const noEsCadena = normalizarClaveIdempotencia({ a: 1 });
  assert.equal(noEsCadena.ok, false, '🔴 un objeto pasa como clave');
});

// ── EL TEST DEL TICKET ───────────────────────────────────────────────────────────────────────

test('SCRUM-358 · 🔴 EL TEST: la misma alta dos veces es UNA — y dos altas idénticas legítimas NO se deduplican', () => {
  // ① La repetición: misma clave, mismo contenido → es la misma. La ruta devuelve el original.
  assert.deepEqual(compararAlta(ALTA, { ...ALTA }), { mismo: true },
    '🔴 dos envíos idénticos con la misma clave se toman por distintos: el reintento crearía un ' +
    'SEGUNDO albarán, que es el defecto entero que H3 viene a cerrar.');

  // ② 🔴 Y LA OTRA MITAD, que es la que el ticket subraya: dos albaranes LEGÍTIMAMENTE idénticos
  // —mismo cliente, mismo material, mismo día— NO se deduplican, porque la deduplicación es por
  // CLAVE y no por contenido. Se comprueba en el mecanismo: el mismo contenido con claves
  // distintas son dos altas distintas, y ninguna función de este módulo las une.
  const a = normalizarClaveIdempotencia('11111111-1111-4111-8111-111111111111');
  const b = normalizarClaveIdempotencia('22222222-2222-4222-8222-222222222222');
  assert.notEqual(a.clave, b.clave,
    '🔴 dos claves distintas se normalizan a la misma: dos partes del mismo día se fundirían en uno.');
  // Y la búsqueda en la ruta es POR CLAVE, nunca por contenido — si un día se buscara por
  // contenido, el parte de la tarde desaparecería contra el de la mañana.
  const cuerpo = cuerpoDelAlta();
  assert.match(cuerpo, /merchantId_claveIdempotencia: \{ merchantId: req\.merchantId!, claveIdempotencia: clave \}/,
    '🔴 la búsqueda del duplicado ya no es por CLAVE. Si pasara a ser por contenido, dos albaranes ' +
    'legítimamente idénticos (mismo cliente, mismo material, mismo día) colisionarían y uno se ' +
    'perdería en silencio.');
});

test('SCRUM-358 · 🔴 misma clave con contenido DISTINTO es conflicto, y se NOMBRA qué cambió', () => {
  const casos = [
    [{ ...ALTA, notas: 'Otra cosa' }, 'las notas'],
    [{ ...ALTA, lineas: [{ concepto: 'Otro', cantidad: 1 }] }, 'las líneas'],
    [{ ...ALTA, modoValoracion: 'VALORADO' }, 'el modo de valoración'],
    [{ ...ALTA, jobId: 99 }, 'el Trabajo al que cuelga'],
  ];
  for (const [entrante, esperado] of casos) {
    const r = compararAlta(ALTA, entrante);
    assert.equal(r.mismo, false, `🔴 «${esperado}» cambió y se toma por la MISMA alta: el segundo envío se tiraría en silencio`);
    assert.ok(r.diferencias.includes(esperado),
      `🔴 el conflicto no NOMBRA qué cambió (dice ${JSON.stringify(r.diferencias)}, falta «${esperado}»). ` +
      'Un «no coincide» sin decir en qué no se puede ni comprobar ni discutir.');
  }
  // Y el error que sube lleva los dos documentos: sin el número del original, el profesional no
  // puede ir a mirar contra qué chocó.
  const e = new ClaveIdempotenciaReutilizadaError('k-1', 'ALB-2026-007', ['las notas']);
  assert.match(e.message, /ALB-2026-007/, '🔴 el error no nombra el albarán original');
  assert.match(e.message, /las notas/, '🔴 el error no dice qué cambió');
});

// ── EL ORDEN DENTRO DE LA TRANSACCIÓN ────────────────────────────────────────────────────────

test('SCRUM-358 · 🔴 EL ORDEN: cerrojo → constraint → número. Cambiarlo rompe la serie', () => {
  const cuerpo = cuerpoDelAlta();
  const iCerrojo = cuerpo.indexOf('tomarCerrojoDeSerie(');
  const iBusca = cuerpo.indexOf('merchantId_claveIdempotencia');
  const iNumero = cuerpo.indexOf('allocateAlbaranNumber(');
  assert.ok(iCerrojo > 0, '🔴 el alta ya no toma el cerrojo de serie: dos reintentos simultáneos pasarían los dos el «no la he visto» y se llevarían DOS números.');
  assert.ok(iBusca > 0, '🔴 el alta ya no pregunta al constraint por la clave: la idempotencia está apagada.');

  assert.ok(iCerrojo < iBusca,
    '🔴 LA CONSULTA DE LA CLAVE VA FUERA DEL CERROJO. Reintroduce la carrera de SCRUM-234: dos ' +
    'peticiones con la misma clave pasan las dos la comprobación y crean dos albaranes.');
  assert.ok(iBusca < iNumero,
    '🔴 SE RESERVA EL NÚMERO ANTES DE MIRAR LA CLAVE. En una repetición ese número queda consumido ' +
    'y sin documento: un HUECO EN LA SERIE abierto por la propia idempotencia, que es justo lo que ' +
    '`allocateAlbaranNumber` vive dentro de la transacción para evitar.');
});

test('SCRUM-358 · 🔴 no se captura el `P2002`: una sentencia fallida aborta la transacción', () => {
  const cuerpo = cuerpoDelAlta();
  assert.ok(!/P2002/.test(cuerpo),
    '🔴 el alta captura el `P2002` del `create`. En PostgreSQL una sentencia fallida ABORTA la ' +
    'transacción: el reintento no daría otro resultado, daría `25P02 current transaction is ' +
    'aborted`. Se pregunta al constraint DENTRO del cerrojo (invoiceNumber.service.ts:115-122).');
});

// ── LAS TRES SALIDAS ─────────────────────────────────────────────────────────────────────────

test('SCRUM-358 · 🔴 una repetición legítima devuelve EL ORIGINAL, nunca un error', () => {
  const cuerpo = cuerpoDelAlta();
  assert.match(cuerpo, /repetida = true;\s*return yaExiste;/,
    '🔴 la repetición ya no devuelve el albarán original. Un 409 ahí le diría al profesional que ' +
    'salió mal algo que salió BIEN, y dejaría a la cola sin el documento con el que cerrar su elemento.');
  assert.match(cuerpo, /status\(repetida \? 200 : 201\)/,
    '🔴 la repetición no se distingue de la creación por el código: 201 dice «he creado» sobre algo ' +
    'que ya existía.');
});

test('SCRUM-358 · 🔴 «con clave» y «sin clave» NO dan la misma salida', () => {
  const cuerpo = cuerpoDelAlta();
  assert.match(cuerpo, /const idempotencia = !clave \? 'no_solicitada' : repetida \? 'repetida' : 'aplicada'/,
    '🔴 la respuesta ya no distingue las tres situaciones. Un alta SIN clave no debe fallar —los ' +
    'clientes de hoy no la mandan— pero tampoco puede pasar en SILENCIO: el día que la cola dejara ' +
    'de enviarla por un fallo suyo, todo seguiría en verde con la idempotencia apagada.');
  assert.match(cuerpo, /idempotencia \}/, '🔴 el marcador no viaja en la respuesta: no lo puede ver nadie');
});

test('SCRUM-358 · el 409 del conflicto lleva marcador de microcopy (regla 30)', () => {
  const cuerpo = cuerpoDelAlta();
  assert.match(cuerpo, /message: MSG_CLAVE_REUTILIZADA/, '🔴 el 409 no usa el texto declarado');
  const dominio = fs.readFileSync(path.join(RAIZ, 'src/modules/jobs/domain/albaranIdempotencia.ts'), 'utf8');
  assert.match(dominio, /MSG_CLAVE_REUTILIZADA[\s\S]{0,200}\[PENDIENTE microcopy oficial/,
    '🔴 el texto del 409 se da por aprobado. Lo lee el PROFESIONAL y no lo ha aprobado nadie (regla 30).');
});
