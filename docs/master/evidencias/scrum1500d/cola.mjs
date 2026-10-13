#!/usr/bin/env node
// docs/master/evidencias/scrum1500d/cola.mjs — SCRUM-1500d · ¿EXISTE LA COLA DE VfSubmission?
//
// SOLO LEE. Ni una base, ni la red, ni `dist/`: lee `src/` por AST, el esquema y el máster como
// texto, y pregunta además al detector de la casa (`scripts/_guard-afirmacion-fiscal.mjs`,
// SCRUM-1128), que ya sabía buscar a quien llama al envío.
//
// USO (desde la raíz del árbol):  node docs/master/evidencias/scrum1500d/cola.mjs
// Salida 0 = todos los controles en su sitio · 1 = un control no salió como debía (CIEGO).
//
// CADA RECUENTO LLEVA DOS CONTROLES: uno que tiene que dar CERO (un nombre DERIVADO del árbol,
// no escrito a mano) y uno POSITIVO que tiene que aparecer. Y la población va delante.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const RAIZ = process.cwd();
const require = createRequire(path.join(RAIZ, 'package.json'));
const ts = require('typescript');
const rel = (f) => path.relative(RAIZ, f).replace(/\\/g, '/');
const out = (s = '') => process.stdout.write(`${s}\n`);
const fallos = [];
const control = (nombre, ok, detalle) => {
  out(`   ${ok ? 'OK ' : 'MAL'} control · ${nombre} → ${detalle}`);
  if (!ok) fallos.push(nombre);
};

