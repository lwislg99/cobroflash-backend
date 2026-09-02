# SCRUM-579 · CONT-06 · La dirección de facturación en la ficha del cliente

**Fecha:** 2-sep-2026 · **Carril:** contactos (ficha de cliente) · **Gate:** sin gate — corre en `npm test`

**Medido contra:** `origin/main` = `69300b6662752e8fe624b1f6ee6b555f02e3a3f2` · 2026-09-02T18:47:09+01:00

**Tanda:** 4593 tests, 4514 pass, 0 fail, 79 skipped (los 79 declaran su motivo) — medida DESPUES del ultimo cambio, entrada incluida.

---

## La víctima, y tiene dos caras

Hasta este ticket **no había dirección NINGUNA** en el formulario de cliente: un fontanero no
podía guardar dónde le factura a su cliente. Medido, no supuesto: `Customer` no tenía ni un campo
de dirección y `customers` tenía 16 columnas, ninguna de ellas de dirección.

Y la segunda cara es fiscal: **post-SIF el domicilio del destinatario es dato de factura.** Hoy no
duele porque `INVOICING_ES_ENABLED` está OFF. El día que se encienda, duele en producción y con
documentos emitidos detrás.

---

## 🛑 EL ORDEN DE MIGRACIÓN, CUMPLIDO — y hoy no era teórico

① decisión → ② `ALTER` en las TRES bases → ③ **un solo PR** con schema + código + tests.

Hoy se ha pagado por saltárselo: producción llevó **nueve días** sin desplegar porque tres veces se
mergeó un esquema sin aplicar su `ALTER` — treinta despliegues fallidos que nadie vio.

Así que este ticket se partió en dos: primero el DDL (`docs/sql/scrum-579-direccion-facturacion.sql`,
ya mergeado) y **sólo después** el schema. `prisma/schema.prisma` no se tocó hasta que el `ALTER`
estuvo aplicado.

**Y lo comprobé yo antes de tocarlo, no me fié del mensaje** (me lo pidieron con esas palabras, y
con razón: hoy ya había fallado una afirmación de estado sin medir):

| base | resultado de `verificacion-scrum-579.sql` |
|---|---|
| `yaqu_dev_javier` | controles 1·1 · **5/5** · `tipos_correctos` **5** |
| `railway` (staging) | controles 1·1 · **5/5** · `tipos_correctos` **5** |
| producción | **NO la he medido yo** — ver huecos |

---

## PASO 0

**ENTRADA.** El alta y la edición son **el mismo modal** de `public/dashboard/js/customersView.js`
(`buildModal()`, títulos «Nuevo cliente» / «Editar cliente»), y el backend es
`POST /admin/customers` y `PUT /admin/customers/:id`
(`src/modules/system/app/routes/customersAdmin.routes.ts:103`).

**MECANISMO — existía medio motor, y eso cambió el trabajo:**

| pieza | ¿existía? | dónde |
|---|---|---|
| el modal con `createField` | **sí** | `customersView.js` |
| **la lista de países sin librería** | **sí** | `prefijosPais.js` (SCRUM-578) |
| las columnas | **no** | ← el DDL, ya aplicado |
| el campo, el envío, la validación y la relectura | **no** | ← esto |

**Sobre el país: no hacía falta ninguna librería, y no es una opinión.** SCRUM-578 ya había
resuelto exactamente este problema: el ISO viaja en una cadena, el **nombre lo pone el navegador**
con `Intl.DisplayNames` y la bandera se calcula. Se reusa `listaDePrefijos()` ignorando el prefijo:
**223 opciones por cero bytes de datos nuevos.** Regla 36 intacta.

---

## Lo construido · los cinco eslabones

`tests/scrum579-direccion-de-facturacion.test.mjs`, 13 casos.

