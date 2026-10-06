// tests/scrum1100d-el-rojo-dice-lo-que-sabe.test.mjs — SCRUM-1100 (tramo 1100d)
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 DOS MENSAJES DEL META-GUARD NOMBRABAN UNA CAUSA QUE NO HABÍAN COMPROBADO
// ═════════════════════════════════════════════════════════════════════════════════════════════
//
// Medido sobre los logs del job en CI (la serie, con su población y su fecha, en
// `docs/master/SCRUM-1100.md`, sección 1100d):
//
//   · «EL FICHERO MURIÓ AL MUTAR … nunca llegó a ejecutarse … Acota la mutación» salía cuando la
//     ruta del fichero estaba entre los caídos, sin mirar si habían llegado otros tests de esa
//     pasada. Casi siempre habían llegado: el fichero corrió, y lo que no llegó fue el NOMBRE del
//     caso que cayó.
//   · «O el fichero no llegó a ejecutarse, o ese test ya fallaba, o el nombre caducó» decía lo
//     mismo para un test que CAYÓ en la pasada limpia y para uno que NO LLEGÓ. Son un rojo del
//     árbol y un informe perdido, y se arreglan en sitios distintos.
//
// Este fichero vigila el TEXTO de esos dos mensajes. Las funciones son puras: aquí no se muta nada.
//
// ── LO QUE ESTE FICHERO NO PUEDE DECIR ─────────────────────────────────────────────────────
// 🔴 NO dice que el meta-guard haya dejado de perder informes. No ha dejado: eso es SCRUM-1405.
// 🔴 NO cambia ningún veredicto, y el último caso lo comprueba por el camino real de PUERTA 1.
//    El camino real del cuarto veredicto (un fichero rojo por su ruta) no se ejercita aquí: para
//    provocarlo hay que mutar el árbol, y eso lo hace `npm run meta:mutaciones`.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  aplicarUna, cayo, paso, mensajeDeLimpiaSinVerde, mensajeDeMuerto,
} from '../scripts/meta-guard-mutaciones.mjs';

// ⚠️ MUTACIONES DECLARADAS (SCRUM-745): las ejecuta `npm run meta:mutaciones` en CI. Cada una
// devuelve un mensaje a su respuesta única —lo que había antes— y exige el rojo.
export const MUTACIONES_QUE_ME_TUMBAN = [
  { fichero: 'scripts/meta-guard-mutaciones.mjs',
    de: '  if (llegaron === 0) {',
    a: '  if (true) { // un solo mensaje para los dos casos, a proposito',
    cae: 'SCRUM-1100d · 🔴 EL QUE DECIDE: un fichero que CORRIÓ no recibe el mensaje de uno que murió al cargar' },
  { fichero: 'scripts/meta-guard-mutaciones.mjs',
    de: '  if (cayo(limpia, cae)) {',
    a: '  if (false) { // el que cayo y el que no llego, por la misma puerta, a proposito',
    cae: 'SCRUM-1100d · 🔴 EL QUE DECIDE: «cayó en la limpia» y «no llegó» NO dan el mismo mensaje' },
];

const NOMBRE = 'SCRUM-1263 · 🔴 el guard SALTADO no es un guard verde (sin banco, un test de BD se salta)';
const OTROS = ['uno', 'dos', 'tres'];

// La pasada limpia, de tres formas que hasta hoy daban el MISMO texto.
const limpiaDondeCayo = { pasados: OTROS, caidos: [NOMBRE], saltados: [] };
const limpiaDondeNoLlego = { pasados: OTROS, caidos: [], saltados: [] };
const limpiaConElFicheroMuerto = { pasados: [], caidos: ['/ruta/al/fichero.test.mjs'], saltados: [] };

test('SCRUM-1100d · SUELO: las tres pasadas limpias de prueba son de verdad distintas, y en ninguna el test está en verde', () => {
  for (const [n, r] of [['cayó', limpiaDondeCayo], ['no llegó', limpiaDondeNoLlego], ['fichero muerto', limpiaConElFicheroMuerto]]) {
    assert.ok(!paso(r, NOMBRE), `🔴 en el caso «${n}» el test está en verde: no es un caso de PUERTA 1`);
  }
  assert.ok(cayo(limpiaDondeCayo, NOMBRE));
  assert.ok(!cayo(limpiaDondeNoLlego, NOMBRE) && !cayo(limpiaConElFicheroMuerto, NOMBRE));
});

