// SCRUM-1751 · regla 42 · el aviso «¿Empezar una visita nueva?» con el CÓDIGO que sirve yaqu.app, por sus dos puertas.
//
//   BANCO_OUT=<fuera del repo> JOB=84 node docs/master/evidencias/SCRUM-1686/banco-h6/paso2.mjs 390 "#jobs" r42-aviso \
//     docs/master/evidencias/SCRUM-1751/r42-aviso-visita-nueva.mjs
//
// ⚠️ LO QUE ESTO ES Y LO QUE NO. El 18-nov-2026 la cuenta QA no tiene NINGÚN trabajo EN CURSO con el último
// parte firmado y sin borrador (el #84 tiene el borrador #23; el #77, tres). Para ver el aviso sin firmar ni
// borrar datos que usan otros bancos, este paso QUITA LOS BORRADORES de la respuesta de `GET /admin/partes`
// EN EL NAVEGADOR: el código es el de producción y los datos son los reales MENOS los borradores. Dice cuántos
// quitó; si no quitó ninguno o no quedó ningún firmado, CIEGO. Lo que NO prueba: «Crear parte nuevo» (no se pulsa).
// «Cancelar» no crea: se mira que no salga NINGUNA escritura hacia /admin/partes mientras el aviso está abierto.
// El contexto lo abre el banco de SCRUM-1658 (`abrir`, con `serviceWorkers: 'block'`) a través de
// `paso2.mjs` → `rol.mjs`. Se importa aquí, fijo, porque esta acción intercepta yaqu.app con `.route(`
// y eso sólo vale si el SW no puede pedir por su cuenta (SCRUM-1233g: el guard lo exige).
import { OUT } from '../SCRUM-1658/banco/lib.mjs';

const LITERALES = {
  titulo: '¿Empezar una visita nueva?',
  cuerpo: 'El último parte de este trabajo ya está firmado. Si sigues, se crea un parte nuevo para otra visita.',
  crear: 'Crear parte nuevo',
  cancelar: 'Cancelar',
};
const JOB = Number(process.env.JOB || 84);

const leerAviso = () => {
  const o = [...document.querySelectorAll('.modal-overlay')].find((m) => m.getBoundingClientRect().width > 0);
  if (!o) return null;
  const panel = o.querySelector('.jobs-modal');
  const r = panel.getBoundingClientRect();
  const botones = [...panel.querySelectorAll('button')].filter((b) => b.getBoundingClientRect().width > 0).map((b) => {
    const q = b.getBoundingClientRect();
    return { texto: b.textContent.trim(), ancho: Math.round(q.width * 10) / 10, alto: Math.round(q.height * 10) / 10, clase: b.className };
  });
  return {
    titulo: (panel.querySelector('.jobs-modal-titulo') || {}).textContent || null,
    cuerpo: (panel.querySelector('.jobs-modal-cuerpo') || {}).innerText || null,
    botones,
    panel: { izq: Math.round(r.left), der: Math.round(r.right), ancho: Math.round(r.width) },
    ventana: window.innerWidth,
    desbordeDeLaPagina: document.documentElement.scrollWidth - window.innerWidth,
    textoCortado: [...panel.querySelectorAll('*')].filter((e) => e.children.length === 0 && e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent.trim().slice(0, 40)),
  };
};

