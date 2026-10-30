# SCRUM-1250 · `POST invoices/:id/pay` y `/unpay`: re-medidos, y las preguntas al fundador

**Medido contra:** `origin/main` = `d34ee753fdd5b9858b31307d2d34704c80275f67` · 2026-10-24T10:30:25Z (hora de GitHub, `gh api -i zen`)

A9: aviso → cicatriz J1 «En el comentario de Jira de la medición escribí dos recuentos y tres números de línea de memoria del barrido, sin contarlos: dije 4 y 12 donde había 3 y 10; lo cacé al releer antes de copiarlo al registro y corregí el comentario a la vista (SCRUM-1250, c.20742)» — no se pudo comprobar: el texto de un comentario de Jira no pasa por ningún guard del repositorio

Sesión J1 (`jv-j1bl`), 24-oct-2026, por encargo del orquestador de Javier (`cobroflash-backend-95`).
**Solo medir y preguntar**: el ticket lleva `dinero`, así que no se toca `src/`, ni ninguna base, ni
ningún texto de usuario. Todo leído con `git show origin/main:`; nada ejecutado. La medición entera,
con las tablas, está en el comentario 20742 del ticket; aquí va lo que decide.

Lo que me salió mal: la primera versión de ese comentario llevaba dos recuentos y tres números de
línea escritos de memoria del barrido (dije `…/status` 4 veces y 12 sufijos; son 3 y 10). Lo cacé
al releer antes de copiar las cifras aquí, y el comentario se corrigió dejando la corrección a la vista.

## ① Siguen montadas, y no saltan nada

- `invoicesAdmin.routes.ts:594` (`/pay`) y `:615` (`/unpay`), mismo router y mismo
  `requireRole('admin')` que `PUT /:id/status` (`:550`).
- Las dos llaman a `markInvoicePaidAdmin` / `markInvoicePendingAdmin` (`invoiceAdmin.ts:326`, `:330`),
  que son `return updateInvoiceStatusAdmin(id, 'paid'|'pending', merchantId)`: **la misma función que
  usa `/status`**. Por eso comparten tenencia (`findFirst` con `merchantId`), las dos guardas de la
  regla 29 (anulada no vuelve; F1 pagada no se des-paga salvo `J-`/`JUST`) y el estado en el `where`
  de SCRUM-1303. Regla 24: **ninguna de las tres** mira `INVOICING_ES_ENABLED`; no hay diferencia.

## ② Quién las llama: nadie en el repo

`public/`: 0 (control positivo: el mismo barrido ve `…/status` 3 veces y 10 sufijos más). `src/`: 0
fuera de las dos rutas. Scripts: solo listas (`_sin-consumir-declarados.json`, `_anclas-sin-testigo.congelado.mjs`).
Tests: `scrum597:252`, `scrum1455b:60-61` y la red de rol de `src/core/http/adminOnlyRoutes.ts:12-13`
(S1). Docs: `docs/legal/AUDITLOG_FISCAL_CONTRATO.md:94-95`. OpenAPI: no existe. **Lo de fuera del repo
(integraciones, logs de producción) no se ha mirado.**

## ③ Diferencias con el camino bueno (las dos rarezas de la descripción siguen)

1. `/pay` sobre una anulada → 500 en vez de 409 (su `catch` no reconoce `UnpayNotAllowedError`). No escribe.
2. `/pay` ignora `paidVia`.
3. La auditoría de `/pay`/`/unpay` no lleva `number`; la de `/status` sí.

De paso, sin tocar (otros carriles): `_sin-consumir-declarados.json` cita `:569`/`:590` y
`AUDITLOG_FISCAL_CONTRATO.md` cita `:311`/`:332`; hoy son `:594`/`:615`.

## ④ Preguntas al fundador (en el ticket, c.20742)

- **P1 · ¿Se desmontan ya?** ✅ J1 borra rutas y envoltorios; fan-out en `adminOnlyRoutes.ts` (S1,
  cruza de equipo), la lista `sin-consumir` (S0), `scrum597`, `scrum1455b` y el contrato del auditlog
  (J4). ❌ Siguen como hoy.
