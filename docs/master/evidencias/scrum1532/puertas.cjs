// docs/master/evidencias/scrum1532/puertas.cjs — SCRUM-1532
//
// QUIÉN TOCA UN COBRO, Y CON QUÉ ESTADO. Sólo LEE: no escribe en src/, ni en el esquema, ni en disco
// fuera de su propia salida estándar.
//
//     node docs/master/evidencias/scrum1532/puertas.cjs              (árbol real + siembra en memoria)
//     node docs/master/evidencias/scrum1532/puertas.cjs --sin-siembra  (tiene que decir CIEGO y salir 1)
//
// DOS SONDAS, de tipos distintos:
//
//   A · POR FORMA (AST, sin tipos). Toda expresión `<algo>.charge` o `<algo>['charge']` de src/:
//       · seguida de un método   → una PUERTA: método, y qué pone en `where.status` y en `data`
//                                  (literal, o el texto de la expresión/función/esparcido que lo trae);
//       · sin método detrás      → SUELTA: el delegado se escapa a una variable (o es una relación leída);
//       · una clave `charge`/`charges`/`Charge` con create/update/... dentro del `data` de OTRO modelo
//                                → ANIDADA;
//       · un texto con la tabla `charges` y un verbo SQL → SQL CRUDO.
//   B · POR TIPO (programa con tipos). Toda lectura `x.status` cuyo `status` es el de `$ChargePayload`
//       del cliente de Prisma. Es la que contesta «quién LEE el estado de un cobro» sin buscar la palabra.
//       NO VE lo que llega tipado `any`: esas lecturas se CUENTAN aparte y se quedan SIN JUZGAR.
//
// EL CONTROL. Una SIEMBRA EN MEMORIA (un fichero que no se escribe nunca en disco) con una escritura
// fabricada por cada forma, cada una con un valor que no existe (`zz1532_*`):
//   · árbol real, sin siembra → `zz1532` sale 0 veces                  (el CERO derivado)
//   · árbol real + siembra    → cada forma sale en SU sonda           (el POSITIVO)
//   · una lectura sembrada de `Invoice.status` NO sale como de cobro   (el CERO de la sonda B)
// Con `--sin-siembra` el positivo no puede aparecer: dice CIEGO y sale 1, no verde.
//
// NO VE: ninguna base de datos, ninguna pasarela, public/, las lecturas por desestructuración
// (`const { status } = cobro`), ni lo que llega por HTTP entre rutas (el reenvío a /webhooks/psp).
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const RAIZ = path.resolve(__dirname, '..', '..', '..', '..');
const SRC = path.join(RAIZ, 'src');
const SIN_SIEMBRA = process.argv.includes('--sin-siembra');
const JSON_OUT = process.argv.includes('--json');

const ESCRITURAS = new Set(['create', 'createMany', 'createManyAndReturn', 'update', 'updateMany', 'upsert', 'delete', 'deleteMany']);
const ANIDADAS = new Set(['create', 'createMany', 'update', 'updateMany', 'upsert', 'delete', 'deleteMany', 'connectOrCreate', 'set', 'connect', 'disconnect']);
const NOMBRE_SIEMBRA = path.join(SRC, '__siembra1532.ts');
const SIEMBRA = [
  "import { prisma } from './core/db/prisma';",
  'export async function siembra1532() {',
  "  await prisma.charge.update({ where: { id: 1, status: 'zz1532_where' }, data: { status: 'zz1532_literal' } });",
  '  await prisma.charge.updateMany({ where: { id: 1 }, data: { ...fabrica1532() } });',
  "  await (prisma as any)['charge'].update({ where: { id: 1 }, data: { status: 'zz1532_corchete' } });",
  "  await prisma.invoice.update({ where: { id: 1 }, data: { charge: { update: { status: 'zz1532_anidado' } } } });",
  "  await prisma.$executeRawUnsafe(\"UPDATE charges SET status = 'zz1532_sql' WHERE id = 1\");",
  '  const suelto = prisma.charge;',
  "  await suelto.update({ where: { id: 1 }, data: { status: 'zz1532_suelto' } });",
  '  const c = await prisma.charge.findUnique({ where: { id: 1 } });',
  "  if (c && c.status === 'zz1532_lectura') return 1;",
  '  const f = await prisma.invoice.findUnique({ where: { id: 1 } });',
  "  if (f && f.status === 'zz1532_otro_modelo') return 2;",
  '  const s = await prisma.charge.findFirst({ where: { id: 1 }, select: { status: true } });',
  "  if (s && s.status === 'zz1532_select') return 3;",
  '  const q = await prisma.invoice.findFirst({ where: { id: 1 }, select: { status: true, charge: { select: { status: true } } } });',
  "  if (q && q.charge && q.charge.status === 'zz1532_select_anidado') return 4;",
  "  if (q && q.status === 'zz1532_select_otro_modelo') return 5;",
  '  return 0;',
  '}',
  "function fabrica1532() { return { status: 'zz1532_fabrica' }; }",
  '',
].join('\n');

