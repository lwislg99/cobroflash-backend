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
    // SCRUM-522 (2ª vuelta): son DOS puertas de entrada al módulo común y vale cualquiera, pero
    // exactamente UNA. `rutaDelNavegador()` sólo resuelve; `lanzarNavegador()` resuelve Y arranca
    // —y es la que además distingue «no arranca» (3) de «no lo encuentro» (2)—. El suelo no se
    // relaja: las dos PARAN, así que ningún guard puede decir «no hay defectos» cuando lo que
    // pasa es que no supo mirar. Lo que se prohíbe sigue siendo resolver por fuera del módulo.
    const porRuta = src.split('rutaDelNavegador()').length - 1;
    const porLanzar = src.split('lanzarNavegador(').length - 1;
    assert.equal(porRuta + porLanzar, 1,
      `🔴 ${g} entra al módulo común ${porRuta + porLanzar} veces (rutaDelNavegador: ${porRuta}, `
      + `lanzarNavegador: ${porLanzar}); tiene que ser exactamente 1.\n`
      + '  Ahí está su suelo: las dos PARAN si no hay navegador, así que ningún guard puede\n'
      + '  llegar a decir «no hay defectos» cuando lo que pasa es que no supo mirar.');
  });
}

// ═════════════════════════════════════════════════════════════════════════════════════════
// ⑤ SCRUM-522, 2ª VUELTA · LO QUE EL CI ENSEÑÓ Y ESTE FICHERO NO VIGILABA
//
// El primer arreglo resolvió LA RUTA y el runner siguió en rojo, por DOS cosas distintas:
//   · el navegador se encontraba y NO ARRANCABA (sandbox SUID del runner);
//   · **importar la puerta la EJECUTABA**, así que este mismo fichero de test lanzaba los nueve
//     guards y moría en su `process.exit` — 68 s y `'test failed'` sin nombrar un assert.
// Las dos se vigilan aquí, porque las dos se colaron por debajo de lo que ya había escrito.
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-522 · 🔴 IMPORTAR la puerta NO la ejecuta', async () => {
  // El fallo que trajo el ticket de vuelta. Se ejercita EJECUTANDO —no leyendo el fuente—: un
  // `esInvocacionDirecta` mal escrito se lee igual de bien y no hace nada (la trampa de la ruta
  // con espacios, SCRUM-429). `EDGE_PATH` rota para que, SI se ejecutara, se note enseguida y
  // sin abrir un solo navegador.
  const { spawnSync } = await import('node:child_process');
  const r = spawnSync(process.execPath,
    ['-e', "import('./scripts/guards-visuales.mjs').then(m => console.log('IMPORT LIMPIO ' + typeof m.fueraDeLaTanda))"],
    { cwd: RAIZ, encoding: 'utf8', env: { ...process.env, EDGE_PATH: '/no/existe/navegador' } });

  assert.equal(r.status, 0,
    `🔴 importar la puerta salió con ${r.status}. Se está EJECUTANDO al importarla, así que\n`
    + '  cualquier test que la importe arrastra los nueve guards dentro de `npm test` y muere en\n'
    + `  su process.exit. Lo que dijo: ${(r.stderr || '').trim().slice(0, 300)}`);
  assert.match(r.stdout || '', /IMPORT LIMPIO function/,
    '🔴 el import no completó, o dejó de exportar `fueraDeLaTanda`.');
});

test('SCRUM-522 · ✅ POSITIVO: lanzada COMO SCRIPT la puerta sí actúa', async () => {
  // Sin esto, «no se ejecuta al importar» y «no se ejecuta nunca» dan el mismo verde — y el
  // segundo deja el job de CI pasando sin correr un solo guard, que es este ticket al revés.
  const { spawnSync } = await import('node:child_process');
  const r = spawnSync(process.execPath, ['scripts/guards-visuales.mjs'],
    { cwd: RAIZ, encoding: 'utf8', env: { ...process.env, EDGE_PATH: '/no/existe/navegador' } });

  assert.equal(r.status, 2,
    `🔴 lanzada como script salió con ${r.status} y no con 2. Con EDGE_PATH rota tiene que\n`
    + '  declararse CIEGA, no pasar en silencio ni caerse por otra cosa.');
  assert.match(r.stderr || '', /NO SUPE MIRAR/, '🔴 para, pero sin decir por qué.');
});

