// SCRUM-320 (G5) · «QUÉ FALTA PARA COBRAR».
//
// Sin gate: los importes y los huecos son puros y se importan; el render y la escalera se leen del
// código. Ni BD, ni red, ni navegador.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ ESTA SECCIÓN NO TIENE CTA PROPIO
//
// La cabecera contesta «¿cuál es LA siguiente acción de este Trabajo?» — una sola, y la elige
// `jobNextAction` (SCRUM-366). Ésta contesta otra pregunta: «¿qué falta para cobrar?», que puede
// tener VARIAS respuestas a la vez (dos albaranes sin firmar Y 300 € facturados sin cobrar).
//
// Una sección que ENUMERA huecos no tiene que elegir uno. Elegir es el trabajo de la cabecera, y
// hay una sola cabecera. Por eso cada hueco lleva su propio enlace en su propia línea: la escalera
// no se toca, no hay una segunda, y las dos superficies no pueden contradecirse.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { soloEjecutable } from './_guard-texto.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const require_ = createRequire(import.meta.url);
const leer = (p) => fs.readFileSync(path.join(RAIZ, p), 'utf8');

const VISTA_TXT = leer('public/dashboard/js/jobDetailView.js');
const VISTA = soloEjecutable(VISTA_TXT, { almohadillaEsComentario: false });
const G5 = require_(path.join(RAIZ, 'public/dashboard/js/jobCobroHuecos.js'));
const REPARTO = require_(path.join(RAIZ, 'public/dashboard/js/jobDocsReparto.js'));

const fmt = (n) => `${Number(n).toFixed(2)} EUR`;

/** El ejemplo aprobado por el fundador, con sus números exactos. */
const jobDelEjemplo = () => ({
  totalAceptado: 853.05,
  totalCobrado: 300,
  albaranes: [
    { id: 1, estado: 'firmado', facturado: false, totales: { total: 600 } },
    { id: 2, estado: 'emitido' },   // enviado SIN firmar
    { id: 3, estado: 'borrador' },
  ],
  invoices: [
    { id: 9, total: 300, status: 'paid' },
    { id: 10, total: 300, status: 'pending' },
  ],
});

test('SCRUM-320 · SUELO: el derivador encuentra fuentes y los cinco importes cuadran', () => {
  const i = G5.importesDeCobro(jobDelEjemplo());

  // Si el derivador no encontrara NINGUNA fuente, todos los importes serían 0 y los tests de abajo
  // pasarían comparando ceros con ceros.
  assert.ok(
    i.aceptado > 0 && i.facturado > 0 && i.cobrado > 0 && i.entregadoFirmado > 0,
    `🔴 ESCÁNER CIEGO: algún importe sale a 0 con un Trabajo que tiene de todo ` +
      `(aceptado=${i.aceptado} entregado=${i.entregadoFirmado} facturado=${i.facturado} cobrado=${i.cobrado}). ` +
      'Un derivador que no encuentra su fuente devuelve el mismo número que «no hay nada».',
  );

  assert.equal(i.aceptado, 853.05, '🔴 Aceptado no sale de `job.totalAceptado`');
  assert.equal(i.entregadoFirmado, 600, '🔴 Entregado y firmado no suma los albaranes FIRMADOS');
  assert.equal(i.facturado, 600, '🔴 Facturado no suma las facturas del Trabajo');
  assert.equal(i.cobrado, 300, '🔴 Cobrado no sale de `job.totalCobrado`');
  assert.equal(i.faltaPorCobrar, 553.05, '🔴 «Te falta por cobrar» no es aceptado − cobrado');
});

// ── EL TEST QUE PROTEGE EL EURO ─────────────────────────────────────────────────────────

