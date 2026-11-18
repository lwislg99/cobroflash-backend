// SCRUM-1745b · REGLA 42 · la hoja «Editar albarán» y el modal «Agendar», medidos EN yaqu.app.
//
// Acción del banco H6 (se lanza con `docs/master/evidencias/SCRUM-1686/banco-h6/paso2.mjs`):
//   PASO=hoja     node paso2.mjs <ancho> "#jobs-detail/<n>" r42-hoja    <este fichero>
//   PASO=agendar  node paso2.mjs <ancho> "#jobs"            r42-agendar <este fichero>
//
// Mide con el medidor de la casa (`scripts/_medidor-de-toque.mjs`: el área que recibe el dedo, no la
// caja pintada), igual que `scripts/guard-hojas-del-trabajo-44.mjs`, pero sobre la página REAL: datos
// reales de la cuenta QA, hoja de estilos servida por producción, sin CSS local.
//
// NO ESCRIBE: abre la hoja o el modal, mide y lo cierra. No pulsa «Guardar», «Agendar» (el de dentro)
// ni nada que envíe. Si `paso2.mjs` apunta una escritura que no sea `POST /admin/entorno`, es un fallo.
//
// SUELO: si no encuentra el botón que abre, o el diálogo no trae controles, lanza CIEGO (código 1):
// un diálogo que no se abrió tiene cero controles cortos y saldría «limpio».
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const medidor = await import(pathToFileURL(path.join(AQUI, '..', '..', '..', '..', 'scripts', '_medidor-de-toque.mjs')).href);
const { FUENTE_MEDIDOR, INTERACTIVOS, MINIMO_TACTIL, CORTE_MOVIL } = medidor;

const censar = async (SEL) => {
  const capas = [...document.querySelectorAll('.modal-overlay')].filter((m) => m.getBoundingClientRect().width > 0);
  const capa = capas[capas.length - 1];
  if (!capa) return null;
  const tarjeta = capa.querySelector('.modal') || capa;
  const ancho = (el) => {
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2; const cy = r.top + r.height / 2;
    const toca = (x) => { const a = document.elementsFromPoint(x, cy)[0]; return !!a && a.closest(SEL) === el; };
    if (!toca(cx)) return null;
    let izq = cx; let der = cx;
    while (izq > cx - 90 && toca(izq - 0.5)) izq -= 0.5;
    while (der < cx + 90 && toca(der + 0.5)) der += 0.5;
    return +(der - izq).toFixed(1);
  };
  const nombre = (el) => {
    let t = (el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.textContent || '').trim().replace(/\s+/g, ' ');
    if (!t && el.id) { const l = document.querySelector(`label[for="${el.id}"]`); if (l) t = l.textContent.trim(); }
    if (!t && el.closest('label')) t = el.closest('label').textContent.trim();
    return `${el.tagName === 'INPUT' ? `input[${el.type}]` : el.tagName.toLowerCase()} «${t.slice(0, 40)}»`;
  };
  const filas = [];
  for (const el of tarjeta.querySelectorAll(SEL)) {
    const r0 = el.getBoundingClientRect();
    if (!r0.width || !r0.height) continue;
    const a = await window.__areaDeToque(el, SEL, { scroll: true });
    const r = el.getBoundingClientRect();
    const fila = { quien: nombre(el), w: +r.width.toFixed(1), h: +r.height.toFixed(1), tocable: a.tocable == null ? null : a.tocable, error: a.error || null, tocableAncho: null };
    if (!a.error && r.width < 44) fila.tocableAncho = ancho(el);
    if (el.getAttribute('placeholder') === 'Concepto') { fila.concepto = el.value; fila.cabe = el.scrollWidth <= el.clientWidth + 0.5; fila.ve = el.clientWidth; fila.pide = el.scrollWidth; }
    filas.push(fila);
  }
  const t = tarjeta.getBoundingClientRect();
  return {
    titulo: (tarjeta.querySelector('h1, h2, h3, .modal-title') || {}).innerText || '',
    ventana: { w: window.innerWidth, h: window.innerHeight },
    tarjeta: { izq: +t.left.toFixed(1), der: +t.right.toFixed(1), w: +t.width.toFixed(1) },
    desbordaDeLado: document.documentElement.scrollWidth > window.innerWidth + 0.5 || tarjeta.scrollWidth > tarjeta.clientWidth + 0.5,
    filas,
  };
};

