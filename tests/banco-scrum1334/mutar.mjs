// Mutaciones de SCRUM-1334 sobre `scrum514`: la poblacion entera, las cajas y las declaradas. Cada
// una se aplica (y se comprueba que SE APLICO), se corre el test, se apunta que casos caen y se
// restaura. Al final se comprueba por CONTENIDO que el fichero ha vuelto a ser el que era.
//
// MUTA el propio fichero del guard (no hay build: es lectura pura). Se lanza a mano, con el arbol
// comiteado, y mientras corre no se mide nada mas en este arbol:
//   node tests/banco-scrum1334/mutar.mjs
//
// La BASE se corre antes. Si trae algun caso en rojo se NOMBRA y se sigue: una mutacion solo cuenta
// si tumba un caso que en la base estaba verde.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const RAIZ = path.resolve(import.meta.dirname, '../..');
const TEST = 'tests/scrum514-aprobado-y-aplicado.test.mjs';
const F = path.join(RAIZ, TEST);

const CABECERA = 'if (h) { seccion = h[1].trim(); continue; }';

// `cae`: trozo del NOMBRE del caso que tiene que caer. Se comprueba contra la base antes de mutar.
const MUTACIONES = [
  { id: 'M1 vuelve el criterio viejo: solo las citas bajo «Texto aprobado»',
    de: CABECERA, a: CABECERA + '\n    if (!/texto\\s+aprobado/i.test(seccion)) continue;',
    cae: 'vaya bajo el encabezado que vaya' },
  { id: 'M2 las citas bajo un titulo en plural vuelven a quedarse fuera',
    de: CABECERA, a: CABECERA + '\n    if (/textos\\s+aprobados/i.test(seccion)) continue;',
    cae: 'TESTIGO REAL' },
  { id: 'M3 una seccion de las que ya se cruzaban deja de cruzarse',
    de: CABECERA, a: CABECERA + '\n    if (/partes\\s+fijas/i.test(seccion)) continue;',
    cae: 'lo que ya se cruzaba por su título se sigue cruzando' },
  { id: 'M4 lo que el codigo no pinta pasa callado',
    de: "if (c.caja !== 'cruce' || fuera.has(c.texto) || textoDelCorpus.includes(c.texto)) continue;", a: 'continue;',
    cae: 'sale en rojo y dice dónde' },
  { id: 'M5 toda linea de la ficha es poblacion, no solo las citas',
    de: "if (!m || m[1].trim() === '') continue;\n    const texto = m[1].trim();",
    a: "const texto = (m ? m[1] : linea).trim();\n    if (texto === '') continue;",
    cae: 'la prosa de una ficha que NO va en cita' },
  { id: 'M6 las citas cortas se tiran sin meterlas en ninguna caja',
    de: "if (texto.length < 4) { out.push({ texto, seccion, caja: 'corta' }); continue; }", a: 'if (texto.length < 4) continue;',
    cae: 'RECUENTO' },
  { id: 'M7 una plantilla entra en el cruce',
    de: "if (/{[^}]+}/.test(texto)) { out.push({ texto, seccion, caja: 'plantilla' }); continue; }", a: '',
    cae: 'una plantilla y una cita corta siguen fuera' },
  { id: 'M8 una declaracion vale para el texto, este en la ficha que este',
    de: 'd.ficha === ap.nombre && d.texto === u.texto', a: 'd.texto === u.texto',
    cae: 'SÓLO en su ficha' },
  { id: 'M9 ya no se mira que las partes fijas sigan en el fichero',
    de: 'else for (const p of fijas) if (!codigo.includes(p)) fallos.push(', a: 'else for (const p of fijas) if (false) fallos.push(',
    cae: 'una declaración con su prueba vale' },
  { id: 'M10 una declaracion sobrevive a que el codigo ya pinte la cita',
    de: 'if (textoDelCorpus.includes(d.texto)) fallos.push(', a: 'if (false) fallos.push(',
    cae: 'una declaración con su prueba vale' },
  { id: 'M11 una declaracion sobrevive a que la ficha pierda la cita',
    de: 'else if (!citasDeFicha(ficha).some((c) => c.texto === d.texto)) fallos.push(', a: 'else if (false) fallos.push(',
    cae: 'una declaración con su prueba vale' },
  { id: 'M12 un dato puede ser una frase entera',
    de: 'if (v.length > LARGO_DE_UN_DATO) fallos.push(', a: 'if (false) fallos.push(',
    cae: 'una NOTA no cuela' },
  { id: 'M13 una declaracion sin ninguna parte fija de verdad vale',
    de: 'if (!fijas.some((p) => p.trim().length >= 4)) fallos.push(', a: 'if (false) fallos.push(',
    cae: 'una NOTA no cuela' },
  { id: 'M14 una declaracion REAL deja de corresponder a su cita',
    de: "partes: [dato('3'), ' fotos'],", a: "partes: [dato('3'), ' fotografías'],",
    cae: 'cada DECLARADA sigue en su ficha' },
  { id: 'M15 una declaracion REAL nombra un fichero donde ya no se compone',
    de: "fichero: 'public/dashboard/js/customerDetailView.js',", a: "fichero: 'public/dashboard/js/jobsView.js',",
    cae: 'cada DECLARADA sigue en su ficha' },
];

