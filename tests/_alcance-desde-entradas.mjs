// tests/_alcance-desde-entradas.mjs — SCRUM-411 (fase 2b) · ¿LLEGA ESTO DESDE UNA ENTRADA VIVA?
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LA PREGUNTA QUE ESTO CONTESTA, Y POR QUÉ NO LA CONTESTABAN LOS DOS ANTERIORES
//
// `_alcance-dominio.mjs` (primera población) contesta «¿lo importa alguien alcanzable?».
// `_huerfanos-en-modulos-vivos.mjs` (segunda) contesta «¿lo alcanza algún export VIVO de su propio
// fichero?». Con las dos, `ensureReferralCode` salía como huérfano **pero ejecutado**, y de ahí la
// pregunta que faltaba:
//
//   🔴 **¿y el que lo llama por dentro, llega desde una entrada viva?** Si el llamador está muerto,
//   la cadena entera está muerta y el defecto SÍ existe: un merchant antiguo no obtendría nunca su
//   código de referido.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 «ENTRADA VIVA», DEFINIDO ANTES DE CONTESTAR — porque si no, la respuesta no se puede contrastar
//
// Entrada viva = un sitio por el que el PROCESO empieza a ejecutar de verdad:
//
//   ① `src/index.ts`  — el arranque del proceso, y donde se registran los crons.
//   ② `src/app.ts`    — donde se montan las rutas (`app.get(...)`, `app.use(...)`).
//   ③ los `scripts/*.mjs` que **`package.json` declara** como script de npm. Se DERIVAN del
//      `package.json`, no se listan a mano: un script que nadie invoca sigue estando muerto.
//
// Es la misma definición que ya usa `_alcance-dominio.mjs` (`ENTRADAS` + `entradasDeComando`), y se
// reutiliza tal cual a propósito: si las dos mediciones partieran de entradas distintas, comparar
// sus números no significaría nada. **`tests/` NO es una entrada viva** — un módulo llamado solo por
// su test es justo el caso que se busca.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 LO QUE ESTE INSTRUMENTO AFINA: EL NOMBRE SE RESUELVE A SU MÓDULO
//
// `_alcance-dominio.mjs` indexa los importadores **por NOMBRE, global**: un export `X` de A cuenta
// como vivo si algún fichero alcanzable importa un nombre `X` **de donde sea**, aunque sea de B.
// Para «¿hay un huérfano nuevo?» eso sobre-marca vivos y por tanto NO inventa deuda — es un sesgo
// seguro y por eso aquel guard no se toca (regla 9; se AÑADE un instrumento, no se cambia el suyo).
//
// Pero para ESTA pregunta ese sesgo es el peligroso: diría «alcanzable» de una cadena muerta. Aquí
// cada import se resuelve a **(módulo, nombre)**, y además se exige que el nombre se USE en el
// cuerpo del importador — un `import` que nadie referencia no da vida a nada.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 EL SUELO: «NO SE PUDO DETERMINAR» NO ES «NO ES ALCANZABLE». SON OPUESTOS.
//
// Un `import * as x` no dice qué nombres se usan; un `await import()` no ata el nombre. Ahí este
// instrumento **no sabe**, y lo dice con su propio veredicto. Confundirlo con «no es alcanzable»
// fabricaría un defecto que no consta — que es exactamente el error que este ticket viene a evitar.
import ts from 'typescript';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ENTRADAS, entradasDeComando, importsDe, exportsDe, ficherosTs } from './_alcance-dominio.mjs';
import { grafoInterno, alcanceInterno, lineasDeDeclaracion, clave } from './_huerfanos-en-modulos-vivos.mjs';

export const ALCANZABLE = 'ALCANZABLE';
export const NO_ALCANZABLE = 'NO_ALCANZABLE';
export const NO_SE_PUDO_DETERMINAR = 'NO_SE_PUDO_DETERMINAR';

const rel = (raiz, p) => path.relative(raiz, p).split(path.sep).join('/');

