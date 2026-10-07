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
// DESDE SCRUM-1500b (decisión en Jira, SCRUM-1500 c.18831) ESTE INSTRUMENTO CORRE EN LA TANDA, desde
// `tests/scrum1500-el-cotejo-contra-el-master.test.mjs`. Dos cosas cambiaron para que pudiera:
//   · cada comentario se localiza por su MODELO y su CAMPO (`localizar`), no por número de línea;
//   · detrás del cotejo va un JUICIO (`juzgar`): qué veredictos se nombran, y los tres casos que
//     esperan al fundador, cada uno con su excepción (`PARADOS`).
// La salida del guion: 0 nada que nombrar · 1 hay hallazgos · 2 el instrumento no es fiable.
//
// QUÉ NO VE: los campos del esquema que no están en la tabla CAMPOS (los cuenta y los nombra al
// final, pero no los coteja), ni las escrituras por SQL crudo, por un objeto construido en otro fichero o por derrame
// (`...datos`). Por eso D lleva la constante que cierra la lista y no sólo las escrituras.
const fs = require('node:fs');
const path = require('node:path');

const RAIZ_POR_DEFECTO = path.resolve(__dirname, '..', '..', '..', '..');

const CAMPOS = [
  { campo: 'Merchant.trade', comentario: 'cola',
    cierre: { tipo: 'zod', fichero: 'src/core/validation/schemas.ts', propiedad: 'trade' },
    escribe: ['merchant', 'trade'], master: null },
  { campo: 'Merchant.connectStatus', comentario: 'cola',
    cierre: null, escribe: ['merchant', 'connectStatus'],
    master: { ancla: /merchant\.connectStatus\(/, lista: /merchant\.connectStatus\(([^)]*)\)/ } },
  { campo: 'AuthSession.type', comentario: 'cola',
    cierre: null, escribe: ['authSession', 'type'], master: null },
  { campo: 'Expense.category', comentario: 'cola',
    cierre: { tipo: 'const', fichero: 'src/modules/expenses/domain/expenses.service.ts', nombre: 'EXPENSE_CATEGORIES' },
    escribe: ['expense', 'category'], master: null },
  { campo: 'QuoteRequest.status', comentario: 'cola',
    cierre: { tipo: 'includes', fichero: 'src/modules/quoteRequests/app/routes/quoteRequests.routes.ts', argumento: 'status' },
    escribe: ['quoteRequest', 'status'],
    master: { ancla: /^\*\*QuoteRequest:\*\*/, lista: /^\*\*QuoteRequest:\*\* `([^`]+)`/ } },
  { campo: 'TeamMember.role', comentario: 'cola',
    cierre: { tipo: 'const', fichero: 'src/core/http/roleCapabilities.ts', nombre: 'SUPPORTED_ROLES' },
    escribe: ['teamMember', 'role'],
    // La S1 dice «esta tabla es la verdad» y nombra los roles en sus columnas, con mayúscula y
    // acento. Se comparan normalizados (minúsculas, sin acentos): es la única traducción que hay.
    master: { ancla: /^\| Capacidad \|/, lista: /^\| Capacidad \|(.*)\|\s*$/, separador: /\|/, normaliza: true } },
  { campo: 'TeamMember.status', comentario: 'cola',
    cierre: null, escribe: ['teamMember', 'status'], master: null },
  { campo: 'Albaran.estado', comentario: 'cola',
    cierre: { tipo: 'const', fichero: 'src/modules/jobs/domain/albaran.service.ts', nombre: 'ALBARAN_ESTADOS' },
    escribe: ['albaran', 'estado'],
    master: { ancla: /^\*\*Albaran \(NO fiscal\)/, lista: /:\*\* `([^`]+)`/ } },
  { campo: 'Albaran.estado', comentario: 'cabecera', etiqueta: 'Albaran.estado (comentario de cabecera)',
    cierre: { tipo: 'const', fichero: 'src/modules/jobs/domain/albaran.service.ts', nombre: 'ALBARAN_ESTADOS' },
    escribe: ['albaran', 'estado'],
    master: { ancla: /^\*\*Albaran \(NO fiscal\)/, lista: /:\*\* `([^`]+)`/ } },
  { campo: 'Customer.contactKind', comentario: 'encima',
    cierre: { tipo: 'zod', fichero: 'src/core/validation/schemas.ts', propiedad: 'contactKind' },
    escribe: ['customer', 'contactKind'], master: null },
  { campo: 'Customer.tipoDestinatario', comentario: 'encima',
    cierre: { tipo: 'zod', fichero: 'src/core/validation/schemas.ts', propiedad: 'tipoDestinatario' },
    escribe: ['customer', 'tipoDestinatario'], master: null },
  { campo: 'Customer.billingPeriodicity', comentario: 'encima',
    cierre: { tipo: 'zod', fichero: 'src/core/validation/schemas.ts', propiedad: 'billingPeriodicity' },
    escribe: ['customer', 'billingPeriodicity'],
    master: { ancla: /`Customer\.billingPeriodicity` \(`/, lista: /`Customer\.billingPeriodicity` \(`([^`]+)`/ } },
  { campo: 'Quote.shippingAddressMode', comentario: 'encima', encimaDe: 'shippingAddress',
    cierre: { tipo: 'const', fichero: 'src/core/documentos/direccionObra.ts', nombre: 'MODOS_DIRECCION_OBRA' },
    escribe: ['quote', 'shippingAddressMode'], master: null },
  { campo: 'Quote.ivaModo', comentario: 'encima',
    cierre: { tipo: 'const', fichero: 'src/modules/quotes/domain/presentacionIva.ts', nombre: 'MODOS_IVA' },
    escribe: ['quote', 'ivaModo'], master: null },
  { campo: 'Product.itemKind', comentario: 'encima',
    cierre: { tipo: 'const', fichero: 'src/core/validation/schemas.ts', nombre: 'ITEM_KIND' },
    escribe: ['product', 'itemKind'], master: null },
  { campo: 'Job.tipoOperacion', comentario: 'encima',
    cierre: { tipo: 'const', fichero: 'src/modules/jobs/domain/job.service.ts', nombre: 'JOB_TIPOS_OPERACION' },
    escribe: ['job', 'tipoOperacion'],
    master: { ancla: /`Job\.tipoOperacion` string `/, lista: /`Job\.tipoOperacion` string `([^`]+)`/ } },
  { campo: 'Albaran.modoValoracion', comentario: 'encima',
    cierre: { tipo: 'const', fichero: 'src/modules/jobs/domain/albaran.service.ts', nombre: 'ALBARAN_MODOS_VALORACION' },
    escribe: ['albaran', 'modoValoracion'],
    master: { ancla: /`Albaran\.modoValoracion` string `/, lista: /`Albaran\.modoValoracion` string `([^`]+)`/ } },
  { campo: 'ParteTrabajo.tipo', comentario: 'encima',
    cierre: { tipo: 'const', fichero: 'src/modules/jobs/domain/parteTrabajo.ts', nombre: 'TIPOS_PARTE' },
    escribe: ['parteTrabajo', 'tipo'], master: null },
  { campo: 'ParteTrabajo.estado', comentario: 'encima',
    cierre: { tipo: 'const', fichero: 'src/modules/jobs/domain/parteTrabajo.ts', nombre: 'ESTADOS_PARTE' },
    escribe: ['parteTrabajo', 'estado'], master: null },
];

// Controles que viajan con cada pasada. Ninguno puede salir «coincide».
const CONTROLES = [
  { campo: 'Merchant.campoQueNoExiste', comentario: 'cola', control: 'NO_EXISTE',
    cierre: null, escribe: ['merchant', 'campoQueNoExiste'], master: null },
  // SCRUM-1500b · el localizador por identidad también lleva su cero: un modelo que no está.
  { campo: 'ModeloQueNoExiste.status', comentario: 'cola', control: 'NO_EXISTE',
    cierre: null, escribe: ['modeloQueNoExiste', 'status'], master: null },
  { campo: 'Albaran.estado', comentario: 'cola', control: 'CIEGO', etiqueta: 'Albaran.estado con un ancla inventada',
    cierre: { tipo: 'const', fichero: 'src/modules/jobs/domain/albaran.service.ts', nombre: 'ALBARAN_ESTADOS' },
    escribe: ['albaran', 'estado'],
    master: { ancla: /^\*\*EntidadQueElMasterNoTiene:\*\*/, lista: /`([^`]+)`/ } },
  { campo: 'Albaran.estado', comentario: 'cola', control: 'CIEGO', etiqueta: 'Albaran.estado con una constante inventada',
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
function valoresDelComentario(lineas, sitio) {
  const trozos = [];
  let texto = '';
  for (let n = sitio.desde; n <= sitio.hasta; n += 1) {
    const l = lineas[n - 1] ?? '';
    const corte = l.indexOf('//');
    if (corte < 0) continue;
    trozos.push({ linea: n, desde: texto.length });
    texto += `${l.slice(corte).replace(/^\/+\s?/, '')} `;
  }
  const palabra = "['\"`]?[\\p{L}_][\\p{L}\\p{N}_]*['\"`]?";
  const hueco = '(?:\\s*\\([^)|]*\\))?\\s*';
  // Entre dos valores caben un paréntesis de glosa y, en el caso partido en dos líneas, la glosa
  // entera («(varias visitas → …, art. 13)»): por eso el hueco admite un paréntesis sin `|` dentro.
  const racha = new RegExp(`${palabra}${hueco}(?:\\|${hueco}${palabra}${hueco})+`, 'gu');
  const rachas = [...texto.matchAll(racha)];
  if (rachas.length === 0) return { valores: new Set(), linea: sitio.campoEn };
  const larga = rachas.sort((a, b) => b[0].split('|').length - a[0].split('|').length)[0];
  // La línea que se nombra es la de la primera barra de la racha (SCRUM-1500b): es un dato para
  // quien lee la salida, no un ancla. El ancla es el modelo y el campo.
  const barra = larga.index + larga[0].indexOf('|');
  const linea = trozos.filter((t) => t.desde <= barra).pop().linea;
  return { valores: valoresDeLista(larga[0], /\|/), linea };
}

/**
 * SCRUM-1500b · DÓNDE VIVE EL CAMPO Y SU COMENTARIO, POR IDENTIDAD: el modelo y el nombre del campo,
 * nunca un número de línea. Hasta aquí la tabla llevaba `linea` y `campoEn`, y por eso el instrumento
 * no podía correr en el CI: cualquier cambio del esquema que moviera líneas lo dejaba leyendo otro
 * campo. El comentario es uno de tres sitios, y la tabla dice cuál:
 *   'cola'      detrás del campo, en su misma línea
 *   'encima'    el bloque de comentarios pegado encima del campo (o del hermano `encimaDe`, cuando
 *               un solo bloque explica dos columnas)
 *   'cabecera'  el bloque de comentarios pegado encima de `model X {`
 * Si el modelo o el campo no aparecen EXACTAMENTE una vez, no existe: no se adivina cuál.
 */
function localizar(lineas, c) {
  const [modelo, campo] = c.campo.split('.');
  const reModelo = new RegExp(`^model\\s+${modelo}\\s*\\{`);
  const abre = [];
  for (const [i, l] of lineas.entries()) if (reModelo.test(l)) abre.push(i);
  if (abre.length !== 1) return { existe: false, motivo: `el modelo ${modelo} aparece ${abre.length} veces en el esquema (tiene que ser 1)` };
  let cierra = abre[0] + 1;
  while (cierra < lineas.length && !/^\}/.test(lineas[cierra])) cierra += 1;
  const deCampo = (nombre) => {
    const re = new RegExp(`^\\s+${nombre}\\s`);
    const o = [];
    for (let i = abre[0] + 1; i < cierra; i += 1) if (re.test(lineas[i])) o.push(i);
    return o;
  };
  const suyas = deCampo(campo);
  if (suyas.length !== 1) return { existe: false, motivo: `el campo ${campo} aparece ${suyas.length} veces en el modelo ${modelo} (tiene que ser 1)` };
  const esComentario = (i) => /^\s*\/\//.test(lineas[i] ?? '');
  // El bloque de comentarios pegado encima de la línea `i`. Si no hay ninguno sale vacío (desde > hasta).
  const bloqueSobre = (i) => { let a = i; while (a - 1 >= 0 && esComentario(a - 1)) a -= 1; return [a, i - 1]; };
  let rango = [suyas[0], suyas[0]];
  if (c.comentario === 'cabecera') rango = bloqueSobre(abre[0]);
  else if (c.comentario === 'encima') {
    let pie = suyas[0];
    if (c.encimaDe) {
      const hermano = deCampo(c.encimaDe);
      if (hermano.length !== 1) return { existe: false, motivo: `el campo ${c.encimaDe} aparece ${hermano.length} veces en el modelo ${modelo} (tiene que ser 1)` };
      pie = hermano[0];
    }
    rango = bloqueSobre(pie);
  } else if (c.comentario !== 'cola') return { existe: false, motivo: `la tabla no dice dónde está el comentario de ${c.campo} (cola, encima o cabecera)` };
  return { existe: true, motivo: null, campoEn: suyas[0] + 1, desde: rango[0] + 1, hasta: rango[1] + 1 };
}

