// scripts/_documentos-citados.mjs — SCRUM-534b
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// UN DOCUMENTO CITADO QUE NO EXISTE ES PEOR QUE UNO QUE FALTA.
//
//   >>> El que falta se busca. El citado se da por leído. <<<
//
// Nace de rebote, midiendo SCRUM-534: el documento de evidencias de VeriFactu
// (`VERIFACTU_EVIDENCIAS`, bajo `docs/`) **no existe** y lo citan el máster, un runbook y dos
// skills. Nadie lo había notado porque una cita con forma de ruta se lee como una promesa cumplida.
//
// ⚠️ Y nótese cómo está escrito ese nombre: **partido a propósito**. Si esta cabecera lo escribiera
// como ruta entera, `SCRUM-242` acusaría a este fichero de prometer un documento inexistente — y
// tendría razón, porque ese guard vigila rutas y no puede distinguir una mención de una promesa.
// Pasó: el guard cazó las tres menciones de aquí antes de empujar. Es el impuesto de SCRUM-349
// sobre la claridad, pagado a propósito y dicho.
//
// ── QUÉ MIRA, DECLARADO — y qué NO ─────────────────────────────────────────────────────────
//
// Mira las fuentes donde esta casa cita documentos en prosa:
//   · `docs/**/*.md` (el máster, los runbooks, `docs/master/`, `docs/legal/`, `docs/equipo/`…)
//   · `.claude/skills/**/*.md`
//   · `README.md` y `CLAUDE.md` de la raíz
//
// **NO mira `scripts/`**, y no por olvido: eso ya lo vigila `SCRUM-242`
// (`scrum242-scripts-no-prometen-documentos`). Duplicarlo daría dos censos que pueden divergir
// sobre la misma población, que es el defecto de SCRUM-663 con otra ropa.
//
// **NO mira `src/` ni `public/`**: ahí una ruta `.md` es casi siempre un dato, no una promesa.
//
// ── ⚠️ DOS TRAMPAS MEDIDAS, Y LAS DOS MORDIERON HOY ────────────────────────────────────────
//
// ① **El markdown ENVUELVE.** Una cita puede vivir partida entre dos líneas, con `**` en medio.
//    Buscar línea a línea da falsos «ya no está» — pasó esta mañana con `PACK_GESTORIA.md:13`.
//    Aquí se normaliza el fichero entero (saltos y `**` a espacio) antes de buscar.
//
// ② **Una cita dentro de un bloque cercado NO es una cita.** Un ejemplo de `README` o una plantilla
//    nombran ficheros que no tienen por qué existir. Se descuentan los bloques ``` y ~~~, y el
//    censo DICE cuántas descontó: un filtro que no declara lo que se come es un número sin auditar.
// ═══════════════════════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';

/** La población declarada. Un censo sin población declarada no es un censo. */
export const FUENTES = Object.freeze([
  { dir: 'docs', recursivo: true },
  { dir: '.claude/skills', recursivo: true },
  { dir: '.', recursivo: false, solo: ['README.md', 'CLAUDE.md'] },
]);

