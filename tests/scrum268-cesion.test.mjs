// tests/scrum268-cesion.test.mjs — SCRUM-268 · TURNO-4: ceder no es soltar.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL DEFECTO, Y PASÓ DE VERDAD
//
// El turno solo sabía decir «ocupado» y «libre». Una cola acordada entre personas —«cuando
// acabes me lo pasas»— no existía en ningún sitio que una máquina pudiera leer. Así que soltar
// abría una CARRERA, y la carrera la gana quien pregunta más veces por segundo: un bucle
// esperador se llevó el turno que otra sesión acababa de ceder a mano.
//
// Y perdió en silencio: desde fuera, «se lo llevó un `while`» no se distingue de «lo pillé yo
// primero». No hay error, no hay aviso, y la cola acordada simplemente no ocurre.
//
//     soltar = «he terminado, queda libre para quien lo pille»
//     ceder  = «he terminado y es TUYO, no de quien pase antes»
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ NO HACE FALTA UN CAMPO NUEVO EN LA MARCA, Y POR QUÉ ES IMPORTANTE QUE NO LO HAYA
//
// `RE_LOCK` está ANCLADO: un marcador que no case EXACTAMENTE se ignora y el turno se lee como
// **LIBRE**. Si la cesión llevara un campo nuevo ahí, el código anterior —y hay árboles a más de
// cien commits de `main`— vería un turno cedido como libre: sería MÁS robable que uno normal.
// Justo lo contrario de lo que este ticket necesita.
//
// Dejándolo como un `lock:<destinatario>@<ISO>` normal, el código viejo ve «tomado» y se aparta;
// el nuevo compara con `esMiTurno` y solo entra el destinatario, ADOPTÁNDOLO (SCRUM-253). El
// bucle esperador pierde por construcción, no por llegar tarde.
//
// Lo nuevo vive en el CONTEXTO, que es advisory: la etiqueta y la ventana. Si el contexto se
// pierde, queda un lock normal del destinatario — se pierde la ETIQUETA, nunca la protección.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

import {
  MARCADOR, TIPOS_EJECUCION, componerMarca, componerContexto, parsearLock, parsearContexto,
  adquirirLock, cederLock, soltarLock, debeSoltarAlTerminar, decidirVigencia,
  TTL_POR_DEFECTO_MS,
} from '../scripts/_staging-lock.mjs';

const RAIZ = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const T0 = Date.parse('2026-08-04T14:00:00.000Z');
const min = (n) => n * 60 * 1000;
const A = 'DESKTOP-T5MONF5.aaaaaaaaaa'; // quien cede
const B = 'DESKTOP-T5MONF5.bbbbbbbbbb'; // a quien se cede
const C = 'DESKTOP-T5MONF5.cccccccccc'; // el bucle esperador
const SCHEMA = 'standard public schema';

function clienteFalso({ marca, ahoraMs = T0, comentarioSchema = SCHEMA, db = 'railway' }) {
  const estado = { marca, ahoraMs, db, comentarioSchema };
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
      if (sql.includes('COMMENT ON SCHEMA')) estado.comentarioSchema = m[1];
      else estado.marca = m[1];
      return 1;
    },
    async $transaction(fn) { return fn(cli); },
  };
  return cli;
}

/** El turno de A, vivo, tal y como lo deja `turno:tomar`. */
function turnoDeA() {
  const marca = componerMarca(A, T0 - min(5));
  return {
    marca,
    comentarioSchema: `${SCHEMA} ${componerContexto({
      dueño: A, tipo: 'suelto', ref: 'scrum-268', finPrevistoMs: T0 + min(10), señalAntesDeMs: T0 + min(10),
    })}`,
  };
}

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL CASO REAL
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-268 · EL CASO REAL — el bucle esperador NO se lleva un turno recién cedido', async () => {
  // Esto es lo que pasó: A termina y le pasa el turno a B; un esperador automático estaba
  // sondeando y se lo llevó. Con `soltar` eso es inevitable — el turno queda libre y gana quien
  // pregunte antes. Con `ceder`, C se encuentra un turno que NO es suyo.
  const { marca, comentarioSchema } = turnoDeA();
  const cli = clienteFalso({ marca, comentarioSchema });

  const ced = await cederLock(cli, {
    marcaPropia: marca, dueño: A, destinatario: B, ventanaMs: min(30), ref: 'scrum-268',
  });
  assert.equal(ced.ok, true, 'suelo: la cesión tiene que haber ocurrido, o lo de abajo no mide nada');

  // …y ahora el bucle esperador, en el instante siguiente.
  const carrera = await adquirirLock(cli, {
    dueño: C, ttlMs: TTL_POR_DEFECTO_MS, tipo: 'gated', ref: 'el-bucle',
  });

  assert.equal(carrera.ok, false,
    '🔴 el esperador se llevó el turno recién cedido. Es EL defecto: una cola acordada entre\n' +
    '  personas vuelve a ser una carrera, y la gana quien programó el bucle en vez de quien\n' +
    '  tiene la tarea. Y se pierde en silencio: por fuera no se distingue de «llegué antes».');
  assert.equal(carrera.motivo, 'ocupado');
  assert.equal(parsearLock(cli.estado.marca).dueño, B, 'el turno sigue a nombre de B');
});

