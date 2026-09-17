// docs/master/evidencias/SCRUM-307/sin-red/preparar.mjs — CON RED: deja listos los datos de prueba.
//
//   E2E_TEST_LOGIN_SECRET=… node docs/master/evidencias/SCRUM-307/sin-red/preparar.mjs --trabajo <id>
//
// ⚠️ ESCRIBE en staging, sobre el Trabajo que se le pase (que debe ser de prueba y tener presupuesto
// aceptado): crea un albarán con las líneas que propone la pantalla y lo EMITE (la precarga solo baja
// albaranes emitidos: un borrador no se firma), y crea un parte con una línea (sin líneas no se firma).
// Imprime los ids para recorrido-sin-red.mjs.
import { arrancar, entrar, calentar, dormir, pulsar, argumento, BASE } from './_conductor.mjs';

const trabajo = Number(argumento('trabajo'));
if (!trabajo) { console.error('Uso: preparar.mjs --trabajo <id de un Trabajo de prueba>'); process.exit(2); }

const { page, volcar, cerrar } = await arrancar();
try {
  await entrar(page);
  await calentar(page);
  const api = (ruta, opciones = {}) => page.evaluate(async (ruta, opciones) => {
    const r = await fetch(ruta, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...opciones });
    return { status: r.status, json: await r.json().catch(() => null) };
  }, ruta, opciones);

  const antes = new Set(((await api('/admin/albaranes')).json?.filas || []).map((a) => a.id));
  await page.evaluate((id) => window.renderAppView('jobs-detail', { jobId: id }), trabajo);
  await dormir(4000);
  if (!(await pulsar(page, '+ Nuevo albarán'))) throw new Error('no encuentro «+ Nuevo albarán» en el Trabajo');
  await dormir(2000);
  if (!(await pulsar(page, 'Crear albarán'))) throw new Error('no encuentro «Crear albarán»');
  await dormir(4000);
  const nuevo = ((await api('/admin/albaranes')).json?.filas || []).find((a) => !antes.has(a.id) && a.jobId === trabajo);
  if (!nuevo) throw new Error('no se creó el albarán');
  const emitido = await api(`/admin/albaranes/${nuevo.id}/emitir`, { method: 'POST', body: '{}' });
  console.log(`albarán ${nuevo.id} (${nuevo.numero}) creado · emitir → ${emitido.status}`);

  const parte = await api('/admin/partes', { method: 'POST', body: JSON.stringify({ jobId: trabajo }) });
  const parteId = parte.json?.id;
  const linea = await api(`/admin/partes/${parteId}`, { method: 'PATCH', body: JSON.stringify({ lineas: [{ bloque: 'mano_obra', unds: 1, descripcion: 'Línea de prueba con red (banco sin red)' }] }) });
  console.log(`parte ${parteId} creado → ${parte.status} · línea → ${linea.status}`);
  console.log(`\nSiguiente: recorrido-sin-red.mjs --albaran ${nuevo.id} --parte ${parteId} --trabajo ${trabajo} [--firmar]`);
  console.log(`(staging: ${BASE})`);
  volcar('preparar');
} finally {
  await cerrar();
}