- **P2 · Si no, ¿guard que impida enchufarlas?** ✅ J1 escribe un test de solo lectura con positivo
  sembrado; las rarezas siguen vivas para llamadas de fuera. ❌ Como hoy.
- Recomendación de J1 (no del fundador): P1 ✅. Lo construiría J1.

## J1 · SCRUM-1250b · desmontar `pay` y `unpay` — hecho en J1, PARADO por dos guards de otro carril

**Medido contra:** `origin/main` = `0a7eef15c907acc7646ed7ab33cab9176f8f1bc0` · 2026-10-24T10:51:14Z (hora de GitHub; sesión J1 `jv-j1bn`, por encargo del orquestador `cobroflash-backend-95`)

A9: aviso → cicatriz J1 «Di como control positivo de un barrido de workflows un patrón que daba 0 en la propia población (`admin/` en `.github/`), y lo leí como suelo válido hasta mirarlo; el positivo se deriva antes de contar» — no se pudo comprobar: la elección del control de un barrido hecho en la consola no pasa por ningún guard del repositorio

Firma: SCRUM-1250 c.20747 (P1 «Sí, desmontarlas»). Esta rama contiene la de `jv-j1bl`
(`scrum-1250-pay-unpay-medido`, PR #2824), mezclada dentro para no entrelazar dos registros que
crean el mismo fichero.

**Hecho (ficheros J1):** fuera las dos rutas de `invoicesAdmin.routes.ts` y los dos envoltorios
`markInvoicePaidAdmin`/`markInvoicePendingAdmin` de `invoiceAdmin.ts` (sin más llamantes en `src/`).
El bloque de `PUT /:id/status` no cambia ni un carácter. `scrum1455b` pasa de 16 a 14 filas;
`scrum597` muestrea `POST /admin/invoices/bulk-paid` en vez de `/pay` (sigue siendo «marcar
pagada», sigue 403 para el técnico). Test nuevo: `tests/scrum1250b-pay-unpay-desmontadas.test.mjs`,
app real por HTTP: las dos contestan lo mismo que una ruta sembrada que no existe, y `PUT /status`
sigue llegando a su handler. Mutación: re-montar `/:id/pay` en `dist/` → cae con «contesta 200».

**Llamantes fuera de `src/`:** workflows 0 (positivo: `yaqu.app`/`curl` aparece en 2 workflows),
bot 0, OpenAPI no existe. **Logs de producción e integraciones externas: no lo he intentado.**

**PARADO — dejarlos sin tocar pone ROJOS dos guards** (regla 41: no se ensancha nada):

- `tests/scrum55-admin-fail-closed.test.mjs:186` · «ENTRADA MUERTA» por `src/core/http/adminOnlyRoutes.ts:12-13` (**S1**).
- `tests/scrum1185-trinquete-sin-consumir.test.mjs:92` · caso ② por `scripts/_sin-consumir-declarados.json:139-140` (**S0**).

Verdes con el cambio: `docs/legal/AUDITLOG_FISCAL_CONTRATO.md:94-95` (J4) sigue citando las filas
viejas y `scrum525d` no cae; `scripts/_anclas-sin-testigo.congelado.mjs:137-138` tampoco. Se nombran,
no se tocan.

**Desbloqueo — excepción de carril declarada por el fundador, SCRUM-1250 c.20763** («Excepción de
carril en este PR»): exactamente cuatro líneas del equipo de Luis, y nada más de ellos. En
`adminOnlyRoutes.ts` (S1) se quitan las dos filas de `pay`/`unpay`; en `_sin-consumir-declarados.json`
(S0) las dos entradas salen de `declaradas` y entran al principio de `retiradas` (al principio para no
tocar la coma de una quinta línea). Con eso, `scrum55` y `scrum1185` en verde: 81 de 81 en los nueve
ficheros dirigidos (55, 1185, 1250b, 1455b, 597, 158, 168, 1294, 1303), sin saltos.
