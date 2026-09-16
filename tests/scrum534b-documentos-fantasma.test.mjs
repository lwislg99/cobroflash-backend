// tests/scrum534b-documentos-fantasma.test.mjs — SCRUM-534b
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// UN DOCUMENTO CITADO QUE NO EXISTE ES PEOR QUE UNO QUE FALTA.
//
//   >>> El que falta se busca. El citado se da por leído. <<<
//
// Salió de rebote al medir SCRUM-534: `docs/VERIFACTU_EVIDENCIAS.md` no existe y lo citaban el
// máster, un runbook y dos skills. Medido hoy sobre el árbol entero: **7 citadores**, no 4.
//
// ⛔ ESTE FICHERO NO CREA NINGÚN DOCUMENTO Y NO CORRIGE NINGUNA CITA. Lista y clasifica (regla 9).
// ═══════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { censar, linea, citasPorLinea, citasNormalizadas, FUENTES } from '../scripts/_documentos-citados.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ═══ 🔴 EL QUE DECIDE ════════════════════════════════════════════════════════════════════════

test('SCRUM-534b · 🔴 EL QUE DECIDE: `docs/VERIFACTU_EVIDENCIAS.md` sale, con sus citadores', () => {
  const c = censar(RAIZ);
  const f = c.fantasmas.find((x) => x.ruta === 'docs/VERIFACTU_EVIDENCIAS.md');
  assert.ok(f,
    '🔴 EL CENSO NO VE EL CASO CONOCIDO. `docs/VERIFACTU_EVIDENCIAS.md` no existe y lo citan el '
    + 'máster, un runbook y dos skills. Si no sale en la lista, el censo no está mirando.');
  assert.ok(f.citadores.length >= 4,
    `🔴 lo ve pero sólo le encuentra ${f.citadores.length} citador(es), y el ticket ya nombraba `
    + 'cuatro. Un censo que ve el caso y pierde la mitad de sus citas manda a arreglar a medias.');

  // Y que NO exista de verdad, para que este control no pase por una ruta mal escrita aquí.
  assert.equal(fs.existsSync(path.join(RAIZ, 'docs/VERIFACTU_EVIDENCIAS.md')), false,
    '🔴 el documento YA EXISTE: alguien lo creó y este control mide otra cosa. Enhorabuena, y hay '
    + 'que rehacerlo con otro caso conocido.');
});

// ═══ ✅ CONTROL POSITIVO ═════════════════════════════════════════════════════════════════════

test('SCRUM-534b · ✅ POSITIVO: un documento citado que SÍ existe NO sale en la lista', () => {
  // Se elige uno conocido y muy citado: si el censo lo marcara fantasma, acusaría al árbol entero.
  const CONOCIDO = 'docs/RUNBOOKS.md';
  assert.ok(fs.existsSync(path.join(RAIZ, CONOCIDO)), `🔴 ${CONOCIDO} no existe: control mal elegido.`);

  const c = censar(RAIZ);
  const marcado = [...c.fantasmas, ...c.deudaDeNombre].some((x) => x.ruta === CONOCIDO);
  assert.equal(marcado, false,
    `🔴 ${CONOCIDO} EXISTE y el censo lo marca como fantasma. Un censo que acusa lo que está bien `
    + 'se apaga en una semana, y con razón.');
  assert.ok(c.existen.some((x) => x.ruta === CONOCIDO),
    `🔴 ${CONOCIDO} no aparece ni entre los que existen: entonces el censo no lo ha visto citado, `
    + 'y su ausencia de la lista de fantasmas no significa nada.');
});

// ═══ 🔴 SUELO ═══════════════════════════════════════════════════════════════════════════════

test('SCRUM-534b · 🔴 SUELO: cero citas es CIEGO, no «está limpio»', () => {
  const c = censar(RAIZ);
  assert.ok(c.fuentes > 50,
    `🔴 CIEGO: el censo sólo ve ${c.fuentes} documentos fuente. La población declarada son `
    + `${FUENTES.length} familias y este repo tiene cientos de .md.`);
  assert.ok(c.rutasCitadas > 0,
    '🔴 CIEGO: cero rutas .md citadas en todo el árbol. Vacío y no-medido se leen igual, y una de '
    + 'las dos lecturas es falsa.');

  // Y las partes SUMAN: un censo cuyas clases no cierran no es un censo.
  const suma = c.existen.length + c.fantasmas.length + c.deudaDeNombre.length
    + c.futuros.length + c.plantillas.length + c.generados.length + c.enHistorico.length;
  assert.equal(suma, c.rutasCitadas,
    `🔴 las clases suman ${suma} y hay ${c.rutasCitadas} rutas citadas: el reparto pierde entradas.`);
});

// ═══ 🔴 LOS DOS INSTRUMENTOS, Y SU DISCREPANCIA ══════════════════════════════════════════════

