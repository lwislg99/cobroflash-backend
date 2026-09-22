// docs/master/evidencias/SCRUM-612/medir-e1-612.mjs — SCRUM-612 (E-1) · jv-j1, 18-sep-2026
//
// ¿QUÉ PASA HOY, EN EL CÓDIGO, CUANDO SE LE COBRA A UN CLIENTE CON `INVOICING_ES_ENABLED` EN OFF?
//
// SÓLO LEE. Por AST y con el comprobador de tipos de TypeScript sobre `src/` entero (el mismo
// `tsconfig.json` que compila el producto). No importa nada de `src/`, no ejecuta el camino de
// emisión y no modifica ni una línea (regla 38): la parte que EJECUTA funciones reales vive aparte,
// en `ejecutar-e1-612.mjs`, y corre contra `dist/`.
//
// Uso:   node docs/master/evidencias/SCRUM-612/medir-e1-612.mjs <raiz-del-repo>
//
// Cada sección declara su POBLACIÓN y lleva su CONTROL POSITIVO: la misma búsqueda encontrando algo
// que se sabe que existe. Si un control falla, la sección dice «CIEGO» y no afirma nada, y el
// proceso sale con código 2. Un cero sin control delante es «no he mirado» (A3).
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { bocasDeEmision } from '../../../../tests/_bocas-de-emision.mjs';

const RAIZ = path.resolve(process.argv[2] ?? '.');
const rel = (p) => path.relative(RAIZ, p).split(path.sep).join('/');
const linea = (n) => n.getSourceFile().getLineAndCharacterOfPosition(n.getStart()).line + 1;
const donde = (n) => `${rel(n.getSourceFile().fileName)}:${linea(n)}`;
const corto = (s, max = 110) => { const t = String(s).replace(/\s+/g, ' ').trim(); return t.length > max ? t.slice(0, max - 1) + '…' : t; };
const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

let ciegos = 0;
const control = (nombre, ok, detalle) => {
  if (!ok) ciegos++;
  console.log(`  control · ${nombre}: ${ok ? 'OK' : 'FALLA → la sección queda CIEGA'}${detalle ? ` (${detalle})` : ''}`);
  return ok;
};
const titulo = (t) => console.log(`\n${'═'.repeat(100)}\n${t}\n${'═'.repeat(100)}`);

// ── 0 · POBLACIÓN ──────────────────────────────────────────────────────────────────────────────
const cfg = ts.readConfigFile(path.join(RAIZ, 'tsconfig.json'), ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(cfg.config, ts.sys, RAIZ);
const program = ts.createProgram(parsed.fileNames, { ...parsed.options, noEmit: true });
const checker = program.getTypeChecker();
const fuentes = program.getSourceFiles().filter((sf) => rel(sf.fileName).startsWith('src/'));

function jsDe(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) jsDe(p, out); else if (/\.js$/.test(e.name)) out.push(p);
  }
  return out;
}
const publicos = jsDe(path.join(RAIZ, 'public')).map((p) =>
  ts.createSourceFile(p, fs.readFileSync(p, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS));

titulo('0 · POBLACIÓN');
console.log(`  raíz                         : ${RAIZ}`);
console.log(`  ficheros de src/ (tsconfig)  : ${parsed.fileNames.length} declarados · ${fuentes.length} cargados en el programa con tipos`);
console.log(`  ficheros .js de public/      : ${publicos.length} (AST sin tipos)`);
control('el programa carga todo src/', fuentes.length === parsed.fileNames.length && fuentes.length > 200,
  `${fuentes.length}/${parsed.fileNames.length}`);

const todos = (sf, fn) => { const v = (n) => { fn(n); ts.forEachChild(n, v); }; v(sf); };
const esFuncion = (n) => ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n)
  || ts.isMethodDeclaration(n);