test('SCRUM-522 · 🔴 «no lo encuentro» y «no arranca» son DOS códigos, no uno', async () => {
  const { SALIDA_NO_ENCONTRADO, SALIDA_NO_ARRANCA, lanzarNavegador } =
    await import('../scripts/_navegador.mjs');
  assert.notEqual(SALIDA_NO_ENCONTRADO, SALIDA_NO_ARRANCA,
    '🔴 los dos diagnósticos han vuelto a compartir código de salida. Eran indistinguibles, y\n'
    + '  por eso un guard que no midió NADA se leía como un hallazgo real.');
  assert.notEqual(SALIDA_NO_ARRANCA, 1,
    '🔴 «no arranca» vale 1, que es el código de «he encontrado defectos». Es exactamente la\n'
    + '  confusión que este arreglo quita: la puerta lo pintaría `rojo(1)`.');
  assert.equal(typeof lanzarNavegador, 'function', '🔴 no existe el arranque común.');
});

test('SCRUM-617 · 🔴 el tope de arranque POR DEFECTO no se toca', async () => {
  // El runner mató a `guard-contraste` en el tope de arranque de puppeteer (30 000 ms). La
  // tentación es subir el número «a ver si cuela»: eso compra el verde sin saber por qué, y el
  // día que el arranque tarde de verdad nadie se entera. El tope se sube por ENTORNO y sólo para
  // medir; el valor por defecto se queda donde estaba y este test es lo que lo sostiene.
  const { TOPE_ARRANQUE_POR_DEFECTO, topeDeArranque } = await import('../scripts/_navegador.mjs');

  assert.equal(TOPE_ARRANQUE_POR_DEFECTO, 30_000,
    '🔴 ha cambiado el tope de arranque POR DEFECTO. Si es para que el CI pase, no es un arreglo:\n'
    + '  es comprar el verde con un número más grande. Si hay motivo, va escrito al lado y este\n'
    + '  número se cambia a propósito, no de paso.');
  // AUSENTE — el caso NORMAL desde que se retiró la temporal, y por eso va primero y nombrado:
  // la clave NO EXISTE en el entorno, que no es lo mismo que existir vacía.
  assert.equal(topeDeArranque({}), 30_000,
    '🔴 sin la variable en el entorno tiene que valer el de siempre. Éste es el caso de todos los\n'
    + '  días desde que se retiró la pasada de medición de SCRUM-617.');
  assert.ok(!('NAVEGADOR_TIMEOUT_MS' in {}), 'control del propio caso: la clave no está.');

  assert.equal(topeDeArranque({ NAVEGADOR_TIMEOUT_MS: '120000' }), 120_000,
    '🔴 la variable de medición ha dejado de mandar.');

  // Y que una variable basura NO deje el tope en algo raro: un tope de 0 o NaN sería «sin tope»
  // o «arranque imposible», y las dos se leerían como otra cosa.
  for (const malo of ['', 'ochenta', '0', '-5', undefined, '  ']) {
    assert.equal(topeDeArranque({ NAVEGADOR_TIMEOUT_MS: malo }), 30_000,
      `🔴 con NAVEGADOR_TIMEOUT_MS=${JSON.stringify(malo)} el tope no cae al de siempre.`);
  }
});

