// tests/scrum293-cero-literales-retencion.test.mjs — SCRUM-293 (③b), guard estructural, sin gate.
//
// CERO LITERALES DE PORCENTAJE DE RETENCIÓN EN `public/dashboard/js/`.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LO QUE ESTE GUARD IMPIDE, y no es higiene
//
// El selector de ③a se pinta RECORRIENDO `CUBO_DE_RETENCION`. Eso es lo que hace que añadir o
// quitar un tipo se vea solo en pantalla. Un `<option>` escrito a mano rompe justo esa propiedad:
// el día que el cubo cambie, la pantalla seguirá ofreciendo el tipo viejo **y nada avisará**.
//
// Y es un fallo MUDO de los caros: el profesional elige un tipo retirado, la factura sale, el
// cliente la paga, y el descuadre aparece en el 111 meses después — cuando ya no se puede corregir
// (regla 29). Ningún síntoma por el camino.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 EL SUELO ES LA MITAD DE ESTE FICHERO, Y NO ES CELO
//
// «Cero literales» y «no encontré los ficheros» dan **exactamente el mismo verde**. Esta semana
// pasó en las dos direcciones: el guard de SCRUM-480 AVISÓ cuando se le encogió la población, y el
// censo de deriva contestó «en sync» sobre columnas que ni había leído. La diferencia entre los dos
// no fue la suerte: fue que uno tenía suelo.
//
// Así que antes de creerse el cero se comprueba, EN ESTE ORDEN:
//   ① la autoprueba: el detector caza trampas plantadas sobre fuente sintética — y NO caza los
//     inocentes, que aquí es lo caro (el corpus real está lleno de `width:100%` y de `IVA 21 %`);
//   ② que había ficheros que leer, y que está el que pinta el selector;
//   ③ que el cubo llegó con tipos: sin tipos no hay patrones, y sin patrones todo pasa;
//   ④ que un directorio sin ficheros se DECLARA ciego y NO pasaría el suelo.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { censarLiteralesDeRetencion, patronDe, autoprueba } from './_censo-literales-retencion.mjs';
import { tiposDeRetencionOrdenados } from '../dist/modules/invoicing/domain/retencionIrpf.js';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR_JS = path.join(RAIZ, 'public/dashboard/js');

/** 🔴 LOS TIPOS NO SE ESCRIBEN AQUÍ: salen del cubo. Una lista a mano se queda atrás sola. */
const CUBO = tiposDeRetencionOrdenados();
const TIPOS = CUBO.map((t) => t.tipo);
const CENSO = censarLiteralesDeRetencion(DIR_JS, TIPOS);

// ── ① AUTOPRUEBA · antes de creerse ningún cero ──────────────────────────────────────────

test('SCRUM-293 ③b · 🔴 AUTOPRUEBA: el detector se prueba sobre fuente SINTÉTICA antes de creerse su cero', () => {
  const a = autoprueba();
  assert.ok(a.leyoLosDos, `🔴 la autoprueba no leyó sus dos ficheros (leyó ${a.hallazgos.length ? '?' : 0}).`);
  assert.ok(a.cazaElRotulo,
    '🔴 el detector NO caza un rótulo de retención escrito a mano. Es el caso exacto del ticket: ' +
    'sin esto, su cero sobre el repo real no vale nada.');
  assert.ok(a.cazaSinEspacio,
    '🔴 no caza la forma sin espacio. En pantalla se lee igual, así que prohibir solo una de las ' +
    'dos deja la puerta abierta por la otra.');
  assert.ok(a.cazaEnPlantilla,
    '🔴 no caza el literal dentro de una plantilla. La mitad de este front pinta con plantillas: ' +
    'un detector que solo mire cadenas sueltas está mirando la mitad del código.');
  assert.ok(a.nombraLinea, '🔴 caza pero no sabe decir en qué línea: el rojo no podría atenderse.');

  // 🔴 EL CONTROL NEGATIVO, que es el que decide si este guard puede vivir en la suite.
  assert.ok(a.noCazaAlInocente,
    '🔴 el detector acusa a literales legítimos. MEDIDO en el repo real: 63 literales con forma ' +
    '«N %» y ninguno es una retención — pero «IVA 21 %» CONTIENE «1 %» y `width:100%` contiene un ' +
    '«0%». Un guard que nace acusando al IVA lo apaga alguien en una hora, y con razón.\n' +
    `   cazó: ${a.hallazgos.map((h) => `${h.fichero}:${h.linea} «${h.fragmento}»`).join(' · ')}`);
});

