// tests/scrum615-plazo-con-null.test.mjs — SCRUM-615
//
// ¿QUÉ PLAZO APLICA EL SISTEMA HOY, CON `tipoDestinatario` EN NULL?
//
// Este fichero NO cambia el comportamiento: lo FIJA. Es un test de caracterización sobre un
// camino que hoy calcula una fecha con carga legal a partir de un dato que **nadie ha rellenado
// nunca** (15 filas, 15 en NULL). Mientras el fundador decide qué hacer con ese NULL, lo que no
// puede pasar es que el comportamiento actual cambie sin que nadie se entere.
//
// ⚠️ SOLO LEE. No toca el camino de emisión, no escribe en ninguna fila y no propone ningún
// valor por defecto nuevo — poner PARTICULAR o EMPRESARIO a 15 clientes sin saber cuál son es
// escribir un dato fiscal inventado, y está expresamente prohibido en este ticket.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LA RESPUESTA, EN UNA LÍNEA
//
// Aplica un VALOR POR DEFECTO IMPLÍCITO: `PARTICULAR`. No está en la BD (la columna no tiene
// `@default`) ni en el `z.enum`: está en el CÓDIGO, en `resolveTipoDestinatario`, y se aplica en
// cada lectura sin dejar rastro.
//
// Elegir PARTICULAR es el lado prudente y está razonado en el propio código: es el plazo MÁS
// CORTO, así que YaQu nunca le dice a nadie que llega a tiempo cuando ya no llega. Pero tiene una
// consecuencia que sí se ve en pantalla y que este fichero mide: durante 16 días, a un cliente
// que de verdad es EMPRESARIO, YaQu le pinta el semáforo en ROJO —«plazo YA vencido»— sobre un
// plazo legal que NO ha vencido.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { censar, LECTURA } from '../scripts/censo-usos-de-campo.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');

const {
  resolveTipoDestinatario,
  fechaLimiteRecapitulativa,
  calcularSemaforo,
  toIsoDateLocal,
} = await import('../dist/modules/jobs/domain/pendientesFacturar.service.js');

// ── SUELO ────────────────────────────────────────────────────────────────────────────────

test('SCRUM-615 · SUELO: las cuatro piezas del plazo existen y responden', () => {
  // Si alguna llegara `undefined`, todo lo de abajo pasaría en verde comparando `undefined`
  // consigo mismo. Se comprueba antes de afirmar nada.
  for (const [nombre, fn] of Object.entries({
    resolveTipoDestinatario, fechaLimiteRecapitulativa, calcularSemaforo, toIsoDateLocal,
  })) {
    assert.equal(typeof fn, 'function', `🔴 falta \`${nombre}\`: este fichero no mediría nada`);
  }
  // Y que de verdad DISTINGUEN los dos tipos — si dieran lo mismo, no habría nada que medir.
  const p = toIsoDateLocal(fechaLimiteRecapitulativa('2026-03', 'PARTICULAR'));
  const e = toIsoDateLocal(fechaLimiteRecapitulativa('2026-03', 'EMPRESARIO'));
  assert.notEqual(p, e, '🔴 los dos tipos dan la MISMA fecha: el instrumento no distingue');
});

// ── LA RESPUESTA A LA PREGUNTA DEL TICKET ────────────────────────────────────────────────

test('SCRUM-615 · 🔴 con NULL se aplica un VALOR POR DEFECTO IMPLÍCITO: PARTICULAR', () => {
  // Las tres formas del «no consta» caen en el mismo sitio, y ninguna deja rastro en la BD.
  assert.equal(resolveTipoDestinatario({ tipoDestinatario: null }), 'PARTICULAR');
  assert.equal(resolveTipoDestinatario({ tipoDestinatario: undefined }), 'PARTICULAR');
  assert.equal(resolveTipoDestinatario({}), 'PARTICULAR');
  // Y sólo el valor declarado explícitamente escapa del defecto.
  assert.equal(resolveTipoDestinatario({ tipoDestinatario: 'EMPRESARIO' }), 'EMPRESARIO');
});

test('SCRUM-615 · 🔴 un valor DESCONOCIDO también cae en PARTICULAR (y la BD lo permite)', () => {
  // La columna es `text` sin `CHECK`: la lista cerrada vive sólo en Zod, así que un `UPDATE`
  // directo puede meter cualquier cosa. Lo que hace el código con esa cosa es tratarla como
  // PARTICULAR — el lado prudente, pero conviene que esté escrito y fijado.
  assert.equal(resolveTipoDestinatario({ tipoDestinatario: 'empresario' }), 'PARTICULAR');
  assert.equal(resolveTipoDestinatario({ tipoDestinatario: 'AUTONOMO' }), 'PARTICULAR');
  assert.equal(resolveTipoDestinatario({ tipoDestinatario: '' }), 'PARTICULAR');
});

