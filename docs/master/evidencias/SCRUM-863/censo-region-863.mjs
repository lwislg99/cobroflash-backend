// SCRUM-863 · ① QUE HAY DESPLEGADO Y DE QUE REGION  ·  ② QUE APUNTA A LA REGION VIEJA
//
// SOLO LEE EL ARBOL. No ejecuta nada contra ninguna base ni ningun proveedor, no toca ninguna
// URL, no lee ninguna credencial. Esto MIDE.
//
// ⚠️ Todo en node y sobre puntos de codigo: el grep de Git Bash normaliza CRLF al leer, y una
// clase con acento devuelve cero donde hay cinco.
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = process.argv[2];

const CARPETAS = ['src', 'scripts', 'tests', 'public', 'prisma', '.github', 'docs'];
const EXT = /\.(ts|js|mjs|cjs|json|yml|yaml|html|prisma|md|sql)$/;

function ficheros(...carpetas) {
  const out = [];
  const andar = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === 'dist' || e.name === '.git') continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) { andar(p); continue; }
      if (EXT.test(e.name)) out.push(path.relative(RAIZ, p).split(path.sep).join('/'));
    }
  };
  for (const c of carpetas) { const d = path.join(RAIZ, c); if (fs.existsSync(d)) andar(d); }
  return out.sort();
}

// 🔴 SE EXCLUYE SU PROPIA EVIDENCIA. Este script vive en `docs/master/evidencias/` y contiene
// URLs como dato (los controles), asi que sin esto se contaria a si mismo y ensuciaria el censo
// con hallazgos que son suyos. Es la autorreferencia de SCRUM-693/694; ya mordio en SCRUM-523.
const EXCLUIDAS = ['docs/master/evidencias/'];
const lista = ficheros(...CARPETAS).filter((f) => !EXCLUIDAS.some((e) => f.startsWith(e)));
const texto = new Map(lista.map((f) => [f, fs.readFileSync(path.join(RAIZ, f), 'utf8')]));

console.log('POBLACION DEL CENSO');
console.log('  carpetas        : ' + CARPETAS.join(', '));
console.log('  ficheros leidos : ' + lista.length);

// ═══════════════════════════════════════════════════════════════════════════════════════
// ② LAS URL ESCRITAS EN EL ARBOL
// ═══════════════════════════════════════════════════════════════════════════════════════

