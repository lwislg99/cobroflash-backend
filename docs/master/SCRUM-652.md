# SCRUM-652 · T3 fase A — reconocimiento antes de construir

**Medido contra:** `origin/main` = `5091091c973d631f22c3ceb15fdd091aebeed389` · 2026-09-02T12:12:53+02:00
**Rama:** `scrum-652-reconocimiento`
**Alcance:** solo lectura. **No se tocó ni una línea de código de producto.** Lo único escrito es
este documento.
**Instrumentos:** búsqueda de texto (`grep`) y lectura del árbol (AST / lectura directa del fuente).

> ⚠️ **El fichero se llama `SCRUM-652.md`, no `SCRUM-652-reconocimiento.md`.** El encargo pedía el
> segundo nombre y **el guard de SCRUM-273 lo rechaza**: exige `SCRUM-<n>.md` para que dos tickets
> no puedan escribir nunca en el mismo fichero. Como el encargo prohíbe tocar guards, gana el guard
> — y su propia prescripción dice que un registro de trabajo va **dentro** de `SCRUM-<n>.md`, no en
> un fichero al lado. Queda anotado para que nadie busque el otro nombre.

> **Para qué sirve esto.** Cada respuesta termina en **«esto significa que T3 tiene que…»**, para
> que la siguiente tanda lo use como plan y no vuelva a medir.
>
> Toda afirmación lleva **fichero y línea**. Lo que no se pudo medir va como **NO MEDIDO**, con
> esas palabras.

> ⚠️ **No se pudo leer la descripción del ticket en Jira**: el conector de Atlassian está
> desconectado en esta sesión. Este reconocimiento responde **las seis preguntas del encargo**. Si
> la descripción de Jira añade alguna más, **queda sin contestar** y hay que decirlo.

---

## Titular: la premisa que podía duplicar el sprint es FALSA, y en la dirección buena

**Firmar en el móvil del técnico YA EXISTE, y además ya funciona sin cobertura.** No hay que
construirlo. Lo que sí hay que construir es otra cosa, y está en la pregunta 3.

---

## 1 · La firma en el aparato del profesional: **EXISTE**

De las tres respuestas posibles —existe, existe a medias, no existe— la medida es **EXISTE**.

**Hay DOS flujos de firma, no uno.** El encargo describe solo el primero:

| Flujo | Dónde firma | Coordenada |
|---|---|---|
| **Remoto** (SCRUM-49) | el cliente, en **su** móvil, por enlace | `src/app.ts:118` y `:137` montan `/albaran` → `albaranPublic.routes.ts` |
| **En el aparato del profesional** | quien esté delante, en el móvil **del técnico** | `public/dashboard/js/albaranDetailView.js:476-478` (`btnFirmarAqui` → `window.openSignaturePad`) |

El comentario del propio botón lo dice sin ambigüedad (`albaranDetailView.js:472-475`):

> «FIRMAR ES DE VERDAD AQUÍ. El rótulo aprobado dice “aquí mismo” y tiene que ser cierto: un botón
> que promete firmar y te manda a otra pantalla a buscar otro botón es peor que no tenerlo.»

**Y ya está resuelto para sin cobertura**, que era la mitad difícil:

* `public/dashboard/js/colaDeFirmas.js` (SCRUM-358) — **encola la firma que no ha podido subir**, y
  encola **antes** de intentar subir: su cabecera razona que el orden inverso deja una ventana en
  la que la firma se pierde sin que nadie lo sepa.
* `public/dashboard/js/resistenciaAlmacen.js` (SCRUM-455) — el almacén local.
* `public/dashboard/js/estadoFirma.js` (SCRUM-356) — los tres estados de una firma pendiente.
* `public/sw.js:74` — `signaturePad.js` está **precacheado**, así que el pad abre sin red.

**Dos instrumentos.** La búsqueda de texto encontró los cuatro ficheros por nombre
(`colaDeFirmas`, `estadoFirma`, `signaturePad`, `resistenciaAlmacen`); la lectura del fuente
confirmó **quién llama a quién** — que es lo que el nombre no dice: `albaranDetailView.js:478`
invoca `window.openSignaturePad`, y `sw.js:74` lo precachea. Sin el segundo paso, «existe un
fichero de firma» y «se puede firmar aquí» se habrían escrito igual.

> 🔴 **Esto significa que T3 tiene que:** **NO construir el flujo de firma en el aparato del
> técnico.** Ya está, y con su cola offline. T3 lo **reutiliza**. La estimación que asumía
> construirlo desde cero sobra entera.

---

## 2 · El albarán como pariente: casi todo está, y **NO es el mismo documento**

**En una frase: el parte de trabajo comparte con el albarán todo menos dos cosas, y esas dos son
justo las que definen el parte.**

