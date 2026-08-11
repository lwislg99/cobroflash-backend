// tests/scrum359-tres-relojes.test.mjs — SCRUM-359 (H4)
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// LA FECHA DE UNA FIRMA DEPENDE HOY DE UN RELOJ QUE EL USUARIO CONTROLA.
//
// Se firma sin red, el trazo se queda en la cola del móvil y sube al abrir la aplicación —
// días después (H5 midió el desalojo de iOS a los 7). El servidor sella `firmadoAt` en el
// instante de la LLEGADA, así que el albarán acredita como hora de firma un momento en el que
// el cliente ya no estaba delante.
//
// Los tres relojes acotan eso: la hora del DISPOSITIVO se contrasta contra una ventana hecha
// con DOS instantes NUESTROS —última conexión antes y llegada al servidor— que nadie puede
// tocar desde un móvil.
//
// Censo de candidatos para el suelo y qué se eligió: `docs/master/SCRUM-359.md` §2.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '..');
const {
  contrastarReloj, elegirSuelo, cruzaDias, FUENTES_DE_SUELO,
} = await import('../dist/modules/jobs/domain/ventanaDeFirma.js');

const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');
const T = (iso) => new Date(iso);

/** El caso normal del carril H: se firma el martes en un sótano, sube el jueves al abrir la app. */
const SUELO = T('2026-08-04T09:00:00.000Z');   // última conexión nuestra: bajó la precarga
const TECHO = T('2026-08-06T11:00:00.000Z');   // llegada al servidor, dos días después
const candidatos = (extra = []) => [{ fuente: 'albaran_actualizado', instante: SUELO }, ...extra];

// ═══ SUELO DEL TEST ══════════════════════════════════════════════════════════════════════

test('SCRUM-359 · SUELO: el módulo se carga y contrasta un caso simple', () => {
  assert.equal(typeof contrastarReloj, 'function', '🔴 ¿se ha compilado `dist/`?');
  assert.ok(FUENTES_DE_SUELO.length >= 5,
    `🔴 solo hay ${FUENTES_DE_SUELO.length} fuentes de suelo declaradas: el censo no se ha leído.`);
  const r = contrastarReloj({
    horaDispositivo: T('2026-08-04T10:00:00.000Z'),
    candidatosSuelo: candidatos(),
    llegadaAlServidor: TECHO,
  });
  assert.equal(r.estado, 'coherente',
    '🔴 el contraste no funciona ni con una hora que cae claramente dentro: lo de abajo no probaría nada.');
});

// ═══ ① CONTROL POSITIVO ══════════════════════════════════════════════════════════════════

test('SCRUM-359 · ① la hora del dispositivo DENTRO de la ventana → coherente', () => {
  // Firmó el martes a las 10:00: después de bajar la precarga (09:00) y antes de subir (jueves).
  const r = contrastarReloj({
    horaDispositivo: T('2026-08-04T10:00:00.000Z'),
    candidatosSuelo: candidatos(),
    llegadaAlServidor: TECHO,
  });
  assert.equal(r.estado, 'coherente');
  assert.equal(r.ventana.suelo.toISOString(), SUELO.toISOString());
  assert.equal(r.ventana.techo.toISOString(), TECHO.toISOString());
  assert.equal(r.ventana.anchoMs, TECHO.getTime() - SUELO.getTime());
});

test('SCRUM-359 · ① los BORDES cuentan como dentro: la firma con cobertura no es sospechosa', () => {
  // Con red, la hora del dispositivo y la llegada son casi el mismo instante. Si el borde fuera
  // «fuera», marcaríamos como reloj desfasado la mitad de las firmas del producto.
  for (const [nombre, hora] of [['el suelo', SUELO], ['el techo', TECHO]]) {
    const r = contrastarReloj({ horaDispositivo: hora, candidatosSuelo: candidatos(), llegadaAlServidor: TECHO });
    assert.equal(r.estado, 'coherente', `🔴 firmar justo en ${nombre} se declara desfase.`);
  }
});

