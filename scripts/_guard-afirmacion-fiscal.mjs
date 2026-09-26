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
import ts from 'typescript';

/** Terminos que situan la frase en NUESTRO terreno fiscal. Sin esto no hay afirmacion nuestra. */
// ⚠️ SCRUM-537 (2ª pasada): faltaba «Agencia Tributaria» escrita entera, que es la forma NATURAL
// de nombrarla en un texto comercial — estaban `aeat` y `hacienda`, pero no ella. Medido: «Sistema
// registrado ante la Agencia Tributaria» pasaba en verde por esto, no por la afirmacion.
const FISCAL = /(veri\s*\*?\s*factu|verifactu|aeat|agencia\s+tributaria|hacienda|rrsif|rd\s*1007|1007\/2023|hac\/1177|sistema inform[aá]tico de facturaci[oó]n|facturaci[oó]n electr[oó]nica|declaraci[oó]n responsable)/i;

/** A · un tramite de certificacion/homologacion que NO EXISTE en este regimen. */
const CERTIFICACION = /(en certificaci[oó]n|certificaci[oó]n|certificad[oa]s?|homologad[oa]s?|homologaci[oó]n|sello de conformidad|acreditad[oa]s?)/i;

/**
 * C · AFIRMA QUE YA SE CUMPLE. Añadida en SCRUM-537 (2ª pasada) tras MEDIR la cobertura de las
 * dos familias anteriores contra el vocabulario que el asesor declara cerrado:
 *
 *   «Facturacion VeriFactu en certificacion»          → caia (A)
 *   «Software homologado para VeriFactu»              → caia (A)
 *   «YaQu ya cumple con VeriFactu»                    → 🔴 PASABA
 *   «Nuestra facturacion es conforme a la AEAT»       → 🔴 PASABA
 *   «Facturacion con plena conformidad VeriFactu»     → 🔴 PASABA
 *   «Sistema ya adaptado a VeriFactu»                 → 🔴 PASABA
 *   «Facturacion validada por la AEAT»                → 🔴 PASABA
 *
 * 2 de 12 cazadas. El aviso del encargo era exacto: una lista de palabras es un suelo minimo, y
 * estas dos familias no cubrian «cumple» ni «conforme», que son las que un comercial escribe
 * primero porque suenan menos técnicas que «certificado».
 *
 * 🔴 CADUCA POR EL CODIGO, NO POR EL DOCUMENTO, y esa eleccion ES este ticket: atarla a que
 * exista `DECLARACION_RESPONSABLE.md` seria repetir el defecto que SCRUM-537 vino a arreglar.
 * Mientras no haya envio a la AEAT no se cumple VeriFactu, se tenga el papel que se tenga — el
 * arbitraje del fundador para hechos medibles es que gana el CODIGO.
 */