Primero el dato que evita una confusión: **no existe hoy nada llamado «parte»** — cero apariciones
de `parteDeTrabajo`, `parte_trabajo` o `ParteTrabajo` en `src/`, `public/` y `prisma/`. Se
construye desde cero o se reutiliza el albarán; no hay una tercera vía a medio hacer.

**Lo que el albarán YA tiene:**

| Pieza | Estado | Coordenada |
|---|---|---|
| Líneas | **Existe** — `Json`, array ordenado de `{concepto, cantidad, unidad, precioUnitario?, tipoIva?}` | `prisma/schema.prisma:21` |
| Estados | **Existe** — `borrador \| emitido \| firmado` | `prisma/schema.prisma:22` |
| Firma | **Existe** — `firmadoAt`, `firmadoPorNombre`, `firmadoPorCalidad` | `prisma/schema.prisma:25` y siguientes |
| Sobre de evidencia sellado | **Existe**, y **versionado** (v:1 / v:2 / v:3) | `src/modules/jobs/domain/albaran.service.ts:488` |
| PDF | **Existe** — 369 líneas | `src/modules/jobs/infra/albaranPdf.service.ts` |
| Paquete de evidencias | **Existe** | `src/modules/fiscal/evidencias/` (`paquete.ts`, `atestiguamiento.ts`, `paquete.repo.ts`) |
| Dos modos de valoración | **Existe** — `SIN_VALORAR` (sin precios) / `VALORADO` | `albaran.service.ts:22`; `schema.prisma:949` |

**¿El parte ES un albarán con otro nombre?** **No**, y la respuesta sale de medir dos diferencias
concretas, no de un parecido:

1. **El parte lleva DOS bloques de líneas** (mano de obra y materiales, con totales aparte). El
   albarán tiene **una lista plana** — ver pregunta 5.
2. **El parte necesita los precios abiertos después de firmar.** El albarán los **congela al
   firmar** — ver pregunta 3.

Todo lo demás —firma, evidencias, PDF, estados, offline— es el **mismo hecho**, no un parecido.

> 🔴 **Esto significa que T3 tiene que:** reutilizar el **hecho** (firmar un documento de trabajo y
> sellarlo con su evidencia), no copiar el módulo entero. Las dos diferencias de arriba son el
> trabajo real de T3; el resto es cableado. **Y decidir explícitamente** si el parte es un
> `Albaran` con un campo de tipo o un modelo propio — esa decisión es del fundador y toca
> `prisma/schema.prisma`, que es suyo.

---

## 3 · El candado: hoy **congela el documento ENTERO**, no una parte

**En una frase: la maquinaria de hoy sabe congelar todo o nada, y T3 necesita congelar la mitad.**

**Cómo congela hoy**, medido en dos capas:

* **La puerta HTTP.** `src/modules/jobs/app/routes/albaranes.routes.ts:443-445`:

  ```js
  if (albaran.estado === 'firmado') {
    return res.status(409).json({ error: 'albaran_locked',
      message: 'Un albarán firmado está congelado: no se puede editar.' });
  }
  ```

  Es un candado **de documento**: no distingue qué campo se intenta tocar.

* **El sello de contenido.** `albaran.service.ts:676-695` lista **exactamente** qué entra en el
  hash: `numero`, `fecha`, `modoValoracion`, `lineas`, `notas`, `obra`, `referenciaTrabajo`,
  `cliente`, `emisor`, `emisorNif`, `fechaEntrega`, `firmadoPorNombre`, `firmadoPorCalidad`.

🔴 **Y aquí está el dato que decide T3.** Las líneas entran en el hash **con su precio**
(`albaran.service.ts:368-376`, `lineasCanonicas`):

```js
precioUnitario: l.precioUnitario ?? null,
tipoIva: l.tipoIva ?? null,
```

**Cambiar un precio después de firmar rompe la huella del documento.** No es que esté prohibido por
una regla que se pueda relajar: es que el precio **es parte de lo que se firmó**.

Hay además un **segundo candado, y más temprano**: el modo de valoración solo se puede cambiar en
`borrador` (`albaranes.routes.ts:477-481`). Así que un albarán que nace `SIN_VALORAR` no puede
pasar a `VALORADO` una vez emitido.

**Lo que sí demuestra que el mecanismo PUEDE distinguir partes:** el sobre está **versionado**, y la
v:3 «no lee NINGUNA fuente viva: toma los cinco campos del bloque congelado» (`jobDireccion.ts`,
bloque de SCRUM-438). Es decir, **ya existe la idea de un bloque congelado frente a datos vivos** —
lo que no existe es un documento donde una parte esté congelada y otra siga abierta **a la vez**.

