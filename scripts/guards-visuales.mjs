#!/usr/bin/env node
// scripts/guards-visuales.mjs — SCRUM-522
//
// LA PUERTA. Corre los guards de navegador y FALLA si alguno cae.
//
// ── EL PROBLEMA QUE CIERRA ───────────────────────────────────────────────────────────────────
// Nueve guards de navegador quedaban fuera de `npm test` por lentos. Figuraban como cobertura y
// sólo protegían si alguien se acordaba de lanzarlos a mano. Medido: **ninguno de los nueve
// corría en CI**, así que un PR podía romper lo que vigilan y mergear en verde.
//
// ── POR QUÉ NO VALÍA `censo:guards-navegador`, QUE YA LOS EJECUTA ────────────────────────────
// 🔴 Porque MIDE, no juzga. Imprime «verdes: 7 · no verdes: 2» y sale con 0. Engancharlo al
//    workflow habría dado un job VERDE con dos guards rojos dentro — el mismo problema con una
//    capa más de pintura. Aquí el código de salida es el producto.
//
// ── EL REPARTO QUE ELIGIÓ ESTA SALIDA, MEDIDO ───────────────────────────────────────────────
// La duda era si los ~50 s son comprobación o son nueve arranques de navegador (cinco de ellos
// para cargar el MISMO `/index.html`). Medido con procesos reales, mediana de 5:
//
//     levantar el navegador y cerrarlo ....... 0,96 s   → ×9 = 8,7 s = 16 % del total
//     comprobación real ...................... 45,3 s          = 84 %
//     cargar /index.html con el navegador ya abierto ... 0,29 s
//     compartir una sesión para los cinco ahorraría ..... 3,84 s (7 %)
//
// **El coste es la comprobación, no el arranque.** Por eso la salida no es hacerlos más rápidos
// —no hay de dónde—, sino ponerlos donde protejan. Compartir sesión ahorra un 7 % y a cambio
// acopla nueve guards independientes: no compensa hoy.
//
// ── Y POR QUÉ AQUÍ Y NO DENTRO DE `npm test` ────────────────────────────────────────────────
// Meterlos en la tanda con un salto por variable deja el bucle local el doble de largo, o un
// salto que puede llevar meses apagado sin que nadie lo vea. Como job propio del workflow: corren
// en CADA PR, el bucle local sigue rápido, y su rojo llega con nombre propio en vez de
// confundirse con un test.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolverNavegador, SALIDA_NO_ENCONTRADO, SALIDA_NO_ARRANCA, MARCA_ARRANQUE, topeDeArranque } from './_navegador.mjs';
// Se REUSA en vez de escribir una tercera copia: ya vive exportada en los guards de Prisma, y
// su import es inocuo por construccion (su propio cuerpo esta detras de esta misma guarda).
import { esInvocacionDirecta } from './_prisma-client-guard.mjs';
import { esDeNavegador, ficheroDe } from './_solape-de-guards.mjs';
// SCRUM-639 · el 4 de SCRUM-620 NO estaba importado aquí, así que un guard que no pudo
// levantar su servidor se pintaba `rojo(4)` — con la palabra «rojo» delante, que es
// justamente la que significa «he encontrado defectos».
import { SALIDA_SIN_SERVIDOR } from './_servidor.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const TOPE_MS = Number(process.env.GUARDS_VISUALES_TOPE_MS || 240000);

const pkg = JSON.parse(fs.readFileSync(path.join(RAIZ, 'package.json'), 'utf8'));
const scripts = pkg.scripts || {};

/**
 * Los que quedan FUERA de la tanda. Derivado, no a mano: se mira si `test` o `pretest` los
 * mencionan. Lo que corre la tanda ya está vigilado y no hace falta repetirlo aquí.
 */