| eslabón | cómo se comprueba |
|---|---|
| ① se **escribe** | **banco de vistas**: se pinta la pantalla, se PULSA «+ Nuevo cliente» y se buscan los cinco campos en el DOM |
| ② se **envía** | `direccionParaPayload` **extraída del fuente y ejecutada** + «mencionar no es hacer» sobre sus 5 usos |
| ③ se **valida** | `customerCreateSchema` **ejecutado**, con el control del campo inventado |
| ④ se **guarda** | el alta escribe los datos validados tal cual (anclado) |
| ⑤ se **RELEE** | `CUSTOMER_SELECT_NO_TOKEN` por AST, **con su rojo** |

### 🔴 El eslabón ⑤ es el que decidía si esto quedaba alcanzable

`CUSTOMER_SELECT_NO_TOKEN` (`customerAdmin.ts:17`) es un `select` **explícito**: lo que no esté ahí
**no sale**, aunque esté en la columna y aunque el alta lo haya guardado.

> Sin esas cinco claves, el alta guardaría la dirección y **devolvería un cliente sin ella**: la
> pantalla se recargaría vacía y el profesional volvería a escribirla. **Y la tanda seguiría
> VERDE**, porque el dato SÍ estaría en la base. El defecto sería **mudo**.

Localizarlo **antes** de construir es lo que evita que el ticket nazca con el defecto dentro. Por
eso los tests no se conforman con «se guarda»: releen y exigen que siga ahí.

### 🔴 «Ausente ≠ vacío», y aquí significa que `""` NO EXISTE

Es el mismo argumento con el que se rechazó el `DEFAULT 'ES'` en la columna, ahora comprobado en el
código. `direccionParaPayload` convierte todo lo vacío —cadena vacía, espacios, `null`,
`undefined`— en **`null`**, nunca en `""`:

| valor | significado |
|---|---|
| `null` | **no consta** — nadie ha dicho dónde factura este cliente |
| texto | lo declaró el profesional |
| `""` | un **tercer estado que no significa nada** y que nadie ha declarado |

Si se guardara `""`, un cliente sin dirección y otro «con la dirección en blanco» quedarían
indistinguibles para cualquier lectura útil —un `IS NOT NULL` diría que el segundo **tiene**
dirección— y el dato dejaría de servir para lo único que existe: saber a quién le falta el
domicilio antes de que sea dato de factura.

Y el país pasa por la **misma** regla: la opción «—» vale `""` y llega como `null`, o volver a «no
consta» sería imposible una vez elegido un país.

### El país: ISO, no nombre

`billingCountry` guarda `ES`, no «España». Es lo que ya guarda `Merchant.country` —medido: `ES`— y
lo que usa `prefijosPais`. Guardar el nombre sería guardar una **traducción**: el mismo cliente se
llamaría «España» o «Spain» según quién lo diera de alta.

**España va preseleccionada en el FORMULARIO, nunca en la columna.** La columna es nullable y sin
`DEFAULT` a propósito.

---

## Microcopy: los cinco rótulos, APROBADOS y sin marcador

`Dirección` · `Población` · `Código postal` · `Provincia` · `País`, en ese orden (fundador,
2-sep-2026). Anotados en `docs/MICROCOPY_APROBADA_SIN_APLICAR.md` y comparados con `===` en el
test: un retoque «de paso» reabre una aprobación sin que nadie se entere.

> 🔴 **Es «Dirección» A SECAS.** La propuesta de este carril era «Dirección (calle y número)» y
> **no** es la aprobada. No se abrevia («CP» no vale), no se reordena, no lleva paréntesis.
>
> **Y por eso se pidieron ANTES del código:** producción despliega en cuanto se mergea, así que
> cinco rótulos con `[PENDIENTE microcopy oficial]` los habría visto un profesional en su pantalla
> **a los cinco minutos**, cinco veces en el mismo formulario. Este ticket entra **sin una sola
> marca**, y el censo de `scrum402` lo confirma.

---

## El rojo, probado por el mecanismo — seis mutaciones con post-condición

