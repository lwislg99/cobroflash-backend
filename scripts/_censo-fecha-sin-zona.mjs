// scripts/_censo-fecha-sin-zona.mjs — SCRUM-1093h
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 ¿QUÉ LLAMADA LEE O ESCRIBE UN COMPONENTE LOCAL DE UNA `Date`, CON LA ZONA DEL PROCESO?
//
// La familia que SCRUM-643/735/1093(b-g) ha ido encontrando, cuatro veces ya: `getFullYear`,
// `getMonth`, `getDate`, `getDay`, `getHours`, sus hermanas `set*`, y `toLocale*` sin `timeZone`
// explícito. Railway corre en UTC; España no. Un valor de esa familia responde «¿qué año/mes/día
// es, EN LA ZONA DEL PROCESO?», y las dos veces que hace daño de verdad son cuando NUMERA un
// documento (regla 29: un número emitido no se corrige) o cuando GUARDA una fecha derivada así.
//
// SCRUM-1093g censó 65 llamadas en 23 ficheros sobre `src/` (población 304 `.ts`) y las clasificó
// A MANO en el apéndice de `docs/master/SCRUM-1093.md`. Este fichero convierte ese censo en un
// instrumento que corre solo, con dos capas separadas a propósito:
//
//   ① LA FAMILIA — por TIPO, no por nombre de método. `albaranPdf.service.ts:133` es el falso
//     positivo que lo exige: `v.toLocaleString('es-ES', { maximumFractionDigits: 2 })` con
//     `v: number`. Un censo por nombre casaría los dos; por TIPO (`checker.getTypeAtLocation`) el
//     receptor de ÉSE es `number`, no `Date`, y no entra en la familia. Nunca por el nombre de la
//     variable ni por los nombres de las opciones: por el tipo que TypeScript ya conoce.
//   ② EL USO — declarado por IDENTIDAD (fichero + función que envuelve la llamada, SCRUM-710b: una
//     línea es una posición y caduca), no inferido. Clasificar automáticamente «esto numera un
//     documento» es exactamente la lista negra por FORMA que `_trinquete-de-zona.mjs` rechaza por
//     escrito: denunciaría a los 39 bordes de ventana de agregado y el guard se apagaría por
//     ruido en una semana. Lo que SÍ se puede automatizar, y es lo que hace este fichero, es la
//     detección DE LA FAMILIA; la clasificación de USO la escribe una persona, queda en `USO`
//     (abajo) visible en el diff del PR, y una llamada NUEVA sin clasificar es CIEGA — no limpia.
//
// ── EL PATRÓN, por AST + TIPOS ──────────────────────────────────────────────────────────────────
//
//   1. `<receptor>.<método>(...)`, con `<método>` en:
//        GET_SET  : getFullYear/getMonth/getDate/getDay/getHours/getMinutes/getSeconds/
//                   getMilliseconds y sus hermanas `set*` — SIEMPRE dependen del proceso, no hay
//                   forma de pasarles una zona.
//        LOCALE   : toLocaleDateString/toLocaleTimeString/toLocaleString — dependen del proceso
//                   SALVO que el sitio de la llamada declare `{ timeZone: … }` en el objeto de
//                   opciones (literal, inline — si la zona viene de una variable que no se puede
//                   leer en el propio AST, no está «vista» en el sitio de la llamada y se trata
//                   como sin zona: fail-closed, igual que el resto de esta casa).
//   2. El TIPO del receptor (`ts.TypeChecker`, no el nombre de la variable ni de sus opciones)
//      tiene que ser `Date` (o una unión que incluya `Date` tras descartar `null`/`undefined`).
//      `getUTCFullYear` y compañía, y `toLocaleDateString({ timeZone })`, quedan fuera por
//      construcción — no hace falta una lista de excepciones para ellos.
//
// ⛔ NO EJECUTA NADA DEL PRODUCTO. Sólo AST + tipos (`typescript`, ya en el árbol).
// ═════════════════════════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require_ = createRequire(import.meta.url);
const ts = require_('typescript');

