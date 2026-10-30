# SCRUM-1457 · CRUCE DE CARRIL DECLARADO (`area-j3`, lo trabaja J2e) — un `merchantId` que no cabe en la columna: NADA construido; una línea espera el GO y tres son una decisión, no un arreglo

**Medido contra:** `origin/main` = `b71719f32f623729debec40518e3c7c6d3601086` · 2026-10-06T13:45:45Z

6-oct-2026 · **J2e** (puesto J2, equipo de Javier), por encargo del orquestador (`cobroflash-backend-90`).
[Escrito por J2e, una sesión; no por el fundador.]

El ticket es del carril de J3. Lo trabaja J2 porque el orquestador dio los tres de la familia (1455,
1456, 1457) a una sola sesión. La forma única (`cabeEnColumnaInt`) y el borde derivado del esquema están
en `docs/master/SCRUM-1456.md` (Ⓐ y Ⓑ).

A9: aviso → cicatriz J2 «otra hora a ojo en un mensaje al orquestador: puse ~13:50Z y GitHub, leído minutos después, decía 13:28Z; es la quinta línea de J2 con lo mismo» — no se pudo comprobar: el mensaje al orquestador sale por la herramienta de mensajes, que ningún hook del repositorio ve antes de enviar

## Ⓐ Las cuatro líneas, y por qué ninguna está tocada

| Línea (`origin/main` `8dcc6d2a`) | Qué hace con el id | Estado |
|---|---|---|
| `system/app/routes/supresion.routes.ts:34` | `prisma.merchant.findUnique`, detrás del flag `MERCHANT_DELETE_ENABLED` y de la comparación con `req.merchantId` | NO HECHO → al fundador (SCRUM-1456 c.18414: borrado de datos) |
| `billing/app/routes/stripe.routes.ts:97` | `prisma.merchant.update` (suscripción nueva) | NO HECHO → **decisión**, abajo |
| `stripe.routes.ts:139` | `prisma.merchant.update` (`customer.subscription.*`) | NO HECHO → **decisión**, abajo |
| `stripe.routes.ts:177` | `prisma.merchant.update` (`customer.subscription.deleted`) | NO HECHO → **decisión**, abajo |

**`supresion.routes.ts:34`, leído:** un `merchantId` enorme pasa la línea 34, pero la 46 lo compara con
`req.merchantId` ANTES de tocar la base y contesta 404. Como `req.merchantId` es un id que existe, un
valor que no cabe **no puede ser igual** y nunca llega al `findUnique`. O sea: en esa ruta el defecto
del ticket (llegar a la base) **no es alcanzable hoy ni con el flag encendido**; lo que cambiaría el
arreglo es el código de la respuesta, de 404 a 400. LEÍDO, no ejecutado.

## Ⓑ La decisión: la aceptación 3 no se puede cumplir con el arreglo que el ticket propone

La aceptación 3 dice: «un `merchant_id` que no cabe se ignora igual que hoy se ignora uno que no es
entero; **ninguna respuesta a Stripe cambia**». Las dos mitades no caben juntas. LEÍDO en
`stripe.routes.ts`:

- **Hoy**, con un `merchant_id` que no cabe: `prisma.merchant.update` lanza, el `catch` anota el fallo
  del evento y contesta **400**. Stripe reintenta.
- **Con `cabeEnColumnaInt` en esas líneas:** el bloque se salta, el evento se marca procesado y se
  contesta **200**. Stripe deja de reintentar.

Para el valor que no cabe, la respuesta a Stripe CAMBIA (400 → 200). Si se quiere «ignorar», cambia el
reintento; si se quiere «que nada cambie», no hay nada que arreglar en esas tres líneas. Cuál de las dos
es una decisión de un jefe sobre la fuente única de la FSM de la Parte L, no de la sesión.

El ticket ya avisa de que ese `merchant_id` lo escribimos nosotros en la `metadata`: un valor enorme no
lo pone un tercero. No ejecutado: pide fabricar un evento firmado de Stripe.

Subido al orquestador el 6-oct. Lo dejó escrito en SCRUM-1456 c.18414: esas tres **no se tocan**, y la
contradicción queda para quien la decida.

## Ⓒ Lo que queda sin hacer, dicho

Las cuatro líneas. **Este ticket no tiene nada construido en este PR:** lo que lleva es la medición
de por qué no se construye sin una decisión.

---

## J3 · SCRUM-1457a · la línea de supresión, con la guarda de la casa

**Medido contra:** `origin/main` = `7083e0ddcaea127e01642550adc6b3d8d495f5e1` · 2026-10-23T16:33:26Z (mezclado dentro de la rama, A4; sesión J3 `jv-j3at`, por encargo del orquestador `cobroflash-backend-62`; GO del fundador en SCRUM-1456 c.18731, y las tres de Stripe fuera por SCRUM-1457 c.20594)

A9: comprobación → `tests/scrum1387-banco-nuevo-va-al-catalogo.test.mjs`

