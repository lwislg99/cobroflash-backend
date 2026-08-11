# SCRUM-446 · PASO 0: las 24 cabeceras NO son homogéneas — paro antes de unificar

**Medido contra:** `origin/main` = `bf4ffb730a332f936e5bec6000fe665d4e6b0a9c` · 2026-08-10T20:34:39+02:00
**Rama:** `scrum-446-cabecera-modal`

**10-ago-2026, 20:34 CEST (UTC+0200)**

El encargo decía: *«Si al medir resulta que las 24 no son homogéneas —que hay dos o tres formas
distintas de cabecera— DILO ANTES DE UNIFICAR»*. **Hay tres mecánicas y cuatro etiquetas de título.**

## El censo, sobre código ejecutable

Confirmado el punto de partida: **24 cabeceras en 16 ficheros**. (El primer barrido las contó
incluyendo menciones en comentarios; se rehízo sobre `soloEjecutable` — la trampa de
autorreferencia, séptima vez en este repo.)

### Tres mecánicas de construcción

| | mecánica | cuántas |
|---|---|---|
| ① | **HTML en plantilla** (`<div class="modal-header">…`) | **17** |
| ② | **DOM imperativo** (`document.createElement` + `className`) | **6** |
| ③ | **DOM con el helper local** `createElement(tag, clase, texto)` | **1** |

Un constructor compartido que devuelva una **cadena** no sirve a ② ni a ③; uno que devuelva un
**nodo** obliga a reescribir las 17 de ①. **No es un detalle de estilo: es la firma del constructor**,
y elegirla mal deja siete sitios fuera o diecisiete tocados de más.

### 🔴 Y el que convierte esto en decisión, no en refactor: la etiqueta del título

| etiqueta | cuántas |
|---|---|
| `<h3 class="modal-title">` | **12** |
| `<span class="modal-title">` | **5** |
| `<div class="modal-title">` | **5** |
| otro (div/desconocido) | 2 |

**`<h3>` y `<span>` no son la misma cosa para quien no ve la pantalla.** Un lector de pantalla
anuncia el `h3` como encabezado y le da estructura al modal; el `span` no anuncia nada. Unificar
**obliga a elegir una**, y esa elección **cambia lo que se anuncia en 12 sitios** (si gana `span`) o
**en 12 sitios** (si gana `h3`) — en los dos casos, media docena larga de pantallas cambian de
comportamiento para una persona con lector de pantalla.

Eso es una decisión de accesibilidad (checklist AB6), **no un refactor**, y no me corresponde
tomarla en una tarea que dice explícitamente que no cambia nada que vea el usuario.

### Y dos cabeceras SIN botón de cierre

`customerDetailView` y `quotesView:70`. Un constructor con botón las **añadiría** uno donde hoy no
lo hay: eso **cambia el comportamiento**, y puede haber flujos que obliguen a elegir a propósito.
Un constructor sin botón se lo **quitaría** a las otras 22.

## Lo que pregunto antes de construir

1. **La firma del constructor:** ¿devuelve cadena (y se reescriben las 7 imperativas) o nodo (y se
   reescriben las 17 de plantilla)? Las dos son un refactor mayor que «pasar las cabeceras por él».
2. **La etiqueta del título:** `<h3>` o `<span>`. Con lo que implica para el lector de pantalla, y
   sabiendo que hoy hay 12 de cada bando.
3. **Las dos sin botón de cierre:** ¿es deliberado? Si lo es, el constructor necesita el botón como
   opción, y eso hay que decidirlo antes de escribirlo.

**Unificar sin contestar esas tres es exactamente el defecto que este proyecto nombró en SCRUM-242:
reutilizar algo que respondía a otra pregunta.** Aquí serían tres preguntas distintas metidas en una
sola función.

## Lo que NO he hecho

No he construido el constructor · no he tocado ninguna cabecera · no he escrito el guard (nacería
midiendo una forma que aún no está decidida) · no he añadido ni un «?» (eso es SCRUM-416).

## Lo que SÍ queda medido para cuando se decida

- las 24, con fichero, línea, mecánica, etiqueta de título y si tienen botón;
- los **3 overlays propios** que el encargo ya señalaba —`signaturePad`, `onboardingView`,
  `tutorial`— siguen fuera del alcance del constructor **y hay que declararlos**, porque la ayuda
  está oculta por **dos mecanismos distintos**: los modales compartidos por
  `display:none !important` (`styles.css:2173`) y la firma **porque su overlay está a z-index 1200
  con el FAB en 350** — no oculto, **debajo**. Quien arregle solo el primero verá desaparecer el
  síntoma en 24 de 27 sitios y lo dará por resuelto.

---

# SCRUM-446 · segunda entrega: el constructor, y una QUINTA diferencia — paro otra vez

**Rama:** `scrum-446-cabecera-modal` · **10-ago-2026, 20:5x CEST (UTC+0200)**

