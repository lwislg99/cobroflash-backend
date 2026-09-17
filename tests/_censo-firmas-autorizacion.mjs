// tests/_censo-firmas-autorizacion.mjs — SCRUM-921
//
// TODAS las AFIRMACIONES DE AUTORIZACIÓN del árbol: las frases que dicen que alguien con
// potestad —el fundador, el asesor/orquestador— aprobó, autorizó, firmó o decidió algo.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ NO SE CENSA POR SUBSTRING
//
// Medido sobre este mismo árbol, ANTES de escribir una línea de este fichero:
//
//     «firma»     11.226 líneas   ← casi todo huella encadenada de VeriFactu
//     «firmad»     2.970 líneas   ← casi todo albaranes y partes firmados POR EL CLIENTE
//     «fundador»   3.656 líneas   ← en su mayoría NORMA: «hace falta firma del fundador»
//
// Ninguna de esas tres cuentas mide lo que pregunta el ticket. Lo que se busca no es la
// PALABRA, es la FORMA: un AGENTE con potestad como sujeto o complemento agente de un VERBO
// DE AUTORIZACIÓN en modo declarativo. «Sin firma del fundador no se toca» contiene las dos
// palabras y no afirma nada; «aprobado por el fundador el 4-sep» afirma.
//
//     🔒 Un prefijo no es un nombre, y una subcadena tampoco.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LO QUE ESTE CENSO DEVUELVE, Y POR QUÉ SON TRES CAPAS
//
// Devuelve las tres, no sólo la última, porque un censo que publica únicamente lo que le
// queda después de filtrar no se puede auditar: nadie puede ver qué tiró ni discutirlo.
//
//   1. `bruto`      — toda línea que case una forma de autorización.
//   2. `descartes`  — lo que se tira, CON SU MOTIVO nombrado y su cuenta.
//   3. `candidatos` — lo que queda: afirmaciones de autorización sobre este proyecto.
//
// Y declara su POBLACIÓN: ficheros seguidos, leídos, saltados y líneas leídas. Un «0» sin
// población no es un limpio: es un «no he mirado».
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

// ── Los agentes que en ESTE proyecto pueden autorizar algo ───────────────────────────────
// Salen de docs/equipo/orquestador.md §1 (el asesor ES el orquestador) y de A7 de
// docs/equipo/00-normas-comunes.md (vale la del fundador, o la del orquestador por su
// delegación permanente). No se inventa ninguno: quien no está ahí, no firma aquí.
const AGENTE = '(?:el |la |los |las )?(?:fundador|asesor|orquestador)';

// 🔴 EL LÍMITE DE PALABRA NO ENTIENDE LOS ACENTOS, Y ESO DEJABA CIEGO A ESTE CENSO.
//
// En JavaScript `\w` es `[A-Za-z0-9_]`: `ó` NO es carácter de palabra. Así que `aprob[oó]\b`
// casa «aprobo» y **no casa «aprobó»** — detrás de la `ó` y delante del espacio hay dos
// caracteres no-palabra, y entre dos no-palabra no hay frontera. Medido: la forma `lo+aprobo`
// no reconocía «lo aprobó el fundador», y `agente+verbo` no reconocía «el fundador aprobó /
// autorizó / firmó». O sea: el censo estaba ciego a TODOS los pretéritos con tilde, que en
// castellano son la forma natural de decir que alguien ya autorizó algo.
//
// No lo cazó el control positivo, porque el caso conocido dice «decide» y la `e` sí es palabra.
// Un control positivo prueba lo que prueba: el que pasa no absuelve a los que nadie escribió.
//
//     🔒 La rotura usa la grafía real.
const FIN = '(?![A-Za-z0-9_áéíóúüñÁÉÍÓÚÜÑ])';

