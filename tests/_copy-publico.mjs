// tests/_copy-publico.mjs — SCRUM-299 (punto 4): detector de PROMESAS de «factura» en el copy público.
//
// LA REGLA (Parte M del máster): sin las variables INVOICING_ES, el documento post-pago es
// «justificante de cobro» (sin numeración de factura, sin QR) — el copy público NUNCA lo promete
// como «factura». El código de emisión YA distingue bien (`allocateInvoiceNumber` → getEmissionMode
// → JUST, V0-0, medido en SCRUM-276). Esto NO vigila la emisión (regla 38 = STOP); vigila el COPY.
//
// ─── QUÉ DISTINGUE UNA PROMESA DE UNA MENCIÓN (declarado, porque es la mitad del guard) ───────────
// (A) PROMESA — CAE: «factura» es el DOCUMENTO que el CLIENTE FINAL recibe / paga / tiene. La señal
//     es la ENTREGA a ese cliente, no la palabra en sí. Tres formas medidas en index.html:
//       · posesivo del cliente:     «aquí tienes TU factura» (:424)
//       · verbo de entrega:         «RECIBE la factura»       (:380)
//       · documento NUMERADO:       «Factura #F-128»          (:433)
// (B) MENCIÓN — NO CAE: «factura(s)» como CATEGORÍA de producto (que es cierta) o como término
//     fiscal/config, SIN entrega al cliente final. Medidas y protegidas:
//       · categoría/feature:  «llevas clientes, gastos y facturas» (:317), la <meta> (:7),
//                             el JSON-LD (:37), la FAQ, «Clientes, gastos, facturas y bot»
//       · responsabilidad:    «el cumplimiento fiscal recae en ti» (terminos:82)
//       · categoría -ción:    «facturación VeriFactu» (:498)   · config del pro: «Serie factura»
//       · acción del pro:     «ya puedes emitir la factura» (email al merchant)
// El discriminador NO mira la palabra: mira si hay señal de ENTREGA AL CLIENTE FINAL pegada a ella.
// «recibo» (el sustantivo justificante) NO es «recibir» (el verbo): por eso el patrón de entrega
// exige formas verbales de recibir y excluye «recibo/recibos».
//
// TRAMPA DE LA CASA (req.5): `public/dashboard/**` es la app del PRO, no material público-cliente —
// «Facturas» ahí es legítimo. Se EXCLUYE del censo por su frontera de carpeta (no por lista a mano).
//
// ─── SCRUM-349 · QUÉ PARTE DEL FICHERO ES COPY (y qué parte NO lo es) ─────────────────────────────
// El censo leía el FICHERO ENTERO, comentarios incluidos. Medido: de los 99.496 bytes de `src/` que
// escanea, **24.466 (24,6%) son comentarios** — 281 bloques. Un comentario no llega a ninguna
// pantalla, así que ahí el guard no vigilaba copy: vigilaba prosa de programador.
//
// Y eso tiene una víctima medida, `lifecycle.service.ts:156`. Ese comentario explica por qué el
// texto de al lado no enumera el documento fiscal, y para explicarlo **no puede nombrarlo**: dice
// «NO usa el posesivo del documento fiscal» donde la frase clara sería «NO dice "tus facturas"».
// Comprobado: la versión clara pone el guard ROJO. La circunlocución es el precio del guard.
//
//   **Un guard que obliga a escribir peor las explicaciones para no despertarlo cobra un impuesto
//   sobre la claridad del código.**
//
// Se arregla por donde debía estar desde el principio: se enmascara lo que NO puede llegar a una
// pantalla, y se conserva lo que sí. `enmascararNoPantalla` devuelve un texto **del mismo largo**,
// con los mismos saltos de línea, así que los números de línea que reporta el detector siguen
// siendo los del fichero real — enmascarar y recortar no es lo mismo.
//
//   · `.ts` / `.js` → AST: se conservan SOLO los literales de cadena y plantilla. Fuera quedan los
//     comentarios y también el código (un `const facturaUrl` tampoco es copy).
//   · `.html`       → fuera los comentarios `<!-- -->`, y dentro de cada `<script>` de JavaScript se
//     aplica lo mismo (28 KB de script en línea: si no, el agujero se muda ahí).
//   · `.json` `.xml` `.webmanifest` `.txt` → intactos: no tienen canal de comentario donde esconder
//     una explicación, y su contenido ES el dato que se publica.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const EXT_PUBLICO = new Set(['.html', '.htm', '.js', '.json', '.xml', '.webmanifest', '.txt']);

