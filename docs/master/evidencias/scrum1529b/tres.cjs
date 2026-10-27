// docs/master/evidencias/scrum1529b/tres.cjs — SCRUM-1529b
//
// LOS TRES CAMPOS DE ESTADO DEL MISMO CAJÓN QUE ParteTrabajo Y TeamMember:
// Merchant.status · EmailMessage.status · VfSubmission.status.
//
//     node docs/master/evidencias/scrum1529b/tres.cjs
//     node docs/master/evidencias/scrum1529b/tres.cjs --romper where|sin-siembra|sin-quitar   (tiene que salir 1)
//
// QUÉ REUTILIZA. Los valores del código (D), el @default y el rastro en el máster los da el instrumento
// de J5 (`../scrum1500c/cotejo-once.cjs`), sin tocar. Su D es la UNIÓN de lo declarado (una constante,
// un enum) y lo escrito: no separa las dos cosas, y la pregunta de este tramo es justo ésa.
//
// QUÉ AÑADE.
//   1. DECLARADO contra ESCRITO, por campo. «Declarado» = las fuentes `const` y `enum` de J5.
//      «Escrito» = los literales de Prisma de J5 + el @default si alguna creación no pone el campo +
//      las PUERTAS de abajo, que son por donde entra el valor cuando Prisma recibe una expresión
//      (`constancia.estado`, `d.estado`). Cada expresión no literal que J5 imprime tiene que estar
//      explicada por una puerta declarada aquí: si aparece una que no, el campo sale CIEGO.
//   2. QUIÉN LLAMA a la función que escribe: llamadas por nombre en src/. Un valor puede tener una
//      línea que lo escribe dentro de una función que nadie llama.
//   3. CONTROLES SEMBRADOS, en una copia del árbol FUERA del repositorio:
//        A · una escritura de Prisma fabricada por campo (`zz1529b_<delegado>`): árbol real 0, copia
//            sin siembra 0, copia sembrada en SU campo y en ningún otro.
//        B · el caso que decide: se le QUITA a la copia el escritor de un valor declarado. Ese valor
//            tiene que salir en «declarado y nadie lo escribe» de su campo, y sólo ahí.
//        C · una llamada fabricada a la función sin llamadores: el contador tiene que pasar de 0 a 1.
//
// NO VE: SQL crudo, las TRANSICIONES, ninguna base de datos, ni si una ruta montada recibe tráfico.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const REAL = path.resolve(__dirname, '..', '..', '..', '..');
const MARCA = (delegado) => `zz1529b_${delegado}`;
const SIEMBRA = path.join('src', 'sonda1529b-siembra.ts');

const TRES = [
  { campo: 'Merchant.status', delegado: 'merchant', puertas: [], explica: [], llamadores: [] },
  { campo: 'EmailMessage.status', delegado: 'emailMessage',
    puertas: [
      { tipo: 'propEnFuncion', fichero: 'src/modules/messaging/domain/constanciaCorreo.ts', funcion: 'constanciaDeEnvio', propiedad: 'estado' },
      { tipo: 'propEnFuncion', fichero: 'src/modules/messaging/domain/constanciaCorreo.ts', funcion: 'constanciaDeFallo', propiedad: 'estado' },
      { tipo: 'valoresDeObjeto', fichero: 'src/integrations/firmaResend.ts', nombre: 'EVENTOS_RESEND' },
    ],
    explica: [
      { re: /^constancia\.estado$/, por: 'constanciaDeEnvio / constanciaDeFallo (se comprueba abajo que toda llamada a registrarEnvio trae una de las dos)' },
      { re: /^avanzar\(fila\.status as EstadoCorreo, estado\)$/, por: 'EVENTOS_RESEND: avanzar() devuelve el aviso o lo que ya había, nunca un valor nuevo' },
    ],
    constanciaDe: { funcion: 'registrarEnvio', propiedad: 'constancia', fabricas: ['constanciaDeEnvio', 'constanciaDeFallo'] },
    llamadores: ['registrarEnvio', 'aplicarAvisoDeProveedor', 'estadoDelAviso'] },
  { campo: 'VfSubmission.status', delegado: 'vfSubmission',
    puertas: [{ tipo: 'propEnFichero', fichero: 'src/modules/fiscal/verifactu/sif.cola.ts', propiedad: 'estado' }],
    explica: [{ re: /^d\.estado$/, por: 'las decisiones de sif.cola.ts (decidirTrasEnvio, recuperarEnviadoSinCierre)' }],
    llamadores: ['encolarAltaTrasSellado', 'procesarObligado', 'decidirTrasEnvio', 'recuperarEnviadoSinCierre'] },
];

