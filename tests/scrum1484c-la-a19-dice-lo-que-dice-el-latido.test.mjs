// SCRUM-1484c · LA A19 Y EL CÓDIGO DICEN LO MISMO.
//
// SCRUM-1484 metió en el código, el 6-oct-2026, la segunda frase del relevo («se releva YA…» por encima del
// número de «a mitad de entrega»). La A19 de `docs/equipo/00-normas-comunes.md` siguió diciendo un día entero
// «el latido no avisa de este caso», y al día siguiente se repartió construir lo ya construido. El papel de S5
// lo ata `tests/scrum899c-relevar-y-contexto.test.mjs`, que dice a propósito que NO ata la A19. Esto la ata:
//   · los DOS números de la A19 son los dos del código;
//   · la A19 cita, literales, las DOS conductas que dice `fraseDeRelevo`.
// Quien mueva un número o cambie una frase en `sesion.mjs` tiene que escribirlo en la norma, o esto cae.
//
// Población declarada: UNA sección (la A19), con su suelo de tamaño; dos números; dos frases.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NORMAS = 'docs/equipo/00-normas-comunes.md';
const s = await import(pathToFileURL(path.join(RAIZ, 'scripts', 'equipo', 'sesion.mjs')).href);

// El rojo de cada pieza, declarado: lo ejecuta `npm run meta:mutaciones`.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'scripts/equipo/sesion.mjs',
    de: 'export const UMBRAL_CONTEXTO_A_MITAD = 500_000;',
    a: 'export const UMBRAL_CONTEXTO_A_MITAD = 450_000;',
    cae: '🔴 SCRUM-1484c · los dos números de la A19 son los dos del código',
  },
  {
    fichero: 'scripts/equipo/sesion.mjs',
    de: '): se releva YA, sin esperar a terminar — primer punto seguro (un commit local), traspaso y relevo`',
    a: '): se releva en cuanto pueda`',
    cae: '🔴 SCRUM-1484c · la A19 cita las dos conductas que dice `fraseDeRelevo`',
  },
];

const k = (n) => `${Math.round(n / 1000)}k`;
const plano = (t) => t.replace(/\s+/g, ' ');

/** La sección A19, de su cabecera a la siguiente de su nivel; `null` si no está. */
export function seccionA19(texto) {
  const t = '\n' + texto.replace(/\r\n/g, '\n');
  const i = t.indexOf('\n## A19 · ');
  if (i < 0) return null;
  const j = t.indexOf('\n## ', i + 1);
  return t.slice(i + 1, j < 0 ? undefined : j);
}

/** Lo que una frase de `fraseDeRelevo` manda HACER: lo que va detrás de «): ». */
export function conducta(frase) {
  const i = frase.indexOf('): ');
  return i < 0 ? null : frase.slice(i + 3);
}

/**
 * Qué le falta a la A19 para decir lo que dice el código. Lista vacía = dicen lo mismo.
 * @param {string} a19 la sección
 * @param {{umbral:number, umbralAMitad:number, fraseEntre:string, fraseEncima:string}} codigo
 */
export function loQueLeFalta(a19, { umbral, umbralAMitad, fraseEntre, fraseEncima }) {
  const t = plano(a19);
  const faltas = [];
  if (!t.includes(`¿Pasa de **${k(umbral)}**?`)) faltas.push(`la casilla 3 no dice «¿Pasa de **${k(umbral)}**?», que es UMBRAL_CONTEXTO`);
  if (!t.includes(`si pasa de **${k(umbralAMitad)}**`)) faltas.push(`«en mitad de una entrega» no dice «si pasa de **${k(umbralAMitad)}**», que es UMBRAL_CONTEXTO_A_MITAD`);
  for (const [cual, frase] of [['entre los dos números', fraseEntre], ['por encima del segundo', fraseEncima]]) {
    const c = frase && conducta(frase);
    if (!c) { faltas.push(`SUELO: \`fraseDeRelevo\` no da frase ${cual}; sin ella no he comparado nada`); continue; }
    if (!t.includes(`«${c}»`)) faltas.push(`no cita «${c}», que es lo que el código dice ${cual}`);
  }
  return faltas;
}

const codigoDeHoy = () => ({
  umbral: s.UMBRAL_CONTEXTO,
  umbralAMitad: s.UMBRAL_CONTEXTO_A_MITAD,
  fraseEntre: s.fraseDeRelevo({ tokens: s.UMBRAL_CONTEXTO + 1 }),
  fraseEncima: s.fraseDeRelevo({ tokens: s.UMBRAL_CONTEXTO_A_MITAD + 1 }),
});

