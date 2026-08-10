# SCRUM-212 · ¿SCRUM-292 lo absorbe? Contraste punto por punto + medición por contenido

**Fecha:** 5-ago-2026 · **Carril:** B (medición) · **Gate:** sin gate — **solo lee**

**Medido contra:** `origin/main` = `f1a8ca507d6df9d530976c3a00289e051014fb0a` · 2026-08-05T00:51:56+01:00

> SCRUM-292 (A1) declara **en su propio título** que absorbe a SCRUM-212. Esto lo confirma o lo
> desmiente. Los dos alcances se han leído enteros y **sin adaptar la redacción de ninguno** para
> que encajen. No se ha tocado nada: ni emisor, ni `prisma/schema.prisma`, ni Jira.

---

# VEREDICTO: (c) NO LO ABSORBE

**El título de SCRUM-292 afirma algo que su alcance no cumple.** No es que le falten flecos: 292
absorbe el **titular** de 212 —el defecto y su síntoma— y **ninguno** de sus entregables. Y lo
absorbe con la premisa que el propio 212 ya había corregido por escrito.

Las tres frases que lo deciden, cada una comprobable arriba y abajo:

1. **292 promete construir lo que 212 prohíbe construir todavía.** El DoD de 212 es
   *medición · propuesta de las tres vías con recomendación · lista de lo que necesita dictamen*,
   con **Gate: «implementación bloqueada por criterio fiscal»** y la instrucción literal **«No
   implementar antes de esa medición»**. 292 no tiene sección de medición ni gate fiscal: tiene
   una sección titulada **«Lo que se construye»**.
2. **292 repite el error de enunciado que 212 ya corrigió.** 292 dice «la derivación S2/N1/N2
   **para exentas** y no sujetas». **S2 no es exenta** (medición de 212 del 29-jul, verificada
   contra el XSD): S1 y S2 son **ambas sujetas y no exentas** y se diferencian por la inversión
   del sujeto pasivo; la exención vive en `OperacionExenta` con causa **E1..E6**, en un `<choice>`
   excluyente. **Construir literalmente lo que 292 escribe —mapear una exenta a S2— es declarar
   en falso**, que es exactamente lo que SCRUM-209 se negó a hacer. La corrección **no aparece en
   292** por ninguna parte: cero menciones de `OperacionExenta` y de `E1..E6`.
3. **Cerrar 212 dejaría las 11 preguntas de dictamen fuera del repo.** Medido: viven **solo** en
   un comentario de Jira. `docs/legal/PREGUNTAS_ASESOR.md` tiene cinco secciones (A…E) y **ninguna**
   trata exentas, no sujetas ni inversión del sujeto pasivo. 292 solo enruta dudas **nuevas** a ese
   fichero — no reconoce que ya hay once esperando, y son justo las que decidirían si su alcance
   existe en el vertical de oficios.

**Lo que sí corresponde, dicho para no exagerar el veredicto:** 292 recoge el **defecto** de 212 y
su **consecuencia** (la exportación bloqueada sin salida), y su «Rojo por el mecanismo» apunta al
mismo sitio. Eso es un **resultado en común, no un alcance absorbido**.

---

## Contraste punto por punto — el ENUNCIADO de 212

Cada punto, literal del ticket. Correspondencia **literal** en 292 o ausencia. Sin punto medio.