// ───────────────────────────── modo --leer <raíz>: UNA lectura de UN árbol, en JSON ─────────────────────────────
function leerArbol(raiz) {
  const ts = require(require.resolve('typescript', { paths: [REAL, process.cwd()] }));
  const once = require(path.join(raiz, 'docs', 'master', 'evidencias', 'scrum1500c', 'cotejo-once.cjs'));
  const r = once.cotejarOnce();
  const rel = (f) => path.relative(raiz, f).replace(/\\/g, '/');
  const lista = [];
  (function anda(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) anda(p); else if (e.name.endsWith('.ts') && !e.name.endsWith('.d.ts')) lista.push(p);
    }
  })(path.join(raiz, 'src'));
  const arboles = new Map(); let sinParsear = 0;
  for (const f of lista) { try { arboles.set(rel(f), ts.createSourceFile(f, fs.readFileSync(f, 'utf8'), ts.ScriptTarget.Latest, true)); } catch { sinParsear += 1; } }
  const linea = (sf, n) => sf.getLineAndCharacterOfPosition(n.getStart()).line + 1;
  const desnuda = (e) => { let x = e; while (x && (ts.isAsExpression(x) || ts.isParenthesizedExpression(x))) x = x.expression; return x; };
  const hojas = (e, out = []) => {
    const x = desnuda(e);
    if (!x) return out;
    if (ts.isStringLiteral(x) || ts.isNoSubstitutionTemplateLiteral(x)) out.push({ valor: x.text });
    else if (ts.isConditionalExpression(x)) { hojas(x.whenTrue, out); hojas(x.whenFalse, out); } else out.push({ noLiteral: x.getText().replace(/\s+/g, ' ').slice(0, 60) });
    return out;
  };
  const nombreDe = (callee) => (ts.isIdentifier(callee) ? callee.text : (ts.isPropertyAccessExpression(callee) ? callee.name.text : null));

  function leerPuerta(p) {
    const sf = arboles.get(p.fichero);
    const o = { de: '', valores: [], sitios: [], noLit: [], ciego: null };
    if (!sf) { o.de = `${p.tipo} en ${p.fichero}`; o.ciego = `no pude leer ${p.fichero}`; return o; }
    const toma = (n, ini) => { for (const h of hojas(ini)) { if (h.valor !== undefined) { o.valores.push(h.valor); o.sitios.push(`${p.fichero}:${linea(sf, n)} '${h.valor}'`); } else o.noLit.push(`${p.fichero}:${linea(sf, n)} ${h.noLiteral}`); } };
    const props = (raizNodo) => (function ver(n) { if (ts.isPropertyAssignment(n) && ts.isIdentifier(n.name) && n.name.text === p.propiedad) toma(n, n.initializer); ts.forEachChild(n, ver); })(raizNodo);
    if (p.tipo === 'propEnFuncion') {
      o.de = `la propiedad «${p.propiedad}» dentro de ${p.funcion}() en ${p.fichero}`;
      let cuerpo = null;
      (function ver(n) { if (ts.isFunctionDeclaration(n) && n.name && n.name.text === p.funcion) cuerpo = n; ts.forEachChild(n, ver); })(sf);
      if (!cuerpo) o.ciego = `no encuentro la función ${p.funcion}`; else props(cuerpo);
    } else if (p.tipo === 'propEnFichero') {
      o.de = `toda propiedad «${p.propiedad}» de un objeto literal en ${p.fichero}`;
      props(sf);
    } else if (p.tipo === 'valoresDeObjeto') {
      o.de = `los VALORES del objeto ${p.nombre} en ${p.fichero}`;
      let ini = null;
      (function ver(n) { if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === p.nombre && n.initializer) ini = n.initializer; ts.forEachChild(n, ver); })(sf);
      let obj = desnuda(ini);
      if (obj && ts.isCallExpression(obj) && obj.arguments[0]) obj = desnuda(obj.arguments[0]); // Object.freeze({…})
      if (!obj || !ts.isObjectLiteralExpression(obj)) o.ciego = `no encuentro ${p.nombre} como objeto literal`;
      else for (const q of obj.properties) if (ts.isPropertyAssignment(q)) toma(q, q.initializer);
    }
    if (!o.ciego && o.valores.length === 0) o.ciego = 'la puerta no trae ningún literal';
    o.valores = [...new Set(o.valores)].sort();
    return o;
  }

  // Una pasada: llamadas por nombre, y la forma de cada escritura de Prisma sobre los tres delegados.
  const quiero = new Set(TRES.flatMap((t) => [...t.llamadores, ...(t.constanciaDe ? [t.constanciaDe.funcion] : [])]));
  const llamadas = new Map(); const escrituras = new Map();
  const ESCRIBE = new Set(['create', 'update', 'upsert', 'createMany', 'updateMany', 'createManyAndReturn']);
  for (const [fichero, sf] of arboles) {
    (function ver(n) {
      if (ts.isCallExpression(n)) {
        const nombre = nombreDe(n.expression);
        if (nombre && quiero.has(nombre)) { if (!llamadas.has(nombre)) llamadas.set(nombre, []); llamadas.get(nombre).push({ sf, nodo: n, sitio: `${fichero}:${linea(sf, n)}` }); }
        const c = n.expression;
        if (ts.isPropertyAccessExpression(c) && ESCRIBE.has(c.name.text) && ts.isPropertyAccessExpression(c.expression)) {
          const d = c.expression.name.text;
          if (!escrituras.has(d)) escrituras.set(d, []);
          escrituras.get(d).push({ metodo: c.name.text, nodo: n, sitio: `${fichero}:${linea(sf, n)}` });
        }
      }
      ts.forEachChild(n, ver);
    })(sf);
  }

  const campos = {};
  for (const t of TRES) {
    const f = r.filas.find((x) => !x.control && x.id === t.campo);
    if (!f) { campos[t.campo] = { ciego: ['el instrumento de J5 no devuelve este campo'] }; continue; }
    const nombreCampo = t.campo.split('.')[1];
    const ciego = [];
    const fuentesJ5 = f.fuentes.map((x) => ({ de: x.de, valores: [...x.valores].sort(), sitios: x.sitios, noLit: x.noLit, ciego: x.ciego || null }));
    const prismaLit = new Set(f.fuentes.filter((x) => x.de.startsWith('escrituras de Prisma')).flatMap((x) => [...x.valores]));
    const noLit = f.fuentes.filter((x) => x.de.startsWith('escrituras de Prisma')).flatMap((x) => x.noLit);
    const fDecl = f.fuentes.filter((x) => /^(const|enum) /.test(x.de));
    const declarado = fDecl.length ? [...new Set(fDecl.flatMap((x) => [...x.valores]))].sort() : null;
    const puertas = t.puertas.map(leerPuerta);
    for (const p of puertas) if (p.ciego) ciego.push(`${p.de}: ${p.ciego}`);
    // Cada expresión no literal de J5, explicada o CIEGO.
    const explicadas = noLit.map((s) => { const expr = s.replace(/^\S+ /, ''); const e = t.explica.find((x) => x.re.test(expr)); if (!e) ciego.push(`expresión sin puerta declarada: ${s}`); return { sitio: s, por: e ? e.por : null }; });
    // Las creaciones que NO ponen el campo escriben el @default; y los derrames que podrían traerlo.
    const porDefecto = []; const derrames = []; const dataNoLiteral = [];
    for (const e of escrituras.get(t.delegado) || []) {
      const a0 = desnuda(e.nodo.arguments[0]);
      if (!a0 || !ts.isObjectLiteralExpression(a0)) { dataNoLiteral.push(`${e.sitio} ${e.metodo}(<no literal>)`); continue; }
      for (const clave of ['data', 'create', 'update']) {
        const pr = a0.properties.find((q) => q.name && ts.isIdentifier(q.name) && q.name.text === clave);
        if (!pr) continue;
        const obj = ts.isPropertyAssignment(pr) ? desnuda(pr.initializer) : null;
        if (!obj || !ts.isObjectLiteralExpression(obj)) { dataNoLiteral.push(`${e.sitio} ${e.metodo}.${clave}: ${(ts.isPropertyAssignment(pr) ? pr.initializer.getText() : pr.name.text).replace(/\s+/g, ' ').slice(0, 50)}`); continue; }
        const lleva = obj.properties.some((q) => q.name && ts.isIdentifier(q.name) && q.name.text === nombreCampo);
        for (const q of obj.properties) if (ts.isSpreadAssignment(q)) derrames.push({ sitio: `${e.sitio} ${e.metodo}.${clave}`, texto: q.getText().replace(/\s+/g, ' ').slice(0, 70), nombraElCampo: new RegExp(`(^|[^A-Za-z0-9_])${nombreCampo}([^A-Za-z0-9_]|$)`).test(q.getText()) });
        const crea = (e.metodo.startsWith('create') && clave === 'data') || (e.metodo === 'upsert' && clave === 'create');
        if (crea && !lleva) porDefecto.push(`${e.sitio} ${e.metodo} sin «${nombreCampo}»`);
      }
    }
    // Toda llamada a registrarEnvio trae una constancia de una de las dos fábricas.
    let constancias = null;
    if (t.constanciaDe) {
      const cs = llamadas.get(t.constanciaDe.funcion) || [];
      const fuera = [];
      for (const c of cs) {
        const a0 = desnuda(c.nodo.arguments[0]);
        const pr = a0 && ts.isObjectLiteralExpression(a0) ? a0.properties.find((q) => q.name && ts.isIdentifier(q.name) && q.name.text === t.constanciaDe.propiedad) : null;
        let expr = pr ? desnuda(ts.isPropertyAssignment(pr) ? pr.initializer : pr.name) : null;
        if (expr && ts.isIdentifier(expr)) {
          const nombre = expr.text; const antes = c.nodo.getStart(); let mejor = null;
          (function ver(n) { if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === nombre && n.initializer && n.getStart() < antes && (!mejor || n.getStart() > mejor.getStart())) mejor = n; ts.forEachChild(n, ver); })(c.sf);
          expr = mejor ? desnuda(mejor.initializer) : expr;
        }
        const ok = expr && ts.isCallExpression(expr) && t.constanciaDe.fabricas.includes(nombreDe(expr.expression));
        if (!ok) fuera.push(`${c.sitio} ${expr ? expr.getText().replace(/\s+/g, ' ').slice(0, 50) : '(sin constancia)'}`);
      }
      constancias = { total: cs.length, fuera };
      if (cs.length === 0) ciego.push(`ninguna llamada a ${t.constanciaDe.funcion}()`);
      for (const x of fuera) ciego.push(`constancia que no sale de una fábrica declarada: ${x}`);
    }
    const escrito = new Set([...prismaLit, ...puertas.flatMap((p) => p.valores), ...(f.defecto && porDefecto.length ? [f.defecto] : [])]);
    campos[t.campo] = {
      lineaEsquema: f.campoEn, veredictoJ5: f.veredicto, defecto: f.defecto, D: f.D, fuentesJ5, declarado,
      prismaLiteral: [...prismaLit].sort(), puertas, explicadas, porDefecto, derrames, dataNoLiteral, constancias,
      escrito: [...escrito].sort(),
      declaradoSinEscribir: declarado ? declarado.filter((x) => !escrito.has(x)) : null,
      escritoSinDeclarar: declarado ? [...escrito].filter((x) => !declarado.includes(x)).sort() : null,
      llamadores: Object.fromEntries(t.llamadores.map((n) => [n, (llamadas.get(n) || []).map((c) => c.sitio)])),
      rastroMaster: f.rastroSinMaster, ciego,
    };
  }
  return { raiz, poblacion: { ficheros: lista.length, sinParsear, escriturasVistas: r.B.escriturasVistas, lineasMaster: r.lineasMaster.length }, campos };
}

