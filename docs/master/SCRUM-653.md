# SCRUM-653 · Las DOS firmas del parte: FIRMA CLIENTE y FIRMA TÉCNICO

**Medido contra:** `origin/main` = `2becaeaa82a8e491a5705862d3df95d6d88e5bc3` · 2026-09-03T13:10:17+02:00
**Rama:** `scrum-653-dos-firmas`

## PASO 0

```
git ls-tree -r --name-only origin/main | grep -iE 'scrum-?653|firmante'
  src/modules/jobs/domain/albaranFirmante.ts
  tests/scrum300-firmante-ids-y-microcopy.test.mjs
  tests/scrum463-firmante-ve-el-contenido.test.mjs
  tests/scrum466-el-firmante-ve-el-albaran.test.mjs

git ls-remote --heads origin | grep -iE 'scrum-?653'   →  ninguna
```

**LA COSA no existe**, comprobado con control positivo (el mismo instrumento **sí** encuentra
`firmadoPorNombre` en `schema.prisma` y en dos ficheros de `src/`): cero para «segunda firma»,
`firmaTecnico`, `firma_tecnico`, `signatureUrlTecnico`, `firmadoPorTecnico` y «firma del técnico».

## 🔴 La medición que CAMBIÓ el encargo

> El encargo decía: «el modelo tiene un solo juego (`signatureUrl`, `firmadoAt`,
> `firmadoPorNombre`, `firmadoPorCalidad`)».

Medido: **ese es el juego del ALBARÁN. El parte no tiene `signatureUrl`.** Y peor —

**`POST /admin/partes/:id/firmar` VALIDA `signatureData` y lo TIRA.** Sus tres únicas apariciones
en el fichero son la regex de PNG/JPEG y el tope de tamaño; el `UPDATE` escribe estado, fecha,
nombre, calidad y el hash. **El trazo se descarta.** El parte guardaba *que* se firmó y *quién dijo
ser*, y no la firma.

Es un defecto de la fase C —mío— y sale a la luz justo al ir a añadir la segunda. Así que este
ticket no añade una firma: **añade la segunda y guarda la primera.**

## Las tres decisiones, medidas antes de escribir

### ① El sello: v:1 sellaba al firmante, y con dos firmas eso NO puede ser

`contenidoCanonicoParte` v:1 incluye `firmadoPorNombre` y `firmadoPorCalidad`. La huella se calcula
al firmar, así que con dos firmas:

```
firma el cliente  → técnico aún null  →  hash H1
firma el técnico  → los dos rellenos  →  hash H2 ≠ H1     (y al revés, otro par)
```

**Un documento cuya huella depende de quién firmó primero, con el mismo contenido.** Eso no es un
sello: es un número que cambia solo.

→ **v:2 sella sólo el CONTENIDO.** Las firmas son evidencia *adherida*: cada una con su trazo, su
fecha y su nombre, en la fila y **fuera** del hash. La v:1 se conserva **entera e intacta** —un
parte sellado con ella se verifica con ella— y una versión desconocida **lanza**, sin rama por
defecto (lección de SCRUM-438).

La alternativa —meter las dos y recalcular al completarse— es peor: el hash que se le enseñó al
primer firmante dejaría de valer.

### ② El congelado: se congela con la PRIMERA, y NO se cambia nada

**Medido antes de tocar:** `puedeEditarContenido` cierra con cualquier estado ≠ `borrador`, o sea
que **ya congelaba con la primera**. Se conserva, y con dos firmas el motivo es más fuerte: lo que
el primer firmante avaló no puede cambiar después. Si el contenido siguiera abierto hasta la
segunda, se podría modificar lo que el otro ya firmó — y no volvería a mirarlo.

La segunda firma es una **adición**: pone su trazo, su fecha y su nombre, y no toca el contenido,
así que el sello no se mueve.

