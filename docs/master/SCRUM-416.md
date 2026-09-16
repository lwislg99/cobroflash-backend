# SCRUM-416 · PASO 0: paro en (a), y la medición de (b) encuentra un TERCER estado

**Medido contra:** `origin/main` = `0a40bfbf32067ecd6c7d630f92b35c5fd574cedd` · 2026-08-11T13:56:25+02:00
**Rama:** `scrum-446-cabecera-modal` (no se abre rama propia: no hay nada que construir todavía)

## (a) 🔴 PARO: el constructor NO está en main

```
git ls-tree origin/main public/dashboard/js/modalHeader.js   → vacío
git merge-base --is-ancestor 13b855a7… origin/main           → NO mergeada
```

**`scrum-446-cabecera-modal` sigue sin mergear**, y en `main` **cero** cabeceras pasan por el
constructor. Meter el «?» ahí sería construir sobre aire, que es lo que el encargo mandaba evitar.
En cuanto entre, el trabajo es el pequeño que describe el ticket: **un sitio, no 27**.

## (b) El «?» YA EXISTE — buscado por mecanismo, no por nombre

No es un botón que haya que inventar. Es un **FAB global**:

| | |
|---|---|
| quién lo crea | `tutorial.js` → `ensureHelpButton()` |
| qué es | `<button id="tut-help-btn">` con `textContent = '?'` y `title = 'Guía de inicio'` |
| dónde | `position:fixed; bottom:20px; right:20px; **z-index:350**` |
| qué abre | `openHelpGuide()` → panel lateral `#tut-guide-backdrop` a `z-index:360` |

**Y esconderlo fue una decisión, no un descuido.** El propio CSS lo dice:

```css
/* ── Feedback fundador 6-jul: el botón flotante "?" no debe pisar las modales ── */
.modal-overlay { z-index: 500; }
body:has(.modal-overlay) #tut-help-btn { display: none !important; }
```

Eso **reencuadra el ticket**: no se trata de destapar el FAB —esa decisión sigue en pie— sino de que
la ayuda **viva dentro** del modal. Que es justo lo que el constructor permite.

## 🔴 Y no son DOS mecanismos: son TRES estados

Medido el `z-index` de cada overlay propio, uno a uno:

| pantalla | overlay | z-index | qué le pasa al «?» (350) |
|---|---|---|---|
| los **24** modales compartidos | `.modal-overlay` | 500 | **oculto** por `display:none !important` |
| **firma** (`signaturePad.js:49`) | propio | **1200** | **DEBAJO** — visible pero inalcanzable |
| **onboarding** (`onboardingView.js:75`) | propio | **300** | **ENCIMA** — el FAB se ve y funciona, **pisando el onboarding** |

Los tres montan overlay propio (`modal-overlay: 0` en los tres, comprobado), así que **la regla CSS
no les aplica a ninguno**. Lo que cambia el resultado es solo el número:

- **1200 > 350** → la firma tapa el «?». Es la pantalla donde firma el cliente.
- **300 < 350** → el onboarding **no** lo tapa, y ahí el «?» está haciendo exactamente lo que el
  feedback del 6-jul quería evitar: **pisar** una pantalla modal.

**El tercer estado no estaba contado**, y es el único donde el defecto va en la dirección contraria.

## Lo que esto significa para la entrega

Cuando el constructor esté en main, el «?» dentro de la cabecera resuelve **los 24**. Y entonces:

- **la firma seguirá igual** — su overlay no lleva cabecera de modal, así que el «?» del constructor
  no le llega. **Se entregará declarándolo**, no como «resuelto»;
- **el onboarding también seguirá igual**, y con su propio matiz: ahí no falta ayuda, **sobra FAB**.

## Lo que NO se ha hecho

Ni una línea de construcción · ni un «?» nuevo · ni microcopy (si el «?» necesita texto, se propone;
hoy el FAB usa `title="Guía de inicio"`, que ya existe) · no se ha tocado el CSS ni el z-index de
nadie.


---

# SCRUM-416 · entrega: la ayuda vive DENTRO — y DOS pantallas siguen sin ella

