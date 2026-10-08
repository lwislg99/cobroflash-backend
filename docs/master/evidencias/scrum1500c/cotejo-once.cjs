// docs/master/evidencias/scrum1500c/cotejo-once.cjs — SCRUM-1500c
//
// LOS CAMPOS DE ESTADO QUE EL COTEJO DE SCRUM-1500 NOMBRA Y NO COTEJA, cotejados contra el máster.
//
//     node docs/master/evidencias/scrum1500c/cotejo-once.cjs
//
// La POBLACIÓN no se escribe aquí: es `estadosFueraDeLaTabla` del instrumento de SCRUM-1500
// (`../scrum1500/cotejo.cjs`). Si esa lista y la tabla ONCE de abajo no son la misma, sale CIEGO.
// El VEREDICTO tampoco es mío: es la función `veredicto` de ese instrumento, sin tocar.
//
// Lo que este fichero añade es cómo se saca D (lo que decide el DESTINO) cuando el valor no se
// escribe con un literal dentro de la llamada de Prisma, que es el caso de casi todos estos campos:
//   prisma     literales en `<delegado>.<campo>` de una escritura de Prisma, con su CAMINO dentro del
//              argumento. Sólo cuenta el camino directo (data.x, create.x, update.x); un camino más
//              hondo es una escritura ANIDADA de otra tabla: se imprime aparte y no se suma.
//   const      una constante que es una lista            consts   constantes sueltas con un literal
//   claves     las claves de un objeto literal           includes `[..].includes(<arg>)` en un fichero
//   enum       un `enum` del esquema de Prisma
//   llamada    el literal de la propiedad P en el argumento N de toda llamada a la función F
//   argumento  el literal que va de argumento N en toda llamada a la función F
//   fabrica    el literal de la propiedad P dentro del cuerpo de la función F de un fichero
// Una fuente DECLARADA que no encuentra nada deja el campo CIEGO: no se suple con el @default.
//
// M sale de UNA línea del máster, por un ancla que tiene que casar exactamente una vez. En modo
// 'flechas' son todos los tramos entre comillas invertidas de esa línea que llevan una flecha.
//
// QUÉ NO VE: SQL crudo (se cuenta aparte, abajo), un objeto que llega por derrame (`...datos`) y no
// está declarado como fábrica, y las TRANSICIONES: se comparan conjuntos de valores.
const fs = require('node:fs');
const path = require('node:path');
const base = require('../scrum1500/cotejo.cjs');

const RAIZ = path.resolve(__dirname, '..', '..', '..', '..');
const ts = require(require.resolve('typescript', { paths: [RAIZ, process.cwd()] }));

