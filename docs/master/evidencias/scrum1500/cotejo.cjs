// docs/master/evidencias/scrum1500/cotejo.cjs — SCRUM-1500
//
// EL CENSO DE SCRUM-1342/1401 PREGUNTABA «¿dice el comentario lo mismo que el código?».
// ÉSTE PREGUNTA «¿dice el CÓDIGO lo mismo que el MÁSTER?», y sólo después mira el comentario.
//
//     node docs/master/evidencias/scrum1500/cotejo.cjs
//     node docs/master/evidencias/scrum1500/cotejo.cjs --master <otro máster>   (para verlo en rojo)
//
// TRES CONJUNTOS POR CAMPO, y ninguno sale de leer el comentario:
//   C · lo que enumera el COMENTARIO del esquema (se lee de la línea, no se copia aquí)
//   D · lo que decide el DESTINO: la constante o el validador que cierra la lista, MÁS los literales
//       que el código escribe en esa columna (AST), MÁS el @default del esquema
//   M · lo que fija el MÁSTER: UNA línea, localizada por un ancla que tiene que casar UNA sola vez
//
// VEREDICTOS (el orden importa: el primero que se cumple manda):
//   NO_EXISTE              el campo no está en esa línea del esquema
//   CIEGO                  no pude sacar D, o el ancla del máster no casa exactamente una vez
//   CODIGO_FUERA_DEL_MASTER    D tiene un valor que M no tiene            ← regla 27: se PARA
//   MASTER_SIN_ESCRIBIR        M tiene un valor que D no tiene            ← también es decisión
//   COMENTARIO_ATRASADO        D = M y C ≠ D
//   COINCIDE_CON_EL_MASTER     D = M = C
//   ESTADO_SIN_MAQUINA_EN_EL_MASTER   el campo es un estado y el máster no trae su lista
//   EL_MASTER_NO_LO_FIJA       el campo no es un estado y el máster no trae su lista
//
// 🔴 «El máster no trae su lista» LO DECLARO YO en la tabla (master: null), así que NO se cree a
//    ciegas: para esos campos el instrumento busca en el máster el nombre del campo y cada valor de
//    D, y si alguna línea junta TODOS los valores lo dice (POSIBLE LISTA) en vez de callar.
//
// QUÉ NO VE: escrituras por SQL crudo, por un objeto construido en otro fichero o por derrame
// (`...datos`). Por eso D lleva la constante que cierra la lista y no sólo las escrituras.
const fs = require('node:fs');
const path = require('node:path');

const RAIZ_POR_DEFECTO = path.resolve(__dirname, '..', '..', '..', '..');

