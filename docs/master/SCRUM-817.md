# SCRUM-817 · El detalle del Trabajo se ordena por lo que se hace en él

**Medido contra:** `origin/main` = `af08201502a3978a484de3933132dfcdf26df790` · 2026-09-07T14:20:00+02:00
**Rama:** `scrum-817-detalle-del-trabajo`

---

## 1 · PASO 0 · cuatro medidas, y tres cambian el encargo

### ① «Incluir precios en el parte» NO es del parte — es del ALBARÁN. **PARO aquí.**

Las dos apariciones del rótulo (`jobDetailView.js:1166` y `:2106`) gobiernan
**`Albaran.modoValoracion`**, no el `ParteTrabajo`. La palabra «parte» ahí es herencia de cuando el
albarán era lo único que había, y el propio código lo avisa:

> «⚠️ OJO CON EL NOMBRE: la casilla de precios de esta misma barra usa la palabra «parte» para
> referirse al ALBARÁN […] Este botón abre el `ParteTrabajo` de verdad: otro documento, otra tabla.»

**Cuándo se aplica:** su valor se lee **en el instante de pulsar «+ Nuevo albarán»** (`:1396`,
`valoradoCheck.checked ? 'VALORADO' : 'SIN_VALORAR'`). Y no es cosmético: en `SIN_VALORAR` la IA no
copia precio ni IVA, el backend rechaza una línea con precio y facturar devuelve 409.

🔴 **Para la coordinación con SCRUM-818: la casilla NO puede viajar con el botón del parte.** Iría
pegada a un documento que no gobierna. Hay test que la mantiene junto a «+ Nuevo albarán».

### ② «Javier P.» y «Javier Pereira» son **dos filas distintas**. Reportado, no tocado.

Medido en el esquema, sin tocar la base:

* `JobAssignee` tiene **`@@id([jobId, teamMemberId])`** — el mismo técnico **no puede** estar dos
  veces en el mismo trabajo.
* El nombre vive en `TeamMember.name`, **una fila una grafía**: la misma fila no puede pintarse de
  dos maneras.
* `TeamMember.email` es `@unique`.

⇒ **Dos filas de `team_members`, con dos correos distintos.** Si son la misma persona es un dato que
alguien metió dos veces, y **fusionar o borrar un usuario del equipo no se hace desde un ticket de
maqueta** (regla 9). Se reporta y se deja.

### ③ «RESPONSABLE» **puede** tener otro valor. **Se queda.**

`responsableName = job.operario?.name || <nombre del negocio>`. «Epipe» sale **sólo** porque en este
trabajo `operarioId` es `null`. En cuanto un empleado redacte un presupuesto, ahí sale su nombre.

### ④ 🔴 En esta pantalla **no hay agenda**, así que el bloque 1 no puede llamarse «Quién y cuándo»

Lo dice `jobsView.js:220`, y lo confirma el barrido:

> «`jobDetailView.js` tiene CERO —ni agendar, ni empezar, ni terminar, ni cerrar— y `scheduledAt` no
> aparece ni una vez en él: esta lista era el único [sitio]».

Añadir aquí el «cuándo» **no es reordenar: es una función nueva** con su control y su microcopy. El
bloque sube con **el rótulo que ya tenía**: «Quién ejecuta este trabajo» (`jobAsignados.js:36`).
**Cero rótulos nuevos en todo el ticket.**

## 2 · El reorden

| antes | después |
|---|---|
| Tipo de trabajo | **Quién ejecuta este trabajo** |
| Albaranes | Albaranes |
| Notas internas | Tipo de trabajo |
| Gastos | Datos (nombre · dirección) |
| **Datos** → nombre · dirección · **quién ejecuta** ⟵ *lo último* | Notas internas |
| | Gastos de este trabajo |

Los cinco `appendChild` vivían repartidos por 300 líneas y el orden de la pantalla no se podía leer
sin recorrerlas todas — que es **cómo «quién ejecuta» acabó el último sin que nadie lo decidiera**.
Ahora están juntos y el orden **es** esa lista.

## 3 · 🔴 El control que decide: ninguna función perdida

No el aspecto: **las acciones**, contadas sobre el DOM montado.

| | antes | después |
|---|---|---|
| acciones | **18** | **18, las mismas** |
| nodos | 128 | 129 *(el `div` de la sección nueva, y nada más)* |

Comparado **por lista, no por número** — un número deja pasar «he perdido una y he ganado otra». El
inventario identifica cada acción por su **gancho** (`data-*`, `id`, `aria-label`), no por su
posición ni por su texto: si fuera el texto, cambiar un rótulo aprobado contaría como perder una
función; si fuera la posición, reordenar contaría como perderlas todas.

**Y el rojo, comprobado:** intercambiando dos `appendChild`, el test del orden cae.

## 4 · Capturas y suelo

`scripts/capturar-detalle-trabajo.mjs` — navegador de verdad, `page.setViewport({width:390})` y
`{width:1280}`, sirviendo los mismos scripts que declara el índice **en su orden**. 126 elementos
antes, 127 después, a los dos anchos. **El banco se sube: no se queda en el scratchpad.**

**SUELO del encargo, medido:** trabajo sin albaranes, sin gastos, sin técnicos y sin dirección → **78
nodos**, cada bloque dice lo suyo («Todavía no hay gastos en este trabajo», «Aún no hay
documentos…») y **cero marcadores `[PENDIENTE microcopy oficial]` en el DOM**. `jobAsignados.js`
declara uno (`MARCA_ASIGNADOS`) pero **sólo lo exporta, nunca lo pinta** — comprobado sobre el árbol.

## 5 · ⚠️ Un guard de otro carril, reportado y no tocado

`scrum370-gastos-del-trabajo` acota su comprobación a **2.600 caracteres desde el texto «Gastos de
este trabajo»**. Mi bloque de `appendChild` puesto ahí en medio le sacó su `.catch(` de la ventana y
lo puso **rojo sin que se hubiera tragado nada**.

🔴 **Es un anclaje por POSICIÓN, de la familia de SCRUM-710**, y es de otro carril: se reporta, no se
toca. **Yo me moví, no él** — el bloque se recolocó después de la carga de gastos y su ventana queda
en paz. Si algún día alguien añade veinte líneas ahí, volverá a caer por el mismo motivo.

## 6 · Números

**BUILD exit 0** · suite **5894 · 5792 pass · 0 fail · 102 skipped** · `guards:entrada` **21/21**.

## ⛔ No tocado

`src/` · `prisma/schema.prisma` · el camino de emisión · la casilla de precios y su momento de
aplicación · los usuarios del equipo · `scrum370` · ni un `style=` en línea nuevo · ni un rótulo
nuevo.

## 📌 Pendiente de la coordinación con SCRUM-818

Dónde acaba viviendo el **botón del parte** dentro de «Albaranes». Hoy sigue donde estaba. Lo que sí
queda decidido y con test: **la casilla de precios no se mueve de «+ Nuevo albarán»**.
