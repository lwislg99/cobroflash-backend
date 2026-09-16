# SCRUM-333 · F6, una tarjeta por gremio — y el paso 0 decidió qué NO puede enseñar

**Medido contra:** `origin/main` = `783506ac65a6ea1fac70acdb56373d0f7d47559f` · 2026-08-20T02:19:49+01:00

**20-ago-2026** · **Carril:** landing (F6) · **Gate:** sin gate, corre en `npm test`

**LA VÍCTIMA:** somos un producto de oficios y el competidor, un facturador genérico, dedica una
octava parte a los oficios. Que su octava parte se vea más dirigida que nuestra totalidad es un
fallo de presentación. Un fontanero entraba en la landing y veía «los oficios» en abstracto.

---

## ① EL PASO 0 · lo que dijo D0, y cambia el ticket

El encargo quería enseñar los conceptos reales del gremio —«Punto de agua nuevo», «Desatasco con
máquina», «Cambio de termo 80L», «Llave de paso 1/2"»— como prueba de conocimiento del oficio.
**SCRUM-310 (D0 · P4) ya había medido de dónde salen, y la respuesta es doble.**

**Lo que D0 dice, literal:**

> *«**Cinco de seis salen únicamente de `scripts/seed-video.mjs`**, que su propia cabecera describe
> como “V0-6: cuenta realista para grabar el vídeo comercial (60 s)”. O sea: **las capturas muestran
> el seed del vídeo, no el catálogo ni el demo.** El ticket plantea la disyuntiva como “¿seed-demo o
> catálogo?” y la respuesta es “ninguno de los dos”.»*

Y a la vez:

> *«**Sí hay catálogo**, y es un artefacto de primera: `data/catalogs/{gremio}.json`, con schema
> propio, cargador y un consumidor.»* — 6 gremios, **155 items**, 24 plantillas.

**Las dos ramas del paso 0 se cumplen a la vez, y por eso el ticket no se cae ni se hace entero:**

| | |
|---|---|
| Los CONCEPTOS DE LAS CAPTURAS (3 de los 4 que pedía el encargo) | **Los escribió a mano quien hizo el seed del vídeo → NO se pueden enseñar.** Sólo «Desatasco con máquina» está también en el catálogo |
| El CATÁLOGO por gremio | **Existe de verdad**, versionado y con schema → sería fuente legítima… |
| …pero su ESTADO | 🔴 **los seis declaran `status: "draft_pendiente_validacion"`** |

Y su propio `_nota`, medido en los seis ficheros, lo dice sin ambigüedad:

> *«BORRADOR (A17.2). Precios ORIENTATIVOS de mercado ES 2026, **sin validar: 2-3 fontaneros reales
> deben confirmarlos ANTES del seed a merchants reales** (checklist fundador).»*

**Decisión, y es la del propio dato, no una opinión: hoy las tarjetas describen el gremio y no
enseñan ni un concepto ni un euro.** Un precio que suena a inventado lo nota un fontanero
inmediatamente, y lo que se pierde no es una conversión: es la credibilidad del resto de la página.

**Lo que se construye NO es «tarjetas sin conceptos»: es el mecanismo que los enseñará solo.** El
día que un catálogo pase a `validado`, su tarjeta podrá enseñarlos **sin tocar el HTML a mano** — la
regla vive en un sitio y el test la hace cumplir en las dos direcciones.

## ② QUÉ SE CONSTRUYE

* **`scripts/_gremios-landing.mjs`** — el derivador. Fuente única `data/catalogs/*.json`; orden
  derivado del nombre de fichero, **no una lista a mano** (D0 encontró TRES listas del mismo gremio
  en `scripts/`, ninguna derivada; una cuarta habría sido más de lo mismo). Expone
  `conceptosPublicables` y `preciosPublicables`, y **el suelo de ceguera lanza en vez de devolver
  `[]`**.
* **Dos llaves para el precio, y la asimetría es deliberada:** un nombre validado es conocimiento
  del oficio; **un precio publicado es además una afirmación comercial**, y ésa la aprueba el
  fundador (regla 30) aunque el catálogo ya esté validado. `preciosPublicables` exige las dos.
