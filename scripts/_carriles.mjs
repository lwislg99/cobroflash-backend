// SCRUM-1295 · Carriles: la tabla de docs/equipo/dos-equipos.md §3 convertida en un mapa que se
// puede CONSULTAR. Funciones puras, sin E/S: las usan el generador (scripts/carriles.mjs), los hooks
// (.claude/hooks/carril.mjs, identidad.mjs) y el guard (tests/scrum1295-carriles.test.mjs).
//
// Una fila de §3 produce una REGLA por cada ruta entre comillas invertidas de su primera celda:
//   · `src/modules/invoicing/**`            → tal cual (patrón con `**`/`*`)
//   · `system/app/routes/x.ts`, `x.ts`       → se resuelve contra los ficheros del repo bajo la raíz de
//                                              la subsección (3.1 → src/, 3.2 → public/, 3.3 → raíz):
//                                              primero la ruta exacta, si no, por SUFIJO; dos candidatos
//                                              = tabla ambigua (error, no se elige).
//   · `docs/competencia/`                   → directorio: `docs/competencia/**`
//   · `tests/`: … (`_banco-*`)              → un directorio seguido de «:» es un PREFIJO: lo que viene
//                                              detrás cuelga de él, y si no viene nada la fila describe
//                                              algo que no es una ruta (p. ej. «guards nuevos de J6»).
//   · `invoiceReminder`, `claude`           → sin «/», «.» ni «*» no es una ruta: se ignora.
// El dueño sale de la segunda celda. Es CERRADURA solo si es exactamente `**SN**`/`**JN**`, con
// «(contenedor)» o «construye» como único añadido; cualquier otra cosa (un jefe, nadie, «el README;
// cada registro…», dos puestos) es SIN CERRADURA — y aun así la regla existe, para que gane a la
// fila general (p. ej. `privacidad.html` no cae en «todo lo demás de public/»).
// Gana la regla MÁS ESPECÍFICA: ruta exacta > patrón con más texto fijo antes del primer `*`.

export const FUENTE = 'docs/equipo/dos-equipos.md';
export const RAICES = Object.freeze({ '3.1': 'src/', '3.2': 'public/', '3.3': '' });
export const PUESTOS = Object.freeze(['S0', 'S1', 'S2', 'S3', 'S4', 'S5', 'J1', 'J2', 'J3', 'J4', 'J5', 'J6']);

const RE_DUENO = /^\*\*(S[0-5]|J[1-6])\*\*(?: \((contenedor)\)| (construye))?$/;

/** Celdas de una fila de tabla markdown. `null` si no es fila de datos. */
function celdas(linea) {
  if (!linea.startsWith('|') || /^\|\s*-/.test(linea)) return null;
  return linea.slice(1, linea.endsWith('|') ? -1 : undefined).split('|').map((c) => c.trim());
}

