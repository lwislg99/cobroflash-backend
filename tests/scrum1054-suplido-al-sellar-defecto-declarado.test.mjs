// tests/scrum1054-suplido-al-sellar-defecto-declarado.test.mjs — SCRUM-1054 (decisión c.21852: «Medir el sellado y fijarlo»)
//
// Sin gate: ni BD, ni red, ni certificado. EJECUTA el camino REAL de `dist/` sobre una factura con un
// suplido: los tres portones que `ensureInvoiceForCharge` (`src/lib/invoicing.ts`) pasa ANTES de pedir
// número, `sellarTrasEmision` (el único punto por el que una factura entra en la cadena, SCRUM-205), y
// el `registroParaRemision` que usa la cola. El banco es el de `scrum1296-emitir-encola`: se dobla la
// BASE (un cliente que apunta cada `modelo.método` y guarda la fila de la factura con estado) y NO se
// dobla nada del camino de emisión.
//
// No toca `src/`, ni el esquema, ni ninguna base (reglas 38 y 40): sólo LEE el camino de emisión.
//
// 🔴 ESTO NO ES UN VERDE QUE BENDICE EL COMPORTAMIENTO DE HOY. Es un TRINQUETE de UN defecto conocido,
// sobre el caso de c.21842: una F1 de 1.000 € al 21 % más un suplido de 100 € (IVA 0, como obliga
// `schemas.ts`) a un cliente con NIF. Lo que pasa hoy al sellarla:
//
//   · NINGÚN portón la para: `exigirLineasFacturables`, `exigirTiposDeIvaEmitibles` (el 0 % es un
//     tipo español) y `exigirCausaLineaEmitible` (sin causa no es asunto suyo) la dejan pasar.
//   · SE SELLA ENTERA: número, huella, QR y `vfEstado = sellado`. NO queda a medias. Y como está
//     sellada, `puedeProducirDocumento` dice que sí: el cliente recibe su PDF.
//   · SU REGISTRO NO EXISTE: el encolado llama a `registroParaRemision`, que pasa el tramo al 0 % por
//     `clasificarDetalleDesglose` y éste lanza `DesgloseNoClasificableError`. `encolarAltaTrasSellado`
//     no lanza (a propósito, SCRUM-1296): deja 0 filas en `vfSubmission` y UNA constancia
//     `encolado_fallido` con motivo `excluida`. El usuario no ve nada: la emisión sale como buena.
//
// 🔵 QUÉ TENDRÁ QUE CAMBIAR CUANDO SE DECIDA (c.21852: S-A, sacarlo de la base, o quitar la casilla):
//    · S-A: el registro se construye → la factura se ENCOLA → esto sale CAMBIADO y ROJO. El mismo PR
//      retira la entrada de `DEFECTO_CONOCIDO`, y el test del arreglo es de quien lo haga.
//    · quitar la casilla: un portón para la línea antes del número → sale CAMBIADO y ROJO, igual.
//    · 🔴 si un cambio deja la factura con NÚMERO y SIN HUELLA (`pendiente_de_sellado`), también sale
//      CAMBIADO y el motivo lo dice: es lo más grave que puede pasar aquí, y hoy NO pasa.
//
// Cómo trabaja (A23 · 7, igual que `scrum1732` y `scrum1730`):
//   · DECLARADO + defecto presente → verde, y dice que es un defecto conocido, no una conformidad.
//   · DECLARADO + el comportamiento cambió → ROJO.
//   · RETIRADO + defecto presente → ROJO: retirar la declaración no es arreglarlo.
//   · RETIRADO + arreglado → verde.
//   · el control sembrado (la MISMA factura sin el suplido se sella Y se encola) no sale → CIEGO, ROJO.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';

const RAIZ = path.resolve(import.meta.dirname, '..');
const requiere = createRequire(path.join(RAIZ, 'package.json'));
const rutaDe = (r) => requiere.resolve(path.join(RAIZ, r));

/**
 * 🔴 LA DECLARACIÓN DEL DEFECTO. Quien lo arregle retira la entrada en el mismo cambio
 * (`declarado: false` o borrándola). Mientras esté, cualquier cambio de este comportamiento tumba esto.
 */
