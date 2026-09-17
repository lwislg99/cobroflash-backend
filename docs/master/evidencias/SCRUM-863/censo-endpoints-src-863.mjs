// SCRUM-863 · ② afinado: que toca el CODIGO QUE CORRE, y por donde entran los proveedores.
//
// El censo general mira todo el arbol. Este mira solo `src/`, que es lo unico que se ejecuta en
// el servidor, y separa las DOS direcciones —que es lo que decide si algo «muere en silencio»:
//
//   · SALIENTE: hosts a los que la app LLAMA. Son de terceros y NO se mueven con nosotros.
//   · ENTRANTE: rutas que la app EXPONE para que la llamen (webhooks). Esas si dependen de a que
//     URL apunte el proveedor, y esa URL NO vive en el arbol: vive en la consola del proveedor.
//
// SOLO LEE. No ejecuta nada, no toca ninguna URL, no lee ninguna credencial.
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = process.argv[2];

function ts(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === 'dist') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { ts(p, out); continue; }
    if (/\.ts$/.test(e.name)) out.push(path.relative(RAIZ, p).split(path.sep).join('/'));
  }
  return out;
}
const lista = ts(path.join(RAIZ, 'src')).sort();
const texto = new Map(lista.map((f) => [f, fs.readFileSync(path.join(RAIZ, f), 'utf8')]));

console.log('POBLACION: ' + lista.length + ' ficheros .ts bajo src/');
if (lista.length < 50) { console.log('🔴 SUELO: eso no es el arbol. CIEGO.'); process.exit(2); }

const esComentario = (l) => /^\s*(\/\/|\*|\/\*)/.test(l);