const leer = (ruta, codigo) =>
  ts.createSourceFile(ruta, codigo ?? fs.readFileSync(ruta, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

/**
 * Resuelve un especificador relativo al fichero real que designa (o `null`).
 *
 * 🔴 SCRUM-521 · TODA SALIDA PASA POR `path.normalize`, Y ES LA ÚNICA NORMALIZACIÓN DEL FICHERO.
 *
 * Aquí estaba el defecto, y el sitio importa: la rama `dist/` construía su candidato a partir de
 * `norm` —que ya venía con barras `/`— y devolvía `C:/Users/…/x.ts`, mientras la rama normal
 * devolvía `C:\Users\…\x.ts` porque sale de `path.resolve`. **Dos separadores por la misma puerta.**
 * Cualquiera que comparase el resultado contra un `path.join` —que en Windows produce `\`— perdía
 * en silencio justo las aristas de la rama `dist/`, que son las de los `scripts/*.mjs`.
 *
 * Se arregla AQUÍ, en el único punto por el que salen todas las rutas, y no en cada comparación:
 * normalizar en el consumidor sería repartir el defecto en tantos sitios como llamadas, y el que
 * se olvide vuelve a fallar en silencio. Un `replace` por llamada no es un arreglo, es una copia.
 */
function resolver(desde, espec) {
  if (!espec.startsWith('.')) return null;
  const base = path.resolve(path.dirname(desde), espec);
  const norm = base.split(path.sep).join('/');
  if (norm.includes('/dist/')) {
    const comoSrc = norm.replace('/dist/', '/src/').replace(/\.js$/, '');
    for (const c of [comoSrc + '.ts', path.join(comoSrc, 'index.ts')]) if (fs.existsSync(c)) return path.normalize(c);
  }
  for (const c of [base + '.ts', path.join(base, 'index.ts'), base]) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return path.normalize(c);
  }
  return null;
}

/**
 * Qué ata un fichero a otro, con el NOMBRE resuelto a SU módulo.
 *
 * Devuelve también lo que NO se puede atar (`namespaces`, `dinamicos`), que es lo que alimenta el
 * veredicto «no se pudo determinar» en vez de un falso «no alcanzable».
 */
export function importacionesDe(ruta, codigo = null) {
  const sf = leer(ruta, codigo);
  const nombradas = [];
  const namespaces = [];
  const dinamicos = [];
  const usados = new Set();

  const v = (n) => {
    if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier)) {
      const modulo = resolver(ruta, n.moduleSpecifier.text);
      const b = n.importClause?.namedBindings;
      if (b && ts.isNamedImports(b)) {
        for (const el of b.elements) nombradas.push({ nombre: el.propertyName?.text ?? el.name.text, local: el.name.text, modulo });
      }
      if (n.importClause?.name) nombradas.push({ nombre: 'default', local: n.importClause.name.text, modulo });
      if (b && ts.isNamespaceImport(b) && modulo) namespaces.push(modulo);
    }
    // `export { x } from './y'` re-exporta: ata igual que un import.
    if (ts.isExportDeclaration(n) && n.moduleSpecifier && ts.isStringLiteral(n.moduleSpecifier)) {
      const modulo = resolver(ruta, n.moduleSpecifier.text);
      if (n.exportClause && ts.isNamedExports(n.exportClause)) {
        for (const el of n.exportClause.elements) nombradas.push({ nombre: el.propertyName?.text ?? el.name.text, local: el.name.text, modulo, reexport: true });
      } else if (modulo) {
        namespaces.push(modulo); // `export * from` — no se sabe qué sale
      }
    }
    if (ts.isCallExpression(n) && n.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const a = n.arguments[0];
      if (a && ts.isStringLiteral(a)) { const m = resolver(ruta, a.text); if (m) dinamicos.push(m); }
    }
    if (ts.isIdentifier(n)) {
      const p = n.parent;
      const esImport = p && (ts.isImportSpecifier(p) || ts.isImportClause(p) || ts.isNamespaceImport(p) || ts.isExportSpecifier(p));
      if (!esImport) usados.add(n.text);
    }
    ts.forEachChild(n, v);
  };
  ts.forEachChild(sf, v);
  // ⚠️ Un `import` que el cuerpo NUNCA referencia no da vida a nada: se descarta aquí, no después.
  return { nombradas: nombradas.filter((x) => x.modulo && usados.has(x.local)), namespaces, dinamicos };
}

/**
 * EL CENSO DE ALCANCE. Por cada export de `src/`, si se llega a él desde una entrada viva.
 *
 * Dos saltos, y los dos hacen falta:
 *   ① ENTRE ficheros — un fichero ALCANZABLE importa (módulo, nombre). Ése es el pie.
 *   ② DENTRO del fichero — lo que esos exports llaman, por el grafo interno. Aquí es donde se
 *      contesta lo de `ensureReferralCode`: no lo importa nadie, pero lo llama `getReferralStats`,
 *      que sí entra por ①.
 */
