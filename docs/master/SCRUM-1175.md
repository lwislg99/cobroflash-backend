# SCRUM-1175 · Parte de trabajo sin IA (916a) — PR-A: horas y desplazamiento

**Medido contra:** `origin/main` = `63e33e92c5c7f1f535513e7a52b7126707a34247` · 2026-09-27T16:51:50Z
**Rama:** `scrum-1175-parte-horas-selector`.
**Sesión:** S2 (front). **Skill UI:** cargada (`yaqu-premium-ui`). Pantalla: `parteDetailView.js` + `styles.css`.
**Origen:** la parte de SCRUM-916 que NO depende de la IA. SCRUM-916 sigue ABIERTO: el dictado y la IA
que ordena las líneas están simulados y medir cuánto aciertan con voz real va antes (necesita
`GEMINI_API_KEY`, decisión de coste del fundador). Plan: PR-A horas (éste) → PR-B firmas → PR-C datos plegados.

## Textos

Firmados por delegación en SCRUM-916, comentario 17251 (corregido en 17255):
«Horas y desplazamiento», «Ahora», «Tiempo en la obra» con «3 h 30 min», «Revisa las horas»,
«La salida es antes que la entrada», «km». Los de siempre («Entrada», «Salida», «Desplazamiento»,
«Kilómetros») no cambian.

- **«La hora se elige, no se escribe.»** firmada CON CONDICIÓN: se pinta sólo cuando **los dos** campos
  son un selector de verdad. Con uno de texto libre la hora sí se escribe, y la frase sería falsa ahí.
- ⛔ **«horas» junto a Desplazamiento NO se pinta.** `desplazamientos` es `Int` y el `PATCH` responde
  «Los desplazamientos son un número entero»: es un recuento, no una duración. El prototipo lo trataba
  como horas con `step 0.25`, que el servidor rechazaría con un 400. Retirado en el com. 17255.
- ⛔ **«Sin las dos firmas el parte no se cierra.»** (PR-B) tampoco se pinta: con UNA firma cualquiera el
  parte pasa a `firmado` (`partes.routes.ts:675` y `:754`). `firmasCompletas()` existe
  (`parteTrabajo.ts:429`) y se sirve (`:161`), pero nada la consume. Decide el fundador (com. 17253).

## 🔴 Riesgo medido: pérdida silenciosa de datos

`entrada` y `salida` son `String?` de texto libre. Un `<input type="time">` con `value="8h"` sale
VACÍO, y el siguiente `change` guardaría el vacío encima del dato del profesional. Regla construida:
**si el valor guardado no es HH:MM estricto (`00:00`–`23:59`), el campo se queda de TEXTO con su valor y
sin «Ahora»**. La regla va campo a campo. Sin tocar el esquema.

## El cambio

- Entrada, salida, desplazamiento y kilómetros pasan a su paso «Horas y desplazamiento», debajo de
  obra/REF/técnicos. **Los siete campos siguen siendo campos**, con el mismo `data-parte-campo` y el
  mismo `PATCH`: ni uno retirado.
- Selector `type="time"` + «Ahora» (44 px), que guarda por el MISMO camino que el `change` a mano.
- Duración recalculada al elegir la hora. Salida anterior → aviso, sólo mientras el parte se puede
  editar. Salida igual a la entrada, o alguna hora de texto: no se pinta nada (no se adivina).
- Una visita que cruza la medianoche (22:00 → 02:00, una urgencia de noche: caso NORMAL en un oficio)
  da el aviso. **Molesta, pero no miente**, y por eso se deja así: «La salida es antes que la
  entrada» es literalmente cierto (02:00 es anterior a 22:00 en el reloj) y «Revisa las horas» es una
  petición, no un veredicto; no bloquea nada. Un «Las horas están mal» sí habría sido falso en ese caso.
  No se arregla: distinguir «se equivocó al teclear» de «cruzó la medianoche» necesita una FECHA en la
  salida, y hoy sólo hay una hora de texto. Sería cambio de esquema.
- Parte firmado: sin selector, sin «Ahora», sin guía y sin aviso; la duración sí (es un dato cierto).

## Tests — `tests/scrum1175-horas-del-parte.test.mjs` (8)