> 🔴 **Esto significa que T3 tiene que:** diseñar el sello para que el hash cubra **el contenido
> del trabajo y NO los precios** — es decir, una variante de `lineasCanonicas` sin
> `precioUnitario`/`tipoIva`, con su propia versión de sobre. **No se puede reutilizar el sello del
> albarán tal cual.** Y el candado HTTP deja de ser «si está firmado, 409» para pasar a ser «si
> está firmado, 409 **para los campos sellados**», que es un candado por campo y no por documento.
>
> ⚠️ Y una advertencia que sale del propio código: `albaran.service.ts:378-390` razona por escrito
> por qué las versiones del canónico **están escritas enteras y aparte** en vez de compartir un
> helper — porque `JSON.stringify` serializa por orden de inserción y un helper común ataría el
> hash de una versión al de otra. **Quien construya T3 tiene que leer ese bloque antes de tocar
> nada del sello.**

---

## 4 · Offline: el service worker precachea 69 rutas, y **añadir una es peligroso**

**En una frase: la estrategia de hoy es atómica, así que una ruta mal escrita deja a todo el mundo
sin offline y sin avisar.**

* `public/sw.js:95` — `caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL))`.
* **69 rutas** en el `SHELL`.
* El propio fichero ya lo avisa (`sw.js:16`): *«`cache.addAll` es ATÓMICO. Una sola ruta que ya…»*
* Ya precachea la pieza clave de la firma: `sw.js:74` → `/dashboard/js/signaturePad.js`.
* La estrategia de **runtime** sí es tolerante: `sw.js:125` hace `cache.put(...).catch(() => {})`,
  y `:129` tiene su `.catch`. El riesgo está **solo en la instalación**.

**La lección conocida queda CONFIRMADA contra el código**, no aceptada de palabra: el fallo es
atómico, silencioso y global.

> 🔴 **Esto significa que T3 tiene que:** si añade rutas al `SHELL`, **no hacerlo sin más**. Dos
> caminos, y la decisión es de quien construya:
> **(a)** pasar la instalación a tolerante (`Promise.allSettled` sobre `cache.add` uno a uno), de
> modo que una ruta muerta pierda esa ruta y no todo el offline; o
> **(b)** dejar `addAll` y añadir un guard que compruebe que **cada ruta del `SHELL` existe en el
> árbol**, de forma que una ruta muerta caiga en `npm test` y no en el móvil de un técnico.
> La (b) es más barata y cubre el caso conocido; la (a) cubre además el fallo de red durante la
> instalación. **NO MEDIDO** cuál de las dos prefiere el proyecto.

---

## 5 · Dos bloques de líneas: hoy el modelo asume **una lista plana**

**En una frase: no hay ningún campo que agrupe líneas, así que los dos bloques hay que
construirlos.**

* `prisma/schema.prisma:21` — `lineas Json`, y el comentario documenta la forma:
  `[{concepto, cantidad, unidad, precioUnitario?, tipoIva?}]`. **No hay clave de grupo.**
* La validación de una línea (`albaran.service.ts:34-42`) tiene exactamente esos cinco campos.
* Búsqueda de `grupo`, `bloque`, `categoria`, `manoDeObra`, `material` en `prisma/schema.prisma`:
  **ningún acierto aplicable** — los que salen son de otras cosas (preferencias de la Home `:63`,
  bloqueo de WhatsApp `:203`, la categoría de un **gasto** `:570`).
* Lo más cercano que existe es `Expense.category` (`schema.prisma:570`), con valores
  `materiales|desplazamiento|herramientas|subcontrata|otros`. **Es de gastos, no de líneas de
  documento**: no vale, pero **sí da un vocabulario ya existente** para no inventar otro.

> 🔴 **Esto significa que T3 tiene que:** añadir el agrupamiento. Dos formas, y **es decisión de
> diseño, no obvia**:
> **(a)** un campo por línea (`grupo: 'mano_obra' | 'materiales'`), que no rompe el array ni el
> orden y **cabe dentro del `Json` actual sin tocar el esquema**; o
> **(b)** dos arrays separados, que cambia la forma del documento y **sí** toca el esquema.
> La (a) es mucho más barata y conserva `lineaIndex`, del que ya depende
> `AlbaranLineaFacturada` (`schema.prisma`, modelo `albaran_lineas_facturadas`).
> ⚠️ Y con la (a) hay que decidir **qué pasa con las líneas viejas sin grupo** — un default o un
> «sin clasificar». Esa decisión es del fundador.

---

## 6 · El desplegable de quién firma: **ya sirve, casi entero**

**En una frase: «conserje» ya está; «personal del centro» no, pero hay una opción libre.**

Las opciones de hoy (`src/modules/jobs/domain/albaranFirmante.ts:109-116`):

| id | etiqueta |
|---|---|
| `el_propio_cliente` | El propio cliente |
| `en_nombre_del_cliente` | En nombre del cliente |
| `familiar_o_conviviente` | Un familiar o conviviente |
| `encargado_o_personal_de_obra` | Encargado o personal de la obra |
| `portero_o_conserje` | **Portero o conserje** |
| `otro` | Otro |

