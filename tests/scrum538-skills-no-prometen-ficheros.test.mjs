// tests/scrum538-skills-no-prometen-ficheros.test.mjs — SCRUM-538
//
// NINGUNA SKILL NOMBRA UN FICHERO QUE NO EXISTE.
//
// ── POR QUÉ, Y POR QUÉ AQUÍ Y NO EN EL GUARD QUE YA HAY ──────────────────────────────────────
// SCRUM-242 vigila que un SCRIPT no prometa un documento inexistente. Las skills no entraban, y
// son la zona con PEOR mecanismo de entrega: un documento espera a que alguien lo abra; una
// skill se le entrega a cada sesión sin que nadie la pida.
//
// Medido en SCRUM-536 y confirmado hoy:
//   · `cerebro-yaqu:12` mandaba leer `docs/CLAUDE.md` — está en la RAÍZ, no en `docs/`.
//   · dos skills nombraban `docs/VERIFACTU_EVIDENCIAS.md`, que no existe, mientras
//     `docs/EVIDENCIAS_E2E.md`, citado a su lado, sí.
//
// Una ruta que no resuelve no da error en ninguna parte: la sesión va a buscarla, no la
// encuentra, y decide por su cuenta. Que es exactamente lo que no queremos de una skill.
//
// ── LO QUE NO SE VIGILA, con esas palabras ───────────────────────────────────────────────────
// `impeccable/` queda FUERA: es de terceros y está gobernada por hash en `skills-lock.json`;
// tocarla rompería la verificación. Y sólo se miran rutas que empiezan por un directorio real
// del repo: un `.xsd` de la AEAT o una URL no son promesas de fichero nuestro.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKILLS = path.join(RAIZ, '.claude', 'skills');

/** Directorios del repo: una ruta que empieza por uno de éstos ES una promesa de fichero nuestro. */
const DIRS = ['docs/', 'src/', 'tests/', 'scripts/', 'public/', 'prisma/', '.claude/', '.github/'];

/** Las skills que se vigilan: todas menos las de terceros. */
export function skillsPropias() {
  if (!fs.existsSync(SKILLS)) return [];
  return fs.readdirSync(SKILLS, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name !== 'impeccable')
    .map((e) => path.join(SKILLS, e.name, 'SKILL.md'))
    .filter((f) => fs.existsSync(f));
}

/**
 * 🔴 NOMBRAR NO ES PROMETER, y esta excepción la trajo un falso positivo de este mismo guard.
 *
 * `yaqu-verifactu-sif` cita `docs/VERIFACTU_EVIDENCIAS.md` PARA DECIR QUE NO EXISTE — es el
 * arreglo de SCRUM-538, no el defecto. Un guard que denuncia eso obliga a borrar la advertencia
 * para callarlo, y entonces el documento inexistente vuelve a citarse como si existiera dentro
 * de seis meses.
 *
 * Así que una ruta acompañada de una declaración de ausencia NO cuenta como promesa. La ventana
 * son la línea y las dos siguientes, que es donde cabe la frase partida por el ancho de columna.
 */
const DECLARA_AUSENCIA = /\bno\s+existe|NO\s+EXISTE|no\s+se\s+ha\s+escrito|no\s+est[áa]\s+escrito|NO CONSTRUIDO/;

