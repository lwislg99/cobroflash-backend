// docs/master/evidencias/SCRUM-307/sin-red/recorrido-sin-red.mjs — qué se puede hacer SIN RED en parte y albarán.
//
//   E2E_TEST_LOGIN_SECRET=… node docs/master/evidencias/SCRUM-307/sin-red/recorrido-sin-red.mjs \
//        --albaran <emitido> --parte <con líneas> --trabajo <id> [--firmar]
//
// Los ids los da preparar.mjs. Sin `--firmar` solo mira; con `--firmar` firma el albarán y el parte
// sin red (se ENCOLAN) y comprueba cuándo suben. Antes de cada paso que podría escribir comprueba que
// la red sigue cortada (SUELO): si no, se para, porque un «funciona sin red» con red es mentira.
//
// Pasos y veredicto medido el 17-sep-2026 en staging (2be8fe16), para comparar:
//   A abrir el albarán precargado ........ funciona («Sin cobertura no puedes crear albaranes, solo firmar…»)
//   B foto en el albarán ................. falla, visible («No se pudo subir la foto.»)
//   C firmar el albarán .................. funciona: se encola (el pad dice «La firma sigue en pantalla…»)
//   D crear albarán ...................... falla: el Trabajo no carga
//   E abrir un parte ..................... falla: los partes no se precargan
//   F parte abierto con red: añadir línea  falla, visible; firmar → se encola
//   G volver la red 60 s sin recargar .... la cola NO se vacía; al recargar sí
//   H reabrir el panel sin red ........... 🔴 falla entero: /admin/me falla → /login.html, que no está en el SHELL
import {
  arrancar, entrar, calentar, dormir, sondaDeRed, cortada, trazoTactil, colaDeFirmas,
  textoDePagina, textoNuevo, pulsar, argumento, BASE,
} from './_conductor.mjs';

const albaran = Number(argumento('albaran'));
const parte = Number(argumento('parte'));
const trabajo = Number(argumento('trabajo'));
const firmar = process.argv.includes('--firmar');
if (!albaran || !parte || !trabajo) { console.error('Uso: --albaran <id> --parte <id> --trabajo <id> [--firmar]'); process.exit(2); }

const { page, red, volcar, captura, cerrar } = await arrancar();
const ver = (etiqueta, texto) => console.log(`   ${etiqueta}: ${String(texto).slice(0, 300)}`);
const suelo = async () => {
  if (!cortada(await sondaDeRed(page))) { console.error('✗ NO SUPE MIRAR: la red NO está cortada. Me paro antes de escribir.'); await cerrar(); process.exit(2); }
};
const vista = (nombre, opciones) => page.evaluate((n, o) => window.renderAppView(n, o), nombre, opciones);
const firmarEnPad = async () => {
  await dormir(2000);
  await page.$eval('#sp-nombre', (e) => { e.value = 'Cliente Prueba (banco sin red)'; e.dispatchEvent(new Event('input', { bubbles: true })); }).catch(() => {});
  await trazoTactil(page);
  await dormir(500);
  const desactivado = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.innerText.trim() === 'Confirmar firma'); return b ? b.disabled : 'sin botón'; });
  if (desactivado !== false) return `«Confirmar firma» no se puede pulsar (${desactivado})`;
  await pulsar(page, 'Confirmar firma');
  await dormir(6000);
  return 'firmado en el pad';
};