* **«Conserje» ya existe** — `albaranFirmante.ts:114`. El encargo lo daba por ausente.
* **«Personal del centro» no existe tal cual.** Lo más cercano es
  `encargado_o_personal_de_obra`, que dice **«de la obra»**, no «del centro». Para un cuarto
  técnico de un edificio, «obra» puede leerse mal.
* Hay salida sin tocar la lista: `otro` es una **ranura libre** y el texto que escriba el
  profesional se muestra tal cual (`albaranFirmante.ts:267`, `etiquetaCalidad`).
* ⚠️ **Sin opción marcada por defecto, y es deliberado** (`albaranFirmante.ts:120-122`): «una
  casilla premarcada es una declaración que el firmante no ha hecho».

> 🔴 **Esto significa que T3 tiene que:** **no rehacer el desplegable**. Como mucho, **una
> decisión**: si «Encargado o personal de la obra» vale para un centro de trabajo, o si hace falta
> una opción nueva. Añadir una etiqueta es **microcopy nueva (regla 30)** y la aprueba el fundador;
> además, esa etiqueta acompaña a una **firma**, y el propio fichero avisa de que una etiqueta
> falsa ahí es peor que ninguna (`albaranFirmante.ts:260-262`).

---

## Resumen para planificar T3

| Pregunta | Respuesta | ¿Construir? |
|---|---|---|
| 1 · Firma en el aparato del técnico | **Existe**, con cola offline | **No** |
| 2 · El albarán como pariente | Comparte todo menos dos cosas; **no es el mismo documento** | Reutilizar el hecho |
| 3 · Candado por partes | **Congela entero**; el precio está dentro del hash | **Sí — es el trabajo real de T3** |
| 4 · Offline | `addAll` **atómico**, 69 rutas | Sí, si se añaden rutas |
| 5 · Dos bloques de líneas | **Lista plana**, sin agrupación | **Sí** |
| 6 · Quién firma | Ya sirve; «conserje» ya está | **No** — a lo sumo una decisión |

**Lo que crece respecto de lo previsto:** la pregunta 3. **Lo que se cae:** las preguntas 1 y 6.

## Decisiones pendientes, y de quién son

1. **¿El parte es un `Albaran` con tipo, o un modelo propio?** — Fundador (toca
   `prisma/schema.prisma`, que es suyo).
2. **Agrupar líneas: campo por línea o dos arrays.** — Quien construya, con el fundador si toca
   esquema.
3. **Qué hacer con las líneas existentes sin grupo.** — Fundador.
4. **Estrategia del service worker: tolerante o guard.** — Quien construya.
5. **Si hace falta una opción nueva de firmante para «centro de trabajo».** — Fundador (regla 30).

## Qué queda NO MEDIDO

1. **La descripción de SCRUM-652 en Jira** — el conector de Atlassian está caído en esta sesión. Si
   añade requisitos, no están cubiertos aquí.
2. **Qué prefiere el proyecto** entre las dos estrategias de service worker de la pregunta 4.
3. **El coste real** de cada camino. Este documento dice **qué hay**, no cuánto cuesta lo que falta.

---

# SCRUM-652 · T3 fase B — el parte de trabajo, construido hasta la puerta del esquema

**Medido contra:** `origin/main` = `01d5c5a03e1f5e1b93d24e9f10b5b6b9a8a3f9c2` · 2026-09-02T13:40:00+02:00
**Rama:** `scrum-652-reconocimiento`

> **En una frase:** el parte existe como **dominio puro y probado** —sus dos bloques, su sello sin
> precios y sus dos candados— y **se para en la persistencia**, que necesita `prisma/schema.prisma`
> y es del fundador.

## 1 · Lo construido

`src/modules/jobs/domain/parteTrabajo.ts` + `tests/scrum652-parte-trabajo.test.mjs` (12 tests).

* **Dos bloques cerrados** — `BLOQUES_PARTE = ['mano_obra', 'materiales']`. Son el **sitio** de la
  línea, no una etiqueta: el papel los lleva separados y con su total aparte.
* **Tres tipos excluyentes** — `reparacion_asistencia | mantenimiento | instalacion`.
* **Su canónico propio, ESCRITO ENTERO**, sin compartir ni una línea con el del albarán.
* 🔴 **El sello NO lleva precios.** `lineasCanonicasParte` sella `bloque`, `unds` y `descripcion`,
  y nada más — escrito como lista explícita y no como «la línea menos dos claves», para que un
  campo nuevo **no pueda colarse en el sello sin que alguien lo decida**.
* **Los dos candados**: `puedeEditarContenido` (solo `borrador`) y `puedeEditarPrecios` (hasta
  `facturado`). Devuelven **motivo**, no un booleano: «no se puede» a secas manda a adivinar.