test('SCRUM-1100d · 🔴 EL QUE DECIDE: «cayó en la limpia» y «no llegó» NO dan el mismo mensaje', () => {
  const cayoMsg = mensajeDeLimpiaSinVerde({ limpia: limpiaDondeCayo, cae: NOMBRE });
  const noLlegoMsg = mensajeDeLimpiaSinVerde({ limpia: limpiaDondeNoLlego, cae: NOMBRE });
  assert.notEqual(cayoMsg, noLlegoMsg,
    '🔴 EL MENSAJE NO DISTINGUE un rojo del árbol de un informe perdido. Es el defecto medido: el '
    + 'mismo texto para los dos, y quien lo lee no sabe si tiene que arreglar un test o esperar.');
  assert.match(cayoMsg, /CAYÓ en la pasada limpia/);
  assert.doesNotMatch(cayoMsg, /NO LLEGÓ/, 'un test que cayó SÍ llegó: está entre los caídos');
  assert.match(noLlegoMsg, /NO LLEGÓ/);
  assert.match(noLlegoMsg, /NO SÉ si corrió y su informe no llegó, o si no corrió/,
    '🔴 cuando el test no aparece, el instrumento no sabe si corrió: tiene que decirlo con esas palabras');
  assert.doesNotMatch(noLlegoMsg, /CAYÓ en la pasada limpia/);
});

test('SCRUM-1100d · el recuento de la limpia viaja en el mensaje, y el veredicto de fondo se sigue diciendo', () => {
  for (const limpia of [limpiaDondeCayo, limpiaDondeNoLlego, limpiaConElFicheroMuerto]) {
    const m = mensajeDeLimpiaSinVerde({ limpia, cae: NOMBRE, ficheroMuerto: limpia === limpiaConElFicheroMuerto });
    assert.match(m, /NO aparece EN VERDE en la pasada limpia, así que no se ha mutado nada/,
      '🔴 la primera frase es la de siempre: quien lee logs viejos y nuevos tiene que reconocerla');
    assert.match(m, new RegExp(`Recuento de la LIMPIA: ${limpia.pasados.length} pasados · ${limpia.caidos.length} caídos · 0 saltados`));
  }
});

test('SCRUM-1100d · «el fichero no llegó a ejecutarse» sólo se dice cuando el fichero está entre los caídos', () => {
  const muerto = mensajeDeLimpiaSinVerde({ limpia: limpiaConElFicheroMuerto, cae: NOMBRE, ficheroMuerto: true });
  const vivo = mensajeDeLimpiaSinVerde({ limpia: limpiaDondeNoLlego, cae: NOMBRE, ficheroMuerto: false });
  assert.match(muerto, /murió antes de registrarlo/);
  assert.match(vivo, /el fichero NO está entre los caídos/);
  assert.doesNotMatch(vivo, /murió antes de registrarlo|sin compilar/,
    '🔴 con el fichero vivo se sigue mandando a buscar un `dist/` sin compilar');
});

test('SCRUM-1100d · del nombre sólo se afirma lo que se ha contado en el fuente', () => {
  const dosVeces = mensajeDeLimpiaSinVerde({ limpia: limpiaDondeNoLlego, cae: NOMBRE, vecesEscrito: 2 });
  const unaVez = mensajeDeLimpiaSinVerde({ limpia: limpiaDondeNoLlego, cae: NOMBRE, vecesEscrito: 1 });
  const sinMirar = mensajeDeLimpiaSinVerde({ limpia: limpiaDondeNoLlego, cae: NOMBRE, vecesEscrito: null });
  assert.match(dosVeces, /escrito 2 veces en el fuente del guard[^.]*: NO ha caducado/);
  assert.match(unaVez, /No afirmo cuál/);
  assert.doesNotMatch(unaVez, /NO ha caducado/);
  assert.doesNotMatch(sinMirar, /caduc/, '🔴 sin haber leído el fuente no se dice nada del nombre, ni a favor ni en contra');
});

// El cuarto veredicto, con las dos formas que hasta hoy daban el MISMO texto.
const base = { cae: NOMBRE, saltados: 0, causa: { nombre: 'Error', code: 'ERR_TEST_FAILURE', mensaje: 'test failed' } };
// El caso del log de CI: llegaron los primeros y faltó la cola, con el declarado dentro.
const corrioYNoLlego = { ...base, pasados: 44, caidosConNombre: 0, ausentes: [NOMBRE, 'el que venía detrás'], enLimpia: 53 };
const murioAlCargar = { ...base, pasados: 0, caidosConNombre: 0, ausentes: ['a', 'b', NOMBRE], enLimpia: 53 };

