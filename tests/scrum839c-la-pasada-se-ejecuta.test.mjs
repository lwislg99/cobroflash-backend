// tests/scrum839c-la-pasada-se-ejecuta.test.mjs — SCRUM-839c
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// LA PASADA DEL VIGÍA SE EJECUTA, NO SE LEE
//
// `scripts/vigia-pasada.mjs` es la pieza que DECIDE: quién entra en la lista, si la cosa ha
// empeorado, y si se avisa a alguien o el issue se reescribe en silencio. Su propia cabecera
// dice por qué vive fuera del YAML: «aquí se puede LEER y se puede EJECUTAR en la tanda, que es
// la diferencia entre un guard y una intención».
//
// 🔴 Medido el 15-sep-2026: **nadie la ejecutaba**. Lo único que había eran dos `assert.match`
// sobre su TEXTO —que delega en el suelo, que descarta RECIEN-EMPUJADO—. Un fichero que solo se
// comprueba con regex sobre su fuente se puede romper entero sin que nada caiga: basta con que
// las palabras sigan ahí. Es el mismo defecto que SCRUM-745 persigue en los trinquetes que
// comparaban por texto y salían mudos.
//
// ── Y EL LÍMITE QUE ESTO SUJETA, que es el del encargo ──────────────────────────────────
//
// El vigía AVISA; no falla. Un PR atascado no es una avería del workflow —lo dice
// `clasificar-fallo-automerge.mjs`, que ya clasifica un conflicto como benigno, y hace bien—,
// así que poner el run en rojo por haber atascados fabricaría exactamente el falso rojo que
// SCRUM-828 vino a quitar.
//
// ⚠️ Pero la regla NO es «que no haya `::error::` en el workflow»: eso sería falso. La pasada
// SÍ tiene que fallar cuando **ella** no ha podido hacer su trabajo —su suelo no reconoce el
// cebo, o el texto a publicar despertaría a Claude—, y el paso que publica SÍ falla si la
// pasada dice que empeora y no deja aviso. Eso no es pintar de rojo un PR: es el instrumento
// declarando que no vale. La regla exacta, y la que se ejerce aquí, es:
//
//     🔒 el NÚMERO de PR atascados nunca cambia el código de salida.
//
// Cero atascados, uno o veinte: la pasada termina en 0. Lo que cambia es a quién se avisa.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { UMBRALES_HORAS } from '../scripts/vigia-atascados.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PASADA = path.join(RAIZ, 'scripts', 'vigia-pasada.mjs');

/**
 * Lo que el meta-guard de la casa (SCRUM-745) EJECUTA contra este fichero: si una de estas
 * mutaciones no lo tumba, este guard es decorativo. Las tres imitan defectos que ya han
 * ocurrido en esta familia — el falso rojo (SCRUM-828), el aviso que no sale («y nadie se
 * entera», el título de SCRUM-839) y la puerta de la mención que deja de cerrar.
 */
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'scripts/vigia-pasada.mjs',
    de: "fs.writeFileSync('veredicto.json', JSON.stringify({ ...r, atascados: filas.length }));",
    // ⚠️ UN SOLO LITERAL, sin concatenar: el lector del meta-guard (SCRUM-757/765) evalúa los
    // cuatro campos por AST y una `BinaryExpression` la denuncia como declaración ilegible —
    // que es un guard que se queda sin vigilar. Me lo cazó en la tanda; queda anotado.
    // Lo que inyecta es el FALSO ROJO de SCRUM-828: salir en 1 por haber atascados.
    a: "if (filas.length) process.exit(1);\nfs.writeFileSync('veredicto.json', JSON.stringify({ ...r, atascados: filas.length }));",
    cae: '🔴 con atascados la pasada sale en 0: el vigía AVISA, no falla',
  },
  {
    fichero: 'scripts/vigia-pasada.mjs',
    de: 'if (r.empeora) {',
    a: 'if (false) { // el aviso apagado a propósito: detectar sin avisar',
    cae: '🔴 un atasco NUEVO deja aviso, y el aviso menciona a alguien',
  },
  {
    fichero: 'scripts/vigia-pasada.mjs',
    de: 'if (!cuerpoNoDebeDespertar(b)) {',
    a: 'if (false) { // la puerta de la mención, apagada a propósito',
    cae: '🔴 pero SÍ falla cuando es ELLA la que no puede hacer su trabajo',
  },
];

const haceHoras = (h) => new Date(Date.now() - h * 3600000).toISOString();

/**
 * Un PR tal y como lo entrega `gh pr list --json …`. Por defecto, uno que el vigía SÍ mira:
 * abierto por el bot y con el auto-merge armado.
 */
function pr(numero, { horas = 200, titulo = 'un PR', autoMerge = true } = {}) {
  return {
    number: numero,
    title: titulo,
    author: { login: 'yaqu-bot[bot]' },
    isDraft: false,
    labels: [],
    autoMergeRequest: autoMerge ? { enabledAt: haceHoras(horas) } : null,
    createdAt: haceHoras(horas),
    updatedAt: haceHoras(horas),
    headRefOid: 'a'.repeat(40),
  };
}

