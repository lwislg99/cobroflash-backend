// SCRUM-1739 (+ mitad-tarjeta de SCRUM-1749) · qué botón pesa en cada tarjeta de la lista de Trabajos,
// ANTES y DESPUÉS, en la página real de yaqu.app.
//
// Acción del banco H6 (`docs/master/evidencias/SCRUM-1686/banco-h6/paso2.mjs`):
//   ANTES    BANCO_OUT=<fuera del repo> node …/paso2.mjs <ancho> "#jobs" antes   <este fichero>
//   DESPUÉS  LOCAL_DIR=<raíz del árbol> BANCO_OUT=… node …/paso2.mjs <ancho> "#jobs" despues <este fichero>
//
// Con LOCAL_DIR sirve `js/jobsView.js` del árbol ENCIMA de producción (datos reales de la cuenta QA, todo
// lo demás de yaqu.app) y recarga. Mismo mecanismo que `SCRUM-1679/c1679-tarjeta.mjs`.
//
// NO ESCRIBE: lee y fotografía. No pulsa ningún botón («▶ Empezar» escribiría `en_curso` con un clic).
//
// Lo que mide, por tarjeta y en el orden en que se VE (arriba-abajo, izquierda-derecha), no en el del DOM:
//   · el grupo bajo el que cae y el rótulo, la clase y el relleno CALCULADO de cada botón visible;
//   · cuántas rellenas (`.btn-primary`) lleva.
// SUELO: sin tarjetas, CIEGO. CONTROL POSITIVO: la cuenta QA tiene trabajos EN CURSO, y «Abrir parte» es
// rellena desde SCRUM-1700: si ninguna tarjeta la trae rellena, el instrumento no ve el relleno → CIEGO.
// Con LOCAL_DIR, además: si ningún «▶ Empezar» sale relleno, o no se sirvió el fichero local o la cuenta
// no tiene ningún trabajo agendado → CIEGO (no se lee como «no cambia nada»).
import fs from 'node:fs';
import path from 'node:path';
// QUIÉN ABRE EL CONTEXTO DE ESTA ACCIÓN: el banco de SCRUM-1658 (`abrir`, con `serviceWorkers: 'block'`).
// Esta acción llama a `.route(` sobre yaqu.app y no abre navegador: sin service worker bloqueado, lo
// interceptado puede no pasar por aquí y la petición sale a producción (SCRUM-1233). Se importa el MISMO
// módulo que importa `paso2.mjs`, y abajo se comprueba que es el que nos han pasado: si alguien corre esta
// acción desde otro lanzador, para en vez de interceptar a ciegas. Lo vigila `tests/scrum1233g-…`.
import * as banco from '../SCRUM-1658/banco/lib.mjs';

const SERVIDOS = [['js/jobsView.js', 'application/javascript']];

const leer = () => {
  const out = [];
  for (const tbody of document.querySelectorAll('tbody.jobs-grupo')) {
    const t = tbody.querySelector('tr.jobs-grupo-titulo');
    const grupo = t ? t.textContent.replace(/\s+/g, ' ').trim() : '?';
    for (const tr of tbody.querySelectorAll('tr.jobs-fila')) {
      if (tr.getBoundingClientRect().height === 0) continue;
      const celda = tr.querySelector('.jobs-celda-acciones');
      const botones = [...(celda ? celda.querySelectorAll('button, summary') : [])]
        .filter((b) => b.getBoundingClientRect().width > 0)
        .map((b) => {
          const r = b.getBoundingClientRect();
          const cs = getComputedStyle(b);
          return {
            rotulo: b.textContent.replace(/\s+/g, ' ').trim(), clase: b.className,
            fondo: cs.backgroundColor, x: Math.round(r.left), y: Math.round(r.top), ancho: Math.round(r.width), alto: Math.round(r.height),
            rellena: b.classList.contains('btn-primary'),
          };
        })
        .sort((a, b) => (Math.abs(a.y - b.y) > 6 ? a.y - b.y : a.x - b.x));
      const cliente = tr.querySelector('.jobs-fila-cliente');
      out.push({ grupo, cliente: cliente ? cliente.textContent.trim() : null, botones });
    }
  }
  return out;
};