test('SCRUM-615 · el plazo que se ENSEÑA con NULL es 16 días MÁS CORTO que el de un EMPRESARIO', () => {
  const mes = '2026-03';
  const conNull = fechaLimiteRecapitulativa(mes, resolveTipoDestinatario({ tipoDestinatario: null }));
  const siEmpresario = fechaLimiteRecapitulativa(mes, 'EMPRESARIO');

  assert.equal(toIsoDateLocal(conNull), '2026-03-31', 'último día del mes (art. 13.2, particular)');
  assert.equal(toIsoDateLocal(siEmpresario), '2026-04-16', 'día 16 del mes siguiente (art. 13.2, empresario)');

  const dias = Math.round((siEmpresario.getTime() - conNull.getTime()) / 86_400_000);
  assert.equal(dias, 16, `🔴 la distancia entre lo enseñado y lo legal ha cambiado: ${dias} días`);
});

test('SCRUM-615 · 🔴 LA CONSECUENCIA QUE SE VE: 16 días de ROJO sobre un plazo que NO ha vencido', () => {
  // El escenario es el de los 15 clientes de hoy: sin clasificar. Si uno de ellos es de verdad un
  // EMPRESARIO —un administrador de fincas, por ejemplo— YaQu le pinta «plazo YA vencido» durante
  // toda la ventana entre el fin de mes y el día 16 del siguiente.
  const mes = '2026-03';
  const pintada = fechaLimiteRecapitulativa(mes, resolveTipoDestinatario({ tipoDestinatario: null }));
  const legal = fechaLimiteRecapitulativa(mes, 'EMPRESARIO');

  const rojosFalsos = [];
  for (let d = 1; d <= 20; d += 1) {
    const hoy = new Date(2026, 3, d, 12, 0, 0); // abril de 2026
    if (calcularSemaforo(pintada, hoy) === 'rojo' && calcularSemaforo(legal, hoy) !== 'rojo') {
      rojosFalsos.push(toIsoDateLocal(hoy));
    }
  }

  assert.equal(
    rojosFalsos.length, 16,
    `🔴 la ventana de rojo falso ha cambiado de tamaño: ${rojosFalsos.length} días (${rojosFalsos[0]} … ${rojosFalsos[rojosFalsos.length - 1]})`,
  );
  assert.equal(rojosFalsos[0], '2026-04-01');
  assert.equal(rojosFalsos[15], '2026-04-16');
});

test('SCRUM-615 · ✅ CONTROL NEGATIVO: con el cliente DECLARADO no hay ni un rojo falso', () => {
  // La otra mitad, sin la cual lo de arriba no significa nada: el rojo falso lo produce el NULL,
  // no el mecanismo del semáforo. Con el dato declarado, lo pintado y lo legal coinciden siempre.
  const mes = '2026-03';
  const legal = fechaLimiteRecapitulativa(mes, 'EMPRESARIO');
  const declarada = fechaLimiteRecapitulativa(mes, resolveTipoDestinatario({ tipoDestinatario: 'EMPRESARIO' }));
  for (let d = 1; d <= 20; d += 1) {
    const hoy = new Date(2026, 3, d, 12, 0, 0);
    assert.equal(
      calcularSemaforo(declarada, hoy), calcularSemaforo(legal, hoy),
      `🔴 con el tipo DECLARADO el semáforo diverge del legal el ${toIsoDateLocal(hoy)}`,
    );
  }
});

// ── EL TRINQUETE: que no aparezca una segunda copia de la regla en silencio ───────────────

test('SCRUM-615 · SUELO del censo: el instrumento ve, y clasifica lecturas de verdad', () => {
  // Un censo ciego devuelve cero y se lee igual que «nadie lo usa». Se calibra con un campo que
  // se sabe muy usado ANTES de creerse ningún número del campo real.
  const control = censar('providerId', RAIZ);
  assert.ok(
    control.usos.filter((u) => u.clase === LECTURA).length >= 20,
    `🔴 CENSO CIEGO: sólo ${control.usos.length} usos de providerId; el instrumento no está midiendo`,
  );
});

