// docs/master/evidencias/SCRUM-307/sin-red/control-red.mjs — ¿el corte de red CORTA? Solo lecturas.
//
//   E2E_TEST_LOGIN_SECRET=… node docs/master/evidencias/SCRUM-307/sin-red/control-red.mjs
//
// Con red, una petición directa (/version) y una que pasa por el service worker (/admin/jobs) dan 200.
// Con la red cortada, las DOS tienen que fallar; y al devolverla, volver a 200. Si no, este banco no
// sirve y cualquier «funciona sin red» que dé es mentira. Salidas: 0 el corte corta · 2 no corta.
import { arrancar, entrar, calentar, sondaDeRed, cortada } from './_conductor.mjs';

const { page, red, volcar, cerrar } = await arrancar();
let salida = 2;
try {
  await entrar(page);
  const estado = await calentar(page);
  const conRed = await sondaDeRed(page);
  await red.cortar();
  const sinRed = await sondaDeRed(page);
  await red.devolver();
  const deVuelta = await sondaDeRed(page);
  console.log('service worker controlando: ' + estado.sw);
  console.log('CON RED       ' + JSON.stringify(conRed));
  console.log('RED CORTADA   ' + JSON.stringify(sinRed) + ' · rechazadas por el proxy: ' + red.rechazados());
  console.log('RED DEVUELTA  ' + JSON.stringify(deVuelta));
  const ok = estado.sw && conRed.directa === 200 && conRed.porElSW === 200 && cortada(sinRed) && deVuelta.directa === 200 && deVuelta.porElSW === 200;
  console.log(ok ? '✓ el corte corta, también al service worker' : '✗ NO SUPE MIRAR: el corte no se comporta como un sótano');
  salida = ok ? 0 : 2;
  volcar('control');
} finally {
  await cerrar();
}
process.exit(salida);
