// SCRUM-293 (A2) · LOS TRES ESTADOS NO COLAPSAN, Y EL CUARTO GRITA.
//
// ──────────────────────────────────────────────────────────────────────────────────────────────
// `retencionIrpfDeclarada` significa «HA DECLARADO», no «declara que retiene». Cruzar esas dos
// lecturas hace que «nadie lo ha dicho todavía» signifique «todos declaran que no retienen» — y
// como el campo es `Boolean @default(false)`, eso sería **los 13 merchants de hoy**.
//
// Ése es el defecto que este ticket existe para impedir, y no es teórico: emitir sin la retención
// de quien SÍ retiene es un fallo fiscal MUDO. La factura sale, el cliente la paga, y el descuadre
// aparece meses después en el 111 — cuando ya no se puede corregir la factura (regla 29).

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  leerTipoRetencion,
  CUBO_DE_RETENCION,
  tiposDeRetencionOrdenados,
} from '../dist/modules/invoicing/domain/retencionIrpf.js';

/** EL ADAPTADOR — la única línea que traduce el merchant a lo que el dominio entiende. */
const configDe = (m) => (m.retencionIrpfDeclarada ? (m.retencionIrpfTipo ?? false) : null);

test('SCRUM-293 · SUELO: el cubo y el lector se cargan y tienen contenido', () => {
  // Sin esto, un import roto dejaría las igualdades de abajo comparando `undefined` con
  // `undefined` — verde por no ver nada, que es como un guard deja de vigilar sin que se note.
  assert.equal(typeof leerTipoRetencion, 'function', '🔴 CIEGO: no se carga `leerTipoRetencion`');
  const ordenados = tiposDeRetencionOrdenados();
  assert.ok(ordenados.length >= 4,
    `🔴 CIEGO: el cubo tiene ${ordenados.length} tipos y deberían ser al menos 4`);
  assert.ok(ordenados.every((t) => typeof t.rotulo === 'string' && t.rotulo.length > 0),
    '🔴 hay un tipo en el cubo sin rótulo utilizable');
});

// ── LOS TRES ESTADOS, uno por test, para que un rojo diga CUÁL se rompió ──────────────────────

test('SCRUM-293 · ① declarada=false → NO CONSTA (y NO es «no retiene»)', () => {
  const m = { retencionIrpfDeclarada: false, retencionIrpfTipo: null };
  assert.equal(configDe(m), null,
    '🔴 el merchant que no ha declarado nada se está resolviendo a algo distinto de `null`');

  const r = leerTipoRetencion(configDe(m));
  assert.equal(r.ok, false,
    '🔴 «NO CONSTA» se está tratando como un estado válido.\n\n'
    + '  `retencionIrpfDeclarada = false` son los 13 merchants de hoy: NINGUNO ha dicho si\n'
    + '  retiene. Resolverlo a «sin retención» sería poner en su boca una afirmación que no han\n'
    + '  hecho, y hacerlo en silencio — que es la parte cara.');
});

test('SCRUM-293 · ② declarada=true + tipo NULL → DECLARA QUE NO RETIENE', () => {
  const m = { retencionIrpfDeclarada: true, retencionIrpfTipo: null };
  assert.equal(configDe(m), false, '🔴 «declara que no retiene» no está llegando como `false`');

  const r = leerTipoRetencion(configDe(m));
  assert.equal(r.ok, true, '🔴 «declara que NO retiene» debería ser un estado VÁLIDO, no un fallo');
  assert.equal(r.tipo, null, '🔴 quien declara que no retiene no puede acabar con un tipo');
});

test('SCRUM-293 · ③ declarada=true + tipo=N → RETIENE, y con ESE tipo', () => {
  for (const { tipo } of tiposDeRetencionOrdenados()) {
    const m = { retencionIrpfDeclarada: true, retencionIrpfTipo: tipo };
    const r = leerTipoRetencion(configDe(m));
    assert.equal(r.ok, true, `🔴 el tipo ${tipo} del cubo no se acepta`);
    assert.equal(r.tipo, tipo, `🔴 se ha leído ${r.tipo} donde el merchant declaró ${tipo}`);
  }
});

test('SCRUM-293 · 🔴 ① y ② NO COLAPSAN: son distinguibles', () => {
  // El corazón del ticket. Si estos dos se confunden, «no lo ha dicho» y «dice que no» son el
  // mismo valor y nadie puede saber a quién hay que preguntarle.
  const noConsta = leerTipoRetencion(configDe({ retencionIrpfDeclarada: false, retencionIrpfTipo: null }));
  const noRetiene = leerTipoRetencion(configDe({ retencionIrpfDeclarada: true, retencionIrpfTipo: null }));
  assert.notDeepEqual(noConsta, noRetiene,
    '🔴 «NO CONSTA» y «DECLARA QUE NO RETIENE» han colapsado en el mismo resultado.\n\n'
    + '  Son lo contrario: uno es una pregunta sin contestar y el otro una respuesta. Con los dos\n'
    + '  iguales, el producto no puede distinguir a quién preguntarle — y emite igual.');
  assert.equal(noConsta.ok, false);
  assert.equal(noRetiene.ok, true);
});

// ── ⑤ EL SUELO RUIDOSO ────────────────────────────────────────────────────────────────────────

test('SCRUM-293 · 🔴 SUELO RUIDOSO: si la lectura falla, NO se degrada a «sin retención»', () => {
  // «Sin retención» es un valor LEGÍTIMO, y por eso es el peor sitio del producto para degradar:
  // una factura sin retención no chirría, así que nadie notaría nunca el fallo. Tiene que gritar.
  for (const roto of [null, undefined, 'quince', 99, {}, [], NaN, '']) {
    const r = leerTipoRetencion(roto);
    assert.equal(r.ok, false,
      `🔴 la entrada rota ${JSON.stringify(roto)} se ha aceptado en vez de fallar.\n\n`
      + '  Degradar a «sin retención» ante un fallo de lectura es invisible: la factura sale bien\n'
      + '  formada, el cliente la paga, y el descuadre aparece meses después en el 111.');
    assert.ok(typeof r.motivo === 'string' && r.motivo.length > 0,
      `🔴 falla sin decir por qué con ${JSON.stringify(roto)}: un fallo mudo no es ruidoso`);
  }
});

test('SCRUM-293 · el cubo no admite tipos fuera de él (el 19 incluido)', () => {
  // El 19 % no es un tipo de retención de actividades profesionales. Si algún día vuelve, que
  // vuelva por el cubo —donde no compila sin rótulo— y no colándose por el lector.
  const r = leerTipoRetencion(19);
  assert.equal(r.ok, false, '🔴 el 19 se está aceptando como tipo de retención');
  assert.ok(!(19 in CUBO_DE_RETENCION), '🔴 el 19 ha entrado en el cubo');
});