export default async (s, h) => {
  const p = s.page;
  s.nota(`SALIDA de las capturas: ${OUT}`);
  let quitados = 0; let firmados = 0; let pedidas = 0;
  await p.route((u) => u.pathname === '/admin/partes', async (ruta) => {
    if (ruta.request().method() !== 'GET') return ruta.continue();
    const real = await ruta.fetch();
    const cuerpo = await real.json();
    const lista = Array.isArray(cuerpo) ? cuerpo : cuerpo.partes;
    const sin = lista.filter((x) => x.estado !== 'borrador');
    quitados = lista.length - sin.length; firmados = sin.filter((x) => x.jobId === JOB && x.estado === 'firmado').length; pedidas++;
    await ruta.fulfill({ response: real, json: Array.isArray(cuerpo) ? sin : { ...cuerpo, partes: sin } });
  });
  const escriturasDePartes = () => s.escrituras.filter((e) => /\/admin\/partes/.test(e));
  const esperarQuieto = async () => { await p.waitForTimeout(700); };
  let fallos = 0;
  const comprobar = async (puerta) => {
    await esperarQuieto();
    const a = await p.evaluate(leerAviso);
    s.nota(`${puerta} @${s.ancho} · GET /admin/partes interceptadas=${pedidas} · borradores quitados=${quitados} · firmados del #${JOB}=${firmados}`);
    if (!pedidas || !quitados || !firmados) { fallos++; s.nota(`CIEGO ${puerta}: la intercepción no vio lo que tenía que ver`); }
    if (!a) { fallos++; s.nota(`ROJO ${puerta}: el aviso NO ha salido`); await s.mide(puerta + '-sin-aviso'); return; }
    s.nota(`AVISO ${puerta}: ${JSON.stringify(a)}`);
    const textos = a.botones.map((b) => b.texto);
    const ok = a.titulo === LITERALES.titulo && String(a.cuerpo).trim() === LITERALES.cuerpo && textos.includes(LITERALES.crear) && textos.includes(LITERALES.cancelar);
    const cuarentaYCuatro = a.botones.every((b) => b.alto >= 44);
    const cabe = a.panel.izq >= 0 && a.panel.der <= a.ventana && a.desbordeDeLaPagina <= 0 && !a.textoCortado.length;
    s.nota(`VEREDICTO ${puerta}: literales exactos=${ok} · botones ≥44 de alto=${cuarentaYCuatro} · cabe=${cabe}`);
    if (!ok || !cabe || (s.ancho < 600 && !cuarentaYCuatro)) fallos++;
    await s.mide(puerta + '-aviso');
    const antes = escriturasDePartes().length;
    await p.locator('.jobs-modal button', { hasText: LITERALES.cancelar }).first().click();
    await esperarQuieto();
    const sigue = await p.evaluate(leerAviso);
    const despues = escriturasDePartes().length;
    s.nota(`CANCELAR ${puerta}: aviso cerrado=${!sigue} · escrituras a /admin/partes antes=${antes} después=${despues} · hash=${new URL(p.url()).hash}`);
    if (sigue || despues !== antes) fallos++;
  };

  // Puerta 1 · la lista: «Abrir parte» en la tarjeta de un trabajo EN CURSO.
  const abrir = p.locator('button', { hasText: /^\s*Abrir parte\s*$/ }).filter({ visible: true });
  const cuantos = await abrir.count();
  s.nota(`LISTA: ${cuantos} botón(es) «Abrir parte» a la vista`);
  if (!cuantos) throw new Error('CIEGO: la lista no ofrece «Abrir parte»');
  // El del trabajo pedido, si la tarjeta lleva su enlace; si no, el primero, y se dice cuál.
  let elegido = abrir.first();
  for (let i = 0; i < cuantos; i++) {
    const cerca = await abrir.nth(i).evaluate((b, job) => {
      let e = b; for (let k = 0; k < 8 && e; k++) { if (e.outerHTML.slice(0, 600).includes('jobs-detail/' + job) || e.getAttribute('data-job-id') === String(job) || e.getAttribute('data-id') === String(job)) return true; e = e.parentElement; }
      return false;
    }, JOB);
    if (cerca) { elegido = abrir.nth(i); s.nota(`LISTA: el botón ${i + 1} es el de la tarjeta del #${JOB}`); break; }
  }
  await elegido.scrollIntoViewIfNeeded();
  await elegido.click();
  await comprobar('lista');

  // Puerta 2 · la ficha: «+ Nuevo parte».
  await h.ir(p, '#jobs-detail/' + JOB);
  await p.waitForTimeout(900);
  const nuevo = p.locator('button', { hasText: '+ Nuevo parte' }).filter({ visible: true }).first();
  if (!(await nuevo.count())) throw new Error('CIEGO: la ficha del #' + JOB + ' no ofrece «+ Nuevo parte»');
  await nuevo.scrollIntoViewIfNeeded();
  await nuevo.click();
  await comprobar('ficha');

  if (escriturasDePartes().length) throw new Error('EL BANCO HA ESCRITO en /admin/partes: ' + escriturasDePartes().join(' ; '));
  if (fallos) throw new Error(`${fallos} comprobación(es) en rojo o ciegas: léelas arriba`);
};
