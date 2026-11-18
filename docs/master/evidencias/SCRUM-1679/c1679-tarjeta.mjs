// SCRUM-1679 · la tarjeta de la lista de Trabajos, ANTES y DESPUÉS, en la página real de yaqu.app.
//
// Acción del banco H6 (`docs/master/evidencias/SCRUM-1686/banco-h6/paso2.mjs`):
//   ANTES    BANCO_OUT=<fuera del repo> node …/paso2.mjs <ancho> "#jobs" antes   <este fichero>
//   DESPUÉS  LOCAL_DIR=<raíz del árbol> BANCO_OUT=… node …/paso2.mjs <ancho> "#jobs" despues <este fichero>
//
// Con LOCAL_DIR sirve `js/jobsView.js` y `css/styles.css` del árbol ENCIMA de producción (datos reales
// de la cuenta QA, todo lo demás de yaqu.app) y recarga: ir al mismo hash no vuelve a pedir los
// ficheros (SCRUM-1746). El TESTIGO dice qué código corre: cuántas tarjetas pintan tarea o dirección.
//
// NO ESCRIBE: lee la lista y fotografía. No pulsa «Nuevo trabajo» (crearía un trabajo de verdad).
// SUELO: sin tarjetas, CIEGO (código 1). Con LOCAL_DIR y cero tarjetas con tarea o dirección, CIEGO:
// o los ficheros locales no se sirvieron, o la cuenta no tiene ningún trabajo que las lleve.
import fs from 'node:fs';
import path from 'node:path';

const SERVIDOS = [['js/jobsView.js', 'application/javascript'], ['css/styles.css', 'text/css']];

const leerTarjetas = () => [...document.querySelectorAll('tr.jobs-fila')].map((tr) => {
  const c = tr.querySelector('td.cell-client');
  const de = (sel) => { const e = c && c.querySelector(sel); return e ? e.textContent.trim() : null; };
  const corte = (sel) => { const e = c && c.querySelector(sel); return e ? { alto: Math.round(e.getBoundingClientRect().height), cortado: e.scrollHeight > e.clientHeight + 1, lineas: Math.round(e.getBoundingClientRect().height / parseFloat(getComputedStyle(e).lineHeight)) } : null; };
  const r = tr.getBoundingClientRect();
  return {
    cliente: de('.jobs-fila-cliente'), tarea: de('.jobs-fila-tarea'), linea: de('.jobs-fila-linea'), direccion: de('.jobs-fila-direccion'),
    corteTarea: corte('.jobs-fila-tarea'), corteDireccion: corte('.jobs-fila-direccion'),
    tarjeta: { izq: Math.round(r.left), der: Math.round(r.right), alto: Math.round(r.height) },
    botones: [...tr.querySelectorAll('button')].filter((b) => b.getBoundingClientRect().width > 0).map((b) => `${b.textContent.trim()}|${b.className}`),
  };
});

export default async (s, h) => {
  const p = s.page;
  const local = process.env.LOCAL_DIR;
  if (local) {
    for (const [f, tipo] of SERVIDOS) {
      const ruta = path.join(local, 'public', 'dashboard', f);
      const cuerpo = fs.readFileSync(ruta, 'utf8');
      await p.route((u) => u.pathname.endsWith('/dashboard/' + f), (r) => r.fulfill({ status: 200, contentType: tipo, body: cuerpo }));
      s.nota(`LOCAL ${f} ← ${ruta} (${cuerpo.length} caracteres)`);
    }
    await p.reload({ waitUntil: 'networkidle' });
    await p.waitForTimeout(1200);
  } else {
    s.nota('SIN LOCAL_DIR: se mide lo que sirve producción');
  }
  const tarjetas = await p.evaluate(leerTarjetas);
  if (!tarjetas.length) throw new Error('CIEGO: la lista no pinta ninguna tarjeta (tr.jobs-fila)');
  const conTarea = tarjetas.filter((t) => t.tarea).length;
  const conDireccion = tarjetas.filter((t) => t.direccion).length;
  const pagina = await p.evaluate(() => ({ ancho: window.innerWidth, desborde: document.documentElement.scrollWidth - window.innerWidth }));
  s.nota(`TESTIGO @${s.ancho}: ${tarjetas.length} tarjetas · con tarea ${conTarea} · con dirección ${conDireccion} · desborde de la página ${pagina.desborde}`);
  for (const t of tarjetas) s.nota('TARJETA ' + JSON.stringify(t));
  const fuera = tarjetas.filter((t) => t.tarjeta.izq < 0 || t.tarjeta.der > pagina.ancho + 1);
  await s.mide('lista');
  if (local && !conTarea && !conDireccion) throw new Error('CIEGO: con LOCAL_DIR ninguna tarjeta pinta tarea ni dirección');
  if (pagina.desborde > 0 || fuera.length) throw new Error(`ROJO: la página desborda ${pagina.desborde} px o ${fuera.length} tarjeta(s) se salen de lado`);
};
