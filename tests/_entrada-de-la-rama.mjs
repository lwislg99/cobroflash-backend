// tests/_entrada-de-la-rama.mjs — SCRUM-854
//
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ¿A QUÉ TICKET PERTENECE ESTA RAMA, Y HA DEJADO SU ENTRADA DE REGISTRO?
//
// Un PR puede entrar en `main` tocando código y sin dejar entrada en `docs/master/`, y hoy no lo
// ve nadie. Medido sobre los 60 últimos merges (37 de PR): **5 entraron SIN expediente** —dos de
// ellos siguen sin él— y 3 más tenían uno y no lo actualizaron.
//
// SCRUM-273 ya comprueba que la entrada que EXISTE se llame como su ticket y no se escriba en
// `YAQU_MASTER.md`. Hace bien lo que promete. Lo que nadie comprobaba es que exista.
//
// ── POR QUÉ NO ES UN GUARD DE TEXTO (la trampa de SCRUM-349) ──────────────────────────────────
//
// La descripción de este mismo ticket lleva dentro los patrones que persigue (`scrum-<n>-*`,
// `docs/master/SCRUM-<n>.md`), así que un guard que barriera ficheros buscando esas cadenas se
// cazaría a sí mismo. Aquí no se lee el texto de nada: se pregunta a **git** por la estructura
// —qué toca la rama, de dónde parte, qué dicen sus commits—, que es un dato, no una cadena.
//
// ── 🔴 «NO SE PUDO DETERMINAR» NO ES «CUMPLE». SON COSAS DISTINTAS ────────────────────────────
//
// El caso de SCRUM-828 enseñó que el número de ticket puede **no aparecer en ninguna parte**: ni
// en la rama, ni en el commit, ni en el test. Un guard que sólo mire nombres de rama se traga
// justo esos. Por eso hay TRES veredictos y no dos: el tercero se reporta en voz alta en vez de
// contarse como verde.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
import { execFileSync } from 'node:child_process';
import { baseDeLaRama, ficherosDeLaRama } from './_censo-eol.mjs';

export const CUMPLE = 'CUMPLE';
export const FALTA = 'FALTA';
export const NO_SE_PUDO_DETERMINAR = 'NO_SE_PUDO_DETERMINAR';

/** Lo que cuenta como «código» a efectos de exigir expediente. Derivado de las carpetas reales. */
export const CARPETAS_DE_CODIGO = Object.freeze(['src/', 'tests/', 'scripts/', 'public/', 'prisma/']);

const git = (raiz, ...args) => execFileSync('git', args, {
  cwd: raiz, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024,
});

/** El número que lleva dentro un nombre de rama, o `null`. `scrum-839b-…` → `839`. */
export function numeroDeRama(rama) {
  const m = String(rama || '').match(/^scrum-(\d+)/i);
  return m ? m[1] : null;
}

/** La ruta que le toca a un ticket. UN sitio, para que el test no la teclee aparte. */
export const entradaDe = (num) => `docs/master/SCRUM-${num}.md`;

/**
 * 🔴 LAS VÍAS PARA SABER A QUÉ TICKET PERTENECE UNA RAMA, con su cobertura MEDIDA.
 *
 * Sobre los 37 merges de PR de los últimos 60:
 *   ① nombre de la rama .......... 35/37
 *   ② mensajes de sus commits .... 36/37   ← la que más cubre, y la que nadie miraba
 *   ③ entrada de registro tocada . 22/37   (no sirve para EXIGIRLA: es lo que se quiere probar)
 *   🔴 por ninguna de las tres ... 1/37    (`scrum-orquestador-…`: rama sin número de ticket)
 *
 * Se usan ① y ② **en unión**, no una sola: con ① a secas se escapan los merges cuya rama no lleva
 * número, que son justo los que el caso de SCRUM-828 señala. ③ queda fuera a propósito —usarla
 * sería preguntar por la respuesta—.
 */
export function numeroDelTicket(raiz, { rama = null, env = process.env } = {}) {
  const vias = [];

  // ① el nombre de la rama. En un PR de GitHub, HEAD va desprendido y el nombre vive en el env.
  const nombre = rama ?? env.GITHUB_HEAD_REF ?? (() => {
    try { return git(raiz, 'branch', '--show-current').trim() || null; } catch { return null; }
  })();
  const porRama = numeroDeRama(nombre);
  if (porRama) vias.push({ via: 'rama', num: porRama, detalle: nombre });

  // ② los mensajes de los commits que la rama aporta sobre su base.
  const base = baseDeLaRama(raiz);
  if (base) {
    try {
      const msgs = git(raiz, 'log', `${base.sha}..HEAD`, '--format=%s%x0A%b');
      const nums = [...new Set([...msgs.matchAll(/SCRUM-(\d+)/gi)].map((m) => m[1]))];
      // Un solo número: la rama habla de un ticket. Varios: no se elige, se dice (ver abajo).
      if (nums.length) vias.push({ via: 'commits', num: nums.length === 1 ? nums[0] : null, todos: nums });
    } catch { /* sin historia utilizable */ }
  }

  const deRama = vias.find((v) => v.via === 'rama')?.num ?? null;
  const deCommits = vias.find((v) => v.via === 'commits');

  // La rama manda cuando existe: es la que el flujo de la casa fija (`scrum-<n>-<slug>`).
  if (deRama) return { num: deRama, via: 'rama', vias, nombre };
  if (deCommits?.num) return { num: deCommits.num, via: 'commits', vias, nombre };
  // Varios números y ninguna rama que desempate: NO se elige uno. Adivinar aquí sería peor que
  // no saber — acusaría de faltar una entrada que quizá no le toca a este PR.
  if (deCommits?.todos?.length) return { num: null, via: 'ambiguo', vias, nombre, candidatos: deCommits.todos };
  return { num: null, via: null, vias, nombre };
}

