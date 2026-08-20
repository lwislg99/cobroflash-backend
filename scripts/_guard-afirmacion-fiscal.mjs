// scripts/_guard-afirmacion-fiscal.mjs — SCRUM-537
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// QUE PROBLEMA RESUELVE, Y POR QUE NO LO RESUELVE EL GUARD QUE YA HAY
//
// SCRUM-400 vigila una CONJUNCION: «se afirma conformidad Y no hay documento emitido detras».
// Es correcto y no se toca. Pero su segunda mitad es una condicion que CADUCA: uno de sus
// tests fija, a proposito, que «con el documento EMITIDO, la misma frase PASA».
//
// 🔴 MEDIDO EL 20-ago-2026 CONTRA `origin/main`, simulando el documento emitido: el guion H2
// entero y la insignia «Facturacion VeriFactu en certificacion» PASAN LOS DOS EN VERDE. O sea
// que el dia que se emita `docs/legal/DECLARACION_RESPONSABLE.md` (SCRUM-523, en cola), una
// afirmacion FALSA puede volver a la landing con el CI en verde y nadie se entera.
//
// Son dos cosas distintas y hacen falta las dos:
//   · SCRUM-400 → no afirmes conformidad SIN DOCUMENTO.
//   · esto      → no afirmes algo FALSO, tengas el documento que tengas.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// SE VIGILA LA AFIRMACION, NO LA CITA — y esto es el ticket entero
//
// La insignia retirada eran CINCO palabras que no citaban ningun guion y decian lo mismo. Un
// guard que buscara «el guion H2» por su texto no la habria cazado nunca. Asi que aqui no
// aparece ni una frase del guion: lo que se describe es QUE SE AFIRMA.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// DOS FAMILIAS, Y CADUCAN DE FORMA DISTINTA. Esa diferencia es la que gobierna el diseño.
//
//   A · FALSA POR EL REGIMEN — «certificados», «homologados», «en certificacion».
//       NO existe una certificacion de VeriFactu: el art. 13 del RD 1007/2023 establece una
//       DECLARACION RESPONSABLE del productor. No hay tramite que superar, asi que no hay
//       documento, ni codigo, ni fecha que vuelva cierta esta frase. Se bloquea SIEMPRE.
//
//   B · FALSA POR EL ESTADO DEL CODIGO — «esta construida», «solo hay que activarla».
//       Hoy es falsa (auditoria SCRUM-525: el envio a la AEAT no existe). Pero es la clase de
//       frase que el dia que se construya el envio pasa a ser VERDAD.
//       🔴 Por eso NO se cablea un `false` aqui: se DERIVA DEL CODIGO. El dia que exista el
//       envio, esta familia deja de bloquear sola, sin que nadie tenga que acordarse de venir
//       a desactivar nada — que es como mueren los guards.
//
// El arbitraje es el que fijo el fundador: para hechos medibles (que existe, que esta
// construido) gana el CODIGO.
import fs from 'node:fs';
import path from 'node:path';

/** Terminos que situan la frase en NUESTRO terreno fiscal. Sin esto no hay afirmacion nuestra. */
const FISCAL = /(veri\s*\*?\s*factu|verifactu|aeat|hacienda|rrsif|rd\s*1007|1007\/2023|hac\/1177|sistema inform[aá]tico de facturaci[oó]n|facturaci[oó]n electr[oó]nica|declaraci[oó]n responsable)/i;

/** A · un tramite de certificacion/homologacion que NO EXISTE en este regimen. */
const CERTIFICACION = /(en certificaci[oó]n|certificaci[oó]n|certificad[oa]s?|homologad[oa]s?|homologaci[oó]n|sello de conformidad|acreditad[oa]s?)/i;

/** B · «ya esta hecho, solo falta encenderlo». */
const CONSTRUIDA = /(est[aá]\s+construid[oa]|ya\s+est[aá]\s+(construid[oa]|list[oa]|desarrollad[oa]|terminad[oa]|hech[oa])|est[aá]\s+list[oa]|est[aá]\s+desarrollad[oa]|est[aá]\s+terminad[oa]|solo\s+(hay\s+que|falta)\s+activarl[oa]|no\s+puedo\s+activarl[oa]|sin\s+activar|pendiente\s+de\s+activar)/i;

/**
 * Marcas de NEGACION. Sin esto, el guard bloquearia la frase VERDADERA —«VeriFactu no exige
 * certificacion: es una declaracion responsable»— que es justo la que hay que poder decir.
 * Un guard que impide decir la verdad se desactiva, y entonces no protege de nada.
 */
