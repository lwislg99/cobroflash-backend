# SCRUM-300 · C5 — MAPA DE FUSIÓN de las dos implementaciones paralelas

**Fecha:** 5-ago-2026 · **Carril:** A · **Gate:** medición, sin código

**Medido contra:** `origin/main` = `425301c8ddc79ad20e8605b49194f608ecdf339c` · 2026-08-05T22:56:24+01:00

> ⚠️ **ESTE FICHERO NO ES LA ENTREGA DE C5: es el mapa para fundirla.** C5 se construyó DOS VECES,
> en paralelo y por dos personas, con esquemas divergentes. Se detectó la noche del 5-ago-2026, al
> medir la cola de `jobDetailView.js` para SCRUM-305, **antes de que se generara la migración**.
>
> **Las dos ramas crean también este fichero con su propia entrada.** Al fundir habrá conflicto aquí:
> lo que tiene que sobrevivir es ESTA sección (es la instrucción de la propia fusión) más la entrada
> de trabajo que se escriba al terminar. Mide antes de resolverlo a favor de una sola.

## Las dos ramas

| | **A** | **B** |
| --- | --- | --- |
| Rama | `scrum-300-campos-albaran` | `scrum-300-firmado-por` |
| Punta | `44e66d0bded1617e71c72b4a8f27483ec049d9eb` | `eb023c0ec8f9d7e84e428cfaccdf9ce857261d9f` |
| Último commit | 5-ago 14:07 (Luis) | 5-ago 15:06 (Javier) |
| Columnas que añade | **4**: `fechaEntrega`, `lugarEntrega`, `firmadoPorNombre`, `firmadoPorCalidad` | **3**: sin `fechaEntrega` |
| Fichero de dominio | `albaranFirmaCopy.ts` | `albaranFirmante.ts` |

Ninguna es ancestro de la otra. **Ninguna está en `main`.**

## 🔴 LOS TRES HALLAZGOS — esto es lo que no se puede perder

### ① Las dos rompen la suite al mergear, y las dos con razón

Se escribieron **cuando SCRUM-369 no existía**. Hoy el verificador del sello está en `main` y su
contrato es: **una receta por versión de sobre, y un guard que exige que toda versión que el
sellador pueda emitir tenga la suya**.

Medido ejecutando el escáner de `tests/scrum369-verificador-sello.test.mjs` contra las tres
versiones del sellador:

| | Versiones que el escáner ve | Recetas en `albaranVerificacion.ts` de `main` |
| --- | --- | --- |
| `origin/main` | `[1]` | `{1}` ✅ |
| **A** | **`[]` — ninguna** | `{1}` |
| **B** | `[1, 2]` | `{1}` ❌ falta v:2 |

* **A** sella con `v: EVIDENCIA_VERSION_ACTUAL` (identificador, no literal numérico), así que el
  escáner no reconoce su objeto canónico y **salta el suelo** del guard. Y A **solo sabe sellar
  v:2**: lo dice su propio comentario —*«ESTA FUNCIÓN SELLA EN v2 Y SOLO EN v2… quien construya el
  verificador (SCRUM-369) tiene que saber que hay DOS poblaciones»*—, escrito cuando ese verificador
  era futuro. Ya no lo es.
* **B** sí despacha por versión (`v: 1` / `v: 2` + `obraSegunVersion`), así que el guard ve las dos y
  **exige la receta de v:2**.

🔴 **Falta trabajo que NO está en ninguna de las dos ramas:** añadir la **receta de v:2 a
`albaranVerificacion.ts` con su vector congelado**. Sin eso la suite queda roja.

**Arreglarla bajando el guard sería exactamente lo que SCRUM-369 vino a impedir**: un sello sin
verificador se lee igual que uno que funciona.

### ② El cliente firma un documento donde el «lugar de la obra» es el título del Trabajo

`src/modules/jobs/app/routes/albaranPublic.routes.ts:142` —la página pública de firma— hace:

```ts
const obra = esc((job?.direccion || job?.titulo || '').trim());
```

Con `Job.direccion` **sin escritores** (medido en SCRUM-374 y en la propia C5), ese `||` **se recorre
SIEMPRE**: lo que se enseña como lugar de la obra es en realidad el título del Trabajo.

No es el domicilio fiscal, así que no viola la letra del suelo del ticket, pero **es el mismo daño**:
un dato que no es una dirección, presentado como si lo fuera, en el documento que el cliente firma.

**Ya está en `main` y ninguna de las dos ramas lo toca.** No se ha corregido aquí: merece su decisión.

### ③ Nadie contó los toques del flujo de firma

Barrido completo de las dos ramas: **cero** menciones a un recuento de toques. B tiene capturas AB6
del bloque de firma (antes/después, 360 y 390 px), que es lo más cercano — pero **una captura no es
un recuento**. Es **condición de cierre escrita en el ticket** y está sin cumplir en las dos.

## Decisiones tomadas (asesor, 5-ago-2026)

* **Esquema: el de A** — 4 columnas, `fechaEntrega` incluida (es el campo nº 1 del ticket), y su
  comentario, porque SCRUM-374 confirmó que `Job.direccion` no la escribe nadie.
* **`albaran.service.ts`: base B**, por el despacho por versión. De A se trae `fechaEntrega` dentro
  del canónico de v:2. **Lo que NO se trae de A es su modelo de «sello único en v:2».**
* **Dominio: se queda `albaranFirmante.ts` (B).** `albaranFirmaCopy.ts` **no convive**: sería la
  tercera fuente de verdad sobre lo mismo en un ticket que ya tenía dos. De A se traen los textos de
  **`ayuda`** por campo (B no los tiene) y todo lo de `fechaEntrega`.
* **Límites: nombre 160 · otro 120.** (A traía 120 para el nombre; B, 160. Es validación, no estilo.)
* **ids de calidad, descriptivos y FIJADOS ANTES DE LA MIGRACIÓN** — es el valor que se guarda en
  `Albaran.firmadoPorCalidad`, así que cambiarlo después obliga a migrar filas:

  `el_propio_cliente` · `representante_del_cliente` · `familiar_o_conviviente` ·
  `encargado_o_personal_de_obra` · `portero_o_conserje` · `otro`

  📌 **DEROGADO EL 6-ago-2026, y se conserva porque es el registro de lo que se decidió el día 5.**
  La segunda ranura es hoy **`en_nombre_del_cliente`**, no `representante_del_cliente` — el motivo
  está más abajo, en su propia sección. Se anota AQUÍ porque esta lista se lee como la decisión
  vigente, y es el valor que se guarda en la columna: quien migre con la de arriba migra el id
  equivocado.

  ⚠️ Ninguna de las dos ramas usa estos ids: A tenía `familiar_o_conviviente`/`encargado_o_personal_obra`…
  y B `convive`/`obra`/`porteria`. **Los seis son nuevos y hay que aplicarlos en la fusión.**

