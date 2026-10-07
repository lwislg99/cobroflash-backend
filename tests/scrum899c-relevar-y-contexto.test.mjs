// tests/scrum899c-relevar-y-contexto.test.mjs — SCRUM-899 hito 3.2
//
// LOS DOS SUBCOMANDOS QUE HACEN QUE EL RELEVO DE LA A19 SE PUEDA EJECUTAR.
//
//   · `contexto N` — cuánto ocupa el último turno de una sesión, para saber si pasa de 200k;
//   · `relevar N <fichero>` — parar una sesión y levantar otra en su puesto, con su encargo dentro.
//
// ── LO QUE ESTE FICHERO VIGILA DE VERDAD ────────────────────────────────────────────────────
// `relevar` es lo más peligroso que hay en este script: MATA SESIONES. Y lo que mata no es el
// proceso, es lo que la sesión sabía y no había escrito. Por eso la mitad de los casos de abajo no
// comprueban que releve, sino que **NO releve**: sin traspaso, con el traspaso viejo o con la
// sesión trabajando, se niega y lo dice.
//
// SCRUM-1007 (22-sep-2026) · «Fresco» YA NO es `traspasoMtime > ultimoTurno`: el protocolo real es
// escribir el traspaso y LUEGO contestar «traspaso listo» —esa respuesta es un turno posterior al
// fichero, por diseño—, así que el orden estricto nunca daba verde en el camino feliz. Ahora es una
// VENTANA: `ultimoTurno - traspasoMtime < esperaMs`, en cualquier dirección. El resultado se
// devuelve en `comprobado` para que un `SIN-TRASPASO` se pueda discutir sin volver a correrlo.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = path.join(RAIZ, 'scripts', 'equipo', 'sesion.mjs');
const s = await import(pathToFileURL(SCRIPT).href);

// El rojo de cada pieza, declarado: lo ejecuta `npm run meta:mutaciones`.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'scripts/equipo/sesion.mjs',
    de: '    tokens = suma;',
    a: '    tokens = Math.max(tokens ?? 0, suma);',
    cae: '🔴 el contexto es el del ÚLTIMO turno, no el máximo histórico',
  },
  {
    fichero: 'scripts/equipo/sesion.mjs',
    de: "    const suma = (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);",
    a: "    const suma = (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.output_tokens || 0);",
    cae: '🔴 el contexto NO incluye output_tokens: es lo que se manda, no lo que contesta',
  },
  {
    fichero: 'scripts/equipo/sesion.mjs',
    de: '  return tokens === null ? null : { tokens, turnos, cuando };',
    a: '  return { tokens: tokens ?? 0, turnos, cuando };',
    cae: '🔴 SUELO: sin turnos legibles el contexto es null, NUNCA 0',
  },
  {
    fichero: 'scripts/equipo/sesion.mjs',
    de: '  for (const c of carpetas || []) {',
    a: '  for (const c of (carpetas || []).slice(0, 1)) {',
    cae: '🔴 el jsonl se busca en TODAS las carpetas de proyecto, no solo en la del repo',
  },
  {
    fichero: 'scripts/equipo/sesion.mjs',
    de: "  if (v.state === 'working' || v.state === 'busy') {",
    a: '  if (false) {',
    cae: '🔴 no se para una sesión que está TRABAJANDO, aunque el traspaso esté fresco',
  },
  {
    fichero: 'scripts/equipo/sesion.mjs',
    de: '  if (ultimoTurno - traspasoMtime >= esperaMs) {',
    a: '  if (false) {',
    cae: '🔴 no se para una sesión cuyo traspaso está REALMENTE viejo frente al último turno',
  },
  {
    fichero: 'scripts/equipo/sesion.mjs',
    de: '  const yaSinEsperar = tokens > umbralAMitad;',
    a: '  const yaSinEsperar = false;',
    cae: '🔴 SCRUM-1484b · `contexto N` dice CUÁNDO: entre los dos números AL TERMINAR, por encima del segundo YA',
  },
  {
    fichero: 'scripts/equipo/sesion.mjs',
    de: 'export const UMBRAL_CONTEXTO_A_MITAD = 500_000;',
    a: 'export const UMBRAL_CONTEXTO_A_MITAD = 450_000;',
    cae: '🔴 SCRUM-1484b · el papel de S5 (`orquestador-autonomo.md` §5bis.1) dice los DOS números que lleva el código',
  },
];

