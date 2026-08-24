// tests/scrum600-un-solo-front-documento.test.mjs — SCRUM-600 (DOC-10)
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 EL HALLAZGO QUE JUSTIFICA ESTE FICHERO, Y ESTA MEDIDO
//
// El encargo de SCRUM-600 declara OCHO funciones innegociables (F7–F14: lo que YaQu ya hace
// mejor que Holded) y ordena que la unificacion de los dos fronts del documento no pierda
// ninguna. Antes de escribir una linea se midio si alguna estaba SUJETA por algo.
//
//   MEDIDO el 24-ago-2026 sobre `main` (9b49190a), rompiendo CADA UNA a proposito y corriendo
//   la tanda COMPLETA (3.934 tests) despues de cada rotura:
//
//     F7  vista previa en vivo ................ fail=0 · NADIE LO CAZA
//     F8  la marca de suplido viaja en la linea  fail=0 · NADIE LO CAZA
//     F9  margen/coste por linea .............. fail=0 · NADIE LO CAZA
//     F10 la comision, en el formulario ....... fail=0 · NADIE LO CAZA
//     F11 IA + plantillas en primer plano ..... fail=0 · NADIE LO CAZA
//     F12 el selector dice que falta .......... fail=0 · NADIE LO CAZA
//     F13 el albaran enlaza a su trabajo ...... fail=1, pero el que cae es el guard de fines de
//         linea de SCRUM-533 — salta porque ese fichero lleva CRLF en disco y no dice NADA de
//         la funcion. O sea: NADIE LA CAZA.
//     F14 la firma sale en el PDF ............. igual que F13. NADIE LA CAZA.
//
//   Y el banco SABIA dar rojo: como CONTROL POSITIVO se cambio el texto aprobado de la accion
//   primaria del modal de factura y cayo `SCRUM-289b · MICROCOPY`, nombrandolo. Sin ese control,
//   ocho «fail=0» seguidos no distinguen «nadie lo vigila» de «no supe mirar» (SCRUM-311).
//
// Ocho funciones que son LA VENTAJA DEL PRODUCTO y que se pueden borrar sin que nadie se entere.
// Por eso este fichero existe ANTES que la unificacion: mover un front sin red es como se
// pierde una en silencio, y la unificacion es justo la operacion que mueve el front.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUE AST Y NO `grep`
//
// Un `includes('appendChild(previewBox)')` sobre la fuente da VERDE con esa linea COMENTADA.
// Es el falso verde de SCRUM-515 —un aviso pintado y borrado cuatro lineas despues, con el test
// en verde porque el texto seguia en el fichero—. Aqui el arbitro es el arbol: un comentario no
// es un nodo de llamada, asi que queda fuera POR CONSTRUCCION y no por una lista de excepciones.
//
// CADA detector lleva su CONTROL NEGATIVO dentro: se le quita el ancla a una copia EN MEMORIA
// (nunca al fichero) y se exige que cambie de respuesta. Un detector que no sabe decir «no» no
// vigila nada, y esa es la mitad que casi nunca se prueba.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { censarControles, censarCapacidades, CAPACIDADES, LOS_OCHO } from './_censo-dos-fronts.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');

const FRONT_PRESUPUESTO = 'public/dashboard/js/quotesView.js';
const FRONT_FACTURA = 'public/dashboard/js/nuevaFacturaModal.js';

const arbol = (fuente, ruta) => ts.createSourceFile(ruta, fuente, ts.ScriptTarget.Latest, true);

