// tests/scrum253-adopcion.test.mjs — SCRUM-253 · un dueño puede heredar su propio turno.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL DEFECTO
//
// `adquirirLock` preguntaba UNA cosa y actuaba como si hubiera preguntado dos:
//
//     if (vigencia.vigente) return { ok: false, motivo: 'ocupado' }
//
// SCRUM-266 arregló la CADUCIDAD que decide ese `vigente`. La PROPIEDAD —de quién es— no la
// miraba nadie. Así que **tu propio turno vivo te bloqueaba a ti**: `turno:tomar` para sostener
// la base, lanzas la tanda, y el runner se da `exit 5` contra sí mismo. La herramienta que
// SCRUM-232 hizo para poder mirar el turno sin lanzar una tanda impedía justo lo siguiente que
// ibas a hacer.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LO QUE HACE DIFÍCIL EL TICKET, Y ESTÁ EN LA MITAD DE ABAJO DE ESTE FICHERO
//
// La causa era que el dueño se medía con el PID, y el PID cambia entre los procesos de una
// misma sesión. La tentación —quitar el PID y comparar por máquina— **es SCRUM-258**: dos
// sesiones del mismo equipo pasarían a ser el mismo dueño y se adoptarían el turno la una a la
// otra, las dos escribiendo sobre la misma base. Aflojar la identidad hasta que el bug
// desaparezca hace desaparecer también el mecanismo.
//
// Por eso los tests de identidad no son adorno: son el ticket. Si la identidad no distingue
// SESIÓN de MÁQUINA, la adopción es una regresión de SCRUM-188 con buena letra.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

import {
  MARCADOR, componerMarca, componerContexto, adquirirLock, esMiTurno, idDeSesion,
  parsearContexto, TTL_POR_DEFECTO_MS,
} from '../scripts/_staging-lock.mjs';
import { dueñoActual, raizDeTrabajo, tokenDeSesion } from '../scripts/_identidad-sesion.mjs';

const RAIZ = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const T0 = Date.parse('2026-08-04T10:00:00.000Z');
const min = (n) => n * 60 * 1000;
const YO = 'DESKTOP-T5MONF5.cc9175b270';
const OTRO = 'DESKTOP-T5MONF5.a4ca185471'; // MISMA máquina, otra sesión. Ver los tests de identidad.
const SCHEMA = 'standard public schema';

function clienteFalso({ marca, ahoraMs, comentarioSchema = SCHEMA, db = 'railway' }) {
  const estado = { marca, ahoraMs, db, comentarioSchema, escrituras: [], escriturasSchema: [] };
  const cli = {
    estado,
    async $queryRawUnsafe(sql) {
      if (sql.includes('pg_namespace')) return [{ comentario: estado.comentarioSchema }];
      return [{ db: estado.db, marca: estado.marca, ahora: new Date(estado.ahoraMs) }];
    },
    async $executeRawUnsafe(sql) {
      if (sql.includes('advisory')) return 1;
      const m = /, '([^']*)'\); END \$\$;$/.exec(sql);
      assert.ok(m, `SQL inesperado: ${sql}`);
      if (sql.includes('COMMENT ON SCHEMA')) { estado.escriturasSchema.push(m[1]); estado.comentarioSchema = m[1]; }
      else { estado.escrituras.push(m[1]); estado.marca = m[1]; }
      return 1;
    },
    async $transaction(fn) { return fn(cli); },
  };
  return cli;
}

/** Un turno VIVO de `dueño`, tomado hace `hace`, con compromiso publicado (SCRUM-249). */
function turnoVivo(dueño, { hace = min(5), quedan = min(30), ref = 'una-rama' } = {}) {
  const desde = T0 - hace;
  return {
    marca: componerMarca(dueño, desde),
    comentarioSchema: `${SCHEMA} ${componerContexto({
      dueño, tipo: 'suelto', ref,
      finPrevistoMs: T0 + quedan,
      señalAntesDeMs: T0 + quedan,
    })}`,
  };
}

