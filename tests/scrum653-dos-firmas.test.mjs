// tests/scrum653-dos-firmas.test.mjs — SCRUM-653 · FIRMA CLIENTE y FIRMA TÉCNICO.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// LAS TRES COSAS QUE DECIDEN EL TICKET, Y QUE ESTE FICHERO FIJA
//
// ① EL SELLO NO PUEDE DEPENDER DE QUIÉN FIRMA PRIMERO. La v:1 sellaba `firmadoPorNombre` y
//    `firmadoPorCalidad`. Con dos firmas eso da DOS huellas distintas para el MISMO contenido
//    según el orden. La v:2 sella sólo el contenido; las firmas son evidencia adherida.
//
// ② EL CONTENIDO SE CONGELA CON LA PRIMERA FIRMA. Medido antes de tocar: ya lo hacía. Lo que
//    cambia es el CANDADO DE FIRMA, que pasa de mirar el estado a mirar la RANURA — si no, el
//    segundo firmante se queda fuera según el orden.
//
// ③ EL TÉCNICO NO TIENE «CALIDAD». Las seis opciones existen porque quien firma POR EL CLIENTE
//    puede ser cualquiera. El técnico es un empleado identificado.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
// SCRUM-694: el filtro de comentarios NO se fabrica aquí.
import { soloCodigo } from './_solo-codigo.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const JS = path.join(RAIZ, 'public', 'dashboard', 'js');

const {
  computeParteContentHash,
  puedeEditarContenido,
  puedeFirmarCliente,
  puedeFirmarTecnico,
  firmasCompletas,
  ordenDeFirmaExigido,
  PARTE_CONTENIDO_VERSION_ACTUAL,
} = await import('../dist/modules/jobs/domain/parteTrabajo.js');