/**
 * 🔴 SCRUM-1377 · LA RAÍZ ES LA DEL ÁRBOL QUE SE MIDE, no la de la casa de `typescript`.
 *
 * Hasta el 1-oct-2026 esto era `require.resolve('typescript/package.json')` subiendo dos carpetas.
 * En un worktree cuyo `node_modules` es una junction al de otro, node resuelve la junction a su
 * destino y esa «raíz» es EL OTRO ÁRBOL: medido, 312 ficheros censados, 0 filas y salida 0 — un
 * «árbol limpio» que no había mirado nada. Este fichero vive en `scripts/` del árbol que mide: su
 * propia ruta es la única referencia que no depende de dónde esté instalada una dependencia.
 */
const RAIZ = path.resolve(import.meta.dirname, '..');

/**
 * La raíz, comprobada: tiene que ser un árbol que este censo SABE medir (su `tsconfig.json` y al
 * menos una de las `CARPETAS`). Si no, LANZA — «no pude determinar la raíz» nunca sale como 0 filas.
 */
export function raizMedible(raiz = RAIZ) {
  const abs = path.resolve(raiz);
  const faltan = [];
  if (!fs.existsSync(path.join(abs, 'tsconfig.json'))) faltan.push('tsconfig.json');
  if (!CARPETAS.some((c) => fs.existsSync(path.join(abs, c)))) faltan.push(`ninguna de [${CARPETAS.join(', ')}]`);
  if (faltan.length) {
    throw new Error(`🔴 CIEGO · censo de fecha sin zona: «${abs}» no es un árbol medible (falta ${faltan.join(' y ')}). `
      + 'No se devuelve un censo vacío: cero filas aquí sería «no he mirado», no «está limpio» (SCRUM-1377).');
  }
  return abs;
}

/** ¿`fichero` cuelga de `raiz`? Por ruta relativa, que en Windows ya compara sin distinguir la caja. */
function relativaDentro(raiz, fichero) {
  const rel = path.relative(raiz, fichero);
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) return null;
  return rel.split(path.sep).join('/');
}

const GET_SET = new Set([
  'getFullYear', 'getMonth', 'getDate', 'getDay', 'getHours', 'getMinutes', 'getSeconds', 'getMilliseconds',
  'setFullYear', 'setMonth', 'setDate', 'setHours', 'setMinutes', 'setSeconds', 'setMilliseconds',
]);
const LOCALE = new Set(['toLocaleDateString', 'toLocaleTimeString', 'toLocaleString']);
const FAMILIA = new Set([...GET_SET, ...LOCALE]);

const EXT = new Set(['.ts']);
const FUERA = new Set(['node_modules', '.git', 'dist', 'coverage', 'storage']);

/** Dónde se censa. `SCRUM-1093g` fijó `src/`: es lo que compila el producto y lo que mide `tsconfig.json`. */
export const CARPETAS = ['src'];

function ficherosDe(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (FUERA.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) ficherosDe(p, out);
    else if (EXT.has(path.extname(e.name))) out.push(p);
  }
  return out;
}

/**
 * Un `ts.Program` real de esos ficheros, con las mismas opciones de compilación que usa la casa
 * (`tsconfig.json`), para que el `TypeChecker` resuelva tipos exactamente como lo hace `tsc`.
 *
 * `overrides` permite sustituir el TEXTO de ficheros concretos (por su ruta absoluta) sin tocar
 * disco — así los controles con código histórico (`git show <sha>`) y los casos fabricados usan
 * el MISMO camino de tipos que el censo real, en vez de un atajo sin tipos.
 */
/** TypeScript normaliza sus rutas internas con `/`, siempre — en Windows también. Una clave de
 * `overrides` escrita con `path.join` (que da `\`) nunca casa con lo que el host pregunta: el
 * override pasa desapercibido en silencio y `getSourceFile` cae al disco real sin decirlo. */
function conBarra(p) {
  return String(p).split(path.sep).join('/');
}

