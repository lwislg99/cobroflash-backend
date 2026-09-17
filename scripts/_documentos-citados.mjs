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

/**
 * Rutas de documento tal y como las escribe esta casa: una ruta con barras y extensión .md
 *
 * 🔴 LOS SEGMENTOS ADMITEN ESPACIO, y no es un capricho: este repo tiene dos carpetas reales que
 * lo llevan — `docs/Sprint Scrum/` y `docs/Srpint Scrum/` (sí, con la errata dentro del nombre).
 * Sin el espacio, la clase de caracteres **corta la ruta por la mitad** y el censo acusa de
 * fantasma a un trozo (`Scrum/SESION_ACTUAL_SCRUM-69.md`) de una cita que estaba perfecta.
 *
 * ⚠️ NO ES UN DEFECTO NUEVO: `docs/master/SCRUM-718.md:49` lo documenta para otro censo, con estas
 * palabras — *«la ruta real es `docs/Sprint Scrum/…` y mi clase de caracteres no admitía el
 * espacio, así que la cortaba en "docs/Sprint"»*. Esta primera versión lo repitió igual. Queda
 * escrito aquí porque un defecto que reaparece en otro instrumento es un defecto de la casa, no
 * del instrumento.
 *
 * ⚠️ Y EL ESPACIO SE ACOTA, porque la primera versión del arreglo se pasó de largo: admitir
 * cualquier palabra antes del espacio hacía que un `OK` o un `for f in …` pegados a la ruta casaran
 * enteros, arrastrando el texto de delante. Medido: las «deudas» saltaron de 5 a 12, y las nuevas
 * eran todas trozos de prosa.
 *
 * Se admite sólo cuando **las dos palabras empiezan por mayúscula** —la forma de un nombre de
 * carpeta como `Sprint Scrum`—, que es justo lo que este repo tiene y lo que la prosa no produce.
 */