const CAMPOS = [
  { linea: 18, campo: 'Merchant.trade', campoEn: 18,
    cierre: { tipo: 'zod', fichero: 'src/core/validation/schemas.ts', propiedad: 'trade' },
    escribe: ['merchant', 'trade'], master: null },
  { linea: 67, campo: 'Merchant.connectStatus', campoEn: 67,
    cierre: null, escribe: ['merchant', 'connectStatus'],
    master: { ancla: /merchant\.connectStatus\(/, lista: /merchant\.connectStatus\(([^)]*)\)/ } },
  { linea: 201, campo: 'AuthSession.type', campoEn: 201,
    cierre: null, escribe: ['authSession', 'type'], master: null },
  { linea: 973, campo: 'Expense.category', campoEn: 973,
    cierre: { tipo: 'const', fichero: 'src/modules/expenses/domain/expenses.service.ts', nombre: 'EXPENSE_CATEGORIES' },
    escribe: ['expense', 'category'], master: null },
  { linea: 1115, campo: 'QuoteRequest.status', campoEn: 1115,
    cierre: { tipo: 'includes', fichero: 'src/modules/quoteRequests/app/routes/quoteRequests.routes.ts', argumento: 'status' },
    escribe: ['quoteRequest', 'status'],
    master: { ancla: /^\*\*QuoteRequest:\*\*/, lista: /^\*\*QuoteRequest:\*\* `([^`]+)`/ } },
  { linea: 1174, campo: 'TeamMember.role', campoEn: 1174,
    cierre: { tipo: 'const', fichero: 'src/core/http/roleCapabilities.ts', nombre: 'SUPPORTED_ROLES' },
    escribe: ['teamMember', 'role'],
    // La S1 dice «esta tabla es la verdad» y nombra los roles en sus columnas, con mayúscula y
    // acento. Se comparan normalizados (minúsculas, sin acentos): es la única traducción que hay.
    master: { ancla: /^\| Capacidad \|/, lista: /^\| Capacidad \|(.*)\|\s*$/, separador: /\|/, normaliza: true } },
  { linea: 1175, campo: 'TeamMember.status', campoEn: 1175,
    cierre: null, escribe: ['teamMember', 'status'], master: null },
  { linea: 1453, campo: 'Albaran.estado', campoEn: 1453,
    cierre: { tipo: 'const', fichero: 'src/modules/jobs/domain/albaran.service.ts', nombre: 'ALBARAN_ESTADOS' },
    escribe: ['albaran', 'estado'],
    master: { ancla: /^\*\*Albaran \(NO fiscal\)/, lista: /:\*\* `([^`]+)`/ } },
  { linea: 1426, campo: 'Albaran.estado', campoEn: 1453, etiqueta: 'Albaran.estado (comentario de cabecera)',
    cierre: { tipo: 'const', fichero: 'src/modules/jobs/domain/albaran.service.ts', nombre: 'ALBARAN_ESTADOS' },
    escribe: ['albaran', 'estado'],
    master: { ancla: /^\*\*Albaran \(NO fiscal\)/, lista: /:\*\* `([^`]+)`/ } },
  { linea: 217, campo: 'Customer.contactKind', campoEn: 239,
    cierre: { tipo: 'zod', fichero: 'src/core/validation/schemas.ts', propiedad: 'contactKind' },
    escribe: ['customer', 'contactKind'], master: null },
  { linea: 328, campo: 'Customer.tipoDestinatario', campoEn: 334,
    cierre: { tipo: 'zod', fichero: 'src/core/validation/schemas.ts', propiedad: 'tipoDestinatario' },
    escribe: ['customer', 'tipoDestinatario'], master: null },
  { linea: 396, campo: 'Customer.billingPeriodicity', campoEn: 410,
    cierre: { tipo: 'zod', fichero: 'src/core/validation/schemas.ts', propiedad: 'billingPeriodicity' },
    escribe: ['customer', 'billingPeriodicity'],
    master: { ancla: /`Customer\.billingPeriodicity` \(`/, lista: /`Customer\.billingPeriodicity` \(`([^`]+)`/ } },
  { linea: 609, campo: 'Quote.shippingAddressMode', campoEn: 621,
    cierre: { tipo: 'const', fichero: 'src/core/documentos/direccionObra.ts', nombre: 'MODOS_DIRECCION_OBRA' },
    escribe: ['quote', 'shippingAddressMode'], master: null },
  { linea: 725, campo: 'Quote.ivaModo', campoEn: 728,
    cierre: { tipo: 'const', fichero: 'src/modules/quotes/domain/presentacionIva.ts', nombre: 'MODOS_IVA' },
    escribe: ['quote', 'ivaModo'], master: null },
  { linea: 1050, campo: 'Product.itemKind', campoEn: 1057,
    cierre: { tipo: 'const', fichero: 'src/core/validation/schemas.ts', nombre: 'ITEM_KIND' },
    escribe: ['product', 'itemKind'], master: null },
  { linea: 1335, campo: 'Job.tipoOperacion', campoEn: 1339, comentarioDesde: 1334,
    cierre: { tipo: 'const', fichero: 'src/modules/jobs/domain/job.service.ts', nombre: 'JOB_TIPOS_OPERACION' },
    escribe: ['job', 'tipoOperacion'],
    master: { ancla: /`Job\.tipoOperacion` string `/, lista: /`Job\.tipoOperacion` string `([^`]+)`/ } },
  { linea: 1448, campo: 'Albaran.modoValoracion', campoEn: 1451,
    cierre: { tipo: 'const', fichero: 'src/modules/jobs/domain/albaran.service.ts', nombre: 'ALBARAN_MODOS_VALORACION' },
    escribe: ['albaran', 'modoValoracion'],
    master: { ancla: /`Albaran\.modoValoracion` string `/, lista: /`Albaran\.modoValoracion` string `([^`]+)`/ } },
  { linea: 1636, campo: 'ParteTrabajo.tipo', campoEn: 1637,
    cierre: { tipo: 'const', fichero: 'src/modules/jobs/domain/parteTrabajo.ts', nombre: 'TIPOS_PARTE' },
    escribe: ['parteTrabajo', 'tipo'], master: null },
  { linea: 1642, campo: 'ParteTrabajo.estado', campoEn: 1643,
    cierre: { tipo: 'const', fichero: 'src/modules/jobs/domain/parteTrabajo.ts', nombre: 'ESTADOS_PARTE' },
    escribe: ['parteTrabajo', 'estado'], master: null },
];

// Controles que viajan con cada pasada. Ninguno puede salir «coincide».
const CONTROLES = [
  { linea: 18, campo: 'Merchant.campoQueNoExiste', campoEn: 18, control: 'NO_EXISTE',
    cierre: null, escribe: ['merchant', 'campoQueNoExiste'], master: null },
  { linea: 1453, campo: 'Albaran.estado', campoEn: 1453, control: 'CIEGO', etiqueta: 'Albaran.estado con un ancla inventada',
    cierre: { tipo: 'const', fichero: 'src/modules/jobs/domain/albaran.service.ts', nombre: 'ALBARAN_ESTADOS' },
    escribe: ['albaran', 'estado'],
    master: { ancla: /^\*\*EntidadQueElMasterNoTiene:\*\*/, lista: /`([^`]+)`/ } },
  { linea: 1453, campo: 'Albaran.estado', campoEn: 1453, control: 'CIEGO', etiqueta: 'Albaran.estado con una constante inventada',
    cierre: { tipo: 'const', fichero: 'src/modules/jobs/domain/albaran.service.ts', nombre: 'CONSTANTE_QUE_NO_EXISTE' },
    escribe: ['albaranInventado', 'estado'],
    master: { ancla: /^\*\*Albaran \(NO fiscal\)/, lista: /:\*\* `([^`]+)`/ } },
];

const ESCRIBE = new Set(['create', 'update', 'upsert', 'createMany', 'updateMany', 'createManyAndReturn']);
const sinAcentos = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const esEstado = (campo) => /(^|\.)(status|estado|state)$/i.test(campo) || /(Status|Estado|State)$/.test(campo);
const ordenado = (set) => [...set].sort();
const igual = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));
const menos = (a, b) => ordenado(new Set([...a].filter((x) => !b.has(x))));

/** Los valores de una lista escrita en prosa: `a | b`, `a → b | c(detalle)`, `'a'|'b'`. */
function valoresDeLista(texto, separador = /\||→/) {
  return new Set(
    texto.split(separador)
      .map((t) => t.replace(/\([^)]*\)/g, ' ').replace(/['"`*]/g, ' ').trim())
      .map((t) => (/^[\p{L}_][\p{L}\p{N}_]*$/u.test(t) ? t : (/([\p{L}_][\p{L}\p{N}_]*)$/u.exec(t) || [])[1] || ''))
      .filter(Boolean),
  );
}

