// docs/master/evidencias/SCRUM-1404/reintento-por-la-puerta-real.mjs — SCRUM-1404
//
// ¿SE CUMPLEN HOY LAS TRES AFIRMACIONES DE SCRUM-205 EN EL CAMINO DEL REINTENTO? Ejecutado, no leído.
//
// El test del reintento le pasa a la pasada un `sellar` DOBLE: mira a quién se le pediría sellar, y
// no ejecuta la puerta. Aquí la pasada corre SIN doble de la puerta: llama al `sellarTrasEmision`
// compilado, que llama al `applyVeriFactu` compilado. Lo único doblado es la BASE (por
// `require.cache`, antes de cargar nada de `dist/`), y este doble sí tiene estado.
//
//   ① un sellado que falla en el reintento deja su registro Y devuelve el estado que bloquea;
//   ② ese estado bloquea: se le pide el PDF a `ensureInvoicePdf` (el de producción) y se niega;
//   ③ el reintento no tira ese resultado: la factura sale nombrada como «sigue pendiente».
//
//   node docs/master/evidencias/SCRUM-1404/reintento-por-la-puerta-real.mjs   (después de compilar)
//
// ⚠️ LO QUE NO MIDE: un sellado que SALE BIEN (calcularía una huella contra un doble: no dice nada
// de la cadena y no se ejecuta). El fallo se provoca con una factura sin líneas, que es un rechazo
// del propio `applyVeriFactu` ANTES de leer la cadena; un fallo de la base a mitad del sellado NO
// está aquí. El doble evalúa los `where` en JavaScript: no es Postgres. Y no se escribe ningún PDF.
import path from 'node:path';
import { createRequire } from 'node:module';

const RAIZ = path.resolve(import.meta.dirname, '../../../..');
const requiere = createRequire(import.meta.url);
const rutaDe = (r) => requiere.resolve(path.join(RAIZ, r));

const PENDIENTE = 'pendiente_de_sellado';
const MIN = 60_000;
const M = 4404; // no es el 1 (el demo)

// ── la base doblada, con estado. Lo que no sabe imitar lo DICE: no contesta vacío ───────────────
const banco = { facturas: [], auditoria: [], auditoriaRota: false, llamadas: [] };
function casa(f, where) {
  for (const [campo, cond] of Object.entries(where)) {
    const v = f[campo];
    if (cond === null) { if (v !== null) return false; continue; }
    if (cond instanceof Date || typeof cond !== 'object') { if (v !== cond) return false; continue; }
    const claves = Object.keys(cond);
    if (claves.length === 1 && claves[0] === 'gte') { if (!(v.getTime() >= cond.gte.getTime())) return false; continue; }
    if (claves.length === 1 && claves[0] === 'not' && cond.not === null) { if (v === null) return false; continue; }
    throw new Error(`EL DOBLE NO SABE EVALUAR ${campo}: ${JSON.stringify(cond)}`);
  }
  return true;
}
const SABE = {
  'invoice.findMany': (a) => banco.facturas.filter((f) => casa(f, a.where)).sort((x, y) => x.id - y.id),
  'invoice.findUnique': (a) => banco.facturas.find((f) => f.id === a.where.id) ?? null,
  'invoice.update': (a) => { const f = banco.facturas.find((x) => x.id === a.where.id); Object.assign(f, a.data); return f; },
  'auditLog.create': (a) => { if (banco.auditoriaRota) throw new Error('la base no contesta'); banco.auditoria.push({ ...a.data, createdAt: banco.reloj }); return a.data; },
  'auditLog.findMany': (a) => banco.auditoria.filter((r) => casa(r, a.where)),
};
const modelo = (nombre) => new Proxy({}, {
  get: (_t, metodo) => async (args) => {
    const clave = `${nombre}.${String(metodo)}`;
    banco.llamadas.push([clave, args]);
    if (!SABE[clave]) throw new Error(`EL DOBLE NO SABE IMITAR prisma.${clave}()`);
    return SABE[clave](args);
  },
});
const doble = new Proxy({}, {
  get: (_t, nombre) => {
    if (typeof nombre !== 'string' || nombre === 'then') return undefined;
    if (nombre.startsWith('$')) return async () => { banco.llamadas.push([nombre]); throw new Error(`EL DOBLE NO SABE IMITAR prisma.${nombre}()`); };
    return modelo(nombre);
  },
});
const fPrisma = rutaDe('dist/core/db/prisma.js');
requiere.cache[fPrisma] = { id: fPrisma, filename: fPrisma, loaded: true, exports: { prisma: doble } };

const R = requiere(rutaDe('dist/modules/invoicing/domain/reintentoSellado.js'));
const S = requiere(rutaDe('dist/modules/invoicing/domain/selladoEstado.js'));
const { ensureInvoicePdf } = requiere(rutaDe('dist/lib/invoicing.js'));