* **Suelo**: `puedeFirmarse` rechaza un parte sin ninguna línea. Basta una en cualquiera de los dos
  bloques — una asistencia puede ser solo mano de obra y una instalación solo material.
* **Totales por bloque**, en céntimos enteros como `calcAlbaranTotales`, y el total es **la suma de
  los dos** y no un recuento aparte.
* `lineasParaElTecnico` devuelve **solo** `bloque`, `unds` y `descripcion`: el importe no llega a la
  pantalla, que es lo que hace imposible pintarlo por descuido.

## 2 · 🔴 Dónde se para, y por qué

**El parte no tiene dónde vivir.** Medido: `Job` no tiene ningún `Json` libre y `Albaran` no tiene
discriminador de tipo. Las dos salidas —modelo nuevo, o columna nueva en `Albaran`— **son cambios
de `prisma/schema.prisma`**, que está en NO TOCAS sin OK.

**Diff preparado, sin aplicar** (modelo nuevo; es la opción que no toca el albarán):

```prisma
model ParteTrabajo {
  id              Int      @id @default(autoincrement())
  merchantId      Int      @map("merchant_id")
  jobId           Int?     @map("job_id")
  customerId      Int?     @map("customer_id")

  numero          String
  fecha           DateTime
  obra            String?
  referencia      String?

  entrada         String?
  salida          String?
  desplazamientos Int?
  kilometros      Decimal? @db.Decimal(10, 2)
  /// Array de nombres. Ranura para «varios técnicos» (sesión 1), que HOY NO EXISTE.
  tecnicos        Json     @default("[]")

  /// reparacion_asistencia | mantenimiento | instalacion (TIPOS_PARTE)
  tipo            String?
  /// [{bloque, unds, descripcion, precioUnitario?, tipoIva?}] — el bloque va DENTRO de la línea
  lineas          Json
  notas           String?

  /// borrador | firmado | facturado (ESTADOS_PARTE)
  estado          String   @default("borrador")

  firmadoAt          DateTime? @map("firmado_at")
  firmadoPorNombre   String?   @map("firmado_por_nombre")
  firmadoPorCalidad  String?   @map("firmado_por_calidad")
  /// Huella del CONTENIDO (sin precios) y su versión de canónico.
  contenidoHash      String?   @map("contenido_hash")
  contenidoVersion   Int?      @map("contenido_version")

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt      @map("updated_at")

  @@index([merchantId, fecha])
  @@index([merchantId, estado])
  @@map("partes_trabajo")
}
```

**Es 100 % aditivo**: una tabla nueva, ningún campo tocado de ningún modelo existente.

⚠️ **El bloque va DENTRO de la línea, en el `Json`.** Es la opción (a) del reconocimiento: no rompe
el array, conserva el orden del papel y **no obliga a un modelo de líneas aparte**.

## 3 · Lo que falta después del OK, en orden

1. Aplicar el diff (dev → staging → producción), con su preview.
2. Repositorio y rutas del parte — y ahí **baja el tope de SCRUM-411 de 8 a 7**.
3. La pantalla del técnico (sin importes) y la de valoración de oficina (con ellos).
4. Si esa pantalla añade rutas al `SHELL` del service worker: `sw.js:95` usa `cache.addAll`, que es
   **atómico**. Ver la pregunta 4 del reconocimiento.

## 4 · Declaraciones que este módulo movió, con su motivo

| Censo | Cambio | Por qué |
|---|---|---|
| `scrum627-censo-ciego` | entra `parteTrabajo.ts` | deriva IVA por documento, como el albarán |
| `scrum627b` | veredicto **DOCUMENTO** | por línea de UN parte, sin agrupar por tipo ni periodo. Y esos importes **no entran en el sello**, así que no pueden mover ninguna huella |
| `scrum411` | tope **7 → 8** | módulo de dominio sin llamador **por el gate del esquema**, no por deuda. Baja a 7 el commit que lo persista |

## 5 · Lo que NO se hizo, y es deliberado

* **El canónico del albarán no se ha tocado**, y hay un test que lo comprueba: un albarán valorado
  **sí** se firma con precios. Son dos documentos con dos sellos.
* **No se compartió ni una línea** entre los dos canónicos: `parteTrabajo.ts` importa `crypto` y
  nada más, y hay un test que lo fija.
* **«Varios técnicos» no existe** — medido: el esquema solo tiene `teamMemberId`/`operarioId`, uno.
  La ranura se sella como array para que el día que exista no haya que estrenar versión de
  contenido. **Que la ranura exista no significa que esté cableada.**
* Ni firma, ni cola, ni almacén, ni precache: **ya estaban** (fase A) y no se han tocado.

---

# Fase C · El parte de trabajo YA TIENE LLAMADOR