function ficherosTs(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) ficherosTs(p, acc);
    else if (e.name.endsWith('.ts') && !e.name.endsWith('.d.ts')) acc.push(p);
  }
  return acc;
}

const rel = (f) => path.relative(RAIZ, f).split(path.sep).join('/');
const linea = (sf, nodo) => sf.getLineAndCharacterOfPosition(nodo.getStart(sf)).line + 1;
const corto = (s, n = 110) => { const t = s.replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n) + '…' : t; };

function propiedad(obj, nombre) {
  if (!obj || !ts.isObjectLiteralExpression(obj)) return undefined;
  return obj.properties.find((p) => (ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p)) && p.name && p.name.getText() === nombre);
}

function describirObjeto(sf, expr) {
  // Qué trae un `data` o un `where`: claves, el valor de `status` y los esparcidos.
  if (!expr) return { forma: 'AUSENTE' };
  if (!ts.isObjectLiteralExpression(expr)) return { forma: 'EXPRESION', texto: corto(expr.getText(sf)) };
  const claves = [];
  const esparcidos = [];
  let status;
  for (const p of expr.properties) {
    if (ts.isSpreadAssignment(p)) esparcidos.push(corto(p.expression.getText(sf), 80));
    else if (p.name) {
      claves.push(p.name.getText(sf));
      if (p.name.getText(sf) === 'status') status = ts.isPropertyAssignment(p) ? corto(p.initializer.getText(sf), 80) : '(abreviada) status';
    }
  }
  return { forma: 'OBJETO', claves, esparcidos, status };
}

function sondaA(sf, salida) {
  const f = rel(sf.fileName);
  const visitar = (nodo) => {
    const esPunto = ts.isPropertyAccessExpression(nodo) && nodo.name.text === 'charge';
    const esCorchete = ts.isElementAccessExpression(nodo) && ts.isStringLiteralLike(nodo.argumentExpression) && nodo.argumentExpression.text === 'charge';
    if (esPunto || esCorchete) {
      const padre = nodo.parent;
      const receptor = corto(nodo.expression.getText(sf), 40);
      if (ts.isPropertyAccessExpression(padre) && padre.expression === nodo && ts.isCallExpression(padre.parent) && padre.parent.expression === padre) {
        const metodo = padre.name.text;
        const arg = padre.parent.arguments[0];
        const where = describirObjeto(sf, propiedad(arg, 'where') && propiedad(arg, 'where').initializer);
        const data = describirObjeto(sf, propiedad(arg, 'data') && propiedad(arg, 'data').initializer);
        salida.puertas.push({ f, l: linea(sf, nodo), receptor, metodo, escribe: ESCRITURAS.has(metodo), where, data, crudo: corto(padre.parent.getText(sf), 400) });
      } else {
        salida.sueltas.push({ f, l: linea(sf, nodo), texto: corto(padre.getText(sf), 120) });
      }
    }
    // ANIDADA: clave charge/charges/Charge con un verbo de escritura dentro, bajo una llamada de otro delegado.
    if (ts.isPropertyAssignment(nodo) && /^(charge|charges|Charge)$/.test(nodo.name.getText(sf)) && ts.isObjectLiteralExpression(nodo.initializer)) {
      const verbos = nodo.initializer.properties.map((p) => p.name && p.name.getText(sf)).filter((n) => ANIDADAS.has(n));
      if (verbos.length) salida.anidadas.push({ f, l: linea(sf, nodo), verbos, texto: corto(nodo.getText(sf), 160) });
    }
    // SQL CRUDO: un texto que nombra la tabla y trae un verbo.
    if (ts.isStringLiteralLike(nodo) || ts.isTemplateExpression(nodo)) {
      const t = nodo.getText(sf);
      if (/\bcharges\b/.test(t) && /\b(UPDATE|INSERT|DELETE|SELECT|FROM|JOIN)\b/.test(t)) salida.sql.push({ f, l: linea(sf, nodo), texto: corto(t, 160) });
    }
    if (ts.isCallExpression(nodo) || ts.isTaggedTemplateExpression(nodo)) {
      const callee = ts.isCallExpression(nodo) ? nodo.expression : nodo.tag;
      if (/\$(queryRaw|executeRaw)(Unsafe)?$/.test(callee.getText(sf))) salida.crudoTotal += 1;
    }
    ts.forEachChild(nodo, visitar);
  };
  visitar(sf);
}