/**
 * 🔴 SCRUM-1244 · Los `SourceFile` leídos de DISCO se comparten entre programas del mismo proceso.
 * Cada `ts.createProgram` con un host nuevo vuelve a parsear ~670 ficheros (lib, `@types`, prisma)
 * aunque el programa sólo tenga UNA raíz: medido en `scrum1093h`, nueve programas seguidos subían el
 * pico del proceso a 1.190 MB (650 MB el árbol real, ~185 MB cada programa siguiente, sin que V8
 * recogiera los anteriores antes de crecer). Compartirlos es lo que hace el propio servicio de
 * lenguaje de TypeScript: un `SourceFile` no cambia si no cambia su texto, y las opciones son
 * siempre las mismas (`tsconfig.json`). Lo que NO entra nunca aquí es un override: se consulta
 * antes, así que el código histórico y el fabricado siguen siendo el texto que se analiza.
 */
const DE_DISCO = new Map();

function claveDeVersion(opts) {
  return typeof opts === 'object' && opts !== null ? `${opts.languageVersion}|${opts.impliedNodeFormat}` : String(opts);
}

export function programaDe(ficheros, overrides = new Map(), raiz = RAIZ) {
  const abs = raizMedible(raiz);
  const tsconfigPath = path.join(abs, 'tsconfig.json');
  // Con `/`: al adjuntar un error de sintaxis, TypeScript compara esta ruta con su forma normalizada
  // y con `\` revienta en un «Debug Failure» que tapa el motivo real.
  const leido = ts.readConfigFile(conBarra(tsconfigPath), ts.sys.readFile);
  // Un `tsconfig.json` ilegible deja `leido.config` en `undefined`, y `parseJsonConfigFileContent`
  // lo acepta con las opciones POR DEFECTO sin decir nada: otro compilador, mismos «resultados».
  if (leido.error || !leido.config) {
    throw new Error(`🔴 CIEGO · censo de fecha sin zona: no pude leer ${tsconfigPath}: `
      + `${ts.flattenDiagnosticMessageText(leido.error?.messageText ?? 'sin contenido', ' ')} (SCRUM-1377).`);
  }
  const parseado = ts.parseJsonConfigFileContent(leido.config, ts.sys, abs);
  const opciones = { ...parseado.options, noEmit: true };

  const overridesNormalizados = new Map([...overrides].map(([k, v]) => [conBarra(k), v]));

  const host = ts.createCompilerHost(opciones);
  // 🔴 `host.getSourceFile` de `createCompilerHost` NO llama a `this.readFile`: lee del disco por
  // su cuenta, con una función interna cerrada en el momento de crear el host. Sobreescribir sólo
  // `readFile`/`fileExists` no cambia lo que el compilador COMPILA — sólo lo que otras partes
  // (resolución de módulos) VEN al preguntar. Hay que sobreescribir `getSourceFile` también, o un
  // override nunca llega a la fuente que de verdad se analiza.
  const originalGetSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (fileName, opts, onError, shouldCreateNewSourceFile) => {
    const clave = conBarra(fileName);
    if (overridesNormalizados.has(clave)) {
      return ts.createSourceFile(fileName, overridesNormalizados.get(clave), opts, true, ts.ScriptKind.TS);
    }
    const enCache = `${clave}|${claveDeVersion(opts)}`;
    if (!shouldCreateNewSourceFile && DE_DISCO.has(enCache)) return DE_DISCO.get(enCache);
    const sf = originalGetSourceFile(fileName, opts, onError, shouldCreateNewSourceFile);
    if (sf) DE_DISCO.set(enCache, sf);
    return sf;
  };
  const original = host.readFile.bind(host);
  const originalExists = host.fileExists.bind(host);
  host.readFile = (f) => (overridesNormalizados.has(conBarra(f)) ? overridesNormalizados.get(conBarra(f)) : original(f));
  host.fileExists = (f) => overridesNormalizados.has(conBarra(f)) || originalExists(f);

  return ts.createProgram({ rootNames: ficheros, options: opciones, host });
}

/** ¿El tipo `t` es (o, tras descartar null/undefined, incluye) el `Date` de la lib estándar? */
function esTipoDate(t, checker) {
  const partes = t.isUnion() ? t.types : [t];
  return partes.some((p) => {
    const sinNulo = p.flags & (ts.TypeFlags.Null | ts.TypeFlags.Undefined);
    if (sinNulo) return false;
    return p.symbol?.name === 'Date';
  });
}

