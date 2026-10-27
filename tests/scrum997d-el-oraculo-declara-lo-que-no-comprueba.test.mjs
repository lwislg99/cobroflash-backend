// tests/scrum997d-el-oraculo-declara-lo-que-no-comprueba.test.mjs — SCRUM-997d
//
// EL ORÁCULO DE MICROCOPY DICE TRES COSAS, NO DOS.
//
// ── EL HUECO ────────────────────────────────────────────────────────────────────────────────
// `tests/_microcopy-aprobada.mjs` contestaba «aprobada» o «no aprobada». Una firma delegada caía
// en el mismo «aprobada» que la del fundador, y de la delegada el oráculo sólo lee la forma de la
// firma y UNA línea de `docs/equipo/limites-del-fundador.md`: la viñeta de Luis. No sabe qué
// orquestador firma, ni si el texto es legal o fiscal (lo que la delegación de Javier del 22-sep
// excluye), ni si el comentario de Jira citado existe. Medido el 13-oct-2026: sin ninguna línea de
// Javier seguían aprobadas todas las fichas.
//
// ── LO QUE SE HACE, Y LO QUE NO ─────────────────────────────────────────────────────────────
// NO se cambia el criterio: lo que contaba sigue contando (test 2, ficha a ficha sobre el árbol
// real). Se añade un tercer estado, `aprobada-por-delegacion-sin-comprobar`, y con él la lista de
// lo que no se ha mirado. A quién alcanza cada delegación lo deciden los dos jefes.
//
// ── LA DECLARACIÓN VA ATADA AL CÓDIGO (tests 6, 7 y 8) ──────────────────────────────────────
// Cada línea de `NO_COMPROBADO_EN_UNA_DELEGADA` tiene aquí un test que demuestra que, en efecto,
// el oráculo no la mira. Si alguien le enseña a mirarla, ese test cae: se quita la línea de la
// lista y el test, en el mismo cambio. Una declaración de ceguera que sobrevive a la cura miente
// igual que un verde hueco.
//
// ── SCRUM-1546c · CONDUCTA CAMBIADA A PROPÓSITO ─────────────────────────────────────────────
// El tercer estado pasa a llamarse `aprobada-sin-comprobar` y lo comparte la firma del fundador,
// de la que el oráculo tampoco lee más que la forma (caso M5, SCRUM-1546). Decisión del orquestador
// de Luis, 14-oct-2026. Cambian los tests 1, 3, 4 y 5 (decían «la del fundador sale `aprobada` a
// secas») y el 6 (contaba las delegadas por el estado, que ya no basta). Ninguno afloja: cada
// aserción de antes sigue, sobre la población que le toca, y se añade la del fundador.
// Lo que no se comprueba de la firma del fundador lo atan sus propios tests, en
// `tests/scrum1546c-la-firma-del-fundador-sin-comprobar.test.mjs`.
//
// Todo lo que se escribe va a `os.tmpdir()` y se escribe AQUÍ, sobre `e.raiz` / `e.dir`, como pide
// el censo de SCRUM-824; los ayudantes sólo devuelven texto.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { temporal } from './_temporal.mjs';

import {
  aprobacionesDeMicrocopy, constaAprobado, comoConstaAprobado, delegadasSinComprobar,
  delegacionVigente, LIMITES_DEL_FUNDADOR,
  ESTADO_APROBADA, ESTADO_SIN_COMPROBAR, ESTADO_NO_APROBADA, NO_COMPROBADO_EN_UNA_DELEGADA,
  NO_COMPROBADO_EN_UNA_FIRMA_DEL_FUNDADOR,
} from './_microcopy-aprobada.mjs';

const ESTADOS = [ESTADO_APROBADA, ESTADO_SIN_COMPROBAR, ESTADO_NO_APROBADA];
/** Las delegadas que cuentan: el estado ya no basta, lo comparten con la firma del fundador (1546c). */
const esDelegada = (a) => a.estado === ESTADO_SIN_COMPROBAR && a.firmante === 'orquestador';
const esDelFundador = (a) => a.estado === ESTADO_SIN_COMPROBAR && a.firmante === 'fundador';