function modeloDelSimbolo(sim) {
  // ¿De qué `$XxxPayload` del cliente de Prisma sale esta propiedad?
  const modelos = new Set();
  for (const d of (sim && sim.declarations) || []) {
    for (let n = d; n; n = n.parent) {
      if (ts.isTypeAliasDeclaration(n) && /^\$.+Payload$/.test(n.name.text)) { modelos.add(n.name.text.slice(1, -'Payload'.length)); break; }
    }
  }
  return [...modelos];
}

// Con `select` (o con una relación traída dentro de un `select`), el resultado NO es el payload de
// Prisma: es un tipo MAPEADO (`GetFindResult<P, A>`), y su `status` no tiene declaración ninguna. De
// qué modelo es lo sabe el MAPPER de ese tipo, que lleva P = `$ChargePayload`: se recorre y se lee el
// `name` del payload. La primera versión de esta sonda sólo miraba declaraciones y se dejaba fuera
// `chargesAdmin.routes.ts:53`, que es la guarda de «Confirmar Bizum»; lo cazó la siembra, en rojo.
// OJO: `links` y `mapper` son internos del compilador (TypeScript 5.9). Si cambian, los dos
// positivos «con select» de abajo caen: no puede romperse en silencio.
function modeloPorSelect(sim, checker) {
  const dichos = new Set();
  const recorrer = (mapper, prof) => {
    if (!mapper || prof > 8) return;
    for (const t of [mapper.target, ...(mapper.targets || [])]) {
      if (!t || !t.getProperty) continue;
      const nombre = t.getProperty('name');
      if (!nombre || !t.getProperty('scalars')) continue;
      const tn = checker.getTypeOfSymbol(nombre);
      if (typeof tn.value === 'string') dichos.add(tn.value);
    }
    recorrer(mapper.mapper1, prof + 1);
    recorrer(mapper.mapper2, prof + 1);
  };
  const mapeado = sim && sim.links && sim.links.mappedType;
  if (mapeado) recorrer(mapeado.mapper, 0);
  return [...dichos];
}
const ES_COBRO = /^Charge$/;