test('SCRUM-359 · ① el suelo es EL MÁS RECIENTE, que es el que estrecha la ventana', () => {
  const masReciente = T('2026-08-06T08:00:00.000Z');
  const r = contrastarReloj({
    horaDispositivo: T('2026-08-06T09:00:00.000Z'),
    candidatosSuelo: candidatos([{ fuente: 'albaran_enviado_para_firma', instante: masReciente }]),
    llegadaAlServidor: TECHO,
  });
  assert.equal(r.ventana.suelo.toISOString(), masReciente.toISOString(),
    '🔴 se ha cogido un suelo más antiguo habiendo uno más reciente. Cuanto más reciente, más ' +
    'estrecha la ventana y más dice el contraste: coger el viejo tira evidencia a la basura.');
  assert.equal(r.ventana.fuenteSuelo, 'albaran_enviado_para_firma');
});

// ═══ ② CONTROL NEGATIVO — el que justifica el ticket ══════════════════════════════════════

test('SCRUM-359 · ② 🔴 reloj ADELANTADO: la firma dice haberse hecho DESPUÉS de llegar', () => {
  // Imposible: no se puede firmar después de que la firma haya llegado al servidor.
  const hora = T('2026-08-07T11:00:00.000Z'); // un día MÁS TARDE que el techo
  const r = contrastarReloj({ horaDispositivo: hora, candidatosSuelo: candidatos(), llegadaAlServidor: TECHO });
  assert.equal(r.estado, 'desfase_adelantado',
    '🔴 una firma fechada DESPUÉS de su propia llegada al servidor pasa como coherente. Es el ' +
    'caso que este ticket existe para detectar: el reloj del móvil va adelantado y hasta hoy no ' +
    'había forma de saberlo.');
  assert.equal(r.desfaseMs, hora.getTime() - TECHO.getTime());
});

test('SCRUM-359 · ② 🔴 reloj ATRASADO: la firma dice haberse hecho ANTES de la última conexión', () => {
  // También imposible: el albarán no estaba todavía en el móvil.
  const hora = T('2026-08-01T09:00:00.000Z'); // tres días ANTES del suelo
  const r = contrastarReloj({ horaDispositivo: hora, candidatosSuelo: candidatos(), llegadaAlServidor: TECHO });
  assert.equal(r.estado, 'desfase_atrasado',
    '🔴 una firma fechada ANTES de la última conexión de ese dispositivo pasa como coherente. ' +
    'Ese albarán ni siquiera estaba en el móvil todavía.');
  assert.equal(r.desfaseMs, SUELO.getTime() - hora.getTime());
});

test('SCRUM-359 · ② el desfase se DECLARA y NUNCA se corrige', () => {
  // Un valor «arreglado» es indistinguible de uno correcto, y destruye la anomalía que hacía
  // falta ver. El módulo no puede tener ninguna función que ajuste la hora del dispositivo.
  const hora = T('2026-08-07T11:00:00.000Z');
  const r = contrastarReloj({ horaDispositivo: hora, candidatosSuelo: candidatos(), llegadaAlServidor: TECHO });
  assert.equal(r.horaDispositivo.toISOString(), hora.toISOString(),
    '🔴 la hora del dispositivo vuelve CAMBIADA. Corregir un dato de prueba es peor que tener un ' +
    'dato raro: el valor corregido ya no se distingue de uno correcto.');
  const fuente = leer('src/modules/jobs/domain/ventanaDeFirma.ts');
  assert.ok(!/function\s+(corregir|ajustar|normalizarHora)/.test(fuente),
    '🔴 hay una función que corrige la hora del dispositivo. El desfase se declara, no se arregla.');
});

// ═══ ③ EL SUELO — «desconocida» y «estrecha» son OPUESTOS ════════════════════════════════

test('SCRUM-359 · ③ 🔴 sin ningún evento anterior, la ventana NO se calcula y se DICE', () => {
  const r = contrastarReloj({
    horaDispositivo: T('2026-08-04T10:00:00.000Z'),
    candidatosSuelo: [],
    llegadaAlServidor: TECHO,
  });
  assert.equal(r.estado, 'ventana_desconocida',
    '🔴 sin suelo se ha devuelto una ventana igualmente. «Ventana desconocida» y «ventana ' +
    'estrecha» son OPUESTOS: el primero dice que no sabemos acotar nada.');
  assert.equal(r.motivo, 'sin_suelo');
  assert.ok(!('ventana' in r), '🔴 se devuelve una ventana en un caso en que no la hay.');
});