// ── Las formas. Cada una lleva NOMBRE, para poder decir por qué entró cada línea ─────────
const FORMAS = [
  ['participio+por', new RegExp(`\\b(?:aprobad|autorizad|firmad|validad|refrendad)[oa]s?\\s+por\\s+${AGENTE}\\b`, 'i')],
  ['decidido+por', new RegExp(`\\b(?:decidid[oa]s?|confirmad[oa]s?)\\s+por\\s+${AGENTE}\\b`, 'i')],
  ['agente+verbo', new RegExp(`\\b(?:el |la )?(?:fundador|asesor|orquestador)\\s+(?:lo\\s+|la\\s+|los\\s+|las\\s+|ya\\s+|s[ií]\\s+|me\\s+|nos\\s+)*(?:decide|decidi[oó]|aprueba|aprob[oó]|autoriza|autoriz[oó]|firma|firm[oó]|valida|valid[oó]|dio|da|dijo)${FIN}`, 'i')],
  ['ok/go+del', new RegExp(`\\b(?:OK|GO|visto\\s+bueno|luz\\s+verde|permiso|bendici[oó]n)\\s+d(?:e|el)\\s+${AGENTE}\\b`, 'i')],
  ['con+ok/go', /\bcon\s+(?:el\s+)?(?:OK|GO|visto\s+bueno|luz\s+verde)\b/i],
  ['decision+de', new RegExp(`\\b(?:por\\s+)?decisi[oó]n\\s+d(?:e|el)\\s+${AGENTE}\\b`, 'i')],
  ['autorizacion+de', new RegExp(`\\bautorizaci[oó]n\\s+d(?:e|el)\\s+${AGENTE}\\b`, 'i')],
  ['autorizacion+SN', /\bautorizaci[oó]n\s+d(?:e|el)\s+la\s+(?:Sesi[oó]n\s+\d|S\d)\b/i],
  ['lo+aprobo', new RegExp(`\\blo\\s+(?:aprob[oó]|autoriz[oó]|firm[oó]|decidi[oó]|valid[oó])${FIN}`, 'i')],
  ['firma+del', new RegExp(`\\b(?:la\\s+)?firma\\s+d(?:e|el)\\s+${AGENTE}\\b`, 'i')],
  ['delegacion', /\bdelegaci[oó]n\s+(?:permanente|del\s+fundador)\b/i],
];

// ── Descartes ────────────────────────────────────────────────────────────────────────────
//
// Un descarte NO es una opinión: es una regla escrita, con nombre, que otro puede leer y
// tumbar. Por eso van aquí y no escondidos dentro de la expresión que acepta, y por eso el
// censo publica cuántas líneas tiró por cada motivo.
const DESCARTES = [
  // 1. El PRODUCTO: el cliente firma albaranes y partes. Eso no autoriza ningún cambio del árbol.
  ['firma-del-producto', /\b(?:albar[aá]n|parte|presupuesto|documento|cliente|t[eé]cnico|firmante|contrato|receptor|destinatario)\w*\s+(?:ya\s+)?firmad|firmad[oa]s?\s+por\s+el\s+(?:cliente|t[eé]cnico|receptor|destinatario)|firma\s+del\s+(?:cliente|t[eé]cnico|receptor)/i],
  // 2. Autoridades EXTERNAS — pero SÓLO cuando son ellas quienes autorizan.
  //
  // 🔴 La primera versión descartaba cualquier línea que NOMBRARA a un tercero, y eso se comió
  // afirmaciones reales de las graves. Medido: `docs/MIGRATIONS_PENDING.md:1804`, «`prisma db
  // push` aplicado contra Railway, **autorizado por el fundador**» —una autorización sobre la
  // base de datos— quedaba fuera del censo por decir «Railway». Tres líneas de ese mismo fichero
  // estaban igual.
  //
  //     🔒 El guard no lee tu intención: mira la forma. Si la forma dice «el fundador autorizó»,
  //        da igual qué producto se nombre en la misma frase.
  //
  // Sólo es alcanzable por las formas que NO exigen agente interno (`con+ok/go`, `lo+aprobo`):
  // las demás ya piden fundador, asesor u orquestador, así que un «aprobado por Meta» a secas ni
  // llega aquí — no entra en el censo siquiera.
  ['agente-externo', new RegExp(
    '(?:aprobad|autorizad|validad|firmad|rechazad)[oa]s?\\s+por\\s+(?:la\\s+|el\\s+)?(?:EXT)\\b'
      .replace('EXT', 'Meta|AEAT|Hacienda|Orden\\s+HAC|BOE|Stripe|Railway|Cloudflare|Resend|WhatsApp|Anthropic|GitHub|yaqu-bot|un\\s+humano')
    + '|(?:OK|GO|visto\\s+bueno|luz\\s+verde|permiso|aprobaci[oó]n)\\s+d(?:e|el)\\s+(?:la\\s+|el\\s+)?(?:Meta|AEAT|Hacienda|BOE|Stripe|Railway|Cloudflare|Resend|WhatsApp|Anthropic|GitHub)\\b', 'i')],
  // 3. Modo deóntico, condicional o interrogativo: EXIGE una firma, no afirma tenerla.
  ['norma-no-afirmacion', /(?:hace\s+falta|har[aá]\s+falta|hay\s+que|se\s+necesita|necesita|exige|exigir|requiere|requerir|debe(?:r[aá]n?)?|tiene\s+que|tendr[aá]\s+que|se\s+para\b|pedir|se\s+pide|sin\s+(?:la\s+)?firma|sin\s+(?:el\s+)?(?:OK|GO|permiso)|no\s+se\s+(?:toca|hereda|usa|construye|manda|empieza)|nunca|jam[aá]s|prohibid|s[oó]?lo\s+(?:vale|cuenta|se)|si\s+no\b|hasta\s+que|mientras\s+no|\?|¿)/i],
];