* 🔴 **Las seis etiquetas las validó el fundador. Los cinco textos que B trae marcados como
  «aprobados» NO los aprobó nadie.** B los declara literalmente como *«Aprobado tal cual, ni una
  palabra distinta»* y eso es falso.

  **Un texto etiquetado como aprobado es peor que uno con marcador: el marcador pide permiso y la
  etiqueta falsa lo da.** Al fundir hay que retirar esa afirmación de `albaranFirmante.ts`.

## El mapa, fichero a fichero

Diez ficheros compartidos. Los rangos van en **coordenadas de `main`** (las dos ramas diffean contra
el mismo `main`), así que son comparables entre sí.

| Fichero | A añade | B añade | ¿Misma zona? | Veredicto |
| --- | --- | --- | --- | --- |
| `prisma/schema.prisma` | 21 (4 col.) | 21 (3 col.) | **SÍ** — hunks idénticos (767-772, 776-781) | **A** |
| `docs/sql/deriva-prod.sql` | 5 | 4 | **SÍ** | **A**, coherente con su esquema |
| `docs/MIGRATIONS_PENDING.md` | 28 (~861) | 41 (~81) | No | **Fundir**: escriben en sitios distintos del mismo log |
| `docs/master/SCRUM-300.md` | 10 | 185 | No (nuevo en ambas) | **Fundir a mano** + conservar este mapa |
| `src/modules/jobs/domain/albaran.service.ts` | +84 / −10 | **+223 / −41** | **SÍ**, los 6 hunks | **Fundir, base B** |
| `src/modules/jobs/infra/albaranPdf.service.ts` | +35 / −4 | +22 / −1 | **SÍ** | **Fundir**: A imprime además `fechaEntrega` |
| `src/modules/jobs/app/routes/albaranes.routes.ts` | +43 / −5 | +26 / −1 | **SÍ** | **Fundir**: A valida un campo más |
| `src/modules/jobs/app/routes/albaranPublic.routes.ts` | +72 / −3 | +79 / −2 | **SÍ** (5 de 7 hunks) | **Fundir a mano** — es la página que firma el cliente |
| `public/dashboard/js/signaturePad.js` | **+113 / −5** (5 hunks) | +74 / −1 (2) | **SÍ** | **Fundir, base A** — toca mucho más el pad |
| `public/dashboard/js/jobDetailView.js` | +35 / −3 | +57 / −3 | **NO** — A: 1103·1129·1443 · B: 935·961·1275 | **Fundir**: zonas distintas, entran las dos |

### Solo en A (7)

`src/modules/jobs/domain/albaranFirmaCopy.ts` · `tests/_pdf-texto.mjs` · `tests/albaran.test.mjs` ·
`tests/scrum300-albaran-campos.test.mjs` · `tests/scrum302-patron-albaran.test.mjs` ·
`tests/scrum49-firma-remota.test.mjs` · `tests/scrum68-evidencias-firma.test.mjs`

### Solo en B (11)

`src/modules/jobs/domain/albaranFirmante.ts` · `src/app.ts` · `public/dashboard/js/app.js` ·
`docs/diseno/bloque-c.md` · `docs/capturas/scrum-300/README.md` + las 4 capturas (firma ANTES/DESPUÉS,
360 y 390 px) · `tests/scrum300-albaran-firmado-por.test.mjs` ·
`tests/scrum300-microcopy-firmante.test.mjs`

## Los dos ficheros de dominio: B cubre más, A tiene dos cosas que B no

| | **A · `albaranFirmaCopy.ts`** (115 líneas) | **B · `albaranFirmante.ts`** (181) |
| --- | --- | --- |
| Calidad del firmante | 5 ids, **etiquetas con marcador** | 5 ranuras con texto literal, **etiquetado como aprobado sin serlo** |
| Rótulos | `label` + **`ayuda`** por campo | `ALBARAN_ROTULOS` + lista de «aprobados» |
| `fechaEntrega` | **sí** | no (no tiene esa columna) |
| Límites | `NOMBRE_FIRMANTE_MAX = 120` | `NOMBRE = 160` · `OTRO = 120` · `LUGAR_ENTREGA = 300` |
| Funciones | `codificar`/`decodificarCalidad`, `leerFirmante` | `resolverCalidadFirmante`, `normalizarNombreFirmante`, `normalizarLugarEntrega` |
| Razonamiento del vocabulario | — | evita «representante/autorizado/apoderado» por ser afirmaciones jurídicas que el pro no puede sostener |

## Lo que sí comprobaron las dos, y conviene no perder

* **Ninguna rompe el sello.** Las dos meten los campos DENTRO del contenido canónico antes de sellar,
  no pegados después. El problema de A no es el sellado: es que no puede recalcular un v:1.
* **Ninguna se cae al domicilio fiscal.** A lo bloquea en el dominio (*«es la dirección de OTRO, y en
  un documento de entrega firmada eso miente»*); B lo bloquea en el formulario y usa `Job.direccion`
  **solo como `placeholder`** — sugiere, no rellena.

## Quién hace qué

Midió S2 (esta entrada). **Ejecuta S3**: migración y fusión. Que C5 no lo toquen dos sesiones a la
vez es parte del arreglo, no un detalle — es lo que causó las dos implementaciones.

---

# SCRUM-300 · C5 — LA FUSIÓN, EJECUTADA

**Fecha:** 5-ago-2026 · **Carril:** S3 · **Gate:** código fundido y medido; migración NO ejecutada

**Medido contra:** `origin/main` = `5843684c98e8f8a1b1cef1c3334fc4a094f84d19` · 2026-08-05T23:08:16+01:00

> Esta sección es la EJECUCIÓN del mapa de arriba. El mapa se conserva entero: es la instrucción
> de la propia fusión y sigue siendo lo que explica por qué cada fichero quedó como quedó.

## Lo que se hizo

Se funden las dos ramas paralelas según los diez veredictos del mapa. No se elige ninguna.

