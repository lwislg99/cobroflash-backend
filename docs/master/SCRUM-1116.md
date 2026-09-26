# SCRUM-1116 · El resumen del lunes certificaba «nada pendiente» con garantía retenida

**Medido contra:** `origin/main` = `bf4d82c68cc74c390af36f92c90cdb915e8c31e8` · 2026-09-25T17:56:30Z

**Puesto:** J3 (`jv-j3`, equipo de Javier) · **Rama:** `scrum-1116-digest-garantia-retenida`

**Carril:** `weeklyDigest.service.ts` es de J3 (`dos-equipos.md` §3.1, desde el 18-sep-2026). El ticket
decía que no tenía dueño, y eso era falso: lo cazó J2 al ir a la tabla.

## 1 · PASO 0: el defecto existe hoy (medido ejecutando el código)

`tests/scrum1116-digest-garantia-retenida.test.mjs` corre `sendWeeklyDigests` de verdad contra un
mini-Prisma y lee el HTML que saldría hacia Resend (`axios.post` sustituido: no sale nada). Se corrió
contra el código de `main`, **antes** de escribir el arreglo:

- 🔴 Hay 500 € retenidos en un cobro **pagado** y ninguna factura pendiente. El correo pinta
  **«✅ ¡No tienes facturas pendientes de cobro!»**: falla la aserción «el resumen certifica con un ✅
  que no le deben nada».
- Los tres controles salen verdes con el código de `main`: sin retención, retención ya cobrada y con
  facturas pendientes. El test separa el defecto del montaje.

El defecto está vivo desde que SCRUM-1107 entró en `main` (25-sep, 14:52Z).

## 2 · El arreglo

- `weeklyDigest.service.ts` **lee** `garantiasRetenidasPorCliente`, de J2 (SCRUM-1108), y no rehace
  el cálculo: solo cuenta cobros `paid` y toma el día de liberación en la zona del merchant. Lo
  agrupa por día de liberación, suma en céntimos lo que cae el mismo día (aunque sea de clientes
  distintos) y lo ordena del día más temprano al más tardío.
- Si no hay facturas pendientes y sí garantía retenida, el correo pinta el literal firmado **sin el
  ✅ y sin el fondo verde**: una línea por día, y la primera lleva delante «No tienes facturas
  pendientes de cobro.». Con un solo día, el resultado es exactamente el literal que firmó Javier.
- Si no hay facturas pendientes ni retención, el literal con ✅ no cambia: en ese caso es cierto.
- La consulta de la garantía solo se hace cuando no hay facturas pendientes, que es cuando decide
  si el ✅ dice la verdad.
- `getDigestPreview` (estadísticas en JSON, sin texto) no se toca.

🔴 **Si la consulta de la garantía falla, el correo no vuelve al ✅.** Es mejor que falte el resumen de
ese merchant que un correo que afirma algo sin haberlo comprobado. El error sube: el resumen de ese
merchant no sale y queda constancia en el parte (SCRUM-475), igual que con cualquier otra consulta del
resumen. Caer al literal con ✅ sería volver a afirmar lo falso, que es justo lo que arregla este ticket.

⛔ No se añade ningún envío (regla 28): el resumen ya existía y lo que cambia es lo que dice. No se tocan
`saldoPendiente.ts` ni la ficha 360 (son de J2), ni el cálculo ni las rutas de SCRUM-1107.

## 3 · El texto

- Registros: `docs/microcopy/2026-09-25-SCRUM-1108-garantia-retenida.md`, ranura
  `digestSinPendientesConGarantia`, que firmó Javier en persona (SCRUM-1116, comentario 16979), y
  `docs/microcopy/2026-09-25-SCRUM-1116-digest-garantia.md`, ranura `digestGarantiaLineaExtra` y
  regla de composición, aprobados por el orquestador por delegación (SCRUM-1116, comentario 17017).
- El segundo registro **lo escribió el orquestador** en su rama `scrum-1116c-firma-digest`, no esta
  sesión. El sistema de permisos de J3 le impidió escribir una firma de aprobación que no era suya y
  que le pedía otra sesión. J3 paró y no buscó otra vía. El registro lo escribió quien tiene la
  delegación.
- Por qué no «el total con una sola fecha»: está razonado en el comentario 17017. Con la fecha más
  temprana, el correo diría que todo se libera ya. Con la más tardía, callaría lo que se libera antes.
- ⚠️ **Orden de entrada:** este PR no debe entrar antes que `scrum-1116c-firma-digest`. Lo hace
  cumplir el caso de `constaAprobado()` del test: mientras el registro no está en `main`, sale en rojo
  con «Tienes {importe} … no consta aprobado».

## 4 · Hueco declarado, no arreglado

Cuando **sí** hay facturas pendientes **y además** garantía retenida, el bloque «⏳ Pendiente de cobro»
no nombra la retención. **Calla, pero no dice nada falso**, y no tiene texto firmado, así que este
ticket no lo toca. Queda escrito para que alguien lo arregle algún día; un hueco que no se escribe no
lo arregla nadie.

## 5 · Verificación

**El test del ticket, antes y después del arreglo** (`node --test` sobre el fichero, con `dist/` recompilado):

| Caso | Con el código de `main` | Con el arreglo |
|---|---|---|
| 500 € retenidos y nada pendiente: no sale «✅ ¡No tienes…!» | ✖ | ✔ |
| Control: sin retención, el literal de siempre | ✔ | ✔ |
| Retención ya cobrada: vuelve el literal de siempre | ✔ | ✔ |
| Con facturas pendientes: el bloque «Pendiente de cobro» no cambia | ✔ | ✔ |
| El día que se muestra es el de la zona del merchant (Madrid 12/03, UTC 11/03) | ✖ | ✔ |
| Lo que se libera el mismo día se suma aunque sea de clientes distintos | ✖ | ✔ |
| Con dos días salen LAS DOS líneas, la más temprana primero | ✖ | ✔ |
| Cada línea es un literal firmado (`constaAprobado`) + control negativo con ✅ | ✖ | ✖ hasta que el registro esté en `main` |

**`npm test` entero** en la rama (commit `1e97aafe`, sobre `bf4d82c6`): **8348 tests · 8211 pass · 3 fail ·
134 skipped**. Los tres fallos:
- `SCRUM-1116 · cada línea que se pinta es un literal FIRMADO`: el registro de la segunda ranura todavía
  no está en `main` (va en `scrum-1116c-firma-digest`). Es el candado de §3, y es lo esperado.
- `SCRUM-804b · SUELO y CONTROLES` y `scrum910d-microcopy-recibo-pendiente`: ya fallaban en esta máquina
  antes de este ticket (traspaso de J3, y el aviso del orquestador para 910d). Ninguno de los dos toca
  el resumen del lunes.

**Después de rebasar sobre `main` `e3b563e0`**, con el registro ya dentro (PR #1785 del orquestador):
- El test del ticket, `scrum709` y `scrum267` juntos dan **30 tests · 30 pass · 0 fail**. Pasa también
  el candado de `constaAprobado()`: las dos ranuras constan firmadas y el control negativo con ✅ no
  consta.
- `npm test` entero: **8423 tests · 8287 pass · 2 fail · 134 skipped**. Los dos fallos no son de este
  ticket:
  - `scrum910d`, el mismo de antes.
  - `SCRUM-754b · con fs.watch MUDO…`, en `tests/scrum754-el-juez-que-oscila.test.mjs`. Corrido solo
    sobre `main` `e3b563e0` **sin esta rama**, cae igual (21 pass · 1 fail). No toca el resumen.
