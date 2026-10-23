// scripts/vigia-despliegue-aviso.mjs — SCRUM-1123 (seguimiento)
//
// LA DECISIÓN DE «AVISAR DE VERDAD» DEL VIGÍA DEL DESPLIEGUE, SACADA DEL YAML.
//
// `.github/workflows/vigia-despliegue.yml` (SCRUM-1123) abre o comenta un Issue de GitHub cuando
// el vigía canta. Esa lógica —componer el cuerpo, y decidir si ya hay un Issue con la marca o hay
// que abrir uno— vivía entera en bash+jq dentro del YAML: intocable por un test, exactamente el
// mismo punto ciego que ya tiene resuelto `scripts/puerta-avisador-rojo.mjs` para el otro avisador
// de esta casa (SCRUM-834/853). Este fichero es la MISMA idea aplicada aquí: se saca la DECISIÓN
// (JSON en, JSON fuera, cero red) a un módulo puro y testeable; el `gh api`/`gh issue` que de
// verdad habla con GitHub se queda en el YAML, fino, llamando a esto para saber QUÉ hacer.
//
// ⚠️ LO QUE ESTO NO VERIFICA, y se dice sin rodeos (encargo del orquestador, 26-sep-2026): que
// `api.github.com` acepte de verdad estas llamadas. Eso es EXACTAMENTE lo mismo que ya acepta
// `avisador-rojo.yml` para su propio `gh pr comment` — ningún test de esta casa levanta un
// servidor falso para hablar con la API de GitHub vía `gh`, porque `gh` no tiene un endpoint
// configurable para eso sin asumir un host de GitHub Enterprise (`GH_HOST`), que cambiaría la
// forma de la URL y no probaría el camino real. Lo que SÍ se prueba aquí, contra dobles, es la
// FORMA de la decisión: qué Issue elige, qué cuerpo compone y qué falla cerrado.

/**
 * Lo que va DELANTE del aviso cuando la ejecución es un SIMULACRO (SCRUM-1542): producción no
 * está congelada, se ha fabricado una a propósito para comprobar que este canal suena. Va lo
 * primero porque es lo primero que tiene que leer quien reciba el correo.
 */
export const AVISO_DE_SIMULACRO = '🧪 **SIMULACRO — PRODUCCIÓN NO ESTÁ CONGELADA.** Esta ejecución '
  + 'fabricó a propósito una producción parada para comprobar que este aviso suena de verdad '
  + '(SCRUM-1542). Lo de abajo es el aviso tal cual saldría; la lectura que cita NO es de '
  + '`yaqu.app`. No hay que hacer nada.\n\n';

/** El título del Issue. El del simulacro lo dice delante: es lo que se lee en el asunto del correo. */
export const TITULO_DEL_AVISO = '🔴 Producción congelada — el vigía del despliegue está en rojo';
export const TITULO_DEL_SIMULACRO = '🧪 SIMULACRO (no es real) · ' + TITULO_DEL_AVISO;

// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 SCRUM-1123f · ¿QUÉ AVERÍA ES? DOS DAN EL MISMO SÍNTOMA, Y SE MIRAN EN SITIOS DISTINTOS
//
// Del 21-oct 12:41Z al 22-oct 12:35Z entraron 55 commits en `main` y Railway NO VIO NINGUNO: cero
// despliegues y cero estados de Railway en los tres servicios (medido por S0, SCRUM-1123e). El
// vigía cantó 8 veces, con razón, y su aviso decía «primer sitio donde mirar: los logs de
// arranque… falta un `ALTER`», que es la causa del 24/25-sep. Con un commit que Railway no ha
// visto no hay logs de arranque que mirar: el aviso acertaba el síntoma y mandaba al sitio
// equivocado.
//
//   · TIPO A · Railway no ve el commit → en GitHub, el commit no tiene NI UN estado de Railway.
//     Tres veces: 4-5 de junio (33 commits), 29-sep (8) y 21-22 de octubre (55).
//   · TIPO B · Railway lo ve y el despliegue falla → estado `failure` del servicio de producción.
//     El 24/25-sep (SCRUM-1122) y dos el 23-oct que se curaron con el merge siguiente.
//
// Los estados los lee el paso de aviso del YAML (`GET /repos/:r/commits/:sha/status`, con el
// `GITHUB_TOKEN` que ya tiene) y los trae aquí; esto sólo DECIDE, sin red.
//
// 🔴 MANDA EL SERVICIO DE PRODUCCIÓN, NO EL ESTADO COMBINADO DEL COMMIT. `guard-acreditacion` sale
// en `failure` en commits que están en producción y sirviendo (`655f1252e`, 23-oct 13:25Z): con el
// combinado, un despliegue sano saldría «tipo B».
//
// 🔴 «NO PUDE LEER» NO ES «CERO ESTADOS». Si la API no contestó para un commit, no se sabe qué
// avería es; decir «Railway no lo ha visto» sería convertir un fallo de lectura en un diagnóstico,
// que es la avería de la casa. Entonces el aviso dice que no lo sabe y nombra las dos.
// ═════════════════════════════════════════════════════════════════════════════════════════════

