// tests/_censo-tickets.mjs — SCRUM-388
//
// ¿QUÉ HAY EN `main` DE UN TICKET? Tres veredictos: ENTERO · PARCIAL · NADA.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// LA REGLA VERTEBRAL: **LA EVIDENCIA TIENE QUE NOMBRAR EL TICKET**
//
// Un commit que cite `SCRUM-N`, un `docs/master/SCRUM-N.md`, una rama con N. Y nada más.
//
// «Hay un mecanismo que se parece» NO ES EVIDENCIA, y no es una cautela teórica: es exactamente
// cómo se dio por cerrada A9 (SCRUM-354). Alguien encontró el ciclo de mantenimientos —modelo con
// periodicidad, cron diario, anti-spam, botones— y le pareció el mismo mecanismo. Pero eso es
// **A15/MANT-1**, construido el 6-JULIO, un mes ANTES de que el ticket A9 existiera. Comparten el
// modelo `MaintenancePlan` y no comparten el objeto: A15 propone PRESUPUESTOS al profesional; A9
// pide EMITIR FACTURAS solo, generar trabajos y avisar al cliente. Nada de eso existe.
//
// > **Encontrar un mecanismo que se parece no es encontrar el ticket.** El parecido es la forma
// > que tiene un censo de mentir en la dirección cómoda: la que dice que no hay trabajo pendiente.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// POR QUÉ TRES VEREDICTOS Y NO DOS
//
// «Parcial» no es un matiz: es el estado real de A2 (SCRUM-293) y A3 (SCRUM-294) —dominio con
// tests, sin llamadores, sin UI— y aplanarlo miente en las dos direcciones. Como «hecho», esconde
// trabajo pendiente. Como «nada», tira a la basura una entrega medida y declarada.
//
// ⚠️ Y LA SEÑAL DE «PARCIAL» **NO** ES LA FRASE «ENTREGA PARCIAL». Medido el 7-ago-2026: los
// docs de 293, 294 **y 298** llevan los tres esa frase, y 298 está entregado del todo respecto de
// su alcance vigente. Lo que de verdad los separa es si queda **mecanismo construido y sin
// conectar**: 293 y 294 dejan cálculo que no llama nadie, esperando campos de schema; 298 redujo
// el alcance por decisión del fundador y lo que entregó está en uso.
//
//   · PARCIAL → hay código en `main` que todavía no hace nada para el usuario.
//   · ENTERO  → lo entregado está conectado; lo que falta se declaró fuera de alcance con motivo.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Frases con las que una entrega declara que dejó mecanismo sin conectar.
 *
 * ⚠️ Lista CORTA y declarada a propósito. Ampliarla a base de sinónimos la volvería un detector
 * de tono en vez de un detector de hecho, y entonces cualquier entrega prudente saldría PARCIAL.
 * Si una entrega nueva declara su parcialidad con otras palabras, se añaden AQUÍ con su caso.
 */
export const MARCAS_SIN_CONECTAR = [
  'sin llamadores',
  'sin conectar',
  'no lo llama nadie',
  'no la llama nadie',
];

/**
 * Normaliza texto de markdown para buscar frases que CRUZAN LÍNEAS.
 *
 * 🔴 Los dos pasos son obligatorios y el segundo se descubrió midiendo. En `SCRUM-294.md` la frase
 * «sin llamadores» está partida entre dos líneas **de blockquote**, así que colapsar espacios sin
 * más deja `...probado y sin > llamadores` — con el `>` en medio— y el `grep` da CERO sobre un
 * fichero que sí lo dice. Un censo que no sabe leer su propia fuente da el mismo número que un
 * censo vacío.
 */
export function normalizar(texto) {
  return texto.replace(/^\s*>\s?/gm, ' ').replace(/\s+/g, ' ');
}

/**
 * El número, con FRONTERA. `SCRUM-29` no puede casar dentro de `SCRUM-298`, ni al revés: sin
 * frontera, un censo de SCRUM-29 heredaría toda la evidencia del 298 y lo daría por hecho.
 */
function patronTicket(n) {
  return new RegExp(`SCRUM-${n}(?![0-9])`, 'i');
}

function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

/**
 * Censa un ticket contra `main`. Devuelve el veredicto y **las fuentes**, para que quien lea el
 * informe pueda ir a comprobarlo — un veredicto sin su evidencia es una opinión.
 *
 * @param {number|string} numero  el N de SCRUM-N
 * @param {object} opciones  `{ raiz, ref }` — `ref` es contra qué se mide (por defecto `origin/main`)
 */
