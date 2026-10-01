// Mutaciones de SCRUM-1329 sobre el criterio de prosa de `scrum514`. Cada una: se aplica (y se
// comprueba que SE APLICO), se corre el test, se apunta que casos caen, y se restaura. Al final se
// comprueba por CONTENIDO que el fichero ha vuelto a ser el que era.
//
// MUTA el propio fichero del guard (no hay build: es lectura pura). Se lanza a mano, con el arbol
// comiteado, y mientras corre no se mide nada mas en este arbol:
//   node tests/banco-scrum1329/mutar.mjs
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const RAIZ = path.resolve(import.meta.dirname, '../..');
const TEST = 'tests/scrum514-aprobado-y-aplicado.test.mjs';
const F = path.join(RAIZ, TEST);

// `cae`: trozo del NOMBRE del caso que tiene que caer. Se comprueba contra la base antes de mutar.
const MUTACIONES = [
  { id: 'M1 vuelve el criterio viejo: toda cita larga es prosa',
    de: 'if (falta.length === 0) continue;', a: '',
    cae: 'en UNA línea, NO es prosa' },
  { id: 'M2 ya no se mira si la firma cuenta',
    de: "if (!suyas.some((c) => c.firmaQueCuenta)) falta.push('su ficha no lleva una firma que cuente');\n    else if",
    a: 'if',
    cae: 'una prosa larga SIN FIRMA sigue cayendo' },
  { id: 'M3 ya no se pide el comentario de Jira',
    de: "if (!suyas.some((c) => c.firmaQueCuenta && c.comentario)) falta.push(", a: 'if (false) falta.push(',
    cae: 'sin decir en qué comentario' },
  { id: 'M4 ya no se mira si está pintado',
    de: 'if (!textoDelCorpus.includes(texto)) falta.push(', a: 'if (false) falta.push(',
    cae: 'una nota larga dentro de una ficha FIRMADA' },
  { id: 'M5 el umbral sube a 200',
    de: 'const LARGO_DE_PROSA = 160;', a: 'const LARGO_DE_PROSA = 200;',
    cae: 'el umbral no se ha movido' },
  { id: 'M6 la negrita deja de ser prosa',
    de: "if (/\\*\\*/.test(texto)) { out.push({ texto, porque: 'lleva negrita de Markdown: es una nota, no copy' }); continue; }", a: '',
    cae: 'la negrita de Markdown sigue siendo prosa' },
  { id: 'M7 el comentario vale en cualquier línea de la ficha',
    de: "if (!/^\\s*\\**\\s*Aprobad[oa]s?\\s+por\\s+el\\s+(fundador|orquestador\\s+por\\s+delegaci[oó]n\\s+del\\s+fundador)\\b/i.test(linea)) continue;", a: '',
    cae: 'el comentario nombrado en OTRA línea' },
  { id: 'M8 el comentario se busca también en el registro congelado',
    de: 'comentario: deFicha ? comentarioDeLaFirma(ap.texto) : null,', a: 'comentario: comentarioDeLaFirma(ap.texto),',
    cae: 'una celda larga del registro CONGELADO' },
  { id: 'M9 la firma cuenta la firme quien la firme',
    de: 'firmaQueCuenta: ap.aprobada === true,', a: 'firmaQueCuenta: true,',
    cae: 'una firma que no es del fundador ni delegada' },
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
console.log(`BASE: ok=${base.ok} caen=${base.caen.length}`);
if (base.caen.length !== 0 || base.ok === 0) { console.log('CIEGO: la base no esta verde'); process.exit(2); }
for (const m of MUTACIONES) {
  if (base.nombres.filter((n) => n.nombre.includes(m.cae)).length !== 1) {
    console.log(`CIEGO: «${m.cae}» no nombra exactamente UN caso de la base (${m.id})`); process.exit(2);
  }
}

let mudas = 0;
try {
  for (const m of MUTACIONES) {
    if (original.split(m.de).length !== 2) { console.log(`CIEGO ${m.id}: el texto a mutar no aparece exactamente una vez`); mudas++; continue; }
    fs.writeFileSync(F, original.replace(m.de, () => m.a));
    if (fs.readFileSync(F, 'utf8') === original) { console.log(`CIEGO ${m.id}: la mutacion no se aplico`); mudas++; continue; }
    const r = leer(correr());
    const esperado = r.caen.some((n) => n.includes(m.cae));
    if (!esperado) mudas++;
    console.log(`${esperado ? 'CAE  ' : 'MUDA '} ${m.id} · ok=${r.ok} caen=${r.caen.length}${r.nombres.length === 0 ? ' (el fichero no llego a correr)' : ''}`);
    for (const n of r.caen) console.log(`        - ${n}`);
  }
} finally {
  fs.writeFileSync(F, original);
}
const restaurado = fs.readFileSync(F, 'utf8') === original;
const fin = leer(correr());
console.log(`RESTAURADO: ${restaurado} · tras restaurar ok=${fin.ok} caen=${fin.caen.length}`);
console.log(`RESULTADO: ${MUTACIONES.length - mudas} de ${MUTACIONES.length} caen en su caso`);
const salida = mudas === 0 && restaurado && fin.caen.length === 0 ? 0 : 1;
console.log(`EXIT=${salida}`);
process.exit(salida);
