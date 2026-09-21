// tests/scrum1032-contacto-con-un-toque.test.mjs
//
// SCRUM-1032 (CRM-02) · llamar, escribir por WhatsApp o mandar un correo al cliente con UN TOQUE,
// desde la lista de Clientes y desde su ficha. Hasta hoy: 0 enlaces `tel:` / `wa.me` / `mailto:` en
// las dos pantallas, y el móvil ni se pintaba en la lista.
//
// Lo que se ata:
//   A · la pieza (`contactoDelCliente`): cada caso límite del ticket, con su resultado exacto.
//   B · la LISTA: una fila con datos lleva sus enlaces; una fila vacía no lleva NINGUNO (nunca un
//       botón muerto) y conserva su «sin teléfono».
//   C · la FICHA: lo mismo en la cabecera.
//   D · un enlace de la lista no abre la ficha (`stopPropagation`): la fila entera es clicable.
//
// Los enlaces son del navegador, no envíos de YaQu: no hay ninguna llamada a la red aquí.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const contacto = (c) => cargarDashboard(RAIZ).ctx.contactoDelCliente(c);
const hrefDe = (n) => n.getAttribute('href') || n.href || '';

// ── A · la pieza ──────────────────────────────────────────────────────────────────────────────────
test('SCRUM-1032 · A · cada caso límite del ticket, con su resultado exacto', () => {
  const k = cargarDashboard(RAIZ).ctx.contactoDelCliente;

  // espacios y sin prefijo: se marca tal cual (no se le inventa un país) y wa.me lleva sólo dígitos
  let r = k({ phone: '600 12 34 56' });
  assert.equal(r.telefono.href, 'tel:600123456');
  assert.equal(r.telefono.texto, '600 12 34 56', 'el texto es el dato tal y como lo escribió');
  assert.equal(r.whatsapp.href, 'https://wa.me/600123456');

  // con prefijo: guardado como el servidor lo guarda (11 dígitos) y con +34 / 0034
  for (const v of ['34600123456', '+34 600 12 34 56', '0034 600-12-34-56', '(+34) 600.123.456']) {
    r = k({ phone: v });
    assert.equal(r.telefono.href, 'tel:+34600123456', `«${v}»`);
    assert.equal(r.whatsapp.href, 'https://wa.me/34600123456', `«${v}»`);
  }

  // extranjero
  r = k({ mobile: '+44 20 7946 0958' });
  assert.equal(r.movil.href, 'tel:+442079460958');
  assert.equal(r.whatsapp.href, 'https://wa.me/442079460958');

  // móvil y teléfono iguales → UN solo enlace de llamada (el del teléfono), no dos
  r = k({ phone: '34600123456', mobile: '+34 600 12 34 56' });
  assert.ok(r.telefono && r.movil === null, 'un solo enlace de llamada');
  assert.equal(r.whatsapp.href, 'https://wa.me/34600123456');

  // distintos → los dos, y WhatsApp va al MÓVIL (`Móvil (WhatsApp)`), no al fijo
  r = k({ phone: '34911223344', mobile: '34600123456' });
  assert.equal(r.telefono.href, 'tel:+34911223344');
  assert.equal(r.movil.href, 'tel:+34600123456');
  assert.equal(r.whatsapp.href, 'https://wa.me/34600123456');

  // sólo teléfono → WhatsApp va al teléfono (como el panel del Trabajo)
  assert.equal(k({ phone: '34911223344' }).whatsapp.href, 'https://wa.me/34911223344');

  // correo con mayúsculas: se enlaza tal cual, y el texto es el escrito
  r = k({ email: '  Ana.Perez@Ejemplo.COM ' });
  // (el objeto nace en el contexto del banco: se pasa por JSON para comparar valores, no prototipos)
  assert.deepEqual(JSON.parse(JSON.stringify(r.correo)), { texto: 'Ana.Perez@Ejemplo.COM', href: 'mailto:Ana.Perez@Ejemplo.COM' });
});

