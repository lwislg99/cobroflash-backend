// scripts/capturas-presupuesto-desde-parte.mjs — SCRUM-915b
//
// LAS CAPTURAS DE «+ Nuevo presupuesto» EN EL PARTE FIRMADO, antes y después, a 390 y 1280, y del
// editor al que aterriza, con lo que el parte le pasó.
//
// Uso: `node scripts/capturas-presupuesto-desde-parte.mjs`  →  `docs/master/evidencias/SCRUM-915b/`
//
// Monta la ficha del parte en un navegador de verdad con los scripts REALES del panel
// (`_banco-lista.mjs`): el «antes» con el `public/` del punto de partida de la rama (`arbolDePartida`,
// contra merge-base) y el «después» con el del árbol. En el «después» PULSA el botón, lee lo que el
// panel recibió (`renderAppView` se apunta, no navega) y monta el editor REAL con ESO.
//
// Además de la foto, MIDE y lo dice: que el botón existe sólo en el «después», cuánto mide, que la
// página no se ensancha, y qué enseña el editor al abrir (cliente, conceptos, cantidades, precios).
// Sale con 1 si algo de eso no se cumple; con 2 si no supo mirar.
//
// ⚠️ Una captura no prueba el viaje: eso lo prueba `tests/scrum915b-presupuesto-desde-el-parte.test.mjs`.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { servirListas, abrirNavegador, abrirVista, arbolDePartida } from './_banco-lista.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DESTINO = path.join(RAIZ, 'docs', 'master', 'evidencias', 'SCRUM-915b');

// Teléfonos del rango imposible (prefijo 340, SCRUM-262): no pueden ser de nadie.
const CLIENTE = { id: 3, name: 'Comunidad Los Olivos', email: 'admin@losolivos.example', phone: '34000111222', mobile: null };
// Lo que sirve `GET /admin/partes/:id` (el del técnico: sin dinero), firmado por los dos.
const PARTE = {
  id: 13, jobId: 7, customerId: CLIENTE.id, numero: 'PT-2026-013', clienteNombre: CLIENTE.name,
  fecha: '2026-11-19T08:00:00.000Z', obra: 'Sala de calderas', referencia: '', entrada: '09:00', salida: '11:30',
  desplazamientos: 1, kilometros: 12, tecnicos: ['Israel'], tipo: 'averia',
  lineas: [
    { bloque: 'mano_obra', unds: 2, descripcion: 'Sustitución de la bomba de recirculación' },
    { bloque: 'mano_obra', unds: 0.5, descripcion: 'Purgado y puesta en marcha del circuito' },
    { bloque: 'materiales', unds: 1, descripcion: 'Bomba de recirculación 25-60' },
    { bloque: 'materiales', unds: 3, descripcion: 'Racor de latón 1"' },
  ],
  notas: '', estado: 'firmado',
  firmadoAt: '2026-11-19T11:35:00.000Z', firmadoPorNombre: 'Ana Ruiz', firmadoPorCalidad: null,
  firmadoTecnicoAt: '2026-11-19T11:33:00.000Z', firmadoTecnicoNombre: 'Israel',
  firmoElCliente: true, firmoElTecnico: true, firmasCompletas: true,
  puedeEditarContenido: { ok: false, motivo: 'firmado' }, puedeEditarPrecios: { ok: true, motivo: null },
};
const NEGOCIO = { id: 1, name: 'Fontanería Soler', timezone: 'Europe/Madrid', defaultCurrency: 'EUR', clausulasPresupuesto: [] };

const datosParte = `(function (ruta) {
  if (/\\/admin\\/partes\\/13$/.test(ruta)) return ${JSON.stringify(PARTE)};
  if (/\\/admin\\/merchant/.test(ruta)) return ${JSON.stringify(NEGOCIO)};
  return {};
})`;
const datosEditor = `(function (ruta) {
  if (/\\/admin\\/customers/.test(ruta)) return ${JSON.stringify([CLIENTE, { id: 4, name: 'Bar La Esquina', email: '', phone: '34000111333', mobile: null }])};
  if (/\\/admin\\/merchant/.test(ruta)) return ${JSON.stringify(NEGOCIO)};
  if (/\\/admin\\/products/.test(ruta)) return [];
  return {};
})`;

