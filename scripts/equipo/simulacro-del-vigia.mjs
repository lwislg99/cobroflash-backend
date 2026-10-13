#!/usr/bin/env node
// scripts/equipo/simulacro-del-vigia.mjs — SCRUM-1542
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// HACER SONAR EL AVISO DEL VIGÍA DEL DESPLIEGUE **A PROPÓSITO**
//
// El aviso por Issue (SCRUM-1123) existe desde el 26-sep-2026 y no había disparado NI UNA VEZ:
// 0 Issues con su marca sobre 2.382 filas de la API, medido el 13-oct-2026 por el equipo de
// Javier. Desde que existe, el vigía programado no había salido con código 1. Un canal de aviso
// que no ha sonado nunca no se sabe si funciona — y es el único que diría que un despliegue se
// ha quedado parado.
//
// Esto fabrica una producción CONGELADA y deja que el workflow haga lo demás por su camino de
// siempre. No simula el aviso: provoca el estado que lo dispara.
//
// ── QUÉ SE FABRICA Y QUÉ NO ──────────────────────────────────────────────────────────────────
// SE FABRICA UNA SOLA COSA: lo que contesta `/version`. En vez de `https://yaqu.app/version`, el
// vigía lee una URL `data:` que lleva dentro un commit VIEJO de `main`. Todo lo demás es lo de
// verdad: el mismo `vigilante-de-despliegue.mjs`, el mismo git, la misma cuenta de horas por
// primer padre, el mismo ritmo, el mismo código de salida, el mismo paso de aviso con el mismo
// `GITHUB_TOKEN`, la misma marca y la misma dedupe.
//
// NO SE TOCA: producción (no se le pide nada), ni la memoria del vigía. El workflow no recupera
// ni guarda la caché en un simulacro, así que la lectura fabricada no llega nunca a la pasada
// siguiente — una «producción» inventada en el historial haría decir «RETRASADO, PERO
// DESPLEGANDO» a la primera lectura de verdad.
//
// ── POR QUÉ DOS PASADAS ──────────────────────────────────────────────────────────────────────
// CONGELADO necesita dos lecturas con producción en el mismo commit. Aquí se da la PRIMERA (la
// siembra) contra un historial vacío: tiene que salir 2, «hay hueco y no sé si se está
// cerrando». La segunda la da el paso normal del workflow, y ésa es la que canta.
//
// ── MODOS ────────────────────────────────────────────────────────────────────────────────────
//   node scripts/equipo/simulacro-del-vigia.mjs              # fabrica y siembra; da la URL
//   node scripts/equipo/simulacro-del-vigia.mjs comprobar    # ¿sonó? (lee el entorno del paso)
// ═════════════════════════════════════════════════════════════════════════════════════════════
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { MARGEN_HORAS_PROPUESTO, epochsDeGitLog } from '../_vigilante-de-despliegue.mjs';
import { TITULO_DEL_SIMULACRO } from '../vigia-despliegue-aviso.mjs';

/** Cuánto por ENCIMA del margen tiene que quedar el hueco fabricado, para que no dependa del minuto. */
export const COLCHON_HORAS = 0.5;

/** Cuántas entradas de `main` se miran hacia atrás buscando una lo bastante vieja. */
export const ENTRADAS_A_MIRAR = 400;

/**
 * Qué commit se le va a hacer decir a «producción».
 *
 * Se busca la entrada MÁS NUEVA de `main` que lleve dentro más que el margen (con su colchón) y
 * se fabrica producción en su PADRE: así lo más antiguo «sin desplegar» es esa entrada, y el
 * hueco pasa del margen por poco. No se coge una de hace un mes: un hueco de 700 h también
 * cantaría, pero el aviso llevaría una cifra absurda dentro.
 *
 * @param {{entradas:{sha:string, epoch:number, padre:string|null}[], ahoraEpoch:number, margenHoras?:number}} e
 *   `entradas`: la cadena de PRIMER PADRE de `main`, de la más NUEVA a la más vieja.
 * @returns {{produccion:string, primeraPendiente:string, horas:number}|{ciego:string}}
 */
