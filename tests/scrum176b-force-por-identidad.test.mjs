// SCRUM-176b · LA REGLA DE `--force` COMPARABA POR SUBCADENA, Y ÉSA ES LA SEXTA VEZ ESTA SEMANA.
//
// El patrón era  /(^|[^A-Za-z-])--force(-with-lease)?\b/  . El lado izquierdo estaba bien anclado.
// El derecho no: `\b` entre la `e` de `--force` y el guion de `-device` **existe** (una es letra y
// el otro no), así que `--force-device-scale-factor` —una bandera de calibrado de Chrome, que no
// borra nada de nadie— salía BLOQUEADA como si fuera `git push --force`.
//
// 🔒 POR QUÉ ESTO IMPORTA MÁS QUE LA MOLESTIA. Este guard es el que impide reescribir historia
// (AA2). Un guard de seguridad con falso positivo es un guard que alguien acaba desactivando, y
// el día que se apague por molesto se apaga TAMBIÉN lo que sí protegía. El propio fichero ya lo
// tenía escrito para la familia de SCRUM-454: «una barrera que bloquea lo legítimo la desactiva
// entera alguien con prisa, y entonces protege menos que ninguna».
//
// LA FAMILIA COMPLETA, para que se vea que no es un caso aislado sino UNA avería con seis caras:
//   · `data-view="parte*"` casando vistas que no eran            · `0%` encontrado dentro de `10%`
//   · `window.renderParte` casando dentro de `renderPartesOficinaView`
//   · `ata` apuntando al alias de `window` en vez de a la función que atiende
//   · el prefijo del censo de navegación · `constaAprobado` por subcadena
//   🔒 Un prefijo no es un nombre, y una subcadena tampoco.
//
// EL ARREGLO: se compara por IDENTIDAD DE BANDERA. Se recorta el argumento completo (hasta el `=`
// o el fin) y se mira si ES una de las exentas, enumeradas a mano. **Se niega por defecto**: una
// bandera `--force-loquesea` nueva sigue bloqueada mientras nadie la escriba en la lista. Eximir
// por lista visible es la única forma de aflojar un guard de seguridad sin abrir un agujero.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

import { evaluar } from '../.claude/hooks/guard-dangerous.mjs';

const SENTINEL_FALSO = path.join(os.tmpdir(), 'yaqu-176b-sentinel-que-no-existe');
const llamada = (comando) =>
  JSON.stringify({ tool_name: 'Bash', tool_input: { command: comando, description: 'prueba' } });

const bloquea = (comando) => evaluar(llamada(comando), SENTINEL_FALSO).bloqueado;

// ─────────────────────────────────────────────────────────────────────────────────────────────
// EL ROJO: lo que el guard cazaba y no debía.
// ─────────────────────────────────────────────────────────────────────────────────────────────

// Calibrar la escala del navegador headless no destruye nada. Es lo que hace falta para MEDIR una
// pantalla, que es precisamente lo que este guard estorbaba en SCRUM-720d.
const CALIBRADO_INOFENSIVO = [
  'chrome --headless --force-device-scale-factor=1 --dump-dom about:blank',
  'node banco.mjs --force-device-scale-factor=2',
  'chrome --force-color-profile=srgb --headless',
  'chrome --force-prefers-reduced-motion --headless',
];

