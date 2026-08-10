# SCRUM-431 · El sobre lee datos VIVOS al verificar — censo (parcial: 2 de 4) y propuesta

**Fecha:** 10-ago-2026 · **Carril:** fiscal/evidencias · **Gate:** sin gate — esta tarea **solo lee**

**Medido contra:** `origin/main` = `ca15d694f80bb72758470a346f611b471037c68b` · 2026-08-10T15:25:36+01:00

> **NO SE HA CONSTRUIDO NADA** y **NO SE HA TOCADO EL VERIFICADOR** (regla 38: leerlo no es STOP,
> modificarlo sí). Ni el sellado, ni `computeAlbaranContentHash`, ni el camino de emisión, ni
> `prisma/schema.prisma`, ni ninguna base. **Regla 29: no se altera ninguna evidencia emitida.**
>
> **Se entrega con 2 de los 4 censos hechos.** Los otros dos necesitan base de datos y van con la
> consulta escrita para que la corra quien tenga la credencial (§4). Se escribe igual: una medición
> que solo vive en el contexto de una sesión desaparece al cerrarla.

---

## 1 · Censo 3 · **`obra` tiene CUATRO hermanos** — enumerados, no contados

La pregunta era cuántos campos MÁS del sobre se leen **en vivo** al verificar. Se enumeran los
catorce de `FuentesContenido`, con de dónde los saca el adaptador
(`albaranBarrido.ts:105-124`) y en qué recetas entran (`albaranVerificacion.ts:170-244`).

**«En vivo» = sale de una fila MUTABLE que no es el albarán.** La fila del albarán está congelada
desde que se firma (`albaranes.routes.ts:406-408`, 409 `albaran_locked`), así que sus campos no
pueden cambiar bajo el sello; los de otras tablas, sí.

| Campo del sobre | De dónde sale | ¿VIVO? | v:1 | v:2 |
| --- | --- | --- | --- | --- |
| `numero` · `fecha` · `modoValoracion` · `lineas` · `notas` | el propio `Albaran` | no | ✅ | ✅ |
| `lugarEntrega` (→ `obra` en v:2) · `fechaEntrega` · `firmadoPorNombre` · `firmadoPorCalidad` | el propio `Albaran` | no | — | ✅ |
| 🔴 **`jobDireccion`** (→ `obra` en v:1) | `job?.direccion` — **Job** | **SÍ** | ✅ | — |
| 🔴 **`referenciaTrabajo`** | `job?.titulo` — **Job** | **SÍ** | ✅ | ✅ |
| 🔴 **`cliente`** | `customer?.legalName \|\| customer?.name` — **Customer** | **SÍ** | ✅ | ✅ |
| 🔴 **`emisor`** | `merchant?.legalName \|\| merchant?.name` — **Merchant** | **SÍ** | ✅ | ✅ |
| 🔴 **`emisorNif`** | `merchant?.taxId` — **Merchant** | **SÍ** | ✅ | ✅ |

### 🔴 Y lo que cambia el tamaño del problema: **tres de los cuatro están en LAS DOS versiones**

`obra` fue el caso fácil: SCRUM-300 lo arregló **cambiándole la fuente y subiendo la versión**, así
que v:2 ya no lo lee. **Con los otros cuatro campos esa salida no existe**: `referenciaTrabajo`,
`cliente`, `emisor` y `emisorNif` se leen igual en v:1 y en v:2. Subir a v:3 no protegería a los
sobres ya firmados, que es justo lo que hay que proteger.

### 🔴 Y no es un riesgo futuro: `referenciaTrabajo` **ya tiene escritor vivo**

| Campo vivo | ¿Se puede escribir hoy desde el producto? |
| --- | --- |
| `Job.titulo` | **SÍ, desde el 8-ago** — `jobs.routes.ts:598` (SCRUM-317, «el pro le pone NOMBRE al Trabajo»), con su campo en la pantalla de Datos |
| `Customer.name` / `legalName` | **SÍ** — `customerAdmin.ts:60`, `updateMany` con `data` abierto |
| `Merchant.legalName` / `taxId` | **SÍ** — `app.ts:667` y `:825` |
| `Job.direccion` | hoy **no**; lo abre SCRUM-424, que por eso lleva su propio candado |