Commit en verde **antes** de mutar. Cada mutación exige que el trozo aparezca exactamente una vez
y que el fichero **haya cambiado**; si no, falla en vez de «probar» sobre un fichero intacto.

| se rompe a propósito | cae |
|---|---|
| se quita `billingCity` del `select` explícito | ⑤ EL ESLABÓN MUDO (+ el viaje entero) |
| desaparece el campo «Población» del formulario | ① los cinco se montan — **y nombra cuál** |
| se abrevia el rótulo a «CP» | ① los rótulos aprobados |
| el vacío viaja como `""` en vez de `null` | ② ausente ≠ vacío |
| el esquema deja de declarar `billingProvince` | ③ el esquema deja pasar las cinco |
| el payload manda `.value` en crudo | ② mencionar no es hacer |

**Control negativo:** tocar `recargoEquivalencia` —otro campo del cliente— **no** tumba el guard.

---

## Los huecos que declaro

1. 🔴 **Producción NO la he medido yo.** `DATABASE_URL` está ausente de este worktree por diseño
   (regla 3), así que el `5/5` de producción lo acepto del reporte del asesor. Lo digo porque hoy
   mismo una afirmación de estado sin medir costó un turno.
2. **No he verificado en navegador real.** El banco de vistas ejecuta la pantalla, pero no es un
   navegador: no hay layout, ni pintado, ni teclado.
3. **El eslabón ④ no toca la base de datos.** Se ancla que el alta escribe los datos validados tal
   cual y se hace el viaje de ida y vuelta por serialización; que Postgres devuelva exactamente lo
   guardado no está medido aquí.
4. **No hay validación de forma del código postal ni del ISO contra la lista.** El esquema limita
   longitudes (20 y 2) pero no comprueba que `billingCountry` sea uno de los ~200 países reales:
   un `XX` de dos letras pasaría. Validar formato es otra decisión.
5. **La dirección NO llega al documento.** Es DOC-12 y no es este carril.

---

## Ficheros

`prisma/schema.prisma` (las cinco, **después** del `ALTER`) · `src/core/validation/schemas.ts` ·
`src/modules/system/customerAdmin.ts` (el `select`) ·
`public/dashboard/js/customersView.js` · `tests/scrum579-direccion-de-facturacion.test.mjs`
(**nuevo**) · esta entrada. Y de la fase ②, ya mergeados:
`docs/sql/scrum-579-direccion-facturacion.sql` · `docs/sql/verificacion-scrum-579.sql` ·
`docs/MICROCOPY_APROBADA_SIN_APLICAR.md`.

**No se ha tocado:** `pdf.service.ts` ni el camino de emisión (DOC-12) · `Job.direccion` ·
`tests/_banco-vistas.mjs` ni `sw.js` (S2) · los campos de teléfono (CONT-05/CONT-19).

## Estado del arbol

* `origin/main` se ha MERGEADO DENTRO de la rama —no rebase— sin conflicto.
* Cliente de Prisma regenerado desde ESTE worktree y `dist/` reconstruido DESPUÉS de mezclar main.
* `npm run guards:entrada` en verde. Cero CR en disco en los ficheros tocados (medido por BYTES).

## HALLAZGOS FUERA DE CARRIL — una línea cada uno

* `tests/_banco-vistas.mjs` NO implementa `form.reset()`, así que ninguna vista con `<form>` se puede montar en él sin parchearlo desde fuera; aquí se le añade un no-op **desde el test**, sin tocar el fichero (S2).
* `Job.direccion` sigue en el esquema con su propio comentario diciendo «sin fuente hoy», y SCRUM-300 midió que no la escribe nadie: es la dirección de obra, muerta, y encaja con DOC-12.
* El PDF construye su objeto `customer` a mano en DOS sitios (`quotes.routes.ts:208` y `:546`): cuando DOC-12 lleve la dirección al documento, serán dos y no uno.
