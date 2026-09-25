// SCRUM-985 · EL AVISO DE IMPORTAR NO PROMETE LO QUE EL IMPORTADOR NO LEE.
//
// El tooltip del botón de importar clientes decía «CSV o Excel» y el importador solo lee `.csv` y
// `.txt`: no hay lector de `.xlsx` en `src/` ni en `package.json`. Un profesional con su lista en un
// `.xlsx` llegaba al modal y no podía subirla. Un aviso que miente es peor que ninguno.
//
// Dos preguntas, y las dos se hacen sobre el árbol REAL, no sobre una copia de la frase:
//   1. ¿Qué promete el aviso? → el `title` del botón de `customersView.js`.
//   2. ¿Qué lee el importador? → el `accept` del `<input type="file">` de `csvImport.js`, y la
//      ausencia de un lector de hojas de cálculo entre las dependencias.
//
// Y un censo: la palabra «Excel» / «xlsx» en `public/` solo puede aparecer en UN sitio, la frase de
// `csvImport.js` que dice de dónde sale el `.csv` («que exporta tu Excel») — ahí Excel es el programa
// de origen del fichero, no un formato que se acepte. Si mañana alguien la escribe en otro aviso, este
// test cae y obliga a decidir: o se lee `.xlsx` de verdad (dependencia nueva: la decide el fundador,
// regla 36) o el texto no lo promete.
//
// SCRUM-1022c (25-sep-2026) · CAMBIÓ LA CONDICIÓN, NO EL GUARD. Cuando se escribió (21-sep) el
// servidor NO leía `.xlsx`, y exigir el tooltip «… CSV», `accept=".csv,.txt"` y «que exporta tu
// Excel» era exactamente lo correcto: impedía prometer lo que no se hacía. Con SCRUM-1022 (#1723,
// 23-sep) el servidor lee `.xlsx` de verdad (`read-excel-file`, autorizada) y la pantalla lo seguía
// escondiendo: el selector no lo ofrecía y sólo llegaba arrastrándolo, que en móvil no existe.
// Así que la pantalla lo ofrece y este guard se reescribe A PROPÓSITO, sin relajarlo (regla 41):
// sigue exigiendo que el aviso no prometa más de lo que el importador lee, y ahora ATA la promesa al
// lector del SERVIDOR — si alguien quita `pareceXlsx` de las rutas de importar, el `.xlsx` de la
// pantalla vuelve a ser mentira y este fichero cae. Firma: SCRUM-1022 comentario 17016, registrada
// en docs/microcopy/2026-09-25-SCRUM-1022-importar-xlsx.md. El registro del 21-sep (SCRUM-985) NO
// se borra: fue cierto y es la constancia de por qué se escribió así.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');

// SCRUM-1022c: era «… CSV» (SCRUM-985, comentario 16104); con el .xlsx leído, SCRUM-1022 comentario 17016.
const TEXTO_FIRMADO = 'Importar clientes desde un fichero CSV o Excel';

// Lo ÚNICO que puede nombrar Excel en `public/`, por fichero y por fragmento. Un fragmento, no un
// número de línea: referenciar por posición caduca.
const EXCEL_PERMITIDO = [
  // SCRUM-1022c: el servidor lee `.xlsx` (lo exige el test del `accept`), así que la pantalla lo nombra.
  { fichero: 'public/dashboard/js/csvImport.js', fragmento: 'o el <strong>.xlsx</strong> de tu Excel' },
  { fichero: 'public/dashboard/js/csvImport.js', fragmento: 'accept=".csv,.txt,.xlsx"' },
  { fichero: 'public/dashboard/js/customersView.js', fragmento: 'importBtn.title = "Importar clientes desde un fichero CSV o Excel"' },
  // SCRUM-1022c (comentario 17019): el título del modal nombra los dos formatos; el botón, ninguno.
  { fichero: 'public/dashboard/js/csvImport.js', fragmento: "titulo: '⬆ Importar clientes desde CSV o Excel'" },
  // SCRUM-1086 (23-sep-2026): «sin post-its ni Excel» no promete leerlo — dice que no hace falta.
  { fichero: 'public/index.html', fragmento: 'sin post-its ni Excel' },
];

function ficherosDePublic() {
  const salida = [];
  (function andar(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) andar(p);
      else if (/\.(js|html)$/.test(e.name)) salida.push(p);
    }
  })(path.join(RAIZ, 'public'));
  return salida;
}

/** Líneas que nombran Excel/xlsx. Pura: el texto llega por argumento (así se le puede fabricar un caso). */
export function menciones(texto) {
  return texto.split('\n')
    .map((linea, i) => ({ linea: i + 1, texto: linea }))
    .filter((l) => /excel|xlsx/i.test(l.texto));
}

