# SCRUM-692 · Dos formularios editan el mismo cliente, y ninguno borra lo que no enseña

**Fecha:** 2-sep-2026 · **Carril:** integridad de datos del cliente · **Gate:** el contrato sin gate; el viaje, con `QA_DB_TEST=1`

**Medido contra:** `origin/main` = `a464d978051268f647bdddfa7837538dead8d921` · 2026-09-02T20:50:17Z

> **El guardado parcial era cierto POR ACCIDENTE.** Nadie lo decidió: es la consecuencia de que
> `customerUpdateSchema` sea un `.partial()` de Zod y de que Prisma no toque lo que no recibe. No
> estaba declarado en ninguna parte ni lo sujetaba ningún test. Este ticket lo convierte en una
> propiedad exigida.

---

## 1 · PASO 0

### ENTRADA · dos superficies, las dos alcanzables hoy

| | ruta | campos que envía |
| --- | --- | :-: |
| **modal** | menú Clientes → «+ Nuevo cliente» / «Editar» — `customersView.js` | **16** |
| **ficha 360** | «📊 Historial» por fila → «Editar» — `customerDetailView.js` (`#e360-*`) | **10** |

### MECANISMO

`PUT /admin/customers/:id` → `customersAdmin.routes.ts:114` → `customerUpdateSchema`
(`= customerCreateSchema.partial()`) → `updateCustomer` → `prisma.customer.updateMany({ data })`.

---

## 2 · La medición, EJECUTANDO el camino (no leyéndolo)

Cliente con dirección y referencia, guardado con **el payload exacto de la ficha 360**, y relectura.
Contra `yaqu_dev_javier`.

| | resultado |
| --- | --- |
| **SUELO** · ¿la lectura ve los valores ANTES? | **sí** — dirección y referencia. El instrumento mide. |
| claves que sobreviven al parseo de Zod | `name, notes, waOptOut, contactKind, legalName, taxId, tipoDestinatario, billingPeriodicity` — **ni `billingAddress` ni `internalRef`** |
| después · `billingAddress` | **sigue** |
| después · `internalRef` | **sigue** |
| **CONTROL POSITIVO** · lo que la ficha SÍ muestra | **sí cambia**: `legalName` → `null`, `billingPeriodicity` → `NINGUNA` |

🔴 **El control positivo es lo que hace válida la medición.** Sin él, «no borra» y «no guarda nada»
son el mismo verde. Un `updateCustomer` que no hiciera absolutamente nada habría pasado la prueba
con matrícula de honor.

### La asimetría, y va en LAS DOS direcciones

| sólo en el **modal** (la ficha no los muestra) | sólo en la **ficha 360** (el modal no lo envía) |
| --- | --- |
| `internalRef` · `recargoEquivalencia` · `tags` · `billingAddress` · `billingCity` · `billingPostalCode` · `billingProvince` · `billingCountry` | `billingPeriodicity` |

La segunda columna es **la mitad que se olvida**: `billingPeriodicity` sólo se puede configurar
desde la ficha 360.

🔴 **Y el guard demostró que sirve el mismo día que nació.** Mientras se escribía esto, SCRUM-580
(etiquetas) entró en `main` con `tags` **sólo en el modal**. El test de la asimetría **cayó
nombrándolo** y hubo que declararlo. No era un fallo —la ficha 360 no lo envía, así que no lo
borra— pero la lista creció **con aviso** en vez de en silencio. **Tercera columna en un día**:
`internalRef`, los cinco `billing*` y `tags`. Ése es exactamente el agujero que la opción (c)
—añadir campos a la ficha— habría dejado abierto para la cuarta.

---

## 3 · Qué se construyó, y por qué esta propiedad y no otra

**«Un formulario sólo envía lo que muestra.»** Una sola regla que cubre las dos direcciones.

🔴 **Se descartó «ninguna clave puede ser un literal `null`»**, que era lo primero que se me
ocurrió, **porque no caza la regresión real**: un `billingAddress: data.customer.billingAddress ??
null` **no es un literal** —lee una variable— y si el `/detail` no trae ese campo vale `null` y
borra igual. **Lo que hace segura a una clave no es su forma: es que detrás haya un control donde
el profesional pueda ver y escribir el valor.**

### Dos ficheros, dos mitades que no se sustituyen

| fichero | gate | qué vigila |
| --- | --- | --- |
| `scrum692-un-formulario-no-borra-lo-que-no-muestra` | **sin gate**, cada tanda | el **contrato**: lee por AST el payload REAL de los dos formularios y exige que cada clave salga de un control del propio formulario |
| `scrum692-guardado-parcial-en-base` | `QA_DB_TEST=1` | el **viaje**: que el camino entero escriba lo que dice y no toque lo demás |