const QUIETO = "document.getAnimations().every((a) => a.playState !== 'running')";
const ANCHOS = [[390, 844], [1280, 900]];
let salida = 0;
const fallo = (codigo, texto) => { console.error('🔴 ' + texto); salida = Math.max(salida, codigo); };

const partida = arbolDePartida(RAIZ, 'antes-915b');
if (!partida.publico) {
  console.error('🔴 NO SUPE MIRAR: no se pudo resolver el punto de partida de la rama (merge-base); sin él no hay «antes».');
  process.exit(2);
}

fs.mkdirSync(DESTINO, { recursive: true });
const { browser } = await abrirNavegador(puppeteer);
const RUTA_PARTE = [{ ruta: '/parte', fnVista: 'renderParteDetailView', datos: datosParte, args: '[13]' }];
const antes = await servirListas(partida.publico, RUTA_PARTE);
const despues = await servirListas(path.join(RAIZ, 'public'), RUTA_PARTE);
const filas = [];
let template = null;

async function fotoDelParte(etiqueta, puerto, ancho, alto) {
  const { page, errores } = await abrirVista(browser, puerto, '/parte', ancho, alto);
  if (errores.length) fallo(1, `parte ${etiqueta} ${ancho}: errores en consola: ${errores.join(' | ')}`);
  if (!(await page.$('#view-container [data-parte-firmas]'))) { fallo(2, `NO SUPE MIRAR: parte ${etiqueta} ${ancho} no pinta la ficha del parte.`); await page.close(); return; }
  await page.waitForFunction(QUIETO, { timeout: 5000 }).catch(() => {});
  const m = await page.evaluate(() => {
    const b = document.querySelector('[data-parte-presupuesto]');
    const v = document.querySelector('[data-parte-volver-al-trabajo]');
    const caja = (n) => { if (!n) return null; const r = n.getBoundingClientRect(); return { ancho: Math.round(r.width), alto: Math.round(r.height), arriba: Math.round(r.top + window.scrollY) }; };
    return {
      boton: caja(b), texto: b ? b.textContent : null, clase: b ? b.className : null, volver: caja(v),
      desborda: document.documentElement.scrollWidth - window.innerWidth,
    };
  });
  const destino = path.join(DESTINO, `parte-${etiqueta}-${ancho}.png`);
  if (m.boton) await page.evaluate(() => document.querySelector('[data-parte-presupuesto]').scrollIntoView({ block: 'center' }));
  else if (m.volver) await page.evaluate(() => document.querySelector('[data-parte-volver-al-trabajo]').scrollIntoView({ block: 'center' }));
  await page.screenshot({ path: destino, fullPage: true });
  filas.push({ vista: 'parte', etiqueta, ancho, ...m });

  if (etiqueta === 'antes' && m.boton) fallo(1, `parte antes ${ancho}: el punto de partida YA tiene el botón; el «antes» no es un antes.`);
  if (etiqueta === 'despues') {
    if (!m.boton) fallo(1, `parte despues ${ancho}: no hay «+ Nuevo presupuesto».`);
    else {
      // Al pulgar, 44 px; en escritorio manda el vecino (medido: «Volver al trabajo» mide 36 a 1280).
      if (ancho <= 768 && m.boton.alto < 44) fallo(1, `parte despues ${ancho}: el botón mide ${m.boton.alto} px de alto (< 44).`);
      if (m.volver && m.boton.alto !== m.volver.alto) fallo(1, `parte despues ${ancho}: mide ${m.boton.alto} px de alto y «Volver al trabajo» ${m.volver.alto}.`);
      if (!m.volver || m.boton.arriba <= m.volver.arriba) fallo(1, `parte despues ${ancho}: el botón no va debajo de «Volver al trabajo».`);
      if (m.volver && m.boton.ancho !== m.volver.ancho) fallo(1, `parte despues ${ancho}: mide ${m.boton.ancho} px de ancho y «Volver al trabajo» ${m.volver.ancho}.`);
    }
    if (m.desborda > 0) fallo(1, `parte despues ${ancho}: la página se ensancha ${m.desborda} px.`);
    if (m.boton && !template) {
      await page.click('[data-parte-presupuesto]');
      const nav = await page.evaluate('window.__navegaciones');
      if (nav.length !== 1 || nav[0].vista !== 'quotes-new' || !nav[0].params || !nav[0].params.template) {
        fallo(1, `parte despues ${ancho}: el clic no abrió el editor con su plantilla: ${JSON.stringify(nav)}`);
      } else template = nav[0].params.template;
    }
  }
  await page.close();
}

