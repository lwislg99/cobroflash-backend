// docs/master/evidencias/SCRUM-1822/capturar-candado.mjs — SCRUM-1822 tramo ⓐ (S4)
//
// LA CABECERA DEL PARTE, ANTES Y DESPUÉS, en borrador y firmado, a 390 y 1280: la foto, las cajas de
// lo nuevo y la HUELLA DE FUNCIÓN (palabras, botones y casillas) comparada entre el punto de partida de
// la rama (merge-base) y el árbol. Hermano de `SCRUM-1762/d-parte/capturar-parte.mjs`, con otra pregunta:
// allí la huella tenía que ser IDÉNTICA; aquí tiene que cambiar en EXACTAMENTE lo firmado y en nada más.
//
// Uso:  node docs/master/evidencias/SCRUM-1822/capturar-candado.mjs
// Fotos (fuera de git, A8): D:\MILLONARIO\cobroFlash\capturas\SCRUM-1822\  (o CAPTURAS_DIR)
// Medidas: `medidas.json` junto a este fichero.
//
// Monta la ficha del parte con los scripts REALES del panel y su shell (`scripts/_banco-lista.mjs`). El
// motivo del firmado es el que da HOY el dominio compilado (`dist/`), no una frase escrita aquí.
// Sale con 1 si algo no es lo esperado; con 2 si no supo mirar.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';
import { servirListas, abrirNavegador, abrirVista, arbolDePartida } from '../../../../scripts/_banco-lista.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..', '..', '..', '..');
const FOTOS = process.env.CAPTURAS_DIR || 'D:\\MILLONARIO\\cobroFlash\\capturas\\SCRUM-1822';
const EDITAR = 'Editar';

const DOMINIO = path.join(RAIZ, 'dist', 'modules', 'jobs', 'domain', 'parteTrabajo.js');
if (!fs.existsSync(DOMINIO)) {
  console.error('🔴 NO SUPE MIRAR: falta dist/ (npm run build): sin el dominio no sé qué motivo manda el servidor.');
  process.exit(2);
}
const { puedeEditarContenido } = await import(pathToFileURL(DOMINIO).href);
const MOTIVO = puedeEditarContenido('firmado').motivo;
if (typeof MOTIVO !== 'string' || MOTIVO.length < 20) {
  console.error('🔴 NO SUPE MIRAR: el dominio no da el motivo de un parte firmado.');
  process.exit(2);
}

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
  tecnicos: ['Israel'], tipo: 'mantenimiento', lineas: LINEAS, notas: '',
  queHayQueHacer: 'Cambiar la bomba de recirculación y dejar el circuito purgado.',
};
const PARTES = {
  borrador: {
    ...COMUN, id: 12, numero: 'PT-2026-012', estado: 'borrador',
    firmoElCliente: false, firmoElTecnico: false, firmasCompletas: false,
    puedeEditarContenido: puedeEditarContenido('borrador'), puedeEditarPrecios: { ok: true, motivo: null },
  },
  firmado: {
    ...COMUN, id: 13, numero: 'PT-2026-013', estado: 'firmado',
    firmadoAt: '2026-11-19T11:35:00.000Z', firmadoPorNombre: 'Ana Ruiz', firmadoPorCalidad: null,
    firmadoTecnicoAt: '2026-11-19T11:33:00.000Z', firmadoTecnicoNombre: 'Israel',
    firmoElCliente: true, firmoElTecnico: true, firmasCompletas: true,
    puedeEditarContenido: puedeEditarContenido('firmado'), puedeEditarPrecios: { ok: true, motivo: null },
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
const ANCHOS = [[390, 844], [1280, 900]];
let salida = 0;
const fallo = (codigo, texto) => { console.error('🔴 ' + texto); salida = Math.max(salida, codigo); };

const partida = arbolDePartida(RAIZ, 'antes-1822');
if (!partida.publico) {
  console.error('🔴 NO SUPE MIRAR: no se pudo resolver el punto de partida de la rama (merge-base).');
  process.exit(2);
}
fs.mkdirSync(FOTOS, { recursive: true });
const { browser } = await abrirNavegador(puppeteer);
const antes = await servirListas(partida.publico, RUTAS);
const despues = await servirListas(path.join(RAIZ, 'public'), RUTAS);
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
    const cabecera = document.querySelector('header.parte-cabecera');
    const hoja = cabecera.parentElement;
    const caja = (n) => {
      if (!n) return null;
      const r = n.getBoundingClientRect();
      return { izq: Math.round(r.left), ancho: Math.round(r.width), alto: Math.round(r.height), arriba: Math.round(r.top + window.scrollY) };
    };
    const rgb = (s) => { const x = /rgba?\(([^)]+)\)/.exec(s); if (!x) return null; const p = x[1].split(/[,\s/]+/).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
    const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
    const fondoDe = (n) => { for (let x = n; x; x = x.parentElement) { const c = rgb(getComputedStyle(x).backgroundColor); if (c && c.a === 1) return c; } return { r: 255, g: 255, b: 255, a: 1 }; };
    const contraste = (n) => {
      if (!n) return null;
      const a = lum(rgb(getComputedStyle(n).color)), b = lum(fondoDe(n));
      return Math.round(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)) * 100) / 100;
    };
    // El relleno del botón contra el lienzo que tiene debajo: que se vea que es una pastilla.
    const rellenoContraLienzo = (n) => {
      if (!n) return null;
      const a = lum(fondoDe(n)), b = lum(fondoDe(n.parentElement));
      return Math.round(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)) * 100) / 100;
    };
    const candado = document.querySelector('[data-parte-candado]');
    const editar = document.querySelector('[data-parte-editar]');
    const dibujo = (n) => (n ? getComputedStyle(n, '::before').width : null);
    let derecha = 0;
    for (const n of hoja.querySelectorAll('*')) { if (n.offsetParent === null) continue; const c = n.getBoundingClientRect(); if (c.width && c.right > derecha) derecha = c.right; }
    const palabras = hoja.innerText.split(/\s+/).filter(Boolean).sort();
    const botones = Array.from(hoja.querySelectorAll('button, a[href], summary')).map((b) => (
      b.textContent.trim().replace(/\s+/g, ' ') + ' {' + Array.from(b.attributes).map((a) => a.name).filter((x) => /^data-/.test(x)).sort().join(',') + '}'
    )).sort();
    const casillas = Array.from(hoja.querySelectorAll('input, textarea, select')).map((c) => (
      c.tagName + ':' + (c.getAttribute('type') || '') + ':' + Array.from(c.attributes).map((a) => a.name).filter((x) => /^data-/.test(x)).sort().join(',') + '=' + c.value + (c.disabled ? ':disabled' : '')
    )).sort();
    return {
      seSale: Math.max(0, Math.round(derecha - window.innerWidth)),
      desborda: document.documentElement.scrollWidth - window.innerWidth,
      cabecera: caja(cabecera),
      candado: caja(candado), candadoTexto: candado ? candado.textContent : null, candadoContraste: contraste(candado),
      candadoTransforma: candado ? getComputedStyle(candado).textTransform : null, candadoDibujo: dibujo(candado),
      candadoDentro: candado ? cabecera.contains(candado) : null,
      editar: caja(editar), editarTexto: editar ? editar.textContent : null, editarContraste: contraste(editar),
      editarRelleno: rellenoContraLienzo(editar), editarDibujo: dibujo(editar), editarDentro: editar ? cabecera.contains(editar) : null,
      primeraCasilla: (document.querySelector('[data-parte-campo]') || { getAttribute: () => null }).getAttribute('data-parte-campo'),
      palabras, botones, casillas,
    };
  });
  // «Editar» se PULSA de verdad, y se mira dónde queda el cursor.
  if (etiqueta === 'despues' && m.editar) {
    await page.click('[data-parte-editar]');
    m.cursorTrasEditar = await page.evaluate(() => (document.activeElement && document.activeElement.getAttribute('data-parte-campo')) || null);
    await page.evaluate(() => { if (document.activeElement) document.activeElement.blur(); window.scrollTo(0, 0); });
  }
  await page.screenshot({ path: path.join(FOTOS, `${etiqueta}-parte-${clave}.png`), fullPage: true });
  (medidas[clave] = medidas[clave] || {})[etiqueta] = m;
  await page.close();
}

