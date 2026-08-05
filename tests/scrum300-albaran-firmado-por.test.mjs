// tests/scrum300-albaran-firmado-por.test.mjs — SCRUM-300 (C5)
//
// Tres campos nuevos en el albarán (lugar de entrega + quién firma y en calidad de qué) y la
// subida del contenido canónico a v:2. Lo que este fichero tiene que dejar demostrado:
//
//   ① Los campos LLEGAN AL PDF GENERADO, no solo a la base — se leen del documento.
//   ② ROJO POR CAMPO: si un campo deja de imprimirse, el test cae NOMBRÁNDOLO.
//   ③ 🔴 UN ALBARÁN v:1 ANTIGUO SIGUE VERIFICANDO. Es la condición que el fundador puso para
//      autorizar el v:2, y sin ella el cambio no entra.
//   ④ La versión se LEE DEL DATO. Un lector que dé por hecho v:2 rompe los v:1 en silencio.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ EL v:2 ERA OBLIGATORIO, y no es cosmético
//
// El contenido canónico YA sellaba `obra`, tomándola de `Job.direccion` — un campo que NADIE
// escribe (su único escritor en todo el árbol es `scripts/seed-video.mjs`). O sea: el sello
// llevaba meses guardando el lugar de obra VACÍO. No faltaba un campo; había un campo sellado
// que nunca tuvo contenido. Pasar su fuente a `Albaran.lugarEntrega` no es AÑADIR: es CAMBIAR
// LA FUENTE DE UN CAMPO YA SELLADO, y dos hashes calculados con reglas distintas bajo la misma
// versión serían indistinguibles. De ahí el v:2.
//
// Nada de esto toca los albaranes ya firmados: su hash está CONGELADO en su propia evidencia
// (`Albaran.evidenciaFirma`), el PDF lo LEE y no lo recalcula nunca. Recalcular el sello de un
// documento firmado sería falsificarlo aunque el resultado coincidiera (regla 29).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';

import {
  ALBARAN_CONTENIDO_VERSION_ACTUAL,
  computeAlbaranContentHash,
  obraSegunVersion,
  recomputarHashDeEvidencia,
  verificarEvidenciaAlbaran,
} from '../dist/modules/jobs/domain/albaran.service.js';
import { generateAlbaranPdf } from '../dist/modules/jobs/infra/albaranPdf.service.js';

const SIG_1PX =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

// ── LECTOR DEL PDF ───────────────────────────────────────────────────────────────────────
//
// pdfkit escribe el texto como CADENAS HEX dentro de los operadores TJ/Tj (`[<414c42> …] TJ`),
// dentro de streams deflatados — no entre paréntesis. Medido: un extractor de `(texto)` devuelve
// CERO caracteres sobre estos PDFs y habría dado un verde vacío en todos los tests de abajo.
function textoDelPdf(buf) {
  const partes = [];
  let i = 0;
  for (;;) {
    const ini = buf.indexOf('stream', i);
    if (ini === -1) break;
    let ds = ini + 6;
    if (buf[ds] === 0x0d) ds++;
    if (buf[ds] === 0x0a) ds++;
    const fin = buf.indexOf('endstream', ds);
    if (fin === -1) break;
    try { partes.push(zlib.inflateSync(buf.subarray(ds, fin)).toString('latin1')); } catch { /* no deflatado (imágenes) */ }
    i = fin + 9;
  }
  const crudo = partes.join('\n');
  const textos = [];
  const re = /<([0-9A-Fa-f]+)>/g;
  let m;
  while ((m = re.exec(crudo))) textos.push(Buffer.from(m[1], 'hex').toString('latin1'));
  return textos.join('');
}

const PDF_BASE = {
  merchantId: 999300,
  numero: 'ALB-2026-T300',
  fecha: new Date('2026-08-01T09:00:00Z'),
  emisionAt: new Date('2026-07-28T09:00:00Z'),
  version: 1,
  modoValoracion: 'SIN_VALORAR',
  merchant: { name: 'QA Fontanería', legalName: null, taxId: null, address: null, logoUrl: null, whatsappPhone: null },
  customer: { name: 'Cliente QA', legalName: null, taxId: null },
  referenciaTrabajo: 'Reforma de baño',
  lineas: [{ concepto: 'Sustitución de bajante', cantidad: 8, unidad: 'm' }],
  totales: null,
  notas: null,
  signatureData: SIG_1PX,
  firmadoAt: new Date('2026-08-01T12:00:00Z'),
};

