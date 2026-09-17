# SCRUM-929 · EL TOTAL DEL BORRADOR: el ciclo de mantenimiento no usaba la aritmética de la casa

**Fecha:** 17-sep-2026 · **Carril:** A · **Gate:** STOP con GO (empujar = desplegar; camino del cobro)
**Medido contra:** `origin/main` = `12b4992f965ef3af48c9cec0c3bb1ca115faebe3` · 2026-09-17T19:13:32Z
**Tanda:** 7432 tests, 7321 pass, 0 fail, 111 skipped

El defecto se descubrió en STAGING el 17-sep-2026 haciendo el PASO 0 de **SCRUM-911**, contra
`origin/main` `ef332b90728399ab0ee75c9166af63890fda2bfa`. **Bloquea encender MANT-1 en producción.**

---

## El defecto

`maintenance.service.ts` calculaba el importe del borrador que crea el ciclo así:

```ts
const price = Number(line.price ?? 0) * Number(line.qty ?? 1);
```

y guardaba eso en `Quote.total`. La **misma línea** entrando por `POST /quote/create` pasa por
`calcTotal` (`src/core/utils/utils.ts:224-228`), que multiplica por `(1 + tax)` y aplica el
descuento de línea con `precioConDto`.

🔴 **El defecto no era «se olvida el IVA»: era que había DOS aritméticas**, y la del ciclo se dejaba
fuera todo lo que la de la casa sabe. Medido línea a línea antes de escribir el arreglo:

| línea | guardaba | debía guardar | |
|---|---|---|---|
| 320 € al 21 % | **320,00** | 387,20 | 21 % **DE MENOS** — lo paga el profesional |
| 150 € × 2 al 10 % | **300,00** | 330,00 | idem |
| 320 € con dto 50 %, IVA 0 | **320,00** | 160,00 | **EL DOBLE** — lo paga el cliente |
| 150 € × 2, dto 20 %, IVA 10 % | **300,00** | 264,00 | |
| IVA 0 · sin clave `tax` · cabecera de apartado · suplido | igual | igual | no cambia nada |

**Las dos direcciones duelen, y por motivos distintos.** Sin el IVA, el profesional cobra un 21 %
menos de lo que le cuesta el trabajo. Sin el descuento, se le pide al **cliente** un importe que no
es el que se pactó. La segunda no la habíamos previsto: salió al medir, no al razonar.

**Y no se ve.** Medido en pantalla, en el navegador, sobre el borrador #16 que creó el ciclo de
verdad en staging:

```
CONCEPTO                        CANT.   PRECIO      IVA     TOTAL
Revisión de termo/calentador      1     320,00 €   21 %    387,20 €
Base imponible: 320,00 €   ·   IVA: 67,20 €   ·   Total: 320,00 €
```

El documento se contradice a sí mismo. Y el mismo 320 sale en la lista de Presupuestos, en el
detalle y en el WhatsApp al pro («¿Enviar presupuesto de 320,00 €?»), porque **los tres leen esta
misma columna**. Un número coherente consigo mismo en todas partes no da ninguna pista: esto no se
descubre mirando, se descubre cuadrando cuentas.

---

## La decisión, y por qué

**Se usa `calcTotal`, y no se toca `calcTotal`.**

```ts
const price = calcTotal([line as Parameters<typeof calcTotal>[0][number]]);
```

`calcTotal` es la aritmética buena y la usa todo lo demás; el defecto era no llamarla. Pasarle la
línea en un array de uno —que es su contrato— trae de regalo lo que ya sabe hacer:
`lineasQueSuman` descarta una cabecera de apartado (que **puede** colarse aquí, porque
`suggestMaintenance` casa contra el `concept` y una cabecera tiene concepto) y `precioConDto`
aplica el descuento de línea.

**No se arregla en la pantalla.** El dato malo está EN LA COLUMNA: taparlo en el front dejaría el
importe malo en el WhatsApp al pro, que es donde se toma la decisión de enviar.

### Y la segunda mitad: el ciclo no tenía UN SOLO TEST

Medido por AST el 17-sep-2026: `runMaintenanceProposals` la importaba **solo `cron.ts`**. Un
importe del camino del dinero, escrito por un cron diario, sin una sola prueba que lo mirase.

Por eso el bucle acepta ahora `{ prisma, recordCustomerEvent }` **con default al real**. Es el
patrón que este mismo fichero ya declara dos veces —`seleccionarLotes(now, { prisma })` y
`DepsAviso`— y que la casa tiene escrito: «va por parámetro con default al real… así un test puede
inyectar un doble y comprobar que el EFECTO ocurre, sin BD y sin gate». En producción nadie pasa
nada y el recorrido es el mismo.

**Y son exactamente DOS, no todas las que se podrían:**

* `prisma` — es por donde sale el `quote.create` cuyo `total` hay que poder leer. Se pasa **también**
  a `seleccionarLotes`, que antes lo cogía del módulo: dos clientes distintos en el mismo ciclo
  darían un lote de una base y una escritura en otra.
* `recordCustomerEvent` — no para observarlo, sino porque el bucle lo llama **sin `await`**: con el
  cliente real y sin base, esa promesa se rechaza sola y se lleva la tanda por delante con un fallo
  que no es del test.