/** ¿El objeto de opciones (último argumento, LITERAL inline) declara `timeZone`? */
function tieneZonaExplicita(nodoLlamada) {
  const opciones = nodoLlamada.arguments[nodoLlamada.arguments.length - 1];
  if (!opciones || !ts.isObjectLiteralExpression(opciones)) return false;
  return opciones.properties.some((p) => ts.isPropertyAssignment(p) && p.name?.getText?.() === 'timeZone');
}

/** El nombre de la llamada, si es `X(...)` o `algo.X(...)` — y, para éste, el propio receptor. */
function partesDeLlamada(nodo) {
  const e = nodo.expression;
  if (!ts.isPropertyAccessExpression(e)) return null;
  return { metodo: e.name.text, receptor: e.expression };
}

/**
 * Si `fn` (una función/flecha SIN nombre) es el argumento de `app.get('/ruta', fn)` (o
 * `.post`/`.put`/`.patch`/`.delete`/`.use`, en `app` o en un `Router`), su «nombre» es la ruta:
 * `GET /admin/me`. Es el caso más común de handler anónimo en este árbol, y sin esto TODOS los
 * handlers de un fichero de rutas comparten la identidad `(módulo)` — bastante para acusar una
 * llamada nueva, pero no para distinguir A CUÁL de los handlers pertenece un `USO` ya declarado.
 */
function rutaDeHandler(fn, sf) {
  const llamada = fn.parent;
  if (!llamada || !ts.isCallExpression(llamada) || !ts.isPropertyAccessExpression(llamada.expression)) return null;
  const metodo = llamada.expression.name.text;
  if (!/^(get|post|put|patch|delete|use)$/.test(metodo)) return null;
  const ruta = llamada.arguments[0];
  if (!ruta || !ts.isStringLiteralLike(ruta)) return null;
  return `${metodo.toUpperCase()} ${ruta.text}`;
}

/**
 * La IDENTIDAD de un sitio de llamada: fichero + función que lo envuelve (SCRUM-710b — nunca la
 * línea, que es una posición y caduca en el primer PR que añada una línea antes). Sube hasta la
 * primera declaración CON NOMBRE: función, método, o variable inicializada con una función/flecha
 * (`const foo = () => …`). Una flecha SIN nombre que es handler de ruta usa su ruta (arriba). Sin
 * ninguna de las dos, es del cuerpo del módulo — límite declarado, no oculto: un fichero con dos
 * llamadas de la familia sueltas fuera de toda función y toda ruta las funde en una identidad.
 */
function identidadDe(nodo, sf) {
  for (let p = nodo.parent; p; p = p.parent) {
    if ((ts.isFunctionDeclaration(p) || ts.isMethodDeclaration(p) || ts.isFunctionExpression(p)) && p.name) {
      return p.name.getText(sf);
    }
    if (ts.isVariableDeclaration(p) && ts.isIdentifier(p.name)
      && p.initializer && (ts.isArrowFunction(p.initializer) || ts.isFunctionExpression(p.initializer))) {
      return p.name.text;
    }
    if (ts.isArrowFunction(p) || (ts.isFunctionExpression(p) && !p.name)) {
      const ruta = rutaDeHandler(p, sf);
      if (ruta) return ruta;
    }
  }
  return '(módulo)';
}

/**
 * Censa un `ts.Program` ya construido. Devuelve una fila por llamada de la familia, con su
 * identidad, línea (informativa, no la clave) y si tiene zona explícita.
 */