const nombreLlamada = (c) => { const e = c.expression; return ts.isPropertyAccessExpression(e) ? e.name.text : ts.isIdentifier(e) ? e.text : null; };
const cadenaPropiedades = (e) => { const out = []; let x = e; while (ts.isPropertyAccessExpression(x)) { out.unshift(x.name.text); x = x.expression; } if (ts.isIdentifier(x)) out.unshift(x.text); return out; };
function textoLiteral(n) {
  if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) return n.text;
  if (ts.isTemplateExpression(n)) return n.head.text + n.templateSpans.map((s) => '${…}' + s.literal.text).join('');
  return null;
}
function funcionQueEnvuelve(n) {
  for (let x = n.parent; x; x = x.parent) {
    if (ts.isFunctionDeclaration(x) && x.name) return x.name.text;
    if (ts.isMethodDeclaration(x) && x.name) return x.name.getText();
    if ((ts.isArrowFunction(x) || ts.isFunctionExpression(x)) && x.parent) {
      if (ts.isVariableDeclaration(x.parent)) return x.parent.name.getText();
      if (ts.isCallExpression(x.parent)) {
        const a0 = x.parent.arguments[0];
        const ch = cadenaPropiedades(x.parent.expression).join('.');
        if (a0 && ts.isStringLiteral(a0)) return `${ch}('${a0.text}')`;
      }
    }
  }
  return '(nivel de módulo)';
}

// ── ENTRADAS: todas las rutas y todos los crons, con su prefijo de montaje ────────────────────
// El prefijo se lee de `src/app.ts` (`app.use('/x', …, router)` y `mountAdmin(app, '/x', …, router)`),
// resolviendo el identificador del router a su FICHERO con el comprobador de tipos.
const prefijos = new Map(); // fichero → [prefijo]
const appSf = fuentes.find((sf) => rel(sf.fileName) === 'src/app.ts');
if (appSf) todos(appSf, (n) => {
  if (!ts.isCallExpression(n)) return;
  const ch = cadenaPropiedades(n.expression).join('.');
  let pref = null;
  if (ch === 'app.use' && n.arguments[0] && ts.isStringLiteral(n.arguments[0])) pref = n.arguments[0].text;
  if (ch === 'mountAdmin' && n.arguments[1] && ts.isStringLiteral(n.arguments[1])) pref = n.arguments[1].text;
  if (!pref) return;
  const ult = n.arguments[n.arguments.length - 1];
  if (!ult || !ts.isIdentifier(ult)) return;
  let s = checker.getSymbolAtLocation(ult);
  if (s && s.flags & ts.SymbolFlags.Alias) s = checker.getAliasedSymbol(s);
  const d = s?.declarations?.[0];
  if (!d) return;
  const f = rel(d.getSourceFile().fileName);
  if (!prefijos.has(f)) prefijos.set(f, []);
  prefijos.get(f).push(pref);
});

const METODOS = new Set(['get', 'post', 'put', 'patch', 'delete']);
const entradas = []; // { etiqueta, nodo, fichero, rutaCompleta[] }
for (const sf of fuentes) {
  const f = rel(sf.fileName);
  todos(sf, (n) => {
    if (!ts.isCallExpression(n) || !ts.isPropertyAccessExpression(n.expression)) return;
    const met = n.expression.name.text;
    const a0 = n.arguments[0];
    const ult = n.arguments[n.arguments.length - 1];
    if (METODOS.has(met) && a0 && ts.isStringLiteral(a0) && ult && (ts.isArrowFunction(ult) || ts.isFunctionExpression(ult))) {
      const objeto = n.expression.expression.getText(sf);
      if (!/router|app/i.test(objeto)) return;
      const rutas = (prefijos.get(f) ?? ['?']).map((p) => (p + (a0.text === '/' ? '' : a0.text)) || '/');
      entradas.push({ etiqueta: `${met.toUpperCase()} ${rutas.join(' | ')}`, nodo: ult, fichero: f, rutas, metodo: met.toUpperCase() });
    }
    if (met === 'schedule' && n.expression.expression.getText(sf) === 'cron' && ult && (ts.isArrowFunction(ult) || ts.isFunctionExpression(ult))) {
      entradas.push({ etiqueta: `CRON ${a0 ? a0.getText(sf) : '?'} (${f}:${linea(n)})`, nodo: ult, fichero: f, rutas: [], metodo: 'CRON' });
    }
  });
}