🔴 **Lo que sí cambia es el CANDADO DE FIRMA: pasa de mirar el ESTADO a mirar la RANURA.** Con el
viejo, en cuanto el técnico firmaba el estado era `firmado` y **el cliente ya no podía firmar** —
el segundo firmante se quedaba fuera según el orden. Y el orden no se exige
(`ordenDeFirmaExigido()`): en la obra firma quien esté libre primero.

### ③ El técnico NO tiene «en calidad de»

Las seis opciones de `albaranFirmante.ts` —«portero o conserje», «un familiar o conviviente»…—
existen porque quien firma **por el cliente** puede ser cualquiera. El técnico es un empleado
identificado: darle esa ranura sería ofrecerle declarar que firma *en nombre del cliente*, que es
justo lo que no puede hacer. Su nombre **sí** es obligatorio, con la misma regla que el del cliente.

Hay un test con **control positivo del detector**: comprueba que la ruta del técnico no la tiene
**y** que el mismo detector la encuentra en la del cliente, donde sí está.

## Sin cobertura: la misma cola, un tipo más

Ni una segunda cola. `RUTAS` pasa a guardar **la ruta entera** y no la base, porque la firma del
técnico cambia el *sufijo* (`/firmar-tecnico`) y con el mapa viejo habría hecho falta un `if`.
`albaran` sigue primero y sigue siendo el default: una firma encolada por una versión anterior no
tiene `tipo` y es de un albarán por construcción.

Las dos firmas del **mismo** parte tienen claves distintas —`firma:parte:7` y
`firma:parte-tecnico:7`— y hay un test que lo exige: con la misma clave, el `keyPath` del almacén
sobrescribe y **una de las dos desaparece en silencio**.

## Entregado en el orden de la casa

| | Qué | Dónde |
|---|---|---|
| ① | decisión | ya estaba |
| **②** | `ALTER` aditivo, **4 columnas nullable** | `docs/sql/scrum-653-dos-firmas.sql` |
| **③** | schema + dominio + rutas + vista + tests | este PR |

**Clasificador sobre el ②: 4 sentencias · 0 RECHAZADAS · 0 borrados · `ok=true` · exit 0.**
El fichero dice en cabecera que el ② va **antes** de mergear el ③.

## ⚠️ Esta rama va DESPUÉS de `scrum-652-puerta-al-parte`

Se construyó **encima** de ella, y no por comodidad: el cable de la pantalla
(`renderParteDetailView`) sólo existe ahí. Construir sobre `main` habría dejado dos botones que
nadie engancha, y un conflicto seguro en `parteDetailView.js`.

## 📌 Hallazgo de otro carril (regla 9): el delimitador de SCRUM-683b

Su test acota «la ruta del dictado» cortando desde `router.post('/:id/dictado'` **hasta
`export default router`** — o sea que da por supuesto que el dictado es **la última ruta del
fichero**. Cualquier ruta escrita después cae dentro de su corte y lo hace saltar aunque el dictado
no escriba nada.

**No se ha tocado su guard.** Se ha movido *mi* ruta antes de la suya, que además queda mejor
colocada (las dos firmas juntas). Queda dicho para que su carril lo mire.

## Declaraciones actualizadas al hecho, ninguna relajada

* **`scrum652`** · `PARTE_CONTENIDO_VERSION_ACTUAL` 1 → 2, y `firmadoPorCalidad` sale de la lista
  de campos que mueven la huella. **La comprobación no se borra: se INVIERTE** —ahora se exige que
  *no* la mueva— y `scrum653` comprueba que en v:1 sí la movía.
* **`scrum652c`** · «si el estado es `firmado`, no se ofrece firmar» pasa a ser **por ranura**. Con
  dos firmas, `firmado` ya no significa «el cliente firmó».
* **SCRUM-55** · la ruta nueva en `TECNICO_ALLOWED`, con motivo: es **su** firma.
* **SCRUM-411** · `ordenDeFirmaExigido` declarado como `ESPECIFICACION_EJECUTABLE_SIN_SUPERFICIE`:
  borrarla no quita código muerto, quita la única constancia de que esa decisión se tomó.
* **`docs/sql/deriva-prod.sql`** regenerado: 417 columnas.

