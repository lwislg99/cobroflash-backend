# SCRUM-1429c — dos envíos a la vez de la misma factura por WhatsApp → dos cobros (test, SIN arreglo)

**Medido contra:** `origin/main` = `fc51ec7a2f11dd93e34141fae48b4357b72d9990` · 2026-11-24T12:27:18Z (cabecera `Date:` de GitHub)

Puesto J1 (jv-j1jx, relevo de jv-j1jw). Solo test y registro: `src/` no se toca (la creación de cobros es flujo de cobro en producción, STOP).

**Qué repite.** La sonda de S1 del 2-oct (SCRUM-1429 c.18152, caso «2 A LA VEZ»: cobros creados = 2, `chargeId` = 901, #900 y #901 en `pending`), hoy y en el check obligatorio: `tests/scrum1429c-dos-envios-dos-cobros.test.mjs`. Molde de `tests/scrum1532d-cancelar-cobro-ficha-y-reenvio.test.mjs` ②: servicio de `dist/` tal cual, router REAL de `/charges` en el proceso, base doblada CON ESTADO, Meta en `WHATSAPP_DRY_RUN`. Ningún envío real.

**Salida medida (2026-11-24, sobre `fc51ec7a`):**

    a la vez      → POST a /charges=2 · cobros creados [900,901] · vivos [900,901] · enviados con [900,901] · factura.chargeId=901
    uno tras otro → POST a /charges=1 · un solo cobro (control: la base doblada recuerda lo escrito; el 2 es la carrera)

**Rojo visto:** con `declarado: false` el caso principal cae («Se retiró la declaración de SCRUM-1429 y siguen saliendo dos cobros», `git diff --numstat` 1/1, restaurado con `git restore --source=HEAD`). Con la declaración puesta queda verde y dice «DEFECTO CONOCIDO … No es conformidad»; el día que salga un solo cobro vivo, cae y pide retirar `DEFECTO_CONOCIDO` en el mismo cambio (molde de `tests/scrum1240b-clave-regimen-defecto-declarado.test.mjs`).

Mutaciones: catálogo → `tests/scrum1429c-dos-envios-dos-cobros.test.mjs`

**Propuesta de arreglo (NO aplicada; pide el GO que S1 cita en c.18211, por verificar):**
1. Tras crear el cobro, enlazarlo con escritura condicional: `invoice.updateMany({ where: { id, merchantId, chargeId: null }, data: { chargeId } })`.
2. Si `count === 0` (otro envío ganó), cancelar el cobro recién creado y releer `invoice.chargeId` para enviar con el ganador.
3. El test ya distingue el arreglo: «un solo cobro vivo y los dos envíos con él» es `UNO`.

**No medido:** contra una base real (el doble no tiene cerrojos de fila); la variante «EN EL HUECO» de scrum1304; la suite entera (contexto: 150k al escribir el test).

A9: comprobación → `tests/scrum1429c-dos-envios-dos-cobros.test.mjs`

# SCRUM-1429d — un solo cobro por factura aunque lleguen dos envíos a la vez (ARREGLO)

**Medido contra:** `origin/main` = `86103cb18c55e289b706cd3b530e717e644d54ca` · 2026-11-24T12:38:50Z (cabecera `Date:` de GitHub)

Puesto J1 (jv-j1ka). **GO del fundador: SCRUM-1429 c.22630**, opción «Arreglarlo ya (Recomendado)» (literal en el comentario, no aquí). Alcance: solo `sendInvoicePaymentRequest` en `src/modules/billing/domain/invoiceWhatsApp.service.ts`. Sin esquema, sin texto nuevo, sin código de `reason` nuevo.

**Qué.** ① El enlace cobro→factura pasa de `invoice.update({ where: { id } })` a `invoice.updateMany({ where: { id, merchantId, chargeId: <lo leído> } })`: condicional sobre el valor LEÍDO (null, o el cobro cancelado de 1532d), no sobre null a secas. ② Si `count === 0`, el envío llegó tarde: relee `invoice.chargeId` (el ganador), cancela su propio cobro con la misma transición y la misma barrera que `POST /admin/charges/:id/cancel` (`pending → cancelled`, estado dentro del `where`) y envía con el ganador. ③ 1429c retira `DEFECTO_CONOCIDO` (`declarado: false`) y su caso exige un cobro vivo, los dos envíos con él, el otro `cancelled` y que la carrera ocurrió (2 POST).

**Esperado · visto (2026-11-24, sobre `86103cb1`):**

    a la vez      → esperado: un cobro vivo, los dos envíos con él, el otro cancelado
                    visto:    POST a /charges=2 · creados [900,901] · vivos [900] · enviados con [900,900] · factura.chargeId=900
    1429c + 1532d → 14 tests · 14 pass · 0 fail · 0 skipped (TAP)
    build con tipos (`npm run build` = tsc, sin --noCheck) → salida 0

**Mutaciones (runner de la casa, `correr` + `aplicarUna` de `scripts/meta-guard-mutaciones.mjs`, base limpia sin caídos):** 1429c 4/4 VIVAS (enlace incondicional · sin cancelar · sin usar el ganador · volver a declarar el defecto); 1532d 7/7 VIVAS, con una nueva: el enlace condicionado a `chargeId: null` a secas hace caer ② (el reenvío se iría con el cobro cancelado).

Mutaciones: catálogo → `tests/scrum1429c-dos-envios-dos-cobros.test.mjs`
Mutaciones: catálogo → `tests/scrum1532d-cancelar-cobro-ficha-y-reenvio.test.mjs`

**Lo que cambió fuera del servicio, y por qué:** el doble de la base de 1532d (`invoice.update` → `invoice.updateMany` que solo casa si la factura sigue con lo leído). Sin eso, el doble por defecto devuelve `count: 0` y ② cae enviando con el cobro cancelado 55: era el doble, no el código.

**Corrección a la premisa del encargo:** pedía cancelar «por el camino de SCRUM-1532, con su `recordAudit cobro_cancelado`». En `origin/main` no hay ningún `cobro_cancelado` en `src/` (la clave está aprobada, c.22435, y la fila entra en 1532c), y la cancelación de la casa vive en línea en `chargesAdmin.routes.ts` (J2), sin función exportada. Repetí su sentencia (misma transición, misma barrera) con `updateMany` para no lanzar P2025; sin fila de auditoría. Cuando entre 1532c, esta cancelación debería dejar la suya.

**No medido:** contra una base real (el doble no tiene cerrojos de fila; la condición del `where` es una sola sentencia en Postgres, pero no lo he corrido); la suite entera en local (no cabe en el contexto; queda para CI); yaqu.app (no se puede provocar la carrera sin un envío real).

A9: comprobación → `tests/scrum1429c-dos-envios-dos-cobros.test.mjs`