/** Los tres valores que tienen que aparecer impresos, cada uno con su nombre para el rojo. */
const CAMPOS = {
  lugarEntrega: { valor: 'C/ Mayor 7, nave 3', enPdf: (p, v) => ({ ...p, obra: v }) },
  firmadoPorNombre: { valor: 'Marta Ruiz Alonso', enPdf: (p, v) => ({ ...p, firmadoPorNombre: v }) },
  firmadoPorCalidad: { valor: 'Personal de la obra', enPdf: (p, v) => ({ ...p, firmadoPorCalidad: v }) },
};

/** Genera el PDF con los campos indicados (los `null` NO se imprimen) y devuelve su texto. */
async function textoConCampos(overrides = {}) {
  let params = { ...PDF_BASE, obra: null, firmadoPorNombre: null, firmadoPorCalidad: null };
  for (const [campo, def] of Object.entries(CAMPOS)) {
    const valor = campo in overrides ? overrides[campo] : def.valor;
    params = def.enPdf(params, valor);
  }
  params.numero = `ALB-2026-T300-${Math.random().toString(36).slice(2, 8)}`;
  const { outPath } = await generateAlbaranPdf(params);
  try {
    return textoDelPdf(fs.readFileSync(outPath));
  } finally {
    fs.rmSync(outPath, { force: true });
  }
}

// ── ① SUELO: el lector lee de verdad ─────────────────────────────────────────────────────

test('SCRUM-300 · SUELO: el lector del PDF extrae texto (si no, todo lo de abajo sería verde vacío)', async () => {
  const t = await textoConCampos();
  assert.ok(t.length > 200,
    `🔴 ESCÁNER CIEGO: el lector solo ha sacado ${t.length} caracteres del PDF. Con un lector que no ` +
    'lee, «el campo no aparece» y «no sé mirar» son la misma respuesta, y todos los rojos de este ' +
    'fichero pasarían en verde. pdfkit escribe el texto en HEX dentro de TJ, no entre paréntesis.');
  // Y que lee ESTE documento y no otro: dos anclas que ya existían antes de SCRUM-300.
  assert.match(t, /Conformidad del cliente/, '🔴 el lector no encuentra el bloque de firma que YA existía');
  assert.match(t, /Reforma de baño/, '🔴 el lector no encuentra la referencia del Trabajo');
});

// ── ② LOS TRES CAMPOS LLEGAN AL PDF, y el rojo va CAMPO A CAMPO ──────────────────────────

test('SCRUM-300 · los tres campos llegan al PDF FIRMADO (en el documento, no en la base)', async () => {
  const t = await textoConCampos();
  for (const [campo, def] of Object.entries(CAMPOS)) {
    assert.ok(t.includes(def.valor),
      `🔴 «${campo}» NO llega al PDF firmado: esperaba encontrar «${def.valor}» en el documento ` +
      'generado. Los tres son contenido mínimo obligatorio del albarán; que estén en la base y no ' +
      'en el papel no sirve de nada.');
  }
});

test('SCRUM-300 · ROJO POR CAMPO: quitar cada uno del PDF hace caer el test NOMBRÁNDOLO', async () => {
  // Ésta es la autoprueba del test de arriba: se quita UN campo cada vez y se comprueba que su
  // ausencia se detecta Y que no arrastra a los otros dos (si arrastrase, el rojo no diría cuál).
  for (const [campo, def] of Object.entries(CAMPOS)) {
    const t = await textoConCampos({ [campo]: null });
    assert.equal(t.includes(def.valor), false,
      `🔴 el detector NO ve la falta de «${campo}»: he generado el PDF SIN ese campo y su valor ` +
      `«${def.valor}» sigue apareciendo. Un test que no distingue presente de ausente no vigila nada.`);
    for (const [otro, defOtro] of Object.entries(CAMPOS)) {
      if (otro === campo) continue;
      assert.ok(t.includes(defOtro.valor),
        `🔴 al quitar «${campo}» ha desaparecido también «${otro}»: el rojo no señalaría al culpable.`);
    }
  }
});

test('SCRUM-300 · RETROCOMPATIBILIDAD: un albarán firmado ANTES (sin los campos) sigue generando su PDF', async () => {
  // Los ya firmados tienen los tres a null. Su PDF tiene que salir, y salir SIN los rótulos nuevos.
  const t = await textoConCampos({ lugarEntrega: null, firmadoPorNombre: null, firmadoPorCalidad: null });
  assert.match(t, /Conformidad del cliente/, '🔴 un albarán antiguo ha dejado de imprimir su bloque de firma');
  assert.equal(/Firmado por:/.test(t), false,
    '🔴 un albarán antiguo imprime el rótulo «Firmado por:» con el campo vacío. Un rótulo sin dato ' +
    'detrás en un documento de entrega es peor que no ponerlo.');
  assert.equal(/En calidad de:/.test(t), false,
    '🔴 un albarán antiguo imprime «En calidad de:» sin dato detrás.');
});