/**
 * C: lo que enumera el comentario. Coge la racha de palabras unidas por `|` (la más larga de la
 * línea) y, si la línea de antes acaba abriendo esa racha, la junta (el caso de `Job.tipoOperacion`,
 * partido en dos líneas: lo que el censo viejo declaraba no ver).
 */
function valoresDelComentario(lineas, c) {
  const desde = c.comentarioDesde ?? c.linea;
  const trozos = [];
  for (let n = desde; n <= c.linea; n += 1) {
    const l = lineas[n - 1] ?? '';
    const corte = l.indexOf('//');
    if (corte < 0) return null;
    trozos.push(l.slice(corte).replace(/^\/+\s?/, ''));
  }
  const texto = trozos.join(' ');
  const palabra = "['\"`]?[\\p{L}_][\\p{L}\\p{N}_]*['\"`]?";
  const hueco = '(?:\\s*\\([^)|]*\\))?\\s*';
  // Entre dos valores caben un paréntesis de glosa y, en el caso partido en dos líneas, la glosa
  // entera («(varias visitas → …, art. 13)»): por eso el hueco admite un paréntesis sin `|` dentro.
  const racha = new RegExp(`${palabra}${hueco}(?:\\|${hueco}${palabra}${hueco})+`, 'gu');
  const rachas = texto.match(racha) || [];
  if (rachas.length === 0) return new Set();
  const larga = rachas.sort((a, b) => b.split('|').length - a.split('|').length)[0];
  return valoresDeLista(larga, /\|/);
}