* el contrato puede estar bien y `updateCustomer` rellenar el objeto por su cuenta;
* el viaje puede estar bien hoy y romperse mañana con un `?? null` en el front.

**El del contrato lee el payload real**, no uno inventado — si construyera su propio corpus,
inyectar `?? null` en la vista no lo tumbaría, que es justo lo que hay que impedir.

---

## 4 · Evidencia

Commiteado en verde antes de mutar; cada mutación con post-condición sobre el fichero nombrado.

| mutación en `customerDetailView.js` | resultado |
| --- | --- |
| **la regresión exacta**: `billingAddress: data.customer.billingAddress ?? null` y lo mismo con `internalRef` | 🔴 **caen 2 guards** y el mensaje **nombra los dos campos con su expresión**: `billingAddress ← data.customer.billingAddress ?? null` |
| **el caso que se olvida**: `legalName` pasa de `\|\| null` a `\|\| undefined` | 🔴 «**«legalName» … ya no puede VACIARSE**: el profesional no podría borrar un dato que puso mal — y «guardado parcial» no puede convertirse en «ya no se puede borrar nada»» |

El segundo importa tanto como el primero: **sin él, alguien «arreglaría» esto quitando la
posibilidad de vaciar, y el guard le daría verde.**

**Suelo**, y me hace falta a mí el primero: el extractor tiene que ver `name` en los dos
formularios (va en **shorthand** en la ficha) y `phone` (se añade **fuera** del literal). Si se
queda ciego, «ninguna clave envía lo que no muestra» sería cierto sobre un conjunto vacío.

**El test gateado, en sus dos formas**: sin gate **salta declarando el motivo**; con
`QA_DB_TEST=1` ejercita el viaje real contra staging y pasa.

**Verde:** tanda completa después del último cambio, `guards:entrada` verde, worktree limpio.

---

## 5 · Huecos declarados

* **No se añadieron campos a la ficha 360.** Eso es la opción (c) —¿deben las dos superficies
  editar lo mismo?— y la decide el fundador. Este ticket cierra el agujero **para todas las
  columnas futuras**, que es lo que añadir campos no haría.
* **No se probó el camino HTTP completo** (con servidor levantado): se ejercita ruta → schema →
  `updateCustomer` → `getCustomer`, que es donde vive la lógica, no el transporte.
* **`tags` (SCRUM-580) entró mientras se escribía esto y NO se midió su viaje contra base de
  datos.** El guard del contrato sí lo cubre —cayó nombrándolo y ya está declarado—, pero el test
  gateado no incluye `tags` en su cliente de prueba: si alguien hiciera que la ficha 360 lo
  enviara, lo cazaría el contrato, no el viaje.
* **El guard del contrato conoce cinco formas de leer un control** (`$('#…')`, `fieldX.input.value`,
  `.leer()`, `telefonoCompleto()`, `direccionParaPayload(field…)`). Una forma nueva de leer un
  control haría caer el guard **en falso** hasta que se añada a `LEE_UN_CONTROL` — el mensaje lo
  dice, pero es una lista a mano y envejece como todas.

---

## 6 · El instrumento que falló cuatro veces hoy, y lo que eso enseña

Midiendo **este mismo ticket**, mi censo de campos se dejó primero `phone`/`email` —van fuera del
objeto literal— y después `name`, por el **shorthand** (`name,` sin dos puntos). Las dos veces lo
destapó un **suelo** que fallaba mientras el extractor estuvo ciego, no yo leyendo el resultado.

Es la cuarta vez en el día que el instrumento falla antes que el código, y **la cuarta que lo caza
un control positivo**:

1. el PDF medido con los nombres de campo equivocados → un cero que era falso;
2. el CSV «partido» por un `split(';')` que no respeta comillas → un fallo que no existía;
3. `MARCADOR_MICROCOPY` buscado como subcadena → tres ficheros que eran `PV_MARCADOR_MICROCOPY`;
4. este censo de campos, dos veces.

Cuatro veces no es casualidad: **es que ponerlos funciona.** Un instrumento sin control positivo
no informa de lo que hay — informa de lo que sabe ver.

---

## Tests que introduce esta entrada

* `tests/scrum692-un-formulario-no-borra-lo-que-no-muestra.test.mjs` — 6 pruebas sin gate: el suelo
  del extractor, la propiedad en los dos formularios, el control positivo, la asimetría fijada en
  las dos direcciones y el caso de vaciar a propósito.
* `tests/scrum692-guardado-parcial-en-base.test.mjs` — el viaje completo contra base de datos,
  gateado por `QA_DB_TEST=1`.
