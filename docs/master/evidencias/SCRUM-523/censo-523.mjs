// ② QUE EXISTE HOY DE LA DECLARACION RESPONSABLE, con fichero y linea en cada afirmacion.
//
// SOLO LEE. No importa nada de src/, no ejecuta el camino de emision (regla 38).
//
// 🔴 CADA CERO LLEVA SU CONTROL. Casi anoto un cero falso con `grep`: «declaración responsable»
// no aparecia donde SI esta, por los acentos. Un instrumento que no ve lo que busca da un cero
// muy creible. Asi que cada busqueda se hace ademas contra un CEBO que tiene que encontrar.
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = process.argv[2];

// ── POBLACION, declarada ────────────────────────────────────────────────────────────────
const EXT = /\.(ts|js|mjs|json|html|css|md)$/;
function ficherosDe(...carpetas) {
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

const CARPETAS = ['src', 'public', 'scripts', 'tests', 'prisma', 'docs'];

// 🔴 SE EXCLUYE SU PROPIA EVIDENCIA, y lo cazo su propio control. Al dejar este script y su
// salida dentro de `docs/master/evidencias/`, el censo empezo a LEERSE A SI MISMO y encontro su
// cebo «no existe esta cadena» — o sea que el control salio en rojo y el censo se nego a afirmar
// nada, que es exactamente lo que tenia que hacer. Es la trampa de autorreferencia de
// SCRUM-693/694: un censo que se cuenta a si mismo mide su propia sombra.
//
// La exclusion va DECLARADA porque es una decision, no un detalle: la evidencia de un censo no es
// superficie del producto. Si algun dia hubiera que censar `docs/master/evidencias/`, sera otro
// censo con otro cebo.
const EXCLUIDAS = ['docs/master/evidencias/'];
const ficheros = ficherosDe(...CARPETAS).filter((f) => !EXCLUIDAS.some((e) => f.startsWith(e)));
const texto = new Map();
for (const f of ficheros) {
  try { texto.set(f, fs.readFileSync(path.join(RAIZ, f), 'utf8')); } catch { /* ilegible */ }
}

// Normaliza acentos y caso: asi «declaración» y «declaracion» son la misma busqueda.
const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const normalizados = new Map([...texto].map(([f, t]) => [f, norm(t)]));

/** Lineas que casan, con su numero. Busqueda sobre texto NORMALIZADO. */
function buscar(patron, soloEn = null) {
  const re = new RegExp(norm(patron));
  const out = [];
  for (const [f, t] of normalizados) {
    if (soloEn && !soloEn.some((c) => f.startsWith(c))) continue;
    const orig = texto.get(f).split('\n');
    const lineas = t.split('\n');
    for (let i = 0; i < lineas.length; i++) {
      if (re.test(lineas[i])) out.push({ f, linea: i + 1, txt: orig[i].trim().slice(0, 110) });
    }
  }
  return out;
}

console.log('POBLACION DEL CENSO');
console.log('  carpetas            : ' + CARPETAS.join(', '));
console.log('  ficheros leidos     : ' + ficheros.length);
console.log('  ilegibles           : ' + (ficheros.length - texto.size));

// 🔴 CONTROL DEL INSTRUMENTO: tiene que encontrar algo que SE SABE que esta, y no encontrar
// algo que se sabe que no. Sin las dos mitades, un buscador que dijera «nada» a todo pasaria.
const CEBO_SI = buscar('declaracion responsable', ['src']);
const CEBO_NO = buscar('zzz-no-existe-esta-cadena-zzz');
console.log('\nCONTROL DEL INSTRUMENTO');
console.log('  ve «declaracion responsable» en src/ : ' + CEBO_SI.length + (CEBO_SI.length > 0 ? '  OK' : '  🔴 CIEGO'));
console.log('  no ve una cadena inventada           : ' + CEBO_NO.length + (CEBO_NO.length === 0 ? '  OK' : '  🔴'));
if (!CEBO_SI.length || CEBO_NO.length) { console.log('\n🔴 el instrumento no pasa su control: nada de abajo significa nada.'); process.exit(1); }

const bloque = (t) => console.log('\n' + '═'.repeat(88) + '\n' + t + '\n' + '═'.repeat(88));
const listar = (r, tope = 12) => {
  if (!r.length) { console.log('   (CERO — y el instrumento pasa su control, arriba)'); return; }
  for (const x of r.slice(0, tope)) console.log('   · ' + x.f + ':' + x.linea + '   ' + x.txt);
  if (r.length > tope) console.log('   … y ' + (r.length - tope) + ' mas');
};

// ── A · LA UBICACION INTERNA (art. 15.3: dentro del SIF, accesible por el usuario) ───────
bloque('A · UBICACION INTERNA — una pantalla dentro del producto');
console.log('\nA1 · «declaracion responsable» en lo que ve el usuario (public/):');
listar(buscar('declaracion responsable', ['public']));
console.log('\nA2 · el titulo fijo que exige el art. 15.1, en cualquier sitio:');
listar(buscar('declaracion responsable del sistema informatico de facturacion'));
console.log('\nA3 · un menu «Acerca de» o «Ayuda» en el panel (patron que sugiere la AEAT):');
listar(buscar('acerca de', ['public']).concat(buscar('>ayuda<', ['public'])));
console.log('\nA4 · una ruta que sirva la declaracion:');
listar(buscar('declaracion[-_/]?responsable').concat(buscar('/legal/declaracion')));

// ── B · LA UBICACION EXTERNA (para cliente y comercializador) ───────────────────────────
bloque('B · UBICACION EXTERNA — accesible a cliente y potencial cliente');
console.log('\nB1 · ficheros cuyo NOMBRE la nombre (pdf, txt, md, html):');
const porNombre = ficheros.filter((f) => /declaraci/i.test(f));
if (!porNombre.length) console.log('   (CERO)');
for (const f of porNombre) console.log('   · ' + f);
console.log('\nB2 · en la landing publica:');
listar(buscar('declaracion responsable', ['public/index.html', 'public/legal']));

// ── C · LAS DOCE LETRAS · que dato existe ya en el codigo, y donde ──────────────────────
bloque('C · LAS DOCE LETRAS DEL ART. 15.1 — que existe ya como dato');
const LETRAS = [
  ['a', 'Nombre del sistema informatico', 'nombresistemainformatico'],
  ['b', 'Codigo identificador del sistema (2 car.)', 'verifactu_id_sistema'],
  ['c', 'Identificador completo de la version', 'verifactu_version'],
  ['d', 'Componentes hardware y software', null],
  ['e', 'Solo VERI*FACTU (S/N)', 'tipousoposiblesoloverifactu'],
  ['f', 'Multiples obligados tributarios (S/N)', 'tipousoposiblemultiot'],
  ['g', 'Tipos de firma (solo si NO VERI*FACTU)', 'xades'],
  ['h', 'Nombre o razon social del productor', 'verifactu_productor_nombre'],
  ['i', 'NIF del productor', 'verifactu_productor_nif'],
  ['j', 'Direccion postal del productor', null],
  ['k', 'Constancia de cumplimiento (art. 29.2.j LGT, RRSIF, Orden)', null],
  ['l', 'Fecha y lugar de suscripcion', null],
];
for (const [letra, que, patron] of LETRAS) {
  if (!patron) { console.log('\n  ' + letra + ') ' + que + '\n      → NO BUSCABLE por una cadena: es prosa de la declaracion, no un dato del codigo.'); continue; }
  const r = buscar(patron, ['src']);
  console.log('\n  ' + letra + ') ' + que + '   → ' + (r.length ? r.length + ' sitio(s) en src/' : 'CERO en src/'));
  listar(r, 4);
}

// ── D · LA VERSION · que alimenta `Version` en cada registro ────────────────────────────
bloque('D · «UNA POR VERSION» — de donde sale la version que viaja en cada registro');
console.log('\nD1 · la constante declarada:');
listar(buscar('export const verifactu_version', ['src']));
console.log('\nD2 · ¿la toca algo del despliegue (package.json, sha, CI)?');
listar(buscar('verifactu_version', ['scripts', '.github']).concat(buscar('verifactu_version', ['package.json'])));
const pkg = JSON.parse(texto.get('package.json') ?? fs.readFileSync(path.join(RAIZ, 'package.json'), 'utf8'));
console.log('\nD3 · version de package.json : ' + pkg.version);
const m = /export const VERIFACTU_VERSION = "([^"]*)"/.exec(texto.get('src/modules/fiscal/verifactu/productor.ts') ?? '');
console.log('      VERIFACTU_VERSION       : ' + (m ? m[1] : '(no leida)'));
console.log('      ¿coinciden?             : ' + (m && m[1] === pkg.version));
console.log('\nD4 · ¿existe archivo historico de versiones declaradas?');
listar(buscar('historico de (la )?declaracion').concat(buscar('declaraciones responsables')));

// ── E · LOS DOS CONSTRUCTORES DEL BLOQUE (regla 2) ──────────────────────────────────────
bloque('E · QUIEN CONSTRUYE EL BLOQUE `SistemaInformatico`');
listar(buscar('<sum1:sistemainformatico>', ['src']));
console.log('\nE2 · valores CABLEADOS como literal en el XML (no parametrizados):');
for (const [f, t] of texto) {
  if (!f.startsWith('src/')) continue;
  const l = t.split('\n');
  for (let i = 0; i < l.length; i++) {
    if (/<sum1:(TipoUsoPosibleSoloVerifactu|TipoUsoPosibleMultiOT|IndicadorMultiplesOT|NombreSistemaInformatico)>[^$<]/.test(l[i])) {
      console.log('   🔴 ' + f + ':' + (i + 1) + '   ' + l[i].trim());
    }
  }
}