| # | Punto de SCRUM-212 (literal) | ¿En SCRUM-292? |
| --- | --- | --- |
| 1 | «no existe ninguna lógica que derive `S2` (exenta), `N1` ni `N2` (no sujeta) a partir de la línea» | ✅ **SÍ, literal** — «La **derivación S2/N1/N2** para exentas y no sujetas» (con el error de premisa; ver #11) |
| 2 | «se le para la exportación y **no tiene camino alternativo dentro del producto**» | ✅ **SÍ, literal** — «…que es lo que hoy **bloquea la exportación sin salida**» + «Rojo por el mecanismo» |
| 3 | «Un bloqueo sin salida es peor que un aviso: por el criterio del semáforo esto sería **ROJO**, y un rojo solo es legítimo cuando lo que se impide es lo irreversible. Aquí lo que se impide es **una operación válida**» | ❌ **NO** — 292 no menciona el semáforo ni el criterio rojo/ámbar |
| 4 | «**Siguiente acción concreta: medir primero** qué modela hoy el producto… **No implementar antes de esa medición**» | ❌ **NO** — 292 no tiene punto de medición. (La medición **ya existe**, dentro de 212: comentario del 29-jul. 292 no la referencia ni la hereda) |
| 5 | «el criterio de qué es exento y qué es no sujeto **es fiscal, no técnico**. Lo que decida el código **sale del dictamen**» | ❌ **NO** — 292 solo enruta dudas **nuevas** a `PREGUNTAS_ASESOR.md`; no reconoce un dictamen previo como requisito |
| 6 | DoD (a): **medición de lo que existe** | ❌ **NO** (ya hecha dentro de 212) |
| 7 | DoD (b): **propuesta de las tres vías con recomendación** — automática · la elige el profesional con lenguaje de oficio · pregunta para el asesor | ❌ **NO — y es peor que una ausencia:** 292 **elige una** («proponer y confirmar») y la da por decidida. Es la conclusión **sin** el entregable que la justificaba |
| 8 | DoD (c): **lista de lo que necesita dictamen** | ❌ **NO** (hecha en 212: 11 preguntas; **no están en el repo**) |
| 9 | «**Gate:** implementación bloqueada por criterio fiscal» | ❌ **NO, y no es ausencia sino contradicción** — 292 tiene «Lo que se construye», sin gate fiscal |

## Contraste punto por punto — el alcance que la MEDICIÓN de 212 añadió

La medición del 29-jul no es un adorno del ticket: **cambió su alcance** y así está escrito en él.

| # | Punto medido en 212 | ¿En SCRUM-292? |
| --- | --- | --- |
| 10 | Una sola línea al 0 % **excluye la factura entera** del registro, no el tramo | 🟡 **PARCIAL** — 292 dice «una operación exenta bloquea la exportación»: misma familia, **granularidad distinta** (tramo vs documento) |
| 11 | **S2 NO es «exenta»**; la exención se declara en `OperacionExenta` con causa **E1..E6**, excluyente con `CalificacionOperacion` (`<choice>` obligatorio) | ❌ **NO — 292 arrastra el error**. Cero menciones de `OperacionExenta`/`E1..E6` |
| 12 | Hacen falta **dos ramas de serialización** y **dos datos distintos**: marcador de ISP (S2) y marca **+ causa** (exención) | ❌ **NO** — 292 modela **un** selector de «tipo de factura» |
| 13 | **Granularidad por línea o por factura** es **pregunta abierta de dictamen** (§5.5) — el XSD admite hasta 12 `DetalleDesglose` | ❌ **NO — 292 la responde de facto**: su diseño es un tipo **por documento**. Decide sin dictamen una pregunta que 212 marcó para el asesor |
| 14 | La **agregación por tipo** (`vat.service.ts:28`) **borra cualquier dato nuevo por línea**, y tocarla afecta a **303 + export RRSIF + cuota de la huella** (los tres consumidores declarados) | ❌ **NO, y hay contradicción**: 292 declara «Lo que NO toca: … **el Modelo 303 (A5)**» |
| 15 | Los productores automáticos de `tax: 0` sin dictamen | ❌ **NO** |
| 16 | **Cuatro puertas traseras** de tipo de IVA que no pasan por `invalidTipoIva` | ❌ **NO** |
| 17 | **Ampliar el Semáforo Fiscal** (sus avisos no cubren esta dimensión) | ❌ **NO** |
| 18 | **Unificar convenciones**: `lines[].tax` es fracción y `Albaran.lineas[].tipoIva` es entero | ❌ **NO** |
| 19 | Adoptar el patrón `MODO_SIN_DICTAMEN` (constante de modo + **las dos salidas construidas** + error que excluye y reporta) | 🟡 **PARCIAL** — 292 pide un «Suelo» que falla en vez de caer al defecto: pariente, **no** el patrón de modo |
| 20 | Defecto colateral para `BUGS.md` (borrador de mantenimiento guarda `total` sin aplicar `tax`) | ❌ **NO** |

**Recuento: de 20 puntos, 2 corresponden literalmente, 2 parcialmente y 16 no.**

---

## Medición POR CONTENIDO sobre `main` — qué de 212 ya está, al margen de 292

El estado de un ticket en Jira no es evidencia de qué hay en el árbol. Todo lo de abajo sale de un
derivador sobre el AST de los **166 `.ts` de `src/`**, con suelo (si se queda ciego, `exit 1`;
control positivo: **50 elementos XML** del emisor y el `S1` que sí existe). Se re-ejecutó entero
sobre el `main` del ancla, después de que `main` se moviera dos veces durante la sesión — una de
ellas tocando `invoicesAdmin.routes.ts`, que es uno de los ficheros citados aquí.

### ✅ Lo que SÍ ha cambiado desde que se midió 212 (29-jul)

* **SCRUM-209 YA ESTÁ EN `main`.** Era el bloqueante nº 1 de 212 («sin él no hay
  `CalificacionOperacion` que extender»). Hoy existe y emite: `clasificarDetalleDesglose`
  (`src/modules/fiscal/verifactu/registro.builder.ts:298`) y
  `<sum1:CalificacionOperacion>` (`:344`). **El punto de partida de 212 ya existe** — el
  comentario del 29-jul («en el emisor vivo no se deriva ni siquiera S1») está **caducado**.
* **Uno de los tres productores automáticos de `tax: 0` del censo está RESUELTO.** El emisor ya
  **no** fabrica un tramo al 0 % para una factura sin líneas: **lanza**
  (`src/modules/invoicing/domain/verifactu.service.ts:611-618`), con el motivo escrito.

### ❌ Lo que sigue exactamente igual

* **Cero derivación de S2/N1/N2 y cero exención.** Derivado del AST (que no ve comentarios): el
  código produce **una sola** calificación, `S1`, en **un solo sitio** (`registro.builder.ts:48`).
  **Cero** literales `S2`, `N1`, `N2`, `E1`…`E6` en todo `src/`.
* **La rama de la exención no existe.** De los **50 elementos XML** que el emisor escribe,
  `CalificacionOperacion` **sí** está y **`OperacionExenta` NO**. `DetalleDesglose`
  (`registro.builder.ts:36-45`) no tiene campo para la causa.
* **El bloqueo del 0 % sigue vivo y sigue siendo correcto**: `registro.builder.ts:302-310` lanza
  `DesgloseNoClasificableError`, y `verifactu.service.ts:604` lo propaga → **la factura entera**
  queda fuera del registro.
* **La capa que borra el dato sigue intacta**: `calcVatBreakdown` agrupa por
  `Math.round(taxFrac * 100)` (`src/modules/invoicing/domain/vat.service.ts:28`), y sus tres
  consumidores siguen declarados en la cabecera del fichero (`:5-6`): **303, export XML RRSIF y la
  cuota de la huella**.
* **Las cuatro puertas traseras de tipo siguen abiertas.** `invalidTipoIva` se invoca desde **un
  solo sitio** en todo `src/` (`core/validation/schemas.ts:16`). No pasan por ahí: alta/edición de
  producto (`products.routes.ts:222`, `:244` — solo `Number(vat)`), import CSV
  (`products.service.ts:146-151`), plantillas (`templates.routes.ts:41` — solo comprueba que
  `lines` sea un array no vacío y guarda el resto verbatim) y albarán
  (`albaran.service.ts:85` — solo `0 ≤ tipoIva ≤ 100`, así que un 13 % pasa).
* **Las 11 preguntas de dictamen NO están en el repo.** `docs/legal/PREGUNTAS_ASESOR.md` tiene
  cinco secciones (A: bloqueo de S1-D · B: registros S1-C · C: bundle legal Y3 · D: calendario ·
  E: baja de un profesional) y **ninguna** habla de exentas, no sujetas ni ISP.
* **La trampa del nombre, reconfirmada por contenido.** `tests/scrum212-copy-sin-claim-fiscal.test.mjs`
  existe en `main` y **no es este ticket**: es un guard del copy de la landing del cliente
  (`:1-19`), un hallazgo del censo. Un fichero que lleva el número del ticket no demuestra que el
  ticket esté hecho.

### 🔴 Y algo que el censo de 212 NO recoge porque es posterior: los productores de `tax: 0` han pasado de 3 a 4

Censo derivado (objeto literal con `tax`/`tipoIva` igual a `0`):

| Productor | Fichero:línea | ¿Estaba en el censo de 212? |
| --- | --- | --- |
| Factura desde un `Charge` sin `Quote`: la línea se inventa | `src/lib/invoicing.ts:306` | sí |
| Borrador de mantenimiento sin presupuesto origen | `src/modules/maintenance/domain/maintenance.service.ts:142` | sí |
| **Deducción de un anticipo LEGACY sin líneas** | `src/modules/invoicing/domain/finalInvoice.service.ts:112` | **NO** |
| **Rectificativa de una factura sin líneas** | `src/modules/system/app/routes/invoicesAdmin.routes.ts:720` | **NO** |

Los dos nuevos importan porque **cierran el círculo con el bloqueo**: esa línea al 0 % produce un
tramo `rate = 0` en `calcVatBreakdown`, y ese tramo hace que `clasificarDetalleDesglose` lance y la
**factura entera** quede fuera del registro fiscal. O sea: **el producto fabrica por su cuenta, en
cuatro sitios, exactamente la condición que se autoexcluye del registro.**

⚠️ **Alcance de esta afirmación, dicho con precisión:** está **derivada leyendo los tres ficheros
encadenados**, no ejecutada. Y el de `finalInvoice` **solo** se dispara cuando el anticipo deducido
es *legacy sin líneas* — la ruta normal deduce **por tipo** (`finalInvoice.service.ts:91-98`) y
conserva el tipo. Merece su propio rojo antes de darla por buena.

---

## Consecuencia práctica de las tres opciones

* **Si se cierra 212 como duplicado (a):** se pierden del radar la corrección de premisa (#11), las
  11 preguntas de dictamen —que **no están en el repo**—, la granularidad sin decidir (#13), los
  cuatro productores de `tax: 0`, las cuatro puertas traseras y la contradicción del 303 (#14). Y
  292 quedaría construyendo, sin gate, un mapeo **fiscalmente falso** (exenta → S2).
* **Si se deja como está (c, lo medido):** 212 sigue vivo entero. Lo que hay que corregir es **el
  título de 292**, que promete una absorción que su alcance no ejecuta.

## Lo que esta medición NO cubre

* **No propone alcance nuevo para ninguno de los dos tickets**, ni redacta cómo debería decirlo
  292: eso es del fundador y del dictamen. Aquí solo se contrasta lo escrito con lo escrito.
* **No se ha ejecutado nada**: ni una exportación, ni un test rojo. Las cadenas de causa
  (productor de `tax: 0` → tramo 0 % → factura excluida) están **leídas**, no ejecutadas.
* **No se ha tocado Jira** (ni un comentario, ni un estado) ni `prisma/schema.prisma`.
* **No se ha respondido ninguna de las 11 preguntas de dictamen.** Son fiscales.
* El derivador es de un solo uso, en el scratchpad: **no es un guard de la suite**.

## Ficheros

* `docs/master/SCRUM-212.md` — **este informe. Es el único fichero que toca la rama.**
