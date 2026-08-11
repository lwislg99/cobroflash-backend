# SCRUM-416 · PASO 0: paro en (a), y la medición de (b) encuentra un TERCER estado

**Medido contra:** `origin/main` = `0a40bfbf32067ecd6c7d630f92b35c5fd574cedd` · `2026-08-11T13:56:25+02:00`
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