Con las tres respuestas —nodo, `<h3>`, cierre opcional— se construyó
`public/dashboard/js/modalHeader.js`, registrado en `index.html` (antes de las vistas) y en el
precache de `sw.js`. **Migradas 2 de 24**, y paro aquí por lo de abajo.

## 🔴 La cuarta y la quinta diferencia

**Cuarta — resuelta midiendo, sin criterio nuevo:**

| | qué | resolución |
|---|---|---|
| `type="button"` | lo ponían las **7** imperativas y **ninguna** de las 17 de plantilla | **unificado**. Sin `type`, dentro de un `<form>` un botón es `submit`. **Medido: ningún `modal-close` está dentro de un `<form>`** (los 3 del panel, uno a uno) → no cambia nada hoy y protege mañana |
| `aria-label="Cerrar"` | lo tenían **4 de 24**; los otros 20 se anuncian como «×» | **unificado**. No es microcopy nueva y **el repo ya lo declara**: `api.js:421` — «`aria-label="Cerrar"` NO es microcopy nueva: es el literal que ya usan `invoiceDetailView`…» |

**🔴 QUINTA — y ésta cambió el constructor:** `nuevaFacturaModal.js` pone
`aria-label = NF_PENDIENTE`, que es **`'[PENDIENTE microcopy oficial]'`** — un **marcador de
microcopy sin aprobar**, no una etiqueta.

> Forzarle «Cerrar» habría **resuelto en silencio una aprobación pendiente**, que es exactamente lo
> que el guard de marcadores existe para impedir (regla 30). El constructor gana `etiquetaCierre`
> para que ese sitio **conserve su marcador**, y la opción queda documentada con ese motivo — no es
> flexibilidad decorativa, es un caso real.

## Por qué paro con 2 de 24

Porque la quinta diferencia **ya cambió la API del constructor**, y las 22 restantes son ediciones
mecánicas que habría que rehacer si no te convence `etiquetaCierre` o el `aria-label` unificado.
**Has dicho tres veces que parar es para esto.** Las dos migradas están para que se vea que la pieza
funciona sobre las dos mecánicas distintas:

- `customersView` — la del helper local, y **conserva `modalTitleEl`** (esa vista cambia el título
  entre «Nuevo cliente» y «Editar cliente»): se obtiene con `header.querySelector('.modal-title')`.
- `nuevaFacturaModal` — la de `document.createElement`, con su marcador intacto.

## Lo que queda, y no se ha tocado

**22 cabeceras** (5 imperativas + 17 de plantilla) · **el guard derivado** — no se escribe todavía
porque **nacería rojo con 22 sin migrar**, y el ticket exige que nazca verde · **los 3 overlays
propios**, que se declaran cuando el guard exista · **la ayuda**, que es SCRUM-416.

**Nada roto:** suite en verde con la migración parcial.


---

# SCRUM-446 · tercera entrega: las 7 imperativas migradas · 17 pendientes

**Rama:** `scrum-446-cabecera-modal` · **11-ago-2026**

`etiquetaCierre` y el `aria-label` unificado quedaron aprobados. Migradas **las 7 cabeceras
imperativas**, que eran las que justificaban la decisión ① (nodo y no cadena):

| fichero | cuántas | nota |
|---|---|---|
| `customersView` | 1 | helper local; conserva `modalTitleEl` vía `querySelector` |
| `nuevaFacturaModal` | 1 | mantiene su **marcador** de microcopy en `etiquetaCierre` |
| `jobDetailView` | 3 | misma forma exacta las tres |
| `quotesView` | 2 | una de ellas **sin botón de cierre**, y se queda sin él |

**Quedan 17**, todas de la misma clase: HTML dentro de una plantilla.

## 🔴 Por qué las 17 no van en esta tanda

Intenté una transformación automática y **la descarté antes de aplicarla**: metía las opciones del
constructor como JSON dentro de un atributo del propio literal, y ahí `${…}` y las comillas se
pelean. Era «demasiado lista» para un refactor cuyo único requisito es **no cambiar nada**.

La forma correcta es la aburrida, y es una edición **a mano por sitio**: quitar el marcado de la
plantilla y anteponer el nodo tras el `innerHTML`, con
`raiz.querySelector('.modal').prepend(cabeceraModal({…}))`. No es mecanizable con confianza porque
**cada fichero llama distinto a su raíz** y alguno no usa `.modal` como contenedor.

**No las dejo a medias:** 17 ediciones a mano sin margen para verificarlas una a una es donde se
cuelan las regresiones mudas que este ticket avisa dos veces. El estado de hoy es **coherente y
verde**: las 7 migradas funcionan, las 17 siguen exactamente como estaban.

## El guard sigue sin escribirse, a propósito

**Nacería rojo con 17 sin migrar**, y el ticket exige que nazca verde. Va en la tanda que las cierre,
junto con la declaración de los tres overlays propios.

