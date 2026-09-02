# SCRUM-651 · T2 · Un trabajo SIN presupuesto, y de primera clase

**Medido contra:** `origin/main` = `01d5c5a06027a443542cb327e029195ac561fda6` · 2026-09-02T12:40:00+02:00
**Medido en:** host `DESKTOP-T5MONF5` · rama `scrum-651-trabajo-sin-presupuesto`

## PASO 0 · LAS DOS PREGUNTAS, MEDIDAS

### 1 · ¿`Invoice` exige `jobId` o `quoteId`? ¿En el esquema o de hecho?

**Ni una cosa ni la otra, y el esquema es tajante:**

| | medido |
|---|---|
| `Invoice.jobId` | **NO EXISTE el campo.** Una factura nunca ha apuntado a un Trabajo |
| `Invoice.quoteId` | `Int?` — **nullable** |
| `Job.quoteId` | `Int?  @unique` — **nullable ya** |

**No hace falta tocar `prisma/schema.prisma`.** La exigencia del presupuesto **no estaba en el
esquema: estaba DE HECHO** — el ÚNICO creador de Trabajos era `ensureJobForQuote`
(`job.service.ts:95`), que arranca en `quote → accepted`. **No había `POST /jobs`.** Esa era la
puerta que faltaba, y es todo lo que faltaba en el lado de escritura.

> Y el lado de LECTURA ya estaba preparado: SCRUM-51 nombra el «Trabajo sin presupuesto» en un
> comentario del serializador, y SCRUM-363 construyó el eje de cobro que **puede no existir**.

### 2 · ¿Qué se rompe cuando no hay presupuesto detrás? — ENUMERADO

El contraste **«presupuestaste 10 m, llevas 7, quedan 3» NO PUEDE EXISTIR**: no hay contra qué
contrastar. Y no está solo. Todo esto cuelga del mismo eje ausente:

| lo que no puede existir | de dónde salía | qué hace hoy sin presupuesto |
|---|---|---|
| «presupuestaste X, llevas Y, quedan Z» | `Quote` + líneas | no se puede calcular |
| «**te has pasado del presupuesto**» | `totalAceptado` | **no se puede detectar** |
| importe **pendiente** (`remaining`) | plan de tramos del Quote | `null` ✅ (ya guardado) |
| **plan de tramos** / siguiente tramo | `buildBillingPlanView(quote)` | `null` ✅ (ya guardado) |
| **semáforo de cobro** (Pendiente/Parcial/Pagado) | `importeDeReferencia` | `null` → sin chip ✅ (SCRUM-363) |
| barra de progreso de cobro | `aceptado > 0` | no se pinta ✅ |
| «Pendiente» en el rail del dinero | `aceptado > 0` | no se pinta ✅ |
| fila de documento **«Presupuesto #N»** | `job.quote` | no se pinta ✅ |

**Lo que sí sigue existiendo, y por eso es de primera clase:** cliente, dirección de obra,
descripción, la FSM entera (`pendiente_agendar → … → cerrado`), agendar, asignar, **partes**,
gastos, cobros anotados y facturar después.

## 🔴 LOS DOS SITIOS DONDE LA PANTALLA SÍ FINGÍA

Medidos, no supuestos. Los dos se arreglan en este ticket:

1. **El título.** El respaldo era `Presupuesto #${quote ? quote.quoteNumber : job.id}`: sin
   presupuesto metía **el ID del Trabajo donde va el número del presupuesto**, y una avería se
   presentaba como **«Presupuesto #12»** — un documento que no existe, con un número que es de
   otra cosa. Ahora se titula con el CLIENTE, que es lo que SCRUM-317 ya dejó escrito como regla.

2. **«Total aceptado 0,00 €».** `jobDetailView.js` hacía `Number(job.totalAceptado || 0)` y pintaba
   el titular **siempre**. En un Trabajo sin presupuesto anunciaba **cero euros a 2,2 rem**, que se
   lee como «presupuestaste cero»: una afirmación, y falsa. Ahora se calla si no consta.
   La guarda mira `!= null` y **no** `> 0`: un presupuesto aceptado por 0 € es un dato que EXISTE
   y se sigue enseñando — el camino de siempre no se toca.

## 🔴 UN FALLO MUDO QUE HABRÍA ENTRADO CON ESTE TICKET

Medido antes de escribir la ruta: un técnico solo ve los Trabajos donde es `operarioId` **o**
`assignedUserId` (SCRUM-467). Si la creación directa dejara `operarioId` en `null`, **el técnico
abriría el Trabajo y dejaría de verlo en el mismo instante** — sin error, sin aviso, y con la
avería ya abierta.

Se guarda **quién lo abre**. No es un criterio inventado: `operarioId` es AUTORÍA (SCRUM-52); en el
camino del presupuesto el autor es quien lo redactó, y aquí es quien abre el Trabajo. `null` sigue
significando «el propietario».

## LO CONSTRUIDO

* `src/modules/jobs/domain/trabajoDirecto.ts` — el núcleo, **puro** (sin base ni red): validación y
  la fila que se escribe. Se prueba entero sin levantar nada.
* `POST /admin/jobs` — la puerta. **No es admin-only**: quien coge la avería es el técnico. El gate
  por CAMPO del PATCH (`tipoOperacion`, `assignedUserId`, cerrar) sigue intacto y aquí no se
  escribe ninguno.