// El ruido del registro que se traga su error se cuenta, no se imprime.
let tragados = 0;
const errorDeConsola = console.error;
console.error = (...a) => { if (String(a[0]).startsWith('[audit]')) tragados += 1; else errorDeConsola(...a); };

const corte = new Date('2026-11-01T09:00:00Z');
const nacida = corte.getTime() + 86_400_000;
const factura = (id, number, extra = {}) => ({
  id, number, merchantId: M, customerId: 57, total: '121.00', currency: 'EUR', type: 'F1', status: 'paid',
  lines: [], pdfUrl: 'PENDING_PDF', qrData: 'PENDING', vfHash: null, vfEstado: PENDIENTE, createdAt: new Date(nacida),
  merchant: { id: M, name: 'Taller de prueba', country: 'ES', taxId: 'B00000000', email: 'taller@example.test' },
  customer: { id: 57, name: 'Cliente de prueba' }, rectifies: null, ...extra,
});
const dejarAsentar = () => new Promise((r) => setImmediate(r));

let mal = 0;
const comprobar = (que, visto, esperado) => {
  const ok = JSON.stringify(visto) === JSON.stringify(esperado);
  if (!ok) mal += 1;
  console.log(`  ${ok ? 'ok  ' : 'CAE '} · ${que}: ${JSON.stringify(visto)}${ok ? '' : ` — esperaba ${JSON.stringify(esperado)}`}`);
};
async function pdfDe(id) {
  try { await ensureInvoicePdf(id, doble); return 'ENTREGA'; } catch (e) { return String(e?.message ?? e); }
}
async function recorrido({ titulo, filas, auditoriaRota, pasadas }) {
  banco.facturas = filas; banco.auditoria = []; banco.auditoriaRota = auditoriaRota; banco.llamadas = [];
  const vistas = [];
  for (let i = 1; i <= pasadas; i += 1) {
    banco.reloj = new Date(nacida + i * MIN);
    const antes = banco.llamadas.length;
    const parte = await R.reintentarSelladosPendientes({ ahora: banco.reloj, corte: { desde: corte, motivo: null }, prisma: doble });
    await dejarAsentar();
    const mias = banco.llamadas.slice(antes).map(([q]) => q);
    vistas.push({
      i, parte, conclusion: R.conclusionDelReintento(parte),
      intentos: mias.filter((q) => q === 'invoice.findUnique').length, // la primera lectura de `applyVeriFactu`
      escriturasDeFactura: mias.filter((q) => q === 'invoice.update').length,
      registrosPedidos: mias.filter((q) => q === 'auditLog.create').length,
    });
  }
  console.log(`\n${titulo} · ${pasadas} pasadas, una por minuto`);
  return vistas;
}

console.log(`tope ${R.TOPE_DE_FALLOS} · plazo ${R.plazoDeAgotamientoS()} s · acción contada «${R.ACCION_DEL_SELLADO_FALLIDO}»`);
const PASADAS = R.plazoDeAgotamientoS() / 60 + 8;

// ── CONTROL A CERO: sin fecha de corte, la misma base no recibe ni una llamada ──────────────────
banco.facturas = [factura(70, 'F-2026-0070')]; banco.llamadas = [];
const inerte = await R.reintentarSelladosPendientes({ ahora: new Date(nacida + 60 * MIN), prisma: doble });
console.log('\nCONTROL A CERO · la pasada tal como está hoy en main (sin fecha)');
comprobar('activa', inerte.activo, false);
comprobar('llamadas a la base', banco.llamadas.length, 0);

// ── E1 · el sellado falla en la puerta real y el registro SE ESCRIBE ────────────────────────────
{
  const v = await recorrido({ titulo: 'E1 · factura fiscal sin líneas: la puerta real la rechaza · el registro se escribe', filas: [factura(71, 'F-2026-0071')], auditoriaRota: false, pasadas: PASADAS });
  const p1 = v[0];
  comprobar('① 1.ª pasada: la factura sale como «sigue pendiente»', p1.parte.siguenPendientes.map((f) => f.numero), ['F-2026-0071']);
  comprobar('① 1.ª pasada: registros pedidos por la puerta', p1.registrosPedidos, 1);
  const reg = banco.auditoria[0] ?? {};
  comprobar('① el registro: acción / entidad / id', [reg.action, reg.entityType, reg.entityId], [R.ACCION_DEL_SELLADO_FALLIDO, 'invoice', 71]);
  comprobar('① el registro: por qué falló y en qué estado queda', [reg.meta?.errorMensaje, reg.meta?.estadoResultante], ['invoice_without_lines_not_sealable', PENDIENTE]);
  comprobar('① escrituras sobre la factura en las ' + PASADAS + ' pasadas', v.reduce((s, x) => s + x.escriturasDeFactura, 0), 0);
  comprobar('① la fila al acabar: estado y huella', [banco.facturas[0].vfEstado, banco.facturas[0].vfHash], [PENDIENTE, null]);
  comprobar('② pedirle el PDF a ensureInvoicePdf', await pdfDe(71), S.ERROR_PDF_SIN_SELLAR);
  comprobar('③ intentos de sellar en total (el tope)', v.reduce((s, x) => s + x.intentos, 0), R.TOPE_DE_FALLOS);
  comprobar('③ registros que quedaron', banco.auditoria.length, R.TOPE_DE_FALLOS);
  comprobar('③ primera pasada en que consta agotada', v.find((x) => x.parte.agotadas.length)?.i ?? null, R.plazoDeAgotamientoS() / 60 + 1);
  comprobar('③ pasadas con algo fuera de plazo', v.filter((x) => x.parte.fueraDePlazo.length).length, 0);
  comprobar('③ conclusión de la última pasada', v.at(-1).conclusion, 'hay_que_mirar');
}

