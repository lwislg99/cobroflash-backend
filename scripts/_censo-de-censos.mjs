// scripts/_censo-de-censos.mjs — SCRUM-927
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 ¿CUÁNTAS MEDICIONES TIENE ESTA CASA, Y CUÁNTAS LAS CORRE ALGUIEN?
//
//     🔒 Convertir 27 sitios arregla 27 sitios; no impide que nazca el 28.
//
// SCRUM-864 escribió un censo, cerró en origen todos los sitios que fugaban y los dejó en cero.
// Un día después habían vuelto dos, porque aquel censo vivía en `docs/master/evidencias/` y **no
// lo corría nadie** (las cifras de aquella tanda, con su fecha, están en `docs/master/SCRUM-864.md`;
// aquí no se repiten para que no envejezcan sin avisar). La pregunta
// que abre SCRUM-927 es si ése fue un caso o es el patrón, y se contesta con DOS cifras juntas:
// cuántos ficheros contienen una medición, y de ésos a cuántos los ejecuta algo.
//
// ── CÓMO SE DECIDE QUÉ ES «UNA MEDICIÓN» — POR LO QUE HACE, NO POR CÓMO SE LLAMA ─────────────
//
// «Censo» en el nombre no prueba que mida, y una medición puede no llamarse así. Se decide por
// AST, nunca por `grep`: `grep` cuenta líneas que MENCIONAN una palabra —comentarios incluidos— y
// aquí los comentarios son larguísimos y hablan precisamente de medir.
//
// Un fichero MIDE si hace las dos cosas:
//   ① **LEE un sujeto**: recorre ficheros, lee del disco o interroga a git (`readdirSync`,
//      `readFileSync`, `execFileSync('git'…)`, un `import` de otro instrumento de la casa).
//   ② **PRODUCE UN AGREGADO**: cuenta, clasifica o compara — `.length`, `++`, `reduce`,
//      `filter`, un `Map`/`Set` que acumula, o un `console.log` de algo calculado.
//
// Leer sin agregar es un script que hace un trabajo (copiar, generar, arrancar). Agregar sin leer
// es aritmética sobre constantes. Hacen falta las dos.
//
// ── Y «LO EJECUTA ALGO» ES ALCANZABILIDAD, NO MENCIÓN ────────────────────────────────────────
//
// Que un `.md` nombre un fichero no lo ejecuta. Que otra evidencia que tampoco corre nadie lo
// lance con `spawnSync` tampoco: eso es una cadena muerta entera. Así que se resuelve por
// ALCANCE TRANSITIVO desde raíces que de verdad arrancan:
//
//   · LA TANDA .... `tests/*.test.mjs` — lo que corre `npm test`.
//   · CI ......... los comandos de `.github/workflows/*.yml` (`npm run X` se resuelve por
//                  `package.json`, y `node <ruta>` directamente).
//   · HOOKS ...... `.claude/hooks/*`, que corren en cada llamada de herramienta.
//
// Y aparte, sin mezclarlo en la misma cifra: **INVOCABLE A MANO** = lo declara `package.json` pero
// no lo alcanza ninguna de las tres. Se puede correr escribiendo su nombre; no corre solo.
//
//   🔒 Lo no clasificable cuenta del lado malo: si no se puede demostrar que algo lo ejecuta,
//      cuenta como no ejecutado. Un «no lo sé» que se apunta del lado bueno infla el verde.
//
// ⛔ NO EJECUTA NADA. Sólo lee y parsea. Correr las evidencias sería impensable: varias tocan la
//    base, la red o el navegador, y algunas esperan un scratchpad que ya no existe.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const EXT = new Set(['.mjs', '.js', '.cjs']);
const FUERA = new Set(['node_modules', '.git', 'dist', 'coverage', 'storage']);

/** Dónde viven las mediciones que este censo juzga. */
export const CARPETAS_SUJETO = ['docs', 'scripts'];

/**
 * `tests/` NO entra en la población A PROPÓSITO, y no es un descuido: los `*.test.mjs` son la
 * RAÍZ —lo que `npm test` corre— así que preguntarse si alguien los ejecuta no tiene sentido; y
 * sus helpers `_*.mjs` los alcanza la tanda por definición. Meterlos dentro haría subir el
 * porcentaje de «ejecutados» sin que ninguna medición dormida se despertara.
 */
export const CARPETAS_RAIZ = ['tests', '.github/workflows', '.claude/hooks', 'scripts/equipo'];

