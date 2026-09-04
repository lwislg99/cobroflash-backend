// tests/scrum726-quien-firma-la-microcopy.test.mjs — SCRUM-726
//
// LA VÍCTIMA: la regla 30. Dice que la microcopy **la aprueba el fundador**, y hasta hoy no había
// nada que la hiciera cierta.
//
// `constaAprobado()` contestaba «aprobado» en cuanto el texto estuviera escrito en
// `docs/microcopy/`, **sin mirar la firma**. Comprobaba que ALGUIEN lo hubiera escrito, no que lo
// hubiera aprobado quien puede. Son dos afirmaciones distintas y daban el mismo verde.
//
// Lo destapó el asesor sobre su PROPIO error: metió el registro de SCRUM-605 con SU firma —y el
// fichero lo decía, escrupulosamente: «esto no es su firma»— y esta función lo leyó igualmente
// como aprobación del fundador. El defecto no estaba en el registro: estaba aquí.
//
// ── Y ES LA SEGUNDA VEZ QUE ESTA MISMA FUNCIÓN MIENTE, POR RAZONES OPUESTAS ─────────────────
//   · SCRUM-715 · mentía por CÓMO comparaba — subcadena en vez de identidad.
//   · SCRUM-726 · miente por QUÉ NO compara — no mira quién firma.
//
// 🔴 EL MATIZ QUE IMPIDE QUE EL ARREGLO SEA PEOR QUE EL DEFECTO: un texto sin firma del fundador
// **no se borra de la pantalla**. Se LISTA (`pendientesDeFirma`) para que él lo firme. Un guard
// que dejara media aplicación con corchetes de golpe costaría más que el hueco que cierra.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  aprobacionesDeMicrocopy, constaAprobado, literalesAprobados, pendientesDeFirma, firmanteDe,
} from './_microcopy-aprobada.mjs';

const TEXTO_DEL_FUNDADOR = 'Texto que sí firmó el fundador';
const TEXTO_DE_OTRO = 'Texto que firmó otra persona';

/** Un directorio de registros de mentira: dos aprobaciones, dos firmantes distintos. */
function registrosDePrueba() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum726-'));
  fs.writeFileSync(path.join(dir, '2026-09-04-SCRUM-111-del-fundador.md'),
    '# Uno\n\n**Aprobado por el fundador** el 4-sep-2026, en **SCRUM-111**.\n\n'
    + '| Qué es | Texto aprobado |\n|---|---|\n| Ranura | ' + TEXTO_DEL_FUNDADOR + ' |\n');
  fs.writeFileSync(path.join(dir, '2026-09-04-SCRUM-222-del-asesor.md'),
    '# Dos\n\n**Aprobado por el ASESOR** el 4-sep-2026, en **SCRUM-222**.\n'
    + '**A la espera de la firma del fundador** — esto no es su firma.\n\n'
    + '| Qué es | Texto aprobado |\n|---|---|\n| Ranura | ' + TEXTO_DE_OTRO + ' |\n');
  return dir;
}

const soloEsteDir = (dir) => ({ dir, congelado: false });