try {
  await entrar(page);
  const estado = await calentar(page);
  console.log(`CON RED · service worker=${estado.sw} · precarga=${JSON.stringify(estado.precarga)}`);
  if (!estado.sw) { console.error('✗ NO SUPE MIRAR: el service worker no controla la página.'); process.exit(2); }

  // El parte se abre CON RED para medir F (el pro lo tenía en pantalla cuando perdió la señal).
  await vista('parte-detail', { parteId: parte });
  await dormir(4000);
  await red.cortar();
  await suelo();
  console.log(`\n>>> RED CORTADA · navigator.onLine=${await page.evaluate(() => navigator.onLine)}`);

  console.log('\n══ F · parte ya abierto: añadir línea');
  let antes = await textoDePagina(page);
  await pulsar(page, 'Añadir línea');
  await dormir(1000);
  await page.$eval('[data-nueva-unds]', (e) => { e.value = '1'; }).catch(() => {});
  await page.$eval('[data-nueva-desc]', (e) => { e.value = 'Línea añadida SIN RED'; e.dispatchEvent(new Event('change')); }).catch(() => {});
  await dormir(5000);
  ver('texto nuevo', textoNuevo(antes, await textoDePagina(page)));
  if (firmar) {
    console.log('══ F · parte ya abierto: firmar');
    await suelo();
    await pulsar(page, 'Firmar aquí mismo');
    ver('pad', await firmarEnPad());
    ver('cola', await colaDeFirmas(page));
    await captura('F-parte-abierto');
    // Sin red el pad NO se cierra (SCRUM-404: sin confirmación del servidor no hay ③) y se queda
    // encima aunque se navegue: si no se cierra aquí, el paso C rellena ESTE pad y no el del albarán.
    ver('cerrar el pad con «Cancelar»', await pulsar(page, 'Cancelar'));
    await dormir(800);
  }
  volcar('F');

  console.log('\n══ A · abrir el albarán precargado');
  await vista('albaran-detail', { albaranId: albaran });
  await dormir(5000);
  antes = await textoDePagina(page);
  ver('texto', antes);
  await captura('A-albaran-precargado');
  volcar('A');

  console.log('\n══ B · foto en el albarán');
  await suelo();
  await pulsar(page, '⋯');
  await dormir(800);
  const [selector] = await Promise.all([page.waitForFileChooser({ timeout: 5000 }).catch(() => null), pulsar(page, '[data-accion="btnFoto"]')]);
  if (selector) {
    const { default: fs } = await import('node:fs');
    const { default: os } = await import('node:os');
    const { default: path } = await import('node:path');
    const png = path.join(os.tmpdir(), 'yaqu-sin-red-1px.png');
    fs.writeFileSync(png, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==', 'base64'));
    await selector.accept([png]);
    await dormir(5000);
    ver('texto nuevo', textoNuevo(antes, await textoDePagina(page)));
  } else ver('foto', 'no se abrió el selector de ficheros');
  volcar('B');

  if (firmar) {
    console.log('\n══ C · firmar el albarán');
    await suelo();
    await vista('albaran-detail', { albaranId: albaran });
    await dormir(4000);
    antes = await textoDePagina(page);
    await pulsar(page, '[data-accion="btnFirmarAqui"]');
    ver('pad', await firmarEnPad());
    ver('texto nuevo', textoNuevo(antes, await textoDePagina(page)));
    ver('cola', await colaDeFirmas(page));
    await captura('C-firma-albaran');
    volcar('C');
  }

  console.log('\n══ D · crear albarán desde el Trabajo');
  await suelo();
  await vista('jobs-detail', { jobId: trabajo });
  await dormir(5000);
  ver('texto', await textoDePagina(page));
  ver('«+ Nuevo albarán» disponible', await pulsar(page, '+ Nuevo albarán'));
  volcar('D');

  console.log('\n══ E · abrir el parte sin red');
  await vista('parte-detail', { parteId: parte });
  await dormir(5000);
  ver('texto', await textoDePagina(page));
  volcar('E');
  console.log(`\n(el proxy rechazó ${red.rechazados()} conexiones con la red cortada)`);

  console.log('\n══ G · volver la red');
  await red.devolver();
  const servidor = async () => page.evaluate(async (a, p) => {
    const A = await (await fetch(`/admin/albaranes/${a}`, { credentials: 'include' })).json().catch(() => ({}));
    const P = await (await fetch(`/admin/partes/${p}`, { credentials: 'include' })).json().catch(() => ({}));
    return `albarán=${(A.albaran || A).estado} · parte=${(P.parte || P).estado}`;
  }, albaran, parte);
  await page.evaluate(() => { window.dispatchEvent(new Event('online')); document.dispatchEvent(new Event('visibilitychange')); });
  await dormir(60000);
  ver('60 s sin recargar', `cola=${await colaDeFirmas(page)} · ${await servidor()}`);
  await page.reload({ waitUntil: 'load' });
  await dormir(12000);
  ver('tras recargar', `cola=${await colaDeFirmas(page)} · ${await servidor()}`);
  volcar('G');

  console.log('\n══ H · reabrir el panel sin red');
  await red.cortar();
  await suelo();
  await page.goto(BASE + '/dashboard/', { waitUntil: 'load', timeout: 20000 }).catch(() => {});
  await dormir(6000);
  ver('url', page.url());
  ver('texto', await textoDePagina(page).catch(() => '(sin DOM)'));
  await captura('H-reabrir-sin-red');
  volcar('H');
  await red.devolver();
} finally {
  await cerrar();
}