/**
 * 🔴 UNA RAÍZ QUE NO ESTÁ EN EL REPOSITORIO, Y LA CAZÓ LA REVISIÓN A MANO.
 *
 * `scripts/equipo/orquestador-arranque.mjs` y `sesion.mjs` salían como «no los corre nadie»
 * estando VIVOS: los lanza una **tarea programada de Windows** a través de un `arranque.cmd` que
 * NO vive en el árbol —lo genera `scripts/equipo/instalar.mjs`—. Ninguna búsqueda dentro del
 * repositorio puede encontrar esa arista, porque el otro extremo está en el sistema operativo.
 *
 * Se declara aquí, con su nombre y su motivo, en vez de dejar que el censo publique dos muertos
 * que no lo están. Un censo que sólo mira las puertas que conoce llama muerto a lo que entra por
 * la que no miró — y ésa es exactamente la forma de error que este ticket viene a medir.
 */
export const RAICES_FUERA_DEL_ARBOL = new Map([
  ['scripts/equipo/orquestador-arranque.mjs', 'lo lanza `arranque.cmd` desde una tarea programada de Windows (SCRUM-899)'],
  ['scripts/equipo/instalar.mjs', 'genera ese `arranque.cmd`; se ejecuta a mano al montar un puesto'],
]);

// ── ① ¿MIDE? ────────────────────────────────────────────────────────────────────────────────

const LEE_SUJETO = /^(readdirSync|readdir|readFileSync|readFile|globSync|glob|statSync|existsSync)$/;
const AGREGA = /^(filter|reduce|map|flatMap|sort|push|add|set|get|has|join|split|match)$/;