const UUID = 'd521a2f6-ff99-4970-a1bc-f8064ed68061';
const OTRO_UUID = 'eac28c28-1111-2222-3333-444455556666';

/** Una línea de turno del jsonl, como las escribe Claude Code. */
function turno({ input = 0, lectura = 0, creacion = 0, salida = 0, cuando = null } = {}) {
  return JSON.stringify({
    type: 'assistant',
    timestamp: cuando,
    message: {
      usage: {
        input_tokens: input,
        cache_read_input_tokens: lectura,
        cache_creation_input_tokens: creacion,
        output_tokens: salida,
      },
    },
  });
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// contextoDelJsonl
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('🔴 el contexto es el del ÚLTIMO turno, no el máximo histórico', () => {
  const jsonl = [
    turno({ input: 10, lectura: 490_000, cuando: '2026-09-17T18:00:00Z' }),
    turno({ input: 10, lectura: 690_000, cuando: '2026-09-17T18:10:00Z' }),
    turno({ input: 10, lectura: 120_000, cuando: '2026-09-17T18:20:00Z' }),
  ].join('\n');

  const c = s.contextoDelJsonl(jsonl);
  assert.equal(c.tokens, 120_010,
    '🔴 con el máximo, una sesión que acaba de compactarse se quedaría «pesada» para siempre y se relevaría sin motivo');
  assert.equal(c.turnos, 3);
  assert.equal(c.cuando, '2026-09-17T18:20:00Z');
});

test('🔴 el contexto NO incluye output_tokens: es lo que se manda, no lo que contesta', () => {
  const c = s.contextoDelJsonl(turno({ input: 1_000, lectura: 200_000, creacion: 99_000, salida: 30_000 }));
  assert.equal(c.tokens, 300_000, '🔴 sumando la salida daría 330k y cruzaría el umbral de la A19 sin haberlo cruzado');
});

test('🔴 SUELO: sin turnos legibles el contexto es null, NUNCA 0', () => {
  // Un 0 se leería como «sesión vacía, no hay que relevarla»: la conclusión CONTRARIA a «no he
  // podido mirar». Es el mismo error que el «0 tests» de SCRUM-928.
  assert.equal(s.contextoDelJsonl(''), null);
  assert.equal(s.contextoDelJsonl('{"type":"user","message":{}}'), null, '🔴 un turno de usuario no trae uso');
  assert.equal(s.contextoDelJsonl(turno({ input: 0, lectura: 0 })), null, '🔴 un turno con uso a cero no es una lectura');

  // Y el suelo tiene que distinguirse de la lectura de verdad, o no vigila nada.
  assert.equal(s.contextoDelJsonl(turno({ input: 5 })).tokens, 5);
});

test('una línea a medio escribir no invalida el resto del fichero', () => {
  // El jsonl de una sesión VIVA se está escribiendo mientras se lee: la última línea puede llegar
  // partida. Si eso tumbara la lectura, `contexto` fallaría justo con las sesiones que importan.
  const jsonl = [turno({ input: 50_000, cuando: '2026-09-17T18:00:00Z' }), '{"type":"assistant","mess'].join('\n');
  assert.equal(s.contextoDelJsonl(jsonl).tokens, 50_000);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// buscarJsonl — el hallazgo medido
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('🔴 el jsonl se busca en TODAS las carpetas de proyecto, no solo en la del repo', () => {
  // MEDIDO el 17-sep-2026: las seis sesiones de fondo tenían su jsonl en la carpeta del SCRATCHPAD
  // de quien las lanzó, no en la del repositorio. Quien busque en la del repo encuentra las de la
  // tanda MUERTA y concluye que el equipo está parado.
  const carpetas = ['/proyectos/D--MILLONARIO-repo', '/proyectos/C--Users-scratchpad-prompts'];
  const soloEnLaSegunda = (p) => p === path.join('/proyectos/C--Users-scratchpad-prompts', `${UUID}.jsonl`);

  assert.equal(
    s.buscarJsonl({ sessionId: UUID, carpetas, existe: soloEnLaSegunda }),
    path.join('/proyectos/C--Users-scratchpad-prompts', `${UUID}.jsonl`),
    '🔴 mirando solo la primera carpeta, las seis sesiones de fondo salen como «no encontradas»',
  );
  assert.equal(s.buscarJsonl({ sessionId: UUID, carpetas, existe: () => false }), null,
    '🔴 SUELO: si no está en ninguna se devuelve null, no una ruta inventada');
  assert.equal(s.buscarJsonl({ sessionId: 'd521a2f6', carpetas, existe: () => true }), null,
    '🔴 acepta un id corto y buscaría un fichero que no es');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// decidirRelevo — los tres casos de la A19
// ═════════════════════════════════════════════════════════════════════════════════════════════

// LO QUE ESTE TEST AFIRMABA, Y LO QUE AFIRMA AHORA — las dos fechas, para que el cambio no sea silencioso:
//   · del 21-sep-2026 al 6-oct-2026 (SCRUM-1070b, A25): «el relevo es a 200k, no a 300k».
//   · desde el 6-oct-2026 (SCRUM-1479): 300k, autorizado por el fundador con su coste. Medido ese día sobre 43
//     sesiones: 200k lo cruzan 38, y 30 de ellas antes de su primer push; 300k lo cruzan 21, 14 ya con alguno.
test('los tres casos de la A19, y sus dos lados del umbral (300k desde el 6-oct-2026; fue 200k desde el 21-sep-2026)', () => {
  assert.equal(s.UMBRAL_CONTEXTO, 300_000, '🔴 A19, 6-oct-2026 (SCRUM-1479): el relevo al entregar es a 300k; el 200k del 21-sep (SCRUM-1070b) ya no rige');
  const ahora = Date.parse('2026-09-17T19:00:00Z');
  const hace5min = ahora - 5 * 60 * 1000;
  const ctx = (t) => ({ tokens: t, turnos: 10, cuando: null });

  assert.equal(s.decidirRelevo({ contexto: ctx(300_001), ultimaActividad: hace5min, ahora }).veredicto, 'RELEVAR');
  assert.equal(s.decidirRelevo({ contexto: ctx(299_999), ultimaActividad: hace5min, ahora }).veredicto, 'SEGUIR',
    '🔴 releva por debajo del umbral: la A19 dice que el encargo siguiente entra en la misma sesión');
  // El caso que el 200k acusaba y el 300k no: una sesión de 230k (la mediana del primer push ese día) SIGUE.
  assert.equal(s.decidirRelevo({ contexto: ctx(230_000), ultimaActividad: hace5min, ahora }).veredicto, 'SEGUIR');

  const hace2h = ahora - 2 * 60 * 60 * 1000;
  assert.equal(s.decidirRelevo({ contexto: ctx(10_000), ultimaActividad: hace2h, ahora }).veredicto, 'RELEVAR',
    '🔴 más de 1 h parada: la caché de prompt ya está fría y el turno siguiente reescribe la conversación entera');

  assert.equal(s.decidirRelevo({ contexto: ctx(10_000), ultimaActividad: hace5min, ahora, tandaNueva: true }).veredicto, 'RELEVAR');

  assert.equal(s.decidirRelevo({ contexto: null, ultimaActividad: hace5min, ahora }).veredicto, 'NO-PUDE-MIRAR',
    '🔴 sin lectura NO se dice «sigue»: un instrumento que no pudo mirar no da verde');
});

// SCRUM-1484b (7-oct-2026) · La A19 tiene DOS números. El latido ya decía dos frases (SCRUM-1484); `contexto N`
// seguía con una, «por encima de 300k», también para una sesión que ya había pasado el segundo. Dos instrumentos
// que miran la misma ventana no pueden decirle dos cosas: la frase vive en `fraseDeRelevo` y la dicen los dos.
test('🔴 SCRUM-1484b · `contexto N` dice CUÁNDO: entre los dos números AL TERMINAR, por encima del segundo YA', () => {
  const ahora = Date.parse('2026-10-07T07:30:00Z');
  const hace5min = ahora - 5 * 60 * 1000;
  const ctx = (t) => ({ tokens: t, turnos: 10, cuando: null });
  const de = (t, extra = {}) => s.decidirRelevo({ contexto: ctx(t), ultimaActividad: hace5min, ahora, ...extra });
  assert.ok(s.UMBRAL_CONTEXTO_A_MITAD > s.UMBRAL_CONTEXTO, '🔴 el de «a mitad» tiene que quedar por encima del de «al entregar»');
  const k = (n) => `${Math.round(n / 1000)}k`;
  const entre = Math.round((s.UMBRAL_CONTEXTO + s.UMBRAL_CONTEXTO_A_MITAD) / 2);
  const encima = s.UMBRAL_CONTEXTO_A_MITAD + 30_000;

  const rEntre = de(entre);
  assert.equal(rEntre.veredicto, 'RELEVAR');
  assert.equal(rEntre.momento, 'AL-TERMINAR');
  assert.equal(rEntre.motivo, `el contexto va por ${k(entre)}, por encima de ${k(s.UMBRAL_CONTEXTO)} (A19): se releva AL TERMINAR su entrega`);

  const rEncima = de(encima);
  assert.equal(rEncima.veredicto, 'RELEVAR', '🔴 por encima del segundo sigue siendo RELEVAR: lo que cambia es CUÁNDO');
  assert.equal(rEncima.momento, 'YA');
  assert.equal(rEncima.motivo, `el contexto va por ${k(encima)}, por encima de ${k(s.UMBRAL_CONTEXTO_A_MITAD)} (A19, a mitad de entrega): se releva YA, sin esperar a terminar — primer punto seguro (un commit local), traspaso y relevo`);
  // Control positivo de la negación: la frase de «YA» existe, o el `doesNotMatch` de abajo no mediría nada.
  assert.match(rEncima.motivo, /se releva YA/);
  assert.doesNotMatch(rEncima.motivo, /AL TERMINAR/, '🔴 a una sesión por encima del segundo número `contexto` le dice «al terminar»: lo contrario de la A19');
  assert.doesNotMatch(rEntre.motivo, /se releva YA/, '🔴 a una sesión que sólo pasó el primero no se le pide parar a mitad');

  // Igual al segundo todavía es «al terminar»: la norma dice «si pasa de». Y por debajo del primero no hay momento.
  assert.equal(de(s.UMBRAL_CONTEXTO_A_MITAD).momento, 'AL-TERMINAR');
  assert.equal(de(s.UMBRAL_CONTEXTO - 1).momento, undefined);
  assert.equal(de(s.UMBRAL_CONTEXTO - 1).veredicto, 'SEGUIR');

  // La frase es UNA: la que exporta `sesion.mjs` y toma el latido (`tests/scrum1350-latido.test.mjs` fija la suya).
  assert.equal(rEncima.motivo, `el contexto va por ${k(encima)}, ${s.fraseDeRelevo({ tokens: encima })}`);
  assert.equal(s.fraseDeRelevo({ tokens: s.UMBRAL_CONTEXTO }), null, 'sin pasar del primero no hay frase');

  // CIEGO: con los dos números iguales o al revés no hay tramo «al terminar», y elegir una frase sería inventarla.
  for (const [umbral, umbralAMitad] of [[300_000, 300_000], [500_000, 300_000], [300_000, NaN]]) {
    const r = de(700_000, { umbral, umbralAMitad });
    assert.equal(r.veredicto, 'NO-PUDE-MIRAR', `🔴 con ${umbral}/${umbralAMitad} da un veredicto`);
    assert.equal(s.fraseDeRelevo({ tokens: 700_000, umbral, umbralAMitad }), null);
  }
});

// SCRUM-1484b · EL PAPEL Y SU GEMELO. SCRUM-1484 metió el segundo número en el código el 6-oct-2026 y dejó este
// papel, que es de S5, diciendo que «no está en el código». Al día siguiente se repartió construir lo ya construido.
// Lo que ata: quien mueva un número en `sesion.mjs` tiene que escribirlo en el apartado que le dice al orquestador
// cuándo se releva, o esto cae. NO ata la A19 (`00-normas-comunes.md`): es de la S0 y nombra muchos números.
test('🔴 SCRUM-1484b · el papel de S5 (`orquestador-autonomo.md` §5bis.1) dice los DOS números que lleva el código', () => {
  const papel = fs.readFileSync(path.join(RAIZ, 'docs', 'equipo', 'orquestador-autonomo.md'), 'utf8');
  const inicio = papel.indexOf('### 5bis.1');
  const fin = papel.indexOf('### 5bis.2');
  assert.ok(inicio > 0 && fin > inicio, '🔴 SUELO: no encuentro el apartado 5bis.1 entre sus dos cabeceras; sin él no he mirado nada');
  const apartado = papel.slice(inicio, fin);
  const k = (n) => `${Math.round(n / 1000)}k`;
  assert.ok(apartado.includes(`por encima de ${k(s.UMBRAL_CONTEXTO)}**`), `🔴 el papel no dice «por encima de ${k(s.UMBRAL_CONTEXTO)}», que es UMBRAL_CONTEXTO`);
  assert.ok(apartado.includes(`de ${k(s.UMBRAL_CONTEXTO_A_MITAD)} de la A19`), `🔴 el papel no dice «de ${k(s.UMBRAL_CONTEXTO_A_MITAD)} de la A19», que es UMBRAL_CONTEXTO_A_MITAD`);
  assert.ok(apartado.includes('`UMBRAL_CONTEXTO_A_MITAD`'), '🔴 el papel no nombra la constante del segundo número');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// decidirRelevar — el protocolo, y es cobarde por defecto
// ═════════════════════════════════════════════════════════════════════════════════════════════

const ahora = Date.parse('2026-09-17T19:00:00Z');
const ultimoTurno = Date.parse('2026-09-17T18:50:00Z');
const viva = (extra = {}) => [{ id: 'aaaaaaaa', name: 'sesion-2', kind: 'background', sessionId: UUID, state: 'idle', ...extra }];

test('traspaso fresco y sesión quieta → RELEVAR, con lo comprobado a la vista', () => {
  const d = s.decidirRelevar({ nombre: 'sesion-2', agentes: viva(), traspasoMtime: ultimoTurno + 1000, ultimoTurno, ahora });
  assert.equal(d.veredicto, 'RELEVAR');
  assert.equal(d.id, 'aaaaaaaa');
  assert.deepEqual(d.comprobado, { traspasoMtime: ultimoTurno + 1000, ultimoTurno, estado: 'idle' },
    '🔴 un SIN-TRASPASO que no dice qué comparó no se puede discutir sin volver a correrlo');
});

test('🔴 SCRUM-1007 · un traspaso unos segundos antes del último turno SÍ cuenta (es el camino feliz)', () => {
  // Es el caso medido en el ticket: la sesión escribe el traspaso y LUEGO contesta «traspaso
  // listo» — esa respuesta es el `ultimoTurno`, y llega segundos DESPUÉS del fichero. Con la
  // ventana (`esperaMs`), esto es fresco: si no lo fuera, el camino feliz jamás daría RELEVAR.
  const d = s.decidirRelevar({
    nombre: 'sesion-2', agentes: viva(), traspasoMtime: ultimoTurno - 14_400, ultimoTurno,
    ahora: ultimoTurno + 5_000,
  });
  assert.equal(d.veredicto, 'RELEVAR', '🔴 vuelve el defecto: contestar «traspaso listo» bloquea el propio relevo');
});

test('🔴 no se para una sesión cuyo traspaso está REALMENTE viejo frente al último turno', () => {
  // «Viejo» ya no es «anterior», es «fuera de la ventana `esperaMs`»: la sesión siguió trabajando
  // DESPUÉS de ese traspaso y no lo ha vuelto a tocar. Los dos lados se prueban lejos del borde de
  // la ventana Y del plazo de espera, a propósito: un caso justo en el límite mide el redondeo.
  const traspasoViejo = ultimoTurno - 20 * 60 * 1000; // 20 min antes: fuera de los 10 min de esperaMs
  const dentro = s.decidirRelevar({
    nombre: 'sesion-2', agentes: viva(), traspasoMtime: traspasoViejo, ultimoTurno,
    ahora: ultimoTurno + 60 * 1000,
  });
  assert.equal(dentro.veredicto, 'ESPERANDO', '🔴 se la carga con un traspaso que ya no describe el último turno');

  const fuera = s.decidirRelevar({
    nombre: 'sesion-2', agentes: viva(), traspasoMtime: traspasoViejo, ultimoTurno,
    ahora: ultimoTurno + 11 * 60 * 1000,
  });
  assert.equal(fuera.veredicto, 'SIN-TRASPASO', '🔴 espera para siempre, o peor: para igual');

  const nada = s.decidirRelevar({ nombre: 'sesion-2', agentes: viva(), traspasoMtime: undefined, ultimoTurno, ahora });
  assert.equal(nada.veredicto, 'SIN-TRASPASO',
    '🔴 para una sesión SIN traspaso: se pierde justo lo que el relevo existe para conservar, y en silencio');
});

test('🔴 no se para una sesión que está TRABAJANDO, aunque el traspaso esté fresco', () => {
  // Un traspaso escrito hace diez minutos no describe lo que está haciendo ahora mismo, y varias
  // sesiones han entregado con cosas a medio empujar.
  const fresco = ultimoTurno + 1000;
  for (const estado of ['working', 'busy']) {
    const d = s.decidirRelevar({ nombre: 'sesion-2', agentes: viva({ state: estado }), traspasoMtime: fresco, ultimoTurno, ahora });
    assert.equal(d.veredicto, 'OCUPADA', `🔴 para a «${estado}» a mitad de lo que esté haciendo`);
  }
  // Y el caso tiene que distinguirse: quieta y con traspaso fresco SÍ se releva (si no, el test
  // pasaría igual con un `return OCUPADA` para todo).
  assert.equal(s.decidirRelevar({ nombre: 'sesion-2', agentes: viva(), traspasoMtime: fresco, ultimoTurno, ahora }).veredicto, 'RELEVAR');
});

test('bloqueada, sin nadie vivo, nombre ajeno y el suelo', () => {
  const fresco = ultimoTurno + 1000;
  assert.equal(
    s.decidirRelevar({ nombre: 'sesion-2', agentes: viva({ state: 'blocked', waitingFor: 'permission prompt' }), traspasoMtime: fresco, ultimoTurno, ahora }).veredicto,
    'BLOQUEADA', '🔴 una sesión bloqueada se trata como quieta y se para sin que nadie lo diga');

  assert.equal(s.decidirRelevar({ nombre: 'sesion-2', agentes: [], traspasoMtime: fresco, ultimoTurno, ahora }).veredicto,
    'LANZAR', 'no hay a quien relevar: eso no es un error');

  assert.equal(s.decidirRelevar({ nombre: 'cobroflash-backend-b9', agentes: viva(), traspasoMtime: fresco, ultimoTurno, ahora }).veredicto,
    'NOMBRE-NO-PERMITIDO', '🔴 relevaría una sesión ajena al equipo');

  assert.equal(s.decidirRelevar({ nombre: 'sesion-2', agentes: null, traspasoMtime: fresco, ultimoTurno, ahora }).veredicto,
    'NO-PUDE-MIRAR', '🔴 SUELO: sin listado, para a ciegas');

  assert.equal(
    s.decidirRelevar({ nombre: 'sesion-2', agentes: [...viva(), { id: 'bbbbbbbb', name: 'sesion-2', kind: 'background', sessionId: OTRO_UUID }], traspasoMtime: fresco, ultimoTurno, ahora }).veredicto,
    'NO-PUDE-MIRAR', '🔴 con dos vivas del mismo nombre pararía la que no es');

  assert.equal(s.decidirRelevar({ nombre: 'sesion-2', agentes: viva(), traspasoMtime: fresco, ultimoTurno: undefined, ahora }).veredicto,
    'NO-PUDE-MIRAR', '🔴 sin fechar el último turno, «fresco» no significa nada y se para por una comparación inventada');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// El relevo lanza SIEMPRE una sesión nueva
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('🔴 relevar lanza SIEMPRE una sesión NUEVA, nunca reanuda', () => {
  // Es el punto entero de la A19: reanudar arrastraría la caché que el relevo viene a soltar.
  // Hasta SCRUM-954 (20-sep-2026) el control de este caso era que `decidirLanzar` SI reanudaba con
  // un registro reciente, y `relevar` no. Ya no vale: desde 954 tampoco reanuda `lanzar`, asi que
  // el contraste se hace contra `argsLanzar({modo:"reanudar"})`, que sigue existiendo y sigue
  // siendo lo que NO se puede construir aqui (el hermano positivo, abajo).
  const registroReciente = { 'sesion-2': { sessionId: UUID, ultimaTanda: ahora - 5 * 60 * 1000 } };
  assert.equal(s.decidirLanzar({ nombre: 'sesion-2', agentes: [], registro: registroReciente, ahora }).veredicto, 'NUEVA',
    'SCRUM-954: ni `relevar` ni `lanzar` reanudan ya; el arrastre de contexto no entra por ninguna de las dos');

  const args = s.argsLanzar({ modo: 'nueva', nombre: 'sesion-2', prompt: 'tu encargo de hoy' });
  assert.deepEqual(args.slice(0, 5), ['--bg', '-n', 'sesion-2', '--permission-mode', 'auto']);
  assert.doesNotMatch(args.join(' '), /--resume/, '🔴 relevar reanudaría, y arrastraría el contexto viejo entero');
  assert.equal(args.at(-1), 'tu encargo de hoy', '🔴 el encargo tiene que viajar DENTRO del prompt: sin él la sesión gasta contexto preguntando');

  // Hermano POSITIVO del patrón (SCRUM-237): sin esto, `--resume` podría ser un token que no
  // aparece nunca y la negación de arriba pasaría siempre sin comprobar nada. El mismo patrón, sobre
  // los argumentos de reanudar, SÍ tiene que casar.
  assert.match(
    s.argsLanzar({ modo: 'reanudar', nombre: 'sesion-2', sessionId: UUID, prompt: 'p' }).join(' '),
    /--resume/,
    '🔴 CIEGO: el patrón no detecta ni los argumentos que SÍ reanudan',
  );
});

test('la ruta del traspaso sale de un solo sitio y es la que dice la A19', () => {
  const config = { traspasos: path.join('/memoria') };
  assert.equal(s.rutaDelTraspaso(config, 'sesion-5'), path.join('/memoria', 'project_s5_traspaso.md'));
  assert.equal(s.rutaDelTraspaso(config, 'sesion-0'), path.join('/memoria', 'project_s0_traspaso.md'));
  // SCRUM-951a: aquí decía `project_traspaso.md`, y el test FIJABA el defecto. El traspaso del
  // orquestador se llama `project_orquestador_traspaso.md` en la memoria de verdad (medido el
  // 18-sep-2026); con el nombre viejo, `relevar orquestador` daba SIN-TRASPASO para siempre.
  assert.equal(s.rutaDelTraspaso(config, 'orquestador'), path.join('/memoria', 'project_orquestador_traspaso.md'));
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// Sobre ficheros de verdad
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('sobre disco: se lee el jsonl de la carpeta que NO es la del repo', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum899c-'));
  try {
    const repo = path.join(dir, 'D--MILLONARIO-repo');
    const scratch = path.join(dir, 'C--Users-scratchpad-prompts');
    fs.mkdirSync(repo);
    fs.mkdirSync(scratch);
    // En la del repo, una sesión VIEJA con otro id: la trampa medida.
    fs.writeFileSync(path.join(repo, `${OTRO_UUID}.jsonl`), turno({ lectura: 888_000 }));
    fs.writeFileSync(path.join(scratch, `${UUID}.jsonl`), turno({ lectura: 142_000, cuando: '2026-09-17T18:45:00Z' }));

    const ruta = s.buscarJsonl({ sessionId: UUID, carpetas: [repo, scratch], existe: (p) => fs.existsSync(p) });
    assert.equal(ruta, path.join(scratch, `${UUID}.jsonl`));
    assert.equal(s.contextoDelJsonl(fs.readFileSync(ruta, 'utf8')).tokens, 142_000);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