const CONFORMIDAD = /(cumpl(e|es|en|imos|o)\b|conforme\b|conformidad|adaptad[oa]s?\b|validad[oa]s?\s+por|registrad[oa]s?\s+ante)/i;

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

      if (CONSTRUIDA.test(limpia) && !envioConstruido && !negada) {
        fuera.push({
          linea: i + 1,
          texto: limpia.slice(0, 160),
          familia: 'B',
          motivo: 'afirma que la facturacion fiscal esta construida (o que solo falta activarla) '
            + 'y el envio a la AEAT NO existe en el codigo',
        });
        continue;
      }

      if (CONFORMIDAD.test(limpia) && !envioConstruido) {
        fuera.push({
          linea: i + 1,
          texto: limpia.slice(0, 160),
          familia: 'C',
          motivo: 'afirma que YA SE CUMPLE (cumple / conforme / adaptado / validado) y el envio a '
            + 'la AEAT NO existe en el codigo. Sin envio no se cumple VeriFactu, se tenga el '
            + 'documento que se tenga: art. 201 bis LGT, 150.000 EUR/ejercicio para el FABRICANTE',
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
 * LAS PIEZAS del envío: lo que el criterio anterior tomaba por «envío construido». Se siguen
 * midiendo y se devuelven, pero YA NO DECIDEN (SCRUM-1128):
 *   ① el código nombra un host de la AEAT para algo que no es el QR, en un fichero que pide red;
 *   ② el esquema declara una cola de remisión (`VfSubmission`).
 *
 * Devuelve también `vistosAeat`, que es el SUELO: si el barrido no encuentra NI SIQUIERA la URL
 * del QR, no está leyendo `src/` y su «no hay envío» es ceguera, no medición.
 */
export function piezasDelEnvio(raiz) {
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

  return { señales, vistosAeat, esquemaLeido: esquema.length > 0 };
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// SCRUM-1128 · EL CRITERIO NUEVO, APROBADO POR EL FUNDADOR EL 25-sep-2026
//
// El criterio anterior confundía «LAS PIEZAS EXISTEN» con «EL ENVÍO FUNCIONA». Bastaba una fila
// `model VfSubmission` en el esquema para que la familia B dejara de bloquear en la landing
// —«cumple», «conforme a la AEAT», «ya está construida»— sin certificado, sin cablear a ninguna
// factura y con los flags en OFF. Lo midió J1 en SCRUM-1127, antes de escribir esa fila.
//
// Ahora «envío construido» exige LAS DOS COSAS A LA VEZ:
//   ① un LLAMANTE: un fichero de `src/` —que no sea el propio cliente ni su cola— que importa
//     `enviarSobre` de `sif.client` como VALOR (no como tipo) y lo LLAMA. Se mide por AST: un
//     comentario, un `import type` o el nombre dentro de una cadena no son una llamada.
//   ② el flag `SIF_ENABLED` en ON en su valor POR DEFECTO de `src/core/flags.ts`.
//
// 🔴 POR QUÉ ESTO NO ES RELAJAR UN GUARD (regla 41 / A7): el criterio nuevo es MÁS ESTRICTO. Todo
// estado que antes daba «no construido» lo sigue dando, y además deja de dar «construido» con
// solo las piezas. La landing queda bloqueada MÁS tiempo, no menos. No se afloja para que pase un
// PR: se corrige un criterio que abría la puerta demasiado pronto. Lo decide la dirección del
// riesgo, y aquí va al lado seguro.
//
// 🔴 Y CUANDO DUDA, BLOQUEA. Un `SIF_ENABLED` encendido SOLO en Railway (variable de entorno) no lo
// ve este guard: la landing sigue bloqueada. Si algún día alguien enciende el flag en el entorno y
// espera que la landing se desbloquee sola, lo que tiene que fallar es ese despliegue, no el
// guard. Lo mismo con un valor por defecto que no sea un `true` literal, o con un `flags.ts` que
// no se pueda leer: cuentan como OFF.
// ─────────────────────────────────────────────────────────────────────────────────────────

/** El flag que tiene que estar en ON. Su valor por DEFECTO, en el código. */
export const FLAG_DEL_ENVIO = 'SIF_ENABLED';
const RUTA_FLAGS = 'src/core/flags.ts';
/** La función del cliente que ENVÍA (`src/modules/fiscal/verifactu/sif.client.ts`, SCRUM-1127). */
export const FUNCION_DE_ENVIO = 'enviarSobre';
const MODULO_CLIENTE = /(^|\/)sif\.client(\.js)?$/;
/** El cliente y su cola no son llamantes de sí mismos. */
const FICHEROS_DEL_CLIENTE = /^src\/modules\/fiscal\/verifactu\/sif\.[a-z]+\.ts$/;

function parsear(fuente, nombre) {
  return ts.createSourceFile(nombre, fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

function sinEnvoltorio(n) {
  let x = n;
  while (x && (ts.isAsExpression(x) || ts.isParenthesizedExpression(x) || ts.isSatisfiesExpression(x))) {
    x = x.expression;
  }
  return x;
}

/**
 * El valor POR DEFECTO de un flag en `flags.ts`, leído del AST de `FLAG_DEFAULTS`.
 * `leido: false` si no encuentra la tabla o la propiedad (CIEGO). Solo un `true` literal es ON.
 */
export function flagPorDefecto(fuente, flag = FLAG_DEL_ENVIO) {
  if (typeof fuente !== 'string' || !fuente) return { leido: false, on: false };
  let res = { leido: false, on: false };
  const visitar = (n) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === 'FLAG_DEFAULTS') {
      const obj = sinEnvoltorio(n.initializer);
      if (obj && ts.isObjectLiteralExpression(obj)) {
        for (const p of obj.properties) {
          if (ts.isPropertyAssignment(p) && p.name.getText() === flag) {
            res = { leido: true, on: sinEnvoltorio(p.initializer).kind === ts.SyntaxKind.TrueKeyword };
          }
        }
      }
    }
    ts.forEachChild(n, visitar);
  };
  visitar(parsear(fuente, RUTA_FLAGS));
  return res;
}

/**
 * Cuántas LLAMADAS a `enviarSobre` del cliente hace un fuente. Por AST: solo cuentan las que usan
 * un nombre importado COMO VALOR desde `sif.client` (directo, renombrado, o `* as x` →
 * `x.enviarSobre`).
 */
export function llamadasAlEnvio(fuente, nombre = 'x.ts') {
  const sf = parsear(fuente, nombre);
  const locales = new Set();
  const espacios = new Set();
  for (const st of sf.statements) {
    if (!ts.isImportDeclaration(st) || !ts.isStringLiteral(st.moduleSpecifier)) continue;
    if (!MODULO_CLIENTE.test(st.moduleSpecifier.text)) continue;
    const c = st.importClause;
    if (!c || c.isTypeOnly || !c.namedBindings) continue;
    if (ts.isNamespaceImport(c.namedBindings)) { espacios.add(c.namedBindings.name.text); continue; }
    for (const el of c.namedBindings.elements) {
      if (el.isTypeOnly) continue;
      if ((el.propertyName ?? el.name).text === FUNCION_DE_ENVIO) locales.add(el.name.text);
    }
  }
  let n = 0;
  const visitar = (x) => {
    if (ts.isCallExpression(x)) {
      const f = x.expression;
      if (ts.isIdentifier(f) && locales.has(f.text)) n += 1;
      else if (ts.isPropertyAccessExpression(f) && ts.isIdentifier(f.expression)
        && espacios.has(f.expression.text) && f.name.text === FUNCION_DE_ENVIO) n += 1;
    }
    ts.forEachChild(x, visitar);
  };
  visitar(sf);
  return n;
}

/**
 * ¿Existe el envío a la AEAT? SCRUM-1128: un LLAMANTE del cliente en `src/` Y el flag en ON, a la
 * vez. Las piezas (`señales`) se devuelven para informar, pero no deciden.
 */
export function envioConstruido(raiz) {
  const piezas = piezasDelEnvio(raiz);

  const llamantes = [];
  let ficherosLeidos = 0;
  for (const f of ficherosTs(path.join(raiz, 'src'))) {
    const rel = path.relative(raiz, f).replace(/\\/g, '/');
    ficherosLeidos += 1;
    if (FICHEROS_DEL_CLIENTE.test(rel)) continue;
    const fuente = fs.readFileSync(f, 'utf8');
    if (!fuente.includes(FUNCION_DE_ENVIO)) continue;   // sin el nombre no puede haber llamada
    const n = llamadasAlEnvio(fuente, rel);
    if (n > 0) llamantes.push({ donde: rel, llamadas: n });
  }

  let fuenteFlags = '';
  try { fuenteFlags = fs.readFileSync(path.join(raiz, RUTA_FLAGS), 'utf8'); } catch { fuenteFlags = ''; }
  const flag = flagPorDefecto(fuenteFlags);

  return {
    construido: llamantes.length > 0 && flag.leido && flag.on,
    llamantes,
    flag: { nombre: FLAG_DEL_ENVIO, leido: flag.leido, on: flag.on },
    ficherosLeidos,
    ...piezas,
  };
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