export function elegirProduccionFabricada({ entradas, ahoraEpoch, margenHoras = MARGEN_HORAS_PROPUESTO } = {}) {
  if (!Array.isArray(entradas) || entradas.length === 0) {
    return { ciego: 'no llegó ninguna entrada de `main`: no hay con qué fabricar el hueco' };
  }
  if (!Number.isFinite(ahoraEpoch)) return { ciego: 'no hay hora de ahora con la que medir' };
  const umbral = (margenHoras + COLCHON_HORAS) * 3600;
  for (const x of entradas) {
    if (!x || !Number.isFinite(x.epoch)) continue;
    if (ahoraEpoch - x.epoch < umbral) continue;
    if (!/^[0-9a-f]{40}$/.test(String(x.padre || ''))) {
      return { ciego: `la entrada ${String(x.sha).slice(0, 8)} es lo bastante vieja pero no tiene padre legible: no hay commit anterior en el que fabricar producción` };
    }
    return { produccion: x.padre, primeraPendiente: x.sha, horas: (ahoraEpoch - x.epoch) / 3600 };
  }
  return { ciego: `ninguna de las ${entradas.length} entradas de \`main\` que llegaron tiene más de ${margenHoras + COLCHON_HORAS} h: no se puede fabricar un hueco que pase del margen` };
}

/** La URL que el vigía lee en vez de `/version`: lleva la respuesta dentro y no sale a la red. */
export function urlFabricada(sha) {
  return 'data:application/json,' + encodeURIComponent(JSON.stringify({ version: sha }));
}

/**
 * ¿Sonó? Se decide sobre lo que GitHub DEVUELVE al leer el Issue, no sobre el log del paso.
 *
 * @param {{salida:string, accion:string, numero:string, issue:object|null, marca:string, runUrl?:string}} e
 *   `salida`: el código del vigía en la pasada que cuenta · `accion`/`numero`: lo que dejó el paso
 *   de aviso · `issue`: `GET /repos/:repo/issues/:numero`, o `null` si no se pudo leer.
 * @returns {{sono:boolean, cerrar:boolean, resumen:string, comentario?:string}}
 */
export function veredictoDelSimulacro({ salida, accion, numero, issue, marca, runUrl = '' } = {}) {
  const no = (porque) => ({ sono: false, cerrar: false, resumen: `🔴 **EL SIMULACRO NO SONÓ** — ${porque}` });
  if (String(salida) !== '1') {
    return no(`el vigía salió con código «${salida || 'ninguno'}» y tenía que salir con 1 (CONGELADA): la producción fabricada no llegó a cantar, así que el paso de aviso no se ha ejercitado.`);
  }
  if (accion !== 'crear' && accion !== 'comentar') {
    return no(`el vigía cantó (salida 1) y el paso de aviso no dejó dicho qué hizo (acción «${accion || 'ninguna'}»): no consta que abriera ni comentara ningún Issue.`);
  }
  if (!/^\d+$/.test(String(numero || ''))) {
    return no(`el paso de aviso dice «${accion}» pero no dio el número del Issue («${numero || ''}»): no se puede comprobar que exista.`);
  }
  if (!issue || typeof issue !== 'object' || typeof issue.number !== 'number') {
    return no(`el paso de aviso dice «${accion}» sobre el Issue #${numero} y GitHub no lo devuelve al leerlo: no consta.`);
  }
  if (!marca || !String(issue.body || '').includes(marca)) {
    return no(`el Issue #${numero} existe pero su cuerpo no lleva la marca del aviso: no es el del vigía.`);
  }
  // Sólo se cierra lo que este simulacro ABRIÓ. Si comentó en un Issue que ya estaba abierto, ése
  // es un aviso de verdad y no es de esta ejecución cerrarlo.
  const abiertoPorElSimulacro = accion === 'crear' && issue.title === TITULO_DEL_SIMULACRO;
  const base = `🧪 **EL AVISO SUENA.** El vigía cantó CONGELADA sobre una producción fabricada y el paso de aviso ${accion === 'crear' ? 'ABRIÓ' : 'COMENTÓ en'} el Issue #${numero}, leído de vuelta en GitHub con su marca.`;
  return {
    sono: true,
    cerrar: abiertoPorElSimulacro,
    resumen: abiertoPorElSimulacro
      ? `${base} Se cierra aquí mismo: era un simulacro.`
      : `${base} NO se cierra: ${accion === 'comentar' ? 'ya estaba abierto antes de este simulacro, y puede ser un aviso de verdad' : 'su título no es el del simulacro'}.`,
    comentario: 'Simulacro terminado (SCRUM-1542): el aviso sonó y este Issue se cierra. '
      + 'Producción NO estuvo congelada; la lectura de arriba salió de una producción fabricada, no de `yaqu.app`.'
      + (runUrl ? `\n\nEjecución: ${runUrl}` : ''),
  };
}