* **`public/index.html`** — la sección `#gremios`, entre «Cómo funciona» y «Todo en uno», con las
  **seis** tarjetas sobre la rejilla `.prods` **ya existente** (AB3: se reutiliza, no se inventa
  componente).
* **`tests/scrum333-tarjetas-gremio.test.mjs`** — 11 tests, sin gate.

## ③ REGLA 30 · el texto no se publica todavía, y hay mecanismo

El microcopy de las seis tarjetas es una **PROPUESTA**. Mientras la sección lleve
`data-microcopy="PENDIENTE_FUNDADOR"`, va **`hidden`** y no la ve nadie — y **un test lo exige**, en
las dos direcciones: si mañana alguien quita el `hidden` sin aprobar, la suite cae; y si se aprueba,
el marcador no puede quedarse a medias en el cuerpo. Es el patrón de `semaforoFiscal` con
`PENDIENTE_ASESOR`, aplicado aquí.

**Para publicarla: aprobar los seis textos, quitar el atributo Y el `hidden`.**

## ④ LOS TRES HUECOS DECLARADOS, que decide el fundador

1. **«Talleres» no existe.** El encargo pedía una tarjeta de talleres. **No hay catálogo de
   talleres**, y el máster lo tiene como **vertical VETADO en F1-F2** (Parte A3: *«Verticales
   vetados: estética, tatuadores, clínicas, academias, eventos, talleres»*). No se inventa: se
   entregan los **seis gremios que el catálogo tiene** —fontanería, electricidad y reformas, que sí
   pedía el encargo, más climatización, cerrajería y pintura—. Añadir talleres es cambio de máster.
2. **Las seis van al MISMO destino, `/register.html`.** No hay página por gremio. Y ponerle un
   `utm_` propio al enlace **sería peor que no ponerlo**, medido en `public/js/atribucion.js`: su
   regla es *«NO pisa lo que el enlace ya trae»*, así que un `utm_source=landing` escrito en la
   tarjeta **borraría el origen real del visitante** (google, un grupo de gremio, un QR) y el embudo
   diría que todos vinieron de la landing. Hay un test que lo impide. Un destino por gremio es
   ticket propio, con su copy.
3. **La alternancia blanco / verde-suave (AB6).** La sección entra entre dos que ya alternaban: al
   aprobarla, o ésta pasa a `sec-white` y `#todo` a `sec-tint`, o al revés. **No se ha tocado
   `#todo`**: cambiaría la página viva sin causa aprobada.

## ⑤ VERIFICACIÓN

* **SUELO** — sin catálogos, `leerCatalogos` **lanza `CatalogosCiego`**; con el directorio creado
  pero vacío, también. «No hay gremios configurados» y «no supe mirar» son el mismo `[]` y
  consecuencias opuestas.
* **CONTROL NEGATIVO** — catálogo sin validar → **cero conceptos**; sin catálogo (`undefined`,
  `null`) → cero; y **ni con la aprobación del fundador** salen precios de un catálogo sin validar.
* **AUTOPRUEBA en la otra dirección** — con `status: 'validado'` **sí** entrega los conceptos. Sin
  esto, el cero de arriba no probaría el gate: probaría que la función devuelve `[]` siempre.
* **Los literales del seed del vídeo NO llegan a la landing** — los cinco que D0 midió, uno a uno.
* **Sincronía HTML ↔ catálogo** — el conjunto de `data-gremio` publicado es exactamente el del
  catálogo, y el rojo **nombra** el que sobra o el que falta.
* **Enlaces** — cada `href` de tarjeta apunta a un fichero de `public/` que existe o a un ancla
  presente en la página. Ningún 404.
* **Móvil** — ver ⑥.

### 🔴 EL ROJO POR EL MECANISMO, con su SHA

Con la rama **ya commiteada** en `83b383bc` —y el árbol limpio, comprobado antes de inyectar—, se
retiró `data/catalogs/reformas.json` y se corrió el test. Cayó **uno solo, el que toca**, y
**nombrando el gremio**:

```
🔴 LA LANDING ENSEÑA UN GREMIO QUE NO ESTÁ EN data/catalogs/: reformas
   Una tarjeta sin catálogo detrás es una lista escrita a mano, que es justo lo que D0
   encontró por triplicado y lo que este ticket no repite.
```

Restaurado el fichero, verde otra vez. **El guard no mira una lista: mira la fuente.**

### 🔴 Y UN ROJO QUE NO SE BUSCABA: el guard se cazó a sí mismo

En su **primera ejecución**, el test de los literales del seed cayó nombrando «Cambio de termo
80L»… que estaba **en el comentario donde se explica por qué no puede publicarse**. Es la trampa de
autorreferencia que ya mordió cuatro veces en esta casa (SCRUM-176/168/3/193).

**El arreglo no fue quitar el comentario, que es donde vive el motivo:** se separó lo que se mide.
Lo que se AFIRMA se mide sobre el **texto publicado** —reutilizando `textoPublicado` de SCRUM-400,
que ya quita comentarios, `<script>` y `<style>`, en vez de escribir un segundo extractor— y lo que
es ESTRUCTURA (atributos, enlaces) se mide sobre el HTML crudo. Dos superficies, cada assert en la
suya.

## ⑥ CÓMO SE VEN EN MÓVIL — medido en Edge, no supuesto

Seis tarjetas son más de tres, así que se midieron con `puppeteer-core` sobre Edge, forzando la
sección visible en el NAVEGADOR (sin tocar el fichero), a cuatro anchuras:

| ancho | columnas | scroll horizontal | tarjetas fuera del ancho | alto de la sección |
|---|---|---|---|---|
| **390 px** | **1** | no | ninguna | 1.925 px |
| **360 px** | **1** | no | ninguna | 1.992 px |
| 560 px | 1 | no | ninguna | 1.726 px |
| 861 px | 3 (2 filas) | no | ninguna | 940 px |

**No es un carrusel** (`overflow-x: visible` en la rejilla): en móvil se apilan y se ven las seis
bajando, en vez de verse la primera y media. Hay test que lo fija, y que también falla si alguien
convierte la sección en carrusel.

**HALLAZGO, y NO se arregla aquí:** el enlace de cada tarjeta mide **22 px de alto**, por debajo de
los **44 px** que pide AB6 para un objetivo táctil. **No lo introduce este ticket:** es una
propiedad del componente `.p-link` compartido, y **las seis tarjetas que ya existen en «Todo en uno»
y «Cómo funciona» miden exactamente lo mismo — 22 px las seis, medido**. Tocar `.p-link` cambiaría
tres secciones que pertenecen a otros tickets. → decisión del fundador.

## ⑦ Ficheros

* `scripts/_gremios-landing.mjs` (nuevo) — derivador, gate y suelo.
* `tests/scrum333-tarjetas-gremio.test.mjs` (nuevo) — 11 tests, sin gate.
* `public/index.html` — sección `#gremios` (+46 líneas, 0 borradas). *De paso, el fichero se
  normalizó a LF en el árbol de trabajo: tenía 600 CR en disco y el blob 0, como manda
  `.gitattributes` desde SCRUM-480. Cero diferencia para git.*
* `docs/master/SCRUM-333.md` (esta entrada).

**Lo que NO se toca:** el posicionamiento (F1) · el héroe (F4) · la comparativa (F5) · las
plantillas por gremio del producto (D3/SCRUM-314 — aquí ni se enseñan) · la app · `prisma/schema.prisma`
· el camino de emisión · las banderas.

## ⑧ Tanda

**3.717 tests · 3.640 pass · 0 fail · 77 skipped.** Los 11 de SCRUM-333 dentro, y los 12 del guard
de conformidad de la landing (SCRUM-400) siguen verdes con la sección nueva puesta.

🔸 El encargo avisaba de **1 fallo preexistente esperado** (`scrum480-fin-de-linea`, SCRUM-533).
**Ya no aparece**: SCRUM-533 entró en `main` y el árbol está limpio. La tanda va a **cero rojos**.