// ── SUMIDEROS ─────────────────────────────────────────────────────────────────────────────────
const WA = 'src/integrations/whatsapp.ts';
const esSumideroWA = (decl) => decl && rel(decl.getSourceFile().fileName) === WA && ts.isFunctionDeclaration(decl) && /^send/.test(decl.name?.text ?? '');
const SUMIDERO_CORREO = new Set(['enviarCorreo', 'enviarPorResend', 'sendMail']);
const SUMIDERO_EMISION = new Set(['allocateInvoiceNumber', 'emitInvoice', 'crearFacturaEmitida', 'ensureInvoiceForCharge']);
const esCreacionDeCobro = (c) => { const ch = cadenaPropiedades(c.expression); return ch.length >= 2 && ch[ch.length - 2] === 'charge' && /^(create|createMany|upsert)$/.test(ch[ch.length - 1]); };
function saltoHttp(c) {
  const nom = nombreLlamada(c);
  const ch = cadenaPropiedades(c.expression).join('.');
  if (!(nom === 'fetch' || /^axios\.(get|post|put|patch|delete)$/.test(ch) || ch === 'axios')) return null;
  const a0 = c.arguments[0];
  const t = a0 ? textoLiteral(a0) : null;
  if (!t) return null;
  const m = t.match(/\$\{…\}(\/[A-Za-z0-9_\-/]+)/) || t.match(/^(\/[A-Za-z0-9_\-/]+)/);
  return m ? m[1] : null;
}

// ── ALCANCE: desde cada entrada, a qué llega (BFS por el comprobador de tipos) ────────────────
function alcance(entrada, profundidadMax = 14) {
  const vistos = new Set([entrada.nodo]);
  const cola = [{ nodo: entrada.nodo, cadena: [] , prof: 0 }];
  const hallado = []; // { tipo, nombre, cadena, llamada }
  const cruzados = new Set();
  while (cola.length) {
    const { nodo, cadena, prof } = cola.shift();
    const visitar = (n) => {
      if (ts.isCallExpression(n)) {
        const nom = nombreLlamada(n);
        let decl = null;
        try { decl = checker.getResolvedSignature(n)?.declaration ?? null; } catch { decl = null; }
        const declNom = decl && decl.name && ts.isIdentifier(decl.name) ? decl.name.text : nom;
        const paso = [...cadena, `${declNom ?? nom}@${donde(n)}`];
        if (esSumideroWA(decl)) hallado.push({ tipo: 'WHATSAPP', nombre: declNom, cadena: paso, llamada: n });
        else if (SUMIDERO_CORREO.has(declNom) || SUMIDERO_CORREO.has(nom)) hallado.push({ tipo: 'CORREO', nombre: declNom ?? nom, cadena: paso, llamada: n });
        if (SUMIDERO_EMISION.has(declNom)) hallado.push({ tipo: 'EMISION', nombre: declNom, cadena: paso, llamada: n });
        if (esCreacionDeCobro(n)) hallado.push({ tipo: 'CREA_COBRO', nombre: cadenaPropiedades(n.expression).join('.'), cadena: paso, llamada: n });
        const salto = saltoHttp(n);
        if (salto) hallado.push({ tipo: 'SALTO_HTTP', nombre: salto, cadena: paso, llamada: n });
        const chLee = cadenaPropiedades(n.expression);
        if (chLee.length >= 3 && /^find(First|Unique|Many)(OrThrow)?$/.test(chLee[chLee.length - 1])) hallado.push({ tipo: 'LEE', nombre: chLee[chLee.length - 2], cadena: paso, llamada: n });
        if (decl && prof < profundidadMax) {
          const f = rel(decl.getSourceFile().fileName);
          const cuerpo = (esFuncion(decl) || ts.isFunctionDeclaration(decl)) && decl.body;
          if (f.startsWith('src/') && cuerpo && !vistos.has(decl)) {
            vistos.add(decl);
            cruzados.add(`${declNom}@${f}`);
            cola.push({ nodo: decl, cadena: paso, prof: prof + 1 });
          }
        }
      }
      ts.forEachChild(n, visitar);
    };
    ts.forEachChild(nodo, visitar);
  }
  return { hallado, cruzados };
}

// Condiciones `if` entre la entrada y la primera llamada de la cadena (lo que tiene que ser verdad
// para que ese envío ocurra, leído del handler; no se evalúa).
function condiciones(llamada, techo) {
  const out = [];
  for (let x = llamada.parent; x && x !== techo; x = x.parent) {
    if (ts.isIfStatement(x) && (x.thenStatement.pos <= llamada.pos && llamada.end <= x.thenStatement.end)) out.unshift(`si ${corto(x.expression.getText(), 90)}`);
    if (ts.isIfStatement(x) && x.elseStatement && (x.elseStatement.pos <= llamada.pos && llamada.end <= x.elseStatement.end)) out.unshift(`si NO ${corto(x.expression.getText(), 90)}`);
  }
  return out;
}

