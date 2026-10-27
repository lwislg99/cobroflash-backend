// docs/master/evidencias/SCRUM-1404/sonda-resellado.mjs — SCRUM-1404
//
// ¿PUEDE EL REINTENTO DEL SELLADO PISAR LA HUELLA DE UNA FACTURA QUE YA LA TIENE? Ejecutado, no leído.
//
// Es la regla 29 del máster (una factura emitida jamás se edita) preguntada por efecto. La pasada
// corre por la puerta REAL: `reintentarSelladosPendientes` llama al `sellarTrasEmision` compilado,
// que llama al `applyVeriFactu` compilado. Lo único doblado es la BASE (por `require.cache`, antes
// de cargar nada de `dist/`), y el doble apunta cada escritura con los campos que toca.
//
// El caso peor: la lectura de candidatas devuelve una foto VIEJA («sin huella») de una fila que en
// la base YA está sellada. Es lo que pasaría si otra entrega la sellara entre que la pasada lee y
// que la pasada sella. Lo que la para es la guarda de SCRUM-1330, dentro del cerrojo de
// `applyVeriFactu`: relee la fila y, si tiene huella, devuelve la guardada sin escribir.
//
//   P  · CONTROL POSITIVO: una factura nueva sin huella SÍ se sella, y el doble VE esa escritura.
//        Sin él, «cero escrituras de huella» en S lo daría igual un doble que no apunta nada.
//   S  · el caso: foto vieja de una fila ya sellada. Se exige que se llegue a `applyVeriFactu`
//        (cerrojo tomado) y que lo ÚNICO escrito sea el estado.
//   S2 · la factura sellada en P, ofrecida otra vez con una foto vieja.
//
//   node docs/master/evidencias/SCRUM-1404/sonda-resellado.mjs      (después de compilar `dist/`)
//
// CÓMO SE SABE QUE DISTINGUE: `mutar-guarda.mjs`, al lado, quita esa guarda del compilado y la
// vuelve a correr. Con la guarda quitada caen las de S que miran QUÉ se escribió y la de las
// escrituras de S2; las que sólo dicen «el caso se ejerció» siguen en pie, como deben.
//
// La escribió y la midió la sesión jv-j1a (J1, equipo de Javier) el 14-oct-2026: SCRUM-1507,
// comentario 19509. Vivía en la carpeta temporal de su trabajo. Lo cambiado al traerla está en el
// diff de este fichero contra su commit anterior, que es su copia byte a byte.
//
// ⚠️ LO QUE NO MIDE:
//  · El doble no es Postgres: el cerrojo se ANOTA, no se ejerce. Dos sellados a la vez de verdad
//    los cubre `tests/scrum1330-una-sellada-no-se-resella.test.mjs`, no esto.
//  · La huella que se calcula en P se calcula contra el doble: no dice nada de la cadena.
//  · La cola de la AEAT: en P, tras sellar, el encolado no sale y deja `encolado_fallido` en el
//    doble. Se imprime, no se juzga, y no se ha mirado por qué.
//  · Un fallo de la base a mitad del sellado.
//
// POR QUÉ S2 ESPERA ANTES DE EMPEZAR. Tal como llegó, «la huella es la de P» NO distinguía: con la
// guarda quitada la factura se vuelve a sellar, pero en la huella no entra el instante entero sino
// lo que devuelve `formatFechaHoraHuso`, que lo corta al segundo. Mismos datos y mismo segundo dan
// la misma huella, así que un resellado dentro del segundo de P no se veía en esa comprobación.
// La espera no es un número de milisegundos elegido: S2 no empieza hasta que ESA MISMA función
// devuelve, para «ahora», otra cadena que la que devolvió para el instante en que se selló P. El
// reloj no retrocede a la cadena de P, así que cualquier resellado posterior lleva otro instante
// en la huella, y con él otra huella. Si la función cambiara de corte, la espera cambia con ella.
import path from 'node:path';
import { createRequire } from 'node:module';

// Por defecto, el árbol donde vive este fichero. Con un argumento, otro árbol ya compilado.
const RAIZ = path.resolve(process.argv[2] ?? path.join(import.meta.dirname, '../../../..'));
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
let hechas = 0;
const comprobar = (que, visto, esperado) => {
  const ok = JSON.stringify(visto) === JSON.stringify(esperado);
  hechas += 1;
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

// La raíz no se imprime: es la ruta de UNA máquina y haría distinta cada salida guardada.
decir(`POBLACION: 3 casos (P, S, S2) · sobre el compilado de ${process.argv[2] ? 'el árbol pasado por argumento' : 'este árbol'}`);

// ── P · CONTROL POSITIVO: el instrumento VE una escritura de huella cuando la hay ────────────────
decir('\nP · control positivo: factura nueva, sin huella, con líneas → la puerta real la sella');
banco.facturas = [fila(81)]; banco.fotoVieja = null;
let parte = await pasada();
comprobar('candidatas / selladas', [parte.candidatas, parte.selladas.map((f) => f.id)], [1, [81]]);
comprobar('escrituras que tocan la huella', tocanHuella().length, 1);
comprobar('la fila tiene huella y estado', [typeof banco.facturas[0].vfHash, banco.facturas[0].vfHash.length > 20, banco.facturas[0].vfEstado], ['string', true, 'sellado']);
comprobar('se entró bajo cerrojo', banco.llamadas.includes('$executeRaw(cerrojo)'), true);
const huellaP = banco.facturas[0].vfHash;
const instanteDeP = banco.facturas[0].vfTimestamp;
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
// La espera derivada (ver cabecera): hasta que lo que entraría en la huella ya no sea lo de P.
const { formatFechaHoraHuso } = requiere(rutaDe('dist/modules/invoicing/domain/verifactu.service.js'));
const loQueEntraEnLaHuella = (d) => formatFechaHoraHuso(d, 'Europe/Madrid');
const topeDeLaEspera = Date.now() + 10_000;
while (loQueEntraEnLaHuella(new Date()) === loQueEntraEnLaHuella(instanteDeP) && Date.now() < topeDeLaEspera) {
  await new Promise((r) => setTimeout(r, 25));
}
comprobar('el instante que entraría ahora en la huella ya no es el de P (el caso se ejerció)', loQueEntraEnLaHuella(new Date()) !== loQueEntraEnLaHuella(instanteDeP), true);
const deP =fila(81, { vfHash: huellaP, vfPrevHash: '', vfTimestamp: new Date(), vfEstado: 'sellado' });
banco.facturas = [deP]; banco.fotoVieja = [{ ...deP, vfHash: null, vfEstado: PENDIENTE }];
parte = await pasada();
comprobar('escrituras que tocan la huella', tocanHuella().length, 0);
comprobar('la huella es la de P', deP.vfHash === huellaP, true);

decir(`\nCOMPROBACIONES HECHAS: ${hechas}`);
decir(`VEREDICTOS QUE CAEN: ${mal}`);
decir(`EXIT=${mal ? 1 : 0}`);
process.exit(mal ? 1 : 0);