const LIMITES_VIGENTE = '# Límites\n\n## Delegación permanente\n\n'
  + '- **Los textos de microcopy que haya que aprobar los aprueba el orquestador**\n'
  + '  (dentro de la regla 30: siguen sin poder inventarse a nivel de sesión).\n\n'
  + '## Cómo quiere trabajar\n\n- lo que sea\n';
const LIMITES_RETIRADA = '# Límites\n\n## Delegación permanente\n\n- otra cosa\n\n## Cómo quiere trabajar\n\n- lo que sea\n';

/** El contenido de una ficha de `docs/microcopy/` de prueba. */
const cuerpoDeFicha = (firma, texto) => `# Ficha\n\n${firma}\n\n## Texto aprobado, literal\n\n> ${texto}\n`;

const FIRMA_FUNDADOR = '**Aprobado por el fundador** el 15-sep-2026.';
const FIRMA_DELEGADA = '**Aprobado por el orquestador por delegación del fundador** el 15-sep-2026 — SCRUM-600 comentario 15357.';
const FIRMA_ASESOR = '**Aprobado por el asesor** el 15-sep-2026.';
const F_FUNDADOR = '2026-09-15-SCRUM-600-del-fundador.md';
const F_DELEGADA = '2026-09-15-SCRUM-600-delegada.md';
const F_ASESOR = '2026-09-15-SCRUM-600-del-asesor.md';
const T_FUNDADOR = 'Texto de prueba que firmó el fundador';
const T_DELEGADA = 'Texto de prueba que aprobó un orquestador';
const T_ASESOR = 'Texto de prueba que firmó el asesor';

/** Un directorio de trabajo en `os.tmpdir()`, con su carpeta de fichas. */
const escenario = () => {
  const raiz = temporal('scrum997d-');
  const dir = path.join(raiz, 'microcopy');
  fs.mkdirSync(dir);
  return { raiz, dir };
};
const opciones = (dir, limites) => ({ dir, congelado: false, limites });
const estadoPorRuta = (as) => new Map(as.map((a) => [a.ruta, a.estado]));

// ═══ 1 · SUELO ══════════════════════════════════════════════════════════════════════════════

test('SCRUM-997d · 1) SUELO: sobre el árbol real hay fichas en los dos estados que cuentan, y se dice cuántas', (t) => {
  const todas = aprobacionesDeMicrocopy();
  const de = (e) => todas.filter((a) => a.estado === e);
  t.diagnostic(`POBLACION · registros ${todas.length} · ${ESTADO_APROBADA} ${de(ESTADO_APROBADA).length} · `
    + `${ESTADO_SIN_COMPROBAR} ${de(ESTADO_SIN_COMPROBAR).length} (del fundador ${todas.filter(esDelFundador).length}, `
    + `delegadas ${todas.filter(esDelegada).length}) · ${ESTADO_NO_APROBADA} ${de(ESTADO_NO_APROBADA).length}`);
  for (const a of todas) {
    assert.ok(ESTADOS.includes(a.estado), `🔴 ${a.ruta} sale con el estado «${a.estado}», que no es ninguno de los tres.`);
  }
  // Sin estos, todo lo de abajo se cumpliría sobre el vacío.
  assert.ok(todas.filter(esDelFundador).length >= 1, '🔴 ninguna ficha con la firma del fundador: el barrido no ha mirado.');
  assert.ok(todas.filter(esDelegada).length >= 1,
    '🔴 ninguna ficha delegada en el árbol real. Hay decenas: o el barrido no ha mirado, o la delegación ha dejado de '
    + 'estar vigente y entonces el rojo de verdad está en scrum861.');
  // SCRUM-1546c · `aprobada` a secas es SÓLO el registro congelado. Ninguna ficha: de ninguna se lee
  // más que la forma de su firma.
  assert.deepEqual(de(ESTADO_APROBADA).map((a) => a.origen), ['congelado'],
    '🔴 una ficha de docs/microcopy/ sale `aprobada` a secas: el oráculo vuelve a afirmar una firma que no comprueba (M5, SCRUM-1546).');
});

