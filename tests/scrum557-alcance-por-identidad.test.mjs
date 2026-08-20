// tests/scrum557-alcance-por-identidad.test.mjs — SCRUM-557
//
// Sin gate: lee ficheros. Ni BD, ni red, ni servidor.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL DEFECTO, ENUNCIADO — y enunciarlo es medio ticket
//
// `data-microcopy="PENDIENTE_FUNDADOR"` hacía DOS trabajos a la vez: marcar que un texto no
// está aprobado, y definir el alcance del censo de SCRUM-551. Con eso, **el día que se aprueba
// un texto y se retira el marcador, ese texto SALE DEL CENSO**: aprobar apagaba la vigilancia
// sobre lo aprobado, justo cuando pasa a ser publicable.
//
// No es hipotético. El fundador aprobó los 37 textos el 20-ago-2026, y registrar esa aprobación
// consiste en retirar los 17 marcadores de `#heroe-f4` y `#gremios`. Con el mecanismo viejo ese
// commit habría dejado 17 anclas huérfanas y las tres frases sin ancla sin vigilar.
//
// AHORA el alcance sale de la IDENTIDAD de las secciones: una deja de censarse cuando DEJA DE
// EXISTIR. Este fichero es la prueba de esa frase, en las dos direcciones.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  censar, censarEnDisco, unidades, bloquesDePropuesta, seccionesMarcadasSinDeclarar,
  SECCIONES_BLOQUE_F, MARCADORES_DE_APROBACION, ANCLAS_F, LANDING,
} from '../scripts/censo-anclas-bloque-f.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(RAIZ, LANDING), 'utf8');

/** Los 17 ids medidos el 20-ago-2026, ANTES del cambio de alcance. */
const IDS_17 = Object.keys(ANCLAS_F).sort();

// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL CONTROL QUE DECIDE · sin esto, el ticket no está hecho
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-557 · 🔴 RETIRAR EL MARCADOR DE APROBACIÓN NO SACA LA SECCIÓN DEL CENSO', () => {
  // Es el ticket entero en una línea. Con el mecanismo viejo —descubrir por el atributo— esto
  // devolvía CERO unidades y el censo se quedaba mirando al vacío en silencio.
  // ⚠️ Se retira la forma de ATRIBUTO (precedida de espacio), no cualquier aparición del texto:
  //   los comentarios del HTML citan el marcador entre comillas invertidas para explicar la
  //   convención, y borrar una cita no es lo que hace una aprobación. Confundir la cita con el
  //   atributo es la trampa de autorreferencia de siempre.
  const ATRIBUTO = /\sdata-microcopy="PENDIENTE_FUNDADOR"/g;
  const aprobado = html.replace(ATRIBUTO, '');
  assert.notEqual(aprobado, html, '🔴 la inyección no se aplicó: la prueba no probaría nada');
  assert.equal((aprobado.match(ATRIBUTO) || []).length, 0,
    '🔴 quedan marcadores sin retirar: el escenario de la aprobación no se ha reproducido');

  const idsDespues = unidades(aprobado).map((u) => u.id).sort();
  assert.deepEqual(idsDespues, IDS_17,
    '🔴 AL RETIRAR LOS MARCADORES EL CENSO DEJA DE VER LAS UNIDADES.\n\n'
    + '  Es exactamente el defecto de este ticket: aprobar apagaría la vigilancia sobre lo\n'
    + '  aprobado, y las tres frases sin ancla dejarían de estar vigiladas justo cuando pasan a\n'
    + `  ser publicables. Vio ${idsDespues.length} de ${IDS_17.length}.`);

  // Y el veredicto tiene que ser el MISMO: las tres sin ancla siguen saliendo.
  const r = censar({ html: aprobado, raiz: RAIZ });
  assert.deepEqual(r.sinAncla.map((s) => s.id).sort(),
    ['gremios[electricidad]/p#1', 'gremios[pintura]/p#1', 'heroe-f4/p#1'],
    '🔴 tras la aprobación, las tres promesas sin ancla dejan de reportarse');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ✅ CONTROL POSITIVO · las 17, id por id, sin mover una
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-557 · ✅ el censo sigue viendo las MISMAS 17 unidades, id por id', () => {
  const ids = unidades(html).map((u) => u.id).sort();
  assert.equal(ids.length, 17, `🔴 el censo ve ${ids.length} unidades y eran 17`);
  assert.deepEqual(ids, IDS_17,
    '🔴 HA CAMBIADO ALGÚN ID. El cambio de alcance no puede mover ni uno: si se mueve, las anclas '
    + 'declaradas dejan de emparejar y el registro entero hay que revisarlo a mano.');
  assert.deepEqual(bloquesDePropuesta(html).map((b) => b.id), ['heroe-f4', 'gremios']);
});

