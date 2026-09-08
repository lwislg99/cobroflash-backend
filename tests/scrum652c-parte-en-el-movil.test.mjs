// tests/scrum652c-parte-en-el-movil.test.mjs — SCRUM-652 (T3 fase C).
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// LO QUE DECIDE ESTE FICHERO
//
// El parte ya estaba construido y probado (fase B, 12 tests) y NO TENÍA LLAMADOR. Esto le da
// superficie. Y la superficie puede romper el dominio de dos maneras que los tests de la fase B
// no ven, porque los dos defectos viven en el CABLE, no en el dominio:
//
//   ① que firmar congele los precios — el producto quedaría inservible y desde fuera se vería
//      IDÉNTICO a haberlo hecho bien: el técnico firma, el jefe entra a valorar y no puede;
//   ② que la pantalla del técnico pinte un importe — en el parte real firmado la columna IMPORTE
//      está EN BLANCO, y enseñarla es romper su forma de trabajar aunque todo lo demás pase.
//
// Por eso los dos controles que deciden son NEGATIVOS: no comprueban que algo funcione, sino que
// algo que NO debe ocurrir siga sin ocurrir.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const JS = path.join(RAIZ, 'public', 'dashboard', 'js');

const {
  puedeEditarPrecios,
  puedeEditarContenido,
  computeParteContentHash,
  lineasParaElTecnico,
} = await import('../dist/modules/jobs/domain/parteTrabajo.js');

// ─────────────────────────────────────────────────────────────────────────────────────────
// ① CONTROL NEGATIVO · EL QUE DECIDE
// ─────────────────────────────────────────────────────────────────────────────────────────

