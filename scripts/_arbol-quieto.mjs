// scripts/_arbol-quieto.mjs — SCRUM-754
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// ¿ESTABA EL ÁRBOL QUIETO MIENTRAS MEDÍA? — porque un veredicto que no lo sabe no es información.
//
// ── EL HECHO QUE LO TRAE, REPRODUCIDO ANTES DE ESCRIBIR UNA LÍNEA (7-sep-2026, 07:12–07:19) ──
// `meta-guard-mutaciones.mjs` daba, sobre el MISMO fichero y las MISMAS dos declaraciones de
// `scrum751`, veredictos distintos en pasadas consecutivas. Provocado a propósito con un
// agitador que crea y borra un `.mjs` SIN defecto dentro de `tests/`:
//
//     ① árbol quieto ......................... VIVA · VIVA
//     ② árbol moviéndose ..................... CIEGA · CIEGA   ← la oscilación del ticket
//     ③ control: guard REALMENTE mudo, quieto . MUDA
//     ⑤ el MISMO mudo, con el árbol movido .... CIEGA          ← la agitación TAPA la mudez
//
// Y el peor, medido aparte con la línea base EN QUIETO y la agitación entrando SÓLO durante la
// pasada mutada, con una mutación que NO introduce el defecto (veredicto correcto: MUDA):
//
//     🔴 VIVA · MUDA · VIVA · VIVA  —  3 VERDES FALSOS DE 4
//
// O sea que el árbol moviéndose no sólo hace ruido: **firma como vigilante a un guard que no
// vigila**, y encima con `colaterales 0`, así que la instrumentación de SCRUM-784 tampoco lo
// insinúa. Es la peor de las dos averías que el ticket contemplaba.
//
// ── POR QUÉ ES DEFECTO DEL INSTRUMENTO Y NO DE QUIEN AGITE ──────────────────────────────────
// Porque el instrumento **no podía decir sobre qué árbol emitía su veredicto**. `scrum751` barre
// `tests/`, `scripts/`, `src/`, `public/` y `prisma/` con `readdirSync` + `readFileSync`, y en el
// hueco entre los dos un fichero se esfuma: ENOENT → `ilegibles` → su test se pone rojo por algo
// que no tiene NADA que ver con la mutación. Es la clase que SCRUM-740 cerró para SEIS barredores
// con `_barrido-estable.mjs`; `_claves-duplicadas.mjs` (SCRUM-751) nació después y no la adoptó.
// Pero arreglar ese barredor sólo taparía ESTE caso: cualquier guard que lea el árbol tiene la
// misma exposición. Lo que falta es que **el juez sepa decir que no puede juzgar**.
//
// ── CÓMO SE OBSERVA, Y POR QUÉ NO VALE UNA HUELLA ANTES/DESPUÉS ─────────────────────────────
// 🔴 Medido: el agitador crea y BORRA en bucle apretado, así que en las dos fotos —antes y
// después— el fichero está AUSENTE. Una huella antes/después habría dicho «árbol quieto» sobre
// la pasada en la que se fabricaron los tres verdes falsos: habría sido un detector mudo dentro
// del arreglo de un detector mudo. Hace falta observar DURANTE, y para eso está `fs.watch`
// recursivo (medido en esta máquina el 7-sep-2026: ve los 8 ficheros efímeros del agitador).
//
// ── LO QUE `fs.watch` DICE DE MÁS, TAMBIÉN MEDIDO ───────────────────────────────────────────
// En Windows, LEER un fichero emite `change` (libuv pide también FILE_NOTIFY_CHANGE_LAST_ACCESS).
// Censado el 7-sep-2026 sobre los 48 guards del meta-guard corriendo SOLOS: 7 «movían» el perímetro, y los 7
// movían **únicamente `dist/`**, que es lo que importan. Si eso contara como movimiento, siete
// guards sanos saldrían CIEGOS y el instrumento quedaría apagado por el otro lado.
//
// Por eso el aviso de `fs.watch` es sólo un CANDIDATO, y quien decide es el DISCO:
//   · el fichero ya no está ............ MOVIMIENTO (lo borraron, o fue transitorio)
//   · está y su `mtime` es de DESPUÉS .. MOVIMIENTO (lo escribieron mientras medía)
//   · está y su `mtime` es de ANTES .... fue una LECTURA. No es movimiento.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';

