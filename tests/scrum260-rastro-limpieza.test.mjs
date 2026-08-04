// tests/scrum260-rastro-limpieza.test.mjs — SCRUM-260
//
// La CONSTANCIA de clean-staging: cuando barre merchants @test.local vivos, deja un rastro que
// responde «¿se ejecutó una limpieza durante MI tanda?». Se prueba SIN BD ni turno: la lógica es
// pura y el IO se inyecta (misma doctrina que _staging-lock.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { leerFuente } from './_guard-texto.mjs';
import {
  componerEntrada, parsearHistorial, añadirEntrada, registrar, mensajeAviso, MAX_ENTRADAS,
  estadoDelTurno, decidirBorrado, BANDERA_PISAR,
} from '../scripts/_rastro-limpieza.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const datos = {
  ranAt: '2026-08-02T10:00:00.000Z',
  turnMarker: 'YAQU_STAGING lock:host.111@2026-08-02T09:00:00.000Z',
  applied: true,
  merchantsCount: 2,
  merchantEmails: ['qa-s23-1@test.local', 'qa-s23-2@test.local'],
  jobsCount: 3,
};

// ─── R3 · los cinco campos, y turnMarker null → «NO CONSTA» explícito ───────────────────────────
test('SCRUM-260 · componerEntrada lleva los cinco campos', () => {
  const e = componerEntrada(datos);
  process.stdout.write(`  entrada → ${e}\n`);
  assert.match(e, /2026-08-02T10:00:00\.000Z/);           // ranAt
  assert.match(e, /turno=YAQU_STAGING/);                  // turnMarker
  assert.match(e, /applied=SI/);                          // applied
  assert.match(e, /merchants=2\[qa-s23-1@test\.local,qa-s23-2@test\.local\]/); // count + cuáles
  assert.match(e, /jobs=3/);                              // jobsCount
});

test('SCRUM-260 · turnMarker ausente → NO-CONSTA explícito, nunca vacío', () => {
  const e = componerEntrada({ ...datos, turnMarker: null });
  assert.match(e, /turno=NO-CONSTA/);
  assert.doesNotMatch(e, /turno=\s*\|/); // el token NO-CONSTA existe en positivo arriba → respaldado
});

// ─── R2 · rolling de N, y el descarte SE VE (contador) ──────────────────────────────────────────
test('SCRUM-260 · añadirEntrada apila la más nueva primero y sube total', () => {
  let c = null;
  c = añadirEntrada(c, 'E1');
  c = añadirEntrada(c, 'E2');
  const h = parsearHistorial(c);
  assert.equal(h.total, 2, 'total cuenta TODAS las pasadas, no solo las guardadas');
  assert.deepEqual(h.entradas, ['E2', 'E1'], 'la más nueva va primero');
  assert.equal(h.descartadas, 0);
});

test('SCRUM-260 · cuando se llena, la vieja se pierde pero el descarte QUEDA VISIBLE', () => {
  let c = null;
  for (let i = 1; i <= MAX_ENTRADAS + 3; i++) c = añadirEntrada(c, `E${i}`);
  const h = parsearHistorial(c);
  assert.equal(h.entradas.length, MAX_ENTRADAS, 'nunca guarda más de MAX_ENTRADAS');
  assert.equal(h.total, MAX_ENTRADAS + 3, 'total refleja TODAS las pasadas');
  assert.equal(h.descartadas, 3, 'las 3 que se cayeron se CUENTAN — un log que descarta en silencio es un verde hueco');
  assert.equal(h.entradas[0], `E${MAX_ENTRADAS + 3}`, 'la más nueva sobrevive');
  assert.ok(!h.entradas.includes('E1'), 'la más vieja se fue');
});

// ─── El corazón (rojo-primero): el rastro NO está antes de escribirse, y SÍ después ──────────────
function ioEnMemoria() {
  let store = null;
  return { leer: async () => store, escribir: async (t) => { store = t; }, ver: () => store };
}

