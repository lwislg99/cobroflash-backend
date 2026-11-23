// tests/scrum1762b-hallmark-ficha.test.mjs — SCRUM-1762 (paraguas «lavado de cara»), PR-1 · S2
//
// LA ROPA DE LA FICHA DEL TRABAJO + LO TRANSVERSAL DE styles.css, sacado de la auditoría hallmark del
// 20-nov (sloplint estático + capturas). Ropa, no función: ni texto nuevo ni color nuevo.
//   ① la pestaña ABIERTA lleva la tinta del acento (antes: secundaria contra fantasma, dos grises);
//   ② «+ Nuevo parte» a tamaño de botón normal (seguía los 18,66 px del primario grande);
//   ③ 📞 y 💬 del lateral → iconos del set del menú, dibujados por CSS (el ✅ lo mide scrum1680 A);
//   ④ transversal: `.btn` sin `transition: all`, `.progress-fill` sin animar `width`, foco
//      INSTANTÁNEO (ningún `transition` de los 12 selectores medidos anima `box-shadow`, que es el
//      anillo de foco) y las pills `draft`/`rejected` a ≥4,5:1 con tokens que ya existían.
//
// Se lee el CSS EJECUTABLE (sin comentarios: el bloque explica las reglas con sus propias palabras) y
// se pinta la ficha con el banco de vistas para el lateral.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ejecutableDe } from './_guard-texto.mjs';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CSS_RUTA = 'public/dashboard/css/styles.css';
// Suelo del filtro (SCRUM-1395): si el filtro de comentarios se comiera el bloque, el ancla no sobrevive y cae aquí.
const css = ejecutableDe(fs.readFileSync(path.join(RAIZ, CSS_RUTA), 'utf8'), {
  ancla: ['.con-icono--hecho', '.status-pill-draft'], almohadillaEsComentario: false,
});

/** Cuerpos de TODAS las reglas cuyo selector (lista separada por comas) contiene EXACTAMENTE `sel`. */
function cuerpos(sel) {
  const out = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(css))) {
    const lista = m[1].split(',').map((s) => s.trim().replace(/\s+/g, ' '));
    if (lista.includes(sel)) out.push(m[2]);
  }
  return out;
}
const declara = (sel, decl) => cuerpos(sel).some((c) => c.replace(/\s+/g, ' ').includes(decl));

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'public/dashboard/css/styles.css',
    de: '  background: var(--brand-tint);\n  color: var(--brand-tint-ink);\n  border-color: var(--brand);\n',
    a: '  border-color: var(--brand);\n',
    cae: '1762b ① · la pestaña abierta lleva la tinta del acento (Verde Tinte + texto verde + filete)',
  },
  {
    fichero: 'public/dashboard/css/styles.css',
    de: '  min-height: 44px;\n  font-size: 13.5px;\n  font-weight: 600;\n  background: var(--brand-tint-ink);\n',
    a: '  min-height: 44px;\n',
    cae: '1762b ② · «+ Nuevo parte» a tamaño de la barra, con la receta AA del primario normal',
  },
  {
    fichero: 'public/dashboard/js/jobRailBlocks.js',
    de: "icono: 'telefono', href: t.href",
    a: "icono: '📞', href: t.href",
    cae: '1762b ③ · 📞 y 💬 del lateral son iconos del menú (clase), y el texto va limpio',
  },
  {
    fichero: 'public/dashboard/css/styles.css',
    de: '  transition: background .15s ease, transform .08s ease; /* SCRUM-1762b: foco instantáneo */\n',
    a: '  transition: background .15s ease, transform .08s ease, box-shadow .15s ease;\n',
    cae: '1762b ④ · transversal: sin `transition: all`, sin animar `width` y foco instantáneo',
  },
  {
    fichero: 'public/dashboard/css/styles.css',
    de: '.status-pill-draft     { background: var(--neutral-100); color: var(--neutral-600); }',
    a: '.status-pill-draft     { background: var(--neutral-100); color: var(--neutral-500); }',
    cae: '1762b ④ · pills de estado a ≥4,5:1 con tokens que ya existían',
  },
];

test('1762b ① · la pestaña abierta lleva la tinta del acento (Verde Tinte + texto verde + filete)', () => {
  const sel = '.detail-page--trabajo .detail-pestanas > [aria-selected="true"]';
  assert.ok(cuerpos(sel).length > 0, `🔴 CIEGO: no encuentro la regla «${sel}»`);
  for (const d of ['background: var(--brand-tint)', 'color: var(--brand-tint-ink)', 'box-shadow: inset 0 0 0 1px var(--brand)']) {
    assert.ok(declara(sel, d), `🔴 la pestaña abierta no declara «${d}»: sigue siendo un gris entre grises`);
  }
  // Y el hover no se la quita (`.btn-secondary:hover` pinta --bg con más especificidad que la base).
  assert.ok(declara(`${sel}:hover:not(:disabled)`, 'background: var(--brand-tint)'), '🔴 al pasar el ratón la pestaña abierta pierde la tinta');
  assert.ok(declara(`${sel}:focus-visible`, 'var(--ring)'), '🔴 la pestaña abierta sin anillo de foco');
});

