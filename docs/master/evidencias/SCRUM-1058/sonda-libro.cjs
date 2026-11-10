// Sonda SCRUM-1058b: ¿el libro de expedidas lee el destinatario de la FICHA VIVA (por customerId)
// o de las columnas congeladas de la factura? Doble de base en memoria; código real compilado.
//
// Uso (sin tocar el dist/ de nadie): compilar SÓLO el repo del libro a una carpeta temporal y pasarla.
//   node <ruta>/typescript/bin/tsc --noCheck --outDir <TMP>/dist --rootDir src --module commonjs \
//        --target es2022 --esModuleInterop --skipLibCheck --resolveJsonModule \
//        src/modules/fiscal/librosAeat/librosAeat.repo.ts
//   node docs/master/evidencias/SCRUM-1058/sonda-libro.cjs <TMP>/dist
// Salida del 21-oct-2026 en `sonda-libro.salida.txt` (la primera vuelta es el control positivo).
const path = require('path');
const DIST = path.resolve(process.argv[2] || 'dist');
const { leerLibroExpedidasDelTrimestre } = require(path.join(DIST, 'modules/fiscal/librosAeat/librosAeat.repo.js'));

const FICHAS = {
  10: { id: 10, name: 'Fusionado SL', legalName: null, taxId: 'B11111111' },
  20: { id: 20, name: 'Principal SA', legalName: null, taxId: 'B22222222' },
};

function factura(customerId) {
  return {
    id: 1, merchantId: 1, number: 'F-2026-0001', createdAt: new Date('2026-10-05T10:00:00Z'),
    paidAt: null, type: 'F1', total: '121.00', currency: 'EUR', status: 'pending',
    customerId, quoteId: null, chargeId: null, albaranRefs: null,
    lines: [{ description: 'x', quantity: 1, unitPrice: 100, vatRate: 21 }],
    // Las cinco congeladas: la factura se emitió a Fusionado SL.
    customerName: 'Fusionado SL', customerLegalName: null, customerTaxId: 'B11111111',
    customerEmail: null, customerPhone: null,
  };
}

function db(customerId) {
  const llamadas = [];
  const modelo = (nombre) => new Proxy({}, {
    get: (_, op) => async (args) => {
      llamadas.push(`${nombre}.${String(op)}`);
      if (nombre === 'invoice' && op === 'findMany') return [factura(customerId)];
      if (nombre === 'customer' && op === 'findMany') return (args.where.id.in || []).map((i) => FICHAS[i]).filter(Boolean);
      if (op === 'findMany') return [];
      if (op === 'count') return 0;
      return { id: 1, criterioCaja: false, recc: false, country: 'ES' };
    },
  });
  return { db: new Proxy({}, { get: (_, m) => modelo(String(m)) }), llamadas };
}

(async () => {
  for (const cid of [10, 20]) {
    const { db: d, llamadas } = db(cid);
    try {
      const r = await leerLibroExpedidasDelTrimestre(d, { merchantId: 1, año: 2026, trimestre: 4 });
      console.log(`customerId=${cid} · miradas=${r.miradas} · filas=${r.filas.length}`);
      for (const f of r.filas) console.log('  ', JSON.stringify(f));
    } catch (e) {
      console.log(`customerId=${cid} · LANZA: ${e.message}`);
    }
    console.log('   llamadas:', llamadas.join(', '));
  }
})();