/**
 * 🔴 SCRUM-857 · EL CRITERIO, PURO — para poder aplicarlo a un merge que YA ESTÁ en `main`.
 *
 * `veredictoDeLaRama` sólo sabe mirar la rama de HOY. El caso que este ticket cierra ocurrió en
 * septiembre y está en la historia, así que el control que decide tiene que poder alimentarse con
 * los datos REALES de aquel merge —sacados de git, no inventados— y contestar qué habría dicho el
 * guard antes y qué dice ahora. Sin esto, «el guard ya lo ve» sería una afirmación, no una prueba.
 *
 * `usarAsuntos: false` **apaga la vía nueva** y deja el criterio de SCRUM-854 exacto. Es lo que
 * hace posible la mutación obligatoria: si apagándola no vuelve el verde falso, la vía nueva no
 * es lo que decide y el guard estaría pasando por otra razón.
 */
export function veredictoDeDatos({ rama, asuntos = [], ficheros = [] }, { usarAsuntos = true } = {}) {
  const codigo = ficheros.filter((r) => CARPETAS_DE_CODIGO.some((c) => r.startsWith(c)));
  if (!codigo.length) return { veredicto: CUMPLE, tickets: [], faltan: [], motivo: 'no toca código' };

  const deRama = numeroDeRama(rama);
  const deAsuntos = usarAsuntos
    ? [...new Set(asuntos.map((s) => (String(s).trim().match(/^SCRUM-([0-9]+)/i) || [])[1]).filter(Boolean))]
    : [];
  const tickets = [...new Set([deRama, ...deAsuntos].filter(Boolean))];
  if (!tickets.length) {
    return { veredicto: NO_SE_PUDO_DETERMINAR, tickets, faltan: [], motivo: 'ninguna vía identifica el ticket' };
  }

  const faltan = tickets.filter((n) => !ficheros.some((r) => r.toLowerCase() === entradaDe(n).toLowerCase()));
  return {
    veredicto: faltan.length ? FALTA : CUMPLE,
    tickets,
    faltan,
    motivo: faltan.length ? `falta ${faltan.map(entradaDe).join(', ')}` : 'trae todas sus entradas',
  };
}

/**
 * 🔴 SCRUM-857 · TODOS los tickets de los que esta rama trae TRABAJO, no sólo el de su nombre.
 *
 * ── EL DEFECTO QUE CIERRA ─────────────────────────────────────────────────────────────────
 *
 * El criterio de SCRUM-854 derivaba el ticket del NOMBRE DE LA RAMA, y el nombre no es el único
 * sitio donde vive esa información. **Medido:** dos commits de SCRUM-846 entraron dentro de PRs
 * de la rama `scrum-637-*`, que traían la entrada de la 637 — así que el guard decía CUMPLE y la
 * entrada de la 846 no existió hasta seis días después.
 *
 * ── 🔴 POR QUÉ EL ASUNTO Y NO «EL MENSAJE», Y ESTO SE MIDIÓ ANTES DE ELEGIR ────────────────
 *
 * Sobre **198 merges de PR** (los de los últimos 400 merges de `main`), cobertura de cada vía:
 *
 *   A · nombre de la rama ....................... 186/198  (93,9 %)  ← lo que usaba el guard
 *   B · `SCRUM-n` en CUALQUIER parte del mensaje . 194/198  (98,0 %)
 *   B'· `SCRUM-n` al INICIO del ASUNTO ........... 175/198  (88,4 %)  ← el elegido
 *   C · título del PR (cuerpo del merge) ......... 100/198  (50,5 %)
 *   D · ficheros tocados ......................... 151/198  (76,3 %)
 *
 * Y el número que decidió, «en cuántos merges esa vía ve un ticket que la rama NO ve»:
 *
 *   B  (cualquier parte del mensaje) ... **157 de 198 — 79,3 %**  → INSERVIBLE
 *   B' (inicio del asunto) ............. **18 de 198 — 9,1 %**    → accionable
 *
 * La vía B cuenta las MENCIONES DE PASADA. Medido en el PR #1248: sus commits nombran 778 y 833
 * en el CUERPO —citas a trabajo ajeno— y su único asunto es `SCRUM-846: …`. Un guard que pidiera
 * entrada de todo lo mencionado la pediría en **4 de cada 5 PR**, y *un guard demasiado amplio
 * acaba relajado*: ése es el riesgo real, no el falso negativo.
 *
 * **El asunto es la línea entre SER trabajo de un ticket y MENCIONARLO.** No es una convención
 * inventada aquí: 175 de 198 merges ya la siguen.
 *
 * ⚠️ El squash rompería esta vía —el commit de la rama no llegaría a `main` tal cual— y por eso
 * se midió: de los 198 merges de PR, **198 tienen dos padres y 0 son squash**, y los commits se
 * leen de `<base>..HEAD`, donde están. Si algún día se pasa a squash, esta cifra cambia y hay que
 * volver a medirla antes de fiarse.
 */