function sondaB(programa, salida) {
  const checker = programa.getTypeChecker();
  for (const sf of programa.getSourceFiles()) {
    if (sf.isDeclarationFile || !sf.fileName.replace(/\\/g, '/').startsWith(SRC.replace(/\\/g, '/'))) continue;
    const f = rel(sf.fileName);
    const visitar = (nodo) => {
      if (ts.isPropertyAccessExpression(nodo) && nodo.name.text === 'status') {
        salida.statusTotal += 1;
        const tipoReceptor = checker.getTypeAtLocation(nodo.expression);
        if (tipoReceptor.flags & ts.TypeFlags.Any) salida.statusAny.push({ f, l: linea(sf, nodo), texto: corto(nodo.getText(sf), 60) });
        else {
          const sim = checker.getSymbolAtLocation(nodo.name);
          const modelos = modeloDelSimbolo(sim);
          const porSelect = modelos.length ? [] : modeloPorSelect(sim, checker);
          for (const m of modelos) salida.statusPorModelo[m] = (salida.statusPorModelo[m] || 0) + 1;
          for (const m of porSelect) salida.statusPorSelect[m] = (salida.statusPorSelect[m] || 0) + 1;
          const l = linea(sf, nodo);
          const esLlamada = ts.isCallExpression(nodo.parent) && nodo.parent.expression === nodo;
          if (!modelos.length && !porSelect.length) {
            if (esLlamada) salida.statusLlamada += 1;
            else { salida.statusOtro += 1; salida.statusOtroPorFichero[f] = (salida.statusOtroPorFichero[f] || 0) + 1; }
          }
          if (modelos.includes('Charge') || porSelect.some((m) => ES_COBRO.test(m))) {
            salida.lecturas.push({ f, l, via: modelos.includes('Charge') ? 'payload' : 'select', texto: corto(sf.text.split(/\r?\n/)[l - 1], 150), tambien: modelos.filter((m) => m !== 'Charge') });
          }
        }
      }
      ts.forEachChild(nodo, visitar);
    };
    visitar(sf);
  }
}

function medir(conSiembra) {
  const ficheros = ficherosTs(SRC);
  const salida = { ficheros: ficheros.length, sinParsear: 0, puertas: [], sueltas: [], anidadas: [], sql: [], crudoTotal: 0, lecturas: [], statusTotal: 0, statusAny: [], statusOtro: 0, statusLlamada: 0, statusOtroPorFichero: {}, statusPorSelect: {}, statusPorModelo: {} };
  const config = ts.readConfigFile(path.join(RAIZ, 'tsconfig.json'), ts.sys.readFile);
  const opciones = ts.parseJsonConfigFileContent(config.config, ts.sys, RAIZ).options;
  opciones.noEmit = true;
  const host = ts.createCompilerHost(opciones, true);
  const leerOriginal = host.readFile.bind(host);
  const existeOriginal = host.fileExists.bind(host);
  const igual = (a) => path.resolve(a) === NOMBRE_SIEMBRA;
  if (conSiembra) {
    host.readFile = (n) => (igual(n) ? SIEMBRA : leerOriginal(n));
    host.fileExists = (n) => (igual(n) ? true : existeOriginal(n));
    const fuenteOriginal = host.getSourceFile.bind(host);
    host.getSourceFile = (n, v, e, c) => (igual(n) ? ts.createSourceFile(n, SIEMBRA, v, true) : fuenteOriginal(n, v, e, c));
  }
  const raices = conSiembra ? [...ficheros, NOMBRE_SIEMBRA] : ficheros;
  const programa = ts.createProgram(raices, opciones, host);
  for (const sf of programa.getSourceFiles()) {
    if (sf.isDeclarationFile || !sf.fileName.replace(/\\/g, '/').startsWith(SRC.replace(/\\/g, '/'))) continue;
    if (programa.getSyntacticDiagnostics(sf).length) salida.sinParsear += 1;
    sondaA(sf, salida);
  }
  sondaB(programa, salida);
  salida.conSiembra = conSiembra;
  salida.prismaResuelto = Boolean(salida.statusPorModelo.Charge || salida.statusPorModelo.Invoice);
  return salida;
}

const veces = (salida, aguja) => JSON.stringify(salida).split(aguja).length - 1;
const enSiembra = (x) => x.f === rel(NOMBRE_SIEMBRA);