**Medido contra:** `origin/main` = `795e9c289e7028c33f37df258b3a7611a5a29e02` · 2026-09-02T18:40:00+02:00
**Rama:** `scrum-652-parte-superficie`
**Commit previo a inyectar rojos:** `5baa5634d9f1b8188a4444dc9c2c9a6e14e35e3a`

## PASO 0

```
git ls-tree -r --name-only origin/main | grep -iE 'scrum-?652|parteTrabajo|partes_trabajo'
  docs/master/SCRUM-652.md
  src/modules/jobs/domain/parteTrabajo.ts
  tests/scrum652-parte-trabajo.test.mjs

git ls-remote --heads origin | grep -iE 'scrum-?652'
  fb21d558a44c3d81944ad21e84a5e118a1ef62d2  refs/heads/scrum-652-reconocimiento
```

Esa rama viva **no tenía ni un commit fuera de `main`**: ya estaba mergeada entera. Nada que
rescatar y nada que duplicar.

## Verificación del contexto medido (no se remidió, se comprobó)

`parteTrabajo.ts` **310 líneas** ✔ · **12 tests** ✔ · `lineasCanonicasParte` en **:130** ✔ ·
el canónico del albarán mete `precioUnitario` y `tipoIva` ✔ · `albaranDetailView.js:546` ✔ ·
`app.js:492` ✔ · las seis opciones de firmante en `albaranFirmante.ts:109-116`, «portero o
conserje» incluida ✔.

**Dos coordenadas NO cuadraron, y gana el árbol:**

* `schema.prisma:1002-1003` **no** son `firmadoPorNombre`/`firmadoPorCalidad`: ahí hay un
  comentario del albarán. Los campos están en **`:1025-1026`** (Albaran) y **`:1178-1179`**
  (ParteTrabajo).
* «Las 8 piezas precacheadas»: con el barrido de este ticket, en `origin/main` son **7**. Son 8
  **después** de añadir el parte. El suelo del test se fijó en el número medido, no en el heredado.

## Lo que decide el ticket: los importes no cruzan el cable

En el parte real firmado la columna IMPORTE está **en blanco**. El técnico cierra en la obra sin
precios; el jefe los pone en la oficina después. Así que el mecanismo **no es «no los pintes»**:

* `serializeParteParaElTecnico` se escribe **entero, campo a campo** —no es la fila menos dos
  claves—, así que el día que la tabla gane una columna de dinero **no sale sola**;
* sus líneas salen de `lineasParaElTecnico`, que devuelve `{bloque, unds, descripcion}`;
* **no hay modo oficina**: ningún parámetro lo desbloquea, y el PATCH del técnico ni siquiera
  *lee* `precioUnitario` del cuerpo.

Una pantalla que los recibe y decide no enseñarlos está a un `console.log` de enseñarlos.

**Y los precios ya puestos no se pierden**: si el técnico corrige una línea que la oficina ya
valoró, el PATCH conserva su precio. Sin eso, una corrección en la obra borraría la valoración del
jefe en silencio.

## No hay segunda cola

Es la de SCRUM-358, con un cuarto argumento. La clave **ya llevaba el tipo dentro**
(`firma:albaran:7`), así que generalizarla no migra nada y una firma encolada por una versión
anterior sigue drenando a su albarán (default `'albaran'` en los tres puntos).

🔴 **Hacía falta de verdad:** sin el tipo, el albarán 7 y el parte 7 acuñarían **la misma clave**, y
como el `keyPath` del almacén sobrescribe por clave, encolar uno **haría desaparecer la firma del
otro en silencio**.

`parte_locked` se añade a `elServidorYaLaTiene` por el mismo motivo que `albaran_locked`: sin él,
la firma de un parte reintentado no saldría de la cola jamás. Y un `tipo` desconocido **no cae al
albarán «por si acaso»**: se queda en la cola y se dice cuál.

## 🔴 El cuarto rojo encontró un hueco REAL en mis propios tests

Los trece primeros llamaban a `firmarConRedDeSeguridad` **directamente, pasándole `'parte'` a
mano**. Probaban la cola, no el cable. Se quitó el `'parte'` de `parteDetailView.js` —el olvido más
fácil de cometer— y **los trece pasaron en verde** con la firma yendo al endpoint del albarán.

> Un test que inyecta el valor que quiere comprobar no comprueba nada: comprueba su propio
> argumento.

Se añadieron dos que ejercitan **`firmarParte`, la función de la vista**, con dobles: uno mira con
qué llama a la cola, otro que el resumen que ve el firmante no lleva dinero. Re-inyectado el mismo
fallo, **ahora cae y lo nombra**.

## Los cuatro rojos

| Inyección | Resultado |
|---|---|
| la pantalla pinta un importe | **2 tests** caen: «está pintando dinero: el símbolo del euro» |
| firmar congela los precios | cae y cita el motivo que devuelve el candado equivocado |
| el canónico del parte sella precios (el del albarán) | cae con los dos hashes |
| firmar el parte sin decir el tipo | **NO caía** → hueco tapado → ahora cae |