const quieta = async (p) => {
  const t0 = Date.now();
  while (Date.now() - t0 < 5000) {
    if (await p.evaluate(() => document.getAnimations().every((a) => a.playState !== 'running'))) return true;
    await p.waitForTimeout(100);
  }
  return false;
};

async function medir(s, que) {
  const p = s.page;
  if (!(await quieta(p))) throw new Error(`CIEGO: ${que} sigue animando a los 5 s`);
  await p.evaluate(FUENTE_MEDIDOR);
  const c = await p.evaluate(censar, INTERACTIVOS);
  if (!c) throw new Error(`CIEGO: ${que} no se abrió (ninguna capa visible)`);
  if (c.filas.length < 3) throw new Error(`CIEGO: ${que} trae ${c.filas.length} controles (menos de 3: a medio pintar)`);
  const movil = c.ventana.w <= CORTE_MOVIL;
  const malos = [];
  s.nota(`${que} · «${c.titulo.trim()}» · ventana ${c.ventana.w}×${c.ventana.h} · tarjeta x=${c.tarjeta.izq}–${c.tarjeta.der} · desborda de lado: ${c.desbordaDeLado ? 'SÍ' : 'no'} · ${c.filas.length} controles`);
  for (const f of c.filas) {
    let marca = '';
    if (f.error) { marca = ` CIEGO(${f.error})`; malos.push(f); }
    else if (movil && f.tocable < MINIMO_TACTIL) { marca = ' CORTO'; malos.push(f); }
    // El ancho se tantea a pasos de 0,5 px: un área de 44 exactos puede leerse 43,5. Misma holgura que el guard (B).
    else if (movil && f.tocableAncho != null && f.tocableAncho < MINIMO_TACTIL - 0.5) { marca = ' ESTRECHO'; malos.push(f); }
    // C sólo se exige en móvil, como en el guard: a escritorio se APUNTA y no tumba la pasada.
    if (f.cabe === false) { marca += movil ? ' CONCEPTO-CORTADO' : ' (concepto cortado, apuntado)'; if (movil) malos.push(f); }
    s.nota(`  ${f.quien} · caja ${f.w}×${f.h} · toque ${f.tocable}${f.tocableAncho != null ? ` · toque de ancho ${f.tocableAncho}` : ''}${f.cabe != null ? ` · concepto ve ${f.ve} de ${f.pide}` : ''}${marca}`);
  }
  const altos = c.filas.filter((f) => f.tocable != null).map((f) => f.tocable);
  s.nota(`${que} · toque mínimo ${Math.min(...altos)} px sobre ${altos.length} medidos · fuera de norma: ${malos.length}${movil ? '' : ' (a escritorio NO se exige 44: sólo se apunta)'}`);
  if (c.desbordaDeLado) malos.push({ quien: 'desborde de lado' });
  return malos.length;
}

export default async (s) => {
  const p = s.page; const paso = process.env.PASO || 'hoja';
  let malos = 0;
  if (paso === 'hoja') {
    const b = p.getByRole('button', { name: /^Editar líneas$/ }).first();
    if (!(await b.count())) throw new Error('CIEGO: esta ficha no tiene «Editar líneas» visible');
    await b.scrollIntoViewIfNeeded();
    await b.click();
    await p.waitForTimeout(600);
    malos = await medir(s, 'HOJA');
    await s.mide('hoja');
  } else {
    let b = p.getByRole('button', { name: /^(Agendar|Reagendar)$/ }).first();
    if (!(await b.count())) {
      const mas = p.locator('button:visible').filter({ hasText: /^\s*⋯\s*$/ }).first();
      if (!(await mas.count())) throw new Error('CIEGO: ni «Agendar» ni «⋯» visibles');
      await mas.scrollIntoViewIfNeeded();
      await mas.click();
      await p.waitForTimeout(500);
      b = p.locator('button:visible, [role="menuitem"]:visible').filter({ hasText: /^\s*(Agendar|Reagendar)\s*$/ }).first();
      if (!(await b.count())) throw new Error('CIEGO: el «⋯» no ofrece «Agendar» ni «Reagendar»');
      s.nota('se llega por el «⋯»');
    }
    s.nota('abre: «' + (await b.innerText()).trim() + '»');
    await b.click();
    await p.waitForTimeout(600);
    malos = await medir(s, 'AGENDAR');
    await s.mide('agendar');
  }
  if (malos) throw new Error(`ROJO: ${malos} controles fuera de norma`);
};
