// tests/scrum810b-los-suelos-derivados.test.mjs — SCRUM-810 (2ª vuelta)
//
// ══════════════════════════════════════════════════════════════════════════════════════════
// El MISMO trinquete, para poblaciones que no son declaraciones
// ══════════════════════════════════════════════════════════════════════════════════════════
//
// ── POR QUÉ AQUÍ Y NO DENTRO DE CADA GUARD ────────────────────────────────────────────────
// Añadir el trinquete editando los guards de otros tickets serían 15 ficheros tocados, cada uno
// con sus propios trinquetes, y cinco sesiones trabajando a la vez. Aquí se usa **la misma
// pieza** (`scripts/_suelo-contra-main.mjs`), con un REGISTRO: añadir una población es una
// entrada, y no se toca ni un guard ajeno. Dos implementaciones de la misma derivación serían
// regla 2, y dentro de seis meses una estaría rota.
//
// ── QUÉ CORRIGE ESTO DE MI PROPIA MEDIDA ANTERIOR ─────────────────────────────────────────
// En la primera vuelta dije que los otros 41 suelos eran «la enfermedad de la casa» con un 27%
// de holgura media. Medido después: **casi todos son suelos de ESCÁNER CIEGO**, y su holgura
// está puesta a propósito y escrita en su propio comentario —`public-js-parsea`: «el suelo va
// por debajo para que un borrado legítimo no lo dispare, pero no tanto como para que un
// recorrido roto —que devolvería 0 o 3— se cuele»—. El número era real; la etiqueta, no.
//
// PERO eso no los deja sin trinquete, y ahí el asesor tenía razón: **el suelo de ceguera y el
// trinquete anti-encogimiento son DOS instrumentos, y faltaba el segundo**. Aquí se añade sin
// mover ni un umbral: el número de cada guard se queda donde está, haciendo su trabajo.
//
// ── EL IMPACTO, MEDIDO ANTES DE CONECTAR ──────────────────────────────────────────────────
// Sobre las 85 ramas vivas, comparando cada una con SU base de fusión:
//     ficheros-js-de-public   0 bajan · 3 suben · 82 igual
//     entradas-de-master      0 bajan · 29 suben · 56 igual
//     scripts-del-dashboard   0 bajan · 3 suben · 82 igual
//     bocas-de-emision        NO MEDIBLE (79 de 86 ramas) -> NO se conecta
// Ni una rama legítima baja ninguna de las TRES conectadas: **no fabrica ni un rojo**.
// Y el cero está controlado — las sondas se mueven entre árboles (87→62, 436→226, 84→60 contra
// un main de mediados de agosto), así que no es un cero de no haber mirado.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url'; // NUNCA `new URL().pathname`: no decodifica (SCRUM-730)
import {
  DIRECCIONES, RAMA_DE_REFERENCIA, arbolDeLaBase,
  poblacionesContraLaBase, sueloDerivado,
} from '../scripts/_suelo-contra-main.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'scripts/_suelo-contra-main.mjs',
    a: '  if (true) return null;',
    de: '  if (!dir.viola(medida.ahora, medida.antes)) return null;',
    cae: 'perder UNO de cualquier población ya habla, y la nombra',
  },
  {
    fichero: 'scripts/_suelo-contra-main.mjs',
    a: '    viola: (ahora, antes) => ahora !== antes,',
    de: '    viola: (ahora, antes) => ahora < antes,',
    cae: 'CRECER sigue siendo gratis en la dirección no-encoger',
  },
  {
    fichero: 'scripts/_suelo-contra-main.mjs',
    a: '    viola: (ahora, antes) => false,',
    de: '    viola: (ahora, antes) => ahora > antes,',
    cae: 'un TOPE es el mismo trinquete del revés: lo que viola es CRECER',
  },
  {
    fichero: 'scripts/_suelo-contra-main.mjs',
    a: '  if (false) return null;',
    de: '  if (retiradas.some((r) => r.guard === medida.nombre)) return null;',
    cae: 'la retirada A PROPÓSITO también vale para una población',
  },
];