/** Filas de §3.1–3.3 y de §3.4 (excepciones), con su número de línea. */
export function leerTabla(texto) {
  const lineas = texto.replace(/\r\n/g, '\n').split('\n');
  const filas = [];
  const excepciones = [];
  let sub = null;
  for (const [i, l] of lineas.entries()) {
    const h = /^### (3\.[1-4]) · /.exec(l);
    if (h) { sub = h[1]; continue; }
    if (/^## /.test(l)) { sub = null; continue; }
    if (!sub) continue;
    const c = celdas(l);
    if (!c || c.length < 2 || /^(ruta|dueño)$/.test(c[0])) continue;
    if (sub === '3.4') {
      if (c[0] === 'ruta') continue;
      excepciones.push({ linea: i + 1, ruta: c[0], quien: c[1], motivo: c[2] ?? '', ticket: c[3] ?? '' });
    } else filas.push({ linea: i + 1, sub, ruta: c[0], dueno: c[1], nota: c[2] ?? '' });
  }
  return { filas, excepciones };
}

/** Las rutas (sin resolver) que declara la primera celda de una fila. */
export function rutasDeCelda(celda) {
  const tokens = [...celda.matchAll(/`([^`]+)`/g)].map((m) => m[1].trim());
  const prefijo = /^`([^`]+\/)`\s*:/.exec(celda)?.[1] ?? null;
  const cuerpo = prefijo ? tokens.slice(1).map((t) => prefijo + t) : tokens;
  return cuerpo.filter((t) => /[/.*]/.test(t) && !/\s/.test(t));
}

export function dueno(celda) {
  const m = RE_DUENO.exec(celda.trim());
  if (!m) return { puesto: null, tipo: 'sin-cerradura' };
  return { puesto: m[1], tipo: m[2] ? 'contenedor' : 'puesto' };
}

export function globARegex(patron) {
  let r = '';
  for (let i = 0; i < patron.length; i++) {
    const ch = patron[i];
    if (ch === '*' && patron[i + 1] === '*') { r += '.*'; i++; if (patron[i + 1] === '/') i++; }
    else if (ch === '*') r += '[^/]*';
    else r += ch.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${r}$`);
}

export function especificidad(patron) {
  const i = patron.indexOf('*');
  return i < 0 ? 100000 + patron.length : i;
}

/** Resuelve una ruta de la tabla contra la lista de ficheros del repo. */
export function resolver(ruta, raiz, ficheros) {
  if (ruta.includes('*')) return { patrones: [ruta.startsWith(raiz) || !raiz ? ruta : raiz + ruta] };
  if (ruta.endsWith('/')) {
    const exacto = ruta.startsWith(raiz) ? ruta : raiz + ruta;
    if (ficheros.some((f) => f.startsWith(exacto)) || !raiz) return { patrones: [exacto + '**'] };
    const dirs = [...new Set(ficheros.filter((f) => f.startsWith(raiz) && f.includes('/' + ruta)).map((f) => f.slice(0, f.indexOf('/' + ruta) + ruta.length + 1)))];
    if (dirs.length === 1) return { patrones: [dirs[0] + '**'] };
    return { error: dirs.length ? `ambigua: ${dirs.join(', ')}` : 'no existe ningún directorio así' };
  }
  const exacto = ruta.startsWith(raiz) ? ruta : raiz + ruta;
  if (ficheros.includes(exacto)) return { patrones: [exacto] };
  const sufijo = ficheros.filter((f) => f.startsWith(raiz) && f.endsWith('/' + ruta));
  if (sufijo.length === 1) return { patrones: [sufijo[0]] };
  if (sufijo.length > 1) return { error: `ambigua: ${sufijo.join(', ')}` };
  // Un fichero que la tabla anuncia y aún no existe (lo crea su dueño) se queda como ruta literal,
  // pero SOLO si viene con su camino completo: un nombre suelto que no casa es una fila que miente.
  if (ruta.includes('/')) return { patrones: [exacto], noExiste: true };
  return { error: 'no existe en el repo' };
}

/** El mapa completo: reglas ordenadas por especificidad, excepciones y lo que no se pudo resolver. */
export function construirMapa(texto, ficheros) {
  const { filas, excepciones } = leerTabla(texto);
  const reglas = [];
  const errores = [];
  const noExisten = [];
  for (const f of filas) {
    const d = dueno(f.dueno);
    for (const ruta of rutasDeCelda(f.ruta)) {
      const r = resolver(ruta, RAICES[f.sub], ficheros);
      if (r.error) { errores.push(`${FUENTE}:${f.linea} · \`${ruta}\` → ${r.error}`); continue; }
      if (r.noExiste) noExisten.push(`${FUENTE}:${f.linea} · ${r.patrones[0]}`);
      for (const p of r.patrones) reglas.push({ patron: p, puesto: d.puesto, tipo: d.tipo, linea: f.linea, dueno: f.dueno });
    }
  }
  // Dos filas que dan la MISMA ruta a dueños distintos: la tabla se contradice.
  const porPatron = new Map();
  for (const r of reglas) {
    const prev = porPatron.get(r.patron);
    if (prev && (prev.puesto !== r.puesto || prev.tipo !== r.tipo)) errores.push(`${FUENTE}:${prev.linea} y :${r.linea} · \`${r.patron}\` con dos dueños`);
    porPatron.set(r.patron, r);
  }
  const unicas = [...porPatron.values()].sort((a, b) => especificidad(b.patron) - especificidad(a.patron) || a.patron.localeCompare(b.patron));
  const exc = [];
  for (const e of excepciones) {
    const quien = e.quien.includes('todos') ? ['*'] : [...e.quien.matchAll(/\b(S[0-5]|J[1-6])\b/g)].map((m) => m[1]);
    const rutas = rutasDeCelda(e.ruta);
    if (!quien.length || !rutas.length || !e.motivo) { errores.push(`${FUENTE}:${e.linea} · excepción sin ruta, sin quién o sin motivo`); continue; }
    for (const p of rutas) exc.push({ patron: p, quien, motivo: e.motivo, ticket: e.ticket, linea: e.linea });
  }
  return { reglas: unicas, excepciones: exc, errores, noExisten, filas: filas.length };
}