| Fichero | Cómo quedó |
| --- | --- |
| `prisma/schema.prisma` | **A** — 4 columnas, `fechaEntrega` incluida |
| `docs/sql/deriva-prod.sql` | **A**, coherente con su esquema |
| `albaran.service.ts` | **fusión a TRES BANDAS sobre `main`** (ver hallazgo ② abajo) + `fechaEntrega` en el canónico de v:2 |
| `albaranVerificacion.ts` | **receta de v:2 NUEVA** con su vector congelado — no estaba en ninguna rama |
| `albaranFirmante.ts` | base B, con los seis ids del asesor, las ayudas de A y la microcopy retirada |
| `albaranPdf.service.ts` · `albaranes.routes.ts` | fundidos; de A entra `fechaEntrega` |
| `albaranPublic.routes.ts` | fundido a mano; retirada la premarca de la ranura |
| `signaturePad.js` | base A (chip de un toque, radios), con la microcopy SERVIDA de B |
| `jobDetailView.js` | zona del editor; la de firma se mudó (ver hallazgo ①) |
| `albaranFirmaCopy.ts` (A) | **NO se trae**: sería la tercera fuente de verdad |

## 🔴 Tres hallazgos MEDIDOS que corrigen el mapa

### ① `jobDetailView.js`: las zonas NO eran distintas, y la de firma ya no está ahí

El mapa concluyó *«zonas distintas, entran las dos»* comparando **números de línea de bases
distintas**: A diffea contra `c711b79` y B contra `de6abbd`. Medidos los anclajes en cada base:

| Ancla | en base de A | en base de B | desfase |
| --- | --- | --- | --- |
| `updateTotales();` (editor) | 1104 | 936 | 168 |
| `const body = { lineas: out…` | 1132 | 964 | 168 |
| `window.openSignaturePad({` | 1444 | 1276 | 168 |

**Desfase constante de 168 líneas: son LAS MISMAS zonas.** Aplicar las dos habría duplicado los
campos de entrega y el manejador de firma.

Y además: **`openSignaturePad` ya no existe en `jobDetailView.js`.** SCRUM-302 lo mudó a
`albaranDetailView.js:199` («firmar es de verdad AQUÍ»). Los campos van donde el código está hoy.

### ② Coger el fichero de B entero BORRA lo que `main` añadió después

`albaran.service.ts` de B es anterior a SCRUM-367/303: no tiene `contarLineasDePresupuesto` ni la
firma de 3 argumentos de `validarLineas`. Un `checkout` de la rama B lo dejaba fuera y rompía
`jobs.routes.ts`. Se rehízo con `git merge-file` (main / base de B / B), **limpio y sin conflictos**.

### ③ Los seis textos de la microcopy NO EXISTEN

El comentario del asesor remite a los seis rótulos validados *«en el comentario siguiente»*.
**Medido: SCRUM-300 tiene 5 comentarios y ninguno los contiene.** Ese comentario no se escribió.

Los seis **`id`** sí están fijados y se han aplicado. Las seis **etiquetas** van con
`[PENDIENTE microcopy oficial]`, que es lo que manda el propio enunciado del ticket mientras no
haya texto oficial, y el patrón de portabilidad, SCRUM-289 y SCRUM-303. La afirmación falsa de
«aprobado tal cual» se ha retirado **junto con** los textos.

## Decisiones que el mapa no cerraba, y cómo quedaron

- **`firmadoPorCalidad` guarda el `id`, no la etiqueta** (decisión del asesor). B guardaba el texto
  resuelto; se revirtió — un cambio de rótulo no puede obligar a reescribir un documento firmado.
- **Ninguna ranura viene premarcada.** Lo exige el comentario de `firmadoPorCalidad` en el schema
  de A, que es el que gobierna. B premarcaba la primera.
- **El nombre del firmante es OPCIONAL** (modelo de B, que es la base del sellador). A lo hacía
  obligatorio y bloqueaba el botón. ⚠️ **Es decisión de producto y está SIN TOMAR por nadie**: ni
  el mapa ni el asesor la resuelven. Se deja en el modelo retrocompatible.
- **El nombre se precarga en la página pública y NO en el pad de obra.** No es incoherencia: en el
  móvil del cliente quien firma es normalmente él; en obra puede ser cualquiera.

## Estado

- **v:2 verificable**: receta escrita entera y aparte, con tres vectores congelados, y probada
  EN ROJO por dos caminos (quitar la receta → 7 fallos; reordenar una clave del canónico → 1).
- **Migración NO ejecutada** y `prisma generate` NO ejecutado (prohibido en esta sesión).
- 🔴 **Gate para la sesión siguiente:** no migrar antes de tener los seis textos del fundador, o el
  marcador acabaría impreso en el PDF de un albarán firmado.
- Pendiente y NO tocado en esta sesión, por acotación explícita del encargo: el **recuento de
  toques** del flujo de firma y la **caída de `albaranPublic.routes.ts:142`** (`job?.direccion ||
  job?.titulo`).

## Los 7 fallos que quedan, clasificados (no se han tapado)

Medido con `node --test tests/*.test.mjs`: **1818 · 1744 pass · 7 fail · 67 skip**.
`npm test` NO llega a correr: su `pretest` (`_prisma-client-guard.mjs`) para antes, y con razón.

### Grupo 1 · cliente de Prisma desfasado (5) — se van con `prisma generate`

`el SQL del censo de producción…` · `SCRUM-235 ×3` · `CONTROL · el árbol sano da VERDE…`

El schema estrena 4 columnas y el cliente generado es de antes. El guard de la casa lo dice
exactamente y su arreglo es `npx prisma generate` desde este worktree. **NO se ha ejecutado**: está
prohibido en esta sesión, y además `node_modules` se comparte por junction entre los cuatro
worktrees (SCRUM-190), así que regenerarlo tocaría a las otras tres sesiones a la vez.
No es un fallo de la fusión: es el estado del entorno mientras la migración sea turno humano.

### Grupo 2 · SCRUM-371, el barrido no sabe de v:2 (2) — 🔴 TRABAJO REAL PENDIENTE

`⑥ el adaptador resuelve CADA FUENTE igual que el sellador` · `SUELO del comparador`

**El guard tiene razón y NO se ha bajado.** Lo que reporta es cierto:

```
jobDireccion: barrido «job?.direccion || null»
            ≠ sellador.obra «obraSegunVersion(ALBARAN_CONTENIDO_VERSION_ACTUAL, {…})»
```