/**
 * Corre la pasada DE VERDAD en un directorio propio, con sus ficheros de entrada.
 * Devuelve el código de salida y lo que haya dejado escrito.
 */
function correrPasada({ prs, estados, antes = [], dueno = 'lwislg99' }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vigia-839c-'));
  try {
    fs.writeFileSync(path.join(dir, 'prs.json'), JSON.stringify(prs));
    fs.writeFileSync(path.join(dir, 'estados.txt'), estados.join('\n') + '\n');
    // `reglas.json` a `null` a propósito: es el camino en el que la lista de obligatorios NO se
    // pudo leer, y la pasada tiene que seguir funcionando diciéndolo, no reventar.
    fs.writeFileSync(path.join(dir, 'reglas.json'), 'null');
    fs.mkdirSync(path.join(dir, 'checks'), { recursive: true });
    for (const p of prs) {
      fs.writeFileSync(path.join(dir, 'checks', `${p.number}.json`),
        JSON.stringify({ total_count: 0, check_runs: [] }));
    }

    let code = 0;
    let salida = '';
    try {
      salida = execFileSync(process.execPath, [PASADA], {
        cwd: dir,
        encoding: 'utf8',
        env: { ...process.env, ANTES: JSON.stringify(antes), DUENO: dueno },
        stdio: 'pipe',
      });
    } catch (e) {
      code = e.status === undefined ? 1 : e.status;
      salida = String(e.stdout || '') + String(e.stderr || '');
    }

    const leer = (f) => {
      try { return fs.readFileSync(path.join(dir, f), 'utf8'); } catch { return null; }
    };
    return {
      code,
      salida,
      cuerpo: leer('cuerpo.md'),
      aviso: leer('aviso.md'),
      veredicto: leer('veredicto.json') && JSON.parse(leer('veredicto.json')),
    };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** Un PR en conflicto, con las dos sondas de acuerdo. Es el caso del #1212. */
const enConflicto = (n, horasSinPush = 146) =>
  `${n}|DIRTY|3|${Math.round(horasSinPush * 60)}|true|0`;

// ═════════════════════════════════════════════════════════════════════════════════════════
// SUELO · si la pasada no arranca, todo lo de abajo pasaría sin medir nada
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-839c · SUELO: la pasada ARRANCA y deja su veredicto', () => {
  const r = correrPasada({ prs: [pr(1212)], estados: [enConflicto(1212)] });
  assert.equal(r.code, 0, `🔴 la pasada no arranca:\n${r.salida}`);
  assert.ok(r.veredicto, '🔴 no ha dejado veredicto.json: sin él, el workflow no puede decidir nada');
  assert.ok(r.cuerpo, '🔴 no ha dejado cuerpo.md');
});