// ═════════════════════════════════════════════════════════════════════════════════════════
// LA ADOPCIÓN · las cuatro caras
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-253 · EL CASO REAL — mi propio turno VIVO ya no me bloquea: lo adopto', async () => {
  // Reproduce exactamente la secuencia que fallaba: `turno:tomar` deja un turno vivo con su
  // compromiso, y acto seguido la tanda de la MISMA sesión intenta tomarlo.
  const { marca, comentarioSchema } = turnoVivo(YO);
  const cli = clienteFalso({ marca, ahoraMs: T0, comentarioSchema });

  const r = await adquirirLock(cli, {
    dueño: YO, ttlMs: TTL_POR_DEFECTO_MS,
    tipo: 'gated', ref: 'scrum-253-adopcion',
    finPrevistoMs: T0 + min(31), señalAntesDeMs: T0 + min(41),
  });

  assert.equal(r.ok, true,
    '🔴 el turno PROPIO sigue bloqueando. Es el defecto entero: `turno:tomar` + tanda desde la\n' +
    '  misma sesión se da `exit 5` contra sí misma, y la herramienta que existe para poder mirar\n' +
    '  el turno sin lanzar una tanda impide lanzar la tanda.');
  assert.equal(r.adoptado, true, 'adoptar el propio tiene que DECIRSE, no colarse como una toma normal');
  assert.equal(r.reclamado, false,
    '🔴 adoptar el turno propio se está anunciando como RECLAMAR. Reclamar es quitárselo a otro; ' +
    'esto es seguir con el mío. Un mensaje que confunde las dos cosas miente sobre quién está ' +
    'escribiendo en la base, que es justo lo que se lee cuando hay dudas.');
});

test('SCRUM-253 · LA OTRA CARA — el turno de OTRA sesión de la MISMA máquina sigue bloqueando', async () => {
  // Sin este test, el de arriba no prueba nada: abrir la puerta al turno propio no puede haber
  // abierto la del vecino. Y el dueño de aquí NO es de otra máquina a propósito — es la misma,
  // otra sesión, que es el caso que SCRUM-258 dice que no se puede romper.
  const { marca, comentarioSchema } = turnoVivo(OTRO);
  const cli = clienteFalso({ marca, ahoraMs: T0, comentarioSchema });

  const r = await adquirirLock(cli, {
    dueño: YO, ttlMs: TTL_POR_DEFECTO_MS, tipo: 'gated', ref: 'scrum-253-adopcion',
  });

  assert.equal(r.ok, false,
    '🔴 un turno AJENO y VIVO se ha dejado tomar. La adopción abrió la puerta de al lado: eso no ' +
    'es SCRUM-253, es una regresión de SCRUM-188 con otro nombre.');
  assert.equal(r.motivo, 'ocupado');
  assert.equal(cli.estado.marca, marca, 'y no se ha escrito NADA sobre el marcador ajeno');
});

test('SCRUM-253 · turno LIBRE: ni adoptado ni reclamado', async () => {
  const cli = clienteFalso({ marca: MARCADOR, ahoraMs: T0 });
  const r = await adquirirLock(cli, { dueño: YO, ttlMs: TTL_POR_DEFECTO_MS, tipo: 'gated', ref: 'r' });

  assert.equal(r.ok, true);
  assert.equal(r.adoptado, false, 'un turno libre no se «adopta»: se toma');
  assert.equal(r.reclamado, false);
});

