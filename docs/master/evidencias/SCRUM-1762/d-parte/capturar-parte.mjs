// docs/master/evidencias/SCRUM-1762/d-parte/capturar-parte.mjs — SCRUM-1762d (S4)
//
// EL PARTE DE TRABAJO, ANTES Y DESPUÉS, en borrador y firmado, a 390, 1280 y 1920: la foto, las cajas
// y la HUELLA DE FUNCIÓN (palabras, botones y casillas), comparada entre el punto de partida de la
// rama (merge-base) y el árbol.
//
// Uso:  node docs/master/evidencias/SCRUM-1762/d-parte/capturar-parte.mjs [--solo-antes]
// Fotos (fuera de git, A8): D:\MILLONARIO\cobroFlash\capturas\SCRUM-1762\d-parte\  (o CAPTURAS_DIR)
// Medidas: `medidas.json` junto a este fichero.
//
// Monta la ficha del parte con los scripts REALES del panel y su shell (`scripts/_banco-lista.mjs`).
// Sale con 1 si la huella cambia, si la página se ensancha o si el móvil se mueve; con 2 si no supo mirar.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { servirListas, abrirNavegador, abrirVista, arbolDePartida } from '../../../../../scripts/_banco-lista.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..', '..', '..', '..', '..');
const FOTOS = process.env.CAPTURAS_DIR || 'D:\\MILLONARIO\\cobroFlash\\capturas\\SCRUM-1762\\d-parte';
const SOLO_ANTES = process.argv.includes('--solo-antes');

// Teléfonos y nombres de mentira; el parte es el del técnico (sin dinero).
const LINEAS = [
  { id: 1, bloque: 'mano_obra', unds: 2, descripcion: 'Sustitución de la bomba de recirculación' },
  { id: 2, bloque: 'mano_obra', unds: 0.5, descripcion: 'Purgado y puesta en marcha del circuito' },
  { id: 3, bloque: 'materiales', unds: 1, descripcion: 'Bomba de recirculación 25-60' },
  { id: 4, bloque: 'materiales', unds: 3, descripcion: 'Racor de latón 1"' },
];
const COMUN = {
  jobId: 7, customerId: 3, clienteNombre: 'Comunidad Los Olivos', fecha: '2026-11-19T08:00:00.000Z',
  obra: 'Sala de calderas', referencia: '', entrada: '09:00', salida: '11:30', desplazamientos: 1, kilometros: 12,
  tecnicos: ['Israel'], tipo: 'averia', lineas: LINEAS, notas: '',
  queHayQueHacer: 'Cambiar la bomba de recirculación y dejar el circuito purgado.',
};
const PARTES = {
  borrador: {
    ...COMUN, id: 12, numero: 'PT-2026-012', estado: 'borrador',
    firmoElCliente: false, firmoElTecnico: false, firmasCompletas: false,
    puedeEditarContenido: { ok: true, motivo: null }, puedeEditarPrecios: { ok: true, motivo: null },
  },
  firmado: {
    ...COMUN, id: 13, numero: 'PT-2026-013', estado: 'firmado',
    firmadoAt: '2026-11-19T11:35:00.000Z', firmadoPorNombre: 'Ana Ruiz', firmadoPorCalidad: null,
    firmadoTecnicoAt: '2026-11-19T11:33:00.000Z', firmadoTecnicoNombre: 'Israel',
    firmoElCliente: true, firmoElTecnico: true, firmasCompletas: true,
    puedeEditarContenido: { ok: false, motivo: 'firmado' }, puedeEditarPrecios: { ok: true, motivo: null },
  },
};
const NEGOCIO = { id: 1, name: 'Fontanería Soler', timezone: 'Europe/Madrid', defaultCurrency: 'EUR' };
const datos = (parte) => `(function (ruta) {
  if (/\\/admin\\/partes\\/${parte.id}$/.test(ruta)) return ${JSON.stringify(parte)};
  if (/\\/admin\\/merchant/.test(ruta)) return ${JSON.stringify(NEGOCIO)};
  return {};
})`;
const RUTAS = Object.entries(PARTES).map(([estado, parte]) => (
  { ruta: '/parte-' + estado, fnVista: 'renderParteDetailView', datos: datos(parte), args: `[${parte.id}]` }
));

const QUIETO = "document.getAnimations().every((a) => a.playState !== 'running')";
const ANCHOS = [[390, 844], [1280, 900], [1536, 864], [1920, 1080]];
let salida = 0;
const fallo = (codigo, texto) => { console.error('🔴 ' + texto); salida = Math.max(salida, codigo); };

