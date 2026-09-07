// tests/scrum818-la-cabecera-no-miente.test.mjs — SCRUM-818
//
// LA VÍCTIMA: el técnico que intenta escribir la hora de entrada, de pie en un cuarto técnico y
// con una mano, y descubre que no se puede.
//
// Arriba del parte había SIETE rótulos con un guion debajo —Dirección de la obra, REF, Entrada,
// Salida, Desplazamiento, Kilómetros, Técnicos—. **Parecían campos y no se podían tocar.** Fue lo
// primero que el fundador notó al abrir `PT-2026-001` en producción.
//
// 🔒 Si algo parece un campo, la gente escribe en él. Si no puede, la pantalla ha mentido, y a
// partir de ahí se deja de fiar del resto.
//
// ── EL PASO 0 QUE DECIDIÓ EL TICKET ─────────────────────────────────────────────────────────
// Los siete EXISTEN en `partes_trabajo` y los siete tienen camino de escritura en el `PATCH`
// —medido ejecutando `permisoDeCampos`, no leyendo el código—, así que ninguno era columna nueva
// y ninguno abría el orden ①②③. Por eso son campos de verdad y no un dato de solo lectura.
//
// Y `tecnicos` viene PRELLENADO de los asignados del Trabajo (SCRUM-650) pero **sigue siendo
// editable**: el parte es la prueba de lo que PASÓ, no el registro de lo que se planeó, y lo firma
// un cliente que puede discutirlo. Si el técnico lo cambia, eso no es un error: es el dato.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

import { clasesDeLasHojas } from './_banco-vistas.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const JS = path.join(RAIZ, 'public', 'dashboard', 'js');
const MARCADOR = '[PENDIENTE microcopy oficial]';

/** Los siete de arriba, con la clave del `PATCH` que los escribe. */
const LOS_SIETE = Object.freeze([
  ['Dirección de la obra', 'obra'],
  ['REF', 'referencia'],
  ['Entrada', 'entrada'],
  ['Salida', 'salida'],
  ['Desplazamiento', 'desplazamientos'],
  ['Kilómetros', 'kilometros'],
  ['Técnicos', 'tecnicos'],
]);

function montar() {
  const contenedor = { innerHTML: '', hijos: [] };
  const ctx = {
    console, window: null,
    document: { createElement: () => ({ style: {}, setAttribute() {}, appendChild() {}, innerHTML: '' }) },
    Date, Array, Object, String, Number, JSON,
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(JS, 'parteDetailView.js'), 'utf8'), ctx,
    { filename: 'parteDetailView.js' });
  return { ctx, contenedor };
}

const PARTE = Object.freeze({
  id: 7, numero: 'PT-2026-001', clienteNombre: 'Comunidad Los Olivos',
  fecha: '2026-09-02T08:00:00.000Z', obra: 'C/ Mayor 3', referencia: 'REF-778',
  entrada: '09:15', salida: '11:40', desplazamientos: 1, kilometros: 12.5,
  tecnicos: ['Israel', 'Miguel'], tipo: 'reparacion_asistencia',
  lineas: [
    { bloque: 'mano_obra', unds: 2, descripcion: 'Tiempo de espera' },
    { bloque: 'materiales', unds: 1, descripcion: 'Presostato' },
  ],
  notas: 'n', estado: 'borrador',
  puedeEditarContenido: { ok: true, motivo: null }, puedeEditarPrecios: { ok: true, motivo: null },
});
const FIRMADO = { ...PARTE, estado: 'firmado', puedeEditarContenido: { ok: false, motivo: 'firmado' } };

const pintar = (parte) => {
  const { ctx, contenedor } = montar();
  assert.equal(ctx.renderParte(contenedor, parte), true, '🔴 la vista se negó a pintar');
  return { html: contenedor.innerHTML, ctx };
};