test('SCRUM-320 · CONTROL NEGATIVO: un albarán ENVIADO-sin-firmar NO cuenta como entregado', () => {
  // Contarlo sería decirle al profesional que puede facturar algo que el cliente no ha aceptado, y
  // ése es justo el euro que acaba en discusión. Asimetría de coste: contar de menos cuesta una
  // comprobación; contar de más cuesta la factura y el cliente.
  const soloEmitido = {
    totalAceptado: 1000, totalCobrado: 0,
    albaranes: [{ id: 1, estado: 'emitido', facturado: false, totales: { total: 600 } }],
    invoices: [],
  };
  assert.equal(
    G5.importesDeCobro(soloEmitido).entregadoFirmado, 0,
    '🔴 UN ALBARÁN ENVIADO Y SIN FIRMAR CUENTA COMO ENTREGADO.\n\n' +
      '  Solo la FIRMA prueba la entrega. Sumarlo le dice al pro que puede facturar algo que el\n' +
      '  cliente no ha aceptado — y ése es el euro que acaba en discusión.',
  );
  // Y tampoco genera el hueco de «entregado sin facturar».
  assert.ok(
    !G5.huecosDeCobro(soloEmitido).some((h) => h.id === 'sin-facturar'),
    '🔴 se propone «Facturar lo entregado» sobre un albarán que el cliente no ha firmado.',
  );
  // El borrador, igual.
  const borrador = { ...soloEmitido, albaranes: [{ id: 1, estado: 'borrador', totales: { total: 600 } }] };
  assert.equal(G5.importesDeCobro(borrador).entregadoFirmado, 0, '🔴 un borrador cuenta como entregado');

  // CONTRASTE, para que lo de arriba no pase por no sumar nunca: el mismo albarán FIRMADO sí suma.
  const firmado = { ...soloEmitido, albaranes: [{ id: 1, estado: 'firmado', facturado: false, totales: { total: 600 } }] };
  assert.equal(
    G5.importesDeCobro(firmado).entregadoFirmado, 600,
    '🔴 ESCÁNER CIEGO: firmado tampoco suma — entonces el control negativo pasaba porque no suma ' +
      'nunca, no porque discrimine por la firma.',
  );
});

// ── LOS HUECOS ──────────────────────────────────────────────────────────────────────────

test('SCRUM-320 · los tres huecos del ejemplo, en su orden fijo', () => {
  const h = G5.huecosDeCobro(jobDelEjemplo());
  assert.deepEqual(
    h.map((x) => x.id), ['sin-firmar', 'sin-facturar', 'sin-cobrar'],
    '🔴 los huecos no salen, o no en el orden canónico. El orden no es estético: primero lo que el ' +
      'pro puede resolver HOY (perseguir una firma), luego lo suyo (facturar) y al final lo que ' +
      'depende del cliente (que pague).',
  );
  assert.equal(h[0].cantidad, 2, '🔴 «N albaranes sin firmar» no cuenta los no firmados');
  assert.equal(h[1].importe, 600, '🔴 «entregados sin facturar» no sale de los albaranes firmados y sin facturar');
  assert.equal(h[2].importe, 300, '🔴 «facturados sin cobrar» no sale de las facturas no pagadas');
  assert.deepEqual(REPARTO.SECCIONES_CUERPO[0], 'que-falta-para-cobrar', '🔴 la sección perdió su sitio en el ciclo');
});

test('SCRUM-320 · cada hueco se deriva POR DOCUMENTO, no restando totales', () => {
  // Restando, «entregado − facturado» daría 0 en cuanto los dos números coincidieran por caminos
  // distintos, y el hueco desaparecería estando ahí. Es exactamente el caso del ejemplo: entregado
  // 600 y facturado 600, y sin embargo hay 600 € entregados SIN facturar.
  const job = jobDelEjemplo();
  const i = G5.importesDeCobro(job);
  assert.equal(i.entregadoFirmado, i.facturado, 'el fixture debe tener los dos iguales para que esto pruebe algo');
  const h = G5.huecosDeCobro(job);
  assert.ok(
    h.some((x) => x.id === 'sin-facturar' && x.importe === 600),
    '🔴 el hueco «entregados sin facturar» ha desaparecido con entregado == facturado. Se está ' +
      'calculando por RESTA en vez de por documento, y el hueco existe: hay un albarán firmado que ' +
      'ninguna factura recoge.',
  );
});

