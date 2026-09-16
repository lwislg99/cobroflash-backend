// tests/_censo-columnas-derivadas.mjs — SCRUM-761
//
// LAS COLUMNAS DERIVADAS del árbol: campos que el camino REAL de alta no recibe, sino que
// CALCULA a partir de otra cosa de la misma fila (`nameSearch: normalizeSearch(input.name)`).
// Y, enfrente, lo que cada SEMBRADOR escribe de verdad. Todo derivado del AST.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ AST Y NO `grep`
//
// Un `where: { nameSearch }` es una LECTURA y sale igual que una escritura; un comentario que
// mencione la columna sale igual que la columna. Medido en este mismo árbol: de las 6
// apariciones de `nameSearch` en `src/`, UNA sola es la escritura derivada del alta. Un censo
// por texto habría contado seis.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// QUÉ CUENTA COMO «DERIVADA», y por qué así
//
// Un campo del `data:` de un `create`/`upsert` cuyo inicializador es una LLAMADA. Es una
// definición ANCHA a propósito: mete dentro coerciones (`amount.toFixed(2)`) que no son sombras
// de otra columna. Se prefiere pasarse a quedarse corto — un censo que se deja fuera el caso
// que buscas no se distingue de un censo que dice que no hay ninguno, y ése es justo el defecto
// que este fichero existe para no repetir. Quien lea la lista clasifica; el instrumento no
// adivina.
//
// EL CERO NO SE PUBLICA A SECAS: `columnasDerivadas` lleva su propio control positivo
// (`product.nameSearch`, respuesta conocida). Si el censo no lo ve, es que está CIEGO, y eso se
// dice en vez de devolver una lista vacía que se lee igual que «no hay ninguna».
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const aPosix = (p) => p.split(path.sep).join('/');

/** Todos los `.ts` bajo `dir`, recursivo. */
function ficherosTs(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...ficherosTs(p));
    else if (e.name.endsWith('.ts')) out.push(p);
  }
  return out;
}

/**
 * Recorre las escrituras `<algo>.<modelo>.create|createMany|upsert({ data|create: { … } })` de un
 * fichero ya parseado y llama a `alEncontrar(modelo, campo, inicializador, nodoCampo)`.
 *
 * Se comparte entre el lado `src/` y el lado sembrador porque es LA MISMA pregunta hecha a dos
 * árboles; dos copias de esto se desincronizarían solas.
 */
function recorrerCreates(sf, alEncontrar) {
  const visitar = (n) => {
    if (
      ts.isCallExpression(n) &&
      ts.isPropertyAccessExpression(n.expression) &&
      /^(create|createMany|upsert)$/.test(n.expression.name.text)
    ) {
      const recv = n.expression.expression.getText(sf); // prisma.product | tx.product | …
      const m = recv.match(/\.([A-Za-z0-9_]+)$/);
      const arg = n.arguments[0];
      if (m && arg && ts.isObjectLiteralExpression(arg)) {
        for (const pr of arg.properties) {
          if (!ts.isPropertyAssignment(pr)) continue;
          if (!/^(data|create)$/.test(pr.name.getText(sf))) continue;
          const init = pr.initializer;
          if (!ts.isObjectLiteralExpression(init)) continue;
          for (const f of init.properties) {
            if (ts.isPropertyAssignment(f)) alEncontrar(m[1], f.name.getText(sf), f.initializer, f);
            else if (ts.isShorthandPropertyAssignment(f)) alEncontrar(m[1], f.name.getText(sf), null, f);
            else if (ts.isSpreadAssignment(f)) alEncontrar(m[1], '...' + f.expression.getText(sf), null, f);
          }
        }
      }
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
}

/**
 * Las columnas derivadas del camino REAL (`src/`).
 *
 * @param {string} raiz raíz del repo
 * @returns {{ derivadas: Array<{modelo:string,campo:string,expr:string,fichero:string,linea:number}>,
 *            campos:number, ficheros:number, controlPositivo:boolean }}
 */
export function columnasDerivadas(raiz) {
  const derivadas = [];
  let campos = 0;
  const ficheros = ficherosTs(path.join(raiz, 'src'));
  for (const p of ficheros) {
    const sf = ts.createSourceFile('x.ts', fs.readFileSync(p, 'utf8'), ts.ScriptTarget.Latest, true);
    recorrerCreates(sf, (modelo, campo, init, nodo) => {
      campos += 1;
      if (!init || !ts.isCallExpression(init)) return;
      derivadas.push({
        modelo,
        campo,
        expr: init.getText(sf).replace(/\s+/g, ' '),
        fichero: aPosix(path.relative(raiz, p)),
        linea: sf.getLineAndCharacterOfPosition(nodo.getStart(sf)).line + 1,
      });
    });
  }
  // CONTROL POSITIVO — caso de respuesta conocida. `createProduct` deriva `nameSearch` de `name`
  // desde SCRUM-631; si el censo no lo ve, no está midiendo, está ciego.
  const controlPositivo = derivadas.some((d) => d.modelo === 'product' && d.campo === 'nameSearch');
  return { derivadas, campos, ficheros: ficheros.length, controlPositivo };
}

/**
 * Lo que un sembrador escribe: modelos que crea A MANO y campos de cada uno.
 *
 * ⚠️ «A mano» es la parte que importa. Un sembrador que llama al alta real (`createProduct`) NO
 * aparece aquí para ese modelo, y eso es correcto: no tiene ningún campo que se le pueda
 * olvidar. Es la diferencia entre estar exento y estar en falta, y el guard la necesita.
 *
 * El valor de cada campo es el TEXTO de su inicializador, no sólo el nombre: sin él no se puede
 * preguntar CON QUÉ lo escribe, que es la mitad del defecto (`seed-video` sí escribía
 * `nameSearch`, pero con una normalización propia y equivocada).
 *
 * @returns {{ porModelo: Map<string, Map<string,string>>, escrituras:number }}
 */
export function escriturasDeSembrador(raiz, rel) {
  const src = fs.readFileSync(path.join(raiz, rel), 'utf8');
  const sf = ts.createSourceFile('x.ts', src, ts.ScriptTarget.Latest, true);
  const porModelo = new Map();
  let escrituras = 0;
  recorrerCreates(sf, (modelo, campo, init) => {
    escrituras += 1;
    if (!porModelo.has(modelo)) porModelo.set(modelo, new Map());
    porModelo.get(modelo).set(campo, init ? init.getText(sf).replace(/\s+/g, ' ') : '');
  });
  return { porModelo, escrituras };
}