/** Un parte de verdad, sin firmantes: lo que se sella. */
function contenido(extra = {}) {
  return Object.assign({
    numero: 'PT-2026-001',
    fecha: new Date('2026-09-03T08:00:00.000Z'),
    cliente: 'Comunidad Los Olivos',
    obra: 'C/ Mayor 3',
    referencia: 'REF-778',
    entrada: '09:15',
    salida: '11:40',
    desplazamientos: 1,
    kilometros: 12.5,
    tecnicos: ['Israel'],
    tipo: 'reparacion_asistencia',
    lineas: [{ bloque: 'mano_obra', unds: 2.5, descripcion: 'Revisión de caldera' }],
    notas: null,
    firmadoPorNombre: null,
    firmadoPorCalidad: null,
  }, extra);
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// ① EL SELLO
// ─────────────────────────────────────────────────────────────────────────────────────────

test('SCRUM-653 · 🔴 LA HUELLA NO DEPENDE DE QUIÉN FIRMÓ PRIMERO', () => {
  // El mismo contenido, con las dos secuencias posibles de firmantes. Si el sello cambia, el
  // documento tiene una huella distinta según el orden — y eso no es un sello.
  const base = computeParteContentHash(contenido(), 2);

  const clientePrimero = computeParteContentHash(
    contenido({ firmadoPorNombre: 'Ana Ruiz', firmadoPorCalidad: 'portero_o_conserje' }), 2);
  const tecnicoPrimero = computeParteContentHash(
    contenido({ firmadoPorNombre: null, firmadoPorCalidad: null }), 2);

  assert.equal(clientePrimero, base,
    '🔴 poner el firmante ha CAMBIADO la huella. Con dos firmas eso significa que el documento ' +
    'tiene un hash distinto según quién firme primero: no es un sello, es un número que cambia solo.');
  assert.equal(tecnicoPrimero, base, '🔴 y al revés, lo mismo');
});

test('SCRUM-653 · 🔴 CONTROL POSITIVO del mismo mecanismo: el CONTENIDO sí mueve la huella', () => {
  // Sin esto, el test de arriba pasaría igual con un sello que no sella nada.
  const base = computeParteContentHash(contenido(), 2);
  assert.notEqual(computeParteContentHash(contenido({ obra: 'C/ Otra 9' }), 2), base,
    '🔴 cambiar la OBRA no mueve la huella: el sello no está sellando nada.');
  assert.notEqual(
    computeParteContentHash(contenido({
      lineas: [{ bloque: 'mano_obra', unds: 3, descripcion: 'Revisión de caldera' }],
    }), 2), base,
    '🔴 cambiar las UNIDADES tampoco la mueve.');
});

test('SCRUM-653 · la v:1 se conserva ENTERA e intacta, y sigue sellando al firmante', () => {
  // Un parte ya sellado con v:1 se verifica con v:1. Cambiarle el significado a una versión
  // publicada rompe en silencio los documentos que ya la usan (lección de SCRUM-438).
  const sinFirmante = computeParteContentHash(contenido(), 1);
  const conFirmante = computeParteContentHash(
    contenido({ firmadoPorNombre: 'Ana Ruiz', firmadoPorCalidad: 'el_propio_cliente' }), 1);
  assert.notEqual(sinFirmante, conFirmante,
    '🔴 la v:1 ha dejado de sellar al firmante. Los partes sellados con ella dejarían de verificar.');

  assert.equal(PARTE_CONTENIDO_VERSION_ACTUAL, 2, '🔴 la versión actual ya no es la 2');
});

test('SCRUM-653 · 🔴 una versión desconocida LANZA, no elige rama', () => {
  assert.throws(() => computeParteContentHash(contenido(), 3), /desconocida/,
    '🔴 un despachador que elige rama para una versión que no reconoce está ADIVINANDO, y un ' +
    'valor adivinado en un documento firmado coincide por accidente hasta el día que no.');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// ② LOS CANDADOS
// ─────────────────────────────────────────────────────────────────────────────────────────

test('SCRUM-653 · 🔴 EL CANDADO ES POR RANURA: el segundo firmante NO se queda fuera', () => {
  // El caso que rompía: el técnico firma primero, el estado pasa a `firmado`, y con un candado
  // por ESTADO el cliente ya no podría firmar. El orden no se exige, así que no puede decidirlo.
  const soloTecnico = { firmadoAt: null, firmadoTecnicoAt: new Date() };
  assert.equal(puedeFirmarCliente(soloTecnico).ok, true,
    '🔴 el técnico firmó primero y el CLIENTE ya no puede firmar. El candado mira el estado en ' +
    'vez de la ranura, y el segundo firmante se queda fuera según el orden.');
  assert.equal(puedeFirmarTecnico(soloTecnico).ok, false,
    '🔴 el técnico puede firmar dos veces: la segunda pisa el trazo de la primera y no queda rastro.');

  const soloCliente = { firmadoAt: new Date(), firmadoTecnicoAt: null };
  assert.equal(puedeFirmarTecnico(soloCliente).ok, true, '🔴 el técnico no puede firmar después del cliente');
  assert.equal(puedeFirmarCliente(soloCliente).ok, false, '🔴 el cliente puede firmar dos veces');

  // Y el motivo viaja: «no se puede» a secas manda al profesional a adivinar.
  assert.match(String(puedeFirmarCliente(soloCliente).motivo), /cliente/i);
  assert.match(String(puedeFirmarTecnico(soloTecnico).motivo), /t[eé]cnico/i);
});

test('SCRUM-653 · 🔴 el CONTENIDO se congela con la PRIMERA firma, y eso NO cambia', () => {
  // Medido antes de tocar: ya lo hacía. Se fija para que nadie lo «arregle» a congelar con las
  // dos — si el contenido siguiera abierto, se podría modificar lo que el otro ya firmó.
  assert.equal(puedeEditarContenido('borrador').ok, true, '🔴 el borrador no se puede editar');
  assert.equal(puedeEditarContenido('firmado').ok, false,
    '🔴 el contenido sigue abierto tras la PRIMERA firma. Entre las dos firmas se podría cambiar ' +
    'lo que el primer firmante ya avaló, y no volvería a mirarlo.');
  assert.equal(puedeEditarContenido('facturado').ok, false, '🔴 el contenido se puede editar ya facturado');
});

test('SCRUM-653 · `firmasCompletas` se DERIVA de las dos fechas, no de una bandera', () => {
  assert.equal(firmasCompletas({ firmadoAt: null, firmadoTecnicoAt: null }), false);
  assert.equal(firmasCompletas({ firmadoAt: new Date(), firmadoTecnicoAt: null }), false,
    '🔴 con una sola firma se da el parte por completo');
  assert.equal(firmasCompletas({ firmadoAt: null, firmadoTecnicoAt: new Date() }), false);
  assert.equal(firmasCompletas({ firmadoAt: new Date(), firmadoTecnicoAt: new Date() }), true);
});

test('SCRUM-653 · el ORDEN no se exige, y está escrito en un sitio', () => {
  assert.equal(ordenDeFirmaExigido(), null,
    '🔴 se ha empezado a exigir un orden de firma. En la obra firma quien esté libre primero, y ' +
    'el sello es del contenido: la huella es la misma firme quien firme.');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// ③ EL TÉCNICO NO TIENE «CALIDAD» — y el trazo del cliente SE GUARDA
// ─────────────────────────────────────────────────────────────────────────────────────────

const RUTAS = fs.readFileSync(
  path.join(RAIZ, 'src', 'modules', 'jobs', 'app', 'routes', 'partes.routes.ts'), 'utf8');

/** El bloque de UNA ruta, sin comentarios. Atado al bloque, no al fichero (SCRUM-694). */
function rutaSinComentarios(patron) {
  const m = RUTAS.match(patron);
  assert.ok(m, `🔴 SUELO: no encuentro la ruta ${patron}. Sin ella nada de esto significa nada.`);
  return soloCodigo(m[0], 'ruta.ts');
}

test('SCRUM-653 · 🔴 la ruta del TÉCNICO no ofrece «en calidad de»', () => {
  const tecnico = rutaSinComentarios(/router\.post\('\/:id\/firmar-tecnico'[\s\S]*?\n\}\);/);
  assert.ok(!/resolverCalidadFirmante|firmadoPorCalidad/.test(tecnico),
    '🔴 la firma del técnico ha ganado una ranura de «calidad». Las seis opciones existen porque ' +
    'quien firma POR EL CLIENTE puede ser cualquiera —«portero o conserje», «un familiar»—. El ' +
    'técnico es un empleado identificado: ofrecerle esa ranura es ofrecerle declarar que firma ' +
    'en nombre del cliente.');
  assert.match(tecnico, /exigirNombreFirmante/,
    '🔴 el nombre del técnico ha dejado de ser obligatorio al firmar.');

  // CONTROL POSITIVO del detector: la ruta del CLIENTE sí la tiene, y el mismo detector la ve.
  const cliente = rutaSinComentarios(/router\.post\('\/:id\/firmar'[\s\S]*?\n\}\);/);
  assert.match(cliente, /resolverCalidadFirmante/,
    '🔴 el detector no encuentra la calidad ni siquiera donde SÍ está: no está mirando.');
});

test('SCRUM-653 · 🔴 EL TRAZO SE GUARDA — las dos firmas', () => {
  // Hasta este ticket la ruta del cliente VALIDABA `signatureData` y lo TIRABA: el parte guardaba
  // que se firmó y quién dijo ser, pero no la firma. Defecto de la fase C.
  const cliente = rutaSinComentarios(/router\.post\('\/:id\/firmar'[\s\S]*?\n\}\);/);
  assert.match(cliente, /signatureUrl:\s*signatureData/,
    '🔴 la firma del CLIENTE se valida y se tira: no se guarda en ninguna columna.');

  const tecnico = rutaSinComentarios(/router\.post\('\/:id\/firmar-tecnico'[\s\S]*?\n\}\);/);
  assert.match(tecnico, /signatureTecnicoUrl:\s*signatureData/,
    '🔴 la firma del TÉCNICO se valida y se tira.');
});

test('SCRUM-653 · 🔴 el schema declara las cuatro columnas, y ninguna es obligatoria', () => {
  const schema = fs.readFileSync(path.join(RAIZ, 'prisma', 'schema.prisma'), 'utf8');
  const m = schema.match(/^model ParteTrabajo \{[\s\S]*?^\}/m);
  assert.ok(m, '🔴 SUELO: no encuentro `model ParteTrabajo`');
  const bloque = soloCodigo(m[0], 'parte.prisma');

  for (const campo of ['signatureUrl', 'signatureTecnicoUrl', 'firmadoTecnicoAt', 'firmadoTecnicoNombre']) {
    const linea = bloque.split('\n').find((l) => new RegExp(`^\\s*${campo}\\s`).test(l));
    assert.ok(linea, `🔴 falta la columna \`${campo}\``);
    assert.match(linea, /\?/,
      `🔴 \`${campo}\` NO es nullable. Una columna nueva obligatoria sobre una tabla con filas ` +
      'falla en seco al aplicar el ALTER.');
  }
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// SIN COBERTURA · la misma cola, con un tipo más
// ─────────────────────────────────────────────────────────────────────────────────────────

function bancoDeCola(opciones = {}) {
  const almacen = new Map();
  const subidas = [];
  const ctx = {
    console, window: null, Date, JSON, Array, Object, String, Number, Promise, Error, Math,
    setTimeout, clearTimeout,
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  ctx.GUARDADO = 'guardado'; ctx.FALLO = 'fallo'; ctx.NO_DISPONIBLE = 'no_disponible';
  ctx.FIRMA_SOLO_EN_ESTE_MOVIL = 'solo_en_este_movil'; ctx.FIRMA_A_SALVO = 'a_salvo';
  ctx.marcarQueHuboCola = () => {};
  ctx.guardarFirmaPendiente = async (f) => { almacen.set(f.claveIdempotencia, f); return { estado: 'guardado' }; };
  ctx.quitarFirmaPendiente = async (c) => { almacen.delete(c); return { estado: 'guardado' }; };
  ctx.leerFirmasPendientes = async () => ({ estado: 'guardado', firmas: [...almacen.values()] });
  ctx.confirmaElServidor = (r) => !!(r && r.id);
  ctx.esperarLoQueLaRed = async (p) => { try { return { valor: await p }; } catch (error) { return { error }; } };
  ctx.apiRequest = async (ruta) => {
    subidas.push(ruta);
    if (opciones.red === 'caida') throw Object.assign(new Error('sin red'), { status: 0 });
    return { id: 1 };
  };
  ctx.pintarAvisoDeFirmas = () => {};
  vm.runInContext(fs.readFileSync(path.join(JS, 'colaDeFirmas.js'), 'utf8'), ctx,
    { filename: 'colaDeFirmas.js' });
  return { ctx, almacen, subidas };
}

test('SCRUM-653 · 🔴 SIN RED: las dos firmas se encolan APARTE y suben a SU ruta', () => {
  const sinRed = bancoDeCola({ red: 'caida' });

  // Las dos claves del MISMO parte tienen que ser distintas: con la misma, el `keyPath` del
  // almacén sobrescribe y una de las dos firmas desaparece EN SILENCIO.
  assert.equal(sinRed.ctx.claveDeFirma(7, 'parte'), 'firma:parte:7');
  assert.equal(sinRed.ctx.claveDeFirma(7, 'parte-tecnico'), 'firma:parte-tecnico:7');
  assert.notEqual(sinRed.ctx.claveDeFirma(7, 'parte'), sinRed.ctx.claveDeFirma(7, 'parte-tecnico'),
    '🔴 las dos firmas del mismo parte comparten clave: encolar una borra la otra.');

  return (async () => {
    await sinRed.ctx.firmarConRedDeSeguridad(7, { signatureData: 'x' }, () =>
      sinRed.ctx.apiRequest('/admin/partes/7/firmar'), 'parte');
    await sinRed.ctx.firmarConRedDeSeguridad(7, { signatureData: 'y' }, () =>
      sinRed.ctx.apiRequest('/admin/partes/7/firmar-tecnico'), 'parte-tecnico');

    assert.deepEqual([...sinRed.almacen.keys()].sort(), ['firma:parte-tecnico:7', 'firma:parte:7'],
      '🔴 las dos firmas no conviven en la cola: ' + [...sinRed.almacen.keys()].join(', '));

    // Vuelve la cobertura: drenan SOLAS y cada una a SU endpoint.
    const conRed = bancoDeCola();
    for (const [k, v] of sinRed.almacen) conRed.almacen.set(k, v);
    const res = await conRed.ctx.drenarFirmasPendientes(conRed.ctx.subirFirmaDeLaCola);

    assert.equal(res.subidas, 2, '🔴 no subieron las dos. Fallidas: ' + JSON.stringify(res.fallidas));
    assert.deepEqual(conRed.subidas.sort(),
      ['/admin/partes/7/firmar', '/admin/partes/7/firmar-tecnico'],
      '🔴 alguna firma fue a la ruta equivocada: ' + conRed.subidas.join(', '));
    assert.equal(conRed.almacen.size, 0, '🔴 subieron pero no salieron de la cola');
  })();
});

test('SCRUM-653 · ✅ CONTROL POSITIVO: el albarán sigue exactamente igual', () => {
  const banco = bancoDeCola();
  assert.equal(banco.ctx.claveDeFirma(7), 'firma:albaran:7',
    '🔴 la clave del albarán ha cambiado: las firmas ya encoladas en los móviles quedarían huérfanas.');
  return banco.ctx.drenarFirmasPendientes(banco.ctx.subirFirmaDeLaCola).then(async () => {
    banco.almacen.set('firma:albaran:9', { claveIdempotencia: 'firma:albaran:9', albaranId: 9, signatureData: 'x' });
    await banco.ctx.drenarFirmasPendientes(banco.ctx.subirFirmaDeLaCola);
    assert.deepEqual(banco.subidas, ['/admin/albaranes/9/firmar'],
      '🔴 una firma SIN `tipo` —encolada por una versión anterior— ha dejado de ir al albarán: ' +
      banco.subidas.join(', '));
  });
});
