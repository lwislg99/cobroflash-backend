// tests/scrum652-parte-trabajo.test.mjs — SCRUM-652 (T3 · fase B), sin gate.
//
// 🔴 FIRMAR CONGELA EL CONTENIDO Y DEJA LOS PRECIOS ABIERTOS. LAS DOS MITADES, O NO VALE.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// POR QUÉ HACEN FALTA DOS CONTROLES Y NO UNO
//
// El de arriba —«cambio una línea firmada y la huella se rompe»— es el que todo el mundo escribe.
// Con solo ése, **«congelé el contenido» y «congelé el parte entero» dan EXACTAMENTE el mismo
// verde**, y el segundo hace el producto inservible: el técnico cierra el parte en la obra sin
// importes y la oficina ya no podría ponerlos nunca.
//
// Por eso el control que de verdad decide es el OTRO: con el parte FIRMADO, cambiar un precio
// tiene que dejar la huella INTACTA. Ése es el que distingue las dos implementaciones.
//
// La decisión y su motivo están en `parteTrabajo.ts`: en el papel real la columna de importe va
// vacía, así que el precio no es lo que se firmó.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const {
  BLOQUES_PARTE, TIPOS_PARTE, ESTADOS_PARTE, PARTE_CONTENIDO_VERSION_ACTUAL,
  computeParteContentHash, puedeEditarContenido, puedeEditarPrecios, puedeFirmarse,
  lineasDelBloque, totalesPorBloque, lineasParaElTecnico,
} = await import('../dist/modules/jobs/domain/parteTrabajo.js');

/** Un parte de ejemplo, con líneas en LOS DOS bloques y con precios ya puestos. */
const parte = () => ({
  numero: 'PT-2026-0007',
  fecha: '2026-09-02T09:00:00.000Z',
  cliente: 'Comunidad Las Acacias',
  obra: 'Calle Mayor 12, cuarto técnico',
  referencia: 'REF-8891',
  entrada: '09:15',
  salida: '12:40',
  desplazamientos: 1,
  kilometros: 22,
  tecnicos: ['Marta R.', 'Iván P.'],
  tipo: 'instalacion',
  lineas: [
    { bloque: 'mano_obra', unds: 3.5, descripcion: 'Instalación y configuración', precioUnitario: 40, tipoIva: 21 },
    { bloque: 'materiales', unds: 2, descripcion: 'Cámara IP domo', precioUnitario: 120, tipoIva: 21 },
    { bloque: 'materiales', unds: 60, descripcion: 'Cable UTP cat.6 (m)', precioUnitario: 0.9, tipoIva: 21 },
  ],
  notas: null,
  firmadoPorNombre: 'Luis G.',
  firmadoPorCalidad: 'portero_o_conserje',
});

// ── SUELO ────────────────────────────────────────────────────────────────────────────────

test('SCRUM-652 · SUELO: el dominio se carga y sus listas cerradas tienen contenido', () => {
  assert.equal(typeof computeParteContentHash, 'function', '🔴 CIEGO: no se carga el sellador.');
  assert.deepEqual([...BLOQUES_PARTE], ['mano_obra', 'materiales'],
    '🔴 han cambiado los DOS bloques del parte. Son los del papel; si nace un tercero, es otra versión.');
  assert.equal(TIPOS_PARTE.length, 3, '🔴 los tipos son TRES casillas excluyentes en el papel.');
  assert.deepEqual([...ESTADOS_PARTE], ['borrador', 'firmado', 'facturado']);
  assert.equal(PARTE_CONTENIDO_VERSION_ACTUAL, 1);
});

