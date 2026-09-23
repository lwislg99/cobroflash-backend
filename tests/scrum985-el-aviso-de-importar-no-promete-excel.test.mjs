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

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');

const TEXTO_FIRMADO = 'Importar clientes desde un fichero CSV';

// Lo ÚNICO que puede nombrar Excel en `public/`, por fichero y por fragmento. Un fragmento, no un
// número de línea: referenciar por posición caduca.
const EXCEL_PERMITIDO = [
  { fichero: 'public/dashboard/js/csvImport.js', fragmento: 'que exporta tu Excel' },
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

test('SCRUM-985 · el importador acepta solo lo que el aviso promete: CSV (y texto plano), no hojas de cálculo', () => {
  const src = leer('public/dashboard/js/csvImport.js');
  const m = src.match(/type="file"[^>]*\baccept="([^"]*)"/);
  assert.ok(m, '🔴 no encuentro el `accept` del `<input type="file">` de csvImport.js');
  const aceptados = m[1].split(',').map((s) => s.trim()).filter(Boolean);
  assert.deepEqual(aceptados.sort(), ['.csv', '.txt']);
  assert.ok(!aceptados.some((e) => /xls/i.test(e)),
    '🔴 el importador acepta hojas de cálculo: entonces sí hay que decidir qué lector las abre');
});

test('SCRUM-985 · no hay lector de hojas de cálculo en las dependencias (lo que hace verdad el aviso)', () => {
  const pkg = JSON.parse(leer('package.json'));
  const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
  assert.ok(deps.length > 10, `🔴 CIEGO: solo veo ${deps.length} dependencias en package.json`);
  const lectores = deps.filter((d) => /^(xlsx|exceljs|node-xlsx|read-excel-file|sheetjs.*|@e965\/xlsx)$/i.test(d));
  assert.deepEqual(lectores, [],
    '🔴 hay un lector de hojas de cálculo: si el importador ya lee `.xlsx`, el aviso puede volver a decirlo — '
    + 'pero entonces este test se reescribe a propósito, con la firma del texto nuevo.');
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

test('SCRUM-985 · CONTROL: el detector ve la frase que se retiró', () => {
  const viejo = 'importBtn.title = "Importar clientes desde un fichero CSV o Excel";';
  assert.equal(menciones(viejo).length, 1, '🔴 el detector no ve «CSV o Excel»: un cero no probaría nada');
  assert.equal(menciones('importBtn.title = "Importar clientes desde un fichero CSV";').length, 0);
  assert.equal(menciones('un .xlsx no se lee').length, 1);
});