test('1762b ② · «+ Nuevo parte» a tamaño de la barra, con la receta AA del primario normal', () => {
  const sel = '.detail-page--trabajo [data-abrir-parte].btn-primary:not(.btn-sm)';
  assert.ok(cuerpos(sel).length > 0, `🔴 CIEGO: no encuentro la regla «${sel}»`);
  assert.ok(declara(sel, 'font-size: 13.5px'), '🔴 «+ Nuevo parte» sigue con la letra del primario grande');
  assert.ok(declara(sel, 'min-height: 44px'), '🔴 «+ Nuevo parte» sin el objetivo táctil de 44 px');
  // Con 13,5 px el blanco sobre --brand no llega a AA (3,30): el fondo tiene que ser el verde de texto.
  assert.ok(declara(sel, 'background: var(--brand-tint-ink)'), '🔴 «+ Nuevo parte» pequeño sobre --brand: 3,30:1, por debajo de AA');
});

test('1762b ③ · 📞 y 💬 del lateral son iconos del menú (clase), y el texto va limpio', async () => {
  const MOVIL = '34700000002'; // rango no asignable (SCRUM-262)
  const job = {
    id: 42, status: 'en_curso', createdAt: '2026-09-01T09:00:00Z', titulo: 'Reparación caldera',
    customer: { id: 5, name: 'Cliente Uno', phone: null, mobile: MOVIL, numeroWhatsApp: MOVIL },
    asignados: [], operario: null, albaranes: [], gastos: [], notes: '',
    quote: null, direccion: null, totalAceptado: 0, totalCobrado: 0,
  };
  const banco = cargarDashboard(RAIZ);
  banco.ctx.apiRequest = async (u) => {
    const url = String(u);
    if (/\/admin\/team/.test(url)) return [];
    if (/\/admin\/merchant/.test(url)) return { name: 'Negocio QA' };
    if (/\/admin\/partes/.test(url)) return { partes: [] };
    if (/gastos/.test(url)) return [];
    return job;
  };
  banco.ctx.appUserRole = 'admin';
  const r = await pintarVista(banco, 'renderJobDetailView');
  assert.equal(r.error, null, `🔴 SUELO: la ficha no monta (${r.error && r.error.message})`);
  const n = todos(r.contenedor);
  const clase = (x) => String(x.className || '');
  const tel = n.filter((x) => /\bcon-icono--telefono\b/.test(clase(x)));
  const wa = n.filter((x) => /\bcon-icono--whatsapp\b/.test(clase(x)));
  assert.equal(tel.length, 1, '🔴 el teléfono del cliente no lleva el icono del menú');
  assert.equal(wa.length, 1, '🔴 el WhatsApp del cliente no lleva el icono del menú');
  assert.equal(String(wa[0].textContent).trim(), 'WhatsApp', `🔴 el rótulo cambió: «${wa[0].textContent}»`);
  const conEmoji = n.filter((x) => !x.children?.length && /📞|💬/.test(String(x.textContent || '')));
  assert.deepEqual(conEmoji.map((x) => x.textContent), [], '🔴 queda un emoji pegado al texto en la ficha');
  for (const nombre of ['hecho', 'telefono', 'whatsapp']) {
    assert.ok(declara(`.con-icono--${nombre}`, '--icono-menu: url("data:image/svg+xml'), `🔴 falta el dibujo de «con-icono--${nombre}»`);
  }
  assert.ok(declara('.con-icono::before', 'background: currentColor'), '🔴 el icono no toma el color del texto');
});

test('1762b ④ · transversal: sin `transition: all`, sin animar `width` y foco instantáneo', () => {
  assert.equal(cuerpos('.btn').filter((c) => /transition\s*:\s*all\b/.test(c)).length, 0, '🔴 `.btn` sigue con `transition: all`');
  assert.ok(cuerpos('.progress-fill').length > 0, '🔴 CIEGO: no encuentro `.progress-fill`');
  assert.equal(cuerpos('.progress-fill').filter((c) => /transition[^;]*\bwidth\b/.test(c)).length, 0, '🔴 `.progress-fill` sigue animando `width`');
  // Los 12 selectores del sloplint (regla 15): su anillo de foco es `box-shadow`, y si se transiciona
  // el anillo APARECE A FUNDIDO. Se exige que exista la regla (control de ceguera) y que no lo anime.
  const DOCE = ['.segmented-option', '.customers-tab', '.search-input', '.kpi-card', '.home-cta', '.qq-mode-btn',
    '.plan-card', '.home-action', '.data-card', '.customers-card', '.btn-primary', '.btn-secondary'];
  for (const sel of DOCE) {
    const conTransicion = cuerpos(sel).filter((c) => /transition\s*:/.test(c));
    assert.ok(conTransicion.length > 0, `🔴 CIEGO: «${sel}» no tiene ninguna regla con transition`);
    const malas = conTransicion.filter((c) => /transition\s*:[^;]*box-shadow/.test(c));
    assert.equal(malas.length, 0, `🔴 «${sel}» anima box-shadow: el anillo de foco aparece a fundido`);
  }
});

test('1762b ④ · pills de estado a ≥4,5:1 con tokens que ya existían', () => {
  assert.ok(declara('.status-pill-draft', 'color: var(--neutral-600)'), '🔴 «Borrador» en --neutral-500 sobre --neutral-100: 4,25:1');
  assert.ok(declara('.status-pill-rejected', 'color: var(--danger-ink)'), '🔴 «Rechazado» en --red-600 sobre --red-50: 4,41:1');
});
