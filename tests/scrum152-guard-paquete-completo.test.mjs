// SCRUM-152 — el paquete de export no puede perder un dataset EN SILENCIO.
// SIN gate, puro (sin BD, sin red): corre en `npm test` normal. Patrón scrum87/96/124.
//
// POR QUÉ EXISTE: SCRUM-138 dejó CUATRO listas que tienen que cuadrar para que el ZIP sea
// honesto — `DATASETS` (qué se puede pedir), `NOMBRE_CSV` (cómo se llama cada fichero),
// `construirCsvsDelPaquete` (qué builder corre) y el bloque "QUÉ LLEVA CADA FICHERO" del
// LEEME (qué se le promete al asesor). Nada las ataba.
//
// Y NO ES HIPOTÉTICO: `gastos.csv` estuvo desde SCRUM-25 sin entrar en el paquete —el asesor
// abría el ZIP y veía INGRESOS SIN COSTES— y no lo detectó nadie hasta SCRUM-138. Un dataset
// se puede caer del paquete sin que salte nada: ya pasó una vez. Los dos fallos posibles son
// del peor tipo para este producto:
//   · el LEEME promete un CSV que el ZIP no lleva → paquete que MIENTE sobre su contenido,
//     justo lo que SCRUM-82 prohibió para el XML;
//   · el CSV va pero el LEEME no lo describe → el asesor no sabe qué criterio sigue
//     (el problema que arreglaron SCRUM-104 y SCRUM-106).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { DATASETS, NOMBRE_CSV, resolverSeleccion } = await import('../dist/modules/exports/domain/seleccionExport.js');
const { construirLeeme } = await import('../dist/modules/exports/domain/exportData.js');

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FUENTE_PAQUETE = fs.readFileSync(path.join(RAIZ, 'src/modules/exports/domain/exportData.ts'), 'utf8');

const LEEME_BASE = {
  nombre: 'Fontanería QA', generado: '2026-07-27T10:00:00.000Z',
  from: new Date('2026-01-01'), to: new Date('2026-12-31'),
  pdfsOk: 0, pdfsTotal: 0, xmlAnios: [], cabecera: [],
};

test('SCRUM-152 (guarda de presencia): el paquete COMPLETO describe los seis datasets', () => {
  // Va PRIMERO a propósito: si el LEEME dejara de nombrar ficheros (o devolviera ''), los
  // asserts de ausencia de los otros tests pasarían en vacío sin vigilar nada.
  const completo = construirLeeme({ ...LEEME_BASE, datasets: undefined });
  assert.ok(completo.length > 0, 'el LEEME no se construye');
  for (const d of DATASETS) {
    assert.ok(
      completo.includes(NOMBRE_CSV[d]),
      `el paquete completo NO describe ${NOMBRE_CSV[d]} — si acabas de añadir el dataset "${d}", ` +
        'te falta su línea en el bloque "QUÉ LLEVA CADA FICHERO" de construirLeeme.',
    );
  }
});

test('SCRUM-152: cada dataset tiene nombre de fichero, y no sobra ninguno', () => {
  for (const d of DATASETS) {
    assert.ok(NOMBRE_CSV[d], `el dataset "${d}" no tiene entrada en NOMBRE_CSV`);
    assert.ok(NOMBRE_CSV[d].endsWith('.csv'), `NOMBRE_CSV["${d}"] debería ser un .csv`);
  }
  // Y al revés: un nombre huérfano significa que alguien quitó el dataset y dejó el resto.
  for (const clave of Object.keys(NOMBRE_CSV)) {
    assert.ok(DATASETS.includes(clave), `NOMBRE_CSV tiene "${clave}", que ya no está en DATASETS`);
  }
});

test('SCRUM-152: el LEEME describe el dataset pedido y NINGÚN otro', () => {
  // El corazón del guard: se pide UN dataset cada vez y se comprueba que el LEEME dice
  // exactamente eso. Cubre los dos fallos a la vez — prometer de más y describir de menos.
  for (const d of DATASETS) {
    const leeme = construirLeeme({ ...LEEME_BASE, datasets: new Set([d]) });

    assert.ok(
      leeme.includes(NOMBRE_CSV[d]),
      `🔴 pedido SOLO "${d}", el LEEME no lo describe: el asesor recibe ${NOMBRE_CSV[d]} sin saber qué criterio sigue.`,
    );

    for (const otro of DATASETS) {
      if (otro === d) continue;
      assert.ok(
        !leeme.includes(NOMBRE_CSV[otro]),
        `🔴 pedido SOLO "${d}", el LEEME promete además ${NOMBRE_CSV[otro]} — un paquete que miente sobre su contenido.`,
      );
    }
  }
});

test('SCRUM-152: cada dataset está cableado en construirCsvsDelPaquete', () => {
  // Esta lista no se puede ejercitar sin BD (cada rama lanza una query), así que se
  // comprueba sobre la FUENTE. Es un guard de cableado, no de comportamiento: verifica que
  // nadie añade un dataset a DATASETS y se olvida de emitirlo en el ZIP.
  const cuerpo = FUENTE_PAQUETE.slice(FUENTE_PAQUETE.indexOf('export async function construirCsvsDelPaquete'));
  assert.ok(cuerpo.length > 0, 'no se encontró construirCsvsDelPaquete: ¿se renombró?');

  for (const d of DATASETS) {
    assert.ok(
      cuerpo.includes(`quiere('${d}')`),
      `🔴 el dataset "${d}" se puede PEDIR pero construirCsvsDelPaquete no lo consulta: ` +
        'el usuario lo marca, el ZIP sale sin él y el LEEME lo promete.',
    );
    assert.ok(
      cuerpo.includes(`'${NOMBRE_CSV[d]}'`),
      `🔴 construirCsvsDelPaquete no emite ${NOMBRE_CSV[d]} — el dataset "${d}" no llega al ZIP.`,
    );
  }
});

test('SCRUM-152: pedir todos los datasets equivale al paquete completo', () => {
  // Cierra el círculo con resolverSeleccion: marcar los seis a mano tiene que dar
  // exactamente lo mismo que no marcar ninguno, o la UI y el default divergirían.
  const todosAMano = resolverSeleccion(DATASETS.join(','), true);
  const sinMarcar = resolverSeleccion('', true);
  assert.deepEqual([...todosAMano.datasets].sort(), [...sinMarcar.datasets].sort());
});
