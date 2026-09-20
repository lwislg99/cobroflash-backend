// SCRUM-804h · UNA FASE `<letra><número>` (`scrum-915e1-…`) ES DEL TICKET 915. No se pierde.
//
// Sin gate: `agruparRamas` y `numeroDeRama` con poblaciones fabricadas, más los refs que `git` ya
// tiene en local. Ni BD, ni red, ni `dist/`.
//
// ── EL DEFECTO, medido el 20-sep-2026 sobre c5d642fe ────────────────────────────────────────
//
// `main` salió ROJO en su check obligatorio —«build + tests (con banco desechable)», run
// 35533496437— por «SCRUM-804 · 🔴 SUELO: el censo cuadra rama a rama con lo que `git` lista»:
//
//     soloEnGit: [ 'scrum-915e1-documento-vivo' ]
//
// Con la puerta de `main` cerrada NO MERGEA NADIE: ese día había seis PR esperando. La rama es
// legítima —sale de partir SCRUM-915 en siete cortes— y el remoto ya tenía DOS con esa forma
// (`scrum-915e1-documento-vivo` y `scrum-915e2-ver-documento`).
//
// La causa, ejecutada sobre el patrón vigente y no leída:
//
//     /^scrum-0*(\d+)[a-z]?(?:-|$)/   sobre 'scrum-915e1-documento-vivo'  →  null
//
// La letra de fase era UN SOLO carácter. `915e1` es fase `e`, corte `1`: tras la letra viene un
// dígito, y ahí el patrón pedía ya el `-`. La rama cae en `sinNumero`, el censo no la ve, el suelo
// de SCRUM-804 compara dos poblaciones distintas y cierra la puerta.
//
// ── ES EL MISMO BORDE QUE 804f, Y POR ESO SE CIERRA IGUAL ───────────────────────────────────
//
// SCRUM-804f cerró exactamente este modo de fallo el 17-sep con `scrum-904` (rama sin slug), en
// esta misma línea, y dejó escrito por qué no se arregla renombrando la rama: «si la rama se
// renombra, el rojo se va solo; la SIGUIENTE rama sin slug lo volvería a traer. Esto lo cierra en
// la regla, no en la rama». Vale palabra por palabra aquí: ya hay dos ramas `e<n>` y la partición
// aprobada tiene siete cortes.
//
// ── POR QUÉ `[a-z]?\d*` Y NO `[a-z]+` ───────────────────────────────────────────────────────
//
// `[a-z]+` habría valido para `915e1` y habría ROTO una decisión escrita: 804f exige
// `scrum-72bb → null` («dos letras no son una fase»). Ensanchar la letra para arreglar los
// dígitos es relajar algo que nadie pidió relajar. `[a-z]?\d*` cubre la forma observada —letra,
// luego dígitos— y deja intacta cada una de las cuatro afirmaciones de identidad de 804f.
//
// ── 🔴 POR QUÉ ESTO NO RE-REPARTE EL TRABAJO DE NADIE, y se puede demostrar sin censar ──────
//
// El grupo 1 no se mueve NUNCA: `0*` come los ceros y `\d+` es voraz, así que se lleva la tirada
// entera de dígitos. Y no hay backtracking que lo cambie: partir la tirada dejaría al `\d*` de
// nuevo delante de un DÍGITO, que no es `-` ni fin, así que la única partición que puede casar es
// la entera. Ensanchar el sufijo sólo puede convertir un `null` en ESE MISMO número — nunca un
// número en otro. El último control lo mide igualmente sobre los refs de hoy, porque una
// demostración que no se ejercita es una opinión con forma de demostración.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { agruparRamas } from '../scripts/_censo-reparto.mjs';
import { numeroDeRama } from '../scripts/_numero-de-rama.mjs';

const RAIZ = path.join(import.meta.dirname, '..');
const FUENTE_DE_LA_REGLA = path.join(RAIZ, 'scripts', '_numero-de-rama.mjs');