const resultados = entradas.map((e) => ({ e, ...alcance(e) }));
const porEtiqueta = (re) => resultados.filter((r) => re.test(r.e.etiqueta));

// ══════════════════════════════════════════════════════════════════════════════════════════════
titulo('A · ¿DE DÓNDE SALE UN ENLACE DE PAGO? (el aviso preliminar del 18-sep ~15:30Z)');
// A1 · creaciones de fila `Charge`: llamadas `.charge.create|createMany|upsert`, escrituras anidadas
// `charge: { create… }` / `charges: { create… }` y SQL crudo `INSERT INTO charges`.
const creaCobro = [];
const anidadas = [];
const sqlCrudo = [];
for (const sf of fuentes) todos(sf, (n) => {
  if (ts.isCallExpression(n) && esCreacionDeCobro(n)) creaCobro.push(n);
  if (ts.isPropertyAssignment(n) && /^(charge|charges)$/.test(n.name.getText()) && ts.isObjectLiteralExpression(n.initializer)
    && n.initializer.properties.some((p) => p.name && /^(create|createMany|connectOrCreate|upsert)$/.test(p.name.getText()))) anidadas.push(n);
  const t = textoLiteral(n);
  if (t && /insert\s+into\s+"?charges"?/i.test(t)) sqlCrudo.push(n);
});
console.log(`  población: ${fuentes.length} ficheros de src/ · busca (a) llamadas *.charge.create|createMany|upsert, (b) escritura anidada charge(s): { create… }, (c) SQL «INSERT INTO charges»`);
console.log(`  (a) llamadas que crean un Charge: ${creaCobro.length}`);
for (const n of creaCobro) console.log(`      · ${donde(n)}  en ${funcionQueEnvuelve(n)}`);
console.log(`  (b) escrituras anidadas: ${anidadas.length}`); for (const n of anidadas) console.log(`      · ${donde(n)}`);
console.log(`  (c) SQL crudo: ${sqlCrudo.length}`); for (const n of sqlCrudo) console.log(`      · ${donde(n)}`);
control('(a) ve la creación conocida de charges.routes.ts', creaCobro.some((n) => rel(n.getSourceFile().fileName) === 'src/modules/billing/app/routes/charges.routes.ts'));
// Control del (b): la misma forma sobre un modelo que SÍ tiene escrituras anidadas (`events: { create }`).
let anidadaControl = 0;
for (const sf of fuentes) todos(sf, (n) => { if (ts.isPropertyAssignment(n) && n.name.getText() === 'events' && ts.isObjectLiteralExpression(n.initializer) && n.initializer.properties.some((p) => p.name?.getText() === 'create')) anidadaControl++; });
control('(b) la misma búsqueda ve `events: { create }` (existe en charges.routes.ts)', anidadaControl > 0, `${anidadaControl} vistas`);

// A2 · ¿quién llama a la ruta que crea el Charge? Literales con la ruta «/charges» (sin «/admin»).
const rutaCobros = [];
const rutaControl = [];
const barrerLiterales = (sf) => todos(sf, (n) => {
  const t = textoLiteral(n);
  if (t === null || !ts.isStringLiteral(n) && !ts.isTemplateExpression(n) && !ts.isNoSubstitutionTemplateLiteral(n)) return;
  if (/(^|[^a-z])\/charges(\/|$|\b)/.test(t) && !/\/admin\/charges/.test(t)) rutaCobros.push(n);
  if (/\/webhooks\/psp/.test(t)) rutaControl.push(n);
});
// `scripts/` también: un llamador fuera del producto (una herramienta, una siembra) crearía cobros
// igual. Lo que llame desde FUERA del repositorio (la ruta va con secreto interno) no se puede ver
// desde aquí, y se declara así en el expediente.
const scriptsJs = [];
(function andar(d) {
  if (!fs.existsSync(d)) return;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) andar(p); else if (/\.(m?js|ts)$/.test(e.name)) scriptsJs.push(ts.createSourceFile(p, fs.readFileSync(p, 'utf8'), ts.ScriptTarget.Latest, true, /\.ts$/.test(e.name) ? ts.ScriptKind.TS : ts.ScriptKind.JS));
  }
})(path.join(RAIZ, 'scripts'));
for (const sf of fuentes) barrerLiterales(sf);
for (const sf of publicos) barrerLiterales(sf);
for (const sf of scriptsJs) barrerLiterales(sf);
console.log(`\n  población: ${fuentes.length} ficheros de src/ + ${publicos.length} de public/ + ${scriptsJs.length} de scripts/ · busca literales de texto que nombren la ruta «/charges» (no «/admin/charges»)`);
for (const n of rutaCobros) console.log(`      · ${donde(n)}  «${corto(textoLiteral(n), 70)}»  en ${funcionQueEnvuelve(n)}`);
control('la misma búsqueda ve la ruta «/webhooks/psp» que llama confirm-bizum', rutaControl.some((n) => /chargesAdmin/.test(n.getSourceFile().fileName)), `${rutaControl.length} vistas`);
const llamadasHttpACobros = rutaCobros.filter((n) => { for (let x = n.parent; x; x = x.parent) if (ts.isCallExpression(x)) return !!saltoHttp(x); return false; });
console.log(`  de ellos, usados como URL de una llamada HTTP (fetch/axios): ${llamadasHttpACobros.length}`);
for (const n of llamadasHttpACobros) console.log(`      · ${donde(n)}  en ${funcionQueEnvuelve(n)}`);

