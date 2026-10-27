// tests/_respaldo-de-firma.mjs — SCRUM-921c
//
// ¿DÓNDE CONSTA QUE ESTO LO APROBÓ EL FUNDADOR? Las TRES fuentes, y por qué son tres.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 UN GUARD QUE SÓLO MIRE JIRA PRODUCE NUEVE ACUSACIONES FALSAS. ESTÁ MEDIDO.
//
// SCRUM-921b clasificó a mano las 16 firmas decidibles del árbol. De las 10 que resultaron
// REALES, **sólo UNA se respaldaba en un comentario de Jira** (SCRUM-379, comentario 12499).
// Las otras NUEVE se respaldan en el máster o en el registro congelado de microcopy:
//
//     docs/YAQU_MASTER.md:1353   «LAS TRES DECISIONES DEL FUNDADOR: ① …»      (SCRUM-206)
//     docs/YAQU_MASTER.md:376    «Copy oficial v2.1 (fundador, 5-jul-2026…)»  (Parte K1)
//     docs/master/SCRUM-593.md   «Literal del fundador: …»
//     docs/MICROCOPY_APROBADA_SIN_APLICAR.md                                   (×2)
//     docs/master/SCRUM-324 · -428 · -581 · -590                               (×4)
//
// Es decir: el mecanismo obvio —exigir un id de comentario de Jira— habría declarado SIN
// RESPALDO a nueve firmas que son ciertas, y nueve rojos que no se reproducen es un guard que
// alguien apaga. Por eso las fuentes son tres y están nombradas aquí.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL ANCLA ES EL ID DEL COMENTARIO Y SU CONTENIDO, NUNCA EL AUTOR
//
// El campo de autor de Jira **no distingue nada en este proyecto**: el orquestador escribe sus
// comentarios con la cuenta de Javier. Así que «lo firmó el fundador» no se puede resolver
// mirando quién escribió. Se resuelve por el **id del comentario** —que es inmutable y se puede
// volver a abrir— y por lo que ese comentario **dice**.
//
//     🔒 Una autorización sin firma es peor que una prohibición sin mecanismo, porque además
//        parece un mecanismo.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LO QUE ESTE MÓDULO NO PUEDE COMPROBAR, DECLARADO
//
// **Jira no se consulta desde la suite**: no hay red ni credenciales en CI, y un guard que
// dependiera de un servicio externo sería rojo intermitente. De la fuente 1 sólo se comprueba
// la FORMA (`SCRUM-<n> comentario <id>`), que es la que ya exige el README de `docs/microcopy/`
// para la firma delegada. De las fuentes 2 y 3, que son ficheros del repo, se comprueba que
// **existen** y que **atribuyen**.
//
// Y no comprueba que la aprobación sea CIERTA. Eso no lo puede saber un test. SCRUM-921b midió
// el caso que lo demuestra: SCRUM-257 **contiene** el literal, pero en su sección «Alcance», que
// es la propuesta del asesor — mientras «Decisiones del fundador» enumera tres y ninguna es ese
// texto. Un guard ve que el documento lo menciona; no ve en qué sección ni con qué intención.
//
//     🔒 Lo que separa una firma real de una inventada es preguntar QUIÉN aprobó, no DÓNDE aparece.
import fs from 'node:fs';
import path from 'node:path';

// 🔴 El extractor de rutas .md NO se escribe a mano: lo exige SCRUM-534d, y con motivo medido —
// cada expresión suelta nace con sus propios agujeros (SCRUM-718 documentó que la suya no
// admitía el espacio, y dos meses después otro censo nació con el mismo fallo). Mi primera
// versión llevaba su propio /docs/[w./-]+.md/ y ese guard la cazó.
import { citasPorLinea, resuelve, mismoNombreEnOtroSitio } from '../scripts/_documentos-citados.mjs';
import { sinCitas } from './_cita-declarada.mjs';
import { PARES_LEIDOS } from './_pares-leidos-en-jira.mjs';

/** Fuente 1 — Jira. Sólo comprobable por su FORMA: el ticket y el id del comentario. */
export const RE_ANCLA_JIRA = /SCRUM-\d+\s*[·,—-]?\s*comentario\s+(\d{3,})/i;
/** La misma forma, con el ticket capturado y global: para sacar TODOS los pares de un bloque. */
const RE_PAR_JIRA = /SCRUM-(\d+)\s*[·,—-]?\s*comentario\s+(\d{3,})/gi;

/** Los pares (ticket, comentario) que cita un texto, en la forma del ancla. */
export function paresCitados(texto) {
  return [...texto.matchAll(RE_PAR_JIRA)].map((m) => ({ ticket: Number(m[1]), comentario: Number(m[2]) }));
}

/**
 * 🔴 SCRUM-1511h: LA FORMA NO BASTA — el par tiene que estar LEÍDO.
 *
 * Hasta aquí «anclado» era «la cita está bien escrita». Medido en SCRUM-1511 comentario 20743: una
 * marca sembrada con `SCRUM-6604 comentario 99999`, ticket que no existe, se contaba como anclada.
 * Decisión del fundador: SCRUM-1511 comentario 20748, una lista congelada de pares leídos en Jira,
 * sin red. La lista, y lo que NO caza, en `_pares-leidos-en-jira.mjs`.
 *
 * @returns {{ticket:number, comentario:number}[]} los pares citados que NO están en la lista
 */
