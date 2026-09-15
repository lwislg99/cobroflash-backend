// scripts/puerta-claude.mjs — SCRUM-853 · la puerta de DONDE SE DESPIERTA
//
// QUÉ PREGUNTA: antes de que `claude.yml` arranque la acción, si el PR sigue abierto; y después,
// si ha quedado una rama que nadie va a mirar.
//
// POR QUÉ AQUÍ Y NO SOLO EN EL AVISADOR, medido el 15-sep-2026: había 47 ramas `claude/pr-*`
// vivas y en TODAS la hora del nombre de la rama era de 1 a 7 min POSTERIOR al merge de su PR.
// No es que Claude terminara tarde: es que ARRANCABA sobre un PR ya mergeado, y con un PR cerrado
// `claude-code-action@v1` no escribe en él — crea una rama nueva (src/github/operations/branch.ts:
// `if (prState === "CLOSED" || prState === "MERGED")` → «Fall through to create a new branch»).
// Rama sin PR, sin CI y sin nadie que la mire. El avisador era UNO de los que llamaban: una
// persona que escribe la mención en un PR ya mergeado produce exactamente la misma rama.
//
// 🔒 «El tope va donde se despierta, no donde se llama.» Esta puerta, igual.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LAS DOS MITADES, una a cada lado de la acción:
//
//   antes    ¿sigue abierto el PR? Si no, NO se arranca, y se CONTESTA: una petición sin
//            respuesta es el peor modo de fallo, porque parece que no ha llegado.
//   despues  ¿quedó una rama muda? La puerta de antes deja dos huecos que desde fuera de la acción
//            no se pueden cerrar, solo DECLARAR: el PR puede entrar en los segundos entre la
//            pregunta y el momento en que la acción lee su estado (→ rama `claude/pr-*`), y puede
//            entrar mientras Claude trabaja (→ Claude empuja a la rama del PR, que este repositorio
//            borra al mergear, y la vuelve a crear). Las dos se dicen en voz alta y a una persona.
//
// 🔴 `claude.yml` ejecuta la copia de MAIN de este fichero (`git show origin/main:`), nunca la del
// checkout: en un `pull_request_review_comment` el checkout trae el código del PR, y ejecutar un
// script de ahí es ejecutar lo que ha escrito quien comenta, con `contents: write`.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { estadoDelPR, prNoAbierto } from './puerta-avisador-rojo.mjs';

const palabra = (estadoPR) => (estadoPR === 'merged' ? 'mergeado' : estadoPR === 'closed' ? 'cerrado' : 'en estado desconocido');

/**
 * ¿Se arranca la acción? Un comentario en un issue no tiene PR que haya podido entrar, así que
 * arranca. En un PR, solo si sigue abierto — la regla es `prNoAbierto`, la misma del avisador.
 * @param {{esPR?:boolean, estadoPR?:string|null}} e
 */
export function antesDeDespertar({ esPR, estadoPR } = {}) {
  if (esPR === false) {
    return { despertar: true, codigo: 'NO-ES-PR', motivo: 'comentario en un issue: no hay PR que haya podido entrar' };
  }
  if (esPR !== true) {
    return { despertar: false, codigo: 'SIN-DATOS', motivo: 'no se sabe si el comentario es de un PR o de un issue: no se arranca' };
  }
  const cerrado = prNoAbierto(estadoPR);
  if (cerrado) return { despertar: false, ...cerrado };
  return { despertar: true, codigo: 'PR-ABIERTO', motivo: 'el PR sigue abierto' };
}

/** La respuesta a quien llamó cuando no se arranca. No lleva la mención: no despierta a nadie. */
export function respuestaSinDespertar({ numero, estadoPR } = {}) {
  const estado = estadoPR === 'merged' || estadoPR === 'closed'
    ? `el PR ya está ${palabra(estadoPR)}`
    : 'no he podido leer si el PR sigue abierto';
  return `No arranco sobre el #${numero}: ${estado} (SCRUM-853).\n\n`
    + 'Con un PR cerrado, cualquier arreglo acabaría en una rama `claude/pr-…` sin PR, que nadie mira. '
    + 'Si hace falta cambiar algo, pídelo en un PR abierto o en un issue.\n';
}

/**
 * ¿Quedó alguna rama muda tras la acción?
 *   · una `claude/pr-<N>-*` que no existía antes de despertar (la acción la crea si ve el PR cerrado);
 *   · con el PR ya no abierto, la rama del PR viva en remoto con otra cabeza que la del PR (Claude
 *     empujó después del merge y la recreó).
 * Si no se pudieron listar las ramas, NO se afirma que no haya ninguna: se declara que no se miró.
 */
