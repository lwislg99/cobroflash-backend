// tests/scrum505-dato-personal-en-contenido.test.mjs — SCRUM-505
//
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// UN CORREO ESCONDIDO EN UN TEXTO LIBRE SOBREVIVE A UNA SUPRESIÓN Y NADIE LO VE.
//
// `CAMPOS_PERSONALES` (SCRUM-497) redacta COLUMNAS por su nombre. Un correo escrito dentro de
// `job.notes` no está en ninguna lista, así que la anonimización lo deja intacto.
//
// 🔒 **Un guard que mira la etiqueta no ve el contenido.** Tercera vez hoy con la misma forma:
// SCRUM-854 derivaba del nombre de la rama, SCRUM-857 no veía lo que viajaba dentro del PR, y
// éste deriva del nombre de la columna.
//
// ── ⛔ TODO FABRICADO ─────────────────────────────────────────────────────────────────────────
//
// Ni un dato real de nadie. Los correos usan `.example` (TLD reservado por la RFC 2606 para
// documentación) y el móvil es una secuencia ascendente trivial — una FORMA, no la línea de nadie.
//
// ── LOS CONTROLES ─────────────────────────────────────────────────────────────────────────────
//
//   ① SUELO ................ hay campos de texto libre que mirar. Si no, CIEGO.
//   ② 🔴 EL QUE DECIDE ..... un correo escondido en `job.notes` cae, nombrando tabla, fila y campo.
//   ③ 🔴 MUTACIÓN .......... apagada la mirada al contenido, vuelve a ser invisible.
//   ④ ✅ POSITIVO .......... los que el ticket nombra siguen sin cubrir: el censo no los pierde.
//   ⑤ ✅ NEGATIVO .......... texto legítimo de obra NO cae — con su tasa medida.
//   ⑥ el informe NO copia el dato que encuentra.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import {
  formasEnTexto, tieneDatoPersonal, buscarEnFilas, FORMAS, LIMITES,
} from './_dato-personal-en-contenido.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const { CAMPOS_PERSONALES } = await import('../dist/modules/system/domain/anonimizarMerchant.js');