**Error propio, y lo cazó esa comprobación:** escribí el banco de mutaciones con su lista propia, que es
justo lo que SCRUM-1387 prohíbe desde el 13-oct. Salió rojo en la primera pasada de los guards de suite
(`scrum976` → `guards:entrada` → `scrum1387`), antes de empujar. Ahora el test declara
`MUTACIONES_QUE_ME_TUMBAN` y el banco local las lee de ahí con `mutacionesDeclaradas`.
De paso, otro mío: la primera población de ⑥ llevaba la cadena vacía, que no llega a la ruta
(`/admin/supresion/` no casa con `/:merchantId`); salió como un falso «⑥ ROTA» y la quité, con su motivo escrito.
Y un tercero, que cazó el obligatorio del primer empujón (PR #2758, `71ce76b1`, 12.379 = 12.289 + 1 + 89): el
nombre del caso ⑥ iba en plantilla (`${POBLACION.length}`) y `tests/scrum1415-nombres-construidos.test.mjs` exige
nombres literales; no estaba en mi mini-tanda. Ahora el nombre es literal y el caso comprueba que la población es 25.

### Qué cambia

`src/modules/system/app/routes/supresion.routes.ts`: en la guarda de entrada, `Number.isInteger(merchantId)`
pasa a `cabeEnColumnaInt(merchantId)` (`src/core/validation/enteroDeColumna.ts`, de S1, sin tocar), más
una línea de `import`. Por el `import`, la guarda baja de `:34` a `:35`. Ninguna otra línea, ningún texto
nuevo (el 400 `merchant_invalido` ya estaba en la línea), el flag `MERCHANT_DELETE_ENABLED` sin tocar.
`stripe.routes.ts` :97/:139/:177 **no se tocan** (c.18731 ④ y c.20594: «No tocarlo»).

### Aceptación → dónde se ve

| aceptación (literal) | dónde se ve |
|---|---|
| 1 · Un `merchantId` de `99999999999999999999` o `10000000000` → 400 en la ruta de supresión, sin llegar a la base | `tests/scrum1457a-supresion-id-que-cabe.test.mjs`, caso «🔴 un merchantId entero que no cabe»: por la app real (`dist/app.js`, `requireAuth`, `requireRole('admin')`, HTTP), también con `2147483648`; 0 lecturas del merchant y 0 escrituras. Antes del arreglo contestaba **404** (la tenencia de SCRUM-440 lo paraba antes de la base, como midió c.18438): el cambio es 404 → 400 |
| 2 · Controles: `abc` sigue en 400; un id válido sigue haciendo lo que hace hoy | el mismo test: `abc` en la población de ⑥ (400); el id propio llega a leer el merchant y a la confirmación (409); `2147483647` ajeno, 404 sin tocar la base; con el flag apagado, 404 para todo |
| 3 · En el webhook: … ninguna respuesta a Stripe cambia | **FUERA DEL ALCANCE** por decisión del fundador (c.20594, «No tocarlo»): las tres líneas se quedan como están |
| c.18731 ⑥ · rechaza más, nunca menos | el caso «⑥ RECHAZA MÁS, NUNCA MENOS»: 25 entradas; para cada una calcula lo que decidía la guarda VIEJA (copiada en el test) y exige que todo lo que rechazaba siga en 400 sin leer la base. Reparto medido sobre la `POBLACION` del fichero: 12 seguían rechazadas, 4 rechazos nuevos (los que no caben), 9 iguales (lo escribí primero de memoria como 13/3/9, y estaba mal). También se deduce del helper: `cabeEnColumnaInt(n)` implica `Number.isInteger(n)` |
| c.18731 ② · que nada reaccione distinto | ninguna pantalla llama a la ruta: `grep -rln "admin/supresion" public` → **0** ficheros, con control positivo `admin/customers` → **12**. Fuera de `public/`, sólo la nombran `src/app.ts` (el montaje) y `src/core/http/adminOnlyRoutes.ts` (el censo de rutas de admin) |
| verlo en yaqu.app | **NO HECHO**: la ruta borra datos y va detrás de un flag apagado; no se ejecuta contra ninguna base real |

### Rojo → verde y mutaciones

- Rojo (punta `c8105df7`, test sin arreglo): 4 casos, **caen 2** (los del cambio, contestan 404), pasan 2.
- Verde (con el arreglo): **4 de 4**.
- Mutaciones (`docs/evidencias/scrum1457a/mutar-1457a.mjs.txt` → `.salida.txt`): base 4 de 4 en verde;
  **3 de 3 caen el caso declarado** (vuelta a `Number.isInteger`, `Number.isSafeInteger`, sin el suelo `<= 0`,
  que sólo tumba ⑥). `git status` limpio al restaurar.
- Guards de suite y vecinos (113, 237, 419, 700, 702, 719, 824, 824b ×2, 836, 976, 1387, 244, 440,
  tenancy-permisos, 1379, 1456 y el nuevo): **213 = 210 pasan + 0 caen + 3 saltados** (`LIBRO_PG_URL` y
  `QA_DB_TEST`, no corridos aquí).

**Suite entera local: NO CORRIDA (la mató el arnés por memoria).** No cupo en los 10 min del primer plano, pasó
a segundo plano y el arnés la paró por falta de memoria de la máquina; lo que dejó escrito no se cuenta. Por
decisión del orquestador (`cobroflash-backend-62`), hace de suite entera el obligatorio de CI de este PR.
Las mini-tandas de arriba se repitieron tras mezclar `7083e0dd`.

**Sin medir:** Postgres de verdad (el banco dobla Prisma); el flag encendido en producción (no se enciende);
yaqu.app.