## Microcopy (regla 30)

Propuesta, no aprobada: «Firma del cliente», «Firma del técnico», «Firmado por el cliente/técnico»,
«Falta una firma para cerrar el parte». Salen con marca y `parteDetailView.js` **ya estaba** en el
censo de SCRUM-402 con 1 — las cinco cuelgan de la misma constante `M`, así que el número no sube.
Es el caso de `libroRegistroView` otra vez: **un 1 que son cinco rótulos**.

## ⛔ No aplicado a ninguna base

Ni a dev. El ② lo ejecuta el fundador, base por base, antes de mergear esto.


---

# Censo de nombres · el PASO 0 de la casa aplicado al esquema

**Medido contra:** `origin/main` = `4e9e114d1620386c76982efbc4eeae1e9d55fc06` · 2026-09-03T14:05:00+02:00
**Leído de `prisma/schema.prisma`**, no de memoria.

## ① `partes_trabajo` HOY — cinco campos, y ninguno es una imagen

| Campo Prisma | Columna | Tipo |
|---|---|---|
| `firmadoAt` | `firmado_at` | `DateTime?` |
| `firmadoPorNombre` | `firmado_por_nombre` | `String?` |
| `firmadoPorCalidad` | `firmado_por_calidad` | `String?` |
| `contenidoHash` | `contenido_hash` | `String?` |
| `contenidoVersion` | `contenido_version` | `Int?` |

**No hay ninguna columna de imagen.** Ni de firmante técnico. Ni token, ni evidencia.

## ② `albaranes` — el linaje, ocho campos

| Campo Prisma | Columna | Tipo |
|---|---|---|
| `signatureUrl` | `signature_url` | `String? @db.Text` |
| `firmadoAt` | `firmado_at` | `DateTime?` |
| `firmadoPorNombre` | `firmado_por_nombre` | `String?` |
| `firmadoPorCalidad` | `firmado_por_calidad` | `String?` |
| `firmaToken` | `firma_token` | `String? @unique` |
| `enviadoParaFirmaAt` | `enviado_para_firma_at` | `DateTime?` |
| `evidenciaFirma` | `evidencia_firma` | `Json?` |
| `estado` | `estado` | `String @default("borrador")` |

**La convención del linaje, leída de ahí:** la IMAGEN se llama `signature_url`; la METADATA va en
castellano, `firmado_*`. Y el barrido de TODO el esquema lo confirma: la imagen de una firma se
llama `signatureUrl` en **`Quote` y en `Albaran`** — dos documentos, un nombre.

## ③ Qué escribe cada ruta — medido sobre el CÓDIGO, no sobre el nombre

Acotando el cuerpo de cada ruta con `tests/_cuerpo-de-ruta.mjs` (paréntesis balanceados sobre el
código blanqueado), el `data:` de cada `update` en `origin/main`:

```
POST /admin/partes/:id/firmar   (cliente)
   estado: 'firmado',
   firmadoAt,
   firmadoPorNombre: nombre.nombre,
   firmadoPorCalidad: calidad.valor,
   contenidoHash,
   contenidoVersion: PARTE_CONTENIDO_VERSION_ACTUAL,

POST /admin/partes/:id/firmar-tecnico   →  NO EXISTE en main
```

⚠️ **Mi primer instrumento mintió por omisión:** filtraba las líneas por `:` y se comía
`firmadoAt,` y `contenidoHash,`, que son propiedades abreviadas. Corregido antes de dar la lista.

**La respuesta al punto 3, entonces:**
* la ranura del CLIENTE es `firmado_at` / `firmado_por_nombre` / `firmado_por_calidad`, **sin
  imagen** — y esa es la mitad del mecanismo que existe;
* la ranura del TÉCNICO **no existe**. No hay medio mecanismo que reutilizar: no hay ninguno.

## ④ El juego propuesto, con su coste