function cargarTs(raiz) {
  for (const base of [raiz, RAIZ_POR_DEFECTO, process.cwd()]) {
    try { return require(require.resolve('typescript', { paths: [base] })); } catch { /* siguiente */ }
  }
  return null;
}

function fuente(ts, raiz, rel, cache) {
  if (cache.has(rel)) return cache.get(rel);
  let sf = null;
  try { sf = ts.createSourceFile(rel, fs.readFileSync(path.join(raiz, rel), 'utf8'), ts.ScriptTarget.Latest, true); } catch { sf = null; }
  cache.set(rel, sf);
  return sf;
}

/** Las hojas literales de una expresión: literal, ternario, `a ?? b`, `as const`, o una const del fichero. */
function hojas(ts, sf, expr, hondo = 0) {
  const fuera = [];
  (function baja(e, h) {
    if (!e) return;
    if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) { fuera.push({ valor: e.text }); return; }
    if (ts.isParenthesizedExpression(e) || ts.isAsExpression(e) || ts.isNonNullExpression(e) || (ts.isSatisfiesExpression && ts.isSatisfiesExpression(e))) { baja(e.expression, h); return; }
    if (ts.isConditionalExpression(e)) { baja(e.whenTrue, h); baja(e.whenFalse, h); return; }
    if (ts.isBinaryExpression(e) && [ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.BarBarToken].includes(e.operatorToken.kind)) { baja(e.left, h); baja(e.right, h); return; }
    if (ts.isIdentifier(e) && h < 3) {
      const decl = declaracion(ts, sf, e.text, e.getStart());
      if (decl) { baja(decl, h + 1); return; }
    }
    fuera.push({ noLiteral: e.getText().replace(/\s+/g, ' ').slice(0, 80) });
  })(expr, hondo);
  return fuera;
}

/** El inicializador de la `const`/`let` de ese nombre más cercana por encima de `antesDe`. */
function declaracion(ts, sf, nombre, antesDe = Infinity) {
  let mejor = null;
  (function ver(n) {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === nombre && n.initializer && n.getStart() < antesDe) {
      if (!mejor || n.getStart() > mejor.getStart()) mejor = n;
    }
    ts.forEachChild(n, ver);
  })(sf);
  return mejor ? mejor.initializer : null;
}

