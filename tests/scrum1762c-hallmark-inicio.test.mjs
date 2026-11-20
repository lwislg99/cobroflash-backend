// tests/scrum1762c-hallmark-inicio.test.mjs — SCRUM-1762 (paraguas «lavado de cara»), PR-2 · S2
//
// EL INICIO, lavado con la auditoría hallmark del 20-nov. Orden y ropa; los textos tocados están
// FIRMADOS por la delegación c.21978 (registro docs/master/SCRUM-1762.md):
//   ① ESTRUCTURA: «Para hoy» (la franja de la Lista) ARRIBA también para el admin, «Dinero en juego»
//      debajo, «Completa tu configuración» AL FINAL (después incluso del rendimiento del equipo);
//   ② ROPA: los emojis → iconos del set del menú; sin raya lateral en la tarjeta del dinero; aire bajo
//      los avisos; UN solo H1 (el de la barra superior: el saludo pasa a h2);
//   ③ TEXTO firmado: «Cotizaciones» → el plural del menú (`appLocale.quotePlural`, «Presupuestos»), y
//      «0%» rojo con 0 enviados → «—» neutro.
// Se pinta el Inicio del admin con el banco de vistas y respuestas de la API hechas a mano.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ejecutableDe } from './_guard-texto.mjs';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
// Suelo del filtro (SCRUM-1395): si el filtro se comiera el bloque, el ancla no sobrevive y cae aquí.
const css = ejecutableDe(fs.readFileSync(path.join(RAIZ, 'public/dashboard/css/styles.css'), 'utf8'), {
  ancla: ['.home-hero-card', '.con-icono--cobro'], almohadillaEsComentario: false,
});

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'public/dashboard/js/homeView.js',
    de: "    pintarTrabajoDeHoy(document.getElementById('home-hoy'));\n  }\n",
    a: "    const hoy = document.getElementById('home-hoy');\n    if (hoy) hoy.remove();\n  }\n",
    cae: '1762c ① · Para hoy arriba, el dinero debajo y «Completa tu configuración» la última',
  },
  {
    fichero: 'public/dashboard/js/homeView.js',
    de: "  if (ranura) ranura.appendChild(checklist);\n",
    a: "  if (ranura) ranura.parentNode.insertBefore(checklist, ranura.parentNode.firstChild);\n",
    cae: '1762c ① · Para hoy arriba, el dinero debajo y «Completa tu configuración» la última',
  },
  {
    fichero: 'public/dashboard/js/homeView.js',
    de: '<span class="home-action-ico con-icono con-icono--clientes" aria-hidden="true"></span>',
    a: '<span class="home-action-ico">👤</span>',
    cae: '1762c ② · ni un emoji, un solo H1 y los iconos del menú',
  },
  {
    fichero: 'public/dashboard/js/homeView.js',
    de: '<div class="kpi-label">${pluralDelPresupuesto()} sin respuesta</div>',
    a: '<div class="kpi-label">Cotizaciones sin respuesta</div>',
    cae: '1762c ③ · «Presupuestos» como el menú, y «—» neutro donde no se ha enviado nada',
  },
  {
    fichero: 'public/dashboard/css/styles.css',
    de: '  border: 1px solid var(--border); /* SCRUM-1762c: sin raya lateral de 4 px (prohibición de DESIGN/impeccable) */\n',
    a: '  border: 1px solid var(--border);\n  border-left: 4px solid var(--brand);\n',
    cae: '1762c ② · la tarjeta del dinero sin raya lateral, y aire bajo los avisos',
  },
];

const clase = (x) => String(x.className || '');
const tag = (x) => String(x.tagName || '').toUpperCase();
const texto = (x) => String(x.textContent || '');
// En el banco, el textContent de una tabla montada por innerHTML no agrega a sus celdas: se juntan las de dentro.
const textoHondo = (x) => [x, ...todos(x)].map((y) => String(y.textContent || '')).join(' ');

async function inicioDelAdmin() {
  const banco = cargarDashboard(RAIZ);
  banco.ctx.appUserRole = 'admin';
  banco.ctx.apiRequest = async (u) => {
    const url = String(u);
    if (/\/admin\/metrics\/home/.test(url)) {
      return { pendingCount: 0, quotesAwaiting: 0, pendingAmount: 0, awaitingAmount: 0, collectedThisMonth: 0,
        expensesThisMonth: 0, recentActivity: [], topCustomers: [], topServices: [] };
    }
    if (/\/admin\/metrics\/team/.test(url)) {
      return { hasTeam: true, inactive: ['Operario QA'], members: [
        { name: 'Dueña', role: 'owner', sent: 0, acceptanceRate: 0, collected: 0 },
        { name: 'Operario QA', role: 'tecnico', sent: 4, acceptanceRate: 50, collected: 0 },
      ] };
    }
    if (/\/admin\/merchant/.test(url)) return { name: 'Negocio QA' };
    if (/\/admin\/jobs/.test(url)) return [];
    return {};
  };
  const r = await pintarVista(banco, 'renderHomeView');
  assert.equal(r.error, null, `🔴 SUELO: el Inicio no monta (${r.error && r.error.message})`);
  // El rendimiento del equipo llega detrás de varias peticiones encadenadas: se deja correr el reloj.
  for (let i = 0; i < 20; i++) await new Promise((res) => setTimeout(res, 5));
  const n = todos(r.contenedor);
  assert.ok(n.some((x) => x.id === 'home-hero'), '🔴 CIEGO: el Inicio no se ha pintado');
  return { r, n };
}