test('SCRUM-615 · 🔴 quién LEE `tipoDestinatario` en producción: la lista está fijada', () => {
  // El trinquete. Hoy hay UN solo sitio en `src/` que hace algo con el valor
  // (`pendientesFacturar.service.ts`); el resto es transporte —el `select` que lo trae y los dos
  // formularios que lo pintan— y tests.
  //
  // Si aparece un lector nuevo, este test cae y obliga a mirarlo: una SEGUNDA copia de la regla
  // «null → PARTICULAR» es exactamente el defecto que `albaranAFactura.ts` ya tiene declarado
  // (ver el informe), y dos copias de una regla fiscal son dos sitios donde divergir.
  const { usos } = censar('tipoDestinatario', RAIZ);
  const ficherosLectoresDeSrc = [...new Set(
    usos.filter((u) => u.clase === LECTURA && u.fichero.startsWith('src/')).map((u) => u.fichero),
  )].sort();

  assert.deepEqual(
    ficherosLectoresDeSrc,
    [
      'src/modules/jobs/domain/pendientesFacturar.service.ts',
      'src/modules/system/customerAdmin.ts', // transporte: el `select` que lo trae a la ficha
    ],
    '🔴 HA CAMBIADO QUIÉN LEE UN CAMPO CON CARGA FISCAL. Míralo antes de actualizar esta lista.',
  );
});

test('SCRUM-615 · 🔴 el censo encuentra LAS DOS GRAFÍAS, incluida la que falló en SCRUM-574', () => {
  // El control positivo del instrumento: tiene que ver `fieldTipoDestinatario` (la variable del
  // formulario) además de `tipoDestinatario`. Buscar el nombre exacto es el error que ya se
  // cometió una vez, y el que dejaría este censo corto sin decirlo.
  const { usos } = censar('tipoDestinatario', RAIZ);
  const grafias = new Set(usos.map((u) => u.grafia).filter(Boolean));
  assert.ok(grafias.has('tipoDestinatario'), '🔴 no ve la grafía del modelo');
  assert.ok(grafias.has('fieldTipoDestinatario'), '🔴 NO VE `fieldTipoDestinatario`: el censo está corto por donde ya falló SCRUM-574');

  // ── Y LOS DOS ESCRITORES SIGUEN AHÍ ────────────────────────────────────────────────────
  //
  // 🔴 SE COMPRUEBA EL FICHERO Y EL CONTENIDO DE LA LÍNEA, NUNCA SU NÚMERO.
  //
  // La primera versión exigía `customersView.js:297` y `customerDetailView.js:365` literales, y
  // el CI la tumbó el 24-ago-2026. NO porque el escritor se hubiera ido: sigue ahí, con la misma
  // grafía y sin tocarse desde `aba49043` (SCRUM-69). Lo que pasó es que al mergearse SCRUM-574
  // (`b47e8341`, el switch Empresa/Persona) entraron líneas ENCIMA y el escritor bajó a la 328.
  //
  // Un número de línea no era parte de lo que costaba mirar —lo difícil era ver la grafía
  // `fieldTipoDestinatario`— así que era precisión sin cobertura: sólo fragilidad. Esto NO es
  // relajar el guard: comprobar que la línea encontrada ES la asignación del campo es MÁS fuerte
  // que comprobar en qué renglón cae, porque un número casa por accidente y el contenido no.
  const escritores = usos.filter((u) => u.fichero.startsWith('public/') && u.clase !== LECTURA);
  for (const fichero of [
    'public/dashboard/js/customersView.js',
    'public/dashboard/js/customerDetailView.js',
  ]) {
    const deEsteFichero = escritores.filter((u) => u.fichero === fichero);
    assert.ok(
      deEsteFichero.length > 0,
      `🔴 el censo ya no ve NINGÚN escritor en ${fichero}: o se ha ido, o el censo se quedó ciego`,
    );
    // Y que lo que ve es la asignación de verdad, no otro uso que pase por allí.
    assert.ok(
      deEsteFichero.some((u) => /tipoDestinatario\s*:/.test(u.texto)),
      `🔴 en ${fichero} hay usos, pero ninguno es la asignación \`tipoDestinatario:\` — ha cambiado de forma:\n   ${deEsteFichero.map((u) => u.texto).join('\n   ')}`,
    );
  }
});

test('SCRUM-615 · 🔴 SUELO del guard anterior: sabría ver que un escritor SE VA', () => {
  // Sin esto, el test de arriba podría pasar en verde con el censo ciego — que es justo el modo
  // de fallo que la versión anclada a la línea NO distinguía: «no está en la 297» y «no está» se
  // leían igual. Se le da un censo VACÍO y se exige que el criterio lo note.
  const vacio = [];
  const deEsteFichero = vacio.filter((u) => u.fichero === 'public/dashboard/js/customersView.js');
  assert.equal(deEsteFichero.length, 0, '🔴 el criterio no distingue un censo vacío');

  // Y al revés: un uso que NO es la asignación no debe colar como escritor.
  const falso = [{ fichero: 'public/dashboard/js/customersView.js', texto: 'const x = c.tipoDestinatario;' }];
  assert.ok(
    !falso.some((u) => /tipoDestinatario\s*:/.test(u.texto)),
    '🔴 una LECTURA está colando como asignación: el criterio no distingue',
  );
});