// ═══ 2 · EL CRITERIO NO CAMBIA ══════════════════════════════════════════════════════════════

test('SCRUM-997d · 2) el criterio NO cambia: cuenta exactamente lo que contaba, ficha a ficha', () => {
  const todas = aprobacionesDeMicrocopy();
  const vigente = delegacionVigente();
  for (const a of todas) {
    // El criterio de antes de este cambio, escrito otra vez aquí y no importado: si alguien toca el
    // del oráculo, esta línea no se mueve con él.
    const antes = a.firmante === 'fundador' || (a.firmante === 'orquestador' && a.delegacion !== null && vigente);
    assert.equal(a.aprobada, antes, `🔴 ${a.ruta}: «aprobada» ya no vale lo que valía antes de los tres estados.`);
    assert.equal(a.aprobada, a.estado !== ESTADO_NO_APROBADA,
      `🔴 ${a.ruta}: «aprobada» y «estado» discrepan (${a.aprobada} frente a «${a.estado}»).`);
    assert.equal(a.noComprobado.length > 0, a.estado === ESTADO_SIN_COMPROBAR,
      `🔴 ${a.ruta}: sólo lo que sale sin comprobar declara algo, y lo declara siempre.`);
    // Y declara lo SUYO: la lista de la delegada no vale para la del fundador, ni al revés.
    if (esDelegada(a)) assert.deepEqual(a.noComprobado, [...NO_COMPROBADO_EN_UNA_DELEGADA], `🔴 ${a.ruta}`);
    if (esDelFundador(a)) assert.deepEqual(a.noComprobado, [...NO_COMPROBADO_EN_UNA_FIRMA_DEL_FUNDADOR], `🔴 ${a.ruta}`);
    if (a.estado === ESTADO_SIN_COMPROBAR) assert.ok(esDelegada(a) || esDelFundador(a), `🔴 ${a.ruta}: sin comprobar y no es de ninguna de las dos firmas que cuentan.`);
  }
  // Por CONJUNTOS: las delegadas son las que firma el orquestador y cuentan, ni una más ni una menos.
  const esperadas = todas.filter((a) => a.firmante === 'orquestador' && a.aprobada).map((a) => a.ruta).sort();
  assert.deepEqual(delegadasSinComprobar().map((d) => d.ruta).sort(), esperadas);
});

// ═══ 3 y 4 · LOS TRES ESTADOS, UNO A UNO ════════════════════════════════════════════════════

test('SCRUM-997d · 3) tres firmas, tres estados', () => {
  const e = escenario();
  fs.writeFileSync(path.join(e.dir, F_FUNDADOR), cuerpoDeFicha(FIRMA_FUNDADOR, T_FUNDADOR));
  fs.writeFileSync(path.join(e.dir, F_DELEGADA), cuerpoDeFicha(FIRMA_DELEGADA, T_DELEGADA));
  fs.writeFileSync(path.join(e.dir, F_ASESOR), cuerpoDeFicha(FIRMA_ASESOR, T_ASESOR));
  const limites = path.join(e.raiz, 'limites.md');
  fs.writeFileSync(limites, LIMITES_VIGENTE);
  const o = opciones(e.dir, limites);

  const todas = aprobacionesDeMicrocopy(o);
  const estados = estadoPorRuta(todas);
  // SCRUM-1546c · la del fundador sale sin comprobar, como la delegada: antes salía `aprobada`.
  assert.deepEqual([...estados].sort(), [
    ['docs/microcopy/' + F_ASESOR, ESTADO_NO_APROBADA],
    ['docs/microcopy/' + F_FUNDADOR, ESTADO_SIN_COMPROBAR],
    ['docs/microcopy/' + F_DELEGADA, ESTADO_SIN_COMPROBAR],
  ].sort());
  // Las dos «sin comprobar» se distinguen por lo que declaran, que es distinto.
  assert.deepEqual(todas.find((a) => a.nombre === F_FUNDADOR).noComprobado, [...NO_COMPROBADO_EN_UNA_FIRMA_DEL_FUNDADOR],
    '🔴 la firma del fundador tiene que decir QUÉ no se ha comprobado de ella.');
  assert.ok(NO_COMPROBADO_EN_UNA_FIRMA_DEL_FUNDADOR.length >= 1, '🔴 la lista de la firma del fundador está vacía.');

  const [delegada] = delegadasSinComprobar(o);
  assert.equal(delegadasSinComprobar(o).length, 1);
  assert.equal(delegada.ruta, 'docs/microcopy/' + F_DELEGADA);
  assert.equal(delegada.referencia, 'SCRUM-600 comentario 15357');
  assert.deepEqual(delegada.noComprobado, [...NO_COMPROBADO_EN_UNA_DELEGADA],
    '🔴 una delegada tiene que decir QUÉ no se ha comprobado de ella, no sólo que algo falta.');
  assert.ok(NO_COMPROBADO_EN_UNA_DELEGADA.length >= 1, '🔴 la lista de lo no comprobado está vacía: el tercer estado no diría nada.');
});