export function paresNoLeidos(texto, leidos = PARES_LEIDOS) {
  const vistos = new Set(leidos.map((p) => `${p.ticket}/${p.comentario}`));
  return paresCitados(texto).filter((p) => !vistos.has(`${p.ticket}/${p.comentario}`));
}

/** El motivo de una marca que baja de «anclado»: qué par falta y cómo se añade. */
export function motivoParNoLeido(pares) {
  return `par no leído: ${pares.map((p) => `SCRUM-${p.ticket} comentario ${p.comentario}`).join(', ')}`
    + ' — ábrelo en Jira, comprueba que existe y que es de ese ticket, y añade su fila a'
    + ' `tests/_pares-leidos-en-jira.mjs` (con la fecha de la lectura) en el mismo PR';
}
/** Procedencia rastreable, el criterio ya firmado en SCRUM-387: un ticket o un documento. */
export const RE_RASTREABLE = /SCRUM-\d+|docs\/[\w./ -]+/i;
/** Quién atribuye. No vale «aprobado» a secas: hace falta el agente. */
const RE_ATRIBUCION = /(?:aprobad|autorizad|firmad|validad)[oa]s?\s+por\s+el\s+fundador|literal\s+del\s+fundador|decisi[oó]n(?:es)?\s+del\s+fundador|el\s+fundador\s+(?:aprob[oó]|firm[oó]|decidi[oó]|autoriz[oó])/i;

/** Fuentes 2 y 3 — ficheros del repo, comprobables de verdad. */
export function fuentesLocales(raiz) {
  const out = [];
  const add = (p) => { if (fs.existsSync(path.join(raiz, p))) out.push(p); };
  add('docs/YAQU_MASTER.md');                       // fuente 2 · el máster (regla 35)
  add('docs/MICROCOPY_APROBADA_SIN_APLICAR.md');    // fuente 3 · el registro congelado
  for (const dir of ['docs/master', 'docs/microcopy']) {
    const d = path.join(raiz, dir);
    if (!fs.existsSync(d)) continue;
    for (const e of fs.readdirSync(d)) if (e.endsWith('.md')) out.push(`${dir}/${e}`);
  }
  return out;
}

/**
 * El índice de fuentes, leído UNA vez: son ~900 ficheros y se consulta por cada marca.
 *
 * 🔴 SCRUM-1502h: LO CITADO EN UNA FUENTE TAMPOCO RESPALDA. Cada fuente se lee con `sinCitas`,
 * así que una frase entre `[[cita]]` y `[[/cita]]` en un registro ni aporta el literal ni aporta
 * la atribución. Medido el 7-oct (SCRUM-1502 c.18795) y el 23-oct (c.20636): sin esto, citar la
 * frase de una marca en un `docs/master/` nuevo la absolvía igual entre `[[cita]]` que a pelo.
 * Decisión del fundador: SCRUM-1502 comentario 20690. Sobre el árbol de ese día no cambió de
 * nivel ninguna marca (`docs/master/SCRUM-1502.md`, tramo 1502h).
 *
 * ⚠️ LO QUE NO CIERRA, DICHO AQUÍ: la frase copiada A PELO sigue respaldando. El respaldo
 * documental ES «el literal, a pelo, en un fichero que atribuye»: la mayoría de las documentales de
 * ese día sólo constan así en `docs/master/` (cifra en el tramo 1502h), y ninguna regla de forma separa una cita de un
 * registro que documenta la firma. Lo que las separa es quién lo escribió y cuándo.
 *
 * @returns {{ruta:string, texto:string, atribuye:boolean}[]}
 */
export function indiceDeFuentes(raiz) {
  return fuentesLocales(raiz).map((ruta) => {
    const texto = sinCitas(fs.readFileSync(path.join(raiz, ruta), 'utf8'));
    return { ruta, texto, atribuye: RE_ATRIBUCION.test(texto) };
  });
}

/**
 * ¿Dónde consta este literal, con atribución al fundador?
 *
 * Busca la frase en las fuentes 2 y 3. Se exige que el fichero **atribuya** —que diga que lo
 * aprobó el fundador— y no sólo que contenga el texto: ésa es justo la diferencia que SCRUM-921b
 * midió entre SCRUM-593 («Literal del fundador») y SCRUM-257 (lo menciona en «Alcance»).
 *
 * @returns {{ruta:string}|null}
 */
export function respaldoDocumental(indice, frase) {
  if (!esProsaDistintiva(frase)) return null;
  for (const f of indice) {
    if (f.atribuye && f.texto.includes(frase)) return { ruta: f.ruta };
  }
  return null;
}