/** Por AST: ¿este fichero lee un sujeto Y produce un agregado? */
export function analizaFuente(rel, fuente) {
  const sf = ts.createSourceFile(rel, fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const s = {
    lee: false, agrega: false, imprime: false, ast: false,
    // señales de que NO se puede volver a correr sobre el árbol y ya está (ver `reproducible`)
    pideArgumento: false, rutaAbsoluta: false, red: false, base: false, navegador: false,
    // 🔴 ¿CAMBIA EL MUNDO? Lo que separa una MEDICIÓN de una HERRAMIENTA. `backup-bd.mjs`,
    // `renumerar-documentos.mjs` o `migrate-stripe-prices-live.mjs` leen y agregan igual que un
    // censo —y por eso el primer criterio los contaba—, pero su producto es un CAMBIO, no un
    // número. Meterlos entre las «mediciones dormidas» inflaría el titular de este ticket con
    // ficheros a los que nadie espera ver correr solos.
    muta: false,
  };
  const ref = [];      // rutas que este fichero menciona como módulo o como proceso a lanzar

  const rec = (n) => {
    if (ts.isCallExpression(n)) {
      const e = n.expression;
      const nom = ts.isPropertyAccessExpression(e) ? e.name.text : ts.isIdentifier(e) ? e.text : '';
      if (LEE_SUJETO.test(nom)) s.lee = true;
      if (AGREGA.test(nom)) s.agrega = true;
      if (nom === 'createSourceFile') { s.ast = true; s.agrega = true; }
      if (nom === 'fetch') s.red = true;
      // `git` interrogado: leer el repositorio es leer un sujeto.
      if (/^(execFileSync|execFile|spawnSync|spawn|exec|execSync)$/.test(nom)) {
        const a0 = n.arguments[0];
        if (a0 && ts.isStringLiteral(a0) && /^(git|gh)$/.test(a0.text)) { s.lee = true; if (a0.text === 'gh') s.red = true; }
        if (a0 && ts.isStringLiteral(a0) && /^(pg_dump|psql|pg_restore)$/.test(a0.text)) s.muta = true;
        // ¿un `git` que ESCRIBE? Entonces no está interrogando: está cambiando el repositorio.
        const a1 = n.arguments[1];
        if (a0 && ts.isStringLiteral(a0) && a0.text === 'git' && a1 && ts.isArrayLiteralExpression(a1)) {
          const sub = a1.elements[0];
          if (sub && ts.isStringLiteral(sub) && /^(add|commit|push|checkout|reset|merge|rebase|tag|worktree)$/.test(sub.text)) s.muta = true;
        }
        // lo que lanza: `node <ruta>` o `<ruta>` directa
        for (const a of n.arguments) rutasDe(a, ref);
      }
      // Prisma que ESCRIBE. Leer la base para contar es medir; crear o borrar filas no lo es.
      if (/^(create|createMany|update|updateMany|upsert|delete|deleteMany|executeRaw|executeRawUnsafe)$/.test(nom)
        && ts.isPropertyAccessExpression(e) && /prisma/i.test(e.expression.getText(sf))) s.muta = true;
      if (nom === 'log' && ts.isPropertyAccessExpression(e) && e.expression.getText(sf) === 'console') {
        // Un `console.log` de algo CALCULADO cuenta como producir un resultado; uno de un
        // literal suelto es un rótulo y no dice nada.
        if (n.arguments.some((a) => !ts.isStringLiteral(a) && !ts.isNoSubstitutionTemplateLiteral(a))) s.imprime = true;
      }
      if (ts.isIdentifier(e) && e.text === 'require') rutasDe(n.arguments[0], ref);
    }
    // `new PrismaClient()`
    if (ts.isNewExpression(n) && n.expression.getText(sf).includes('PrismaClient')) s.base = true;
    if (ts.isPropertyAccessExpression(n)) {
      const t = n.getText(sf);
      if (/^process\.argv/.test(t)) s.pideArgumento = true;
      if (/process\.env\.DATABASE_URL/.test(t)) s.base = true;
      if (/\.length$/.test(t)) s.agrega = true;
    }
    if (ts.isElementAccessExpression(n) && /^process\.argv/.test(n.expression.getText(sf))) s.pideArgumento = true;
    if (ts.isPostfixUnaryExpression(n) || ts.isPrefixUnaryExpression(n)) {
      if (n.operator === ts.SyntaxKind.PlusPlusToken) s.agrega = true;
    }
    if (ts.isImportDeclaration(n) || (ts.isCallExpression(n) && n.expression.kind === ts.SyntaxKind.ImportKeyword)) {
      const esp = ts.isImportDeclaration(n) ? n.moduleSpecifier : n.arguments[0];
      rutasDe(esp, ref);
      const texto = esp && (ts.isStringLiteral(esp) || ts.isNoSubstitutionTemplateLiteral(esp)) ? esp.text : '';
      if (/puppeteer/.test(texto)) s.navegador = true;
      if (/@prisma\/client/.test(texto)) s.base = true;
    }
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateExpression(n)) {
      const t = n.getText(sf);
      if (/[A-Za-z]:[\\/]Users/.test(t)) s.rutaAbsoluta = true;
      if (/_navegador\.mjs|puppeteer/.test(t)) s.navegador = true;
      if (/https?:\/\//.test(t) && /api\.|githubusercontent|\$\{/.test(t)) s.red = true;
    }
    ts.forEachChild(n, rec);
  };
  ts.forEachChild(sf, rec);

  // Las plantillas con `${}` que nombran un `.mjs` también lanzan cosas; se recogen del texto
  // porque su ruta no es un literal y el AST no la puede resolver a un fichero concreto.
  // MIDE = lee un sujeto, produce un agregado, y NO cambia el mundo (ver `muta`).
  return { senales: s, referencias: ref, mide: s.lee && (s.agrega || s.imprime) && !s.muta };
}

/** Saca de un nodo las rutas de fichero que nombra (literales; lo interpolado no se resuelve). */
function rutasDe(nodo, out) {
  if (!nodo) return;
  if (ts.isStringLiteral(nodo) || ts.isNoSubstitutionTemplateLiteral(nodo)) {
    if (/\.(mjs|js|cjs|ts)$/.test(nodo.text) || nodo.text.startsWith('.')) out.push(nodo.text);
    return;
  }
  if (ts.isArrayLiteralExpression(nodo)) { for (const e of nodo.elements) rutasDe(e, out); return; }
  // `pathToFileURL(path.join(RAIZ, 'scripts/x.mjs')).href` — la forma con la que esta casa lanza
  // módulos por ruta absoluta en Windows. Sin bajar por el acceso a propiedad, la arista se
  // pierde y el fichero saldría como «no lo corre nadie» estando vivo: el falso negativo simétrico
  // del que cazó el control positivo.
  if (ts.isPropertyAccessExpression(nodo)) { rutasDe(nodo.expression, out); return; }
  if (ts.isTemplateExpression(nodo)) {
    for (const s of nodo.templateSpans) rutasDe(s.expression, out);
    if (/\.(mjs|js|cjs)$/.test(nodo.getText())) out.push(nodo.getText().replace(/[`$${}]/g, ''));
    return;
  }
  if (ts.isCallExpression(nodo)) { for (const a of nodo.arguments) rutasDe(a, out); }
}

// ── ② EL GRAFO: QUIÉN PUEDE LANZAR A QUIÉN ──────────────────────────────────────────────────

function ficherosDe(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (FUERA.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) ficherosDe(p, out);
    else out.push(p);
  }
  return out;
}

/** Resuelve una ruta mencionada desde un fichero a una ruta relativa del repositorio, o null. */
function resolver(desdeRel, ruta, raiz) {
  if (!ruta || /^(node:|@|[a-z0-9-]+$)/i.test(ruta)) return null; // paquete, no fichero nuestro
  const limpia = ruta.replace(/^file:\/+/, '').replace(/%20/g, ' ');
  const candidatos = limpia.startsWith('.')
    ? [path.resolve(path.dirname(path.join(raiz, desdeRel)), limpia)]
    : [path.join(raiz, limpia), path.resolve(path.dirname(path.join(raiz, desdeRel)), limpia)];
  for (const c of candidatos) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) {
      const r = path.relative(raiz, c).split(path.sep).join('/');
      if (!r.startsWith('..')) return r;
    }
  }
  return null;
}

/** Los `node <ruta>` y `npm run <script>` que menciona un texto plano (YAML, shell, package.json). */
function comandosDe(texto) {
  const rutas = [...texto.matchAll(/node\s+(?:--[\w=-]+\s+)*([\w./-]+\.(?:mjs|js|cjs))/g)].map((m) => m[1]);
  const npms = [...texto.matchAll(/npm\s+run\s+([\w:-]+)/g)].map((m) => m[1]);
  const sueltas = [...texto.matchAll(/\b((?:scripts|docs|tests)\/[\w./-]+\.(?:mjs|js|cjs))/g)].map((m) => m[1]);
  return { rutas: [...rutas, ...sueltas], npms };
}

/**
 * Censa las mediciones del árbol y dice cuáles alcanza algo que de verdad arranca.
 *
 * @param {string} raiz  el repositorio. Un árbol fabricado vale, y es como se le pone delante un
 *                       caso conocido (SCRUM-846).
 */
export function censarCensos(raiz) {
  const abs = path.resolve(raiz);
  const rel = (p) => path.relative(abs, p).split(path.sep).join('/');
  const leer = (r) => { try { return fs.readFileSync(path.join(abs, r), 'utf8'); } catch { return ''; } };

  // ① la población: ficheros ejecutables del sujeto
  const sujeto = CARPETAS_SUJETO.flatMap((c) => ficherosDe(path.join(abs, c)))
    .filter((p) => EXT.has(path.extname(p))).map(rel);

  const analisis = new Map();
  for (const r of sujeto) analisis.set(r, analizaFuente(r, leer(r)));

  // ② las aristas de TODO el árbol (el sujeto también puede lanzar a otro del sujeto)
  const conAristas = [...sujeto];
  for (const c of CARPETAS_RAIZ) {
    for (const p of ficherosDe(path.join(abs, c))) conAristas.push(rel(p));
  }
  const aristas = new Map();
  for (const r of conAristas) {
    const texto = leer(r);
    const salidas = new Set();
    if (EXT.has(path.extname(r))) {
      // 🔴 EN UN FICHERO JS, SÓLO EL AST. La primera versión de esto le pasaba además el
      // extractor de texto plano, y entonces una ruta NOMBRADA EN UN COMENTARIO contaba como
      // ejecución: `censo-mkdtemp.mjs` salía «lo ejecuta la TANDA» porque el guard de SCRUM-864c
      // lo cita en su cabecera para explicar por qué existe. Lo cazó el control positivo, que
      // para eso está. Un fichero que te NOMBRA no te EJECUTA.
      const a = analisis.get(r) || analizaFuente(r, texto);
      for (const x of a.referencias) { const d = resolver(r, x, abs); if (d) salidas.add(d); }
    } else {
      // Lo que no es JS (el YAML de CI, el `.sh` de los hooks) no tiene AST que valga: ahí el
      // texto plano ES el programa, y una ruta escrita es una ruta que se lanza.
      const { rutas } = comandosDe(texto);
      for (const x of rutas) { const d = resolver(r, x, abs); if (d) salidas.add(d); }
    }
    aristas.set(r, salidas);
  }

  // ③ las raíces
  const paquete = (() => { try { return JSON.parse(leer('package.json')); } catch { return {}; } })();
  const scriptsNpm = Object.entries(paquete.scripts || {}).filter(([k]) => !k.startsWith('//'));
  const porNpm = new Map(scriptsNpm);

  /** Un script de npm puede llamar a otros por `npm run`: se sigue la cadena. */
  const ficherosDelScriptNpm = (nombre, vistos = new Set()) => {
    if (vistos.has(nombre)) return [];
    vistos.add(nombre);
    const cuerpo = porNpm.get(nombre);
    if (!cuerpo) return [];
    const { rutas, npms } = comandosDe(cuerpo);
    const salida = rutas.map((x) => resolver('package.json', x, abs)).filter(Boolean);
    for (const otro of npms) salida.push(...ficherosDelScriptNpm(otro, vistos));
    return salida;
  };

  const semillas = new Map(); // fichero → de qué raíz viene
  const sembrar = (f, origen) => { if (f && !semillas.has(f)) semillas.set(f, origen); };

  for (const r of conAristas) {
    if (r.startsWith('tests/') && r.endsWith('.test.mjs')) sembrar(r, 'TANDA');
  }
  for (const r of conAristas) {
    if (!r.startsWith('.github/workflows/')) continue;
    const texto = leer(r);
    const { rutas, npms } = comandosDe(texto);
    for (const x of rutas) sembrar(resolver(r, x, abs), 'CI');
    for (const n of npms) for (const f of ficherosDelScriptNpm(n)) sembrar(f, 'CI');
  }
  for (const r of conAristas) if (r.startsWith('.claude/hooks/')) sembrar(r, 'HOOK');
  for (const [f, motivo] of RAICES_FUERA_DEL_ARBOL) {
    if (fs.existsSync(path.join(abs, f))) sembrar(f, 'ARRANQUE');
    else if (motivo) { /* declarada pero ausente: no se inventa una arista */ }
  }

  // ④ alcance transitivo
  const alcance = new Map(semillas);
  const cola = [...semillas.keys()];
  while (cola.length) {
    const actual = cola.shift();
    for (const sig of (aristas.get(actual) || [])) {
      if (!alcance.has(sig)) { alcance.set(sig, alcance.get(actual)); cola.push(sig); }
    }
  }

  // ⑤ invocables a mano: los que cuelgan de un script de npm que CI no lanza
  const aMano = new Set();
  for (const [nombre] of scriptsNpm) {
    for (const f of ficherosDelScriptNpm(nombre)) {
      if (!alcance.has(f)) {
        aMano.add(f);
        for (const sig of (aristas.get(f) || [])) if (!alcance.has(sig)) aMano.add(sig);
      }
    }
  }

  const filas = sujeto.map((r) => {
    const a = analisis.get(r);
    const s = a.senales;
    return {
      fichero: r,
      mide: a.mide,
      senales: s,
      // 🔴 Lo no clasificable cae del lado malo: sin prueba de que algo lo alcance, no cuenta.
      ejecutadoPor: alcance.get(r) || null,
      aMano: !alcance.has(r) && aMano.has(r),
      // ¿Se puede volver a correr contra el árbol y ya está? Si necesita que alguien le pase una
      // ruta, o una máquina concreta, o la red, o la base, o un navegador, entonces NO: es un acta.
      reproducible: !(s.pideArgumento || s.rutaAbsoluta || s.red || s.base || s.navegador),
    };
  });

  const mediciones = filas.filter((f) => f.mide);
  return {
    poblacion: sujeto.length,
    filas,
    mediciones,
    ejecutadas: mediciones.filter((f) => f.ejecutadoPor),
    aMano: mediciones.filter((f) => !f.ejecutadoPor && f.aMano),
    nadie: mediciones.filter((f) => !f.ejecutadoPor && !f.aMano),
    raices: [...semillas.values()].reduce((m, v) => m.set(v, (m.get(v) || 0) + 1), new Map()),
  };
}

/**
 * 🔴 EL SUELO. Un barrido que no encuentra ficheros contesta «cero mediciones dormidas», que se
 * lee igual que «está todo vigilado».
 */
export function motivosParaNoFiarse(censo) {
  const m = [];
  if (!censo.poblacion) m.push('CERO ficheros ejecutables bajo ' + CARPETAS_SUJETO.join('/ y ') + '/: no hay población.');
  if (!censo.mediciones.length) m.push('CERO mediciones reconocidas: el detector no distingue una medición de un script cualquiera.');
  else if (!censo.ejecutadas.length) {
    m.push('NI UNA medición alcanzable desde una raíz: el grafo no está resolviendo referencias, '
      + 'y entonces «no lo corre nadie» sería el veredicto de un instrumento que no sabe mirar.');
  }
  return m;
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ③ LAS EXCEPCIONES APARCADAS
//
// 🔴 LA PREGUNTA NO ES CUÁNTAS HAY, SINO CUÁNTAS VIGILA ALGUIEN.
//
// Un censo que declara un subconjunto FUERA de su número no está haciendo trampa: casi siempre
// hay un motivo bueno escrito al lado. El caso de SCRUM-864 lo enseña entero — aparcó 15 llamadas
// porque «la limpieza es del llamador», que era verdad, y un día después esas 15 eran el 100% de
// la fuga. El argumento era correcto y la consecuencia nadie la midió.
//
//     🔒 EL LLAMADOR NO SE ACUERDA.
//
// Así que lo que se cuenta aquí es la diferencia entre una excepción VIGILADA y una APARCADA:
//
//   · VIGILADA — algo AFIRMA sobre la propia lista: que no crece, que sus elementos siguen
//     existiendo, que su tamaño es exactamente el declarado. El día que cambia, salta.
//   · APARCADA — la lista sólo se USA para excluir (`filter`, `includes`, `has`). Nadie vuelve a
//     mirarla nunca. Puede seguir siendo correcta; el problema es que si deja de serlo, nada lo
//     dice.
//
// No se juzga si el motivo era bueno: eso no lo puede decir un AST. Se juzga si hay MECANISMO.
// ═════════════════════════════════════════════════════════════════════════════════════════════

/** Nombres que anuncian «esto queda fuera del número». */
const NOMBRE_DE_EXCEPCION = /(EXCEPCION|EXCEPCIONES|DECLARAD|CONOCID|HEREDAD|PENDIENTE|LISTA_BLANCA|BLANCA|IGNORA|EXENT|SALVO|PERMITID|TOLERAD|SIN_|_FUERA|FUERA_DE|NO_SE_|OMIT|EXCLU)/;

/**
 * Los nombres que un fichero IMPORTA y usa dentro de un `assert`, con el módulo de donde vienen.
 *
 * 🔴 Hace falta porque una lista se declara en un módulo y **la vigila su test, desde fuera**:
 * `DECLARADAS` vive en `scripts/_censo-mkdtemp.mjs` y quien afirma sobre ella es
 * `tests/scrum864c`. Mirando sólo dentro del fichero, esa lista salía «aparcada» teniendo guard.
 *
 * Se cruza por (módulo, nombre) resuelto, NO por nombre suelto: `DECLARADAS` existe en varios
 * ficheros de esta casa, y un índice por nombre global daría por vigilada una lista porque otra,
 * en otro sitio, se llama igual. Ese sesgo cae del lado bueno, que es el que no se puede permitir.
 */
function vigilanciaImportada(raiz, ficheros, leer, indice = nombresVigilados) {
  const pares = new Set(); // "modulo::NOMBRE"
  for (const r of ficheros) {
    const fuente = leer(r);
    if (!/assert/.test(fuente)) continue;
    const sf = ts.createSourceFile(r, fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const deDonde = new Map(); // nombre importado → módulo resuelto
    ts.forEachChild(sf, (n) => {
      if (!ts.isImportDeclaration(n) || !n.importClause) return;
      const esp = n.moduleSpecifier;
      if (!ts.isStringLiteral(esp)) return;
      const destino = resolver(r, esp.text, raiz);
      if (!destino) return;
      const b = n.importClause.namedBindings;
      if (b && ts.isNamedImports(b)) for (const el of b.elements) deDonde.set(el.name.text, destino);
    });
    if (!deDonde.size) continue;   // 🔴 era `return`: abortaba el barrido en el primer fichero
    const vigilados = indice(sf);
    for (const [nombre, destino] of deDonde) {
      if (vigilados.has(nombre)) pares.add(destino + '::' + nombre);
    }
  }
  return pares;
}

/**
 * Los nombres VIGILADOS de una fuente: los que llegan a un `assert`, directamente o a través de
 * lo que se deriva de ellos.
 *
 * 🔴 LA PROPAGACIÓN NO ES UN LUJO, Y LA CAZÓ UN CASO CONOCIDO. `DECLARADOS`
 * (`tests/_huerfanos-declarados.mjs`, 149 elementos) salía «aparcada» con la versión ingenua, y
 * está vigiladísima: su test hace `const DECLARADOS_PARES = paresDeclarados()` y afirma sobre
 * ESA variable. Entre la lista y el `assert` hay una función y un renombrado. Publicar esa lista
 * como aparcada habría sido acusar al sitio equivocado — y con 149 elementos, habría torcido el
 * titular entero de este ticket.
 *
 * Se propaga por DERIVACIÓN: si `X = f(N)` y algo afirma sobre `X`, entonces `N` está vigilado.
 * Dos saltos, que es lo que cubre el patrón real de esta casa; más saltos empezarían a dar por
 * vigilado casi todo, y este sesgo cae del lado bueno.
 */
function nombresVigilados(sf) {
  const enAssert = new Set();
  const deriva = new Map();   // variable → nombres de los que se calcula

  const idsDe = (n, out = new Set()) => {
    const r = (x) => { if (ts.isIdentifier(x)) out.add(x.text); ts.forEachChild(x, r); };
    r(n);
    return out;
  };
  const dentroDeAssert = (n) => {
    for (let p = n.parent; p; p = p.parent) {
      if (ts.isCallExpression(p) && /^assert\b|^assert\./.test(p.expression.getText(sf))) return true;
    }
    return false;
  };
  const rec = (n) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) {
      deriva.set(n.name.text, idsDe(n.initializer));
    }
    if (ts.isIdentifier(n) && dentroDeAssert(n)) enAssert.add(n.text);
    ts.forEachChild(n, rec);
  };
  ts.forEachChild(sf, rec);

  const vigilados = new Set(enAssert);
  for (let salto = 0; salto < 2; salto++) {
    for (const v of [...vigilados]) {
      for (const origen of (deriva.get(v) || [])) vigilados.add(origen);
    }
  }
  return vigilados;
}

/**
 * Los nombres que sólo llegan a un `console.log` o a un `t.diagnostic`: AVISADOS, no vigilados.
 *
 * 🔴 ESTA CATEGORÍA LA DESTAPÓ UN CASO REAL, y es la más interesante de las tres.
 * `PARES_SIN_TESTIGO_CONGELADOS` (87 elementos) parece vigiladísima: su test calcula los
 * `muertos` —los que ya no hacen falta— y hasta explica cómo recogerlos. Pero ese cálculo acaba
 * en un `console.log`, no en un `assert`. Si el conjunto deja de ser correcto, **la tanda sigue
 * verde** y el aviso se pierde entre 7.390 tests.
 *
 *     🔒 Contar no es avisar — y avisar no es exigir.
 *
 * Se cuenta aparte a propósito: llamarla «vigilada» sería mentir, y llamarla «aparcada» taparía
 * que alguien se molestó en calcular la consecuencia. Lo que le falta es el mecanismo, no la idea.
 */
function nombresAvisados(sf) {
  const enAviso = new Set();
  const deriva = new Map();
  const idsDe = (n, out = new Set()) => {
    const r = (x) => { if (ts.isIdentifier(x)) out.add(x.text); ts.forEachChild(x, r); };
    r(n);
    return out;
  };
  const dentroDeAviso = (n) => {
    for (let p = n.parent; p; p = p.parent) {
      if (ts.isCallExpression(p)) {
        const t = p.expression.getText(sf);
        if (/console\.(log|warn|error)$|\.diagnostic$/.test(t)) return true;
      }
    }
    return false;
  };
  const rec = (n) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) {
      deriva.set(n.name.text, idsDe(n.initializer));
    }
    if (ts.isIdentifier(n) && dentroDeAviso(n)) enAviso.add(n.text);
    ts.forEachChild(n, rec);
  };
  ts.forEachChild(sf, rec);
  const avisados = new Set(enAviso);
  for (let salto = 0; salto < 2; salto++) {
    for (const v of [...avisados]) for (const o of (deriva.get(v) || [])) avisados.add(o);
  }
  return avisados;
}

/**
 * Los nombres que usa por dentro cada función exportada de una fuente.
 *
 * 🔴 EL ÚLTIMO SALTO, Y TAMBIÉN LO CAZÓ EL CASO DE LOS 149. `DECLARADOS` seguía saliendo
 * «aparcada» con la propagación de arriba, porque quien viaja al test NO es la lista: es
 * `paresDeclarados()`, una función exportada del mismo módulo que la lee por dentro. El test
 * afirma sobre el resultado de esa función. Entre la lista y el `assert` hay una función, un
 * módulo y un renombrado — y la lista está vigiladísima.
 *
 * Con 149 elementos, publicarla como aparcada habría torcido el titular de este ticket. Un censo
 * que acusa al sitio equivocado cuesta más que no medir.
 */
function nombresPorExportada(sf) {
  const mapa = new Map();   // nombre exportado → Set de identificadores que usa
  const idsDe = (n, out = new Set()) => {
    const r = (x) => { if (ts.isIdentifier(x)) out.add(x.text); ts.forEachChild(x, r); };
    r(n);
    return out;
  };
  const rec = (n) => {
    const exportado = n.modifiers && n.modifiers.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    if (exportado && ts.isFunctionDeclaration(n) && n.name && n.body) mapa.set(n.name.text, idsDe(n.body));
    if (exportado && ts.isVariableStatement(n)) {
      for (const d of n.declarationList.declarations) {
        if (ts.isIdentifier(d.name) && d.initializer) mapa.set(d.name.text, idsDe(d.initializer));
      }
    }
    ts.forEachChild(n, rec);
  };
  ts.forEachChild(sf, rec);
  return mapa;
}

/** ¿Este identificador aparece dentro de una aserción, o de una comparación que puede fallar? */
function vigiladoEn(sf, nombre) {
  // Primero la vía con propagación: la lista puede llegar al `assert` a través de un derivado.
  if (nombresVigilados(sf).has(nombre)) return true;
  let vigilado = false;
  const dentroDeAssert = (n) => {
    for (let p = n.parent; p; p = p.parent) {
      if (ts.isCallExpression(p)) {
        const t = p.expression.getText(sf);
        if (/^assert\b|^assert\./.test(t)) return true;
      }
    }
    return false;
  };
  const rec = (n) => {
    if (vigilado) return;
    if (ts.isIdentifier(n) && n.text === nombre && dentroDeAssert(n)) vigilado = true;
    ts.forEachChild(n, rec);
  };
  ts.forEachChild(sf, rec);
  return vigilado;
}

/**
 * Censa las listas de exclusión declaradas y dice cuáles vigila alguien.
 *
 * @param {string} raiz  el repositorio, o un árbol fabricado para ponerle un caso delante.
 */
export function censarExcepciones(raiz) {
  const abs = path.resolve(raiz);
  const rel = (p) => path.relative(abs, p).split(path.sep).join('/');
  const donde = ['tests', 'scripts', 'docs'].flatMap((c) => ficherosDe(path.join(abs, c)))
    .filter((p) => EXT.has(path.extname(p)));
  const leer = (r) => { try { return fs.readFileSync(path.join(abs, r), 'utf8'); } catch { return ''; } };
  // Quién vigila desde FUERA, resuelto por (módulo, nombre).
  const vigiladasDesdeFuera = vigilanciaImportada(abs, donde.map(rel), leer);
  const avisadasDesdeFuera = vigilanciaImportada(abs, donde.map(rel), leer, nombresAvisados);

  const listas = [];
  for (const p of donde) {
    const r = rel(p);
    let fuente;
    try { fuente = fs.readFileSync(p, 'utf8'); } catch { continue; }
    if (!NOMBRE_DE_EXCEPCION.test(fuente)) continue;   // atajo barato; el AST decide
    const sf = ts.createSourceFile(r, fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const porExportada = nombresPorExportada(sf);

    const rec = (n) => {
      if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) {
        const nombre = n.name.text;
        // Sólo las declaradas en MAYÚSCULAS: es como esta casa nombra lo que es una constante de
        // gobierno. Una variable local `excluidos` es de trabajo, no una declaración de política.
        if (nombre === nombre.toUpperCase() && NOMBRE_DE_EXCEPCION.test(nombre)) {
          const ini = n.initializer;
          let elementos = null;
          if (ts.isArrayLiteralExpression(ini)) elementos = ini.elements.length;
          else if (ts.isNewExpression(ini) && /^(Set|Map)$/.test(ini.expression.getText(sf))) {
            const a0 = ini.arguments && ini.arguments[0];
            if (a0 && ts.isArrayLiteralExpression(a0)) elementos = a0.elements.length;
          } else if (ts.isObjectLiteralExpression(ini)) elementos = ini.properties.length;
          else if (ts.isCallExpression(ini) && /freeze$/.test(ini.expression.getText(sf))) {
            const a0 = ini.arguments[0];
            if (a0 && ts.isObjectLiteralExpression(a0)) elementos = a0.properties.length;
            else if (a0 && ts.isArrayLiteralExpression(a0)) elementos = a0.elements.length;
          }
          if (elementos !== null) {
            const { line } = sf.getLineAndCharacterOfPosition(n.getStart(sf));
            const previo = fuente.slice(0, n.getStart(sf)).split('\n').slice(-12).join('\n');
            listas.push({
              fichero: r,
              nombre,
              linea: line + 1,
              elementos,
              // ¿lleva un motivo escrito encima? No juzga si es bueno: si no hay ninguno, nadie
              // podrá saber por qué se aparcó.
              conMotivo: /\/\*|\/\/|\*/.test(previo) && previo.trim().length > 40,
              soloAvisa: nombresAvisados(sf).has(nombre) || avisadasDesdeFuera.has(r + '::' + nombre)
                || [...porExportada].some(([exp, usa]) => usa.has(nombre) && avisadasDesdeFuera.has(r + '::' + exp)),
              vigilada: vigiladoEn(sf, nombre)
                || vigiladasDesdeFuera.has(r + '::' + nombre)
                // …o la vigila una función exportada de este mismo módulo que la lee por dentro.
                || [...porExportada].some(([exp, usa]) => usa.has(nombre) && vigiladasDesdeFuera.has(r + '::' + exp)),
            });
          }
        }
      }
      ts.forEachChild(n, rec);
    };
    ts.forEachChild(sf, rec);
  }
  return {
    listas,
    vigiladas: listas.filter((l) => l.vigilada),
    // 🔴 Las VACÍAS se cuentan aparte: una excepción de cero elementos no aparca nada, y meterla
    // entre las aparcadas engorda el titular con listas que no excluyen a nadie. (`EXCEPCIONES`
    // de scrum846c es exactamente eso: existe, está vacía, y su propio fichero dice que añadir
    // una obliga a tocar dos sitios.)
    aparcadas: listas.filter((l) => !l.vigilada && !l.soloAvisa && l.elementos > 0),
    soloAvisan: listas.filter((l) => !l.vigilada && l.soloAvisa && l.elementos > 0),
    vacias: listas.filter((l) => l.elementos === 0),
    sinMotivo: listas.filter((l) => !l.conMotivo),
    elementosAparcados: listas.filter((l) => !l.vigilada).reduce((n, l) => n + l.elementos, 0),
    elementosVigilados: listas.filter((l) => l.vigilada).reduce((n, l) => n + l.elementos, 0),
  };
}