test('SCRUM-359 · ③ NO se inventa un suelo con una fecha que no sea del servidor', () => {
  // `Albaran.fecha` y `Albaran.fechaEntrega` son EDITABLES en borrador (medido en el esquema).
  // Colar una de ellas como suelo haría que el reloj del dispositivo se contrastara contra un
  // dato del propio dispositivo: siempre saldría coherente y la ventana no probaría nada.
  const r = contrastarReloj({
    horaDispositivo: T('2026-08-04T10:00:00.000Z'),
    candidatosSuelo: [{ fuente: 'albaran_fecha_entrega', instante: T('2026-08-04T08:00:00.000Z') }],
    llegadaAlServidor: TECHO,
  });
  assert.equal(r.estado, 'ventana_desconocida',
    '🔴 se ha aceptado como suelo una fuente que NO está en `FUENTES_DE_SUELO`. La ventana solo ' +
    'vale si sus dos extremos son de NUESTRO reloj; con una fecha que el usuario edita, el ' +
    'contraste se vuelve circular.');
  for (const f of FUENTES_DE_SUELO) {
    assert.ok(!/fecha_entrega|albaran_fecha$/.test(f),
      `🔴 «${f}» es una fecha editable por el usuario y está admitida como suelo.`);
  }
});

test('SCRUM-359 · ③ un candidato POSTERIOR a la llegada no acota nada y se descarta', () => {
  const r = contrastarReloj({
    horaDispositivo: T('2026-08-04T10:00:00.000Z'),
    candidatosSuelo: candidatos([{ fuente: 'auditoria', instante: T('2026-08-09T00:00:00.000Z') }]),
    llegadaAlServidor: TECHO,
  });
  assert.equal(r.ventana.suelo.toISOString(), SUELO.toISOString(),
    '🔴 se ha usado como suelo un evento POSTERIOR a la llegada. Eso da un suelo mayor que el ' +
    'techo —una ventana imposible— y haría «desfasadas» todas las firmas.');
});

test('SCRUM-359 · ③ una firma SIN hora de dispositivo no se confunde con un desfase', () => {
  // Firmas de versiones anteriores del cliente, y las que suben con cobertura sin pasar por la
  // cola. No tener el dato no es lo mismo que tenerlo y que sea raro.
  const r = contrastarReloj({ horaDispositivo: null, candidatosSuelo: candidatos(), llegadaAlServidor: TECHO });
  assert.equal(r.estado, 'sin_hora_dispositivo');
  assert.ok(r.ventana, 'la ventana sí se calcula: los dos extremos nuestros existen igual.');
});

// ═══ ④ LA VENTANA QUE CRUZA DÍAS ═════════════════════════════════════════════════════════

test('SCRUM-359 · ④ la ventana que cruza días se DETECTA (no se resuelve aquí)', () => {
  const r = contrastarReloj({
    horaDispositivo: T('2026-08-04T10:00:00.000Z'),
    candidatosSuelo: candidatos(),
    llegadaAlServidor: TECHO,
  });
  assert.equal(cruzaDias(r.ventana), true,
    '🔴 una ventana de martes a jueves no se detecta como que cruza días. Un albarán acredita ' +
    'una entrega de UN día concreto, y aquí nuestros datos no dicen cuál: solo lo dice el reloj ' +
    'que no controlamos.');

  const mismoDia = contrastarReloj({
    horaDispositivo: T('2026-08-04T10:00:00.000Z'),
    candidatosSuelo: [{ fuente: 'albaran_actualizado', instante: T('2026-08-04T09:00:00.000Z') }],
    llegadaAlServidor: T('2026-08-04T12:00:00.000Z'),
  });
  assert.equal(cruzaDias(mismoDia.ventana), false, '🔴 una ventana de tres horas del mismo día dice que cruza días.');
});