/** Los campos del esquema que por su nombre son un estado (`esEstado`). Es la población que la tabla NO agota. */
function camposDeEstado(lineas) {
  const fuera = [];
  let modelo = null;
  for (const l of lineas) {
    const m = /^model\s+(\w+)\s*\{/.exec(l);
    if (m) { modelo = m[1]; continue; }
    if (/^\}/.test(l)) { modelo = null; continue; }
    const c = modelo && /^\s+(\w+)\s+\w/.exec(l);
    if (c && esEstado(`${modelo}.${c[1]}`)) fuera.push(`${modelo}.${c[1]}`);
  }
  return fuera;
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
function defectoDelEsquema(lineas, sitio) {
  if (!sitio.existe) return null;
  const m = /@default\("([^"]*)"\)/.exec((lineas[sitio.campoEn - 1] ?? '').split('//')[0]);
  return m ? m[1] : null;
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
  return { porValor, delNombre, juntas, juntasTexto: juntas.map((n) => lineasMaster[n - 1]) };
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
  // SCRUM-1500b · un comentario que NO enumera no está atrasado: no hay lista que comparar. Que
  // deje de enumerar sin que la tabla lo diga lo caza `juzgar` (sinLista), no este cajón.
  if (C && C.size === 0) return { veredicto: 'COINCIDE_CON_EL_MASTER', porque: 'código y máster dicen lo mismo; el comentario no enumera valores' };
  if (!C || !igual(C, D)) return { veredicto: 'COMENTARIO_ATRASADO', porque: 'código y máster coinciden; el comentario no' };
  return { veredicto: 'COINCIDE_CON_EL_MASTER', porque: 'comentario, código y máster dicen lo mismo' };
}