/** Toda ruta de fichero del repo que una skill nombra COMO PROMESA, con su línea. */
export function rutasNombradas(fichero) {
  const texto = fs.readFileSync(fichero, 'utf8');
  const lineas = texto.split('\n');
  const out = [];
  lineas.forEach((linea, i) => {
    // Rutas con extensión, delimitadas por comillas, backticks, espacios o paréntesis.
    for (const m of linea.matchAll(/[`'"( ]([A-Za-z0-9_./-]+\.[A-Za-z0-9]{1,5})[`'")\s,.:;]/g)) {
      const ruta = m[1];
      if (!DIRS.some((d) => ruta.startsWith(d))) continue;   // no es una ruta nuestra
      const ventana = lineas.slice(i, i + 3).join(' ');
      if (DECLARA_AUSENCIA.test(ventana)) continue;          // la nombra para decir que falta
      out.push({ ruta, linea: i + 1 });
    }
  });
  return out;
}

// ── ① SUELO ─────────────────────────────────────────────────────────────────────────────────
test('SCRUM-538 · SUELO: el censo ve las skills y ve rutas dentro', () => {
  const skills = skillsPropias();
  assert.ok(skills.length >= 7,
    `🔴 CIEGO: sólo se ven ${skills.length} skills propias y el 20-ago-2026 había 8. Si el ` +
    'recorrido se rompió, «ninguna skill promete un fichero que falta» significaría «no se miró».');

  const total = skills.reduce((n, f) => n + rutasNombradas(f).length, 0);
  assert.ok(total >= 15,
    `🔴 CIEGO: sólo se extraen ${total} rutas de las ${skills.length} skills. El extractor está ` +
    'roto: un cero de rutas y un cero de rutas rotas se leen igual.');
});

// ── ② AUTOPRUEBA DEL EXTRACTOR ──────────────────────────────────────────────────────────────
// Sin esto, un extractor que devolviera siempre [] pasaría el guard de abajo en verde.
test('SCRUM-538 · AUTOPRUEBA: el extractor coge rutas del repo y NO acusa a lo ajeno', () => {
  const tmp = path.join(RAIZ, 'tests', '_tmp-538.md');
  fs.writeFileSync(tmp, [
    'Lee `docs/YAQU_MASTER.md` y `scripts/x.mjs`.',
    'El XSD `SuministroLR.xsd` es de la AEAT, y `https://sede.agenciatributaria.gob.es/a.pdf` una URL.',
    'Un `fichero.txt` suelto tampoco es una ruta del repo.',
  ].join('\n'));
  try {
    const r = rutasNombradas(tmp).map((x) => x.ruta);
    assert.deepEqual(r.sort(), ['docs/YAQU_MASTER.md', 'scripts/x.mjs'],
      '🔴 el extractor no distingue una ruta del repo de un XSD de la AEAT, una URL o un fichero ' +
      'suelto. Acusar de más acaba igual que no acusar: con el guard desactivado.');
  } finally { fs.unlinkSync(tmp); }
});

// ── ②b LA EXCEPCIÓN, PROBADA EN LAS DOS DIRECCIONES ─────────────────────────────────────────
// La trajo un falso positivo real de este guard, así que va con su prueba: si mañana alguien
// afina la ventana o el patrón, esto dice cuál de las dos mitades se ha roto.
test('SCRUM-538 · nombrar un fichero PARA DECIR QUE NO EXISTE no cuenta como promesa', () => {
  const tmp = path.join(RAIZ, 'tests', '_tmp-538b.md');
  fs.writeFileSync(tmp, [
    'El documento `docs/QUE-NO-EXISTE-538.md` **no existe** (comprobado el 20-ago).',
    '',
    'Pero `docs/TAMPOCO-EXISTE-538.md` se cita a secas, y eso sí es una promesa.',
  ].join('\n'));
  try {
    const r = rutasNombradas(tmp).map((x) => x.ruta);
    assert.deepEqual(r, ['docs/TAMPOCO-EXISTE-538.md'],
      '🔴 o denuncia la que se declara ausente —y entonces hay que borrar la advertencia para ' +
      'callar el guard, con lo que el documento inexistente vuelve a citarse como si existiera— ' +
      'o deja pasar la que sí promete. Las dos cosas lo inutilizan.');
  } finally { fs.unlinkSync(tmp); }
});

// ── ③ EL GUARD ──────────────────────────────────────────────────────────────────────────────
test('SCRUM-538 · ninguna skill nombra un fichero del repo que NO existe', () => {
  const rotas = [];
  for (const f of skillsPropias()) {
    const skill = path.basename(path.dirname(f));
    for (const { ruta, linea } of rutasNombradas(f)) {
      if (!fs.existsSync(path.join(RAIZ, ruta))) rotas.push(`${skill}:${linea} → ${ruta}`);
    }
  }
  assert.deepEqual(rotas, [],
    '🔴 SKILLS QUE MANDAN A UN FICHERO QUE NO EXISTE:\n    ' + rotas.join('\n    ') +
    '\n\n  Una ruta que no resuelve no da error en ninguna parte: la sesión va a buscarla, no la\n' +
    '  encuentra y decide por su cuenta — y una skill se entrega a CADA sesión sin que nadie la\n' +
    '  pida.\n  Si el fichero se movió, corrige la ruta. Si nunca existió, quita la promesa: no se\n' +
    '  deja una cita a un documento que hay que escribir algún día.');
});