> **Dicho sin rodeos: renombrar un Trabajo, corregir la razón social de un cliente o arreglarle una
> errata al NIF del emisor cambia el hash recalculado de TODOS los albaranes firmados que cuelgan
> de ellos — en las dos versiones de sobre.** El verificador diría «EL CONTENIDO YA NO ES EL QUE SE
> FIRMÓ» sobre documentos que nadie ha tocado.
>
> Y son operaciones **normales y legítimas**: poner bien un nombre no es manipular una entrega.

**Qué tan vivo está el camino:** `verificarSobre` sí se usa de verdad —
`src/modules/fiscal/evidencias/paquete.repo.ts:19,95` lo llama para el paquete de evidencias —
así que esto no es teórico. (`recomputarHashDeEvidencia` / `verificarEvidenciaAlbaran`, en cambio,
**no tienen ni un llamador** fuera de `albaran.service.ts`: ver §2.)

---

## 2 · Censo 4 · Una versión desconocida: **dos caminos y solo uno acierta**

| Camino | Qué hace con una `v` que no conoce | Veredicto |
| --- | --- | --- |
| **`verificarSobre`** (SCRUM-369, `albaranVerificacion.ts:290-307`) | `v` ausente o no numérica → `version_ausente`. `v` sin receta → **`version_no_soportada`**, y lo dice: *«NO se aproxima con la más parecida: aplicar la regla de otra versión daría "no coincide" sobre un albarán posiblemente intacto»* | ✅ **correcto** |
| 🔴 **`obraSegunVersion`** (`albaran.service.ts:475-481`) | `if (version === 1) return jobDireccion; return lugarEntrega;` → **cualquier otra cosa cae en la rama de v:2, en silencio**: `3`, `99`, `null`, `undefined`, `NaN` y hasta la cadena `'2'` | 🔴 **fallback mudo** |

**Dónde importa:** `obraSegunVersion` la usa `recomputarHashDeEvidencia` (`:507`) **con la versión
del sobre guardado**. Si algún día existiera un v:3 —o si un sobre trajera la `v` corrupta—, ese
camino devolvería un booleano **incorrecto y sin avisar**, mientras el verificador de SCRUM-369
sobre el mismo documento diría, correctamente, «no sé recalcular esta versión».

**Atenuante medido, y conviene decirlo:** `recomputarHashDeEvidencia` y `verificarEvidenciaAlbaran`
**no tienen ningún llamador** hoy fuera de su propio fichero. El camino vivo es el estricto. Así que
esto es una **trampa cargada, no una herida abierta** — y es más barato desarmarla ahora que el día
que alguien la conecte.

---

## 3 · Lo que se deja ESCRITO ya, donde lo vea quien toque `Job`

El acoplamiento no estaba declarado en ningún sitio del lado de `Job`: quien fuera a escribir
`direccion` —o cualquier otro de los cuatro— no tenía forma de enterarse. Se declara en
**`src/modules/jobs/domain/job.service.ts`**, junto al `create` del Trabajo, que es por donde pasa
quien toca este modelo.

**No va en `prisma/schema.prisma`** (es del fundador y está fuera de alcance) **ni en un documento
aparte**, que es donde no lo lee nadie.

---

## 4 · Censos 1 y 2 · **PENDIENTES — necesitan base de datos**

Esta sesión no los ha corrido. Se dejan con la consulta escrita, y con el suelo dentro.

### Censo 1 · Cuántos albaranes v:1 firmados hay (staging y dev POR SEPARADO)

```sql
-- Por versión de sobre. Producción NO: la mide Javier.
SELECT COALESCE((evidencia_firma->>'v')::text, 'SIN_VERSION') AS version,
       COUNT(*) AS albaranes
FROM albaranes
WHERE estado = 'firmado'
GROUP BY 1
ORDER BY 1;
```

🔴 **SUELO, y hay que correrlo ANTES de creerse el resultado de arriba:**

```sql
SELECT COUNT(*) AS firmados_totales,
       COUNT(evidencia_firma) AS con_sobre,
       COUNT(*) FILTER (WHERE evidencia_firma->>'v' IS NULL) AS sin_version_legible
FROM albaranes WHERE estado = 'firmado';
```

**Si `firmados_totales` es 0, el resultado es «no se pudo mirar», no «no hay v:1».** Y si
`sin_version_legible` > 0, esos no se saben clasificar y **cuentan como riesgo**, no como cero.