/**
 * 🔴 SÓLO PROSA, NUNCA UN IDENTIFICADOR — y esto se paga midiendo, como todo lo demás.
 *
 * La primera versión aceptaba cualquier literal de 14 caracteres. Resultado medido: el guard
 * **ABSOLVÍA** a `quotesAdmin.routes.ts:339` —una microcopy que SCRUM-921b verificó a mano como
 * SIN RESPALDO— porque uno de los literales de su función es `internal_error`, que aparece en
 * `docs/YAQU_MASTER.md` por razones que no tienen nada que ver con esa aprobación.
 *
 * Y absolver es PEOR que acusar. Un falso positivo se discute en el rojo; un falso negativo no
 * dice nada, y el árbol se queda con una firma inventada y un guard en verde encima.
 *
 * Una microcopy aprobada es **prosa**: tiene espacios y longitud. Un código de error no.
 */
export function esProsaDistintiva(frase) {
  if (!frase || frase.length < 25) return false;
  if (!/\s\S+\s/.test(frase)) return false;          // al menos tres palabras
  if (/^[\w.$-]+$/.test(frase.trim())) return false; // un identificador suelto no es prosa
  return true;
}

/**
 * El veredicto de un bloque de comentario.
 *
 *   'anclado'     — cita el ticket Y el id del comentario de Jira, y TODOS sus pares están en la
 *                   lista de leídos (SCRUM-1511h). El más fuerte.
 *   'documental'  — el literal consta en el máster o en el registro de microcopy, con atribución.
 *   'rastreable'  — cita un ticket o un documento: se puede ir a mirar. Una marca con la forma del
 *                   ancla y algún par sin leer cae aquí, con su `motivo`.
 *   'sin-respaldo'— no dice dónde consta y el literal no aparece en ninguna fuente.
 *
 * `leidos = null` juzga sólo por la forma, como antes de SCRUM-1511h: existe para que el banco
 * compare con la lista y sin ella, no para el árbol.
 *
 * @param {{texto:string, literales?:string[]}} bloque
 */
export function respaldoDe(bloque, indice, leidos = PARES_LEIDOS) {
  let motivo;
  if (RE_ANCLA_JIRA.test(bloque.texto)) {
    const sinLeer = leidos ? paresNoLeidos(bloque.texto, leidos) : [];
    if (!sinLeer.length) return { nivel: 'anclado' };
    motivo = motivoParNoLeido(sinLeer);
  }
  if (RE_RASTREABLE.test(bloque.texto)) return motivo ? { nivel: 'rastreable', motivo } : { nivel: 'rastreable' };
  for (const frase of bloque.literales ?? []) {
    const d = respaldoDocumental(indice, frase);
    if (d) return { nivel: 'documental', donde: d.ruta, frase };
  }
  return { nivel: 'sin-respaldo' };
}

/**
 * 🔴 UN COMENTARIO PARTE LAS RUTAS, Y EL EXTRACTOR LEE LÍNEA A LÍNEA.
 *
 * Medido en `documentoAsignados.js`: el ajuste del comentario deja la cita así —
 *
 *     // Aprobación registrada en `docs/microcopy/2026-09-08-SCRUM-597-quien-lleva-el-
 *     // documento.md` — una aprobación, un fichero (SCRUM-709).
 *
 * `citasPorLinea` mira cada línea por separado, así que ve `documento.md` como una ruta suelta
 * y la da por fantasma. El documento existe; lo que estaba mal era lo que yo le pasaba. Se
 * quitan los prefijos de comentario y se vuelve a unir lo que el guión de final de línea partió.
 *
 * ⚠️ Esto NO se arregla en `scripts/_documentos-citados.mjs`: ahí la lectura por línea es
 * correcta para su población (ficheros `.md`, donde nadie parte una ruta con `//`). Queda
 * reportado, no tocado — es otro carril.
 */
function sinCortesDeComentario(texto) {
  return texto
    .split('\n')
    .map((l) => l.replace(/^\s*(?:\/\/+|\*|\/\*+)\s?/, ''))
    .join('\n')
    .replace(/-\n(?=\S)/g, '-');
}

/**
 * Los documentos que un bloque CITA y que no existen.
 *
 * Una procedencia que apunta a un fichero fantasma es peor que no tener procedencia: parece
 * rastreable y no lleva a ninguna parte, así que nadie va a mirar. Medido en SCRUM-921c:
 * `scripts/voice-eval.mjs` cita `docs/evidencias/voice-eval/RESULTS.md`, que no existe.
 */
export function referenciasRotas(raiz, texto, desde = '') {
  const rotas = [];
  for (const c of citasPorLinea(sinCortesDeComentario(texto)).citas) {
    // `resuelve` mira también junto al fichero que cita, y `mismoNombreEnOtroSitio` separa el
    // FANTASMA —no existe en ninguna parte— de la simple deuda de nombre: una cita a
    // `MICROCOPY_APROBADA_SIN_APLICAR.md` sin su `docs/` delante apunta a algo que SÍ existe y
    // se puede encontrar. Resolver esto a mano era lo que hacía mi primera versión, y por eso
    // acusaba a dos documentos que están ahí.
    if (resuelve(raiz, c.ruta, desde)) continue;
    if (mismoNombreEnOtroSitio(raiz, c.ruta).length) continue;
    rotas.push(c.ruta);
  }
  return [...new Set(rotas)];
}