/** Lo que habría dicho el censo viejo: comentario contra código, y nada más. */
function censoViejo(C, D) {
  if (!C || !D || D.size === 0) return 'sin dato';
  return igual(C, D) ? 'coincide' : 'diverge';
}

// El barrido de `src/` es lo caro (un parseo por fichero) y no depende ni del máster ni del esquema:
// se hace una vez por raíz y por lista de columnas, para que el test pueda repetir el cotejo con un
// máster cambiado en memoria sin volver a leer el árbol.
const BARRIDOS = new Map();

/**
 * `textoMaster` y `textoEsquema` (SCRUM-1500b) sustituyen EN MEMORIA a los dos ficheros: es como el
 * test mueve una línea del máster, o desplaza el esquema entero, sin escribir nada en disco.
 */
function cotejar({ raiz = RAIZ_POR_DEFECTO, master = null, textoMaster = null, textoEsquema = null, campos = CAMPOS, controles = CONTROLES } = {}) {
  const ts = cargarTs(raiz);
  if (!ts) return { ciego: 'no encuentro el módulo typescript' };
  const lineasEsquema = (textoEsquema ?? fs.readFileSync(path.join(raiz, 'prisma', 'schema.prisma'), 'utf8')).split(/\r?\n/);
  const rutaMaster = master ? path.resolve(master) : path.join(raiz, 'docs', 'YAQU_MASTER.md');
  const lineasMaster = (textoMaster ?? fs.readFileSync(rutaMaster, 'utf8')).split(/\r?\n/);
  const todos = [...campos, ...controles];
  const clave = `${raiz}\n${todos.map((c) => c.escribe.join('.')).join('\n')}`;
  if (!BARRIDOS.has(clave)) BARRIDOS.set(clave, censarEscrituras(ts, raiz, todos.map((c) => c.escribe)));
  const { salida: escrituras, ficheros, sinParsear } = BARRIDOS.get(clave);
  const cache = new Map();
  const enLaTabla = new Set(campos.map((c) => c.campo));
  const filas = todos.map((c) => {
    const sitio = localizar(lineasEsquema, c);
    const { existe } = sitio;
    const defecto = defectoDelEsquema(lineasEsquema, sitio);
    const comentario = existe ? valoresDelComentario(lineasEsquema, sitio) : null;
    const C = comentario ? comentario.valores : null;
    const cierre = valoresDelCierre(ts, raiz, c.cierre, cache);
    const esc = escrituras.get(c.escribe.join('.'));
    const D = new Set([...cierre.valores, ...esc.valores, ...(defecto ? [defecto] : [])]);
    const m = c.master ? valoresDelMaster(lineasMaster, c.master) : { valores: null, motivo: null, linea: null };
    const v = veredicto({ existe, C, D, M: m.valores, masterDeclarado: !!c.master, masterMotivo: m.motivo, campo: c.campo, cierreRoto: c.cierre && cierre.valores.size === 0 ? cierre.de : null });
    const rastro = !c.master && existe ? rastroEnElMaster(lineasMaster, c.campo, D) : null;
    return {
      linea: comentario ? comentario.linea : 0, campoEn: existe ? sitio.campoEn : 0, noExistePorque: sitio.motivo,
      id: c.campo, sinLista: !!c.sinLista,
      campo: c.etiqueta || c.campo, control: c.control || null,
      C: C ? ordenado(C) : null, D: ordenado(D), M: m.valores ? ordenado(m.valores) : null, lineaMaster: m.linea,
      cierre: ordenado(cierre.valores), cierreDe: cierre.de, escritos: ordenado(esc.valores), sitios: esc.sitios,
      noLiterales: esc.noLiterales, defecto,
      declaradoSinEscribir: c.cierre ? menos(cierre.valores, new Set([...esc.valores, ...(defecto ? [defecto] : [])])) : [],
      escritoFueraDelCierre: c.cierre && cierre.valores.size > 0 ? menos(new Set([...esc.valores, ...(defecto ? [defecto] : [])]), cierre.valores) : [],
      viejo: censoViejo(C, D), ...v, rastro,
    };
  });
  return {
    poblacion: {
      campos: campos.length, controles: controles.length, ficheros, sinParsear, lineasEsquema: lineasEsquema.length, lineasMaster: lineasMaster.length, master: rutaMaster,
      estadosFueraDeLaTabla: camposDeEstado(lineasEsquema).filter((c) => !enLaTabla.has(c)),
    },
    filas,
  };
}