// ── ③ 🔴 LA CONDICIÓN DEL v:2: un v:1 antiguo SIGUE VERIFICANDO ──────────────────────────

// Un albarán firmado en tiempos de v:1, con su evidencia tal y como quedó guardada.
//
// ⚠️ `jobDireccion` va CON VALOR y distinto de `lugarEntrega` A PROPÓSITO, y esto no es un
// detalle del fixture: es lo que hace que el test PUEDA fallar. La primera versión de este
// fichero puso los dos a null —«lo realista, porque Job.direccion es null para cualquier
// merchant real»— y al sabotear el lector para que diera por hecho v:2 el test SIGUIÓ EN VERDE:
// con las dos fuentes a null, leer una u otra da lo mismo. Un caso mal elegido convierte el
// guard en decorado. El caso con valor existe de verdad (el seed de demo escribe `Job.direccion`),
// y es el único que distingue si la versión se está leyendo o suponiendo.
const ALBARAN_V1 = {
  numero: 'ALB-2026-011',
  fecha: new Date('2026-07-10T08:00:00Z'),
  modoValoracion: 'SIN_VALORAR',
  lineas: [{ concepto: 'Localización de fuga', cantidad: 1, unidad: 'ud' }],
  notas: 'Trabajo conforme.',
  // La columna no existía al firmar; hoy el albarán ya puede tener lugar de entrega puesto —
  // y aun así su sello v:1 tiene que seguir cuadrando con la fuente de ENTONCES.
  lugarEntrega: 'C/ Nueva 1 (puesta después de firmar)',
};
const CONTEXTO_V1 = {
  jobDireccion: 'C/ Vieja 9', // la fuente que v:1 selló
  referenciaTrabajo: 'Fuga en bajante',
  cliente: 'Cliente Histórico SL',
  emisor: 'QA Fontanería',
  emisorNif: 'B00000000',
};

/** El caso ORDINARIO de un merchant real: `Job.direccion` null, que es lo que hay en producción. */
const ALBARAN_V1_SIN_OBRA = { ...ALBARAN_V1, lugarEntrega: null };
const CONTEXTO_V1_SIN_OBRA = { ...CONTEXTO_V1, jobDireccion: null };

/** El hash tal y como lo calculó el código de v:1 (fuente: `obra` = Job.direccion). */
function hashComoLoCalculabaV1() {
  return computeAlbaranContentHash(
    {
      numero: ALBARAN_V1.numero,
      fecha: ALBARAN_V1.fecha,
      modoValoracion: ALBARAN_V1.modoValoracion,
      lineas: ALBARAN_V1.lineas,
      notas: ALBARAN_V1.notas,
      obra: CONTEXTO_V1.jobDireccion,
      referenciaTrabajo: CONTEXTO_V1.referenciaTrabajo,
      cliente: CONTEXTO_V1.cliente,
      emisor: CONTEXTO_V1.emisor,
      emisorNif: CONTEXTO_V1.emisorNif,
    },
    1,
  );
}

test('SCRUM-300 · 🔴 un albarán v:1 firmado ANTES del cambio SIGUE VERIFICANDO', () => {
  const evidencia = { v: 1, contentHash: hashComoLoCalculabaV1(), hashAlg: 'sha256' };
  assert.equal(
    verificarEvidenciaAlbaran({ evidencia, albaran: ALBARAN_V1, ...CONTEXTO_V1 }),
    true,
    '🔴 UN ALBARÁN FIRMADO ANTES DE SCRUM-300 HA DEJADO DE VERIFICAR.\n\n' +
    '  Es la condición que el fundador puso para autorizar el v:2, y sin ella el cambio no entra.\n' +
    '  Un documento firmado que de pronto «no cuadra» se lee como una falsificación que no ha\n' +
    '  ocurrido: el papel está intacto y es el verificador el que se ha roto.');

  // Y el caso ordinario de producción (sin dirección por ningún lado) también.
  const evSinObra = {
    v: 1,
    hashAlg: 'sha256',
    contentHash: computeAlbaranContentHash(
      {
        numero: ALBARAN_V1_SIN_OBRA.numero,
        fecha: ALBARAN_V1_SIN_OBRA.fecha,
        modoValoracion: ALBARAN_V1_SIN_OBRA.modoValoracion,
        lineas: ALBARAN_V1_SIN_OBRA.lineas,
        notas: ALBARAN_V1_SIN_OBRA.notas,
        obra: CONTEXTO_V1_SIN_OBRA.jobDireccion,
        referenciaTrabajo: CONTEXTO_V1_SIN_OBRA.referenciaTrabajo,
        cliente: CONTEXTO_V1_SIN_OBRA.cliente,
        emisor: CONTEXTO_V1_SIN_OBRA.emisor,
        emisorNif: CONTEXTO_V1_SIN_OBRA.emisorNif,
      },
      1,
    ),
  };
  assert.equal(
    verificarEvidenciaAlbaran({ evidencia: evSinObra, albaran: ALBARAN_V1_SIN_OBRA, ...CONTEXTO_V1_SIN_OBRA }),
    true,
    '🔴 el albarán v:1 SIN dirección de obra —el caso normal en producción— ha dejado de verificar');
});