test('SCRUM-359 · ④ «qué día fue» se pregunta en hora local, no en UTC', () => {
  // Las 23:30 del 4-ago en Madrid son las 21:30 UTC del mismo día; pero 00:30 UTC del día 5 son
  // las 02:30 del 5 en Madrid. Preguntarlo en UTC parte mal los días en los que se factura.
  const ventana = {
    suelo: T('2026-08-04T21:30:00.000Z'),  // 23:30 en Madrid, día 4
    fuenteSuelo: 'albaran_actualizado',
    techo: T('2026-08-04T22:30:00.000Z'),  // 00:30 en Madrid, día 5
    anchoMs: 3600000,
  };
  assert.equal(cruzaDias(ventana), true,
    '🔴 en Madrid esa ventana empieza el día 4 y acaba el día 5, y se dice que no cruza días.');
});

// ═══ ⑤ ROJO POR EL MECANISMO ═════════════════════════════════════════════════════════════

test('SCRUM-359 · ⑤ 🔴 SIN VENTANA, la fecha de la firma depende de un reloj del usuario', () => {
  // Este es el test que cae si alguien quita la ventana: con los tres relojes, una hora imposible
  // se detecta; sin ellos, se acepta tal cual y el albarán acredita lo que diga el móvil.
  const horaImposible = T('2026-08-20T00:00:00.000Z'); // dos semanas DESPUÉS de llegar
  const conVentana = contrastarReloj({
    horaDispositivo: horaImposible, candidatosSuelo: candidatos(), llegadaAlServidor: TECHO,
  });
  assert.notEqual(conVentana.estado, 'coherente',
    '🔴 LA FECHA DE LA FIRMA DEPENDE DE UN RELOJ QUE EL USUARIO CONTROLA. Una hora dos semanas ' +
    'posterior a la llegada de la propia firma pasa por buena, y el albarán acredita esa fecha ' +
    'ante un cliente. La ventana es lo único que lo detecta: sin ella, cualquier hora vale y ' +
    'nadie se entera.');
  assert.match(conVentana.estado, /^desfase_/,
    '🔴 la anomalía no se nombra: sin decir QUÉ pasa, el dato raro se archiva como si fuera normal.');
});

// ═══ ⑥ EL CENSO, CONTRA EL ÁRBOL — que la premisa siga siendo verdad ══════════════════════

test('SCRUM-359 · ⑥ el reloj del dispositivo SE CAPTURA en el móvil', () => {
  // Si algún día deja de capturarse, el reloj ① desaparece y la ventana pierde su sujeto.
  const cola = leer('public/dashboard/js/colaDeFirmas.js');
  assert.match(cola, /encoladaEn:\s*Date\.now\(\)/,
    '🔴 la cola ya no guarda `encoladaEn`. Es la hora en que el cliente firmó de verdad, y sin ' +
    'ella no hay nada que contrastar contra la ventana.');
});

test('SCRUM-359 · ⑥ 🔴 y HOY NO VIAJA: el reloj del dispositivo se descarta al subir', () => {
  // La premisa del ticket, medida contra el árbol y no citada. El día que `encoladaEn` empiece a
  // viajar, este test cae — y esa caída es la señal de que la fase siguiente está hecha y hay que
  // cablear `contrastarReloj` en el camino de firma (`docs/master/SCRUM-359.md` §5).
  const cola = leer('public/dashboard/js/colaDeFirmas.js');
  const cuerpo = cola.slice(cola.indexOf('function subirFirmaDeLaCola'));
  assert.ok(!/encoladaEn/.test(cuerpo.slice(0, cuerpo.indexOf('window.apiRequest'))),
    '🔴 `encoladaEn` ya viaja al servidor. Si es intencionado, este ticket ha pasado de fase: ' +
    'toca guardar los tres relojes y cablear `contrastarReloj`, y actualizar §5 del documento.');

  const ruta = leer('src/modules/jobs/app/routes/albaranes.routes.ts');
  assert.match(ruta, /const firmadoAt = new Date\(\);/,
    '🔴 el servidor ya no sella la llegada con su propio reloj. Ese es el reloj ③ y el techo de ' +
    'la ventana: si se sustituye por uno que venga del cliente, la ventana deja de probar nada.');
});