Su tabla `PAREJAS` daba por hecho que el `obra` del sellador **es** el `jobDireccion` del barrido.
Eso valía con UNA versión. Con v:2, `obra` se resuelve POR VERSIÓN: v:1 → `Job.direccion`,
v:2 → `Albaran.lugarEntrega`. La comparación 1:1 de textos dejó de modelar la realidad.

⚠️ **Lo que NO hay que hacer es quitar la pareja de la tabla para que pase.** Ese guard existe
porque si el barrido resuelve una fuente distinto al sellador, dirá «no coincide» sobre la
población ENTERA de albaranes intactos. La forma correcta es enseñarle a comparar contra los dos
argumentos que entran en `obraSegunVersion`.

**Sí se arregló** una parte que era mía y era un suelo roto: el analizador cogía la PRIMERA
llamada a `computeAlbaranContentHash` del fichero, y C5 añadió una anterior
(`recomputarHashDeEvidencia`). Ahora nombra su objetivo (`buildFirmaEvidencia`) y falla si no lo
encuentra, en vez de comparar en silencio contra la llamada equivocada.

## Lo que NO se importó de las dos ramas, y por qué

`tests/scrum300-albaran-campos.test.mjs` (288 líneas, rama A) ·
`tests/scrum300-albaran-firmado-por.test.mjs` (301, B) ·
`tests/scrum300-microcopy-firmante.test.mjs` (323, B).

Los tres afirman, carácter a carácter, cosas que la fusión revirtió: los ids viejos de cada rama,
los cinco textos falsamente aprobados y el guardado de la ETIQUETA en vez del `id`. Traerlos tal
cual habría dejado la suite verde afirmando lo contrario de lo decidido.

En su lugar se escribió `tests/scrum300-firmante-ids-y-microcopy.test.mjs` (12 casos, verde, con su
rojo probado), que fija la frontera dato/pantalla. **Queda pendiente rescatar de aquellos tres lo
que sí sigue valiendo** —la retrocompatibilidad de un albarán firmado antes de C5 y la extracción
de texto del PDF con `tests/_pdf-texto.mjs`, que sí se ha traído—.

---

# SCRUM-300 · C5 — CIERRE: microcopy aprobada, suite en verde

**Medido contra:** `origin/main` = `9ce9ffd727411f0e69826bbdc174ed65f2582a13` · 2026-08-05T23:46:07+01:00
**Suite:** `npm test` → 1819 · **1752 pass · 0 fail** · 67 skip

## La microcopy, aprobada por el fundador (6-ago-2026)

Rótulo: **¿En calidad de qué firma?** · Campo: **Nombre de quien firma**

| `id` (dato, se guarda) | etiqueta (pantalla) |
| --- | --- |
| `el_propio_cliente` | El propio cliente |
| `en_nombre_del_cliente` | En nombre del cliente |
| `familiar_o_conviviente` | Un familiar o conviviente |
| `encargado_o_personal_de_obra` | Encargado o personal de la obra |
| `portero_o_conserje` | Portero o conserje |
| `otro` | Otro |

### 🔴 `representante_del_cliente` → `en_nombre_del_cliente`, y por qué

La rama `scrum-300-firmado-por` razonaba por escrito que había que evitar «representante»,
«apoderado» y «autorizado» por ser AFIRMACIONES JURÍDICAS que el profesional no puede sostener. La
primera resolución del asesor fijó `representante_del_cliente`, **derogando ese razonamiento sin
abordarlo**. El fundador lo revirtió:

> «Representante» significa quien puede OBLIGAR al cliente. El profesional no está en condiciones
> de verificar eso: le haríamos afirmar más de lo que sostiene, con nuestro sello encima.

Pero la categoría hace falta —el administrador de una comunidad no es ninguna de las otras cinco—.
**«En nombre del cliente» describe el hecho observado sin afirmar la figura.** Renombrado ANTES de
la migración: después habría obligado a migrar filas. Tiene guard propio, que caza
`represent|apoderad|autorizad` tanto en el `id` como en la etiqueta.

## El nombre: columna NULLABLE, formulario OBLIGATORIO

No es contradicción: **contestan a preguntas distintas.** La columna admite nulo por las filas
viejas (retrocompatibilidad; `null` = «no se pidió al firmar»). El formulario lo exige porque es EL
valor del ticket: C5 existe porque «guardamos un trazo sin nombre», y un nombre opcional deja el
mismo trazo sin nombre en cuanto alguien tiene prisa.

Vive en `exigirNombreFirmante`, UNA función para las DOS rutas que firman: si cada una validara por
su cuenta, una acabaría aceptando lo que la otra rechaza. Además: «Otro» exige su texto, y **el
nombre precargado se BORRA al cambiar de opción** — pero solo si sigue siendo la sugerencia nuestra
intacta; lo que teclee el profesional no se toca nunca.

## 🔴 DOS LECCIONES DE MÉTODO QUE VALEN FUERA DE ESTE TICKET

### ① Comparar números de línea de DOS BASES DISTINTAS no dice nada sobre si dos cambios se solapan

El mapa concluyó que A y B tocaban «zonas distintas» de `jobDetailView.js` porque sus números de
línea no coincidían. Medido: el desfase era **constante, 168 líneas en las tres anclas** — porque
cada rama diffea contra su propio merge-base. Eran LAS MISMAS zonas, y aplicar las dos habría
duplicado los campos.

**La comprobación correcta es el ancla, no el número.** Un desfase constante entre varias anclas es
la firma de dos bases distintas, no de dos zonas distintas.

### ② Coger un fichero ENTERO de una rama vieja borra lo que `main` añadió después

Pasó **cuatro veces** en esta fusión: `albaran.service.ts` (perdía `contarLineasDePresupuesto`),
`src/app.ts` y `app.js` (perdían SCRUM-301, 302, 314 y 291) y `albaranes.routes.ts` (172 líneas,
con `allocateAlbaranNumber` dentro de la transacción). **Nueve de los diecisiete fallos iniciales
salían de ahí.**

`git checkout <rama> -- <fichero>` NO es fundir: es reemplazar. Para fundir, `git merge-file` con
las tres versiones (main / merge-base de la rama / rama). Señal barata para detectarlo:
contar las líneas borradas de `git diff origin/main -- <fichero>` — si borra líneas que tú no has
tocado, mira.

### Y una tercera, del guard: un analizador que coge «la primera llamada» caduca

