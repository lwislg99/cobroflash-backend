// SONDA (no entra en el repo): ¿puede el reintento, por la puerta REAL (sellarTrasEmision y
// applyVeriFactu compilados), pisar la huella de una factura que YA la tiene?
// Se le da el caso peor: la lectura de candidatas devuelve una foto VIEJA (sin huella) de una fila
// que en la base ya está sellada. Sólo se dobla la base. Uso: node sonda-resellado.mjs <raiz>
import path from 'node:path';
import { createRequire } from 'node:module';

const RAIZ = path.resolve(process.argv[2]);
const requiere = createRequire(path.join(RAIZ, 'package.json'));
const rutaDe = (r) => requiere.resolve(path.join(RAIZ, r));
const PENDIENTE = 'pendiente_de_sellado';
const M = 4404;

const banco = { facturas: [], fotoVieja: null, llamadas: [], escrituras: [], auditoria: [], noSabe: [] };
const SABE = {
  'invoice.findMany': (a) => {
    if (a.where?.vfHash === null) return banco.fotoVieja ?? banco.facturas.filter((f) => f.vfEstado === PENDIENTE && f.vfHash === null);
    return banco.facturas.filter((f) => f.vfEstado === PENDIENTE && f.vfHash !== null);
  },
  'invoice.findUnique': (a) => banco.facturas.find((f) => f.id === a.where.id) ?? null,
  'invoice.findFirst': (a) => {
    if (a.where?.vfAnulHash) return null;
    const excl = a.where?.id?.not;
    return banco.facturas.filter((f) => f.merchantId === a.where.merchantId && f.vfHash && f.id !== excl).sort((x, y) => y.id - x.id)[0] ?? null;
  },
  'invoice.update': (a) => {
    const f = banco.facturas.find((x) => x.id === a.where.id);
    banco.escrituras.push({ id: a.where.id, campos: Object.keys(a.data).sort() });
    Object.assign(f, a.data);
    return f;
  },
  'merchant.findUnique': () => ({ id: M, timezone: 'Europe/Madrid', email: 'taller@example.test', taxId: 'B00000000', country: 'ES' }),
  'auditLog.findMany': () => [],
  'auditLog.create': (a) => { banco.auditoria.push(a.data.action); return a.data; },
};
const modelo = (nombre) => new Proxy({}, {
  get: (_t, metodo) => async (args) => {
    const clave = `${nombre}.${String(metodo)}`;
    banco.llamadas.push(clave);
    if (!SABE[clave]) { banco.noSabe.push(clave); throw new Error(`EL DOBLE NO SABE IMITAR prisma.${clave}()`); }
    return SABE[clave](args);
  },
});
const hacerDoble = (esTx) => new Proxy({}, {
  get: (_t, nombre) => {
    if (typeof nombre !== 'string' || nombre === 'then') return undefined;
    if (nombre === '$executeRaw') return async () => { banco.llamadas.push('$executeRaw(cerrojo)'); return 1; };
    if (nombre === '$transaction') return esTx ? undefined : async (fn) => { banco.llamadas.push('$transaction'); return fn(hacerDoble(true)); };
    if (nombre.startsWith('$')) return async () => { banco.noSabe.push(nombre); throw new Error(`EL DOBLE NO SABE IMITAR prisma.${nombre}()`); };
    return modelo(nombre);
  },
});
const doble = hacerDoble(false);
const fPrisma = rutaDe('dist/core/db/prisma.js');
requiere.cache[fPrisma] = { id: fPrisma, filename: fPrisma, loaded: true, exports: { prisma: doble } };
const R = requiere(rutaDe('dist/modules/invoicing/domain/reintentoSellado.js'));

const avisos = [];
const w = console.warn; const l = console.log; const e = console.error;
console.warn = (...a) => { avisos.push(String(a[0])); };
console.error = (...a) => { avisos.push(String(a[0])); };
const decir = (...a) => l(...a);
console.log = (...a) => { avisos.push(String(a[0])); };