// ── E2 · lo mismo, y el registro NO se puede escribir (la base que guarda la anotación no contesta) ──
{
  tragados = 0;
  const v = await recorrido({ titulo: 'E2 · la misma factura · el registro NO se puede escribir', filas: [factura(72, 'F-2026-0072')], auditoriaRota: true, pasadas: PASADAS });
  comprobar('① 1.ª pasada: aun sin registro, sale como «sigue pendiente»', v[0].parte.siguenPendientes.map((f) => f.numero), ['F-2026-0072']);
  comprobar('① registros pedidos / guardados / errores tragados', [v.reduce((s, x) => s + x.registrosPedidos, 0), banco.auditoria.length, tragados], [PASADAS, 0, PASADAS]);
  comprobar('① la fila al acabar: estado y huella', [banco.facturas[0].vfEstado, banco.facturas[0].vfHash], [PENDIENTE, null]);
  comprobar('② pedirle el PDF a ensureInvoicePdf', await pdfDe(72), S.ERROR_PDF_SIN_SELLAR);
  comprobar('③ intentos de sellar en total (sin tope: uno por pasada)', v.reduce((s, x) => s + x.intentos, 0), PASADAS);
  comprobar('③ pasadas en que consta agotada', v.filter((x) => x.parte.agotadas.length).length, 0);
  comprobar('③ el segundo cinturón: primera pasada fuera de plazo', v.find((x) => x.parte.fueraDePlazo.length)?.i ?? null, R.plazoDeAgotamientoS() / 60 + 1);
  comprobar('③ conclusiones: antes del plazo / después', [...new Set(v.map((x) => x.conclusion))], ['todo_en_orden', 'hay_que_mirar']);
}

// ── E3 · CONTROL: un justificante. La puerta real SÍ escribe, y el banco lo ve ──────────────────
{
  const v = await recorrido({ titulo: 'E3 · CONTROL · un justificante (J-…): la puerta real lo marca «no aplica»', filas: [factura(73, 'J-2026-0073')], auditoriaRota: false, pasadas: 2 });
  comprobar('1.ª pasada: sale como «no aplica»', v[0].parte.noAplica.map((f) => f.numero), ['J-2026-0073']);
  comprobar('escrituras sobre la factura / registros de fallo', [v[0].escriturasDeFactura, banco.auditoria.length], [1, 0]);
  comprobar('la fila al acabar', banco.facturas[0].vfEstado, S.SELLADO_NO_APLICA);
  comprobar('2.ª pasada: ya no es candidata', v[1].parte.candidatas, 0);
  comprobar('el portón, para ese estado (sin pedir el PDF: lo escribiría en disco)', S.puedeProducirDocumento(banco.facturas[0].vfEstado), true);
}

// -- E4 - CONTROL del instrumento del PDF: que conteste lo mismo a todo no diria nada ------------
{
  banco.facturas = [factura(74, 'F-2026-0074', { vfEstado: S.SELLADO_HECHO }), factura(75, 'F-2026-0075', { customer: null })];
  console.log('\nE4 · CONTROL · el mismo pdfDe, con otras filas, contesta otra cosa');
  const incoherente = await pdfDe(74);
  comprobar('marcada sellada y sin huella: NO entrega, y NO es el mismo rechazo', [incoherente !== 'ENTREGA', incoherente !== S.ERROR_PDF_SIN_SELLAR], [true, true]);
  console.log('         lo que contesta: ' + incoherente.slice(0, 80));
  comprobar('sin cliente', await pdfDe(75), 'missing_relations');
  comprobar('una factura que no existe', await pdfDe(999), 'invoice_not_found');
}

console.error = errorDeConsola;
console.log(`\ncaen ${mal}`);
console.log(`EXIT=${mal ? 1 : 0}`);
process.exit(mal ? 1 : 0);