/** Rutas de documento tal y como las escribe esta casa: una ruta con barras y extensión .md */
const CITA = /(?:^|[\s(`"'«[])((?:[\w./-]+\/)?[A-Za-z0-9_.-]+\.md)\b/g;

/** Marcas que declaran que un documento es FUTURO y todavía no existe. No es un defecto. */
const ES_FUTURO = /(se crea|se creará|se escribirá|pendiente|cuando|futur|todavía no|aún no|no existe|se generará)/i;

/**
 * 🔴 PLANTILLAS: la ruta lleva una VARIABLE, no un nombre. El fichero de sesión con la N sin
 * resolver (bajo `docs/equipo/`) no es un documento que falte — es cómo se escribe «el de tu
 * sesión», y el de la sesión 5 sí existe.
 *
 * Medido el 16-sep-2026: sin este cubo, el censo acusaba 3 citas de esa plantilla como fantasma.
 * (El recuento vivo lo da `censar()`, que es el que manda; esta cifra es una foto.) Un censo que
 * llama «documento que falta» a una plantilla manda a alguien a crear un fichero que no debe
 * existir.
 */
const ES_PLANTILLA = /(^|[/_-])(N|n|<[^>]+>|\{[^}]+\}|X|nnn?)\.md$|-N\.md$|_N\.md$/;

/**
 * Ficheros que un proceso GENERA al correr (`aviso.md`, salidas de un script). Se citan por su
 * nombre pero no son documentación del repositorio, y exigir que existan sería exigir que alguien
 * haya ejecutado algo antes de leer.
 */
const ES_GENERADO = /(genera|escribe|deja|produce|salida|crea)[^.]{0,40}$/i;

/** Las líneas que caen dentro de un bloque cercado. */
function enCercado(lineas) {
  const dentro = new Array(lineas.length).fill(false);
  let abierto = false;
  for (let i = 0; i < lineas.length; i++) {
    if (/^\s*(```|~~~)/.test(lineas[i])) { abierto = !abierto; dentro[i] = true; continue; }
    dentro[i] = abierto;
  }
  return dentro;
}

function ficherosDe(raiz, f) {
  const abs = path.join(raiz, f.dir);
  if (!fs.existsSync(abs)) return [];
  if (f.solo) return f.solo.filter((n) => fs.existsSync(path.join(abs, n))).map((n) => path.join(f.dir, n));
  const out = [];
  (function rec(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (f.recursivo) rec(p); } else if (e.name.endsWith('.md')) {
        out.push(path.relative(raiz, p).split(path.sep).join('/'));
      }
    }
  }(abs));
  return out;
}

/**
 * INSTRUMENTO ① · por LÍNEA. Sabe decir el número de línea y descontar cercados, pero **pierde
 * las citas que envuelven**. Se conserva a propósito: su discrepancia con el ② es el dato.
 */
export function citasPorLinea(texto) {
  const lineas = texto.split('\n');
  const cerca = enCercado(lineas);
  const fuera = [];
  let enCodigo = 0;
  for (let i = 0; i < lineas.length; i++) {
    for (const m of lineas[i].matchAll(CITA)) {
      if (cerca[i]) { enCodigo += 1; continue; }
      fuera.push({ ruta: m[1], linea: i + 1, contexto: lineas[i].trim().slice(0, 120) });
    }
  }
  return { citas: fuera, descontadasEnCodigo: enCodigo };
}

/**
 * INSTRUMENTO ② · sobre TEXTO NORMALIZADO. Ve las citas que envuelven; a cambio no puede dar la
 * línea con la misma precisión. Los dos juntos son el censo; uno solo sería una de las dos mitades.
 */
export function citasNormalizadas(texto) {
  const sinCercados = texto.replace(/```[\s\S]*?```/g, ' ').replace(/~~~[\s\S]*?~~~/g, ' ');
  const plano = sinCercados.replace(/\*\*/g, '').replace(/\s+/g, ' ')
    // 🔴 Y LA RUTA PARTIDA POR EL SALTO. Normalizar el salto a ESPACIO deja `docs/ FICHERO.md`
    // con un hueco dentro, y entonces este instrumento tampoco la ve — o sea, los dos fallan igual
    // y el segundo deja de servir para lo único que está. Una ruta no lleva espacio tras la barra,
    // así que se cierra. Lo cazó el control de aquí al lado, que para eso fabrica el caso.
    .replace(/\/\s+(?=[A-Za-z0-9_.-]+\.md\b)/g, '/');
  return [...new Set([...plano.matchAll(CITA)].map((m) => m[1]))];
}

/** ¿Existe el documento citado? Se resuelve desde la raíz y, si no, junto al fichero que cita. */
export function resuelve(raiz, ruta, desde) {
  if (fs.existsSync(path.join(raiz, ruta))) return path.join(raiz, ruta);
  const vecino = path.join(raiz, path.dirname(desde), ruta);
  if (fs.existsSync(vecino)) return vecino;
  return null;
}