| Opción | Qué | Coste | ¿Toca columnas existentes? |
|---|---|---|---|
| **A · elegida** | añadir 4: `signature_url`, `signature_tecnico_url`, `firmado_tecnico_at`, `firmado_tecnico_nombre` | asimetría de lectura: el juego del cliente va **sin** sufijo y el del técnico **con** él | **NO. Aditivo puro** |
| B | renombrar el juego del cliente a `firmado_cliente_*` para que los dos sean simétricos | **renombra 3 columnas con datos en tres bases** | **SÍ → PARA** |
| C | tabla `partes_trabajo_firmas`, una fila por firma | tabla nueva con todo lo que arrastra (borrado de merchant, backup, tenencia, portabilidad, censos de SCRUM-192/241/172) y hay que migrar la ranura actual | **SÍ, en la práctica → PARA** |

**Se elige A.** El coste que paga —que `firmado_at` sea «el del cliente» sin decirlo en el nombre—
se compensa en el serializador, que expone `firmoElCliente` / `firmoElTecnico` / `firmasCompletas`
derivados, y en un comentario en el modelo.

**B y C obligan a tocar columnas existentes, así que ya no son aditivas y NO se hacen aquí.**
Renombrar una columna con datos en tres bases es otro ticket y otra conversación.

### 🔴 Lo que el censo cambió antes de aplicar nada

La primera versión de este PR llamaba `firma_tecnico_url` a la imagen del técnico. **Habría sido
una TERCERA convención** para lo mismo que `Quote` y `Albaran` llaman `signature_url`.

Corregido a **`signature_tecnico_url`**, y no cuesta nada porque el ALTER **no está aplicado en
ninguna base**. Ese es exactamente el trabajo que hace un censo: verlo antes, no después.

Queda: **imagen = `signature*`, metadata = `firmado_*`**, igual que el albarán.

### Lo que NO se añade, y por qué

`firma_token` y `enviado_para_firma_at` son del albarán porque tiene **firma remota** (un enlace
que se manda al cliente). El parte se firma **en la obra, en el móvil del técnico**: un token para
un enlace que nadie manda sería superficie sin uso. `evidencia_firma` tampoco: el parte no pasa por
`buildFirmaEvidencia`, y añadir la columna sin el mecanismo es prometer una evidencia que no se
recoge.

## El matiz de Javier sobre la exposición

> Que el merchant real todavía no use el producto hace la exposición PEQUEÑA HOY, no la hace CERO,
> y sobre todo NO ARREGLA EL DEFECTO. Las fechas «desde cuándo hasta cuándo» se anotan igual,
> porque el día que entre el primer merchant de verdad nadie va a poder reconstruir ese intervalo
> hacia atrás.

**Las fechas, anotadas:**

* **Desde:** SCRUM-652 fase C, el commit que puso en pie `POST /admin/partes/:id/firmar` con la
  validación de `signatureData` y sin columna donde guardarlo (2-sep-2026).
* **Hasta:** el día que se aplique `docs/sql/scrum-653-dos-firmas.sql` a cada base y se mergee este
  PR. Mientras tanto, **todo parte que se firme queda sin trazo**.

**El recuento, medido** (producción, sólo lectura):

```
CONTROL:  { control_ve_la_tabla: 1, ya_existe_signature_url: 0 }
RECUENTO: { partes_en_total: 0, estado_firmado: 0, con_fecha_de_firma: 0,
            con_nombre_de_firmante: 0, con_sello: 0 }
```

`control_ve_la_tabla = 1`, así que el cero es un cero y no ceguera. **La tabla está vacía.**

⚠️ **`dev` y `staging` NO están medidos.** `dev` no responde (no hay PostgreSQL en esta máquina,
`P1001`) y de `staging` no tengo la cadena. **No se declara nada sobre ellas**: «no medido» y
«cero» no son lo mismo, y esa distinción es justo la que hace que el intervalo se pueda
reconstruir después.


---

# Censo de nombres · 2ª vuelta: la pregunta de Javier, respondida midiendo