test('SCRUM-534b · 🔴 el instrumento por LÍNEA pierde la cita que ENVUELVE; el normalizado no', () => {
  // Es la trampa que mordió esta mañana en `PACK_GESTORIA.md:13`: el markdown envuelve y la cita
  // queda partida, con un `**` en medio. Se reproduce con el caso mínimo.
  const envuelta = 'Ver el detalle en **docs/\nVERIFACTU_EVIDENCIAS.md** para las capturas.\n';
  const recta = 'Ver el detalle en `docs/RUNBOOKS.md` para las capturas.\n';

  assert.ok(citasPorLinea(recta).citas.some((c) => c.ruta === 'docs/RUNBOOKS.md'),
    '🔴 el instrumento por línea no ve ni una cita recta: no vale para nada.');
  assert.ok(citasNormalizadas(recta).includes('docs/RUNBOOKS.md'),
    '🔴 el instrumento normalizado tampoco ve la cita recta.');

  // La que envuelve: el de línea NO la ve entera; el normalizado SÍ. Ésa es la discrepancia.
  const porLinea = citasPorLinea(envuelta).citas.map((c) => c.ruta);
  assert.equal(porLinea.includes('docs/VERIFACTU_EVIDENCIAS.md'), false,
    '🔴 la premisa ha dejado de ser cierta: el instrumento por línea ya ve la cita partida. Si se '
    + 'arregló por otra vía, este control sobra y hay que rehacerlo, no relajarlo.');
  assert.ok(citasNormalizadas(envuelta).includes('docs/VERIFACTU_EVIDENCIAS.md'),
    '🔴 EL INSTRUMENTO NORMALIZADO TAMPOCO VE LA CITA QUE ENVUELVE. Entonces los dos son el mismo '
    + 'y el censo pierde todas las citas partidas — que es como se perdió una afirmación viva en '
    + 'el documento de la gestoría esta mañana.');
});

test('SCRUM-534b · ⚠️ una cita dentro de un BLOQUE DE CÓDIGO no cuenta, y se dice cuántas', () => {
  // Un ejemplo o una plantilla nombran ficheros que no tienen por qué existir. Filtrarlo está
  // bien; filtrarlo EN SILENCIO no: el censo declara cuántas descuenta.
  const conBloque = 'Texto normal con `docs/RUNBOOKS.md`.\n\n```\nver docs/NO_EXISTE_JAMAS.md\n```\n';
  const r = citasPorLinea(conBloque);
  assert.ok(r.citas.some((c) => c.ruta === 'docs/RUNBOOKS.md'), '🔴 se come también la cita de fuera.');
  assert.equal(r.citas.some((c) => c.ruta === 'docs/NO_EXISTE_JAMAS.md'), false,
    '🔴 cuenta como cita una ruta que vive dentro de un bloque de código: el censo se llenaría de '
    + 'ejemplos y nadie lo miraría.');
  assert.equal(r.descontadasEnCodigo, 1,
    `🔴 descuenta ${r.descontadasEnCodigo} y debía descontar 1. Un filtro que no declara lo que se `
    + 'come es un número sin auditar.');
  assert.equal(citasNormalizadas(conBloque).includes('docs/NO_EXISTE_JAMAS.md'), false,
    '🔴 el instrumento normalizado sí se traga el bloque de código: los dos tienen que descontarlo.');
});

// ═══ 🔴 EL REPARTO, que es el entregable ════════════════════════════════════════════════════

test('SCRUM-534b · 🔴 el censo DECLARA su reparto, no un total suelto', (t) => {
  const c = censar(RAIZ);
  t.diagnostic(linea(c));
  for (const f of [...c.fantasmas].sort((a, b) => b.citadores.length - a.citadores.length).slice(0, 12)) {
    t.diagnostic(`  FANTASMA · ${f.ruta} ← ${f.citadores.length} cita(s)`);
  }
  // No hay trinquete numérico a propósito: esta fase MIDE y no arregla, así que fijar el número
  // convertiría en rojo el trabajo de quien empiece a borrar citas — que es lo que debe pasar.
  assert.ok(c.fantasmas.length > 0,
    '🔴 CERO fantasmas. Si de verdad se han arreglado todos, enhorabuena: hay que rehacer este '
    + 'test como trinquete. Pero lo más probable es que el censo haya dejado de ver.');
});

test('SCRUM-534b · una PLANTILLA no es un documento que falte', () => {
  // `docs/equipo/sesion-N.md` es cómo se escribe «el de tu sesión»; `sesion-5.md` existe. Sin este
  // cubo el censo mandaba a crear un fichero que no debe existir.
  const c = censar(RAIZ);
  assert.ok(c.plantillas.some((x) => /sesion-N\.md$/.test(x.ruta)),
    '🔴 `sesion-N.md` ya no se reconoce como plantilla: volvería a la lista de fantasmas y alguien '
    + 'lo crearía.');
  assert.equal(c.fantasmas.some((x) => /sesion-N\.md$/.test(x.ruta)), false,
    '🔴 y además sigue acusada como fantasma: los cubos no son excluyentes.');
});

test('SCRUM-534b · el censo no se cae con un árbol sin documentos', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum534b-'));
  try {
    fs.mkdirSync(path.join(dir, 'docs'), { recursive: true });
    const c = censar(dir);
    assert.equal(c.rutasCitadas, 0, '🔴 inventa citas donde no hay documentos.');
    assert.deepEqual(c.fantasmas, [], '🔴 inventa fantasmas sobre un árbol vacío.');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
