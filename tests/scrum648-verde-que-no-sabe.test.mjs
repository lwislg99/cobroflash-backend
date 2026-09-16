// tests/scrum648-verde-que-no-sabe.test.mjs — SCRUM-648
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// «AL DÍA» CUANDO EL SISTEMA NO HA PODIDO SABERLO
//
// `calcularSemaforo` con un límite ilegible da `NaN`, las dos comparaciones son falsas y sale
// **verde**. Verde se le pinta al profesional como **«AL DÍA»**, y lo que ha ocurrido es que el
// sistema no ha podido calcularlo. Es el defecto nº1 de la casa en el sitio más caro: el aviso
// del plazo del art. 13.2.
//
// ⛔ AQUÍ NO SE ARREGLA, Y NO ES PEREZA: no hay un cuarto estado. Verde miente, rojo miente
// («plazo vencido» tampoco es cierto) y ámbar ya significa «se acerca el plazo». Elegir uno de
// los tres, o crear un cuarto, es **decisión del fundador** (regla 27) y su rótulo es **microcopy**
// (regla 30). Este fichero MIDE y deja la medición atada. La propuesta está en
// `docs/master/SCRUM-648.md`.
//
// ── QUÉ NO REPITE, para no duplicar a SCRUM-622 ──────────────────────────────────────────
// SCRUM-622 ya ató: que el tipo `Semaforo` es un union cerrado de tres, que `calcularSemaforo`
// barrido no devuelve nada fuera de esos tres, que el service worker no cachea `/admin/`, que el
// `fetch` de la bandeja lanza si la respuesta no es buena, y **la caracterización** de que un
// `Date` donde se espera un día sale verde. **Nada de eso se vuelve a comprobar aquí.**
//
// Lo que este fichero añade es la pregunta que faltaba: **¿ALGÚN CAMINO REAL alimenta a
// `calcularSemaforo` con un límite ilegible?** 622 vigiló la salida de la función; esto vigila
// su entrada.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { calcularSemaforo, fechaLimiteRecapitulativa } from '../dist/modules/jobs/domain/pendientesFacturar.service.js';
import { diaNaturalEn, diasEntre } from '../dist/core/zonaDelMerchant.js';

const RAIZ = path.resolve(import.meta.dirname, '..');
const HOY = new Date('2026-09-04T10:00:00Z');
const MADRID = 'Europe/Madrid';

/** Entradas degeneradas al ÚNICO productor del límite. */
const MESKEYS_DEGENERADAS = [
  '', 'basura', '2026', '2026-', '-09', '2026-13', '2026-00', '2026-1', 'YYYY-MM',
  '2026-09-04', '0000-00', '99999-99', 'null', 'undefined', '2026/09', '  ', '2026-ab',
];

// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 CONTROL POSITIVO PRIMERO — antes de creerse ningún cero
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-648 · ✅ los límites ilegibles ya NO salen verde — decisión C, ejecutada en la fase B', () => {
  // ── ESTE ERA EL CONTROL POSITIVO DE LA FASE A, Y CAYÓ AL EJECUTARSE LA DECISIÓN ──────────
  //
  // Afirmaba que los siete ilegibles salían VERDE, y era cierto: ése era el defecto, y hacía falta
  // demostrarlo forzándolo para que el cero de la medición de abajo significara «no hay camino» y
  // no «no supe mirar».
  //
  // La fase B lo cerró con la decisión C del fundador: **ámbar**, con el motivo al lado. Se
  // convierte en la afirmación del arreglo en vez de borrarse, así queda constancia de qué había.
  const ILEGIBLES = ['', 'no soy una fecha', new Date('2026-03-31'), null, undefined, 20260331, '31-03-2026'];
  const noAmbar = ILEGIBLES.filter((v) => calcularSemaforo(v, HOY, MADRID) !== 'ambar');

  assert.deepEqual(noAmbar.map(String), [],
    '🔴 un límite ilegible ha dejado de salir ÁMBAR. Si sale VERDE, se ha deshecho la decisión C ' +
    'y «no lo sé» vuelve a pintarse «AL DÍA» sobre el plazo del art. 13.2.');

  // El contraste que lo hace significativo: los tres estados se siguen alcanzando con plazos
  // legibles, así que el ámbar de arriba no viene de haber roto el cálculo.
  assert.equal(calcularSemaforo('2026-09-03', HOY, MADRID), 'rojo');
  assert.equal(calcularSemaforo('2026-09-09', HOY, MADRID), 'ambar');
  assert.equal(calcularSemaforo('2026-09-10', HOY, MADRID), 'verde');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// LA MEDICIÓN: ¿alimenta algún camino REAL a la función con basura?
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-648 · el ÚNICO productor del límite no entrega hoy ni un día ilegible', () => {
  const ilegibles = [];
  for (const mesKey of MESKEYS_DEGENERADAS) {
    for (const tipo of ['PARTICULAR', 'EMPRESARIO']) {
      let limite;
      try {
        limite = fechaLimiteRecapitulativa(mesKey, tipo);
      } catch {
        continue; // lanza = camino CERRADO: falla ruidosamente, que es lo correcto
      }
      if (!Number.isFinite(diasEntre(diaNaturalEn(HOY, MADRID), limite))) {
        ilegibles.push(`${JSON.stringify(mesKey)} · ${tipo} → ${limite}`);
      }
    }
  }

  assert.deepEqual(ilegibles, [],
    '🔴 UN CAMINO REAL YA ENTREGA UN LÍMITE ILEGIBLE, y eso sale «AL DÍA» al profesional.\n' +
    'Deja de ser un defecto latente y pasa a ser alcanzable: SCRUM-648 sube de prioridad.\n     ' +
    ilegibles.join('\n     '));

  // SUELO del barrido: si no se probó nada, el `[]` de arriba no significa nada.
  assert.ok(MESKEYS_DEGENERADAS.length >= 15,
    `🔴 sólo ${MESKEYS_DEGENERADAS.length} entradas degeneradas: el barrido no aprieta.`);
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 EL HALLAZGO, y es PEOR que el defecto del ticket
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-648 · ✅ un mes fuera de rango ya NO se normaliza en silencio — lo cerró SCRUM-747', () => {
  // ── ESTE TEST CARACTERIZABA UN DEFECTO Y CAYÓ AL ARREGLARSE. Es lo que prometía ──────────
  //
  // Decía: «`fechaLimiteRecapitulativa` no valida su entrada, así que el mes 13 de 2026 se
  // convierte en enero de 2027 sin protestar, y el semáforo lo pinta verde». Era cierto, y era
  // **peor que un valor ilegible**: contra un ilegible se puede programar una barrera porque es
  // detectable; contra un plazo plausible no hay síntoma.
  //
  // SCRUM-747 lo cerró validando ANTES de normalizar, y esta caracterización se convierte en la
  // afirmación del arreglo — no se borra: así queda constancia de qué se arregló y desde cuándo.
  assert.throws(() => fechaLimiteRecapitulativa('2026-13', 'PARTICULAR'), /mesKey inválido/,
    '🔴 ha vuelto la normalización silenciosa: `2026-13` debe FALLAR, no dar el plazo de enero.');
  assert.throws(() => fechaLimiteRecapitulativa('2026-00', 'PARTICULAR'), /mesKey inválido/);

  // Y el error NOMBRA el valor, que es lo que permite arreglar el origen en vez de taparlo.
  try {
    fechaLimiteRecapitulativa('2026-13', 'PARTICULAR');
    assert.fail('debería haber lanzado');
  } catch (e) {
    assert.ok(e.message.includes('"2026-13"'), '🔴 el error ya no dice QUÉ valor entró.');
  }

  // CONTROL NEGATIVO: los meses legítimos siguen dando exactamente lo de siempre.
  assert.equal(fechaLimiteRecapitulativa('2026-09', 'PARTICULAR'), '2026-09-30');
  assert.equal(fechaLimiteRecapitulativa('2026-12', 'EMPRESARIO'), '2027-01-16');
  assert.equal(calcularSemaforo(fechaLimiteRecapitulativa('2026-09', 'PARTICULAR'), HOY, MADRID), 'verde');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// EL COSTE ASIMÉTRICO, ATADO EN LA CAPA QUE NADIE MIRÓ
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-648 · 🔴 el navegador pinta «AL DÍA» lo que no reconoce — y eso BLOQUEA el arreglo', () => {
  const vista = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/invoicesView.js'), 'utf8');

  // El rótulo que ve el profesional cuando el semáforo es verde.
  assert.match(vista, /verde:\s*\{[^}]*label:\s*'AL DÍA'/,
    '🔴 ha cambiado el rótulo de `verde`. Este fichero mide el COSTE de equivocarse, y el coste ' +
    'es exactamente lo que la pastilla dice.');

  // Y el repliegue: cualquier estado que el navegador no conozca se pinta con el de `verde`.
  assert.match(vista, /SEMAFORO_META\[grupo\.semaforo\]\s*\|\|\s*SEMAFORO_META\.verde/,
    '✅ el repliegue a `verde` del navegador ha cambiado. Si ahora repliega a otra cosa, alguien ' +
    'ha decidido qué se enseña cuando no se sabe: bien, pero SCRUM-648 hay que revisarlo entero.');

  // 🔴 LA CONSECUENCIA, que es la razón de que este test exista: el defecto está en DOS capas, y
  // la del navegador es la que MANDA. El día que el fundador cree un cuarto estado y el servidor
  // lo emita, este `||` lo pintaría «AL DÍA» — el mismo defecto, con más trabajo hecho. El arreglo
  // del navegador va ANTES o A LA VEZ que el del servidor, nunca después.
  const meta = /const SEMAFORO_META = \{([\s\S]*?)\};/.exec(vista);
  assert.ok(meta, '🔴 no encuentro `SEMAFORO_META`: si se renombró, este control dejó de mirar.');
  const estados = [...meta[1].matchAll(/^\s*(\w+):/gm)].map((m) => m[1]).sort();
  assert.deepEqual(estados, ['ambar', 'rojo', 'verde'],
    '✅ el navegador ya conoce otro estado además de los tres. Si el fundador aprobó un cuarto, ' +
    'actualiza este censo y comprueba que el repliegue de arriba ya NO manda a «AL DÍA».');
});
