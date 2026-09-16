# SCRUM-318 · G3: el contenido del rail del Trabajo

**Fecha:** 5-ago-2026 · **Carril:** A · **Gate:** sin gate, corre en `npm test` · **UI:** vanilla (regla 4)

**Medido contra:** `origin/main` = `31194480c8ae0c00b99240c47cc5411715a6ea28` · 2026-08-05T13:45:00+02:00

## El defecto

Cliente, teléfono y dirección vivían en «Datos», **debajo de toda la pila de documentos**. Y son
justo lo que se consulta yendo de camino a la obra: a quién llamo y adónde voy. La pila **crece con
el trabajo**, así que cuanto más avanzado estaba, más lejos quedaba lo que más se mira.

G1 dejó la rejilla y los cinco bloques declarados y vacíos. Esto los llena.

## 🔴 El bloque estrella NO se pinta, y esa es la medición

`DÓNDE` con su enlace a mapa era la ventaja que ningún facturador tiene: la dirección de la **obra**,
no la fiscal del cliente. **No hay dato.** Medido dos veces, y las dos apuntan al mismo sitio:

- **`Job.direccion` es campo propio y nadie lo escribe.** En todo `src/` no hay un solo
  `create`/`update` que lo rellene; la única aparición fuera de un `select` es una lectura
  (`albaranPublic.routes.ts:142`). El propio schema lo dice: «direccion sin fuente hoy (ni Quote ni
  Customer la tienen)».
- **El modelo `Customer` no tiene dirección.** Ni `address`, ni `city`, ni `postal`. Se comprobó
  campo a campo.

Así que la trampa de «rellénalo con la del cliente» es **doblemente imposible**: ni sería la de la
obra, ni existe. Sin dato no hay bloque y no hay enlace — **un enlace a mapa que lleva al sitio
equivocado es peor que no tenerlo, porque el que no existe no se sigue.**

El código de `bloqueDonde` **se queda escrito y probado**: el día que alguien escriba `direccion`,
el bloque aparece solo y con el enlace correcto. Hay un test que lo demuestra con una dirección de
verdad, y es además el suelo del control negativo — sin él, «no sale el bloque» podría significar
«el constructor está roto» en vez de «no hay dato».

> **HALLAZGO PARA OTRO CARRIL (regla 9):** que el campo exista, se lea en tres sitios (el albarán
> público, el PDF del albarán y el serializer) y **ninguna ruta lo escriba** es un defecto propio.
> No se arregla aquí: escribirlo pide una decisión de producto —¿se teclea?, ¿se hereda del
> presupuesto?, ¿se geocodifica?— y toca el alta del Trabajo, que no es este bloque.

## Los cuatro bloques que sí tienen dato

| bloque | qué pinta | de dónde |
|---|---|---|
| `CLIENTE` | nombre + teléfono **pulsable** (`tel:` y WhatsApp) | `customer.name`, `customer.phone` |
| `DINERO` | Cobrado · Pendiente | `totalAceptado`, `totalCobrado` |
| `PRESUPUESTO` | `#2 · 24 jun`, enlaza al detalle | `job.quote` |
| `RESPONSABLE` | operario, o el nombre del negocio | `job.operario` |

**El teléfono pulsable no es un detalle.** Como texto plano es un número que hay que copiar a mano
con las manos sucias; pulsable es una llamada. `tel:` y `wa.me` se construyen del **mismo** número
normalizado, y se pinta el que tecleó el pro (con sus espacios): hay test de las tres cosas.

**`Aceptado` NO se repite en el rail**, y es la única desviación de la maqueta del ticket. Ya es el
titular del cuerpo a 2,2 rem; el mismo número dos veces en la misma pantalla no informa, y en una
columna de 220 px compite con lo que sí es nuevo. **Si lo quieres también en el rail, es una línea.**

**Y `Pendiente` exige importe de referencia** (`aceptado > 0`). Sin él no hay nada contra lo que
estar pendiente, y afirmarlo sería reintroducir en el rail el defecto que **SCRUM-363** acaba de
quitar del chip de cobro. No depende de su código: comparte su criterio.

## Por qué los constructores son puros

`public/dashboard/js/jobRailBlocks.js` devuelve **datos**, no DOM. El ticket exige probar que «el
`href` del mapa se construye con el mismo dato que se pinta»; con el enlace armado dentro del render
esa prueba obliga a montar un navegador y acaba siendo una que nadie ejecuta. Así el test compara
los dos campos —`lineas[].texto` y `enlace.href`— y no hay forma de que diverjan sin que salte.