test('SCRUM-300 · la versión se LEE DEL DATO: verificar un v:1 con la regla de v:2 NO cuadra', () => {
  // El fallo que este parámetro existe para evitar. Si el verificador diera por hecho v:2,
  // recalcularía con `Albaran.lugarEntrega` un sello hecho con `Job.direccion`.
  const evidencia = { v: 1, contentHash: hashComoLoCalculabaV1(), hashAlg: 'sha256' };
  const comoSiFueraV2 = recomputarHashDeEvidencia({
    evidencia: { ...evidencia, v: 2 },
    albaran: ALBARAN_V1,
    ...CONTEXTO_V1,
  });
  assert.notEqual(comoSiFueraV2, evidencia.contentHash,
    '🔴 el hash de v:1 y el de v:2 coinciden sobre el mismo contenido. Entonces la versión no ' +
    'distingue nada y el test de arriba pasaría aunque el lector la ignorase por completo.');
});

test('SCRUM-300 · la fuente de `obra` cambia CON la versión, y una versión desconocida se dice', () => {
  const fuentes = { lugarEntrega: 'C/ Nueva 1', jobDireccion: 'C/ Vieja 9' };
  assert.equal(obraSegunVersion(1, fuentes), 'C/ Vieja 9', '🔴 v:1 debe seguir leyendo Job.direccion');
  assert.equal(obraSegunVersion(2, fuentes), 'C/ Nueva 1', '🔴 v:2 debe leer Albaran.lugarEntrega');
  assert.equal(obraSegunVersion(undefined, fuentes), 'C/ Nueva 1',
    '🔴 un albarán SIN FIRMAR todavía debe usar el campo de hoy');

  // Una versión futura NO se aproxima con la más parecida: se dice. Aproximarla devolvería
  // «no coincide» sobre un documento intacto, que es la acusación que no se puede hacer sola.
  assert.throws(
    () => computeAlbaranContentHash({ ...ALBARAN_V1, obra: null, referenciaTrabajo: null, cliente: null, emisor: null, emisorNif: null }, 99),
    /version_desconocida/,
    '🔴 una versión desconocida se está tragando en silencio en vez de decirse.');
});

test('SCRUM-300 · el v:2 SELLA los tres campos: cambiar cualquiera cambia el hash', () => {
  const base = {
    numero: 'ALB-2026-050',
    fecha: new Date('2026-08-01T08:00:00Z'),
    modoValoracion: 'SIN_VALORAR',
    lineas: [{ concepto: 'X', cantidad: 1, unidad: 'ud' }],
    notas: null,
    obra: 'C/ Mayor 7',
    referenciaTrabajo: 'Ref',
    cliente: 'Cliente',
    emisor: 'Emisor',
    emisorNif: 'B1',
    firmadoPorNombre: 'Marta Ruiz',
    firmadoPorCalidad: 'Personal de la obra',
  };
  const h = computeAlbaranContentHash(base, 2);
  assert.notEqual(h, computeAlbaranContentHash({ ...base, obra: 'C/ Otra 2' }, 2),
    '🔴 el lugar de entrega NO está sellado: se podría cambiar tras la firma sin que el hash lo note');
  assert.notEqual(h, computeAlbaranContentHash({ ...base, firmadoPorNombre: 'Otro Nombre' }, 2),
    '🔴 el nombre de quien firma NO está sellado');
  assert.notEqual(h, computeAlbaranContentHash({ ...base, firmadoPorCalidad: 'El propio cliente' }, 2),
    '🔴 la calidad de quien firma NO está sellada');
  assert.equal(ALBARAN_CONTENIDO_VERSION_ACTUAL, 2, '🔴 lo que se sella HOY debe ser v:2');
});