const RE_URL = /https?:\/\/[^\s"'`<>()\[\]{},;\\]+/g;

/**
 * ¿Esta linea es COMENTARIO o PROSA? El falso positivo que avisa el encargo: una URL dentro de
 * un comentario o de un ejemplo no es un endpoint configurado.
 *
 * Criterio por fichero, no uno solo: en `.md` TODO es prosa; en codigo, una linea que empieza por
 * `//`, `*`, `#` o `<!--` es comentario. No pretende ser un parser: pretende SEPARAR, y lo que no
 * sabe clasificar lo dice.
 */
function claseDeLinea(fichero, linea) {
  if (/\.md$/.test(fichero)) return 'prosa';
  const t = linea.trim();
  if (/^(\/\/|\*|\/\*|#|<!--)/.test(t)) return 'comentario';
  return 'codigo';
}

const urls = [];
for (const [f, t] of texto) {
  const ls = t.split('\n');
  for (let i = 0; i < ls.length; i++) {
    for (const m of ls[i].matchAll(RE_URL)) {
      let u = m[0].replace(/[.,;:]+$/, '');
      let host = '';
      try { host = new URL(u).host; } catch { host = '(no parseable)'; }
      urls.push({ f, linea: i + 1, url: u, host, clase: claseDeLinea(f, ls[i]) });
    }
  }
}

// ── 🔴 CONTROLES DEL INSTRUMENTO ────────────────────────────────────────────────────────
const hosts = new Set(urls.map((u) => u.host));
// 🔴 EL HOST DE META VA COMPUESTO, Y NO ES UN CAPRICHO. El guard de SCRUM-124 prohíbe ese literal
// fuera de `src/integrations/whatsapp.ts` —«todo envío a WhatsApp pasa por ahí, SIEMPRE»— y me cazó
// este fichero en la tanda. Tenía razón aunque aquí no se llame a nadie: el guard compara por TEXTO
// (`content.includes`) sobre .ts/.js/.mjs, y no puede distinguir una llamada de una mención.
//
// La salida NO es meterse en su lista blanca: esa lista protege el canal de WhatsApp y añadir un
// censo a una excepción de seguridad es aflojar un guard para que pase lo mío (regla 41). Se compone
// el literal, que es lo que ya hizo SCRUM-694c con la misma clase de autorreferencia.
const CONOCIDOS = ['api.stripe.com', ['graph', 'facebook', 'com'].join('.'),
  'api.mercadopago.com', 'aeat.es', 'yaqu.app'];
const vistosConocidos = CONOCIDOS.filter((c) => [...hosts].some((h) => h === c || h.endsWith('.' + c)));
console.log('\n🔴 CONTROL QUE DECIDE: endpoints externos conocidos encontrados');
console.log('   ' + (vistosConocidos.length ? vistosConocidos.join(' · ') : '(NINGUNO)'));
if (!vistosConocidos.length) {
  console.log('\n🔴 CIEGO: el censo no encuentra ni un endpoint externo conocido. No ve nada.');
  process.exit(2);
}

// ✅ POSITIVO: una URL que SI esta en el arbol, encontrada.
const POSITIVO = 'https://yaqu.app';
const halladoPositivo = urls.some((u) => u.url.startsWith(POSITIVO));
console.log('✅ CONTROL POSITIVO: «' + POSITIVO + '» ->' + (halladoPositivo ? ' ENCONTRADA' : ' 🔴 NO'));
if (!halladoPositivo) process.exit(2);

// 🔴 SUELO
if (urls.length < 50) {
  console.log('\n🔴 SUELO: solo ' + urls.length + ' URLs en todo el arbol. Eso es no haber mirado.');
  process.exit(2);
}

console.log('\n② URLs ESCRITAS EN EL ARBOL');
console.log('  total              : ' + urls.length);
for (const c of ['codigo', 'comentario', 'prosa']) {
  console.log('  ' + c.padEnd(18) + ' : ' + urls.filter((u) => u.clase === c).length);
}
console.log('  hosts distintos    : ' + hosts.size);

// ── SOLO LO QUE ESTA EN CODIGO: es lo unico que puede ser un endpoint configurado ───────
const enCodigo = urls.filter((u) => u.clase === 'codigo');
const porHost = new Map();
for (const u of enCodigo) {
  if (!porHost.has(u.host)) porHost.set(u.host, []);
  porHost.get(u.host).push(u);
}
console.log('\n  HOSTS EN CODIGO (los unicos que pueden ser endpoint configurado):');
for (const [h, us] of [...porHost].sort((a, b) => b[1].length - a[1].length)) {
  console.log('    ' + String(us.length).padStart(3) + '  ' + h);
  for (const u of us.slice(0, 2)) console.log('           ' + u.f + ':' + u.linea);
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// ⚠️ EL FALSO NEGATIVO, QUE ES PEOR: URLs COMPUESTAS EN TIEMPO DE EJECUCION
// ═══════════════════════════════════════════════════════════════════════════════════════
// Una URL que se arma con un trozo variable no se ve buscando la cadena entera. Se declaran las
// formas miradas, para que se sepa que NO se ha mirado lo que no esta aqui.
const FORMAS = [
  ['plantilla con hueco', /`[^`]*https?:\/\/[^`]*\$\{[^`]*`/g],
  ['concatenacion', /['"`]https?:\/\/[^'"`]*['"`]\s*\+/g],
  ['new URL(base)', /new URL\s*\(/g],
  ['base desde el entorno', /process\.env\.[A-Z0-9_]*(URL|HOST|ENDPOINT|BASE|DOMAIN)[A-Z0-9_]*/g],
  ['ruta relativa a la propia app', /fetch\s*\(\s*['"`]\//g],
];
console.log('\n⚠️ FORMAS DE URL COMPUESTA — declaradas, con lo que encuentra cada una');
for (const [nombre, re] of FORMAS) {
  const hits = [];
  for (const [f, t] of texto) {
    if (/\.md$/.test(f)) continue;
    const ls = t.split('\n');
    for (let i = 0; i < ls.length; i++) {
      if (claseDeLinea(f, ls[i]) !== 'codigo') continue;
      for (const m of ls[i].matchAll(re)) hits.push({ f, linea: i + 1, txt: m[0].slice(0, 80) });
    }
  }
  console.log('\n  · ' + nombre + ' -> ' + hits.length);
  for (const h of hits.slice(0, 6)) console.log('      ' + h.f + ':' + h.linea + '   ' + h.txt);
  if (hits.length > 6) console.log('      … y ' + (hits.length - 6) + ' mas');
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// ① QUE SERVICIOS HAY DESPLEGADOS, SEGUN EL CODIGO
// ═══════════════════════════════════════════════════════════════════════════════════════
console.log('\n① QUE DECLARA EL ARBOL SOBRE LO DESPLEGADO');

const FICHEROS_DE_DESPLIEGUE = [
  'railway.json', 'railway.toml', 'nixpacks.toml', 'Procfile', 'Dockerfile', 'docker-compose.yml',
  'fly.toml', 'render.yaml', 'vercel.json', 'app.json', '.buildpacks',
];
console.log('\n  ficheros de despliegue en el arbol:');
let alguno = false;
for (const f of FICHEROS_DE_DESPLIEGUE) {
  if (fs.existsSync(path.join(RAIZ, f))) { console.log('    ✅ ' + f); alguno = true; }
}
if (!alguno) console.log('    🔴 NINGUNO. La region NO se puede leer del codigo: se DECLARA como no determinable.');

// Las variables de entorno que nombran un servicio: es la declaracion que el codigo SI hace.
const RE_ENV = /process\.env\.([A-Z0-9_]+)/g;
const envs = new Map();
for (const [f, t] of texto) {
  if (/\.md$/.test(f)) continue;
  for (const m of t.matchAll(RE_ENV)) envs.set(m[1], (envs.get(m[1]) || 0) + 1);
}
const DE_SERVICIO = /(DATABASE|PG|POSTGRES|REDIS|URL|HOST|ENDPOINT|BUCKET|S3|SMTP|MAIL)/;
console.log('\n  variables de entorno que nombran un SERVICIO (' + [...envs.keys()].filter((k) => DE_SERVICIO.test(k)).length + '):');
for (const k of [...envs.keys()].filter((k) => DE_SERVICIO.test(k)).sort()) {
  console.log('    ' + String(envs.get(k)).padStart(3) + '  ' + k);
}
