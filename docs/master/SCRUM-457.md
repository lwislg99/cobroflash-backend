# SCRUM-457 · El logout purga también `localStorage`

**Fecha:** 10-ago-2026 · **Carril:** H (offline) · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `409780f4f15ac717021056993c2d5966bfa504e3` · 2026-08-10T22:25:32+01:00
**Tanda:** 2877 tests · 2803 pass · **0 fail** · 74 gateados · `npm test` exit **0** · `guards:entrada` 17/17

## La víctima

Un profesional cierra sesión en el móvil de la furgoneta que comparte con dos compañeros. Dentro se
quedan el borrador de presupuesto —con el cliente y los importes— y su catálogo con **sus precios**.
Ha hecho lo único que el producto le ofrece para protegerse, y no ha servido.

Y **medio purgado es peor que ninguno**: SCRUM-455 ya limpia IndexedDB y las cachés, así que el
logout **parece** que limpia y el profesional deja de preocuparse.

## PASO 0

**a) ¿Estaba hecho?** No: `docs/master/SCRUM-457.md` no existe en `main`, no hay rama `scrum-457-*`
en el remoto.

**b) La premisa, con una corrección.** El encargo decía «El logout de hoy es `app.js:456-459`: un
POST y una redirección. **NO PURGA NADA**». **Eso ya no es cierto**: SCRUM-455 está en `main` y
`logout()` (ahora `app.js:456-469`) llama a `window.purgarDatosLocales()` **antes** del POST. El
resto del propio encargo ya lo daba por sabido, así que lo trato como una descripción que se quedó
vieja, no como un cambio de alcance. **El hueco real sí se sostiene, medido:** `purgarDatosLocales`
vacía los dos almacenes de IndexedDB y las cachés `yaqu-`, y **no toca `localStorage` ni
`sessionStorage`**.

**ENTRADA.** `public/dashboard/js/almacenLocal.js:282` → `purgarDatosLocales()`, que el logout ya
llama en `public/dashboard/js/app.js:466`.

**MECANISMO.** El enganche existe y el orden correcto ya está decidido en 455. Esto es **darle
superficie**, no rehacerlo.

### 🔴 Y el censo AST de SCRUM-336 SIRVE DE BASE — se mira antes de construir otro

`tests/_censo-almacenamiento-publico.mjs` ya recorre `public/` entero por AST y ya encuentra las
escrituras, con fichero, línea, almacén y si están en el panel. **No se duplica.** Lo único que le
faltaba era resolver la clave: daba `(clave no literal)` justo en **las dos que más importan**,
porque se escriben como `localStorage.setItem(draftKey(), …)`. Se le añade **un campo**,
`claveResuelta`, sin tocar lo que ya devolvía.

## Lo medido: cuatro escrituras vivas en el panel

| fichero:línea | almacén | clave | decisión |
|---|---|---|---|
| `quotesView.js:988` | localStorage | `pf_quote_draft_<merchantId>` | **PURGA** |
| `quotesView.js:1519` | localStorage | `pf_recent_products_<merchantId>` | **PURGA** |
| `tutorial.js:37` | localStorage | `yaqu_tips_shown` | **sobrevive** |
| `voiceInput.js:47` | sessionStorage | `voiceUnsupported` | **sobrevive** |

`pf_recent_products_*` **no es dato del cliente**: son los precios del profesional, en un aparato que
puede acabar en manos de un competidor. Eso no es RGPD, es su negocio.

### Lo que NO se purga, y por qué — hay dos, y no es una lista por simetría

* **`yaqu_tips_shown`** — el «no me lo vuelvas a enseñar» de los consejos. No lleva merchant, no hay
  dato personal ni de negocio: es una preferencia **del aparato**. Purgarlo devolvería el tour
  entero en cada cierre de sesión sin proteger absolutamente nada.
* **`voiceUnsupported`** — el resultado de probar si el micrófono de **este** aparato funciona (iOS
  en PWA lo declara y está roto). No hay dato de nadie; borrarlo solo haría repetir una prueba que
  ya se sabe que falla. **Y sí hacía falta decidirlo**: `sessionStorage` **no** se vacía al cerrar
  sesión, porque la pestaña es la misma.

Cada excepción lleva **motivo escrito**, y hay un test que exige que **cada una excluya algo de
verdad**: una excepción que no excluye nada es una regla que siempre pasa (SCRUM-450), y una que
sobrevive a la clave que la justificaba es peor —parece una decisión y ya no protege nada—.

## Lo que se construye

**Se engancha DENTRO de `purgarDatosLocales`, no en `app.js`.** El logout ya llamaba ahí y ya lo
hacía antes del POST. Efecto colateral bueno, y va al informe: **no toco `app.js`**, que es la zona
donde la sesión 1 está con H2.

**Por nombre, no `localStorage.clear()`.** Misma regla que 455 aplicó a las cachés, por dos motivos
distintos: `clear()` se lleva lo que otro haya dejado en el mismo origen, **y oculta el error de
mañana** — la clave que alguien añada el mes que viene se borraría sin que nadie se entere de que
existía, y sin que nadie decida nunca si debía sobrevivir.

**Se recorre lo GUARDADO y se borra lo que casa, no al revés.** `pf_quote_draft_<id>` no es una
clave: es una **familia**, y el móvil de la furgoneta tiene una por cada compañero que haya entrado.
Y las claves se listan **antes** de borrar, porque `key(i)` se reindexa al eliminar y un bucle que
borre mientras recorre se salta la mitad — el defecto clásico de este API.