export function censarTicket(numero, { raiz = process.cwd(), ref = 'origin/main' } = {}) {
  const n = String(numero).trim();
  if (!/^\d+$/.test(n)) throw new Error(`[censo] número de ticket inválido: «${numero}»`);
  const patron = patronTicket(n);

  // ── FUENTE 1 · commits del historial que NOMBRAN el ticket EN SU ASUNTO ─────────────────
  //
  // 🔴 EN EL ASUNTO, y no en el cuerpo. Medido: `58d7753 docs(master): SCRUM-8 …` menciona otro
  // ticket dentro de su cuerpo, y aceptarlo hacía que **SCRUM-2 saliera ENTERO con evidencia que
  // no era suya**. Una referencia cruzada dice «esto tiene que ver con aquello», no «aquello se
  // construyó aquí» — y atribuir trabajo ajeno es el mismo error que dio A9 por cerrada, solo que
  // entrando por la otra puerta.
  //
  // La convención de la casa pone el ticket en el asunto (`feat(x): … (SCRUM-N)`), así que esto no
  // pierde entregas de verdad. Y si alguna citara solo en el cuerpo, sale de aquí como no vista:
  // este censo se equivoca hacia «falta trabajo», nunca hacia «ya está hecho».
  // `--grep` de git no tiene frontera de palabra portable, así que se filtra después con el
  // patrón propio: pedirle a git `SCRUM-29` devuelve también los del 298.
  const crudo = git(['log', ref, '--format=%h%cs%an%s', `--grep=SCRUM-${n}`, '-i'], raiz);
  const commits = crudo.split('\n').filter(Boolean)
    .map((l) => { const [sha, fecha, autor, asunto] = l.split(''); return { sha, fecha, autor, asunto }; })
    .filter((c) => patron.test(c.asunto));

  // ── FUENTE 2 · la entrada de máster ─────────────────────────────────────────────────────
  const rutaDoc = path.join(raiz, 'docs', 'master', `SCRUM-${n}.md`);
  const doc = fs.existsSync(rutaDoc) ? fs.readFileSync(rutaDoc, 'utf8') : null;

  // ── FUENTE 3 · ramas cuyo NOMBRE lleva el número ────────────────────────────────────────
  // De las refs locales de `origin` (rápido y sin red): refleja el último `fetch`, y eso se
  // declara en vez de fingir que es el remoto en vivo.
  const refs = git(['for-each-ref', '--format=%(refname:short)', 'refs/remotes/origin/'], raiz)
    .split('\n').filter(Boolean);
  // 🔴 Con la CONVENCIÓN de la casa (`scrum-<n>-<slug>`), no «el número aparece por ahí». Medido:
  // buscar el número suelto atribuía a SCRUM-2 las ramas `…-rebasada-2` y `codeowners-zona-roja-v2`,
  // donde el 2 es un sufijo de reintento o de versión. Cinco ramas ajenas para un solo ticket.
  const ramas = refs.filter((r) => new RegExp(`^scrum-${n}(-|$)`, 'i').test(r.replace(/^origin\//, '')));

  const fuentes = [];
  if (commits.length) fuentes.push('commits');
  if (doc) fuentes.push('docs/master');
  if (ramas.length) fuentes.push('ramas');

  // ── VEREDICTO ───────────────────────────────────────────────────────────────────────────
  if (fuentes.length === 0) {
    return {
      ticket: `SCRUM-${n}`, veredicto: 'NADA', fuentes: [], commits: [], ramas, doc: false, marcas: [],
      porque: 'ninguna evidencia NOMBRA el ticket: ni un commit, ni entrada de máster, ni una rama',
    };
  }

  const textoEvidencia = normalizar(
    [doc || '', ...commits.map((c) => `${c.asunto} ${cuerpoDe(c.sha, raiz)}`)].join('\n'));
  const marcas = MARCAS_SIN_CONECTAR.filter((m) => textoEvidencia.toLowerCase().includes(m));

  return {
    ticket: `SCRUM-${n}`,
    veredicto: marcas.length ? 'PARCIAL' : 'ENTERO',
    fuentes,
    commits,
    ramas,
    doc: !!doc,
    marcas,
    porque: marcas.length
      ? `la entrega declara mecanismo sin conectar (${marcas.map((m) => `«${m}»`).join(', ')})`
      : 'hay evidencia que nombra el ticket y no declara nada sin conectar',
  };
}

const cacheCuerpo = new Map();
function cuerpoDe(sha, raiz) {
  if (!cacheCuerpo.has(sha)) cacheCuerpo.set(sha, git(['show', '-s', '--format=%b', sha], raiz));
  return cacheCuerpo.get(sha);
}

/**
 * SUELO. Se llama ANTES de creerse ningún veredicto.
 *
 * «No supe mirar» y «no hay nada» son el mismo resultado y significan lo contrario — y ése es
 * literalmente el defecto que este censo existe para cazar, así que aquí sería el colmo.
 */
export function comprobarSuelo({ raiz = process.cwd(), ref = 'origin/main' } = {}) {
  const problemas = [];
  try {
    const n = git(['rev-list', '--count', ref], raiz).trim();
    if (!/^\d+$/.test(n) || Number(n) < 100) problemas.push(`el historial de «${ref}» devolvió ${n} commits`);
  } catch (e) {
    problemas.push(`no se pudo leer el historial de «${ref}»: ${e.message.split('\n')[0]}`);
  }
  const dir = path.join(raiz, 'docs', 'master');
  try {
    const entradas = fs.readdirSync(dir).filter((f) => /^SCRUM-\d+\.md$/.test(f));
    if (entradas.length < 20) problemas.push(`docs/master/ solo tiene ${entradas.length} entradas SCRUM-*.md`);
  } catch (e) {
    problemas.push(`no se pudo leer ${dir}: ${e.message.split('\n')[0]}`);
  }
  return problemas;
}