/** D, primera mitad: la constante o el validador que cierra la lista. */
function valoresDelCierre(ts, raiz, cierre, cache) {
  if (!cierre) return { valores: new Set(), de: null };
  const sf = fuente(ts, raiz, cierre.fichero, cache);
  if (!sf) return { valores: new Set(), de: `${cierre.fichero} (no se pudo leer)` };
  let lista = null;
  let linea = null;
  const tomaArray = (arr) => {
    const v = new Set();
    for (const el of arr.elements) for (const h of hojas(ts, sf, el)) if (h.valor !== undefined) v.add(h.valor);
    return v;
  };
  const desnuda = (e) => { let x = e; while (x && (ts.isAsExpression(x) || ts.isParenthesizedExpression(x))) x = x.expression; return x; };
  (function ver(n) {
    if (lista) return;
    if (cierre.tipo === 'const' && ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === cierre.nombre && n.initializer) {
      const arr = desnuda(n.initializer);
      if (ts.isArrayLiteralExpression(arr)) { lista = tomaArray(arr); linea = n; }
    }
    if (cierre.tipo === 'zod' && ts.isPropertyAssignment(n) && ts.isIdentifier(n.name) && n.name.text === cierre.propiedad) {
      // <propiedad>: z.enum([...]) o z.enum(CONSTANTE), con lo que cuelgue detrás (.nullable()…)
      (function dentro(m) {
        if (lista) return;
        if (ts.isCallExpression(m) && ts.isPropertyAccessExpression(m.expression) && m.expression.name.text === 'enum' && m.arguments[0]) {
          let arg = desnuda(m.arguments[0]);
          if (ts.isIdentifier(arg)) arg = desnuda(declaracion(ts, sf, arg.text));
          if (arg && ts.isArrayLiteralExpression(arg)) { lista = tomaArray(arg); linea = n; }
        }
        ts.forEachChild(m, dentro);
      })(n.initializer);
    }
    if (cierre.tipo === 'includes' && ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === 'includes'
      && n.arguments[0] && ts.isIdentifier(n.arguments[0]) && n.arguments[0].text === cierre.argumento) {
      const arr = desnuda(n.expression.expression);
      if (arr && ts.isArrayLiteralExpression(arr)) { lista = tomaArray(arr); linea = n; }
    }
    ts.forEachChild(n, ver);
  })(sf);
  const donde = linea ? `${cierre.fichero}:${sf.getLineAndCharacterOfPosition(linea.getStart()).line + 1}` : `${cierre.fichero} (no encontrado: ${cierre.nombre || cierre.propiedad || cierre.argumento})`;
  return { valores: lista || new Set(), de: donde };
}

function ficherosTs(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) ficherosTs(p, out);
    else if (e.name.endsWith('.ts') && !e.name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

/**
 * D, segunda mitad: los literales que se escriben en `<delegado>.<campo>` dentro de una llamada de
 * escritura de Prisma. Lo que cuelga de un `where` no es una escritura y no cuenta.
 */
function censarEscrituras(ts, raiz, objetivos) {
  const lista = ficherosTs(path.join(raiz, 'src'));
  let sinParsear = 0;
  const salida = new Map(objetivos.map(([d, c]) => [`${d}.${c}`, { valores: new Set(), sitios: [], noLiterales: [] }]));
  for (const f of lista) {
    let sf;
    try { sf = ts.createSourceFile(f, fs.readFileSync(f, 'utf8'), ts.ScriptTarget.Latest, true); } catch { sinParsear += 1; continue; }
    const rel = path.relative(raiz, f).replace(/\\/g, '/');
    (function ver(n, delegado, enWhere) {
      let d = delegado;
      let w = enWhere;
      if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && ESCRIBE.has(n.expression.name.text)
        && ts.isPropertyAccessExpression(n.expression.expression)) { d = n.expression.expression.name.text; w = false; }
      if (ts.isPropertyAssignment(n) && ts.isIdentifier(n.name) && n.name.text === 'where') w = true;
      if (d && !w && (ts.isPropertyAssignment(n) || ts.isShorthandPropertyAssignment(n)) && n.name && ts.isIdentifier(n.name)) {
        const k = `${d}.${n.name.text}`;
        if (salida.has(k)) {
          const expr = ts.isPropertyAssignment(n) ? n.initializer : n.name;
          const linea = sf.getLineAndCharacterOfPosition(n.getStart()).line + 1;
          for (const h of hojas(ts, sf, expr)) {
            if (h.valor !== undefined) { salida.get(k).valores.add(h.valor); salida.get(k).sitios.push(`${rel}:${linea} '${h.valor}'`); }
            else salida.get(k).noLiterales.push(`${rel}:${linea} ${h.noLiteral}`);
          }
        }
      }
      ts.forEachChild(n, (h) => ver(h, d, w));
    })(sf, null, false);
  }
  return { salida, ficheros: lista.length, sinParsear };
}

/** El @default de la línea del campo, si lo hay. */
function defectoDelEsquema(lineas, c) {
  const l = lineas[c.campoEn - 1] ?? '';
  const nombre = c.campo.split('.')[1];
  if (!new RegExp(`^\\s+${nombre}\\s`).test(l)) return { existe: false, defecto: null };
  const m = /@default\("([^"]*)"\)/.exec(l.split('//')[0]);
  return { existe: true, defecto: m ? m[1] : null };
}