// ── ② y ③ SUELO · ¿había algo que mirar, y con qué se miraba? ────────────────────────────

test('SCRUM-293 ③b · 🔴 SUELO: había ficheros que leer, y está el que pinta el selector', () => {
  assert.equal(CENSO.sinDirectorio, false,
    `🔴 CIEGO: no existe «${DIR_JS}». El guard no ha mirado nada y sin este suelo habría dado VERDE.`);
  assert.ok(CENSO.ficherosLeidos >= 40,
    `🔴 CIEGO: solo ${CENSO.ficherosLeidos} ficheros .js leídos, y el 13-ago-2026 eran 60. Una caída ` +
    'así no es limpieza: es que el guard ha dejado de encontrar lo que vigila. «Cero literales» y ' +
    '«no supe mirar» son el mismo verde — arréglalo antes de creerte el cero.');
  assert.ok(CENSO.ficheros.includes('settingsView.js'),
    '🔴 CIEGO: `settingsView.js` no está entre los ficheros leídos, y es LA pantalla que pinta el ' +
    'selector de retención. Si se ha renombrado o movido, este guard está vigilando un sitio donde ' +
    'ya no puede aparecer el defecto — y seguiría en verde para siempre.');
});

test('SCRUM-293 ③b · 🔴 SUELO: el cubo llegó con tipos, o no habría nada prohibido', () => {
  // Sin tipos no se construye ningún patrón, así que el censo saldría vacío y el guard verde
  // sobre una pantalla llena de porcentajes a mano. Es la forma más silenciosa de quedarse ciego.
  assert.ok(TIPOS.length >= 4,
    `🔴 CIEGO: el cubo trae ${TIPOS.length} tipos y son al menos 4. Sin tipos no hay patrones y ` +
    'este guard aprobaría cualquier cosa.');
  assert.ok(TIPOS.every((t) => typeof t === 'number' && Number.isFinite(t)),
    `🔴 CIEGO: algún tipo del cubo no es un número: ${JSON.stringify(TIPOS)}`);

  // 🔴 Y EL LAZO QUE ATA EL PATRÓN AL CUBO: cada rótulo que hoy pinta el dominio tiene que ser
  // cazado por su propio patrón. Si mañana el rótulo pasa a «15 por ciento», el patrón dejaría de
  // describirlo y este guard vigilaría una forma que ya nadie escribe — sin enterarse.
  for (const { tipo, rotulo } of CUBO) {
    assert.match(rotulo, patronDe(tipo),
      `🔴 el rótulo «${rotulo}» del cubo NO lo caza el patrón de su propio tipo (${tipo}). El ` +
      'formato del rótulo ha cambiado y la vigilancia se ha quedado describiendo el de antes.');
  }
});

// ── ④ SUELO · el ciego se DECLARA, no se disfraza de verde ───────────────────────────────

test('SCRUM-293 ③b · 🔴 SUELO: sin ficheros que mirar, el censo se DECLARA ciego y NO pasa el suelo', () => {
  // Probado, no prometido — y probado en las DOS formas de quedarse sin población, porque no son
  // la misma avería: un directorio BORRADO y un directorio VACIADO llegan por caminos distintos.
  const vacio = fs.mkdtempSync(path.join(os.tmpdir(), 'yaqu-vacio-'));
  try {
    const rVacio = censarLiteralesDeRetencion(vacio, TIPOS);
    assert.equal(rVacio.sinDirectorio, false, '🔴 un directorio que SÍ existe se declara inexistente.');
    assert.equal(rVacio.ficherosLeidos, 0);
    assert.deepEqual(rVacio.hallazgos, [],
      '🔴 sin ficheros el censo devuelve hallazgos: está midiendo otra cosa.');
    // Y LA CONSECUENCIA, que es lo único que de verdad protege: ese cero NO pasa el suelo real.
    assert.ok(!(rVacio.ficherosLeidos >= 40),
      '🔴 un directorio vacío pasaría el suelo de ②: entonces el suelo no es un suelo y este guard ' +
      'daría VERDE exactamente cuando ha dejado de mirar.');
  } finally {
    fs.rmSync(vacio, { recursive: true, force: true });
  }

  const rNoExiste = censarLiteralesDeRetencion(path.join(RAIZ, 'no-existe-este-directorio'), TIPOS);
  assert.equal(rNoExiste.sinDirectorio, true,
    '🔴 un directorio INEXISTENTE no se declara como tal. «No está» y «está y no tiene nada» son ' +
    'averías distintas, y confundirlas manda a arreglar lo que no es.');
  assert.equal(rNoExiste.ficherosLeidos, 0);
});

