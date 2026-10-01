// Mutaciones de SCRUM-1102f. Cada una: se aplica (y se comprueba que SE APLICO), se compila si toca
// `src/`, se corre el test del ticket, se mira que caiga EL CASO que tiene que caer, y se restaura.
// Al final: build limpio + arbol limpio.
//
// ⚠️ MUTA `src/`, `public/` y `prisma/schema.prisma`, y reescribe `dist/` (un build ENTERO por cada
// mutacion de `src/`). Se lanza a mano, con el arbol comiteado, y mientras corre no se mide nada
// mas en este arbol:
//   node tests/banco-scrum1102f/mutar.mjs            (todas)
//   node tests/banco-scrum1102f/mutar.mjs M1,M7      (solo esas)
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const RAIZ = path.resolve(import.meta.dirname, '../..');
const en = (rel) => path.join(RAIZ, rel);
const ESQUEMA = en('prisma/schema.prisma');
const ZOD = en('src/core/validation/schemas.ts');
const PERFIL = en('src/modules/system/merchantAdmin.ts');
const VISTA = en('public/dashboard/js/settingsView.js');
const MAPA = en('public/dashboard/js/settingsSubmenus.js');
const TEST = 'tests/scrum1102f-sii-y-foral-se-preguntan-y-se-guardan.test.mjs';

// `cae`: un trozo del NOMBRE del caso que tiene que caer. Se comprueba contra la base antes de
// mutar nada: un trozo que no nombra ningun caso daria «muda» sin haber medido.
const MUTACIONES = [
  { id: 'M1 la columna del SII nace con valor por defecto', f: ESQUEMA, cae: '① el esquema',
    de: 'Boolean?  @map("lleva_libros_por_sii")', a: 'Boolean?  @default(false) @map("lleva_libros_por_sii")' },
  { id: 'M2 la columna foral deja de ser anulable', f: ESQUEMA, cae: '① el esquema',
    de: 'Boolean?  @map("domicilio_fiscal_foral")', a: 'Boolean   @map("domicilio_fiscal_foral")' },
  { id: 'M3 el esquema del PUT descarta la respuesta del SII', f: ZOD, cae: '② los TRES estados',
    de: '  llevaLibrosPorSii: z.boolean().nullable().optional(),\n', a: '' },
  { id: 'M4 el esquema del PUT ya no admite «no consta» en la foral', f: ZOD, cae: '② los TRES estados',
    de: 'domicilioFiscalForal: z.boolean().nullable().optional(),', a: 'domicilioFiscalForal: z.boolean().optional(),' },
  { id: 'M5 el esquema del PUT traga cualquier cosa en el SII', f: ZOD, cae: '② NEGATIVO',
    de: 'llevaLibrosPorSii: z.boolean().nullable().optional(),', a: 'llevaLibrosPorSii: z.any().optional(),' },
  { id: 'M6 el GET no devuelve la respuesta foral', f: PERFIL, cae: '② los TRES estados',
    de: '      domicilioFiscalForal: true,\n', a: '' },
  { id: 'M7 al cargar, «dijo que no» se pinta como «no consta» (SII)', f: VISTA, cae: '③ la pantalla pinta',
    de: ': merchant.llevaLibrosPorSii === false ? "no" : "";', a: ': "";' },
  { id: 'M8 al guardar, «no consta» viaja como false (foral)', f: VISTA, cae: '③ un perfil que no trae',
    de: 'fDomicilioFiscalForal.value === "no" ? false : null,', a: 'fDomicilioFiscalForal.value === "no" ? false : false,' },
  { id: 'M9 la pantalla deja de mandar la respuesta del SII', f: VISTA, cae: '③ la pantalla pinta',
    de: '        llevaLibrosPorSii: fLlevaLibrosPorSii.value === "si" ? true : fLlevaLibrosPorSii.value === "no" ? false : null,\n', a: '' },
  { id: 'M10 la foral se guarda con lo que dice el selector del SII', f: VISTA, cae: '③ lo que el profesional elige',
    de: 'domicilioFiscalForal: fDomicilioFiscalForal.value === "si" ? true : fDomicilioFiscalForal.value',
    a: 'domicilioFiscalForal: fLlevaLibrosPorSii.value === "si" ? true : fLlevaLibrosPorSii.value' },
  { id: 'M11 el enunciado del SII cambia una palabra', f: VISTA, cae: '④ cada selector lleva',
    de: '"¿Llevas los libros de IVA por el SII?"', a: '"¿Llevas los libros del IVA por el SII?"' },
  { id: 'M12 la opcion «Sí» pasa a explicar', f: VISTA, cae: '④ las opciones',
    de: '<option value="si">Sí</option>\' +\n      \'<option value="no">No</option>', a: '<option value="si">Sí, lo llevo</option>\' +\n      \'<option value="no">No</option>' },
  { id: 'M13 la pregunta foral lleva un texto de ayuda debajo', f: VISTA, cae: '④ cada selector lleva',
    de: '    foralWrapper.appendChild(fDomicilioFiscalForal);\n', a: '    foralWrapper.appendChild(fDomicilioFiscalForal);\n    foralWrapper.appendChild(document.createElement("p"));\n' },
  { id: 'M14 la del SII se va a otra pestaña', f: MAPA, cae: '④ cada selector lleva',
    de: "llevaLibrosPorSii: 'empresa',", a: "llevaLibrosPorSii: 'facturacion'," },
];