El detector de dinero lleva **control positivo dentro**: se le da un importe puesto a mano y tiene
que cazarlo. Sin eso, una regex rota daría el mismo verde.

## Declaraciones actualizadas al hecho, ninguna relajada

* **SCRUM-411 · 9 → 8.** El parte ya tiene consumidor, que es lo que su propia entrada pedía.
  **Baja a 8 y no a 7**: cuando se escribió aquella nota el censo estaba en 8; después entró
  `revision.ts` (SCRUM-655), que sigue esperando su gate. El número se **recuenta**, no se resta de
  una foto vieja.
* **SCRUM-362 · `tipo` entra en la lista de campos de la cola.** No es lo que ese test vigila —dice
  de qué documento es la firma, se fija al encolar y no cambia—. La lista **no se relaja** a
  «contiene al menos»: sigue exacta, y además se escribe **aparte** lo que de verdad protege
  (ningún campo puede hablar de progreso de envío), para que siga vigilando aunque la lista se
  amplíe otro día.
* **SCRUM-55 · cinco rutas en `TECNICO_ALLOWED`,** con motivo: el parte **es** el trabajo de campo
  del Operario. No abre puerta a dinero y no hay ruta de facturar (T8, regla 24).
* **SCRUM-402 · `parteDetailView.js` entra con 1.** El 1 engañaría si no se dijera: es **una** marca
  concatenada a **20 rótulos** — el caso de `libroRegistroView` (SCRUM-514). No significa «un
  rótulo provisional», significa «esta pantalla entera está sin firmar».

## Lo que NO se hizo, dicho para que no se suponga

* **`prisma/schema.prisma` no se ha tocado.** Congelado por el db push.
* **Una sola firma**, la que ya hay. Las dos firmas (cliente + técnico) necesitan columnas nuevas.
* **No se facturó nada desde el parte** (T8, bloqueado por regla 24).
* **`parteTrabajo.ts` y su sellador no se han reescrito.**
* El papel lleva **Calle / Población / Teléfono / CIF** y esta pantalla **no los cablea**: viven en
  la ficha del cliente, y traerlos es meter más datos personales en una pantalla nueva. Se decide,
  no se arrastra de paso.

## 📌 Limitación declarada: la numeración del parte

`allocateAlbaranNumber` reserva contra **dos columnas de `Merchant`** dentro de la transacción del
create. El parte **no puede** hacerlo hoy: no tiene columnas equivalentes y el schema está
congelado. Así que `parteNumero.ts` deriva del **máximo ya emitido** dentro de la transacción, y hay
que decir lo que eso **no** garantiza: `partes_trabajo` **no tiene índice único** sobre
`(merchant_id, numero)` —medido—, así que dos creaciones simultáneas del mismo merchant pueden
acuñar el mismo número y la base no lo rechazaría.

**El arreglo de verdad es la columna, no más código:** `nextParteNumber` + `parteSeriesYear` en
`Merchant`, propuesto para el segundo commit de schema junto a las dos firmas.

## 📌 Hallazgo de otro carril (regla 9): un nombre colisiona

`app.ts:510` y varias entradas de `adminRouteDeclarations.ts` llaman **«parte de trabajo» a los
ALBARANES**, por herencia de cuando era lo único que había. Desde hoy hay un `ParteTrabajo` de
verdad, con su tabla y sus rutas. **No se renombra aquí** —no es este carril— pero queda dicho, y
anotado al lado de las líneas afectadas: son dos documentos distintos.


---

# Fase D · La puerta al parte, y el cable que faltaba detrás del botón

**Medido contra:** `origin/main` = `69300b6662752e8fe624b1f6ee6b555f02e3a3f2` · 2026-09-02T20:01:54+02:00
**Commit previo a inyectar rojos:** `107846d3bdaee5a15762fd849abb691000fd4058`

## PASO 0

```
git ls-tree -r --name-only origin/main | grep -iE 'parteDetailView|partes.routes'
  public/dashboard/js/parteDetailView.js
  src/modules/jobs/app/routes/partes.routes.ts

git ls-remote --heads origin | grep -iE 'parte'
  32863041…  refs/heads/scrum-652-parte-superficie      ← la mía de la fase C
```

📌 **Y de paso, un dato que corrige el encargo:** de esa rama **todo está en `main` menos el
último commit** (`32863041`, el estado del db push). La sección «Estado del db push» **no estaba
mergeada**. Se arrastra en esta rama para que no se pierda.

## Lo que se midió antes de decidir dónde ponía la puerta

**¿Desde dónde llega hoy el técnico a un trabajo?** Sí hay camino, y es sólido:

```
index.html:55  data-view="jobs"   →  app.js:296  case 'jobs'      →  renderJobsView
jobsView.js:419  renderAppView('jobs-detail', { jobId })          →  app.js:300  →  renderJobDetailView
```