// ───────────────────────── SCRUM-1500b · EL JUICIO: qué pone el CI en rojo ─────────────────────────
//
// Decisión del orquestador de Javier en Jira, SCRUM-1500 c.18831 (8-oct-2026): el instrumento corre
// sobre el árbol en la tanda normal, como un fichero de test. Lo que se vigila es que la pregunta
// siga siendo «¿dice el CÓDIGO lo mismo que el MÁSTER?».
//
// SE PARA (sale nombrado) todo campo cuyo veredicto esté aquí. NO se nombran COINCIDE_CON_EL_MASTER
// ni EL_MASTER_NO_LO_FIJA; este último se IMPRIME como «sin cotejar», porque no es un verde.
const SE_PARA = new Set(['NO_EXISTE', 'CIEGO', 'CODIGO_FUERA_DEL_MASTER', 'MASTER_SIN_ESCRIBIR', 'COMENTARIO_ATRASADO', 'ESTADO_SIN_MAQUINA_EN_EL_MASTER']);

// 🔴 LOS TRES PARADOS. Esperan una decisión del fundador (regla 27) y tienen que poder esperarla sin
// poner el CI en rojo. NO son un «ignora este campo»: cada entrada congela EXACTAMENTE lo que se le
// llevó al fundador (el veredicto, los valores del código y los del máster). Si el código gana o
// pierde un valor, si el máster cambia su lista, o si el campo deja de estar parado, la entrada ya
// no describe lo que hay y el guard cae nombrándola. Una entrada lleva:
//   motivo   por qué espera            retira   quién la quita, y cuándo
//   consta   dónde está escrito        desde    el día en que se paró (se imprime su edad; NO caduca
//                                               sola: ponerle plazo al fundador no es de este fichero)
//   leidas   un trozo literal de cada línea del máster que junta todos los valores y que YA se leyó
//            y no es su lista. Una línea nueva que los junte no está leída: cae.
// «Sigue montada» se comprueba en cada pasada y por AST: los valores de `D` tienen que salir de un
// cierre encontrado en `src/` o de una escritura de Prisma, no sólo del @default del esquema.
const PARADOS = [
  {
    campo: 'QuoteRequest.status',
    veredicto: 'CODIGO_FUERA_DEL_MASTER',
    D: [
      'done',
      'pending',
      'read',
    ],
    M: [
      'converted',
      'discarded',
      'new',
      'seen',
    ],
    leidas: [],
    motivo: 'el código escribe pending/read/done y la Parte L del máster dice new → seen → converted | discarded: ningún valor en común. Es cambio de máster o cambio de código (regla 27), y no lo decide una sesión',
    retira: 'el fundador decide; quien aplique su decisión (máster o código) borra esta entrada en ese mismo PR',
    consta: 'Jira SCRUM-1500, comentarios 18796 y 18831; docs/master/SCRUM-1500.md, sección Ⓒ',
    desde: '2026-10-07',
  },
  {
    campo: 'ParteTrabajo.estado',
    veredicto: 'ESTADO_SIN_MAQUINA_EN_EL_MASTER',
    D: [
      'borrador',
      'facturado',
      'firmado',
    ],
    M: null,
    leidas: [
      'Estado de COBRO del albarán — VOCABULARIO DERIVADO',
      'SCRUM-170 (FACT-2c) · facturación PARCIAL por cantidad servida',
    ],
    motivo: 'es un estado y el máster no nombra la entidad: o la Parte L gana su máquina, o se dice que no es una máquina de la Parte L (regla 27). Las dos líneas del máster que juntan sus tres valores hablan del albarán',
    retira: 'el fundador decide; quien escriba la máquina en el máster (o la declaración de que no lo es) borra esta entrada y le pone ancla al campo en CAMPOS, en ese mismo PR',
    consta: 'Jira SCRUM-1500, comentarios 18796 y 18831; docs/master/SCRUM-1500.md, sección Ⓒ',
    desde: '2026-10-07',
  },
  {
    campo: 'TeamMember.status',
    veredicto: 'ESTADO_SIN_MAQUINA_EN_EL_MASTER',
    D: [
      'active',
      'invited',
      'suspended',
    ],
    M: null,
    leidas: [],
    motivo: 'es un estado y la Parte L no trae máquina para TeamMember: sus tres valores sólo salen en prosa. O la Parte L gana la máquina, o se dice que no lo es (regla 27)',
    retira: 'el fundador decide; quien escriba la máquina en el máster (o la declaración de que no lo es) borra esta entrada y le pone ancla al campo en CAMPOS, en ese mismo PR',
    consta: 'Jira SCRUM-1500, comentarios 18796 y 18831; docs/master/SCRUM-1500.md, sección Ⓒ',
    desde: '2026-10-07',
  },
];