`sendWhatsAppButtons` **no** se inyecta: el bucle no lo llama si el merchant no tiene
`whatsappPhone`, así que el doble cierra esa puerta sin tocar el código. `allocateQuoteNumber`
tampoco: recibe el `tx` de la transacción, que ya gobierna el doble. **Una dependencia que se puede
cerrar desde el fixture no se inyecta** — cada inyección es una rama más que producción no recorre.

---

## Verificado en rojo

Se quitó **el punto exacto** (se volvió a poner `price * qty`), se recompiló y se corrió el fichero.
**Caen 4 de 8, y son las 4 que miden la aritmética:**

```
✖ 🔴 EL DEFECTO: el total del borrador es el de `calcTotal`, con su IVA
✖ el descuento de línea también se respeta — el defecto no era solo el IVA
✖ descuento Y IVA a la vez, con cantidad > 1
✖ el importe que se le cuenta al pro es el MISMO que se guarda
✔ CONTROL POSITIVO: una línea con IVA 0 sigue dando lo mismo que antes
✔ el borrador hereda la línea del presupuesto origen
✔ el ciclo sigue haciendo todo lo demás igual
✔ sin nada inyectado, el ciclo sigue siendo el de producción
```

Eso es lo que prueba que los ocho miden cosas distintas: **cuatro verdes repetidos cuatro veces no
habrían discriminado nada**. Los cuatro que no caen son a propósito los que dicen «esto NO se ha
movido».

Tres cosas del banco que no son decorativas:

* **El control positivo** (IVA 0 → sigue dando 320,00 €) es el que distingue «ahora sale otro
  número» de «ahora sale el número bueno».
* **El suelo del fixture**: si `suggestMaintenance` no casara —por el gremio o por el concepto— el
  bucle se quedaría con su línea de cortesía a precio 0 y todos los asertos darían «0.00 === 0.00»
  tan contentos. Hay un test que comprueba que se está midiendo la línea heredada de verdad.
* **El número va escrito**, `'387.20'`, y no solo comparado con `calcTotal`: si algún día las dos se
  rompieran a la vez, comparar una con otra saldría verde.

---

## Lo que se midió

* Los cuatro casos de la tabla de arriba, contra `calcTotal` del `dist`, antes de tocar nada.
* Que `calcTotal` **sí** aplica el IVA: el presupuesto origen de staging, con 320 € + 25 € al 21 %,
  guarda 417,45 € = 345 × 1,21.
* Que el ciclo, con el arreglo, escribe en `quote.create` exactamente `calcTotal([line]).toFixed(2)`.
* Que el `CustomerEvent` de la ficha del cliente y el `Quote.total` **siguen saliendo de la misma
  variable**: si divergieran, la ficha diría un número y el documento otro.
* Que el plan se reprograma con el `now` recibido y no con el reloj real (`lastProposedAt = now`,
  `nextDueAt = now + 90 d`).

---

## Lo que NO cubre

* 🔴 **NO hay backfill, y es una decisión, no un olvido.** Cambiar el total de un documento que
  alguien pudo haber mirado es fabricar una cifra que nadie escribió. En producción no hay ninguno
  (0 merchants reales). En staging queda el borrador **#16** con su 320,00 € malo, **a propósito**:
  es la evidencia del PASO 0 de SCRUM-911, y un dato malo a la vista con su ticket al lado es más
  honesto que reescribirlo en silencio.
* **No se toca `handleMaintenanceButton`.** Cuando el pro aprueba, el borrador se envía tal cual
  esté; si lo editó, manda lo editado. Eso no cambia.
* **No se ha visto el ciclo REAL de staging con el arreglo dentro.** Lo medido es el bucle con un
  doble, más el recorrido de SCRUM-911 con el código anterior. Queda para cuando esto esté en main.
* **El `line` heredado conserva `apartado: true` si la que casó era una cabecera.** Con el arreglo el
  total sale 0 —igual que antes—, así que no hay regresión, pero un borrador que es solo un
  encabezado de apartado sigue siendo un borrador raro. No es de este ticket.
* **El KPI `maintenanceEurInMonth` sigue sin llamador** (confirmado por AST en SCRUM-911). Este
  arreglo hace que, el día que alguien lo llame, sume importes buenos — no lo pone a funcionar.

---

## Y el guard que lo tenía delante

`tests/_censo-aritmetica-iva.mjs` (SCRUM-627) censa quién hace aritmética de IVA **por su forma**.
En su comentario está escrito que `line.price * line.qty` de `maintenance.service.ts` era **«el
ÚNICO falso positivo del barrido»**, y se añadió un paso para no marcarlo.

**Y la clasificación era correcta**: esa multiplicación, en efecto, no hace aritmética de IVA. Lo que
pasa es que el defecto tiene la forma contraria — **un sitio que DEBERÍA hacerla y no la hace** — y
un censo de «quién la hace» no puede ver eso ni en teoría. No es un guard mal escrito: es que la
pregunta que contesta no es esta. Queda dicho aquí porque el comentario de ese fichero ahora nombra
una línea que ya no existe, y esa decisión es de otro carril (S3/S0), no de este ticket.

    🔒 Un censo de quién hace algo nunca encuentra a quien debería hacerlo y no lo hace.

---

## Ficheros

* `src/modules/maintenance/domain/maintenance.service.ts` — el arreglo (`calcTotal`) y el seam
  `{ prisma, recordCustomerEvent }` del ciclo.
* `tests/scrum929-el-total-del-borrador.test.mjs` — los ocho, sin base y sin gate.
* `docs/master/SCRUM-911.md` — dónde y cómo se encontró.