test('SCRUM-557 · `#contacto-publico` SALE, y sale por el CRITERIO, no por quitarle el atributo', () => {
  // El criterio está escrito en `SECCIONES_BLOQUE_F`: este censo vigila el texto del bloque F que
  // está EN PROPUESTA, y `#contacto-publico` es el canal de contacto de F7.
  assert.equal(SECCIONES_BLOQUE_F['contacto-publico'].censada, false);
  assert.ok(SECCIONES_BLOQUE_F['contacto-publico'].motivo,
    '🔴 sale del censo sin motivo escrito: entonces es un descarte, no un criterio');

  // 🔴 Y SU MARCADOR SIGUE PUESTO: retirarlo sería registrar una aprobación, y eso no es de este
  //    ticket. Que salga del censo y que conserve su marcador son cosas independientes — que se
  //    confundieran es justo el defecto que se está corrigiendo.
  assert.match(html, /id="contacto-publico"[\s\S]{0,300}?data-microcopy="PENDIENTE_FUNDADOR"/,
    '🔴 se le ha retirado el marcador a `#contacto-publico`. Eso es registrar una aprobación y '
    + 'lo hace S3 en otro ticket; aquí sólo se decide que no lo censa este guard.');

  assert.ok(!unidades(html).some((u) => u.id.startsWith('contacto-publico')),
    '🔴 `#contacto-publico` sigue aportando unidades al censo');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 ROJO POR EL MECANISMO · una sección deja de censarse cuando DEJA DE EXISTIR
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-557 · 🔴 borrar una sección declarada CAE, nombrándola', () => {
  const sinGremios = html.replace(/<section id="gremios"/, '<section id="gremios-retirada"');
  assert.notEqual(sinGremios, html, '🔴 la inyección no se aplicó');

  const r = censar({ html: sinGremios, raiz: RAIZ });
  assert.equal(r.ok, false, '🔴 desapareció una sección declarada y el censo lo dio por bueno');
  assert.match(r.salida, /SECCION DECLARADA QUE NO EXISTE: #gremios/,
    '🔴 no NOMBRA la sección que falta: sin el nombre no se sabe si le cambiaron el id o se retiró');
});

test('SCRUM-557 · 🔴 una sección MARCADA y sin declarar obliga a decidir', () => {
  // Es lo que pasó con `#contacto-publico` en SCRUM-549: dos ramas correctas por separado que no
  // se conocían. Con la red de seguridad, el censo no la traga NI la ignora en silencio.
  const nueva = html.replace('<footer>',
    '<section id="bloque-nuevo" hidden data-propuesta="microcopy-sin-aprobar"><p>Texto nuevo.</p></section>\n<footer>');
  assert.notEqual(nueva, html, '🔴 la inyección no se aplicó');

  assert.deepEqual(seccionesMarcadasSinDeclarar(nueva), ['bloque-nuevo']);
  const r = censar({ html: nueva, raiz: RAIZ });
  assert.equal(r.ok, false, '🔴 una sección con marcador de aprobación entró sin que nadie decidiera');
  assert.match(r.salida, /SECCION MARCADA Y SIN DECLARAR: #bloque-nuevo/);
});

test('SCRUM-557 · 🔴 SUELO: sin NINGUNA sección del bloque F, se declara CIEGO', () => {
  const r = censar({ html: '<section id="otra"><p>Nada que ver.</p></section>', raiz: RAIZ });
  assert.equal(r.ciego, true,
    '🔴 «cero unidades» y «no encontré ninguna sección» dan el mismo número y significan lo '
    + 'contrario. Sin esta distinción, un HTML equivocado se leería como bloque F limpio.');
  assert.equal(r.ok, false);
  assert.match(r.salida, /CIEGO/);
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// LOS DOS MARCADORES · medidos, y NO fusionados
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-557 · los dos marcadores de aprobación existen y NINGUNO define el alcance', () => {
  // Medido antes de elegir cómo (punto 1 del ticket): son dos grafías del mismo concepto
  // —«texto sin aprobar»— y las dos van con la sección `hidden`. Que sean parecidos NO los hace
  // el mismo campo, así que aquí no se fusionan: sólo se deja de depender de ellos.
  assert.equal(MARCADORES_DE_APROBACION.length, 2,
    '🔴 la lista de marcadores ha cambiado. Si aparece un tercero, la red de seguridad tiene que '
    + 'conocerlo o dejará de ver secciones nuevas.');
  assert.ok(MARCADORES_DE_APROBACION.some((re) => re.test('data-microcopy="PENDIENTE_FUNDADOR"')));
  assert.ok(MARCADORES_DE_APROBACION.some((re) => re.test('data-propuesta="microcopy-sin-aprobar"')));

  // Y los dos siguen en la landing: si uno desapareciera, la red vigilaría un marcador muerto.
  assert.match(html, /data-microcopy="PENDIENTE_FUNDADOR"/);
  assert.match(html, /data-propuesta="microcopy-sin-aprobar"/);

  // `#comparativa` queda declarada FUERA con su ticket: un hueco escrito, no escondido.
  assert.equal(SECCIONES_BLOQUE_F.comparativa.censada, false);
  assert.match(SECCIONES_BLOQUE_F.comparativa.motivo, /SCRUM-555/);
});

test('SCRUM-557 · el repo REAL pasa, y sigue reportando las tres sin ancla', () => {
  const r = censarEnDisco(RAIZ);
  assert.equal(r.ciego, false);
  assert.deepEqual(r.sinAncla.map((s) => s.id).sort(),
    ['gremios[electricidad]/p#1', 'gremios[pintura]/p#1', 'heroe-f4/p#1'],
    '🔴 han cambiado las promesas sin ancla. El cambio de alcance no puede alterarlas.');
});