/** Los servicios del proyecto de Railway, tal como salen en el `context` del estado («<proyecto> - <servicio>»). Medido el 23-oct-2026. */
export const SERVICIOS_DE_RAILWAY = Object.freeze(['cobroflash-backend', 'yaqu-staging', 'guard-acreditacion']);
/** El que sirve `yaqu.app` (su estado de éxito dice «Success - yaqu.app»). */
export const SERVICIO_DE_PRODUCCION = 'cobroflash-backend';

export const TIPO_A = 'railway-no-lo-vio';
export const TIPO_B = 'fallo-el-despliegue';
export const EN_CURSO = 'desplegando';
export const NO_SE_SABE = 'no-se-sabe';

const corto = (sha) => String(sha || '?').slice(0, 9);

/** El servicio de Railway de un estado, o `null` si el estado no es de Railway. */
export function servicioDeRailway(context) {
  const m = / - ([\w.-]+)$/.exec(String(context || ''));
  return m && SERVICIOS_DE_RAILWAY.includes(m[1]) ? m[1] : null;
}

/**
 * Qué avería es, a partir de los estados de los commits de `main` que producción no tiene.
 *
 * @param {{sha:string, leido:boolean, estados?:{context:string,state:string,description?:string}[]}[]} commits
 *        del más nuevo al más viejo (el orden de `git rev-list`)
 * @returns {{tipo:string, sha?:string, descripcion?:string, motivo?:string, filas:object[]}}
 */
export function tipoDeAveria(commits) {
  const filas = [];
  if (!Array.isArray(commits) || commits.length === 0) {
    return { tipo: NO_SE_SABE, motivo: 'no llegó ningún commit sin desplegar que mirar', filas };
  }
  for (const c of commits) {
    if (!c || c.leido !== true || !Array.isArray(c.estados)) {
      return {
        tipo: NO_SE_SABE,
        motivo: `no se pudieron leer los estados de \`${corto(c && c.sha)}\` en GitHub («no pude leer» no es «cero estados»)`,
        filas,
      };
    }
    const deRailway = c.estados.filter((e) => e && servicioDeRailway(e.context));
    const prod = deRailway.find((e) => servicioDeRailway(e.context) === SERVICIO_DE_PRODUCCION);
    filas.push({
      sha: c.sha, railway: deRailway.length,
      produccion: prod ? prod.state : null, descripcion: prod ? (prod.description || '') : '',
    });
  }
  const fallo = filas.find((f) => f.produccion === 'failure' || f.produccion === 'error');
  if (fallo) return { tipo: TIPO_B, sha: fallo.sha, descripcion: fallo.descripcion, filas };
  if (filas.every((f) => f.railway === 0)) return { tipo: TIPO_A, filas };
  const enCurso = filas.find((f) => f.produccion === 'pending');
  if (enCurso) return { tipo: EN_CURSO, sha: enCurso.sha, filas };
  return {
    tipo: NO_SE_SABE,
    motivo: 'Railway sí ha visto estos commits y no dice que `' + SERVICIO_DE_PRODUCCION
      + '` fallara; si dice `success`, es producción la que no sirve lo desplegado (mirar `/version` y el dominio)',
    filas,
  };
}