const ONCE = [
  { campo: 'Merchant.subscriptionStatus',
    fuentes: [{ tipo: 'prisma', delegado: 'merchant' }],
    master: { ancla: /^\*\*Subscription \(merchant\.plan\):\*\*/, modo: 'flechas' } },
  { campo: 'Merchant.status',
    fuentes: [{ tipo: 'prisma', delegado: 'merchant' }],
    master: null },
  { campo: 'Charge.status',
    fuentes: [
      { tipo: 'prisma', delegado: 'charge' },
      { tipo: 'fabrica', fichero: 'src/modules/billing/domain/instanteDeCobro.ts', funcion: 'datosDeCobroPagado', propiedad: 'status' },
    ],
    master: { ancla: /^\*\*Charge:\*\*/, modo: 'flechas' } },
  { campo: 'Quote.status',
    fuentes: [
      { tipo: 'prisma', delegado: 'quote' },
      { tipo: 'fabrica', fichero: 'src/modules/quotes/domain/revision.ts', funcion: 'nuevaRevisionDe', propiedad: 'status' },
    ],
    master: { ancla: /^\*\*Quote:\*\*/, modo: 'flechas', etiquetados: [{ re: /`(expired)` `F2`/, etiqueta: 'F2' }] } },
  { campo: 'Invoice.status',
    fuentes: [
      { tipo: 'prisma', delegado: 'invoice' },
      { tipo: 'includes', fichero: 'src/modules/system/app/routes/invoicesAdmin.routes.ts', argumento: 'status' },
      { tipo: 'argumento', funcion: 'updateInvoiceStatusAdmin', n: 1, puedeNoTraerLiteral: true },
    ],
    master: { ancla: /^\*\*Invoice:\*\*/, modo: 'flechas' } },
  { campo: 'Invoice.vfEstado',
    fuentes: [
      { tipo: 'prisma', delegado: 'invoice' },
      { tipo: 'consts', fichero: 'src/modules/invoicing/domain/selladoEstado.ts', nombres: ['SELLADO_PENDIENTE', 'SELLADO_HECHO', 'SELLADO_NO_APLICA'] },
    ],
    master: { ancla: /^\*\*Invoice\.vfEstado /, modo: 'flechas' } },
  { campo: 'BotSession.state',
    fuentes: [
      { tipo: 'prisma', delegado: 'botSession' },
      { tipo: 'llamada', funcion: 'setSession', n: 1, propiedad: 'state' },
    ],
    master: { ancla: /`BotSession \{phone, merchantId\?, state: /, lista: /state: ([^,]+),/ } },
  { campo: 'WhatsAppMessage.status',
    fuentes: [
      { tipo: 'prisma', delegado: 'whatsAppMessage' },
      { tipo: 'llamada', funcion: 'recordWaMessage', n: 0, propiedad: 'status' },
      { tipo: 'claves', fichero: 'src/modules/messaging/domain/whatsappLog.service.ts', nombre: 'STATUS_RANK' },
    ],
    master: { ancla: /^\*\*WhatsAppMessage:\*\*/, modo: 'flechas' },
    masterOtro: { ancla: /^Tabla `WhatsAppMessage \{/, modo: 'flechas', nombre: 'J4' } },
  { campo: 'Job.status',
    fuentes: [
      { tipo: 'prisma', delegado: 'job' },
      { tipo: 'const', fichero: 'src/modules/jobs/domain/job.service.ts', nombre: 'JOB_STATES' },
    ],
    master: { ancla: /^\*\*Job `F2 \(Parte R/, modo: 'flechas' } },
  { campo: 'EmailMessage.status',
    fuentes: [
      { tipo: 'prisma', delegado: 'emailMessage', puedeNoTraerLiteral: true },
      { tipo: 'const', fichero: 'src/modules/messaging/domain/constanciaCorreo.ts', nombre: 'ESTADOS_CORREO' },
    ],
    master: null },
  { campo: 'VfSubmission.status',
    fuentes: [
      { tipo: 'prisma', delegado: 'vfSubmission' },
      { tipo: 'const', fichero: 'src/modules/fiscal/verifactu/sif.cola.ts', nombre: 'ESTADOS_VF_SUBMISSION' },
      { tipo: 'enum', nombre: 'VfSubmissionStatus' },
    ],
    master: null },
];

// CONTROLES. Viajan en cada pasada. Los de CERO no pueden salir «coincide»; el POSITIVO tiene que.
const CONTROLES = [
  { campo: 'Merchant.estadoQueNoExiste', control: 'NO_EXISTE',
    fuentes: [{ tipo: 'prisma', delegado: 'merchant' }], master: null },
  { campo: 'Job.status', etiqueta: 'Job.status con una función inventada', control: 'CIEGO',
    fuentes: [{ tipo: 'llamada', funcion: 'funcionQueNoExiste', n: 0, propiedad: 'status' }],
    master: { ancla: /^\*\*Job `F2 \(Parte R/, modo: 'flechas' } },
  { campo: 'Job.status', etiqueta: 'Job.status con un ancla inventada', control: 'CIEGO',
    fuentes: [{ tipo: 'const', fichero: 'src/modules/jobs/domain/job.service.ts', nombre: 'JOB_STATES' }],
    master: { ancla: /^\*\*EntidadQueElMasterNoTiene:\*\*/, modo: 'flechas' } },
  // POSITIVO: un campo que el instrumento de SCRUM-1500 ya da por COINCIDE, sacado con MIS fuentes y
  // MI lectura del máster. Si esto no sale COINCIDE, lo roto es este fichero.
  { campo: 'Albaran.estado', etiqueta: 'Albaran.estado (positivo)', control: 'COINCIDE_CON_EL_MASTER',
    fuentes: [
      { tipo: 'prisma', delegado: 'albaran' },
      { tipo: 'const', fichero: 'src/modules/jobs/domain/albaran.service.ts', nombre: 'ALBARAN_ESTADOS' },
    ],
    master: { ancla: /^\*\*Albaran \(NO fiscal\)/, modo: 'flechas' } },
  // POSITIVO del cajón que PARA: el caso que abrió SCRUM-1500 tiene que salir fuera del máster.
  { campo: 'QuoteRequest.status', etiqueta: 'QuoteRequest.status (positivo del tercer cajón)', control: 'CODIGO_FUERA_DEL_MASTER',
    fuentes: [
      { tipo: 'prisma', delegado: 'quoteRequest' },
      { tipo: 'includes', fichero: 'src/modules/quoteRequests/app/routes/quoteRequests.routes.ts', argumento: 'status' },
    ],
    master: { ancla: /^\*\*QuoteRequest:\*\*/, modo: 'flechas' } },
];

const ESCRIBE = new Set(['create', 'update', 'upsert', 'createMany', 'updateMany', 'createManyAndReturn']);
const NO_ES_DATO = new Set(['where', 'select', 'include', 'orderBy', 'omit']);
const rel = (f) => path.relative(RAIZ, f).replace(/\\/g, '/');
const linea = (sf, n) => sf.getLineAndCharacterOfPosition(n.getStart()).line + 1;

function ficherosTs(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) ficherosTs(p, out);
    else if (e.name.endsWith('.ts') && !e.name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

function declaracion(sf, nombre, antesDe = Infinity) {
  let mejor = null;
  (function ver(n) {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === nombre && n.initializer && n.getStart() < antesDe) {
      if (!mejor || n.getStart() > mejor.getStart()) mejor = n;
    }
    ts.forEachChild(n, ver);
  })(sf);
  return mejor ? mejor.initializer : null;
}

/** Las hojas literales de una expresión (el mismo criterio que `hojas` del instrumento de SCRUM-1500). */
function hojas(sf, expr) {
  const fuera = [];
  (function baja(e, h) {
    if (!e) return;
    if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) { fuera.push({ valor: e.text }); return; }
    if (ts.isParenthesizedExpression(e) || ts.isAsExpression(e) || ts.isNonNullExpression(e) || (ts.isSatisfiesExpression && ts.isSatisfiesExpression(e))) { baja(e.expression, h); return; }
    if (ts.isConditionalExpression(e)) { baja(e.whenTrue, h); baja(e.whenFalse, h); return; }
    if (ts.isBinaryExpression(e) && [ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.BarBarToken].includes(e.operatorToken.kind)) { baja(e.left, h); baja(e.right, h); return; }
    if (ts.isIdentifier(e) && h < 3) {
      const d = declaracion(sf, e.text, e.getStart());
      if (d) { baja(d, h + 1); return; }
    }
    fuera.push({ noLiteral: e.getText().replace(/\s+/g, ' ').slice(0, 70) });
  })(expr, 0);
  return fuera;
}

const desnuda = (e) => { let x = e; while (x && (ts.isAsExpression(x) || ts.isParenthesizedExpression(x))) x = x.expression; return x; };

// ── UNA pasada por src/: escrituras de Prisma con su camino, y llamadas por nombre de función ──
function barrer(fuentesTodas) {
  const lista = ficherosTs(path.join(RAIZ, 'src'));
  const arboles = new Map();
  let sinParsear = 0;
  for (const f of lista) {
    try { arboles.set(rel(f), ts.createSourceFile(f, fs.readFileSync(f, 'utf8'), ts.ScriptTarget.Latest, true)); } catch { sinParsear += 1; }
  }
  const prisma = new Map();   // «delegado.campo» → [{ camino, sitio, valor | noLiteral }]
  const llamadas = new Map(); // función → [{ sf, nodo, sitio }]
  const funciones = new Set(fuentesTodas.filter((x) => x.funcion && x.tipo !== 'fabrica').map((x) => x.funcion));
  let escriturasVistas = 0;
  for (const [r, sf] of arboles) {
    (function ver(n) {
      if (ts.isCallExpression(n)) {
        const callee = n.expression;
        const nombre = ts.isIdentifier(callee) ? callee.text : (ts.isPropertyAccessExpression(callee) ? callee.name.text : null);
        if (nombre && funciones.has(nombre)) {
          if (!llamadas.has(nombre)) llamadas.set(nombre, []);
          llamadas.get(nombre).push({ sf, nodo: n, sitio: `${r}:${linea(sf, n)}` });
        }
        if (ts.isPropertyAccessExpression(callee) && ESCRIBE.has(callee.name.text) && ts.isPropertyAccessExpression(callee.expression)) {
          const delegado = callee.expression.name.text;
          escriturasVistas += 1;
          (function dentro(m, camino) {
            if ((ts.isPropertyAssignment(m) || ts.isShorthandPropertyAssignment(m)) && m.name && ts.isIdentifier(m.name)) {
              const k = m.name.text;
              if (NO_ES_DATO.has(k)) return;
              const aqui = [...camino, k];
              const expr = ts.isPropertyAssignment(m) ? m.initializer : m.name;
              const clave = `${delegado}.${k}`;
              const hs = hojas(sf, expr);
              const esHoja = hs.some((h) => h.valor !== undefined) || !ts.isPropertyAssignment(m) || !ts.isObjectLiteralExpression(desnuda(m.initializer));
              if (esHoja) {
                if (!prisma.has(clave)) prisma.set(clave, []);
                for (const h of hs) prisma.get(clave).push({ camino: aqui.join('.'), sitio: `${r}:${linea(sf, m)}`, ...h });
              }
              if (ts.isPropertyAssignment(m)) ts.forEachChild(m.initializer, (x) => dentro(x, aqui));
              return;
            }
            ts.forEachChild(m, (x) => dentro(x, camino));
          })(n.arguments[0] ?? n, []);
        }
      }
      ts.forEachChild(n, ver);
    })(sf);
  }
  return { arboles, prisma, llamadas, ficheros: lista.length, sinParsear, escriturasVistas };
}

const DIRECTO = /^(data|create|update)\.[A-Za-z_]\w*$/;

/** Los valores de UNA fuente declarada. `ciego` si la fuente no encontró nada donde tenía que haber algo. */
function leerFuente(f, campo, B, lineasEsquema) {
  const nombreCampo = campo.split('.')[1];
  const v = new Set(); const sitios = []; const noLit = []; const anidadas = [];
  let de = ''; let ciego = null;
  const sfDe = (fichero) => B.arboles.get(fichero) || null;
  if (f.tipo === 'prisma') {
    de = `escrituras de Prisma en ${f.delegado}.${nombreCampo}`;
    for (const e of B.prisma.get(`${f.delegado}.${nombreCampo}`) || []) {
      if (!DIRECTO.test(e.camino)) { anidadas.push(`${e.sitio} ${e.camino} ${e.valor !== undefined ? `'${e.valor}'` : e.noLiteral}`); continue; }
      if (e.valor !== undefined) { v.add(e.valor); sitios.push(`${e.sitio} '${e.valor}'`); } else noLit.push(`${e.sitio} ${e.noLiteral}`);
    }
    // Una fuente de Prisma sin un solo literal no ciega por sí sola: puede que TODO llegue por otra
    // fuente (el caso de EmailMessage). Ciega el campo si es la única fuente que hay.
  } else if (f.tipo === 'const' || f.tipo === 'claves' || f.tipo === 'consts' || f.tipo === 'includes' || f.tipo === 'fabrica') {
    const sf = sfDe(f.fichero);
    de = `${f.tipo} ${f.nombre || (f.nombres || []).join('+') || f.funcion || `includes(${f.argumento})`} en ${f.fichero}`;
    if (!sf) ciego = `no pude leer ${f.fichero}`;
    else if (f.tipo === 'const' || f.tipo === 'claves') {
      const ini = desnuda(declaracion(sf, f.nombre));
      if (f.tipo === 'const' && ini && ts.isArrayLiteralExpression(ini)) for (const el of ini.elements) for (const h of hojas(sf, el)) if (h.valor !== undefined) v.add(h.valor);
      if (f.tipo === 'claves' && ini && ts.isObjectLiteralExpression(ini)) for (const p of ini.properties) if (p.name && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name))) v.add(p.name.text);
      if (v.size === 0) ciego = `no encuentro ${f.nombre} con la forma esperada en ${f.fichero}`;
    } else if (f.tipo === 'consts') {
      for (const nombre of f.nombres) {
        const ini = desnuda(declaracion(sf, nombre));
        if (ini && ts.isStringLiteral(ini)) v.add(ini.text); else ciego = `no encuentro la constante ${nombre} en ${f.fichero}`;
      }
    } else if (f.tipo === 'includes') {
      (function ver(n) {
        if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === 'includes'
          && n.arguments[0] && ts.isIdentifier(n.arguments[0]) && n.arguments[0].text === f.argumento) {
          const arr = desnuda(n.expression.expression);
          if (arr && ts.isArrayLiteralExpression(arr)) { for (const el of arr.elements) for (const h of hojas(sf, el)) if (h.valor !== undefined) v.add(h.valor); sitios.push(`${f.fichero}:${linea(sf, n)}`); }
        }
        ts.forEachChild(n, ver);
      })(sf);
      if (sitios.length !== 1) ciego = `\`[..].includes(${f.argumento})\` aparece ${sitios.length} veces en ${f.fichero} (tiene que ser 1)`;
    } else if (f.tipo === 'fabrica') {
      let cuerpo = null;
      (function ver(n) { if (ts.isFunctionDeclaration(n) && n.name && n.name.text === f.funcion) cuerpo = n; ts.forEachChild(n, ver); })(sf);
      if (!cuerpo) ciego = `no encuentro la función ${f.funcion} en ${f.fichero}`;
      else {
        (function ver(n) {
          if (ts.isPropertyAssignment(n) && ts.isIdentifier(n.name) && n.name.text === f.propiedad) {
            for (const h of hojas(sf, n.initializer)) { if (h.valor !== undefined) { v.add(h.valor); sitios.push(`${f.fichero}:${linea(sf, n)} '${h.valor}'`); } else noLit.push(`${f.fichero}:${linea(sf, n)} ${h.noLiteral}`); }
          }
          ts.forEachChild(n, ver);
        })(cuerpo);
        if (v.size === 0) ciego = `${f.funcion} no pone ningún literal en «${f.propiedad}»`;
      }
    }
  } else if (f.tipo === 'llamada' || f.tipo === 'argumento') {
    const cs = B.llamadas.get(f.funcion) || [];
    de = `${f.tipo === 'llamada' ? `propiedad «${f.propiedad}» del argumento ${f.n}` : `argumento ${f.n}`} de las ${cs.length} llamadas a ${f.funcion}()`;
    let sinPropiedad = 0;
    for (const c of cs) {
      let expr = c.nodo.arguments[f.n];
      if (!expr) continue;
      if (f.tipo === 'llamada') {
        const obj = desnuda(expr);
        if (!ts.isObjectLiteralExpression(obj)) { noLit.push(`${c.sitio} (el argumento no es un objeto literal) ${expr.getText().replace(/\s+/g, ' ').slice(0, 50)}`); continue; }
        const p = obj.properties.find((x) => x.name && ts.isIdentifier(x.name) && x.name.text === f.propiedad);
        if (!p) { sinPropiedad += 1; continue; }
        expr = ts.isPropertyAssignment(p) ? p.initializer : p.name;
      }
      for (const h of hojas(c.sf, expr)) { if (h.valor !== undefined) { v.add(h.valor); sitios.push(`${c.sitio} '${h.valor}'`); } else noLit.push(`${c.sitio} ${h.noLiteral}`); }
    }
    if (sinPropiedad) de += ` (${sinPropiedad} sin esa propiedad)`;
    if (cs.length === 0) ciego = `ninguna llamada a ${f.funcion}() en src/`;
    else if (v.size === 0 && !f.puedeNoTraerLiteral) ciego = `ninguna llamada a ${f.funcion}() trae un literal ahí`;
  } else if (f.tipo === 'enum') {
    de = `enum ${f.nombre} de prisma/schema.prisma`;
    const i = lineasEsquema.findIndex((l) => new RegExp(`^enum\\s+${f.nombre}\\s*\\{`).test(l));
    if (i < 0) ciego = `no encuentro el enum ${f.nombre} en el esquema`;
    else for (let k = i + 1; k < lineasEsquema.length && !/^\}/.test(lineasEsquema[k]); k += 1) { const m = /^\s+(\w+)/.exec(lineasEsquema[k]); if (m) v.add(m[1]); }
    if (!ciego && v.size === 0) ciego = `el enum ${f.nombre} salió vacío`;
  } else ciego = `tipo de fuente desconocido: ${f.tipo}`;
  return { de, valores: v, sitios, noLit, anidadas, ciego };
}