export function censarPrograma(program, soloEstosFicheros = null, raiz = RAIZ) {
  const abs = path.resolve(raiz);
  // 🔴 SCRUM-1377 · Los ficheros que se PIDIÓ censar tienen que colgar de la raíz contra la que se
  // van a nombrar. Si no, ninguno empieza por `src/`, el filtro de abajo los descarta todos y el
  // censo devuelve 0 filas: el defecto medido. Raíz y programa que no casan es CIEGO, no vacío.
  const fuera = program.getRootFileNames().filter((f) => relativaDentro(abs, f) === null);
  if (fuera.length) {
    throw new Error(`🔴 CIEGO · censo de fecha sin zona: ${fuera.length} de ${program.getRootFileNames().length} `
      + `ficheros pedidos caen FUERA de la raíz «${abs}» (el primero: ${fuera[0]}). La raíz no es la del `
      + 'árbol que se mide; no se devuelve un censo vacío (SCRUM-1377).');
  }
  const checker = program.getTypeChecker();
  const filas = [];
  for (const sf of program.getSourceFiles()) {
    if (sf.isDeclarationFile) continue;
    const rel = relativaDentro(abs, sf.fileName);
    if (rel === null) continue;
    if (soloEstosFicheros && !soloEstosFicheros.includes(rel)) continue;
    if (!rel.startsWith('src/') && soloEstosFicheros === null) continue;

    const rec = (n) => {
      if (ts.isCallExpression(n)) {
        const partes = partesDeLlamada(n);
        if (partes && FAMILIA.has(partes.metodo)) {
          const tipo = checker.getTypeAtLocation(partes.receptor);
          if (esTipoDate(tipo, checker)) {
            const zonaExplicita = LOCALE.has(partes.metodo) ? tieneZonaExplicita(n) : false;
            if (!zonaExplicita) {
              const { line } = sf.getLineAndCharacterOfPosition(n.getStart(sf));
              filas.push({
                fichero: rel,
                linea: line + 1,
                metodo: partes.metodo,
                identidad: `${rel}::${identidadDe(n, sf)}`,
                clase: LOCALE.has(partes.metodo) ? 'LOCALE' : 'GET_SET',
              });
            }
          }
        }
      }
      ts.forEachChild(n, rec);
    };
    rec(sf);
  }
  return filas;
}

