# SCRUM-1307 · `borrarMerchant` se niega ENTERO si el comercio tiene envíos a la AEAT

**Medido contra:** `origin/main` = `46195e86903cdccc85a04327c0a68577773c4693` · 2026-10-01T00:04:48+01:00
(J6 del equipo de Javier; encargo del orquestador `cobroflash-backend-47`)

A9: comprobación → `tests/scrum1307-negarse-con-envios.test.mjs`

## El permiso, literal

**Javier, 1-oct-2026: «2-Firmo»** (Jira SCRUM-1307, comentario 17664), sobre la opción (a):

> **(a)** `borrarMerchant` **comprueba antes** de tocar nada si hay envíos a la AEAT y **se niega entera** —cero `deleteMany`— en vez de borrar 22 tablas y devolver un error por escrito.

**No firmada la (b)** (mover `auditLog` al final): arregla un síntoma y deja vivo el otro, porque las
tablas de delante caerían igual y la factura seguiría quedándose sin enlaces. **No firmada la (c)**
(conservar las filas fiscales redactadas, D-4): va al asesor. Ninguna de las dos se construye.

## El defecto, medido

- **Claves ajenas de `invoices`**, iguales en dev, staging y producción (comentarios 17663 y 17664):
  `quoteId`, `charge_id` y `rectifies_id` son SET NULL; `customerId` y `merchantId`, RESTRICT (el
  control).
- **Efecto, sobre el `borrarMerchant` real compilado**, en un Postgres desechable (PGlite 16, DDL
  sacado del schema con el CLI local, fuera del repo), con una fila de auditoría y una factura
  enlazada a su cobro y a su presupuesto:

| Código | Envío a la AEAT | Resultado | Factura después | `audit_logs` |
| --- | --- | --- | --- | --- |
| antes | sí | `ok=false`, 24 modelos recorridos, errores `invoice`, `customer`, `merchant` | viva, `quoteId` y `charge_id` a **NULL** | **0** (borrado) |
| antes | no | `ok=true`, 27 modelos | borrada | 0 |
| después | sí | `ok=false`, **0 modelos**, error `vfSubmission` | viva, **con sus enlaces** | **1** |
| después | no | `ok=true`, 27 modelos | borrada | 0 |

## Lo construido

- `src/modules/system/domain/borradoMerchant.ts`: `prisma.vfSubmission.count({ where: { merchantId } })`
  **antes del primer `deleteMany`**.
  - Con envíos devuelve `{ ok: false, borradas: {}, errores: [{ modelo: 'vfSubmission', … }] }`, sin
    tocar nada.
  - **Sin estado nuevo** (regla 5): es la misma forma de siempre.
  - «No había nada que borrar» deja cada modelo recorrido con su 0 en `borradas`; «me negué» deja
    `borradas` vacío y el error nombrando la cola.
  - Si la comprobación **revienta**, se niega igual: una pregunta que falla no es un permiso.
- **No tocado:** el orden de borrado, el sellado, la huella, el QR, `suprimirMerchant`, `barridoDemo`
  y el esquema.

## Los dobles de scrum192 y scrum244, y el trinquete de scrum411

**Con OK explícito del orquestador (opción A):**
- A los tres dobles de `scrum192` (dos) y `scrum244` (uno) se les añade `count: async () => 0`.
  - El cliente real siempre lo tiene; el doble no lo tenía.
  - Sin ello, el fail-closed se negaba y cinco tests caían sin que el código estuviera mal.
- **Ni una aserción cambia.**
- **Descartada la B** (fail-open si falta `count`): sería código solo para los dobles, y dejaría un
  hueco en la comprobación que se firmó.

**Mismo resultado, test viejo con código viejo contra test nuevo con código nuevo:**

| Mutación en `dist/` | viejo | nuevo |
| --- | --- | --- |
| sin mutar | 24 verdes | 24 verdes |
| M1 · el colgado de `charge` se borra con `where: {}` | caen los mismos 2 de `scrum244` | caen los mismos 2 |
| M2 · `albaranLineaFacturada` pasa al final del orden | caen los mismos 2 de `scrum192` | caen los mismos 2 |

**Población del test de `scrum244` «ningún borrado sin filtro»:**
- En `main`, **27** llamadas.
- Con el arreglo **sin** la A, **0**: verde en vacío.
- Con la A, **27**.

El vacío lo introducía este cambio y no venía de antes. Queda un hueco latente, que no se arregla
aquí (A7): ese test no tiene suelo de población, así que cualquier camino futuro que no recorra
volvería a dejarlo verde sin mirar.

**`scrum411`** («lo que un test CORRE… se cuenta por AST») es un trinquete de igualdad exacta. Pasa de
**7 a 13** llamadas y suma `tests/scrum1307-negarse-con-envios.test.mjs` a la lista de ficheros, con
el motivo escrito en el propio test. Sube porque se añade especificación ejecutable, no porque se
retire.

## Rojo visto

`tests/scrum1307-negarse-con-envios.test.mjs` usa un doble que modela el RESTRICT de `invoice` y el
SET NULL de `charge` y `quote`.

- **Sobre el código de antes caen 3 de 5:**
  - con envíos hay `deleteMany` y la factura pierde sus enlaces;
  - los dos ceros no se distinguen;
  - si la comprobación revienta, el borrado sigue.
- **Pasan los 2 controles:**
  - sin envíos, se borra entero y en el mismo orden;
  - los envíos de OTRO comercio no bloquean este.
- **Después del arreglo:** 5 de 5.

## Tanda

- **De la zona:** `scrum1307`, `scrum192`, `scrum244` (colgados, supresión, puerta), `scrum314`,
  `scrum1296-esquema-cola`, `scrum411`, `scrum237`, `scrum525d` y `scrum976`. El resultado va en el
  PR.
- **La tanda completa** no se ha corrido en local (memoria justa, seis sesiones vivas); la corre el
  CI.

## El primer CI salió rojo, y era mío

- **Qué cayó:** `scrum377` («el «(s)» de programador no sube»). Mi mensaje de negativa decía
  «envío(s)», y fue el único fallo de 9.317 tests.
- **Corrección:** ahora dice «tiene envíos a la AEAT (N en la cola)». La tanda de la zona, con
  `scrum377` dentro, sale 60 de 60.
- **Por qué no lo vi en local:** mi muestra de guards no incluía `scrum377`, que mira el texto de
  todo `src/`. La lección ya está escrita (cambio con texto: tanda completa o sus guards de texto), y
  la comprobación ya existe: es el propio `scrum377`, que lo cazó.