function control(real, sembrado) {
  const filas = [];
  const pon = (nombre, ok, detalle) => filas.push({ nombre, ok: Boolean(ok), detalle });
  pon('CERO · el árbol real no trae ningún zz1532', veces(real, 'zz1532') === 0, `${veces(real, 'zz1532')} apariciones`);
  if (!sembrado) return { filas, ciego: true };
  const p = sembrado.puertas.filter(enSiembra);
  pon('POSITIVO · escritura con literal', p.some((x) => x.data.status === "'zz1532_literal'" && x.where.status === "'zz1532_where'"), 'data.status y where.status');
  pon('POSITIVO · escritura por fábrica (esparcido)', p.some((x) => (x.data.esparcidos || []).includes('fabrica1532()')), '...fabrica1532()');
  pon('POSITIVO · delegado por corchete', p.some((x) => x.data.status === "'zz1532_corchete'"), "['charge']");
  pon('POSITIVO · escritura anidada desde otro modelo', sembrado.anidadas.filter(enSiembra).some((x) => x.texto.includes('zz1532_anidado')), 'invoice → charge.update');
  pon('POSITIVO · SQL crudo', sembrado.sql.filter(enSiembra).some((x) => x.texto.includes('zz1532_sql')), 'UPDATE charges');
  pon('POSITIVO · delegado suelto', sembrado.sueltas.filter(enSiembra).some((x) => /suelto = prisma.charge/.test(x.texto)), 'const suelto = prisma.charge');
  const lect = sembrado.lecturas.filter(enSiembra);
  pon('POSITIVO · lectura tipada de Charge.status', lect.some((x) => x.texto.includes('zz1532_lectura')), `${lect.length} en la siembra`);
  pon('CERO · la lectura de Invoice.status NO sale como de cobro', !lect.some((x) => x.texto.includes('otro_modelo')), 'f.status y q.status');
  pon('POSITIVO · lectura de un cobro traído con select', lect.some((x) => x.texto.includes("'zz1532_select'") && x.via === 'select'), 'prisma.charge.findFirst({ select })');
  pon('POSITIVO · lectura de un cobro traído como relación con select', lect.some((x) => x.texto.includes('zz1532_select_anidado') && x.via === 'select'), 'invoice → charge: { select }');
  const quita = (s) => ({ ...s, puertas: s.puertas.filter((x) => !enSiembra(x)).length, sueltas: s.sueltas.filter((x) => !enSiembra(x)).length, anidadas: s.anidadas.filter((x) => !enSiembra(x)).length, sql: s.sql.filter((x) => !enSiembra(x)).length, lecturas: s.lecturas.filter((x) => !enSiembra(x)).length });
  const a = quita(sembrado); const b = quita(real);
  pon('La siembra no mueve lo demás', a.puertas === b.puertas && a.sueltas === b.sueltas && a.anidadas === b.anidadas && a.sql === b.sql && a.lecturas === b.lecturas, `puertas ${b.puertas}/${a.puertas} · lecturas ${b.lecturas}/${a.lecturas}`);
  return { filas, ciego: false };
}