/**
 * El perímetro. Son las familias que los guards de la casa LEEN: si una de ellas se mueve
 * mientras se mide, el veredicto puede estar describiendo otro árbol.
 *
 * `dist/` entra a propósito, y cierra un hueco DECLARADO en SCRUM-763: allí quedó escrito que
 * «una sesión que corriera la suite entre dos pasadas sí curaría el árbol sin darse cuenta —eso
 * no está medido—», porque `npm test` empieza por `npm run build`. Con `dist/` dentro del
 * perímetro, una recompilación a mitad de medición deja de ser invisible.
 */
export const FAMILIAS_VIGILADAS = Object.freeze(['tests', 'scripts', 'src', 'public', 'prisma', 'docs', 'dist']);

/**
 * Los eventos de `fs.watch` llegan con retardo. Sin esperarlos, el observador podría cerrar antes
 * del último y devolver «quieto» sin haberlo mirado — que es exactamente el fallo que persigue.
 * 200 ms: medido suficiente en esta máquina para ver los del agitador, y es reloj que se paga una
 * vez por pasada de test, no por fichero.
 */
export const GRACIA_MS = 200;

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * 🔴 EL MARGEN, Y POR QUÉ NO ES UN NÚMERO ELEGIDO A OJO.
 *
 * El corte natural sería «`mtime` posterior a `Date.now()` del arranque». **Medido, y es falso el
 * 97,5 % de las veces**: 400 escrituras hechas ESTRICTAMENTE ANTES de leer el reloj, y 390
 * contadas como posteriores, con un desfase de hasta **+1,76 ms**. `Date.now()` entrega
 * milisegundos ENTEROS y `mtimeMs` trae fracción, así que el fichero escrito un instante antes
 * sale «después».
 *
 * La alternativa de tomar la referencia del PROPIO sistema de ficheros —escribir un fichero y
 * usar su `mtime`— también se midió, y es peor por el otro lado: **211 falsos negativos de 400**,
 * porque dos escrituras seguidas comparten marca. Medida la granularidad aquí: salto mediano
 * 1,0 ms y **máximo 4,0 ms** entre marcas distintas (1.337 escrituras, 553 marcas).
 *
 * Así que el corte lleva margen, y el margen sale de esas dos medidas:
 *
 *     desfase del reloj ..... hasta +1,76 ms
 *     granularidad del FS ... hasta  4,00 ms
 *     MARGEN_MS = 25 ms ..... ~6× la mayor de las dos
 *
 * Comprobado en los DOS sentidos: con margen 0 salen 151 falsos positivos de 200; con 5, 20, 50 y
 * 100 salen **0 falsos positivos y 0 falsos negativos** sobre movimientos a 150 ms de arranque.
 *
 * ⚠️ LO QUE CUESTA, DICHO: los primeros 25 ms de cada pasada no se vigilan. El guard más corto
 * del censo dura 0,3 s, así que es el 8 % del peor caso. Y lo que cae ahí dentro son, sobre todo,
 * las escrituras del PROPIO instrumento, que no se descartan por tiempo sino por bytes
 * (`propias`, abajo). Por eso el margen no puede crecer «por si acaso»: un margen grande se
 * traga movimientos reales, y por eso lleva TOPE además de suelo.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
export const MARGEN_MS = 25;

/** El instante a partir del cual una escritura cuenta como «mientras medía». */
export function instanteDeReferencia(ahora = Date.now()) {
  return ahora + MARGEN_MS;
}

/** Un candidato NO es un movimiento hasta que el disco lo confirma. Devuelve el motivo, o `null`. */
export function porQueEsMovimiento(abs, desdeMs, stat = fs.statSync) {
  let s;
  try {
    s = stat(abs);
  } catch {
    // 🔴 El caso que fabricó los verdes falsos: nació y murió mientras se medía. No está en
    // ninguna foto de antes ni de después, y sólo el observador en vivo sabe que existió.
    return 'apareció y desapareció mientras medía (o lo borraron)';
  }
  if (s.mtimeMs >= desdeMs) return 'lo escribieron mientras medía';
  return null; // estaba y sigue igual: fue una LECTURA, y una lectura no mueve nada
}