const mismos = (a, b) => (a === null || b === null ? a === b : a.length === b.length && a.every((x, i) => x === b[i]));

/**
 * El juicio sobre una pasada. Devuelve `hallazgos` (lo que pone el CI en rojo, cada uno con su campo)
 * y tres listas que se IMPRIMEN siempre: lo que coincide, lo que no se pudo cotejar y lo que espera.
 */
function juzgar(r, parados = PARADOS, hoy = new Date()) {
  const hallazgos = [];
  const di = (campo, clase, texto) => hallazgos.push({ campo, clase, texto });
  if (r.ciego) return { fiable: false, hallazgos: [{ campo: '(instrumento)', clase: 'INSTRUMENTO_CIEGO', texto: r.ciego }], coinciden: [], sinCotejar: [], esperan: [] };
  const p = r.poblacion;
  if (!(p.ficheros > 0)) di('(instrumento)', 'INSTRUMENTO_CIEGO', 'no leí ningún fichero .ts bajo src/');
  if (p.sinParsear > 0) di('(instrumento)', 'INSTRUMENTO_CIEGO', `${p.sinParsear} fichero(s) de src/ sin parsear`);
  if (!(p.campos > 0)) di('(instrumento)', 'INSTRUMENTO_CIEGO', 'la tabla de campos está vacía');
  for (const f of r.filas.filter((x) => x.control)) {
    if (f.veredicto !== f.control) di(f.campo, 'CONTROL_ROTO', `el control tenía que salir ${f.control} y sale ${f.veredicto}: el instrumento ya no distingue lo que no pudo mirar`);
  }
  for (const e of parados) {
    for (const k of ['motivo', 'retira', 'consta', 'desde']) if (!e[k] || !String(e[k]).trim()) di(e.campo, 'EXCEPCION_SIN_PAPELES', `a la excepción le falta «${k}»: sin eso no es una excepción, es una promesa`);
  }
  const reales = r.filas.filter((x) => !x.control);
  const coinciden = [];
  const sinCotejar = [];
  const esperan = [];
  const usadas = new Set();
  for (const f of reales) {
    const e = parados.find((x) => x.campo === f.id) || null;
    if (f.veredicto !== 'NO_EXISTE' && (f.C || []).length > 0 === f.sinLista) {
      di(f.campo, 'COMENTARIO_CAMBIO_DE_FORMA', f.sinLista
        ? 'la tabla dice que su comentario no enumera (sinLista) y enumera: quita `sinLista` de su entrada en CAMPOS'
        : 'su comentario ya no enumera valores, o no lo encuentro donde la tabla dice. Si se firmó quitarle la lista, dilo en su entrada de CAMPOS con `sinLista: true`');
    }
    if (!SE_PARA.has(f.veredicto)) {
      if (e) { usadas.add(e); di(f.campo, 'EXCEPCION_SOBRANTE', `tiene una excepción de «parado» y hoy sale ${f.veredicto}: ya no espera nada. Bórrala de PARADOS`); }
      if (f.veredicto === 'EL_MASTER_NO_LO_FIJA') {
        if (f.rastro && f.rastro.juntas.length > 0) di(f.campo, 'POSIBLE_LISTA_EN_EL_MASTER', `la tabla dice que el máster no lo fija, y la(s) línea(s) ${f.rastro.juntas.join(', ')} del máster juntan TODOS sus valores. Léela(s): si es su lista, ponle ancla en CAMPOS`);
        else sinCotejar.push(f.campo);
      } else coinciden.push(f.campo);
      continue;
    }
    if (!e) { di(f.campo, f.veredicto, f.noExistePorque || f.porque); continue; }
    usadas.add(e);
    const antes = hallazgos.length;
    const rota = (texto) => di(f.campo, 'EXCEPCION_QUE_YA_NO_DESCRIBE', `${texto}. Lo que espera al fundador es lo que se le llevó, no esto: vuelve a preguntar (PARADOS no se ensancha a mano)`);
    if (f.veredicto !== e.veredicto) rota(`se paró como ${e.veredicto} y hoy sale ${f.veredicto} (${f.porque})`);
    if (!mismos(f.D, e.D)) rota(`el código tenía ${e.D.join(' | ')} y hoy tiene ${f.D.join(' | ') || '(nada)'}`);
    if (!mismos(f.M, e.M)) rota(`el máster decía ${e.M ? e.M.join(' | ') : '(sin lista)'} y hoy dice ${f.M ? f.M.join(' | ') : '(sin lista)'}`);
    if (f.cierre.length === 0 && f.sitios.length === 0) rota('ya no encuentro en src/ ni el cierre ni una escritura de esos valores: sólo queda el @default');
    const sinLeer = f.rastro ? f.rastro.juntas.filter((n, i) => !e.leidas.some((t) => f.rastro.juntasTexto[i].includes(t))) : [];
    if (sinLeer.length > 0) rota(`la(s) línea(s) ${sinLeer.join(', ')} del máster juntan todos sus valores y no están entre las ya leídas: puede ser su máquina`);
    if (hallazgos.length === antes) {
      const dias = Math.floor((hoy.getTime() - new Date(`${e.desde}T00:00:00Z`).getTime()) / 86400000);
      esperan.push({ campo: f.campo, veredicto: f.veredicto, desde: e.desde, dias, montadaEn: [f.cierreDe, ...f.sitios].filter(Boolean), retira: e.retira });
    }
  }
  for (const e of parados) if (!usadas.has(e)) di(e.campo, 'EXCEPCION_HUERFANA', 'está en PARADOS y no es ningún campo de la tabla: no sujeta nada. Bórrala');
  return { fiable: !hallazgos.some((h) => h.clase === 'INSTRUMENTO_CIEGO' || h.clase === 'CONTROL_ROTO'), hallazgos, coinciden, sinCotejar, esperan };
}

