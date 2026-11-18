// SCRUM-1670c · el tipo de intervención en la tarjeta de la lista de Trabajos, ANTES y DESPUÉS, en yaqu.app.
//
// Acción del banco H6 (`docs/master/evidencias/SCRUM-1686/banco-h6/paso2.mjs`):
//   ANTES    BANCO_OUT=<fuera del repo> node …/paso2.mjs <ancho> "#jobs" antes   <este fichero>
//   DESPUÉS  LOCAL_DIR=<raíz del árbol> BANCO_OUT=… node …/paso2.mjs <ancho> "#jobs" despues <este fichero>
//
// Con LOCAL_DIR sirve `js/jobsView.js` y `css/styles.css` del árbol ENCIMA de producción (datos reales de
// la cuenta QA, todo lo demás de yaqu.app) y recarga. Mismo mecanismo que `SCRUM-1679/c1679-tarjeta.mjs`.
//
// NO ESCRIBE: lee la lista y fotografía.
//
// Lo que mide, por tarjeta: el renglón del tipo (`.jobs-fila-tipo`), si su texto ES un rótulo del
// vocabulario que el servidor dio a la página (`window.appTiposIntervencion`), en qué orden cae respecto al
// cliente, la tarea y la dirección, y su cuerpo, color y líneas CALCULADOS al lado de los de la dirección
// (la decisión es «la misma regla que la dirección»: se comparan, no se suponen).
// SUELO: sin tarjetas, CIEGO. Vocabulario vacío en la página, CIEGO (no habría con qué comparar).
// CONTROL: con LOCAL_DIR y ninguna tarjeta con tipo → CIEGO (o no se sirvió el fichero local, o la cuenta no
// tiene ningún trabajo con tipo de intervención; el 18-nov-2026 lo lleva el trabajo QA #86).
import fs from 'node:fs';
import path from 'node:path';
// QUIÉN ABRE EL CONTEXTO DE ESTA ACCIÓN: el banco de SCRUM-1658 (`abrir`, con `serviceWorkers: 'block'`).
// Esta acción llama a `.route(` sobre yaqu.app y no abre navegador: sin service worker bloqueado, lo
// interceptado puede no pasar por aquí (SCRUM-1233). Se importa el MISMO módulo que importa `paso2.mjs`
// y abajo se comprueba que es el que nos han pasado. Lo vigila `tests/scrum1233g-…`.
import * as banco from '../SCRUM-1658/banco/lib.mjs';

const SERVIDOS = [['js/jobsView.js', 'application/javascript'], ['css/styles.css', 'text/css']];

const leer = () => {
  const vocabulario = (Array.isArray(window.appTiposIntervencion) ? window.appTiposIntervencion : []).map((t) => t && t.rotulo);
  const tarjetas = [...document.querySelectorAll('tr.jobs-fila')].map((tr) => {
    const c = tr.querySelector('td.cell-client');
    const de = (sel) => { const e = c && c.querySelector(sel); return e ? e.textContent.trim() : null; };
    const caja = (sel) => {
      const e = c && c.querySelector(sel); if (!e) return null;
      const cs = getComputedStyle(e);
      return { cuerpo: cs.fontSize, peso: cs.fontWeight, color: cs.color, lineas: Math.round(e.getBoundingClientRect().height / parseFloat(cs.lineHeight)), cortado: e.scrollHeight > e.clientHeight + 1 };
    };
    const r = tr.getBoundingClientRect();
    return {
      cliente: de('.jobs-fila-cliente'), tipo: de('.jobs-fila-tipo'), tarea: de('.jobs-fila-tarea'), direccion: de('.jobs-fila-direccion'),
      orden: c ? [...c.children].map((h) => h.className.split(' ')[0]).filter((n) => /^jobs-fila-(cliente|tipo|tarea|linea|direccion)$/.test(n)) : [],
      cajaTipo: caja('.jobs-fila-tipo'), cajaDireccion: caja('.jobs-fila-direccion'),
      tarjeta: { izq: Math.round(r.left), der: Math.round(r.right), alto: Math.round(r.height) },
    };
  });
  return { vocabulario, tarjetas, ancho: window.innerWidth, desborde: document.documentElement.scrollWidth - window.innerWidth };
};

export default async (s, h) => {
  if (h !== banco) throw new Error('CIEGO: esta acción no corre sobre el banco de SCRUM-1658 (el que bloquea el service worker); no intercepto sin él');
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
  const m = await p.evaluate(leer);
  if (!m.tarjetas.length) throw new Error('CIEGO: la lista no pinta ninguna tarjeta (tr.jobs-fila)');
  if (!m.vocabulario.length) throw new Error('CIEGO: la página no tiene vocabulario de tipos (window.appTiposIntervencion vacío)');
  const conTipo = m.tarjetas.filter((t) => t.tipo);
  const fueraDeVocabulario = conTipo.filter((t) => !m.vocabulario.includes(t.tipo));
  const malOrden = conTipo.filter((t) => t.orden[0] !== 'jobs-fila-cliente' || t.orden[1] !== 'jobs-fila-tipo');
  const distintoDeDireccion = conTipo.filter((t) => t.cajaDireccion && (t.cajaTipo.cuerpo !== t.cajaDireccion.cuerpo || t.cajaTipo.color !== t.cajaDireccion.color || t.cajaTipo.peso !== t.cajaDireccion.peso));
  s.nota(`VOCABULARIO de la página: ${m.vocabulario.join(' | ')}`);
  s.nota(`TESTIGO @${s.ancho}: ${m.tarjetas.length} tarjetas · con tipo ${conTipo.length} · tipo fuera del vocabulario ${fueraDeVocabulario.length} · tipo que NO va justo bajo el cliente ${malOrden.length} · tipo con cuerpo/color/peso distinto de la dirección ${distintoDeDireccion.length} · desborde de la página ${m.desborde}`);
  for (const t of m.tarjetas) s.nota('TARJETA ' + JSON.stringify(t));
  const fuera = m.tarjetas.filter((t) => t.tarjeta.izq < 0 || t.tarjeta.der > m.ancho + 1);
  await s.mide('lista');
  if (local && !conTipo.length) throw new Error('CIEGO: con LOCAL_DIR ninguna tarjeta pinta el tipo: o no se sirvió el fichero local o la cuenta no tiene ningún trabajo con tipo de intervención');
  if (fueraDeVocabulario.length) throw new Error(`ROJO: ${fueraDeVocabulario.length} tarjeta(s) pintan un tipo que no es un rótulo del vocabulario`);
  if (malOrden.length) throw new Error(`ROJO: en ${malOrden.length} tarjeta(s) el tipo no va justo debajo del cliente`);
  if (distintoDeDireccion.length) throw new Error(`ROJO: en ${distintoDeDireccion.length} tarjeta(s) el tipo no se pinta como la dirección`);
  if (m.desborde > 0 || fuera.length) throw new Error(`ROJO: la página desborda ${m.desborde} px o ${fuera.length} tarjeta(s) se salen de lado`);
};