test('1762c ① · Para hoy arriba, el dinero debajo y «Completa tu configuración» la última', async () => {
  const { n } = await inicioDelAdmin();
  const i = (id) => n.findIndex((x) => x.id === id);
  assert.ok(i('home-hoy') >= 0, '🔴 el Inicio del admin no tiene «Para hoy»');
  assert.ok(i('home-hoy') < i('home-hero'), '🔴 «Para hoy» no va antes que «Dinero en juego»');
  const conf = n.find((x) => x.id === 'home-configuracion');
  assert.ok(conf, '🔴 falta la ranura de «Completa tu configuración»');
  assert.ok(n.some((x) => /Completa tu configuración/.test(texto(x)) && x !== conf && conf && todos(conf).includes(x)),
    '🔴 «Completa tu configuración» no está en su ranura del final');
  const raiz = conf.parentNode;
  const hermanos = [...raiz.children];
  assert.equal(hermanos[hermanos.length - 1], conf, '🔴 «Completa tu configuración» no es lo último del Inicio');
  const equipo = n.find((x) => tag(x) === 'TABLE' && /Miembro/.test(textoHondo(x)));
  assert.ok(equipo, '🔴 CIEGO: el rendimiento del equipo no se ha pintado');
  assert.ok(n.indexOf(equipo) < n.indexOf(conf), '🔴 el rendimiento del equipo quedó DEBAJO de «Completa tu configuración»');
});

test('1762c ② · ni un emoji, un solo H1 y los iconos del menú', async () => {
  const { r, n } = await inicioDelAdmin();
  const emojis = [...new Set(textoHondo(r.contenedor).match(/\p{Extended_Pictographic}/gu) || [])];
  assert.deepEqual(emojis, [], `🔴 quedan emojis en el Inicio: ${emojis.join(' ')}`);
  assert.equal(n.filter((x) => tag(x) === 'H1').length, 0, '🔴 el Inicio pinta su propio H1 además del de la barra superior');
  assert.ok(n.some((x) => tag(x) === 'H2' && /home-greeting-titulo/.test(clase(x))), '🔴 el saludo ha desaparecido');
  for (const nombre of ['ajustes', 'presupuesto', 'clientes', 'cobro', 'aviso']) {
    assert.ok(n.some((x) => new RegExp(`\\bcon-icono--${nombre}\\b`).test(clase(x))), `🔴 falta el icono «${nombre}»`);
    assert.ok(new RegExp(`\\.con-icono--${nombre}\\s*\\{\\s*--icono-menu: url\\("data:image/svg\\+xml`).test(css), `🔴 falta el dibujo de «con-icono--${nombre}»`);
  }
});

test('1762c ② · la tarjeta del dinero sin raya lateral, y aire bajo los avisos', () => {
  const reglas = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter((m) => m[1].split(',').map((s) => s.trim()).includes('.home-hero-card'));
  assert.ok(reglas.length > 0, '🔴 CIEGO: no encuentro `.home-hero-card`');
  assert.equal(reglas.filter((m) => /border-left\s*:/.test(m[2])).length, 0, '🔴 `.home-hero-card` sigue con raya lateral');
  assert.match(css, /#home-precarga:not\(:empty\)[^{]*\{\s*margin-bottom:\s*16px/, '🔴 el aviso del albarán sigue pegado a la tarjeta');
});

test('1762c ③ · «Presupuestos» como el menú, y «—» neutro donde no se ha enviado nada', async () => {
  const { r, n } = await inicioDelAdmin();
  assert.doesNotMatch(textoHondo(r.contenedor), /Cotizaciones/, '🔴 el Inicio sigue diciendo «Cotizaciones»');
  assert.ok(n.some((x) => /\bkpi-label\b/.test(clase(x)) && texto(x) === 'Presupuestos sin respuesta'), '🔴 falta «Presupuestos sin respuesta»');
  const filas = n.filter((x) => tag(x) === 'TR');
  const dueña = filas.find((x) => /Dueña/.test(textoHondo(x)));
  const op = filas.find((x) => /Operario QA/.test(textoHondo(x)) && !/Sin actividad/.test(textoHondo(x)));
  assert.ok(dueña && op, '🔴 CIEGO: no encuentro las filas del equipo');
  assert.doesNotMatch(textoHondo(dueña), /0%/, '🔴 0 enviados sigue pintando «0%»');
  assert.ok(todos(dueña).some((x) => tag(x) === 'TD' && texto(x) === '—' && /equipo-tasa-sin-envios/.test(clase(x))), '🔴 0 enviados no pinta el guion neutro');
  assert.match(textoHondo(op), /50%/, '🔴 CONTROL: con envíos la tasa tiene que seguir saliendo');
});