const NEGACION = /\b(no|ni|sin|ninguna?|jam[aá]s|nunca|tampoco)\b/i;

/** Reduce el HTML a lo PUBLICADO: sin comentarios, sin scripts, sin etiquetas. */
export function textoPublicado(html) {
  if (typeof html !== 'string') return null;
  return html
    .replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/<script[\s\S]*?<\/script>/gi, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/<style[\s\S]*?<\/style>/gi, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/<[^>]*>/g, ' ');
}

/**
 * Afirmaciones FALSAS publicadas en un HTML.
 *
 * `envioConstruido` decide si la familia B sigue siendo falsa. Se pasa como argumento —y no se
 * lee aqui dentro— para que el analizador sea puro y se pueda probar en las dos direcciones:
 * con el envio construido y sin el.
 */
export function afirmacionesFalsas(html, { envioConstruido = false } = {}) {
  const texto = textoPublicado(html);
  if (texto === null) return null; // ilegible: lo trata el suelo del llamante
  const fuera = [];
  texto.split(/\r?\n/).forEach((linea, i) => {
    for (const frase of linea.split(/(?<=[.;!?])\s+/)) {
      const limpia = frase.replace(/\s+/g, ' ').trim();
      if (!limpia || !FISCAL.test(limpia)) continue;
      const negada = NEGACION.test(limpia);

      if (CERTIFICACION.test(limpia) && !negada) {
        fuera.push({
          linea: i + 1,
          texto: limpia.slice(0, 160),
          familia: 'A',
          motivo: 'afirma una CERTIFICACION que no existe: el art. 13 del RD 1007/2023 establece '
            + 'una DECLARACION RESPONSABLE del productor, no un tramite de certificacion. Ningun '
            + 'documento la vuelve cierta',
        });
        continue;
      }

      if (CONSTRUIDA.test(limpia) && !envioConstruido) {
        fuera.push({
          linea: i + 1,
          texto: limpia.slice(0, 160),
          familia: 'B',
          motivo: 'afirma que la facturacion fiscal esta construida (o que solo falta activarla) '
            + 'y el envio a la AEAT NO existe en el codigo',
        });
      }
    }
  });
  return fuera;
}

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL HECHO, DERIVADO DEL CODIGO — no de un documento, que es lo que puede mentir
// ═════════════════════════════════════════════════════════════════════════════════════════

/** Hosts de la Agencia Tributaria: si el codigo habla con uno, hay envio. */
const HOST_AEAT = /(aeat\.es|agenciatributaria\.gob\.es)/i;
/**
 * ⚠️ LA URL DEL QR NO CUENTA, Y ES LA TRAMPA DE ESTA MEDICION. `buildVeriFactuQrUrl` construye
 * `…/ValidarQR?…` para IMPRIMIRLA en la factura: es una direccion que se le da al cliente para
 * que compruebe, no una llamada que hagamos. Contarla daria «envio construido» hoy mismo, y el
 * guard dejaria de bloquear la familia B justo cuando mas hace falta.
 */
const ES_QR = /ValidarQR/i;
/**
 * ⚠️ Y LOS ESPACIOS DE NOMBRES TAMPOCO, que fue el segundo hallazgo de esta medicion.
 * `registro.builder.ts` declara `NS_LR` y `NS_SF` con URIs de `agenciatributaria.gob.es`:
 * son IDENTIFICADORES que se escriben dentro del XML, no direcciones que nadie pida — un
 * espacio de nombres XML no se descarga jamas. Contarlos daba «envio construido» hoy mismo,
 * con el resultado exacto que el QR: la familia B dejaba de bloquear justo cuando hace falta.
 *
 * El patron comun de los dos: son cadenas que EMITIMOS, no puntos con los que HABLAMOS. Por
 * eso ademas de excluirlos se exige una primitiva de red en el fichero — lo que distingue
 * una llamada de una constante no es la URL, es que alguien la pida.
 */