test('SCRUM-997d · 4) con la delegación retirada, la delegada pasa a «no aprobada» y la del fundador no se mueve', () => {
  const e = escenario();
  fs.writeFileSync(path.join(e.dir, F_FUNDADOR), cuerpoDeFicha(FIRMA_FUNDADOR, T_FUNDADOR));
  fs.writeFileSync(path.join(e.dir, F_DELEGADA), cuerpoDeFicha(FIRMA_DELEGADA, T_DELEGADA));
  const limites = path.join(e.raiz, 'limites.md');
  fs.writeFileSync(limites, LIMITES_RETIRADA);
  const o = opciones(e.dir, limites);

  const estados = estadoPorRuta(aprobacionesDeMicrocopy(o));
  // SCRUM-1546c · «no se mueve» es ahora «sigue sin comprobar»: la delegación no la toca.
  assert.equal(estados.get('docs/microcopy/' + F_FUNDADOR), ESTADO_SIN_COMPROBAR);
  assert.deepEqual(constaAprobado(T_FUNDADOR, o), ['docs/microcopy/' + F_FUNDADOR], '🔴 la del fundador dejó de contar al retirar la delegación.');
  assert.equal(estados.get('docs/microcopy/' + F_DELEGADA), ESTADO_NO_APROBADA,
    '🔴 «sin comprobar» no puede querer decir «sin delegación»: una firma delegada sin delegación vigente NO cuenta.');
  assert.deepEqual(delegadasSinComprobar(o), []);
  assert.deepEqual(constaAprobado(T_DELEGADA, o), []);
});

// ═══ 5 · LA PREGUNTA QUE DISTINGUE ══════════════════════════════════════════════════════════

