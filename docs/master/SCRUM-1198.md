# SCRUM-1198 · Presupuesto rápido sin teléfono — parte (a): con cliente nuevo, lo tecleado no se pierde

**Medido contra:** `origin/main` = `643e9a65a5756b9729c9f8d4b911ea0c536988b3` · 2026-10-02T13:10:21Z
A9: comprobación → `tests/scrum1198-cliente-nuevo-sin-telefono.test.mjs`

Carril S2 (`public/dashboard/js/homeView.js`) · rama `scrum-1198-cliente-nuevo-sin-telefono` · sesión `s2-2octa`.

**Skill UI:** cargada (`yaqu-premium-ui`, en esta sesión y antes de editar). Cambio de lógica en un fichero de `public/dashboard/js/`: sin marcado, sin estilos y **sin texto**.

## Qué es esta parte y qué no

**(a) quita la pérdida de datos; el código crudo sigue a la vista y lo quita (b), que espera firma.**

El ticket tiene cuatro partes, decididas por el orquestador el 2-oct-2026 («guardar sin enviar»):

- **(a) — este PR:** con cliente nuevo y sin teléfono, se crean el cliente y el presupuesto.
- (b) no pintar el código interno · (c) cerrar el modal y avisar fuera · (d) el literal. **No están aquí**: esperan el texto firmado en el ticket.

## El defecto, medido en yaqu.app

Presupuesto rápido, cliente NUEVO, teléfono vacío, un clic en «Enviar». Cuenta QA, build `643e9a65`.

La única petición que salía:

- `POST /admin/customers` con `{"name":"…","phone":null}` → **400** `{"error":"validation_error","details":[{"path":["phone"],"message":"Invalid input: expected string, received null"}]}`

No había alta de presupuesto ni envío. Después del error: 0 clientes nuevos y 0 presupuestos nuevos. En pantalla, «API 400: validation_error», y lo tecleado, perdido.

**La causa estaba en el panel.** El esquema del alta admite que `phone` no venga; lo que rechaza es `null`. Y `homeView.js` mandaba `phone: phone || null`. El servidor no se niega a guardar un cliente sin teléfono.

Dos lecturas anteriores parecían contradecirse y las dos eran ciertas: el `phone` es opcional en el esquema (leído por S1) y el alta sin teléfono daba 400 (medido por s2-1octb).

## El arreglo

Una línea: sin teléfono, `phone` no viaja. Con teléfono, viaja igual que antes.

## Verificado, ejecutando

**En el banco** — `tests/scrum1198-cliente-nuevo-sin-telefono.test.mjs`, modal real y una red de mentira con el contrato medido (rechaza `phone: null` con el cuerpo de producción, acepta que no venga):

- **Rojo antes** (con el `homeView.js` de `main`): 3 de 5 caen (sin teléfono, teléfono de sólo espacios, y el reintento). Pasan el suelo y el control con teléfono.
- **Verde después:** 5 de 5.
- **Corrección del propio test (s2-2octc):** el caso CONTROL escribía un teléfono de rango móvil real (`346…`) y el guard de SCRUM-262 lo cazó en el obligatorio (1 rojo de 10258). Estaba en el test, no en nada que mande la pantalla. Ahora lleva uno del rango imposible (`340…`); el guard no se ha tocado.

**Contra yaqu.app**, con el `homeView.js` de esta rama servido por la sonda en lugar del de producción (todo lo demás, producción). Service worker bloqueado; control positivo del interceptor antes de pulsar. Tres clics seguidos en «Enviar»:

| Petición | Veces | Respuesta de producción |
| --- | --- | --- |
| `POST /admin/customers` con `{"name":"…"}` | 1 | **201**, cliente #84, `phone: null` |
| `POST /quote/create` | 1 | **201**, presupuesto #205, borrador |
| `POST /admin/quotes/205/send-whatsapp` | 3 | **400** `customer_missing_phone` las tres |

- El alta sin `phone` da 201: ejecutado, no deducido del esquema.
- Los reintentos no duplican (SCRUM-1371 sigue valiendo con el `phone` omitido): un cliente, un presupuesto.
- No salió ningún WhatsApp: el cliente no tiene teléfono y el servidor corta antes de intentarlo.
- Con esto, cliente nuevo y cliente existente hacen lo mismo: todo queda guardado y falla sólo el envío.

**Datos de prueba que quedan en la cuenta QA** por esta medición y la anterior: cliente #84 «QA 1198 cliente de prueba sin teléfono», presupuestos #204 y #205 (borradores de 1 €).

## Límites

- **Se sigue leyendo un código interno:** antes «API 400: validation_error», ahora «API 400: customer_missing_phone». Y el modal se queda abierto con el botón encendido. Es (b) y (c).
- Medido en Chromium sin cabeza a 1280 px; no en un móvil.
- El fichero medido contra producción es el de la rama servido por la sonda, no uno desplegado.
- `providersView.js` también manda `phone: phone || null` (dos sitios). No se ha mirado si su alta lo rechaza igual: es otra pantalla y no se toca aquí.