// ═══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL ROJO QUE IMPORTA
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-726 · 🔴 un registro firmado por OTRO no cuenta como aprobación', () => {
  const dir = registrosDePrueba();
  try {
    const o = soloEsteDir(dir);

    // SUELO: si el barrido no viera los dos registros, todo lo de abajo mediría el vacío.
    assert.equal(aprobacionesDeMicrocopy(o).length, 2,
      '🔴 CIEGO: no se están leyendo los dos registros de prueba.');

    assert.deepEqual(constaAprobado(TEXTO_DE_OTRO, o), [],
      `🔴 «${TEXTO_DE_OTRO}» sale como APROBADO y NO lo firmó el fundador. La regla 30 dice que la `
      + 'microcopy la aprueba él; esto la elude escribiendo el texto en el directorio.');

    // Y el del fundador SÍ, que es lo que impide que el arreglo sea «negarlo todo».
    assert.deepEqual(constaAprobado(TEXTO_DEL_FUNDADOR, o), ['docs/microcopy/2026-09-04-SCRUM-111-del-fundador.md'],
      '🔴 se ha caído la aprobación LEGÍTIMA: apretar el guard no puede tirar las buenas.');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('SCRUM-726 · 🔴 Y CAE CON EL MECANISMO VIEJO: hoy ese mismo fichero daba «aprobado»', () => {
  const dir = registrosDePrueba();
  try {
    const o = soloEsteDir(dir);
    // El mecanismo VIEJO, tal cual era: los literales de TODOS los registros, sin mirar la firma.
    const comoAntes = (aguja) => aprobacionesDeMicrocopy(o)
      .filter((a) => a.literales.includes(aguja))
      .map((a) => a.ruta);

    assert.equal(comoAntes(TEXTO_DE_OTRO).length, 1,
      '🔴 el caso NO discrimina: con el mecanismo viejo este texto TENÍA que salir aprobado. Si no '
      + 'sale, esta prueba pasaría con los dos mecanismos y no probaría ninguno.');
    assert.equal(constaAprobado(TEXTO_DE_OTRO, o).length, 0,
      '🔴 y con el nuevo tiene que salir NO aprobado. Ahí está la diferencia entera.');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// CONTROL POSITIVO — apretar no puede tirar ninguna aprobación legítima
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-726 · ✅ CONTROL POSITIVO: los registros REALES siguen contando, uno a uno', () => {
  const todas = aprobacionesDeMicrocopy();
  assert.ok(todas.length >= 6,
    `🔴 CIEGO: sólo ${todas.length} registros y había 7 (6 ficheros + el congelado).`);

  const sinFirma = todas.filter((a) => a.firmante !== 'fundador');
  assert.deepEqual(sinFirma.map((a) => `${a.ruta} → firmante: ${a.firmante}`), [],
    '🔴 HAY REGISTROS SIN FIRMA DEL FUNDADOR. No se borran sus textos: se listan aquí para que los '
    + 'firme, y hasta entonces sus literales NO cuentan como aprobados.');

  // Y una muestra de literales de VARIOS registros distintos, uno por uno.
  for (const t of [
    'No se ha podido abrir el parte',                  // SCRUM-402
    'Firma del cliente',                               // SCRUM-720c
    'Dirección de la obra',                            // SCRUM-720
    'Mano de obra',                                    // registro congelado
  ]) {
    assert.ok(constaAprobado(t).length > 0, `🔴 se ha caído una aprobación legítima: «${t}»`);
  }

  assert.ok(literalesAprobados().length >= 150,
    `🔴 sólo ${literalesAprobados().length} literales del fundador y había 195 medidos.`);
});

test('SCRUM-726 · ✅ CONTROL NEGATIVO: la identidad del 715 NO se relaja', () => {
  // Lo que se añade es QUIÉN firma; lo que NO se toca es CÓMO se compara.
  assert.deepEqual(constaAprobado('Precio por'), [],
    '🔒 un PREFIJO de un texto aprobado no es ese texto (SCRUM-715).');
  assert.deepEqual(constaAprobado('de obra'), [],
    '🔒 un TROZO de «Mano de obra» no es «Mano de obra».');
  assert.deepEqual(constaAprobado('Este texto no lo aprobó nadie jamás'), []);
  assert.throws(() => constaAprobado(''), /CIEGO/);
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// CÓMO SE LEE LA FIRMA
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-726 · 🔴 la firma se lee FUERA de las citas, que es donde vive la historia', () => {
  // El registro de SCRUM-605 conserva citada la frase «Aprobado por el ASESOR» que explica el
  // error. Si la firma se leyera del fichero entero, la explicación decidiría por la firma.
  const conHistoriaCitada = '# X\n\n**Aprobado por el fundador** el 4-sep.\n\n'
    + '> Antes decía «Aprobado por el ASESOR», y por eso se corrigió.\n';
  assert.equal(firmanteDe(conHistoriaCitada), 'fundador',
    '🔴 una cita que CUENTA el error ha cambiado quién firma.');

  const alReves = '# X\n\n**Aprobado por el ASESOR** el 4-sep.\n\n'
    + '> Cuando lo firme el fundador se corregirá esta línea.\n';
  assert.equal(firmanteDe(alReves), 'asesor',
    '🔴 una cita que MENCIONA al fundador ha bastado para dar por firmado lo que no lo está. Es el '
    + 'agujero exacto del ticket, del revés.');

  assert.equal(firmanteDe('# X\n\nsin ninguna línea de firma\n'), null,
    '🔴 un registro que no dice quién firma tiene que devolver `null`, no adivinar.');
});

test('SCRUM-726 · lo que queda pendiente de firma se puede LISTAR, no se borra', () => {
  const dir = registrosDePrueba();
  try {
    const pendientes = pendientesDeFirma(soloEsteDir(dir));
    assert.equal(pendientes.length, 1, '🔴 el listado de pendientes no ve el registro sin firmar');
    assert.equal(pendientes[0].firmante, 'asesor');
    assert.ok(pendientes[0].literales.includes(TEXTO_DE_OTRO),
      '🔴 el listado no trae el LITERAL, que es lo que el fundador necesita para firmarlo.');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