/** El párrafo de «dónde mirar», según la avería. Sin diagnóstico, el de no saberlo. */
export function dondeMirar(diagnostico) {
  const d = diagnostico || { tipo: NO_SE_SABE, motivo: 'el paso de aviso no trajo los estados de Railway', filas: [] };
  const filas = d.filas || [];
  const tabla = filas.length
    ? '\n\n| commit | estados de Railway | `' + SERVICIO_DE_PRODUCCION + '` |\n|---|---|---|\n'
      + filas.map((f) => `| \`${corto(f.sha)}\` | ${f.railway} | ${f.produccion || '—'} |`).join('\n')
    : '';
  if (d.tipo === TIPO_A) {
    return '🔴 **Railway NO HA VISTO ' + (filas.length === 1 ? 'este commit' : `estos ${filas.length} commits`)
      + '** de `main`: ni un estado de Railway en ninguno. No hay logs de arranque que mirar: el '
      + 'despliegue ni ha empezado. **Primer sitio donde mirar: la conexión del servicio con GitHub en '
      + 'Railway** (el servicio → *Settings* → *Source*, y su registro de actividad). Es la avería de '
      + 'tipo A, y ha pasado tres veces: 4-5 de junio, 29-sep y 21-22 de octubre (SCRUM-1123e).' + tabla;
  }
  if (d.tipo === TIPO_B) {
    return `🔴 **Railway vio \`${corto(d.sha)}\` y el despliegue FALLÓ** (\`${SERVICIO_DE_PRODUCCION}\`: `
      + `«${d.descripcion || 'failure'}»). Primer sitio donde mirar: los logs de arranque de ese `
      + 'despliegue en Railway. Si dicen `[schema] DERIVA`, falta un `ALTER` en producción — mirar '
      + '`docs/sql/` en `main` por SQL pendiente. Es la avería de tipo B (24/25-sep, SCRUM-1122).' + tabla;
  }
  if (d.tipo === EN_CURSO) {
    return `Railway tiene un despliegue EN CURSO de \`${corto(d.sha)}\`. Si en la próxima lectura `
      + 'sigue igual, mirar ese despliegue en Railway.' + tabla;
  }
  return `⚠️ **No he podido saber qué avería es:** ${d.motivo || 'sin motivo'}. Hay dos que dan este `
    + 'mismo síntoma y se miran en sitios distintos: **A** · Railway no ha visto el commit (ni un '
    + 'estado de Railway en GitHub) → la conexión del servicio con GitHub en Railway; **B** · lo vio y '
    + `falló (estado \`failure\` de \`${SERVICIO_DE_PRODUCCION}\`) → los logs de arranque y el \`ALTER\` `
    + 'que falte.' + tabla;
}