const partida = arbolDePartida(RAIZ, 'antes-1762d');
if (!partida.publico) {
  console.error('🔴 NO SUPE MIRAR: no se pudo resolver el punto de partida de la rama (merge-base).');
  process.exit(2);
}
fs.mkdirSync(FOTOS, { recursive: true });
const { browser } = await abrirNavegador(puppeteer);
const antes = await servirListas(partida.publico, RUTAS);
const despues = SOLO_ANTES ? null : await servirListas(path.join(RAIZ, 'public'), RUTAS);
const medidas = {};

async function mirar(etiqueta, puerto, estado, ancho, alto) {
  const { page, errores } = await abrirVista(browser, puerto, '/parte-' + estado, ancho, alto);
  const clave = `${estado}-${ancho}`;
  if (errores.length) fallo(1, `${etiqueta} ${clave}: errores en consola: ${errores.join(' | ')}`);
  if (!(await page.$('#view-container [data-parte-firmas]'))) {
    fallo(2, `NO SUPE MIRAR: ${etiqueta} ${clave} no pinta la ficha del parte.`);
    await page.close();
    return;
  }
  await page.waitForFunction(QUIETO, { timeout: 5000 }).catch(() => {});
  const m = await page.evaluate(() => {
    const hoja = document.querySelector('header.parte-cabecera').parentElement;
    const principal = document.querySelector('main.main') || document.body;
    const caja = (n) => {
      if (!n) return null;
      const r = n.getBoundingClientRect();
      return { izq: Math.round(r.left), ancho: Math.round(r.width), alto: Math.round(r.height), arriba: Math.round(r.top + window.scrollY) };
    };
    const cs = getComputedStyle(principal);
    const dentroIzq = principal.getBoundingClientRect().left + parseFloat(cs.paddingLeft);
    const dentroDer = principal.getBoundingClientRect().right - parseFloat(cs.paddingRight);
    const r = hoja.getBoundingClientRect();
    const palabras = hoja.innerText.split(/\s+/).filter(Boolean).sort();
    const botones = Array.from(hoja.querySelectorAll('button, a[href], summary')).map((b) => (
      b.textContent.trim().replace(/\s+/g, ' ') + ' {' + Array.from(b.attributes).map((a) => a.name).filter((n) => /^data-/.test(n)).sort().join(',') + '}'
    )).sort();
    const casillas = Array.from(hoja.querySelectorAll('input, textarea, select')).map((c) => (
      c.tagName + ':' + (c.getAttribute('type') || '') + ':' + Array.from(c.attributes).map((a) => a.name).filter((n) => /^data-/.test(n)).sort().join(',') + '=' + c.value
    )).sort();
    const bajos = Array.from(hoja.querySelectorAll('button, summary, input:not([type=hidden]), textarea, select'))
      .filter((n) => n.offsetParent !== null && n.getBoundingClientRect().height < 44)
      .map((n) => (n.textContent.trim().slice(0, 30) || n.tagName) + ':' + Math.round(n.getBoundingClientRect().height));
    const volver = document.querySelector('[data-parte-volver-al-trabajo]');
    // Contraste del texto de lo que se pulsa y de las constancias, contra el fondo que de verdad lleva debajo.
    const rgb = (s) => { const m = /rgba?\(([^)]+)\)/.exec(s); if (!m) return null; const p = m[1].split(/[,\s/]+/).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
    const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
    const fondoDe = (n) => { for (let x = n; x; x = x.parentElement) { const c = rgb(getComputedStyle(x).backgroundColor); if (c && c.a === 1) return c; } return { r: 255, g: 255, b: 255, a: 1 }; };
    const contrastes = Array.from(hoja.querySelectorAll('button, summary, .parte-firma-hecha, .parte-pista, .parte-horas-guia, .parte-plegable-resumen, th, .detail-miga-link, [class*="pill"]'))
      .filter((n) => n.offsetParent !== null && n.textContent.trim())
      .map((n) => {
        const cs2 = getComputedStyle(n); const t = rgb(cs2.color); const f = fondoDe(n);
        const a = lum(t), b = lum(f); const razon = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        const px = parseFloat(cs2.fontSize); const grande = px >= 24 || (px >= 18.66 && Number(cs2.fontWeight) >= 700);
        return { texto: n.textContent.trim().replace(/\s+/g, ' ').slice(0, 34), razon: Math.round(razon * 100) / 100, px, peso: cs2.fontWeight, suelo: grande ? 3 : 4.5 };
      });
    // Bajo `overflow-x: clip`, `scrollWidth` dice 0 aunque algo se salga (SCRUM-1722c): se busca la caja más a la derecha.
    let derecha = 0;
    for (const n of hoja.querySelectorAll('*')) { if (n.offsetParent === null) continue; const c = n.getBoundingClientRect(); if (c.width && c.right > derecha) derecha = c.right; }
    return {
      seSale: Math.max(0, Math.round(derecha - window.innerWidth)),
      pocoContraste: contrastes.filter((c) => c.razon < c.suelo).map((c) => `${c.texto} ${c.razon}:1 (${c.px}px/${c.peso})`),
      hoja: caja(hoja),
      pasilloIzq: Math.round(r.left - dentroIzq), pasilloDer: Math.round(dentroDer - r.right),
      firmas: caja(document.querySelector('[data-parte-firmas]')),
      primeraTarjeta: caja(hoja.querySelector('.parte-horas, .parte-datos-del-parte')),
      volver: caja(volver), volverLetra: volver ? getComputedStyle(volver).fontSize : null,
      presupuesto: caja(document.querySelector('[data-parte-presupuesto]')),
      altoDePagina: document.documentElement.scrollHeight,
      desborda: document.documentElement.scrollWidth - window.innerWidth,
      bajos, palabras, botones, casillas,
    };
  });
  await page.screenshot({ path: path.join(FOTOS, `${etiqueta}-parte-${clave}.png`), fullPage: true });
  (medidas[clave] = medidas[clave] || {})[etiqueta] = m;
  await page.close();
}