/** La regla que manda sobre un fichero (ruta relativa, con `/`), o null. */
export function reglaDe(rel, mapa) {
  for (const r of mapa.reglas) if (globARegex(r.patron).test(rel)) return r;
  return null;
}

export function excepcionPara(rel, puesto, mapa) {
  return mapa.excepciones.find((e) => (e.quien.includes('*') || e.quien.includes(puesto)) && globARegex(e.patron).test(rel)) ?? null;
}

/**
 * El puesto que declara un nombre de sesión. Formatos medidos el 29-sep: `sesion-N` (sesion.mjs),
 * `sN-<fecha><letra>` (lanzados a mano), `orquestador`. Para el equipo de Javier se aceptan
 * `jN-…` y `puesto-jN`. Cualquier otro nombre (`cobroflash-backend-57`, vacío) → null.
 */
export function puestoDeNombre(nombre) {
  if (typeof nombre !== 'string') return null;
  const n = nombre.trim().toLowerCase();
  let m = /^(?:sesion-([0-5])|s([0-5])-[a-z0-9-]+)$/.exec(n);
  if (m) return `S${m[1] ?? m[2]}`;
  m = /^(?:puesto-j([1-6])|j([1-6])-[a-z0-9-]+)$/.exec(n);
  if (m) return `J${m[1] ?? m[2]}`;
  if (/^orquestador(?:-[a-z0-9-]+)?$/.test(n)) return 'ORQ';
  return null;
}

/** El último nombre que el transcript registra para la sesión (`/rename` incluido). */
export function nombreDelTranscript(texto) {
  let nombre = null;
  for (const l of texto.split('\n')) {
    if (!l.includes('"agent-name"') && !l.includes('"custom-title"')) continue;
    try {
      const o = JSON.parse(l);
      const v = o.type === 'agent-name' ? o.agentName : o.type === 'custom-title' ? o.customTitle : null;
      if (typeof v === 'string' && v.trim()) nombre = v.trim();
    } catch { /* línea partida: se ignora */ }
  }
  return nombre;
}

/** Área de cada puesto, sacada de las tablas de §2.1 y §2.2. */
export function areasDePuestos(texto) {
  const areas = {};
  for (const l of texto.replace(/\r\n/g, '\n').split('\n')) {
    const c = celdas(l);
    if (!c || c.length < 2) continue;
    const m = /^\*\*(S[0-5]|J[1-6])\*\*(?: · (.+))?$/.exec(c[0]);
    if (m && !areas[m[1]]) areas[m[1]] = (m[2] ? `${m[2]}: ` : '') + c[1];
  }
  return areas;
}

export function fichaDe(puesto) {
  if (/^S[0-5]$/.test(puesto)) return `docs/equipo/sesion-${puesto.slice(1)}.md`;
  if (/^J[1-6]$/.test(puesto)) return `docs/equipo/puesto-j${puesto.slice(1)}.md`;
  if (puesto === 'ORQ') return 'docs/equipo/orquestador.md';
  return null;
}