test('SCRUM-997d · 5) `comoConstaAprobado` da las rutas de `constaAprobado`, y además dice cuál de los dos «sí» es', () => {
  const e = escenario();
  fs.writeFileSync(path.join(e.dir, F_FUNDADOR), cuerpoDeFicha(FIRMA_FUNDADOR, T_FUNDADOR));
  fs.writeFileSync(path.join(e.dir, F_DELEGADA), cuerpoDeFicha(FIRMA_DELEGADA, T_DELEGADA));
  fs.writeFileSync(path.join(e.dir, F_ASESOR), cuerpoDeFicha(FIRMA_ASESOR, T_ASESOR));
  const limites = path.join(e.raiz, 'limites.md');
  fs.writeFileSync(limites, LIMITES_VIGENTE);
  const o = opciones(e.dir, limites);

  // SCRUM-1546c · la del fundador consta SIN COMPROBAR y dice qué no se ha mirado (antes: `aprobada`, `[]`).
  assert.deepEqual(comoConstaAprobado(T_FUNDADOR, o),
    [{ ruta: 'docs/microcopy/' + F_FUNDADOR, estado: ESTADO_SIN_COMPROBAR, noComprobado: [...NO_COMPROBADO_EN_UNA_FIRMA_DEL_FUNDADOR] }]);
  assert.deepEqual(comoConstaAprobado(T_DELEGADA, o),
    [{ ruta: 'docs/microcopy/' + F_DELEGADA, estado: ESTADO_SIN_COMPROBAR, noComprobado: [...NO_COMPROBADO_EN_UNA_DELEGADA] }]);
  assert.deepEqual(comoConstaAprobado(T_ASESOR, o), [], 'una firma que no cuenta no consta, tampoco aquí');
  assert.throws(() => comoConstaAprobado('', o), /CIEGO/);

  // Y sobre el árbol real, un literal de cada firma que cuenta y del congelado: mismas rutas, en el mismo orden.
  const todas = aprobacionesDeMicrocopy();
  const casos = [
    ['ficha del fundador', ESTADO_SIN_COMPROBAR, (a) => a.origen === 'fichero' && esDelFundador(a)],
    ['ficha delegada', ESTADO_SIN_COMPROBAR, (a) => a.origen === 'fichero' && esDelegada(a)],
    ['registro congelado', ESTADO_APROBADA, (a) => a.origen === 'congelado'],
  ];
  for (const [rotulo, estado, cual] of casos) {
    const ficha = todas.find((a) => cual(a) && a.literales.length > 0);
    assert.ok(ficha, `🔴 no encuentro en el árbol real ningún ${rotulo} con un literal: no puedo comparar.`);
    const como = comoConstaAprobado(ficha.literales[0]);
    assert.deepEqual(como.map((c) => c.ruta), constaAprobado(ficha.literales[0]));
    assert.ok(como.some((c) => c.ruta === ficha.ruta && c.estado === estado), `🔴 ${rotulo}: no consta con «${estado}».`);
  }
});

// ═══ 6, 7 y 8 · CADA LÍNEA DE LA DECLARACIÓN, ATADA A LO QUE EL CÓDIGO HACE ═════════════════

const SI_ESTO_CAE = 'Si le has enseñado al oráculo a mirarlo, enhorabuena: quita esa línea de '
  + '`NO_COMPROBADO_EN_UNA_DELEGADA` y este test en el mismo cambio. Si no, has roto otra cosa.';

test('SCRUM-997d · 6) declarado «no sé qué orquestador firma»: sin ninguna línea de Javier, ninguna ficha cambia de estado', (t) => {
  assert.ok(NO_COMPROBADO_EN_UNA_DELEGADA.some((l) => /qué orquestador firma/.test(l)), 'la declaración ya no lo dice: este test sobra, quítalo');
  const e = escenario();
  const lineas = fs.readFileSync(LIMITES_DEL_FUNDADOR, 'utf8').split(/\r?\n/);
  const abren = lineas.filter((l) => /^\*\*Javier, 2[25]-sep-2026/.test(l)).length;
  assert.equal(abren, 2,
    '🔴 CIEGO: no encuentro en `limites-del-fundador.md` las dos líneas que abren las delegaciones de Javier (25-sep y '
    + '22-sep). Sin ellas no puedo quitar nada, y «no cambia nada» sería cierto sobre el vacío.');
  const sinJavier = lineas.filter((l) => !/Javier/.test(l));
  const sinLuis = lineas.filter((l) => !/Los textos de microcopy que haya que aprobar los aprueba el orquestador/.test(l));
  const rutaSinJavier = path.join(e.raiz, 'limites-sin-javier.md');
  const rutaSinLuis = path.join(e.raiz, 'limites-sin-luis.md');
  fs.writeFileSync(rutaSinJavier, sinJavier.join('\n'));
  fs.writeFileSync(rutaSinLuis, sinLuis.join('\n'));
  t.diagnostic(`POBLACION · ${lineas.length} líneas · quitadas ${lineas.length - sinJavier.length} que nombran a Javier · quitadas ${lineas.length - sinLuis.length} con la viñeta de Luis`);
  assert.equal(lineas.length - sinLuis.length, 1, '🔴 CIEGO: la viñeta de Luis no aparece exactamente una vez; el control de abajo no vale.');

  // SCRUM-1546c · las delegadas se cuentan por estado Y firmante: el estado lo comparten con la del fundador.
  const real = estadoPorRuta(aprobacionesDeMicrocopy());
  const delegadas = aprobacionesDeMicrocopy().filter(esDelegada).length;
  assert.ok(delegadas >= 1, '🔴 CIEGO: ninguna delegada en el árbol real.');

  // CONTROL: la sonda ve. Quitar la viñeta de Luis apaga TODAS las delegadas.
  assert.equal(aprobacionesDeMicrocopy({ limites: rutaSinLuis }).filter(esDelegada).length, 0,
    '🔴 quitar la viñeta de Luis no apaga las delegadas: la copia no llega al oráculo y este test no mide nada.');

  // LO DECLARADO: quitar todo lo de Javier no mueve ninguna.
  const conSinJavier = estadoPorRuta(aprobacionesDeMicrocopy({ limites: rutaSinJavier }));
  assert.deepEqual([...conSinJavier].sort(), [...real].sort(),
    '🔴 quitar las líneas de Javier cambia el estado de alguna ficha: el oráculo ya distingue de quién es la delegación. ' + SI_ESTO_CAE);
});

