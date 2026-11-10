// SCRUM-962d · LA CABECERA DE LOS MODALES, ANTES Y DESPUÉS. Sólo lee el árbol.
//
// Monta `cabeceraModal` (el `modalHeader.js` REAL, con `tokens.css` + `styles.css` REALES) dentro de
// `.modal-overlay > .modal`, con un `.modal-body` que empieza por un campo, en las variantes que tiene el
// producto (título corto, medio, largo que parte en dos líneas, y `sinCierre`) y a 320, 390 y 929 px.
// Mide, para cada caso:
//   · el ALTO de la cabecera y la caja del título (¿se ha descolocado algo?);
//   · la caja VISIBLE del «?» y del «×» (¿se ve igual?);
//   · el ÁREA EFECTIVA de cada botón en las DOS dimensiones: hasta dónde, desde su centro, el punto sigue
//     siendo suyo según `elementFromPoint(...).closest('button')` — el árbitro del censo, en horizontal
//     y en vertical;
//   · que los dos botones no se pisen, y que el primer campo del cuerpo siga siendo suyo en su borde de arriba.
// CONTROL POSITIVO: un botón-sonda de 12 px en la misma cabecera tiene que salir con área < 44.
// Uso: node cabecera-banco.mjs <raiz> <salida.json>
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const RAIZ = path.resolve(process.argv[2]);
const imp = (p) => import(pathToFileURL(path.join(RAIZ, p)).href);
const puppeteer = (await import(pathToFileURL(createRequire(path.join(RAIZ, 'package.json')).resolve('puppeteer-core')).href)).default;
const { lanzarNavegador } = await imp('scripts/_navegador.mjs');
const PUBLIC = path.join(RAIZ, 'public');

