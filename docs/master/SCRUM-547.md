# SCRUM-547 · El documento estaba hecho desde hacía 26 días. Lo que faltaba era el camino hasta él

**Medido contra:** `origin/main` = `a9a1a3382fa74008e7da6da9611289b0ce6165ce` · 2026-09-16T09:56:07+01:00

**Carril:** microcopy · instrumentos · **Gate:** sin gate — corre en `npm test`

**Tanda:** 6985 tests · 6875 pass · **0 fail** · 110 skipped · **exit 0** · guards de publicación **91/91** · `guards:entrada` 26/26.

---

## PASO 0 · el ticket estaba mal diagnosticado, y se comprueba midiendo

El ticket decía que el fundador no podía aprobar los textos del bloque F **porque están dentro del
HTML**. No era eso: `docs/MICROCOPY_BLOQUE_F_PARA_APROBAR.md` entró el **20-ago-2026** (commit
`36386d4d590df47aa22c97f15fb8e101a0abe7ce`) con los 51 textos transcritos uno a uno. Llevaban
**26 días fuera del HTML**.

Verificado contra el `index.html` de hoy, punto de código a punto de código:

| control | resultado |
|---|---|
| marcadores **derivados del HTML**, no de la lista del ticket | `data-microcopy="PENDIENTE_FUNDADOR"` ×3 + `data-propuesta="microcopy-sin-aprobar"` ×1 = **4 secciones**. Las otras 2 apariciones están **dentro de comentarios**. No hay un quinto sitio marcado |
| recuento | **51 en el documento = 51 en el HTML**; ni uno del HTML sin volcar |
| literales | los **51** aparecen exactos. Numeración sin huecos (F4 1..7 · F5 1..24 · F6 1..16 · F7 1..4) y **31 llevan su ancla** (`fila firma`, `gremio fontaneria`…) |
| guards de publicación | **91/91** en verde (scrum331, 333, 402, 549, 551, 555, 557, 563) |

**Lo que fallaba:** ni `PENDIENTES_FUNDADOR.md` ni el máster lo nombraban. Un documento «para
aprobar» que nadie enlaza **no espera: se pierde**.

### 🔴 Y mi instrumento se equivocó dos veces antes de acertar

Mi primer extractor declaró **5 textos alterados**. Los cinco eran míos: un `<span>` partiendo el
titular de F4, y tres textos que viven en `data-wa-etiqueta`/`data-wa-texto`/`data-email-etiqueta`,
atributos **del tag de apertura de la sección**, que yo recortaba fuera. Y F6-6 («Empezar gratis →»)
no está contiguo en el fuente —`Empezar gratis <span class="ar">→</span>`— pero es **idéntico
renderizado**, U+2192 en los dos lados: exigir contigüidad en el fuente declaraba alterado un texto
fiel.

## ② El enlace, y por qué el entregable no es el enlace

**Medido antes de decidir nada**, sobre los **666** `.md` de `docs/`, con control del instrumento
(ve un documento que sí está enlazado, no ve uno inventado):

| | |
|---|---|
| documentos que **se declaran a la espera de una aprobación** | **6** |
| · enlazados desde el máster o `PENDIENTES_FUNDADOR.md` | 3 → **4** tras este PR |
| · 🔴 **sin enlazar** | 3 → **2**, los dos declarados con motivo |

**No fue un caso: era el patrón.** La mitad de los documentos que esperaban una decisión no tenían
camino. Por eso el entregable es el **guard**, no el enlace: poner el que falta arregla uno; el
guard impide que el siguiente entre en silencio.

⚠️ **Las entradas de `docs/master/` no entran, y va declarado.** El criterio también toca 3
(`SCRUM-400`, `SCRUM-549`, `SCRUM-836`), pero el registro es **una entrada por ticket**: se
referencia por su ticket, no por una lista de pendientes. Exigirles enlace sería pedir ~500 enlaces
desde la lista del fundador — el ruido que acaba apagando un guard.

### Los dos que NO se enlazan, cerrados en dos y clavados por identidad

- `MICROCOPY_APROBADA_SIN_APLICAR.md` — lo lleva **otra sesión ahora mismo** en la rama viva
  `scrum-650-microcopy-aprobada`. Enlazarlo sería escribir en su carril (regla 9) y chocaría al
  mezclar.
- `CENSO_MICROCOPY_PENDIENTE.md` — es un censo de trabajo interno, **no una decisión del fundador**.
  Ponerlo en su lista le daría una tarea que no es suya.

Un tercero **no se añade: se decide**.

### Los controles del guard

| control | resultado |
|---|---|
| 🔴 **EL QUE DECIDE** | un documento a la espera sin enlace **hace caer la tanda**, nombrándolo y diciendo qué señal lo delató |
| ✅ **POSITIVO** | el del bloque F pasa — y **no basta con nombrarlo**: el enlace tiene que decir que hay algo que aprobar, o es una entrada de índice |
| 🔴 **SUELO** | menos de 4 documentos a la espera → CIEGO. Y **las dos señales** (nombre y cuerpo) tienen que cazar a alguien: si una no dispara nunca, media comprobación es decorativa |
| 🔴 **MUTACIÓN ①** | quitar un declarado → **caen 2 tests**, entre ellos el que decide |
| 🔴 **MUTACIÓN ②** | hacer que `estaEnlazado` devuelva siempre `true` → **vuelve el silencio** en el control que decide, **y lo caza el de la lista cerrada** |