/** Lo que el juicio dice siempre, caiga o no: su población, lo que no miró y lo que espera. */
function pintaJuicio(r, j) {
  const out = [];
  if (r.ciego) return `JUICIO: CIEGO — ${r.ciego}`;
  const p = r.poblacion;
  out.push(`JUICIO sobre ${p.campos} comentarios (${p.controles} controles aparte) · ${p.ficheros} ficheros .ts bajo src/, ${p.sinParsear} sin parsear:`);
  out.push(`  ${String(j.coinciden.length).padStart(2)}  coinciden con el máster`);
  out.push(`  ${String(j.sinCotejar.length).padStart(2)}  SIN COTEJAR, el máster no trae su lista (no es un verde): ${j.sinCotejar.join(', ') || '—'}`);
  out.push(`  ${String(j.esperan.length).padStart(2)}  PARADOS, esperan al fundador con su excepción: ${j.esperan.map((e) => `${e.campo} (${e.veredicto}, desde ${e.desde}: ${e.dias} días)`).join(' · ') || '—'}`);
  for (const e of j.esperan) out.push(`        ${e.campo} sigue montado en: ${e.montadaEn.join(' · ')}`);
  out.push(`  ${String(j.hallazgos.length).padStart(2)}  HALLAZGOS${j.hallazgos.length ? ':' : ''}`);
  for (const h of j.hallazgos) out.push(`        🔴 ${h.campo} · ${h.clase} · ${h.texto}`);
  out.push(`  FUERA DE LA TABLA, sin mirar: ${p.estadosFueraDeLaTabla.length} campo(s) del esquema con nombre de estado que este instrumento NO coteja${p.estadosFueraDeLaTabla.length ? ` (${p.estadosFueraDeLaTabla.join(', ')})` : ''}`);
  return out.join('\n');
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
  // SCRUM-1500b · el juicio va detrás, y la salida tiene tres valores: 0 nada que nombrar, 1 hay
  // hallazgos, 2 el instrumento no es fiable (y entonces sus hallazgos no se creen).
  const j = juzgar(r);
  out.push('');
  out.push(pintaJuicio(r, j));
  const salida = !ok || !j.fiable ? 2 : (j.hallazgos.length > 0 ? 1 : 0);
  out.push(salida === 2 ? 'INSTRUMENTO NO FIABLE\nEXIT=2' : `EXIT=${salida}`);
  return { texto: out.join('\n'), ok, salida, juicio: j };
}

module.exports = { CAMPOS, CONTROLES, PARADOS, SE_PARA, cotejar, juzgar, pintaJuicio, veredicto, censoViejo, valoresDeLista, valoresDelComentario, valoresDelMaster, localizar, camposDeEstado, esEstado, pinta };

if (require.main === module) {
  const i = process.argv.indexOf('--master');
  const r = cotejar({ master: i > 0 ? process.argv[i + 1] : null });
  if (r.ciego) { console.log(`CIEGO: ${r.ciego}\nEXIT=2`); process.exit(2); }
  const { texto, salida } = pinta(r);
  console.log(texto);
  process.exit(salida);
}
