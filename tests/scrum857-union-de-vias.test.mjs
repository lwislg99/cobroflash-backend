// tests/scrum857-union-de-vias.test.mjs — SCRUM-857
//
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// EL GUARD NO VE EL TRABAJO QUE VIAJA EN LA RAMA DE OTRO TICKET.
//
// SCRUM-854 derivaba el ticket del NOMBRE DE LA RAMA. Dos commits de SCRUM-846 entraron dentro de
// PRs de `scrum-637-*`, que traían la entrada de la 637 → el guard decía **CUMPLE** y la entrada
// de la 846 no existió hasta seis días más tarde.
//
// Esto **amplía** SCRUM-854, no lo sustituye: sus seis controles siguen en pie y se corren igual.
//
// ── 🔴 EL CRITERIO SE ELIGIÓ DESPUÉS DE MEDIR, NO ANTES ───────────────────────────────────────
//
// Sobre 198 merges de PR (de los últimos 400 merges de `main`), «en cuántos esa vía ve un ticket
// que la rama NO ve»:
//
//   · `SCRUM-n` en CUALQUIER parte del mensaje .. 157/198 — **79,3 %** → INSERVIBLE
//   · `SCRUM-n` al INICIO del ASUNTO ............  18/198 — **9,1 %**  → el elegido
//
// La primera cuenta las menciones de pasada. Un guard que pidiera entrada de todo lo mencionado
// la pediría en 4 de cada 5 PR, y **un guard demasiado amplio acaba relajado** — ése es el riesgo
// de este ticket, no el falso negativo. El detalle y el porqué, en `_entrada-de-la-rama.mjs`.
//
// ── LOS CONTROLES ─────────────────────────────────────────────────────────────────────────────
//
//   ① 🔴 EL QUE DECIDE ..... sobre el merge REAL de la 846 en `scrum-637-*`, con los datos
//                            sacados de git: antes CUMPLE, ahora FALTA nombrando la 846.
//   ② 🔴 MUTACIÓN .......... apagada la vía nueva, vuelve el verde falso. Si no vuelve, la vía
//                            nueva no es lo que decide.
//   ③ ✅ POSITIVO .......... un PR normal sigue pasando, y las menciones de pasada NO exigen nada.
//   ④ ✅ NEGATIVO .......... lo que la 854 cerraba sigue cerrado.
//   ⑤ SUELO ................ si no encuentra los merges que examinar, CIEGO.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

import {
  veredictoDeDatos, ticketsDeLaRama, entradaDe,
  CUMPLE, FALTA, NO_SE_PUDO_DETERMINAR,
} from './_entrada-de-la-rama.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const git = (...a) => execFileSync('git', a, { cwd: RAIZ, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 });
const existe = (sha) => { try { git('cat-file', '-e', `${sha}^{commit}`); return true; } catch { return false; } };

