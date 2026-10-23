// Sonda de un solo uso (SCRUM-1251): ejecuta el LECTOR REAL del paquete con un prisma falso.
// Merchant fabricado id=777, sin facturas ni albaranes. Imprime ficheros, tamaños y avisos.
const path = require('path');
const dist = process.argv[2];
const { leerPaqueteEvidencias } = require(path.join(dist, 'modules/fiscal/evidencias/paquete.repo.js'));
const { FICHEROS } = require(path.join(dist, 'modules/fiscal/evidencias/paquete.js'));

const llamadas = [];
const modelo = (nombre) => new Proxy({}, {
  get: (_, op) => async (args) => {
    llamadas.push(`${nombre}.${String(op)}`);
    if (op === 'findMany' || op === 'groupBy') return [];
    if (op === 'findUnique' || op === 'findFirst') {
      if (nombre === 'merchant') return { id: 777, name: 'Banco 1251', legalName: 'Banco 1251 SL', taxId: 'B00000000', country: 'ES', timezone: 'Europe/Madrid', taxRegime: null };
      return null;
    }
    if (op === 'count') return 0;
    if (op === 'aggregate') return { _sum: {}, _count: 0 };
    return null;
  },
});
const db = new Proxy({}, { get: (_, m) => (m === '$queryRaw' || m === '$queryRawUnsafe') ? async () => [] : modelo(String(m)) });

(async () => {
  const p = await leerPaqueteEvidencias(db, { merchantId: 777, año: 2026, trimestre: 3 });
  console.log('ficheros:', p.ficheros.length);
  for (const f of p.ficheros) console.log('  ', f.nombre, Buffer.byteLength(f.contenido), 'B');
  console.log('avisos:', JSON.stringify(p.avisos));
  // Control positivo: los 7 nombres declarados en FICHEROS tienen que salir todos.
  const declarados = Object.values(FICHEROS).sort();
  const salidos = p.ficheros.map((f) => f.nombre).sort();
  console.log('control FICHEROS ⊆ salida:', declarados.every((n) => salidos.includes(n)), `(${declarados.length} declarados)`);
  console.log('llamadas a la base:', [...new Set(llamadas)].join(' '));
  const m = p.ficheros.find((f) => f.nombre === 'manifiesto.json');
  console.log('manifiesto:', m.contenido.slice(0, 1500));
  const l = p.ficheros.find((f) => f.nombre === 'modelo-303.csv');
  console.log('modelo-303.csv:', JSON.stringify(l.contenido.slice(0, 600)));
})().catch((e) => { console.error('SONDA CAYÓ:', e); process.exit(1); });