// ── CLI ────────────────────────────────────────────────────────────────────────────────────────
const esCli = process.argv[1]
  && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (esCli && process.argv[2] === 'comprobar') {
  // La marca NO se escribe aquí ni en el paso que comprueba: la da el propio paso de aviso como
  // salida suya, así que se comprueba con la MISMA con la que se escribió. Sin marca, no sonó.
  let issue = null;
  try { issue = JSON.parse(process.env.SIMULACRO_ISSUE_JSON || 'null'); } catch { issue = null; }
  const v = veredictoDelSimulacro({
    salida: process.env.SIMULACRO_SALIDA, accion: process.env.SIMULACRO_ACCION,
    numero: process.env.SIMULACRO_NUMERO, issue, marca: process.env.SIMULACRO_MARCA,
    runUrl: process.env.SIMULACRO_RUN_URL,
  });
  console.log(JSON.stringify(v));
  process.exit(v.sono ? 0 : 1);
} else if (esCli) {
  const AQUI = path.dirname(fileURLToPath(import.meta.url));
  const VIGIA = path.join(AQUI, '..', 'vigilante-de-despliegue.mjs');
  const muere = (motivo) => { console.error('🔴 SIMULACRO: NO SE PUDO FABRICAR — ' + motivo); process.exit(2); };

  const estado = process.env.VIGIA_ESTADO || '';
  if (!estado) muere('falta `VIGIA_ESTADO`: sin historial no hay segunda lectura y no puede salir CONGELADA.');
  // Un historial que ya existe es el del vigía de verdad (o un simulacro a medias): no se escribe
  // encima, y no se compara una producción fabricada con una lectura real.
  if (fs.existsSync(estado)) muere(`ya existe ${estado}: el simulacro sólo corre sobre un historial VACÍO, para no mezclar una lectura fabricada con las de verdad.`);

  let crudo = null;
  try {
    crudo = String(execFileSync('git', ['log', '--first-parent', '-n', String(ENTRADAS_A_MIRAR), '--format=%H %ct %P', 'origin/main'], { encoding: 'utf8' }));
  } catch (e) { muere('no se pudo leer la cadena de primer padre de la punta de `main`: ' + String(e.message).split('\n')[0]); }
  const entradas = crudo.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
    const [sha, ct, padre] = l.split(' ');
    return { sha, epoch: epochsDeGitLog(ct)[0], padre: padre || null };
  });
  const elegido = elegirProduccionFabricada({ entradas, ahoraEpoch: Math.floor(Date.now() / 1000) });
  if (elegido.ciego) muere(elegido.ciego);

  const url = urlFabricada(elegido.produccion);
  console.log('🧪 SIMULACRO · producción FABRICADA en ' + elegido.produccion.slice(0, 8)
    + ' · lo primero «sin desplegar» es ' + elegido.primeraPendiente.slice(0, 8)
    + ', que entró en `main` hace ' + elegido.horas.toFixed(1) + ' h (margen ' + MARGEN_HORAS_PROPUESTO + ' h)'
    + ' · población: ' + entradas.length + ' entradas de `main` miradas');
  console.log('   No se le pide nada a yaqu.app. Lo que sigue es la SIEMBRA: la primera de las dos lecturas.');

  // La siembra: el vigía de verdad, con la URL fabricada. Hereda la salida para que se lea en el log.
  // La URL viaja por el ENTORNO, no por el `argv` del hijo (guard de SCRUM-226).
  const siembra = spawnSync(process.execPath, [VIGIA], {
    // Sin resumen del job: el de la siembra no es el veredicto de esta ejecución. La anotación
    // «⚠️ hay hueco y no sé si se está cerrando» que deja en el run SÍ sale, y es la esperada: es
    // la primera de las dos lecturas, y sin lectura anterior no puede decir otra cosa.
    stdio: 'inherit', env: { ...process.env, VIGIA_URL: url, GITHUB_STEP_SUMMARY: '' },
  });
  // 2 = «hay hueco y no sé si se está cerrando»: es lo ÚNICO que puede decir sin lectura anterior.
  // Cualquier otra cosa es que el escenario no es el que se cree, y entonces no se sigue.
  if (siembra.status !== 2) {
    muere(`la siembra salió con código ${siembra.status} y tenía que salir con 2 (hay hueco, sin lectura anterior). El escenario fabricado no es el que hace falta.`);
  }
  let renglones = [];
  try { renglones = fs.readFileSync(estado, 'utf8').split('\n').filter((l) => l.trim()); } catch { /* se dice abajo */ }
  if (renglones.length !== 1) {
    muere(`la siembra tenía que dejar UN renglón en ${estado} y hay ${renglones.length}: la segunda pasada no tendría con qué comparar.`);
  }

  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, 'url=' + url + '\n');
  else console.log(url);
  console.log('🧪 SIMULACRO · siembra hecha (salida 2, un renglón). La pasada siguiente es la que tiene que cantar.');
}