/**
 * Abre la vigilancia sobre el perímetro. Devuelve los candidatos que vayan llegando, las familias
 * que NO se han podido vigilar (con su motivo: un hueco callado sería el defecto de siempre) y la
 * forma de cerrarla.
 *
 * `watch` se inyecta para poder ejercitar esto sin depender de la plataforma.
 */
export function abrirVigilancia(raiz, familias = FAMILIAS_VIGILADAS, watch = fs.watch) {
  const candidatos = new Set();
  const sinVigilar = [];
  const abiertas = [];
  for (const fam of familias) {
    const dir = path.join(raiz, fam);
    if (!fs.existsSync(dir)) { sinVigilar.push(`${fam} (no existe)`); continue; }
    try {
      abiertas.push(watch(dir, { recursive: true }, (_ev, f) => {
        if (f) candidatos.add(path.join(dir, String(f)));
      }));
    } catch (e) {
      // Ni se traga ni revienta: se DECLARA. Que una plataforma no sepa vigilar recursivamente es
      // un dato del veredicto, no una excusa para emitirlo igual.
      sinVigilar.push(`${fam} (${e.code || e.message})`);
    }
  }
  return {
    candidatos,
    sinVigilar,
    cerrar: () => { for (const w of abiertas) { try { w.close(); } catch { /* ya cerrado */ } } },
  };
}

/**
 * Los candidatos que el DISCO confirma como movimiento, en rutas relativas y con su motivo.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * 🔴 `propias` · LO QUE ESCRIBIÓ EL PROPIO INSTRUMENTO NO ES «EL ÁRBOL MOVIÉNDOSE»: ES LA
 * MEDICIÓN. Y esto lo destapó la PRIMERA pasada completa con las puertas puestas (7-sep-2026,
 * 07:48→08:07): `vivas 144 · mudas 0 · ciegas 4`, y las CUATRO ciegas eran `scrum765`, con
 * «`scripts/meta-guard-mutaciones.mjs` — lo escribieron mientras medía». Las había escrito YO.
 *
 * El mecanismo, medido: `scrum765` arranca subprocesos que IMPORTAN los dos ficheros que sus
 * declaraciones mutan. En Windows leer emite `change`, así que la pieza mutada entra como
 * candidato; y su `mtime` es el de la escritura de la mutación, que ocurre en el mismo
 * milisegundo en que arranca la medición. El corte `mtime >= desde` la daba por movida.
 *
 * ⛔ NO SE DESCARTA POR RUTA. Una lista de rutas exentas taparía justo lo que hay que ver: que
 * OTRO toque ese mismo fichero mientras se mide. Se descarta por BYTES: si la pieza sigue
 * conteniendo exactamente lo que este proceso escribió, es suya y no se ha movido nada. Si sus
 * bytes ya no son los suyos, eso es MÁS grave que un movimiento cualquiera, y se dice así.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
export function movimientosConfirmados(candidatos, desdeMs, raiz, stat = fs.statSync, propias = null) {
  const out = [];
  const rel = (abs) => path.relative(raiz, abs).split(path.sep).join('/');
  for (const abs of candidatos) {
    const mios = propias && propias.get(abs);
    if (mios) {
      let ahora = null;
      try { ahora = fs.readFileSync(abs); } catch { /* desapareció: se dice abajo */ }
      if (ahora && Buffer.compare(ahora, mios) === 0) continue; // es mi mutación, intacta
      out.push(`${rel(abs)} — ES UNA PIEZA MÍA Y YA NO TIENE MIS BYTES: alguien más la ha tocado `
        + 'mientras la usaba de mutación');
      continue;
    }
    const porque = porQueEsMovimiento(abs, desdeMs, stat);
    if (porque) out.push(`${rel(abs)} — ${porque}`);
  }
  return out.sort();
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * 🔴 EL CONTROL POSITIVO — y no es ceremonia.
 *
 * Un `fs.watch` que se instala sin reventar y luego no entrega NADA es un vigilante mudo, y un
 * vigilante mudo dentro del arreglo de un juez mudo dejaría el ticket exactamente donde estaba,
 * pero con una línea verde encima diciendo que está resuelto. Así que antes de fiarse se le
 * enseña un movimiento fabricado y se le EXIGE verlo.
 *
 * Y las dos mitades, porque una sola no distingue:
 *   ① VE lo que tiene que ver ..... un fichero que nace y muere dentro del perímetro;
 *   ② NO inventa .................. un fichero que sólo se LEE no sale como movimiento.
 * Sin ②, un vigilante que gritara siempre pasaría ① y dejaría el instrumento en CIEGO perpetuo.
 *
 * La sonda se llama con punto delante A PROPÓSITO: todos los barredores de la casa se saltan los
 * nombres que empiezan por punto (`_claves-duplicadas.mjs:77`, entre otros), así que el control
 * positivo no puede poner rojo a nadie. `fs.watch`, en cambio, sí la ve.
 */