const VARIANTES = [
  { id: 'corto', o: { titulo: 'Ajustes de la línea' } },
  { id: 'medio', o: { titulo: '✨ Sugerir líneas con IA', idCierre: 'x1' } },
  { id: 'largo', o: { titulo: 'Facturar lo entregado · ALB-2026-000123 · Reforma integral del baño de la comunidad' } },
  { id: 'sinCierre', o: { titulo: 'Editar cliente', sinCierre: true } },
  { id: 'sonda', o: { titulo: 'Sonda' }, sonda: true },
];
const pagina = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="/tokens.css"><link rel="stylesheet" href="/dashboard/css/styles.css"></head><body>
<script src="/dashboard/js/modalHeader.js"></script>
<script>
window.__montar = (o, sonda) => {
  document.querySelectorAll('.modal-overlay').forEach((n) => n.remove());
  const ov = document.createElement('div'); ov.className = 'modal-overlay';
  const m = document.createElement('div'); m.className = 'modal';
  const h = window.cabeceraModal(o);
  if (sonda) { const s = document.createElement('button'); s.id = '__sonda'; s.textContent = '.'; s.style.cssText = 'width:12px;height:12px;padding:0;border:0'; h.prepend(s); } // delante del título: detrás del «×» la tapa su área (que es lo que se quiere)
  m.appendChild(h);
  const b = document.createElement('div'); b.className = 'modal-body';
  b.innerHTML = '<div class="field"><label for="__c">Nombre</label><input id="__c" class="input" type="text"></div>';
  m.appendChild(b); ov.appendChild(m); document.body.appendChild(ov);
};
window.__area = (el) => {
  const r = el.getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const suyo = (x, y) => { const t = document.elementFromPoint(x, y); return !!t && t.closest('button') === el; };
  if (!suyo(cx, cy)) return { error: 'el centro no es suyo' };
  const hasta = (dx, dy) => { let d = 0; while (d < 80 && suyo(cx + dx * (d + 0.5), cy + dy * (d + 0.5))) d += 0.5; return d; };
  const arriba = hasta(0, -1), abajo = hasta(0, 1), izq = hasta(-1, 0), der = hasta(1, 0);
  return { alto: +(arriba + abajo).toFixed(1), ancho: +(izq + der).toFixed(1), arriba, abajo, izq, der };
};
window.__medir = () => {
  const h = document.querySelector('.modal-header'), t = h.querySelector('.modal-title');
  const caja = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); return { x: +r.left.toFixed(1), y: +r.top.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) }; };
  const ay = h.querySelector('.modal-ayuda'), ce = h.querySelector('.modal-close'), so = document.getElementById('__sonda');
  const campo = document.getElementById('__c'); const cr = campo.getBoundingClientRect();
  const out = { cabecera: caja(h), titulo: caja(t), ayuda: caja(ay), cerrar: caja(ce),
    areaAyuda: ay ? window.__area(ay) : null, areaCerrar: ce ? window.__area(ce) : null, areaSonda: so ? window.__area(so) : null,
    // el campo de debajo: su borde de arriba (1 px dentro) en tres puntos, ¿sigue siendo suyo?
    campoLibre: [0.05, 0.5, 0.95].every((f) => document.elementFromPoint(cr.left + cr.width * f, cr.top + 1) === campo) };
  // ¿se pisan? El punto medio entre el borde derecho del «?» y el izquierdo del «×»: debe ser de uno de los dos.
  if (ay && ce) {
    const ra = ay.getBoundingClientRect(), rc = ce.getBoundingClientRect();
    const xm = (ra.right + rc.left) / 2, ym = (ra.top + ra.bottom) / 2;
    const t2 = document.elementFromPoint(xm, ym);
    out.entreLosDos = t2 ? (t2.closest('button') === ay ? 'ayuda' : t2.closest('button') === ce ? 'cerrar' : t2.tagName) : null;
  }
  return out;
};
</script></body></html>`;
const srv = http.createServer((rq, res) => {
  const u = rq.url.split('?')[0];
  if (u === '/banco') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(pagina); }
  const d = path.join(PUBLIC, u.replace(/^\/+/, ''));
  if (!d.startsWith(PUBLIC) || !fs.existsSync(d)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': d.endsWith('.css') ? 'text/css; charset=utf-8' : d.endsWith('.js') ? 'text/javascript' : 'application/octet-stream' });
  return res.end(fs.readFileSync(d));
});
const PUERTO = await new Promise((ok) => srv.listen(0, '127.0.0.1', () => ok(srv.address().port)));
const nav = await lanzarNavegador(puppeteer, {});
const res = [];
try {
  for (const ancho of [320, 390, 929]) {
    const page = await nav.newPage();
    await page.setViewport({ width: ancho, height: 900 });
    await page.goto(`http://127.0.0.1:${PUERTO}/banco`, { waitUntil: 'load' });
    for (const v of VARIANTES) {
      await page.evaluate((o, s) => window.__montar(o, s), v.o, !!v.sonda);
      // En móvil el modal ENTRA deslizando (`slide-from-bottom`, 0,22 s): medir antes es medir a mitad de camino.
      await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'), { timeout: 3000 });
      res.push({ ancho, variante: v.id, ...(await page.evaluate(() => window.__medir())) });
      // La CAPTURA de la cabecera (con el ratón fuera): ¿se ve igual? Se compara byte a byte entre antes y después.
      if (process.env.CAPTURAS && !v.sonda) { await page.mouse.move(1, 1); const h = await page.$('.modal-header'); await h.screenshot({ path: path.join(process.env.CAPTURAS, `${v.id}-${ancho}.png`) }); }
    }
    await page.close();
  }
} finally { await nav.close(); srv.close(); }
fs.writeFileSync(process.argv[3], JSON.stringify(res, null, 1));
for (const r of res) {
  const a = r.areaAyuda, c = r.areaCerrar;
  console.log(`@${String(r.ancho).padEnd(3)} ${r.variante.padEnd(9)} cabecera ${r.cabecera.h} · título ${r.titulo.h} · ` +
    (r.variante === 'sonda' ? `SONDA área ${r.areaSonda.alto}×${r.areaSonda.ancho} (tiene que ser <44)` :
      `«?» caja ${r.ayuda ? r.ayuda.w + '×' + r.ayuda.h + ' área ' + a.ancho + '×' + a.alto : '—'} · «×» caja ${r.cerrar ? r.cerrar.w + '×' + r.cerrar.h + ' área ' + c.ancho + '×' + c.alto : '—'} · entre ${r.entreLosDos ?? '—'} · campo libre ${r.campoLibre}`));
}