export const DEFECTO_CONOCIDO = {
  suplidoSelladoSinRegistro: { declarado: true,
    tickets: ['SCRUM-1054'],
    que: 'una factura con un suplido pasa los portones, se sella entera (número, huella, QR y PDF) y su registro de alta no se construye: 0 filas en la cola y una constancia encolado_fallido «excluida»' },
};

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // S-A con la forma más corta: el tramo al 0 % se clasifica en vez de lanzar. El registro se
    // construye y la factura se encola → CAMBIADO.
    fichero: 'src/modules/fiscal/verifactu/registro.builder.ts',
    de: '  if (!Number.isFinite(entrada.rate) || entrada.rate <= 0) {',
    a: '  if (!Number.isFinite(entrada.rate) || entrada.rate < 0) {',
    cae: 'SCRUM-1054 · una factura con suplido se sella entera y su registro no se construye: defecto declarado',
  },
  {
    // «Quitar la casilla» con la forma de un portón: la línea marcada suplido se rechaza ANTES del
    // número → CAMBIADO.
    fichero: 'src/core/validation/tiposIvaEmitibles.ts',
    de: '  if (motivo) throw new TipoIvaNoEmitibleError(motivo);',
    a: "  if (motivo || (lines ?? []).some((l: any) => l?.suplido === true)) throw new TipoIvaNoEmitibleError(motivo ?? 'suplido');",
    cae: 'SCRUM-1054 · una factura con suplido se sella entera y su registro no se construye: defecto declarado',
  },
  {
    // Lo más grave: el sellado falla con un 0 % y la factura queda con número y sin huella → CAMBIADO.
    fichero: 'src/modules/invoicing/domain/verifactu.service.ts',
    de: "    throw new Error('invoice_without_lines_not_sealable');\n  }",
    a: "    throw new Error('invoice_without_lines_not_sealable');\n  }\n  if (lineas.some((l: any) => Number(l?.tax) === 0)) throw new Error('mutacion_scrum1054');",
    cae: 'SCRUM-1054 · una factura con suplido se sella entera y su registro no se construye: defecto declarado',
  },
  {
    // El control se queda ciego: la cola deja de escribir para TODAS → la factura sin suplido no se
    // encola → CIEGO, que es rojo.
    fichero: 'src/modules/invoicing/domain/encolarRemision.ts',
    de: '      if (yaEnCola > 0) return false;',
    a: '      if (yaEnCola >= 0) return false;',
    cae: 'SCRUM-1054 · una factura con suplido se sella entera y su registro no se construye: defecto declarado',
  },
  {
    // Se retira la declaración y el defecto sigue.
    fichero: 'tests/scrum1054-suplido-al-sellar-defecto-declarado.test.mjs',
    de: 'DEFECTO_CONOCIDO = {\n  suplidoSelladoSinRegistro: { declarado: true,',
    a: 'DEFECTO_CONOCIDO = {\n  suplidoSelladoSinRegistro: { declarado: false,',
    cae: 'SCRUM-1054 · una factura con suplido se sella entera y su registro no se construye: defecto declarado',
  },
];

// ── El caso de c.21842 ──────────────────────────────────────────────────────────────────────────
const NIF = 'B12345678';
const FACTURA = Object.freeze({
  id: 10541, number: '2026-CF-1054', total: { toString: () => '1310.00' },
  createdAt: new Date('2026-11-13T10:00:00Z'), merchantId: 77, type: 'F1',
});
const OBRA = Object.freeze({ concept: 'Obra', qty: 1, price: 1000, tax: 0.21 });
const SUPLIDO = Object.freeze({ concept: 'Tasa municipal pagada por cuenta del cliente', qty: 1, price: 100, tax: 0, suplido: true });
const CLIENTE = Object.freeze({ name: 'Cliente', taxId: 'A11111111' });
const MERCHANT_ES = Object.freeze({ country: 'ES', taxId: NIF });

/** El doble de `scrum1296`: apunta cada llamada y guarda la fila con estado (lo que sella lo lee la cola). */
function dobleQueApunta({ lineas, total }) {
  const llamadas = [];
  const fila = {
    ...FACTURA, total, vfHash: null, vfPrevHash: null, vfTimestamp: null, vfEstado: 'pendiente_de_sellado',
    vfAnulHash: null, vfAnulTimestamp: null, vfAnulPrevHash: null, lines: lineas, customer: { ...CLIENTE }, rectifies: null,
  };
  const respuestas = {
    'invoice.findUnique': () => fila,
    'invoice.findFirst': () => null, // primer registro de la cadena
    'invoice.update': (args) => { Object.assign(fila, args?.data ?? {}); return fila; },
    'merchant.findUnique': () => ({ id: FACTURA.merchantId, country: 'ES', taxId: NIF, name: 'Fontanería', legalName: 'Fontanería S.L.', timezone: null }),
  };
  const modelo = (m) => new Proxy({}, {
    get: (_, metodo) => async (args) => {
      const k = `${m}.${String(metodo)}`;
      llamadas.push({ clave: k, args });
      const r = respuestas[k];
      if (r) return r(args);
      if (metodo === 'findMany') return [];
      if (metodo === 'count') return 0;
      return { id: llamadas.length, ...(args?.data ?? {}) };
    },
  });
  const cliente = new Proxy({}, {
    get: (_, k) => {
      if (k === '$transaction') return async (fn) => fn(cliente);
      if (k === '$executeRaw' || k === '$executeRawUnsafe') return async () => 1;
      if (k === 'then') return undefined;
      if (typeof k === 'symbol') return undefined;
      return modelo(String(k));
    },
  });
  return { cliente, llamadas, fila };
}