// ── población ───────────────────────────────────────────────────────────────────────────
function ficherosTs(dir) {
  const r = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) r.push(...ficherosTs(p));
    else if (e.name.endsWith('.ts')) r.push(p);
  }
  return r;
}
const FICHEROS = ficherosTs(path.join(RAIZ, 'src')).sort();
const FUENTES = new Map();
let sinParsear = 0;
for (const f of FICHEROS) {
  const texto = fs.readFileSync(f, 'utf8');
  const sf = ts.createSourceFile(f, texto, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  if (sf.parseDiagnostics && sf.parseDiagnostics.length) sinParsear += 1;
  FUENTES.set(rel(f), { texto, sf });
}
const lineaDe = (sf, n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
const recorrer = (n, f) => { f(n); ts.forEachChild(n, (h) => recorrer(h, f)); };

function funcionQueEnvuelve(n) {
  for (let x = n.parent; x; x = x.parent) {
    if ((ts.isFunctionDeclaration(x) || ts.isMethodDeclaration(x)) && x.name) return x.name.getText();
    if ((ts.isArrowFunction(x) || ts.isFunctionExpression(x)) && x.parent && ts.isVariableDeclaration(x.parent)) {
      return x.parent.name.getText();
    }
  }
  return '(nivel de módulo o callback anónimo)';
}

out('SCRUM-1500d · ¿existe la cola de VfSubmission? · lectura de src/ por AST');
out(`población: ${FICHEROS.length} ficheros .ts en src/ · ${sinParsear} sin parsear`);
control('la población no está vacía', FICHEROS.length > 100, `${FICHEROS.length} ficheros`);
control('ningún fichero quedó sin parsear', sinParsear === 0, `${sinParsear}`);

// Un nombre que NO puede estar: se deriva alargando uno real hasta que ningún fuente lo contiene.
function nombreAusente(base) {
  let n = `${base}Z`;
  const todo = [...FUENTES.values()].map((v) => v.texto).join('\n');
  while (todo.includes(n)) n += 'Z';
  return n;
}

// ── ① el máster, por CONTENIDO y no por número de línea ──────────────────────────────────
out('\n① LAS DOS LÍNEAS DEL MÁSTER (se localizan por su frase; el número se comprueba)');
const master = fs.readFileSync(path.join(RAIZ, 'docs/YAQU_MASTER.md'), 'utf8').split(/\r?\n/);
out(`   máster: ${master.length} líneas`);
const ANCLAS = [
  { numero: 404, frase: 'La cola de remisión a la AEAT NO está construida', trozo: /\*\*La cola de remisión a la AEAT NO está construida\*\*[^]*$/ },
  { numero: 980, frase: '`enviarSobre` no tiene ningún llamador', trozo: /S1-D ~~✅~~[^]*?llamador en `src\/`\.\)\*/ },
];
for (const a of ANCLAS) {
  const donde = master.map((l, i) => (l.includes(a.frase) ? i + 1 : 0)).filter(Boolean);
  control(`«${a.frase}» está en UNA línea y es la ${a.numero}`, donde.length === 1 && donde[0] === a.numero, `líneas ${JSON.stringify(donde)}`);
  if (donde.length) out(`   L${donde[0]} literal: ${(a.trozo.exec(master[donde[0] - 1]) ?? ['(no casa el trozo)'])[0]}`);
}
const ausenteMaster = nombreAusente('VfSubmission');
control('una palabra derivada no está en el máster', !master.some((l) => l.includes(ausenteMaster)), `«${ausenteMaster}» 0 líneas`);
out('   todas las líneas del máster que nombran VfSubmission:');
master.forEach((l, i) => { if (l.includes('VfSubmission')) out(`     L${i + 1}: …${l.slice(Math.max(0, l.indexOf('VfSubmission') - 90), l.indexOf('VfSubmission') + 110)}…`); });

// ── ②③ quién toca el modelo ─────────────────────────────────────────────────────────────
const ESCRIBE = new Set(['create', 'createMany', 'createManyAndReturn', 'update', 'updateMany', 'upsert', 'delete', 'deleteMany']);
const LEE = new Set(['findMany', 'findFirst', 'findUnique', 'findFirstOrThrow', 'findUniqueOrThrow', 'count', 'aggregate', 'groupBy']);

function accesosAlModelo(modelo) {
  const r = [];
  for (const [fich, { sf }] of FUENTES) {
    recorrer(sf, (n) => {
      if (!ts.isPropertyAccessExpression(n) || n.name.text !== modelo) return;
      const p = n.parent;
      const metodo = p && ts.isPropertyAccessExpression(p) && p.expression === n ? p.name.text : null;
      const llamada = metodo && p.parent && ts.isCallExpression(p.parent) && p.parent.expression === p ? p.parent : null;
      const estados = [];
      if (llamada) {
        for (const arg of llamada.arguments) {
          recorrer(arg, (x) => {
            if (!ts.isPropertyAssignment(x) || x.name.getText(sf) !== 'status') return;
            let bajo = '?';
            for (let y = x.parent; y && y !== llamada; y = y.parent) {
              if (ts.isPropertyAssignment(y) && ['data', 'where', 'create', 'update'].includes(y.name.getText(sf))) { bajo = y.name.getText(sf); break; }
            }
            const lit = [];
            recorrer(x.initializer, (z) => { if (ts.isStringLiteralLike(z)) lit.push(z.text); });
            estados.push({ bajo, valor: lit.length ? lit.join('|') : `NO LITERAL: ${x.initializer.getText(sf)}` });
          });
        }
      }
      r.push({
        donde: `${fich}:${lineaDe(sf, n)}`, objeto: n.expression.getText(sf), metodo: metodo ?? '(sin método)',
        clase: ESCRIBE.has(metodo) ? 'ESCRIBE' : LEE.has(metodo) ? 'LEE' : 'OTRO', dentro: funcionQueEnvuelve(n), estados,
      });
    });
  }
  return r;
}
const accesos = accesosAlModelo('vfSubmission');
const pinta = (a) => out(`     ${a.donde} · ${a.objeto}.vfSubmission.${a.metodo}() · en ${a.dentro}${a.estados.length ? ` · status ${a.estados.map((e) => `[${e.bajo}] ${e.valor}`).join(' ; ')}` : ''}`);
out('\n② QUIÉN ESCRIBE FILAS (toda llamada `<algo>.vfSubmission.<método de escritura>()` de src/)');
accesos.filter((a) => a.clase === 'ESCRIBE').forEach(pinta);
out('\n③ QUIÉN LAS LEE (toda llamada `<algo>.vfSubmission.<método de lectura>()` de src/)');
accesos.filter((a) => a.clase === 'LEE').forEach(pinta);
const otros = accesos.filter((a) => a.clase === 'OTRO');
out(`   accesos que no son ni lectura ni escritura conocida: ${otros.length}`);
otros.forEach(pinta);
const modeloAusente = nombreAusente('vfSubmission');
control('un modelo derivado que no existe', accesosAlModelo(modeloAusente).length === 0, `«${modeloAusente}» 0 accesos`);
control('el mismo recorrido ve un modelo que se sabe usado (invoice)', accesosAlModelo('invoice').length > 50, `${accesosAlModelo('invoice').length} accesos a .invoice`);

// Lo que el recorrido de arriba NO ve: el modelo nombrado como CADENA, la relación, o SQL crudo.
out('   por otras vías (cadena, relación, tabla en SQL):');
for (const aguja of ['vfSubmission', 'vfSubmissions', 'vf_submissions', 'vf_flujo_obligado', modeloAusente]) {
  const v = [];
  for (const [fich, { sf }] of FUENTES) {
    recorrer(sf, (n) => {
      const cadena = (ts.isStringLiteralLike(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) && n.text.includes(aguja)
        && (aguja !== 'vfSubmission' || !n.text.includes('vfSubmissions'));
      const propiedad = (ts.isPropertyAssignment(n) || ts.isShorthandPropertyAssignment(n)) && n.name.getText(sf) === aguja;
      if (cadena) v.push(`${fich}:${lineaDe(sf, n)} cadena «${n.text.slice(0, 60)}»`);
      if (propiedad) v.push(`${fich}:${lineaDe(sf, n)} propiedad`);
    });
  }
  out(`     «${aguja}» fuera de comentarios, como cadena o propiedad: ${v.length}${v.length ? ` → ${v.join(' · ')}` : ''}`);
}

// ── ④ quién LLAMA a cada pieza ──────────────────────────────────────────────────────────
function usosDe(nombre) {
  const u = { declara: [], importaValor: [], importaTipo: [], llama: [], otraReferencia: [] };
  for (const [fich, { sf }] of FUENTES) {
    recorrer(sf, (n) => {
      if (!ts.isIdentifier(n) || n.text !== nombre) return;
      const p = n.parent;
      const d = `${fich}:${lineaDe(sf, n)}`;
      if ((ts.isFunctionDeclaration(p) || ts.isVariableDeclaration(p)) && p.name === n) u.declara.push(d);
      else if (ts.isImportSpecifier(p)) {
        const soloTipo = p.isTypeOnly || p.parent.parent.isTypeOnly;
        (soloTipo ? u.importaTipo : u.importaValor).push(d);
      } else if (ts.isCallExpression(p) && p.expression === n) u.llama.push(`${d} (en ${funcionQueEnvuelve(n)})`);
      else if (ts.isPropertyAccessExpression(p) && p.name === n && ts.isCallExpression(p.parent) && p.parent.expression === p) u.llama.push(`${d} (en ${funcionQueEnvuelve(n)}, como ${p.getText(sf)})`);
      else u.otraReferencia.push(`${d} (${ts.SyntaxKind[p.kind]})`);
    });
  }
  return u;
}
out('\n④ QUIÉN LLAMA A CADA PIEZA (identificadores del AST: un comentario o una cadena no cuentan)');
const PIEZAS = ['encolarAltaTrasSellado', 'procesarObligado', 'enviarSobre', 'decidirTrasEnvio', 'recuperarEnviadoSinCierre', 'trocear', 'idDelRegistro'];
const usos = {};
for (const p of PIEZAS) {
  const u = usos[p] = usosDe(p);
  out(`   ${p}: declara ${u.declara.length} · importa como valor ${u.importaValor.length} · importa como tipo ${u.importaTipo.length} · LLAMADAS ${u.llama.length} · otras referencias ${u.otraReferencia.length}`);
  [...u.declara.map((x) => `declara ${x}`), ...u.importaValor.map((x) => `importa ${x}`), ...u.llama.map((x) => `LLAMA ${x}`), ...u.otraReferencia.map((x) => `referencia ${x}`)].forEach((x) => out(`       ${x}`));
}
const piezaAusente = nombreAusente('procesarObligado');
const ua = usosDe(piezaAusente);
control('una función derivada que no existe', Object.values(ua).every((v) => v.length === 0), `«${piezaAusente}» 0 usos`);
control('el mismo recorrido ve llamadas que se saben muchas (sellarTrasEmision)', usosDe('sellarTrasEmision').llama.length >= 5, `${usosDe('sellarTrasEmision').llama.length} llamadas`);
control('el encolado SÍ tiene quien lo llame', usos.encolarAltaTrasSellado.llama.length >= 1, `${usos.encolarAltaTrasSellado.llama.length} llamadas`);

// ── ④bis qué carga el proceso al arrancar ───────────────────────────────────────────────
out('\n④bis QUÉ CARGA EL PROCESO: grafo de import/require/import() desde src/index.ts (los `import type` no cargan nada)');
function resolver(desde, espec) {
  if (!espec.startsWith('.')) return null;
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(desde), espec));
  for (const c of [`${base}.ts`, `${base}/index.ts`, base.replace(/\.js$/, '.ts'), base]) if (FUENTES.has(c)) return c;
  return undefined;
}
const sinResolver = [];
function aristas(fich) {
  const { sf } = FUENTES.get(fich);
  const r = [];
  const anota = (espec) => { const d = resolver(fich, espec); if (d) r.push(d); else if (d === undefined && !/\.(json|css|html)$/.test(espec)) sinResolver.push(`${fich} → ${espec}`); };
  recorrer(sf, (n) => {
    if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier)) {
      const c = n.importClause;
      const soloTipos = c && (c.isTypeOnly || (!c.name && c.namedBindings && ts.isNamedImports(c.namedBindings) && c.namedBindings.elements.length > 0 && c.namedBindings.elements.every((e) => e.isTypeOnly)));
      if (!soloTipos) anota(n.moduleSpecifier.text);
    } else if (ts.isExportDeclaration(n) && n.moduleSpecifier && ts.isStringLiteral(n.moduleSpecifier) && !n.isTypeOnly) anota(n.moduleSpecifier.text);
    else if (ts.isCallExpression(n) && n.arguments.length === 1 && ts.isStringLiteralLike(n.arguments[0])
      && (n.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(n.expression) && n.expression.text === 'require'))) anota(n.arguments[0].text);
  });
  return r;
}
const cargados = new Set(['src/index.ts']);
for (const cola = ['src/index.ts']; cola.length;) for (const d of aristas(cola.pop())) if (!cargados.has(d)) { cargados.add(d); cola.push(d); }
out(`   alcanzables desde src/index.ts: ${cargados.size} de ${FUENTES.size} · importaciones relativas sin resolver: ${sinResolver.length}`);
sinResolver.slice(0, 5).forEach((x) => out(`       sin resolver: ${x}`));
const MIRAR = ['src/core/cron/cron.ts', 'src/modules/invoicing/domain/selladoEstado.ts', 'src/modules/invoicing/domain/encolarRemision.ts',
  'src/modules/fiscal/verifactu/registro.builder.ts', 'src/modules/fiscal/verifactu/sif.cola.ts', 'src/modules/fiscal/verifactu/sif.procesador.ts', 'src/modules/fiscal/verifactu/sif.client.ts'];