// A3 · ¿quién llega, por el grafo de llamadas, a crear un cobro (directo o por el salto HTTP a /charges)?
const llegaACobro = resultados.filter((r) => r.hallado.some((h) => h.tipo === 'CREA_COBRO' || (h.tipo === 'SALTO_HTTP' && /^\/charges\/?$/.test(h.nombre))));
console.log(`\n  población: ${entradas.length} entradas (rutas + crons de src/) · ¿cuáles llegan a crear un cobro?`);
for (const r of llegaACobro) {
  const h = r.hallado.find((x) => x.tipo === 'CREA_COBRO' || x.tipo === 'SALTO_HTTP');
  console.log(`      · ${r.e.etiqueta}\n          ${h.cadena.join(' → ')}`);
}
const psp = porEtiqueta(/^POST \/webhooks\/psp$/)[0];
control('el grafo cruza ficheros: POST /webhooks/psp llega a sendWhatsAppWindowFirst por sendPaymentConfirmationInvoice',
  !!psp && psp.hallado.some((h) => h.tipo === 'WHATSAPP' && h.cadena.some((c) => c.startsWith('sendPaymentConfirmationInvoice@'))));

// A4 · pasarelas: sesiones de Stripe, preferencias de Mercado Pago, enlaces de pago de terceros.
const pasarela = [];
for (const sf of fuentes) todos(sf, (n) => {
  if (!ts.isCallExpression(n)) return;
  const ch = cadenaPropiedades(n.expression).join('.');
  if (/(checkout\.sessions|paymentLinks|paymentIntents)\.create$|preference\.create$|preferences\.create$/.test(ch)) pasarela.push(n);
});
console.log(`\n  pasarelas (checkout.sessions|paymentLinks|paymentIntents.create, preference(s).create): ${pasarela.length}`);
for (const n of pasarela) console.log(`      · ${donde(n)}  ${cadenaPropiedades(n.expression).join('.')}  en ${funcionQueEnvuelve(n)}`);

// A5 · las páginas públicas de pago y de recibo: ¿de qué tabla sale lo que cobran/enseñan?
const paginasPago = resultados.filter((r) => r.e.rutas.some((x) => /^\/(pay|recibo)(\/|$)/.test(x)));
console.log(`\n  páginas públicas bajo /pay y /recibo: ${paginasPago.length} rutas · tablas que leen (find*) por el grafo:`);
for (const r of paginasPago) {
  const leidas = [...new Set(r.hallado.filter((h) => h.tipo === 'LEE').map((h) => h.nombre))].sort();
  console.log(`      · ${r.e.etiqueta.padEnd(52)} ${leidas.join(', ') || '(ninguna)'}`);
}
control('la página de tarjeta (GET /pay/card/:token) lee la tabla charge', paginasPago.some((r) => /GET \/pay\/card\/:token/.test(r.e.etiqueta) && r.hallado.some((h) => h.tipo === 'LEE' && h.nombre === 'charge')));