**Un FALLO ya anotado no se pisa con un `NO_DISPONIBLE`.** Son cosas distintas y manda la peor:
«este navegador no da IndexedDB» es una limitación conocida; «había almacén y algo que debía
borrarse no se borró» es un dato que sigue en el móvil. Colapsarlos daría el recuento tranquilo y
falso que SCRUM-455 separó en tres estados.

## Verificado

**El control positivo ES el test:** se monta el dashboard entero, se le pone en `localStorage` lo
que hay en el móvil de la furgoneta —dos borradores de dos compañeros, el catálogo con precios, la
preferencia de consejos y **una clave de otra aplicación**— y se llama a **`logout()` de verdad**.
Probar el purgado por su cuenta comprobaría que la función funciona, no que el logout la llama, y lo
que le falla al profesional es lo segundo.

**Siete rojos por el MECANISMO**, cada uno con post-condición:

| # | qué se rompe | qué sale |
|---|---|---|
| **R1** | una **quinta** escritura sin registrar | 🔴 «estas escrituras NO están en `CLAVES_LOCALES`… `public/dashboard/js/tutorial.js:30 → localStorage['yaqu_ultimo_cliente_…']`» — **fichero, línea y clave** |
| **R1b** | una escritura con clave que no se sabe leer | 🔴 «hay escrituras cuya **CLAVE NO SE SABE LEER**: `tutorial.js:30`… se declara ciego» |
| **R2** | el logout deja de purgar | 🔴 «tras cerrar sesión sigue en el móvil el borrador con el cliente y los importes» |
| **R3** | se borra todo en vez de por nombre | 🔴 «se ha borrado una clave que no es nuestra… el origen es compartido» |
| **R4** | se recorre el almacén VIVO mientras se borra | 🔴 se purga uno de los dos borradores: el `key(i)` reindexado en acción |
| **R5** | una excepción que no excluye nada | 🔴 «la excepción `/^clave_que_ya_nadie_escribe$/` no casa con NINGUNA escritura… es una decisión que ya no lo es» |
| **R6** | el censo deja de ver las escrituras (**suelo**) | 🔴 «SUELO: el censo solo vio 6 accesos en todo `public/`. No ha mirado» |

**Controles negativos:** lo ajeno (`otra_app_preferencias`) y las dos excepciones **sobreviven** ·
purgar dos veces seguidas no revienta y **no cambia nada** · sin `localStorage` disponible —Safari
en privado, permiso denegado— **cerrar sesión no se rompe**, y el resultado dice `FALLO` **con
motivo**, porque «está borrado» y «no supe borrarlo» no pueden ser el mismo valor.

**Y el orden**, que no es indiferente: hay test de que el purgado sale **antes** del POST. El
purgado no depende de la red y el POST sí; si saliera después, una petición colgada en un sótano
dejaría los datos del cliente en el móvil.

### 🔴 El banco guarda de verdad, y sin eso nada de esto significaría nada

El `localStorage` del banco era `{ getItem: () => null, setItem() {}, removeItem() {} }`: **un
almacén donde escribir no escribe**. Con eso, «tras el logout no queda ni un dato» sale **verde
aunque el logout no borre nada**, porque nunca hubo nada que borrar. Es el mismo verde vacío que el
`fetch` que ignoraba el `signal` en SCRUM-451, y aquí con el art. 32 detrás. Ahora implementa el API
entero que el purgado recorre —`length` y `key(i)`, no solo get/set/remove— y `key(i)` se reindexa
al borrar, como en el navegador, para que ese defecto pueda salir.

## Lo que NO cubre

* **🔴 El fallo del purgado NO SE PUEDE VER: no hay superficie todavía.** `purgarDatosLocales`
  devuelve `estado`, `motivo` y ahora `claves`, y **nadie pinta ese resultado**. Si el purgado falla,
  el profesional cierra sesión y no se entera. Quién lo mira y con qué palabras es **H2
  (SCRUM-356)**, sesión 1, y no se construye aquí.
* **Solo se purga en el logout.** Cerrar la pestaña, que caduque la sesión desde el servidor o que
  otro usuario entre en el mismo navegador **no purgan nada**. No estaba en el encargo.
* **No se ha visto en un navegador.** Lo verificado es la lógica en el banco.
* **Las claves de terceros en el mismo origen se quedan**, a propósito. Si mañana alguien mete un
  dato nuestro con un nombre que no parece nuestro, el guard lo caza; el purgado, no.
* **`document.cookie` queda fuera del guard.** El censo lo ve y lo cuenta, pero el registro es de
  claves de almacén: hoy no hay ninguna escritura de cookie en el panel, así que no se inventa una
  regla para un caso que no existe.

## Ficheros

* `public/dashboard/js/almacenLocal.js` — `CLAVES_LOCALES`, `purgarClavesDe`, y el purgado
  enganchado dentro de `purgarDatosLocales`.
* `tests/scrum457-logout-purga-claves.test.mjs` (nuevo, 7).
* `tests/_censo-almacenamiento-publico.mjs` — campo `claveResuelta` **añadido**, nada sustituido.
* `tests/_banco-vistas.mjs` — `almacenDeTeclas`: un `localStorage`/`sessionStorage` que guarda.