const RE_JIRA = /\bSCRUM[-\s]?(\d{1,4})\b/gi;
// Procedencia RASTREABLE, con el criterio que este proyecto YA tiene firmado y en uso
// (tests/scrum387-procedencia-aprobacion.test.mjs): un ticket o un documento. Una FECHA SOLA
// no vale, porque no dice dónde mirar. No se inventa criterio: se reutiliza el que hay.
const RE_PROCEDENCIA = /SCRUM-\d+|docs\/[\w./-]+/i;
const EXT_TEXTO = /\.(mjs|js|ts|tsx|md|json|yml|yaml|sql|css|html|txt|sh|mts|cjs)$/i;

/**
 * 🔴 EL BLOQUE CONTIGUO, NO UNA VENTANA DE N LÍNEAS — y esto se paga midiendo.
 *
 * La versión 1 de este censo (commit `eeac08f7`) miraba ±3 líneas alrededor de la afirmación
 * para buscarle procedencia. Medido justo después: de las **26** marcas que declaró «sin
 * procedencia», **24 tenían su `SCRUM-<n>` a más de tres líneas**, dentro del mismo bloque de
 * comentario. O sea: 24 acusaciones falsas, y con la forma más peligrosa que puede tener un
 * hallazgo — una lista de nombres propios que parecía trabajo pendiente.
 *
 * Y la ventana ancha es el error simétrico: un `SCRUM-<n>` a 25 líneas puede no tener nada que
 * ver con la frase que se está juzgando.
 *
 *     🔒 Una ventana fija es una tolerancia disfrazada.
 *
 * Así que no se elige una distancia: se usa la UNIDAD DE LECTURA. El bloque contiguo de líneas
 * no vacías es lo que un humano lee como una sola cosa, y es la misma unidad que usa SCRUM-387
 * cuando une los `//` consecutivos en un bloque. Si la procedencia está en el bloque, está
 * dicha; si hay una línea en blanco de por medio, es otro párrafo y ya no lo está.
 *
 * @returns {{texto:string, desde:number, hasta:number}} el bloque que contiene la línea `i`
 */
export function bloqueContiguo(lineas, i) {
  // 🔴 «Vacía» es vacía DE VERDAD, y esto también se paga midiendo. El primer intento contaba
  // como vacía cualquier línea de sólo `*`, `/`, `>` o `-` — es decir, la línea ` *` con la que
  // un JSDoc separa sus párrafos. Resultado: partía en trozos el bloque de comentario y el
  // `SCRUM-<n>` que estaba cuatro líneas más abajo quedaba fuera. Las «sin procedencia» del
  // estrato canónico pasaron de 26 a 55 cuando tenían que haber BAJADO, que es la señal de que
  // el corte era del instrumento y no del árbol.
  const vacia = (n) => n < 0 || n >= lineas.length || /^\s*$/.test(lineas[n]);
  let desde = i, hasta = i;
  while (!vacia(desde - 1)) desde--;
  while (!vacia(hasta + 1)) hasta++;
  return { texto: lineas.slice(desde, hasta + 1).join('\n'), desde, hasta };
}