/**
 * EL REGISTRO. Cada población se calcula con el censo de HOY, y se corre sobre DOS árboles: el
 * de trabajo y el de la base de fusión. Añadir una es una entrada; no se toca ningún guard.
 *
 * `suelo` es el número cableado que ya existe en su guard: **no se mueve**, se anota para que se
 * vea de un vistazo cuánto se separa de la población y que sigue siendo un suelo de ceguera.
 */
export const POBLACIONES = [
  {
    nombre: 'ficheros-js-de-public',
    guard: 'public-js-parsea.test.mjs', suelo: 'SUELO_FICHEROS = 40',
    censo: (raiz) => {
      const out = [];
      const rec = (d) => {
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
          const p = path.join(d, e.name);
          if (e.isDirectory()) rec(p);
          else if (e.name.endsWith('.js')) out.push(p);
        }
      };
      rec(path.join(raiz, 'public'));
      return out.length;
    },
  },
  {
    nombre: 'entradas-de-master',
    guard: 'scrum391-guards-declarados-presentes.test.mjs', suelo: 'MINIMO_ENTRADAS = 90',
    censo: (raiz) => fs.readdirSync(path.join(raiz, 'docs/master')).filter((f) => /^SCRUM-\d+\.md$/.test(f)).length,
  },
  {
    nombre: 'scripts-del-dashboard',
    guard: 'scrum274-huella-estaticos.test.mjs', suelo: 'MINIMO_SCRIPTS = 31',
    censo: (raiz) => (fs.readFileSync(path.join(raiz, 'public/dashboard/index.html'), 'utf8')
      .match(/<script\s+[^>]*src=/gi) || []).length,
  },
  // 🔴 `bocas-de-emision` NO ESTÁ AQUÍ, y no es un olvido.
  // Su censo (`bocasDeEmision({ raiz })`, scrum778/205/206b/246) corre perfectamente sobre los dos
  // árboles —11 y 11, verificado—, pero su IMPACTO no se ha podido medir: para compararlo en las
  // 86 ramas vivas hay que materializar cada una, y extrayendo sólo `src/` el control salió
  // **«NO MIDE»** (el censo devolvió null en el propio HEAD) con **79 de 86 ramas no medibles**.
  // Un «0 bajan» sobre 7 ramas no es el cero que pide el encargo. Conectar sin esa medida sería
  // saltarse la obligación 2, así que se queda FUERA hasta que se pueda medir con el árbol
  // entero — que a 63 MB por rama son ~5 GB, y eso es otra tarea, no un descuido de ésta.
];

// 🔴 El motivo del salto va como LITERAL dentro del propio `skip`, no por variable: SCRUM-456
// exige que produzca TEXTO, porque en el log un salto mudo no se distingue de un test roto.
const BASE = arbolDeLaBase(RAIZ);

// ══ ① EL CONTROL QUE DECIDE, repetido POR POBLACIÓN ══════════════════════════════════════
// Los dos números pegados: con la población intacta CALLA, y con UNO menos HABLA. Sintético a
// propósito — mide el MECANISMO, no el árbol de hoy, que cambia cada hora.
test('perder UNO de cualquier población ya habla, y la nombra', () => {
  for (const P of [7, 40, 436]) {
    const intacta = { nombre: 'x', medible: true, antes: P, ahora: P };
    assert.equal(sueloDerivado(intacta), null, `con ${P} → ${P} tiene que CALLAR`);
    const perdida = { nombre: 'x', medible: true, antes: P, ahora: P - 1 };
    const dicho = sueloDerivado(perdida);
    assert.ok(dicho, `con ${P} → ${P - 1} tiene que HABLAR: si no, el trinquete llega tarde`);
    assert.match(dicho, new RegExp(`${P} → ${P - 1}`));
    assert.match(dicho, /«x»/, 'y tiene que NOMBRAR la población, no sólo decir que algo bajó');
  }
});

