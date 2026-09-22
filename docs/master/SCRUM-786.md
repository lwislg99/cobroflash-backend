# SCRUM-786 · Los `.btn-sm` miden ~30 px de área de toque contra los 44 de AB6

**Medido contra:** `origin/main` = `f52ff943e5a0ddff5c07aa760dbd8bc07a6acd8d` · 2026-09-17T19:40:45+01:00
**Rama:** `scrum-786` · **Instrumento:** `npm run censo:tactil-panel` (SCRUM-787), de la casa

> 🔴 **AQUÍ NO SE CAMBIA NI UN PÍXEL.** Agrandar un botón se VE, y lo que se ve lo firma el
> fundador. Esto es la medición y la propuesta.

---

## PASO 0 · el defecto EXISTE HOY

El ticket es de hace semanas. Medido **corriendo**, no leyendo:

    .btn-sm  ->  29,7-31,0 px de área de toque, en 17 pantallas
    la regla, hoy:  .btn-sm, .btn.btn-sm { padding: 5px 12px; font-size: 12.5px; min-height: 30px; }

Persiste. No se ha gastado la tanda en un defecto arreglado.

---

## 🔴 HALLAZGO QUE NO BUSCABA: el medidor de la casa está +1 px OPTIMISTA

Antes de creerme una cifra, calibré el árbitro (`scripts/_medidor-de-toque.mjs`) con casos
fabricados de respuesta conocida. **Nadie le había preguntado nunca cuánto dice de 44 exactos.**

    mínimo táctil que declara la casa: 44 px

    caso fabricado   caja   tocable   veredicto
      h20    (=20)   20     21        🔴 MIDE 21
      h43    (=43)   43     44        🔴 MIDE 44
      h44    (=44)   44     45        🔴 MIDE 45
      h45    (=45)   45     46        🔴 MIDE 46
      h100   (=100)  100    101       🔴 MIDE 101
      suma   (=44)   44     45        🔴 MIDE 45

**Constante +1 a cualquier tamaño** — es un off-by-one del barrido de filas, no un error de
escala. `caja` (el `getBoundingClientRect`) acierta los seis; `tocable` no.

**Y el árbitro que decide el cumplimiento es `tocable >= 44`.** O sea que **hoy se aprueba como
conforme un objetivo de 43 px reales.** El portón de AB6 está un píxel flojo.

> ⛔ **NO lo arreglo.** Es instrumento de otro carril (SCRUM-542 / 782 / 791 / 795) y un hallazgo
> de otro carril se REPORTA (regla 9). Va como ticket aparte si lo decides.

### Y esto contesta la pregunta de las dos vías

El encargo pedía: *si dos vías de cálculo discrepan, no promedies — di cuál tenía el suelo firme.*

| vía | decía |
|---|---|
| CSS estático (`min-height: 30px`) | **30,0** |
| navegador (`tocable`) | **30,5-31,0** |

Discrepaban por ~0,8. **La calibración decide, y no mi preferencia:** `tocable` lleva +1 constante,
así que el navegador corregido da **29,5-30,0** y coincide con el CSS. **El suelo firme es `caja` /
el CSS**; `tocable` era la vía desplazada. Sin calibrar, habría tenido que elegir a ojo.

**Las cifras de abajo van tal y como las publica el censo (`tocable`).** No las corrijo a mano: la
corrección es -1 px y afecta a todas por igual, sin cambiar quién está por debajo de 44 — ningún
`.btn-sm` está cerca del umbral, todos rondan los 30.

---

## ① LA POBLACIÓN · las dos cifras, y la que falta

| | |
|---|---|
| vistas que publica el banco | **27** |
| **montadas y medidas** | **17** |
| **NO medidas** (declaradas, no contadas como cero) | **10** |
| elementos DISTINTOS por debajo de 44 px | **84** |
| **de ellos con `.btn-sm`** | **63 · 75,0 %** |
| de ellos SIN `.btn-sm` | 21 |
| mediciones (pantalla × anchura × elemento) | 182 |
| ocurrencias de `btn-sm` en el FUENTE de `public/` | **172, en 28 ficheros** |

**El enunciado decía «13 en una sola pantalla». El árbol da 63** — y es un **suelo, no un total**:
las 10 vistas sin medir (`renderJobsView`, `renderQuoteDetailView`, `renderPartesOficinaView`,
`renderTeamView`, `renderAlbaranesView`, `renderInvoiceDetailView`, `renderLibroRegistroView`,
`renderParteDetailView`, `renderPlansView`, `renderQuoteRequestsView`) no aportan cero: aportan
«no se ha podido montar con estos datos». Con 172 ocurrencias en el fuente, el número final será
mayor.

**Los 63 son elementos renderizados; las 172 son ocurrencias en el código.** Son dos preguntas
distintas y no se suman: una cadena puede pintar N elementos, y hay elementos que ningún banco
monta.

---

## ② CLASIFICADOS POR CONSECUENCIA, no por tamaño

### A · IRREVERSIBLE — lo hecho no se deshace (regla 29)

| | px | dónde |
|---|---|---|
| **«Borrar»** (`btn.btn-danger.btn-sm`) | 30,8 | 1 elemento, 1 pantalla |
| **«Emitir»** (`btn-primary.btn-sm`) | 30,5-30,8 | emite documento fiscal: no se edita ni se borra |

### B · 🔴 JUNTO A OTRO BOTÓN — cuentan doble

Aquí el fallo de pulsación **no es no acertar: es acertar en el equivocado.**

