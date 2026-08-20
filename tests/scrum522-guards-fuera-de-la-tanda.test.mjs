// tests/scrum522-guards-fuera-de-la-tanda.test.mjs — SCRUM-522
//
// NUEVE GUARDS FIGURABAN COMO COBERTURA Y NO CORRÍAN EN NINGÚN SITIO.
//
// Levantan un navegador, quedaban fuera de `npm test` por lentos, y **ninguno corría en CI**: un
// PR podía romper lo que vigilan y mergear en verde. La ficha decía «al menos tres» — medido
// derivando de `package.json`, son ~~3~~ **9**.
//
// ── LO QUE ESTE FICHERO NO PUEDE DECIR ─────────────────────────────────────────────────────
// 🔴 NO puede decir que los guards estén verdes: eso lo dice `npm run guards:visuales`, que abre
//    navegador y por eso NO está en la tanda. Aquí se vigila que la puerta siga existiendo, que
//    el workflow la invoque, y que la lista salga DERIVADA en vez de escrita a mano.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fueraDeLaTanda } from '../scripts/guards-visuales.mjs';
import { resolverNavegador, CANDIDATOS } from '../scripts/_navegador.mjs';
import { esDeNavegador } from '../scripts/_solape-de-guards.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PKG = JSON.parse(fs.readFileSync(path.join(RAIZ, 'package.json'), 'utf8'));
const SCRIPTS = PKG.scripts || {};
const CI = fs.readFileSync(path.join(RAIZ, '.github', 'workflows', 'ci.yml'), 'utf8');

const GUARDS = ['contraste', 'caja-avisos', 'cls-barra-anuncio', 'primera-pantalla',
  'vias-de-cobro', 'aviso-bizum', 'a11y-comparativa', 'a11y-landing', 'objetivo-tactil'];

// ═════════════════════════════════════════════════════════════════════════════════════════
// ① SUELO · «todos corren» y «no supe mirar» son el mismo resultado
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-522 · 🔴 SUELO: la lista de guards fuera de la tanda no está vacía', () => {
  const fuera = fueraDeLaTanda(SCRIPTS);
  assert.ok(fuera.length > 0,
    '🔴 CIEGO: cero guards de navegador fuera de `npm test`.\n'
    + '  O se han metido todos en la tanda —y entonces la puerta sobra y hay que retirarla a\n'
    + '  mano— o el detector dejó de reconocerlos por su //comentario. «Todos los guards corren»\n'
    + '  y «no supe mirar los scripts» son el mismo resultado con significados opuestos.');

  // El número, con la corrección del ticket A LA VISTA: la ficha decía «al menos tres».
  assert.equal(fuera.length, 9,
    `🔴 HA CAMBIADO EL NÚMERO DE GUARDS FUERA DE LA TANDA: ~~3~~ 9 → ${fuera.length}.\n`
    + '  Si ha subido, hay uno nuevo que nadie corre salvo esta puerta — bien, pero míralo.\n'
    + '  Si ha bajado, di CUÁL y por qué antes de tocar este número.\n'
    + `  Ahora mismo: ${JSON.stringify(fuera)}`);
});