/** M: la lista del máster, o por qué no se pudo leer. */
function valoresDelMaster(lineasMaster, spec) {
  const casan = [];
  for (const [i, l] of lineasMaster.entries()) if (spec.ancla.test(l)) casan.push(i + 1);
  if (casan.length !== 1) return { valores: null, motivo: `el ancla ${spec.ancla} casa ${casan.length} veces en el máster (tiene que ser 1)`, linea: null };
  const m = spec.lista.exec(lineasMaster[casan[0] - 1]);
  if (!m) return { valores: null, motivo: `la línea ${casan[0]} del máster no trae la lista con la forma esperada`, linea: casan[0] };
  let valores = valoresDeLista(m[1], spec.separador);
  if (spec.normaliza) valores = new Set([...valores].map((v) => sinAcentos(v).toLowerCase()));
  if (valores.size === 0) return { valores: null, motivo: `la lista de la línea ${casan[0]} del máster salió vacía`, linea: casan[0] };
  return { valores, motivo: null, linea: casan[0] };
}

/** Para los campos sin lista en el máster: dónde aparece cada valor, y si alguna línea los junta todos. */
function rastroEnElMaster(lineasMaster, campo, valores) {
  const palabra = (v) => new RegExp(`(?<![\\p{L}\\p{N}_])${v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}_])`, 'u');
  const porValor = {};
  for (const v of valores) porValor[v] = [];
  const nombres = [campo, campo.split('.')[1]];
  const delNombre = Object.fromEntries(nombres.map((n) => [n, []]));
  const juntas = [];
  for (const [i, l] of lineasMaster.entries()) {
    let cuantos = 0;
    for (const v of valores) if (palabra(v).test(l)) { porValor[v].push(i + 1); cuantos += 1; }
    if (valores.size > 0 && cuantos === valores.size) juntas.push(i + 1);
    for (const n of nombres) if (palabra(n).test(l)) delNombre[n].push(i + 1);
  }
  return { porValor, delNombre, juntas };
}

/** El veredicto, puro: tres conjuntos y dos banderas. Es lo que prueba el test. */
function veredicto({ existe, C, D, M, masterDeclarado, masterMotivo, campo, cierreRoto = null }) {
  if (!existe) return { veredicto: 'NO_EXISTE', porque: 'el campo no está en esa línea del esquema' };
  // Un cierre DECLARADO que no aparece no se suple con el @default: sería medir otra cosa.
  if (cierreRoto) return { veredicto: 'CIEGO', porque: `no encuentro el cierre declarado: ${cierreRoto}` };
  if (!D || D.size === 0) return { veredicto: 'CIEGO', porque: 'no saqué ningún valor del código para este campo' };
  if (masterDeclarado && !M) return { veredicto: 'CIEGO', porque: masterMotivo };
  if (!masterDeclarado) {
    return esEstado(campo)
      ? { veredicto: 'ESTADO_SIN_MAQUINA_EN_EL_MASTER', porque: 'el campo es un estado y el máster no trae su lista' }
      : { veredicto: 'EL_MASTER_NO_LO_FIJA', porque: 'el máster no trae una lista para este campo' };
  }
  const sobran = menos(D, M);
  const faltan = menos(M, D);
  if (sobran.length > 0) return { veredicto: 'CODIGO_FUERA_DEL_MASTER', porque: `el código tiene ${sobran.join(', ')} y el máster no${faltan.length ? `; y el máster manda ${faltan.join(', ')}, que el código no tiene` : ''}`, sobran, faltan };
  if (faltan.length > 0) return { veredicto: 'MASTER_SIN_ESCRIBIR', porque: `el máster manda ${faltan.join(', ')} y el código no lo tiene`, sobran, faltan };
  if (!C || !igual(C, D)) return { veredicto: 'COMENTARIO_ATRASADO', porque: 'código y máster coinciden; el comentario no' };
  return { veredicto: 'COINCIDE_CON_EL_MASTER', porque: 'comentario, código y máster dicen lo mismo' };
}