// ══════════════════════════════════════════════════════════════════════════════════════════════
titulo('B · ¿QUÉ RECIBE EL CLIENTE? Todas las entradas que llegan a un envío (WhatsApp / correo) o a emitir');
const conAlgo = resultados.filter((r) => r.hallado.some((h) => ['WHATSAPP', 'CORREO', 'EMISION'].includes(h.tipo)));
console.log(`  población: ${entradas.length} entradas (${entradas.filter((e) => e.metodo !== 'CRON').length} rutas + ${entradas.filter((e) => e.metodo === 'CRON').length} crons) · ${conAlgo.length} llegan a algo`);
for (const r of conAlgo) {
  const tipos = [...new Set(r.hallado.map((h) => h.tipo).filter((t) => t !== 'LEE'))].join(', ');
  console.log(`\n  ▸ ${r.e.etiqueta}   [${tipos}]   (${r.e.fichero})`);
  const vistos = new Set();
  for (const h of r.hallado) {
    if (!['WHATSAPP', 'CORREO', 'EMISION', 'SALTO_HTTP'].includes(h.tipo)) continue;
    const clave = `${h.tipo}:${h.cadena[0]}`;
    if (vistos.has(clave)) continue; vistos.add(clave);
    const primera = h.cadena[0];
    let nodoPrimero = null;
    todos(r.e.nodo, (n) => { if (!nodoPrimero && ts.isCallExpression(n) && primera.endsWith(`@${donde(n)}`)) nodoPrimero = n; });
    const cond = nodoPrimero ? condiciones(nodoPrimero, r.e.nodo) : [];
    console.log(`      ${h.tipo.padEnd(10)} ${h.cadena.map((c) => c.split('@')[0]).join(' → ')}   [${primera.split('@')[1]}]`);
    if (cond.length) console.log(`                 ${cond.join(' · ')}`);
  }
}

titulo('C · MARCAR UN COBRO A MANO: qué dispara cada puerta');
const manuales = porEtiqueta(/^(PUT \/admin\/invoices\/:id\/status|POST \/admin\/invoices\/:id\/pay|POST \/admin\/invoices\/bulk-paid|POST \/admin\/charges\/:id\/confirm-bizum)$/);
console.log(`  población: las ${manuales.length} puertas del panel que marcan cobrado (esperadas 4)`);
control('encuentra las 4 puertas', manuales.length === 4);
for (const r of manuales) {
  const envios = r.hallado.filter((h) => ['WHATSAPP', 'CORREO'].includes(h.tipo));
  const saltos = r.hallado.filter((h) => h.tipo === 'SALTO_HTTP');
  console.log(`  ▸ ${r.e.etiqueta}: envíos alcanzados directamente = ${envios.length} · saltos HTTP = ${saltos.map((s) => s.nombre).join(', ') || 'ninguno'} · funciones cruzadas = ${r.cruzados.size}`);
  for (const f of [...r.cruzados].slice(0, 12)) console.log(`        recorre ${f}`);
}
const status = porEtiqueta(/^PUT \/admin\/invoices\/:id\/status$/)[0];
control('el recorrido de PUT …/status cruza a job.service (recalcJobCobradoForInvoice)', !!status && [...status.cruzados].some((c) => c.startsWith('recalcJobCobradoForInvoice@')));

