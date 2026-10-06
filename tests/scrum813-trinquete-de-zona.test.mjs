// tests/scrum813-trinquete-de-zona.test.mjs — SCRUM-813
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// LA RED QUE SÍ CORRE SIEMPRE.
//
// El trinquete de verdad —`npm run trinquete:zona`— barre 800 ficheros en dos zonas y cuesta
// minutos, así que vive fuera de `npm test`, en su propio job del CI, como `meta:mutaciones`.
//
// Ese reparto tiene un agujero conocido y esta casa ya lo ha pagado: **un instrumento que sólo
// corre en un sitio se pudre en silencio entre pasada y pasada**. Basta que alguien cambie una
// constante, que `run()` deje de emitir lo que se le lee, o que la sonda de `TZ` deje de llegar,
// para que la pasada siguiente devuelva un cero perfecto que nadie sabrá leer como avería.
//
// Aquí se corre **el mismo camino de medición**, con los mismos canarios y las mismas zonas, y
// sólo sobre ellos: cuatro ficheros minúsculos en vez de ochocientos. Segundos. Lo caro es barrer
// el árbol; comprobar que el aparato VE, no.
//
// ── 🔴 EL CONTROL QUE DECIDE, Y ESTÁ EN LOS DOS SENTIDOS ───────────────────────────────────
//
//   ① METE UN TEST QUE DEPENDA DE LA ZONA → EL TRINQUETE TIENE QUE HABLAR. Es exactamente lo que
//      no pasó el 4-sep-2026, cuando SCRUM-592 metió tres y nada dijo nada. Aquí se provoca en
//      cada tanda con dos canarios dependientes, uno por signo de desfase.
//
//   ② LOS QUE YA FIJAN SU ZONA NO SE DENUNCIAN. Un detector que marca a los inocentes marca el
//      árbol entero y se desactiva por ruido en una semana — que es la otra forma de no tener
//      trinquete. Dos canarios fijados lo comprueban.
//
// ⛔ LO QUE ESTE FICHERO NO HACE: barrer el árbol. Su verde NO dice que no haya tests nuevos
// dependientes de zona — eso sólo lo dice la pasada completa. Dice que el aparato que lo mira
// sigue viendo.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';   // SCRUM-730: `pathname` no decodifica el espacio
import { execFileSync } from 'node:child_process'; // SCRUM-813b: contrastar la marca contra git
// SCRUM-864: crea Y se compromete a borrar. Este fichero es del 8-sep y nacio antes del helper.
import { temporal } from './_temporal.mjs';