test('SCRUM-652 · SUELO: una versión desconocida LANZA, no adivina rama', () => {
  // La lección de SCRUM-438: un despachador con rama por defecto elige por ti para un `99`, y un
  // valor adivinado en un documento firmado coincide por accidente hasta el día que no.
  assert.throws(() => computeParteContentHash(parte(), 99), /desconocida/,
    '🔴 sella una versión que no conoce. Eso es adivinar sobre un documento firmado.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL CANDADO DEL CONTENIDO
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-652 · 🔴 EL QUE DECIDE (1/2): cambiar el CONTENIDO de un parte firmado rompe la huella', () => {
  const original = parte();
  const firmado = computeParteContentHash(original);

  // Se cambia UNA descripción: exactamente lo que el cliente leyó antes de firmar.
  const manipulado = parte();
  manipulado.lineas[1].descripcion = 'Cámara IP domo con visión nocturna';
  const despues = computeParteContentHash(manipulado);

  assert.notEqual(despues, firmado,
    `🔴 SE HA CAMBIADO EL CONTENIDO DE UN PARTE FIRMADO Y LA HUELLA NO SE ENTERA.\n\n` +
    `   línea tocada: «${original.lineas[1].descripcion}» → «${manipulado.lineas[1].descripcion}»\n` +
    `   firma que queda huérfana: ${original.firmadoPorNombre} (${original.firmadoPorCalidad})\n\n` +
    '  Esa persona firmó un documento que ya no existe: el papel diría una cosa y el sello otra.\n' +
    '  Un parte firmado sirve para ganar la discusión de «yo no pedí eso»; si el contenido se\n' +
    '  puede cambiar después, no prueba nada.');

  // Y las OTRAS puertas del contenido, para que el de arriba no pase por casualidad con una sola.
  for (const [campo, cambio] of [
    ['unds', (p) => { p.lineas[0].unds = 4; }],
    ['bloque', (p) => { p.lineas[1].bloque = 'mano_obra'; }],
    ['tipo', (p) => { p.tipo = 'mantenimiento'; }],
    ['obra', (p) => { p.obra = 'Otra dirección'; }],
    ['tecnicos', (p) => { p.tecnicos = ['Marta R.']; }],
    ['firmadoPorCalidad', (p) => { p.firmadoPorCalidad = 'el_propio_cliente'; }],
    ['una línea nueva', (p) => { p.lineas.push({ bloque: 'materiales', unds: 1, descripcion: 'Fuente 12V' }); }],
  ]) {
    const p = parte();
    cambio(p);
    assert.notEqual(computeParteContentHash(p), firmado,
      `🔴 cambiar «${campo}» NO mueve la huella: ese campo se ha caído del sello.`);
  }
});

test('SCRUM-652 · el candado de CONTENIDO se cierra al firmar, y lo dice', () => {
  assert.equal(puedeEditarContenido('borrador').ok, true);
  const firmado = puedeEditarContenido('firmado');
  assert.equal(firmado.ok, false);
  assert.match(firmado.motivo, /firm/i,
    '🔴 el candado no dice POR QUÉ. «No se puede» a secas manda al profesional a adivinar.');
  assert.equal(puedeEditarContenido('facturado').ok, false);
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL CANDADO DE LOS PRECIOS — EL CONTROL QUE FALTA SI SOLO SE HACE EL DE ARRIBA
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-652 · 🔴 EL QUE DECIDE (2/2): con el parte FIRMADO, los precios se editan y la huella SIGUE VÁLIDA', () => {
  const original = parte();
  const firmado = computeParteContentHash(original);

  // La oficina valora: cambia un precio, pone el que faltaba y toca el IVA. Tres veces, porque se
  // valora «las veces que haga falta hasta que se factura».
  const valorado = parte();
  valorado.lineas[0].precioUnitario = 45;
  valorado.lineas[1].tipoIva = 10;
  valorado.lineas[2].precioUnitario = 1.1;

  assert.equal(computeParteContentHash(valorado), firmado,
    '🔴 CAMBIAR UN PRECIO HA ROTO LA HUELLA DE UN PARTE FIRMADO.\n\n' +
    '  Eso significa que se ha congelado el parte ENTERO en vez de su contenido, y el producto es\n' +
    '  inservible: el técnico cierra en la obra sin importes y la oficina ya no puede ponerlos.\n\n' +
    '  El precio NO entra en el sello, y no es un detalle de implementación: en el papel real la\n' +
    '  columna de importe va VACÍA. El cliente firma lo que le pusieron, no lo que cuesta.');

  // Y el mismo hecho por el otro lado: quitar el precio del todo tampoco mueve la huella.
  const sinPrecios = parte();
  for (const l of sinPrecios.lineas) { l.precioUnitario = null; l.tipoIva = null; }
  assert.equal(computeParteContentHash(sinPrecios), firmado,
    '🔴 un parte SIN valorar y el mismo YA valorado tienen que sellar igual: es el mismo trabajo.');

  // El permiso, además del hash.
  assert.equal(puedeEditarPrecios('firmado').ok, true,
    '🔴 el candado de precios se cierra al FIRMAR, y tiene que cerrarse al FACTURAR.');
  assert.equal(puedeEditarPrecios('borrador').ok, true);
});

test('SCRUM-652 · los precios se cierran al FACTURAR, no antes', () => {
  const facturado = puedeEditarPrecios('facturado');
  assert.equal(facturado.ok, false);
  assert.match(facturado.motivo, /factura/i,
    '🔴 el motivo no nombra la factura, que es lo que cierra el precio (regla 29).');
});

// ── SUELO: una firma sobre nada ──────────────────────────────────────────────────────────

test('SCRUM-652 · 🔴 SUELO: un parte con CERO líneas en los dos bloques NO se firma', () => {
  const vacio = puedeFirmarse([]);
  assert.equal(vacio.ok, false,
    '🔴 se puede firmar un parte vacío. Queda un papel firmado que no dice qué se hizo, y eso es ' +
    'peor que no tenerlo: PARECE que prueba algo.');
  assert.match(vacio.motivo, /no dice qué se hizo|ninguna línea/i);

  // Y basta UNA en cualquiera de los dos: una asistencia puede ser solo mano de obra, y una
  // instalación solo material. Exigir las dos habría bloqueado los dos casos normales.
  assert.equal(puedeFirmarse([{ bloque: 'mano_obra', unds: 1, descripcion: 'Revisión' }]).ok, true);
  assert.equal(puedeFirmarse([{ bloque: 'materiales', unds: 1, descripcion: 'Fusible' }]).ok, true);
});

// ── LOS DOS BLOQUES ──────────────────────────────────────────────────────────────────────

test('SCRUM-652 · los dos bloques suman POR SEPARADO, y el total es la suma de los dos', () => {
  const t = totalesPorBloque(parte().lineas);

  // mano de obra: 3,5 × 40 € = 140,00 → 14000 céntimos
  assert.equal(t.mano_obra.baseCents, 14000, `🔴 la base de mano de obra es ${t.mano_obra.baseCents}`);
  // materiales: 2 × 120 = 240,00 · 60 × 0,90 = 54,00 → 29400 céntimos
  assert.equal(t.materiales.baseCents, 29400, `🔴 la base de materiales es ${t.materiales.baseCents}`);

  assert.equal(t.total.baseCents, t.mano_obra.baseCents + t.materiales.baseCents,
    '🔴 el total NO es la suma de los dos bloques: se está recontando aparte, y el día que nazca ' +
    'un tercer bloque los subtotales dejarán de cuadrar con él sin que nadie lo vea.');
  assert.equal(t.total.cuotaCents, t.mano_obra.cuotaCents + t.materiales.cuotaCents);
  assert.equal(t.total.totalCents, t.total.baseCents + t.total.cuotaCents);
});

test('SCRUM-652 · una línea sin precio no suma y NO rompe', () => {
  // Es el estado normal entre que el técnico cierra y la oficina valora.
  const t = totalesPorBloque([
    { bloque: 'mano_obra', unds: 2, descripcion: 'Sin valorar todavía' },
    { bloque: 'materiales', unds: 1, descripcion: 'Cámara', precioUnitario: 100, tipoIva: 21 },
  ]);
  assert.equal(t.mano_obra.baseCents, 0, '🔴 una línea sin precio está sumando algo.');
  assert.equal(t.materiales.baseCents, 10000);
  assert.ok(Number.isFinite(t.total.totalCents), '🔴 el total sale NaN con una línea sin precio.');
});

test('SCRUM-652 · cada bloque devuelve SUS líneas, en su orden', () => {
  const l = parte().lineas;
  assert.equal(lineasDelBloque(l, 'mano_obra').length, 1);
  const mats = lineasDelBloque(l, 'materiales');
  assert.equal(mats.length, 2);
  assert.equal(mats[0].descripcion, 'Cámara IP domo',
    '🔴 se ha perdido el ORDEN del papel, que es el orden en que el cliente lo lee.');
});

// ── 🔴 CONTROL NEGATIVO: EN EL MÓVIL DEL TÉCNICO NO HAY IMPORTES ─────────────────────────

test('SCRUM-652 · 🔴 CONTROL NEGATIVO: al técnico NO le llega ni un importe, en ningún estado', () => {
  // Mismo mecanismo que `albaranDetailView.js:490`: que NO LLEGUEN es lo que hace imposible que se
  // pinten por descuido. Una pantalla que los recibe y decide no enseñarlos está a un descuido de
  // enseñarlos.
  for (const estado of ESTADOS_PARTE) {
    const paraElTecnico = lineasParaElTecnico(parte().lineas);
    for (const l of paraElTecnico) {
      assert.deepEqual(Object.keys(l).sort(), ['bloque', 'descripcion', 'unds'],
        `🔴 en estado «${estado}» al técnico le llegan claves de más: ${JSON.stringify(Object.keys(l))}. ` +
        'El papel tiene UNDS y DESCRIPCIÓN, y nada más.');
      assert.equal(l.precioUnitario, undefined, '🔴 le llega `precioUnitario`.');
      assert.equal(l.tipoIva, undefined, '🔴 le llega `tipoIva`.');
    }
  }
});

// ── EL CANÓNICO NO SE COMPARTE CON EL DEL ALBARÁN ────────────────────────────────────────

test('SCRUM-652 · 🔴 el sellador del parte NO importa nada de `albaran.service`', () => {
  // Si alguien «deduplica» los dos canónicos, el orden de claves de uno pasa a depender del otro y
  // cambiar el parte movería el hash de albaranes YA FIRMADOS. El propio `albaran.service.ts`
  // razona por escrito por qué sus versiones están escritas enteras y aparte.
  const fuente = fs.readFileSync(path.join(RAIZ, 'src/modules/jobs/domain/parteTrabajo.ts'), 'utf8');
  const imports = fuente.split('\n').filter((l) => /^import\s/.test(l));
  assert.deepEqual(imports.map((l) => l.trim()), ["import crypto from 'crypto';"],
    '🔴 el parte ha empezado a importar algo. Si es del albarán, ata el hash de un documento al ' +
    `otro y rompe firmas viejas en silencio. Imports: ${JSON.stringify(imports)}`);

  // Y el canónico del albarán sigue con SUS precios dentro: no se ha «arreglado» de paso.
  const alb = fs.readFileSync(path.join(RAIZ, 'src/modules/jobs/domain/albaran.service.ts'), 'utf8');
  assert.match(alb, /precioUnitario: l\.precioUnitario \?\? null/,
    '🔴 se ha tocado el canónico del ALBARÁN. Un albarán valorado SÍ se firma con precios: son dos ' +
    'documentos con dos sellos distintos, y unificarlos rompe uno de los dos.');
});