test('SCRUM-1032 · A · sin dato válido NO hay enlace, y nunca sale «undefined» ni «null»', () => {
  const k = cargarDashboard(RAIZ).ctx.contactoDelCliente;
  const VACIOS = [undefined, null, {}, { phone: null, mobile: null, email: null },
    { phone: '', mobile: '   ', email: '' }, { phone: 'sin teléfono' }, { phone: '12' }, { mobile: 'llamar a Pepe' },
    { email: 'pepe@' }, { email: 'no es un correo' }, { phone: undefined, email: undefined }];
  for (const c of VACIOS) {
    const r = JSON.parse(JSON.stringify(k(c)));
    assert.deepEqual(r, { telefono: null, movil: null, whatsapp: null, correo: null }, `🔴 ${JSON.stringify(c)}`);
  }
  // Y los que SÍ salen no llevan la palabra en ningún enlace.
  for (const c of [{ phone: '600123456', email: 'a@b.es' }, { mobile: '34600123456' }, { phone: '+34911223344', mobile: '600123456' }]) {
    // sólo lo que se PINTA o se ENLAZA (texto y href): un `movil: null` del objeto no es un enlace
    const visibles = Object.values(JSON.parse(JSON.stringify(k(c)))).filter(Boolean)
      .flatMap((e) => [e.texto, e.href]).filter((s) => s !== undefined).join(' ');
    assert.ok(visibles.length > 0, 'el control positivo: hay algo que mirar');
    assert.doesNotMatch(visibles, /undefined|null/, `🔴 ${JSON.stringify(c)} → ${visibles}`);
  }
  // wa.me: sólo dígitos, siempre
  for (const v of ['+34 600 12 34 56', '600.123.456', '(0034) 600-123-456']) {
    assert.match(k({ mobile: v }).whatsapp.href, /^https:\/\/wa\.me\/\d{8,15}$/, v);
  }
});

// ── B · la lista ──────────────────────────────────────────────────────────────────────────────────
const CLIENTES = [
  { id: 1, name: 'Ana Pérez', phone: '34911223344', mobile: '34600123456', email: 'Ana@Ejemplo.com', notes: '', tags: null, createdAt: '2026-01-05T10:00:00Z' },
  { id: 2, name: 'Cliente vacío', phone: null, mobile: null, email: null, notes: '', tags: null, createdAt: '2026-01-06T10:00:00Z' },
  { id: 3, name: 'Solo teléfono', phone: '34911000111', mobile: null, email: '', notes: '', tags: null, createdAt: '2026-01-07T10:00:00Z' },
];

async function listaDeClientes() {
  const banco = cargarDashboard(RAIZ, { datos: (ruta) => (String(ruta).startsWith('/admin/customers') ? CLIENTES : {}) });
  const r = await pintarVista(banco, 'renderCustomersView');
  assert.equal(r.error, null, `la lista no se monta: ${r.error}`);
  const filas = todos(r.contenedor).filter((n) => n.tagName === 'TR' && todos(n).some((h) => h.tagName === 'TD'));
  return { banco, filas };
}
const enlacesDe = (n) => todos(n).filter((h) => h.tagName === 'A');

test('SCRUM-1032 · B · la fila con datos lleva sus enlaces; la vacía, ninguno', async () => {
  const { filas } = await listaDeClientes();
  assert.equal(filas.length, 3, `esperaba 3 filas y salieron ${filas.length}`);

  const completa = enlacesDe(filas[0]).map(hrefDe);
  assert.deepEqual(completa, ['tel:+34911223344', 'tel:+34600123456', 'https://wa.me/34600123456', 'mailto:Ana@Ejemplo.com'],
    '🔴 la fila completa: teléfono, móvil, WhatsApp (al móvil) y correo');
  const wa = enlacesDe(filas[0]).find((a) => hrefDe(a).startsWith('https://wa.me/'));
  assert.equal(wa.getAttribute('aria-label'), 'WhatsApp', '🔴 el enlace de WhatsApp, que en la lista es sólo el icono, lleva su nombre accesible (el rótulo ya en uso)');
  assert.equal(wa.target || wa.getAttribute('target'), '_blank', 'WhatsApp se abre aparte');

  const vacia = filas[1];
  assert.equal(enlacesDe(vacia).length, 0, '🔴 la fila vacía NO lleva ningún enlace (nunca un botón muerto)');
  assert.ok(todos(vacia).some((h) => h._texto === 'sin teléfono'), 'y conserva su «sin teléfono»');

  const soloTel = enlacesDe(filas[2]).map(hrefDe);
  assert.deepEqual(soloTel, ['tel:+34911000111', 'https://wa.me/34911000111'], 'sólo teléfono: llamar y WhatsApp a ese número');

  const todo = filas.map((f) => enlacesDe(f).map((a) => `${hrefDe(a)} ${a.textContent}`).join(' ')).join(' ');
  assert.doesNotMatch(todo, /undefined|null/, '🔴 ningún enlace sale con «undefined» ni «null»');
});

