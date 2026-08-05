# SCRUM-309 · G0: el Trabajo, MEDIDO — seis preguntas, cero construcción

**Fecha:** 5-ago-2026 · **Carril:** A · **Gate:** informe, no construye · **Toca código:** NO

**Medido contra:** `origin/main` = `de6abbd325419a9e85d60cf13b1588596125d66b` · 2026-08-05T09:15:41+02:00

> Todo lo de abajo lleva su **ancla `fichero:línea`**. Lo que no se ha podido medir va marcado
> **[NO SE PUEDE MEDIR HOY]** con el motivo. Los censos están **derivados por AST**, con suelo
> probado: con el umbral por encima de lo que hay, el derivador **falla** en vez de devolver un
> cero que se leería como «no hay».

---

## 1 · Los dos ejes de estado

**La epic acierta en que son dos ejes independientes, y falla en el contenido de los dos.**

### Eje TRABAJO — son CINCO estados, no cuatro

`job.service.ts:9` — `JOB_STATES`, unión cerrada:

```
pendiente_agendar → agendado → en_curso → terminado → cerrado
```

La epic decía «sin agendar → agendado → en curso → terminado». **Falta `cerrado`**, que es
terminal. Y los nombres del modelo son `snake_case`, no los de pantalla.

Transiciones (`job.service.ts:22-28`), y no son lineales del todo:

| desde | puede ir a |
|---|---|
| `pendiente_agendar` | `agendado` |
| `agendado` | `agendado` (re-agendar), `pendiente_agendar` (des-programar), `en_curso` |
| `en_curso` | `terminado` |
| `terminado` | `cerrado` |
| `cerrado` | — (terminal) |

### Eje COBRO — no es un estado: es una FUNCIÓN

**No existe ninguna columna de estado de cobro.** `estadoCobroFor(cobrado, aceptado)`
(`job.service.ts:212-218`) lo calcula a partir de dos `Decimal` del propio Job (`totalCobrado`,
`totalAceptado`):

```
a > 0 && c >= a  → 'Pagado'
c > 0            → 'Parcial'
resto            → 'Pendiente'
```

Esto pesa más que un matiz de nombres: un eje tiene tabla de transiciones y auditoría; el otro
es aritmética que se recalcula en cada lectura. **No se pueden diseñar como si fueran
simétricos.**

### ¿Son independientes? SÍ, y se comprueba por ausencia

**Ninguna transición consulta el dinero** (`TRANSITIONS` no menciona `totalCobrado`) y
**`estadoCobroFor` no consulta el estado** (solo recibe dos números).

### ⚠️ «Terminado y sin cobrar»: SÍ existe, y es trivialmente alcanzable

Se llega a `terminado` desde `en_curso` **sin que nada mire el cobro**. Con `totalCobrado = 0`
el eje de cobro da `Pendiente`. Es el estado que el negocio necesita ver y **la tabla de un solo
eje lo escondía**: confirmado.

### 🔴 Y una combinación que NO es alcanzable, y la epic no la contempla

**`Pagado` es imposible si `totalAceptado` es `null` o `0`.** La fórmula exige `a > 0`, y
`totalAceptado` es `Decimal?` en el modelo. Un Trabajo sin presupuesto aceptado al que se le
cobra dinero se queda en **`Parcial` para siempre**, por mucho que se cobre.

No está declarado como defecto en ningún sitio: **sale de componer el nullable con la fórmula**,
que es el tipo de cosa que ningún diff enseña.

---

## 2 · Censo derivado de las acciones — **37**

Derivado por AST sobre `public/dashboard/js/jobDetailView.js` (1522 líneas).

**⚠️ Mi primer derivador dio 12 y estaba mal.** Solo miraba la fábrica `mkBtn(...)`
(`jobDetailView.js:419`), y los botones de cabecera **no la usan**. Hay **tres vías**, y un censo
que mira una de tres es exactamente el defecto que este ticket existe para evitar:

| vía | nº |
|---|---|
| `document.createElement('button')` | 23 |
| `mkBtn(label, fn)` | 12 |
| `<button>` en plantilla | 2 |
| **total** | **37** |

**Suelo probado:** con el umbral puesto por encima de lo que hay, el derivador **falla**
diciendo cuántas vio, en vez de devolver un número que se leería como censo bueno.

### Las acciones con guarda, y su condición

Las que no aparecen aquí no tienen condición: se pintan siempre.