**Medido contra:** `origin/main` = `3047b2c9f98e44f2a69ac7dd1ab8f0997e6fb9d2` · 2026-09-03T15:05:00+02:00
**Leído de `prisma/schema.prisma`.** Selección por **límite de palabra sobre el nombre en
snake_case** — nunca por prefijo ni substring: así `firma` no puede casar dentro de `confirmado`.

> «Cuatro columnas de firma junto a las que ya existen no es una migración: es una BIFURCACIÓN.»

Esa era la pregunta. **Se mide, no se opina.**

## ① `partes_trabajo` con las cuatro propuestas — nueve campos

| Campo Prisma | Tipo | Columna |
|---|---|---|
| `firmadoAt` | `DateTime?` | `firmado_at` |
| `firmadoPorNombre` | `String?` | `firmado_por_nombre` |
| `firmadoPorCalidad` | `String?` | `firmado_por_calidad` |
| **`signatureUrl`** | `String?` | **`signature_url`** `@db.Text` |
| **`signatureTecnicoUrl`** | `String?` | **`signature_tecnico_url`** `@db.Text` |
| **`firmadoTecnicoAt`** | `DateTime?` | **`firmado_tecnico_at`** |
| **`firmadoTecnicoNombre`** | `String?` | **`firmado_tecnico_nombre`** |
| `contenidoHash` | `String?` | `contenido_hash` |
| `contenidoVersion` | `Int?` | `contenido_version` |

*(En negrita, las cuatro que añade el ALTER. Las otras cinco ya están en las tres bases.)*

## ② `albaranes` — el linaje, siete campos

| Campo Prisma | Tipo | Columna |
|---|---|---|
| `signatureUrl` | `String?` | `signature_url` `@db.Text` |
| `firmadoAt` | `DateTime?` | `firmado_at` |
| `firmadoPorNombre` | `String?` | `firmado_por_nombre` |
| `firmadoPorCalidad` | `String?` | `firmado_por_calidad` |
| `firmaToken` | `String?` | `firma_token` |
| `enviadoParaFirmaAt` | `DateTime?` | `enviado_para_firma_at` |
| `evidenciaFirma` | `Json?` | `evidencia_firma` |

### 🔴 Y AQUÍ ESTÁ LA RESPUESTA A LO DEL INGLÉS Y EL CASTELLANO

**`albaranes` YA mezcla los dos idiomas en la MISMA tabla, y con una regla:**

> **la IMAGEN se llama `signature_url` (inglés). La METADATA va en castellano (`firmado_*`).**

Y el barrido del esquema entero lo confirma: la imagen de una firma se llama `signatureUrl` en
**`Quote`** y en **`Albaran`** — dos documentos, un nombre, cero excepciones.

Así que la mezcla **no es una tercera convención que yo invente: es LA convención que ya existe.**
Lo que sería inventar una tercera es lo que yo tenía escrito ayer —`firma_tecnico_url`— y por eso
se corrigió antes de aplicar nada.

## ③ ¿HAY BIFURCACIÓN? — una fila por (rol × dato)

| Rol · dato | Columna(s) |
|---|---|
| CLIENTE · imagen | `signature_url` |
| CLIENTE · fecha | `firmado_at` |
| CLIENTE · nombre | `firmado_por_nombre` |
| CLIENTE · calidad | `firmado_por_calidad` |
| TÉCNICO · imagen | `signature_tecnico_url` |
| TÉCNICO · fecha | `firmado_tecnico_at` |
| TÉCNICO · nombre | `firmado_tecnico_nombre` |

**UNA columna por dato y por rol. Cero duplicadas. NO hay bifurcación.**

Lo que hay es **una ranura de cliente a la que le faltaba la imagen** — y las cuatro columnas la
COMPLETAN y añaden la del técnico, que no existía. Es exactamente lo que dice Javier que hay que
hacer: **darle superficie al mecanismo que existe a medias, no poner un segundo juego al lado.**