test('SCRUM-804h · 🔴 una fase `scrum-<n><letra><dígito>` se agrupa bajo SU ticket, no se pierde', () => {
  const agrupadas = agruparRamas([
    'aaa\trefs/heads/scrum-915e1-documento-vivo',
    'bbb\trefs/heads/scrum-915e2-ver-documento',
    'ccc\trefs/heads/scrum-300-con-slug',
    'ddd\trefs/heads/scrum-915e1',
  ], () => false);

  // SUELO: la rama con slug de toda la vida se agrupa como siempre. Sin esto, lo de abajo podría
  // estar verde porque el agrupador no agrupa nada.
  assert.deepEqual(agrupadas.porTicket.get(300)?.map((r) => r.nombre), ['scrum-300-con-slug'],
    '🔴 NO PUDE MIRAR: ni siquiera la rama con slug se agrupa');

  assert.deepEqual(agrupadas.porTicket.get(915)?.map((r) => r.nombre),
    ['scrum-915e1-documento-vivo', 'scrum-915e2-ver-documento', 'scrum-915e1'],
    '🔴 las fases `e1`/`e2` no están bajo SCRUM-915: el censo no las ve, el suelo de SCRUM-804 '
    + 'compara dos poblaciones distintas y la puerta obligatoria de `main` se cierra para TODOS');
  assert.deepEqual(agrupadas.sinNumero, [],
    '🔴 hay ramas de ticket en «sin número»: se están perdiendo del censo');

  // Y el dato suelto, que es el que mide el instrumento y no el agrupador.
  assert.equal(numeroDeRama('scrum-915e1-documento-vivo'), 915);
  assert.equal(numeroDeRama('scrum-915e2-ver-documento'), 915);
  assert.equal(numeroDeRama('scrum-915e1'), 915, '🔴 el fin de nombre también delimita (SCRUM-804f)');
  assert.equal(numeroDeRama('scrum-915e12-siete-cortes'), 915, '🔴 el corte puede tener dos dígitos');
});

test('SCRUM-804h · ⛔ LA IDENTIDAD NO SE AFLOJA: las cuatro de 804f siguen en pie, y las nuevas', () => {
  // Las de 804f, copiadas A PROPÓSITO. Si el ensanche hubiera tocado cualquiera de ellas, este
  // fichero caería junto al suyo en vez de dejar que se descubra en otro PR.
  assert.equal(numeroDeRama('scrum-72'), 72);
  assert.equal(numeroDeRama('scrum-727'), 727, '🔴 `scrum-727` se está leyendo como 72');
  assert.equal(numeroDeRama('scrum-727-x'), 727);
  assert.equal(numeroDeRama('scrum-72b'), 72, 'la letra de fase es del mismo ticket');
  assert.equal(numeroDeRama('scrum-72bb'), null, '🔴 DOS LETRAS SIGUEN SIN SER UNA FASE (804f)');
  assert.equal(numeroDeRama('scrum-72.1'), null, '🔴 un punto tras el número no es un delimitador');
  assert.equal(numeroDeRama('feature/scrum-72'), null, '🔴 ha dejado de estar anclada al principio');
  assert.equal(numeroDeRama('revert-1192-scrum-824b'), null, '🔴 un revert vuelve a atribuirse al ticket (SCRUM-829)');

  // Y el borde que estrena este ticket: la forma es LETRA y luego DÍGITOS, no una alternancia.
  assert.equal(numeroDeRama('scrum-915e1b-x'), null, '🔴 una letra DESPUÉS de los dígitos del corte no es una fase');
  assert.equal(numeroDeRama('scrum-915e1.2-x'), null, '🔴 un punto dentro del corte no es un delimitador');
  assert.equal(numeroDeRama('scrum-9151-x'), 9151, '🔴 `scrum-9151` es el ticket 9151, no el 915 con corte 1');
});