export function censarAlcance(raiz) {
  const src = path.join(raiz, 'src');
  if (!fs.existsSync(src)) return { sinSrc: true, total: 0, alcanzables: 0, veredictos: new Map(), ficherosAlcanzables: 0 };

  const todos = ficherosTs(src);
  const entradas = [
    ...ENTRADAS.map((r) => path.join(raiz, r)).filter((p) => fs.existsSync(p)),
    ...entradasDeComando(raiz),
  ];

  // ── ① Qué FICHEROS toca el proceso, partiendo de las entradas vivas ─────────────────────
  const grafo = new Map(todos.map((p) => [p, importsDe(p)]));
  const ficherosAlcanzables = new Set();
  const pila = [...entradas];
  while (pila.length) {
    const p = pila.pop();
    if (ficherosAlcanzables.has(p)) continue;
    ficherosAlcanzables.add(p);
    for (const q of grafo.get(p) ?? (fs.existsSync(p) ? importsDe(p) : [])) pila.push(q);
  }

  // ── ② Qué EXPORTS ata un fichero alcanzable, con el nombre resuelto a su módulo ─────────
  const semillas = new Map();      // modulo → Set(nombres importados desde un fichero alcanzable)
  const opacos = new Set();        // módulos atados de forma que no se sabe QUÉ se usa
  const anota = (m, n) => {
    if (!semillas.has(m)) semillas.set(m, new Set());
    semillas.get(m).add(n);
  };
  for (const p of [...todos, ...entradas]) {
    if (!ficherosAlcanzables.has(p)) continue;
    const { nombradas, namespaces, dinamicos } = importacionesDe(p);
    for (const { nombre, modulo } of nombradas) anota(modulo, nombre);
    for (const m of namespaces) opacos.add(m);
    for (const m of dinamicos) opacos.add(m);
  }

  // ── ③ Y dentro de cada fichero, lo que esos exports llaman ──────────────────────────────
  const veredictos = new Map();
  for (const p of todos) {
    const r = rel(raiz, p);
    const exps = exportsDe(p);
    if (!exps.length) continue;
    const lineas = lineasDeDeclaracion(p);
    const desdeFuera = semillas.get(p) ?? new Set();
    const alcanzadosDentro = alcanceInterno(grafoInterno(p), [...desdeFuera]);
    const esOpaco = opacos.has(p);

    for (const nombre of exps) {
      let estado, porQue;
      if (desdeFuera.has(nombre)) {
        estado = ALCANZABLE;
        porQue = 'lo importa un fichero al que se llega desde una entrada viva';
      } else if (alcanzadosDentro.has(nombre)) {
        estado = ALCANZABLE;
        porQue = 'no lo importa nadie, pero lo llama por dentro un export de este mismo fichero que sí entra desde una entrada viva';
      } else if (esOpaco) {
        // 🔴 EL SUELO. No es lo mismo que «no alcanzable».
        estado = NO_SE_PUDO_DETERMINAR;
        porQue = 'su módulo se ata con `import * as`, `export * from` o un import dinámico: no se puede saber QUÉ nombres se usan';
      } else if (!ficherosAlcanzables.has(p)) {
        estado = NO_ALCANZABLE;
        porQue = 'ni siquiera su fichero se alcanza desde ninguna entrada viva';
      } else {
        estado = NO_ALCANZABLE;
        porQue = 'su fichero se alcanza, pero a este export no llega nada: ni un import de fuera ni una llamada de dentro';
      }
      veredictos.set(clave(r, nombre), { modulo: r, nombre, linea: lineas.get(nombre) ?? 0, estado, porQue });
    }
  }

  const cuenta = (e) => [...veredictos.values()].filter((v) => v.estado === e).length;
  return {
    sinSrc: false,
    total: veredictos.size,
    ficherosAlcanzables: ficherosAlcanzables.size,
    alcanzables: cuenta(ALCANZABLE),
    noAlcanzables: cuenta(NO_ALCANZABLE),
    indeterminados: cuenta(NO_SE_PUDO_DETERMINAR),
    veredictos,
  };
}

/**
 * LA CADENA, para poder contrastarla a mano: quién importa el módulo y desde qué entrada.
 * Devuelve los ficheros ALCANZABLES que importan ese nombre de ese módulo.
 */