try {
  for (const estado of Object.keys(PARTES)) {
    for (const [ancho, alto] of ANCHOS) {
      await mirar('antes', antes.puerto, estado, ancho, alto);
      await mirar('despues', despues.puerto, estado, ancho, alto);
    }
  }
} finally {
  await browser.close();
  antes.cerrar && antes.cerrar();
  despues.cerrar && despues.cerrar();
  partida.limpiar();
}

const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
/** Lo que hay en `b` y no en `a`, contando repeticiones (las dos listas vienen ordenadas). */
const sobra = (a, b) => { const resto = a.slice(); return b.filter((x) => { const i = resto.indexOf(x); if (i < 0) return true; resto.splice(i, 1); return false; }); };
const PALABRAS_DEL_MOTIVO = MOTIVO.split(/\s+/).filter(Boolean).sort();

for (const [clave, par] of Object.entries(medidas)) {
  const a = par.antes, d = par.despues;
  if (!a || !d) { fallo(2, `NO SUPE MIRAR: ${clave} no tiene sus dos fotos.`); continue; }
  const firmado = /^firmado-/.test(clave);
  const nuevas = sobra(a.palabras, d.palabras), perdidas = sobra(d.palabras, a.palabras);
  const botonesNuevos = sobra(a.botones, d.botones), botonesPerdidos = sobra(d.botones, a.botones);
  console.log(`\n${clave}`);
  console.log(`  antes    candado ${a.candado ? 'SÍ' : 'no'} · «Editar» ${a.editar ? 'SÍ' : 'no'} · cabecera ${a.cabecera.alto} px`);
  console.log(`  despues  candado ${d.candado ? `${d.candado.ancho}×${d.candado.alto} contraste ${d.candadoContraste}:1` : 'no'} · «Editar» ${d.editar ? `${d.editar.ancho}×${d.editar.alto} contraste ${d.editarContraste}:1 relleno/lienzo ${d.editarRelleno}:1` : 'no'} · cabecera ${d.cabecera.alto} px · se sale ${d.seSale} · desborde ${d.desborda}`);
  console.log(`  palabras nuevas (${nuevas.length}): ${nuevas.join(' ') || '—'} · perdidas (${perdidas.length}) · botones nuevos: ${botonesNuevos.join(' | ') || '—'} · perdidos (${botonesPerdidos.length})`);

  // CONTROL: el «antes» es de verdad el de antes (sin candado y sin botón). Si no, no comparo nada.
  if (a.candado || a.editar) fallo(2, `NO SUPE MIRAR: ${clave}: el «antes» ya trae lo nuevo (¿merge-base mal resuelto?).`);
  if (perdidas.length || botonesPerdidos.length) fallo(1, `${clave}: se ha perdido texto o un botón que estaba.`);
  if (!igual(a.casillas, d.casillas)) fallo(1, `${clave}: las casillas no son las de antes.`);
  if (d.desborda > 0 || d.seSale > 0) fallo(1, `${clave}: la página se ensancha ${d.desborda} px o algo se sale ${d.seSale} px.`);

  if (firmado) {
    if (d.candadoTexto !== MOTIVO) fallo(1, `${clave}: el candado no dice el motivo del servidor byte a byte: ${JSON.stringify(d.candadoTexto)}`);
    if (d.candadoTransforma !== 'none') fallo(1, `${clave}: la hoja de estilos le cambia las letras al motivo (${d.candadoTransforma}).`);
    if (!d.candadoDentro) fallo(1, `${clave}: el candado no está en la cabecera.`);
    if (d.candadoDibujo !== '18px') fallo(1, `${clave}: el candado no lleva su dibujo (${d.candadoDibujo}).`);
    if (!(d.candadoContraste >= 4.5)) fallo(1, `${clave}: el motivo no llega a 4,5:1 (${d.candadoContraste}).`);
    if (!igual(nuevas, PALABRAS_DEL_MOTIVO)) fallo(1, `${clave}: las palabras nuevas no son exactamente las del motivo.`);
    if (d.editar || botonesNuevos.length) fallo(1, `${clave}: un parte firmado estrena un botón.`);
    if (d.casillas.some((c) => !/:disabled$/.test(c))) fallo(1, `${clave}: queda una casilla abierta en el firmado.`);
  } else {
    if (d.candado) fallo(1, `${clave}: un borrador lleva candado.`);
    if (d.editarTexto !== EDITAR) fallo(1, `${clave}: el botón no dice «${EDITAR}»: ${JSON.stringify(d.editarTexto)}`);
    if (!d.editarDentro) fallo(1, `${clave}: «Editar» no está en la cabecera.`);
    if (!igual(nuevas, [EDITAR])) fallo(1, `${clave}: las palabras nuevas no son exactamente «${EDITAR}».`);
    if (!igual(botonesNuevos, [EDITAR + ' {data-parte-editar}'])) fallo(1, `${clave}: los botones nuevos no son exactamente «Editar».`);
    if (!(d.editar && d.editar.alto >= 44)) fallo(1, `${clave}: «Editar» mide menos de 44 px de alto.`);
    if (!(d.editarContraste >= 4.5)) fallo(1, `${clave}: «Editar» no llega a 4,5:1 (${d.editarContraste}).`);
    if (d.editarDibujo !== '18px') fallo(1, `${clave}: «Editar» no lleva su lápiz (${d.editarDibujo}).`);
    if (!d.primeraCasilla || d.cursorTrasEditar !== d.primeraCasilla) fallo(1, `${clave}: tras pulsar «Editar» el cursor está en ${d.cursorTrasEditar}, no en la primera casilla (${d.primeraCasilla}).`);
    console.log(`  tras pulsar «Editar», el cursor está en: ${d.cursorTrasEditar}`);
  }
}
if (Object.keys(medidas).length !== Object.keys(PARTES).length * ANCHOS.length) fallo(2, 'NO SUPE MIRAR: faltan combinaciones de estado y ancho.');

// Al fichero van las cajas y los RECUENTOS de la huella (las listas ya se compararon arriba), una medida por línea.
const corto = (m) => ({ ...m, palabras: m.palabras.length, botones: m.botones.length, casillas: m.casillas.length });
const lineas = Object.entries(medidas).flatMap(([clave, par]) => Object.entries(par).map(([etiqueta, m]) => ` ${JSON.stringify(`${clave} ${etiqueta}`)}: ${JSON.stringify(corto(m))}`));
fs.writeFileSync(path.join(AQUI, 'medidas.json'), '{\n' + lineas.join(',\n') + '\n}\n');
console.log(`\nPoblación: ${Object.keys(medidas).length} combinaciones (2 estados × ${ANCHOS.length} anchos), antes y después.`);
console.log(`Fotos en ${FOTOS}`);
process.exit(salida);
