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
import { extraerRanurasVisibles, ranurasDelDocumento, RANURAS_NO_DERIVABLES } from './_ranuras-documento.mjs';

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
    // SCRUM-598: F9 sale de la lista. La capacidad no se pierde — se mudó al catálogo con
    // CAT-01 —, lo que se retira es el margen del DOCUMENTO. Decisión del fundador 24-ago-2026.
    ['F7', 'F8', 'F10', 'F11', 'F12', 'F13', 'F14'],
    '🔴 la red de SCRUM-600 son OCHO y estan enumeradas en el encargo. Ni una menos.');
  for (const f of LOS_OCHO) {
    assert.ok(fs.existsSync(path.join(RAIZ, f.fichero)),
      `🔴 ${f.id} apunta a ${f.fichero}, que no existe: la red vigilaria el vacio`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// LAS RANURAS DE TEXTO · lo que el fundador tiene que decidir para que esto se pueda codificar.
//
// La lista se FIJA aqui —texto a texto, comparado con `===`— y no en un informe, porque un
// informe no vuelve a leerse: en cuanto alguien toque un rotulo del presupuesto, la lista que
// el fundador esta mirando deja de ser cierta SIN QUE NADIE SE ENTERE. Fijada, cae.
//
// 🔴 NO se fija la LINEA. Se fija la VIA y el TEXTO. Una linea cambia porque alguien anadio un
// comentario doce lineas mas arriba, y un guard que cae por eso lo apaga el siguiente que pase.
// Las lineas van en la entrada del master, fechadas contra su sha.
// ─────────────────────────────────────────────────────────────────────────────────────────
const RANURAS_A = [
  ["textContent", "Crear presupuesto"],
  ["textContent", "Genera un presupuesto con varias líneas, calcula los totales y envía el link de pago por WhatsApp."],
  ["cabeceraModal(titulo)", "Presupuesto #${displayNum} generado"],
  ["textContent", "Revisa el PDF del presupuesto antes de enviarlo por WhatsApp al cliente."],
  ["title", "PDF Presupuesto #${displayNum}"],
  ["setAlert", "Presupuesto enviado por email."],
  ["setAlert", "Presupuesto enviado por WhatsApp."],
  ["textContent", "Solo presupuesto (facturación manual)"],
  ["textContent", "Pasada esta fecha el presupuesto caduca solo y el cliente verá \"pide uno actualizado\"."],
  ["textContent", "Añade los conceptos que vas a presupuestar."],
  ["title", "Describe el trabajo y Claude sugiere las líneas del presupuesto"],
  ["textContent", "Generar presupuesto"],
  ["textContent", "Estado del presupuesto"],
  ["innerHTML [const STATUS_EMPTY_HTML]", "<div class=\"quote-status-empty\">📄 Genera el presupuesto y aquí verás su número, el estado y si se ha enviado.</div>"],
  ["innerHTML [const STATUS_EMPTY_HTML]", "<div class=\"quote-status-empty\">📄 Genera el presupuesto y aquí verás su número, el estado y si se ha enviado.</div>"],
  ["innerHTML", "<strong>Presupuesto #${displayNum}</strong>"],
  ["innerHTML", "KPI-TOTAL"],
  ["innerHTML", "PIE-TOTAL"],
  ["textContent", "Presupuesto válido durante 30 días salvo indicación en contrario."],
  ["title", "Añadir una línea con \"${item.concepto}\" (en ${item.usos} presupuestos)"],
  ["textContent", "en ${item.usos} presupuestos"],
  ["innerHTML", "MODAL-USAR-PLANTILLA"],
  ["innerHTML", "MODAL-GUARDAR-PLANTILLA"],
  ["setAlert", "Plantilla \"${template.name}\" cargada — completa los datos del cliente y genera el presupuesto."],
  ["new Error", "Respuesta inesperada al crear presupuesto."],
  ["textContent", "Generar presupuesto"],
];

// Las cuatro ranuras que son BLOQUES de HTML con la frase dentro. Se fijan por la frase, no por
// el bloque entero: el bloque lleva ademas estilos y marcado, que cambian sin que cambie el
// texto — y entonces el guard caeria por algo que no es lo que vigila.
const FRASES_EN_BLOQUE = {
  'KPI-TOTAL': 'Total presupuesto',
  'PIE-TOTAL': 'Total presupuesto',
  'MODAL-USAR-PLANTILLA': 'Elige una plantilla para cargar sus líneas en el presupuesto actual.',
  'MODAL-GUARDAR-PLANTILLA': 'Dale un nombre a esta plantilla para reutilizarla en futuros presupuestos.',
};

test('SCRUM-600 · SUELO: el extractor de ranuras VE las dos pantallas enteras', () => {
  const q = extraerRanurasVisibles(leer(FRONT_PRESUPUESTO), 'quotesView.js');
  const f = extraerRanurasVisibles(leer(FRONT_FACTURA), 'nuevaFacturaModal.js');
  assert.ok(q.length >= 100, `🔴 EXTRACTOR CIEGO sobre el presupuesto: ${q.length} ranuras visibles`);
  assert.ok(f.length >= 15, `🔴 EXTRACTOR CIEGO sobre la factura: ${f.length} ranuras visibles`);
});

test('SCRUM-600 · 🔴 LAS RANURAS QUE ESPERAN AL FUNDADOR: 26 posiciones, 24 textos', () => {
  const ranuras = ranurasDelDocumento(leer(FRONT_PRESUPUESTO), 'quotesView.js');

  assert.equal(ranuras.length, RANURAS_A.length,
    `🔴 el numero de ranuras ha cambiado: eran ${RANURAS_A.length} y ahora son ${ranuras.length}. `
    + 'La lista que el fundador esta mirando ha dejado de ser cierta — hay que volver a mandarsela.');

  ranuras.forEach((r, i) => {
    const [via, esperado] = RANURAS_A[i];
    assert.equal(r.via, via, `ranura ${i + 1}: la via cambio de ${via} a ${r.via}`);
    const clave = FRASES_EN_BLOQUE[esperado];
    if (clave === undefined) {
      // Texto EXACTO, con `===`. Nada de `includes`.
      assert.equal(r.texto, esperado,
        `🔴 la ranura ${i + 1} (${via}) cambio de texto.\n  antes: ${JSON.stringify(esperado)}\n  ahora: ${JSON.stringify(r.texto)}`);
    } else {
      // Bloque de HTML: se exige que la FRASE siga dentro, byte a byte.
      const dentro = r.texto.split(clave).length - 1;
      assert.equal(dentro, 1,
        `🔴 la frase del bloque ${esperado} ya no esta (o esta ${dentro} veces): ${JSON.stringify(clave)}`);
    }
  });

  const distintos = new Set(ranuras.map((r) => r.texto));
  assert.equal(distintos.size, 24,
    `🔴 textos distintos: ${distintos.size}. Eran 24: 26 posiciones menos las dos parejas que `
    + 'comparten texto («Generar presupuesto» en el boton y al restaurarlo; el vacio del panel de '
    + 'estado, que sale dos veces de la MISMA constante).');
});

test('SCRUM-600 · 🔴 GRUPO B: la ranura que el criterio derivado NO puede ver sigue donde se dijo', () => {
  assert.ok(RANURAS_NO_DERIVABLES.length >= 1,
    '🔴 el grupo B se ha vaciado: o se resolvio y hay que decirlo, o alguien lo borro');
  for (const r of RANURAS_NO_DERIVABLES) {
    const disco = fs.readFileSync(path.join(RAIZ, r.fichero));       // BYTES, no texto
    const veces = disco.toString('utf8').split(r.ancla).length - 1;
    assert.equal(veces, 1,
      `🔴 ${r.id}: su ancla aparece ${veces} veces en ${r.fichero}. La lista a mano se ha desincronizado `
      + 'del codigo, que es lo peor que le puede pasar a una lista a mano.');
    // Y el criterio derivado NO la ve: si algun dia la viera, sobra del grupo B.
    assert.equal(r.texto.toLowerCase().includes('presupuest'), false,
      `🔴 ${r.id} SI nombra el documento, asi que el criterio derivado ya la encuentra: `
      + 'sacala del grupo B o se contara dos veces.');
  }
});
