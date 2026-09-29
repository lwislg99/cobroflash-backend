# SCRUM-1276 · Un presupuesto decidido no se reabre con el mismo enlace

**Medido contra:** `origin/main` = `fcc2cc01a6ba29ed57bece0844508d513cd86264` · 2026-09-29T10:57:35Z

Carril S1 · sesión s1-29a · rama `scrum-1276-decision-solo-sobre-sent`. Sale de la auditoría del viaje
«el cliente acepta un presupuesto» (hallazgos H1, H4 y H5).

## El defecto (medido por la ruta real)

`POST /quote/:token/decision` solo cerraba el MISMO sentido (idempotencia). Un presupuesto ACEPTADO y
facturado + `{decision:'reject'}` → 200, `acceptedAt` borrado, `quote_rejected` en el historial y un
WhatsApp «❌ rechazó» al profesional de un trabajo ya cobrado. Uno rechazado se aceptaba (y perdía su
`rejectionReason`). Y `GET /pay/quote/:token/reject` pintaba el formulario de rechazo con CUALQUIER
estado, así que se alcanzaba desde pantalla. Dos aceptaciones simultáneas duplicaban historial y aviso.

Parte L:398: «Terminales: accepted/rejected (acción permitida: Duplicar → nuevo draft; jamás reabrir)».

## Alcance: candado sobre los TERMINALES, y `draft` sigue decidible

El ticket decía «solo sobre `sent`». **Medido que eso rompía J5**: si el envío por WhatsApp falla, el
presupuesto se queda en `draft` (`sendQuote.service.ts:111-114`, solo pasa a `sent` si el envío fue bien)
y el panel ofrece copiar el enlace (`quotesDetailView.js:105-116`, A20.5/J5: en fallo de WhatsApp,
siempre las tres salidas). La landing trata `draft` como `sent`. Cerrar a `sent` rechazaba al cliente
justo en la salida de emergencia. Decisión del orquestador (a): candado sobre `accepted`/`rejected`;
`draft → accepted` no reabre nada. Si un draft con el enlace en la calle debe seguir siendo draft es
otro ticket (lo abre el orquestador; toca J5, máster).

## El arreglo

- `src/modules/quotes/domain/decisionDelCliente.ts` (nuevo): `ESTADOS_DECIDIBLES_POR_EL_CLIENTE =
  ['draft','sent']`, el código `quote_already_decided` y su `message`.
- `quotes.routes.ts`: **dos barreras**. ① Al entrar: el sentido contrario sobre un decidido → 409 (el
  mismo sentido sigue con su 200 idempotente). ② La condición `status: { in: … }` EN el `update` de
  aceptar y de rechazar: si otra petición decidió entre leer y escribir, Prisma lanza P2025 y esta se
  relee y contesta como si hubiera llegado después, sin historial, PDF, Trabajo ni aviso.
- Landing (`quoteDecisionLanding.routes.ts`): `GET …/reject` sobre un decidido redirige a
  `/pay/quote/:token` (su página N3); el `POST …/reject` y el botón de aceptar, ante el 409, llevan a
  esa misma página. **Sin texto nuevo.**
- **El `message` del 409 NO es texto nuevo**: es el N3 que la landing ya pinta para esos estados
  («Ya aceptaste este presupuesto. El profesional te informará de los siguientes pasos.» /
  «Rechazaste este presupuesto. ¿Has cambiado de opinión? Pídele uno nuevo a …»), en su variante sin
  fecha. Lo exige el trinquete SCRUM-275 (ninguna respuesta pública nueva sin `message`).
- Censo de SCRUM-421 (`tests/_censo-estados-presupuesto.mjs`): `where:` deja de contarse como
  escritura de estado (igual que `select`/`include`, SCRUM-688), con su control negativo en `scrum421`:
  lo que va bajo `data:` se sigue contando.

## Prueba

`tests/scrum1276-decision-no-reabre.test.mjs`, por la ruta real (base doblada; `quote.update` lanza
P2025 como Prisma si el `where` no casa; WhatsApp en dry-run). Los 7 puntos de la aceptación, el
control de `draft` y la redirección de la landing: 8/8. **Rojo sin el arreglo: 5/8** (pasan los tres
controles, como deben). Vecinos (240 ficheros: rutas, landing, censos, microcopy): 2437 tests, 2430 ✔,
0 ✖, 7 saltados por base.

No toca la emisión: el candado va antes de ella; numeración, sellado y cerrojo de serie intactos.

## Juicio del orquestador (29-sep) sobre el `message` y el censo

- **El `message` del 409 es COPIA del texto firmado, no texto nuevo**: mismo literal N3, en un solo
  sitio (`decisionDelCliente.ts`), y no llega a un contexto nuevo porque la landing lleva en los tres
  caminos a la misma página N3. ⚠️ **Condición:** el día que ese `message` se pinte en un sitio donde
  la landing NO llevaría a la página N3, es un contexto nuevo y vuelve a necesitar firma (regla 39).
  Es firma para este camino, no para siempre.
- **El cambio al censo de SCRUM-421 no relaja el guard**: le quita una ceguera (`where:` no escribe,
  igual que `select`/`include` en SCRUM-688), con control negativo. Aprobado por el orquestador.