const ES_IDENTIFICADOR = /(xmlns|static_files|namespace|\bNS_[A-Z])/i;
/** Lo que convierte una URL en una llamada: que algo la pida. */
const PRIMITIVA_RED = /(fetch\s*\(|https?\.request\s*\(|axios|node-fetch|got\s*\(|new\s+https?\.Agent|soapClient|createClient\s*\()/

function ficherosTs(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) ficherosTs(p, out);
    else if (e.name.endsWith('.ts')) out.push(p);
  }
  return out;
}

/**
 * ¿Existe el envio a la AEAT? Dos señales independientes, y basta una:
 *   ① el codigo nombra un host de la AEAT para algo que no es el QR;
 *   ② el esquema declara una cola de remision (`VfSubmission`).
 *
 * Devuelve tambien `vistos`, que es el SUELO: si el barrido no encuentra NI SIQUIERA la URL del
 * QR, no esta leyendo `src/` y su «no hay envio» es ceguera, no medicion. Y esa ceguera importa
 * en las dos direcciones: manteniendo bloqueada la familia B el dia que el envio SI exista.
 */
export function envioConstruido(raiz) {
  const src = path.join(raiz, 'src');
  const señales = [];
  let vistosAeat = 0;

  for (const f of ficherosTs(src)) {
    const rel = path.relative(raiz, f).replace(/\\/g, '/');
    const fuente = fs.readFileSync(f, 'utf8');
    const pideAlgo = PRIMITIVA_RED.test(fuente);
    for (const linea of fuente.split(/\r?\n/)) {
      if (!HOST_AEAT.test(linea)) continue;
      vistosAeat += 1;
      if (ES_QR.test(linea)) continue;              // se imprime, no se pide
      if (ES_IDENTIFICADOR.test(linea)) continue;   // identifica el XML, no se pide
      if (/^\s*(\/\/|\*|\/\*)/.test(linea)) continue; // un comentario no es una llamada
      if (!pideAlgo) continue;                      // una constante sin quien la pida no es un envio
      señales.push({ tipo: 'host-aeat', donde: rel, texto: linea.trim().slice(0, 120) });
    }
  }

  let esquema = '';
  try { esquema = fs.readFileSync(path.join(raiz, 'prisma', 'schema.prisma'), 'utf8'); } catch { esquema = ''; }
  if (/^\s*model\s+VfSubmission\b/m.test(esquema)) {
    señales.push({ tipo: 'cola', donde: 'prisma/schema.prisma', texto: 'model VfSubmission' });
  }

  return { construido: señales.length > 0, señales, vistosAeat, esquemaLeido: esquema.length > 0 };
}

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL VEREDICTO
// ═════════════════════════════════════════════════════════════════════════════════════════

export const PAGINAS = ['public/index.html', 'public/precios.html', 'public/terminos.html', 'public/privacidad.html'];

/** Puro: recibe las paginas ya leidas y el hecho ya medido. Asi se prueba sin tocar el disco. */
export function comprobar({ paginas, envioConstruido: construido = false }) {
  const lineas = [];
  const fallos = [];
  let paginasLeidas = 0;
  let caracteres = 0;

  for (const { ruta, html } of paginas) {
    const encontradas = afirmacionesFalsas(html, { envioConstruido: construido });
    if (encontradas === null) {
      fallos.push(`SUELO · ${ruta}: no se pudo leer. «Cero afirmaciones» y «no supe leer la pagina» `
        + 'dan el mismo verde y significan lo contrario.');
      lineas.push(`  ${ruta} — ILEGIBLE`);
      continue;
    }
    paginasLeidas += 1;
    caracteres += (textoPublicado(html) || '').replace(/\s+/g, ' ').trim().length;
    lineas.push(`  ${ruta} — ${encontradas.length} afirmacion(es) falsa(s)`);
    for (const a of encontradas) {
      fallos.push(`${ruta}:${a.linea} [familia ${a.familia}] "${a.texto}"\n      → ${a.motivo}`);
    }
  }

  if (paginasLeidas === 0) {
    fallos.push('SUELO · no se leyo NINGUNA pagina: el veredicto no vale nada.');
  }

  return {
    ok: fallos.length === 0,
    salida: [
      `envio a la AEAT en el codigo: ${construido ? 'SI (familia B deja de bloquear)' : 'NO'}`,
      ...lineas,
      ...(fallos.length ? ['', '🔴 AFIRMACIONES QUE NO PUEDEN PUBLICARSE:', ...fallos.map((f) => '   · ' + f)] : []),
    ].join('\n'),
    fallos,
    paginasLeidas,
    caracteres,
  };
}

/** El veredicto sobre el repo de verdad. */
export function comprobarEnDisco(raiz = process.cwd()) {
  const hecho = envioConstruido(raiz);
  const paginas = PAGINAS.map((ruta) => {
    let html = null;
    try { html = fs.readFileSync(path.join(raiz, ruta), 'utf8'); } catch { html = null; }
    return { ruta, html };
  });
  const r = comprobar({ paginas, envioConstruido: hecho.construido });
  return { ...r, hecho };
}