test('SCRUM-617 · 🔴 el workflow NO lleva el tope de medición puesto', () => {
  // ── POR QUÉ ESTO ES UN TEST Y NO UNA NOTA ─────────────────────────────────────────────────
  // El 24-ago-2026 esa línea entró a `main` dentro del merge del ticket, marcada «TEMPORAL» y con
  // su caducidad escrita. La marca no la retiró: la retiró alguien que fue a mirar. Una medida
  // temporal con el tope cuatro veces más alto NO ROMPE NADA VISIBLE — por eso es justo la clase
  // de línea que se queda para siempre, y por eso necesita mecanismo y no una promesa.
  //
  // ⚠️ SI ESTÁS HACIENDO OTRA PASADA DE MEDICIÓN y este test te molesta: eso es lo que tiene que
  // pasar. Ponla, mide, quítala y este test vuelve a verde solo. Si de verdad hay que dejarla, se
  // cambia ESTE test a propósito y con el motivo — que es exactamente la decisión consciente que
  // la vez pasada no llegó a tomarse.
  // 🔴 SE MIRA EL YAML SIN COMENTARIOS, y no es un detalle: la primera versión de este test
  // buscaba el nombre en el fichero entero y SE CAZÓ A SÍ MISMA — el comentario que explica por
  // qué la línea no puede estar la nombra, así que el guard salía rojo con la línea ya retirada.
  // Es la trampa de autorreferencia que la casa tiene escrita; aquí mordió en el estreno.
  const ciSinComentarios = CI.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');

  // ✅ CONTROL POSITIVO del filtro: si quitar comentarios se llevara medio fichero, el
  // `doesNotMatch` de abajo pasaría sobre la nada. Tiene que seguir viéndose la invocación real.
  assert.match(ciSinComentarios, /run: npm run guards:visuales/,
    '🔴 al quitar comentarios se ha perdido el job: lo de abajo estaría midiendo sobre un vacío.');

  assert.doesNotMatch(ciSinComentarios, /NAVEGADOR_TIMEOUT_MS/,
    '🔴 `.github/workflows/ci.yml` vuelve a fijar NAVEGADOR_TIMEOUT_MS.\n'
    + '  Con el tope subido, un arranque que se cuelgue DE VERDAD tarda cuatro veces más en\n'
    + '  denunciarse, y el verde del CI deja de significar lo que parece.\n'
    + '  El valor por defecto (TOPE_ARRANQUE_POR_DEFECTO) no lo elegimos nosotros: es el de\n'
    + '  puppeteer, y tiene procedencia. Un valor intermedio inventado no la tiene.');
});

test('SCRUM-617 · el ARRANQUE se mide aparte del total, y la puerta lo lee', async () => {
  // El total de un guard mezcla arrancar y comprobar. Con un solo número no se puede saber cuál
  // de las dos se disparó — que es exactamente la pregunta que dejó abierta el rojo del runner.
  const { MARCA_ARRANQUE } = await import('../scripts/_navegador.mjs');
  assert.ok(MARCA_ARRANQUE && MARCA_ARRANQUE.length > 3, '🔴 no hay marca de arranque.');

  const puerta = fs.readFileSync(path.join(RAIZ, 'scripts', 'guards-visuales.mjs'), 'utf8');
  assert.match(puerta, /MARCA_ARRANQUE/,
    '🔴 la puerta ya no lee la marca: volvería a enseñar sólo el total, y el arranque de los ocho\n'
    + '  que NO fallan no se vería (la puerta sólo vuelca la salida del que cae).');
  assert.match(puerta, /arranque/,
    '🔴 la tabla de la puerta ha dejado de enseñar el arranque.');
});

test('SCRUM-522 · 🔴 el aislamiento del navegador se relaja SÓLO en CI', async () => {
  // `--no-sandbox` puesto por defecto es un cambio que nadie pidió y que no se nota. Se
  // comprueba en las dos direcciones con un entorno inyectado, para no depender de dónde corra.
  const { argsDeAislamiento } = await import('../scripts/_navegador.mjs');

  assert.deepEqual(argsDeAislamiento({}), [],
    '🔴 fuera de CI se están pasando argumentos de aislamiento. Ahí NO se relaja nada.');
  assert.deepEqual(argsDeAislamiento({ CI: '' }), [],
    '🔴 una `CI` vacía cuenta como CI. Sólo cuando de verdad lo es.');

  const enCi = argsDeAislamiento({ CI: 'true' });
  assert.ok(enCi.includes('--no-sandbox') && enCi.includes('--disable-setuid-sandbox'),
    '🔴 en CI no se pasan los argumentos que hacen falta: el helper SUID del runner aborta el\n'
    + '  arranque y los guards vuelven a no medir nada.');
});

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
