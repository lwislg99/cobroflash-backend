// SCRUM-230 · QR-PAGINA-1 — el QR de la página pública se puede personalizar y previsualizar,
// PERO no hasta el punto de dejar de escanearse.
//
// Lo que hoy no se puede: color, tamaño, formato, ni verlo antes de descargarlo (pides → te cae
// un PNG de 1024 en blanco y negro). La librería `qrcode` ya soporta `color`; simplemente no se
// le pasaba.
//
// ⚠️ LA PARTE QUE IMPORTA NO ES DEJAR ELEGIR, ES IMPEDIR LO QUE NO ESCANEA. Un QR con poco
// contraste, o con los módulos más claros que el fondo, deja de leerse — y el pro no se entera
// hasta que un cliente delante de la furgoneta no consigue escanearlo. Eso no es un defecto
// estético: es el producto mintiendo sobre que le ha dado un QR válido. Por eso el validador es
// fail-closed y por eso vive en una función pura, comprobable sin levantar nada.
//
// NADA de esto toca el QR FISCAL de VeriFactu: son dos llamadas independientes a la librería,
// cada una con su dato y sus opciones inline (medido en el recon del ticket). Aquí se toca la
// de la página pública; la fiscal no comparte wrapper ni configuración.
import test from 'node:test';
import assert from 'node:assert/strict';

const {
  resolverOpcionesQr, ratioContraste, CONTRASTE_MINIMO, FORMATOS_QR, TAMANOS_QR, ErrorQr,
} = await import('../dist/modules/system/domain/qrPagina.service.js');

const ctx = { brandColor: '#1a56db' };

// ── 1 · SUELO ANTI-VERDE-HUECO ───────────────────────────────────────────────────────────
// Si los catálogos salieran vacíos, todos los tests de abajo pasarían sin comprobar nada:
// «ningún formato inválido» es trivialmente cierto cuando no hay formatos.
test('SCRUM-230 · los catálogos existen y no están vacíos', () => {
  assert.ok(FORMATOS_QR.length >= 2, `esperaba ≥2 formatos, hay ${FORMATOS_QR.length}`);
  assert.ok(TAMANOS_QR.length >= 3, `esperaba ≥3 tamaños, hay ${TAMANOS_QR.length}`);
  assert.ok(FORMATOS_QR.includes('png') && FORMATOS_QR.includes('svg'),
    'png para pantalla y svg para imprenta (rotulación de furgoneta) son los dos que pide el ticket');
  assert.equal(typeof CONTRASTE_MINIMO, 'number');
});

// ── 2 · EL DEFECTO DE HOY: sin parámetros, el comportamiento no cambia ───────────────────
test('SCRUM-230 · sin parámetros se conserva el QR de siempre (1024 png, negro sobre blanco)', () => {
  const o = resolverOpcionesQr({}, ctx);
  assert.equal(o.formato, 'png');
  assert.equal(o.size, 1024);
  assert.equal(o.dark, '#000000');
  assert.equal(o.light, '#ffffff');
  assert.equal(o.descargar, true, 'el comportamiento por defecto sigue siendo descargar');
});

// ── 3 · PREVISUALIZACIÓN: el hueco de uso del ticket ─────────────────────────────────────
test('SCRUM-230 · preview=1 sirve en línea en vez de forzar la descarga', () => {
  assert.equal(resolverOpcionesQr({ preview: '1' }, ctx).descargar, false);
  assert.equal(resolverOpcionesQr({ preview: 'true' }, ctx).descargar, false);
});

// ── 4 · CONTRASTE: lo que impide entregar un QR que no escanea ───────────────────────────
test('SCRUM-230 · el ratio de contraste se calcula bien en los extremos conocidos', () => {
  // Negro sobre blanco = 21:1, el máximo posible. Blanco sobre blanco = 1:1.
  assert.equal(Math.round(ratioContraste('#000000', '#ffffff')), 21);
  assert.equal(Math.round(ratioContraste('#ffffff', '#ffffff')), 1);
});

test('SCRUM-230 · un color con poco contraste se RECHAZA, no se sirve un QR ilegible', () => {
  // Gris claro sobre blanco: ratio ~1,6. Elegible en un selector de color, ilegible para un
  // escáner. Este es el caso realista: el pro elige "un gris suave que pega con la marca".
  assert.throws(
    () => resolverOpcionesQr({ dark: '#cccccc' }, ctx),
    (e) => e instanceof ErrorQr && e.codigo === 'contraste_insuficiente',
    '🔴 se sirvió un QR que no se puede escanear',
  );
});

test('SCRUM-230 · invertir claro y oscuro se RECHAZA aunque el contraste sea de sobra', () => {
  // Blanco sobre negro tiene ratio 21:1 —contraste perfecto— y aun así muchos escáneres no lo
  // leen: esperan módulos OSCUROS sobre fondo CLARO. El contraste solo no basta como criterio.
  assert.throws(
    () => resolverOpcionesQr({ dark: '#ffffff', light: '#000000' }, ctx),
    (e) => e instanceof ErrorQr && e.codigo === 'qr_invertido',
  );
});

test('SCRUM-230 · el color de marca sí pasa si contrasta', () => {
  const o = resolverOpcionesQr({ dark: 'marca' }, ctx);
  assert.equal(o.dark, '#1a56db');
  assert.ok(ratioContraste(o.dark, o.light) >= CONTRASTE_MINIMO);
});

// ── 5 · LO DEMÁS SE VALIDA, NO SE CUELA ─────────────────────────────────────────────────
test('SCRUM-230 · formato y tamaño fuera de catálogo se rechazan', () => {
  assert.throws(() => resolverOpcionesQr({ formato: 'gif' }, ctx), (e) => e.codigo === 'formato_invalido');
  assert.throws(() => resolverOpcionesQr({ size: '99999' }, ctx), (e) => e.codigo === 'tamano_invalido');
  assert.throws(() => resolverOpcionesQr({ dark: 'rojo' }, ctx), (e) => e.codigo === 'color_invalido');
});

test('SCRUM-230 · svg ignora el tamaño en píxeles a propósito (es vectorial)', () => {
  const o = resolverOpcionesQr({ formato: 'svg', size: '2048' }, ctx);
  assert.equal(o.formato, 'svg');
  assert.equal(o.size, 2048, 'se conserva para el ancho del viewBox, pero no limita la impresión');
});

test('SCRUM-230 · sin brandColor configurado, "marca" no revienta: cae al negro', () => {
  const o = resolverOpcionesQr({ dark: 'marca' }, { brandColor: null });
  assert.equal(o.dark, '#000000');
});