import {
  AUSENTE, CANARIOS, CENSADAS, SALIDA_APAGADA, SALIDA_CIEGO, SALIDA_HABLA, SALIDA_OK, ZONAS,
  arbolQuieto, cambianDeVeredicto, claveDe, compararZonas, entornoLimpio, escribirCanarios,
  ficherosDeLaTanda, ESCRITURAS_DE_LA_TANDA, huellaPorRuta, juzgarCanarios, marcaDelArbol,
  medirEnZona, repescar, resolverRepesca, sondaDeZona, veredicto,
} from '../scripts/_trinquete-de-zona.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// 🔴 MUTACIONES_QUE_ME_TUMBAN · SCRUM-745. Cada una imita el defecto que este guard promete cazar.
// Se ejecutan con `npm run meta:mutaciones`: aplica, exige el ROJO, restaura y compara bytes.
export const MUTACIONES_QUE_ME_TUMBAN = [
  // ① EL TRINQUETE SE QUEDA MUDO: el diferencial deja de encontrar nada, que es la avería que
  //    convierte una pasada completa en un cero perfecto sin significado.
  {
    fichero: 'scripts/_trinquete-de-zona.mjs',
    de: '    if (distintos.size > 1) {',
    a: '    if (false) {',
    cae: 'el trinquete HABLA: un test que depende de la zona sale denunciado',
  },
  // ② EL TRINQUETE GRITA A TODO: denuncia también a los que fijan su zona. Así se apaga por ruido.
  {
    fichero: 'scripts/_trinquete-de-zona.mjs',
    de: '    if (distintos.size > 1) {',
    a: '    if (distintos.size >= 1) {',
    cae: 'el trinquete NO denuncia a los tests que YA fijan su zona',
  },
  // ③ LA ZONA DEJA DE LLEGAR AL HIJO: las dos pasadas medirían la MISMA zona y el diferencial
  //    saldría vacío — un cero perfecto que no significa nada. Es la avería que la sonda existe
  //    para cazar, y aquí se provoca de verdad en vez de aflojar la comparación.
  {
    fichero: 'scripts/_trinquete-de-zona.mjs',
    de: '  const env = { ...base, TZ: zona };',
    a: '  const env = { ...base };',
    cae: 'SUELO: la zona LLEGA al proceso hijo, y se comprueba antes de medir',
  },
  // ④ UNA CENSADA QUE SE APAGA DEJA DE SER ROJA: el peor movimiento de los dos, en silencio.
  {
    fichero: 'scripts/_trinquete-de-zona.mjs',
    // ⚠️ REAPUNTADA en SCRUM-1335b: la línea ganó `&& !sinVeredicto.has(c.clave)` (una censada que
    // no se pudo comparar no es una apagada). La mutación es la misma: nada sale nunca apagado.
    de: '  const apagadas = censadas.filter((c) => !vistas.has(c.clave) && !sinVeredicto.has(c.clave));',
    a: '  const apagadas = [];',
    cae: 'una CENSADA que deja de cambiar de veredicto pone el trinquete en ROJO',
  },
  // ⑤ EL SUELO SE CAE: cero dependientes teniendo censadas vuelve a leerse como «no hay».
  {
    fichero: 'scripts/_trinquete-de-zona.mjs',
    de: '  const cieloRaso = cambianEnElArbol.length === 0 && censadas.length > 0;',
    a: '  const cieloRaso = false;',
    cae: 'SUELO: CERO dependientes teniendo censadas NO es un cero — es CIEGO',
  },
  // ─────────────────────────────────────────────────────────────────────────────────────────
  // SCRUM-813b · las tres del DETALLE POR RUTA. Las tres se han provocado a mano antes de
  // escribirlas aquí, y las tres tumbaron SU caso y sólo el suyo.
  // ─────────────────────────────────────────────────────────────────────────────────────────
  // ⑥ EL SUELO DEL DETALLE SE CAE: un árbol que se movió pero cuyo troceado por ruta no supo
  //    leer pasaría por QUIETO. Es la única forma en que este refinamiento podría abrir un
  //    agujero, así que es la que más falta hace vigilar.
  {
    fichero: 'scripts/_trinquete-de-zona.mjs',
    // ⚠️ REAPUNTADA en SCRUM-813c: la condición ganó `!amparadas.length` al acotar el sujeto, y
    // el texto viejo pasó a casar CERO veces — o sea que esta mutación se aplicaba sobre nada y
    // pasaba en verde sin haber mutado. Lo cazó la comprobación de anclas del propio ticket.
    de: '  if (!rutas.length && !amparadas.length && antes.huella !== despues.huella) {',
    a: '  if (false) {',
    cae: 'SUELO: si el detalle por ruta NO ve nada pero la huella global cambió, sigue siendo CIEGO',
  },
  // ⑦ EL CIEGO VUELVE A SER MUDO: sigue cerrando la puerta, pero deja de decir QUÉ se movió — que
  //    es exactamente el defecto que este apartado cierra.
  {
    fichero: 'scripts/_trinquete-de-zona.mjs',
    de: '    for (const x of rutas) cambios.push(`${x.ruta}   ${x.antes} → ${x.despues}`);',
    a: '    for (const x of rutas) cambios.push("el contenido del arbol cambio");',
    cae: 'EL QUE DECIDE: un fichero de TEST tocado durante la medición sigue siendo CIEGO',
  },
  // ⑧ LA MARCA DEJA DE TRAER EL DETALLE: el instrumento vuelve a tirar el resultado después de
  //    calcularlo, que es la avería original con otra cara.
  {
    fichero: 'scripts/_trinquete-de-zona.mjs',
    de: '    porRuta: huellaPorRuta(estado.stdout, diff.stdout),',
    a: '    porRuta: new Map(),',
    cae: 'la marca REAL trae el detalle, y cuadra con lo que dice git',
  },
  // ─────────────────────────────────────────────────────────────────────────────────────────
  // SCRUM-813c · las tres del SUJETO ACOTADO. Las tres provocadas a mano antes de escribirlas:
  // cada una tumbó SU caso y sólo el suyo.
  // ─────────────────────────────────────────────────────────────────────────────────────────
  // ⑨ LA LISTA SE VUELVE ZONA FRANCA: se ampara TODO, y entonces tocar un fichero de `tests/`
  //    durante la medición ya no ciega. Es la forma en que este acotado apagaría la puerta.
  {
    fichero: 'scripts/_trinquete-de-zona.mjs',
    de: '      if (laEscribeLaTanda(r, declaradas)) amparadas.push(movimiento);',
    a: '      if (true) amparadas.push(movimiento);',
    cae: 'EL QUE DECIDE: un fichero de TEST tocado a mano DURANTE la medición sigue siendo CIEGO',
  },
  // ⑩ LA LISTA VACÍA SE VUELVE ZONA FRANCA: con cero entradas, el amparo pasa a cubrir CUALQUIER
  //    ruta y el trinquete deja de cegar justo cuando no tiene ninguna excepción declarada.
  //
  //    🔴 REANCLADA EL 17-sep-2026, y el motivo importa. Esta mutación apuntaba a
  //    `if (!declaradas.length) {` —el suelo «lista vacía ⇒ CIEGO»— y su `cae` citaba un test
  //    llamado «SUELO: con la lista de escrituras VACÍA es CIEGO». Los dos desaparecieron a la vez
  //    cuando la última excepción se retiró (SCRUM-824 arregló su causa) y el suelo se fue con
  //    ella, que era su condición de salida escrita. La mutación se quedó **anclada a texto que ya
  //    no existe**, o sea MUDA — y `meta:mutaciones` no podía aplicarla, así que nadie comprobaba
  //    esta mitad del guard.
  //
  //    No se restaura el texto viejo: se REANCLA a lo que hoy sostiene la misma promesa —que un
  //    amparo sólo puede salir de una entrada declarada— y esa es la condición de
  //    `laEscribeLaTanda`. Con `|| !declaradas.length` ampara todo cuando la lista está vacía,
  //    que es exactamente el defecto que el caso nuevo vigila.
  {
    fichero: 'scripts/_trinquete-de-zona.mjs',
    de: '  return declaradas.some((d) => r === d.ruta',
    a: '  return !declaradas.length || declaradas.some((d) => r === d.ruta',
    cae: 'con la lista VACÍA nada se ampara: cualquier ruta sigue cegando',
  },
  // ⑪ NADA SE AMPARA: el acotado deja de existir y el instrumento vuelve a callarse en cada
  //    pasada de CI. Es el defecto que este apartado cierra.
  {
    fichero: 'scripts/_trinquete-de-zona.mjs',
    de: '  return declaradas.some((d) => r === d.ruta',
    a: '  return [].some((d) => r === d.ruta',
    cae: 'POSITIVO: la tanda escribiendo LO SUYO no ciega — el trinquete EMITE veredicto',
  },
  // ─────────────────────────────────────────────────────────────────────────────────────────
  // SCRUM-1335b · «AUSENTE» NO ES UN VEREDICTO. Dos mitades, y las mutaciones van a las dos:
  // que lo que no se puede sostener deje de acusar (⑫ ⑮ ⑰), y que al quitarlo NO se apague ni se
  // calle nada (⑬ ⑭ ⑯ ⑱ ⑲ ⑳ ㉑ ㉒).
  // ─────────────────────────────────────────────────────────────────────────────────────────
  // ⑫ EL DEFECTO VUELVE: un resultado que no llegó cuenta otra vez como un veredicto distinto.
  {
    fichero: 'scripts/_trinquete-de-zona.mjs',
    de: '    const distintos = new Set(porZona.map((p) => p.veredicto).filter((v) => v !== AUSENTE));',
    a: '    const distintos = new Set(porZona.map((p) => p.veredicto));',
    cae: '«ausente» NO es un veredicto: pasa en una zona y falta en la otra NO acusa',
  },
  // ⑬ SE CALLA: lo que deja de acusar desaparece, y un cero se lee como «se comparó todo».
  {
    fichero: 'scripts/_trinquete-de-zona.mjs',
    de: '      else sinComparar.push(entrada);',
    a: '      else void entrada;',
    cae: '② lo que no se pudo comparar se CUENTA, con su zona: no desaparece',
  },
  // ⑭ SE APAGA: la caída real cuyo resultado se pierde deja de verse por el fichero.
  {
    fichero: 'scripts/_trinquete-de-zona.mjs',
    de: '      if (elFicheroCaeSoloDondeSeVio) cambian.push({ ...entrada, porElFichero: true });',
    a: '      if (false) cambian.push({ ...entrada, porElFichero: true });',
    cae: '① una caída REAL cuyo resultado SE PIERDE sigue cambiando: lo dice el fichero',
  },
  // ⑮ LA REGLA DEL FICHERO SE VUELVE «TODO `fail` ACUSA»: un fichero que cae en las dos zonas
  //    pasa por dependiente de la zona.
  {
    fichero: 'scripts/_trinquete-de-zona.mjs',
    de: '        && porZona.every((p, i) => p.veredicto !== AUSENTE || !caidos[i].has(fichero));',
    a: '        && true;',
    cae: 'una prueba que cae en las DOS zonas y pierde un resultado NO acusa a la zona',
  },
  // ⑯ LA PÉRDIDA BORRA UN HALLAZGO: una diferencia vista deja de contar si a solas falta el
  //    resultado. Es la forma en que este cambio apagaría el trinquete por la puerta de atrás.
  {
    fichero: 'scripts/_trinquete-de-zona.mjs',
    de: "    else if (s.estado !== 'cambia') confirmar({ ...c, sinRefutar: s.estado });",
    a: "    else if (s.estado !== 'cambia') noConfirmadas.push(c);",
    cae: '① una diferencia VISTA en la tanda que a solas no se pudo comparar QUEDA EN PIE',
  },
  // ⑰ UNA CAÍDA SIN NOMBRE CONFIRMA A CUALQUIERA: vuelve la acusación sin dato, por la repesca.
  {
    fichero: 'scripts/_trinquete-de-zona.mjs',
    de: '    const loConfirmaElFichero = cambiabaEnLaTanda && delFichero.some(',
    a: '    const loConfirmaElFichero = delFichero.some(',
    cae: 'la repesca por el FICHERO: confirma a la que cambiaba, y nunca a la que sólo faltaba',
  },
  // ⑱ LO COMPARADO A SOLAS SIGUE CONTANDO COMO «NO PUDE»: la cifra dejaría de ser una medida.
  {
    fichero: 'scripts/_trinquete-de-zona.mjs',
    de: "    else if (s.estado === 'igual') resueltas.push(c);",
    a: "    else if (s.estado === 'igual') siguen.push(c);",
    cae: '③ la repesca COMPARA lo que la tanda no pudo: lo que a solas da igual sale de la cuenta',
  },
  // ⑲ EL VERDE PIERDE LA CUENTA: «0 nuevas» vuelve a leerse como «las comparé todas».
  {
    fichero: 'scripts/_trinquete-de-zona.mjs',
    de: "  return { estado: 'OK', salida: SALIDA_OK, nuevas: [], apagadas: [], cieloRaso, sinComparar, motivos: [] };",
    a: "  return { estado: 'OK', salida: SALIDA_OK, nuevas: [], apagadas: [], cieloRaso, sinComparar: [], motivos: [] };",
    cae: '② el VERDE lleva consigo lo que no pudo comparar, y sigue siendo verde',
  },
  // ⑳ UNA CENSADA QUE NO SE VIO SE DA POR BUENA: la alarma «sigue viva» sin haberla mirado.
  {
    fichero: 'scripts/_trinquete-de-zona.mjs',
    de: '  if (censadasSinComparar.length) {',
    a: '  if (false) {',
    cae: 'una CENSADA que no se pudo comparar no está viva ni apagada: es CIEGO',
  },
  // ㉑ UN CANARIO QUE NO SE VIO APRUEBA EL AUTOCONTROL.
  {
    fichero: 'scripts/_trinquete-de-zona.mjs',
    de: '    if (!visto && sinMedida.has(c.rutaClave)) {',
    a: '    if (false) {',
    cae: 'un CANARIO que no se pudo comparar no aprueba el autocontrol',
  },
  // ㉒ LA REPESCA DEJA DE VER EL CAMBIO A SOLAS: una prueba que la tanda no pudo comparar y que a
  //    solas pasa en una zona y cae en la otra saldría como «comparada, y da lo mismo».
  {
    fichero: 'scripts/_trinquete-de-zona.mjs',
    de: "    if (r.cambian.some((x) => x.clave === c.clave)) return { estado: 'cambia' };",
    a: "    if (false) return { estado: 'cambia' };",
    cae: '① lo que la tanda no pudo comparar y a solas CAMBIA es un hallazgo',
  },
];

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ① SUELO · sin esto, todo lo de abajo pasa sin medir
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-813 · SUELO: la zona LLEGA al proceso hijo, y se comprueba antes de medir', () => {
  // El prefijo `TZ=x node` de Git Bash NO funciona en Windows (medido en SCRUM-640). Lo que sí
  // funciona es `TZ` como ENTORNO de un proceso hijo, y es lo único que este instrumento usa.
  // Si esto cayera, cada «pasada por zona» estaría midiendo la zona de la máquina y el censo
  // devolvería un cero que no significa nada.
  for (const zona of ZONAS) {
    const s = sondaDeZona(zona);
    assert.equal(s.ok, true,
      `🔴 CIEGO: pedí \`${zona}\` al hijo y el hijo ve \`${s.vista || '(nada)'}\`. Sin esto, las dos `
      + 'pasadas medirían LA MISMA zona y el diferencial sería siempre vacío.');
  }
});

test('SCRUM-813 · SUELO: la línea base existe, está bien formada y APUNTA A ALGO REAL', () => {
  assert.ok(CENSADAS.length > 0,
    '🔴 la lista de censadas está VACÍA. El 7-sep-2026 había TRES medidas. O se han arreglado —y '
    + 'entonces esto se retira a mano diciéndolo, con SCRUM-643 §2·A decidido— o alguien la ha '
    + 'vaciado para que el trinquete se callara.');

  for (const c of CENSADAS) {
    const [fichero, ...resto] = c.clave.split('::');
    const prueba = resto.join('::');
    assert.ok(prueba, `🔴 clave sin nombre de prueba: ${c.clave}`);
    assert.ok(c.porque && c.parado_en,
      `🔴 \`${c.clave}\` no dice por qué está censada ni dónde está parada. Una lista de claves sin `
      + 'motivo es una lista blanca.');

    // 🔴 ANCLADA POR IDENTIDAD, no por posición (SCRUM-710b): el fichero tiene que existir y el
    // nombre de la prueba tiene que estar DENTRO. Si alguien renombra la prueba, esto lo dice
    // aquí y en una línea, en vez de dejar que la pasada completa lo llame «apagada» dentro de
    // trece minutos.
    const abs = path.join(RAIZ, fichero);
    assert.ok(fs.existsSync(abs), `🔴 la censada apunta a un fichero que no existe: ${fichero}`);
    assert.ok(fs.readFileSync(abs, 'utf8').includes(prueba),
      `🔴 \`${fichero}\` ya no contiene una prueba llamada «${prueba}». O se renombró —y hay que `
      + 'actualizar la clave— o se borró, y entonces hay que decidir qué pasa con lo que estaba '
      + 'parado en SCRUM-643 §2·A.');
  }
});

