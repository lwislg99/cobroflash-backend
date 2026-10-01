# SCRUM-1285 — Lo que se teclea con un guardado en vuelo ya no se pierde ni dispara un segundo guardado (mitad de PANTALLA)

**Medido contra:** `origin/main` = `e75b94ca8755bd5d27981940c5ff4c01b2df8695` · 2026-09-29T16:28:26Z

Carril S2 (pantallas) · rama `scrum-1285-guardado-en-vuelo` · sesión `s2-29d`.

## Carriles, contra el árbol

- `parteOficinaView.js`, `quotesDetailView.js` y `api.js` → **S2** (`orquestador.md` §11bis: en
  `public/dashboard/js/` solo `jobsView`, `parteDetailView` y `albaranDetailView` son de S4).
- `src/modules/system/app/routes/quotesAdmin.routes.ts` (el PATCH que reemplaza sin comprobar versión)
  → **S1**. **No se toca aquí.** Los puntos 3 (entre pestañas o personas) y 4 de la aceptación son suyos.

## El patrón (no dos parches)

`api.js` · `congelarMientrasGuarda(zona, guardar)`: mientras el guardado está en vuelo, **todos** los
controles de su zona (`input, select, textarea, button`) quedan apagados; al volver, bien o mal, cada uno
recupera **el `disabled` que tenía** (un tramo ya facturado sigue bloqueado). Devuelve la misma promesa.

- Congelar en vez de fusionar o avisar: fusionar obliga a decidir quién gana campo a campo, y avisar de un
  descarte exige un texto nuevo (regla 39). Congelar no pierde nada y **no necesita ninguna frase**.
- Es la mitad de la pantalla. Dos pestañas o dos personas se siguen pudiendo pisar: eso solo lo para la
  condición de versión **dentro del `update`** (como SCRUM-1276), que es del servidor.

Aplicado en:

- `parteOficinaView.js` «Guardar precios»: zona = la tarjeta del parte.
- `quotesDetailView.js` «Guardar plan»: zona = la sección «Plan de cobro». Así, teclear ya no puede
  llamar a `recalcular()` y rehabilitar el botón: **no hay segundo PATCH desde esta pantalla**.

## Medición (ejecutando, en el banco de vistas, con la red retenida a mano)

`tests/scrum1285-guardado-en-vuelo.test.mjs`, 9 casos. Las dos pantallas **reales**, montadas y pulsadas.
Teclear y pulsar se simulan como un navegador (un control apagado no recibe nada; `onclick` y oyentes).

| Caso | Con el arreglo | Con las vistas de `main` |
|---|---|---|
| Oficina · control positivo: guardar normal manda el PATCH y repinta lo guardado | ✔ | ✔ |
| Oficina · con el PATCH en vuelo no se puede teclear | ✔ | ✖ |
| Oficina · sonda sin el patrón: lo tecleado en vuelo desaparece (debe verlo) | ✔ | ✔ |
| Oficina · guardado fallido: nada se queda congelado | ✔ | ✔ |
| Plan · control positivo: guardar normal manda el PATCH y repinta | ✔ | ✔ |
| Plan · en vuelo: no se teclea, «Guardar plan» no se rehabilita, un solo PATCH | ✔ | ✖ |
| Plan · la base se queda con el último plan pedido | ✔ | ✔ |
| Plan · sonda sin el patrón: sale un 2.º PATCH y con la latencia invertida la base REVIERTE (debe verlo) | ✔ | ✔ |
| Plan · guardado fallido: el tramo facturado sigue bloqueado, el libre y el botón vuelven | ✔ | ✔ |

Las dos sondas de «sin el patrón» son el control positivo del instrumento: cambian el helper por uno que
no congela y **exigen ver el defecto** (valor pisado; segundo PATCH y reversión con la respuesta vieja
llegando la última).

## Lo que queda fuera

- **Aceptación 4 (la ruta rechaza una versión vieja): S1**, en `quotesAdmin.routes.ts:483-486`. Con la
  pantalla congelada ya no sale un segundo PATCH **desde la misma pantalla**; entre dos pestañas sigue
  pudiendo pasar.
- **Aceptación 6 (editor de líneas del albarán 5/5):** no se ha tocado `jobDetailView.js`; el patrón es
  nuevo y hoy solo lo usan estas dos pantallas.
- El censo de rutas que reemplazan sin versión es de S3.

---

## Mitad de SERVIDOR (S1) · aceptación 4 · rama `scrum-1285b-plan-de-cobro-con-version`

**Medido contra:** `origin/main` = `3700de42ef552b5da5689f375084d8be8ff47157` · 2026-09-29T16:56:08Z

`PATCH /admin/quotes/:id/billing-plan` hacía `update({ where: { id } })`: reemplazaba sin mirar sobre qué
versión escribía. Ahora:

- La petición puede traer `version` = el `updatedAt` que la pantalla recibió (`quoteAdmin.ts:253` ya lo
  devuelve en el GET del detalle). La condición va **dentro del `where`** del `update`
  (`{ id, updatedAt: version }`), mismo patrón que SCRUM-1276: la base decide «¿sigue siendo esa versión?»
  y «escribe» en la misma sentencia; no cabe otra petición en medio.
- No casa → P2025 → **409 `version_superada`**, sin escribir. Ilegible → 400 `version_invalida`.
- La respuesta devuelve `version` (la nueva) para el siguiente guardado.

**Plantilla para el censo de S3:** `src/core/db/escrituraConVersion.ts` (`leerVersion`,
`condicionDeVersion`, `esVersionSuperada`, los dos códigos). Cuatro líneas por ruta.

⚠️ **Transición declarada:** sin `version` se escribe como hoy, porque la pantalla aún no la manda y
exigirla rompería el guardado normal al desplegar. **Falta (S2):** que `quotesDetailView.js:807` mande
`version: quote.updatedAt`, la actualice con la de la respuesta y trate el 409. El 409 va **sin
`message`**: cualquier texto para la persona pide firma (regla 39). Cuando la pantalla la mande, se exige.

**Patrón nombrado por el orquestador (29-sep), visto en SCRUM-1276:** *un fixture inválido que pasa
porque el código de producción es demasiado laxo.* Al apretar el código, el fixture cae (`scrum814`
creaba el presupuesto en `pending`, estado que no existe). La pregunta no es «qué he roto» sino «¿este
fixture era posible?».

Test `tests/scrum1285b-plan-de-cobro-con-version.test.mjs`, por el manejador real con la base doblada
(P2025 y `@updatedAt` emulados): control positivo (dos guardados seguidos, cada uno sobre la versión que
devolvió el anterior), versión superada → 409 sin cambiar la base, **latencia invertida** (el PATCH viejo
llega el último y no revierte), versión ilegible → 400, y la transición. **Rojo contra `3700de42`: 4/5**
(la transición pasa en los dos, como debe).

Fuera de alcance: si se emite una factura entre la lectura de `emitidas` y la escritura, eso no cambia el
`updatedAt` del presupuesto; lo cubre (o no) el censo de S3.

La tanda completa lo marcó (SCRUM-1185): `version` es un campo del cuerpo que ninguna pantalla manda aún. Declarado en scripts/_sin-consumir-declarados.json con carril **S2** y ticket SCRUM-1285; se retira cuando quotesDetailView.js lo mande. Resto de la tanda: solo el 1216b ajeno.