test('SCRUM-997d · 7) declarado «no sé si el texto es legal o fiscal»: una delegada con un texto así sale igual que otra cualquiera', () => {
  assert.ok(NO_COMPROBADO_EN_UNA_DELEGADA.some((l) => /legal o fiscal/.test(l)), 'la declaración ya no lo dice: este test sobra, quítalo');
  const e = escenario();
  const F_LEGAL = '2026-09-28-SCRUM-600-aviso-legal.md';
  fs.writeFileSync(path.join(e.dir, F_DELEGADA), cuerpoDeFicha(FIRMA_DELEGADA, T_DELEGADA));
  fs.writeFileSync(path.join(e.dir, F_LEGAL), cuerpoDeFicha(FIRMA_DELEGADA, 'Texto de prueba: aviso legal de privacidad y dato fiscal'));
  const limites = path.join(e.raiz, 'limites.md');
  fs.writeFileSync(limites, LIMITES_VIGENTE);

  const estados = estadoPorRuta(aprobacionesDeMicrocopy(opciones(e.dir, limites)));
  assert.equal(estados.get('docs/microcopy/' + F_DELEGADA), ESTADO_SIN_COMPROBAR);
  assert.equal(estados.get('docs/microcopy/' + F_LEGAL), ESTADO_SIN_COMPROBAR,
    '🔴 una delegada con un texto legal o fiscal ya no sale como las demás. ' + SI_ESTO_CAE);
});

test('SCRUM-997d · 8) declarado «no sé si el comentario de Jira existe»: una referencia que no puede existir cuenta igual', () => {
  assert.ok(NO_COMPROBADO_EN_UNA_DELEGADA.some((l) => /comentario de Jira/.test(l)), 'la declaración ya no lo dice: este test sobra, quítalo');
  const e = escenario();
  const firmaImposible = '**Aprobado por el orquestador por delegación del fundador** el 15-sep-2026 — SCRUM-99999999 comentario 1.';
  fs.writeFileSync(path.join(e.dir, F_DELEGADA), cuerpoDeFicha(firmaImposible, T_DELEGADA));
  const limites = path.join(e.raiz, 'limites.md');
  fs.writeFileSync(limites, LIMITES_VIGENTE);

  const [ficha] = aprobacionesDeMicrocopy(opciones(e.dir, limites));
  assert.equal(ficha.estado, ESTADO_SIN_COMPROBAR,
    '🔴 una referencia a un comentario que no existe ya no cuenta. ' + SI_ESTO_CAE);
  assert.deepEqual(ficha.delegacion, { referencia: 'SCRUM-99999999 comentario 1' });
});