const a19DeHoy = () => {
  const a19 = seccionA19(fs.readFileSync(path.join(RAIZ, NORMAS), 'utf8'));
  assert.ok(a19 && a19.length > 5000, `🔴 SUELO: no encuentro la sección «## A19 · » de ${NORMAS} con su tamaño; sin ella no he mirado nada`);
  return a19;
};

test('🔴 SCRUM-1484c · los dos números de la A19 son los dos del código', () => {
  const faltas = loQueLeFalta(a19DeHoy(), codigoDeHoy()).filter((f) => f.includes('UMBRAL_CONTEXTO'));
  assert.deepEqual(faltas, [], `🔴 la A19 y \`sesion.mjs\` no dicen el mismo número:\n  ${faltas.join('\n  ')}`);
});

test('🔴 SCRUM-1484c · la A19 cita las dos conductas que dice `fraseDeRelevo`', () => {
  const codigo = codigoDeHoy();
  assert.match(codigo.fraseEntre, /AL TERMINAR/, '🔴 SUELO: entre los dos números el código ya no dice «al terminar»; la comparación de abajo no sabe qué mira');
  assert.match(codigo.fraseEncima, /se releva YA/, '🔴 SUELO: por encima del segundo el código ya no dice «YA»');
  const faltas = loQueLeFalta(a19DeHoy(), codigo).filter((f) => !f.includes('UMBRAL_CONTEXTO'));
  assert.deepEqual(faltas, [], `🔴 la A19 no dice lo que dice el latido:\n  ${faltas.join('\n  ')}`);
});

// Los rojos, con texto fijo: el párrafo que la A19 llevó hasta el 7-oct-2026 y un número que no es el del código.
test('SCRUM-1484c · la comparación CAE con el párrafo de antes y con un número movido, y cada caída dice cuál', () => {
  const codigo = {
    umbral: 300_000,
    umbralAMitad: 500_000,
    fraseEntre: 'por encima de 300k (A19): se releva AL TERMINAR su entrega',
    fraseEncima: 'por encima de 500k (A19, a mitad de entrega): se releva YA, sin esperar a terminar — primer punto seguro (un commit local), traspaso y relevo',
  };
  const deAntes = [
    '  3. ¿Pasa de **300k**? → no empiezo lo siguiente.',
    '  Y **en mitad de una entrega**, si pasa de **500k**: busco el primer punto seguro.',
    '  ⚠️ **El latido no avisa de este caso** (SCRUM-1484): a una sesión por encima de 500k le dice lo mismo que',
    '  a una que sólo ha pasado el umbral de entrega, «se releva AL TERMINAR su entrega», que para ese caso es',
    '  lo contrario de esta norma.',
  ].join('\n');
  assert.deepEqual(loQueLeFalta(deAntes, codigo),
    ['no cita «se releva YA, sin esperar a terminar — primer punto seguro (un commit local), traspaso y relevo», que es lo que el código dice por encima del segundo'],
    '🔴 el párrafo de antes del 7-oct tiene que caer por UNA cosa: no cita la frase de «YA»');

  const alDia = deAntes.replace(/⚠️[\s\S]*$/, 'le dice «se releva YA, sin esperar a terminar — primer punto seguro (un commit local), traspaso y\n  relevo», y a la otra «se releva AL TERMINAR su entrega».');
  assert.deepEqual(loQueLeFalta(alDia, codigo), [], 'el mismo párrafo, puesto al día y partido en dos líneas, no cae');

  const movido = loQueLeFalta(alDia, { ...codigo, umbralAMitad: 450_000 });
  assert.equal(movido.length, 1, '🔴 con el segundo número movido en el código tiene que caer UNA cosa');
  assert.match(movido[0], /450k.*UMBRAL_CONTEXTO_A_MITAD/);

  assert.match(loQueLeFalta(alDia, { ...codigo, fraseEncima: null })[0], /^SUELO:/, '🔴 sin frase del código la comparación no puede salir limpia');
  assert.equal(seccionA19('# otra cosa\n\n## A18 · nada\n'), null, 'sin sección A19 no hay sección: lo dice, no devuelve vacío');
  assert.equal(conducta('una frase sin paréntesis'), null);
});