test('SCRUM-652c · 🔴 FIRMAR NO CONGELA LOS PRECIOS: siguen abiertos hasta facturar', () => {
  // El técnico cierra el parte en la obra sin importes. La oficina los pone DESPUÉS, las veces
  // que haga falta. Si firmar cerrara los precios, el parte real —el de la columna IMPORTE en
  // blanco— no se podría valorar nunca, y el producto sería inservible sin que nada fallara.
  const firmado = puedeEditarPrecios('firmado');
  assert.equal(firmado.ok, true,
    '🔴 firmar ha CONGELADO los precios. El técnico firma sin importes y el jefe los pone luego: ' +
    'con esto, el parte firmado ya no se puede valorar. Motivo que da: ' + String(firmado.motivo));
  assert.equal(firmado.motivo, null, '🔴 dice que se puede y a la vez da un motivo para no poder');

  // Y el contenido SÍ se cierra: son dos candados distintos, y confundirlos es el defecto.
  const contenido = puedeEditarContenido('firmado');
  assert.equal(contenido.ok, false,
    '🔴 el CONTENIDO sigue abierto después de firmar. Es lo que el cliente vio y firmó.');

  // El cierre de precios llega en `facturado`, y sólo ahí.
  assert.equal(puedeEditarPrecios('facturado').ok, false,
    '🔴 los precios siguen abiertos con el parte YA FACTURADO. Los fija la factura.');
  assert.equal(puedeEditarPrecios('borrador').ok, true,
    '🔴 los precios están cerrados en borrador, que es cuando más abiertos tienen que estar.');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// ② SEGUNDO CONTROL NEGATIVO · el canónico que se reutilizó es el CORRECTO
// ─────────────────────────────────────────────────────────────────────────────────────────

/** Un parte de verdad: dos bloques, como el papel. */
function parteDeEjemplo(lineas) {
  return {
    numero: 'PT-2026-001',
    fecha: new Date('2026-09-02T08:00:00.000Z'),
    cliente: 'Comunidad Los Olivos',
    obra: 'C/ Mayor 3, portal B',
    referencia: 'REF-778',
    entrada: '09:15',
    salida: '11:40',
    desplazamientos: 1,
    kilometros: 12.5,
    tecnicos: ['Israel', 'Miguel'],
    tipo: 'reparacion_asistencia',
    lineas,
    notas: 'Se cambió el presostato.',
    firmadoPorNombre: 'Ana Ruiz',
    firmadoPorCalidad: 'portero_o_conserje',
  };
}

test('SCRUM-652c · 🔴 EL HASH NO SE MUEVE AL TOCAR UN PRECIO', () => {
  // Es la prueba de que se reutilizó el canónico del PARTE y no el del albarán. El del albarán
  // (`albaran.service.ts`) mete `precioUnitario` y `tipoIva` DENTRO del hash: con él, la oficina
  // valorando rompería el sello de un documento ya firmado. El del parte sella `bloque`, `unds` y
  // `descripcion`, y nada más.
  const sinPrecios = [
    { bloque: 'mano_obra', unds: 2.5, descripcion: 'Revisión de caldera' },
    { bloque: 'materiales', unds: 1, descripcion: 'Presostato' },
  ];
  const conPrecios = [
    { bloque: 'mano_obra', unds: 2.5, descripcion: 'Revisión de caldera', precioUnitario: 38, tipoIva: 21 },
    { bloque: 'materiales', unds: 1, descripcion: 'Presostato', precioUnitario: 54.9, tipoIva: 21 },
  ];

  const antes = computeParteContentHash(parteDeEjemplo(sinPrecios));
  const despues = computeParteContentHash(parteDeEjemplo(conPrecios));

  assert.equal(antes, despues,
    '🔴 poner un precio ha CAMBIADO la huella del parte. Es el canónico equivocado —el que mete ' +
    'importes en el sello—, y significa que valorar en la oficina invalida el documento que el ' +
    'cliente firmó en la obra.');

  // CONTROL POSITIVO del mismo mecanismo: que el hash no reaccione a NADA sería peor todavía.
  const otro = parteDeEjemplo(sinPrecios);
  otro.lineas = [{ bloque: 'mano_obra', unds: 3, descripcion: 'Revisión de caldera' }];
  assert.notEqual(computeParteContentHash(otro), antes,
    '🔴 cambiar las UNIDADES tampoco mueve el hash: entonces no está sellando nada y el test de ' +
    'arriba pasa por el motivo equivocado.');
});

test('SCRUM-652c · lo que sale hacia el técnico no tiene NI UNA clave de dinero', () => {
  const conPrecios = [
    { bloque: 'mano_obra', unds: 2, descripcion: 'Mano de obra', precioUnitario: 38, tipoIva: 21 },
  ];
  const salida = lineasParaElTecnico(conPrecios);
  const claves = Object.keys(salida[0]).sort();
  assert.deepEqual(claves, ['bloque', 'descripcion', 'unds'],
    '🔴 al técnico le llegan claves de más: ' + claves.join(', '));
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// EL BANCO: la pantalla, ejecutada de verdad
// ─────────────────────────────────────────────────────────────────────────────────────────

/**
 * Un DOM de mentira, suficiente para esta pantalla. Sin dependencias nuevas (regla 36).
 *
 * `innerHTML` se guarda TAL CUAL: lo que se afirma después se afirma sobre el marcado que la
 * vista produjo, no sobre su código fuente. Es la lección de SCRUM-402 — un texto que está en
 * el `.js` puede no llegar nunca a la pantalla, y al revés.
 */
function montar() {
  const contenedor = { innerHTML: '', hijos: [] };
  const ctx = {
    console,
    window: null,
    document: {
      createElement: () => ({ style: {}, setAttribute() {}, appendChild() {}, innerHTML: '' }),
    },
    Date,
    Array,
    Object,
    String,
    Number,
    JSON,
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(JS, 'parteDetailView.js'), 'utf8'), ctx, {
    filename: 'parteDetailView.js',
  });
  return { ctx, contenedor };
}

const PARTE_PINTABLE = {
  id: 7,
  numero: 'PT-2026-001',
  clienteNombre: 'Comunidad Los Olivos',
  fecha: '2026-09-02T08:00:00.000Z',
  obra: 'C/ Mayor 3, portal B',
  referencia: 'REF-778',
  entrada: '09:15',
  salida: '11:40',
  desplazamientos: 1,
  kilometros: 12.5,
  tecnicos: ['Israel', 'Miguel', 'Jesús L.'],
  tipo: 'reparacion_asistencia',
  lineas: [
    { bloque: 'mano_obra', unds: 2.5, descripcion: 'Revisión de caldera' },
    { bloque: 'materiales', unds: 1, descripcion: 'Presostato' },
  ],
  notas: 'Se cambió el presostato.',
  estado: 'borrador',
  puedeEditarContenido: { ok: true, motivo: null },
  puedeEditarPrecios: { ok: true, motivo: null },
};

test('SCRUM-652c · la pantalla pinta el parte: los DOS bloques y las TRES casillas', () => {
  const { ctx, contenedor } = montar();
  assert.equal(typeof ctx.renderParte, 'function', '🔴 la vista no publica `renderParte`');

  const pintado = ctx.renderParte(contenedor, PARTE_PINTABLE);
  assert.equal(pintado, true, '🔴 la vista se ha negado a pintar un parte válido');

  const html = contenedor.innerHTML;
  assert.ok(html.includes('data-parte-bloque="mano_obra"'), '🔴 falta el bloque de mano de obra');
  assert.ok(html.includes('data-parte-bloque="materiales"'), '🔴 falta el bloque de materiales');
  assert.ok(html.includes('Revisión de caldera'), '🔴 no pinta la línea de mano de obra');
  assert.ok(html.includes('Presostato'), '🔴 no pinta la línea de materiales');

  // Las tres casillas de tipo, EXCLUYENTES: radios con el mismo `name`, no checkboxes.
  const radios = (html.match(/type="radio" name="parte-tipo"/g) || []).length;
  assert.equal(radios, 3, `🔴 el tipo tiene ${radios} casillas excluyentes y el papel tiene 3`);
  assert.ok(!/type="checkbox"[^>]*parte-tipo/.test(html),
    '🔴 el tipo se pinta con casillas MARCABLES A LA VEZ. En el papel es una sola.');

  // Los tres técnicos van juntos, como en el papel.
  assert.ok(html.includes('Israel, Miguel, Jesús L.'), '🔴 no pinta los tres técnicos juntos');

  // Y las horas y el desplazamiento, que también van en el impreso.
  assert.ok(html.includes('09:15') && html.includes('11:40'), '🔴 faltan entrada y salida');
  assert.ok(html.includes('12.5'), '🔴 faltan los kilómetros');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// ③ EL ROJO POR EL MECANISMO
// ─────────────────────────────────────────────────────────────────────────────────────────

test('SCRUM-652c · 🔴 UN IMPORTE EN LA PANTALLA LA PONE ROJA, Y EL ROJO LO NOMBRA', () => {
  const { ctx, contenedor } = montar();
  ctx.renderParte(contenedor, PARTE_PINTABLE);
  const html = contenedor.innerHTML;

  // Se busca en el MARCADO PINTADO, no en el fichero: es la única forma de afirmar «no se ve».
  const sospechas = [
    { patron: /\d+[.,]\d{2}\s*€/, que: 'un importe con el símbolo del euro' },
    { patron: /€/, que: 'el símbolo del euro' },
    { patron: /precioUnitario/i, que: 'el precio unitario' },
    { patron: /tipoIva/i, que: 'el tipo de IVA' },
    { patron: /\bimporte\b/i, que: 'la palabra «importe»' },
    { patron: /\bsubtotal\b/i, que: 'un subtotal' },
    { patron: /\btotal\b/i, que: 'un total' },
  ];
  const encontrados = sospechas.filter((s) => s.patron.test(html)).map((s) => s.que);

  assert.deepEqual(encontrados, [],
    '🔴 LA PANTALLA DEL TÉCNICO ESTÁ PINTANDO DINERO: ' + encontrados.join(' · ') + '.\n' +
    '   En el parte real firmado la columna IMPORTE está EN BLANCO: el técnico firma en la obra\n' +
    '   sin precios y el jefe los pone en la oficina después. Aunque el resto de los tests pasen,\n' +
    '   esto rompe su forma de trabajar.');

  // 🔴 EL CONTROL POSITIVO DEL PROPIO DETECTOR, sin el cual el verde de arriba no vale nada: se
  // le da a la MISMA función una pantalla que sí pinta dinero y tiene que cazarla. Sin esto,
  // un detector roto —una regex que no casa nunca— daría exactamente el mismo verde.
  const conDinero = html + '<td>1.250,00 €</td>';
  const cazados = sospechas.filter((s) => s.patron.test(conDinero)).map((s) => s.que);
  assert.ok(cazados.length > 0,
    '🔴 el detector NO caza un importe puesto a mano. Entonces el verde de arriba no dice que no ' +
    'haya dinero: dice que el detector no mira.');
});

test('SCRUM-652c · los precios NO CRUZAN EL CABLE aunque estén en la fila', () => {
  // El mecanismo de verdad no es la pantalla: es que no le lleguen. Se le pasa un parte cuyas
  // líneas traen precio —como lo tendría después de que la oficina valore— y se comprueba que la
  // vista no los pinta ni por accidente.
  const { ctx, contenedor } = montar();
  const valorado = JSON.parse(JSON.stringify(PARTE_PINTABLE));
  valorado.lineas = [
    { bloque: 'mano_obra', unds: 2.5, descripcion: 'Revisión de caldera', precioUnitario: 38, tipoIva: 21 },
  ];
  ctx.renderParte(contenedor, valorado);
  assert.ok(!/38|21\s*%|€/.test(contenedor.innerHTML),
    '🔴 la vista ha pintado un precio que venía en la línea. El serializador del servidor no debería ' +
    'mandarlos, pero la vista tampoco puede depender de eso: son dos redes, no una.');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// EL SUELO
// ─────────────────────────────────────────────────────────────────────────────────────────

const SIMBOLOS_DE_FIRMA = [
  'firmarConRedDeSeguridad', 'drenarAlAbrir', 'guardarFirmaPendiente', 'quitarFirmaPendiente',
  'leerFirmasPendientes', 'openSignaturePad', 'confirmaElServidor', 'marcarQueHuboCola',
];

/** Los ficheros que SON la maquinaria de firmas. Sin comentarios: mencionar no es usar. */
function barrerMaquinariaDeFirmas() {
  return fs.readdirSync(JS)
    .filter((f) => f.endsWith('.js'))
    .filter((f) => {
      const sinComentarios = fs.readFileSync(path.join(JS, f), 'utf8').replace(/^\s*\/\/.*$/gm, '');
      return SIMBOLOS_DE_FIRMA.some((s) => sinComentarios.includes(s));
    });
}

test('SCRUM-652c · 🔴 SUELO: cero ficheros de firma es CEGUERA, no un producto sin firmas', () => {
  const encontrados = barrerMaquinariaDeFirmas();
  assert.notEqual(encontrados.length, 0,
    '🔴 el barrido de la maquinaria de firmas ve CERO ficheros. Eso NO significa «el producto no ' +
    'firma»: significa que este instrumento no está mirando donde cree —la carpeta se movió, los ' +
    'símbolos se renombraron—. Con cero, todos los tests de abajo pasarían por no encontrar nada.');
  // MEDIDO, no heredado: en `origin/main` son 7 y con el parte son 8. Si baja de 8, una pieza de
  // la maquinaria de firmas ha desaparecido y hay que decir cuál.
  assert.ok(encontrados.length >= 8,
    `🔴 la maquinaria de firmas ha encogido a ${encontrados.length} ficheros (${encontrados.join(', ')}). ` +
    'Eran 8 con el parte dentro.');
  assert.ok(encontrados.includes('parteDetailView.js'),
    '🔴 el parte ha salido de la maquinaria de firmas: ya no usa ninguna de sus piezas.');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// ④ CONTROL POSITIVO · EL ALBARÁN SIGUE IGUAL, ENUMERADO
// ─────────────────────────────────────────────────────────────────────────────────────────

/** La cola de firmas, cargada con sus dependencias, sobre un almacén y una red de mentira. */
function bancoDeCola(opciones = {}) {
  const almacen = new Map();
  const subidas = [];
  const ctx = {
    console, window: null, Date, JSON, Array, Object, String, Number, Promise, Error, Math,
    setTimeout, clearTimeout,
  };
  ctx.window = ctx;
  vm.createContext(ctx);

  // Los estados y las piezas del almacén: se inyectan, que es como el fichero los espera.
  ctx.GUARDADO = 'guardado';
  ctx.FALLO = 'fallo';
  ctx.NO_DISPONIBLE = 'no_disponible';
  ctx.FIRMA_SOLO_EN_ESTE_MOVIL = 'solo_en_este_movil';
  ctx.FIRMA_A_SALVO = 'a_salvo';
  ctx.marcarQueHuboCola = () => {};
  ctx.guardarFirmaPendiente = async (f) => { almacen.set(f.claveIdempotencia, f); return { estado: 'guardado' }; };
  ctx.quitarFirmaPendiente = async (c) => { almacen.delete(c); return { estado: 'guardado' }; };
  ctx.leerFirmasPendientes = async () => ({ estado: 'guardado', firmas: [...almacen.values()] });
  ctx.confirmaElServidor = (r) => !!(r && r.id);
  ctx.esperarLoQueLaRed = async (p) => {
    try { return { valor: await p }; } catch (error) { return { error }; }
  };
  ctx.apiRequest = async (ruta, opts) => {
    subidas.push({ ruta, opts });
    if (opciones.red === 'caida') throw Object.assign(new Error('sin red'), { status: 0 });
    if (opciones.red === 'yaLaTiene') {
      throw Object.assign(new Error('ya firmado'), { status: 409, code: opciones.codigo || 'albaran_locked' });
    }
    return { id: 1 };
  };
  ctx.pintarAvisoDeFirmas = () => {};

  vm.runInContext(fs.readFileSync(path.join(JS, 'colaDeFirmas.js'), 'utf8'), ctx, {
    filename: 'colaDeFirmas.js',
  });
  return { ctx, almacen, subidas };
}

test('SCRUM-652c · ✅ CONTROL POSITIVO: el albarán firma EXACTAMENTE como antes', async () => {
  const { ctx, almacen, subidas } = bancoDeCola();

  // 1. La clave del albarán NO cambia: es la que ya tienen los móviles guardada.
  assert.equal(ctx.claveDeFirma(7), 'firma:albaran:7',
    '🔴 la clave del albarán ha cambiado de forma. Las firmas YA ENCOLADAS en los móviles quedarían ' +
    'huérfanas, que es justo lo que esta máquina existe para no hacer.');

  // 2. Firmar SIN pasar tipo sigue yendo al albarán.
  const r = await ctx.firmarConRedDeSeguridad(7, { signatureData: 'x' }, () =>
    ctx.apiRequest('/admin/albaranes/7/firmar', { method: 'POST' }));
  assert.equal(r.estado, ctx.FIRMA_A_SALVO, '🔴 el albarán ya no llega a «a salvo»');
  assert.equal(r.encolada, true, '🔴 el albarán ha dejado de tener red de seguridad');
  assert.equal(almacen.size, 0, '🔴 la firma confirmada no ha salido de la cola');
  assert.equal(subidas[0].ruta, '/admin/albaranes/7/firmar', '🔴 el albarán ha cambiado de endpoint');

  // 3. Una firma ANTIGUA —encolada antes de que existiera `tipo`— sigue drenando al albarán.
  const viejo = bancoDeCola();
  viejo.almacen.set('firma:albaran:9', { claveIdempotencia: 'firma:albaran:9', albaranId: 9, signatureData: 'x' });
  await viejo.ctx.drenarFirmasPendientes(viejo.ctx.subirFirmaDeLaCola || ((f) => viejo.ctx.apiRequest(
    '/admin/albaranes/' + f.albaranId + '/firmar', { method: 'POST' })));
  assert.equal(viejo.almacen.size, 0,
    '🔴 una firma encolada por una versión ANTERIOR a SCRUM-652 ya no drena. Sobrevivió a la falta ' +
    'de cobertura y la ha matado un refactor.');

  // 4. El 409 del albarán sigue siendo un ÉXITO al drenar.
  const yaLaTiene = bancoDeCola({ red: 'yaLaTiene', codigo: 'albaran_locked' });
  yaLaTiene.almacen.set('firma:albaran:11', { claveIdempotencia: 'firma:albaran:11', albaranId: 11, signatureData: 'x' });
  const res = await yaLaTiene.ctx.drenarFirmasPendientes((f) =>
    yaLaTiene.ctx.apiRequest('/admin/albaranes/' + f.albaranId + '/firmar', { method: 'POST' }));
  assert.equal(res.yaEstaban, 1, '🔴 `albaran_locked` ha dejado de contar como «el servidor ya la tiene»');
  assert.equal(yaLaTiene.almacen.size, 0, '🔴 y por eso se ha quedado dando vueltas en la cola para siempre');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// ⑤ SIN COBERTURA · el flujo entero, con LA COLA QUE YA EXISTE
// ─────────────────────────────────────────────────────────────────────────────────────────

test('SCRUM-652c · 🔴 SIN RED: el parte se firma, se encola, y sube al ABRIR la aplicación', async () => {
  // No hay segunda cola: es la misma máquina, con un cuarto argumento que dice de qué documento
  // es la firma. Si se hubiera construido otra, este test cargaría otro fichero.
  const sinRed = bancoDeCola({ red: 'caida' });

  const r = await sinRed.ctx.firmarConRedDeSeguridad(
    7, { signatureData: 'data:image/png;base64,AAA', firmadoPorNombre: 'Ana Ruiz' },
    () => sinRed.ctx.apiRequest('/admin/partes/7/firmar', { method: 'POST' }),
    'parte',
  );

  assert.equal(r.estado, sinRed.ctx.FIRMA_SOLO_EN_ESTE_MOVIL,
    '🔴 sin red se ha declarado la firma A SALVO. Es el fallo mudo: el técnico se va creyendo que subió.');
  assert.equal(r.encolada, true, '🔴 sin red la firma NO ha entrado en la cola. Se pierde al cerrar la app.');

  // 🔴 Y NO PISA AL ALBARÁN 7: la clave lleva el tipo. Sin esto, encolar el parte 7 se habría
  // llevado por delante la firma del albarán 7 que ya estuviera esperando.
  const claves = [...sinRed.almacen.keys()];
  assert.deepEqual(claves, ['firma:parte:7'],
    '🔴 la firma del parte se ha guardado con la clave equivocada: ' + claves.join(', '));

  // Ahora vuelve la cobertura y se abre la aplicación: drena SOLA, y AL ENDPOINT DEL PARTE.
  const conRed = bancoDeCola();
  for (const [k, v] of sinRed.almacen) conRed.almacen.set(k, v);
  const res = await conRed.ctx.drenarFirmasPendientes(conRed.ctx.subirFirmaDeLaCola);

  assert.equal(res.subidas, 1, '🔴 la firma del parte no ha subido al drenar. Fallidas: ' + JSON.stringify(res.fallidas));
  assert.equal(conRed.almacen.size, 0, '🔴 subió pero no salió de la cola: quedaría subiéndose para siempre');
  assert.equal(conRed.subidas[0].ruta, '/admin/partes/7/firmar',
    '🔴 la firma del PARTE se ha subido a ' + conRed.subidas[0].ruta + '. Ahí ese id no es un parte.');
});

// ────────────────────────────────────────────────────────────────────────────────────
// 🔴 EL HUECO QUE ENCONTRÓ EL CUARTO ROJO, Y QUE NO SE TAPA CON UN PARCHE
//
// Los tests de arriba llamaban a `firmarConRedDeSeguridad` DIRECTAMENTE, pasándole `'parte'` a
// mano. O sea: probaban la COLA, no el CABLE. Se quitó el `'parte'` de `parteDetailView.js` —el
// olvido más fácil de cometer— y los trece pasaron en verde con la firma yendo al endpoint del
// albarán.
//
// Un test que inyecta el valor que quiere comprobar no comprueba nada: comprueba su propio
// argumento. Lo que hay que ejercitar es la función DE LA VISTA, con dobles, y mirar con qué
// llama a la cola.
// ────────────────────────────────────────────────────────────────────────────────────

test('SCRUM-652c · 🔴 LA VISTA le dice a la cola que esto es un PARTE', async () => {
  const { ctx } = montar();
  assert.equal(typeof ctx.firmarParte, 'function', '🔴 la vista no publica `firmarParte`');

  let padAbierto = null;
  const llamadas = [];
  const abierto = ctx.firmarParte(PARTE_PINTABLE, {
    abrirPad: (o) => { padAbierto = o; },
    firmar: async (id, cuerpo, subir, tipo) => { llamadas.push({ id, tipo }); return { estado: 'ok' }; },
    apiRequest: async () => ({ id: 1 }),
  });
  assert.equal(abierto, true, '🔴 la vista no ha abierto el pad de firma');
  assert.ok(padAbierto && typeof padAbierto.onConfirm === 'function', '🔴 el pad no recibe `onConfirm`');

  await padAbierto.onConfirm('data:image/png;base64,AAA', { firmadoPorNombre: 'Ana Ruiz' });

  assert.deepEqual(llamadas, [{ id: 7, tipo: 'parte' }],
    '🔴 la vista ha firmado SIN decirle a la cola que esto es un parte. Sin ese cuarto '
    + 'argumento la firma se encola con la clave del ALBARÁN y el drenado la sube a '
    + '`/admin/albaranes/7/firmar`, donde ese id no es un parte —y además pisaría la firma del '
    + 'albarán 7 si la hubiera. Es el fallo que los trece tests anteriores dejaban pasar EN VERDE '
    + 'porque le pasaban el tipo a mano en vez de mirar el de la vista.');
});

test('SCRUM-652c · 🔴 lo que se le enseña al firmante en el pad tampoco lleva dinero', () => {
  const { ctx } = montar();
  let padAbierto = null;
  const valorado = JSON.parse(JSON.stringify(PARTE_PINTABLE));
  valorado.lineas = [
    { bloque: 'mano_obra', unds: 2.5, descripcion: 'Revisión de caldera', precioUnitario: 38, tipoIva: 21 },
  ];
  ctx.firmarParte(valorado, {
    abrirPad: (o) => { padAbierto = o; },
    firmar: async () => ({ estado: 'ok' }),
    apiRequest: async () => ({ id: 1 }),
  });

  const resumen = JSON.stringify((padAbierto && padAbierto.albaran) || {});
  assert.ok(!/precioUnitario|tipoIva|"38"|:38|\u20ac/.test(resumen),
    '🔴 el resumen que ve el FIRMANTE lleva importes: ' + resumen + '.\n'
    + '   Aquí firma quien esté delante —el portero, un familiar, el encargado— y enseñarle precios '
    + 'es revelar condiciones comerciales a un tercero.');
});

test('SCRUM-652c · 🔴 `parte_locked` es un ÉXITO al drenar, igual que el del albarán', async () => {
  const banco = bancoDeCola({ red: 'yaLaTiene', codigo: 'parte_locked' });
  banco.almacen.set('firma:parte:7', {
    claveIdempotencia: 'firma:parte:7', albaranId: 7, tipo: 'parte', signatureData: 'x',
  });
  const res = await banco.ctx.drenarFirmasPendientes(banco.ctx.subirFirmaDeLaCola);
  assert.equal(res.yaEstaban, 1,
    '🔴 el 409 `parte_locked` se ha leído como FALLO. Esa firma no saldría de la cola jamás: cada ' +
    'apertura reintentaría, cada reintento daría 409, y el contador le diría al profesional que ' +
    'tiene pendiente algo que lleva semanas a salvo.');
  assert.equal(banco.almacen.size, 0, '🔴 y sigue dentro de la cola');
});

test('SCRUM-652c · 🔴 un documento de tipo DESCONOCIDO no se sube al albarán «por si acaso»', async () => {
  const banco = bancoDeCola();
  banco.almacen.set('firma:factura:3', {
    claveIdempotencia: 'firma:factura:3', albaranId: 3, tipo: 'factura', signatureData: 'x',
  });
  const res = await banco.ctx.drenarFirmasPendientes(banco.ctx.subirFirmaDeLaCola);
  assert.equal(res.subidas, 0, '🔴 ha subido la firma de un documento que no sabe encaminar');
  assert.equal(banco.almacen.size, 1, '🔴 y además la ha sacado de la cola: firma perdida');
  assert.equal(banco.subidas.length, 0,
    '🔴 ha llamado a la API con una ruta adivinada: ' + JSON.stringify(banco.subidas));
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// EL SUELO DE LA PANTALLA
// ─────────────────────────────────────────────────────────────────────────────────────────

test('SCRUM-652c · 🔴 un parte sin líneas legibles NO se pinta como «parte vacío»', () => {
  const { ctx, contenedor } = montar();
  const roto = Object.assign({}, PARTE_PINTABLE, { lineas: undefined });
  assert.equal(ctx.renderParte(contenedor, roto), false,
    '🔴 la vista ha pintado un parte cuyas líneas no supo leer. «No hay líneas» y «no supe leerlas» ' +
    'son la misma pantalla y significan lo contrario: el técnico firmaría un documento que no dice ' +
    'lo que hizo.');
  assert.equal(contenedor.innerHTML, '', '🔴 y además ha dejado marcado pintado');
});

// 🔴 SCRUM-653 · ESTE TEST SE ACTUALIZA AL HECHO, NO SE RELAJA.
//
// Decía: «si `estado === 'firmado'`, no se ofrece firmar». Con UNA firma eso era cierto. Con DOS
// **`firmado` ya no significa «el cliente firmó»**: significa que firmó ALGUIEN, y el contenido se
// congeló. Si el técnico firmó primero, el estado ya es `firmado` y el cliente **tiene que poder
// firmar** — con el aserto viejo, el segundo firmante se quedaba fuera según el orden.
//
// Así que lo que se comprueba pasa a ser POR RANURA, que es más fuerte: cada firma se ofrece si y
// sólo si falta la SUYA.
test('SCRUM-653 · 🔴 cada firma se ofrece SOLO si falta la suya (no según el estado)', () => {
  const { ctx, contenedor } = montar();

  // ① Nadie ha firmado: se ofrecen las DOS.
  ctx.renderParte(contenedor, Object.assign({}, PARTE_PINTABLE, {
    firmoElCliente: false, firmoElTecnico: false,
  }));
  assert.match(contenedor.innerHTML, /data-parte-firmar="1"/,
    '🔴 sin firmas no se ofrece la del cliente');
  assert.match(contenedor.innerHTML, /data-parte-firmar-tecnico="1"/,
    '🔴 sin firmas no se ofrece la del técnico');

  // ② EL TÉCNICO FIRMÓ PRIMERO. El estado ya es `firmado` — y el cliente TIENE que poder firmar.
  ctx.renderParte(contenedor, Object.assign({}, PARTE_PINTABLE, {
    estado: 'firmado',
    puedeEditarContenido: { ok: false, motivo: 'el parte está firmado' },
    firmoElCliente: false, firmoElTecnico: true, firmadoTecnicoNombre: 'Israel',
  }));
  assert.match(contenedor.innerHTML, /data-parte-firmar="1"/,
    '🔴 el técnico firmó primero y ahora EL CLIENTE NO PUEDE FIRMAR. El candado se puso al ' +
    'estado en vez de a la ranura, y el segundo firmante se queda fuera según el orden — justo lo ' +
    'que `ordenDeFirmaExigido()` dice que no se exige.');
  assert.match(contenedor.innerHTML, /data-parte-firmar-tecnico-hecha/,
    '🔴 no dice que el técnico ya firmó');
  assert.ok(!/data-parte-firmar-tecnico="1"/.test(contenedor.innerHTML),
    '🔴 el técnico puede firmar DOS veces: la segunda pisaría el trazo de la primera, y de eso ' +
    'no queda rastro.');

  // ③ Las dos puestas: ningún botón, y ya no falta ninguna.
  ctx.renderParte(contenedor, Object.assign({}, PARTE_PINTABLE, {
    estado: 'firmado',
    puedeEditarContenido: { ok: false, motivo: 'el parte está firmado' },
    firmoElCliente: true, firmoElTecnico: true,
    firmadoPorNombre: 'Ana Ruiz', firmadoTecnicoNombre: 'Israel',
  }));
  assert.ok(!/data-parte-firmar="1"/.test(contenedor.innerHTML), '🔴 ofrece firmar al cliente otra vez');
  assert.ok(!/data-parte-firmar-tecnico="1"/.test(contenedor.innerHTML), '🔴 ofrece firmar al técnico otra vez');
  assert.ok(!/data-parte-falta-firma/.test(contenedor.innerHTML),
    '🔴 con las dos firmas puestas sigue diciendo que falta una');
});