const entorno = { ...process.env };
for (const k of ['FORCE_COLOR', 'NODE_OPTIONS', 'NODE_TEST_CONTEXT']) delete entorno[k];
const tsc = en('node_modules/typescript/bin/tsc');
const build = () => spawnSync(process.execPath, [tsc], { cwd: RAIZ, env: entorno, encoding: 'utf8' });
const correr = () => {
  const r = spawnSync(process.execPath, ['--test', '--test-force-exit', '--test-reporter=tap', TEST], { cwd: RAIZ, env: entorno, encoding: 'utf8' });
  const out = r.stdout || '';
  return { pasan: [...out.matchAll(/^ok \d+ - (.*)$/gm)].map((m) => m[1]), caen: [...out.matchAll(/^not ok \d+ - (.*)$/gm)].map((m) => m[1]) };
};
const esDeSrc = (f) => f.startsWith(en('src'));

// BASE sin mutar, primero.
let b = build();
if (b.status !== 0) { console.log('CIEGO: el build base falla\n' + b.stdout); process.exit(2); }
const base = correr();
console.log(`BASE: pasan=${base.pasan.length} caen=${base.caen.length}`);
if (base.caen.length || !base.pasan.length) { console.log('CIEGO: la base no esta verde\n' + base.caen.join('\n')); process.exit(2); }
const sinCaso = MUTACIONES.filter((m) => base.pasan.filter((n) => n.includes(m.cae)).length !== 1);
if (sinCaso.length) { console.log('CIEGO: `cae` no nombra UN caso de la base: ' + sinCaso.map((m) => m.id).join(' · ')); process.exit(2); }

const SOLO = (process.argv[2] || '').split(',').filter(Boolean);
const ELEGIDAS = MUTACIONES.filter((x) => !SOLO.length || SOLO.some((p) => x.id.startsWith(p + ' ')));
const filas = [];
let mudas = 0;
// Una mutacion de `src/` deja su build en `dist/` aunque el fuente se restaure: antes de una que
// no compila (esquema, pantalla) se recompila, o el test correria contra el `dist/` de la anterior.
let distMutado = false;
for (const m of ELEGIDAS) {
  const original = fs.readFileSync(m.f, 'utf8');
  const veces = original.split(m.de).length - 1;
  if (veces !== 1) { filas.push(`${m.id}: CIEGO — el ancla aparece ${veces} veces, no se aplico`); mudas++; continue; }
  try {
    if (!esDeSrc(m.f) && distMutado) { b = build(); distMutado = false; }
    fs.writeFileSync(m.f, original.replace(m.de, () => m.a));
    if (esDeSrc(m.f)) {
      b = build();
      distMutado = true;
      if (b.status !== 0) { filas.push(`${m.id}: NO COMPILA (${(b.stdout || '').split('\n')[0]})`); mudas++; continue; }
    }
    const r = correr();
    const cumple = r.caen.some((n) => n.includes(m.cae));
    if (!cumple) mudas++;
    filas.push(`${m.id}: ${cumple ? 'CAE' : 'MUDA'} (se esperaba: ${m.cae}) · pasan=${r.pasan.length} caen=${r.caen.length}`
      + r.caen.map((c) => `\n      - ${c}`).join(''));
  } finally {
    fs.writeFileSync(m.f, original);
  }
}
b = build();
const fin = correr();
console.log(filas.join('\n'));
console.log(`\nPOBLACION: ${ELEGIDAS.length} mutaciones de ${MUTACIONES.length} · mudas o ciegas: ${mudas}`);
console.log(`FINAL: build=${b.status} · pasan=${fin.pasan.length} caen=${fin.caen.length}`);
const st = spawnSync('git', ['status', '--porcelain'], { cwd: RAIZ, encoding: 'utf8' });
console.log(`ARBOL: ${st.stdout.trim() === '' ? 'limpio' : 'SUCIO\n' + st.stdout}`);
process.exit(mudas === 0 && b.status === 0 && fin.caen.length === 0 && st.stdout.trim() === '' ? 0 : 1);