test('SCRUM-268 · y la contraprueba: con SOLTAR, el esperador sí se lo lleva', async () => {
  // Sin esto, el test de arriba no demuestra que la cesión sea la que protege: podría estar
  // pasando por cualquier otra razón. Aquí se ve el mecanismo VIEJO haciendo lo que hacía.
  const { marca, comentarioSchema } = turnoDeA();
  const cli = clienteFalso({ marca, comentarioSchema });

  await soltarLock(cli, { marcaPropia: marca, dueño: A });
  const carrera = await adquirirLock(cli, {
    dueño: C, ttlMs: TTL_POR_DEFECTO_MS, tipo: 'gated', ref: 'el-bucle',
  });

  assert.equal(carrera.ok, true,
    'soltar deja el turno LIBRE por definición: quien pase primero se lo lleva. Por eso hacía ' +
    'falta un verbo distinto, y no arreglar soltar.');
  assert.equal(parsearLock(cli.estado.marca).dueño, C);
});

test('SCRUM-268 · el destinatario lo RECOGE: adopta lo que le cedieron', async () => {
  const { marca, comentarioSchema } = turnoDeA();
  const cli = clienteFalso({ marca, comentarioSchema });
  await cederLock(cli, { marcaPropia: marca, dueño: A, destinatario: B, ventanaMs: min(30), ref: 'r' });

  const recogida = await adquirirLock(cli, {
    dueño: B, ttlMs: TTL_POR_DEFECTO_MS, tipo: 'gated', ref: 'lo-de-B',
    finPrevistoMs: T0 + min(31), señalAntesDeMs: T0 + min(41),
  });

  assert.equal(recogida.ok, true, '🔴 el destinatario no puede recoger lo que le cedieron');
  assert.equal(recogida.adoptado, true,
    '🔴 recoger una cesión se está contando como TOMAR un turno libre. Es una adopción: el turno ' +
    'ya estaba a su nombre (SCRUM-253).');
  assert.equal(recogida.reclamado, false, 'y desde luego no se le ha quitado a nadie');
});

test('SCRUM-268 · la cesión queda ESCRITA como tal, no disfrazada de turno normal', async () => {
  const { marca, comentarioSchema } = turnoDeA();
  const cli = clienteFalso({ marca, comentarioSchema });
  await cederLock(cli, { marcaPropia: marca, dueño: A, destinatario: B, ventanaMs: min(30), ref: 'scrum-268' });

  const ctx = parsearContexto(cli.estado.comentarioSchema, B);
  assert.ok(ctx, 'el contexto tiene que quedar legible y a nombre del destinatario');
  assert.equal(ctx.tipo, 'cedido',
    '🔴 la cesión se guarda como una ejecución normal. Entonces `estado` diría que B está\n' +
    '  corriendo algo, cuando B puede que ni sepa todavía que tiene el turno.');
  assert.ok(TIPOS_EJECUCION.includes('cedido'), 'y `cedido` es parte del vocabulario cerrado');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// SI NADIE LA RECOGE
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-268 · una cesión que nadie recoge NO bloquea staging para siempre', async () => {
  // La ventana se publica como el compromiso de SCRUM-249, así que no hace falta inventar nada:
  // pasada la ventana, `decidirVigencia` la ve VENCIDA y el turno vuelve al común.
  const { marca, comentarioSchema } = turnoDeA();
  const cli = clienteFalso({ marca, comentarioSchema });
  await cederLock(cli, { marcaPropia: marca, dueño: A, destinatario: B, ventanaMs: min(30), ref: 'r' });

  const lock = parsearLock(cli.estado.marca);
  const ctx = parsearContexto(cli.estado.comentarioSchema, B);

  // Dentro de la ventana: reservado, nadie más entra.
  assert.equal(decidirVigencia({ lock, contexto: ctx, ahoraMs: T0 + min(29) }).vigente, true,
    '🔴 la reserva se cae antes de tiempo: entonces ceder no protege nada');

  // Pasada: libre, y ANTES del TTL de 45.
  const despues = decidirVigencia({ lock, contexto: ctx, ahoraMs: T0 + min(31) });
  assert.equal(despues.vigente, false,
    '🔴 una cesión que nadie recoge sigue bloqueando. Ceder no puede ser una forma de secuestrar ' +
    'staging a nombre de alguien que no aparece.');
  assert.equal(despues.base, 'compromiso', 'y se libera por la ventana declarada, no por el TTL');
  assert.ok(min(31) < TTL_POR_DEFECTO_MS,
    'suelo de la afirmación anterior: la ventana vence ANTES que el TTL por defecto');
});

