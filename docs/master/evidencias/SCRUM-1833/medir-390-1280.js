// docs/master/evidencias/SCRUM-1833/medir-390-1280.js — lo que corrió jv-j2fi (26-nov-2026) con
// `browser_run_code_unsafe` del MCP de Playwright sobre las páginas de `pagina.mjs`, servidas en 127.0.0.1:47833
// por un servidor estático cualquiera. Por cada estado y ancho: desbordamiento horizontal, filas, «Eliminar»,
// objetivos táctiles < 44 px dentro de la pestaña, y la captura `<estado>-<ancho>.png` en esta carpeta.
async (page) => {
  const DIR = 'docs/master/evidencias/SCRUM-1833/';
  const out = [];
  for (const estado of ['lista', 'alta', 'editar', 'tecnico', 'vacio', 'error']) {
    for (const ancho of [390, 1280]) {
      await page.setViewportSize({ width: ancho, height: 900 });
      const resp = await page.goto(`http://127.0.0.1:47833/${estado}.html`);
      await page.waitForTimeout(150);
      const m = await page.evaluate(() => {
        const de = document.documentElement;
        const sel = 'button, input, select, textarea, a[href]';
        const raiz = document.querySelector('[data-accion="nuevo-equipo"]')?.parentElement?.parentElement || document.body;
        const pequenos = [...raiz.querySelectorAll(sel)].filter((n) => n.offsetParent !== null).map((n) => {
          const r = n.getBoundingClientRect();
          return { q: (n.dataset.accion || n.id || n.textContent || n.type || '').trim().slice(0, 30), w: Math.round(r.width), h: Math.round(r.height) };
        }).filter((x) => x.h < 44 || x.w < 44);
        const fueraDerecha = [...document.querySelectorAll('li[data-equipo] *')].filter((n) => n.getBoundingClientRect().right > window.innerWidth + 0.5).length;
        return { scroll: de.scrollWidth, vista: de.clientWidth, interactivos: [...raiz.querySelectorAll(sel)].length, pequenos, fueraDerecha,
          filas: document.querySelectorAll('li[data-equipo]').length, eliminar: document.querySelectorAll('[data-accion="eliminar"]').length };
      });
      await page.screenshot({ path: `${DIR}${estado}-${ancho}.png`, fullPage: true });
      out.push(`${estado}@${ancho} http ${resp.status()} · scroll ${m.scroll}/${m.vista} · filas ${m.filas} · eliminar ${m.eliminar} · interactivos ${m.interactivos} · <44: ${JSON.stringify(m.pequenos)} · se salen ${m.fueraDerecha}`);
    }
  }
  return out.join('\n');
}