export function ramasMudas({ estadoPR, ramasAntes, ramasDespues, ramaCabeza, cabezaPR, cabezaRemota } = {}) {
  if (!Array.isArray(ramasAntes) || !Array.isArray(ramasDespues)) {
    return {
      declarar: true,
      codigo: 'NO-SE-PUDO-MIRAR',
      mudas: [],
      motivo: 'no se pudieron listar las ramas claude/* antes o después de la acción: no se puede afirmar que no haya quedado ninguna muda',
    };
  }
  const corta = (r) => String(r).replace(/^refs\/heads\//, '');
  const previas = new Set(ramasAntes.map(corta));
  const mudas = ramasDespues.map(corta).filter((r) => !previas.has(r));

  // La cabeza remota: '' es «no existe» (lo normal tras un merge: el repositorio borra la rama), un
  // sha de 40 es «existe», y CUALQUIER OTRA COSA es «no se sabe». Lo cazó el laboratorio del
  // 15-sep: un 404 de `gh api -q` llegó aquí como el CUERPO del error, y contarlo como una cabeza
  // distinta de la del PR declaraba una rama muda que no existía.
  const cabeza = cabezaRemota === '' ? '' : (/^[0-9a-f]{40}$/.test(String(cabezaRemota)) ? cabezaRemota : null);
  let sinMirarCabeza = false;
  if (estadoPR !== 'open') {
    if (!ramaCabeza || cabeza === null) sinMirarCabeza = true;
    else if (cabeza && cabeza !== cabezaPR) mudas.push(ramaCabeza);
  }

  if (mudas.length > 0) {
    return {
      declarar: true,
      codigo: 'RAMA-MUDA',
      mudas,
      motivo: `quedó trabajo en ${mudas.join(', ')} con el PR ${palabra(estadoPR)}: fuera de main y sin PR que lo lleve`,
    };
  }
  if (sinMirarCabeza) {
    return {
      declarar: true,
      codigo: 'NO-SE-PUDO-MIRAR',
      mudas,
      motivo: 'no se pudo comprobar si la rama del PR se volvió a crear tras cerrarse (estado del PR o cabeza remota ilegibles)',
    };
  }
  return { declarar: false, codigo: 'SIN-RAMA-MUDA', mudas, motivo: 'la acción no dejó trabajo fuera de un PR abierto' };
}

/** El aviso de rama muda: nombra la rama y a una PERSONA. No lleva la mención de Claude. */
export function avisoRamaMuda({ numero, estadoPR, mudas = [], dueno = '', urlRun = '' } = {}) {
  let t = dueno ? `@${dueno} ` : '';
  t += `🔴 **RAMA MUDA** en el #${numero} (SCRUM-853): el PR está ${palabra(estadoPR)} y este trabajo quedó FUERA de main:\n\n`;
  t += mudas.map((m) => `- \`${m}\``).join('\n');
  t += '\n\nNadie la va a mirar si no se dice aquí. No se borra —es la evidencia—: hay que decidir si ese '
     + 'arreglo hace falta y, si hace, llevarlo a un PR abierto.\n';
  if (urlRun) t += `\nRun: ${urlRun}\n`;
  return t;
}

// ── CLI ────────────────────────────────────────────────────────────────────────────────────
// `node puerta-claude.mjs antes|despues` con el JSON por stdin. Escribe DOS líneas —código y
// motivo— y, si hay algo que publicar, lo deja en el fichero `$CUERPO`.
//   antes    sale 0 si se arranca, 1 si no.
//   despues  sale 0 si no hay nada que declarar, 1 si lo hay.
// Cualquier otra cosa (entrada ilegible, modo desconocido) sale ≠ 0: no saber no arranca nada.
const esCli = process.argv[1]
  && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (esCli) {
  const modo = process.argv[2];
  let crudo = '';
  for await (const trozo of process.stdin) crudo += trozo;
  let e;
  try {
    e = JSON.parse(crudo || '{}');
  } catch {
    console.log('ENTRADA-ILEGIBLE');
    console.log('no se pudo leer el JSON de entrada: no se arranca ni se afirma nada');
    process.exit(1);
  }
  const cuerpo = process.env.CUERPO;
  const pr = (e.pr && typeof e.pr === 'object') ? e.pr : {};
  const estadoPR = estadoDelPR(e.pr);

  if (modo === 'antes') {
    const r = antesDeDespertar({ esPR: e.esPR, estadoPR });
    if (!r.despertar && e.esPR === true && cuerpo) {
      fs.writeFileSync(cuerpo, respuestaSinDespertar({ numero: e.numero, estadoPR }));
    }
    console.log(r.codigo);
    console.log(r.motivo);
    process.exit(r.despertar ? 0 : 1);
  }

  if (modo === 'despues') {
    const r = ramasMudas({
      estadoPR, ramasAntes: e.ramasAntes, ramasDespues: e.ramasDespues,
      ramaCabeza: pr.ramaCabeza, cabezaPR: pr.cabezaPR, cabezaRemota: e.cabezaRemota,
    });
    if (r.codigo === 'RAMA-MUDA' && cuerpo) {
      fs.writeFileSync(cuerpo, avisoRamaMuda({ numero: e.numero, estadoPR, mudas: r.mudas, dueno: e.dueno, urlRun: e.urlRun }));
    }
    console.log(r.codigo);
    console.log(r.motivo);
    process.exit(r.declarar ? 1 : 0);
  }

  console.log('MODO-DESCONOCIDO');
  console.log(`modo «${modo}»: se esperaba «antes» o «despues»`);
  process.exit(2);
}