| grupo | px | nº | por qué duele |
|---|---|---|---|
| **«Bizum / tarjeta / transferencia»** (`btn-sm.btn-ghost`) | 30,5-30,9 | **15** | tres vías de cobro **adyacentes**; la equivocada manda al cliente a pagar por otro medio |
| **«Editar / Portal / 📊 Historial»** (fila de Clientes) | 30,8-31,0 | 11 cortos en esa pantalla, repetidos por fila | «Portal» abre la vista del cliente, «Editar» la modifica |
| **«📋 Usar plantilla / 💾 Guardar como plantilla»** | 30,7-36,7 | 4 | adyacentes y **opuestas**: una lee, la otra escribe |
| **«Todos / Historial / Empresa»** | 30,5-30,9 | 4 | pestañas de filtro pegadas |

### C · RECUPERABLE de un toque

«⋯» overflow (1), navegación «← Volver» / «Ver →» (12), «Descargar PDF» / «⬇ CSV», «Copiar link»,
«+ Nuevo presupuesto». Un toque errado se deshace con otro toque.

### Y un arreglo previo que NO alcanza a todas sus instancias

`styles.css:1553` acota la excepción: `.quote-line__actions .overflow-trigger { min-height: 44px }`.
El censo mide un `BUTTON.overflow-trigger.btn-ghost.btn-sm` a **30,5 px** — hay instancias de
`.overflow-trigger` **fuera** de `.quote-line__actions` que el arreglo no toca. Lo reporto, no lo
arreglo.

---

## ③ LA PROPUESTA, CON SU COSTE REAL

### El coste, medido

| | |
|---|---|
| reglas CSS que mencionan `btn-sm` | **25** en `styles.css` |
| ficheros de `public/` que lo usan | **28** (172 ocurrencias) |
| pantallas que se mueven | **17 medidas** + las 10 sin medir |
| cuánto crece cada botón | de ~30 a 44 px → **+14 px de alto** |

**Qué se desplaza.** Un botón más grande empuja a su vecino:

* en las **filas de Clientes** hay tres botones por fila: la fila crece 14 px y caben menos filas
  por pantalla sin scroll;
* en las **barras de acciones** (albarán, presupuesto) los botones **envuelven antes a 390 px**;
* las **pestañas de filtro** («Todos / Historial / Empresa») pasan de una línea a dos en móvil.

### 🔴 La trampa de especificidad, que ya está medida en el árbol

`styles.css:1844-1853` usa `:not(.btn-sm)` **a propósito**, y su comentario lo explica medido: sin
él, un `btn-primary btn-sm` saltaría a 44 y su gemelo `btn btn-primary btn-sm` se quedaría en 30,
porque `.btn.btn-sm` es (0,2,0) y gana a `.btn-sm` (0,1,0). **Cualquier subida tiene que hacerse en
la MISMA regla doble de la l.493-494** (`.btn-sm, .btn.btn-sm`), o salen gemelos descuadrados.

### Tres opciones, y no elijo yo

**① Subir la clase entera** — `.btn-sm, .btn.btn-sm { min-height: 44px; }`
*Una línea. Cumple los 63 de golpe.* Mueve las 17 pantallas medidas y las 10 que faltan. Es el
cambio visual más grande del día.

**② Área de toque sin cambio visual** — un pseudo-elemento absoluto que extienda el área sin mover
la caja. *No mueve nada.* ⛔ Pero **15 de los 63 son tríos adyacentes**: las áreas se **solaparían**,
y un área que se solapa es peor que una corta — es exactamente el «acertar en el equivocado» del
grupo B. Y añade pseudo-elementos que `guard:arbitro-de-toque` (SCRUM-562) vigila.

**③ Sólo A y B, en reglas acotadas** — los ~20 de consecuencia irreversible o adyacente, con
selectores por contenedor, como ya se hizo con `.quote-propuesta-*` (l.1443) y
`.quote-line__actions .overflow-trigger` (l.1553).
*Coste acotado, y ataca donde el fallo cuesta.* ⛔ Deja 43 botones cortos y la clase sin arreglar:
el número no baja a cero y hay que decirlo.

**Mi recomendación: ③**, y el orden A → B. Pero el cambio se ve, así que decides tú.

---

## CONTROLES

| | resultado |
|---|---|
| 🔴 **POSITIVO** · un botón que YA cumple no sale en la lista | ✅ ni `.btn-lg` (44) ni los `.quote-propuesta-*` (44) aparecen entre los cortos |
| 🔴 **EL QUE DECIDE** · el medidor da 44 para 44 exactos | ❌ **NO** — da 45. Constante +1. Es el hallazgo de arriba |
| **SUELO** · sin `.btn-sm` encontrados, CIEGO | ✅ el censo declara sus 10 vistas no medidas en vez de contarlas como cero |

El control que decide **falló**, y por eso el informe empieza por él: si no lo hubiera corrido,
habría publicado «30,8 px» como medida buena y las dos vías discrepando sin saber cuál creer.

---

## Lo que NO se ha hecho

⛔ **Ni un cambio visual.** Ninguna regla CSS tocada.
⛔ **Ningún texto** (regla 30). **Ninguna dependencia** (36). Vanilla, sin bundler, sin estilos en
línea (regla 4).
⛔ **El off-by-one del medidor NO se arregla aquí**: es de otro carril y se reporta.
⛔ **La calibración no queda como guard nuevo**: añadir un guard de navegador subiría el trinquete
de `scrum522-guards-fuera-de-la-tanda`, y ese trinquete no es mío. Su salida literal está arriba.