// ═══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 LO QUE DECIDE EL TICKET
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-818 · 🔴 los SIETE de arriba son campos ESCRIBIBLES, uno por uno', () => {
  const { html } = pintar(PARTE);
  // SUELO: si la pantalla pintara poco, «tiene siete casillas» no significaría nada.
  assert.ok(html.length > 1500, `🔴 CIEGO: la pantalla pintó ${html.length} caracteres.`);

  const faltan = LOS_SIETE.filter(([, campo]) => !html.includes(`data-parte-campo="${campo}"`));
  assert.deepEqual(faltan.map(([r]) => r), [],
    '🔴 SIGUEN SIENDO RÓTULOS MUERTOS: parecen campos y no se pueden rellenar. Los siete existen '
    + 'en la base y los siete se escriben por el PATCH — medido en el PASO 0.');

  // El número abre teclado numérico: con una mano, un teclado alfabético para meter 12,5 es otro
  // obstáculo más en la obra.
  assert.match(html, /data-parte-campo="kilometros"[^>]*inputmode="decimal"|inputmode="decimal"[^>]*data-parte-campo="kilometros"/,
    '🔴 los kilómetros no abren teclado numérico');
});

test('SCRUM-818 · 🔴 «Técnicos» viene PRELLENADO y sigue siendo EDITABLE', () => {
  const { html } = pintar(PARTE);
  assert.ok(html.includes('value="Israel, Miguel"'),
    '🔴 los técnicos no vienen puestos: nadie teclea lo que el sistema ya sabe (SCRUM-650).');
  assert.ok(html.includes('data-parte-campo="tecnicos"'),
    '🔴 los técnicos se han vuelto de solo lectura. El parte es la prueba de lo que PASÓ: si al '
    + 'final fue otro, manda quien fue de verdad, y eso se teclea aquí.');
});

test('SCRUM-818 · 🔴 un parte FIRMADO no abre NI UN campo (T3, SCRUM-652)', () => {
  const { html } = pintar(FIRMADO);
  assert.ok(!html.includes('data-parte-campo='),
    '🔴 UN PARTE FIRMADO HA ABIERTO UN CAMPO. El contenido de un documento que el cliente ya firmó '
    + 'no se toca; abrir un hueco ahí es invitar a cambiar lo que alguien firmó.');
  assert.ok(!html.includes('parte-linea-unds') && !html.includes('parte-linea-desc'),
    '🔴 las líneas de un parte firmado tienen casillas escribibles.');
  // Y no desaparecen: se enseñan como dato, que es lo contrario de dejar la pantalla muda.
  assert.ok(html.includes('parte-campo-dato'), '🔴 los datos han desaparecido en vez de enseñarse');
  assert.ok(html.includes('C/ Mayor 3'), '🔴 el dato ya no se ve');
});

test('SCRUM-818 · las líneas tienen DOS campos con borde, y el grupo de tipos dice de qué es', () => {
  const { html } = pintar(PARTE);
  assert.ok(html.includes('class="parte-linea-unds"'), '🔴 la cantidad no es un campo');
  assert.ok(html.includes('class="parte-linea-desc"'), '🔴 la descripción no es un campo');
  assert.ok(html.includes('parte-quitar-linea'), '🔴 se ha perdido la «×» de quitar');
  // La aguja se construye en vez de escribirse entera: un literal con la etiqueta y su `>` pegado
  // sube el censo de SCRUM-553, y este fichero no tiene por qué pagar ese impuesto para comprobar
  // que el rótulo está donde debe.
  const enLegend = '<legend' + '>' + 'Tipo de intervención';
  assert.ok(html.includes(enLegend),
    '🔴 los tres tipos vuelven a flotar sin decir de qué son opciones. El rótulo NO es texto nuevo: '
    + 'lo firmó el fundador en SCRUM-703 para este mismo vocabulario cerrado.');
});

test('SCRUM-818 · 🔴 CERO marcadores en el DOM, en los TRES estados', () => {
  let total = 0;
  for (const parte of [PARTE, FIRMADO, { ...PARTE, lineas: [] }]) {
    total += pintar(parte).html.split(MARCADOR).length - 1;
  }
  assert.equal(total, 0, `🔴 ${total} marcadores llegan a la pantalla del técnico.`);
});