test('SCRUM-813 · SUELO: la tanda que el trinquete barre es la MISMA que corre `npm test`', () => {
  // Si `ficherosDeLaTanda` se quedara corto, el trinquete barrería medio árbol y su cero sería
  // un cero de lo que miró, no del árbol.
  const vistos = ficherosDeLaTanda(RAIZ);
  const enDisco = fs.readdirSync(path.join(RAIZ, 'tests')).filter((f) => f.endsWith('.test.mjs'));
  assert.equal(vistos.length, enDisco.length,
    `🔴 el trinquete ve ${vistos.length} ficheros y en \`tests/\` hay ${enDisco.length}.`);
  assert.ok(vistos.length > 300,
    `🔴 sólo ${vistos.length} ficheros: eso no es la tanda de esta casa.`);
  assert.ok(vistos.includes(path.join(RAIZ, 'tests', path.basename(fileURLToPath(import.meta.url)))),
    '🔴 el barrido no incluye ni a este fichero.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ② 🔴 EL CONTROL QUE DECIDE · se PROVOCA el caso, no se predice (regla 13)
//
// Se miden los cuatro canarios por el camino real —proceso hijo con `TZ` de entorno, `run()` de
// `node:test`, diferencial entre las dos zonas— y se comprueba lo que sale. Es la ÚNICA prueba
// de este fichero que cuesta segundos, y es la que vale.
// ═════════════════════════════════════════════════════════════════════════════════════════════

const dirCanarios = temporal('scrum813-');
const canarios = escribirCanarios(path.join(dirCanarios, 'canarios'));
const medidas = ZONAS.map((zona) => medirEnZona({
  zona,
  ficheros: canarios.map((c) => c.ruta),
  raiz: RAIZ,
  salida: path.join(dirCanarios, `${zona.replace(/\W/g, '_')}.json`),
}));
const cambian = medidas.every((m) => m.ok) ? cambianDeVeredicto(medidas) : [];
const denunciados = new Set(cambian.map((c) => c.fichero));
const denunciado = (c) => denunciados.has(c.rutaClave);

test('SCRUM-813 · SUELO: las dos pasadas de canarios midieron de verdad', () => {
  for (const m of medidas) {
    assert.equal(m.ok, true, `🔴 la pasada en \`${m.zona}\` no dejó medida: ${m.porque}`);
    assert.equal(m.zonaVista, m.zona,
      `🔴 pedí \`${m.zona}\` y el hijo corrió en \`${m.zonaVista}\`.`);
    assert.equal(m.veredictos.size, CANARIOS.length,
      `🔴 en \`${m.zona}\` se vieron ${m.veredictos.size} pruebas de ${CANARIOS.length} canarios. `
      + 'Un canario que no llega a registrarse no puede denunciar nada.');
  }
});

test('SCRUM-813 · 🔴 el trinquete HABLA: un test que depende de la zona sale denunciado', () => {
  // ESTE es el control del encargo: se mete un test nuevo que depende de la zona y el instrumento
  // tiene que decirlo. Son dos, uno por signo de desfase, y hacen falta los dos: con un solo
  // canario, un juego de zonas todo al oeste (o todo al este) daría verde sin haberlo ganado.
  for (const c of canarios.filter((x) => x.clase === 'dependiente')) {
    assert.ok(denunciado(c),
      `🔴 EL TRINQUETE NO HABLA. El canario \`${c.fichero}\` depende de la zona de la máquina y NO `
      + `ha salido denunciado. ${c.porque}\n`
      + `  Denunciados: ${[...denunciados].join(', ') || '(ninguno)'}\n`
      + `  Zonas medidas: ${ZONAS.join(', ')} — si se han cambiado, comprueba que cubren los DOS `
      + 'signos de desfase.');
  }
});

test('SCRUM-813 · 🔴 el trinquete NO denuncia a los tests que YA fijan su zona', () => {
  // El otro sentido, y es igual de decisivo: un detector que marca a los correctos marca el árbol
  // entero, y a la segunda semana alguien lo desactiva «porque da falsos». Ahí muere el guard.
  for (const c of canarios.filter((x) => x.clase === 'fijado')) {
    assert.equal(denunciado(c), false,
      `🔴 RUIDO: el canario \`${c.fichero}\` fija su zona (o no habla de fechas) y aun así ha salido `
      + `denunciado. ${c.porque}`);
  }
});

test('SCRUM-813 · los canarios juzgan al instrumento, y el veredicto lo dice', () => {
  const j = juzgarCanarios(cambian, canarios);
  assert.deepEqual(j.fallos, [], '🔴 el autocontrol del trinquete falla');
  assert.equal(j.ok, true);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ③ EL VEREDICTO · se prueba sin correr la tanda, con medidas de mentira
// ═════════════════════════════════════════════════════════════════════════════════════════════

const medidaFalsa = (zona, pares) => ({ zona, ok: true, veredictos: new Map(pares) });
const DOS_MEDIDAS = [medidaFalsa('A', [['x::y', 'pass']]), medidaFalsa('B', [['x::y', 'fail']])];
const CONTROLES_OK = { ok: true, fallos: [] };
const censada = (clave) => ({ clave, porque: '…', parado_en: '…' });
const cambio = (clave) => ({ clave, fichero: clave.split('::')[0], prueba: clave.split('::')[1], porZona: [] });

test('SCRUM-813 · 🔴 una prueba dependiente NO censada pone el trinquete en ROJO', () => {
  const v = veredicto({
    cambianEnElArbol: [cambio('tests/nuevo.test.mjs::algo que mide la máquina')],
    censadas: [],
    medidas: DOS_MEDIDAS,
    controles: CONTROLES_OK,
  });
  assert.equal(v.estado, 'HABLA');
  assert.equal(v.salida, SALIDA_HABLA);
  assert.equal(v.nuevas.length, 1);
});

test('SCRUM-813 · una prueba dependiente que SÍ está censada no lo pone en rojo', () => {
  const clave = 'tests/x.test.mjs::y';
  const v = veredicto({
    cambianEnElArbol: [cambio(clave)],
    censadas: [censada(clave)],
    medidas: DOS_MEDIDAS,
    controles: CONTROLES_OK,
  });
  assert.equal(v.estado, 'OK');
  assert.equal(v.salida, SALIDA_OK);
});

test('SCRUM-813 · 🔴 una CENSADA que deja de cambiar de veredicto pone el trinquete en ROJO', () => {
  // El movimiento peligroso de verdad: los tres rojos de SCRUM-592 son HOY la única evidencia
  // automática de un defecto de numeración fiscal sin decidir (SCRUM-643 §2·A). Fijarles la zona
  // los pone verdes y APAGA LA ALARMA. Un trinquete que sólo mira hacia arriba lo deja pasar.
  const viva = 'tests/x.test.mjs::sigue cambiando';
  const apagada = 'tests/x.test.mjs::ésta ya no';
  const v = veredicto({
    cambianEnElArbol: [cambio(viva)],
    censadas: [censada(viva), censada(apagada)],
    medidas: DOS_MEDIDAS,
    controles: CONTROLES_OK,
  });
  assert.equal(v.estado, 'APAGADA');
  assert.equal(v.salida, SALIDA_APAGADA);
  assert.deepEqual(v.apagadas.map((a) => a.clave), [apagada]);
});

test('SCRUM-813 · 🔴 SUELO: CERO dependientes teniendo censadas NO es un cero — es CIEGO', () => {
  // Lo pide el encargo con estas palabras: «si el censo devuelve cero tests dependientes de zona,
  // falla declarándose ciego — hay tres medidos». Y la diferencia con APAGADA no es cosmética: si
  // desaparecen ALGUNAS, el instrumento midió y lo que hay que mirar es qué se arregló; si no
  // queda NINGUNA, lo primero que hay que mirar es el instrumento.
  const v = veredicto({
    cambianEnElArbol: [],
    censadas: [censada('tests/x.test.mjs::y'), censada('tests/x.test.mjs::z')],
    medidas: DOS_MEDIDAS,
    controles: CONTROLES_OK,
  });
  assert.equal(v.estado, 'CIEGO');
  assert.equal(v.salida, SALIDA_CIEGO);
  assert.equal(v.cieloRaso, true);

  // Y con la lista base VACÍA —el día que 643 §2·A se decida y se borren a mano— un cero es un
  // cero de verdad: el suelo deja de aplicar y el instrumento sigue vigilado por sus canarios.
  const sinCensadas = veredicto({
    cambianEnElArbol: [], censadas: [], medidas: DOS_MEDIDAS, controles: CONTROLES_OK,
  });
  assert.equal(sinCensadas.estado, 'OK');
  assert.equal(sinCensadas.salida, SALIDA_OK);
});

test('SCRUM-813 · una NUEVA manda sobre el suelo: primero se dice lo que ha entrado', () => {
  // Si una nueva entra el mismo día que las censadas dejan de verse, lo urgente es la nueva.
  const v = veredicto({
    cambianEnElArbol: [cambio('tests/nuevo.test.mjs::algo')],
    censadas: [censada('tests/x.test.mjs::y')],
    medidas: DOS_MEDIDAS,
    controles: CONTROLES_OK,
  });
  assert.equal(v.estado, 'HABLA');
  assert.equal(v.salida, SALIDA_HABLA);
  assert.equal(v.apagadas.length, 1, '🔴 y la apagada no se pierde: viaja en el mismo informe');
});

test('SCRUM-813 · 🔴 sin controles, o con una pasada muda, se declara CIEGO y NO opina del árbol', () => {
  const conControlesRotos = veredicto({
    cambianEnElArbol: [],
    censadas: CENSADAS,
    medidas: DOS_MEDIDAS,
    controles: { ok: false, fallos: ['el canario dependiente no salió denunciado'] },
  });
  assert.equal(conControlesRotos.estado, 'CIEGO');
  assert.equal(conControlesRotos.salida, SALIDA_CIEGO);

  const pasadaMuda = veredicto({
    cambianEnElArbol: [],
    censadas: CENSADAS,
    medidas: [medidaFalsa('A', []), medidaFalsa('B', [['x::y', 'pass']])],
    controles: CONTROLES_OK,
  });
  assert.equal(pasadaMuda.estado, 'CIEGO', '🔴 una pasada que no vio NI UNA prueba no es un cero');

  const pasadaRota = veredicto({
    cambianEnElArbol: [],
    censadas: CENSADAS,
    medidas: [{ zona: 'A', ok: false, porque: 'el hijo murió', veredictos: new Map() }, DOS_MEDIDAS[1]],
    controles: CONTROLES_OK,
  });
  assert.equal(pasadaRota.estado, 'CIEGO');

  const unaSolaZona = veredicto({
    cambianEnElArbol: [],
    censadas: CENSADAS,
    medidas: [DOS_MEDIDAS[0]],
    controles: CONTROLES_OK,
  });
  assert.equal(unaSolaZona.estado, 'CIEGO', '🔴 con una sola zona no hay diferencial que medir');
});

test('SCRUM-813 · un fichero que MUERE AL CARGAR en una zona sola sigue cambiando de veredicto', () => {
  // Es la forma más gorda de dependencia de zona, y no se puede escapar por no tener «pass» ni
  // «fail» con el mismo nombre en las dos: en la zona donde muere, `run()` entrega UN `fail` con
  // la ruta del fichero por nombre, y sus pruebas no existen.
  //
  // ⚠️ REESCRITO en SCRUM-1335b. Este caso se llamaba «una prueba que EXISTE en una zona y no en la
  // otra también cambia de veredicto» y lo probaba con `pass` contra NADA — que no es un fichero
  // que muere: es un resultado que no llegó, y era justo la afirmación que el instrumento no podía
  // sostener (289 de 289 acusaciones el 6-oct-2026). Lo que el caso quería proteger se protege
  // aquí con la forma que de verdad tiene, medida con un fichero sembrado.
  const { cambian: c2, sinComparar: s2 } = compararZonas([
    medidaFalsa('A', [['x::y', 'pass'], ['x::z', 'pass']]),
    medidaFalsa('B', [['x::/ruta/x', 'fail']]),
  ]);
  assert.deepEqual(c2.map((c) => c.clave), ['x::/ruta/x'],
    '🔴 un fichero que cae en una zona y en la otra no ha dejado de ser un hallazgo');
  assert.equal(c2[0].porElFichero, true);
  assert.equal(c2[0].porZona.find((p) => p.zona === 'A').veredicto, AUSENTE);
  assert.deepEqual(s2.map((c) => c.clave), ['x::y', 'x::z'],
    'sus pruebas no se pudieron comparar una a una, y se dice');
});

test('SCRUM-813 · 🔴 el hijo NO hereda `NODE_TEST_CONTEXT` ni `NODE_OPTIONS`, y sí el resto', () => {
  // 🔴 ESTE TEST EXISTE PORQUE LA AVERÍA OCURRIÓ, y ocurrió justo aquí: este mismo fichero corre
  // DENTRO de `node --test`, así que sus hijos heredaban `NODE_TEST_CONTEXT=child-v8` — y con esa
  // variable puesta el `run()` del nieto devuelve CERO eventos. La red que vigila al trinquete
  // medía cero canarios, y su cero se leía como «el trinquete no ve».
  const env = entornoLimpio('UTC', {
    NODE_TEST_CONTEXT: 'child-v8',
    NODE_OPTIONS: '--test-reporter=tap --test-reporter-destination=/tmp/tanda.tap',
    LIBRO_PG_URL: 'postgresql://x', QA_DB_TEST: '1', TZ: 'Europe/Madrid',
  });
  assert.equal(env.NODE_TEST_CONTEXT, undefined,
    '🔴 el hijo heredaría el contexto de test y su `run()` devolvería cero eventos');
  assert.equal(env.NODE_OPTIONS, undefined,
    '🔴 el hijo heredaría los reporters de la tanda y escribiría encima de su informe');
  assert.equal(env.TZ, 'UTC', '🔴 la zona pedida tiene que GANAR a la del entorno');
  assert.equal(env.LIBRO_PG_URL, 'postgresql://x',
    '🔴 sin las variables de banco, los tests que las piden se saltarían EN LAS DOS ZONAS y el '
    + 'trinquete saldría verde sin haberlos mirado');
  assert.equal(env.QA_DB_TEST, '1');
});

test('SCRUM-813 · 🔴 si el árbol se MUEVE entre las dos pasadas, el veredicto es CIEGO', () => {
  // El diferencial compara dos pasadas. Decenas de guards de esta casa LEEN el árbol, así que un
  // fichero editado a mitad les cambia el veredicto por un motivo que no es la zona: un hallazgo
  // FALSO. Y un hallazgo falso es lo que hace que alguien apague el guard.
  const marca = marcaDelArbol();
  if (!marca.ok) {
    // Sin git no se puede comprobar. Se DECLARA y no se pasa en verde en silencio.
    assert.fail(`no se pudo tomar la marca del árbol: ${marca.porque}`);
  }
  assert.equal(arbolQuieto(marca, marca).cambios.length, 0,
    '🔴 la misma marca dos veces sale como «se movió»: el detector no distingue nada');

  const movido = arbolQuieto(marca, { ...marca, huella: 'otra cosa' });
  assert.equal(movido.cambios.length, 1);

  const v = veredicto({
    cambianEnElArbol: [],
    censadas: CENSADAS,
    medidas: DOS_MEDIDAS,
    controles: CONTROLES_OK,
    quieto: movido,
  });
  assert.equal(v.estado, 'CIEGO');
  assert.equal(v.salida, SALIDA_CIEGO);
});

test('SCRUM-813 · la clave se escribe igual en Windows y en Linux', () => {
  // El CI corre en ubuntu y esta casa desarrolla en Windows. Una clave con `\` no casaría con la
  // misma clave con `/`, y la línea base entera saldría «apagada» al cruzar de sistema.
  const clave = claveDe(path.join(RAIZ, 'tests', 'x.test.mjs'), 'una prueba', RAIZ);
  assert.equal(clave, 'tests/x.test.mjs::una prueba');
  assert.equal(clave.includes('\\'), false);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ④ EL TRINQUETE ESTÁ CONECTADO · un instrumento que nadie ejecuta no existe
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-813 · 🔴 el trinquete tiene comando propio Y job de CI: no depende de que alguien se acuerde', () => {
  // ES LA MITAD QUE FALTABA EN SCRUM-640. Aquel censo se midió una vez, salió un número, y el
  // número se quedó en un documento; dos días después el defecto volvió a entrar. Si esto no
  // corre solo en cada PR, lo que hay es otra medición de una vez con más comentarios.
  const pkg = JSON.parse(fs.readFileSync(path.join(RAIZ, 'package.json'), 'utf8'));
  assert.equal(pkg.scripts['trinquete:zona'], 'node scripts/trinquete-de-zona.mjs',
    '🔴 el comando `trinquete:zona` ha desaparecido de package.json');

  const ci = fs.readFileSync(path.join(RAIZ, '.github', 'workflows', 'ci.yml'), 'utf8');
  assert.ok(ci.includes('npm run trinquete:zona'),
    '🔴 EL CI YA NO LO CORRE. Sin job, el trinquete vuelve a ser una medición que hay que '
    + 'acordarse de teclear — que es exactamente lo que permitió que SCRUM-592 reintrodujera los '
    + 'tres dos días después de arreglarlos.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// SCRUM-813b · EL CIEGO DICE QUÉ RUTA SE MOVIÓ
//
// EL DEFECTO: el instrumento medía las dos pasadas enteras, los cuatro canarios y las tres
// censadas, y entonces resumía el árbol a UN hash y tiraba el resto. Un CIEGO que sólo sabe decir
// «el contenido del árbol cambió» no permite distinguir «la tanda escribió algo» de «alguien
// editó un fichero mientras corría» — dos causas con arreglos OPUESTOS. Y ante esa duda, la
// salida cómoda es relajar la puerta, que es justo lo que no se puede hacer.
//
// ⛔ LO QUE ESTOS CASOS FIJAN NO ES UNA EXCEPCIÓN: es que la puerta sigue igual de cerrada y
//    ADEMÁS nombra. Cualquier ruta que se mueva sigue siendo CIEGO.
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-813b · SUELO: la huella por ruta SEPARA los ficheros, no los mezcla en un hash', () => {
  // Dos ficheros que cambian a la vez tienen que dar DOS señales. Con un hash común daban una
  // sola, indivisible — que es el defecto que este apartado cierra.
  const estado = ' M scripts/uno.mjs\n?? tests/nuevo.test.mjs\n';
  const diff = 'diff --git a/scripts/uno.mjs b/scripts/uno.mjs\n@@\n-a\n+b\n';
  const h = huellaPorRuta(estado, diff);

  assert.ok(h instanceof Map, 'la huella por ruta tiene que ser un mapa ruta → señal');
  assert.deepEqual([...h.keys()].sort(), ['scripts/uno.mjs', 'tests/nuevo.test.mjs']);
  assert.match(h.get('scripts/uno.mjs'), /diff:/, 'el fichero que aparece en el diff lleva su contenido');
  assert.match(h.get('tests/nuevo.test.mjs'), /^estado:/, 'el que sólo sale en `status` lleva su código');

  // CONTROL POSITIVO del detalle: cambiar el contenido de UNO cambia SÓLO su señal.
  const h2 = huellaPorRuta(estado, 'diff --git a/scripts/uno.mjs b/scripts/uno.mjs\n@@\n-a\n+DISTINTO\n');
  assert.notEqual(h.get('scripts/uno.mjs'), h2.get('scripts/uno.mjs'), 'el contenido no se está mirando');
  assert.equal(h.get('tests/nuevo.test.mjs'), h2.get('tests/nuevo.test.mjs'),
    '🔴 cambiar un fichero mueve la señal de OTRO: el detalle no separa por ruta');
});

test('SCRUM-813b · 🔴 EL QUE DECIDE: un fichero de TEST tocado durante la medición sigue siendo CIEGO — y ahora se NOMBRA', () => {
  // Es el caso que la puerta existe para cazar: alguien edita un fichero que la medición JUZGA
  // mientras las dos pasadas corren. Antes salía CIEGO sin decir cuál; ahora sale CIEGO y lo dice.
  const antes = {
    ok: true, head: 'abc', huella: 'A',
    porRuta: huellaPorRuta(' M tests/quoteNumber.test.mjs\n', 'diff --git a/tests/quoteNumber.test.mjs b/tests/quoteNumber.test.mjs\n@@\n-uno\n'),
  };
  const despues = {
    ok: true, head: 'abc', huella: 'B',
    porRuta: huellaPorRuta(' M tests/quoteNumber.test.mjs\n', 'diff --git a/tests/quoteNumber.test.mjs b/tests/quoteNumber.test.mjs\n@@\n-otro\n'),
  };

  const q = arbolQuieto(antes, despues);
  assert.equal(q.cambios.length, 1, 'un fichero de test movido tiene que salir como movimiento');
  assert.equal(q.rutas.length, 1);
  assert.equal(q.rutas[0].ruta, 'tests/quoteNumber.test.mjs',
    '🔴 el CIEGO no NOMBRA el fichero que se movió: vuelve a ser inaccionable');

  // Y el veredicto sigue siendo CIEGO: nombrar no es perdonar.
  const v = veredicto({
    cambianEnElArbol: [], censadas: CENSADAS, medidas: DOS_MEDIDAS, controles: CONTROLES_OK, quieto: q,
  });
  assert.equal(v.estado, 'CIEGO', '🔴 la puerta se ha abierto: un fichero de test movido ya no ciega');
  assert.equal(v.salida, SALIDA_CIEGO);
  assert.ok(v.motivos.some((m) => m.includes('tests/quoteNumber.test.mjs')),
    'el motivo del CIEGO tiene que llevar el nombre del fichero');
});

test('SCRUM-813b · 🔴 SUELO: si el detalle por ruta NO ve nada pero la huella global cambió, sigue siendo CIEGO', () => {
  // Sin este suelo, el refinamiento SERÍA un agujero: bastaría con que el troceado por ruta no
  // supiera leer un diff raro para que un árbol movido pasara por quieto. Un detector que no sabe
  // deja la puerta CERRADA, no abierta.
  const iguales = huellaPorRuta('', '');
  const q = arbolQuieto(
    { ok: true, head: 'abc', huella: 'A', porRuta: iguales },
    { ok: true, head: 'abc', huella: 'B', porRuta: iguales },
  );
  assert.equal(q.rutas.length, 0, 'el detalle no ve nada: es el caso que este suelo cubre');
  assert.equal(q.cambios.length, 1, '🔴 el árbol se movió y el instrumento lo da por quieto');
  assert.match(q.cambios[0], /NO supo decir dónde/, 'el motivo tiene que declarar la ceguera, no disimularla');
});

test('SCRUM-813b · CONTROL NEGATIVO: dos marcas iguales NO producen ni un movimiento', () => {
  // Si esto fallara, el instrumento gritaría en cada pasada y acabaría apagado.
  const m = { ok: true, head: 'abc', huella: 'A', porRuta: huellaPorRuta(' M x.mjs\n', '') };
  const q = arbolQuieto(m, { ...m, porRuta: huellaPorRuta(' M x.mjs\n', '') });
  assert.equal(q.cambios.length, 0);
  assert.equal(q.rutas.length, 0);
});

test('SCRUM-813b · la marca REAL trae el detalle, y cuadra con lo que dice git', () => {
  // Control positivo contra git de verdad, sólo lectura: lo que `marcaDelArbol` mete en `porRuta`
  // tiene que ser exactamente lo que `git status --porcelain` está viendo en este árbol. Sin esto,
  // los casos de arriba probarían una función que el instrumento no usa.
  const m = marcaDelArbol();
  if (!m.ok) assert.fail(`no se pudo tomar la marca del árbol: ${m.porque}`);
  assert.ok(m.porRuta instanceof Map, '🔴 la marca ya no trae el detalle por ruta');

  const porcelain = execFileSync('git', ['status', '--porcelain'], { cwd: RAIZ, encoding: 'utf8' });
  const deGit = new Set(porcelain.split('\n').filter((l) => l.trim())
    .map((l) => l.slice(3).trim().split(' -> ').pop()));
  for (const r of deGit) {
    assert.ok(m.porRuta.has(r), `🔴 git ve \`${r}\` con cambios y la marca no lo tiene`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// SCRUM-813c · EL SUJETO DE LA QUIETUD SE ACOTA: lo que la medición JUZGA, no lo que ESCRIBE
//
// EL CIEGO de CI, ya con nombre gracias al detalle de SCRUM-813b:
//
//     árbol 🔴 SE MOVIÓ durante la medición
//        · scrum659/   (no aparecía) → estado:??
//
// Un directorio que la propia tanda crea al correr. Exigir quietud sobre lo que la medición
// escribe es pedirle a la tanda que no corra; exigirla sobre lo que la medición JUZGA —los
// ficheros de `tests/` y de `src/`, que es lo que los guards leen— es la puerta de verdad.
//
// ⛔ LA EXCEPCIÓN ES UNA LISTA CERRADA, NO UNA ZONA FRANCA, y estos casos lo fijan en los dos
//    sentidos: lo declarado no ciega, y TODO lo demás sigue cegando.
// ═════════════════════════════════════════════════════════════════════════════════════════════

/** Dos marcas que sólo difieren en las rutas que se le digan. */
const marcasQueMueven = (rutas) => {
  const antes = { ok: true, head: 'abc', huella: 'A', porRuta: new Map() };
  const despues = { ok: true, head: 'abc', huella: 'B', porRuta: new Map(rutas.map((r) => [r, 'estado:??'])) };
  return [antes, despues];
};

test('SCRUM-813c · ✅ POSITIVO: la tanda escribiendo LO SUYO no ciega — el trinquete EMITE veredicto', () => {
  // Es el caso que se estaba comiendo el instrumento: la pasada funcionaba entera y se callaba.
  //
  // Va con `LISTA_DE_PRUEBA` y no con la real (17-sep-2026): lo que este caso prueba es que una
  // ruta AMPARADA no ciega, y eso no debe depender de que la lista real tenga entradas — hoy está
  // legítimamente a cero. Antes citaba `scrum659/` y cayó el día que esa entrada se retiró.
  const [antes, despues] = marcasQueMueven(['fixture-de-prueba/']);
  const q = arbolQuieto(antes, despues, LISTA_DE_PRUEBA);

  assert.deepEqual(q.cambios, [], '🔴 lo que la propia medición ESCRIBE sigue cegando: no se ha acotado nada');
  assert.equal(q.amparadas.length, 1, 'la ruta declarada tiene que salir, no desaparecer');
  assert.equal(q.amparadas[0].ruta, 'fixture-de-prueba/');

  // Y con el árbol así, el veredicto se EMITE: 3 censadas vistas, 3 censadas. Lo que ya salía.
  const v = veredicto({
    cambianEnElArbol: CENSADAS.map((c) => cambio(c.clave)),
    censadas: CENSADAS,
    medidas: DOS_MEDIDAS,
    controles: CONTROLES_OK,
    quieto: q,
  });
  assert.equal(v.estado, 'OK', `🔴 el trinquete sigue sin emitir veredicto: ${JSON.stringify(v.motivos)}`);
  assert.equal(v.salida, SALIDA_OK);
  assert.equal(v.nuevas.length, 0);
  assert.equal(v.apagadas.length, 0, '🔴 una censada se ha apagado: los tres de SCRUM-592 tienen que seguir ahí');
});

test('SCRUM-813c · 🔴 EL QUE DECIDE: un fichero de TEST tocado a mano DURANTE la medición sigue siendo CIEGO', () => {
  // Si esto dejara de cegar, la puerta se habría apagado en vez de acotarse. Es el caso por el
  // que la comprobación existe: alguien edita lo que la medición JUZGA mientras las dos pasadas
  // corren, y los guards que leen el árbol cambian de veredicto por eso y no por la zona.
  const [antes, despues] = marcasQueMueven(['tests/quoteNumber.test.mjs']);
  const q = arbolQuieto(antes, despues);

  assert.equal(q.amparadas.length, 0, '🔴 un fichero de `tests/` se está amparando como escritura de la tanda');
  assert.equal(q.cambios.length, 1);
  assert.equal(q.rutas[0].ruta, 'tests/quoteNumber.test.mjs', 'el CIEGO tiene que NOMBRARLO');

  const v = veredicto({
    cambianEnElArbol: [], censadas: CENSADAS, medidas: DOS_MEDIDAS, controles: CONTROLES_OK, quieto: q,
  });
  assert.equal(v.estado, 'CIEGO', '🔴 LA PUERTA SE HA APAGADO: tocar un test durante la medición ya no ciega');
  assert.equal(v.salida, SALIDA_CIEGO);
  assert.ok(v.motivos.some((m) => m.includes('tests/quoteNumber.test.mjs')));
});

// 🔴 EL MECANISMO DE AMPARO SE PRUEBA CON UNA LISTA PROPIA, NO CON LA REAL — 17-sep-2026.
//
// Estos casos usaban la lista real y por tanto dependían de que tuviera `scrum659/` dentro. El día
// que esa entrada se retiró (porque SCRUM-824 arregló su causa) se quedaron sin sujeto y cayeron
// SEIS a la vez — no porque el mecanismo se hubiera roto, sino porque estaban midiendo el
// CONTENIDO de la lista creyendo medir su FUNCIONAMIENTO. Con una lista de prueba, el amparo queda
// probado aunque la real esté a cero, que es justo el estado al que se quiere llegar.
//
//     🔒 Un caso que se queda sin sujeto cuando el defecto se arregla estaba atado al defecto,
//        no al mecanismo.
const LISTA_DE_PRUEBA = Object.freeze([Object.freeze({
  ruta: 'fixture-de-prueba/',
  quien: 'tests/scrum813-trinquete-de-zona.test.mjs',
  expresion: '(sintética: sólo para ejercitar el amparo)',
  porque: 'no describe el árbol real — existe para que estos casos no dependan de que la lista '
    + 'real tenga entradas.',
})]);

test('SCRUM-813c · 🔴 la excepción es CERRADA: lo que NO está declarado ciega, aunque se le parezca', () => {
  // Un `src/` cualquiera, y un directorio con nombre PARECIDO al declarado. Los tres ciegan.
  for (const ruta of ['src/core/utils/utils.ts', 'fixture-de-prueba-bis/', 'otro/fixture-de-prueba/']) {
    const [antes, despues] = marcasQueMueven([ruta]);
    const q = arbolQuieto(antes, despues, LISTA_DE_PRUEBA);
    assert.equal(q.amparadas.length, 0, `🔴 \`${ruta}\` se está amparando sin estar declarada`);
    assert.equal(q.cambios.length, 1, `🔴 \`${ruta}\` ha dejado de cegar: la lista se ha vuelto una zona franca`);
  }

  // Y el directorio declarado SÍ ampara lo que cuelga de él — un fixture no es una ruta sola.
  const [a2, d2] = marcasQueMueven(['fixture-de-prueba/pagina-1.pdf']);
  const q2 = arbolQuieto(a2, d2, LISTA_DE_PRUEBA);
  assert.equal(q2.cambios.length, 0, 'un directorio declarado tiene que amparar su contenido');
  assert.equal(q2.amparadas.length, 1);
});

test('SCRUM-813c · 🔴 con la lista VACÍA nada se ampara: cualquier ruta sigue cegando', () => {
  // Éste sustituye al suelo «lista vacía ⇒ CIEGO», retirado el 17-sep-2026 junto con su entrada
  // (la condición de salida estaba escrita en el propio suelo). Aquel suelo protegía contra BORRAR
  // la lista; hoy la lista está legítimamente a cero y lo que hay que proteger es lo contrario:
  // que vaciarla no convierta el árbol en zona franca.
  for (const ruta of ['scrum659/', 'fixture-de-prueba/', 'src/core/utils/utils.ts']) {
    const [antes, despues] = marcasQueMueven([ruta]);
    const q = arbolQuieto(antes, despues, []);
    assert.equal(q.amparadas.length, 0,
      `🔴 con la lista VACÍA se está amparando \`${ruta}\`: el amparo no puede salir de la nada.`);
    assert.equal(q.cambios.length, 1,
      `🔴 con la lista VACÍA, \`${ruta}\` ha dejado de cegar. Vaciar la lista tiene que hacer el `
      + 'trinquete MÁS estricto, no convertirlo en una puerta abierta.');
  }
});

test('SCRUM-813c · la lista declarada es EXACTAMENTE ésta, y cada entrada dice quién y por qué', () => {
  // Fijada por CONTENIDO: si crece, este caso cae y alguien tiene que escribir el motivo aquí Y
  // en la lista. Una lista de excepciones que engorda sola acaba tapando el defecto que evita.
  //
  // 🟢 HOY ESTÁ VACÍA, y llegó a estarlo por el camino bueno. Tenía `scrum659/`; SCRUM-824 arregló
  // ese respaldo a `os.tmpdir()` y **la comprobación de identidad de abajo cazó la entrada
  // caducada** (17-sep-2026) — el guard no se relajó, se retiró la excepción. Vacía es MÁS
  // estricta que con una entrada: sin excepciones, cualquier ruta que se mueva deja el veredicto
  // en CIEGO.
  assert.deepEqual(ESCRITURAS_DE_LA_TANDA.map((e) => e.ruta), [],
    '🔴 HA CAMBIADO LA LISTA DE ESCRITURAS DE LA TANDA. Cada entrada es una ruta que deja de '
    + 'cegar: se añade con su medición delante, nunca para que el trinquete se calle. Y volver a '
    + 'meter una es RETROCEDER: la lista llegó a cero el 17-sep-2026 porque el defecto de origen '
    + 'se arregló, no porque se tapara.');

  for (const e of ESCRITURAS_DE_LA_TANDA) {
    assert.ok(e.quien && e.porque && e.expresion,
      `🔴 \`${e.ruta}\` no dice quién la escribe, por qué, o con qué expresión. Una excepción sin `
      + 'motivo es una lista blanca.');

    // 🔴 ANCLADA POR IDENTIDAD, NO POR POSICIÓN (SCRUM-710b): el fichero tiene que existir Y
    // seguir conteniendo LA EXPRESIÓN que lo hace escribir dentro del árbol.
    //
    // Esto es lo que hace la entrada AUTOVERIFICABLE, y es la mitad que evita que una lista de
    // excepciones se pudra: el día que alguien arregle ese respaldo a `os.tmpdir()`, este caso
    // CAE y obliga a retirar la excepción. Sin él, la entrada seguiría amparando una ruta que ya
    // nadie escribe — y una excepción que sobra es exactamente cómo una lista engorda.
    assert.ok(fs.existsSync(path.join(RAIZ, e.quien)),
      `🔴 \`${e.ruta}\` dice que la escribe \`${e.quien}\`, y ese fichero no existe.`);
    assert.ok(fs.readFileSync(path.join(RAIZ, e.quien), 'utf8').includes(e.expresion),
      `🔴 \`${e.quien}\` ya NO contiene \`${e.expresion}\`. O se arregló —y entonces esta entrada `
      + 'SOBRA y hay que retirarla— o se reescribió y la excepción está amparando otra cosa.');
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// SCRUM-1335b · «AUSENTE» NO ES UN VEREDICTO
//
// EL DEFECTO, MEDIDO el 6-oct-2026 sobre 177 corridas del job: 34 rojos, 289 acusaciones, y las
// 289 eran `pass` en una zona y NADA en la otra. Ninguna pasa/cae. El resultado de la prueba no
// había llegado (el hijo corre con `forceExit`: SCRUM-1405) y el instrumento lo leía como
// «depende de la zona».
//
// LA DECISIÓN (orquestador, SCRUM-1335 c.18387) y sus TRES condiciones, cada una con sus casos:
//
//   ① una diferencia REAL pasa/cae sigue en ROJO ........ casos «🔴 ①»  — y el sembrado de abajo
//   ② «ausente» se DICE, no se calla .................... casos «②»
//   ③ no se apaga: lo que deja de acusar, se cuenta ..... casos «③»
//
// ⛔ LO QUE ESTO NO ES: una lista de excepciones. No hay ningún fichero ni prueba nombrados; lo
//    que cambia es qué cuenta como «dos veredictos distintos».
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1335b · «ausente» NO es un veredicto: pasa en una zona y falta en la otra NO acusa', () => {
  // La forma exacta de las 289: el fichero corre entero en las dos zonas, todo pasa, y a una de
  // las dos le faltan resultados. Ningún `fail` en ninguna parte.
  const { cambian: c } = compararZonas([
    medidaFalsa('A', [['x::uno', 'pass'], ['x::dos', 'pass'], ['x::tres', 'pass']]),
    medidaFalsa('B', [['x::uno', 'pass']]),
  ]);
  assert.deepEqual(c, [],
    '🔴 un resultado que NO LLEGÓ vuelve a contar como «cambia de veredicto». Eso es acusar de '
    + 'depender de la zona a una prueba de la que en una zona no se sabe nada.');
});

test('SCRUM-1335b · ② lo que no se pudo comparar se CUENTA, con su zona: no desaparece', () => {
  const { sinComparar } = compararZonas([
    medidaFalsa('A', [['x::uno', 'pass'], ['x::dos', 'pass'], ['x::tres', 'skip']]),
    medidaFalsa('B', [['x::uno', 'pass']]),
  ]);
  assert.deepEqual(sinComparar.map((s) => s.clave), ['x::dos', 'x::tres'],
    '🔴 lo que deja de acusar se ha CALLADO. La condición es que se diga: «no pude comparar» no '
    + 'es «son iguales», y un cero aquí se leería como que se comparó todo.');
  for (const s of sinComparar) {
    assert.equal(s.porZona.find((p) => p.zona === 'B').veredicto, AUSENTE, 'y dice en qué zona falta');
  }
});

test('SCRUM-1335b · 🔴 ① una diferencia REAL pasa/cae sigue cambiando de veredicto', () => {
  // Con los dos resultados delante no ha cambiado nada: es la acusación de siempre. Y `skip`
  // contra `pass` también son dos veredictos reales.
  const { cambian: c, sinComparar } = compararZonas([
    medidaFalsa('A', [['x::cae', 'pass'], ['x::salta', 'pass'], ['x::igual', 'pass']]),
    medidaFalsa('B', [['x::cae', 'fail'], ['x::salta', 'skip'], ['x::igual', 'pass']]),
  ]);
  assert.deepEqual(c.map((x) => x.clave), ['x::cae', 'x::salta']);
  assert.equal(c.some((x) => x.porElFichero), false, 'se vio con su nombre: no hace falta el fichero');
  assert.deepEqual(sinComparar, []);
});

test('SCRUM-1335b · 🔴 ① una caída REAL cuyo resultado SE PIERDE sigue cambiando: lo dice el fichero', () => {
  // EL CASO QUE DECIDE SI ESTO ES ARREGLAR O APAGAR. La prueba cae sólo en B y su resultado no
  // llega: queda `pass` contra nada, igual que el ruido. Pero el fichero sale con código ≠ 0 en B
  // y `run()` lo entrega como un `fail` con la ruta por nombre — medido con ficheros sembrados, y
  // aunque el resto de resultados del fichero sí lleguen.
  const { cambian: c, sinComparar } = compararZonas([
    medidaFalsa('A', [['x::antes', 'pass'], ['x::cae en B', 'pass']]),
    medidaFalsa('B', [['x::antes', 'pass'], ['x::/ruta/x', 'fail']]),
  ]);
  assert.deepEqual(c.map((x) => x.clave), ['x::/ruta/x'],
    '🔴 SE HA APAGADO: una prueba que cae en una zona sola se escapa en cuanto se pierde su '
    + 'resultado. El fichero cae en B y en A no, y eso no depende de que el resultado llegue.');
  assert.equal(c[0].porElFichero, true);
  assert.deepEqual(sinComparar.map((s) => s.clave), ['x::cae en B']);

  // Y al revés: la caída se VE con su nombre en A y lo que se pierde en B es un `pass`.
  const alReves = compararZonas([
    medidaFalsa('A', [['x::cae en A', 'fail']]),
    medidaFalsa('B', []),
  ]);
  assert.deepEqual(alReves.cambian.map((x) => x.clave), ['x::cae en A'],
    '🔴 un `fail` visto, frente a un fichero que en la otra zona no cae, es un hallazgo');
});

test('SCRUM-1335b · una prueba que cae en las DOS zonas y pierde un resultado NO acusa a la zona', () => {
  // El control negativo de la regla del fichero, y sin él la regla sería «todo `fail` acusa»: aquí
  // el fichero cae en A (se ve la prueba) y TAMBIÉN en B (se ve el fichero). No se sabe si es la
  // misma prueba, así que no se puede comparar — pero desde luego no «cae en una y en la otra no».
  const { cambian: c, sinComparar } = compararZonas([
    medidaFalsa('A', [['x::cae siempre', 'fail']]),
    medidaFalsa('B', [['x::/ruta/x', 'fail']]),
  ]);
  assert.deepEqual(c, [],
    '🔴 se acusa de depender de la zona a un fichero que cae en las dos');
  assert.deepEqual(sinComparar.map((s) => s.clave), ['x::/ruta/x', 'x::cae siempre']);
});

// ── la repesca, que ahora tiene un tercer resultado posible ──────────────────────────────────

const entrada = (clave, a, b, extra = {}) => ({
  clave, fichero: clave.split('::')[0], prueba: clave.split('::')[1],
  porZona: [{ zona: 'A', veredicto: a }, { zona: 'B', veredicto: b }], ...extra,
});
const soloDe = (pares) => new Map(Object.entries(pares).map(([fichero, [a, b]]) => [
  fichero, [medidaFalsa('A', a), medidaFalsa('B', b)],
]));

test('SCRUM-1335b · ③ la repesca COMPARA lo que la tanda no pudo: lo que a solas da igual sale de la cuenta', () => {
  const r = resolverRepesca({
    cambian: [],
    sinComparar: [entrada('x::uno', 'pass', AUSENTE), entrada('x::dos', 'pass', AUSENTE)],
    aSolas: soloDe({ x: [[['x::uno', 'pass'], ['x::dos', 'pass']], [['x::uno', 'pass']]] }),
  });
  assert.deepEqual(r.resueltas.map((c) => c.clave), ['x::uno'],
    '🔴 una prueba que a solas da el MISMO veredicto en las dos zonas se comparó: no puede seguir '
    + 'contando como «no pude comparar»');
  assert.deepEqual(r.sinComparar.map((c) => c.clave), ['x::dos'],
    '🔴 y la que a solas SIGUE sin resultado en una zona tiene que seguir en la cuenta');
  assert.deepEqual(r.confirmadas, []);
});

test('SCRUM-1335b · 🔴 ① lo que la tanda no pudo comparar y a solas CAMBIA es un hallazgo', () => {
  const r = resolverRepesca({
    cambian: [],
    sinComparar: [entrada('x::uno', 'pass', AUSENTE)],
    aSolas: soloDe({ x: [[['x::uno', 'pass']], [['x::uno', 'fail']]] }),
  });
  assert.deepEqual(r.confirmadas.map((c) => c.clave), ['x::uno']);
  assert.deepEqual(r.sinComparar, []);
});

test('SCRUM-1335b · 🔴 ① una diferencia VISTA en la tanda que a solas no se pudo comparar QUEDA EN PIE', () => {
  // La mitad que no se puede regalar: si a solas falta el resultado, la misma pérdida que este
  // cambio deja de acusar serviría para BORRAR un hallazgo. Una diferencia vista con los dos
  // resultados sólo la desmiente otra medida que la vea igual.
  const vista = entrada('x::cae en B', 'pass', 'fail');
  const sinResultado = resolverRepesca({
    cambian: [vista], sinComparar: [],
    aSolas: soloDe({ x: [[['x::cae en B', 'pass'], ['x::/ruta/x', 'fail']], [['x::/ruta/x', 'fail']]] }),
  });
  assert.deepEqual(sinResultado.confirmadas.map((c) => c.clave), ['x::cae en B'],
    '🔴 una diferencia que se VIO ha desaparecido porque a solas faltó un resultado');
  assert.equal(sinResultado.confirmadas[0].sinRefutar, 'sin comparar', 'y dice que nadie la desmintió');
  assert.deepEqual(sinResultado.noConfirmadas, []);

  const sinMedir = resolverRepesca({
    cambian: [vista], sinComparar: [],
    aSolas: new Map([['x', [{ zona: 'A', ok: false, porque: 'murió', veredictos: new Map() }, medidaFalsa('B', [])]]]),
  });
  assert.equal(sinMedir.confirmadas[0]?.sinRefutar, 'sin medir',
    '🔴 una pasada a solas que NO MIDIÓ ha desmentido una diferencia vista');

  // Y el parpadeo sigue siendo parpadeo: a solas se ve en las dos zonas, y da lo mismo.
  const parpadeo = resolverRepesca({
    cambian: [vista], sinComparar: [],
    aSolas: soloDe({ x: [[['x::cae en B', 'pass']], [['x::cae en B', 'pass']]] }),
  });
  assert.deepEqual(parpadeo.confirmadas, [], '🔴 un parpadeo se ha vuelto hallazgo');
  assert.deepEqual(parpadeo.noConfirmadas.map((c) => c.clave), ['x::cae en B']);
});

test('SCRUM-1335b · la repesca por el FICHERO: confirma a la que cambiaba, y nunca a la que sólo faltaba', () => {
  // En la tanda la caída se supo por el fichero; a solas el resultado llega y tiene nombre. Se
  // queda con el nombre — sin esto, una censada cuyo resultado se pierde en la tanda saldría
  // además como una «nueva» que no es.
  const porFichero = entrada('x::/ruta/x', AUSENTE, 'fail', { porElFichero: true });
  const conNombre = resolverRepesca({
    cambian: [porFichero],
    sinComparar: [entrada('x::cae en B', 'pass', AUSENTE)],
    aSolas: soloDe({ x: [[['x::cae en B', 'pass']], [['x::cae en B', 'fail']]] }),
  });
  assert.deepEqual(conNombre.confirmadas.map((c) => c.clave), ['x::cae en B'],
    '🔴 lo que a solas se ve con su nombre tiene que salir UNA vez y con su nombre');

  // Un fichero que a solas no cae en ninguna zona: la caída de la tanda fue un parpadeo.
  const noRepite = resolverRepesca({
    cambian: [porFichero], sinComparar: [],
    aSolas: soloDe({ x: [[['x::cae en B', 'pass']], [['x::cae en B', 'pass']]] }),
  });
  assert.deepEqual(noRepite.confirmadas, []);
  assert.deepEqual(noRepite.noConfirmadas.map((c) => c.clave), ['x::/ruta/x']);

  // 🔴 Y el control negativo: de una prueba que en la tanda sólo «faltaba» no se ha visto NADA. Que
  // su fichero caiga a solas en una zona no la convierte en dependiente de la zona.
  const soloFaltaba = resolverRepesca({
    cambian: [],
    sinComparar: [entrada('x::uno', 'pass', AUSENTE)],
    aSolas: soloDe({ x: [[['x::uno', 'pass']], [['x::/ruta/x', 'fail']]] }),
  });
  assert.deepEqual(soloFaltaba.confirmadas, [],
    '🔴 una caída SIN NOMBRE a solas ha confirmado a una prueba de la que no se sabía nada');
  assert.deepEqual(soloFaltaba.sinComparar.map((c) => c.clave), ['x::uno']);
});

// ── el veredicto y los controles, con lo que no se pudo comparar ─────────────────────────────

test('SCRUM-1335b · ② el VERDE lleva consigo lo que no pudo comparar, y sigue siendo verde', () => {
  const clave = 'tests/x.test.mjs::y';
  const pendientes = [entrada('tests/z.test.mjs::uno', 'pass', AUSENTE), entrada('tests/z.test.mjs::dos', AUSENTE, 'pass')];
  const v = veredicto({
    cambianEnElArbol: [cambio(clave)], censadas: [censada(clave)],
    medidas: DOS_MEDIDAS, controles: CONTROLES_OK, sinComparar: pendientes,
  });
  assert.equal(v.estado, 'OK', '🔴 un resultado que no llegó ha vuelto a poner el trinquete en rojo');
  assert.equal(v.salida, SALIDA_OK);
  assert.deepEqual(v.sinComparar.map((c) => c.clave), pendientes.map((c) => c.clave),
    '🔴 el verde ha perdido la cuenta de lo que no pudo comparar: se ha callado');
});

test('SCRUM-1335b · 🔴 una CENSADA que no se pudo comparar no está viva ni apagada: es CIEGO', () => {
  // Antes, que a la censada le faltara el resultado en una zona contaba como «sigue cambiando» y
  // la alarma se daba por viva sin haberla visto. Llamarla APAGADA sería peor: es acusar a alguien
  // de haberla arreglado en silencio.
  const viva = 'tests/x.test.mjs::sigue cambiando';
  const perdida = 'tests/w.test.mjs::no llegó';
  const v = veredicto({
    cambianEnElArbol: [cambio(viva)],
    censadas: [censada(viva), censada(perdida)],
    medidas: DOS_MEDIDAS, controles: CONTROLES_OK,
    sinComparar: [entrada(perdida, 'pass', AUSENTE)],
  });
  assert.equal(v.estado, 'CIEGO', '🔴 una censada que no se pudo comparar se ha dado por buena');
  assert.equal(v.salida, SALIDA_CIEGO);
  assert.deepEqual(v.apagadas, [], '🔴 y no se la puede llamar APAGADA: no se sabe');
  assert.ok(v.motivos.some((m) => m.includes(perdida)), 'el CIEGO dice cuál');

  // Su fichero cae en una zona y en la otra no, sin el nombre de la prueba: casi seguro es ella,
  // y por eso mismo no se le cuelga a nadie como NUEVA.
  const conFichero = veredicto({
    cambianEnElArbol: [cambio(viva), { ...cambio('tests/w.test.mjs::/ruta/w'), porElFichero: true }],
    censadas: [censada(viva), censada(perdida)],
    medidas: DOS_MEDIDAS, controles: CONTROLES_OK,
    sinComparar: [entrada(perdida, 'pass', AUSENTE)],
  });
  assert.equal(conFichero.estado, 'CIEGO');
  assert.deepEqual(conFichero.nuevas, [], '🔴 la censada perdida ha salido como una NUEVA sin nombre');

  // Y una caída por el fichero en un fichero SIN censadas pendientes sí es una nueva.
  const ajena = veredicto({
    cambianEnElArbol: [cambio(viva), { ...cambio('tests/otro.test.mjs::/ruta/otro'), porElFichero: true }],
    censadas: [censada(viva)], medidas: DOS_MEDIDAS, controles: CONTROLES_OK,
  });
  assert.equal(ajena.estado, 'HABLA');
});

test('SCRUM-1335b · 🔴 un CANARIO que no se pudo comparar no aprueba el autocontrol', () => {
  // Los dos sentidos. Antes, a un dependiente le bastaba FALTAR en una zona para darse por
  // «denunciado»; y un fijado que faltaba salía como «denunciado» — rojo, pero con una mentira.
  for (const c of canarios) {
    const resto = cambian.filter((x) => x.fichero !== c.rutaClave);
    const j = juzgarCanarios(resto, canarios, [entrada(`${c.rutaClave}::su prueba`, 'pass', AUSENTE)]);
    assert.equal(j.ok, false, `🔴 el canario \`${c.fichero}\` no se pudo comparar y el autocontrol pasa`);
    assert.ok(j.fallos.some((f) => f.includes(c.fichero) && f.includes('NO SE PUDO COMPARAR')),
      `el motivo tiene que decir que no se pudo comparar, no otra cosa: ${JSON.stringify(j.fallos)}`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL SEMBRADO · las condiciones ① y ②, por el camino real y no con medidas de mentira
//
// Tres ficheros fabricados FUERA del árbol (como los canarios), medidos por el mismo camino que
// el job: proceso hijo con `TZ`, `run()`, diferencial, repesca a solas, veredicto.
//
//   · `real`     — una prueba que cae sólo en Midway. Se ve en las dos zonas.
//   · `perdida`  — todo pasa; en Midway el fichero deja de escribir su salida. Es la forma de las
//                  289: resultados que existen y no llegan.
//   · `caida-perdida` — una prueba cae sólo en Midway Y allí su resultado no llega.
//
// ⚠️ LA PÉRDIDA SE IMITA, y se dice: la real sólo se ha visto en el runner de Linux y no se
// reproduce en esta casa (0 de 120, SCRUM-1335). Lo que el sembrado demuestra no es la causa: es
// qué hace el instrumento con un resultado que no llega, y que el código de salida del fichero
// llega sin él.
// ═════════════════════════════════════════════════════════════════════════════════════════════

const CABECERA_SEMBRADA = `import test from 'node:test';
import assert from 'node:assert/strict';
const ZONA = Intl.DateTimeFormat().resolvedOptions().timeZone;
`;
const ENMUDECE_EN_MIDWAY = "if (ZONA === 'Pacific/Midway') process.stdout.write = () => true;\n";
const SEMBRADOS = {
  'sembrado-real.test.mjs': `${CABECERA_SEMBRADA}
test('sembrado · pasa en las dos', () => {});
test('sembrado · cae SÓLO en Midway', () => { assert.notEqual(ZONA, 'Pacific/Midway'); });
`,
  'sembrado-perdida.test.mjs': `${CABECERA_SEMBRADA}${ENMUDECE_EN_MIDWAY}
test('sembrado · pasa y en Midway no llega (1)', () => {});
test('sembrado · pasa y en Midway no llega (2)', () => {});
`,
  'sembrado-caida-perdida.test.mjs': `${CABECERA_SEMBRADA}${ENMUDECE_EN_MIDWAY}
test('sembrado · pasa', () => {});
test('sembrado · cae SÓLO en Midway y su resultado no llega', () => { assert.notEqual(ZONA, 'Pacific/Midway'); });
`,
};

const dirSembrado = path.join(dirCanarios, 'sembrado');
fs.mkdirSync(dirSembrado, { recursive: true });
const sembrados = Object.entries(SEMBRADOS).map(([nombre, codigo]) => {
  const ruta = path.join(dirSembrado, nombre);
  fs.writeFileSync(ruta, codigo);
  return { nombre, ruta, rutaClave: path.relative(RAIZ, ruta).split(path.sep).join('/') };
});
const medidasSembradas = ZONAS.map((zona) => medirEnZona({
  zona, ficheros: sembrados.map((s) => s.ruta), raiz: RAIZ,
  salida: path.join(dirSembrado, `${zona.replace(/\W/g, '_')}.json`),
}));
const tandaSembrada = medidasSembradas.every((m) => m.ok)
  ? compararZonas(medidasSembradas) : { cambian: [], sinComparar: [] };
const finalSembrado = resolverRepesca({
  ...tandaSembrada,
  aSolas: repescar({
    candidatas: [...tandaSembrada.cambian, ...tandaSembrada.sinComparar],
    raiz: RAIZ, dirTrabajo: dirSembrado,
  }),
});
const delSembrado = (lista, nombre) => lista
  .filter((c) => c.fichero === sembrados.find((s) => s.nombre === nombre).rutaClave);

test('SCRUM-1335b · SUELO del sembrado: las dos pasadas midieron, y en Midway FALTAN resultados', () => {
  // Sin esto, todo lo de abajo podría pasar sobre un sembrado que no sembró nada: si la imitación
  // de la pérdida dejara de funcionar, «no acusa» se cumpliría porque no habría nada que acusar.
  for (const m of medidasSembradas) assert.equal(m.ok, true, `🔴 la pasada en \`${m.zona}\` no midió: ${m.porque}`);
  const [kiritimati, midway] = medidasSembradas;
  const claveDeLaPerdida = `${sembrados[1].rutaClave}::sembrado · pasa y en Midway no llega (1)`;
  assert.equal(kiritimati.veredictos.get(claveDeLaPerdida), 'pass', '🔴 el sembrado no corrió en Kiritimati');
  assert.equal(midway.veredictos.has(claveDeLaPerdida), false,
    '🔴 EL SEMBRADO NO SIEMBRA: el resultado que tenía que perderse en Midway ha llegado.');
});

test('SCRUM-1335b · 🔴 ① SEMBRADO: una prueba que cae sólo en una zona sale ROJA — llegue o no su resultado', () => {
  // La que se ve en las dos zonas, con su nombre.
  const real = delSembrado(finalSembrado.confirmadas, 'sembrado-real.test.mjs');
  assert.deepEqual(real.map((c) => c.prueba), ['sembrado · cae SÓLO en Midway'],
    '🔴 EL TRINQUETE NO HABLA ante una diferencia pasa/cae vista en las dos zonas');
  assert.deepEqual(real[0].porZona.map((p) => p.veredicto), ['pass', 'fail']);

  // Y la que pierde su resultado justo donde cae: sale igual, por el fichero.
  const perdida = delSembrado(finalSembrado.confirmadas, 'sembrado-caida-perdida.test.mjs');
  assert.equal(perdida.length, 1,
    '🔴 SE HA APAGADO: una prueba que cae sólo en Midway se escapa si allí se pierde su resultado. '
    + `Confirmadas: ${JSON.stringify(finalSembrado.confirmadas.map((c) => c.clave))}`);
  assert.equal(perdida[0].porElFichero, true);

  const v = veredicto({
    cambianEnElArbol: finalSembrado.confirmadas, censadas: [], medidas: medidasSembradas,
    controles: CONTROLES_OK, sinComparar: finalSembrado.sinComparar,
  });
  assert.equal(v.estado, 'HABLA');
  assert.equal(v.salida, SALIDA_HABLA);
  assert.equal(v.nuevas.length, 2, 'dos sembrados dependen de la zona, y son los dos que salen');
});

test('SCRUM-1335b · ② ③ SEMBRADO: resultados que no llegan NO acusan, y salen CONTADOS', () => {
  const nombre = 'sembrado-perdida.test.mjs';
  assert.deepEqual(delSembrado(finalSembrado.confirmadas, nombre), [],
    '🔴 un fichero donde TODO pasa ha salido acusado porque en una zona no llegaron sus resultados');
  const pendientes = delSembrado(finalSembrado.sinComparar, nombre).map((c) => c.prueba);
  for (const prueba of ['sembrado · pasa y en Midway no llega (1)', 'sembrado · pasa y en Midway no llega (2)']) {
    assert.ok(pendientes.includes(prueba),
      `🔴 «${prueba}» no acusa Y TAMPOCO se cuenta: se ha callado. Sin comparar: ${JSON.stringify(pendientes)}`);
  }

  // Sin los dos que caen de verdad, el veredicto es VERDE y lleva la cuenta consigo.
  const v = veredicto({
    cambianEnElArbol: delSembrado(finalSembrado.confirmadas, nombre), censadas: [],
    medidas: medidasSembradas, controles: CONTROLES_OK,
    sinComparar: delSembrado(finalSembrado.sinComparar, nombre),
  });
  assert.equal(v.estado, 'OK');
  assert.equal(v.salida, SALIDA_OK);
  assert.ok(v.sinComparar.length >= 2, '🔴 el verde no dice cuántas no pudo comparar');
});
