// tests/_censo-estrechamientos-linea.mjs — SCRUM-619
//
// Censa los sitios de `src/` donde una LINEA se reconstruye con un juego FIJO de claves.
// Puro: recibe el arbol de ficheros, devuelve el censo. Sin `grep`: AST.
//
// ── 🔴 POR QUE ESTE CENSO, Y QUE ES UN «ESTRECHAMIENTO» ──────────────────────
// La casa tiene una convencion escrita: «Las lineas en la forma que espera `Invoice.lines` —
// `{concept, qty, price, tax}`» (albaranAFactura.ts). Cada vez que alguien construye ese
// literal a partir de una linea que YA EXISTIA, todo lo que la linea trajera de mas se cae —
// sin error, sin aviso y sin diferencia de importe.
//
// El censo cuenta los SITIOS con esa firma exacta. Lo que NO hace es decir cuales pierden algo:
// eso depende de si la linea de entrada traia mas claves, y esa parte es JUICIO, no derivacion.
// Va escrito asi de claro porque un censo que presenta un juicio como una medicion es el engano
// que SCRUM-311 cazo en el guard de SCRUM-271.
//
//   DERIVADO   · cuantos sitios hay, donde estan y con que claves.
//   ESCRITO    · el veredicto de cada uno (PASO / ESTRECHA / FABRICA), en la entrada del master.
//
// ── EL SUELO ─────────────────────────────────────────────────────────────────
// Si el escaner no encuentra ficheros o no encuentra ningun literal con forma de linea, se
// declara CIEGO. Un cero de un instrumento roto se lee igual que «aqui no pasa nada».
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

/** La firma que declara la convencion de la casa, ordenada para poder comparar. */
export const FIRMA_LINEA_FACTURA = ['concept', 'price', 'qty', 'tax'];

function ficherosTs(raiz) {
  const fuera = [];
  (function anda(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) anda(p);
      else if (e.name.endsWith('.ts')) fuera.push(p);
    }
  })(raiz);
  return fuera;
}

/**
 * Los literales con forma de linea que hay en `src/`.
 *
 * @returns {{ficheros:number, conForma:number, estrechamientos:Array<{ruta:string,linea:number,claves:string[]}>}}
 */
export function censarEstrechamientos(raizAbsoluta) {
  const raizSrc = path.join(raizAbsoluta, 'src');
  const ficheros = ficherosTs(raizSrc);
  const estrechamientos = [];
  let conForma = 0;

  for (const f of ficheros) {
    const sf = ts.createSourceFile(f, fs.readFileSync(f, 'utf8'), ts.ScriptTarget.Latest, true);
    const nLinea = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
    // Ruta con barras normales: el censo se compara contra una lista fijada, y en Windows
    // `path.join` mete barras invertidas. Una lista que solo cuadra en un sistema operativo no
    // es una lista, es una casualidad.
    const ruta = path.relative(raizAbsoluta, f).split(path.sep).join('/');

    (function rec(n) {
      if (ts.isObjectLiteralExpression(n)) {
        const claves = [];
        let spread = false;
        for (const p of n.properties) {
          if (ts.isSpreadAssignment(p)) { spread = true; continue; }
          const nom = p.name && (ts.isIdentifier(p.name) ? p.name.text
            : (ts.isStringLiteral(p.name) ? p.name.text : null));
          if (nom) claves.push(nom);
        }
        if (claves.includes('concept')) {
          conForma++;
          claves.sort();
          // 🔴 UN `...spread` NO ES UN ESTRECHAMIENTO, y distinguirlo es media medicion: el
          // camino de la rectificativa hace `({ ...l, price: -l.price })` y CONSERVA todo lo que
          // traiga la linea. Contarlo como estrechamiento habria inflado el numero y mandado a
          // alguien a «arreglar» un sitio que ya estaba bien.
          if (!spread && claves.length === FIRMA_LINEA_FACTURA.length
              && claves.every((c, i) => c === FIRMA_LINEA_FACTURA[i])) {
            estrechamientos.push({ ruta, linea: nLinea(n), claves });
          }
        }
      }
      n.forEachChild(rec);
    })(sf);
  }

  return {
    ficheros: ficheros.length,
    conForma,
    estrechamientos: estrechamientos.sort((a, b) => a.ruta.localeCompare(b.ruta) || a.linea - b.linea),
  };
}