test('SCRUM-818 · lo tecleado viaja con SU tipo, y vacío es null y no cero', () => {
  const { ctx } = pintar(PARTE);
  const cuerpo = ctx.parteCuerpoDeCampo;
  assert.equal(typeof cuerpo, 'function', '🔴 la vista no publica `parteCuerpoDeCampo`');

  // Por VALOR y no por identidad de prototipo: la vista se evalúa en un contexto `vm`, así que sus
  // objetos no comparten `Object.prototype` con este fichero y `deepEqual` estricto los rechaza
  // aunque digan lo mismo. Lo que se está comprobando es el contenido.
  const igual = (a, b) => assert.equal(JSON.stringify(a), JSON.stringify(b));

  igual(cuerpo('kilometros', '12.5'), { kilometros: 12.5 });
  igual(cuerpo('desplazamientos', '2'), { desplazamientos: 2 });
  igual(cuerpo('obra', '  C/ Mayor  '), { obra: 'C/ Mayor' });
  assert.equal(JSON.stringify(cuerpo('tecnicos', 'Israel, , Miguel')),
    JSON.stringify({ tecnicos: ['Israel', 'Miguel'] }),
    '🔴 «Israel, , Miguel» ha guardado un técnico vacío');

  // 🔴 AUSENTE NO ES CERO. Un campo que el técnico borra es un dato que NO apuntó; 0 kilómetros es
  // haber ido y no recorrer nada. En un papel que se factura, no son lo mismo.
  assert.equal(JSON.stringify(cuerpo('kilometros', '')), JSON.stringify({ kilometros: null }),
    '🔴 borrar los kilómetros ha guardado CERO. Ausente y cero no son el mismo dato.');
  igual(cuerpo('obra', ''), { obra: null });
});

test('SCRUM-818 · las clases nuevas TIENEN regla en styles.css', () => {
  // La pregunta no es «¿tiene clase?» sino «¿esa clase existe en la hoja?» — el punto ciego que
  // cerró SCRUM-666, y por el que esta pantalla llegó a producción sin una sola regla de CSS.
  const enHojas = clasesDeLasHojas(RAIZ);
  const sinRegla = ['parte-datos', 'parte-campo', 'parte-campo-rotulo', 'parte-campo-dato',
    'parte-linea-unds', 'parte-linea-desc', 'parte-col-unds', 'parte-col-quitar']
    .filter((c) => !enHojas.has(c));
  assert.deepEqual(sinRegla, [],
    `🔴 clases pintadas que la hoja no define: ${JSON.stringify(sinRegla)}. Se verían como texto crudo.`);
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// EL CANDADO QUE NO SE PUEDE ROMPER — SCRUM-725
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-818 · 🔴 el aviso de SCRUM-725 sigue en SU línea, en los DOS sentidos', () => {
  // Si el rediseño de las líneas lo tira o lo descoloca, se ha roto lo que impide que una máquina
  // invente el modelo de la alarma de un cliente en un documento que ese cliente firma.
  const { ctx } = pintar(PARTE);
  const AVISO = 'Esto no lo has dicho — bórralo o confírmalo.';
  const LINEA = { descripcion: 'Alarma Ajax Hub 2', unds: 1 };
  const avisos = { datosRetirados: AVISO, cantidadesRetiradas: 'x' };

  const conDato = { innerHTML: '' };
  ctx.partePintarPropuesta(conDato, {
    propuesta: { vacia: false, mano_obra: [LINEA], materiales: [], sinBloque: [],
      datosRetirados: [{ descripcion: 'Alarma Ajax Hub 2', dato: 'modelo' }] },
    avisos,
  });
  assert.ok(conDato.innerHTML.includes(AVISO),
    '🔴 EL AVISO NO APARECE con un dato que el técnico no dijo.');
  assert.ok(conDato.innerHTML.includes('data-dato-inventado="1"'),
    '🔴 el aviso ya no va marcado en su línea.');
  assert.ok(conDato.innerHTML.indexOf(AVISO) > conDato.innerHTML.indexOf('Alarma Ajax Hub 2'),
    '🔴 el aviso se ha descolocado: va DESPUÉS de la descripción que lo lleva, no como resumen.');

  const sinDato = { innerHTML: '' };
  ctx.partePintarPropuesta(sinDato, {
    propuesta: { vacia: false, mano_obra: [LINEA], materiales: [], sinBloque: [], datosRetirados: [] },
    avisos,
  });
  assert.ok(!sinDato.innerHTML.includes(AVISO),
    '🔴 el aviso aparece con un dato RESPALDADO: avisar de todo es no avisar de nada.');
  assert.ok(sinDato.innerHTML.includes('Alarma Ajax Hub 2'),
    '🔴 y la línea sí se pinta: el «no aparece» de arriba no puede ser que no pintara nada.');
});