export function fueraDeLaTanda(s = scripts) {
  const tanda = String(s.test || '') + ' ' + String(s.pretest || '');
  return Object.keys(s)
    .filter((k) => k.startsWith('guard:') && esDeNavegador(s, k))
    .filter((k) => !tanda.includes(k) && !tanda.includes(ficheroDe(s, k) || '\x00'));
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 SCRUM-639 · EL VOCABULARIO SALE DE LA PUERTA.
//
// LO QUE PASABA, literal del runner:
//
//     ✖ guard:contraste   30.1 s   arranque 30.0 s   NO ARRANCA
//     🔴 NO PUDE ARRANCARLO: el navegador ESTÁ y no levanta.
//     Error: Process completed with exit code 1.
//
// La puerta SABÍA que no se había medido nada, lo IMPRIMÍA con esas palabras, y luego salía
// con el mismo 1 que usa para «he encontrado defectos». Desde fuera —que es desde donde se
// mira— las dos cosas eran idénticas. Costó dos días tratando tres PR como sospechosas.
//
// ⚠️ Y NO ERA UNA POLÍTICA DE SALIDA DELIBERADA. Lo que sí está decidido y documentado, en
// este fichero y en `//guards:visuales` de package.json, es que **un guard no verde hace
// fallar el job** («no supo mirar» no es «ha vigilado»). Eso NO se toca: sigue fallando.
// Lo que no estaba escrito en ninguna parte es que todos los fallos compartieran el 1 — y el
// propio fichero ya lo contradecía, porque para SU PROPIA ceguera (lista vacía, sin
// navegador) ya salía con 2. El vocabulario estaba aquí; simplemente no se propagaba desde
// los hijos. Esto lo propaga.
// ═════════════════════════════════════════════════════════════════════════════════════════════

/** Qué significa cada código, y —lo que importa— si el guard LLEGÓ a medir con él. */
export const VOCABULARIO = new Map([
  [0, { etiqueta: 'verde', midio: true }],
  [1, { etiqueta: 'rojo', midio: true }],
  [SALIDA_NO_ENCONTRADO, { etiqueta: 'CIEGO', midio: false }],
  [SALIDA_NO_ARRANCA, { etiqueta: 'NO ARRANCA', midio: false }],
  [SALIDA_SIN_SERVIDOR, { etiqueta: 'SIN SERVIDOR', midio: false }],
]);

/**
 * ¿Ese código significa que el guard llegó a medir? `null` es el tope de la puerta: no llegó.
 *
 * 🔴 UN CÓDIGO DESCONOCIDO CUENTA COMO DEFECTO, no como ceguera, y es deliberado. Las dos
 * equivocaciones no cuestan lo mismo: leer una ceguera como defecto hace perder tiempo
 * —lo que pasó—, pero leer un defecto como ceguera lo convierte en «cosa de infraestructura»,
 * se relanza el job, y el defecto acaba mergeando. Fail-closed en la dirección que importa.
 */
export function llegoAMedir(codigo) {
  if (codigo === null || codigo === undefined) return false;
  const v = VOCABULARIO.get(codigo);
  return v ? v.midio : true;
}

/**
 * El veredicto de la tanda entera: qué código saca el PROCESO y con qué palabras.
 *
 * PURA y sin `process`, para que el control de las dos direcciones corra en `npm test` en
 * milisegundos en vez de necesitar nueve navegadores — que es lo que hoy hace que nadie lo
 * ejercite. La reproducción de punta a punta está en `docs/master/SCRUM-639.md`.
 *
 * LA REGLA, y su motivo:
 *   · nadie no-verde ......................... 0
 *   · alguien MIDIÓ y encontró algo .......... 1, aunque otros se quedaran ciegos. Un defecto
 *     no se puede relanzar hasta que desaparezca; y que la cobertura fue parcial se DICE.
 *   · nadie midió ............................ el código de la ceguera (2, 3 o 4), para que
 *     «no llegué a medir» tenga puerta propia. Si los ciegos no coinciden entre ellos, o si
 *     no dieron código (tope), sale 2 — que es el «no supe mirar» que esta puerta YA usaba
 *     para su propia ceguera, no un número nuevo.
 */
export function veredicto(filas) {
  const noVerdes = filas.filter((f) => f.estado !== 'verde');
  if (noVerdes.length === 0) {
    return { codigo: 0, midio: true, titulo: 'VERDE', detalle: 'los ' + filas.length + ' guards de navegador están verdes.', ciegos: 0, defectos: 0 };
  }
  const conDefecto = noVerdes.filter((f) => llegoAMedir(f.codigo));
  const ciegos = noVerdes.filter((f) => !llegoAMedir(f.codigo));

  if (conDefecto.length > 0) {
    const quienes = conDefecto.map((f) => f.g).join(', ');
    return {
      codigo: 1, midio: true, defectos: conDefecto.length, ciegos: ciegos.length,
      titulo: 'DEFECTOS (salida 1) · ' + conDefecto.length + ' guard(s) midieron y encontraron algo',
      detalle: 'Han medido y hay hallazgos: ' + quienes + '.'
        + (ciegos.length ? ' ⚠️ Y ADEMÁS ' + ciegos.length + ' guard(s) NO llegaron a medir (' + ciegos.map((f) => f.g + ': ' + f.estado).join(', ') + '), así que esta tanda NO es la lista completa de defectos.' : ''),
    };
  }

  const codigos = [...new Set(ciegos.map((f) => f.codigo).filter((c) => c !== null && c !== undefined))];
  const codigo = codigos.length === 1 ? codigos[0] : SALIDA_NO_ENCONTRADO;
  const etiqueta = VOCABULARIO.get(codigo) ? VOCABULARIO.get(codigo).etiqueta : 'CIEGO';
  return {
    codigo, midio: false, defectos: 0, ciegos: ciegos.length,
    titulo: 'NO MEDIDO (salida ' + codigo + ') · ' + etiqueta + ' en ' + ciegos.length + ' guard(s)',
    detalle: 'NINGUN guard llegó a medir: ' + ciegos.map((f) => f.g + ': ' + f.estado).join(', ')
      + '. Esto NO es un hallazgo de contraste ni de accesibilidad: no se ha comprobado nada.'
      + (codigos.length > 1 ? ' (Los ciegos no coinciden entre ellos, así que sale el 2 genérico.)' : ''),
  };
}

/**
 * Que la distinción se vea SIN abrir el log.
 *
 * Una ANOTACIÓN de GitHub Actions sale en la pestaña de checks del PR, y el RESUMEN se
 * renderiza en la página del run: los dos se leen sin entrar en la salida del job. Es el
 * mismo mecanismo que ya usa `.github/workflows/zona-roja.yml` (y que vigila
 * `tests/scrum168-zona-roja.test.mjs`), reusado en vez de inventar un segundo.
 *
 * Se emite desde AQUÍ y no desde el workflow a propósito: el workflow sólo ve un código de
 * salida y no sabe distinguir los desenlaces; este fichero sí. Y en local no se emite nada,
 * para no ensuciar una salida que alguien pueda estar leyendo.
 */
export function anuncio(v) {
  const cuerpo = String(v.detalle).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
  return { anotacion: '::error title=' + v.titulo + '::' + cuerpo,
    resumen: '### 🔴 guards de navegador — ' + v.titulo + '\n\n' + v.detalle + '\n' };
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 SCRUM-645 · LA PUERTA TIRABA LOS TRAMOS, Y ES LA SEGUNDA VEZ QUE TIRA INFORMACIÓN
//
// SCRUM-642 partió `⟦arranque⟧` en tramos —`proceso+ws` y `primera-página`, cada uno con su
// propio presupuesto de tope— para poder saber DÓNDE se va el tiempo del arranque en frío. Y
// aquí no se veía ni uno: esta puerta reproduce la salida cruda del guard **sólo cuando NO sale
// verde**, y para los verdes pinta su propia columna con el total reformateado. Medido en una
// tanda real con el tope a 180 s: **0 apariciones de `proceso+ws`, 9 de la columna de la puerta.**
//
// O sea que el guard SÍ emitía el desglose y la puerta lo tiraba. Y no es la primera: en
// SCRUM-639 el vocabulario de códigos existía dentro y no salía fuera. Dos veces es un patrón,
// y por eso esto no se arregla sólo pintando: se pone un TRINQUETE.
//
// ── EL TRINQUETE, Y POR QUÉ LA LISTA SE ESCRIBE A MANO ───────────────────────────────────────
// 🔴 `TRAMOS_QUE_LA_TABLA_PINTA` **NO se importa de `_navegador.mjs` a propósito.** Si la puerta
// heredara la lista de quien emite, un tramo nuevo entraría aquí solo: o se pintaría sin que
// nadie hubiera decidido enseñarlo, o —peor— caería en un hueco y se tragaría en silencio, que
// es exactamente el defecto que este ticket cierra. Escrita a mano, un tramo que esta tabla no
// conoce **PARA LA TANDA** y obliga a decidir. Duplicar la lista es el precio del trinquete, y
// se paga a sabiendas.
// ═════════════════════════════════════════════════════════════════════════════════════════════

/** Los tramos que esta tabla sabe pintar. Ver arriba: se escribe a mano, no se importa. */
export const TRAMOS_QUE_LA_TABLA_PINTA = ['proceso+ws', 'primera-página'];

/**
 * Lee la línea de `⟦arranque⟧` ENTERA, no sólo el total.
 *
 * Devuelve `null` si el guard no emitió marca — eso no es tirar nada, es que no había. Si la
 * emitió pero trae algo que esta tabla no sabe nombrar, sale en `desconocidos` y el trinquete
 * de abajo se encarga.
 */
export function leerArranque(salida, marca = MARCA_ARRANQUE) {
  // 🔴 SCRUM-673 · LA ULTIMA, NO LA PRIMERA. Esto era `.find()`, o sea la PRIMERA marca, y las
  // siguientes se tiraban EN SILENCIO. Con eso el informe se contradecia a si mismo: un guard
  // que arranco bien (0,3 s) y despues murio esperando emitia DOS marcas, y la tabla pintaba
  // «COMPLETA · proceso+ws 0.3 s» debajo de una fila que decia NO ARRANCA. Quien leia solo el
  // desglose concluia que habia arrancado bien.
  //
  // El desenlace de un arranque es el ULTIMO emitido. Y desde que hay REINTENTOS (parte A)
  // esto deja de ser raro: un arranque con dos intentos emite dos marcas SIEMPRE, y con
  // `.find()` la tabla se quedaria congelada en el primer intento fallido.
  const todas = String(salida || '').split(String.fromCharCode(10)).filter((l) => l.includes(marca));
  const linea = todas.length ? todas[todas.length - 1] : undefined;
  // Los intentos anteriores NO se tiran: se cuentan, para que la tabla diga «costo dos».
  const intentos = todas.length;
  if (!linea) return null;
  const cabecera = linea.match(new RegExp(marca + ' ([0-9.]+) s (COMPLETA|CORTADA EN «([^»]+)»)'));
  if (!cabecera) {
    // Hay marca y no se entiende. NO se cae al total a secas: eso es justo tragarse lo que no
    // se sabe leer, y volveríamos a la columna de un solo número sin que nadie se entere.
    const soloTotal = linea.match(new RegExp(marca + ' ([0-9.]+)'));
    return {
      total: soloTotal ? Number(soloTotal[1]) : null,
      desenlace: null, cortadoEn: null, tramos: [], desconocidos: [linea.trim()], intentos,
    };
  }
  const desconocidos = [];
  const cortadoEn = cabecera[3] || null;
  if (cortadoEn && !TRAMOS_QUE_LA_TABLA_PINTA.includes(cortadoEn)) desconocidos.push(cortadoEn);

  const tramos = [];
  for (const trozo of linea.slice(cabecera.index + cabecera[0].length).split(' · ')
    .map((t) => t.trim()).filter(Boolean)) {
    const nombre = TRAMOS_QUE_LA_TABLA_PINTA.find((t) => trozo.startsWith(t + ' '));
    if (nombre) tramos.push({ nombre, valor: trozo.slice(nombre.length).trim() });
    else desconocidos.push(trozo);
  }
  return {
    total: Number(cabecera[1]),
    desenlace: cabecera[2].startsWith('CORTADA') ? 'CORTADA' : 'COMPLETA',
    cortadoEn, tramos, desconocidos, intentos,
  };
}

/**
 * La segunda línea de la tabla: el desglose, TAMBIÉN para los guards verdes — que es el ticket.
 * `null` cuando no hay marca, para no ensuciar la tabla con una línea vacía.
 */
export function lineaDeTramos(a) {
  if (!a || !a.desenlace) return null;
  return '       └ arranque ' + a.desenlace + (a.cortadoEn ? ' EN «' + a.cortadoEn + '»' : '')
    + a.tramos.map((t) => ' · ' + t.nombre + ' ' + t.valor).join('')
    // SCRUM-673 · si costo mas de un intento, se DICE: un arranque que necesito reintentar es
    // un runner cargado, y esa senal es la que hay que ver acumularse ANTES de que vuelva a
    // tumbar el CI. Callarla seria volver a tirar informacion que el guard si emite.
    + (a.intentos > 1 ? ' · ' + a.intentos + ' intentos' : '');
}

/**
 * EL TRINQUETE. Qué guards emitieron algo que esta tabla no sabe pintar.
 *
 * PURA, como `veredicto`, para que el control corra en `npm test` en milisegundos en vez de
 * necesitar nueve navegadores — que es lo que hace que un guard así no lo ejercite nadie.
 */
export function loQueLaTablaNoSabePintar(filas) {
  return filas
    .filter((f) => f.marca && f.marca.desconocidos && f.marca.desconocidos.length > 0)
    .map((f) => ({ g: f.g, desconocidos: f.marca.desconocidos }));
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 SCRUM-522 (24-ago-2026) · DE AQUÍ ABAJO SÓLO SE EJECUTA SI ESTO SE LANZA COMO SCRIPT.
//
// LO QUE PASABA, y es el segundo fallo que trajo este ticket de vuelta: todo esto estaba en el
// nivel superior del módulo, y `tests/scrum522-guards-fuera-de-la-tanda.test.mjs` hace
//
//     import { fueraDeLaTanda } from '../scripts/guards-visuales.mjs';
//
// O sea que **IMPORTAR la puerta la EJECUTABA**: el test lanzaba los nueve guards y luego moría
// en el `process.exit` del final. En el runner tardó 68 s y salió como `'test failed'` a nivel de
// FICHERO, sin nombrar un solo assert — porque no falló ningún assert: se murió el proceso.
//
// Y no era «lo mismo que el fallo del navegador» aunque lo pareciera. Se midió: con `EDGE_PATH`
// rota —un fallo DISTINTO del sandbox de CI— el fichero de test se cae exactamente igual. Son
// dos causas, y ésta sobrevive al arreglo de la otra: sin esta guarda, importar la puerta seguiría
// metiendo los nueve guards DENTRO de `npm test`, que es justo lo que el diseño de este fichero
// dice que evita a propósito («por qué aquí y no dentro de npm test», arriba).
//
// `esInvocacionDirecta` se REUSA en vez de reescribirse: compara rutas resueltas y no texto,
// porque `import.meta.url` viene percent-encodeada y `argv[1]` no — en cualquier ruta con un
// espacio la comparación ingenua da `false` y el fichero se vuelve un no-op silencioso. Esa
// trampa ya costó un `pretest` que pasaba sin comparar nada (SCRUM-429).
// ═════════════════════════════════════════════════════════════════════════════════════════════
if (!esInvocacionDirecta(import.meta.url, process.argv[1])) {
  // Importado: se exporta `fueraDeLaTanda` y NADA MÁS. Ni un spawn, ni un exit.
} else {
  await puerta();
}

async function puerta() {
const lista = fueraDeLaTanda();

// ── 🔴 SUELO ────────────────────────────────────────────────────────────────────────────────
// «Todos los guards corren» y «no supe mirar los scripts» son el mismo resultado con
// significados opuestos. Un cero aquí sería el segundo disfrazado del primero.
if (lista.length === 0) {
  console.error('🔴 CIEGO: cero guards de navegador fuera de la tanda.');
  console.error('   O se han metido todos en `npm test` —y entonces esta puerta sobra y hay que');
  console.error('   retirarla a mano—, o el detector dejó de reconocerlos por su //comentario.');
  console.error('   No se anuncia «todo corre» sobre una lista vacía.');
  process.exit(2);
}

// ── Y QUE HAYA NAVEGADOR, dicho antes de empezar ────────────────────────────────────────────
const nav = resolverNavegador();
if (!nav.ok) {
  console.error('🔴 NO SUPE MIRAR: ' + nav.motivo);
  process.exit(2);
}

console.log('guards de navegador FUERA de `npm test`: ' + lista.length);
console.log('navegador: ' + nav.quien + ' → ' + nav.ruta + '\n');

let fallos = 0;
let total = 0;
const filas = [];

for (const g of lista) {
  const f = ficheroDe(scripts, g);
  const abs = f && path.join(RAIZ, f);
  if (!f || !fs.existsSync(abs)) {
    console.error('   🔴 CIEGO · ' + g + ': está declarado y su fichero no está en el disco.');
    fallos += 1; continue;
  }
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [abs], { cwd: RAIZ, timeout: TOPE_MS, encoding: 'utf8' });
  const ms = Date.now() - t0;
  total += ms;

  const cortado = r.error && r.error.code === 'ETIMEDOUT';
  // SCRUM-522 · TRES desenlaces malos y no dos. El 3 —«lo hay y no arranca»— es nuevo y tiene
  // nombre propio porque antes salía como `rojo(1)`, indistinguible de «he encontrado defectos»:
  // el runner llevaba un guard que no había medido NADA y se leía como un hallazgo real.
  // SCRUM-639 · el código del hijo se GUARDA, no sólo se pinta: es lo que la puerta necesita
  // para no volver a colapsarlo todo en su propio 1 al salir. Y el 4 entra en la escalera.
  const codigo = cortado ? null : r.status;
  const estado = cortado ? 'TOPE'
    : (codigo === 0 ? 'verde'
      : (codigo === SALIDA_NO_ENCONTRADO ? 'CIEGO'
        : (codigo === SALIDA_NO_ARRANCA ? 'NO ARRANCA'
          : (codigo === SALIDA_SIN_SERVIDOR ? 'SIN SERVIDOR' : 'rojo(' + codigo + ')'))));
  const salida = (r.stdout || '') + (r.stderr || '');
  // SCRUM-617 (2a vuelta) · el ARRANQUE, aparte del total. El total mezcla arrancar y comprobar,
  // y con un solo numero no se sabe cual de las dos se disparo — que es justo la pregunta abierta
  // desde que el runner mato a guard-contraste en el tope de arranque.
  // SCRUM-645 · se lee la línea ENTERA, no sólo el total: el desglose de SCRUM-642 llegaba aquí
  // y se tiraba para todo el que salía verde.
  const marca = leerArranque(salida);
  const arranque = marca && marca.total !== null ? marca.total : null;
  filas.push({ g, ms, estado, codigo, arranque, marca, salida });
  console.log('   ' + (estado === 'verde' ? '✔' : '✖') + ' ' + g.padEnd(26)
    + String((ms / 1000).toFixed(1)).padStart(6) + ' s'
    + (arranque === null ? '   (arranque: ?)' : '   arranque ' + arranque.toFixed(1).padStart(5) + ' s')
    + '   ' + estado);
  // La segunda línea es el ticket: los tramos se enseñan TAMBIÉN cuando el guard pasa. Antes
  // sólo se veían si moría, y con el tope subido morir es justo lo que deja de pasar.
  const desglose = lineaDeTramos(marca);
  if (desglose) console.log(desglose);
  // 🔴 CIEGO cuenta como fallo. Un guard que no supo mirar no ha vigilado nada, y dejarlo pasar
  //    sería exactamente el hueco que este ticket viene a cerrar.
  if (estado !== 'verde') fallos += 1;
}

console.log('\n── TOTAL ' + '─'.repeat(48));
console.log('   ' + lista.length + ' guards · ' + (total / 1000).toFixed(1) + ' s en serie'
  + '   ·   verdes: ' + (filas.length - filas.filter((f) => f.estado !== 'verde').length)
  + ' · no verdes: ' + filas.filter((f) => f.estado !== 'verde').length);

// ── 🔴 EL TRINQUETE (SCRUM-645) ─────────────────────────────────────────────────────────────
// Va ANTES del volcado de los no verdes a propósito: si la puerta no entiende lo que lee, lo que
// venga después ya no es de fiar. Y para con el 2 —«no supe mirar»—, que es el código que esta
// puerta YA usa para su propia ceguera; no hace falta uno nuevo.
const ciega = loQueLaTablaNoSabePintar(filas);
if (ciega.length) {
  console.error('\n' + '═'.repeat(72));
  console.error('🔴 NO SUPE PINTAR lo que los guards SÍ dijeron. La tanda para aquí.');
  console.error('═'.repeat(72));
  for (const c of ciega) console.error('   ' + c.g + '  →  ' + c.desconocidos.join('  |  '));
  console.error('\n   Un guard ha emitido en su ⟦arranque⟧ algo que esta tabla no conoce, y eso NO se');
  console.error('   ignora. Es la SEGUNDA vez que esta puerta tira información que el guard sí emite');
  console.error('   —la primera fue el vocabulario de códigos (SCRUM-639)—, y un campo tragado en');
  console.error('   silencio es un verde con menos información: la peor forma de romper esto.');
  console.error('\n   Se arregla DECIDIENDO: si el tramo nuevo hay que enseñarlo, se añade a');
  console.error('   `TRAMOS_QUE_LA_TABLA_PINTA`, en este mismo fichero. Esa lista se escribe a mano');
  console.error('   a propósito: importándola de `_navegador.mjs` esto no saltaría jamás.');
  process.exit(SALIDA_NO_ENCONTRADO);
}

if (fallos) {
  console.error('\n' + '═'.repeat(72));
  console.error('🔴 ' + fallos + ' guard(s) de navegador no están verdes. Lo que dijeron:');
  console.error('═'.repeat(72));
  for (const f of filas.filter((x) => x.estado !== 'verde')) {
    console.error('\n── ' + f.g + '  [' + f.estado + '] ' + '─'.repeat(Math.max(0, 50 - f.g.length)));
    // Se reproduce SU salida entera: si hay que abrir el fichero del guard para saber qué pasó,
    // el rojo llega un día tarde.
    console.error(f.salida.trimEnd() || '   (sin salida)');
  }
  // SCRUM-639 · aquí vivía el colapso: `process.exit(1)` para todo, incluida una tanda en la
  // que ningún guard llegó a medir. Ahora el código lo decide `veredicto`, que es puro y está
  // probado en las dos direcciones.
  const v = veredicto(filas);
  console.error('\n' + v.titulo);
  console.error(v.detalle);
  // Y que se vea sin abrir el log.
  if (process.env.GITHUB_ACTIONS) {
    const a = anuncio(v);
    console.log(a.anotacion);
    if (process.env.GITHUB_STEP_SUMMARY) {
      try { fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, a.resumen); } catch { /* el resumen es un extra: si no se puede escribir, el código de salida sigue siendo el bueno */ }
    }
  }
  process.exit(v.codigo);
}
console.log('\n✅ los ' + lista.length + ' guards de navegador están verdes.');
}
