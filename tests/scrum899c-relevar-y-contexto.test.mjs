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
// «Fresco» no es una sensación: es `traspasoMtime > ultimoTurno`, dos números. El resultado los
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
    de: '  if (traspasoMtime <= ultimoTurno) {',
    a: '  if (false) {',
    cae: '🔴 no se para una sesión cuyo traspaso no se ha reescrito',
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

test('los tres casos de la A19, y sus dos lados del umbral (200k desde A25)', () => {
  assert.equal(s.UMBRAL_CONTEXTO, 200_000, '🔴 A25: el relevo es a 200k, no a 300k');
  const ahora = Date.parse('2026-09-17T19:00:00Z');
  const hace5min = ahora - 5 * 60 * 1000;
  const ctx = (t) => ({ tokens: t, turnos: 10, cuando: null });

  assert.equal(s.decidirRelevo({ contexto: ctx(200_001), ultimaActividad: hace5min, ahora }).veredicto, 'RELEVAR');
  assert.equal(s.decidirRelevo({ contexto: ctx(199_999), ultimaActividad: hace5min, ahora }).veredicto, 'SEGUIR',
    '🔴 releva por debajo del umbral: la A19 dice que el encargo siguiente entra en la misma sesión');

  const hace2h = ahora - 2 * 60 * 60 * 1000;
  assert.equal(s.decidirRelevo({ contexto: ctx(10_000), ultimaActividad: hace2h, ahora }).veredicto, 'RELEVAR',
    '🔴 más de 1 h parada: la caché de prompt ya está fría y el turno siguiente reescribe la conversación entera');

  assert.equal(s.decidirRelevo({ contexto: ctx(10_000), ultimaActividad: hace5min, ahora, tandaNueva: true }).veredicto, 'RELEVAR');

  assert.equal(s.decidirRelevo({ contexto: null, ultimaActividad: hace5min, ahora }).veredicto, 'NO-PUDE-MIRAR',
    '🔴 sin lectura NO se dice «sigue»: un instrumento que no pudo mirar no da verde');
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

test('🔴 no se para una sesión cuyo traspaso no se ha reescrito', () => {
  // Anterior al último turno = la sesión aún no lo ha escrito. El plazo se cuenta DESDE ese último
  // turno, que es la última vez que contestó; si lleva horas parada sin escribirlo, ya no lo va a
  // escribir. Los dos lados se prueban lejos del borde, a propósito: un caso que cae justo en el
  // límite mide el redondeo, no la conducta.
  const dentro = s.decidirRelevar({
    nombre: 'sesion-2', agentes: viva(), traspasoMtime: ultimoTurno - 1000, ultimoTurno,
    ahora: ultimoTurno + 60 * 1000,
  });
  assert.equal(dentro.veredicto, 'ESPERANDO', '🔴 se la carga mientras todavía está escribiendo el traspaso');

  const fuera = s.decidirRelevar({
    nombre: 'sesion-2', agentes: viva(), traspasoMtime: ultimoTurno - 1000, ultimoTurno,
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