test('SCRUM-260 · ROJO→VERDE: el store está VACÍO antes de registrar y contiene la entrada después', async () => {
  const io = ioEnMemoria();
  assert.equal(io.ver(), null, 'ANTES de registrar no hay rastro (el estado que arreglamos)');
  const res = await registrar(io, datos);
  assert.equal(res.ok, true);
  const despues = io.ver();
  assert.notEqual(despues, null, 'DESPUÉS de registrar el rastro existe');
  assert.match(despues, /merchants=2\[qa-s23-1@test\.local/, 'y lleva lo que se barrió');
  process.stdout.write(`  store tras registrar → ${despues}\n`);
});

// ─── R5 · best-effort: nada de esto puede lanzar hacia el script ────────────────────────────────
test('SCRUM-260 · formato roto → historial fresco, sin lanzar', () => {
  for (const basura of [null, undefined, '', 'ruido sin cabecera', 'YAQU_RASTRO_LIMPIEZA roto']) {
    const h = parsearHistorial(basura);
    assert.equal(h.total, 0);
    assert.deepEqual(h.entradas, []);
  }
});

test('SCRUM-260 · si el IO de escritura LANZA, registrar degrada a {ok:false} y NO propaga', async () => {
  const io = { leer: async () => null, escribir: async () => { throw new Error('BD caída'); } };
  const res = await registrar(io, datos); // no debe lanzar
  assert.equal(res.ok, false);
  assert.match(res.motivo, /BD caída/);
});

test('SCRUM-260 · si el IO de LECTURA lanza, se degrada a historial vacío y aun así escribe', async () => {
  let escrito = null;
  const io = { leer: async () => { throw new Error('lectura caída'); }, escribir: async (t) => { escrito = t; } };
  const res = await registrar(io, datos);
  assert.equal(res.ok, true, 'una lectura caída no impide dejar constancia de ESTA pasada');
  assert.match(escrito, /total=1/);
});

// ─── R4 + R6 · estructura de clean-staging: escribir ANTES de borrar; solo imports read-only ─────
test('SCRUM-260 · clean-staging registra el rastro ANTES del bucle de deletes (R4)', () => {
  const src = leerFuente(path.join(RAIZ, 'scripts', 'clean-staging-tests.mjs'));
  const iReg = src.search(/registrar\s*\(/);
  const iDel = src.search(/deleteMany\s*\(/);
  assert.ok(iReg !== -1, 'clean-staging debe llamar a registrar()');
  assert.ok(iDel !== -1, 'clean-staging borra con deleteMany()');
  assert.ok(iReg < iDel, '🔴 el rastro debe escribirse ANTES del primer deleteMany — si un borrado revienta a mitad, la fila ya está a salvo');
});

test('SCRUM-260 · clean-staging lee el marcador SOLO con funciones read-only, sin tocar los ficheros en disputa (R6)', () => {
  const src = leerFuente(path.join(RAIZ, 'scripts', 'clean-staging-tests.mjs'));
  assert.match(src, /import\s*\{[^}]*leerMarcaCruda[^}]*\}\s*from\s*['"]\.\/_staging-lock\.mjs['"]/,
    'el marcador se lee con leerMarcaCruda de _staging-lock.mjs (read-only)');
  assert.match(src, /import\s*\{[^}]*parsearLock[^}]*\}\s*from\s*['"]\.\/_staging-lock\.mjs['"]/,
    'el owner del turno para el aviso sale de parsearLock (read-only)');
  assert.doesNotMatch(src, /from\s*['"]\.\/turno-staging\.mjs['"]/,
    'NO importa turno-staging.mjs — ahí chocan 253 y 258');
});

// ─── AVISO (avisa, NO bloquea): las DOS señales antes de barrer ──────────────────────────────────
test('SCRUM-260 · mensajeAviso lleva el turno vigente Y el nº de @test.local vivos', () => {
  const m = mensajeAviso({ dueñoTurno: 'host.111', merchantsVivos: 7 });
  process.stdout.write(`  aviso →\n${m}\n`);
  // SCRUM-260 (2ª mitad): el aviso YA NO puede prometer «no bloquea» — con turno ajeno vivo, el
  // script se planta. Un texto que describe el comportamiento viejo es peor que ninguno, porque
  // el siguiente se lo cree; y aquí lo leería justo el operador al que sí se le va a bloquear.
  assert.doesNotMatch(m, /no bloquea/i,
    '🔴 el aviso sigue prometiendo que no bloquea, y con turno ajeno vivo ahora bloquea');
  assert.match(m, /Turno de staging vigente: host\.111/);
  assert.match(m, /VIVOS que se barrerán: 7/); // el dato que el turno NO ve (gateado suelto)
  assert.match(m, /SIN turno/); // dice explícito que un gateado suelto no toma turno
});

test('SCRUM-260 · mensajeAviso sin turno → NO CONSTA / libre, pero el CONTEO sigue siendo la señal', () => {
  const m = mensajeAviso({ dueñoTurno: null, merchantsVivos: 3 });
  assert.match(m, /Turno de staging vigente: NO CONSTA \/ libre/);
  assert.match(m, /VIVOS que se barrerán: 3/); // sin turno, el conteo es LA señal que queda
});

test('SCRUM-260 · clean-staging imprime el AVISO ANTES del bucle de deletes', () => {
  const src = leerFuente(path.join(RAIZ, 'scripts', 'clean-staging-tests.mjs'));
  const iAviso = src.search(/mensajeAviso\s*\(/);
  const iDel = src.search(/deleteMany\s*\(/);
  assert.ok(iAviso !== -1, 'clean-staging debe imprimir el aviso con mensajeAviso()');
  assert.ok(iAviso < iDel, '🔴 el aviso debe salir ANTES del primer deleteMany');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// LA DECISIÓN · con turno AJENO vivo no se borra sin la bandera (SCRUM-260, 2ª mitad)
//
// LOS TRES CASOS, y el motivo de que sean tres: probar solo el que bloquea no demuestra que no
// se bloquee TODO. Una herramienta manual que se planta cuando no toca se acaba puenteando, y
// entonces deja de proteger también cuando sí tocaba.
// ═════════════════════════════════════════════════════════════════════════════════════════

const LOCK_AJENO = { dueño: 'otra-maquina.4242', desdeMs: 0 };
const vivo = (extra = {}) => ({ lecturaOk: true, marca: 'YAQU_STAGING lock:otra-maquina.4242@…', lock: LOCK_AJENO, vigente: true, ...extra });

test('SCRUM-260 · (1) turno AJENO vivo y SIN bandera → NO se borra nada', () => {
  const estado = estadoDelTurno({ ...vivo(), dueñoPropio: null });
  assert.equal(estado, 'ajeno');

  const d = decidirBorrado({ estado, pisar: false, dueñoTurno: LOCK_AJENO.dueño });
  assert.equal(
    d.borra, false,
    '🔴 SE BORRA CON UNA TANDA AJENA VIVA. Esos @test.local pueden ser sus fixtures, y borrarlas ' +
    'le deja un rojo que parecerá un defecto suyo — que es el caso que abrió SCRUM-259.',
  );
  assert.match(d.mensaje, /NO se ha borrado nada/);
  assert.match(d.mensaje, new RegExp(BANDERA_PISAR), 'el mensaje tiene que decir CÓMO seguir');
  assert.match(d.mensaje, /otra-maquina\.4242/, 'y de quién es el turno que lo frena');
});

test('SCRUM-260 · (2) CONTROL: turno ajeno vivo y CON bandera → sí borra', () => {
  const estado = estadoDelTurno({ ...vivo(), dueñoPropio: null });
  const d = decidirBorrado({ estado, pisar: true, dueñoTurno: LOCK_AJENO.dueño });
  assert.equal(d.borra, true, '🔴 la bandera no sirve de nada: entonces esto no es un freno, es un muro');
  assert.match(d.motivo, new RegExp(BANDERA_PISAR));
});

test('SCRUM-260 · (3) CONTROL: sin turno ajeno, se borra como siempre', () => {
  // Las tres formas de «no hay turno ajeno vivo», porque bloquear cualquiera de ellas sería
  // convertir la herramienta en inútil justo cuando el operador tiene razón.
  const casos = [
    ['libre  (no hay marcador)', { lecturaOk: true, marca: null, lock: null, vigente: false, dueñoPropio: null }],
    ['propio (YAQU_LOCK_DUENO casa)', { ...vivo(), dueñoPropio: 'otra-maquina.4242' }],
    ['caducado (reclamable por contrato)', { ...vivo({ vigente: false }), dueñoPropio: null }],
  ];
  for (const [nombre, entrada] of casos) {
    const estado = estadoDelTurno(entrada);
    const d = decidirBorrado({ estado, pisar: false });
    assert.equal(d.borra, true, `🔴 se bloquea con el turno ${nombre}: eso NO es lo que pide el enunciado`);
  }
  assert.equal(estadoDelTurno({ ...vivo(), dueñoPropio: 'otra-maquina.4242' }), 'propio');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL SUELO · no poder leer el turno NO es «no hay turno»
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-260 · SUELO: si el marcador no se puede LEER, no se degrada a «vía libre»', () => {
  const estado = estadoDelTurno({ lecturaOk: false, marca: null, lock: null, vigente: false, dueñoPropio: null });
  assert.equal(estado, 'ilegible', '🔴 una lectura caída se está leyendo como «no hay turno»');
  const d = decidirBorrado({ estado, pisar: false });
  assert.equal(
    d.borra, false,
    '🔴 SE BORRA SIN SABER SI HAY TANDA VIVA. Es el fallo mudo de este ticket con otra cara: no ' +
    'poder leer el turno tiene que ser ruidoso, no permisivo.',
  );
  assert.match(d.mensaje, /NO SE PUDO LEER/);
});

test('SCRUM-260 · SUELO: un marcador que existe pero NO se parsea tampoco es «vía libre»', () => {
  // El caso del formato cambiado: hay marca, `parsearLock` devuelve null. Sabemos que HAY algo
  // escrito y no sabemos de quién — que es el peor sitio para dar por hecho que no es de nadie.
  const estado = estadoDelTurno({ lecturaOk: true, marca: 'FORMATO_NUEVO_QUE_NO_CASA', lock: null, vigente: false, dueñoPropio: null });
  assert.equal(estado, 'ilegible', '🔴 marca ilegible tratada como turno libre');
  assert.equal(decidirBorrado({ estado, pisar: false }).borra, false);
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// Y QUE EL SCRIPT LA OBEDEZCA: la decisión va ANTES del primer borrado
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-260 · clean-staging decide ANTES de borrar, y sale sin tocar nada si no procede', () => {
  // Sin esto, los tests de arriba probarían una función que el script podría no estar mirando.
  const src = leerFuente(path.join(RAIZ, 'scripts', 'clean-staging-tests.mjs'));
  const iDecide = src.search(/decidirBorrado\s*\(/);
  const iSalida = src.search(/if\s*\(!\s*\w+\.borra\s*\)/);
  const iDel = src.search(/deleteMany\s*\(/);

  assert.ok(iDecide !== -1, '🔴 clean-staging no llama a decidirBorrado(): la decisión no está cableada');
  assert.ok(iSalida !== -1, '🔴 no hay salida temprana cuando la decisión dice que no se borra');
  assert.ok(iDecide < iSalida && iSalida < iDel,
    '🔴 el orden está mal: decidir → salir → borrar. Si la salida queda después del primer ' +
    'deleteMany, la decisión llega tarde y no protege nada.');
});

test('SCRUM-260 · un --apply RECHAZADO consta como rechazado, ni SI ni dry-run', () => {
  // Si constara «SI», el rastro afirmaría un borrado que no ocurrió. Si constara «dry-run», sería
  // indistinguible de una pasada de prueba — y «¿alguien INTENTÓ limpiar durante mi tanda?» es la
  // pregunta que este rastro existe para responder.
  const e = componerEntrada({ ...datos, applied: 'RECHAZADO-turno-ajeno-vivo' });
  assert.match(e, /applied=RECHAZADO-turno-ajeno-vivo/);
  assert.doesNotMatch(e, /applied=SI/);
  // Y los dos valores de siempre siguen igual (control de no-regresión del formato).
  assert.match(componerEntrada({ ...datos, applied: true }), /applied=SI/);
  assert.match(componerEntrada({ ...datos, applied: false }), /applied=dry-run/);
});