`tests/scrum371-…` localizaba el sellado como «la primera llamada a `computeAlbaranContentHash` del
fichero». C5 añadió dos llamadas ANTES (`recomputarHashDeEvidencia`, `ensureAlbaranPdf`), así que
pasó a comparar contra la equivocada. Se cazó solo porque su propio suelo exigía ver `customer` ahí
dentro. Ahora **nombra su objetivo** (`buildFirmaEvidencia`) y falla si no lo encuentra.

## SCRUM-371, resuelto (no bajado)

El barrido no sabía de v:2: le faltaban `fechaEntrega`, `firmadoPorNombre` y `firmadoPorCalidad` en
el adaptador Y en el `select`. **Sin ellos, un albarán v:2 INTACTO se habría recalculado con nulos y
salido como «no coincide»** — la acusación de falsificación contra un papel que nadie tocó.

El guard se REFORZÓ, no se relajó: ahora compara las DOS fuentes de `obra` contra los dos argumentos
que entran en `obraSegunVersion`, y compara la NORMALIZACIÓN (`??` vs `||`) ignorando de qué objeto
sale el dato — porque el sellador los lee de `params` (la petición) y el barrido de la fila, y eso
es correcto que difiera. Probado en rojo cambiando `?? null` por `|| null`: cae.

## Pendiente para la sesión siguiente

- **La migración**, en el orden confirmado: **#1 SCRUM-205 (`vf_estado`, con su orden propio:
  ALTER → backfill → desplegar) → #2 SCRUM-207 (índice) → #3 ésta.** El gate de la microcopy ya
  está levantado: los seis textos están dentro.
- El **recuento de toques** del flujo de firma (condición de cierre del ticket, sin cumplir).
- La **caída de `albaranPublic.routes.ts:142`** (`job?.direccion || job?.titulo`).
- Rescatar de los tres tests no importados lo que siga valiendo (retrocompatibilidad de un albarán
  firmado antes de C5, y el uso de `tests/_pdf-texto.mjs`, que sí se trajo).

## Addenda (6-ago-2026): los tres textos de error, y el matiz del precargado

**Tres textos APROBADOS por el fundador**, con guard propio en
`tests/scrum300-firmante-ids-y-microcopy.test.mjs`:

| Caso | Texto |
| --- | --- |
| Falta el nombre (400) | Falta el nombre de quien firma. |
| Calidad que no existe | Esa opción no existe. Recarga la página y vuelve a intentarlo. |
| «Otro» sin texto | Si eliges «Otro», escribe en calidad de qué firma. |

Los dos últimos venían de `scrum-300-firmado-por` como literales que **nadie había aprobado** — la
misma clase de texto que las cinco ranuras retiradas — y se reescribieron. El segundo dice **QUÉ
HACER** y eso no es adorno: quien lo ve tiene la pantalla desincronizada con las ranuras que sirve
el backend, y recargar es la salida. Tiene assert propio (`/[Rr]ecarga/`) para que no se pierda.

### 🔴 El nombre precargado se borra al cambiar de opción — SALVO si lo tecleó él

La regla, tal y como la dio el fundador, era «se borra al cambiar de opción». Al implementarla
apareció un caso que esa formulación no cubría: **si el profesional YA ha escrito un nombre a mano,
borrárselo es peor que dejar una precarga obsoleta.** Pierde trabajo suyo, y en obra probablemente
no se dé cuenta hasta después de firmar.

La regla final, aprobada: se borra **solo si el valor sigue siendo nuestra sugerencia intacta**.
Se marca con `dataset.deSugerencia` al rellenarla desde el chip (o desde la precarga de la página
pública) y se retira en cuanto hay un `input` a mano. Lo que teclee el profesional no se toca nunca.

**La lección:** «borrar lo obsoleto» y «no destruir lo que el usuario ha escrito» chocan, y gana el
segundo. Un dato nuestro se puede volver a poner; uno suyo, no.
## ⚠️ SI RETOMAS C5: `npx prisma generate` NADA MÁS HACER CHECKOUT

**Estado a 6-ago-2026.** El trabajo de C5 vive en la rama **`scrum-300-c5-fusion`**, verde y
parada, esperando a que alguien con credencial mida producción. No está en `main` y no debe
mergearse hasta entonces.

Esa rama añade **4 columnas** a `Albaran` (`fechaEntrega`, `lugarEntrega`, `firmadoPorNombre`,
`firmadoPorCalidad`). El cliente de Prisma del worktree está generado **contra el schema de
`main`**, que no las tiene. Así que:

```bash
git checkout scrum-300-c5-fusion
npx prisma generate            # ← ANTES de npm test, o el pretest para (y con razón)
```

Sin eso, `npm test` muere en su `pretest` diciendo que el cliente va por detrás del schema. **El
guard lo dice bien y no hay que rodearlo** — solo que enterarse por un rojo a las tres de la
mañana cuesta media hora, y esta nota vale por esa media hora.

⚠️ **Y al revés también:** al volver a `main` (o a cualquier rama sin las 4 columnas) hay que
regenerar OTRA VEZ, porque entonces el cliente va por DELANTE. Ese sentido es el peor de los dos y
tiene precedente escrito: *«es lo que mató la tanda del 29-jul-2026: 6 tests y 27 minutos, con este
guard en verde»*. Medido el 6-ago-2026: `node_modules` **NO** es un junction en ninguno de los
cuatro worktrees (`fsutil` → error 4390, `LinkType` vacío), así que regenerar **solo afecta al
árbol en el que estás** — el motivo escrito que decía lo contrario es falso (SCRUM-351).
---

# SCRUM-300 · C5 — LA FUSIÓN, EJECUTADA

**Fecha:** 5-ago-2026 · **Carril:** S3 · **Gate:** código fundido y medido; migración NO ejecutada

**Medido contra:** `origin/main` = `5843684c98e8f8a1b1cef1c3334fc4a094f84d19` · 2026-08-05T23:08:16+01:00

> Esta sección es la EJECUCIÓN del mapa de arriba. El mapa se conserva entero: es la instrucción
> de la propia fusión y sigue siendo lo que explica por qué cada fichero quedó como quedó.

## Lo que se hizo

Se funden las dos ramas paralelas según los diez veredictos del mapa. No se elige ninguna.