test('SCRUM-985 · el tooltip de importar clientes dice exactamente el texto firmado', () => {
  const src = leer('public/dashboard/js/customersView.js');
  const m = src.match(/importBtn\.title\s*=\s*"([^"]*)"/);
  assert.ok(m, '🔴 no encuentro el `title` del botón de importar: el test miraría a ciegas');
  assert.equal(m[1], TEXTO_FIRMADO);
});

test('SCRUM-985 · SCRUM-1022c — el selector ofrece exactamente lo que el servidor lee: .csv, .txt y .xlsx', () => {
  const src = leer('public/dashboard/js/csvImport.js');
  const m = src.match(/type="file"[^>]*\baccept="([^"]*)"/);
  assert.ok(m, '🔴 no encuentro el `accept` del `<input type="file">` de csvImport.js');
  const aceptados = m[1].split(',').map((s) => s.trim()).filter(Boolean);
  // Igualdad de CONJUNTO: ni falta el .xlsx (función invisible) ni sobra un .xls/.ods que no se lee.
  assert.deepEqual(aceptados.sort(), ['.csv', '.txt', '.xlsx']);

  // La condición que hace verdad el `.xlsx`: las DOS rutas de importar miran la firma del fichero.
  // Sin esto, el `accept` volvería a prometer lo que no se lee, que es lo que este fichero impide.
  const rutas = leer('src/modules/system/app/routes/customersAdmin.routes.ts');
  const llamadas = rutas.split('\n').filter((l) => !/^\s*(\/\/|\*)/.test(l) && /\bpareceXlsx\(bytes\)/.test(l));
  assert.equal(llamadas.length, 2,
    `🔴 las rutas de importar deberían mirar la firma del .xlsx en /import/preparar y en /import; veo ${llamadas.length}`);
});

test('SCRUM-985 · SCRUM-1022 — el lector de hojas de cálculo es el autorizado', () => {
  // SCRUM-1022 (23-sep-2026, comentario 16597): el fundador autorizó `read-excel-file` (regla 36)
  // para que el SERVIDOR lea un .xlsx real. La promesa en pantalla llegó después y con su propia
  // firma (SCRUM-1022c, comentario 17016): el `title`, el `accept` y el texto del modal.
  const pkg = JSON.parse(leer('package.json'));
  const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
  assert.ok(deps.length > 10, `🔴 CIEGO: solo veo ${deps.length} dependencias en package.json`);
  const lectores = deps.filter((d) => /^(xlsx|exceljs|node-xlsx|read-excel-file|sheetjs.*|@e965\/xlsx)$/i.test(d));
  assert.deepEqual(lectores, ['read-excel-file'],
    '🔴 el lector de hojas de cálculo no es (solo) el autorizado en SCRUM-1022: si es otro o hay '
    + 'varios, revisa la autorización; si no hay ninguno, esta tanda no instaló lo que dice que instaló.');
});

test('SCRUM-985 · «Excel»/«xlsx» en `public/` solo aparece donde está declarado (y el censo VE el árbol)', () => {
  const ficheros = ficherosDePublic();
  assert.ok(ficheros.length >= 50,
    `🔴 CIEGO: el censo solo ve ${ficheros.length} ficheros de public/ (se esperan ≥50): un cero no sería «limpio», sería «no miré»`);

  const halladas = [];
  for (const f of ficheros) {
    const rel = path.relative(RAIZ, f).split(path.sep).join('/');
    for (const m of menciones(fs.readFileSync(f, 'utf8'))) halladas.push({ rel, ...m });
  }

  const permitidas = halladas.filter((h) => EXCEL_PERMITIDO.some((p) => p.fichero === h.rel && h.texto.includes(p.fragmento)));
  const sospechosas = halladas.filter((h) => !permitidas.includes(h));

  // El suelo del propio censo: lo permitido TIENE que verse. Si no, la lista de permitidos apunta a
  // una frase que ya no existe y el «cero sospechosas» de abajo no probaría nada.
  for (const p of EXCEL_PERMITIDO) {
    assert.ok(permitidas.some((h) => h.rel === p.fichero),
      `🔴 el censo no ve «${p.fragmento}» en ${p.fichero}: o se movió la frase o el censo está ciego`);
  }
  assert.deepEqual(sospechosas.map((h) => `${h.rel}:${h.linea}  ${h.texto.trim()}`), [],
    '🔴 un aviso nombra Excel/xlsx fuera de la única frase declarada. ¿Lee de verdad hojas de cálculo?');
});

// SCRUM-1022c: «CSV o Excel» vuelve al tooltip, ahora cierto; el control sigue midiendo el DETECTOR.
test('SCRUM-985 · CONTROL: el detector ve la frase que se retiró', () => {
  const viejo = 'importBtn.title = "Importar clientes desde un fichero CSV o Excel";';
  assert.equal(menciones(viejo).length, 1, '🔴 el detector no ve «CSV o Excel»: un cero no probaría nada');
  assert.equal(menciones('importBtn.title = "Importar clientes desde un fichero CSV";').length, 0);
  assert.equal(menciones('un .xlsx no se lee').length, 1);
});