if (process.argv[2] === '--leer') { console.log(JSON.stringify(leerArbol(path.resolve(process.argv[3])))); process.exit(0); }

// ───────────────────────────────────────────── el modo normal ─────────────────────────────────────────────
const romper = process.argv[2] === '--romper' ? process.argv[3] : null;

function leer(raiz) {
  const entorno = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP, TMP: process.env.TMP };
  const salida = execFileSync(process.execPath, [path.join(raiz, 'docs', 'master', 'evidencias', 'scrum1529b', 'tres.cjs'), '--leer', raiz], { cwd: REAL, env: entorno, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return JSON.parse(salida);
}

function copiar(destino) {
  for (const rel of ['src', path.join('prisma', 'schema.prisma'), path.join('docs', 'YAQU_MASTER.md'),
    path.join('docs', 'master', 'evidencias', 'scrum1500'), path.join('docs', 'master', 'evidencias', 'scrum1500c'), path.join('docs', 'master', 'evidencias', 'scrum1529b')]) {
    fs.cpSync(path.join(REAL, rel), path.join(destino, rel), { recursive: true });
  }
}

/** Siembra A (una escritura de Prisma por campo) y C (una llamada a la función sin llamadores). */
function sembrarAC(destino) {
  if (romper === 'sin-siembra') return;
  const lineas = TRES.map((t) => {
    const campo = t.campo.split('.')[1]; const v = MARCA(t.delegado);
    return romper === 'where'
      ? `  await prisma.${t.delegado}.update({ where: { id: 1, ${campo}: '${v}' }, data: { id: 1 } });`
      : `  await prisma.${t.delegado}.update({ where: { id: 1 }, data: { ${campo}: '${v}' } });`;
  });
  fs.writeFileSync(path.join(destino, SIEMBRA), `// SIEMBRA de SCRUM-1529b: no es código del producto.\nexport async function siembra(prisma: any, procesarObligado: any) {\n${lineas.join('\n')}\n  await procesarObligado('zz1529b', null);\n}\n`);
}
const marcasEnDisco = (destino) => { const f = path.join(destino, SIEMBRA); if (!fs.existsSync(f)) return 0; const t = fs.readFileSync(f, 'utf8'); return TRES.filter((x) => t.includes(`'${MARCA(x.delegado)}'`)).length; };

/** Siembra B: se le quita a la copia el escritor de UN valor declarado, en los dos campos que declaran una lista. */
const QUITAR = [
  { campo: 'EmailMessage.status', valor: 'reclamado', fichero: path.join('src', 'integrations', 'firmaResend.ts'), de: "'email.complained': 'reclamado'", a: "'email.complained': 'rebotado'" },
  { campo: 'VfSubmission.status', valor: 'rejected', fichero: path.join('src', 'modules', 'fiscal', 'verifactu', 'sif.cola.ts'), de: "estado: 'rejected'", a: "estado: 'manual_review'" },
];
function quitarEscritores(destino) {
  const hechos = {};
  for (const q of QUITAR) {
    const f = path.join(destino, q.fichero); const antes = fs.readFileSync(f, 'utf8');
    const n = antes.split(q.de).length - 1;
    if (romper !== 'sin-quitar') fs.writeFileSync(f, antes.split(q.de).join(q.a));
    hechos[q.campo] = { cambios: n, quedan: fs.readFileSync(f, 'utf8').split(q.de).length - 1 };
  }
  return hechos;
}

const dondeD = (r, v) => Object.keys(r.campos).filter((id) => (r.campos[id].D || []).includes(v));
const dondeEscrito = (r, v) => Object.keys(r.campos).filter((id) => (r.campos[id].escrito || []).includes(v));
const dondeSinEscribir = (r, v) => Object.keys(r.campos).filter((id) => (r.campos[id].declaradoSinEscribir || []).includes(v));

function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'yaqu-1529b-'));
  let mal = 0;
  const pinta = (s) => console.log(s);
  try {
    const real = leer(REAL);
    copiar(tmp);
    const limpia = leer(tmp);
    sembrarAC(tmp);
    const marcas = marcasEnDisco(tmp);
    const sembrada = marcas === TRES.length ? leer(tmp) : null;
    const quitados = quitarEscritores(tmp);
    const sinEscritor = leer(tmp);

    pinta(`POBLACION: ${TRES.length} campos · árbol real: ${real.poblacion.ficheros} ficheros .ts bajo src/ (${real.poblacion.sinParsear} sin parsear), ${real.poblacion.escriturasVistas} escrituras de Prisma vistas, máster ${real.poblacion.lineasMaster} líneas`);
    pinta(`           copia sembrada: ${sembrada ? `${sembrada.poblacion.ficheros} ficheros .ts, ${sembrada.poblacion.escriturasVistas} escrituras` : 'NO SE LEYÓ'} · marcas de la siembra A en disco: ${marcas} de ${TRES.length}${romper ? ` · 🔧 ROTO A PROPÓSITO: ${romper}` : ''}`);
    if (real.poblacion.ficheros === 0 || real.poblacion.sinParsear !== 0) { pinta('🔴 CIEGO: población vacía o con ficheros sin parsear'); mal += 1; }
    if (!sembrada) { pinta('🔴 CIEGO: la siembra A no llegó al disco; sus controles no valen'); mal += 1; }

    for (const t of TRES) {
      const c = real.campos[t.campo];
      pinta(`\n=== ${t.campo} (esquema, línea ${c.lineaEsquema}) · J5 dice ${c.veredictoJ5}`);
      if (c.ciego.length) { mal += 1; for (const x of c.ciego) pinta(`    🔴 CIEGO: ${x}`); }
      pinta(`    J5, unión D     : ${c.D.join(' | ')}   · @default ${c.defecto || '(ninguno)'}`);
      pinta(`    DECLARADO       : ${c.declarado ? c.declarado.join(' | ') : '(ninguna lista ni enum: el campo es un String sin vocabulario declarado)'}`);
      pinta(`    ESCRITO         : ${c.escrito.join(' | ') || '(nada)'}`);
      pinta(`      · literal dentro de Prisma: ${c.prismaLiteral.join(' | ') || '(ninguno)'}`);
      for (const f of c.fuentesJ5.filter((x) => x.de.startsWith('escrituras de Prisma'))) for (const s of f.sitios) pinta(`          ${s}`);
      pinta(`      · por el @default (creaciones que no ponen el campo): ${c.porDefecto.length ? c.defecto : '(ninguna)'}`);
      for (const s of c.porDefecto) pinta(`          ${s}`);
      for (const p of c.puertas) { pinta(`      · PUERTA ${p.de}: ${p.valores.join(' | ') || '(nada)'}`); for (const s of p.sitios) pinta(`          ${s}`); for (const s of p.noLit) pinta(`          (no literal) ${s}`); }
      for (const e of c.explicadas) pinta(`      · expresión en Prisma ${e.sitio}  ← ${e.por || '🔴 SIN PUERTA'}`);
      if (c.constancias) pinta(`      · llamadas a registrarEnvio(): ${c.constancias.total}, con la constancia fuera de las dos fábricas: ${c.constancias.fuera.length}`);
      pinta(`      · derrames en escrituras de ${t.delegado}: ${c.derrames.length}, que nombran el campo: ${c.derrames.filter((d) => d.nombraElCampo).length} · escrituras con el dato no literal: ${c.dataNoLiteral.length}`);
      for (const d of c.derrames.filter((x) => x.nombraElCampo)) pinta(`          🔴 ${d.sitio} ${d.texto}`);
      for (const d of c.dataNoLiteral) pinta(`          (dato no literal: se lee a mano) ${d}`);
      pinta(`    ⚠️ DECLARADO Y NADIE LO ESCRIBE: ${c.declaradoSinEscribir ? (c.declaradoSinEscribir.join(', ') || 'NINGUNO') : 'no aplica (no hay lista declarada)'}`);
      if (c.escritoSinDeclarar && c.escritoSinDeclarar.length) pinta(`    🔴 ESCRITO Y NO DECLARADO: ${c.escritoSinDeclarar.join(', ')}`);
      for (const [fn, sitios] of Object.entries(c.llamadores)) pinta(`    llamadas a ${fn}() en src/: ${sitios.length}${sitios.length ? ` → ${sitios.slice(0, 4).join(', ')}${sitios.length > 4 ? ', …' : ''}` : ''}`);
      pinta(`    máster          : ${Object.entries(c.rastroMaster || {}).map(([k, ls]) => `«${k}» ${ls.length}`).join(' · ')}   (líneas del máster donde sale la palabra entera; J5)`);
    }

    pinta('\n=== CONTROL A · una escritura de Prisma sembrada por campo ===');
    let vistos = 0;
    for (const t of TRES) {
      const v = MARCA(t.delegado);
      const a = dondeD(real, v).length + dondeEscrito(real, v).length;
      const b = dondeD(limpia, v).length + dondeEscrito(limpia, v).length;
      const s = sembrada ? [dondeD(sembrada, v), dondeEscrito(sembrada, v)] : null;
      const iguales = JSON.stringify(real.campos[t.campo].escrito) === JSON.stringify(limpia.campos[t.campo].escrito) && JSON.stringify(real.campos[t.campo].D) === JSON.stringify(limpia.campos[t.campo].D);
      const bien = a === 0 && b === 0 && s && s.every((x) => x.length === 1 && x[0] === t.campo) && iguales;
      if (bien) vistos += 1; else mal += 1;
      pinta(`${bien ? 'VE    ' : '🔴 MAL'} ${t.campo}: «${v}» árbol real ${a} (0) · copia sin siembra ${b} (0) · sembrada: en D de [${s ? s[0].join(', ') : 'CIEGO'}], en ESCRITO de [${s ? s[1].join(', ') : 'CIEGO'}] (sólo ${t.campo}) · copia sin siembra igual que el árbol real: ${iguales ? 'sí' : 'NO'}`);
    }
    pinta(`${vistos} de ${TRES.length}`);

    pinta('\n=== CONTROL B · el caso que decide: quitarle a la copia el escritor de un valor declarado ===');
    let vistosB = 0;
    for (const q of QUITAR) {
      const h = quitados[q.campo];
      const a = dondeSinEscribir(real, q.valor); const b = dondeSinEscribir(limpia, q.valor); const s = dondeSinEscribir(sinEscritor, q.valor);
      const bien = h.cambios > 0 && h.quedan === 0 && a.length === 0 && b.length === 0 && s.length === 1 && s[0] === q.campo;
      if (bien) vistosB += 1; else mal += 1;
      pinta(`${bien ? 'VE    ' : '🔴 MAL'} ${q.campo}: quitado «${q.valor}» de ${q.fichero.replace(/\\/g, '/')} (${h.cambios} sitio(s) cambiados, quedan ${h.quedan}) · «declarado y nadie lo escribe» lo nombra: árbol real [${a.join(', ')}] (vacío) · copia sin tocar [${b.join(', ')}] (vacío) · copia sin escritor [${s.join(', ')}] (sólo ${q.campo})`);
    }
    pinta(`${vistosB} de ${QUITAR.length} · Merchant.status no tiene lista declarada: no hay valor que quitarle, y se dice.`);

    pinta('\n=== CONTROL C · el contador de llamadas ===');
    const n0 = real.campos['VfSubmission.status'].llamadores.procesarObligado.length;
    const n1 = limpia.campos['VfSubmission.status'].llamadores.procesarObligado.length;
    const n2 = sembrada ? sembrada.campos['VfSubmission.status'].llamadores.procesarObligado.length : null;
    const pos = real.campos['VfSubmission.status'].llamadores.encolarAltaTrasSellado.length;
    const bienC = n2 !== null && n2 === n0 + 1 && n1 === n0 && pos > 0;
    if (!bienC) mal += 1;
    pinta(`${bienC ? 'VE    ' : '🔴 MAL'} llamadas a procesarObligado(): árbol real ${n0} · copia sin siembra ${n1} · copia con una llamada sembrada ${n2 === null ? 'CIEGO' : n2} (tiene que ser una más) · positivo del árbol real: encolarAltaTrasSellado() tiene ${pos} (> 0)`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  pinta(`\nEXIT=${mal ? 1 : 0}`);
  process.exit(mal ? 1 : 0);
}

main();