| Fichero | Cómo quedó |
| --- | --- |
| `prisma/schema.prisma` | **A** — 4 columnas, `fechaEntrega` incluida |
| `docs/sql/deriva-prod.sql` | **A**, coherente con su esquema |
| `albaran.service.ts` | **fusión a TRES BANDAS sobre `main`** (ver hallazgo ② abajo) + `fechaEntrega` en el canónico de v:2 |
| `albaranVerificacion.ts` | **receta de v:2 NUEVA** con su vector congelado — no estaba en ninguna rama |
| `albaranFirmante.ts` | base B, con los seis ids del asesor, las ayudas de A y la microcopy retirada |
| `albaranPdf.service.ts` · `albaranes.routes.ts` | fundidos; de A entra `fechaEntrega` |
| `albaranPublic.routes.ts` | fundido a mano; retirada la premarca de la ranura |
| `signaturePad.js` | base A (chip de un toque, radios), con la microcopy SERVIDA de B |
| `jobDetailView.js` | zona del editor; la de firma se mudó (ver hallazgo ①) |
| `albaranFirmaCopy.ts` (A) | **NO se trae**: sería la tercera fuente de verdad |

## 🔴 Tres hallazgos MEDIDOS que corrigen el mapa

### ① `jobDetailView.js`: las zonas NO eran distintas, y la de firma ya no está ahí

El mapa concluyó *«zonas distintas, entran las dos»* comparando **números de línea de bases
distintas**: A diffea contra `c711b79` y B contra `de6abbd`. Medidos los anclajes en cada base:

| Ancla | en base de A | en base de B | desfase |
| --- | --- | --- | --- |
| `updateTotales();` (editor) | 1104 | 936 | 168 |
| `const body = { lineas: out…` | 1132 | 964 | 168 |
| `window.openSignaturePad({` | 1444 | 1276 | 168 |

**Desfase constante de 168 líneas: son LAS MISMAS zonas.** Aplicar las dos habría duplicado los
campos de entrega y el manejador de firma.

Y además: **`openSignaturePad` ya no existe en `jobDetailView.js`.** SCRUM-302 lo mudó a
`albaranDetailView.js:199` («firmar es de verdad AQUÍ»). Los campos van donde el código está hoy.

### ② Coger el fichero de B entero BORRA lo que `main` añadió después

`albaran.service.ts` de B es anterior a SCRUM-367/303: no tiene `contarLineasDePresupuesto` ni la
firma de 3 argumentos de `validarLineas`. Un `checkout` de la rama B lo dejaba fuera y rompía
`jobs.routes.ts`. Se rehízo con `git merge-file` (main / base de B / B), **limpio y sin conflictos**.

### ③ Los seis textos de la microcopy NO EXISTEN

El comentario del asesor remite a los seis rótulos validados *«en el comentario siguiente»*.
**Medido: SCRUM-300 tiene 5 comentarios y ninguno los contiene.** Ese comentario no se escribió.

Los seis **`id`** sí están fijados y se han aplicado. Las seis **etiquetas** van con
`[PENDIENTE microcopy oficial]`, que es lo que manda el propio enunciado del ticket mientras no
haya texto oficial, y el patrón de portabilidad, SCRUM-289 y SCRUM-303. La afirmación falsa de
«aprobado tal cual» se ha retirado **junto con** los textos.

## Decisiones que el mapa no cerraba, y cómo quedaron

- **`firmadoPorCalidad` guarda el `id`, no la etiqueta** (decisión del asesor). B guardaba el texto
  resuelto; se revirtió — un cambio de rótulo no puede obligar a reescribir un documento firmado.
- **Ninguna ranura viene premarcada.** Lo exige el comentario de `firmadoPorCalidad` en el schema
  de A, que es el que gobierna. B premarcaba la primera.
- **El nombre del firmante es OPCIONAL** (modelo de B, que es la base del sellador). A lo hacía
  obligatorio y bloqueaba el botón. ⚠️ **Es decisión de producto y está SIN TOMAR por nadie**: ni
  el mapa ni el asesor la resuelven. Se deja en el modelo retrocompatible.
- **El nombre se precarga en la página pública y NO en el pad de obra.** No es incoherencia: en el
  móvil del cliente quien firma es normalmente él; en obra puede ser cualquiera.

## Estado

- **v:2 verificable**: receta escrita entera y aparte, con tres vectores congelados, y probada
  EN ROJO por dos caminos (quitar la receta → 7 fallos; reordenar una clave del canónico → 1).
- **Migración NO ejecutada** y `prisma generate` NO ejecutado (prohibido en esta sesión).
- 🔴 **Gate para la sesión siguiente:** no migrar antes de tener los seis textos del fundador, o el
  marcador acabaría impreso en el PDF de un albarán firmado.
- Pendiente y NO tocado en esta sesión, por acotación explícita del encargo: el **recuento de
  toques** del flujo de firma y la **caída de `albaranPublic.routes.ts:142`** (`job?.direccion ||
  job?.titulo`).

## Los 7 fallos que quedan, clasificados (no se han tapado)

Medido con `node --test tests/*.test.mjs`: **1818 · 1744 pass · 7 fail · 67 skip**.
`npm test` NO llega a correr: su `pretest` (`_prisma-client-guard.mjs`) para antes, y con razón.

### Grupo 1 · cliente de Prisma desfasado (5) — se van con `prisma generate`

`el SQL del censo de producción…` · `SCRUM-235 ×3` · `CONTROL · el árbol sano da VERDE…`

El schema estrena 4 columnas y el cliente generado es de antes. El guard de la casa lo dice
exactamente y su arreglo es `npx prisma generate` desde este worktree. **NO se ha ejecutado**: está
prohibido en esta sesión, y además `node_modules` se comparte por junction entre los cuatro
worktrees (SCRUM-190), así que regenerarlo tocaría a las otras tres sesiones a la vez.
No es un fallo de la fusión: es el estado del entorno mientras la migración sea turno humano.

### Grupo 2 · SCRUM-371, el barrido no sabe de v:2 (2) — 🔴 TRABAJO REAL PENDIENTE

`⑥ el adaptador resuelve CADA FUENTE igual que el sellador` · `SUELO del comparador`

**El guard tiene razón y NO se ha bajado.** Lo que reporta es cierto:

```
jobDireccion: barrido «job?.direccion || null»
            ≠ sellador.obra «obraSegunVersion(ALBARAN_CONTENIDO_VERSION_ACTUAL, {…})»
```

Su tabla `PAREJAS` daba por hecho que el `obra` del sellador **es** el `jobDireccion` del barrido.
Eso valía con UNA versión. Con v:2, `obra` se resuelve POR VERSIÓN: v:1 → `Job.direccion`,
v:2 → `Albaran.lugarEntrega`. La comparación 1:1 de textos dejó de modelar la realidad.