/** Lo que habría dicho el censo viejo: comentario contra código, y nada más. */
function censoViejo(C, D) {
  if (!C || !D || D.size === 0) return 'sin dato';
  return igual(C, D) ? 'coincide' : 'diverge';
}

function cotejar({ raiz = RAIZ_POR_DEFECTO, master = null, campos = CAMPOS, controles = CONTROLES } = {}) {
  const ts = cargarTs(raiz);
  if (!ts) return { ciego: 'no encuentro el módulo typescript' };
  const lineasEsquema = fs.readFileSync(path.join(raiz, 'prisma', 'schema.prisma'), 'utf8').split(/\r?\n/);
  const rutaMaster = master ? path.resolve(master) : path.join(raiz, 'docs', 'YAQU_MASTER.md');
  const lineasMaster = fs.readFileSync(rutaMaster, 'utf8').split(/\r?\n/);
  const todos = [...campos, ...controles];
  const { salida: escrituras, ficheros, sinParsear } = censarEscrituras(ts, raiz, todos.map((c) => c.escribe));
  const cache = new Map();
  const filas = todos.map((c) => {
    const { existe, defecto } = defectoDelEsquema(lineasEsquema, c);
    const C = existe ? valoresDelComentario(lineasEsquema, c) : null;
    const cierre = valoresDelCierre(ts, raiz, c.cierre, cache);
    const esc = escrituras.get(c.escribe.join('.'));
    const D = new Set([...cierre.valores, ...esc.valores, ...(defecto ? [defecto] : [])]);
    const m = c.master ? valoresDelMaster(lineasMaster, c.master) : { valores: null, motivo: null, linea: null };
    const v = veredicto({ existe, C, D, M: m.valores, masterDeclarado: !!c.master, masterMotivo: m.motivo, campo: c.campo, cierreRoto: c.cierre && cierre.valores.size === 0 ? cierre.de : null });
    const rastro = !c.master && existe ? rastroEnElMaster(lineasMaster, c.campo, D) : null;
    return {
      linea: c.linea, campo: c.etiqueta || c.campo, control: c.control || null,
      C: C ? ordenado(C) : null, D: ordenado(D), M: m.valores ? ordenado(m.valores) : null, lineaMaster: m.linea,
      cierre: ordenado(cierre.valores), cierreDe: cierre.de, escritos: ordenado(esc.valores), sitios: esc.sitios,
      noLiterales: esc.noLiterales, defecto,
      declaradoSinEscribir: c.cierre ? menos(cierre.valores, new Set([...esc.valores, ...(defecto ? [defecto] : [])])) : [],
      escritoFueraDelCierre: c.cierre && cierre.valores.size > 0 ? menos(new Set([...esc.valores, ...(defecto ? [defecto] : [])]), cierre.valores) : [],
      viejo: censoViejo(C, D), ...v, rastro,
    };
  });
  return {
    poblacion: { campos: campos.length, controles: controles.length, ficheros, sinParsear, lineasEsquema: lineasEsquema.length, lineasMaster: lineasMaster.length, master: rutaMaster },
    filas,
  };
}

