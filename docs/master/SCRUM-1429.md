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