test('SCRUM-268 · si el CONTEXTO se pierde, queda un lock normal — se espera MÁS, nunca menos', async () => {
  // La degradación importante. El contexto es advisory: perderlo no puede convertir una cesión
  // en un turno libre. Lo que queda es `lock:B@ahora`, o sea un turno normal de B, y sin
  // compromiso se decide por el TTL supuesto: 45 min en vez de 30. Más tarde, nunca antes.
  const { marca, comentarioSchema } = turnoDeA();
  const cli = clienteFalso({ marca, comentarioSchema });
  await cederLock(cli, { marcaPropia: marca, dueño: A, destinatario: B, ventanaMs: min(30), ref: 'r' });

  cli.estado.comentarioSchema = SCHEMA; // el contexto se evapora

  const lock = parsearLock(cli.estado.marca);
  const sinCtx = decidirVigencia({ lock, contexto: null, ahoraMs: T0 + min(31), ttlSupuestoMs: TTL_POR_DEFECTO_MS });
  assert.equal(sinCtx.vigente, true,
    '🔴 perder el contexto libera el turno. Eso convierte un fallo de escritura advisory en una ' +
    'carrera, que es el defecto que este ticket cierra.');
  assert.equal(sinCtx.base, 'ttl-supuesto', 'y se dice que se está decidiendo por suposición');

  const carrera = await adquirirLock(cli, { dueño: C, ttlMs: TTL_POR_DEFECTO_MS, tipo: 'gated', ref: 'x' });
  assert.equal(carrera.ok, false, 'el esperador sigue sin poder entrar');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// QUIÉN PUEDE CEDER
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-268 · no se cede lo que no es tuyo, ni a uno mismo', async () => {
  const marcaDeOtro = componerMarca(C, T0 - min(5));
  const cli = clienteFalso({ marca: marcaDeOtro });

  const ajeno = await cederLock(cli, {
    marcaPropia: marcaDeOtro, dueño: A, destinatario: B, ventanaMs: min(30), ref: 'r',
  });
  assert.equal(ajeno.ok, false,
    '🔴 se ha podido ceder el turno de OTRA sesión. Ceder lo ajeno es peor que soltarlo: se lo ' +
    'entregas a alguien concreto y con la puerta cerrada para el dueño legítimo.');
  assert.equal(ajeno.motivo, 'ajeno');
  assert.equal(cli.estado.marca, marcaDeOtro, 'y el marcador ajeno no se ha tocado');

  const aMi = await cederLock(cli, { marcaPropia: marcaDeOtro, dueño: A, destinatario: A, ventanaMs: min(30) });
  assert.equal(aMi.ok, false, 'cederse a uno mismo no significa nada');
  assert.equal(aMi.motivo, 'a-mi-mismo');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// LA ASIMETRÍA DE SCRUM-258 · lo que se ADOPTÓ no se suelta
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-268 · una tanda no suelta el turno que se encontró puesto', () => {
  // Quedó declarado y sin arreglar en SCRUM-258: si tomas el turno a mano para veinte minutos y
  // lanzas una tanda por el medio, la tanda lo soltaba al acabar. Con la cesión dentro deja de
  // ser una molestia: A cede a B, B corre UNA tanda, y la tanda suelta lo que acaban de cederle
  // — la cola vuelve a ser una carrera justo después de haberla respetado. Por eso entra aquí.
  assert.equal(debeSoltarAlTerminar({ adoptado: false }), true,
    'lo que la tanda TOMÓ, la tanda lo suelta: si no, cada tanda dejaría el turno pillado');
  assert.equal(debeSoltarAlTerminar({ adoptado: true }), false,
    '🔴 la tanda suelta un turno que ya estaba puesto a nombre de esta sesión. No era suyo para ' +
    'soltarlo: se lo encontró, y quien lo tomó puede seguir teniendo trabajo.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// GUARDS · derivados del código, no de una lista
// ═════════════════════════════════════════════════════════════════════════════════════════

const ESCRITURAS = ['escribirMarca', 'fijarContexto'];
const SECCION = 'enSeccionCritica';

function ast(rel) {
  return ts.createSourceFile(rel, fs.readFileSync(path.join(RAIZ, rel), 'utf8'),
    ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}
function recorrer(n, v) { v(n); n.forEachChild((h) => recorrer(h, v)); }
function nombreLlamado(e) {
  if (ts.isIdentifier(e)) return e.text;
  if (ts.isPropertyAccessExpression(e)) return e.name.text;
  return null;
}

test('SCRUM-268 · toda escritura del turno ocurre dentro de la sección crítica', () => {
  // ESTE es el guard del ticket. Ceder es leer-decidir-escribir sobre DOS objetos (el marcador y
  // el contexto), y contra un bucle que sondea varias veces por segundo eso solo es seguro si
  // está serializado por el advisory lock. Una escritura fuera de la sección crítica devuelve la
  // carrera por la puerta de atrás: el esperador se cuela entre el «¿es mío?» y el «toma».
  //
  // Derivado: se recorre el módulo entero y se exige de CADA escritura, sin nombrar funciones.
  const sf = ast('scripts/_staging-lock.mjs');
  const fuera = [];
  let vistas = 0;

  recorrer(sf, (n) => {
    if (!ts.isCallExpression(n) || !ESCRITURAS.includes(nombreLlamado(n.expression))) return;
    vistas += 1;
    let dentro = false;
    for (let a = n.parent; a; a = a.parent) {
      // la escritura vive en el callback que `enSeccionCritica` recibe
      if (ts.isCallExpression(a) && nombreLlamado(a.expression) === SECCION) { dentro = true; break; }
      // …o dentro de la propia definición del helper
      if ((ts.isFunctionDeclaration(a) || ts.isFunctionExpression(a)) && a.name?.text === SECCION) {
        dentro = true; break;
      }
    }
    if (!dentro) fuera.push(`${nombreLlamado(n.expression)} en línea ${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1}`);
  });

  assert.ok(vistas >= 4,
    `🔴 el analizador solo ve ${vistas} escrituras del turno; hay al menos cuatro (tomar, ` +
    'refrescar, soltar, ceder). Si no las encuentra, su verde no dice nada.');
  assert.deepEqual(fuera, [],
    '🔴 hay escrituras del turno FUERA de la sección crítica:\n\n' +
    fuera.map((f) => `      ${f}`).join('\n') + '\n\n' +
    '  Sin el advisory lock, un bucle esperador se cuela entre el «¿es mío?» y el «toma», y la\n' +
    '  cesión vuelve a ser una carrera — que es exactamente lo que este ticket cierra.');
});

test('SCRUM-268 · ceder NUNCA degrada a soltar: no escribe el marcador libre', () => {
  // Si `cederLock` llegara a escribir `MARCADOR` por algún camino, la cesión se convertiría en un
  // soltar con otro nombre y el esperador ganaría igual — con la agravante de que el mensaje
  // diría «cedido». Se comprueba dentro de su cuerpo, encontrado por AST y no por líneas.
  const sf = ast('scripts/_staging-lock.mjs');
  let cuerpo = null;
  recorrer(sf, (n) => {
    if (ts.isFunctionDeclaration(n) && n.name?.text === 'cederLock') cuerpo = n;
  });
  assert.ok(cuerpo, '🔴 no se encuentra `cederLock`: el guard no está mirando lo que cree');

  const malas = [];
  recorrer(cuerpo, (n) => {
    if (!ts.isCallExpression(n) || nombreLlamado(n.expression) !== 'escribirMarca') return;
    const arg = n.arguments[1]?.getText(sf) ?? '';
    if (/\bMARCADOR\b/.test(arg)) {
      malas.push(sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1);
    }
  });
  assert.deepEqual(malas, [],
    `🔴 \`cederLock\` escribe el marcador LIBRE (línea ${malas.join(', ')}). Eso es soltar, no ` +
    'ceder: deja el turno para quien lo pille mientras el mensaje dice que se lo diste a alguien.');
});

test('SCRUM-268 · el runner consulta si debe soltar, en vez de soltar siempre', () => {
  // Sin esto, el arreglo de la asimetría se deshace con una línea y nadie se entera: la función
  // pura seguiría verde en sus tests y el runner soltaría igual.
  const sf = ast('scripts/test-staging-gated.mjs');
  let consulta = false;
  recorrer(sf, (n) => {
    if (ts.isCallExpression(n) && nombreLlamado(n.expression) === 'debeSoltarAlTerminar') consulta = true;
  });
  assert.ok(consulta,
    '🔴 el runner ya no pregunta si debe soltar. Vuelve a soltar SIEMPRE, incluido el turno que ' +
    'se encontró puesto — y con la cesión dentro, eso tira por tierra lo que acaban de cederle.');
});