const entorno = { ...process.env };
for (const k of ['FORCE_COLOR', 'NODE_OPTIONS', 'NODE_TEST_CONTEXT']) delete entorno[k];
const correr = () => spawnSync(process.execPath, ['--test', '--test-reporter=tap', TEST], { cwd: RAIZ, env: entorno, encoding: 'utf8' });
const leer = (r) => {
  const out = r.stdout || '';
  const nombres = [...out.matchAll(/^(not ok|ok) \d+ - (.*)$/gm)].map((m) => ({ ok: m[1] === 'ok', nombre: m[2] }));
  return { nombres, ok: nombres.filter((n) => n.ok).length, caen: nombres.filter((n) => !n.ok).map((n) => n.nombre) };
};

const original = fs.readFileSync(F, 'utf8');
const base = leer(correr());
console.log(`POBLACION: ${MUTACIONES.length} mutaciones sobre ${TEST}`);
console.log(`BASE: casos=${base.nombres.length} ok=${base.ok} caen=${base.caen.length}`);
for (const n of base.caen) console.log(`   base en rojo (no cuenta para ninguna mutacion): ${n}`);
if (base.ok === 0) { console.log('CIEGO: la base no ha corrido'); process.exit(2); }
for (const m of MUTACIONES) {
  const suyos = base.nombres.filter((n) => n.nombre.includes(m.cae));
  if (suyos.length !== 1 || !suyos[0].ok) {
    console.log(`CIEGO: «${m.cae}» no nombra exactamente UN caso VERDE de la base (${m.id})`); process.exit(2);
  }
}

let mudas = 0;
try {
  for (const m of MUTACIONES) {
    if (original.split(m.de).length !== 2) { console.log(`CIEGO ${m.id}: el texto a mutar no aparece exactamente una vez`); mudas++; continue; }
    fs.writeFileSync(F, original.replace(m.de, () => m.a));
    if (fs.readFileSync(F, 'utf8') === original) { console.log(`CIEGO ${m.id}: la mutacion no se aplico`); mudas++; continue; }
    const r = leer(correr());
    const nuevos = r.caen.filter((n) => !base.caen.includes(n));
    const esperado = nuevos.some((n) => n.includes(m.cae));
    if (!esperado) mudas++;
    console.log(`${esperado ? 'CAE  ' : 'MUDA '} ${m.id} · ok=${r.ok} caen=${r.caen.length} (nuevos: ${nuevos.length})${r.nombres.length === 0 ? ' (el fichero no llego a correr)' : ''}`);
    for (const n of nuevos) console.log(`        - ${n}`);
  }
} finally {
  fs.writeFileSync(F, original);
}
const restaurado = fs.readFileSync(F, 'utf8') === original;
const fin = leer(correr());
const igualQueLaBase = JSON.stringify(fin.caen) === JSON.stringify(base.caen) && fin.ok === base.ok;
console.log(`RESTAURADO: ${restaurado} · tras restaurar ok=${fin.ok} caen=${fin.caen.length} · igual que la base=${igualQueLaBase}`);
console.log(`RESULTADO: ${MUTACIONES.length - mudas} de ${MUTACIONES.length} caen en su caso`);
const salida = mudas === 0 && restaurado && igualQueLaBase ? 0 : 1;
console.log(`EXIT=${salida}`);
process.exit(salida);
