# SCRUM-1267 — El alta de albarán viaja con su `claveIdempotencia`

**Medido contra:** `origin/main` = `bd2964d9a4ebfc48a38f8d34cacc1db250ebd144` · 2026-09-29T09:28:01Z

Carril S2 (`jobDetailView.js`, §11bis) · rama `scrum-1267-albaran-clave-idempotencia` · sesión `s2-29a`.
Medición de S4 y S1 en el ticket; no se repitió.

## El defecto

`POST /admin/jobs/:id/albaranes` es idempotente desde SCRUM-358: con la misma clave y el mismo contenido
devuelve el original sin reservar número. Pero `crearAlbaran` (`jobDetailView.js`), el único alta del
front, no mandaba la clave. Si la respuesta se perdía (`incierto`, SCRUM-459, o la red caía a la
vuelta) y el profesional reintentaba, salían DOS albaranes con números seguidos.

## Lo construido

- `openAlbCrearSheet` acuña `claveAlta` UNA vez, al abrir la hoja (`crypto.randomUUID()`; si no existe,
  `alb-<tiempo>-<aleatorio>`, menos de 64 caracteres). `crearAlbaran` la añade al cuerpo. La reutilizan
  todos los reintentos y los dos botones («Crear albarán» y «Entregar y enviar a firmar»). `onGuardar`,
  que es el receptor que vigilan 593e/607, no se toca.
- Censo 1185: `cuerpo · POST /admin/jobs/:id/albaranes::claveIdempotencia` pasa a `retiradas`.

## Tests

`tests/scrum1267-alta-albaran-idempotente.test.mjs`. Usan la ficha real del Trabajo, la hoja de alta real
y el `apiRequest` real. Al otro lado hay un servidor que pasa la clave por la
`normalizarClaveIdempotencia` real (dist):

- 🔴 El viaje: la primera respuesta se pierde (el albarán SÍ se crea) y se reintenta desde la misma hoja.
  Resultado: la misma clave y UN solo albarán.
- Control negativo: el mismo viaje contra un servidor que ignora la clave saca DOS, así que el servidor
  de mentira distingue.
- 🔴 Dos hojas, dos altas legítimas: claves distintas y dos albaranes (la clave es por intento, no por Trabajo).
- El cuerpo solo AÑADE la clave.
- Rojo por mutación: sin la clave en el cuerpo caen 3 de 4. Con la clave acuñada en cada clic cae el
  viaje, que es justo el error del que avisó S1.
- Vecinos (`jobDetailView`, `_sin-consumir-declarados`, `albaranIdempotencia`, 1185): 789/790, 1 saltado
  (staging).

**NO VERIFICADO en yaqu.app** por S2.