function cargar(doble) {
  const fPrisma = rutaDe('dist/core/db/prisma.js');
  requiere.cache[fPrisma] = { id: fPrisma, filename: fPrisma, loaded: true, exports: { prisma: doble.cliente } };
  for (const m of [
    'dist/modules/system/audit.service.js',
    'dist/modules/invoicing/domain/verifactu.service.js',
    'dist/modules/invoicing/domain/encolarRemision.js',
    'dist/modules/invoicing/domain/selladoEstado.js',
  ]) { try { delete requiere.cache[rutaDe(m)]; } catch { /* aún no existe */ } }
  return {
    sellado: requiere(rutaDe('dist/modules/invoicing/domain/selladoEstado.js')),
    verifactu: requiere(rutaDe('dist/modules/invoicing/domain/verifactu.service.js')),
  };
}

const PORTONES = [
  ['exigirLineasFacturables', 'dist/modules/invoicing/domain/lineasFacturables.js'],
  ['exigirTiposDeIvaEmitibles', 'dist/core/validation/tiposIvaEmitibles.js'],
  ['exigirCausaLineaEmitible', 'dist/core/validation/causaLineaEmitible.js'],
];
const tic = () => new Promise((r) => setImmediate(r)); // `recordAudit` escribe sin esperar
const escriturasEnCola = (ll) => ll.filter((l) => /^vfSubmission\.(create|createMany|upsert)$/.test(l.clave));
const constancias = (ll) => ll
  .filter((l) => l.clave === 'auditLog.create' && l.args?.data?.action === 'encolado_fallido')
  .map((l) => l.args.data);

/** Lo que hacen los tres portones con estas líneas: `null` si pasan, el error si alguno para. */
function pasarPortones(lineas) {
  for (const [fn, modulo] of PORTONES) {
    try { requiere(rutaDe(modulo))[fn](lineas); } catch (e) { return `${fn}: ${e?.name}: ${String(e?.message).slice(0, 160)}`; }
  }
  return null;
}

/** Sella por el camino real y devuelve lo observado. */
export async function sellar(lineas, total) {
  const d = dobleQueApunta({ lineas, total });
  const { sellado, verifactu } = cargar(d);
  const r = await sellado.sellarTrasEmision({ ...FACTURA, total: { toString: () => total } }, MERCHANT_ES, d.cliente);
  await tic();
  let registro = 'construido';
  if (d.fila.vfHash) {
    try { await verifactu.registroParaRemision(FACTURA.id, d.cliente); } catch (e) { registro = `${e?.name}: ${String(e?.message).slice(0, 200)}`; }
  } else {
    registro = 'sin huella: no se pidió';
  }
  return {
    estado: r.estado,
    error: r.error ?? null,
    vfHash: d.fila.vfHash,
    vfEstado: d.fila.vfEstado,
    pdf: sellado.puedeProducirDocumento(d.fila.vfEstado),
    enCola: escriturasEnCola(d.llamadas).length,
    constancias: constancias(d.llamadas).map((c) => ({ motivo: c.meta?.motivo, error: c.meta?.errorMensaje })),
    registro,
    llamadas: d.llamadas.length,
  };
}