// ── EL GUARD ─────────────────────────────────────────────────────────────────────────────

test('SCRUM-293 ③b · 🔴 CERO literales de porcentaje de retención en el front', (t) => {
  t.diagnostic(`${CENSO.ficherosLeidos} ficheros · tipos vigilados: ${TIPOS.join(', ')}`);

  // 🔴 CON FICHERO Y LÍNEA: un guard que obliga a buscar a mano lo que ha cazado se acaba apagando.
  const nombrados = CENSO.hallazgos
    .map((h) => `   public/dashboard/js/${h.fichero}:${h.linea}  (tipo ${h.tipo})  «${h.fragmento}»`)
    .join('\n');

  assert.deepEqual(CENSO.hallazgos.map((h) => `${h.fichero}:${h.linea}`), [],
    `🔴 HAY ${CENSO.hallazgos.length} LITERAL(ES) DE PORCENTAJE DE RETENCIÓN ESCRITO(S) A MANO:\n\n` +
    `${nombrados}\n\n` +
    '  El selector se pinta RECORRIENDO `CUBO_DE_RETENCION` justo para que esto no exista. Un\n' +
    '  porcentaje escrito a mano es un número suelto que nadie relaciona con esa lista: el día que\n' +
    '  se añada o se quite un tipo, la pantalla seguirá ofreciendo el de ayer y NADA AVISARÁ.\n\n' +
    '  Y el fallo no da síntomas: el profesional elige un tipo retirado, la factura sale, el cliente\n' +
    '  la paga, y el descuadre aparece en el 111 meses después — cuando ya no se puede corregir.\n\n' +
    '  ARRÉGLALO PINTANDO DESDE EL CUBO, no borrando el número: los rótulos viajan al navegador en\n' +
    '  `window.appRetencionOpciones` (el cable de ③a, `/admin/me`). Si de verdad hace falta un\n' +
    '  porcentaje literal ahí, no es este guard el que sobra: es que la decisión cambió, y se dice.');
});

test('SCRUM-293 ③b · 🔴 CONTROL POSITIVO: el guard SÍ caza el caso del ticket sobre el árbol REAL', () => {
  // El cero de arriba no prueba que el guard funcione: prueba que hoy no hay nada. Así que se
  // planta el defecto EN EL DIRECTORIO REAL —copiado a un temporal junto a los 60 de verdad— y se
  // comprueba que cae. Sin esto, un detector roto y una pantalla limpia son indistinguibles.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'yaqu-real-'));
  try {
    for (const f of CENSO.ficheros) {
      fs.copyFileSync(path.join(DIR_JS, f), path.join(dir, f));
    }
    // La trampa: exactamente lo que el cubo existe para impedir, en la pantalla del selector.
    const victima = path.join(dir, 'settingsView.js');
    const original = fs.readFileSync(victima, 'utf8');
    fs.writeFileSync(victima, original + '\nvar opcionAMano = "' + CUBO[0].rotulo + '";\n', 'utf8');

    const r = censarLiteralesDeRetencion(dir, TIPOS);
    assert.equal(r.ficherosLeidos, CENSO.ficherosLeidos,
      '🔴 la copia no tiene los mismos ficheros que el original: el control no probaría lo que dice.');
    const cazado = r.hallazgos.find((h) => h.fichero === 'settingsView.js' && h.tipo === CUBO[0].tipo);
    assert.ok(cazado,
      '🔴 el guard NO caza un rótulo del cubo escrito a mano en `settingsView.js`. Entonces su cero ' +
      'sobre el árbol real no significa nada.');
    assert.ok(cazado.linea > 1, '🔴 lo caza pero no lo sitúa: el rojo no podría atenderse.');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