for (const m of MIRAR) out(`     ${cargados.has(m) ? 'SE CARGA   ' : 'NO SE CARGA'} ${m}`);
control('las importaciones relativas se resuelven todas', sinResolver.length === 0, `${sinResolver.length} sin resolver`);
control('el grafo ve lo que se sabe cargado (cron.ts y el encolado)', cargados.has(MIRAR[0]) && cargados.has(MIRAR[2]), 'los dos alcanzables');
out('   quién importa cada fichero de la cola (cualquier fichero de src/, cargado o no):');
for (const m of MIRAR.slice(4)) {
  const quien = [...FUENTES.keys()].filter((f) => aristas(f).includes(m));
  out(`     ${m} ← ${quien.length ? quien.join(', ') : 'NADIE (como valor)'}`);
}

// ── ④ter lo que se programa ─────────────────────────────────────────────────────────────
out('\n④ter LO QUE SE PROGRAMA: toda llamada `.schedule(…)`, `setInterval(…)` y `setTimeout(…)` de src/, y a qué llama dentro');
const COLA = new Set(PIEZAS);
let programados = 0; let programadosQueTocanLaCola = 0; let temporizadores = 0;
for (const [fich, { sf }] of FUENTES) {
  recorrer(sf, (n) => {
    if (!ts.isCallExpression(n)) return;
    const f = n.expression;
    const esSchedule = ts.isPropertyAccessExpression(f) && f.name.text === 'schedule';
    const esIntervalo = ts.isIdentifier(f) && (f.text === 'setInterval' || f.text === 'setTimeout');
    if (!esSchedule && !esIntervalo) return;
    const dentro = new Set();
    let tocaModelo = false;
    n.arguments.forEach((a) => recorrer(a, (x) => {
      if (ts.isCallExpression(x)) { const c = x.expression; if (ts.isIdentifier(c)) dentro.add(c.text); }
      if (ts.isPropertyAccessExpression(x) && (x.name.text === 'vfSubmission' || x.name.text === 'vfFlujoObligado')) tocaModelo = true;
    }));
    const toca = tocaModelo || [...dentro].some((d) => COLA.has(d));
    if (esSchedule) {
      programados += 1; if (toca) programadosQueTocanLaCola += 1;
      out(`     ${fich}:${lineaDe(sf, n)} schedule(${n.arguments[0] ? n.arguments[0].getText(sf) : ''}) → llama a: ${[...dentro].filter((d) => !['String', 'Number', 'Date'].includes(d)).join(', ')}${toca ? '  ← TOCA LA COLA' : ''}`);
    } else { temporizadores += 1; if (toca) { programadosQueTocanLaCola += 1; out(`     ${fich}:${lineaDe(sf, n)} ${f.text} TOCA LA COLA`); } }
  });
}
out(`   .schedule(): ${programados} · setInterval/setTimeout: ${temporizadores} · de todos ellos, los que tocan la cola (llaman a una de sus piezas o al modelo): ${programadosQueTocanLaCola}`);
const registrados = (FUENTES.get('src/core/cron/cron.ts').texto.match(/^\s*programar\(/gm) ?? []).length;
control('los .schedule() vistos son los `programar(` de cron.ts', programados > 0 && programados === registrados, `${programados} vistos, ${registrados} registrados`);

// ── ⑤ los valores de status ─────────────────────────────────────────────────────────────
out('\n⑤ LOS VALORES DE status');
const esquema = fs.readFileSync(path.join(RAIZ, 'prisma/schema.prisma'), 'utf8');
const enumEsquema = (/enum VfSubmissionStatus \{([^}]*)\}/.exec(esquema)?.[1] ?? '').split(/\s+/).filter(Boolean);
const porDefecto = /status\s+VfSubmissionStatus\s+@default\((\w+)\)/.exec(esquema)?.[1] ?? null;
out(`   esquema · enum VfSubmissionStatus: ${enumEsquema.join(', ')} · @default(${porDefecto})`);
let constante = [];
recorrer(FUENTES.get('src/modules/fiscal/verifactu/sif.cola.ts').sf, (n) => {
  if (ts.isVariableDeclaration(n) && n.name.getText() === 'ESTADOS_VF_SUBMISSION') recorrer(n.initializer, (x) => { if (ts.isStringLiteralLike(x)) constante.push(x.text); });
});
out(`   código · ESTADOS_VF_SUBMISSION (sif.cola.ts): ${constante.join(', ')}`);
// Lo que las decisiones de la cola pueden devolver en `estado` (el procesador lo guarda con `status: d.estado`).
const decide = new Map();
recorrer(FUENTES.get('src/modules/fiscal/verifactu/sif.cola.ts').sf, (n) => {
  if (ts.isPropertyAssignment(n) && n.name.getText() === 'estado') {
    recorrer(n.initializer, (x) => { if (ts.isStringLiteralLike(x)) decide.set(x.text, [...(decide.get(x.text) ?? []), lineaDe(FUENTES.get('src/modules/fiscal/verifactu/sif.cola.ts').sf, n)]); });
  }
});
const escritos = new Map();
const anota = (v, d) => escritos.set(v, [...(escritos.get(v) ?? []), d]);
if (porDefecto) anota(porDefecto, 'prisma/schema.prisma @default');
for (const a of accesos.filter((x) => x.clase === 'ESCRIBE')) for (const e of a.estados) if (e.bajo === 'data' && !e.valor.startsWith('NO LITERAL')) anota(e.valor, a.donde);
for (const [v, ls] of decide) anota(v, `sif.cola.ts:${ls.join(',')} (decisión → sif.procesador.ts \`status: d.estado\`)`);
const leidos = new Map();
for (const a of accesos.filter((x) => x.clase === 'LEE')) for (const e of a.estados) if (e.bajo === 'where') leidos.set(e.valor, [...(leidos.get(e.valor) ?? []), a.donde]);
out('   valor · ¿lo escribe alguien? · ¿lo filtra una lectura? · líneas del máster que lo traen · de ellas, las que nombran VfSubmission');
for (const v of [...new Set([...enumEsquema, ...constante, ...escritos.keys()])]) {
  const lm = master.map((l, i) => (new RegExp(`(^|[^a-z_])${v}([^a-z_]|$)`).test(l) ? i + 1 : 0)).filter(Boolean);
  const conVf = lm.filter((i) => master[i - 1].includes('VfSubmission'));
  out(`     ${v.padEnd(14)} · escribe: ${(escritos.get(v) ?? ['NADIE']).join(' ; ')} · lectura con where: ${(leidos.get(v) ?? ['ninguna']).join(' ; ')} · máster: ${lm.length} líneas${lm.length && lm.length <= 6 ? ` (${lm.join(', ')})` : ''} · con VfSubmission: ${conVf.length}${conVf.length ? ` (${conVf.join(', ')})` : ''}`);
}
control('el enum del esquema y la constante del código son la misma lista', enumEsquema.length === 5 && enumEsquema.join() === constante.join(), `${enumEsquema.length} y ${constante.length}`);
control('`manual_review` sí está en el máster (el rastro ve)', master.some((l) => l.includes('manual_review')), 'aparece');