Las dos verificadas **en disco** y restauradas byte a byte.

> 🔴 **Por qué el criterio vive en `tests/_documentos-a-la-espera.mjs` y no dentro del guard.** No
> es estética: la mutación de SCRUM-745 **no puede apuntar al fichero que la declara**, porque el
> literal `de` aparecería dos veces —en el código y dentro de la propia declaración— y el
> meta-guard lo rechaza por no ser único. Lo comprobé: las dos primeras mutaciones salieron «no
> calza o no es único (2)». Es la autorreferencia de SCRUM-693/694 en su versión de mutaciones.

## ③ Censo de bloques ocultos — sin tocar nada (regla 9)

Derivado del HTML. ⚠️ **`hidden` de verdad, no `aria-hidden`**: el primer criterio dio **19**
elementos porque `\bhidden\b` casa dentro de `aria-hidden="true"`, que no oculta a la vista sino al
lector de pantalla. Con el criterio bien son **6**.

| línea | elemento | |
|---|---|---|
| 405 | `#announce` | 🔴 **sin marcador** |
| 503 | `#heroe-f4` | marcado |
| 646 | `#gremios` | marcado |
| 695 | `#comparativa` | marcado |
| 744 | `#founding-banner` | 🔴 **sin marcador** |
| 786 | `#contacto-publico` | marcado |

### 🔴 Lo importante: esos dos NO están «ocultos esperando aprobación»

**Se los enseña el JS.** `index.html:867` hace `ab.hidden=false; fb.hidden=false` cuando
`/public/founding-status` devuelve `seatsLeft > 0`. O sea que **su texto se le enseña a visitantes
reales**, y nunca ha pasado por el circuito de microcopy: no llevan marcador, así que los guards de
SCRUM-547 no los ven.

Y `index.html:109` dice `.announce[hidden]{display:block;visibility:hidden}` — **el CSS redefine el
`hidden`**: ese bloque no desaparece, ocupa su hueco invisible.

### De dónde sale «quedan N plazas» — y aquí hay que corregir la alarma

`/public/founding-status` → `getFoundingStatus()` (`src/modules/billing/domain/founding.ts:99`) →
`PLAZA_OCUPADA = { plan: 'founding', subscriptionStatus: 'active' }` (`:34`).

🟢 **SCRUM-340 ya cerró el defecto de contar sólo `plan`**: hoy exige **plan Y estado**. Y la
escasez sólo se pinta si `taken > 0 && seatsLeft > 0` (`index.html:856-857`), con el motivo escrito
al lado: «quedan 20 de 20» no comunica escasez, comunica que no ha comprado nadie. Queda un residual
**ya declarado** en ese fichero: cancelar o `past_due` **no deberían liberar la plaza**, y eso pide
una columna nueva — el `ALTER` está escrito y sin aplicar en `docs/sql/scrum-340-la-plaza-comprada.sql`
porque `prisma/schema.prisma` es dominio exclusivo del fundador.

### ⚠️ Corrijo mi propia observación de la tanda anterior

Dije que el banner era «un compromiso de precio permanente que nadie ha aprobado». **Medido, eso no
se sostiene:**

- el precio **está decidido en el máster** — `docs/YAQU_MASTER.md` líneas 31, 58, 211 y 228:
  «founding 9,90 € de por vida (20 plazas, banner con contador real)». Es la fuente de verdad del
  propio fundador;
- y **hay un guard**: `tests/scrum341-condicion-precio-publicada.test.mjs` exige que toda promesa
  pública de permanencia lleve al lado la condición del documento vinculante, y cubre
  `public/index.html`.

**Lo que sí sigue siendo cierto, y es más pequeño de lo que dije:** el texto exacto «Oferta
fundadores: …» **no aparece en ningún documento de microcopy** (0 de 666), y el bloque no lleva
marcador, así que está fuera del circuito de aprobación aunque no esté fuera de la decisión. La
diferencia importa: no es un precio sin aprobar, es una microcopy sin circuito.

## Lo que NO se hizo

- **Ni una coma de los 51 textos.** Transcripción verificada, no redacción (regla 30).
- **`public/index.html` no se toca.** Ningún `hidden` quitado, ningún `data-propuesta` borrado.
- El banner **no se marca, no se reescribe y no se enseña**: se censa y se lista (regla 9).
- **`src/` intacto** · cero dependencias (36) · cero estado o flag de producto (27).

> ⚠️ **Nota de tanda:** `scrum547-…` importa de `tests/_documentos-a-la-espera.mjs`, que es un
> **ayudante y no registra tests**, así que el total sube sólo por los **4** tests nuevos de este
> guard. Los dos scripts de `docs/master/evidencias/SCRUM-547/` se ejecutan a mano y no los importa
> nadie: no entran en `npm test`.