- **Contra main: 0/8** (rojo antes).
- **Mutación:** `cabeEnSelector` devolviendo siempre `true` (el selector se pinta sobre «8h») →
  cae **sólo** el test de la pérdida silenciosa (7 pasan, 1 falla). El guard ve el defecto que dice ver.
- Con el cambio, junto con los 14 ficheros que leen `parteDetailView` (818, 652c, 666b, 720, 890…):
  **136/136**. Ampliado a todo fichero que lee `parteDetailView` o `styles.css`, más el ancla (267) y
  el registro (854): **74 ficheros · 714/714 · 0 saltados**. La tanda completa NO se ha corrido en
  local (la máquina es compartida y el turno se pide para eso); la corre el check obligatorio del PR.

## Capturas (390 px, producto real en Edge, `docs/master/evidencias/scrum1175/`)

`selector-390-antes` (main) · `selector-390-despues` · `textolibre-390-despues` («8h» se queda de texto,
sin «Ahora» y sin la guía) · `aviso-390-despues`.

**PR-A mergeado:** #1845. El primer intento del check obligatorio dio rojo por MIS tests (tres negaciones
sin positivo hermano, SCRUM-237; dos regex con el `>` pegado, SCRUM-553; SCRUM-976 caía por el 237). Se
arreglaron los tests, no los guards.

---

# PR-B · Las firmas en su paso

Medido sobre `origin/main` = `f0eac753c14885d78b754fdd578579e2b80223e2` (27-sep-2026 17:16Z), con PR-A ya dentro.
**Rama:** `scrum-1175-parte-firmas-en-su-paso`.

## El cambio

- Las dos firmas pasan a un paso con título, **«Firmas»** (firmado, com. 17251), y **una caja por firma**.
  Cada aviso «Falta la firma del … para cerrar el parte.» vive DENTRO de la caja de su firma: así el botón
  «Firmar aquí mismo», que no dice de quién es, queda al lado del texto que sí lo dice.
- Mismos botones, mismos atributos (`data-parte-firmar`, `data-parte-firmar-tecnico`) y mismo camino de
  firma. **La cola sin conexión (SCRUM-890/919) no se toca**, y un test lo fija: `firmarConRedDeSeguridad`,
  los tipos de cola `parte` / `parte-tecnico` y sus dos rutas.

## Lo que NO se pinta, y por qué

- **«Sin las dos firmas el parte no se cierra.»** Con UNA firma cualquiera el parte ya es `firmado`
  (`partes.routes.ts:675` y `:754`). `firmasCompletas()` existe (`parteTrabajo.ts:429`) y se sirve, pero
  nada la consume. Decide el fundador (com. 17253): o se cablea la regla (ticket de servidor) o no existe.
  El test lo fija en los tres estados (sin firmas, sólo cliente, sólo técnico), con su respaldo: el token es
  el de `docs/prototipos/SCRUM-916/textos-propuestos.md`.
- **«N firma(s) guardada(s) en este móvil».** El prototipo la ponía en la franja de sin cobertura (fuera de
  esta pantalla y dentro del camino sin conexión, que no se toca), y el panel YA tiene un contador aprobado
  para el mismo dato («Te quedan N firmas por subir», `estadoFirma.js:250`). Dos textos para un mismo dato
  divergen. Retirada por el orquestador (SCRUM-916).

## Tests — `tests/scrum1175b-firmas-en-su-paso.test.mjs` (4)

- **Contra main: 2 fallan** (el paso y las cajas) **y 2 pasan** (las dos protecciones, que tienen que
  pasar en los dos lados: la frase no pintada y el camino sin conexión intacto).
- Vecinos (todo lo que lee `parteDetailView` o `styles.css`, más 653, 919, 358, 362, 267, 854): 80 ficheros,
  **786 · 785 pass**; el único rojo era el registro de este apéndice (SCRUM-854), que es esto. Con 237 y 553
  en verde antes de empujar.

## Capturas (390 px)

`scrum1175b-firmas-390-despues` (las dos cajas, con su aviso cada una) · `scrum1175b-unafirma-390-despues`
(parte firmado sólo por el cliente: su caja dice quién firmó y la del técnico sigue ofreciendo su firma).

# PR-C · Los datos del parte, plegados al final (+ SCRUM-1189, el tipo que no se guardaba)