const sinParentesis = (s) => { let a = s; let b; do { b = a; a = a.replace(/\([^()]*\)/g, ' '); } while (a !== b); return a; };
const valores = (texto) => new Set(sinParentesis(texto).split(/\||→/).map((t) => t.replace(/['"`*]/g, ' ').trim()).filter((t) => /^[\p{L}_][\p{L}\p{N}_]*$/u.test(t)));

function leerMaster(lineasMaster, spec) {
  const casan = [];
  for (const [i, l] of lineasMaster.entries()) if (spec.ancla.test(l)) casan.push(i + 1);
  if (casan.length !== 1) return { valores: null, motivo: `el ancla ${spec.ancla} casa ${casan.length} veces en el máster (tiene que ser 1)`, linea: null, etiquetados: [] };
  const l = lineasMaster[casan[0] - 1];
  let v = new Set(); const tramos = [];
  if (spec.modo === 'flechas') {
    // Las comillas invertidas se EMPAREJAN: los trozos impares de partir la línea por ellas. Con una
    // expresión regular suelta casaba también el texto que queda ENTRE dos pares.
    for (const [i, t] of l.split('`').entries()) if (i % 2 === 1 && t.includes('→')) { tramos.push(t); for (const x of valores(t)) v.add(x); }
  } else {
    const m = spec.lista.exec(l);
    if (m) { tramos.push(m[1]); v = valores(m[1]); }
  }
  if (v.size === 0) return { valores: null, motivo: `la línea ${casan[0]} del máster no trae la lista con la forma esperada`, linea: casan[0], etiquetados: [] };
  const etiquetados = [];
  for (const e of spec.etiquetados || []) { const m = e.re.exec(l); if (m) etiquetados.push({ valor: m[1], etiqueta: e.etiqueta }); }
  return { valores: v, motivo: null, linea: casan[0], tramos, etiquetados };
}

/** Dónde sale una palabra entera en el máster. Es el grep que se guarda antes de decir «no está». */
function rastro(lineasMaster, palabra) {
  const re = new RegExp(`(?<![\\p{L}\\p{N}_])${palabra.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}_])`, 'u');
  const o = [];
  for (const [i, l] of lineasMaster.entries()) if (re.test(l)) o.push(i + 1);
  return o;
}

/** El comentario del campo: su cola, el bloque pegado encima y el bloque pegado encima de `model X {`. */
function comentarioDe(lineasEsquema, campo) {
  const sitio = base.localizar(lineasEsquema, { campo, comentario: 'cola' });
  if (!sitio.existe) return { sitio, texto: '' };
  const esC = (i) => /^\s*\/\//.test(lineasEsquema[i] ?? '');
  const trozos = [];
  const cola = lineasEsquema[sitio.campoEn - 1];
  if (cola.includes('//')) trozos.push(cola.slice(cola.indexOf('//')));
  for (let i = sitio.campoEn - 2; i >= 0 && esC(i); i -= 1) trozos.push(lineasEsquema[i]);
  const abre = lineasEsquema.findIndex((l) => new RegExp(`^model\\s+${campo.split('.')[0]}\\s*\\{`).test(l));
  for (let i = abre - 1; i >= 0 && esC(i); i -= 1) trozos.push(lineasEsquema[i]);
  return { sitio, texto: trozos.join('\n') };
}

function cotejarOnce({ textoMaster = null } = {}) {
  const lineasEsquema = fs.readFileSync(path.join(RAIZ, 'prisma', 'schema.prisma'), 'utf8').split(/\r?\n/);
  const lineasMaster = (textoMaster ?? fs.readFileSync(path.join(RAIZ, 'docs', 'YAQU_MASTER.md'), 'utf8')).split(/\r?\n/);
  const todos = [...ONCE, ...CONTROLES];
  const B = barrer(todos.flatMap((c) => c.fuentes));
  const filas = todos.map((c) => {
    const { sitio, texto } = comentarioDe(lineasEsquema, c.campo);
    const defecto = sitio.existe ? (/@default\("?([^")]*)"?\)/.exec(lineasEsquema[sitio.campoEn - 1].split('//')[0]) || [])[1] ?? null : null;
    const fuentes = c.fuentes.map((f) => leerFuente(f, c.campo, B, lineasEsquema));
    const D = new Set([...fuentes.flatMap((f) => [...f.valores]), ...(defecto ? [defecto] : [])]);
    const ciegas = fuentes.filter((f) => f.ciego).map((f) => f.ciego);
    if (fuentes.every((f) => f.valores.size === 0)) ciegas.push('ninguna fuente declarada dio un valor');
    const m = c.master ? leerMaster(lineasMaster, c.master) : { valores: null, motivo: null, linea: null, etiquetados: [] };
    const M = m.valores ? new Set([...m.valores, ...m.etiquetados.map((e) => e.valor)]) : null;
    // C: los valores de D∪M que el comentario NOMBRA como palabra entera. Con menos de dos no enumera.
    const universo = new Set([...D, ...(M || [])]);
    const nombrados = new Set([...universo].filter((x) => rastro(texto.split('\n'), x).length > 0));
    const C = nombrados.size >= 2 ? nombrados : new Set();
    const v = base.veredicto({ existe: sitio.existe, C, D, M, masterDeclarado: !!c.master, masterMotivo: m.motivo, campo: c.campo, cierreRoto: ciegas.length ? ciegas.join(' · ') : null });
    const sobran = M ? [...D].filter((x) => !M.has(x)).sort() : [];
    const faltan = M ? [...M].filter((x) => !D.has(x)).sort() : [];
    const otro = c.masterOtro ? leerMaster(lineasMaster, c.masterOtro) : null;
    return {
      campo: c.etiqueta || c.campo, id: c.campo, control: c.control || null, campoEn: sitio.existe ? sitio.campoEn : 0, defecto,
      fuentes, D: [...D].sort(), M: M ? [...M].sort() : null, lineaMaster: m.linea, tramos: m.tramos || [], etiquetados: m.etiquetados,
      C: [...C].sort(), comentario: texto, sobran, faltan, ...v,
      rastroSobran: Object.fromEntries(sobran.map((x) => [x, rastro(lineasMaster, x)])),
      rastroSinMaster: !c.master && sitio.existe ? Object.fromEntries([c.campo, ...D].map((x) => [x, rastro(lineasMaster, x)])) : null,
      otro: otro && otro.valores ? { nombre: c.masterOtro.nombre, linea: otro.linea, valores: [...otro.valores].sort() } : (otro ? { nombre: c.masterOtro.nombre, motivo: otro.motivo } : null),
    };
  });
  const poblacion = base.cotejar().poblacion.estadosFueraDeLaTabla;
  return { filas, poblacion, B, lineasMaster };
}

function pinta(r) {
  const out = [];
  const reales = r.filas.filter((f) => !f.control);
  const mia = reales.map((f) => f.id).sort().join(',');
  const suya = [...r.poblacion].sort().join(',');
  out.push(`POBLACION: ${r.poblacion.length} campos de estado fuera de la tabla del instrumento de SCRUM-1500 · en mi tabla: ${reales.length} · ${mia === suya ? 'SON LOS MISMOS' : '🔴 NO SON LOS MISMOS'}`);
  out.push(`           ${r.B.ficheros} ficheros .ts bajo src/ (${r.B.sinParsear} sin parsear) · ${r.B.escriturasVistas} llamadas de escritura de Prisma vistas · máster ${r.lineasMaster.length} líneas`);
  for (const f of r.filas) {
    out.push('');
    out.push(`=== ${f.control ? `[CONTROL, tiene que salir ${f.control}] ` : ''}${f.campo} (esquema, línea ${f.campoEn}) → ${f.veredicto}`);
    out.push(`    por qué   : ${f.porque}`);
    out.push(`    código D  : ${f.D.join(' | ') || '(nada)'}${f.defecto ? `   · @default ${f.defecto}` : '   · sin @default'}`);
    for (const s of f.fuentes) {
      out.push(`      · ${s.de}: ${[...s.valores].sort().join(' | ') || '(ningún literal)'}${s.ciego ? `   🔴 ${s.ciego}` : ''}`);
      for (const x of s.sitios) out.push(`          ${x}`);
      for (const x of s.noLit) out.push(`          (no literal) ${x}`);
      for (const x of s.anidadas) out.push(`          (ANIDADA, es de otra tabla: no se suma) ${x}`);
    }
    out.push(`    máster M  : ${f.M ? `${f.M.join(' | ')}   ← línea ${f.lineaMaster}` : '(sin lista declarada)'}`);
    for (const t of f.tramos) out.push(`          tramo: ${t}`);
    for (const e of f.etiquetados) out.push(`          ⚠ «${e.valor}» está en esa línea con la etiqueta ${e.etiqueta}: cuenta como del máster, y se dice`);
    if (f.otro) out.push(`    máster ${f.otro.nombre}: ${f.otro.valores ? `${f.otro.valores.join(' | ')}   ← línea ${f.otro.linea} · ${f.M && f.otro.valores.join() === f.M.join() ? 'igual que la Parte L' : '🔴 DISTINTO de la Parte L'}` : `🔴 ${f.otro.motivo}`}`);
    if (f.sobran.length) {
      out.push(`    🔴 en el código y NO en esa línea del máster: ${f.sobran.join(', ')}`);
      for (const [x, ls] of Object.entries(f.rastroSobran)) out.push(`          «${x}» como palabra entera en TODO el máster: ${ls.length} línea(s)${ls.length ? ` → ${ls.slice(0, 20).join(', ')}` : ''}`);
    }
    if (f.faltan.length) out.push(`    en el máster y sin fuente en el código: ${f.faltan.join(', ')}`);
    if (f.rastroSinMaster) for (const [x, ls] of Object.entries(f.rastroSinMaster)) out.push(`    rastro «${x}» en el máster: ${ls.length} línea(s)${ls.length ? ` → ${ls.slice(0, 20).join(', ')}` : ''}`);
    out.push(`    comentario: nombra ${f.C.length ? f.C.join(' | ') : '(no enumera: menos de dos valores)'}`);
  }
  const cuenta = {};
  for (const f of reales) cuenta[f.veredicto] = (cuenta[f.veredicto] || 0) + 1;
  out.push('');
  out.push('RESUMEN (sin los controles):');
  for (const [k, n] of Object.entries(cuenta).sort()) out.push(`  ${String(n).padStart(2)}  ${k}`);
  out.push(`  ${String(reales.length).padStart(2)}  TOTAL`);
  const malos = r.filas.filter((f) => f.control && f.veredicto !== f.control);
  const ciegos = reales.filter((f) => f.veredicto === 'CIEGO' || f.veredicto === 'NO_EXISTE');
  // El control del RASTRO: una palabra que el máster tiene seguro y una derivada que no puede tener.
  const positivo = rastro(r.lineasMaster, 'confirming_request');
  let inventada = 'estado_que_no_esta';
  while (r.lineasMaster.some((l) => l.includes(inventada))) inventada += '_x';
  const cero = rastro(r.lineasMaster, inventada);
  out.push('');
  out.push(`CONTROLES: ${r.filas.filter((f) => f.control).length - malos.length} de ${r.filas.filter((f) => f.control).length} salen como tienen que salir${malos.length ? ` · 🔴 ${malos.map((f) => `${f.campo} sale ${f.veredicto}`).join(' · ')}` : ''} · campos reales ciegos: ${ciegos.length} (tiene que ser 0)`);
  out.push(`RASTRO   : «confirming_request» sale en ${positivo.length} línea(s) del máster (${positivo.join(', ')}; tiene que ser > 0) · una palabra derivada que no está sale en ${cero.length} (tiene que ser 0)`);
  const ok = malos.length === 0 && ciegos.length === 0 && mia === suya && r.B.sinParsear === 0 && r.B.ficheros > 0 && positivo.length > 0 && cero.length === 0;
  out.push(ok ? 'EXIT=0' : 'INSTRUMENTO NO FIABLE\nEXIT=2');
  return { texto: out.join('\n'), ok };
}

module.exports = { ONCE, CONTROLES, cotejarOnce, pinta, leerMaster, valores, rastro };

if (require.main === module) {
  const { texto, ok } = pinta(cotejarOnce());
  console.log(texto);
  process.exit(ok ? 0 : 2);
}
