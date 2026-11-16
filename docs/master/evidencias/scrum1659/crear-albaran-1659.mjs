// SCRUM-1659 · crea UN albarán de muestra en la cuenta QA de yaqu.app (autorizado: QA en producción).
// Sólo dos POST, a rutas nombradas: alta en el Trabajo 76 (fixture QA) y, con --emitir <id>, la emisión.
// Ningún envío de WhatsApp. Uso: node crear-albaran-1659.mjs crear | emitir <id>
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const cookie = readFileSync('C:/Users/Admin/.yaqu-qa-sesion.txt', 'utf8').trim();
const BASE = 'https://yaqu.app';
const JOB = 76;
const [orden, arg] = process.argv.slice(2);

async function post(ruta, cuerpo) {
  const r = await fetch(BASE + ruta, {
    method: 'POST', redirect: 'manual',
    headers: { cookie, 'content-type': 'application/json', origin: BASE },
    body: JSON.stringify(cuerpo || {}),
  });
  const t = await r.text();
  console.log('POST', ruta, '→', r.status, 'Date:', r.headers.get('date'));
  console.log(t.slice(0, 1500));
  if (!r.ok) process.exitCode = 1;
  return t;
}

if (orden === 'crear') {
  await post(`/admin/jobs/${JOB}/albaranes`, {
    modoValoracion: 'VALORADO',
    claveIdempotencia: randomUUID(),
    fechaEntrega: '2026-11-10',
    notas: 'Sustitución del tramo de tubería bajo el lavabo y cambio de grifo. Probado sin fugas.',
    lineas: [
      { concepto: 'Tubo multicapa 20 mm', cantidad: 12, unidad: 'm', precioUnitario: 3.85, tipoIva: 21 },
      { concepto: 'Codo multicapa 20 mm a presión', cantidad: 8, unidad: 'ud', precioUnitario: 2.4, tipoIva: 21 },
      { concepto: 'Grifo monomando de lavabo', cantidad: 1, unidad: 'ud', precioUnitario: 64.9, tipoIva: 21 },
      { concepto: 'Mano de obra oficial fontanero', cantidad: 2, unidad: 'h', precioUnitario: 35, tipoIva: 21 },
    ],
  });
} else if (orden === 'emitir' && /^\d+$/.test(arg || '')) {
  await post(`/admin/albaranes/${arg}/emitir`, {});
} else {
  console.error('uso: crear | emitir <id>'); process.exitCode = 3;
}