/** `{ estado: 'CIEGO' | 'DEFECTO' | 'CAMBIADO', poblacion }` */
export async function medir() {
  // CONTROL SEMBRADO: la misma factura SIN el suplido tiene que sellarse Y encolarse. Si no, el
  // banco no ve la cola y un «0 filas» no diría nada.
  const control = await sellar([{ ...OBRA }], '1210.00');
  if (!(control.estado === 'sellado' && control.enCola === 1 && control.registro === 'construido')) {
    return { estado: 'CIEGO', poblacion: `control sin suplido: ${JSON.stringify(control)}` };
  }

  const lineas = [{ ...OBRA }, { ...SUPLIDO }];
  const porton = pasarPortones(lineas);
  if (porton) return { estado: 'CAMBIADO', poblacion: `un portón PARA la factura antes del número: ${porton}` };

  const m = await sellar(lineas, '1310.00');
  if (m.llamadas === 0) return { estado: 'CIEGO', poblacion: 'el sellado no hizo ni una llamada a la base' };
  const poblacion = `portones 3/3 pasan · estado ${m.estado} · vfEstado ${m.vfEstado} · huella ${m.vfHash ? 'sí' : 'NO'} · `
    + `PDF ${m.pdf ? 'sí' : 'no'} · filas en cola ${m.enCola} · constancias ${JSON.stringify(m.constancias)} · registro: ${m.registro}`;

  if (m.estado !== 'sellado' || !m.vfHash) {
    return { estado: 'CAMBIADO', poblacion: `🔴 LA FACTURA QUEDA A MEDIAS (número sin huella, error «${m.error}»): ${poblacion}` };
  }
  const esElDefecto = /^[0-9A-F]{64}$/.test(m.vfHash)
    && m.vfEstado === 'sellado'
    && m.pdf === true
    && m.enCola === 0
    && m.constancias.length === 1
    && m.constancias[0].motivo === 'excluida'
    && /tramo de IVA al 0%/.test(m.constancias[0].error ?? '')
    && /^DesgloseNoClasificableError: /.test(m.registro);
  return { estado: esElDefecto ? 'DEFECTO' : 'CAMBIADO', poblacion };
}

/** El veredicto del trinquete: `{ ok, motivo }`. */
export function juicio(medida, declaracion) {
  const declarado = declaracion?.declarado === true;
  switch (medida.estado) {
    case 'CIEGO':
      return { ok: false, motivo: `CIEGO: el control sembrado no sale (${medida.poblacion}). No mido nada, y eso no es un verde.` };
    case 'DEFECTO':
      return declarado
        ? { ok: true, motivo: `DEFECTO CONOCIDO, declarado (SCRUM-1054): ${medida.poblacion}. No es conformidad.` }
        : { ok: false, motivo: `Se retiró la declaración y el defecto sigue: ${medida.poblacion}. Retirarla es parte del arreglo, no lo sustituye.` };
    default:
      return declarado
        ? { ok: false, motivo: `El sellado de una factura con suplido ha CAMBIADO con el defecto todavía declarado: ${medida.poblacion}. `
          + 'Si es la decisión de c.21852 (S-A o quitar la casilla), retira la entrada de DEFECTO_CONOCIDO en este mismo cambio; si no, es un cambio del camino de emisión sin decidir.' }
        : { ok: true, motivo: `Declaración retirada y cambiado: ${medida.poblacion}.` };
  }
}

test('SCRUM-1054 · una factura con suplido se sella entera y su registro no se construye: defecto declarado', async (t) => {
  const medida = await medir();
  t.diagnostic(`estado ${medida.estado} · ${medida.poblacion}`);
  const v = juicio(medida, DEFECTO_CONOCIDO.suplidoSelladoSinRegistro);
  t.diagnostic(v.motivo);
  assert.equal(v.ok, true, `🔴 ${v.motivo}`);
});

test('SCRUM-1054 · la declaración vigente cita el ticket que la retira, y es la única', () => {
  assert.deepEqual(Object.keys(DEFECTO_CONOCIDO), ['suplidoSelladoSinRegistro']);
  const d = DEFECTO_CONOCIDO.suplidoSelladoSinRegistro;
  if (d.declarado === true) assert.deepEqual(d.tickets, ['SCRUM-1054']);
});

test('SCRUM-1054 · control: un 0 % SIN marca de suplido corre la misma suerte (el defecto es del tramo, no de la marca)', async () => {
  const m = await sellar([{ ...OBRA }, { ...SUPLIDO, suplido: undefined }], '1310.00');
  assert.equal(m.estado, 'sellado');
  assert.equal(m.enCola, 0);
  assert.match(m.registro, /^DesgloseNoClasificableError: /);
});

test('SCRUM-1054 · control: las casillas del juicio', () => {
  const p = 'x';
  assert.equal(juicio({ estado: 'CIEGO', poblacion: p }, { declarado: true }).ok, false);
  assert.equal(juicio({ estado: 'DEFECTO', poblacion: p }, { declarado: true }).ok, true);
  assert.equal(juicio({ estado: 'DEFECTO', poblacion: p }, { declarado: false }).ok, false);
  assert.equal(juicio({ estado: 'CAMBIADO', poblacion: p }, { declarado: true }).ok, false);
  assert.equal(juicio({ estado: 'CAMBIADO', poblacion: p }, { declarado: false }).ok, true);
  assert.equal(juicio({ estado: 'CAMBIADO', poblacion: p }, undefined).ok, true);
});