// ─────────────────────────────────────────────────────────────────────────────────────────
// SUELO · el escaner tiene que VER las dos pantallas. Un cero de un instrumento ciego se lee
// igual que una pantalla vacia, y aqui todo el censo se apoya en eso.
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-600 · SUELO: el escaner ve LOS DOS fronts (si no, se declara ciego)', () => {
  const a = censarControles(leer(FRONT_PRESUPUESTO), 'quotesView.js');
  const b = censarControles(leer(FRONT_FACTURA), 'nuevaFacturaModal.js');
  assert.ok(a.controles.length >= 20,
    `🔴 ESCANER CIEGO sobre el presupuesto: solo veo ${a.controles.length} controles`);
  assert.ok(b.controles.length >= 5,
    `🔴 ESCANER CIEGO sobre la factura: solo veo ${b.controles.length} controles`);
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// PASO 0 · EL CENSO. La pregunta del ticket: que tiene HOY cada uno de los dos fronts.
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-600 · PASO 0: los dos fronts del documento son DISTINTOS, y el censo lo deriva', () => {
  const censo = censarCapacidades([
    { nombre: 'quotesView.js', fuente: leer(FRONT_PRESUPUESTO) },
    { nombre: 'nuevaFacturaModal.js', fuente: leer(FRONT_FACTURA) },
  ]);
  assert.equal(censo.length, CAPACIDADES.length, 'el censo tiene que cubrir el inventario entero');

  const enFactura = censo.filter((c) => c.porFront['nuevaFacturaModal.js']).map((c) => c.id);
  const enPresupuesto = censo.filter((c) => c.porFront['quotesView.js']).map((c) => c.id);

  // El presupuesto las tiene TODAS. Si dejara de tenerlas, el censo estaria midiendo otra cosa.
  const perdidas = CAPACIDADES.map((c) => c.id).filter((id) => !enPresupuesto.includes(id));
  assert.deepEqual(perdidas, [],
    `🔴 el presupuesto ha PERDIDO estas capacidades: ${perdidas.join(', ')}. `
    + 'O se han borrado, o el detector dejo de verlas: las dos cosas hay que mirarlas antes de seguir.');

  // 🔴 EL SUELO QUE EXIGE EL ENCARGO, AL REVES DE COMO SUELE ESCRIBIRSE: si algun dia la
  // factura las tuviera TODAS, este ticket estaria ya hecho y quien lo lea tiene que enterarse
  // por el test y no por una captura. Mientras no lo esten, la diferencia es el hecho.
  assert.notDeepEqual(enFactura, CAPACIDADES.map((c) => c.id),
    'los dos fronts ya comparten TODO: SCRUM-600 estaria hecho — revisa el instrumento antes de creerlo');
  assert.deepEqual(enFactura, [],
    `la factura tenia CERO capacidades del censo cuando se midio; ahora tiene: ${enFactura.join(', ')}`);
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// LA RED · los OCHO. Uno por uno, con nombre, y con su control negativo.
// ─────────────────────────────────────────────────────────────────────────────────────────
for (const f of LOS_OCHO) {
  test(`SCRUM-600 · 🔴 ${f.id} NO SE PIERDE: ${f.que}`, () => {
    const fuente = leer(f.fichero);

    // CONTROL POSITIVO — hoy esta.
    assert.ok(f.detecta(arbol(fuente, f.fichero)),
      `🔴 SE HA PERDIDO ${f.id} (${f.que}) en ${f.fichero}. `
      + `El encargo de SCRUM-600 lo declara innegociable: si se ha quitado a proposito, es cambio `
      + `de master ANTES de codificar, no un borrado de paso.`);

    // El ancla tiene que ser UNICA, o el control negativo estaria quitando otra cosa.
    const veces = fuente.split(f.ancla).length - 1;
    assert.equal(veces, 1,
      `🔴 el ancla de ${f.id} aparece ${veces} veces en ${f.fichero}: el control negativo no seria fiable`);

    // CONTROL NEGATIVO — sobre una copia EN MEMORIA. El detector tiene que saber decir «no».
    const mutilada = fuente.replace(f.ancla, '');
    assert.equal(f.detecta(arbol(mutilada, f.fichero)), false,
      `🔴 DETECTOR TAUTOLOGICO en ${f.id}: sigue diciendo que si con el ancla quitada, `
      + `asi que no vigila nada y su verde no vale.`);
  });
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// R-CONTAR · el numero de vigilados no baja sin que se vea. Quitar una entrada de `LOS_OCHO`
// apagaria su test SIN QUE FALLE NADA: un guard que se puede desactivar borrando su fila no es
// un guard. Misma forma que el trinquete de SCRUM-402.
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-600 · 🔴 la red cubre los OCHO — quitar uno de la lista tiene que doler', () => {
  assert.deepEqual(LOS_OCHO.map((f) => f.id),
    ['F7', 'F8', 'F9', 'F10', 'F11', 'F12', 'F13', 'F14'],
    '🔴 la red de SCRUM-600 son OCHO y estan enumeradas en el encargo. Ni una menos.');
  for (const f of LOS_OCHO) {
    assert.ok(fs.existsSync(path.join(RAIZ, f.fichero)),
      `🔴 ${f.id} apunta a ${f.fichero}, que no existe: la red vigilaria el vacio`);
  }
});