test('SCRUM-839c · SUELO: y RECONOCE el atasco que se le pone delante', () => {
  // Un cero aquí no sería «no hay atascados», sería «no sé mirar» — y los tests de abajo
  // pasarían todos sobre una lista vacía.
  const r = correrPasada({ prs: [pr(1212)], estados: [enConflicto(1212)] });
  assert.equal(r.veredicto.atascados, 1, `🔴 no ve el atasco. Salida:\n${r.salida}`);
  assert.match(r.cuerpo, /#1212/);
  assert.match(r.cuerpo, /DIRTY/);
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL LÍMITE: el número de atascados NUNCA cambia el código de salida
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-839c · 🔴 con atascados la pasada sale en 0: el vigía AVISA, no falla', () => {
  // Es el límite que separa este vigía del falso rojo de SCRUM-828. Se ejerce ejecutando, no
  // leyendo el YAML: un `::error::` puede aparecer ahí por motivos legítimos —y de hecho hay
  // uno—, así que buscarlo en el texto daría un veredicto equivocado.
  for (const cuantos of [0, 1, 5]) {
    const prs = Array.from({ length: cuantos }, (_, i) => pr(1200 + i));
    const estados = prs.map((p) => enConflicto(p.number));
    const r = correrPasada({ prs, estados });
    assert.equal(r.code, 0,
      `🔴 la pasada sale en ${r.code} con ${cuantos} PR atascados. Un PR parado no es una avería `
      + 'del workflow: ponerlo en rojo fabrica el falso rojo que SCRUM-828 vino a quitar. '
      + `Salida:\n${r.salida}`);
    assert.equal(r.veredicto.atascados, cuantos);
  }
});

test('SCRUM-839c · 🔴 pero SÍ falla cuando es ELLA la que no puede hacer su trabajo', () => {
  // El control del de arriba, y lo que impide leerlo como «esto nunca falla». El título de un PR
  // es texto que escribe otra persona: si lleva la mención, el cuerpo despertaría a una sesión
  // que nadie llamó. Ahí la pasada TIENE que parar — eso no es pintar de rojo un PR atascado,
  // es el instrumento declarando que no puede publicar.
  const r = correrPasada({
    prs: [pr(1212, { titulo: 'arreglo pedido a @claude en el PR' })],
    estados: [enConflicto(1212)],
  });
  assert.equal(r.code, 1,
    '🔴 un cuerpo que despertaría a Claude se ha publicado igual. Esa puerta es la que impide '
    + 'que el vigía llame a una sesión que nadie pidió.');
  assert.match(r.salida, /::error::/);
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 Y QUE AVISE DE VERDAD — ejecutado, que es lo que el ticket pedía
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-839c · 🔴 un atasco NUEVO deja aviso, y el aviso menciona a alguien', () => {
  // «Escribir en un issue» y «avisar a alguien» no son lo mismo: sin la mención, el comentario
  // no le llega a nadie. Es literalmente el título del ticket, «y nadie se entera».
  const r = correrPasada({ prs: [pr(1212)], estados: [enConflicto(1212)], antes: [] });
  assert.equal(r.code, 0);
  assert.equal(r.veredicto.empeora, true);
  assert.ok(r.aviso, '🔴 empeora y no ha dejado aviso.md: nadie se entera, que es el defecto entero');
  assert.match(r.aviso, /@lwislg99/, '🔴 el aviso no menciona a nadie');
  assert.match(r.aviso, /#1212/);
});

test('SCRUM-839c · 🔴 EL CASO DEL TICKET: el mismo atasco, quieto, VUELVE a avisar al envejecer', () => {
  // El #1212 real: misma causa, mismo PR, seis días. Antes de SCRUM-839b esto se reescribía
  // «en silencio, sin notificar» para siempre.
  const previo = [{ numero: 1212, causa: 'DIRTY', umbral: 24 }];
  const r = correrPasada({ prs: [pr(1212)], estados: [enConflicto(1212, 146)], antes: previo });
  assert.equal(r.code, 0);
  assert.equal(r.veredicto.empeora, true, '🔴 un atasco que cumple 72 h tiene que volver a avisar');
  assert.ok(r.aviso, '🔴 envejece y no avisa');
  assert.match(r.aviso, /cruza \d+ h/, 'el aviso tiene que decir QUÉ umbral ha cruzado');
});

test('SCRUM-839c · 🔴 y en el MISMO umbral NO avisa: si no, el ruido lo silencia', () => {
  // El control del de arriba. El vigía corre cada tres horas: sin esto serían ocho avisos al día
  // por el mismo PR parado, y un vigía que grita se silencia el primer día.
  const previo = [{ numero: 1212, causa: 'DIRTY', umbral: 72 }];
  const r = correrPasada({ prs: [pr(1212)], estados: [enConflicto(1212, 146)], antes: previo });
  assert.equal(r.code, 0);
  assert.equal(r.veredicto.empeora, false);
  assert.equal(r.aviso, null, '🔴 ha dejado aviso sin que nada empeore: eso es el ruido');
  assert.match(r.cuerpo, /#1212/, 'pero el cuerpo se reescribe igual, con el atasco dentro');
});

test('SCRUM-839c · los umbrales del aviso son los que declara el módulo, no otros', () => {
  // Derivado, no copiado: si alguien cambia los umbrales, esto sigue hablando de los de verdad.
  const previo = [{ numero: 1212, causa: 'DIRTY', umbral: UMBRALES_HORAS[0] }];
  const r = correrPasada({
    prs: [pr(1212)], estados: [enConflicto(1212, UMBRALES_HORAS[1] + 1)], antes: previo,
  });
  assert.equal(r.veredicto.empeora, true);
  assert.deepEqual(r.veredicto.envejecidos.map((e) => e.numero), [1212]);
});

test('SCRUM-839c · un PR que NO es asunto suyo se descarta DICIENDO por qué', () => {
  // Y sale en el cuerpo: callar un descarte y no tener nada que descartar se leen igual.
  const humano = { ...pr(999, { autoMerge: false }), author: { login: 'Javierpf28' } };
  const r = correrPasada({ prs: [humano], estados: [`999|CLEAN|3|60|false|0`] });
  assert.equal(r.code, 0);
  assert.equal(r.veredicto.atascados, 0);
  assert.match(r.cuerpo, /#999/, '🔴 el descarte no aparece: un descarte callado no se audita');
  assert.match(r.cuerpo, /backlog, no atasco/);
});

test('SCRUM-839c · 🔴 CERO atascados se declara MEDIDO, no a secas', () => {
  const r = correrPasada({ prs: [], estados: [] });
  assert.equal(r.code, 0);
  assert.equal(r.veredicto.atascados, 0);
  assert.match(r.cuerpo, /cero MEDIDO/,
    '🔴 un cero sin decir que el suelo dio OK no se distingue de un instrumento ciego');
});
