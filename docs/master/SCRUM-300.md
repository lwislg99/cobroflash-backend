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

## Entrada de trabajo · rama A (`scrum-300-campos-albaran`)

# SCRUM-300 · C5: lugar y fecha de entrega + QUIÉN FIRMA el albarán

**Fecha:** 5-ago-2026 · **Carril:** B · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `c711b7968777f29fd00fcddae69c2ba8489c576a` · 2026-08-05T13:55:37+02:00
**Tanda:** 1634 tests, 1567 pass, 0 fail, 67 skipped (gateados a staging)

> ⚠️ **LA PREMISA DEL TICKET ESTABA DESMENTIDA**, y el fundador pidió medirlo antes de tocar nada.
> Lo que sigue es lo medido, no lo supuesto.

el albarán firmado guardaba un trazo anónimo y ningún dato de la entrega. **La premisa del ticket estaba DESMENTIDA y se midió antes de tocar nada:** el ticket daba por hecho que el lugar de obra salía de `Job.direccion`, pero **nadie escribe `Job.direccion`** (ningún esquema de `src/core/validation/` la acepta; sus únicas apariciones en `src/` son lecturas — el propio comentario del schema ya lo admitía: *"sin fuente hoy… se llenará en la UI (tarea futura)"*) y **`Customer` no tiene dirección**. Peor: `buildFirmaEvidencia` metía `obra: job.direccion` DENTRO del hash del contenido, así que **todos los albaranes firmados hasta hoy llevan el lugar de obra sellado como `null`**. Y `firmante` se rellenaba con el nombre del CLIENTE pasara lo que pasara — una declaración que nadie había hecho, que es peor que un hueco porque se impugna y arrastra al documento. **Schema aditivo (GO del fundador, diff presentado antes de aplicar):** `Albaran.fechaEntrega DateTime?` · `lugarEntrega String?` · `firmadoPorNombre String?` · `firmadoPorCalidad String?`, las cuatro opcionales; SQL generado offline (`prisma migrate diff` schema→schema) = **4 `ADD COLUMN` y nada más**: 0 DROP, 0 RENAME, 0 ALTER destructivo, 0 NOT NULL. **El sobre de evidencia sube a `v: 2`** y los campos nuevos entran al contenido sellado (probado: cambiar cualquiera de los cuatro cambia el hash). **Los sobres `v:1` NO se recalculan, NO se migran y NO se tocan** — con su `obra: null` son la verdad de lo que se firmó; `computeAlbaranContentHash` emite SOLO v2 y lo dice en su docstring, para que quien construya el verificador (**SCRUM-369**) sepa que hay dos poblaciones y que `v` las distingue. **Quién firma es OBLIGATORIO en los dos canales**, y ni prerrellenado ni con opción marcada: campo VACÍO + **chip de sugerencia de un toque** con el nombre del cliente, y «en calidad de qué» sin default (las cinco etiquetas las aprobó el fundador el 5-ago-2026 y entraron sin migrar ni un albarán, porque lo que se guarda es el `id`, fijado antes que el texto; el guard NO se retiró al llegar la copy: cambió de objeto y ahora clava el texto literal en las DOS listas —módulo TS y pad del dashboard—, porque un guard que se borra al aprobarse la copy deja la copy sin vigilar). **SUELO:** si no hay lugar de entrega se imprime «No se pidió al firmar»; **jamás** se cae al domicilio fiscal del emisor ni al del cliente — una dirección equivocada en un documento de entrega es peor que un hueco, porque se firma sin mirarla. **TOQUES del flujo de firma (medidos sobre el código, antes → después):** in situ **3 → 4** (Firmar · *chip* · dibujar · Confirmar) y remoto **2 → 3** (*chip* · dibujar · Firmar); +1 más en cada uno si se marca la calidad, que es opcional. Si el firmante NO es el cliente hay que teclear el nombre — es el precio de no mentir, y el chip cubre el caso normal. **Tests:** `tests/scrum300-albaran-campos.test.mjs` (17, puros, sin gate) + `tests/_pdf-texto.mjs`, **primer lector de texto de PDF del repo** — hasta ahora los tests de PDF solo miraban tamaño y `%PDF-`, que un PDF con los campos en blanco también pasa; el ticket exigía afirmar sobre el DOCUMENTO. Los tres campos, la retrocompatibilidad de un albarán `v:1` (se imprime, conserva su hash tal cual, se sigue facturando) y el suelo se prueban leyendo el PDF generado. **Probado en rojo por el mecanismo:** quitando cada campo del PDF (cae nombrándolo), rompiendo el suelo (cae solo el test del suelo, con su control al lado en verde) y sacando `lugarEntrega` del sello. **Tres trinquetes ajenos se pusieron rojos y los tres tenían razón:** el censo SQL de SCRUM-222 (regenerado, 331→335 columnas), el de SCRUM-275 (mi `invalid_date` duplicado añadía una respuesta pública muda: las dos fechas comparten ahora UNA salida de error; y el `message` va deletreado en el sitio, no escondido tras una variable) y el de SCRUM-302, que **cortaba 1200 caracteres FIJOS** del modelo y al crecer éste decía «no encuentro `estado`» cuando `estado` seguía donde estaba — arreglado para recortar el modelo entero con comprobación de que se cogió completo. **`Job.direccion` NO se toca** (queda como precarga opcional para cuando alguien le dé fuente); tampoco se implementa precarga hoy, porque saldría siempre vacía. **Hallazgo → SCRUM-369:** `computeAlbaranContentHash` se invoca en **un solo sitio de `src/`** (al firmar) y **nada lo recalcula**: el hash es evidencia guardada, no un invariante comprobado — no existe verificador. **Migración aditiva: staging antes que producción, y prod ⏳ con GO del fundador.**