/** Espacios del mismo largo, conservando `\n` y `\r` para no mover ni una línea. */
const enBlanco = (s) => s.replace(/[^\n\r]/g, ' ');

/**
 * Deja SOLO los literales de cadena/plantilla de un JS/TS; lo demás, en blanco.
 * Si el parseo falla, devuelve `null` — quien llama decide, porque «no supe leer» no puede
 * confundirse con «no había copy» (sería un guard aprobando por ceguera).
 */
export function literalesDeJs(codigo) {
  let sf;
  try { sf = ts.createSourceFile('x.ts', codigo, ts.ScriptTarget.Latest, true); } catch { return null; }
  // ⚠️ `split('')` y NO `Array.from`: `Array.from` itera por PUNTOS DE CÓDIGO y colapsa cada par
  // suplente (emoji) en un elemento, así que un `⚠️` de un comentario se convertía en UN espacio
  // donde ocupaba DOS unidades. El texto salía más corto y todos los offsets de detrás quedaban
  // corridos — números de línea falsos. Los índices de TypeScript son unidades UTF-16, y aquí
  // también. Lo cazó el suelo de «enmascarar no mueve una sola línea», no la vista.
  const buf = codigo.replace(/[^\n\r]/g, ' ').split('');
  const CADENAS = new Set([
    ts.SyntaxKind.StringLiteral,
    ts.SyntaxKind.NoSubstitutionTemplateLiteral,
    ts.SyntaxKind.TemplateHead,
    ts.SyntaxKind.TemplateMiddle,
    ts.SyntaxKind.TemplateTail,
  ]);
  const visita = (n) => {
    if (CADENAS.has(n.kind)) {
      // `getStart` salta la trivia de delante (comentarios incluidos): se copia el literal y nada más.
      for (let i = n.getStart(sf); i < n.getEnd(); i++) buf[i] = codigo[i];
    }
    ts.forEachChild(n, visita);
  };
  visita(sf);
  return buf.join('');
}