export function ticketsDeLaRama(raiz, { rama = null, env = process.env } = {}) {
  const porVia = { rama: null, asuntos: [] };

  const deRama = numeroDelTicket(raiz, { rama, env });
  if (deRama.num && deRama.via === 'rama') porVia.rama = deRama.num;

  const base = baseDeLaRama(raiz);
  if (base) {
    try {
      const salida = git(raiz, 'log', `${base.sha}..HEAD`, '--no-merges', '--format=%s');
      for (const linea of salida.split(String.fromCharCode(10))) {
        const m = linea.trim().match(/^SCRUM-([0-9]+)/i);
        if (m && !porVia.asuntos.includes(m[1])) porVia.asuntos.push(m[1]);
      }
    } catch { /* sin historia utilizable */ }
  }

  const tickets = [...new Set([porVia.rama, ...porVia.asuntos].filter(Boolean))];
  return { tickets, porVia, nombre: deRama.nombre, baseResuelta: !!base };
}

/**
 * El veredicto de ESTA rama.
 *
 * Las dos exenciones son CRITERIOS derivados del contenido, no una lista de ramas que envejece:
 *   · **no toca código** → un PR de sólo documentación no necesita expediente propio;
 *   · **no se sabe el ticket** → no se puede exigir la entrada de un número que no existe. Y esto
 *     NO se cuenta como que cumple: sale con su propio veredicto.
 */
export function veredictoDeLaRama(raiz, opciones = {}) {
  const { rutas, baseResuelta } = ficherosDeLaRama(raiz);
  const tocadas = [...rutas];
  const codigo = tocadas.filter((r) => CARPETAS_DE_CODIGO.some((c) => r.startsWith(c)));

  if (!baseResuelta) {
    return {
      veredicto: NO_SE_PUDO_DETERMINAR,
      motivo: 'no se pudo resolver la base de la rama (checkout somero): sin base no se sabe qué '
        + 'aporta esta rama, y un «no he mirado» no se cuenta como que cumple',
      tocadas, codigo,
    };
  }
  if (codigo.length === 0) {
    return {
      veredicto: CUMPLE,
      motivo: 'no toca código: un PR de sólo documentación no necesita expediente propio',
      tocadas, codigo,
    };
  }

  const t = numeroDelTicket(raiz, opciones);
  // 🔴 SCRUM-857 · TODOS los tickets con trabajo en la rama, no sólo el de su nombre.
  const { tickets, porVia } = ticketsDeLaRama(raiz, opciones);

  if (!tickets.length) {
    return {
      veredicto: NO_SE_PUDO_DETERMINAR,
      motivo: t.via === 'ambiguo'
        ? `los commits nombran varios tickets (${t.candidatos.join(', ')}) y la rama no desempata: `
          + 'elegir uno sería acusar de faltar una entrada que quizá no le toca'
        : 'ni el nombre de la rama ni el asunto de ningún commit dicen a qué ticket pertenece esto',
      tocadas, codigo, ticket: t, tickets, porVia,
    };
  }

  // Cada ticket con trabajo aquí necesita SU entrada. La de otro no vale por él.
  const faltan = tickets.filter((n) => !tocadas.some((r) => r.toLowerCase() === entradaDe(n).toLowerCase()));

  if (faltan.length) {
    return {
      veredicto: FALTA,
      motivo: `toca ${codigo.length} fichero(s) de código y NO trae ${faltan.map(entradaDe).join(', ')}`,
      tocadas, codigo, ticket: t, tickets, porVia,
      faltan,
      esperada: entradaDe(faltan[0]),
      esperadas: faltan.map(entradaDe),
    };
  }
  return {
    veredicto: CUMPLE,
    motivo: `toca código y trae la entrada de ${tickets.map((n) => `SCRUM-${n}`).join(', ')}`,
    tocadas, codigo, ticket: t, tickets, porVia,
    esperada: entradaDe(tickets[0]),
    esperadas: tickets.map(entradaDe),
  };
}