**¿Hay lista de partes?** **No, y no se estrena.** Crear un parte sólo tiene sentido dentro de un
trabajo: una entrada suelta en la barra llevaría a una pantalla que no sabe de qué trabajo hablar.
`GET /admin/partes` existe y hoy lo consume el propio botón para no duplicar partes; una pantalla
de «mis partes pendientes» es otro ticket.

## 🔴 Lo que faltaba de la fila 4 no era el botón: era el cable

La certificación decía «pantalla 🔴» en *firmar*. Medido:

* `renderParte` **sí pintaba** `data-parte-firmar` desde la fase C;
* y `parteDetailView.js` **no tenía ni un `addEventListener`**.

**El botón estaba pintado y MUERTO.** Y entre `app.js` y la vista faltaba además la función que
trae el parte: `renderParte(contenedor, parte)` pinta uno que alguien ya trajo, y nadie lo traía.

Así que la fila 4 se cierra con tres piezas, no con una:

1. `renderParteDetailView(contenedor, parteId)` — trae de `/admin/partes/:id`, pinta y **engancha**;
2. `app.js` — `state.parteId` + `case 'parte-detail'`;
3. `jobDetailView.js` — el botón, en la misma barra que «+ Nuevo albarán».

**Tras firmar se repinta desde el SERVIDOR**, no retocando el objeto en memoria — y también cuando
la firma se queda en la cola: el parte sigue en borrador y la pantalla tiene que seguir diciéndolo.

**Abre el que haya y sólo crea si no hay.** Un botón que siempre crea dejaría seis partes vacíos
del mismo trabajo al final del día, sin saber cuál es el suyo.

## `partes.routes.ts` NO se ha tocado

El filtro por `jobId` se hace en el cliente **a propósito**: `GET /admin/partes` ya devuelve `jobId`
en cada fila. Así la puerta se abre sin entrar en el fichero que está editando la sesión 4, y no
hay nada que mezclar.

## Esto NO estrena la idea: SCRUM-420 ya vigilaba la mitad

`SCRUM-420 · ③` comprueba que toda vista del router esté **en la barra o declarada** en
`VISTAS_SIN_ENTRADA`. Lo que añade la fase D es la otra mitad:

> **Una declaración es una promesa; una llamada es un hecho.**

Declarar «se llega desde el Trabajo» deja verde a SCRUM-420 aunque nadie llame nunca. El test nuevo
comprueba que **algo invoque** `renderAppView('parte-detail')` y que el botón **escuche**.
`parte-detail` queda además declarado en `VISTAS_SIN_ENTRADA` con su motivo y su ticket.

## Los rojos

| Inyección | Resultado |
|---|---|
| quitar la llamada desde el Trabajo | **2 tests** caen: «LA PANTALLA DEL PARTE NO ES ALCANZABLE» |
| el test entero **contra `origin/main`** | **6 de 10 fallan** — no habría pasado con el mecanismo de ayer |

El segundo es el que decide: un test que también aprobaría el estado anterior no prueba que hiciera
falta. Y el suelo declara **ceguera** si el barrido no ve ni un `case` ni un destino, porque con
cero todo lo demás pasaría por no encontrar nada.

## 🔴 Dos rojos me cazaron a MÍ, los dos por autorreferencia

Van tres veces hoy con el mismo patrón, así que queda escrito:

1. **Mi test del dinero** buscaba `precioUnitario` en el cuerpo **crudo** del serializador y cayó
   sobre **el comentario que explica que esos campos NO cruzan el cable**. El guard se cazó a sí
   mismo. Ahora mira el código sin comentarios, y el detector lleva **control positivo propio**:
   se le da un serializador que sí manda dinero y tiene que cazarlo.
2. **Mi comentario** en `jobDetailView.js` citaba literal el rótulo de la casilla de precios del
   albarán, y **SCRUM-319 cuenta sus apariciones**: le subí el recuento de 2 a 3. Reescrito para
   describirlo sin citarlo.

> Un guard que prohíbe un texto casa con el comentario que lo explica. Leer el código, no el
> fichero.

## El control que no podía caer

`serializeParteParaElTecnico` **no se ha tocado**, y no hay modo oficina. El detector de dinero de
la fase C sigue verde, y ahora hay un segundo que vigila el serializador **desde fuera**, sin
comentarios y con su control positivo.

## Microcopy (regla 30)

Propuesta, no aprobada. `jobDetailView.js` entra en el censo de SCRUM-402 con **2** —el rótulo del
botón y el aviso de fallo— y `parteDetailView.js` suma el suyo del suelo de carga.

**Entran porque la alternativa era peor:** un marcador se ve y se corrige; una pantalla
inalcanzable no se ve, y ya estuvo así una fase entera con sus tests en verde.