⚠️ **Lo que NO hay que hacer es quitar la pareja de la tabla para que pase.** Ese guard existe
porque si el barrido resuelve una fuente distinto al sellador, dirá «no coincide» sobre la
población ENTERA de albaranes intactos. La forma correcta es enseñarle a comparar contra los dos
argumentos que entran en `obraSegunVersion`.

**Sí se arregló** una parte que era mía y era un suelo roto: el analizador cogía la PRIMERA
llamada a `computeAlbaranContentHash` del fichero, y C5 añadió una anterior
(`recomputarHashDeEvidencia`). Ahora nombra su objetivo (`buildFirmaEvidencia`) y falla si no lo
encuentra, en vez de comparar en silencio contra la llamada equivocada.

## Lo que NO se importó de las dos ramas, y por qué

`tests/scrum300-albaran-campos.test.mjs` (288 líneas, rama A) ·
`tests/scrum300-albaran-firmado-por.test.mjs` (301, B) ·
`tests/scrum300-microcopy-firmante.test.mjs` (323, B).

Los tres afirman, carácter a carácter, cosas que la fusión revirtió: los ids viejos de cada rama,
los cinco textos falsamente aprobados y el guardado de la ETIQUETA en vez del `id`. Traerlos tal
cual habría dejado la suite verde afirmando lo contrario de lo decidido.

En su lugar se escribió `tests/scrum300-firmante-ids-y-microcopy.test.mjs` (12 casos, verde, con su
rojo probado), que fija la frontera dato/pantalla. **Queda pendiente rescatar de aquellos tres lo
que sí sigue valiendo** —la retrocompatibilidad de un albarán firmado antes de C5 y la extracción
de texto del PDF con `tests/_pdf-texto.mjs`, que sí se ha traído—.

---

# SCRUM-300 · C5 — CIERRE: microcopy aprobada, suite en verde

**Medido contra:** `origin/main` = `9ce9ffd727411f0e69826bbdc174ed65f2582a13` · 2026-08-05T23:46:07+01:00
**Suite:** `npm test` → 1819 · **1752 pass · 0 fail** · 67 skip

## La microcopy, aprobada por el fundador (6-ago-2026)

Rótulo: **¿En calidad de qué firma?** · Campo: **Nombre de quien firma**

| `id` (dato, se guarda) | etiqueta (pantalla) |
| --- | --- |
| `el_propio_cliente` | El propio cliente |
| `en_nombre_del_cliente` | En nombre del cliente |
| `familiar_o_conviviente` | Un familiar o conviviente |
| `encargado_o_personal_de_obra` | Encargado o personal de la obra |
| `portero_o_conserje` | Portero o conserje |
| `otro` | Otro |

### 🔴 `representante_del_cliente` → `en_nombre_del_cliente`, y por qué

La rama `scrum-300-firmado-por` razonaba por escrito que había que evitar «representante»,
«apoderado» y «autorizado» por ser AFIRMACIONES JURÍDICAS que el profesional no puede sostener. La
primera resolución del asesor fijó `representante_del_cliente`, **derogando ese razonamiento sin
abordarlo**. El fundador lo revirtió:

> «Representante» significa quien puede OBLIGAR al cliente. El profesional no está en condiciones
> de verificar eso: le haríamos afirmar más de lo que sostiene, con nuestro sello encima.

Pero la categoría hace falta —el administrador de una comunidad no es ninguna de las otras cinco—.
**«En nombre del cliente» describe el hecho observado sin afirmar la figura.** Renombrado ANTES de
la migración: después habría obligado a migrar filas. Tiene guard propio, que caza
`represent|apoderad|autorizad` tanto en el `id` como en la etiqueta.

## El nombre: columna NULLABLE, formulario OBLIGATORIO

No es contradicción: **contestan a preguntas distintas.** La columna admite nulo por las filas
viejas (retrocompatibilidad; `null` = «no se pidió al firmar»). El formulario lo exige porque es EL
valor del ticket: C5 existe porque «guardamos un trazo sin nombre», y un nombre opcional deja el
mismo trazo sin nombre en cuanto alguien tiene prisa.

Vive en `exigirNombreFirmante`, UNA función para las DOS rutas que firman: si cada una validara por
su cuenta, una acabaría aceptando lo que la otra rechaza. Además: «Otro» exige su texto, y **el
nombre precargado se BORRA al cambiar de opción** — pero solo si sigue siendo la sugerencia nuestra
intacta; lo que teclee el profesional no se toca nunca.

## 🔴 DOS LECCIONES DE MÉTODO QUE VALEN FUERA DE ESTE TICKET

### ① Comparar números de línea de DOS BASES DISTINTAS no dice nada sobre si dos cambios se solapan

El mapa concluyó que A y B tocaban «zonas distintas» de `jobDetailView.js` porque sus números de
línea no coincidían. Medido: el desfase era **constante, 168 líneas en las tres anclas** — porque
cada rama diffea contra su propio merge-base. Eran LAS MISMAS zonas, y aplicar las dos habría
duplicado los campos.

**La comprobación correcta es el ancla, no el número.** Un desfase constante entre varias anclas es
la firma de dos bases distintas, no de dos zonas distintas.

### ② Coger un fichero ENTERO de una rama vieja borra lo que `main` añadió después

Pasó **cuatro veces** en esta fusión: `albaran.service.ts` (perdía `contarLineasDePresupuesto`),
`src/app.ts` y `app.js` (perdían SCRUM-301, 302, 314 y 291) y `albaranes.routes.ts` (172 líneas,
con `allocateAlbaranNumber` dentro de la transacción). **Nueve de los diecisiete fallos iniciales
salían de ahí.**

`git checkout <rama> -- <fichero>` NO es fundir: es reemplazar. Para fundir, `git merge-file` con
las tres versiones (main / merge-base de la rama / rama). Señal barata para detectarlo:
contar las líneas borradas de `git diff origin/main -- <fichero>` — si borra líneas que tú no has
tocado, mira.

### Y una tercera, del guard: un analizador que coge «la primera llamada» caduca

`tests/scrum371-…` localizaba el sellado como «la primera llamada a `computeAlbaranContentHash` del
fichero». C5 añadió dos llamadas ANTES (`recomputarHashDeEvidencia`, `ensureAlbaranPdf`), así que
pasó a comparar contra la equivocada. Se cazó solo porque su propio suelo exigía ver `customer` ahí
dentro. Ahora **nombra su objetivo** (`buildFirmaEvidencia`) y falla si no lo encuentra.