export function quienLoImporta(raiz, moduloRel, nombre) {
  const src = path.join(raiz, 'src');
  // 🔴 SUELO 1 · SIN ÁRBOL NO HAY RESPUESTA. Devolver `[]` aquí diría «no lo importa nadie» cuando
  // lo cierto es «no he encontrado dónde mirar». Son opuestos, y el vacío los hacía iguales.
  if (!fs.existsSync(src)) {
    throw new Error(`🔴 quienLoImporta CIEGO: no existe ${rel(raiz, src)}. No es que nadie importe `
      + `«${nombre}»: es que no se ha podido mirar. Un [] aquí se leería como «huérfano».`);
  }
  const abs = path.normalize(path.join(raiz, moduloRel));
  // 🔴 SUELO 2 · EL MÓDULO PREGUNTADO TIENE QUE EXISTIR. Preguntar por una ruta mal escrita —o por
  // un fichero que se movió— devolvía `[]`, y ese `[]` es indistinguible de un huérfano de verdad.
  if (!fs.existsSync(abs)) {
    throw new Error(`🔴 quienLoImporta CIEGO: no existe el módulo «${moduloRel}». Comprueba la ruta: `
      + 'un módulo que no está no tiene cero importadores, tiene una pregunta mal hecha.');
  }
  const todos = ficherosTs(src);
  const entradas = [
    ...ENTRADAS.map((r) => path.join(raiz, r)).filter((p) => fs.existsSync(p)),
    ...entradasDeComando(raiz),
  ];
  // 🔴 SUELO 3 · SI NO HAY CORPUS, NO HAY CERO. Cero ficheros analizados produce cero importadores
  // pase lo que pase: es el mismo verde que «lo he mirado todo y no lo importa nadie».
  const corpus = [...new Set([...todos, ...entradas].map((p) => path.normalize(p)))];
  if (!corpus.length) {
    throw new Error('🔴 quienLoImporta CIEGO: el corpus está vacío — 0 ficheros analizados. '
      + 'Cualquier respuesta sería inventada.');
  }

  const out = [];
  let exportaElNombre = false;
  for (const p of corpus) {
    let imps;
    try { imps = importacionesDe(p).nombradas; } catch { continue; }
    for (const imp of imps) {
      if (!imp.modulo) continue;
      // Comparación entre rutas ya normalizadas por `resolver`: mismo separador en los dos lados.
      if (path.normalize(imp.modulo) === abs) {
        exportaElNombre = exportaElNombre || imp.nombre === nombre;
        if (imp.nombre === nombre) out.push(rel(raiz, p));
      }
    }
  }
  // 🔴 SUELO 4 · EL QUE DECIDE ESTE TICKET. Si NADIE importa el nombre pero el módulo SÍ está
  // importado por alguien, el cero es sospechoso: o el nombre no existe, o el resolvedor no está
  // atando lo que cree. Se distingue con el corpus de exports del propio módulo.
  if (!out.length && !exportaElNombre) {
    const exportados = exportsDelModulo(abs);
    if (exportados.length && !exportados.includes(nombre)) {
      throw new Error(`🔴 quienLoImporta CIEGO: «${nombre}» no es un export de «${moduloRel}». `
        + `Exporta: ${exportados.join(', ')}.\n  Un [] habría dicho «no lo importa nadie» a una `
        + 'pregunta que nadie puede contestar que sí — que es como un typo se convierte en un '
        + 'huérfano declarado.');
    }
  }
  return [...new Set(out)];
}