// ── ⑥ el detector de la casa ────────────────────────────────────────────────────────────
out('\n⑥ EL DETECTOR DE LA CASA (scripts/_guard-afirmacion-fiscal.mjs · envioConstruido, SCRUM-1128)');
const casa = await import(pathToFileURL(path.join(RAIZ, 'scripts/_guard-afirmacion-fiscal.mjs')).href);
const ec = casa.envioConstruido(RAIZ);
out(`   construido: ${ec.construido} · llamantes de enviarSobre: ${ec.llamantes.length} · flag ${ec.flag.nombre}: leído ${ec.flag.leido}, on ${ec.flag.on} · ficheros leídos: ${ec.ficherosLeidos} · líneas con host de la AEAT vistas: ${ec.vistosAeat} · esquema leído: ${ec.esquemaLeido}`);
out(`   señales: ${ec.señales.map((s) => `${s.tipo} @ ${s.donde}`).join(' · ') || '(ninguna)'}`);
control('el detector de la casa leyó la misma población', ec.ficherosLeidos === FICHEROS.length, `${ec.ficherosLeidos} y ${FICHEROS.length}`);
control('el detector de la casa no está ciego (ve el host de la AEAT)', ec.vistosAeat > 0, `${ec.vistosAeat} líneas`);
control('su detector de llamadas cuenta una llamada fabricada', casa.llamadasAlEnvio("import { enviarSobre } from './sif.client';\nexport const f = () => enviarSobre({} as any);\n") === 1, '1 en un fuente de prueba en memoria');
control('y no cuenta un `import type`', casa.llamadasAlEnvio("import type { enviarSobre } from './sif.client';\n// enviarSobre()\n") === 0, '0');

out(`\n${fallos.length ? `CIEGO: ${fallos.length} control(es) no salieron como debían → ${fallos.join(' | ')}` : 'CONTROLES: todos en su sitio'}`);
process.exit(fallos.length ? 1 : 0);
