// tests/scrum750-los-dos-calendarios.test.mjs — SCRUM-750
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// UN CAMPO, UN CALENDARIO.
//
// El campo «Válido hasta» del presupuesto tenía DOS escritores y cada uno usaba un calendario:
//
//   · el valor por defecto y el `min` los pone `quoteCaducidad.diaPorDefecto` (SCRUM-633), en la
//     zona del MERCHANT;
//   · los tres atajos los ponía `quoteAtajosVencimiento.fechaDeAtajo` (SCRUM-605), que calculaba
//     con componentes LOCALES — o sea, en la zona del NAVEGADOR.
//
// Medido el 5-sep-2026 sobre 17.520 instantes de 2026, merchant en `Europe/Madrid`, atajo de +30
// contra valor por defecto de +30:
//
//     navegador en Europe/Madrid       120 divergen   ( 0,7 %)   ← ni estando en su sitio cuadraba
//     navegador en Europe/London       730            ( 4,2 %)
//     navegador en UTC               1.150            ( 6,6 %)
//     navegador en America/New_York  4.324            (24,7 %)
//     navegador en Pacific/Auckland  7.990            (45,6 %)
//
// El arreglo NO es «que el atajo calcule mejor»: es que **deje de haber dos aritméticas**.
// `fechaDeAtajo` ahora llama a `diaPorDefecto`. Este fichero comprueba las dos mitades de eso:
// que el comportamiento cuadra (barrido en otra zona horaria, en procesos hijos) y que la
// derivación no puede deshacerse sin que salte algo (guard estructural sobre el cuerpo).
//
// ── 🔴 POR QUÉ HAY PROCESOS HIJOS ────────────────────────────────────────────────────────
// La zona del navegador entra por `Date`, y `Date` fija su zona al arrancar el proceso: para
// probar «el empleado con el navegador en Auckland» hay que ARRANCAR en Auckland. Lo hace
// `tests/_sonda-calendarios.mjs`, que además lleva su propio control de ceguera — en esta máquina
// `TZ=X node …` NO llega a `process.env.TZ` y devuelve la zona del sistema con otra etiqueta.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
// 🔴 EL LECTOR DE MUTACIONES ES EL OFICIAL (SCRUM-745), no una copia. Si esta declaración tuviera
// la forma equivocada, `npm run meta:mutaciones` no la vería y nadie se enteraría.
import { mutacionesDeclaradas } from '../scripts/meta-guard-mutaciones.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');
const MODULO = 'public/dashboard/js/quoteAtajosVencimiento.js';
const VISTA = 'public/dashboard/js/quotesView.js';

// (las mutaciones declaradas van al final del fichero, en el formato de SCRUM-745)

// ── la sonda, memorizada: cada arranque cuesta ~1,9 s y varios tests miran lo mismo ────────
const cache = new Map();
function sonda(navegador, merchant = 'Europe/Madrid', modo = 'derivado') {
  const clave = `${navegador}|${merchant}|${modo}`;
  if (!cache.has(clave)) {
    const r = spawnSync(process.execPath,
      [path.join(RAIZ, 'tests', '_sonda-calendarios.mjs'), navegador, merchant, modo],
      { encoding: 'utf8' });
    assert.equal(r.status, 0,
      `🔴 CIEGO: la sonda ${clave} salió con ${r.status}. stdout: ${r.stdout} stderr: ${r.stderr}`);
    const j = JSON.parse(r.stdout.trim().split('\n').pop());
    assert.ok(!j.ciego, `🔴 CIEGO: la sonda ${clave} dice «${j.ciego}»`);
    cache.set(clave, j);
  }
  return cache.get(clave);
}

// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 SUELO · antes de creerse ningún cero
// ═════════════════════════════════════════════════════════════════════════════════════════
test('SCRUM-750 · 🔴 SUELO: el barrido mira algo, y contiene LOS DOS cambios de hora', () => {
  const s = sonda('Pacific/Auckland');

  assert.ok(s.muestras >= 2000,
    `🔴 el barrido sólo tiene ${s.muestras} instantes: un cero sobre una población así no dice nada.`);
  assert.deepEqual(s.atajos, [7, 14, 30],
    '🔴 la lista de atajos que recorre la sonda no es la del módulo: estaría midiendo otra cosa.');

  // 🔴 Los dos cambios de hora de 2026 en `Europe/Madrid` se CUENTAN observando el desplazamiento
  // de la zona instante a instante, no se dan por supuestos por la fecha: es donde la aritmética
  // de 24 h fijas y la de días de calendario se separan, así que un barrido que no los contenga
  // devolvería cero por no haber mirado.
  assert.equal(s.cambiosDeHora, 2,
    `🔴 el barrido ve ${s.cambiosDeHora} cambios de hora y en 2026 hay 2. Sin ellos dentro, este `
    + 'fichero entero mide la franja fácil y publica un cero que no vale.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL QUE DECIDE
// ═════════════════════════════════════════════════════════════════════════════════════════
test('SCRUM-750 · 🔴 EL QUE DECIDE: navegador en Auckland, negocio en Madrid, MISMO día', () => {
  const s = sonda('Pacific/Auckland', 'Europe/Madrid');
  assert.deepEqual(s.divergencias, { 7: 0, 14: 0, 30: 0 },
    `🔴 EL ATAJO Y EL VALOR POR DEFECTO VUELVEN A DAR DÍAS DISTINTOS.\n`
    + `     navegador: ${s.navegador} · negocio: ${s.merchant}\n`
    + `     ejemplo:   ${JSON.stringify(s.ejemplo)}\n`
    + '  El profesional pulsa «30 días» y el campo se queda con un día distinto del que ese mismo '
    + 'campo propuso al abrirse, en un documento que el cliente recibe.');
});

test('SCRUM-750 · el mismo día TAMBIÉN con el navegador en su sitio y en América', () => {
  // No sólo el caso extremo: `Europe/Madrid` es el 99 % de los profesionales y ANTES tampoco
  // cuadraba —120 de 17.520 por la aritmética, no por la zona—, así que si sólo se mirase Auckland
  // se estaría dando por arreglado lo que más se usa sin haberlo medido.
  for (const navegador of ['Europe/Madrid', 'America/New_York']) {
    const s = sonda(navegador, 'Europe/Madrid');
    assert.deepEqual(s.divergencias, { 7: 0, 14: 0, 30: 0 },
      `🔴 con el navegador en ${navegador} divergen: ${JSON.stringify(s.ejemplo)}`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ✅ CONTROL POSITIVO · el barrido SABE ponerse rojo
// ═════════════════════════════════════════════════════════════════════════════════════════
test('SCRUM-750 · ✅ CONTROL POSITIVO: con la aritmética VIEJA reinyectada, el barrido cae', () => {
  // Un cero que no se ha visto ponerse en rojo es una decoración. La sonda vuelve a meter, palabra
  // por palabra, el cálculo por componentes locales que había antes del 5-sep — el defecto de
  // verdad, no uno inventado — y tiene que verlo.
  const s = sonda('Pacific/Auckland', 'Europe/Madrid', 'mutado');

  for (const dias of s.atajos) {
    assert.ok(s.divergencias[dias] > 0,
      `🔴 con la aritmética vieja puesta, el atajo de ${dias} días NO diverge ni una vez. El `
      + 'barrido no mide: su cero del test de arriba no vale nada.');
  }

  // Y la divergencia es EXACTAMENTE de un día, que es la avería que se describió — no un desastre
  // cualquiera que también saldría rojo.
  const { atajo, defecto } = s.ejemplo;
  const dif = Math.round((new Date(defecto + 'T00:00:00Z') - new Date(atajo + 'T00:00:00Z')) / 86400000);
  assert.equal(Math.abs(dif), 1,
    `🔴 la divergencia inyectada es de ${dif} días (${atajo} vs ${defecto}) y se esperaba 1: el `
    + 'control positivo está probando otra cosa que la que este ticket arregla.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// LA DERIVACIÓN · que no pueda deshacerse en silencio
// ═════════════════════════════════════════════════════════════════════════════════════════
test('SCRUM-750 · 🔴 `fechaDeAtajo` DELEGA y no recalcula — el cuerpo, no el fichero', () => {
  // Se mira el CUERPO de la función y no el fichero entero: la cabecera cita la aritmética vieja
  // para explicar por qué se fue, y un `grep` sobre el fichero se cazaría a sí mismo en esa
  // explicación — la avería de guard de texto que esta casa lleva una semana cazando.
  const fuente = leer(MODULO);
  const cuerpo = fuente.slice(fuente.indexOf('function fechaDeAtajo'),
    fuente.indexOf('function rotuloDeAtajo'));
  assert.ok(cuerpo.length > 200, '🔴 SUELO: no he aislado el cuerpo de `fechaDeAtajo`.');

  assert.ok(cuerpo.includes('diaPorDefecto'),
    '🔴 `fechaDeAtajo` ya no llama a `diaPorDefecto`. Si vuelve a calcular por su cuenta, vuelve a '
    + 'haber dos aritméticas para el mismo campo y una se quedará atrás — otra vez.');

  for (const propio of ['getFullYear', 'getMonth', 'getDate', '86400000']) {
    assert.equal(cuerpo.includes(propio), false,
      `🔴 el cuerpo de \`fechaDeAtajo\` vuelve a usar \`${propio}\`: eso es aritmética de fechas `
      + 'propia, y `getFullYear`/`getMonth`/`getDate` además leen la zona del DISPOSITIVO, que es '
      + 'exactamente el defecto que cerró SCRUM-750.');
  }
});

test('SCRUM-750 · 🔴 FAIL-CLOSED: sin la pieza de calendario NO se inventa una fecha', () => {
  // El módulo depende de que `quoteCaducidad.js` se haya cargado antes. Si alguien mueve esa línea
  // del índice, la salida correcta es «no escribo nada» y no «calculo como pueda»: el campo se
  // queda con el valor por defecto, que sí es correcto.
  const soloAtajos = {};
  new Function('window', leer(MODULO))(soloAtajos);
  const sinCalendario = soloAtajos.QUOTE_ATAJOS_VENCIMIENTO;
  assert.ok(sinCalendario, '🔴 SUELO: el módulo no ha publicado nada.');
  assert.equal(sinCalendario.fechaDeAtajo(30, null, new Date('2026-01-31T12:00:00Z')), null,
    '🔴 sin `quoteCaducidad` cargado el atajo ha devuelto una fecha. La ha calculado ÉL, que es lo '
    + 'que este ticket vino a impedir.');

  // CONTROL POSITIVO: con la pieza cargada, la misma llamada SÍ da fecha. Sin esto, una función
  // que devolviera `null` siempre pasaría el aserto de arriba.
  const conCalendario = {};
  new Function('window', leer('public/dashboard/js/quoteCaducidad.js'))(conCalendario);
  new Function('window', leer(MODULO))(conCalendario);
  assert.equal(
    conCalendario.QUOTE_ATAJOS_VENCIMIENTO.fechaDeAtajo(30, null, new Date('2026-01-31T12:00:00Z')),
    '2026-03-02',
    '🔴 con el calendario cargado tampoco calcula: el `null` de arriba no prueba nada.');
});

test('SCRUM-750 · 🔴 la VISTA le pasa el merchant al atajo — es donde se perdía la zona', () => {
  const vista = leer(VISTA);
  assert.equal(vista.split('atajosVenc.fechaDeAtajo(dias, currentMerchant)').length - 1, 1,
    '🔴 el manejador del clic ya no le pasa `currentMerchant` a `fechaDeAtajo`. Sin merchant la '
    + 'zona cae a UTC y el atajo vuelve a escribir el día de OTRO calendario, en silencio y con '
    + 'aspecto de fecha correcta.');
  assert.equal(/fechaDeAtajo\(dias\)/.test(vista), false,
    '🔴 ha vuelto la llamada con la firma vieja `fechaDeAtajo(dias)`.');

  // El eslabón que de verdad se pierde: que el índice cargue el calendario ANTES.
  const indice = leer('public/dashboard/index.html');
  assert.ok(indice.indexOf('quoteCaducidad.js') < indice.indexOf('quoteAtajosVencimiento.js'),
    '🔴 `quoteCaducidad.js` ya no se carga antes que `quoteAtajosVencimiento.js`. No rompe la '
    + 'pantalla —el atajo devuelve `null` y no escribe—, pero los tres botones dejan de hacer nada.');
});

test('SCRUM-750 · mis mutaciones las LEE el lector oficial, y apuntan a tests que existen', () => {
  // 🔴 SE PREGUNTA AL LECTOR DE VERDAD, no a una comprobación propia. Una declaración con la forma
  // equivocada no da error: es INVISIBLE para `npm run meta:mutaciones`, que es justo el trinquete
  // que existe para ejecutarla. Es la misma avería que el marcador `[copy: fundador]` del 605, que
  // el censo no contaba porque buscaba `[PENDIENTE`.
  const propio = leer('tests/scrum750-los-dos-calendarios.test.mjs');
  const leidas = mutacionesDeclaradas(propio, 'scrum750-los-dos-calendarios.test.mjs');

  assert.ok(leidas.length >= 3,
    `🔴 el lector oficial sólo ve ${leidas.length} mutaciones declaradas en este fichero. Con la `
    + 'forma equivocada no salta nada: simplemente no se ejecutan.');

  for (const m of leidas) {
    // El fichero que dice mutar tiene que existir, y el texto `de` tiene que estar DENTRO de él:
    // una mutación cuyo `de` no aparece no se aplica, y el meta-guard la daría por no medible.
    const fuente = leer(m.fichero);
    assert.ok(fuente.includes(m.de),
      `🔴 la mutación de \`${m.fichero}\` busca un texto que ya no está:\n     ${m.de}\n`
      + '  Una mutación que no se puede aplicar es una promesa, no cobertura.');
    assert.ok(propio.includes(m.cae),
      `🔴 dice que cae «${m.cae}» y no hay ningún test con ese nombre en este fichero.`);
    assert.notEqual(m.de, m.a, '🔴 una mutación que no cambia nada no puede tumbar a nadie.');
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// SCRUM-745 · LAS MUTACIONES QUE TIENEN QUE TUMBAR A ESTE GUARD, DECLARADAS
//
// En el formato que lee `scripts/meta-guard-mutaciones.mjs` por AST, para que
// `npm run meta:mutaciones` las EJECUTE sin que nadie tenga que acordarse. Las tres se probaron
// el 5-sep-2026 y las tres cayeron.
//
// ⚠️ LO QUE NO DECLARO, Y POR QUÉ: no hay mutación que tumbe el aserto de los DOS cambios de hora
// (`cambiosDeHora === 2`). Está garantizado por DOS partes independientes del barrido —el peine de
// 6 h sobre el año entero y las dos ventanas densas—, así que cualquier mutación que se lo cargue
// se lleva antes por delante el aserto del número de muestras. Declarar una que no cae sería peor
// que no declararla: parecería cobertura.
// ═════════════════════════════════════════════════════════════════════════════════════════
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // El defecto ENTERO, tal cual estaba antes del ticket: la aritmética local de vuelta.
    fichero: 'public/dashboard/js/quoteAtajosVencimiento.js',
    de: 'return cal.diaPorDefecto(merchant, dias, hoy instanceof Date ? hoy : undefined);',
    a: "var base = (hoy instanceof Date && !isNaN(hoy.getTime())) ? hoy : new Date();\n    var d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + dias);\n    var dc = function (n) { return (n < 10 ? '0' : '') + n; };\n    return d.getFullYear() + '-' + dc(d.getMonth() + 1) + '-' + dc(d.getDate());",
    cae: 'EL QUE DECIDE: navegador en Auckland',
  },
  {
    // Sólo el eslabón: el módulo deriva bien, pero la vista deja de pasarle el merchant y la zona
    // vuelve a caer a UTC. Es el fallo más fácil de cometer y el que menos se nota.
    fichero: 'public/dashboard/js/quotesView.js',
    de: 'atajosVenc.fechaDeAtajo(dias, currentMerchant)',
    a: 'atajosVenc.fechaDeAtajo(dias)',
    cae: 'la VISTA le pasa el merchant al atajo',
  },
  {
    // El fail-closed: sin la pieza de calendario, inventarse una fecha en vez de callarse.
    fichero: 'public/dashboard/js/quoteAtajosVencimiento.js',
    de: '    if (!cal) return null;                        // sin la pieza del calendario no se inventa nada',
    a: "    if (!cal) return '2026-01-01';",
    cae: 'FAIL-CLOSED: sin la pieza de calendario',
  },
  {
    // Deriva SIN cambiar el comportamiento: una lectura de componentes del DISPOSITIVO que no hace
    // nada hoy pero reabre la puerta. Ninguna prueba de comportamiento la ve; el guard estructural
    // existe exactamente para esto.
    fichero: 'public/dashboard/js/quoteAtajosVencimiento.js',
    de: '    if (merchant instanceof Date) return null;',
    a: '    if (merchant instanceof Date) return null;\n    var ignorado = (hoy instanceof Date) ? hoy.getFullYear() : 0; void ignorado;',
    cae: 'DELEGA y no recalcula',
  },
];
