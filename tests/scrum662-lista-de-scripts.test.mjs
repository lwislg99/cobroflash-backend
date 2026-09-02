// SCRUM-662 · EL INVARIANTE DE LOS SCRIPTS DEL DASHBOARD NO ES LA CUENTA: ES LA LISTA.
//
// Sin gate: lee el índice y funciones puras. Ni BD, ni red, ni navegador.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL FALLO QUE MATA ESTE TICKET, Y HABÍA PASADO CUATRO VECES
//
// `SCRIPTS_DEL_DASHBOARD` era un NÚMERO, y chocó seis veces. La séptima fue distinta:
//
//     lado de la rama .... 69   (68 + quoteApartados.js)
//     lado de main ....... 69   (68 + tiposDeIva.js)
//
// **Los dos lados escribieron el mismo número por scripts DISTINTOS.** Un merge textual no ve
// ahí ningún conflicto: `= 69` contra `= 69` es la misma línea. Lo ÚNICO que hizo visible el
// choque fue que el comentario de al lado llevaba meses engordando y también chocó — un
// comentario haciendo de mecanismo por accidente. Sin esa casualidad, el árbol mezclado habría
// quedado con 70 scripts declarando 69, y los dos guards que dependen de ese número habrían
// seguido en verde con un fichero fuera de su vigilancia.
//
// Una CUENTA no distingue «tu script» de «mi script». Una LISTA sí: dos ramas que añaden cosas
// distintas producen listas distintas, y entonces o git las funde y quedan las dos —correcto— o
// chocan donde se ve. Lo que no puede pasar es que «coincidan» por accidente.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// POR QUÉ LISTA Y NO SECUENCIA, decidido y no heredado
//
// Hoy convivían TRES afirmaciones distintas sobre la misma población: se DECLARABA la cuenta, se
// COMPROBABA la pertenencia (SCRUM-274 usa `new Set`) y el MENSAJE DE ERROR hablaba del orden.
// El invariante elegido es la LISTA, con las DEPENDENCIAS declaradas aparte:
//
//   · lo que rompe el producto no es «el orden» en abstracto: son dependencias concretas —un
//     consumidor cargado antes que su pieza—, y ésas se declaran con su motivo y se comprueban;
//   · exigir las 69 posiciones prometería un orden que nadie mantiene: `public/sw.js` lleva su
//     lista en otra secuencia desde antes de este ticket, y su guard pasa porque compara
//     conjuntos. Un invariante que el repositorio ya incumple nace muerto.
//
// ⚠️ Y por eso este mismo ticket QUITA la frase «en el mismo orden que el HTML» del mensaje de
// error de SCRUM-274: ese guard no comprueba el orden. Una frase que miente dentro de un error
// es peor que ninguna — la lee quien está depurando a las once de la noche.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SCRIPTS_DEL_DASHBOARD, DEPENDENCIAS_DE_CARGA, scriptsDelDashboard,
  contrastarScripts, dependenciasRotas, nombreDeScript,
} from './_banco-vistas.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// ═════════════════════════════════════════════════════════════════════════════════════════
// § 1 · 🔴 EL CASO QUE MOTIVA EL TICKET: DOS RAMAS, EL MISMO NÚMERO, SCRIPTS DISTINTOS
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-662 · 🔴 la CUENTA no distingue dos ramas; la LISTA sí', () => {
  const base = ['api.js', 'app.js', 'homeView.js'];
  // Cada rama añade UN script, distinto. Las dos escribirían «4».
  const ramaA = [...base, 'quoteApartados.js'];
  const ramaB = [...base, 'tiposDeIva.js'];

  // ── Lo que pasaba con una cuenta: los dos lados dicen lo mismo, y el merge no ve conflicto.
  assert.equal(ramaA.length, ramaB.length,
    '🔴 el vector no reproduce el caso: las dos ramas tienen que escribir el MISMO número, que es '
    + 'lo que hacía el choque invisible.');

  // ── Y lo que pasa con una lista: son distintas, así que el choque es visible SIEMPRE.
  assert.notDeepEqual(ramaA, ramaB,
    '🔴 las dos listas han salido iguales: entonces la lista tampoco distinguiría las dos ramas y '
    + 'el arreglo de este ticket no arregla nada.');

  // ── EL ÁRBOL MEZCLADO, que es donde estaba el daño. Git funde los dos scripts en el índice
  //    (70) pero la declaración solo se queda con la de un lado si nadie mira: con la CUENTA eso
  //    pasa en verde; con la LISTA, cae y NOMBRA el que falta.
  const indiceMezclado = [...base, 'quoteApartados.js', 'tiposDeIva.js'];
  const declaradoDeUnSoloLado = ramaA;

  const porCuenta = indiceMezclado.length === declaradoDeUnSoloLado.length;
  assert.equal(porCuenta, false,
    '🔴 el contraste por CUENTA seguiría dando verde aquí. (Si esto falla, es que el vector ya no '
    + 'reproduce el caso: el índice mezclado tiene que tener un script MÁS que lo declarado.)');

  const declarados = new Set(declaradoDeUnSoloLado);
  const faltaEnLaDeclaracion = indiceMezclado.filter((n) => !declarados.has(n));
  assert.deepEqual(faltaEnLaDeclaracion, ['tiposDeIva.js'],
    '🔴 LA LISTA NO HA CAZADO EL SCRIPT QUE SE COLÓ EN EL MERGE. Es el fallo entero del ticket: '
    + 'el índice carga un script que nadie declaró, y los guards que se apoyan en esta población '
    + 'seguirían diciendo «todo vigilado».');
});

