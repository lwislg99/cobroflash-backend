// tests/scrum1546c-la-firma-del-fundador-sin-comprobar.test.mjs — SCRUM-1546c
//
// UNA FIRMA «DEL FUNDADOR» QUE EL ORÁCULO NO PUEDE COMPROBAR YA NO SALE `aprobada` A SECAS.
//
// ── EL HUECO (caso M5, medido el 14-oct-2026, `docs/master/evidencias/SCRUM-1546/`) ─────────
// Una ficha con «**Aprobado por el fundador** … en **SCRUM-999999**» —un ticket que Jira da 404—
// salía `aprobada`, con `noComprobado` vacío; la misma ficha sin esa línea, `no-aprobada`. De la
// firma del fundador el oráculo lee sólo su FORMA, y la de las 31 fichas reales es la misma que la
// de la inventada.
//
// ── LO QUE SE HACE (decisión del orquestador de Luis, SCRUM-1546, 14-oct-2026) ───────────────
// La firma del fundador entra en el MISMO tercer estado que la delegada, que pasa a llamarse
// `aprobada-sin-comprobar`, y declara lo que no se ha mirado (`NO_COMPROBADO_EN_UNA_FIRMA_DEL_FUNDADOR`).
// SIGUE CONTANDO: `aprobada`, `constaAprobado` y `literalesAprobados` no cambian para ninguna ficha
// (test 2 de scrum997d, sobre el árbol real). Cómo se hace verificable de verdad una firma del
// fundador NO lo decide este test: es del fundador.
//
// ── CADA LÍNEA DE LA DECLARACIÓN, ATADA A LO QUE EL CÓDIGO HACE (tests 2 y 3) ─────────────────
// Si alguien enseña al oráculo a mirar una, su test cae: se quita la línea y el test en el mismo
// cambio. Todo lo que se escribe va a `os.tmpdir()` por `temporal` (SCRUM-824 / 864c).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { temporal } from './_temporal.mjs';

import {
  aprobacionesDeMicrocopy, constaAprobado, comoConstaAprobado,
  ESTADO_SIN_COMPROBAR, ESTADO_NO_APROBADA, NO_COMPROBADO_EN_UNA_FIRMA_DEL_FUNDADOR,
} from './_microcopy-aprobada.mjs';

const LIT = 'Texto de prueba que dice estar firmado por el fundador';
const NOMBRE = '2026-10-14-SCRUM-999999-cobaya.md';
const RUTA = 'docs/microcopy/' + NOMBRE;
const cuerpo = (firma) => ['# Cobaya', '', ...(firma ? [firma] : []), '', '## Texto aprobado, literal', '', '> ' + LIT, ''].join('\n');

/** Una carpeta de fichas en `os.tmpdir()` con UNA cobaya, y el barrido sobre ella. */
const barrer = (firma) => {
  const dir = path.join(temporal('scrum1546c-'), 'microcopy');
  fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir, NOMBRE), cuerpo(firma));
  const o = { dir, congelado: false };
  const [ficha] = aprobacionesDeMicrocopy(o);
  assert.equal(ficha?.nombre, NOMBRE, '🔴 CIEGO: la cobaya no llegó al oráculo.');
  return { ficha, o };
};

const SI_ESTO_CAE = 'Si le has enseñado al oráculo a mirarlo, enhorabuena: quita esa línea de '
  + '`NO_COMPROBADO_EN_UNA_FIRMA_DEL_FUNDADOR` y este test en el mismo cambio. Si no, has roto otra cosa.';

test('SCRUM-1546c · 1) M5: la firma del fundador INVENTADA cuenta, pero sale sin comprobar y lo dice', () => {
  const { ficha, o } = barrer('**Aprobado por el fundador** el 14-oct-2026, en **SCRUM-999999**.');
  assert.equal(ficha.firmante, 'fundador');
  assert.equal(ficha.aprobada, true, 'el criterio no cambia: la firma del fundador sigue contando');
  assert.equal(ficha.estado, ESTADO_SIN_COMPROBAR,
    '🔴 una firma del fundador que el oráculo no puede comprobar vuelve a salir aprobada A SECAS (caso M5).');
  assert.deepEqual(ficha.noComprobado, [...NO_COMPROBADO_EN_UNA_FIRMA_DEL_FUNDADOR]);
  assert.deepEqual(constaAprobado(LIT, o), [RUTA]);
  assert.deepEqual(comoConstaAprobado(LIT, o), [{ ruta: RUTA, estado: ESTADO_SIN_COMPROBAR, noComprobado: [...NO_COMPROBADO_EN_UNA_FIRMA_DEL_FUNDADOR] }]);

  // CONTROL: la misma ficha sin la línea de firma no cuenta. La sonda distingue.
  const sin = barrer(null);
  assert.equal(sin.ficha.estado, ESTADO_NO_APROBADA, '🔴 sin firma también cuenta: este test no mide la firma.');
  assert.deepEqual(constaAprobado(LIT, sin.o), []);
});

test('SCRUM-1546c · 2) declarado «no sé si el ticket citado existe»: un ticket imposible, o ninguno, cuentan igual', () => {
  assert.ok(NO_COMPROBADO_EN_UNA_FIRMA_DEL_FUNDADOR.some((l) => /ticket citado exista/.test(l)), 'la declaración ya no lo dice: este test sobra, quítalo');
  for (const firma of [
    '**Aprobado por el fundador** el 14-oct-2026, en **SCRUM-99999999**.',
    'Aprobado por el fundador.',
  ]) {
    const { ficha } = barrer(firma);
    assert.equal(ficha.estado, ESTADO_SIN_COMPROBAR, `🔴 «${firma}» ya no cuenta como antes. ` + SI_ESTO_CAE);
  }
});

test('SCRUM-1546c · 3) declarado «no sé quién escribió la línea»: una ficha FUERA de git, sin autor ninguno, cuenta igual', () => {
  assert.ok(NO_COMPROBADO_EN_UNA_FIRMA_DEL_FUNDADOR.some((l) => /quién escribió la línea/.test(l)), 'la declaración ya no lo dice: este test sobra, quítalo');
  // `os.tmpdir()` no es un repositorio: de esta ficha no hay commit, ni autor, ni historia.
  const { ficha, o } = barrer('**Aprobado por el fundador** el 14-oct-2026, en **SCRUM-999999**.');
  let raiz = o.dir;
  for (let i = 0; i < 40 && raiz !== path.dirname(raiz); i++, raiz = path.dirname(raiz)) {
    assert.ok(!fs.existsSync(path.join(raiz, '.git')), `🔴 CIEGO: la cobaya cayó dentro de un repositorio (${raiz}); este test no prueba nada.`);
  }
  assert.equal(ficha.estado, ESTADO_SIN_COMPROBAR, '🔴 una ficha sin autor ya no cuenta como antes. ' + SI_ESTO_CAE);
});