/** La mención: sólo un `@usuario` de GitHub bien formado. Cualquier otra cosa es «sin mención». */
export function mencionValida(m) {
  const s = String(m || '').trim();
  return /^@[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(s) ? s : null;
}

/**
 * El cuerpo del aviso.
 * @param {{renglon:string, runUrl:string, marca:string, simulacro?:boolean, diagnostico?:object, mencion?:string}} e
 */
export function componerCuerpo({ renglon, runUrl, marca, simulacro = false, diagnostico, mencion }) {
  const r = renglon || '(sin constancia: no se pudo leer .vigia/constancias.log)';
  // SCRUM-1123f · un aviso que no nombra a nadie no le llega a nadie: el #2455 acumuló 9
  // comentarios del bot con 0 menciones. Va lo primero, para que salga en la notificación.
  const quien = mencionValida(mencion);
  return (simulacro ? AVISO_DE_SIMULACRO : '')
    + (quien ? `${quien} · este aviso es para ti: producción no se está actualizando.\n\n`
      : '⚠️ Este aviso no menciona a nadie (no llegó una mención válida): sólo lo verá quien abra el Issue.\n\n')
    + 'El vigía del despliegue (`vigia-despliegue.yml`) ha cantado: producción no está al día '
    + 'con `main` y no se está cerrando solo.\n\n'
    + dondeMirar(diagnostico) + '\n\n'
    // SCRUM-1542 · aquí decía «tardó 8 días en verse». Eran las «193 h» del log de entonces, y
    // esa cifra era la fecha de escritura de un commit viejo, no el tiempo parado: medido, fueron
    // 24,5 h sin un despliegue bueno (24-sep 16:12Z → 25-sep 16:40Z). El motivo no cambia.
    + 'El 24/25-sep-2026 producción pasó 24,5 h sin un despliegue bueno (SCRUM-1122) y no se '
    + 'enteró nadie, porque el único aviso era el job en rojo y nadie miraba Actions.\n\n'
    + `\`\`\`\n${r}\n\`\`\`\n\n`
    + `Ejecución: ${runUrl}\n\n${marca}\n`;
}

/**
 * ¿Ya hay un Issue ABIERTO con la marca? Mismo criterio que el `jq contains()` que reemplaza:
 * substring EXACTO de la marca dentro del cuerpo, nunca una búsqueda tokenizada (`gh issue list
 * --search` no garantiza casar un literal con `<!-- … -->`, y es justo por lo que el YAML ya lo
 * evitaba). Un Issue sin `body` (puede venir `null`) no casa nunca — no es un error, es que no
 * lleva la marca.
 *
 * @param {object[]} issues  la respuesta de `GET /repos/:repo/issues?state=open` tal cual
 * @param {string} marca
 * @returns {number|null} el número del Issue MÁS ANTIGUO con la marca, o `null` si no hay ninguno
 */
export function elegirIssueExistente(issues, marca) {
  if (!Array.isArray(issues) || !marca) return null;
  for (const it of issues) {
    if (!it || typeof it !== 'object') continue;
    if (it.pull_request) continue; // la API de Issues incluye los PR: no son Issues de aviso
    if (typeof it.number !== 'number') continue;
    if (String(it.body || '').includes(marca)) return it.number;
  }
  return null;
}

/**
 * La decisión completa: qué hacer, con qué cuerpo, y sobre qué Issue si toca comentar.
 * FALLA CERRADO: sin `marca` no hay forma de deduplicar, así que no se decide nada (igual que el
 * resto de guards de esta casa tratan «no sé» y «no hay» como respuestas opuestas).
 *
 * 🔴 SCRUM-1542 · EL SIMULACRO PASA POR AQUÍ MISMO. No tiene una decisión aparte: misma marca,
 * misma dedupe, mismo cuerpo con un párrafo delante y otro título. Un simulacro con su propio
 * camino comprobaría su propio camino, no el del aviso.
 *
 * SCRUM-1123f · `diagnostico` (de `tipoDeAveria`) y `mencion` van al cuerpo; el `tipo` sale
 * también suelto, para que el YAML lo deje en el resumen del job sin parsear prosa.
 *
 * @param {{issues:object[], marca:string, renglon:string, runUrl:string, simulacro?:boolean, diagnostico?:object, mencion?:string}} e
 * @returns {{accion:'crear'|'comentar', numero?:number, cuerpo:string, titulo:string, tipo:string}|{accion:'no-se-sabe', motivo:string}}
 */
export function decidirAviso({ issues, marca, renglon, runUrl, simulacro = false, diagnostico, mencion } = {}) {
  if (!marca) return { accion: 'no-se-sabe', motivo: 'sin marca no se puede deduplicar: no se decide nada' };
  const cuerpo = componerCuerpo({ renglon, runUrl, marca, simulacro, diagnostico, mencion });
  const titulo = simulacro ? TITULO_DEL_SIMULACRO : TITULO_DEL_AVISO;
  const tipo = (diagnostico && diagnostico.tipo) || NO_SE_SABE;
  const existente = elegirIssueExistente(issues, marca);
  return existente !== null
    ? { accion: 'comentar', numero: existente, cuerpo, titulo, tipo }
    : { accion: 'crear', cuerpo, titulo, tipo };
}

/**
 * `VIGIA_ESTADOS_JSON` → diagnóstico. Vacío o ilegible NO tumba el aviso: el aviso tiene que salir
 * igual, diciendo que no sabe qué avería es. Callar el aviso porque no se pudo diagnosticar sería
 * peor que avisar sin diagnóstico.
 */
export function diagnosticoDelEntorno(texto) {
  if (!texto) return tipoDeAveria(null);
  let commits;
  try { commits = JSON.parse(texto); } catch {
    return { tipo: NO_SE_SABE, motivo: 'los estados de Railway llegaron ilegibles (no son JSON)', filas: [] };
  }
  return tipoDeAveria(commits);
}

// ── CLI ────────────────────────────────────────────────────────────────────────────────────────
// Lee `VIGIA_ISSUES_JSON` / `VIGIA_MARCA` / `VIGIA_RENGLON` / `VIGIA_RUN_URL` del ENTORNO —no de
// stdin— porque el YAML ya tiene esos cuatro valores en variables `env:` del paso; por env en vez
// de por stdin se evita un segundo `node -e` sólo para montar el JSON de entrada. Escribe a stdout
// el JSON de `decidirAviso`, que el paso lee con `jq` para decidir `gh issue create`/`comment`.
// Comparación por RUTA RESUELTA (mismo patrón que `puerta-avisador-rojo.mjs`).
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const esCli = process.argv[1]
  && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (esCli) {
  let issues;
  try {
    issues = JSON.parse(process.env.VIGIA_ISSUES_JSON || '[]');
  } catch {
    console.log(JSON.stringify({ accion: 'no-se-sabe', motivo: 'VIGIA_ISSUES_JSON no es JSON legible' }));
    process.exit(1);
  }
  if (!Array.isArray(issues)) {
    console.log(JSON.stringify({ accion: 'no-se-sabe', motivo: 'VIGIA_ISSUES_JSON no es un array' }));
    process.exit(1);
  }
  const r = decidirAviso({
    issues, marca: process.env.VIGIA_MARCA, renglon: process.env.VIGIA_RENGLON, runUrl: process.env.VIGIA_RUN_URL,
    // Sólo el literal `true`, que es lo que da `${{ inputs.simulacro }}`: cualquier otra cosa
    // (vacío en el programado, `false`) es un aviso de verdad.
    simulacro: process.env.VIGIA_SIMULACRO === 'true',
    // SCRUM-1123f · los estados de Railway de los commits sin desplegar, y a quién llamar.
    diagnostico: diagnosticoDelEntorno(process.env.VIGIA_ESTADOS_JSON),
    mencion: process.env.VIGIA_MENCION,
  });
  console.log(JSON.stringify(r));
  process.exit(r.accion === 'no-se-sabe' ? 1 : 0);
}