try {
  for (const [ancho, alto] of ANCHOS) {
    await fotoDelParte('antes', antes.puerto, ancho, alto);
    await fotoDelParte('despues', despues.puerto, ancho, alto);
  }

  if (!template) fallo(2, 'NO SUPE MIRAR: sin lo que el parte le pasa al editor no hay editor que fotografiar.');
  else {
    const editor = await servirListas(path.join(RAIZ, 'public'), [
      { ruta: '/editor', fnVista: 'renderQuotesView', datos: datosEditor, args: JSON.stringify([template]) },
    ]);
    try {
      for (const [ancho, alto] of ANCHOS) {
        const { page, errores } = await abrirVista(browser, editor.puerto, '/editor', ancho, alto);
        if (errores.length) fallo(1, `editor ${ancho}: errores en consola: ${errores.join(' | ')}`);
        await page.waitForFunction(QUIETO, { timeout: 5000 }).catch(() => {});
        const m = await page.evaluate(() => {
          const cliente = document.querySelector('select[name="customer_id"]');
          const lineas = Array.from(document.querySelectorAll('#view-container [role="listitem"]')).map((t) => {
            const concepto = t.querySelector('input[placeholder="Concepto / servicio"]');
            const numeros = Array.from(t.querySelectorAll('input[type="number"]'));
            const cantidad = numeros.find((n) => n.step === '1');
            const precio = numeros.find((n) => n.step === '0.01' && n !== cantidad);
            return concepto ? { concepto: concepto.value, cantidad: cantidad ? cantidad.value : null, precio: precio ? precio.value : null } : null;
          }).filter(Boolean);
          return { cliente: cliente ? cliente.value : null, lineas, desborda: document.documentElement.scrollWidth - window.innerWidth };
        });
        await page.screenshot({ path: path.join(DESTINO, `editor-despues-${ancho}.png`), fullPage: true });
        filas.push({ vista: 'editor', etiqueta: 'despues', ancho, ...m });
        if (m.cliente !== String(CLIENTE.id)) fallo(1, `editor ${ancho}: no abre con el cliente del parte (${m.cliente}).`);
        const esperadas = template.lines.map((l) => `${l.concept}|${l.qty}|`);
        const vistas = m.lineas.map((l) => `${l.concepto}|${l.cantidad}|${l.precio}`);
        if (JSON.stringify(vistas) !== JSON.stringify(esperadas)) fallo(1, `editor ${ancho}: las líneas no son las del parte, sin precio: ${JSON.stringify(vistas)}`);
        if (m.desborda > 0) fallo(1, `editor ${ancho}: la página se ensancha ${m.desborda} px.`);
        await page.close();
      }
    } finally { editor.srv.close(); }
  }
} finally {
  await browser.close();
  antes.srv.close();
  despues.srv.close();
  partida.limpiar();
}

console.log(`punto de partida («antes»): ${partida.base.sha}`);
for (const f of filas) {
  if (f.vista === 'parte') {
    console.log(`parte  ${f.etiqueta.padEnd(7)} ${String(f.ancho).padStart(4)} · botón: ${f.boton ? `${f.boton.ancho}×${f.boton.alto} «${f.texto}» [${f.clase}]` : 'no hay'} · volver: ${f.volver ? `${f.volver.ancho}×${f.volver.alto}` : 'no hay'} · desborda: ${f.desborda}`);
  } else {
    console.log(`editor ${f.etiqueta.padEnd(7)} ${String(f.ancho).padStart(4)} · cliente: ${f.cliente} · líneas: ${f.lineas.map((l) => `${l.cantidad}× ${l.concepto} [precio «${l.precio}»]`).join(' ; ')} · desborda: ${f.desborda}`);
  }
}
console.log(`lo que el parte le pasa al editor: ${JSON.stringify(template)}`);
console.log(salida === 0 ? `✔ ${filas.length} capturas en ${path.relative(RAIZ, DESTINO)}` : `✖ salida ${salida}`);
process.exit(salida);