test('SCRUM-176b · las banderas de calibrado del navegador PASAN', () => {
  assert.ok(CALIBRADO_INOFENSIVO.length >= 4, '🔴 SUELO: sin casos que probar, esto no prueba nada.');
  const cazadas = CALIBRADO_INOFENSIVO.filter(bloquea);
  assert.deepEqual(
    cazadas,
    [],
    '🔴 FALSO POSITIVO: el guard bloquea banderas que no destruyen nada.\n' +
      '   Un guard de seguridad que estorba es un guard que alguien desactiva, y con él se va\n' +
      '   la protección de verdad (AA2, --force en git). Compara por IDENTIDAD de bandera.\n' +
      '   Bloqueadas sin motivo:\n     ' +
      cazadas.join('\n     '),
  );
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// EL CONTROL NEGATIVO, Y ES EL QUE DECIDE. Aflojar sin esta lista es peor que dejarlo molesto.
// Cada caso va escrito entero: lo que se sigue cazando se enumera, no se supone.
// ─────────────────────────────────────────────────────────────────────────────────────────────

const SIGUEN_BLOQUEADOS = [
  // — el corazón de AA2: reescribir historia publicada —
  ['git push --force', 'reescribe la historia del remoto'],
  ['git push --force origin main', 'lo mismo, con destino explícito'],
  ['git push origin main --force', 'la bandera al final sigue siendo la bandera'],
  ['git push --force-with-lease', '--force con apellido: sigue reescribiendo'],
  ['git push --force-with-lease=refs/heads/main', 'con valor pegado al `=`'],
  ['git push --force-if-includes', 'el otro apellido de la misma familia'],
  ['git push -f origin main', 'la forma corta'],

  // — el que borra la base de datos —
  ['npx prisma db push --force-reset', 'tira el esquema entero y los datos con él'],
  ['./node_modules/.bin/prisma db push --force-reset', 'el mismo, por la ruta correcta'],

  // — otras que arrasan trabajo —
  ['git checkout --force otra-rama', 'se lleva por delante el árbol sucio'],
  ['git clean -fd --force', 'borra lo no seguido'],
  ['npm install --force', 'reinstala pisando el árbol de dependencias'],
  ['git rebase --force-rebase main', 'rebase, que en esta casa está prohibido de por sí'],

  // — y la forma pelada, esté donde esté —
  ['algo --force', 'un programa cualquiera con la bandera pelada'],
];

test('SCRUM-176b · 🔴 CONTROL NEGATIVO: lo peligroso SIGUE bloqueado, uno a uno', () => {
  // SUELO: si el barrido se queda sin casos peligrosos, el test se declara ciego en vez de pasar.
  // Un control negativo vacío da verde igual que uno que funciona, y eso es lo que no puede pasar.
  assert.ok(
    SIGUEN_BLOQUEADOS.length >= 14,
    `🔴 CIEGO: solo ${SIGUEN_BLOQUEADOS.length} casos peligrosos enumerados. Un control negativo ` +
      'con la lista vacía aprueba cualquier cosa: no mide que el guard siga mordiendo.',
  );

  const escapados = SIGUEN_BLOQUEADOS.filter(([c]) => !bloquea(c)).map(([c, porque]) => `${c}   ← ${porque}`);
  assert.deepEqual(
    escapados,
    [],
    '🔴 AGUJERO ABIERTO EN EL GUARD: al aflojar el falso positivo se ha dejado pasar algo que\n' +
      '   destruye trabajo. Esto es exactamente lo que el control negativo existe para impedir:\n     ' +
      escapados.join('\n     '),
  );
});

// La lista de exentas es la superficie del agujero: si crece sin que nadie lo note, el guard se
// vacía por goteo. Se fija aquí para que ampliarla obligue a tocar ESTE fichero y explicarlo.
test('SCRUM-176b · 🔴 LAS EXENTAS SON EXACTAMENTE ÉSTAS: la lista no puede crecer sola', async () => {
  const AQUI = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
  const fuente = fs.readFileSync(path.join(AQUI, '..', '.claude', 'hooks', 'guard-dangerous.mjs'), 'utf8');
  const bloque = fuente.match(/FORCE_EXENTAS\s*=\s*new Set\(\[([\s\S]*?)\]\)/);
  assert.ok(bloque, '🔴 no encuentro la lista de exentas: si se ha renombrado, este control dejó de mirar.');

  const declaradas = [...bloque[1].matchAll(/'(--[a-z0-9-]+)'/g)].map((m) => m[1]).sort();
  assert.deepEqual(
    declaradas,
    ['--force-color-profile', '--force-device-scale-factor', '--force-prefers-reduced-motion'],
    '🔴 la lista de banderas exentas ha cambiado. No es un detalle de estilo: cada entrada es un\n' +
      '   agujero declarado en la barrera que impide reescribir historia. Si hace falta una nueva,\n' +
      '   se añade AQUÍ también, con su motivo, para que se vea quién la abrió y por qué.',
  );
});