## Lo que hay que recordar para esa tanda

- **Los 3 overlays propios NO se unifican, se DECLARAN**: `signaturePad`, `onboardingView`,
  `tutorial`.
- Y con **los dos mecanismos de ocultación distintos**, que es lo que impide dar SCRUM-416 por
  resuelto a medias: los modales compartidos se ocultan con `display:none !important`
  (`styles.css:2173`); **la firma no está oculta, está DEBAJO** — su overlay va a `z-index: 1200` y
  el FAB a `350`. Quien arregle solo el primero verá desaparecer el síntoma en 24 de 27 sitios.
- **12 cabeceras pasarán de `span`/`div` a `<h3>`**: cambia lo que anuncia un lector de pantalla, y
  va declarado como tal (AB6), no escondido bajo «refactor».


---

# SCRUM-446 · cuarta entrega: 24/24 y el guard NACE VERDE

**Medido contra:** `origin/main` = `79e74f6f1aa85401de20ee1e70b46b11eb514e3a` · 2026-08-11T13:37:10+02:00
**Rama:** `scrum-446-cabecera-modal`

**24 de 24 migradas · 0 escritas a mano · guard 6/6 en verde.**

## Control positivo: ninguna cambió de texto ni de id

Listadas las 24 llamadas y contrastadas contra el censo previo: **mismo título y mismo id en todas**.
Las dos que no tenían botón (`customerDetailView`, una de `quotesView`) **siguen sin él**; las tres
con `aria-labelledby` conservan su `idTitulo`.

**El único texto que cambia de forma** es el de `invoiceDetailView`: pasaba por `escAnul()` para
meterlo en una plantilla, y el constructor usa `textContent` — escaparlo ahí mostraría `&amp;` al
usuario. Va sin escapar, y **en pantalla se ve exactamente lo mismo**.

## 🔴 Sexta diferencia, y llegó a ser una regresión REAL

`invoiceDetailView` llevaba `id="anul-t"` en el título, y el modal lo referencia con
`aria-labelledby`. **Mi migración lo perdió en `jobDetailView` y `settingsView`**: la referencia
quedó apuntando a nada y esos dos modales se quedaron **sin nombre accesible**, en silencio. Es
exactamente la regresión muda contra la que avisaba el ticket, y **la cazó medir, no leer el diff**.

Constructor: `idTitulo`. Y un test que exige que **todo `aria-labelledby` apunte a un id declarado**
— derivado, no una lista.

## Un intento fallido, descartado a tiempo

Mi transformación automática **rompió `expensesView` e `invoiceDetailView`**: buscaba el fin de la
plantilla con el primer acento grave, y esos literales llevan **acentos graves anidados dentro de
`${…}`**. Se restauraron del backup y se hicieron a mano. **Ningún fichero quedó roto**, y las otras
14 se verificaron con `node --check` una a una.

## Los rojos — cinco, por `$?`

| | inyectado | resultado |
|---|---|---|
| ① | cabecera a mano en un fichero | cae **nombrando** `plansView.js (1 en marcado, 0 en DOM)` |
| ② | una que **sí** pasa por el constructor | no cae |
| ③ | algo que **no** es cabecera de modal | no cae |
| ④ | el título deja de ser `<h3>` | cae |
| ⑤ | se pierde el `idTitulo` de un `aria-labelledby` | cae: *«…y NADIE declara ese id»* |

## Lo que cambia de lo que se OYE — declarado, no escondido

**12 cabeceras pasan de `<span>`/`<div>` a `<h3>`** y ahora se anuncian como encabezado. Ninguna
deja de anunciarse. Es AB6 y va dicho con esas palabras.

## Los tres overlays propios: declarados, no unificados

`signaturePad`, `onboardingView`, `tutorial`. Y **los dos mecanismos de ocultación**, vigilados
**donde viven** — que no es donde supuse al escribir el test: **no están en el CSS, están en línea
en el JS**.

| mecanismo | dónde |
|---|---|
| los modales compartidos: la ayuda **oculta** | `display:none !important` en `styles.css` |
| la firma: la ayuda **no oculta, DEBAJO** | `signaturePad.js:36` → `z-index:1200` · FAB en `tutorial.js:196` → `350` |

Quien arregle solo el primero verá desaparecer el síntoma en 24 de 27 sitios y lo dará por resuelto.

## 📌 Reportado, no arreglado (regla 9): `origin/main` está ROJA

Cinco tests fallan **en `origin/main` sin tocar nada**: `scrum356-tres-estados`, `scrum358-drenado`,
`scrum358-encolar-firma`, `scrum360-desalojo`, `scrum455-almacen-local` — todos de la cola offline.
Comprobado haciendo checkout de `origin/main` limpio. **No son de este ticket**, y esta rama no
añade ni uno.

## Lo que NO toca

La ayuda (**SCRUM-416**) · los tres overlays propios · ni una palabra que se vea.