const CITA = /(?:^|[\s(`"'«[])((?:(?:[A-Z][\w.-]*(?: [A-Z][\w.-]*)+|[\w.-]+)\/)*[A-Za-z0-9_.-]+\.md)\b/g;

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
 * Ficheros que un proceso GENERA al correr. Se citan por su nombre pero no son documentación del
 * repositorio, y exigir que existan sería exigir que alguien haya ejecutado algo antes de leer.
 *
 * 🔴 SE DERIVA DEL CÓDIGO, NO DE LA PROSA QUE RODEA LA CITA. La primera versión buscaba verbos
 * —`genera|escribe|deja|produce|salida|crea`— en el contexto de la línea, y eso es **eximir por
 * mencionar**: el defecto que censó SCRUM-511. Medido el 17-sep-2026: con el criterio por prosa
 * el cubo `generados` tenía **0** entradas mientras había una salida de verdad sin reconocer.
 *
 * Ahora la pregunta es la de SCRUM-242, que ya estaba probada: **¿hay algún script del árbol que
 * ESCRIBA este fichero?** Derivado, no listado — el día que el script deje de escribirlo, la ruta
 * vuelve a exigirse.
 *
 * ⚠️ SE EXIGE LA RUTA CITADA ENTERA, no el nombre base, y el matiz lo cazó una medición: buscando
 * sólo el nombre, `tests/_censo-fixture.mjs` —que escribe un `LEEME.md` dentro de un árbol
 * sintético— hacía pasar por «salida generada» a `spike/LEEME.md`, que es un documento que existió
 * en esa ruta y se borró. Dos cosas distintas con el mismo final de nombre.
 */
/** Los ficheros de código donde puede vivir una escritura. Se leen UNA vez por árbol, no por censo. */
const cacheCodigo = new Map();
function codigoDelArbol(raiz) {
  if (cacheCodigo.has(raiz)) return cacheCodigo.get(raiz);
  const fuera = [];
  for (const dir of ['scripts', 'tests']) {
    const abs = path.join(raiz, dir);
    if (!fs.existsSync(abs)) continue;
    for (const f of fs.readdirSync(abs)) {
      if (!/\.(mjs|js)$/.test(f)) continue;
      fuera.push(fs.readFileSync(path.join(abs, f), 'utf8').replace(/\s+/g, ' '));
    }
  }
  cacheCodigo.set(raiz, fuera);
  return fuera;
}

/** ¿Escribe algún script del árbol exactamente esta ruta? */
function loEscribeUnScript(codigo, ruta) {
  const esc = ruta.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(writeFileSync|appendFileSync|createWriteStream)\\([^)]{0,200}?${esc}`);
  return codigo.some((c) => re.test(c));
}

/**
 * 🔴 SKILLS DE TERCEROS: su documentación interna NO es documentación de esta casa.
 *
 * `.claude/skills/impeccable/reference/adapt.md` cita a sus hermanos (`typography.md`,
 * `personas.md`, `responsive-design.md`…) y el proveedor los absorbió en línea, así que apuntan a
 * ficheros que él borró. Son referencias colgadas REALES, pero **no las mantenemos nosotros** y
 * meterlas en el mismo cubo que un runbook prometido confunde una deuda con un paquete ajeno.
 *
 * ⚠️ EL CRITERIO SE DERIVA DEL MÁSTER, que es quien decide (regla 35), y NO de una lista escrita
 * aquí ni de que la palabra aparezca por ahí. El máster declara, textual: *«`impeccable` es skill
 * de TERCEROS (regla 36)»* y *«Excepción a la regla 36 (plugins de terceros): la skill
 * `impeccable`…»*. Se busca el nombre de la carpeta **dentro de una frase que declare "terceros"**,
 * que es usar la señal en vez de mencionarla — la distinción que midió SCRUM-511.
 *
 * 🔴 Y VA APARTE, NO EXENTO, igual que `docs/historico/`: la fuente se sigue leyendo. Una fuente
 * retirada de la población no puede volver a ponerse roja nunca, y este censo existe precisamente
 * para que un cero signifique «he mirado».
 */
export function skillsDeTerceros(raiz) {
  const dirSkills = path.join(raiz, '.claude', 'skills');
  const master = path.join(raiz, 'docs', 'YAQU_MASTER.md');
  if (!fs.existsSync(dirSkills) || !fs.existsSync(master)) return [];
  // ⚠️ EL NOMBRE TIENE QUE IR PEGADO A LA PALABRA, no suelto en la misma frase. La primera
  // versión se quedaba con las frases que contuvieran «terceros» y buscaba el nombre dentro, y
  // eso marcó como ajenas a CINCO skills nuestras: el máster tiene frases que hablan de terceros
  // y nombran de paso las de la casa (`.agents/skills/` = `yaqu-*` + `impeccable`). Volvía a ser
  // eximir por vecindad. Ahora se exige el nombre ENTRECOMILLADO a menos de 60 caracteres de la
  // palabra, que es la forma en que el máster declara de verdad: «`impeccable` es skill de
  // TERCEROS», «(plugins de terceros): la skill `impeccable`».
  const texto = fs.readFileSync(master, 'utf8').replace(/\s+/g, ' ');
  const declarada = (n) => {
    const e = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp('`' + e + '`[^.]{0,60}terceros|terceros[^.]{0,60}`' + e + '`', 'i').test(texto);
  };
  return fs.readdirSync(dirSkills, { withFileTypes: true })
    .filter((e) => e.isDirectory() && declarada(e.name))
    .map((e) => e.name)
    .sort();
}

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
  const plantillas = []; const generados = []; const enHistorico = []; const enSkillDeTerceros = [];
  const codigo = codigoDelArbol(raiz);
  const ajenas = skillsDeTerceros(raiz).map((s) => `.claude/skills/${s}/`);
  for (const [ruta, citadores] of porRuta) {
    if (citadores.some((c) => resuelve(raiz, ruta, c.fichero))) { existen.push({ ruta, citadores }); continue; }
    const fila = { ruta, citadores };
    // Los cubos que NO son el defecto van antes, y cada uno con su motivo comprobable.
    if (ES_PLANTILLA.test(ruta)) { plantillas.push(fila); continue; }
    if (citadores.every((c) => ES_FUTURO.test(c.contexto))) { futuros.push(fila); continue; }
    if (loEscribeUnScript(codigo, ruta)) { generados.push(fila); continue; }
    // Aparte, no exento: la fuente se sigue leyendo y la cifra se sigue publicando.
    if (ajenas.length && citadores.every((c) => ajenas.some((a) => c.fichero.startsWith(a)))) {
      enSkillDeTerceros.push(fila); continue;
    }
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
    enSkillDeTerceros,
    existen,
  };
}

/** La línea que el censo imprime: población y reparto, nunca un total suelto. */
export function linea(c) {
  return `población: ${c.fuentes} documentos · ${c.rutasCitadas} rutas .md citadas · `
    + `${c.existen.length} existen · ${c.fantasmas.length} FANTASMA · `
    + `${c.deudaDeNombre.length} deuda de nombre · ${c.futuros.length} futuras · `
    + `${c.plantillas.length} plantillas · ${c.generados.length} generados · ${c.enHistorico.length} en histórico · ${c.enSkillDeTerceros.length} en skill de terceros `
    + `(descontadas en bloque de código: ${c.descontadasEnCodigo} · vistas sólo al normalizar: ${c.soloNormalizado})`;
}
