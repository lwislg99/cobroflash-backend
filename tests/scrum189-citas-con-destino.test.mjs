// SCRUM-189 — una cita a la doctrina tiene que decir A QUÉ FICHERO apunta (sin gate: solo lee
// ficheros, no toca BD ni red).
//
// EL PROBLEMA NO ERA DE CONTENIDO, ERA DE PUNTERÍA — que es peor, porque tiene aspecto de
// precisión. Ocho comentarios citaban «regla N del runbook». La regla existía y era cierta,
// pero «el runbook» no identifica nada en este repo. Al ir a comprobarlo aparecieron CUATRO
// destinos posibles para un mismo «3»:
//
//   1. `docs/RUNBOOKS.md` → R3 es de PAGOS (webhook perdido).
//   2. `docs/QA/SUITE_REGRESION.md`, sección **«Runbook de ejecución»** → su punto 3 es
//      «limpia staging antes de una tanda». Y esta es la cruel: es la sección que LITERALMENTE
//      se llama runbook, así que el lector más diligente —el que abre el fichero correcto y
//      busca la sección con ese nombre— aterriza justo en el 3 equivocado.
//   3. `docs/QA/SUITE_REGRESION.md`, sección «Escribir verificaciones» → su punto 3 es el
//      bueno: «una red que solo funciona cuando alguien se acuerda de levantarla no es una red».
//   4. El mismo fichero tiene además secciones `## 0` … `## 8` de escenarios E2E.
//
// Y encima el sustantivo estaba mal: el documento los llama **principios**, no reglas.
//
// «Una cita cierta que dirige al sitio equivocado gasta más confianza que una cita vaga: la
// vaga te hace buscar, la falsamente precisa te hace descartar.»
//
// POR QUÉ ESTE GUARD Y NO SOLO EL ARREGLO: la cita ambigua no se escribió ocho veces, se COPIÓ
// de fichero en fichero — nació en SCRUM-113 y se propagó sola. Arreglar las ocho sin dejar
// mecanismo es garantizar la novena.
//
// TRAMPA (patrón SCRUM-125): este fichero necesita escribir los literales que persigue, así
// que se excluye a sí mismo POR RUTA. No se ofuscan: romper el `grep` a mano sería cambiar un
// problema de puntería por uno de visibilidad.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const THIS_FILE = fileURLToPath(import.meta.url);
const RAIZ = path.join(path.dirname(THIS_FILE), '..');

const DIRS = ['tests', 'scripts', 'src'];
const EXT = new Set(['.ts', '.js', '.mjs', '.cjs']);
const SKIP = new Set(['node_modules', '.git', 'dist', 'coverage']);

// UNA SOLA REGLA, y no dos, porque el primer intento tenía dos y se contradecían: prohibía la
// forma «N del runbook» a secas Y exigía nombrar el fichero. El arreglo que nombraba el fichero
// («trampa 5 del runbook de SUITE_REGRESION.md», que es perfectamente inequívoca) hacía saltar
// la primera. Un guard que rechaza el arreglo correcto de lo que persigue está mal formulado:
// lo que importa no es la forma de la frase, es si el lector puede llegar al destino.
const CITA_NUMERADA = /\b(regla|principio|trampa)\s+\d+\s+(del|de)\b/gi;

// Un destino vale si el lector puede llegar a él. Dos formas aceptadas:
//   · el nombre de un fichero `.md` — lo inequívoco por construcción;
//   · la palabra «máster» — hay UN máster (`docs/YAQU_MASTER.md`, regla 35) con UNA lista de
//     reglas numeradas, así que «regla 8 del máster» no admite confusión. Esta excepción no es
//     una concesión: es la diferencia exacta entre este caso y el del runbook, donde había dos
//     ficheros candidatos y cuatro numeraciones. Lo que se persigue es la ambigüedad, no la
//     falta de una fórmula.
const DESTINO_VALIDO = /\.md\b|\bm[áa]ster\b/i;
const DOC = 'SUITE_REGRESION.md';
const CERCA = 260; // caracteres a cada lado — un comentario de bloque cabe de sobra

function ficheros(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!SKIP.has(e.name)) ficheros(full, acc);
      continue;
    }
    if (full !== THIS_FILE && EXT.has(path.extname(e.name))) acc.push(full);
  }
  return acc;
}

const TODOS = DIRS.flatMap((d) => ficheros(path.join(RAIZ, d)));

test('SCRUM-189 · toda cita numerada a la doctrina nombra su fichero', () => {
  const huerfanas = [];
  for (const f of TODOS) {
    const texto = fs.readFileSync(f, 'utf8');
    for (const m of texto.matchAll(CITA_NUMERADA)) {
      const ventana = texto.slice(Math.max(0, m.index - CERCA), m.index + CERCA);
      if (!DESTINO_VALIDO.test(ventana)) {
        const linea = texto.slice(0, m.index).split('\n').length;
        huerfanas.push(`${path.relative(RAIZ, f)}:${linea} («${m[0]}»)`);
      }
    }
  }
  assert.deepEqual(
    huerfanas,
    [],
    `🔴 ${huerfanas.length} cita(s) numeran un principio o una trampa sin nombrar ` +
      `${DOC} cerca (${huerfanas.join(', ')}). El número solo no identifica nada: el mismo ` +
      `documento tiene «trampas» 1-7, «principios» 1-9 y secciones «## 0»-«## 8».`,
  );
});

// El otro lado del guard: que el destino al que ahora apuntan las citas EXISTA. Un guard que
// solo exige nombrar un fichero se conforma con que se nombre un fichero equivocado.
test('SCRUM-189 · el destino citado existe y dice lo que las citas dicen que dice', () => {
  // Espacios normalizados ANTES de buscar: en el documento la frase va partida en dos líneas
  // con sangría, así que buscarla literal daba un rojo por el formato y no por el contenido.
  // Es el mismo error que persigue este ticket, cometido dentro de su propio guard: dar por
  // hecho que una cita coincide carácter a carácter con su destino.
  const doc = fs
    .readFileSync(path.join(RAIZ, 'docs', 'QA', DOC), 'utf8')
    .replace(/\s+/g, ' ');
  assert.ok(
    doc.includes('Escribir verificaciones'),
    `🔴 la sección «Escribir verificaciones» ya no está en ${DOC}: las citas quedaron colgando`,
  );
  assert.ok(
    doc.toLowerCase().includes('una red que solo funciona cuando alguien se acuerda de levantarla no es una red'),
    '🔴 la frase del principio 3 ya no está en el documento. Si el texto cambió, hay que ' +
      'actualizar las citas que la reproducen — que es exactamente el fallo que este ticket cerró.',
  );
});