/** Censa el árbol real de `src/`. Declara su POBLACIÓN (SCRUM-850): nunca sólo el resultado. */
export function censar(raiz = RAIZ) {
  const abs = raizMedible(raiz);
  const todos = CARPETAS.flatMap((c) => ficherosDe(path.join(abs, c)));
  if (todos.length === 0) {
    throw new Error(`🔴 CIEGO · censo de fecha sin zona: «${abs}» no tiene ni un fichero ${[...EXT].join('/')} `
      + `en [${CARPETAS.join(', ')}]. Sin población no hay censo (SCRUM-1377).`);
  }
  const program = programaDe(todos, new Map(), abs);
  const filas = censarPrograma(program, null, abs);
  return { raiz: abs, ficheros: todos.length, filas };
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ② EL USO — declarado, no inferido (ver la cabecera del fichero para el porqué).
//
// Las clases con daño irreversible o real, que SÍ se acusan:
export const NUMERA = 'NUMERA';     // un número de documento — regla 29, no se corrige.
export const GUARDA = 'GUARDA';     // una fecha derivada así que se persiste.
export const IMPRIME = 'IMPRIME';   // una fecha derivada así que el cliente LEE en un documento
                                     // o comunicación — no numera ni persiste, pero miente.
export const REFERIDO = 'REFERIDO'; // bajo impacto (un código, no una fecha operativa).
// La única clase que NO se acusa — un borde de ventana de informe/filtro/agregado:
export const AGREGADO = 'AGREGADO';

/**
 * ═════════════════════════════════════════════════════════════════════════════════════════════
 * LA LÍNEA BASE · SCRUM-1093g (S1) censó 65 llamadas en 23 ficheros sobre `origin/main` =
 * `37bda5db` y las clasificó a mano en el apéndice de `docs/master/SCRUM-1093.md`. Esta lista es
 * ESA clasificación, vuelta a medir sobre el árbol de esta rama (62: tres ya curadas por 1093f/g)
 * — con UNA corrección propia, dicha en voz alta y no en silencio:
 *
 *   🔴 `weeklyDigest.service.ts::sendDigestForMerchant` (línea 208) estaba en el grupo de
 *   AGREGADO de S1 junto a sus otros dos `setHours` del mismo fichero. Leído el código: construye
 *   `weekStr`, que se IMPRIME literalmente en el asunto del correo («📊 Tu semana en YaQu
 *   (${weekStr})») — es la misma familia que `receipt.routes.ts` o `albaranPdf.service.ts`, no un
 *   borde de ventana. Movido a IMPRIME. Los otros dos `setHours` de ese fichero
 *   (`sendWeeklyDigests`, `getDigestPreview`) SÍ son ventana y se quedan en AGREGADO.
 *
 * NUNCA se borra una entrada porque se arregló: se mueve a `RETIRADAS` (abajo), con su commit —
 * igual que `_trinquete-de-zona.mjs` (regla 41: mejorar se declara, no se hace desaparecer).
 * ═════════════════════════════════════════════════════════════════════════════════════════════
 */
export const USO = new Map([
  // ── GUARDA — carril S1, módulo apagado (MAINTENANCE_ENABLED), NO TOCAR (reportado en 1093g) ────
  ['src/modules/maintenance/domain/maintenance.service.ts::addMonths', { uso: GUARDA, motivo: 'setMonth para nextDueAt, módulo apagado — NO TOCAR (SCRUM-1093g)', ref: 'SCRUM-1093' }],

  // ── REFERIDO — bajo impacto (reportado en 1093g) ────────────────────────────────────────────
  ['src/modules/auth/domain/referral.service.ts::buildCandidate', { uso: REFERIDO, motivo: 'año en el código de referido — bajo impacto', ref: 'SCRUM-1093' }],

  // ── IMPRIME — fecha en un documento o comunicación que el cliente/profesional lee ─────────────
  ['src/modules/invoicing/infra/pdf/pdf.service.ts::dateStr', { uso: IMPRIME, motivo: 'fecha impresa en el PDF de factura/presupuesto' }],
  ['src/modules/invoicing/infra/pdf/pdf.service.ts::generateQuotePdf', { uso: IMPRIME, motivo: 'fecha impresa en el PDF de presupuesto' }],
  ['src/modules/jobs/infra/albaranPdf.service.ts::fmtDate', { uso: IMPRIME, motivo: 'fecha impresa en el PDF de albarán' }],
  ['src/modules/jobs/infra/albaranPdf.service.ts::generateAlbaranPdf', { uso: IMPRIME, motivo: 'fecha impresa en el PDF de albarán' }],
  ['src/modules/jobs/domain/recapitulativa.service.ts::emitirRecapitulativas', { uso: IMPRIME, motivo: 'fecha impresa en la recapitulativa' }],
  ['src/modules/jobs/app/routes/albaranes.routes.ts::POST /:id/facturar-parcial', { uso: IMPRIME, motivo: 'fecha impresa al facturar parcialmente' }],
  ['src/modules/jobs/app/routes/albaranes.routes.ts::POST /:id/convertir-en-factura', { uso: IMPRIME, motivo: 'fecha impresa al convertir en factura' }],
  ['src/modules/billing/app/routes/receipt.routes.ts::GET /:token', { uso: IMPRIME, motivo: 'fecha impresa en el recibo público' }],
  ['src/modules/system/app/routes/customerPortal.routes.ts::dateShort', { uso: IMPRIME, motivo: 'fecha impresa en el portal del cliente' }],
  ['src/modules/system/app/routes/invoicesAdmin.routes.ts::fD', { uso: IMPRIME, motivo: 'fecha impresa en el admin de facturas' }],
  ['src/modules/messaging/domain/weeklyDigest.service.ts::sendDigestForMerchant', { uso: IMPRIME, motivo: 'fecha impresa en el asunto del digest semanal — corrección propia, ver cabecera del bloque' }],

  // ── AGREGADO — bordes de ventana de informe/filtro/métrica: NO se acusan ──────────────────────
  ['src/modules/messaging/domain/whatsappLog.service.ts::getWhatsAppMetrics', { uso: AGREGADO }],
  ['src/integrations/whatsapp.ts::sendWhatsAppTemplate', { uso: AGREGADO }],
  ['src/modules/expenses/domain/expenses.service.ts::getExpenseSummary', { uso: AGREGADO }],
  ['src/modules/jobs/domain/precarga.service.ts::ventanaDePrecarga', { uso: AGREGADO }],
  ['src/modules/system/app/routes/quotesAdmin.routes.ts::GET /', { uso: AGREGADO }],
  ['src/modules/system/app/routes/invoicesAdmin.routes.ts::GET /', { uso: AGREGADO }],
  ['src/modules/metrics/domain/metrics.service.ts::getHomeMetrics', { uso: AGREGADO }],
  ['src/modules/metrics/domain/metrics.service.ts::monthRange', { uso: AGREGADO }],
  ['src/modules/metrics/domain/metrics.service.ts::getTeamMetrics', { uso: AGREGADO }],
  ['src/modules/team/domain/teamOverview.service.ts::getTeamOverview', { uso: AGREGADO }],
  ['src/modules/exports/app/routes/exports.routes.ts::parseDateFilter', { uso: AGREGADO }],
  ['src/modules/exports/app/routes/exports.routes.ts::GET /datos.zip', { uso: AGREGADO }],
  ['src/modules/exports/app/routes/exports.routes.ts::GET /fees.csv', { uso: AGREGADO }],
  ['src/modules/reports/app/routes/reports.routes.ts::GET /pl', { uso: AGREGADO }],
  ['src/modules/reports/app/routes/reports.routes.ts::GET /x2', { uso: AGREGADO }],
  ['src/modules/reports/app/routes/reports.routes.ts::GET /vat', { uso: AGREGADO }],
  ['src/modules/reports/app/routes/reports.routes.ts::GET /resumen-trimestre', { uso: AGREGADO }],
  ['src/modules/messaging/domain/weeklyDigest.service.ts::sendWeeklyDigests', { uso: AGREGADO }],
  ['src/modules/messaging/domain/weeklyDigest.service.ts::getDigestPreview', { uso: AGREGADO }],
]);

/**
 * ✂ RETIRADAS · identidades que YA NO aparecen porque se arreglaron (no porque el censo dejó de
 * verlas). Quien mejora, declara — igual que `_trinquete-de-zona.mjs`.
 *
 *   · `src/modules/quotes/domain/quoteNumber.service.ts::allocateQuoteNumber` (+ `displayQuoteNumber`)
 *     — SCRUM-1093, `a0f454f3`. Deriva el año con `diaNaturalEn(now, zonaDelMerchant(m))`.
 *   · `src/modules/jobs/domain/albaranNumber.service.ts::allocateAlbaranNumber`
 *     — SCRUM-1093f, `f0ff43df`. Mismo patrón.
 *   · `src/modules/jobs/app/routes/partes.routes.ts::POST /admin/partes`
 *     — SCRUM-1093g, `5cb43c1c`. Mismo patrón.
 *   · `src/app.ts::GET /admin/me`, `::POST /admin/onboarding/serie`, `::POST /admin/onboarding/serie/previa`
 *     y `src/modules/system/merchantAdmin.ts::updateMerchantProfile` — SCRUM-1168. Las puertas de la
 *     serie de facturas: el año sale de `anioDeLaSerie(merchant)` (`core/validation/fiscalInput.ts`),
 *     la misma expresión que `allocateInvoiceNumber`, comparada contra el emisor real en
 *     `tests/scrum1168-anio-serie-zona-merchant.test.mjs`.
 */
export const RETIRADAS = new Set([
  'src/modules/quotes/domain/quoteNumber.service.ts::allocateQuoteNumber',
  'src/modules/jobs/domain/albaranNumber.service.ts::allocateAlbaranNumber',
  'src/modules/jobs/app/routes/partes.routes.ts::POST /admin/partes',
  'src/app.ts::GET /admin/me',
  'src/app.ts::POST /admin/onboarding/serie/previa',
  'src/app.ts::POST /admin/onboarding/serie',
  'src/modules/system/merchantAdmin.ts::updateMerchantProfile',
]);

/** ¿Esta fila se acusa? Todo lo que no esté declarado AGREGADO — incluida una identidad NUEVA que
 * el `USO` no conoce todavía: fail-closed, fuerza a clasificarla en vez de dejarla pasar muda. */
export function clasifica(fila) {
  return USO.get(fila.identidad)?.uso ?? null;
}

export function acusada(fila) {
  return clasifica(fila) !== AGREGADO;
}

export { RAIZ, FAMILIA, GET_SET, LOCALE };