test('SCRUM-522 · la lista sale DERIVADA de package.json, no escrita aquí', () => {
  // Se comprueba contra un `scripts` de mentira: si la función devolviera siempre lo mismo,
  // el trinquete de arriba estaría midiendo una constante.
  const falso = {
    test: 'npm run build && node --test tests/*.test.mjs',
    pretest: 'node scripts/_algo.mjs',
    '//guard:uno': 'levanta un navegador con puppeteer',
    'guard:uno': 'node scripts/guard-uno.mjs',
    // ⚠️ El caso negativo NO puede llevar la palabra «navegador» dentro, ni siquiera para negarla:
    //    `esDeNavegador` busca esa palabra en el //comentario, así que «esto NO abre navegador»
    //    daba positivo. Un corpus de control que dice lo contrario de lo que cree decir.
    '//guard:dos': 'esto mira ficheros en disco, sin abrir nada',
    'guard:dos': 'node scripts/guard-dos.mjs',
  };
  assert.deepEqual(fueraDeLaTanda(falso), ['guard:uno'],
    '🔴 o no distingue los de navegador por su //comentario, o no deriva de lo que se le pasa.');

  // Y que sepa EXCLUIR lo que la tanda ya corre: si no, la puerta repetiría trabajo y, peor,
  // diría que vigila algo que ya estaba vigilado.
  const conTanda = { ...falso, test: 'node --test tests/*.test.mjs && npm run guard:uno' };
  assert.deepEqual(fueraDeLaTanda(conTanda), [],
    '🔴 no excluye un guard que la tanda YA corre.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ② EL NAVEGADOR · lo que hace que puedan correr en CI, y su suelo
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-522 · el resolutor encuentra el navegador donde lo haya', () => {
  // `existe` se inyecta: sin eso este resolutor sólo se probaría en un sistema operativo y las
  // demás ramas —las que de verdad corren en CI— no las miraría nadie.
  const soloLinux = (p) => p === '/usr/bin/microsoft-edge';
  const r = resolverNavegador({}, soloLinux);
  assert.equal(r.ok, true, '🔴 no encuentra Edge en la ruta de Linux, que es la del runner de CI.');
  assert.equal(r.ruta, '/usr/bin/microsoft-edge');

  const soloChrome = (p) => p === '/usr/bin/google-chrome';
  assert.equal(resolverNavegador({}, soloChrome).ruta, '/usr/bin/google-chrome',
    '🔴 no cae a Chrome cuando no hay Edge.');
});

test('SCRUM-522 · 🔴 SUELO: sin navegador NO devuelve una ruta plausible', () => {
  const r = resolverNavegador({}, () => false);
  assert.equal(r.ok, false,
    '🔴 ha devuelto una ruta con cero navegadores instalados. Una ruta plausible haría que el\n'
    + '  guard fallara al abrirla y el rojo diría «no se pudo abrir» en vez de «aquí no hay».');
  for (const c of CANDIDATOS) {
    assert.ok(r.motivo.includes(c.ruta),
      `🔴 el motivo no nombra ${c.ruta}. Un «no lo encuentro» sin decir dónde ha mirado obliga a\n`
      + '  abrir el código para arreglarlo.');
  }
});

test('SCRUM-522 · 🔴 EDGE_PATH puesta y rota NO cae hacia atrás a otro navegador', () => {
  // Alguien la puso a propósito. Taparlo con otro navegador es medir en un sitio distinto del
  // que se pidió, y el informe diría lo que no es.
  const hayDeTodo = () => true;
  const r = resolverNavegador({ EDGE_PATH: '/no/existe/edge' }, (p) => p !== '/no/existe/edge' && hayDeTodo());
  assert.equal(r.ok, false, '🔴 ha ignorado una EDGE_PATH rota y ha usado otro navegador.');
  assert.match(r.motivo, /EDGE_PATH/);

  // Y si está puesta y es buena, manda sobre los candidatos.
  const r2 = resolverNavegador({ EDGE_PATH: '/mi/edge' }, () => true);
  assert.equal(r2.ruta, '/mi/edge', '🔴 EDGE_PATH ha dejado de mandar.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ③ LOS NUEVE, PORTADOS · y sin perder su propio suelo
// ═════════════════════════════════════════════════════════════════════════════════════════

for (const g of GUARDS) {
  test(`SCRUM-522 · guard-${g} no lleva una ruta de Windows escrita a mano`, () => {
    const src = fs.readFileSync(path.join(RAIZ, 'scripts', `guard-${g}.mjs`), 'utf8');
    assert.ok(!src.includes("EDGE_PATH || 'C:/"),
      '🔴 ha vuelto la ruta de Windows por defecto. Con eso este guard no puede correr en el\n'
      + '  runner de CI, y volvería a figurar como cobertura sin serlo.');
    assert.equal(src.split('rutaDelNavegador()').length - 1, 1,
      '🔴 no resuelve el navegador por el módulo común, o lo hace más de una vez.\n'
      + '  Ahí está su suelo: `rutaDelNavegador` PARA si no hay navegador, así que ningún guard\n'
      + '  puede llegar a decir «no hay defectos» cuando lo que pasa es que no supo mirar.');
  });
}

test('SCRUM-522 · 🔴 y ese suelo común PARA de verdad, no devuelve una ruta', async () => {
  // 🔴 Se ejercita EJECUTANDO, no leyendo. Cuatro de los nueve guards no tenían comprobación
  //    propia —envuelven el `launch` en un `try`—, así que el suelo de los nueve es hoy éste y
  //    sólo éste: si `rutaDelNavegador` devolviera en vez de parar, esos cuatro seguirían
  //    adelante con una ruta rota y su rojo diría «no se pudo abrir» en lugar de «aquí no hay».
  const { spawnSync } = await import('node:child_process');
  const correr = (edgePath) => spawnSync(process.execPath,
    ['-e', "import('./scripts/_navegador.mjs').then(m => { m.rutaDelNavegador(); console.log('HA SEGUIDO'); })"],
    { cwd: RAIZ, encoding: 'utf8', env: { ...process.env, EDGE_PATH: edgePath } });

  // ✅ EL HERMANO POSITIVO, y no es adorno. Sin él, «no aparece HA SEGUIDO» sería verde también
  //    si el proceso muriera por cualquier otro motivo, o si el token no pudiera imprimirse
  //    nunca. Se prueba primero que SÍ aparece cuando la ruta existe — se apunta al propio
  //    binario de node, que existe siempre y es lo único que `rutaDelNavegador` comprueba.
  const bien = correr(process.execPath);
  assert.equal(bien.status, 0, `🔴 con una ruta que EXISTE salió con ${bien.status}: ${bien.stderr}`);
  assert.match(bien.stdout || '', /HA SEGUIDO/,
    '🔴 el token no aparece ni cuando debe. Entonces su ausencia de abajo no significaría nada.');

  // 🔴 Y ahora la negación, que ya sí dice algo.
  const r = correr('/no/existe/navegador');
  assert.equal(r.status, 2,
    `🔴 con EDGE_PATH rota salió con ${r.status} y no con 2. El 2 es lo que distingue «no supe\n`
    + '  mirar» de «no hay defectos» en toda la casa.');
  assert.ok(!(r.stdout || '').includes('HA SEGUIDO'),
    '🔴 ha devuelto una ruta y el programa ha continuado. Tiene que parar.');
  assert.match((r.stderr || ''), /NO SUPE MIRAR/, '🔴 para, pero sin decir por qué.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ④ LA PUERTA, Y QUE CI LA INVOQUE — que es lo único que hace que esto proteja
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-522 · la puerta está declarada con su //comentario', () => {
  assert.equal(SCRIPTS['guards:visuales'], 'node scripts/guards-visuales.mjs',
    '🔴 falta el comando `guards:visuales` o apunta a otro sitio.');
  assert.ok(String(SCRIPTS['//guards:visuales'] || '').length > 200,
    '🔴 falta su //comentario. Un comando sin explicación se borra el día que estorba.');
});

test('SCRUM-522 · 🔴 el workflow de CI invoca la puerta', () => {
  assert.match(CI, /^\s{2}guards-visuales:\s*$/m,
    '🔴 no hay job `guards-visuales` en .github/workflows/ci.yml. Sin él, los nueve guards\n'
    + '  vuelven a no correr en ningún sitio y este ticket no ha arreglado nada.');
  assert.match(CI, /run: npm run guards:visuales/,
    '🔴 el job existe y NO invoca `npm run guards:visuales`. Un job que no llama a la puerta es\n'
    + '  un job verde que no vigila nada.');
  // El job de tests sigue donde estaba: aquí no se ha movido nada de lo que ya protegía.
  assert.match(CI, /^\s{2}test:\s*$/m, '🔴 ha desaparecido el job de tests.');
});

test('SCRUM-522 · la puerta JUZGA, no sólo mide', () => {
  // Es la diferencia con `censo:guards-navegador`, que imprime «no verdes: 2» y sale con 0.
  // Enganchar aquel al workflow habría dado un job verde con guards rojos dentro.
  const src = fs.readFileSync(path.join(RAIZ, 'scripts', 'guards-visuales.mjs'), 'utf8');
  assert.match(src, /process\.exit\(1\)/,
    '🔴 la puerta no sale con error cuando algo falla: sería un job verde con guards rojos.');
  assert.match(src, /if \(estado !== 'verde'\) fallos \+= 1;/,
    '🔴 ha dejado de contar como fallo lo que no está verde. Un guard CIEGO no ha vigilado nada.');
  assert.match(src, /process\.exit\(2\)/,
    '🔴 ha perdido el suelo: sin guards que correr tiene que declararse ciega, no pasar.');
});