// ══════════════════════════════════════════════════════════════════════════════════════════════
titulo('D · BOCAS DE EMISIÓN y si consultan el modo ANTES de pedir número (reutiliza tests/_bocas-de-emision.mjs, SCRUM-778)');
const bocas = bocasDeEmision({ raiz: RAIZ, porton: 'getEmissionMode', cuando: 'antes' });
console.log(`  población: ${bocas.length} bocas (llamadas a allocateInvoiceNumber / emitInvoice en src/)`);
control('el censo de bocas no está vacío', bocas.length >= 5, `${bocas.length}`);
for (const b of bocas) {
  const e = entradas.find((x) => x.fichero === b.fichero && linea(x.nodo) <= b.linea && b.linea <= x.nodo.getSourceFile().getLineAndCharacterOfPosition(x.nodo.end).line + 1);
  console.log(`  · ${`${b.fichero}:${b.linea}`.padEnd(66)} ${b.tipo.padEnd(7)} ${String(b.etiqueta ?? '-').padEnd(18)} modo consultado antes: ${b.protegida ? 'SÍ' : 'no'}   ${e ? e.etiqueta : '(no es una ruta: función o cron)'}`);
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
titulo('E · LOS FLAGS: valor por defecto y quién los lee');
const flagsSf = fuentes.find((sf) => rel(sf.fileName) === 'src/core/flags.ts');
let defaults = {};
if (flagsSf) todos(flagsSf, (n) => {
  if (ts.isVariableDeclaration(n) && n.name.getText() === 'FLAG_DEFAULTS') {
    let ini = n.initializer; while (ini && (ts.isAsExpression(ini) || ts.isParenthesizedExpression(ini))) ini = ini.expression;
    if (ini && ts.isObjectLiteralExpression(ini)) for (const p of ini.properties) if (ts.isPropertyAssignment(p)) defaults[p.name.getText()] = `${p.initializer.getText()}  (${donde(p)})`;
  }
});
console.log(`  FLAG_DEFAULTS tiene ${Object.keys(defaults).length} flags. Los dos del encargo:`);
for (const f of ['INVOICING_ES_ENABLED', 'SIF_ENABLED']) console.log(`    ${f.padEnd(22)} = ${defaults[f] ?? '(NO ENCONTRADO)'}`);
control('lee FLAG_DEFAULTS por AST', !!defaults.INVOICING_ES_ENABLED && !!defaults.WHATSAPP_TEMPLATES_ENABLED);
for (const flag of ['INVOICING_ES_ENABLED', 'SIF_ENABLED']) {
  const lectores = [];
  const barrer = (sf) => todos(sf, (n) => {
    const t = (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) ? n.text : (ts.isPropertyAccessExpression(n) && n.name.text === flag ? flag : null);
    if (t !== flag) return;
    if (ts.isPropertyAssignment(n.parent) && n.parent.name === n) return;
    const llamada = n.parent && ts.isCallExpression(n.parent) ? nombreLlamada(n.parent) : null;
    lectores.push(`${donde(n)}  ${llamada ? `${llamada}(…)` : ts.isPropertyAccessExpression(n) ? 'process.env / propiedad' : 'literal'}  en ${funcionQueEnvuelve(n)}`);
  });
  for (const sf of fuentes) barrer(sf);
  for (const sf of publicos) barrer(sf);
  console.log(`\n  ${flag}: ${lectores.length} apariciones como valor (src/ + public/; no cuenta la clave de FLAG_DEFAULTS)`);
  for (const l of lectores) console.log(`    · ${l}`);
  if (flag === 'INVOICING_ES_ENABLED') control('ve la lectura conocida de getEmissionMode', lectores.some((l) => l.includes('emission.service.ts') && l.includes('getEmissionMode')));
  if (flag === 'SIF_ENABLED') control('ve al menos una lectura de SIF_ENABLED fuera de flags.ts', lectores.some((l) => !l.includes('src/core/flags.ts')));
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
titulo('F · EL CAMINO DEL JUSTIFICANTE: dónde RAMIFICA el código por él');
const MARCAS = new Set(['receipt', 'JUST', 'justificante']);
const ramas = [];
const refs = new Map();
const IDS = ['getEmissionMode', 'isReceiptNumber', 'RECEIPT_NUMBER_PREFIX', 'makeReceiptNumber', 'reservarReferenciaJustificante', 'modoDocumentoSuelto'];
const barrerRamas = (sf) => todos(sf, (n) => {
  if (ts.isBinaryExpression(n) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken].includes(n.operatorToken.kind)) {
    const lit = [n.left, n.right].map(textoLiteral).find((t) => t !== null && MARCAS.has(t));
    if (lit) ramas.push({ n, lit });
  }
  if (ts.isPropertyAssignment(n) && n.name.getText() === 'not' && textoLiteral(n.initializer) === 'JUST') ramas.push({ n, lit: 'JUST (filtro not)' });
  if (ts.isIdentifier(n) && IDS.includes(n.text)) {
    const f = rel(n.getSourceFile().fileName);
    const k = `${n.text}`; if (!refs.has(k)) refs.set(k, new Map());
    refs.get(k).set(f, (refs.get(k).get(f) ?? 0) + 1);
  }
});
for (const sf of fuentes) barrerRamas(sf);
for (const sf of publicos) barrerRamas(sf);
console.log(`  población: ${fuentes.length} de src/ + ${publicos.length} de public/ · comparaciones (===, !==, ==, !=) contra 'receipt' | 'JUST' | 'justificante', y el filtro { not: 'JUST' }`);
console.log(`  ramificaciones: ${ramas.length} en ${new Set(ramas.map((r) => rel(r.n.getSourceFile().fileName))).size} ficheros`);
for (const r of ramas) console.log(`    · ${donde(r.n).padEnd(70)} [${r.lit}]  ${corto(r.n.getText(), 70)}`);
control("ve la rama conocida de allocateInvoiceNumber (getEmissionMode(...) === 'receipt')", ramas.some((r) => rel(r.n.getSourceFile().fileName) === 'src/modules/invoicing/domain/invoiceNumber.service.ts' && r.lit === 'receipt'));
console.log('\n  referencias a los identificadores del mecanismo (fichero: nº):');
for (const id of IDS) {
  const m = refs.get(id) ?? new Map();
  const total = [...m.values()].reduce((a, b) => a + b, 0);
  console.log(`    ${id.padEnd(32)} ${String(total).padStart(3)} en ${m.size} ficheros`);
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
titulo('G · TEXTOS con «justificante» que puede ver alguien (literales de código, sin comentarios)');
const HOMONIMO = (f) => /src\/modules\/expenses\/|public\/dashboard\/js\/expensesView\.js/.test(f);
const textos = []; const homonimos = [];
const barrerTextos = (sf) => todos(sf, (n) => {
  const t = textoLiteral(n);
  if (t === null) return;
  if (ts.isTemplateExpression(n.parent) || ts.isTemplateSpan(n.parent)) return;
  if (!/justificante/.test(norm(t))) return;
  if (/^[a-z_]+$/.test(t) || t === 'justificante') return; // claves y valores internos: van en F
  (HOMONIMO(rel(n.getSourceFile().fileName)) ? homonimos : textos).push(n);
});
for (const sf of fuentes) barrerTextos(sf);
for (const sf of publicos) barrerTextos(sf);
const porFichero = new Map();
for (const n of textos) { const f = rel(n.getSourceFile().fileName); porFichero.set(f, [...(porFichero.get(f) ?? []), n]); }
console.log(`  población: ${fuentes.length} de src/ + ${publicos.length} de public/ · literales de texto (no identificadores, no comentarios) que contienen «justificante» sin distinguir acentos ni mayúsculas`);
console.log(`  ${textos.length} textos en ${porFichero.size} ficheros · aparte, ${homonimos.length} del homónimo de GASTOS (justificante de un gasto, SCRUM-324), que no es este documento`);
for (const [f, ns] of [...porFichero].sort()) {
  console.log(`    ${f}  (${ns.length})`);
  for (const n of ns) console.log(`        :${linea(n)}  «${corto(textoLiteral(n), 80)}»`);
}
control("ve «JUSTIFICANTE DE COBRO» del PDF (pdf.service.ts)", textos.some((n) => /pdf\.service\.ts$/.test(n.getSourceFile().fileName) && /JUSTIFICANTE DE COBRO/.test(textoLiteral(n))));

// ══════════════════════════════════════════════════════════════════════════════════════════════
titulo('H · LA MARCA DE AGUA «DEMO — no válida fiscalmente»');
const wm = [];
const barrerWm = (sf) => todos(sf, (n) => {
  const t = textoLiteral(n);
  if (t !== null && /no valida fiscalmente/.test(norm(t))) wm.push(`${donde(n)}  literal «${corto(t, 60)}»  en ${funcionQueEnvuelve(n)}`);
  if (ts.isIdentifier(n) && n.text === 'DEMO_WATERMARK' && !ts.isImportSpecifier(n.parent)) wm.push(`${donde(n)}  DEMO_WATERMARK  en ${funcionQueEnvuelve(n)}`);
  if (ts.isPropertyAssignment(n) && n.name.getText() === 'watermark') wm.push(`${donde(n)}  watermark: ${corto(n.initializer.getText(), 60)}`);
  if (ts.isPropertyAccessExpression(n) && n.name.text === 'watermark' && n.expression.getText() === 'params') wm.push(`${donde(n)}  params.watermark  en ${funcionQueEnvuelve(n)}`);
});
for (const sf of fuentes) barrerWm(sf);
for (const sf of publicos) barrerWm(sf);
console.log(`  población: ${fuentes.length} de src/ + ${publicos.length} de public/ · el literal, la constante, la propiedad \`watermark:\` y su lectura \`params.watermark\``);
for (const l of wm) console.log(`    · ${l}`);
control('ve la constante en emission.service.ts', wm.some((l) => l.includes('emission.service.ts') && l.includes('literal')));
control('ve el dibujo en pdf.service.ts (params.watermark)', wm.some((l) => l.includes('pdf.service.ts') && l.includes('params.watermark')));

console.log(`\nEXIT_PREVISTO=${ciegos ? 2 : 0}  (controles fallidos: ${ciegos})`);
process.exitCode = ciegos ? 2 : 0;