/**
 * @param {string} raiz  la raíz del repo
 * @param {{dirs?:string[]}} [opciones]
 * @returns {{poblacion:object, bruto:Array, descartes:Array, candidatos:Array}}
 */
export function censarFirmas(raiz, { dirs = ['tests', 'src', 'scripts', 'docs'] } = {}) {
  const seguidos = execFileSync('git', ['ls-files', '-z', ...dirs], { cwd: raiz, maxBuffer: 1 << 28 })
    .toString('utf8').split('\0').filter(Boolean);

  const poblacion = {
    dirs, ficherosSeguidos: seguidos.length, ficherosLeidos: 0, ficherosSaltados: 0,
    lineasLeidas: 0, saltadosPorExtension: 0, saltadosPorIlegible: 0,
  };
  const bruto = [], descartes = [], candidatos = [];

  for (const rel of seguidos) {
    if (!EXT_TEXTO.test(rel)) { poblacion.ficherosSaltados++; poblacion.saltadosPorExtension++; continue; }
    let texto;
    try { texto = fs.readFileSync(path.join(raiz, rel), 'utf8'); }
    catch { poblacion.ficherosSaltados++; poblacion.saltadosPorIlegible++; continue; }
    poblacion.ficherosLeidos++;
    const lineas = texto.split(/\r?\n/);
    poblacion.lineasLeidas += lineas.length;

    for (let i = 0; i < lineas.length; i++) {
      const fila = clasificarLinea(lineas[i], { fichero: rel, linea: i + 1, lineas, i });
      if (!fila) continue;
      bruto.push(fila);
      (fila.motivo ? descartes : candidatos).push(fila);
    }
  }
  return { poblacion, bruto, descartes, candidatos };
}

/**
 * El clasificador, EXPUESTO A PROPÓSITO.
 *
 * Los controles positivo y negativo tienen que pasar por el MISMO código que el árbol, o no
 * controlan nada: un control que corre por otro camino sólo demuestra que ese otro camino
 * funciona. Por eso esta función se exporta, y por eso el banco le pasa casos conocidos.
 *
 * @returns {null|{fichero:string, linea:number, texto:string, formas:string[], ids:string[], motivo?:string}}
 */
export function clasificarLinea(linea, { fichero = '(caso)', linea: nLinea = 0, lineas = [linea], i = 0 } = {}) {
  const formas = FORMAS.filter(([, re]) => re.test(linea)).map(([n]) => n);
  if (!formas.length) return null;

  const bloque = bloqueContiguo(lineas, i);
  const ids = new Set();
  for (const fuente of [linea, bloque.texto, fichero]) {
    for (const m of String(fuente).matchAll(RE_JIRA)) ids.add(`SCRUM-${m[1]}`);
  }
  const idsEnLaLinea = [...new Set([...linea.matchAll(RE_JIRA)].map((m) => `SCRUM-${m[1]}`))];
  // Procedencia = ticket o documento, en el BLOQUE o en el nombre del fichero (SCRUM-387).
  const procedencia = RE_PROCEDENCIA.test(bloque.texto) || RE_PROCEDENCIA.test(fichero);
  const motivo = (DESCARTES.find(([, re]) => re.test(linea)) || [])[0];

  const fila = {
    fichero, linea: nLinea, texto: linea.trim().slice(0, 300), formas,
    ids: [...ids].sort(), idsEnLaLinea, procedencia, bloque: [bloque.desde + 1, bloque.hasta + 1],
  };
  return motivo ? { ...fila, motivo } : fila;
}

/** Las cuentas por motivo de descarte, para que el censo pueda decir qué tiró y por qué. */
export function porMotivo(descartes) {
  const m = {};
  for (const d of descartes) m[d.motivo] = (m[d.motivo] || 0) + 1;
  return m;
}

export const _formas = FORMAS.map(([n]) => n);
export const _descartes = DESCARTES.map(([n]) => n);