test('SCRUM-253 · turno AJENO y CADUCADO: se reclama, y NO se llama adopción', async () => {
  // La vía de SCRUM-188 sigue viva y se distingue de la nueva. Son tres desenlaces, no dos.
  const cli = clienteFalso({ marca: componerMarca(OTRO, T0 - min(90)), ahoraMs: T0 });
  const r = await adquirirLock(cli, { dueño: YO, ttlMs: TTL_POR_DEFECTO_MS, tipo: 'gated', ref: 'r' });

  assert.equal(r.ok, true);
  assert.equal(r.reclamado, true);
  assert.equal(r.adoptado, false,
    '🔴 reclamar un turno caducado ajeno se está anunciando como adopción. Adoptar es «sigo con ' +
    'lo mío»; esto es «se lo he quitado a alguien». No son la misma frase.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL COMPROMISO DE SCRUM-249 AL HEREDAR · se SUSTITUYE, no se hereda
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-253 · al adoptar, el compromiso es el de quien adopta — heredarlo mataría la tanda', async () => {
  // LA DECISIÓN DEL TICKET, y no es cosmética. `turno:tomar` promete señales para ~15 min; la
  // tanda que viene detrás dura ~31. Si adoptar CONSERVARA el compromiso viejo, la tanda saldría
  // VENCIDA a los 15 minutos y otra sesión la reclamaría — con toda la razón, porque el
  // compromiso publicado diría que ya no da señales. Sería el defecto de SCRUM-266 entrando por
  // una puerta nueva: un turno vivo dado por muerto.
  //
  // El compromiso describe lo que está corriendo AHORA. Al adoptar, lo que corre es otra cosa.
  const viejo = turnoVivo(YO, { quedan: min(15), ref: 'sostener-la-base' });
  const cli = clienteFalso({ marca: viejo.marca, ahoraMs: T0, comentarioSchema: viejo.comentarioSchema });

  const r = await adquirirLock(cli, {
    dueño: YO, ttlMs: TTL_POR_DEFECTO_MS,
    tipo: 'gated', ref: 'scrum-253-adopcion',
    finPrevistoMs: T0 + min(31), señalAntesDeMs: T0 + min(41),
  });

  assert.equal(r.adoptado, true);
  const ctx = parsearContexto(cli.estado.comentarioSchema, YO);
  assert.ok(ctx, 'tras adoptar tiene que quedar un contexto legible del nuevo dueño');
  assert.equal(ctx.tipo, 'gated',
    '🔴 el contexto sigue diciendo «suelto»: describe el `turno:tomar` de antes, no la tanda que ' +
    'está corriendo. Quien mire `turno:estado` leerá lo que ya no pasa.');
  assert.equal(ctx.señalMs, T0 + min(41),
    '🔴 se HEREDÓ el compromiso viejo (15 min) en vez de sustituirlo por el de la tanda (41).\n' +
    '  Consecuencia medida: la tanda saldría VENCIDA a mitad y otra sesión la reclamaría con la\n' +
    '  razón de su parte. Es SCRUM-266 al revés — un turno vivo dado por muerto.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// LA IDENTIDAD · sesión ≠ máquina. Esto es lo que impide que 253 sea una regresión de 258
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-253 · IDENTIDAD ① dos procesos del MISMO árbol son el mismo dueño', () => {
  // Es la condición que arregla el bug: el `turno:tomar`, el runner y los hijos que el runner
  // lanza corren todos desde el mismo directorio, así que se reconocen sin exportar nada.
  const a = dueñoActual({ host: 'maquina', desde: RAIZ });
  const b = dueñoActual({ host: 'maquina', desde: path.join(RAIZ, 'tests') }); // subdirectorio

  assert.equal(a, b,
    '🔴 dos procesos del mismo árbol calculan dueños distintos. Con eso, una sesión no se ' +
    'reconoce a sí misma y vuelve el auto-bloqueo entero.');
  assert.doesNotMatch(a, new RegExp(`\\.${process.pid}$`),
    '🔴 el id vuelve a llevar el PID. El PID cambia entre los procesos de una sesión: ES el bug.');
});

test('SCRUM-253 · IDENTIDAD ② dos árboles de la MISMA máquina son dueños DISTINTOS (SCRUM-258)', () => {
  // La mitad que impide la regresión. Mismo host, distinto árbol → distinto dueño. Si esto
  // fallara, dos sesiones del mismo equipo se adoptarían el turno y las dos escribirían sobre
  // la misma base — el desastre exacto que SCRUM-188 existe para impedir.
  //
  // ⚠️ SE MONTAN DOS ÁRBOLES DE VERDAD, y no es ceremonia. La primera versión de este test
  // comparaba `RAIZ` contra `RAIZ/..`, que NO tiene `.git`: caía al fallback por PID y salía
  // verde comparando un árbol real contra la degradación. Verde por el motivo equivocado, y
  // justo en el test que sostiene el ticket. Dos árboles con su marca es lo que de verdad se
  // quiere medir.
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'yaqu-253-'));
  const arbolA = path.join(base, 'sesion-a');
  const arbolB = path.join(base, 'sesion-b');
  try {
    for (const a of [arbolA, arbolB]) {
      fs.mkdirSync(path.join(a, 'sub'), { recursive: true });
      fs.writeFileSync(path.join(a, '.git'), 'gitdir: ../fantasia\n'); // como un worktree enlazado
    }
    assert.equal(raizDeTrabajo(path.join(arbolA, 'sub')), arbolA,
      'suelo: el andamio tiene que ser un árbol reconocible, o el test no mide lo que dice');
    assert.equal(raizDeTrabajo(arbolB), arbolB);

    const mismoHost = 'DESKTOP-T5MONF5';
    const a = dueñoActual({ host: mismoHost, desde: arbolA });
    const b = dueñoActual({ host: mismoHost, desde: arbolB });

    assert.notEqual(a, b,
      '🔴 dos árboles distintos de la MISMA máquina dan el mismo dueño. Eso es SCRUM-258: la ' +
      'identidad se ha aflojado hasta ser «la máquina», y con ella el mecanismo entero.');
    assert.ok(a.startsWith(`${mismoHost}.`) && b.startsWith(`${mismoHost}.`),
      'y los dos siguen nombrando la máquina: el host se conserva para que un humano sepa dónde mirar');
    assert.doesNotMatch(a + b, new RegExp(`p${process.pid}`),
      '🔴 alguno cayó al fallback por PID: entonces no se está comparando árbol contra árbol');
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test('SCRUM-253 · IDENTIDAD ③ sin árbol identificable se degrada a NO adoptar', () => {
  // Fail-safe declarado: si no hay `.git` por encima, el token cae al PID, o sea que dos
  // procesos NO se reconocen y no se adopta nada — exactamente el comportamiento de antes de
  // este ticket. El error caro aquí es adoptar lo que no es tuyo, no dejar de adoptar lo tuyo.
  const raizVolumen = path.parse(RAIZ).root;
  assert.equal(raizDeTrabajo(raizVolumen), null, 'la raíz del volumen no puede ser un árbol de trabajo');
  assert.equal(tokenDeSesion(raizVolumen), `p${process.pid}`,
    '🔴 sin árbol, el token tiene que caer al PID. Cualquier otro valor compartido entre procesos ' +
    'haría que dos sesiones sin árbol se adoptaran entre sí.');
});

test('SCRUM-253 · `esMiTurno` no dice que sí por defecto', () => {
  const lock = { dueño: YO, desdeMs: T0, desdeIso: new Date(T0).toISOString() };
  assert.equal(esMiTurno(lock, YO), true);
  assert.equal(esMiTurno(lock, OTRO), false);
  assert.equal(esMiTurno(null, YO), false, 'sin turno no hay dueño: no es mío, y desde luego no es «sí»');
  assert.equal(esMiTurno(lock, null), false, 'sin saber quién soy, la respuesta no puede ser «mío»');
  assert.equal(esMiTurno(lock, undefined), false);
});

test('SCRUM-253 · el id se compone dentro del charset del marcador', () => {
  // El id viaja DENTRO del comentario de catálogo, así que un carácter fuera del charset
  // rompería el marcador — y el marcador es la barrera anti-producción de SCRUM-118.
  const sucio = idDeSesion("máquina de 'Ana'\\;", "ab/cd'ef");
  assert.match(sucio, /^[A-Za-z0-9._-]+$/,
    '🔴 el id admite caracteres fuera del charset seguro; el marcador se escribe interpolado en SQL');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL GUARD · la identidad se DERIVA, no se declara
// ═════════════════════════════════════════════════════════════════════════════════════════
//
// La pregunta «¿es mío?» se contestaba en CUATRO sitios y tres de ellos la contestaban leyendo
// `process.env.<esa variable>`, que el runner exportaba a sus hijos. De ahí salían los dos
// defectos: quien tomaba el turno a mano y no la exportaba se veía a sí mismo como AJENO (lo
// dejó anotado la sesión 4 en SCRUM-260), y una identidad que se DECLARA se puede AFIRMAR —
// cualquiera podía escribir el id de otra sesión y adoptar su turno vivo.
//
// El guard mira por AST y NO por texto: este fichero nombra la variable en la prosa que explica
// por qué está prohibida, y un guard de texto se caza a sí mismo ahí (ha mordido cinco veces en
// este repo). Por el mismo motivo el nombre se compone en tiempo de ejecución más abajo: escrito
// como literal, el analizador se encontraría a sí mismo.

const VETADA = ['YAQU', 'LOCK', 'DUENO'].join('_');
const CONTROL = 'DATABASE_URL_STAGING'; // una que SÍ se lee: es el suelo del analizador

function ficherosDeCodigo() {
  const salida = [];
  for (const dir of ['scripts', 'tests']) {
    const abs = path.join(RAIZ, dir);
    if (!fs.existsSync(abs)) continue;
    for (const n of fs.readdirSync(abs)) if (n.endsWith('.mjs')) salida.push(`${dir}/${n}`);
  }
  return salida.sort();
}

/** Apariciones de una variable de entorno EN CÓDIGO (lecturas y escrituras). Nunca comentarios. */
function usosDeEnv(rel, nombre) {
  const sf = ts.createSourceFile(rel, fs.readFileSync(path.join(RAIZ, rel), 'utf8'),
    ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const hallados = [];
  const visitar = (n) => {
    const linea = () => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
    if (ts.isPropertyAccessExpression(n) && n.name.text === nombre) hallados.push(linea());
    else if (ts.isStringLiteral(n) && n.text === nombre) hallados.push(linea());
    n.forEachChild(visitar);
  };
  visitar(sf);
  return hallados;
}

test('SCRUM-253 · SUELO: el analizador ve de verdad las variables de entorno del código', () => {
  const ficheros = ficherosDeCodigo();
  assert.ok(ficheros.length >= 40,
    `🔴 el barrido solo ve ${ficheros.length} ficheros de código; se midieron muchos más. Si el ` +
    'analizador no recorre nada, su «0 usos» no significa «limpio», significa «no miré».');

  const conControl = ficheros.filter((f) => usosDeEnv(f, CONTROL).length > 0);
  assert.ok(conControl.length >= 1,
    `🔴 el analizador no encuentra ni un uso de ${CONTROL}, que se lee con toda seguridad. Ha ` +
    'dejado de reconocer la forma en que se leen las envs, así que su veredicto sobre la vetada ' +
    'no vale nada.');
});

test('SCRUM-253 · nadie decide quién es el dueño del turno leyendo una variable de entorno', () => {
  const usos = ficherosDeCodigo()
    .flatMap((f) => usosDeEnv(f, VETADA).map((l) => `${f}:${l}`));

  assert.deepEqual(usos, [],
    `🔴 vuelve a haber código que nombra la variable del dueño:\n\n` +
    usos.map((u) => `      ${u}`).join('\n') + '\n\n' +
    '  Esa variable era el canal por el que la identidad se DECLARABA, y trajo dos defectos:\n' +
    '  quien tomaba el turno a mano sin exportarla se veía a sí mismo como AJENO (SCRUM-260), y\n' +
    '  cualquiera podía escribir el id de otra sesión para adoptar su turno vivo.\n\n' +
    '  El dueño se deriva con `dueñoActual()` (del árbol de trabajo) y la propiedad se responde\n' +
    '  con `esMiTurno()`. Un hecho, no una afirmación.');
});