// `watch` se inyecta para poder ejercitar el control positivo CON LA CAPA DE PLATAFORMA
// APAGADA, que es la condicion exacta de `ubuntu-latest`: instalada y sin entregar nada.
export async function controlPositivoDeVigilancia(raiz, familias = FAMILIAS_VIGILADAS, watch = fs.watch) {
  const dir = path.join(raiz, 'tests');
  if (!fs.existsSync(dir)) return { ok: false, motivo: 'no hay `tests/` que vigilar' };

  // Restos de un control anterior que muriera a mitad: se barren ANTES, no después (SCRUM-808).
  for (const f of fs.readdirSync(dir)) {
    if (f.startsWith('.quietud-')) fs.rmSync(path.join(dir, f), { force: true });
  }

  // ② La mitad de «no inventa» necesita un fichero que sea INDISCUTIBLEMENTE de antes. Se fabrica
  // y se le retrasa el `mtime` a mano: usar un fichero cualquiera del árbol —`package.json`, que
  // es lo que hacía la primera versión— metía una carrera de milisegundos consigo mismo, porque
  // en una raíz recién creada ese fichero se acababa de escribir y caía DENTRO de la ventana.
  // Cazado por el propio test, que salió rojo diciendo que la vigilancia «inventa». Lo inventado
  // era la medición.
  const viejo = path.join(dir, `.quietud-viejo-${process.pid}.tmp`);
  fs.writeFileSync(viejo, 'fichero anterior a la medición (SCRUM-754)\n');
  const hace = new Date(Date.now() - 60_000);
  fs.utimesSync(viejo, hace, hace);

  const desde = instanteDeReferencia();
  // 🔴 SCRUM-754b · SE ABRE EL OBSERVADOR COMPLETO, no sólo `fs.watch`. Que la vigilancia en vivo
  // no entregue —lo que pasa en `ubuntu-latest`, medido— ya NO apaga el control positivo: la
  // huella antes/después contesta igual, y es la capa que este control tiene que probar.
  const v = abrirObservacion(raiz, familias, watch);

  const sonda = path.join(dir, `.quietud-sonda-${process.pid}-${Date.now().toString(36)}.tmp`);
  try {
    fs.writeFileSync(sonda, 'sonda de vigilancia (SCRUM-754)\n');
    fs.rmSync(sonda, { force: true });
    fs.readFileSync(viejo); // leerlo NO puede convertirlo en movimiento
    await new Promise((s) => setTimeout(s, Math.max(GRACIA_MS, 400)));
  } finally {
    v.cerrar();
    fs.rmSync(sonda, { force: true });
  }

  const movidos = v.movimientos(desde);
  // 🔴 LA SONDA NACIÓ Y MURIÓ: puede salir con su NOMBRE (si `fs.watch` entregó) o como su
  // DIRECTORIO (`tests/`, que es lo que la huella puede decir siempre). Las dos cuentan: lo que
  // se le exige al instrumento es DENUNCIAR el transitorio, no nombrarlo.
  const dirSonda = path.relative(raiz, path.dirname(sonda)).split(path.sep).join('/') + '/';
  const vioLaSonda = movidos.some((m) => m.includes(path.basename(sonda)) || m.startsWith(dirSonda + ' '));
  const inventaLaLectura = movimientosConfirmados([viejo], desde, raiz).length > 0;
  fs.rmSync(viejo, { force: true }); // fuera de la ventana: borrarlo antes generaría su evento

  if (!vioLaSonda) {
    return {
      ok: false,
      motivo: 'el observador NO ha visto un fichero que ha nacido y muerto dentro de `tests/` '
        + 'delante de él — NI por el nombre (vigilancia en vivo) NI por el `mtime` de su '
        + 'directorio (huella antes/después). La huella NO depende de la plataforma, así que esto '
        + 'ya no se arregla declarando CIEGO: o el perímetro no incluye `tests/`, o este sistema '
        + 'de ficheros no actualiza el `mtime` del directorio al crear y borrar una entrada. Hay '
        + 'que ir a mirarlo: sin eso no se puede firmar ningún veredicto sobre este árbol.'
        + (v.sinVigilar.length ? ` (sin vigilar: ${v.sinVigilar.join(', ')})` : ''),
    };
  }
  if (inventaLaLectura) {
    return {
      ok: false,
      motivo: 'la vigilancia cuenta como MOVIMIENTO un fichero que sólo se ha LEÍDO. Con ese '
        + 'criterio saldrían CIEGOS los guards sanos que importan de `dist/`, y el instrumento '
        + 'quedaría apagado por el otro lado.',
    };
  }
  return { ok: true, sinVigilar: v.sinVigilar };
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 LA HUELLA · SCRUM-754b — el observador que NO depende de la plataforma
//
// ── EL HECHO QUE LO TRAE ────────────────────────────────────────────────────────────────────
// El hueco que este fichero dejó DECLARADO se cumplió palabra por palabra: en `ubuntu-latest`
// `fs.watch` recursivo se instala y **no entrega**, así que el control positivo salió rojo y
// `meta:mutaciones` salió CIEGO con exit 2. Y un CIEGO permanente se ignora igual que un rojo
// fijo: el instrumento habría quedado apagado justo donde más falta hace.
//
// ── LO QUE NO SE TOCA ───────────────────────────────────────────────────────────────────────
// La PREGUNTA —«¿estuvo el árbol quieto mientras medía?»— es obligatoria y sigue igual. Lo que
// cambia es el INSTRUMENTO con el que se contesta. Una vigilancia en vivo era UNA forma de
// contestarla, no la pregunta.
//
// ── POR QUÉ UNA HUELLA DE CONTENIDO NO BASTABA, Y QUÉ LA ARREGLA ────────────────────────────
// La cabecera de arriba lo dice, y sigue siendo cierto: el caso que fabricó los tres verdes
// falsos es un fichero que **nace y muere** dentro de la ventana, así que en las dos fotos está
// AUSENTE. Una huella del CONTENIDO habría firmado «árbol quieto» sobre esa misma pasada.
//
// 🔴 Pero el fichero no es el único que deja rastro: **su DIRECTORIO sí lo deja**. Crear o borrar
// una entrada actualiza el `mtime` del directorio que la contiene — POSIX lo garantiza para
// `link`/`unlink` y NTFS hace lo mismo. MEDIDO aquí antes de escribir esto: un fichero creado y
// borrado en el mismo instante deja el directorio con `mtime` DENTRO de la ventana, con el
// fichero ya inexistente.
//
// Así que la huella mira las DOS cosas:
//   · el `mtime` de cada FICHERO ....... lo escribieron mientras medía
//   · el `mtime` de cada DIRECTORIO .... algo NACIÓ o MURIÓ dentro mientras medía
//   · las altas y bajas de rutas ....... apareció / desapareció, con nombre
//
// Y conserva la mitad que impide apagar el instrumento por el otro lado: **LEER no mueve el
// `mtime`**. Es incluso más limpia que `fs.watch`, que en Windows emite `change` al leer y
// obligaba a confirmar cada candidato contra el disco. Los guards que importan de `dist/` —los
// que el censo fechado de la cabecera midió como los únicos que «movían» el perímetro— no
// pueden salir CIEGOS por esta vía. El recuento no se repite aquí: vive en esa medición, con
// su fecha, y copiarlo sería una segunda cifra que envejece sola (SCRUM-737).
//
// ── 🔴 SU LÍMITE, ESCRITO Y NO CALLADO ──────────────────────────────────────────────────────
// ① **No ve un cambio cuyo autor restaure también los tiempos.** Quien escriba un fichero y
//    después le devuelva su `mtime` con `utimes` —y, si creó y borró, también el del
//    directorio— es invisible para esta huella. No es hipotético: `utimesSync` está a una
//    llamada. Lo que NO puede hacer es ocurrir por accidente.
// ② **Dice DÓNDE, no siempre QUÉ.** De un transitorio queda el directorio, no el nombre del
//    fichero: la huella acusa `tests/` y no `tests/x.mjs`. Por eso `fs.watch` NO se retira —
//    donde entrega, añade el nombre; donde no, la huella sigue contestando la pregunta.
// ③ **Granularidad del sistema de ficheros.** Un cambio que caiga dentro del mismo tic de
//    `mtime` que la línea base no se distingue de ella. Es la misma medida que ya sostiene
//    `MARGEN_MS` (aquí: salto mediano 1,0 ms, máximo 4,0 ms), y por eso el corte lleva margen.
// ═════════════════════════════════════════════════════════════════════════════════════════════

/**
 * La huella del perímetro: cada ruta con su `mtime` y si es directorio.
 *
 * 🔴 SUELO DE CEGUERA: si no ve NADA, lanza. Una huella vacía comparada con otra huella vacía da
 * «no se movió nada», que es indistinguible de «no he sabido mirar» — y ése es exactamente el
 * error que este fichero existe para no volver a cometer.
 */
export function huellaDelPerimetro(raiz, familias = FAMILIAS_VIGILADAS) {
  const huella = new Map();
  const sinMirar = [];
  const anda = (dir) => {
    let entradas;
    try {
      entradas = fs.readdirSync(dir, { withFileTypes: true });
      huella.set(dir, { m: fs.statSync(dir).mtimeMs, dir: true });
    } catch (e) {
      // Un directorio que desaparece a mitad del barrido ES movimiento, y se anota como tal en
      // vez de tragarse: `readdir` fallando es un dato, no un contratiempo.
      sinMirar.push(`${dir} (${e.code || e.message})`);
      return;
    }
    for (const d of entradas) {
      const p = path.join(dir, d.name);
      if (d.isDirectory()) { anda(p); continue; }
      try { huella.set(p, { m: fs.statSync(p).mtimeMs, dir: false }); }
      catch (e) { sinMirar.push(`${p} (${e.code || e.message})`); }
    }
  };

  const sinFamilia = [];
  for (const fam of familias) {
    const dir = path.join(raiz, fam);
    if (!fs.existsSync(dir)) { sinFamilia.push(`${fam} (no existe)`); continue; }
    anda(dir);
  }

  if (huella.size === 0) {
    throw new Error(
      'HUELLA CIEGA: el barrido del perímetro no ha visto NI UNA ruta. Comparar dos huellas '
      + 'vacías da «el árbol no se movió», que es lo mismo que «no he mirado» con otra cara. '
      + `Familias pedidas: ${familias.join(', ')}${sinFamilia.length ? ` · sin leer: ${sinFamilia.join(', ')}` : ''}`,
    );
  }
  return { huella, sinFamilia, sinMirar };
}

/**
 * Lo que cambió entre dos huellas, en rutas relativas y con su motivo.
 *
 * `propias` es el mismo descarte por BYTES que usa la vía de `fs.watch`: lo que escribió el
 * propio instrumento es la medición, no el árbol moviéndose. No se descarta por ruta (taparía
 * justo lo que hay que ver: que OTRO toque esa misma pieza mientras se mide).
 */
export function movimientosPorHuella(antes, despues, desdeMs, raiz, propias = null) {
  const out = [];
  const rel = (abs) => path.relative(raiz, abs).split(path.sep).join('/');

  const esMia = (abs) => {
    const mios = propias && propias.get(abs);
    if (!mios) return false;
    let ahora = null;
    try { ahora = fs.readFileSync(abs); } catch { return false; }
    if (Buffer.compare(ahora, mios) === 0) return true;
    out.push(`${rel(abs)} — ES UNA PIEZA MÍA Y YA NO TIENE MIS BYTES: alguien más la ha tocado `
      + 'mientras la usaba de mutación');
    return true;
  };

  for (const [abs, d] of despues) {
    if (!antes.has(abs)) {
      if (esMia(abs)) continue;
      out.push(`${rel(abs)} — apareció mientras medía`);
      continue;
    }
    // 🔴 SE COMPARA CONTRA SU PROPIA LÍNEA BASE, NO CONTRA EL RELOJ — y no es un detalle: es la
    // ventaja que tiene la huella y que `fs.watch` no puede tener.
    //
    // El corte por reloj (`mtime >= desde`) existe porque la vigilancia en vivo NO tiene foto
    // previa: sin ella hay que preguntarle la hora al sistema, y de ahí sale todo el aparato de
    // `MARGEN_MS` (desfase de `Date.now()` + granularidad del FS). Ese margen tiene un coste
    // escrito: **los primeros 25 ms de cada pasada no se vigilan**.
    //
    // MEDIDO al probar esto: el control positivo escribe su sonda dentro de esos 25 ms, así que
    // por reloj el transitorio NO salía. Aquí no hace falta ninguna hora — hay dos fotos, y basta
    // con que el valor haya CAMBIADO. Sin ventana ciega y sin margen que ajustar.
    if (d.m === (antes.get(abs) || {}).m) continue;   // mismo `mtime` que antes: no se tocó
    if (esMia(abs)) continue;
    out.push(d.dir
      // El transitorio: el fichero ya no está, pero su directorio lo delata.
      ? `${rel(abs)}/ — algo nació o murió aquí dentro mientras medía`
      : `${rel(abs)} — lo escribieron mientras medía`);
  }
  for (const [abs] of antes) {
    if (despues.has(abs)) continue;
    if (esMia(abs)) continue;
    out.push(`${rel(abs)} — desapareció mientras medía`);
  }
  return [...new Set(out)].sort();
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * EL OBSERVADOR COMPLETO · las DOS capas, y cuál manda.
 *
 *   ② LA HUELLA (antes/después) — obligatoria, y es la que contesta la pregunta. Puros
 *      `readdir` y `stat`: UNA sola implementación en todas las plataformas, así que ejercitarla
 *      en Windows ejercita exactamente el mismo código que corre en `ubuntu-latest`.
 *   ① `fs.watch` — OPCIONAL, y sólo AÑADE. Donde entrega, pone el NOMBRE del fichero transitorio
 *      que la huella sólo puede situar en su directorio. Donde no entrega —CI de Linux, medido—
 *      no resta nada: la huella sigue contestando.
 *
 * 🔴 POR ESO ESTO YA NO PUEDE SALIR CIEGO POR LA PLATAFORMA. Antes, que `fs.watch` no entregara
 * apagaba el instrumento entero. Ahora es un acompañante: se declara que no entregó y se sigue.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
export function abrirObservacion(raiz, familias = FAMILIAS_VIGILADAS, watch = fs.watch) {
  const { huella: antes, sinFamilia } = huellaDelPerimetro(raiz, familias);
  const vigia = abrirVigilancia(raiz, familias, watch);
  return {
    sinFamilia,
    // Lo que `fs.watch` no ha podido vigilar. Ya NO es motivo de CIEGO: es una nota del veredicto.
    sinVigilar: vigia.sinVigilar,
    cerrar: () => vigia.cerrar(),
    /** Los movimientos confirmados por las dos capas, sin repetir. */
    movimientos(desdeMs, propias = null) {
      const { huella: despues } = huellaDelPerimetro(raiz, familias);
      const porHuella = movimientosPorHuella(antes, despues, desdeMs, raiz, propias);
      const porVigilancia = movimientosConfirmados(vigia.candidatos, desdeMs, raiz, undefined, propias);
      return [...new Set([...porHuella, ...porVigilancia])].sort();
    },
  };
}