/** Los nombres que un módulo exporta. Sirve al suelo: distingue «nadie lo importa» de «no existe». */
function exportsDelModulo(abs) {
  let sf;
  try { sf = leer(abs); } catch { return []; }
  const out = [];
  const v = (n) => {
    if (ts.isFunctionDeclaration(n) || ts.isClassDeclaration(n)) {
      if (n.name && n.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) out.push(n.name.text);
    } else if (ts.isVariableStatement(n) && n.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) {
      for (const d of n.declarationList.declarations) if (ts.isIdentifier(d.name)) out.push(d.name.text);
    } else if (ts.isTypeAliasDeclaration(n) || ts.isInterfaceDeclaration(n) || ts.isEnumDeclaration(n)) {
      if (n.name && n.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) out.push(n.name.text);
    } else if (ts.isExportDeclaration(n) && n.exportClause && ts.isNamedExports(n.exportClause)) {
      for (const el of n.exportClause.elements) out.push(el.name.text);
    }
    ts.forEachChild(n, v);
  };
  ts.forEachChild(sf, v);
  return [...new Set(out)];
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// EL OTRO INSTRUMENTO: ¿QUIÉN EJERCE ESTO, AUNQUE NO SEA PRODUCCIÓN?
//
// Un export sin llamador en producción puede seguir siendo el SUJETO EJECUTABLE de un guard: el
// test no lo usa de utilidad, lo CORRE para comprobar una regla que no está escrita en ningún otro
// sitio. Confundir eso con «una copia superada» es grave en una dirección concreta: una copia
// superada se acaba borrando, y una especificación ejecutable NO SE PUEDE BORRAR NUNCA.
//
// Se cuentan LLAMADAS por AST, no menciones: `'borrarMerchant'` dentro de una lista de prohibidos y
// un comentario que lo nombra NO son ejercicio del código, y con `grep` valdrían lo mismo.
// ─────────────────────────────────────────────────────────────────────────────────────────

export function llamadasEnTests(raiz, nombre) {
  const dir = path.join(raiz, 'tests');
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.mjs')) continue;
    const ruta = path.join(dir, f);
    const sf = leer(ruta, fs.readFileSync(ruta, 'utf8'));
    const lineas = [];
    const v = (n) => {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === nombre) {
        lineas.push(sf.getLineAndCharacterOfPosition(n.expression.getStart()).line + 1);
      }
      ts.forEachChild(n, v);
    };
    ts.forEachChild(sf, v);
    if (lineas.length) out.push({ fichero: `tests/${f}`, llamadas: lineas.length, lineas });
  }
  return out.sort((a, b) => a.fichero.localeCompare(b.fichero));
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 LA AUTOPRUEBA — sobre fuente sintética, antes de creerse ningún número
//
//   index.ts → app.ts → x.routes.ts → domain/motor.ts
//
//   · `motorVivo`   lo importa la ruta                              → ALCANZABLE (por ①)
//   · `AYUDA`       no lo importa nadie, lo usa `motorVivo` dentro   → ALCANZABLE (por ②) ← la
//                   pregunta del ticket, en pequeño: `ensureReferralCode` es este caso
//   · `motorMuerto` no lo importa nadie y no lo llama nadie          → NO_ALCANZABLE
//   · todo `opaco.ts`, atado con `import * as`                       → NO_SE_PUDO_DETERMINAR
//                   (y NO «no alcanzable»: son opuestos)
// ─────────────────────────────────────────────────────────────────────────────────────────

const FUENTE = {
  'package.json': '{ "name": "sintetico", "scripts": {} }\n',
  'src/index.ts': `import { arrancar } from './app';\narrancar();\n`,
  'src/app.ts': `import { rutaViva } from './modules/x/x.routes';\nexport function arrancar() { return rutaViva(); }\n`,
  'src/modules/x/x.routes.ts':
    `import { motorVivo } from './domain/motor';\n` +
    `import * as todo from './domain/opaco';\n` +
    `export function rutaViva() { return motorVivo() + todo.loQueSea(); }\n`,
  'src/modules/x/domain/motor.ts':
    `export const AYUDA = 7;\n` +
    `export function motorVivo() { return AYUDA; }\n` +
    `export function motorMuerto() { return 'nadie'; }\n`,
  'src/modules/x/domain/opaco.ts':
    `export function loQueSea() { return 1; }\n` +
    `export function niIdea() { return 2; }\n`,
};

export function escribirFuenteSintetica() {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum411-alcance-'));
  for (const [r, c] of Object.entries(FUENTE)) {
    const destino = path.join(raiz, r);
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.writeFileSync(destino, c);
  }
  return raiz;
}

export function autoprueba() {
  const raiz = escribirFuenteSintetica();
  try {
    const c = censarAlcance(raiz);
    const e = (m, n) => c.veredictos.get(`src/modules/x/domain/${m}.ts::${n}`)?.estado;
    return {
      porImport: e('motor', 'motorVivo') === ALCANZABLE,
      porLlamadaInterna: e('motor', 'AYUDA') === ALCANZABLE,
      muerto: e('motor', 'motorMuerto') === NO_ALCANZABLE,
      opacoIndeterminado: e('opaco', 'loQueSea') === NO_SE_PUDO_DETERMINAR
        && e('opaco', 'niIdea') === NO_SE_PUDO_DETERMINAR,
      // El suelo, dicho al revés: lo opaco NO puede salir como «no alcanzable».
      opacoNoEsMuerto: e('opaco', 'niIdea') !== NO_ALCANZABLE,
      visto: Object.fromEntries([...c.veredictos.values()].map((v) => [clave(v.modulo, v.nombre), v.estado])),
    };
  } finally {
    fs.rmSync(raiz, { recursive: true, force: true });
  }
}