La decisión de «¿hay dato?» vive **entera** en los constructores. Repartirla entre el módulo y el
render es como se acaba pintando un bloque que el constructor daba por vacío.

## El móvil, que es el caso de uso real

El rail deja de ser columna por debajo de 720 px **y se adelanta con `order:-1`**. Debajo del cuerpo
volvería a quedar detrás de la pila de documentos, que es exactamente el defecto que este ticket
corrige. Hay test de la media query: sin `order:-1`, rojo.

Objetivo táctil de 44 px en los enlaces del rail (AB6): el teléfono y el mapa se pulsan de pie, con
el motor en marcha.

## Los siete rojos

| # | Qué se rompe | Qué sale |
|---|---|---|
| 1 | La dirección desaparece del modelo | 🔴 el SUELO, nombrando el bloque DÓNDE |
| 2 | Rellenar DÓNDE con lo del cliente (la trampa) | 🔴 CONTROL NEGATIVO |
| 3 | Un bloque que se pinta con «—» | 🔴 la regla del hueco |
| 4 | El `href` sale de otro dato que el pintado | 🔴 «lee una cosa y conduce a otra» |
| 5 | Meter un `input` en el rail | 🔴 el rail es de solo lectura |
| 6 | Quitar `order:-1` del móvil | 🔴 «vuelve a quedar detrás de la pila» |
| 7 | Cegar el derivador | 🔴 ESCÁNER CIEGO |

**Repetidos enteros después del rebase a `main`**, que es la regla nueva. Tres de ellos no aplicaron
a la primera porque mis anclas llevaban `\n` literal sobre ficheros CRLF: el `node -e` salía por
error y el `&&` se saltaba el test, así que **no salía ni rojo ni verde**. Se rehicieron con
patrones `\r?\n`. Un rojo que no se ejecuta se lee igual que uno que pasa.

## Tres guards ajenos se pusieron en rojo, y los tres tenían razón

- **SCRUM-262** — mis fixtures usaban `34600000000`. Un móvil español empieza por 6 o 7: **ese
  número puede ser de alguien**. Ahora salen de `telefonoDePrueba()` (rango imposible `340…`), y el
  fixture lleva su propio suelo — si el formateo con espacios no casara, el test de normalización
  pasaría sin normalizar nada.
- **SCRUM-189** — escribí «regla 4 del patrón B2». El número solo no identifica nada, que es
  justo lo que ese guard defiende. Reescrito sin cita numerada.
- **SCRUM-316** — su assert del rail buscaba el filtro **concreto** de G1 (`.filter((b) => b.el)`) y
  G3 lo sustituyó por `.filter(Boolean)`: rojo por un cambio legítimo. Se cambió para proteger la
  **regla** —un bloque sin contenido no llega al rail— y no la expresión del primer día.

## Verificación

- `npm run build` → **exit 0** y `npm test` → **exit 0** en esa misma tirada: **1617 tests · 1550
  pass · 0 fail · 67 skipped**.
- ⚠️ La primera vez di un «BUILD OK» que era falso: el worktree no tenía dependencias, `tsc` no
  existía, y el `| tail` se comió el código de salida. Desde entonces se lee `$?` explícitamente.

## Microcopy (regla 30)

- **Aprobados por el fundador y usados literales:** `CLIENTE` · `DÓNDE` · `DINERO` · `PRESUPUESTO` ·
  `RESPONSABLE`.
- `Cobrado` y `Pendiente` se **mueven verbatim** del cuerpo: no son texto nuevo.
- `abrir en mapa` **no está aprobado** → sale con `[PENDIENTE microcopy oficial]`. Hoy no llega a
  pintarse nunca (no hay dirección), así que el marcador no se publica; el texto vive en el código y
  la regla aplica al código.

## Huecos declarados

- **AB6 · matriz de dispositivos: PENDIENTE.** Es humana, y **aquí importa más que en ninguna otra
  tarea del bloque**: el rail en móvil es el caso de uso real de esta pantalla. El `order:-1` está
  probado por CSS, no en dispositivo.
- **Capturas antes/después: PENDIENTE** — mismo motivo.

## Lo que NO se tocó

- El reparto de DOCUMENTOS (**G4**), «Qué falta para cobrar» (**G5**), el listado, el cobro, la
  firma y `prisma/schema.prisma`.
- La fila del presupuesto en DOCUMENTOS sigue donde estaba: el bloque `PRESUPUESTO` del rail es un
  atajo desde el contexto, no una segunda copia del documento.
