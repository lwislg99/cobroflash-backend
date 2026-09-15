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
  if (!t.num) {
    return {
      veredicto: NO_SE_PUDO_DETERMINAR,
      motivo: t.via === 'ambiguo'
        ? `los commits nombran varios tickets (${t.candidatos.join(', ')}) y la rama no desempata: `
          + 'elegir uno sería acusar de faltar una entrada que quizá no le toca'
        : 'ni el nombre de la rama ni los commits dicen a qué ticket pertenece esto',
      tocadas, codigo, ticket: t,
    };
  }

  const esperada = entradaDe(t.num);
  const traeEntrada = tocadas.some((r) => r.toLowerCase() === esperada.toLowerCase());
  return {
    veredicto: traeEntrada ? CUMPLE : FALTA,
    motivo: traeEntrada
      ? `toca código y trae ${esperada}`
      : `toca ${codigo.length} fichero(s) de código y NO trae ni toca ${esperada}`,
    tocadas, codigo, ticket: t, esperada,
  };
}