// ── SIMULA_AGENDADO=1 · DOS TRABAJOS AGENDADOS QUE LA CUENTA QA NO TIENE ─────────────────────────
// Medido el 18-nov-2026: la cuenta QA no tiene NINGÚN trabajo agendado (0 «▶ Empezar» en 8 tarjetas),
// y agendar uno de verdad escribe en producción. Con SIMULA_AGENDADO=1 se cambia EN EL NAVEGADOR la
// respuesta de `GET /admin/jobs`: los dos primeros `pendiente_agendar` pasan a `agendado`, uno para
// HOY y otro para dentro de tres días. No se escribe nada en el servidor, y cada nota lo DECLARA con
// el id del trabajo. Lo que se fotografía es el código (el de producción o el del árbol) pintando un
// estado que el servidor no tiene: vale para ver el botón, no como prueba de datos.
async function simularAgendados(s) {
  const tocados = [];
  await s.page.route((u) => u.pathname === '/admin/jobs', async (r) => {
    if (r.request().method() !== 'GET') return r.continue();
    const resp = await r.fetch();
    let cuerpo;
    try { cuerpo = await resp.json(); } catch { return r.fulfill({ response: resp }); }
    const lista = Array.isArray(cuerpo) ? cuerpo : (cuerpo && (cuerpo.jobs || cuerpo.items)) || [];
    const sin = lista.filter((j) => j && j.status === 'pendiente_agendar').slice(0, 2);
    const hoy = new Date(); hoy.setHours(23, 30, 0, 0);
    const luego = new Date(hoy.getTime() + 3 * 864e5); luego.setHours(10, 0, 0, 0);
    sin.forEach((j, i) => { j.status = 'agendado'; j.scheduledAt = (i ? luego : hoy).toISOString(); if (!tocados.includes(j.id)) tocados.push(j.id); });
    return r.fulfill({ response: resp, json: cuerpo });
  });
  return tocados;
}

export default async (s, h) => {
  if (h !== banco) throw new Error('CIEGO: esta acción no corre sobre el banco de SCRUM-1658 (el que bloquea el service worker); no intercepto sin él');
  const p = s.page;
  const local = process.env.LOCAL_DIR;
  const simula = process.env.SIMULA_AGENDADO === '1';
  const tocados = simula ? await simularAgendados(s) : null;
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
    if (simula) { await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(1200); }
  }
  if (simula) {
    if (!tocados.length) throw new Error('CIEGO: SIMULA_AGENDADO=1 y no se cambió ningún trabajo (¿`GET /admin/jobs` no pasó por aquí, o no hay `pendiente_agendar`?)');
    s.nota(`SIMULADO Y DECLARADO: los trabajos ${tocados.map((i) => '#' + i).join(' y ')} se pintan como AGENDADOS (hoy y +3 días) cambiando la respuesta de GET /admin/jobs en el navegador; en el servidor siguen sin agendar. Cero escrituras.`);
  }
  const tarjetas = await p.evaluate(leer);
  if (!tarjetas.length) throw new Error('CIEGO: la lista no pinta ninguna tarjeta (tbody.jobs-grupo tr.jobs-fila)');
  const corto = (b) => `${b.rellena ? '■' : '□'}${b.rotulo}`;
  for (const t of tarjetas) s.nota(`TARJETA [${t.grupo}] ${t.cliente} → ${t.botones.map(corto).join(' · ')}`);
  for (const t of tarjetas) for (const b of t.botones.filter((x) => x.rellena)) s.nota(`RELLENA «${b.rotulo}» clase=«${b.clase}» fondo=${b.fondo} ${b.ancho}x${b.alto} @(${b.x},${b.y})`);
  const todas = tarjetas.flatMap((t) => t.botones);
  const rellenas = todas.filter((b) => b.rellena);
  const dobles = tarjetas.filter((t) => t.botones.filter((b) => b.rellena).length > 1);
  const empezar = todas.filter((b) => b.rotulo === '▶ Empezar');
  const agendar = todas.filter((b) => b.rotulo === 'Agendar');
  const parte = todas.filter((b) => b.rotulo === 'Abrir parte');
  const cobrar = todas.filter((b) => b.rotulo.startsWith('💰 Cobrar el resto'));
  const cuenta = (l) => `${l.filter((b) => b.rellena).length}/${l.length}`;
  // ¿La rellena es lo PRIMERO que se ve en su tarjeta?
  const noPrimera = tarjetas.filter((t) => t.botones.some((b) => b.rellena) && !t.botones[0].rellena);
  s.nota(`TESTIGO @${s.ancho}: ${tarjetas.length} tarjetas · rellenas ${rellenas.length} · tarjetas con DOS rellenas ${dobles.length}`
    + ` · rellenas/total → «▶ Empezar» ${cuenta(empezar)} · «Agendar» ${cuenta(agendar)} · «Abrir parte» ${cuenta(parte)} · «Cobrar el resto» ${cuenta(cobrar)}`
    + ` · tarjetas cuya rellena NO va primera ${noPrimera.length}`);
  for (const t of noPrimera) s.nota(`NO-PRIMERA [${t.grupo}] ${t.cliente}: ${t.botones.map(corto).join(' · ')}`);
  await s.mide('lista');
  if (!parte.some((b) => b.rellena)) throw new Error('CIEGO: ninguna tarjeta trae «Abrir parte» rellena (control positivo de SCRUM-1700): el instrumento no ve el relleno o la cuenta no tiene trabajos EN CURSO');
  if (local && !empezar.some((b) => b.rellena)) throw new Error(`CIEGO: con LOCAL_DIR ningún «▶ Empezar» sale relleno (${empezar.length} «▶ Empezar» en la lista): o no se sirvió el fichero local o no hay trabajos agendados`);
  if (dobles.length) throw new Error(`ROJO: ${dobles.length} tarjeta(s) con DOS rellenas`);
  if (agendar.some((b) => b.rellena)) throw new Error('ROJO: «Agendar» sale rellena (c.22030: se queda secundaria)');
};