⚠️ **Mi propio instrumento dio un FALSO POSITIVO y lo digo:** marcó «BIFURCACIÓN» en
`contenido_hash` + `contenido_version` porque los clasificó los dos como «sello» del mismo rol. Son
**dos datos distintos del documento** —la huella y la versión con que se calculó—, no dos ranuras
para lo mismo, y además no son de ningún firmante. El fallo es de mi clasificador, no del esquema.

## ④ Qué escribe cada ruta — el CÓDIGO, no el nombre

Acotando cada ruta con paréntesis balanceados sobre el código blanqueado:

```
CLIENTE  POST /admin/partes/:id/firmar
   estado: 'firmado',
   firmadoAt,
   firmadoPorNombre: nombre.nombre,
   firmadoPorCalidad: calidad.valor,
   signatureUrl: signatureData,
   contenidoHash,
   contenidoVersion: parte.contenidoVersion ?? PARTE_CONTENIDO_VERSION_ACTUAL,

TÉCNICO  POST /admin/partes/:id/firmar-tecnico
   estado: 'firmado',
   firmadoTecnicoAt: new Date(),
   firmadoTecnicoNombre: nombre.nombre,
   signatureTecnicoUrl: signatureData,
   contenidoHash,
   contenidoVersion: parte.contenidoVersion ?? PARTE_CONTENIDO_VERSION_ACTUAL,
```

**La regla que sale de la asignación, no del nombre:**

> **Las columnas SIN `tecnico` son las del CLIENTE.** La ausencia del rol *es* el rol.

Es la respuesta literal a la pregunta de Javier — «cuál de las cuatro es la del cliente»: **una,
`signature_url`**, y se sabe porque es la que escribe la ruta `/firmar`.

Y en esta tabla los nombres **ya mintieron una vez**: `signatureData` se validaba y se tiraba. Por
eso la respuesta sale del `data:` de cada `update`, no del nombre.

## ⑤ Las opciones, con su coste y con la pregunta que decide

| Opción | Qué | Coste | ¿Toca columnas EXISTENTES? |
|---|---|---|---|
| **A · propuesta** | las cuatro tal como están | el rol del cliente es IMPLÍCITO (ausencia de `tecnico`) | **NO. Aditivo puro** |
| B | renombrar las nuevas al castellano (`firma_tecnico_url`) | rompe el linaje de la IMAGEN, que en `Quote` y `Albaran` es `signature_url`: sería la tercera convención | NO, pero **empeora** |
| C | sufijo de rol en TODAS: `firmado_cliente_at`, `firma_cliente_url`… | simetría perfecta | **SÍ: renombra 3 columnas con datos en 3 bases** |
| D | `_cliente` sólo en la nueva del cliente | dos reglas dentro del MISMO rol (`signature_cliente_url` junto a `firmado_at`) | NO, pero incoherente |

### 🔴 La opción C obliga a tocar columnas existentes

**Renombrar una columna con datos en tres bases es otro ticket y otra conversación. Paro ahí.**
No se propone, no se prepara y no entra en el lote de Javier.

**Se propone A**, y el coste que paga —que el rol del cliente sea implícito— se compensa donde se
lee: el serializador expone `firmoElCliente`, `firmoElTecnico` y `firmasCompletas` **derivados**, y
el modelo lleva el comentario que dice qué juego es de quién.

### Lo que NO se añade, y por qué

`firma_token` y `enviado_para_firma_at` son del albarán porque tiene **firma remota** (un enlace al
cliente). El parte se firma en la obra, en el móvil: un token para un enlace que nadie manda es
superficie sin uso. `evidencia_firma` tampoco — el parte no pasa por `buildFirmaEvidencia`, y poner
la columna sin el mecanismo es prometer una evidencia que no se recoge.

## ⑥ El fichero, y lo que sigue pendiente en producción

**`docs/sql/scrum-653-dos-firmas.sql`** — rama `scrum-653-dos-firmas`.
Clasificador: **4 sentencias · 0 RECHAZADAS · 0 borrados · `ok=true`**.

Y como el lote va junto, medido en **producción** (sólo lectura) lo que falta de lo mío:

```
{ control_ve_la_tabla: 1, columnas_de_la_tabla: 24,
  idx_685b_unico: 0,
  col_signature_url: 0, col_signature_tecnico_url: 0,
  col_firmado_tecnico_at: 0, col_firmado_tecnico_nombre: 0 }
```

`control_ve_la_tabla = 1`, así que los ceros son ceros. **Pendientes de aplicar, los dos:**

| Fichero | Qué | Estado en prod |
|---|---|---|
| `docs/sql/scrum-685b-parte-numero-unico.sql` | índice único `(merchant_id, numero)` | **sin aplicar** |
| `docs/sql/scrum-653-dos-firmas.sql` | las 4 columnas de las dos firmas | **sin aplicar** |

⚠️ El de 685b lleva **fichero de comprobación previa**: `docs/sql/scrum-685b-comprobar-duplicados.sql`
se ejecuta ANTES en cada base, y si devuelve filas esa base no se toca.

⚠️ **`dev` y `staging` NO están medidos**, y no se declara nada de ellas. «No medido» y «cero» no
son lo mismo.

---

# SCRUM-653b · Los cinco textos de las dos firmas, firmados — y el aviso que ya dice CUÁL falta

**Medido contra:** `origin/main` = `1304643497934441f88950e441182b7e344dbb57` · 2026-09-04T19:06:52+02:00
**Medido en:** host `DESKTOP-T5MONF5` · rama `scrum-653-dos-firmas`

El fundador firmó los cinco textos que la rama traía con marcador. Constan en
`docs/microcopy/2026-09-04-SCRUM-653-las-dos-firmas.md`, **con su firma** — que es exactamente el
defecto que SCRUM-726 acaba de cerrar: registrarlos como del asesor habría hecho que el propio guard
dejara de contarlos en cuanto el 726 entre en main.

**🔴 EL CUARTO NO SE APROBÓ COMO ESTABA: se partió en DOS.** La rama traía una sola clave,
`faltaUnaFirma` → «Falta una firma para cerrar el parte.», y **no dice cuál falta**. El control
negativo de este mismo ticket exige que se diga: el técnico está de pie en un cuarto técnico con el
móvil en la mano, y un aviso que no nombra lo que falta le obliga a adivinar.

Ahora hay `faltaLaFirmaDelCliente` y `faltaLaFirmaDelTecnico`, y **el aviso nombra la que falta — si
faltan las dos, se dicen las dos**. Por eso `PARTE_TEXTOS` pasa de 31 a **32**: 27 firmados en
SCRUM-720 **+ 5**, no + 4. Un 31 habría significado sustituir en vez de partir.

**La puntuación es deliberada:** etiquetas de estado **sin** punto final, frases **con** punto. Dos
de los textos cambiaron por eso — «Firmado por el cliente.» y «Firmado por el técnico.» lo pierden.

## Verificación, sobre el DOM renderizado

- **CERO marcadores** en los tres estados: borrador 0 · firmado 0 · sin líneas 0.
- **Los 32 textos, enumerados uno a uno**, ninguno con marcador. Los 27 de SCRUM-720 siguen todos:
  añadir cinco no perdió ninguno.
- `TEXTOS_ASIGNADOS` sigue con **5**.
- Las cuatro clases de SCRUM-720 —`parte-bloque`, `parte-tipo`, `parte-anadir`,
  `parte-quitar-linea`— **tienen regla en `styles.css`**, comprobado con el banco que arregló
  SCRUM-666: la pregunta no es «¿tiene clase?» sino «¿esa clase existe en la hoja?».
- **BUILD limpio (exit 0, 0 errores) ANTES de mirar los tests**, que es la lección del día: 27 tests
  pasaron una vez contra un `dist/` viejo.
- Los dos guards de SCRUM-720 en **verde**, y no porque miren menos: porque los textos están
  firmados. No se tocó ni un umbral.

**El suelo del instrumento estaba probado de antes**: antes de resolver el conflicto veía 1 marcador
y 3 marcas de git, así que este cero es un dato y no una ceguera.