test('SCRUM-662 · 🔴 EL CASO QUE SE ESCAPABA: mismo TAMAÑO, contenido distinto', () => {
  // ⚠️ ESTE TEST NACIÓ DE UN ROJO QUE NO CAYÓ. El de arriba razona sobre arrays a mano, así que
  // demuestra la IDEA pero no toca `contrastarScripts`; y los de §2 cambian el tamaño, con lo que
  // un mecanismo que solo mirase la cuenta seguiría cazándolos. Al reinyectar el mecanismo viejo
  // —contrastar por longitud— la suite entera se quedó EN VERDE: ocho de ocho.
  //
  // O sea que el arreglo no estaba cubierto por su propio test justo en el caso que motiva el
  // ticket. Éste es ese caso, y contra la función de verdad: una lista del MISMO tamaño con un
  // script cambiado por otro.
  const real = scriptsDelDashboard(RAIZ).map(nombreDeScript);
  const mezclado = [...real.filter((n) => n !== 'api.js'), 'tiposDeIva.js'];

  assert.equal(mezclado.length, real.length,
    '🔴 el vector no reproduce el caso: los dos lados tienen que tener el MISMO tamaño.');

  const c = contrastarScripts(mezclado);
  assert.deepEqual(c.sobran, ['tiposDeIva.js'],
    '🔴 UN SCRIPT NO DECLARADO SE HA COLADO SIN QUE NADIE LO VEA, porque el total cuadraba.\n'
    + '  Es el fallo entero de SCRUM-662: dos ramas escribieron `= 69` por scripts distintos y el\n'
    + '  merge no vio conflicto. Si esto pasa en verde, el mecanismo ha vuelto a mirar la CUENTA.');
  assert.deepEqual(c.faltan, ['api.js'],
    '🔴 y el que DESAPARECIÓ del índice tampoco se nombra: con el total cuadrando, ese fichero\n'
    + '  queda fuera de la vigilancia de los dos guards sin que salte nada.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// § 2 · 🔴 ROJO POR EL MECANISMO: un script de más o de menos cae NOMBRADO
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-662 · 🔴 un script AÑADIDO al índice y no declarado cae con su nombre', () => {
  const real = scriptsDelDashboard(RAIZ).map(nombreDeScript);
  const conIntruso = [...real, 'vistaQueNadieDeclaro.js'];
  const c = contrastarScripts(conIntruso);
  assert.deepEqual(c.sobran, ['vistaQueNadieDeclaro.js'],
    '🔴 un `<script src=` nuevo en el índice no se detecta. Ése es el caso de todos los días: '
    + 'alguien añade una vista y la población vigilada se queda vieja en silencio.');
  assert.deepEqual(c.faltan, [], '🔴 añadir uno no puede hacer que falten otros');
});

test('SCRUM-662 · 🔴 un script QUITADO del índice cae con su nombre', () => {
  const real = scriptsDelDashboard(RAIZ).map(nombreDeScript);
  const sinUno = real.filter((n) => n !== 'api.js');
  const c = contrastarScripts(sinUno);
  assert.deepEqual(c.faltan, ['api.js'],
    '🔴 quitar una etiqueta del índice no se detecta. Es EXACTAMENTE el fallo que midió SCRUM-559: '
    + 'con holgura, perder una dejaba ese fichero fuera de la vigilancia de dos guards a la vez.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// § 3 · 🔴 EL ORDEN QUE SÍ IMPORTA: las dependencias declaradas
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-662 · 🔴 un consumidor cargado ANTES de su pieza cae nombrando a los dos', () => {
  // Es la mitad que la cuenta nunca vigiló: un merge puede reordenar sin añadir ni quitar nada,
  // y entonces el recuento cuadra mientras la pantalla revienta al abrirse.
  const real = scriptsDelDashboard(RAIZ).map(nombreDeScript);
  const d = DEPENDENCIAS_DE_CARGA[0];
  const movido = real.filter((n) => n !== d.antes);
  movido.splice(movido.indexOf(d.despues) + 1, 0, d.antes); // la pieza, DESPUÉS de su consumidor

  const rotas = dependenciasRotas(movido);
  assert.equal(rotas.length, 1,
    `🔴 mover \`${d.antes}\` detrás de \`${d.despues}\` no lo detecta nadie. Los scripts clásicos `
    + 'comparten ámbito y se ejecutan en el orden del índice: el consumidor se ejecutaría antes de '
    + 'que exista lo que consume.');
  assert.equal(rotas[0].antes, d.antes);
  assert.equal(rotas[0].despues, d.despues);
  assert.ok(rotas[0].motivo && rotas[0].motivo.length > 5,
    '🔴 la dependencia rota no dice su MOTIVO: sin él, quien la lee no sabe cuál de los dos mover.');
});

test('SCRUM-662 · CONTROL POSITIVO: con el índice intacto, ni sobra ni falta ni hay orden roto', () => {
  const real = scriptsDelDashboard(RAIZ);
  const c = contrastarScripts(real);
  assert.deepEqual([...c.sobran, ...c.faltan], [],
    '🔴 el índice de HOY no cuadra con la lista declarada:\n'
    + `  sobran: ${c.sobran.join(', ') || '—'}\n  faltan: ${c.faltan.join(', ') || '—'}`);
  assert.deepEqual(dependenciasRotas(real), [],
    '🔴 hay dependencias de carga incumplidas en el índice real.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// § 4 · SUELOS
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-662 · 🔴 SUELO DE CEGUERA: cero scripts leídos es NO SUPE LEER, no «no hay»', () => {
  const c = contrastarScripts([]);
  assert.ok(c.faltan.length > 0,
    '🔴 CIEGO: con CERO scripts leídos el contraste no acusa nada. Un cero significa que la '
    + 'extracción del índice se rompió —cambió el formato del `<script>`, o el fichero no está—, '
    + 'no que el dashboard no cargue nada. Sin esto, un extractor roto pasaría en verde y los dos '
    + 'guards que se apoyan en esta población dejarían de vigilar a todo el mundo a la vez.');
  assert.equal(c.faltan.length, SCRIPTS_DEL_DASHBOARD.length,
    '🔴 con la lista vacía tienen que faltar TODOS los declarados.');
  assert.ok(SCRIPTS_DEL_DASHBOARD.length > 50,
    `🔴 la lista declarada solo tiene ${SCRIPTS_DEL_DASHBOARD.length} entradas y el dashboard `
    + 'carga del orden de 70: una lista que encoge sola es la misma ceguera por otro camino.');
});

test('SCRUM-662 · la lista declarada no tiene repetidos ni prefijos `js/`', () => {
  // Un repetido haría que `faltan` mintiera; un prefijo suelto haría que el contraste no casara
  // nunca — los dos son formas de que el mecanismo diga que todo está bien sin mirar.
  assert.equal(new Set(SCRIPTS_DEL_DASHBOARD).size, SCRIPTS_DEL_DASHBOARD.length,
    '🔴 hay nombres repetidos en la lista declarada.');
  const conPrefijo = SCRIPTS_DEL_DASHBOARD.filter((n) => n.includes('/'));
  assert.deepEqual(conPrefijo, [],
    `🔴 estas entradas llevan ruta y deberían ser solo el nombre: ${conPrefijo.join(', ')}`);
});

test('SCRUM-662 · DETERMINISTA: dos lecturas seguidas dan lo mismo', () => {
  // Lección de SCRUM-520: no se cambia una comprobación frágil por otra frágil. Si el resultado
  // dependiera del orden del sistema de ficheros o de un `Set` recorrido, este test lo diría.
  const a = contrastarScripts(scriptsDelDashboard(RAIZ));
  const b = contrastarScripts(scriptsDelDashboard(RAIZ));
  assert.deepEqual(a.sobran, b.sobran, '🔴 dos ejecuciones dan «sobran» distintos');
  assert.deepEqual(a.faltan, b.faltan, '🔴 dos ejecuciones dan «faltan» distintos');
  assert.deepEqual(a.vistos, b.vistos, '🔴 dos lecturas del índice devuelven listas distintas');
  assert.deepEqual(dependenciasRotas(a.vistos), dependenciasRotas(b.vistos));
});