## SCRUM-371, resuelto (no bajado)

El barrido no sabía de v:2: le faltaban `fechaEntrega`, `firmadoPorNombre` y `firmadoPorCalidad` en
el adaptador Y en el `select`. **Sin ellos, un albarán v:2 INTACTO se habría recalculado con nulos y
salido como «no coincide»** — la acusación de falsificación contra un papel que nadie tocó.

El guard se REFORZÓ, no se relajó: ahora compara las DOS fuentes de `obra` contra los dos argumentos
que entran en `obraSegunVersion`, y compara la NORMALIZACIÓN (`??` vs `||`) ignorando de qué objeto
sale el dato — porque el sellador los lee de `params` (la petición) y el barrido de la fila, y eso
es correcto que difiera. Probado en rojo cambiando `?? null` por `|| null`: cae.

## Pendiente para la sesión siguiente

- **La migración**, en el orden confirmado: **#1 SCRUM-205 (`vf_estado`, con su orden propio:
  ALTER → backfill → desplegar) → #2 SCRUM-207 (índice) → #3 ésta.** El gate de la microcopy ya
  está levantado: los seis textos están dentro.
- El **recuento de toques** del flujo de firma (condición de cierre del ticket, sin cumplir).
- La **caída de `albaranPublic.routes.ts:142`** (`job?.direccion || job?.titulo`).
- Rescatar de los tres tests no importados lo que siga valiendo (retrocompatibilidad de un albarán
  firmado antes de C5, y el uso de `tests/_pdf-texto.mjs`, que sí se trajo).

## Addenda (6-ago-2026): los tres textos de error, y el matiz del precargado

**Tres textos APROBADOS por el fundador**, con guard propio en
`tests/scrum300-firmante-ids-y-microcopy.test.mjs`:

| Caso | Texto |
| --- | --- |
| Falta el nombre (400) | Falta el nombre de quien firma. |
| Calidad que no existe | Esa opción no existe. Recarga la página y vuelve a intentarlo. |
| «Otro» sin texto | Si eliges «Otro», escribe en calidad de qué firma. |

Los dos últimos venían de `scrum-300-firmado-por` como literales que **nadie había aprobado** — la
misma clase de texto que las cinco ranuras retiradas — y se reescribieron. El segundo dice **QUÉ
HACER** y eso no es adorno: quien lo ve tiene la pantalla desincronizada con las ranuras que sirve
el backend, y recargar es la salida. Tiene assert propio (`/[Rr]ecarga/`) para que no se pierda.

### 🔴 El nombre precargado se borra al cambiar de opción — SALVO si lo tecleó él

La regla, tal y como la dio el fundador, era «se borra al cambiar de opción». Al implementarla
apareció un caso que esa formulación no cubría: **si el profesional YA ha escrito un nombre a mano,
borrárselo es peor que dejar una precarga obsoleta.** Pierde trabajo suyo, y en obra probablemente
no se dé cuenta hasta después de firmar.

La regla final, aprobada: se borra **solo si el valor sigue siendo nuestra sugerencia intacta**.
Se marca con `dataset.deSugerencia` al rellenarla desde el chip (o desde la precarga de la página
pública) y se retira en cuanto hay un `input` a mano. Lo que teclee el profesional no se toca nunca.

**La lección:** «borrar lo obsoleto» y «no destruir lo que el usuario ha escrito» chocan, y gana el
segundo. Un dato nuestro se puede volver a poner; uno suyo, no.

---

## 📌 LOS CUATRO TESTS QUE ESTA ENTRADA DECLARA — medido el 9-ago-2026 (SCRUM-391)

El guard de SCRUM-391 midió que esta entrada nombra tests que no estaban en `main`. Los cuatro,
comprobados **uno a uno contra `main` y contra todas las ramas del remoto**:

| Test declarado | ¿En `main`? | Veredicto |
| --- | --- | --- |
| `tests/scrum300-firmante-ids-y-microcopy.test.mjs` | **sí** | el de la fusión; vigente |
| `tests/scrum300-albaran-campos.test.mjs` | **no, y en NINGUNA rama** | **se ESCRIBE** (ver abajo) |
| `tests/scrum300-albaran-firmado-por.test.mjs` | no · solo en `origin/scrum-300-firmado-por` | **declaración RETIRADA**: cubierto |
| `tests/scrum300-microcopy-firmante.test.mjs` | no · solo en `origin/scrum-300-firmado-por` | **declaración RETIRADA**: cubierto |

### Los dos que se retiran, y QUÉ los cubre

Los dos vivían en la **rama B** (`scrum-300-firmado-por`), que **no se mergeó**: la fusión conservó
`albaranFirmante.ts` y descartó el otro fichero de dominio, así que sus tests se fueron con él. Lo
que comprobaban está cubierto por **`tests/scrum300-firmante-ids-y-microcopy.test.mjs`** (14 tests):
los seis `id` y su orden, las seis etiquetas aprobadas literales, que «representante» no está en el
vocabulario, que la microcopy viaja SERVIDA y no copiada, que ninguna ranura viene marcada, que se
guarda el `id` y nunca la etiqueta, la ranura libre de ida y vuelta, el rechazo de un id
desconocido, los topes (160/120/300) y el suelo del lugar vacío.

### El que se ESCRIBE, y por qué no se borraba la línea

`scrum300-albaran-campos.test.mjs` venía de `scrum-300-campos-albaran` (**PR #492, cerrada**) y no
existe en ninguna rama. Pero **describía una comprobación que no cubre nadie**, y hay dos medidas
que lo demuestran:

* `generateAlbaranPdf` tenía **cero consumidores** en `tests/`: ningún test miraba dentro del PDF.
* `tests/_pdf-texto.mjs` —el lector de texto de PDF que SÍ entró con la fusión— estaba **huérfano**,
  precisamente porque su único consumidor era este test.

O sea: el PDF pinta el lugar, la fecha de entrega y quién firma, **y nada lo comprobaba**. Los
tests de PDF de esta casa miran tamaño y `%PDF-`, y un PDF con los campos en blanco pasa las dos.

Escrito con ese alcance exacto —**el DOCUMENTO**, no el dominio, que ya está cubierto— más el suelo
del lector (si saca menos de 100 bytes, falla) y el suelo fiscal (sin lugar de entrega, el
domicilio del emisor no ocupa su sitio) con su control del control. **Probado en rojo**: quitando
del PDF el bloque de quién firma cae nombrando ese campo, y quitando el de la fecha de entrega,
el suyo.
