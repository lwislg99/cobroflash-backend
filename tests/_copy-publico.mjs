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
import fs from 'node:fs';
import path from 'node:path';

const EXT_PUBLICO = new Set(['.html', '.htm', '.js', '.json', '.xml', '.webmanifest', '.txt']);

/**
 * Censo DERIVADO por recorrido del árbol (nunca lista a mano): todo el material público-cliente.
 * `public/**` salvo `public/dashboard/**`, + los emails de messaging + el copy de whatsapp.ts
 * (lo que el cliente final recibe). Un fichero de landing nuevo entra solo — ese es el punto.
 * @returns {{rel:string, texto:string}[]}
 */
export function recolectarCopyPublico(raiz) {
  const out = [];
  const leer = (abs, rel) => out.push({ rel, texto: fs.readFileSync(abs, 'utf8') });

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