| L | acción | aparece cuando |
|---|---|---|
| 234 | *(CTA del héroe, etiqueta dinámica `nextAct.label`)* | `nextAct` |
| 477 | `+ Añadir gasto` | `job.quote?.id != null && typeof openExpenseModal === 'function'` |
| 785 | `🎤 Dictar el parte` | `vozDisponible` |
| 891 | `Añadir al parte` | `vozDisponible` |
| 1260 | `Emitir` | `alb.estado === 'borrador'` |
| 1274 | `Firmar` | `!borrador` **y** `alb.estado === 'emitido'` |
| 1291 | `Enviar para firmar` | `!borrador` **y** `alb.estado === 'emitido'` |
| 1319 | `Facturar parte` / `Facturar lo que queda` | `!borrador` **y** `!emitido` **y** `alb.modoValoracion === 'VALORADO' && !alb.facturado && quedaPorFacturar` |
| 1330 | `Enviar por WhatsApp` | `!borrador` **y** `!emitido` |
| 1373 | `Marcar como PAGADA` | `!paid` |
| 1433 | `Recordar pago` | `!paid` **y** `job.customer?.phone` |
| 1446 | `Reenviar por WhatsApp` | `!paid` |
| 1503 | `Ver presupuesto` | `job.quote` |

### 🔴 El dato que más cambia el diseño

**Ninguna de las 37 condiciones mira `job.status`.** Las guardas miran el estado del **albarán**
(`alb.estado`), el del **cobro** (`!paid`) o la existencia de datos (`job.quote`, `phone`).

Una tabla «acciones por estado del Trabajo» **no se puede escribir hoy transcribiendo nada**: el
estado del Trabajo no gobierna ninguna acción de esta vista. Si el diseño la quiere, es una
**decisión nueva**, no una transcripción.

> **[PARCIALMENTE MEDIBLE]** Las 2 acciones en plantilla (`jobDetailView.js:800,808`) viven
> dentro de literales de cadena: su condición **no es derivable por AST** sin ejecutar el render.
> Se declaran como tales en vez de inventarles una guarda.

---

## 3 · «Iniciar precio en el parte» — **ese literal NO EXISTE**

Medido: `Iniciar precio`, `precio en el parte` e `Iniciar` sobre `public/` y `src/` devuelven
**0** los tres.

**Lo que hay de verdad en esa cabecera** (`jobDetailView.js:458-464`) es una **casilla**, no un
botón:

```
<label> [checkbox] Incluir precios en el parte
```

- **Etiqueta real:** `Incluir precios en el parte` (`jobDetailView.js:463`)
- **Qué hace:** al crear un albarán, `modoValoracion = valoradoCheck.checked ? 'VALORADO' :
  'SIN_VALORAR'` (`jobDetailView.js:607`)
- **De dónde viene:** SCRUM-65. El modo queda **congelado desde `emitido`** y es ajustable
  mientras el albarán siga en borrador (`jobDetailView.js:456-457`)
- Debajo lleva un texto fijo: `El parte sigue sin ser una factura.` (`jobDetailView.js:495`)

**El `[SUPUESTO]` sobre `modoValoracion` era CORRECTO.** Lo que estaba mal era el artefacto —una
casilla leída como botón— y la transcripción de la etiqueta. Mismo tipo de error que el «Paquete
de etiqueta» de B2: **una captura no es código**.

---

## 4 · ¿Hay campo de descripción? **SÍ — y ya está ocupado**

`Job.titulo String?` existe en el modelo.

**Pero no está vacío esperando a G2: se autogenera.** `job.service.ts:58`:

```js
const titulo = 'Presupuesto #' + num + (quote.customer?.name ? ' · ' + quote.customer.name : '');
```

O sea que el título de la captura —`Presupuesto #2 · Francisco Jiménez`— **no es una
concatenación de la vista: es el contenido del campo**.

🔴 **Y no lo puede cambiar nadie.** El `PATCH /admin/jobs/:id` acepta `status`, `scheduledAt`,
`notes`, `assignedUserId` y `tipoOperacion` (`jobs.routes.ts:340-395`) — **`titulo` no está**.
Hoy es de escritura única, en la creación automática.

**Para G2 es media buena noticia:** el campo existe, así que **no hace falta tocar schema** (el
único freno duro del proyecto). Lo que hace falta es **abrir su escritura** y decidir qué pasa
con los Trabajos ya creados, que llevan dentro el string derivado.

---

## 5 · «Tipo de trabajo» — `tipoOperacion`, bandera FISCAL

`Job.tipoOperacion String @default("TRABAJO_UNICO")`. Valores (`job.service.ts:17`, unión
cerrada): **`OPERACIONES_SUELTAS`** | **`TRABAJO_UNICO`**.

