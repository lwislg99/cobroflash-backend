# SCRUM-1614 · A12.2c (/webhooks/psp, «payment.confirmed duplicado NO re-paga») cae a ratos: la causa medida

## J6 · SCRUM-1614 · la limpieza del test contra el historial que la ruta escribe sin await

**Medido contra:** `origin/main` = `efe736f3f01b5ecbc6dce221e80a3dfc3bfcd42a` · 2026-10-27T13:25:12Z (hora de GitHub; sesión J6 `jv-j6df`, por encargo del orquestador `cobroflash-backend-8b`. Rama `scrum-1614-a122c-psp`. Al cerrar, `origin/main` iba en `2a8d703da3711da3940c833948056fe48fdca0d3`, que no toca ningún fichero de este tramo)

A9: aviso → cicatriz J6 «Metí una ruta con espacios en una variable sin comillas dentro de un bucle de grep, y salieron ochenta errores en vez de veinte filas» — no se pudo comprobar: ningún hook de este árbol lee las comillas de un comando antes de lanzarlo; lo cazó la salida, y el recuento se rehízo con node

Carril: `carriles.mjs de tests/webhooks-idempotencia.test.mjs` → «sin fila en §3: nadie lo reclama», consultado antes de editar. **0 líneas de `src/`**: `psp.routes.ts` se LEYÓ. Ninguna aserción relajada: las seis de antes siguen igual y se añade una. Banco: el Postgres 16.14 de `pgbanco.mjs` (el de 1611c, copiado sin enlazar), puerto 55614, base rehecha antes de cada pasada, DDL de `prisma migrate diff --from-empty`, `dist/` con `tsc --noCheck`. Salidas e instrumentos: `evidencias/SCRUM-1614/`.

### ① El literal, y qué NO es

Las tres caídas de 1611c (r-3, r-7, r-8) son la MISMA, y no es ninguna aserción del cobro:

    Invalid `prisma.customer.deleteMany()` invocation:
    Foreign key constraint violated on the constraint: `customer_events_customer_id_fkey`
    … webhooks-idempotencia.test.mjs:96:5   (la limpieza, en el finally)

con el diagnóstico «duplicado ACK + marcado duplicate, un solo efecto de pago ✓» impreso justo antes: las seis aserciones habían pasado. **No es la idempotencia del cobro**, y tampoco el `phone` con `stamp % 1000000` (el FK que cae es el de `customer_events`, no un unique).

### ② La causa medida

`psp.routes.ts:315` llama a `recordCustomerEvent({ type: 'payment_received', … })` **sin await** (el historial ENT-3), y la ruta responde. La fila llega DESPUÉS de las dos respuestas, y la limpieza la pisa:

| medición | n | resultado |
|---|---|---|
| sonda (copia del caso con marcas de reloj de la base), en paralelo con los 57 ficheros de banco | 9 | la fila aún no estaba tras las DOS respuestas en 8 de 9 (`antes=0`): cayó entre los dos borrados en 2 (el FK de la limpieza), llegó con el cliente ya borrado en 2 (la ruta se traga el FK y lo pone en el log) y llegó antes del borrado en 4. A tiempo: 1 |
| test viejo, a solas | 20 | **8 de 20 en rojo, y son justo las 8 con fila tardía**: 3 en la A12.2c (el FK de la limpieza) y 5 en el FICHERO (la fila llega con el cliente o el comercio ya borrados, la ruta se traga el FK y el proceso aborta al salir: `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file src\win\async.c, line 94`, exitCode 3221226505). Las 12 sin fila tardía, verdes. |
| test viejo en el régimen paralelo (dentro de la sonda) | 9 | A12.2c roja 1 de 9 |

No hace falta el paralelo: a solas cae más. Que la cola de la ruta caiga dentro o fuera de la limpieza depende del reloj, y por eso salta.

### ③ El arreglo, en el test

Antes de limpiar, el test espera a ESA fila **por su condición** (un `count` de `payment_received` de su cliente, cada 20 ms), y ahora además lo exige: `el historial lleva UN «Pago recibido»: el duplicado no añade otro`. El `finally` también espera, si el primer pago llegó a confirmarse, para que un rojo de antes no se tape con otro de la limpieza. El tope de 15 s no sincroniza nada: sólo convierte «no llegó nunca» en un rojo con nombre en vez de un test colgado. No hay espera fija.

### ④ Rojo primero, siembra y mutación

| pasada | n | resultado |
|---|---|---|
| siembra `siembra1614.mjs` en la base desechable (INSERT en `customer_events` +150 ms y DELETE en `charges` +300 ms: la fila tardía cae siempre ENTRE los dos borrados) · test viejo | 3 | **ROJO 3 de 3**, el literal de ① |
| la misma siembra · test nuevo | 3 | verde 3 de 3 |
| test nuevo, a solas, sin siembra | 20 | 60 de 60 casos verdes, 0 filas tardías; **1 aborto de libuv en el fichero** (⑤) |
| test nuevo en el régimen paralelo (57 ficheros + sonda) | 8 | A12.2c 8 de 8; 1.544 casos = 1.544 declarados; 0 abortos |
| `MUTACIONES_CON_BASE` (el `if` del duplicado → `if (false)`), con `mutar-1599i.mjs` | 1 | **MUERE**, por «y marcado como duplicate»; limpia 3 de 3; `dist/` restaurado byte a byte |

La siembra demuestra que el mecanismo de ② da el literal, no que en CI fuera ese el orden exacto. El commit de antes de mutar es `592469a48dc20a183dbd8333f287b3f4d927fd40`.

### ⑤ Lo que queda, y por qué no lo toco

- **El aborto de libuv sigue saliendo 1 de cada 20 a solas, ya sin fila tardía.** Sólo aparece en los ficheros que llaman a `/webhooks/psp` (en paralelo: 0 en los otros 56). Hipótesis, SIN MEDIR: otra escritura que la ruta deja corriendo (`recalcJobCobradoForCharge`, el aviso al profesional, el WhatsApp) sigue viva cuando el test hace `$disconnect` y sale. La línea es de `src\win\…`: CI corre en Linux, y que allí pase algo parecido está SIN MEDIR. Para esperar a todo eso el test necesita algo que la ruta no expone, y hacer que lo exponga (o que espere) es tocar el flujo de cobro: **STOP**, y se queda como pregunta en el ticket.
- De paso, en el régimen paralelo: `SCRUM-115: sendWhatsAppText bloqueado` (`scrum115-wa-fallo-registrado.test.mjs:112`, «debe quedar una fila en WA-0b para el intento bloqueado») cayó 1 de 8. Ajeno y no investigado. Los dos rojos de scrum419 de cada pasada son por mi fichero sonda `zz`, que no se comitea (lo mismo que en 1611c).

### ⑥ Sin medir

CI (no he esperado al obligatorio) · staging · el régimen con menos CPU (CI corre en 4) · si en Linux hay algo parecido al aborto de ⑤ · suite entera local: NO CORRIDA (diez sesiones a la vez).