try {
  for (const estado of Object.keys(PARTES)) {
    for (const [ancho, alto] of ANCHOS) {
      await mirar('antes', antes.puerto, estado, ancho, alto);
      if (despues) await mirar('despues', despues.puerto, estado, ancho, alto);
    }
  }
} finally {
  await browser.close();
  antes.cerrar && antes.cerrar();
  despues && despues.cerrar && despues.cerrar();
  partida.limpiar();
}

const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
for (const [clave, par] of Object.entries(medidas)) {
  const a = par.antes, d = par.despues;
  if (!a) continue;
  const linea = (e, m) => `${e.padEnd(8)} hoja ${String(m.hoja.ancho).padStart(4)} px · pasillos ${m.pasilloIzq}/${m.pasilloDer} · firmas x=${m.firmas.izq} w=${m.firmas.ancho} · página ${m.altoDePagina} px · desborde ${m.desborda}` +
    ` · se sale ${m.seSale}` + (m.volver ? ` · «volver» ${m.volver.ancho}×${m.volver.alto} ${m.volverLetra}` : '') +
    `\n             <44 px (${m.bajos.length}): ${m.bajos.join(' | ') || '—'}\n             contraste bajo (${m.pocoContraste.length}): ${m.pocoContraste.join(' | ') || '—'}`;
  console.log(`\n${clave}\n  ${linea('antes', a)}`);
  if (!d) continue;
  console.log(`  ${linea('despues', d)}`);
  const huella = igual(a.palabras, d.palabras) && igual(a.botones, d.botones) && igual(a.casillas, d.casillas);
  console.log(`  huella de función: ${huella ? 'IDÉNTICA' : 'DISTINTA'} (${d.palabras.length} palabras, ${d.botones.length} botones, ${d.casillas.length} casillas)`);
  if (!huella) fallo(1, `${clave}: la huella de función cambia.`);
  if (d.desborda > 0 || d.seSale > 0) fallo(1, `${clave}: la página se ensancha ${d.desborda} px y algo se sale ${d.seSale} px.`);
  if (d.pocoContraste.length > a.pocoContraste.length) fallo(1, `${clave}: hay más textos con poco contraste que antes.`);
  // MÓVIL NO SE TOCA: a 390 las cajas de la hoja, de las firmas y el alto de la página son los de antes.
  if (/-390$/.test(clave) && !(igual(a.hoja, d.hoja) && igual(a.firmas, d.firmas) && a.altoDePagina === d.altoDePagina && igual(a.volver, d.volver) && igual(a.presupuesto, d.presupuesto))) {
    fallo(1, `${clave}: el móvil se ha movido (hoja, firmas, salidas o alto de página).`);
  }
  if (d.bajos.length > a.bajos.length) fallo(1, `${clave}: hay más controles por debajo de 44 px que antes: ${d.bajos.join(' | ')}`);
}
// Al fichero van las cajas y los RECUENTOS de la huella (las listas ya se compararon arriba), una medida por línea.
const corto = (m) => ({ ...m, palabras: m.palabras.length, botones: m.botones.length, casillas: m.casillas.length });
const lineas = Object.entries(medidas).flatMap(([clave, par]) => Object.entries(par).map(([etiqueta, m]) => ` ${JSON.stringify(`${clave} ${etiqueta}`)}: ${JSON.stringify(corto(m))}`));
fs.writeFileSync(path.join(AQUI, 'medidas.json'), '{\n' + lineas.join(',\n') + '\n}\n');
console.log(`\nFotos en ${FOTOS}`);
process.exit(salida);