test('SCRUM-1100d · 🔴 EL QUE DECIDE: un fichero que CORRIÓ no recibe el mensaje de uno que murió al cargar', () => {
  const corrio = mensajeDeMuerto(corrioYNoLlego);
  const murio = mensajeDeMuerto(murioAlCargar);
  assert.notEqual(corrio, murio);
  assert.match(corrio, /SÍ llegaron 44 tests con nombre/);
  assert.match(corrio, /faltan 2 de los 53 de la limpia/);
  assert.match(corrio, /El fichero NO murió al cargar/);
  assert.match(corrio, /NO acusa a la mutación/,
    '🔴 con 44 tests llegados, mandar a «acotar la mutación» es mandar a arreglar lo que no está roto');
  assert.doesNotMatch(corrio, /Acota la mutación/);
  assert.match(murio, /no ha llegado NI UN test con nombre/);
  assert.match(murio, /Acota la mutación/, 'aquí sí encaja el radio demasiado ancho, y se sigue diciendo');
});

test('SCRUM-1100d · en los dos casos dice que NO SABE si el test cayó, y enseña lo que el proceso dejó dicho', () => {
  for (const d of [corrioYNoLlego, murioAlCargar]) {
    const m = mensajeDeMuerto(d);
    assert.match(m, /NO SÉ si ese test cayó o si no llegó a correr/);
    assert.match(m, /lo que el proceso dejó dicho: Error · ERR_TEST_FAILURE · test failed/);
    assert.doesNotMatch(m, /nunca llegó a ejecutarse/,
      '🔴 «nunca llegó a ejecutarse» es una afirmación que este instrumento no puede hacer');
  }
  assert.match(mensajeDeMuerto({ ...corrioYNoLlego, causa: null }), /sin error capturado/);
});

test('SCRUM-1100d · una cola larga de ausentes se nombra hasta ocho y se cuenta el resto', () => {
  const muchos = Array.from({ length: 11 }, (_, i) => `ausente ${i + 1}`);
  const m = mensajeDeMuerto({ ...base, pasados: 30, caidosConNombre: 1, ausentes: muchos, enLimpia: 42 });
  assert.match(m, /SÍ llegaron 31 tests con nombre \(30 pasados · 1 caídos · 0 saltados\)/);
  assert.match(m, /«ausente 8», y 3 más/);
  assert.doesNotMatch(m, /«ausente 9»/);
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL CAMINO REAL DE PUERTA 1, y con él que EL VEREDICTO NO SE HA MOVIDO.
//
// `aplicarUna` sale por PUERTA 1 ANTES de escribir nada en el árbol, así que se puede llamar
// aquí con una pasada limpia fabricada: no muta, no corre ningún fichero y no deja marca.
// ═════════════════════════════════════════════════════════════════════════════════════════
test('SCRUM-1100d · 🔴 PUERTA 1 sigue dictando CIEGO sin mutar, y su texto es el de la función', async () => {
  const mut = { fichero: 'package.json', de: 'no-importa', a: 'tampoco', cae: NOMBRE };
  const guard = 'scrum1100d-el-rojo-dice-lo-que-sabe.test.mjs';
  for (const limpia of [limpiaDondeCayo, limpiaDondeNoLlego]) {
    const r = await aplicarUna(mut, guard, { ...limpia, movidos: [] });
    assert.equal(r.ok, false);
    assert.equal(typeof r.ciego, 'string', '🔴 PUERTA 1 ya no sale CIEGA: eso es cambiar el veredicto, y no era el encargo');
    assert.equal(r.mudo, undefined);
    assert.equal(r.muerto, undefined);
    assert.match(r.ciego, /NO aparece EN VERDE en la pasada limpia/);
    assert.match(r.ciego, limpia === limpiaDondeCayo ? /CAYÓ en la pasada limpia/ : /NO LLEGÓ/);
  }
  // Y del nombre: este fichero lo escribe en la constante de arriba, una sola vez.
  const r = await aplicarUna(mut, guard, { ...limpiaDondeNoLlego, movidos: [] });
  assert.match(r.ciego, /No afirmo cuál/, '🔴 el fuente de este guard escribe el nombre una vez: no se puede decir que no ha caducado');
});
