// tests/fixtures/scrum814-peticion-simultanea.mjs — SCRUM-814
//
// UNA petición POST /admin/quotes/:id/invoice, lanzada por un PROCESO PROPIO a una hora de
// salida pactada. No es un test: es el cliente que el test pilota.
//
// ── POR QUÉ UN PROCESO Y NO UNA PROMESA MÁS ──────────────────────────────────────────────────
//
// `Promise.all([emitir(), emitir()])` NO es simultaneidad: las dos salidas comparten el bucle de
// eventos y el agente HTTP del mismo node, así que la segunda sale cuando la primera ya ha
// escrito su petición en el socket. La primera medición de SCRUM-814 dijo «no se reproduce» por
// eso, y ese verde no medía nada. Dos procesos no comparten ni bucle ni agente: la única cita
// que tienen es el reloj.
//
// ── LA HORA DE SALIDA ────────────────────────────────────────────────────────────────────────
//
// `T0` llega por argumento. El proceso duerme hasta 20 ms antes y remata con una rueda fina
// (`while`), porque `setTimeout` en Windows llega tarde y con dispersión de decenas de ms — y el
// suelo del banco es 120 ms de desfase entre las dos salidas. Bloquear el bucle 20 ms aquí no
// tiene coste: este proceso no hace nada más.
//
// `listo` es cuando el proceso ya está en marcha y esperando. El test lo EXIGE anterior a `T0`:
// si un hijo arrancó tarde, no hubo cita y no se concluye nada.
//
// Escribe UNA línea JSON en stdout y termina. Nada más: no toca la base de datos, no importa
// Prisma y no sabe qué está midiendo.
const [, , base, cookie, quoteId, t0] = process.argv;
const T0 = Number(t0);

const listo = Date.now();
const grueso = T0 - Date.now() - 20;
if (grueso > 0) await new Promise((r) => setTimeout(r, grueso));
while (Date.now() < T0) { /* rueda fina: los últimos milisegundos, a pulso */ }

const salida = Date.now();
let status = null;
let cuerpo = null;
let error = null;
try {
  const res = await fetch(`${base}/admin/quotes/${quoteId}/invoice`, {
    method: 'POST',
    headers: { cookie, 'Content-Type': 'application/json' },
  });
  status = res.status;
  cuerpo = await res.json().catch(() => null);
} catch (e) {
  error = String(e?.message || e);
}

process.stdout.write(`${JSON.stringify({ listo, salida, status, cuerpo, error })}\n`);