**Medido contra:** `origin/main` = `494c0a7165d4b3e39e9b4b39d50616e32616a710` · 2026-09-27T17:50:45Z

## El cambio

- Obra y REF, tipo de intervención, técnicos y notas salen de la primera pantalla y van al final, **después de
  las firmas**, en una sección «Datos del parte» con una línea por dato (`<details>` nativo) que enseña su
  resumen y se abre al tocarla. Línea y fichas del tipo a **48 px**.
- El tipo, en fichas: la etiqueta entera es el objetivo; el radio sigue dentro (teclado y lector de pantalla).
- 🔴 **SCRUM-1189 dentro de este PR** (decisión del orquestador: mismo fichero y mismo control). Los radios
  `name="parte-tipo"` se pintaban editables en `pintarTipo` y el único cable (`[data-parte-campo]`) no los
  veía: marcar el tipo no se guardaba nunca. Ahora el `change` manda `PATCH { tipo }` por el mismo
  `guardarCampo` (`partes.routes.ts:504` ya lo aceptaba; **no hace falta servidor**). Lo que NO entra: que
  el ALTA mande `tipo` (no tiene selector y no se inventa), así que `cuerpo · POST /admin/partes::tipo`
  sigue declarada en el trinquete de 1185.

## Inventario de campos (condición de la firma: sin retirar ninguno)

Medido montando `renderParte` en el banco con el mismo parte, antes (`origin/main` 0a10475c) y después:

| | antes | después |
|---|---|---|
| casillas `data-parte-campo` (editable) | obra, referencia, tecnicos, entrada, salida, desplazamientos, kilometros, notas | las mismas 8 (cambia el orden) |
| datos `data-parte-dato` (firmado) | las mismas 8 | las mismas 8 |
| radios del tipo | 3 (deshabilitados en firmado) | 3 (deshabilitados en firmado) |

## Textos: comprobados contra el código ANTES de pintarlos

De los diez firmados en SCRUM-916 c.17251, **cuatro no se cumplen y NO se pintan**:

- «La del trabajo, si no pones otra» y «Los del trabajo»: con la obra vacía nada usa la dirección del trabajo:
  ni al crear el parte (`partes.routes.ts:425-437`) ni en lo que se sella y firma el cliente
  (`obra: parte.obra ?? null`, :214).
- «Solo tú» y «Quién más ha estado en la obra»: Técnicos se prellena con TODOS los asignados del trabajo, quien
  lo rellena incluido (`partes.routes.ts:389-411`, SCRUM-818); vacío es «sin trabajo o sin asignados», y
  «tú» sería el jefe si lo abre desde la oficina.

Los sustituyen cuatro firmados por el orquestador (delegación del fundador) el 27-sep-2026 por mensaje:
«Dónde se ha hecho el trabajo» · «Sin dirección ni referencia» · «Sin técnicos» · «Quién ha estado en la obra».
Se pintan los otros seis: «Datos del parte», «Obra y referencia», «Tu referencia interna, si usas alguna»,
«Sin elegir» (`tipo` es nullable, :381), «Sin notas», «Lo que haya que dejar dicho.».

## Tests — `tests/scrum1175c-datos-del-parte-plegados.test.mjs` (7)

Contra la vista sin el cambio **5 fallan** (plegado tras las firmas, resúmenes, marcadores y ausencia de los
cuatro falsos, fichas de 48 px, y el viaje del tipo); el inventario y el control del firmado pasan en los dos,
que es lo que tienen que hacer. Con el cambio, 7/7. El de 1189 recorre el viaje entero: marcar → `PATCH`
→ **recargar otra vista** desde lo que quedó en el servidor → sale marcado.
Vecinos: los 18 ficheros que cargan `parteDetailView` **140/140**; censos de todo el panel (clases, hojas,
scripts, 1185) 94/94; censos de microcopy y objetivos táctiles 851/857 con 5 saltados y 1 fallo, `scrum910d`,
uno de los tres que caen bajo carga: solo, 5/5.

## Capturas (390 px, vista y hoja reales en Edge)

`scrum1175c-datos-cerrado-390.png` · `scrum1175c-datos-abierto-390.png` · `scrum1175c-datos-vacio-390.png`.