/** Lo que de un fichero puede llegar a una pantalla. Mismo largo que la entrada, siempre. */
export function enmascararNoPantalla(texto, rel) {
  const ext = path.extname(rel).toLowerCase();

  if (ext === '.ts' || ext === '.js') {
    const m = literalesDeJs(texto);
    // Fallback deliberado: si no se puede parsear, se escanea entero. Prefiere un falso rojo (que
    // se investiga) a un falso verde (que no lo mira nadie). El suelo del test lo cuenta aparte.
    return m ?? texto;
  }

  if (ext === '.html' || ext === '.htm') {
    let out = texto.replace(/<!--[\s\S]*?-->/g, enBlanco);
    // Y el mismo criterio dentro de cada <script> de JavaScript. Los que NO son JS (JSON-LD,
    // `application/ld+json`) se dejan: ahí no hay comentarios y su contenido sí se publica.
    out = out.replace(/(<script\b([^>]*)>)([\s\S]*?)(<\/script>)/gi, (todo, abre, attrs, cuerpo, cierra) => {
      if (/type\s*=\s*["']?(?!text\/javascript|module)[^"'\s>]+/i.test(attrs)) return todo;
      const m = literalesDeJs(cuerpo);
      return m === null ? todo : abre + m + cierra;
    });
    return out;
  }

  return texto; // sin canal de comentario: el fichero ES el dato publicado
}

/**
 * Censo DERIVADO por recorrido del árbol (nunca lista a mano): todo el material público-cliente.
 * `public/**` salvo `public/dashboard/**`, + los emails de messaging + el copy de whatsapp.ts
 * (lo que el cliente final recibe). Un fichero de landing nuevo entra solo — ese es el punto.
 * @returns {{rel:string, texto:string}[]}
 */
export function recolectarCopyPublico(raiz) {
  const out = [];
  // SCRUM-349: `texto` es lo que puede LLEGAR A PANTALLA (comentarios y código enmascarados, con
  // los offsets intactos). `bruto` es el fichero tal cual, para que el suelo pueda comparar los dos
  // y notar si el enmascarado se comió el corpus entero.
  const leer = (abs, rel) => {
    const bruto = fs.readFileSync(abs, 'utf8');
    out.push({ rel, texto: enmascararNoPantalla(bruto, rel), bruto });
  };

  const recorrer = (dir, rel, filtro) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, e.name);
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) {
        if (r === 'public/dashboard') continue; // req.5: app del pro, no material público-cliente
        recorrer(abs, r, filtro);
      } else if (filtro(e.name)) {
        leer(abs, r);
      }
    }
  };

  recorrer(path.join(raiz, 'public'), 'public', (n) => EXT_PUBLICO.has(path.extname(n).toLowerCase()));
  // Copy que el CLIENTE FINAL recibe fuera de public/: emails + WhatsApp.
  recorrer(path.join(raiz, 'src', 'modules', 'messaging'), 'src/modules/messaging', (n) => n.endsWith('.ts'));
  const wa = path.join(raiz, 'src', 'integrations', 'whatsapp.ts');
  if (fs.existsSync(wa)) leer(wa, 'src/integrations/whatsapp.ts');
  return out;
}

// Patrones de ENTREGA AL CLIENTE FINAL pegada a «factura». Cada uno con nombre, para poder NOMBRAR
// por qué cayó (req.3: que caiga por el mecanismo, no por un error de parseo).
const PATRONES_PROMESA = [
  { marcador: 'posesivo del cliente (tu/su factura)', re: /\b(?:tu|su|tus|sus)\s+facturas?\b/i },
  { marcador: 'verbo de entrega (recibir → factura)', re: /\brecib(?:es?|en|ir[aá]?s?|ir[eé]is|ir[aá]n)\b[^.<>]{0,25}\bfacturas?\b/i },
  { marcador: 'entrega (aquí tienes/está → factura)', re: /\baqu[ií]\s+(?:tienes|est[aá])\b[^.<>]{0,25}\bfacturas?\b/i },
  { marcador: 'entrega (te enviamos/mandamos → factura)', re: /\bte\s+(?:enviamos|mandamos|paso|adjunto)\b[^.<>]{0,25}\bfacturas?\b/i },
  { marcador: 'documento numerado (factura #/nº)', re: /\bfactura\s*(?:#|nº|n\.º|núm\.?\s*\d|no\.\s*\d)/i },
];

const lineaDe = (texto, idx) => texto.slice(0, idx).split('\n').length;
const recorte = (texto, idx) => texto.slice(Math.max(0, idx - 12), idx + 48).replace(/\s+/g, ' ').trim();

/**
 * PROMESAS de «factura» en un texto. Devuelve una por LÍNEA (varias señales en la misma línea son
 * la misma promesa). NO cae por menciones de categoría/fiscal/config: solo por entrega al cliente.
 * @returns {{linea:number, marcador:string, frag:string}[]}
 */
export function promesasDeFactura(texto) {
  const porLinea = new Map();
  for (const { marcador, re } of PATRONES_PROMESA) {
    const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
    let m;
    while ((m = g.exec(texto)) !== null) {
      const linea = lineaDe(texto, m.index);
      if (!porLinea.has(linea)) porLinea.set(linea, { linea, marcador, frag: recorte(texto, m.index) });
      if (m.index === g.lastIndex) g.lastIndex++; // guarda anti-bucle en match vacío
    }
  }
  return [...porLinea.values()].sort((a, b) => a.linea - b.linea);
}