/** Los datos REALES de un merge que ya está en `main`. Nada de esto se escribe a mano. */
function datosDelMerge(sha) {
  const asunto = git('log', '-1', '--format=%s', sha).trim();
  const m = asunto.match(/^Merge pull request #(\d+) from [^/]+\/(.+)$/);
  return {
    pr: m ? Number(m[1]) : null,
    rama: m ? m[2].trim() : null,
    asuntos: git('log', `${sha}^1..${sha}`, '--no-merges', '--format=%s').split(String.fromCharCode(10)).map((x) => x.trim()).filter(Boolean),
    ficheros: git('diff', '--name-only', `${sha}^1`, sha).split(String.fromCharCode(10)).map((x) => x.trim()).filter(Boolean),
  };
}

/** Los dos merges donde el trabajo de SCRUM-846 viajó dentro de `scrum-637-*`. */
const CASOS_846 = ['51a28288', 'd0ab360b'];

/**
 * 🔴 EL VERDE FALSO LITERAL, y existe: medidos sobre los 198 merges de PR.
 *
 * Son PRs que **traen su propia entrada** —así que el criterio de SCRUM-854 los daba por buenos—
 * y que además llevan dentro un commit cuyo asunto es de OTRO ticket, sin entrada:
 *
 *   · `b07546cf` PR#1149 `scrum-805-…` → trae `SCRUM-805.md`, y un commit es de **SCRUM-797**
 *   · `855562ac` PR#1143 `scrum-818-…` → trae `SCRUM-818.md`, y un commit es de **SCRUM-722**
 *
 * Y `docs/master/SCRUM-722.md` **no existe hoy en `main`** (medido el 15-sep-2026): el criterio
 * nuevo no destapa un caso de laboratorio, destapa un expediente que sigue faltando.
 */
const VERDES_FALSOS = [
  { sha: 'b07546cf', reclama: '797' },
  { sha: '855562ac', reclama: '722' },
];

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ⑤ SUELO — primero, porque sin él los demás no significan nada
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-857 · ⑤ SUELO: los merges medidos existen y traen datos', () => {
  const vistos = CASOS_846.filter(existe);
  assert.deepEqual(vistos, CASOS_846,
    '🔴 CIEGO: no encuentro los merges que este ticket mide. Una lista vacía y una no-medida se '
    + 'leen igual y significan lo contrario, así que esto no sigue.');

  for (const sha of CASOS_846) {
    const d = datosDelMerge(sha);
    assert.ok(d.rama, `🔴 ${sha}: no se pudo leer la rama del merge`);
    assert.ok(d.asuntos.length > 0, `🔴 ${sha}: el merge no devuelve asuntos de commit — con squash `
      + 'esta vía no existiría, y la cifra que la respalda estaría sacada del sitio equivocado');
    assert.ok(d.ficheros.length > 0, `🔴 ${sha}: el merge no devuelve ficheros`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ① EL QUE DECIDE — sobre el caso real, ejecutado
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-857 · 🔴 ① EL QUE DECIDE: el verde falso literal cae, y nombra al ticket sin entrada', () => {
  for (const { sha, reclama } of VERDES_FALSOS) {
    const d = datosDelMerge(sha);

    // Lo que decía el guard de SCRUM-854 (sólo la rama). Se EJECUTA, no se da por hecho.
    const antes = veredictoDeDatos(d, { usarAsuntos: false });
    assert.equal(antes.veredicto, CUMPLE,
      `🔴 ${sha} (PR#${d.pr}, ${d.rama}) ya no reproduce el verde falso de partida: dio `
      + `${antes.veredicto}. Si el punto de partida no es el que se midió, lo de abajo no prueba nada.`);

    // Y lo que dice ahora.
    const ahora = veredictoDeDatos(d);
    assert.equal(ahora.veredicto, FALTA,
      `🔴 EL DEFECTO DE SCRUM-857 SIGUE: ${sha} (PR#${d.pr}) trae su propia entrada y, dentro, un `
      + `commit de otro ticket sin la suya — y el guard lo da por bueno.`);
    assert.ok(ahora.faltan.includes(reclama),
      `🔴 cae, pero no por SCRUM-${reclama}: reclama ${ahora.faltan.join(', ')}.`);
    assert.ok(ahora.motivo.includes(entradaDe(reclama)),
      `🔴 el motivo no nombra el fichero que falta: «${ahora.motivo}»`);
  }
});

test('SCRUM-857 · 🔴 ①bis el caso del ticket: antes NO nombraba la 846, ahora SÍ', () => {
  // ⚠️ CORRECCIÓN DE UNA AFIRMACIÓN PROPIA, y por eso este control está escrito así.
  //
  // El informe que originó SCRUM-857 decía que sobre estos dos merges el guard «habría dicho
  // CUMPLE». **Medido ejecutándolo: no.** Decía FALTA — pero reclamando `SCRUM-637.md`, porque la
  // rama es `scrum-637-*` y ese PR tampoco traía la entrada de la 637.
  //
  // El defecto es real y el daño el mismo, pero el mecanismo es otro y hay que decirlo: **el guard
  // no se callaba, señalaba el ticket equivocado.** Quien viera aquel rojo habría añadido la
  // entrada de la 637, el guard se habría callado, y la 846 seguiría sin expediente — que es
  // exactamente lo que pasó durante seis días.
  for (const sha of CASOS_846) {
    const d = datosDelMerge(sha);
    const antes = veredictoDeDatos(d, { usarAsuntos: false });
    const ahora = veredictoDeDatos(d);

    assert.ok(!antes.faltan.includes('846'),
      `🔴 ${sha}: el criterio VIEJO ya nombraba la 846 (${antes.faltan.join(', ')}), así que este `
      + 'ticket no tendría nada que cerrar aquí. Vuelve a medir antes de seguir.');
    assert.ok(ahora.faltan.includes('846'),
      `🔴 ${sha}: el criterio NUEVO sigue sin nombrar la 846. Reclama ${ahora.faltan.join(', ')}.`);
    assert.ok(ahora.tickets.includes('846') && ahora.tickets.includes('637'),
      `🔴 ${sha}: no ve los DOS tickets con trabajo dentro: ${ahora.tickets.join(', ')}`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ② MUTACIÓN — apagar la vía nueva tiene que devolver el verde falso
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-857 · 🔴 ② MUTACIÓN: apagada la vía nueva, vuelve el verde falso', () => {
  // En los verdes falsos literales el VEREDICTO ENTERO se da la vuelta.
  for (const { sha, reclama } of VERDES_FALSOS) {
    const d = datosDelMerge(sha);
    const conVia = veredictoDeDatos(d, { usarAsuntos: true });
    const sinVia = veredictoDeDatos(d, { usarAsuntos: false });

    assert.notEqual(conVia.veredicto, sinVia.veredicto,
      `🔴 ${sha}: el veredicto NO cambia al apagar la vía de los asuntos (${conVia.veredicto} en `
      + 'los dos casos). Entonces el guard estaría pasando por otra razón y la vía nueva no es lo '
      + 'que decide: el control ① estaría verde por accidente.');
    assert.equal(sinVia.veredicto, CUMPLE, `🔴 ${sha}: apagada la vía, tiene que volver el CUMPLE`);
    assert.equal(conVia.veredicto, FALTA, `🔴 ${sha}: encendida la vía, tiene que caer`);
    assert.ok(!sinVia.faltan.includes(reclama) && conVia.faltan.includes(reclama),
      `🔴 ${sha}: SCRUM-${reclama} no aparece y desaparece con la vía — no es ella quien lo trae`);
  }

  // Y en los de la 846 no cambia el veredicto (ya era FALTA por la 637), pero SÍ cambia a quién
  // señala. Eso es lo que hay que medir aquí: la vía nueva es la que mete la 846 en la cuenta.
  for (const sha of CASOS_846) {
    const d = datosDelMerge(sha);
    const conVia = veredictoDeDatos(d, { usarAsuntos: true });
    const sinVia = veredictoDeDatos(d, { usarAsuntos: false });

    assert.ok(conVia.faltan.includes('846') && !sinVia.faltan.includes('846'),
      `🔴 ${sha}: apagar la vía nueva no quita la 846 de lo reclamado `
      + `(con=${conVia.faltan.join(',')} · sin=${sinVia.faltan.join(',')}). Si la 846 aparece con `
      + 'la vía apagada, ①bis está verde por otra razón.');
  }
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ③ POSITIVO — el riesgo real: un guard demasiado amplio acaba relajado
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-857 · ✅ ③ un PR normal sigue pasando, y una mención de pasada NO exige entrada', () => {
  // PR normal: rama con su número, commits de ese ticket, entrada traída.
  const NORMAL = {
    rama: 'scrum-857-union-de-vias',
    asuntos: ['SCRUM-857: el guard sube a la unión de vías'],
    ficheros: ['tests/_entrada-de-la-rama.mjs', 'docs/master/SCRUM-857.md'],
  };
  assert.equal(veredictoDeDatos(NORMAL).veredicto, CUMPLE,
    '🔴 un PR normal con su entrada ha dejado de pasar: el guard se ha vuelto inservible');

  // 🔴 LA MITAD QUE PROTEGE DE RELAJARLO: el cuerpo cita otros tickets y eso NO cuenta.
  // Es el caso medido del PR #1248, cuyos commits nombran 778 y 833 en el CUERPO.
  const CON_MENCIONES = {
    rama: 'scrum-857-union-de-vias',
    asuntos: [
      'SCRUM-857: el guard sube a la unión de vías',
      'SCRUM-857 (fase 2): el censo, con más población',
    ],
    ficheros: ['tests/x.mjs', 'docs/master/SCRUM-857.md'],
  };
  const v = veredictoDeDatos(CON_MENCIONES);
  assert.equal(v.veredicto, CUMPLE,
    `🔴 EL GUARD SE HA VUELTO DEMASIADO AMPLIO: pide ${v.faltan.join(', ')} en un PR que sólo `
    + 'trabaja en un ticket. Un guard que exige entradas de tickets citados de pasada lo van a '
    + 'relajar, y entonces no protege de nada.');
  assert.deepEqual(v.tickets, ['857'], `🔴 ve tickets de más: ${v.tickets.join(', ')}`);

  // Y una fase (`857b`) es del mismo ticket, no de otro.
  assert.deepEqual(
    veredictoDeDatos({ rama: 'scrum-857b-fase', asuntos: ['SCRUM-857b: la fase'], ficheros: ['src/a.ts', 'docs/master/SCRUM-857.md'] }).tickets,
    ['857'], '🔴 una fase con letra se está leyendo como un ticket distinto');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ④ NEGATIVO — lo que la 854 cerraba sigue cerrado
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-857 · ✅ ④ lo que cerraba SCRUM-854 sigue cerrado: se amplía, no se sustituye', () => {
  // El caso original de la 854: rama con número, toca código, no trae su entrada.
  assert.equal(
    veredictoDeDatos({ rama: 'scrum-848-tactil', asuntos: ['SCRUM-848: la ficha'], ficheros: ['src/app.ts'] }).veredicto,
    FALTA, '🔴 EL DEFECTO DE SCRUM-854 HA VUELTO: una rama que toca código sin su entrada pasa');

  // Sólo documentación: sigue exento.
  assert.equal(
    veredictoDeDatos({ rama: 'scrum-848-tactil', asuntos: ['SCRUM-848: doc'], ficheros: ['docs/RUNBOOKS.md'] }).veredicto,
    CUMPLE, '🔴 un PR de sólo documentación ha empezado a exigir expediente');

  // Sin ninguna vía: NO_SE_PUDO_DETERMINAR, nunca CUMPLE (la trampa de SCRUM-828).
  assert.equal(
    veredictoDeDatos({ rama: 'scrum-orquestador-prompt', asuntos: ['arregla el prompt'], ficheros: ['src/app.ts'] }).veredicto,
    NO_SE_PUDO_DETERMINAR,
    '🔴 una rama que toca código y no dice de qué ticket es ha salido por buena');

  // Y la entrada de OTRO ticket no cuenta por la propia.
  assert.equal(
    veredictoDeDatos({ rama: 'scrum-848-x', asuntos: ['SCRUM-848: y'], ficheros: ['src/a.ts', 'docs/master/SCRUM-999.md'] }).veredicto,
    FALTA, '🔴 la entrada de otro ticket se cuenta como propia');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// ⑥ Y sobre ESTA rama, con el criterio nuevo
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-857 · ⑥ el resolvedor ve TODOS los tickets con trabajo en esta rama', () => {
  const t = ticketsDeLaRama(RAIZ);
  assert.ok(t.baseResuelta, '🔴 sin base resuelta no se sabe qué aporta esta rama');
  assert.ok(Array.isArray(t.tickets), '🔴 el resolvedor no devuelve una lista');
  assert.ok(t.porVia && 'rama' in t.porVia && Array.isArray(t.porVia.asuntos),
    '🔴 el resolvedor no declara por qué vía vio cada ticket');
});
