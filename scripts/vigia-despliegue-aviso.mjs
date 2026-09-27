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
 * El cuerpo del aviso, EXACTO al que componía el `printf` del YAML — misma prosa, mismo orden.
 * @param {{renglon:string, runUrl:string, marca:string}} e
 */
export function componerCuerpo({ renglon, runUrl, marca }) {
  const r = renglon || '(sin constancia: no se pudo leer .vigia/constancias.log)';
  return 'El vigía del despliegue (`vigia-despliegue.yml`) ha cantado: producción no está al día '
    + 'con `main` y no se está cerrando solo.\n\n'
    + 'Antes esto tardó 8 días en verse (SCRUM-1122) porque el único aviso era el job en rojo y '
    + 'nadie miraba Actions.\n\n'
    + 'Primer sitio donde mirar: los logs de arranque en Railway. Si dicen `[schema] DERIVA`, '
    + 'falta un `ALTER` en producción — mirar `docs/sql/` en `main` por SQL pendiente.\n\n'
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
 * @param {{issues:object[], marca:string, renglon:string, runUrl:string}} e
 * @returns {{accion:'crear'|'comentar', numero?:number, cuerpo:string}|{accion:'no-se-sabe', motivo:string}}
 */
export function decidirAviso({ issues, marca, renglon, runUrl } = {}) {
  if (!marca) return { accion: 'no-se-sabe', motivo: 'sin marca no se puede deduplicar: no se decide nada' };
  const cuerpo = componerCuerpo({ renglon, runUrl, marca });
  const existente = elegirIssueExistente(issues, marca);
  return existente !== null
    ? { accion: 'comentar', numero: existente, cuerpo }
    : { accion: 'crear', cuerpo };
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
  });
  console.log(JSON.stringify(r));
  process.exit(r.accion === 'no-se-sabe' ? 1 : 0);
}