function pinta(r) {
  const out = [];
  const p = r.poblacion;
  out.push(`POBLACION: ${p.campos} comentarios + ${p.controles} controles · ${p.ficheros} ficheros .ts bajo src/ (${p.sinParsear} sin parsear) · esquema ${p.lineasEsquema} líneas · máster ${p.lineasMaster} líneas`);
  for (const f of r.filas) {
    out.push('');
    out.push(`=== ${f.control ? `[CONTROL, tiene que salir ${f.control}] ` : ''}${String(f.linea).padStart(4)} · ${f.campo} → ${f.veredicto}`);
    out.push(`    por qué      : ${f.porque}`);
    out.push(`    comentario C : ${f.C ? f.C.join(' | ') || '(sin lista)' : '(no hay)'}`);
    out.push(`    código D     : ${f.D.join(' | ') || '(nada)'}`);
    out.push(`      · cierre   : ${f.cierre.join(' | ') || '(sin constante que lo cierre)'}${f.cierreDe ? `   ← ${f.cierreDe}` : ''}`);
    out.push(`      · escritos : ${f.escritos.join(' | ') || '(ningún literal)'}${f.defecto ? `   · @default ${f.defecto}` : ''}`);
    for (const s of f.sitios) out.push(`          ${s}`);
    for (const s of f.noLiterales) out.push(`          (no literal) ${s}`);
    if (f.declaradoSinEscribir.length) out.push(`      · en el cierre y sin ningún literal que lo escriba: ${f.declaradoSinEscribir.join(', ')}`);
    if (f.escritoFueraDelCierre.length) out.push(`      · 🔴 escrito y FUERA del cierre: ${f.escritoFueraDelCierre.join(', ')}`);
    out.push(`    máster M     : ${f.M ? `${f.M.join(' | ')}   ← línea ${f.lineaMaster}` : '(sin lista)'}`);
    out.push(`    censo viejo  : ${f.viejo}`);
    if (f.rastro) {
      for (const [n, ls] of Object.entries(f.rastro.delNombre)) out.push(`    rastro «${n}»: ${ls.length} línea(s)${ls.length ? ` → ${ls.slice(0, 12).join(', ')}` : ''}`);
      for (const [v, ls] of Object.entries(f.rastro.porValor)) out.push(`    rastro «${v}»: ${ls.length} línea(s)${ls.length ? ` → ${ls.slice(0, 12).join(', ')}` : ''}`);
      out.push(f.rastro.juntas.length
        ? `    🔴 POSIBLE LISTA EN EL MÁSTER: la(s) línea(s) ${f.rastro.juntas.join(', ')} juntan TODOS los valores. Hay que leerlas.`
        : '    ninguna línea del máster junta todos los valores');
    }
  }
  const reales = r.filas.filter((f) => !f.control);
  const cuenta = {};
  for (const f of reales) cuenta[f.veredicto] = (cuenta[f.veredicto] || 0) + 1;
  out.push('');
  out.push('RESUMEN (sin los controles):');
  for (const [k, n] of Object.entries(cuenta).sort()) out.push(`  ${String(n).padStart(2)}  ${k}`);
  out.push(`  ${String(reales.length).padStart(2)}  TOTAL`);
  const viejoBueno = reales.filter((f) => f.viejo === 'coincide');
  out.push(`  el censo viejo daría «coincide» a ${viejoBueno.length} de ${reales.length}; de ésos, con el máster delante coinciden ${viejoBueno.filter((f) => f.veredicto === 'COINCIDE_CON_EL_MASTER').length}`);
  const malos = r.filas.filter((f) => f.control && f.veredicto !== f.control);
  const ciegos = reales.filter((f) => f.veredicto === 'CIEGO' || f.veredicto === 'NO_EXISTE');
  const coincidenDeMentira = r.filas.filter((f) => f.control && f.veredicto === 'COINCIDE_CON_EL_MASTER');
  out.push('');
  out.push(`CONTROLES: ${r.poblacion.controles - malos.length} de ${r.poblacion.controles} salen como tienen que salir · controles que salen «coincide»: ${coincidenDeMentira.length} (tiene que ser 0) · campos reales ciegos: ${ciegos.length} (tiene que ser 0)`);
  const ok = malos.length === 0 && coincidenDeMentira.length === 0 && ciegos.length === 0 && p.sinParsear === 0 && p.ficheros > 0;
  out.push(ok ? 'EXIT=0' : 'INSTRUMENTO NO FIABLE\nEXIT=2');
  return { texto: out.join('\n'), ok };
}

module.exports = { CAMPOS, CONTROLES, cotejar, veredicto, censoViejo, valoresDeLista, valoresDelComentario, valoresDelMaster, esEstado, pinta };

if (require.main === module) {
  const i = process.argv.indexOf('--master');
  const r = cotejar({ master: i > 0 ? process.argv[i + 1] : null });
  if (r.ciego) { console.log(`CIEGO: ${r.ciego}\nEXIT=2`); process.exit(2); }
  const { texto, ok } = pinta(r);
  console.log(texto);
  process.exit(ok ? 0 : 2);
}