* `public/dashboard/js/jobNuevoModal.js` + botón en la lista, **antes del `return` del estado
  vacío**: con cero trabajos es justo cuando más falta hace poder abrir el primero.

**`totalAceptado` no se escribe.** La columna es nullable y no tocarla la deja en `null`. Escribir
`0` sería afirmar «presupuestaste cero», y ese 0 viajaría al semáforo y a la barra.

**`quoteId` no se acepta por esta puerta**, y no es un olvido: sería un SEGUNDO escritor del
emparejamiento Trabajo↔presupuesto en paralelo a `ensureJobForQuote`, que mantiene los dos
sentidos (SCRUM-195). Dos escritores para el mismo hecho discrepan, y aquí discrepar es un Trabajo
duplicado con el dinero repartido entre los dos.

## ⛔ LO QUE NO SE ENTREGA, Y POR QUÉ — hace falta tu OK

**«Tipo de intervención» no está.** Es el único de los cuatro campos del encargo que **no tiene
dónde guardarse**: `Job` tiene `titulo`, `direccion` y `notes`, y nada para esto. Meterlo requiere
las DOS cosas que están cerradas sin tu OK:

1. una **columna nueva** en `prisma/schema.prisma` (`tipo_intervencion`, `String?`), y
2. un **vocabulario CERRADO** (avería · mantenimiento · instalación · …), que es Parte L/P y regla 27.

No lo he colado en `notes` ni en `titulo`: eso sería inventarse un modelo de datos donde hay una
decisión tuya pendiente. **Propuesta lista para aprobar; con el OK son 20 minutos.**


## 🔴 LO QUE ENCONTRO LA TANDA DE ROJOS: mi guard del titulo no vigilaba el hecho

Inyecte el defecto del titulo y **el guard siguio VERDE**. La causa estaba en mi propio test: el
criterio vivia EN LINEA dentro del serializador, asi que lo unico que se podia hacer era
**comparar el texto del fuente** — y eso pasa en verde en cuanto alguien reescribe la expresion
sin cambiar el defecto. Otra vez el guard atado a la FORMA y no al HECHO.

Arreglado sacando el criterio a `tituloDeTrabajo()`, puro, y probandolo **por comportamiento**:

| entrada | sale | 
|---|---|
| sin presupuesto, cliente «Bar Paco» | `Bar Paco` |
| sin presupuesto, sin cliente | `#12` (su id, que si es suyo) |
| **con** presupuesto 34 + cliente | `Presupuesto #34 · Bar Paco` (**igual que hoy**) |
| con presupuesto sin numero | `Presupuesto #9` (cae a su id, como siempre) |
| con titulo puesto por el pro | el suyo, y manda sobre todo |

Y la tanda incluye una **variante SUTIL**: el mismo defecto REDACTADO DE OTRA FORMA. Con el guard
viejo habria pasado en verde; con el de comportamiento cae. Es la comprobacion de que el arreglo
no es cosmetico.

## ROJOS: 12/12, POR CODIGO DE SALIDA

Un build roto NO cuenta como rojo (dejaria `dist/` con el codigo bueno y el test no mediria nada):
el arnes lo marca aparte — y paso una vez, con la primera version de la variante sutil.

| # | rojo inyectado | cae |
|---|---|---|
| 1 | **MECANISMO**: se quita la puerta, vuelve a no haber `POST /` | 🔴 |
| 2 | **MECANISMO**: el presupuesto vuelve a ser obligatorio | 🔴 |
| 3 | **AUSENTE Y CERO**: el Trabajo directo nace con `totalAceptado: 0` | 🔴 |
| 4 | el Trabajo directo nace emparejado a un presupuesto | 🔴 |
| 5 | **FALLO MUDO**: deja de guardar quien lo abrio | 🔴 |
| 6 | …y por la RUTA: el nucleo bien, pero le llega `null` fijo | 🔴 |
| 7 | vuelve el titulo «Presupuesto #\<id del Trabajo\>» | 🔴 |
| 8 | …y la **variante SUTIL**, el mismo defecto con otra redaccion | 🔴 |
| 9 | vuelve «Total aceptado 0,00 €» a la pantalla | 🔴 |
| 10 | **CONTROL POSITIVO**: el camino del presupuesto pierde su eje de dinero | 🔴 |
| 11 | **CONTROL POSITIVO**: deja de anotar la pertenencia (SCRUM-195) | 🔴 |
| 12 | **SUELO DE CEGUERA**: el lector de rutas por AST se queda ciego | 🔴 |

## Otras dos que son tuyas (regla 30 · regla 9)

* **Microcopy que deja de ser cierta.** La lista de Trabajos dice *«Cada presupuesto aceptado se
  convierte en un trabajo»* y su estado vacío *«Cuando un cliente acepte un presupuesto, el trabajo
  aparece solo»*. Con este ticket eso pasa a ser **media verdad**, y el estado vacío llega a
  contradecir al botón que tiene al lado. **Es copy aprobado: no lo reescribo, lo propongo.**
* **Sin registro de auditoría.** `AuditAction` es un conjunto CERRADO y no tiene ninguna acción
  para «trabajo creado». Ampliarlo es cambio de máster; queda propuesto, no colado.