test('SCRUM-320 · familia SCRUM-271: un importe ausente no se convierte en otra cosa', () => {
  // `Number([])` es 0 —un número finito y perfectamente válido—, así que un objeto vacío colado en
  // un total se leería como «cero euros medidos» en vez de como «no hay dato».
  const raro = {
    totalAceptado: [], totalCobrado: '',
    albaranes: [{ id: 1, estado: 'firmado', facturado: false, totales: { total: {} } }],
    invoices: [{ id: 9, total: null, status: 'pending' }],
  };
  const i = G5.importesDeCobro(raro);
  for (const [k, v] of Object.entries(i)) {
    assert.ok(Number.isFinite(v), `🔴 ${k} no es un número finito: ${v}`);
    assert.ok(!Number.isNaN(v), `🔴 ${k} es NaN y se pintaría como «NaN €»`);
  }
  // Y una factura sin importe no inventa un hueco de cobro.
  assert.ok(
    !G5.huecosDeCobro(raro).some((h) => h.id === 'sin-cobrar'),
    '🔴 una factura sin importe genera un hueco «facturados sin cobrar» de 0 €.',
  );
});

// ── EL CONTROL POSITIVO ─────────────────────────────────────────────────────────────────

test('SCRUM-320 · CONTROL POSITIVO: todo cobrado → la sección NO se pinta, y el resto sigue entero', () => {
  // El requisito se cumple por AUSENCIA, así que «no se pinta» y «se rompió al pintar» se ven igual
  // desde fuera. Aquí se comprueba que la sección desaparece Y que el render sigue haciendo lo
  // demás.
  const saldado = {
    totalAceptado: 500, totalCobrado: 500,
    albaranes: [{ id: 1, estado: 'firmado', facturado: true, totales: { total: 500 } }],
    invoices: [{ id: 9, total: 500, status: 'paid' }],
  };
  assert.deepEqual(G5.huecosDeCobro(saldado), [], '🔴 hay huecos en un Trabajo saldado');
  assert.equal(
    G5.seccionCobroVisible(saldado), false,
    '🔴 la sección se pinta sin ningún hueco: preguntar «qué falta» cuando no falta nada es ruido.',
  );

  // Contraste: con un solo hueco SÍ se pinta. Sin esto, `seccionCobroVisible` podría devolver
  // `false` siempre y el test de arriba pasaría por avería.
  assert.equal(
    G5.seccionCobroVisible(jobDelEjemplo()), true,
    '🔴 ESCÁNER CIEGO: la sección tampoco se pinta cuando SÍ faltan cosas — entonces el control de ' +
      'arriba pasaba porque nunca se pinta, no porque el Trabajo esté saldado.',
  );

  // Y el resto de la pantalla no depende de ella: el render la monta en su propio `if`, sin tocar
  // lo que viene después.
  assert.ok(
    /if \(typeof seccionCobroVisible === 'function' && seccionCobroVisible\(job\)\) \{/.test(VISTA),
    '🔴 la sección no se monta bajo su propia condición: si desaparece podría llevarse por delante ' +
      'lo que venga detrás.',
  );
  assert.ok(
    /body\.appendChild\(sumSec\);/.test(VISTA),
    '🔴 ESCÁNER CIEGO: el resumen ya no se monta — el guard mediría una pantalla que no existe.',
  );
});

// ── EL INVARIANTE CON LA CABECERA ───────────────────────────────────────────────────────

function cargarEscalera() {
  const ctx = { window: {}, fmtMoneyEs: (n, c) => `${Number(n).toFixed(2)} ${c || 'EUR'}` };
  vm.createContext(ctx);
  vm.runInContext(leer('public/dashboard/js/jobNextAction.js'), ctx);
  return ctx.window.jobNextAction;
}

test('SCRUM-320 · si la cabecera propone una acción de COBRO, G5 lista algún hueco', () => {
  // El invariante barato en vez de una escalera nueva: no rediseña nada y caza el día que las dos
  // superficies empiecen a divergir.
  const jobNextAction = cargarEscalera();
  assert.equal(typeof jobNextAction, 'function', '🔴 ESCÁNER CIEGO: no se pudo cargar la escalera');

  const hace30dias = new Date(Date.now() - 30 * 86400000).toISOString();
  const casos = [
    // (1) El ejemplo, TERMINADO y con saldo → la escalera propone «cobrar» (nivel 1).
    { ...jobDelEjemplo(), status: 'terminado', remaining: { amount: 553.05, currency: 'EUR' }, customer: {} },
    // (2) Factura vieja sin pagar y con teléfono → la escalera propone «recordar» (nivel 2).
    {
      totalAceptado: 500, totalCobrado: 0, status: 'en_curso',
      customer: { phone: '34000000001' },
      albaranes: [{ id: 1, estado: 'emitido' }],
      invoices: [{ id: 2, total: 500, status: 'pending', createdAt: hace30dias }],
    },
    // (3) El caso SIN documentos, que el invariante excluye a propósito (ver abajo).
    { totalAceptado: 500, totalCobrado: 0, albaranes: [], invoices: [], status: 'terminado', remaining: { amount: 500, currency: 'EUR' }, customer: {} },
  ];
  const DE_COBRO = ['cobrar', 'recordar'];
  let vistos = 0;

  for (const job of casos) {
    const acc = jobNextAction({ customer: {}, invoices: [], albaranes: [], ...job }, true);
    if (!acc || !DE_COBRO.includes(acc.kind)) continue;

    // ⚠️ EL INVARIANTE SE LIMITA A LOS TRABAJOS CON DOCUMENTOS, y no por comodidad: los tres huecos
    // aprobados hablan de DOCUMENTOS (albaranes sin firmar, entregado sin facturar, facturado sin
    // cobrar). Un Trabajo `terminado` con importe aceptado y **sin ningún documento todavía** no
    // tiene ninguno de los tres, y la cabecera sí propone «Cobrar el resto».
    //
    // Ese caso está MEDIDO y REPORTADO como decisión del fundador (ver `docs/master/SCRUM-320.md`):
    // o se añade un cuarto hueco —«aceptado y sin facturar»— o se acepta que la sección no aparezca
    // hasta que exista el primer documento. **No se decide aquí**, y sobre todo no se tapa
    // metiendo un hueco que nadie aprobó.
    const tieneDocumentos = (job.albaranes || []).length > 0 || (job.invoices || []).length > 0;
    if (!tieneDocumentos) continue;

    vistos++;
    assert.ok(
      G5.huecosDeCobro(job).length > 0,
      `🔴 LA CABECERA Y ESTA SECCIÓN SE CONTRADICEN: la cabecera propone «${acc.kind}» y «qué falta ` +
        'para cobrar» no lista ningún hueco — o sea, no se pinta. La pantalla diría a la vez que ' +
        'hay que cobrar y que no falta nada.',
    );
  }
  assert.ok(
    vistos > 0,
    '🔴 ESCÁNER CIEGO: ningún caso de prueba produjo una acción del eje COBRO sobre un Trabajo con ' +
      'documentos, así que el invariante de arriba no se ha comprobado ni una vez.',
  );
});

test('SCRUM-320 · el HUECO MEDIDO queda a la vista, no tapado', () => {
  // Un Trabajo terminado, con importe aceptado y SIN ningún documento: la cabecera propone cobrar y
  // los tres huecos aprobados no tienen nada que enumerar. Este test NO afirma que esté bien —
  // afirma que la situación es la que se reportó, para que cambie de estado el día que el fundador
  // decida, en vez de quedarse en una nota que nadie relee.
  const jobNextAction = cargarEscalera();
  const pelado = {
    totalAceptado: 500, totalCobrado: 0, albaranes: [], invoices: [],
    status: 'terminado', remaining: { amount: 500, currency: 'EUR' }, customer: {},
  };
  const acc = jobNextAction(pelado, true);
  assert.equal(acc && acc.kind, 'cobrar', '🔴 la escalera ya no propone cobrar en este caso: el hueco ' +
    'reportado ha cambiado de forma y la entrada del máster describe algo que ya no pasa.');
  assert.deepEqual(
    G5.huecosDeCobro(pelado), [],
    '🔴 ahora SÍ salen huecos en el caso reportado. Si es porque se ha añadido un cuarto hueco, ' +
      'tiene que venir con la aprobación del fundador y con su microcopy (regla 30) — y este test ' +
      'y la entrada del máster dejan de describir la realidad.',
  );
});

test('SCRUM-320 · NO hay una segunda escalera: la sección no decide «la» acción', () => {
  assert.ok(
    !/function\s+jobNextAction/.test(soloEjecutable(leer('public/dashboard/js/jobCobroHuecos.js'), { almohadillaEsComentario: false })),
    '🔴 el módulo de G5 define su propia escalera.',
  );
  const g5 = soloEjecutable(leer('public/dashboard/js/jobCobroHuecos.js'), { almohadillaEsComentario: false });
  assert.ok(
    !/jobNextAction/.test(g5),
    '🔴 G5 consulta la escalera de la cabecera para elegir UNA acción. No debe: enumera huecos, no ' +
      'elige — y elegir es el trabajo de la cabecera.',
  );
  // Cada hueco lleva SU acción; ninguna es «la» primaria de la sección.
  const h = G5.huecosDeCobro(jobDelEjemplo());
  assert.equal(new Set(h.map((x) => x.accion)).size, h.length, '🔴 dos huecos comparten acción');
  //
  // ⚠️ LA PRIMERA VERSIÓN DE ESTE ASSERT NO SALTABA. Anclaba en `cobroSec` —la variable del
  // LLAMADOR— y el botón se pinta dentro de `pintarQueFaltaParaCobrar`, donde la sección se llama
  // `sec`: la ventana de búsqueda nunca llegaba al botón. El guard miraba el sitio equivocado, que
  // es la misma familia de error que llevo cazando todo el día.
  const i = VISTA.indexOf('function pintarQueFaltaParaCobrar');
  assert.ok(i >= 0, '🔴 ESCÁNER CIEGO: no se encuentra `pintarQueFaltaParaCobrar`. ¿Se renombró?');
  const j = VISTA.indexOf('\nfunction jdAddRow', i + 1);
  assert.ok(j > i, '🔴 ESCÁNER CIEGO: no se encuentra el FINAL del recorte — sin los dos extremos el ' +
    'guard mediría un trozo que no es esta función.');
  const cuerpo = VISTA.slice(i, j);
  assert.ok(cuerpo.length > 500, `🔴 ESCÁNER CIEGO: el recorte mide ${cuerpo.length} caracteres`);

  assert.ok(
    !/btn-primary/.test(cuerpo),
    '🔴 la sección pinta un botón PRIMARIO: eso la convierte en una segunda cabecera. Aquí ningún ' +
      'hueco es «la» acción — elegir es el trabajo de la cabecera, y hay una sola.',
  );
});

test('SCRUM-320 · el importe entregado se OMITE si no se pudo medir, en vez de escribir 0,00 €', () => {
  // Los albaranes SIN_VALORAR —el modo por DEFECTO— no llevan importe (`totales` es null). Con tres
  // albaranes firmados y sin valorar, «Entregado y firmado 0,00 €» sería una afirmación falsa, no
  // un hueco. En la pantalla del dinero no se escribe un cero que no se ha medido.
  const sinValorar = {
    totalAceptado: 500, totalCobrado: 0,
    albaranes: [{ id: 1, estado: 'firmado', facturado: false, totales: null }],
    invoices: [],
  };
  const i = G5.importesDeCobro(sinValorar);
  assert.equal(
    i.albaranesFirmadosConImporte, 0,
    '🔴 se cuenta como medido un albarán SIN_VALORAR, que no lleva importe.',
  );
  assert.equal(i.entregadoFirmado, 0, '🔴 se inventa un importe para un albarán sin valorar');
  // Y la vista omite la línea en ese caso.
  assert.ok(
    /if \(i\.albaranesFirmadosConImporte > 0\) fila\('Entregado y firmado'/.test(VISTA),
    '🔴 la vista pinta «Entregado y firmado» sin comprobar que se pudo medir: escribiría 0,00 € ' +
      'sobre albaranes firmados de verdad.',
  );
  // Contraste: con uno VALORADO sí se cuenta.
  const valorado = { ...sinValorar, albaranes: [{ id: 1, estado: 'firmado', facturado: false, totales: { total: 400 } }] };
  assert.equal(G5.importesDeCobro(valorado).albaranesFirmadosConImporte, 1, '🔴 tampoco cuenta el valorado');
});