**Medido contra:** `origin/main` = `5122bfc097e9cdbfd46fcc8915a504981a2542c6` · 2026-08-11T14:29:32+02:00
**Rama:** `scrum-416-ayuda-dentro`

## (a) desbloqueado, comprobado

`13b855a7` **y** `67dd208d` están los dos en `origin/main`, y `modalHeader.js` también. El arreglo
del ancla entró.

Y **`main` está VERDE: 3040 tests, 0 fail.** Mi reporte de ayer era falso: los 5 rojos eran
`fake-indexeddb`, que main estrenó con SCRUM-455 y mi `node_modules` no tenía. **Un `npm ci` los
arregló todos.** Lo que medí era mi entorno, no el repo — y lo di como hallazgo de main.

## Lo entregado: el «?» en la cabecera, y NO destapa el FAB

El botón entra **una vez**, en `cabeceraModal`, y llega a los **24** modales. La decisión del 6-jul
—que el FAB no pise las modales— **sigue intacta**: no se ha tocado ni el CSS que lo oculta ni el
z-index del FAB.

Abre **`window.openHelpGuide`**, que es **la misma guía** del FAB. Dos guías se separarían el día
que alguien mejore una, y nadie lo notaría.

### 🔴 Dos cosas que lo habrían dejado inútil, encontradas midiendo

1. **`openHelpGuide` no era global.** Un botón que no puede llamar a nada.
2. **El panel de ayuda vivía en z-index 360 y los modales van a 500.** Se habría abierto **detrás
   de la modal desde la que acabas de pedir ayuda**: un «?» que no enseña nada es peor que no
   tenerlo, porque además parece que el producto está roto. **Subido a 600** — la ayuda va encima de
   lo que explica. Sigue por debajo de la firma (1200), que es uno de los casos declarados.

## 🔴 LO QUE NO ESTÁ RESUELTO, por su nombre

| pantalla | estado | por qué |
|---|---|---|
| **24 modales compartidos** | **resuelto** | el «?» va en la cabecera |
| **la firma** (`signaturePad.js`) | **SIGUE IGUAL** | su overlay es propio (z-index 1200), **no lleva cabecera de modal**, así que el constructor no le llega. Es **la pantalla donde firma el cliente** |
| **el onboarding** (`onboardingView.js`) | **SIGUE IGUAL** | overlay propio a 300, **por debajo** del FAB (350): ahí **no falta ayuda, sobra FAB** — el defecto va al revés, y arreglarlo es otra decisión |

**Esto no es «resuelto».** Es 24 de 27, y los otros dos tienen test propio que se pone rojo el día
que cambien —en cualquier dirección— para que nadie lo descubra en la pantalla de la firma.

## Microcopy (regla 30)

**No se ha inventado texto.** El botón usa `title` y `aria-label` = **`Guía de inicio`**, que es
**el literal que el FAB ya usa** desde que existe. Se reutiliza, igual que se hizo con
`aria-label="Cerrar"` en SCRUM-446. **Si quieres otro, es una línea.**

## Verificado en rojo — cuatro, por `$?`

quitar el «?» de la cabecera · devolver el panel a 360 (*«el panel de ayuda (360) NO está por encima
del modal (500)»*) · dejar de exponer `openHelpGuide` · y que la firma pase a usar la cabecera
compartida — que **también** cae, porque entonces hay que **actualizar la declaración** en vez de
dejarla mintiendo.

## Y un defecto mío, en el test que vigila ese defecto

La primera versión del test del z-index usaba una **ventana fija de 400 caracteres**, y **el
comentario que yo acababa de escribir empujó el número fuera**. Es exactamente SCRUM-435, cometido
dentro del guard que lo persigue. Corregido: se lee el código **sin comentarios** y se ancla en la
asignación, no en una distancia.

Ficheros: `public/dashboard/js/modalHeader.js` · `public/dashboard/js/tutorial.js` ·
`public/dashboard/css/styles.css` · `tests/scrum416-ayuda-dentro.test.mjs` (nuevo).
