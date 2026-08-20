// scripts/_solape-de-guards.mjs — SCRUM-548
//
// ¿CUÁNTOS GUARDS DE NAVEGADOR LEVANTAN UNO SOBRE LA MISMA PÁGINA?
//
// ── DE DÓNDE SALE ESTA PREGUNTA ──────────────────────────────────────────────────────────────
// SCRUM-546 encontró dos guards escritos con dos días de diferencia midiendo la misma página. No
// lo encontró un instrumento: lo encontró **una persona mirando `package.json` a mano porque
// tenía un conflicto de merge delante**. Lo mismo con el control negativo ciego de
// `guard:primera-pantalla`.
//
//     Los dos hallazgos fueron suerte del conflicto, no del proceso. Y la suerte se acaba.
//
// Esto es la parte de esa revisión manual que SÍ se puede derivar, y cuesta milisegundos: a qué
// página va cada guard. El censo de SCRUM-546 dice cuántos hay y qué cuestan; no decía que varios
// pagaran el arranque de un navegador por la misma página.
//
// ── 🔴 LO QUE NO SE PUEDE RESOLVER SE DICE, NO SE CUENTA COMO «SIN SOLAPE» ───────────────────
// `guard-contraste.mjs` saca sus páginas de una función (`paginasDelProducto()`), así que su
// destino NO es derivable leyendo el fichero. Marcarlo como «sin solape» sería el fallo cómodo:
// haría bajar el número sin que nadie lo supiera. Sale como `DERIVADO` y el informe dice que
// cualquier solape suyo es invisible para este detector.
//
// ── LA AUTORIDAD SIGUE SIENDO package.json ───────────────────────────────────────────────────
// La población sale de los `guard:*` DECLARADOS, igual que en SCRUM-546: lo que existe es lo que
// alguien puede ejecutar. Si los comandos se mudaran de fichero, esto dejaría de ver lo que
// cuenta — y por eso no se mudan.
import fs from 'node:fs';
import path from 'node:path';

/** Un guard es «de navegador» si su propia documentación dice que levanta uno. */
export function esDeNavegador(scripts, nombre) {
  return /puppeteer|navegador/i.test(String(scripts['//' + nombre] || ''));
}

/** El fichero que ejecuta, extraído del comando declarado. */
export function ficheroDe(scripts, nombre) {
  const m = String(scripts[nombre] || '').match(/scripts\/[A-Za-z0-9._-]+\.mjs/);
  return m ? m[0] : null;
}

/**
 * A qué página va un guard, leyendo sus `page.goto(...)`.
 *
 * Devuelve `{ rutas: [...], derivado: bool }`. `/` y `/index.html` son LA MISMA PÁGINA y se
 * normalizan: sin eso, cinco guards sobre la landing parecerían dos grupos de dos y uno suelto.
 */
export function objetivoDe(raiz, rel) {
  const abs = path.join(raiz, rel);
  if (!fs.existsSync(abs)) return { rutas: [], derivado: false, error: 'no existe ' + rel };
  const src = fs.readFileSync(abs, 'utf8');

  const rutas = new Set();
  let derivado = false;

  // El primer argumento de `.goto(...)`, entero. Se coge hasta la coma o el paréntesis de cierre
  // del mismo nivel, porque la casa lo escribe de DOS formas y las dos hay que entenderlas:
  //   `http://127.0.0.1:${PUERTO}/index.html`        (plantilla)
  //   'http://127.0.0.1:' + puerto + '/index.html'   (concatenación)
  // La primera versión de esto sólo cazaba hasta la primera comilla, y la forma concatenada le
  // salía como «http://127.0.0.1:» — tres guards distintos con el mismo destino inventado.
  for (const m of src.matchAll(/\.goto\(([\s\S]*?)(?:,\s*\{|\)\s*;|\)\s*\n)/g)) {
    const arg = m[1];
    // Los trozos LITERALES se conservan; todo lo que sale de una variable se marca con \x00.
    let junto = '';
    const re = /([`'"])((?:\\.|(?!\1)[\s\S])*?)\1|(\$\{[^}]*\})|([^`'"\s+]+)/g;
    let x;
    while ((x = re.exec(arg))) {
      if (x[1]) junto += x[2].replace(/\$\{[^}]*\}/g, '\x00');
      else if (x[3]) junto += '\x00';
      else junto += '\x00';                       // identificador suelto de una concatenación
    }
    // Fuera el host y el puerto (el puerto SIEMPRE es variable → UN \x00, exactamente uno).
    // ⚠️ Con `\x00*` —codicioso— se comía también la variable de la RUTA, y `${PUERTO}${ruta}`
    //    quedaba en cadena vacía, o sea `/index.html`. Eso convertía «no sé a dónde va» en «va a
    //    la landing»: un destino inventado, y encima hacia el lado cómodo, porque hacía que el
    //    detector dijera «no resueltos: ninguno» cuando había uno.
    const resto = junto.replace(/^https?:\/\/127\.0\.0\.1:\x00/, '');
    if (resto.includes('\x00')) { derivado = true; continue; }   // el destino sale de una variable
    rutas.add(resto === '' || resto === '/' ? '/index.html' : resto);   // la raíz ES index.html
  }
  return { rutas: [...rutas], derivado };
}

/** El censo completo: cada guard de navegador con su destino, y los grupos que se solapan. */
export function censarSolape(raiz) {
  const pkg = JSON.parse(fs.readFileSync(path.join(raiz, 'package.json'), 'utf8'));
  const scripts = pkg.scripts || {};
  const declarados = Object.keys(scripts).filter((k) => k.startsWith('guard:'));
  const navegador = declarados.filter((g) => esDeNavegador(scripts, g));

  const fichas = navegador.map((g) => {
    const f = ficheroDe(scripts, g);
    return { guard: g, fichero: f, ...(f ? objetivoDe(raiz, f) : { rutas: [], derivado: false, error: 'sin fichero declarado' }) };
  });

  const porRuta = new Map();
  for (const f of fichas) for (const r of f.rutas) {
    if (!porRuta.has(r)) porRuta.set(r, []);
    porRuta.get(r).push(f.guard);
  }
  const solapes = [...porRuta.entries()]
    .filter(([, gs]) => gs.length > 1)
    .map(([ruta, gs]) => ({ ruta, guards: gs.sort() }))
    .sort((a, b) => b.guards.length - a.guards.length);

  return {
    declarados: declarados.length,
    navegador: navegador.length,
    fichas,
    solapes,
    // Lo que este detector NO puede ver, contado aparte para que no se lea como «limpio».
    noResueltos: fichas.filter((f) => f.derivado || f.error).map((f) => f.guard),
  };
}