// ── C · la ficha ──────────────────────────────────────────────────────────────────────────────────
async function fichaDe(customer) {
  const detalle = { customer, quotes: [], invoices: [], stats: {}, events: [] };
  const banco = cargarDashboard(RAIZ, {
    datos: (ruta) => (String(ruta).endsWith('/detail') ? detalle : String(ruta).endsWith('/historial') ? null : {}),
  });
  const r = await pintarVista(banco, 'renderCustomer360View', customer.id);
  assert.equal(r.error, null, `la ficha no se monta: ${r.error}`);
  const cabecera = todos(r.contenedor).find((n) => String(n.className || '').includes('customers-card'));
  assert.ok(cabecera, 'la ficha pinta su cabecera');
  return cabecera;
}

test('SCRUM-1032 · C · la cabecera de la ficha lleva los enlaces del cliente completo y ninguno del vacío', async () => {
  const completa = await fichaDe({ id: 1, name: 'Ana Pérez', phone: '34911223344', mobile: '34600123456', email: 'Ana@Ejemplo.com', createdAt: '2026-01-05T10:00:00Z' });
  assert.deepEqual(enlacesDe(completa).map(hrefDe), ['tel:+34911223344', 'tel:+34600123456', 'https://wa.me/34600123456', 'mailto:Ana@Ejemplo.com'],
    '🔴 la ficha completa: teléfono, móvil, WhatsApp (al móvil) y correo');

  const vacia = await fichaDe({ id: 2, name: 'Cliente vacío', phone: null, mobile: null, email: null, createdAt: '2026-01-06T10:00:00Z' });
  assert.equal(enlacesDe(vacia).length, 0, '🔴 la ficha vacía no lleva ningún enlace');
  const html = todos(vacia).map((n) => n._html || '').join(' ') + todos(vacia).map((n) => n._texto || '').join(' ');
  assert.doesNotMatch(html, /undefined|null/, '🔴 la cabecera vacía no escribe «undefined» ni «null»');

  // un teléfono que no es un número se PINTA (como hasta hoy) pero sin enlace
  const raro = await fichaDe({ id: 3, name: 'Dato raro', phone: 'llamar a Pepe', mobile: null, email: 'no es un correo', createdAt: '2026-01-07T10:00:00Z' });
  assert.equal(enlacesDe(raro).length, 0, 'ni el texto raro ni el falso correo se vuelven enlace');
  assert.match(todos(raro).map((n) => n._html || '').join(' '), /llamar a Pepe/, 'pero el texto se sigue viendo');
});

// ── D · un enlace no abre la ficha ────────────────────────────────────────────────────────────────
test('SCRUM-1032 · D · los enlaces de la lista frenan el clic: la FILA abre la ficha y tocar el número no debe', () => {
  const fuente = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/customersView.js'), 'utf8');
  const cuerpo = fuente.slice(fuente.indexOf('function enlaceDeContacto'), fuente.indexOf('function celdaDeTelefonos'));
  assert.ok(cuerpo.length > 50, 'encuentro `enlaceDeContacto`');
  assert.match(cuerpo, /addEventListener\(\s*"click",\s*\(ev\)\s*=>\s*ev\.stopPropagation\(\)\s*\)/,
    '🔴 el enlace ya no frena el clic: un toque en el número sacaría al profesional de la lista');
  assert.match(cuerpo, /target\s*=\s*"_blank"/, 'WhatsApp se abre aparte');
});