const corte = new Date('2026-11-01T09:00:00Z');
const nacida = new Date(corte.getTime() + 86_400_000);
const ahora = new Date(nacida.getTime() + 5 * 60_000);
const fila = (id, extra = {}) => ({
  id, number: `F-2026-00${id}`, merchantId: M, total: '121.00', type: 'F1',
  lines: [{ description: 'Trabajo', quantity: 1, unitPrice: 100, vatRate: 21 }],
  qrData: 'PENDING', vfHash: null, vfPrevHash: null, vfTimestamp: null, vfEstado: PENDIENTE, createdAt: nacida,
  merchant: { country: 'ES', taxId: 'B00000000', email: 'taller@example.test' }, ...extra,
});
let mal = 0;
const comprobar = (que, visto, esperado) => {
  const ok = JSON.stringify(visto) === JSON.stringify(esperado);
  if (!ok) mal += 1;
  decir(`  ${ok ? 'ok  ' : 'CAE '} · ${que}: ${JSON.stringify(visto)}${ok ? '' : ` — esperaba ${JSON.stringify(esperado)}`}`);
};
const pasada = async () => {
  banco.llamadas = []; banco.escrituras = []; banco.auditoria = []; banco.noSabe = []; avisos.length = 0;
  const parte = await R.reintentarSelladosPendientes({ ahora, corte: { desde: corte, motivo: null }, prisma: doble });
  await new Promise((r) => setImmediate(r));
  return parte;
};
const tocanHuella = () => banco.escrituras.filter((x) => x.campos.includes('vfHash') || x.campos.includes('vfPrevHash') || x.campos.includes('vfTimestamp'));

decir(`POBLACION: 3 casos · raiz ${RAIZ}`);

// ── P · CONTROL POSITIVO: el instrumento VE una escritura de huella cuando la hay ────────────────
decir('\nP · control positivo: factura nueva, sin huella, con líneas → la puerta real la sella');
banco.facturas = [fila(81)]; banco.fotoVieja = null;
let parte = await pasada();
comprobar('candidatas / selladas', [parte.candidatas, parte.selladas.map((f) => f.id)], [1, [81]]);
comprobar('escrituras que tocan la huella', tocanHuella().length, 1);
comprobar('la fila tiene huella y estado', [typeof banco.facturas[0].vfHash, banco.facturas[0].vfHash.length > 20, banco.facturas[0].vfEstado], ['string', true, 'sellado']);
comprobar('se entró bajo cerrojo', banco.llamadas.includes('$executeRaw(cerrojo)'), true);
const huellaP = banco.facturas[0].vfHash;
decir(`  (lo que el doble no supo imitar, después del sellado: ${JSON.stringify([...new Set(banco.noSabe)])} · auditoría: ${JSON.stringify(banco.auditoria)})`);

// ── S · EL CASO: foto vieja «sin huella» de una fila que YA está sellada ──────────────────────────
decir('\nS · la lectura de candidatas trae una foto VIEJA (sin huella) de una factura ya sellada');
const sellada = fila(82, { vfHash: 'HUELLA-ORIGINAL-0082', vfPrevHash: 'PREV-0082', vfTimestamp: new Date('2026-11-02T09:00:01.234Z'), qrData: 'QR-ORIGINAL' });
banco.facturas = [sellada];
banco.fotoVieja = [{ ...sellada, vfHash: null }];
parte = await pasada();
comprobar('la pasada la trató como candidata (el caso se ejerció)', parte.candidatas, 1);
comprobar('se llegó a applyVeriFactu (cerrojo tomado)', banco.llamadas.includes('$executeRaw(cerrojo)'), true);
comprobar('escrituras que tocan la huella', tocanHuella().length, 0);
comprobar('huella, anterior, instante y QR intactos', [sellada.vfHash, sellada.vfPrevHash, sellada.vfTimestamp.toISOString(), sellada.qrData], ['HUELLA-ORIGINAL-0082', 'PREV-0082', '2026-11-02T09:00:01.234Z', 'QR-ORIGINAL']);
comprobar('lo único escrito sobre la factura', banco.escrituras, [{ id: 82, campos: ['vfEstado'] }]);
comprobar('avisó de que la conserva', avisos.some((a) => a.includes('ya estaba sellada')), true);

// ── S2 · la sellada en P, ofrecida otra vez con foto vieja: misma huella ─────────────────────────
decir('\nS2 · la factura sellada en P, ofrecida otra vez con una foto vieja');
const deP = fila(81, { vfHash: huellaP, vfPrevHash: '', vfTimestamp: new Date(), vfEstado: 'sellado' });
banco.facturas = [deP]; banco.fotoVieja = [{ ...deP, vfHash: null, vfEstado: PENDIENTE }];
parte = await pasada();
comprobar('escrituras que tocan la huella', tocanHuella().length, 0);
comprobar('la huella es la de P', deP.vfHash === huellaP, true);

decir(`\nVEREDICTOS QUE CAEN: ${mal}`);
decir(`EXIT=${mal ? 1 : 0}`);
process.exit(mal ? 1 : 0);
