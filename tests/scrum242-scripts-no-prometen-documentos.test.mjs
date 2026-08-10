// tests/scrum242-scripts-no-prometen-documentos.test.mjs — SCRUM-242
//
// UN SCRIPT NO NOMBRA UN DOCUMENTO QUE NO EXISTE.
//
// ── DE DÓNDE SALE ───────────────────────────────────────────────────────────────────────────
// `backup-dump.mjs` decía, en su cabecera: «restaurable con este mismo script en un entorno
// limpio — **ver RUNBOOK al final**». **Ese RUNBOOK no existe.** Una sola mención en todo el
// fichero: la promesa. Y `docs/RUNBOOKS.md` tampoco tiene procedimiento de restauración.
//
// Eso es peor que no decir nada. Quien lee la cabecera se queda tranquilo —«hay procedimiento»—
// y no lo busca hasta que lo necesita, que es a las tres de la mañana con la base caída. Es la
// misma familia que el marcador de microcopy que se pinta: **un relleno que tranquiliza es peor
// que un hueco**, porque parece intencionado.
//
// Es el hermano exacto de SCRUM-391 —«una constancia no nombra lo que no está»— aplicado a los
// SCRIPTS en vez de a las entradas de máster.
//
// ── LO QUE VIGILA, Y LO QUE NO PUEDE VIGILAR ────────────────────────────────────────────────
// Vigila **rutas de documento**, que son inequívocas. **No** puede vigilar la promesa en prosa
// («ver RUNBOOK al final») porque no es una ruta, y distinguir una promesa de una mención
// necesitaría una marca — o sea, una lista de excepciones con otro nombre. Esa se arregló a mano
// al medirla; ésta impide que vuelva a entrar la clase comprobable.
//
// ── LA EXCLUSIÓN QUE NO ES UNA EXENCIÓN ─────────────────────────────────────────────────────
// Un script SÍ puede nombrar un documento que **él mismo escribe**: `voice-eval.mjs` nombra
// `docs/evidencias/voice-eval/RESULTS.md` y lo genera con `writeFileSync`. Eso no es una promesa
// rota, es una salida. Se deriva de que la escritura esté EN EL PROPIO SCRIPT — nadie lo exime
// por su nombre, y el día que deje de escribirlo pasará a exigirse que exista.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '..');
const DIR = path.join(RAIZ, 'scripts');

/** Rutas `docs/…​.md` que nombra cada script, separando las que ese mismo script ESCRIBE. */
function referencias() {
  const prometidas = [];
  const producidas = [];
  let ficheros;
  try {
    ficheros = fs.readdirSync(DIR).filter((f) => f.endsWith('.mjs'));
  } catch (e) {
    assert.fail(
      `🔴 no se pudo leer ${DIR} (${e && e.code ? e.code : e}).\n\n`
      + '  «No hay promesas rotas» y «no supe leer el directorio» son el mismo verde.');
  }
  for (const f of ficheros) {
    const codigo = fs.readFileSync(path.join(DIR, f), 'utf8');
    for (const ruta of new Set([...codigo.matchAll(/docs\/[A-Za-z0-9_/-]+\.md/g)].map((m) => m[0]))) {
      // ¿Lo escribe él? Se busca el NOMBRE del fichero dentro de una llamada de escritura del
      // propio script. Derivado, no listado.
      const base = path.basename(ruta);
      const escribe = new RegExp(`(writeFileSync|appendFileSync|createWriteStream)\\([^)]*${base.replace('.', '\\.')}`)
        .test(codigo.replace(/\s+/g, ' '));
      (escribe ? producidas : prometidas).push({ script: f, ruta });
    }
  }
  return { prometidas, producidas, ficheros };
}

const MINIMO_REFERENCIAS = 10;

test('SCRUM-242 · SUELO: el detector ve scripts y ve referencias a documento', () => {
  const { prometidas, producidas, ficheros } = referencias();
  assert.ok(ficheros.length >= 15,
    `🔴 solo ${ficheros.length} scripts leídos: el detector no está mirando donde cree`);
  const total = prometidas.length + producidas.length;
  assert.ok(total >= MINIMO_REFERENCIAS,
    `🔴 solo ${total} referencias a documento en ${ficheros.length} scripts: si el extractor deja de verlas, «ninguna promesa rota» no significa nada`);
  // Y el otro cero: si TODAS quedaran clasificadas como «las escribe el script», la exclusión se
  // estaría comiendo el guard entero.
  assert.ok(prometidas.length > 0,
    '🔴 no queda ni una referencia que EXIGIR: la exclusión de salidas se está tragando todas, y entonces el guard no vigila nada');
});

test('SCRUM-242 · la salida que un script GENERA no cuenta como promesa', () => {
  // `voice-eval.mjs` nombra su `RESULTS.md` y lo escribe. Marcarlo sería un rojo en falso, y un
  // guard que da rojos en falso acaba silenciado. Se excluye por lo que HACE, no por su nombre.
  const { producidas } = referencias();
  assert.ok(producidas.length > 0,
    '🔴 el detector no reconoce NINGUNA salida generada: o dejó de haberlas, o la derivación está rota y volverán los rojos en falso');
});

test('SCRUM-242 · ningún script nombra un documento que no existe', () => {
  const { prometidas } = referencias();
  const rotas = prometidas
    .filter(({ ruta }) => !fs.existsSync(path.join(RAIZ, ruta)))
    .map(({ script, ruta }) => `${script} nombra ${ruta}, que NO está en el árbol`);

  assert.deepEqual(
    rotas, [],
    '🔴 UN SCRIPT PROMETE UN DOCUMENTO QUE NO EXISTE:\n    ' + rotas.join('\n    ')
    + '\n\n  Peor que no decir nada: quien lo lee se queda tranquilo y no lo busca hasta que lo\n'
    + '  necesita — y a un runbook se llega a las tres de la mañana con la base caída.\n\n'
    + '  Dos salidas, las dos honestas: escribir el documento, o quitar la referencia.\n'
    + '  Lo que no vale es dejarla apuntando al vacío.\n\n  Y NO ES EL UNICO que vigila una entrada del registro: son CUATRO, y cada sesion los ha\n  ido descubriendo EN ROJO despues de empujar. Compruebalos todos antes con\n  `npm run guards:entrada` (segundos: no compila ni toca la base).');
});