/** Correo fabricado: `.example` está reservado por la RFC 2606 y no resuelve a nada. */
const CORREO_FABRICADO = 'ana@obra.example';
/** Una secuencia ascendente, que es una forma de móvil y no el número de nadie. */
const FORMA_DE_MOVIL = '612345678';

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ① SUELO
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-505 · ① SUELO: hay campos de texto libre y el detector tiene formas que buscar', () => {
  assert.ok(Object.keys(FORMAS).length >= 3,
    '🔴 CIEGO: el detector no tiene formas que buscar, así que su cero no significa nada');
  assert.ok(LIMITES.length >= 3,
    '🔴 un detector que no declara lo que se le escapa se lee como si no se le escapara nada');

  // Y el guard de columnas existe y cubre algo: si no, este test compararía contra el vacío.
  const cubiertos = Object.values(CAMPOS_PERSONALES).flat();
  assert.ok(cubiertos.length > 5,
    `🔴 CAMPOS_PERSONALES sólo cubre ${cubiertos.length} campos: o cambió de forma, o no se está leyendo`);
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ② EL QUE DECIDE
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-505 · 🔴 ② un correo escondido en `job.notes` CAE, y dice dónde', () => {
  // El caso del ticket: texto libre donde un cliente escribió un correo.
  const FILAS = [
    { id: 1, titulo: 'Reforma de baño', notes: 'Acceso por el patio. Llave en portería.' },
    { id: 2, titulo: 'Bajante', notes: `El cliente pide que le escriban a ${CORREO_FABRICADO} antes de ir.` },
    { id: 3, titulo: 'Caldera', notes: 'Revisión anual. Presión 3,5 bar.' },
  ];

  // `job` no tiene NINGÚN campo en CAMPOS_PERSONALES: es exactamente el hueco del ticket.
  const cubiertosDeJob = CAMPOS_PERSONALES.job ?? [];
  assert.deepEqual([...cubiertosDeJob], [],
    '🔴 `job` ha pasado a estar cubierto por columnas: este control ya no mide el hueco que decía medir');

  const hallazgos = buscarEnFilas('job', FILAS, cubiertosDeJob);

  assert.equal(hallazgos.length, 1,
    `🔴 EL DEFECTO DE SCRUM-505 SIGUE: el correo escondido en un texto libre no se ve. `
    + `Hallazgos: ${JSON.stringify(hallazgos)}`);

  const h = hallazgos[0];
  assert.equal(h.modelo, 'job', '🔴 no dice la TABLA');
  assert.equal(h.id, 2, '🔴 no dice la FILA');
  assert.equal(h.campo, 'notes', '🔴 no dice el CAMPO');
  assert.ok(h.formas.includes('correo'), `🔴 no dice QUÉ encontró: ${h.formas.join(', ')}`);
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ③ MUTACIÓN — apagar la mirada al contenido
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-505 · 🔴 ③ MUTACIÓN: mirando sólo el NOMBRE de la columna, el correo es invisible', () => {
  const FILAS = [
    { id: 2, titulo: 'Bajante', notes: `Escribir a ${CORREO_FABRICADO} antes de ir.` },
  ];

  // Así es como decide el guard de hoy: por nombre de columna, sin abrir el valor.
  const porNombreDeColumna = (modelo, filas) => {
    const cubiertos = new Set(CAMPOS_PERSONALES[modelo] ?? []);
    return filas.flatMap((f) => Object.keys(f).filter((c) => cubiertos.has(c)).map((c) => ({ modelo, id: f.id, campo: c })));
  };

  const conNombre = porNombreDeColumna('job', FILAS);
  const conContenido = buscarEnFilas('job', FILAS, CAMPOS_PERSONALES.job ?? []);

  assert.equal(conNombre.length, 0,
    '🔴 la mutación no reproduce el estado de partida: mirando sólo nombres, `job.notes` NO debería '
    + 'salir. Si sale, el control ② está verde por otra razón.');
  assert.equal(conContenido.length, 1,
    '🔴 mirando el contenido tiene que caer. Si no cae, la vía nueva no es lo que decide.');
  assert.notEqual(conNombre.length, conContenido.length,
    '🔴 mirar el nombre y mirar el contenido dan lo mismo: entonces no se ha añadido nada');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ④ POSITIVO — los que el ticket nombra siguen sin cubrir
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-505 · ✅ ④ los campos que el ticket nombra siguen SIN cubrir por el guard de columnas', () => {
  // Del inventario del ticket (los de texto libre y los que son dato personal en sí).
  // Si alguno pasara a estar cubierto, sería una buena noticia — pero hay que enterarse.
  const DEL_TICKET = [
    ['job', 'notes'], ['job', 'direccion'],
    ['quote', 'internalNotes'], ['expense', 'notes'],
    ['teamMember', 'name'], ['teamMember', 'email'],
    ['merchant', 'iban'], ['merchant', 'bizumPhone'],
    ['botSession', 'phone'],
  ];

  const cubiertos = [];
  for (const [modelo, campo] of DEL_TICKET) {
    if ((CAMPOS_PERSONALES[modelo] ?? []).includes(campo)) cubiertos.push(`${modelo}.${campo}`);
  }

  assert.deepEqual(cubiertos, [],
    '📋 Alguno de los campos que SCRUM-505 declara «sin decidir» ya está cubierto por '
    + `CAMPOS_PERSONALES: ${cubiertos.join(', ')}. No es un fallo — es que el inventario del `
    + 'ticket se quedó atrás y hay que re-medirlo antes de seguir usándolo.');

  // Y el suelo de este control: la lista no puede estar vacía por un cambio de forma del módulo.
  assert.ok(DEL_TICKET.length >= 9, '🔴 la lista del ticket se ha quedado corta');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ⑤ NEGATIVO — un guard demasiado amplio acaba relajado
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-505 · ✅ ⑤ texto legítimo de obra NO cae, y la tasa está medida', () => {
  const LEGITIMOS = [
    'Cambiar bajante de PVC 110 en patio interior. Acceso por el portal.',
    'Factura 2026-CF-000123 pendiente de cobro por transferencia.',
    'Importe 1.234,56 EUR con IVA 21% incluido. Base 1020,30.',
    'NIF del cliente B12345678 comprobado en el registro.',
    'Obra en calle del Pez 14, 3 izquierda. Codigo postal 28004.',
    'Se han instalado 9 radiadores de 800 x 600 mm.',
    'Albaran ALB-2026-0042 firmado por el encargado de obra.',
    'Cita el 7 de abril a las 10:30. Duracion estimada 2 horas.',
    'Presion de red 3,5 bar medida en el grifo de la cocina.',
    'Garantia de 24 meses desde la fecha de este parte.',
  ];

  const disparan = LEGITIMOS.filter((t) => tieneDatoPersonal(t));
  assert.deepEqual(disparan, [],
    `🔴 EL GUARD ES DEMASIADO AMPLIO: dispara sobre texto de obra normal (${disparan.length} de `
    + `${LEGITIMOS.length}). Un guard que grita sobre trabajo legítimo lo van a relajar, y entonces `
    + 'no protege de nada.');

  // 🔴 EL FALSO POSITIVO CONOCIDO, fijado aquí para que no se descubra como sorpresa.
  // Un número de pedido de 9 dígitos que empieza por 9 es INDISTINGUIBLE de un móvil español.
  // No es arreglable con una expresión mejor: las dos cosas tienen exactamente la misma forma.
  assert.ok(tieneDatoPersonal('Pedido 987654321 del proveedor, entrega en 48 horas.'),
    '📋 el falso positivo conocido ha dejado de darse. Si es por una mejora, re-mide la tasa; '
    + 'si es porque el detector dejó de ver teléfonos, es un agujero.');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ⑥ El informe no puede convertirse en el problema
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-505 · ⑥ el hallazgo dice DÓNDE y QUÉ forma, nunca el dato', () => {
  const FILAS = [{ id: 7, notes: `Escribir a ${CORREO_FABRICADO} y llamar al ${FORMA_DE_MOVIL}.` }];
  const [h] = buscarEnFilas('job', FILAS, []);

  assert.ok(h, '🔴 no encontró nada donde hay dos datos');
  const serializado = JSON.stringify(h);
  assert.ok(!serializado.includes(CORREO_FABRICADO),
    '🔴 EL HALLAZGO LLEVA EL CORREO DENTRO. Un guard que copia a sus registros el dato que acaba '
    + 'de encontrar es el problema que venía a resolver.');
  assert.ok(!serializado.includes(FORMA_DE_MOVIL), '🔴 el hallazgo lleva el teléfono dentro');
  assert.deepEqual(h.formas.sort(), ['correo', 'telefono'], '🔴 no nombra las dos formas encontradas');
});