- **Qué gobierna:** el motor de facturación. `OPERACIONES_SUELTAS` = varias visitas al mismo
  cliente → **recapitulativa mensual** (art. 13 RD 1619/2012); `TRABAJO_UNICO` = una prestación
  → factura al concluir (`job.service.ts:12-16`).
- **Efecto visible medido:** habilita `🧾 Consolidar en factura` — `consolidaEnabled =
  job.tipoOperacion === 'OPERACIONES_SUELTAS' && consolidaEligibles.length > 0`
  (`jobDetailView.js:512-513`).
- **Es ADMIN-ONLY por ser dinero:** está en `ADMIN_ONLY_JOB_FIELDS` (`roleCapabilities.ts:90`);
  un técnico que lo mande hace que se rechace el PATCH **entero**.
- **No afecta a los estados ni a los albaranes:** no aparece en `TRANSITIONS`.

**No está sin documentar:** viene de **SCRUM-66 (TRABAJO-4)** y su motor es **SCRUM-17**. Que el
asesor no lo hubiera leído no lo hace antiguo.

---

## 6 · La dirección — campo propio, **pero siempre vacío**

`Job.direccion String?` **es campo propio del Trabajo**, no del cliente.

🔴 **Y la suposición de C5 (SCRUM-300) es FALSA en la práctica.** Lo dice el propio código:

> `// SCRUM-10: campos del contenedor "Trabajo". direccion sin fuente hoy → null.`
> — `job.service.ts:65`

**Nada la escribe.** No está en los campos del `PATCH` (`jobs.routes.ts:340-395`) ni la rellena
la creación automática. Solo se **lee**: el PDF del albarán la usa como «obra»
(`albaran.service.ts:313,402`; `albaranPdf.service.ts:32`) y el portal público cae a
`job?.direccion || job?.titulo` (`albaranPublic.routes.ts:142`) — es decir, **hoy siempre enseña
el título**, porque la dirección es null.

**C5 no puede dar por hecho que «sale del Trabajo, que ya la tiene»: la tiene declarada y
vacía.** Necesita, además de leerla, un camino para escribirla.

**¿Varios trabajos del mismo cliente en direcciones distintas?** **Sí, estructuralmente:** la
columna es del Job y no hay unicidad por cliente. El día que se rellene, la dirección de obra
funciona sin tocar el modelo.

---

## Confirmación de lo tomado de las CAPTURAS

| afirmación | veredicto |
|---|---|
| Pestañas `Todos · Pendiente · Parcial · Pagado` | ✅ `jobsView.js:59`, literales exactos |
| Contadores por pestaña | ✅ `jobsView.js:55` |
| Dos chips a la vez en el detalle | ✅ el de cobro en `jobDetailView.js:210`, junto al de estado en la misma cabecera |
| `+ Nuevo albarán` · `+ Añadir gasto` | ✅ `jobDetailView.js:452` y `:479` |
| `Iniciar precio en el parte` | 🔴 **NO existe** — ver §3 |
| Título `Presupuesto #2 · Francisco Jiménez` | ✅ y es **contenido del campo**, no de la vista — ver §4 |
| Secciones `EN CURSO · ESTA SEMANA · SIN AGENDAR` | **[NO SE PUEDE MEDIR HOY]** — no aparecen como literales en `jobsView.js`. O se construyen dinámicamente o viven en otra vista; haría falta una derivación propia del listado, que no entra en el alcance de este informe |

---

## Lo que le diría al asesor antes de partir el Bloque G

1. **La tabla «acciones por estado del Trabajo» no se puede escribir con lo que hay.** Ninguna de
   las 37 acciones consulta `job.status`. Si el diseño la quiere, es una decisión nueva.
2. **`cerrado` existe y la epic lo ignora.** Es terminal y admin-only.
3. **El eje de cobro no es un estado.** Diseñar «transiciones de cobro» sería inventar un
   mecanismo que no existe: es una fórmula sobre dos importes.
4. **`Pagado` es inalcanzable sin `totalAceptado > 0`.** Merece decisión propia.
5. **`titulo` y `direccion` existen y no son escribibles.** G2 y C5 no necesitan schema, pero sí
   una ruta.

## Nota de método

El censo de acciones **se derivó dos veces**. La primera dio 12 y era una medición correcta sobre
un objeto incompleto: una sola de las tres fábricas de botones. Ningún suelo lo habría cazado
—12 está muy por encima de cualquier mínimo razonable— porque el defecto no era el número, era
**el recorte**. Lo que lo destapó fue contar la superficie total de botones por otra vía antes de
fiarse del censo.