test('CRECER sigue siendo gratis en la dirección no-encoger', () => {
  assert.equal(sueloDerivado({ nombre: 'x', medible: true, antes: 40, ahora: 87 }), null,
    'añadir NO puede poner el suelo en rojo: un suelo que salta siempre se desactiva');
  assert.equal(sueloDerivado({ nombre: 'x', medible: true, antes: 40, ahora: 41 }), null);
});

test('un TOPE es el mismo trinquete del revés: lo que viola es CRECER', () => {
  const medida = { nombre: 'los-que-filtran-a-mano', medible: true, antes: 56, ahora: 57 };
  assert.equal(sueloDerivado(medida, 'no-encoger'), null, 'para un mínimo, crecer es normal');
  const dicho = sueloDerivado(medida, 'no-crecer');
  assert.ok(dicho, 'para un TOPE, crecer es la violación');
  assert.match(dicho, /HA CRECIDO/);
  assert.equal(sueloDerivado({ nombre: 'x', medible: true, antes: 56, ahora: 55 }, 'no-crecer'), null,
    'y bajar un tope es lo que se busca: no puede doler');
  assert.deepEqual(Object.keys(DIRECCIONES).sort(), ['no-crecer', 'no-encoger']);
  assert.throws(() => sueloDerivado({ nombre: 'x', medible: true, antes: 1, ahora: 9 }, 'inventada'), /desconocida/);
});

test('la retirada A PROPÓSITO también vale para una población', () => {
  const medida = { nombre: 'entradas-de-master', medible: true, antes: 436, ahora: 400 };
  assert.ok(sueloDerivado(medida), 'sin declararla, la pérdida tiene que doler');
  const conRetirada = [{ guard: 'entradas-de-master', motivo: 'se archivó el bloque viejo', fecha: '2026-09-07' }];
  assert.equal(sueloDerivado(medida, 'no-encoger', conRetirada), null,
    'una retirada declarada NO puede seguir doliendo: si duele, el suelo está mal puesto');
});

test('no haber podido medir NO es verde', () => {
  assert.equal(sueloDerivado({ nombre: 'x', medible: false, motivo: 'no miré' }), null);
  const r = poblacionesContraLaBase('revienta', () => { throw new Error('boom'); }, RAIZ);
  assert.equal(r.medible, false);
  assert.match(r.motivo, /revienta|no pude/, 'un censo que falla NO es una población de cero');
});

test('el registro está completo: cada población dice de qué guard sale', () => {
  assert.ok(POBLACIONES.length >= 3, 'el registro no puede quedarse vacío sin que nada lo diga');
  for (const p of POBLACIONES) {
    assert.ok(p.nombre && p.guard && p.suelo, `entrada incompleta: ${JSON.stringify(p.nombre)}`);
    assert.equal(typeof p.censo, 'function');
  }
  assert.equal(new Set(POBLACIONES.map((p) => p.nombre)).size, POBLACIONES.length, 'nombres repetidos');
});

// ══ ② EL CONTROL POSITIVO, sobre el árbol de verdad ══════════════════════════════════════
test('✅ CONTROL POSITIVO: con el árbol tal cual, ninguna población ha encogido', {
  skip: BASE ? false : 'no pude materializar la base de fusión con origin/main · git fetch origin main',
}, () => {
  const dichos = [];
  let medidas = 0;
  for (const p of POBLACIONES) {
    const m = poblacionesContraLaBase(p.nombre, p.censo, RAIZ);
    if (!m.medible) continue; // se cuenta abajo: cero medibles NO es verde
    medidas++;
    const d = sueloDerivado(m);
    if (d) dichos.push(d);
  }
  assert.ok(medidas > 0,
    `cero poblaciones medibles no es un cero: es no haber mirado (base ${BASE}, ref ${RAMA_DE_REFERENCIA})`);
  assert.deepEqual(dichos, [],
    `el árbol tal cual tiene que estar en verde:\n${dichos.join('\n')}`);
  assert.equal(medidas, POBLACIONES.length,
    'alguna población dejó de ser medible: eso hay que verlo, no absorberlo');
});
