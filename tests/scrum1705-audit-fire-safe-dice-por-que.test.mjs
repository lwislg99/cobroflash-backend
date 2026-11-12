// SCRUM-1705 · `recordAudit` (T3, fire-safe) SIGUE SIN TUMBAR LA ACCIÓN, PERO YA NO CALLA.
//
// Medido el 11-nov en el CI: el flaky de scrum25 («falta la traza de audit del ZIP») venía
// acompañado de decenas de `[audit] no se pudo registrar:` CON EL MENSAJE VACÍO. La línea salía
// sólo con `e?.message`: ni qué acción, ni de qué merchant, ni qué error. Un fallo que no se
// puede atribuir es un fallo mudo aunque haga ruido.
//
// Decisión del orquestador (SCRUM-1705): la traza sigue siendo NO bloqueante —un export no puede
// caer porque la auditoría hipe—, pero el error se dice ENTERO por el canal de errores del
// servidor. La garantía legal más fuerte no está aquí: `exportacion_fiscal` y las de portabilidad
// ya son BLOQUEANTES (`ACCIONES_BLOQUEANTES`, audit.service.ts) y van por `recordAuditOrThrow`.
//
// Sin BD: se sustituye `prisma.auditLog.create` del MISMO cliente que usa `audit.service` por un
// doble que rechaza, y se escucha `console.error`. Construir el `PrismaClient` no conecta.
// Nada de `src/` existe por este test: se observa la función pública tal cual.
//
// La espera es a que llegue la línea, con una RED de última instancia que sólo convierte
// «colgado» en «rojo con motivo»: no hay reloj decidiendo el veredicto.
import test from 'node:test';
import assert from 'node:assert/strict';

const RED_MS = 5_000;

async function fallarYEscuchar(error, params) {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { recordAudit } = await import('../dist/modules/system/audit.service.js');

  const delegate = prisma.auditLog;
  const createOriginal = delegate.create;
  const errorOriginal = console.error;
  let intentos = 0;
  let linea = null;
  let avisar;
  const llego = new Promise((r) => { avisar = r; });

  delegate.create = () => { intentos++; return Promise.reject(error); };
  console.error = (...args) => {
    const texto = args.map((a) => (typeof a === 'string' ? a : String(a))).join(' ');
    if (texto.startsWith('[audit]')) { linea = texto; avisar(); return; }
    errorOriginal(...args);
  };

  let devuelto;
  let temporizador;
  try {
    devuelto = recordAudit(params); // no lanza, no se espera: es lo que se mide
    await Promise.race([
      llego,
      new Promise((_, mal) => {
        temporizador = setTimeout(
          () => mal(new Error(`SCRUM-1705: en ${RED_MS} ms no salió ninguna línea «[audit]» por console.error (intentos de create: ${intentos})`)),
          RED_MS,
        );
      }),
    ]);
  } finally {
    clearTimeout(temporizador);
    delegate.create = createOriginal;
    console.error = errorOriginal;
  }
  return { devuelto, intentos, linea };
}

test('SCRUM-1705: un fallo de la traza fire-safe NO tumba la acción y dice acción, merchant, entidad y error', async () => {
  const err = Object.assign(new Error('Timed out fetching a new connection from the connection pool.'), {
    name: 'PrismaClientKnownRequestError', code: 'P2024',
  });
  const r = await fallarYEscuchar(err, {
    merchantId: 4242, action: 'datos_exportados', entityType: 'export', meta: { fichero: 'datos.zip' },
  });

  assert.equal(r.devuelto, undefined, 'recordAudit sigue siendo void: quien llama no espera nada');
  assert.equal(r.intentos, 1, 'se intentó escribir exactamente una vez');
  assert.match(r.linea, /datos_exportados/, `la línea debe decir QUÉ acción no se registró: ${r.linea}`);
  assert.match(r.linea, /merchant 4242/, `la línea debe decir de QUÉ merchant: ${r.linea}`);
  assert.match(r.linea, /export/, `la línea debe decir la entidad: ${r.linea}`);
  assert.match(r.linea, /P2024/, `la línea debe llevar el código del error: ${r.linea}`);
  assert.match(r.linea, /connection pool/, `la línea debe llevar el mensaje del error: ${r.linea}`);
  assert.ok(!r.linea.includes('datos.zip'), `meta NO se imprime (puede llevar datos personales): ${r.linea}`);
});

test('SCRUM-1705: con el mensaje VACÍO (lo medido en el CI) la línea sigue diciendo algo atribuible', async () => {
  const err = Object.assign(new Error(''), { name: 'PrismaClientUnknownRequestError' });
  const r = await fallarYEscuchar(err, { merchantId: 7, action: 'datos_exportados', entityType: 'export' });

  assert.match(r.linea, /datos_exportados/, `sin mensaje, la acción tiene que estar: ${r.linea}`);
  assert.match(r.linea, /merchant 7\b/, `sin mensaje, el merchant tiene que estar: ${r.linea}`);
  assert.match(r.linea, /PrismaClientUnknownRequestError/, `sin mensaje, el TIPO de error tiene que estar: ${r.linea}`);
});