function pintar(real, ctl) {
  const L = [];
  L.push(`POBLACION · ${real.ficheros} ficheros .ts de src/ · ${real.sinParsear} sin parsear · cliente de Prisma resuelto: ${real.prismaResuelto ? 'SI' : 'NO'}`);
  L.push('');
  L.push(`== A · PUERTAS: ${real.puertas.length} llamadas sobre el delegado de cobros (${real.puertas.filter((x) => x.escribe).length} escriben, ${real.puertas.filter((x) => !x.escribe).length} leen)`);
  for (const x of real.puertas.filter((y) => y.escribe)) {
    const d = x.data.forma === 'OBJETO' ? `data{${x.data.claves.join(',')}}${x.data.esparcidos.length ? ' +ESPARCE[' + x.data.esparcidos.join(' | ') + ']' : ''} status=${x.data.status ?? '—'}` : `data=${x.data.forma}${x.data.texto ? ' ' + x.data.texto : ''}`;
    const w = x.where.forma === 'OBJETO' ? `where{${x.where.claves.join(',')}} status=${x.where.status ?? '—'}` : `where=${x.where.forma}`;
    L.push(`  ESCRIBE ${x.f}:${x.l} ${x.metodo} · ${w} · ${d}`);
  }
  for (const x of real.puertas.filter((y) => !y.escribe)) {
    const w = x.where.forma === 'OBJETO' ? `where{${x.where.claves.join(',')}} status=${x.where.status ?? '—'}` : `where=${x.where.forma}${x.where.texto ? ' ' + x.where.texto : ''}`;
    L.push(`  LEE     ${x.f}:${x.l} ${x.metodo} · ${w}`);
  }
  L.push('');
  L.push(`== A · SUELTAS (\`.charge\` sin método detrás): ${real.sueltas.length}`);
  for (const x of real.sueltas) L.push(`  ${x.f}:${x.l} ${x.texto}`);
  L.push('');
  L.push(`== A · ANIDADAS desde otro modelo: ${real.anidadas.length}`);
  for (const x of real.anidadas) L.push(`  ${x.f}:${x.l} [${x.verbos.join(',')}] ${x.texto}`);
  L.push('');
  L.push(`== A · SQL CRUDO que nombra \`charges\`: ${real.sql.length} (de ${real.crudoTotal} usos de $queryRaw/$executeRaw en todo src/)`);
  for (const x of real.sql) L.push(`  ${x.f}:${x.l} ${x.texto}`);
  L.push('');
  L.push(`== B · LECTURAS TIPADAS de Charge.status: ${real.lecturas.length} (de ${real.statusTotal} accesos \`.status\` en src/)`);
  for (const x of real.lecturas) L.push(`  ${x.f}:${x.l} [${x.via}]${x.tambien.length ? ' (también ' + x.tambien.join('/') + ')' : ''} ${x.texto}`);
  L.push(`   por modelo: ${Object.entries(real.statusPorModelo).sort((a, b) => b[1] - a[1]).map(([m, n]) => `${m} ${n}`).join(' · ')}`);
  L.push(`   por select: ${Object.entries(real.statusPorSelect).sort((a, b) => b[1] - a[1]).map(([m, n]) => `${m} ${n}`).join(' · ')}`);
  L.push(`   FUERA: ${real.statusLlamada} son llamadas \`.status(…)\` (res.status) sobre algo que no es un modelo`);
  L.push(`   SIN JUZGAR: ${real.statusAny.length} accesos \`.status\` sobre un receptor \`any\` · ${real.statusOtro} lecturas sobre un tipo que no es un modelo de Prisma ni un select`);
  for (const [ff, n] of Object.entries(real.statusOtroPorFichero).sort((a, b) => b[1] - a[1])) L.push(`     otro · ${n} · ${ff}`);
  const anyPorFichero = {};
  for (const x of real.statusAny) anyPorFichero[x.f] = (anyPorFichero[x.f] || 0) + 1;
  for (const [f, n] of Object.entries(anyPorFichero).sort((a, b) => b[1] - a[1])) L.push(`     any · ${n} · ${f}`);
  L.push('');
  L.push('== CONTROL');
  for (const c of ctl.filas) L.push(`  ${c.ok ? 'OK  ' : 'FALLA'} ${c.nombre} — ${c.detalle}`);
  return L.join('\n');
}

const real = medir(false);
const sembrado = SIN_SIEMBRA ? null : medir(true);
const ctl = control(real, sembrado);
if (JSON_OUT) process.stdout.write(JSON.stringify({ real, control: ctl }, null, 1) + '\n');
else process.stdout.write(pintar(real, ctl) + '\n');
let salida = 0;
if (ctl.ciego) { process.stdout.write('CIEGO · sin siembra no hay positivo: este resultado no vale como verde\n'); salida = 1; }
else if (ctl.filas.some((c) => !c.ok)) { process.stdout.write('ROJO · algún control no se cumple\n'); salida = 1; }
else if (!real.prismaResuelto) { process.stdout.write('CIEGO · el cliente de Prisma no se resolvió: la sonda B no vio ningún modelo\n'); salida = 1; }
process.stdout.write(`EXIT=${salida}\n`);
process.exit(salida);