### Censo 2 · 🔴 Si TODOS los v:1 se sellaron con `obra: null` — **hoy está SUPUESTO**

La premisa de la que cuelga todo («los v:1 llevan la obra vacía porque nadie escribía el campo») es
una **deducción**, no una medición. Y **no se puede leer del sobre**: el sobre guarda el `contentHash`,
no el valor de `obra`. Hay que **probarlo recalculando**, y por eso esto es un script y no un SQL:

> Para cada albarán v:1 firmado, recalcular su hash **dos veces** con la receta v:1 **congelada**
> (`RECETAS_POR_VERSION[1]`, importada, nunca reimplementada):
> **(A)** con `jobDireccion = null` · **(B)** con `jobDireccion = <el Job.direccion de hoy>`.
>
> * cuadra **A** → se selló con `obra: null` ✅
> * cuadra **B** → se selló **CON dirección** 🔴 **la premisa es falsa y el arreglo cambia entero**
> * no cuadra ninguna → ese albarán **ya** no verifica, por otra causa: hallazgo aparte

**Suelo del propio script:** si no consigue leer los sobres, o si no sabe decidir la versión de
alguno, **falla declarándose ciego**. «Cero v:1 en riesgo» y «no supe mirar» no pueden dar el mismo
resultado: el segundo nos deja tranquilos justo antes de romper firmas emitidas.

**Lo escribo en cuanto tenga el visto bueno**, con `parseBDSegura` de `scripts/_db-guard.mjs` para
la URL (nunca parseo a mano) y **solo lectura**.

---

## 5 · Propuesta — **para aprobar antes de escribir nada** (no aplicada)

Ordenadas de menos a más invasiva. **Ninguna toca el verificador ni las recetas congeladas.**

| # | Qué | Coste | Qué cierra |
| --- | --- | --- | --- |
| **P1** | **Declarar el acoplamiento donde se toca `Job`** | ya hecho (§3), cero riesgo | que el siguiente no se entere |
| **P2** | **Quitar el fallback mudo de `obraSegunVersion`**: que una versión sin regla conocida **lance** en vez de caer a v:2, igual que hace `verificarSobre` | pequeño, pero **toca un fichero del camino de sellado → STOP, decides tú** | el censo 4 |
| **P3** | **Candado como el de SCRUM-424 para los otros cuatro campos vivos**: `Job.titulo`, `Customer.name/legalName`, `Merchant.legalName/taxId` no se pueden cambiar si cuelga de ellos un albarán firmado | medio, y toca tres rutas de otros carriles | el censo 3 — pero **es el peor remedio**: prohíbe corregir el nombre de un cliente para siempre |
| **P4** | 🟢 **CONGELAR EL CONTENIDO EN EL SOBRE**: que al firmar se guarden dentro de `evidenciaFirma` los valores usados (`obra`, `referenciaTrabajo`, `cliente`, `emisor`, `emisorNif`), y que el verificador los lea **de ahí** y no de las filas vivas | el mayor: sobre **v:3** + campo nuevo en el JSON (aditivo) + su receta | **los censos 3 y 4 a la vez**, y para siempre |

> **Mi recomendación, con su motivo:** **P4 es la única que ataca la causa.** Las otras tres tratan
> el síntoma, y P3 lo trata cobrando un precio que el producto no debería pagar: un profesional que
> corrige la razón social de un cliente no está manipulando una entrega, y prohibírselo convertiría
> el sello en un estorbo — que es como acaban desactivándose.
>
> **Un sello que depende de filas que siguen vivas no prueba lo que dice probar.** El contenido
> firmado tiene que viajar CON la firma; hoy viaja media parte.
>
> ⚠️ **P4 no arregla el pasado.** Los sobres v:1 y v:2 ya emitidos seguirán leyendo filas vivas: sus
> recetas están congeladas y **no se tocan** (regla 29). P4 detiene la sangría; lo ya emitido se
> protege con candados o se asume, y eso es decisión tuya con el censo 1 delante.

---

## 6 · Lo que no se ha tocado

El verificador · las recetas congeladas · el sellado · `computeAlbaranContentHash` · el camino de
emisión · `prisma/schema.prisma` · ningún `.env` · producción · ninguna base de datos.