test('SCRUM-804h · ⛔ LAS FORMAS DECLARADAS EN EL FICHERO SE CUMPLEN, UNA A UNA', () => {
  // La segunda mitad del encargo del orquestador (20-sep): el fichero DECLARA qué formas de nombre
  // reconoce, en vez de irlas descubriendo a golpes de `main` bloqueado. Para que esa lista sea un
  // mecanismo y no una decoración, se lee DESDE AQUÍ y se ejercita línea a línea: si alguien añade
  // una forma que la regla no cumple, o cambia la regla y deja la lista atrás, esto cae.
  const fuente = fs.readFileSync(FUENTE_DE_LA_REGLA, 'utf8');
  const bloque = /^\/\/\s+FORMAS:$([\s\S]*?)^\/\/\s+:FIN$/m.exec(fuente);
  assert.ok(bloque,
    '🔴 NO PUDE MIRAR: no encuentro el bloque `FORMAS:` … `:FIN` en scripts/_numero-de-rama.mjs. '
    + 'O se ha borrado la declaración, o se le han cambiado las marcas y esto dejó de leerla.');

  const declaradas = [];
  for (const linea of bloque[1].split('\n')) {
    const m = /^\/\/\s+(\S+)\s+→\s+(\d+|null)\b/.exec(linea);
    if (m) declaradas.push({ nombre: m[1], espera: m[2] === 'null' ? null : Number(m[2]) });
  }

  // ④ SUELO: un bloque que se lee y del que no sale ninguna línea saldría verde por no medir nada.
  // El número no es un umbral escrito a ojo: es «las que hay», y se exige que haya de las DOS
  // clases, porque una lista de puros `null` comprobaría sólo que la regla sabe decir que no.
  assert.ok(declaradas.length >= 8,
    `🔴 NO PUDE MIRAR: del bloque de formas sólo he sabido leer ${declaradas.length} líneas. `
    + 'El formato es `//   <ejemplo> → <número|null>   <motivo>`.');
  assert.ok(declaradas.some((d) => d.espera !== null) && declaradas.some((d) => d.espera === null),
    '🔴 la lista declarada no tiene las dos clases: sin alguna que dé número y alguna que dé null, '
    + 'no comprueba que la regla DISTINGA, sólo que sabe contestar una cosa.');

  const incumplidas = declaradas
    .filter((d) => numeroDeRama(d.nombre) !== d.espera)
    .map((d) => `${d.nombre}: declarado ${d.espera}, la regla da ${numeroDeRama(d.nombre)}`);
  assert.deepEqual(incumplidas, [],
    '🔴 el fichero declara formas que su propia regla NO cumple:\n   · ' + incumplidas.join('\n   · '));
});

test('SCRUM-804h · ✅ EL CONTROL QUE DECIDE: sobre los refs de HOY, quien ya casaba da el MISMO número', () => {
  // La regla ANTERIOR, escrita aquí como referencia de lo retirado (no se usa en ningún otro
  // sitio). Lo que mide este control es que el ensanche no mueva de ticket a NADIE que ya tuviera
  // uno — que es la única forma en que un cambio así repartiría mal el trabajo de alguien.
  const anterior = (s) => { const m = /^scrum-0*(\d+)[a-z]?(?:-|$)/.exec(String(s).trim()); return m ? Number(m[1]) : null; };
  const nombres = [...new Set(
    execFileSync('git', ['for-each-ref', '--format=%(refname:short)', 'refs/remotes/origin/', 'refs/heads/'],
      { cwd: RAIZ, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
      .split('\n').map((l) => l.trim().replace(/^origin\//, '')).filter(Boolean),
  )];

  // ④ SUELO: cero refs no es «no se ha movido nadie», es que no he podido mirar. Y cero refs que
  // casaran ANTES tampoco: comparar dos vacíos siempre sale verde.
  const yaCasaban = nombres.filter((n) => anterior(n) !== null);
  assert.ok(yaCasaban.length > 0,
    '🔴 NO PUDE MIRAR: `git for-each-ref` no trae ninguna rama que la regla anterior reconociera. '
    + 'Sin población, «nadie se ha movido» es cierto por no haber mirado.');

  const reatribuidas = yaCasaban.filter((n) => numeroDeRama(n) !== anterior(n));
  assert.deepEqual(reatribuidas, [],
    '🔴 el ensanche ha RE-ATRIBUIDO ramas que ya tenían ticket, y eso reparte mal el trabajo:\n   · '
    + reatribuidas.map((n) => `${n}: ${anterior(n)} → ${numeroDeRama(n)}`).join('\n   · '));

  // Y el otro lado de la moneda, que es el motivo del ticket: alguien tiene que haber sido
  // RESCATADO. Si no, este cambio no arregla nada y el rojo de `main` sigue ahí.
  const rescatadas = nombres.filter((n) => anterior(n) === null && numeroDeRama(n) !== null);
  assert.ok(rescatadas.length > 0,
    '🔴 NINGUNA rama pasa de «sin número» a tener ticket. O el remoto ya no tiene ramas `e<n>` '
    + '—y entonces este control ha dejado de medir sobre población— o el ensanche no hace nada.');
  assert.deepEqual(rescatadas.filter((n) => !/^scrum-\d+[a-z]\d+(?:-|$)/i.test(n)), [],
    '🔴 se ha rescatado algo que NO tiene la forma `scrum-<n><letra><dígitos>`: el ensanche está '
    + 'cogiendo más de lo que este ticket midió');
});