// ── SALIENTE ───────────────────────────────────────────────────────────────────────────
const RE_URL = /https?:\/\/[^\s"'`<>()\[\]{},;\\]+/g;
const salientes = new Map();
for (const [f, t] of texto) {
  const ls = t.split('\n');
  for (let i = 0; i < ls.length; i++) {
    if (esComentario(ls[i])) continue;
    for (const m of ls[i].matchAll(RE_URL)) {
      let h = '';
      try { h = new URL(m[0].replace(/[.,;:]+$/, '')).host; } catch { h = m[0].slice(0, 46) + ' (con hueco)'; }
      if (!salientes.has(h)) salientes.set(h, []);
      salientes.get(h).push(f + ':' + (i + 1));
    }
  }
}
console.log('\n② SALIENTE — hosts que el codigo de src/ LLAMA (fuera de comentarios)');
if (!salientes.size) { console.log('  🔴 CIEGO: cero. src/ llama a proveedores, asi que esto es el instrumento.'); process.exit(2); }
for (const [h, d] of [...salientes].sort((a, b) => b[1].length - a[1].length)) {
  console.log('  ' + String(d.length).padStart(3) + '  ' + h);
  for (const x of d.slice(0, 3)) console.log('        ' + x);
}

// ── ENTRANTE ───────────────────────────────────────────────────────────────────────────
// Las rutas de webhook que la app expone. Se derivan de las declaraciones de ruta, no de una lista.
const RE_RUTA = /\b(?:app|router|r)\s*\.\s*(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/g;
const rutas = [];
for (const [f, t] of texto) {
  const ls = t.split('\n');
  for (let i = 0; i < ls.length; i++) {
    if (esComentario(ls[i])) continue;
    for (const m of ls[i].matchAll(RE_RUTA)) rutas.push({ f, linea: i + 1, verbo: m[1], ruta: m[2] });
  }
}
console.log('\n  rutas declaradas en src/: ' + rutas.length);

// 🔴 LOS WEBHOOKS SE MONTAN CON `app.use('/webhooks/...')`, NO CON `router.post('/webhook')`.
// La primera version buscaba la palabra en la RUTA y cazó seis rutas internas de admin que
// llevan «whatsapp» en el nombre —falsos positivos— mientras se dejaba fuera TODOS los webhooks
// de verdad, que es el peor modo de fallar en este censo: el punto 4 del ticket va justo de eso.
const RE_MONTAJE = /\b(?:app|router)\s*\.\s*use\s*\(\s*['"`](\/webhooks[^'"`]*)['"`]/g;
const montajes = [];
for (const [f, t] of texto) {
  const ls = t.split('\n');
  for (let i = 0; i < ls.length; i++) {
    if (esComentario(ls[i])) continue;
    for (const m of ls[i].matchAll(RE_MONTAJE)) montajes.push({ f, linea: i + 1, ruta: m[1], src: ls[i].trim().slice(0, 110) });
  }
}
console.log('\n② ENTRANTE — puntos de entrada que un PROVEEDOR llama');
console.log('   (la URL a la que apunta cada proveedor NO vive en el arbol: vive en su consola)');
if (!montajes.length) { console.log('  🔴 CIEGO: cero montajes de /webhooks. El detector no ve nada.'); process.exit(2); }
for (const m of montajes) console.log('  ' + m.ruta.padEnd(26) + m.f + ':' + m.linea);

const porRuta = rutas.filter((r) => /webhook|callback|notif|ipn/i.test(r.ruta));
console.log('\n  (y por si acaso, rutas cuyo PROPIO nombre dice webhook/callback/ipn: ' + porRuta.length + ')');
for (const r of porRuta) console.log('    ' + r.verbo.toUpperCase().padEnd(6) + r.ruta + '   ' + r.f + ':' + r.linea);

// ⚠️ EL FALSO NEGATIVO DECLARADO: el host de Stripe NO esta en el arbol. `new Stripe(clave)` lo
// compone dentro del paquete npm, asi que buscar «stripe.com» aqui da CERO y ese cero no
// significa «no hablamos con Stripe».
const usaStripe = [...texto].filter(([, t]) => /new Stripe\s*\(/.test(t)).map(([f]) => f);
console.log('\n⚠️ FALSO NEGATIVO DECLARADO — proveedores cuyo host NO se ve en el arbol');
console.log('  Stripe: `new Stripe(...)` en ' + usaStripe.length + ' fichero(s) — el host lo pone el SDK.');
for (const f of usaStripe) console.log('        ' + f);

// ── LA URL PROPIA: ¿de donde sale? ─────────────────────────────────────────────────────
// Si la app compone enlaces hacia si misma, de donde saca su base decide si la mudanza los rompe.
console.log('\n② LA BASE PROPIA — de donde saca la app su propia URL');
const RE_BASE = /process\.env\.([A-Z0-9_]*(?:PUBLIC|APP|BASE|SITE|SELF|PUBLIC_URL)[A-Z0-9_]*)/g;
const bases = new Map();
for (const [f, t] of texto) {
  const ls = t.split('\n');
  for (let i = 0; i < ls.length; i++) {
    if (esComentario(ls[i])) continue;
    for (const m of ls[i].matchAll(RE_BASE)) {
      if (!bases.has(m[1])) bases.set(m[1], []);
      bases.get(m[1]).push(f + ':' + (i + 1));
    }
  }
}
for (const [k, d] of bases) {
  console.log('  ' + k + '  (' + d.length + ')');
  for (const x of d.slice(0, 3)) console.log('        ' + x);
}
if (!bases.size) console.log('  (ninguna variable de base propia encontrada con este patron)');

// Y las auto-referencias ABSOLUTAS: `https://yaqu.app/...` escrito a pelo en src/.
const propias = [];
for (const [f, t] of texto) {
  const ls = t.split('\n');
  for (let i = 0; i < ls.length; i++) {
    if (esComentario(ls[i])) continue;
    if (/https?:\/\/(www\.)?yaqu\.app/.test(ls[i])) propias.push(f + ':' + (i + 1) + '   ' + ls[i].trim().slice(0, 100));
  }
}
console.log('\n  auto-referencias ABSOLUTAS a yaqu.app escritas en src/ (fuera de comentarios): ' + propias.length);
for (const p of propias.slice(0, 10)) console.log('        ' + p);