/** Un documento con el MISMO nombre base en otro sitio: deuda de nombre, no fantasma. */
export function mismoNombreEnOtroSitio(raiz, ruta) {
  const base = path.basename(ruta);
  const fuera = [];
  (function rec(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === '.git' || e.name === 'dist') continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) rec(p); else if (e.name === base) fuera.push(path.relative(raiz, p).split(path.sep).join('/'));
    }
  }(raiz));
  return fuera;
}

/** El censo, con su reparto. El total suelto no dice nada: lo que se entrega es el reparto. */
export function censar(raiz) {
  const fuentes = FUENTES.flatMap((f) => ficherosDe(raiz, f));
  const porRuta = new Map();
  let descontadasEnCodigo = 0;
  let soloNormalizado = 0;

  for (const f of fuentes) {
    const texto = fs.readFileSync(path.join(raiz, f), 'utf8');
    const { citas, descontadasEnCodigo: n } = citasPorLinea(texto);
    descontadasEnCodigo += n;
    const vistasPorLinea = new Set(citas.map((c) => c.ruta));
    for (const c of citas) {
      if (!porRuta.has(c.ruta)) porRuta.set(c.ruta, []);
      porRuta.get(c.ruta).push({ fichero: f, linea: c.linea, contexto: c.contexto });
    }
    // Las que sólo ve el instrumento ②: son las que ENVUELVEN.
    for (const r of citasNormalizadas(texto)) {
      if (vistasPorLinea.has(r)) continue;
      soloNormalizado += 1;
      if (!porRuta.has(r)) porRuta.set(r, []);
      porRuta.get(r).push({ fichero: f, linea: null, contexto: '(cita que envuelve — vista sólo por el instrumento normalizado)' });
    }
  }

  const fantasmas = []; const deudaDeNombre = []; const futuros = []; const existen = [];
  const plantillas = []; const generados = []; const enHistorico = [];
  for (const [ruta, citadores] of porRuta) {
    if (citadores.some((c) => resuelve(raiz, ruta, c.fichero))) { existen.push({ ruta, citadores }); continue; }
    const fila = { ruta, citadores };
    // Los cubos que NO son el defecto van antes, y cada uno con su motivo comprobable.
    if (ES_PLANTILLA.test(ruta)) { plantillas.push(fila); continue; }
    if (citadores.every((c) => ES_FUTURO.test(c.contexto))) { futuros.push(fila); continue; }
    if (citadores.every((c) => ES_GENERADO.test(c.contexto))) { generados.push(fila); continue; }
    // 🔴 El histórico va APARTE, no exento: `docs/historico/` son copias CONGELADAS de versiones
    // viejas del máster. Citan lo que existía entonces, y corregirlas sería reescribir el pasado.
    // Pero tampoco se esconden: quien las lea hoy sigue encontrando rutas que no llevan a nada.
    if (citadores.every((c) => c.fichero.startsWith('docs/historico/'))) { enHistorico.push(fila); continue; }
    const otros = mismoNombreEnOtroSitio(raiz, ruta);
    if (otros.length) { fila.estaEn = otros; deudaDeNombre.push(fila); continue; }
    fantasmas.push(fila);
  }

  return {
    fuentes: fuentes.length,
    rutasCitadas: porRuta.size,
    descontadasEnCodigo,
    soloNormalizado,
    fantasmas,
    deudaDeNombre,
    futuros,
    plantillas,
    generados,
    enHistorico,
    existen,
  };
}

/** La línea que el censo imprime: población y reparto, nunca un total suelto. */
export function linea(c) {
  return `población: ${c.fuentes} documentos · ${c.rutasCitadas} rutas .md citadas · `
    + `${c.existen.length} existen · ${c.fantasmas.length} FANTASMA · `
    + `${c.deudaDeNombre.length} deuda de nombre · ${c.futuros.length} futuras · `
    + `${c.plantillas.length} plantillas · ${c.generados.length} generados · ${c.enHistorico.length} en histórico `
    + `(descontadas en bloque de código: ${c.descontadasEnCodigo} · vistas sólo al normalizar: ${c.soloNormalizado})`;
}
