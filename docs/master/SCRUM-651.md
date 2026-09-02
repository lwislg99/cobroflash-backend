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

---

# SCRUM-651 · SEGUNDA ENTREGA · el merge, el tipo de intervencion y el copy firmado

**Medido contra:** `origin/main` = `443a9e224c14204c0a01ee75751c067762ef04a0` · 2026-09-02T18:05:00+02:00
**Medido en:** host `DESKTOP-T5MONF5` · rama `scrum-651-trabajo-sin-presupuesto`

## 1 · EL CONFLICTO: el mecanismo cambio bajo los pies

`SCRIPTS_DEL_DASHBOARD` **ya no es un numero**. SCRUM-662 lo retiro —colisiono SIETE veces— y
puso la **LISTA** de scripts: una cuenta no distingue «tu script» de «mi script», y dos ramas que
suben el contador escriben el MISMO valor por scripts DISTINTOS, asi que git funde la linea sin
marcadores y el contador se queda corto en silencio.

**No se conserva nada del lado propio.** Mi rama traia `= 67` y ese mecanismo ya no existe.
Traer de vuelta el numero —o su historial, que main retira a proposito— habria deshecho SCRUM-662,
que es trabajo ajeno que viene en el merge. Del lado propio sobrevive lo unico que sigue siendo
cierto: que entra `jobNuevoModal.js`, y por que.

**La entrada se DERIVO del indice ya mezclado**, no se heredo ni se sumo:

| medida | valor |
|---|---|
| `grep -c "<script src=" public/dashboard/index.html` | **71** |
| lista declarada en main (SCRUM-662) | 70 |
| contraste POR NOMBRE — falta | `jobNuevoModal.js` |
| contraste POR NOMBRE — sobra | (nada) |
| duplicados en el indice | ninguno |

Colocada en su sitio alfabetico: `jobNextAction.js` → **`jobNuevoModal.js`** → `jobRailBlocks.js`.

**ORDEN CON DEPENDENCIA**, comprobado aparte porque un merge lo reordena sin tocar la lista:

* `modalHeader.js` antes de `jobNuevoModal.js` (le da `cabeceraModal`) — OK
* `jobNuevoModal.js` antes de `jobsView.js` (que lo consume) — OK
* `filtroClientes.js` antes de `customersView.js` (de otro carril) — OK

## 2 · TIPO DE INTERVENCION — vocabulario cerrado, UNA sola fuente

Aprobado el 2-sep-2026 (regla 27). Vive en `src/modules/jobs/domain/tipoIntervencion.ts` y **se
importa, no se copia**: el parte de trabajo (SCRUM-652) usa EXACTAMENTE estos valores, y dos
listas para el mismo hecho se separan el dia que alguien anada uno en un sitio.

```ts
export const TIPOS_INTERVENCION = ['REPARACION_ASISTENCIA', 'MANTENIMIENTO', 'INSTALACION'] as const;
```

Hay un **guard que barre `src/`, `tests/` y `public/`** y cae si los tres valores aparecen juntos
fuera de su fuente: es lo que impide que nazca la segunda lista. Con su suelo — si el barrido no
encuentra el vocabulario ni en su propio fichero, se declara ciego.

**No hay caida a un valor por defecto.** Si llega algo que no esta en la lista, la respuesta es
«no». Caer a `REPARACION_ASISTENCIA` porque es el caso frecuente seria inventarse que clase de
trabajo hizo alguien, y eso acaba impreso en un parte que firma el cliente.

## 3 · ⛔ LA COLUMNA: EL DIFF, ESCRITO Y SIN APLICAR

`prisma/schema.prisma` sigue siendo territorio del fundador, asi que **no lo he tocado**. El
cambio, listo para aplicar:

```prisma
model Job {
  // ...
  // SCRUM-651 (T2): que clase de intervencion es. Vocabulario CERRADO en
  // `src/modules/jobs/domain/tipoIntervencion.ts` — el MISMO que usa el parte (SCRUM-652).
  tipoIntervencion String? @map("tipo_intervencion")
}
```

```sql
-- ADITIVO: nullable y SIN default.
ALTER TABLE "jobs" ADD COLUMN "tipo_intervencion" TEXT;
```

⚠️ **Nullable y sin `default`, a proposito.** Un default pondria una intervencion a los Trabajos
que ya existen, y eso es afirmar que clase de trabajo fueron sin haberlo preguntado — el mismo
error que el `0 €` de presupuesto, con otra cara. `null` = «no consta».

### 🔴 Y MIENTRAS NO ESTE, EL DATO NO SE TRAGA EN SILENCIO

La puerta **rechaza** un `tipoIntervencion`, incluso valido, con `tipo_intervencion_sin_columna`.
Aceptarlo y no guardarlo seria el fallo mudo de este ticket cometido otra vez: el profesional
elige «Mantenimiento», el producto contesta 201, y ese dato no existe en ninguna parte.

El dia que la columna este, se abre en tres lineas y **el test es la lista de lo que hay que
tocar**. Por eso el desplegable tampoco esta todavia en el modal: ofrecer un campo que no se
puede guardar es prometer.

## 4 · La traza, y el copy firmado

* **`AuditAction` gana `trabajo_creado`** (aprobado). El camino del presupuesto ya dejaba traza
  y el directo no dejaba ninguna: **un registro con un agujero es peor que no tenerlo**, porque
  quien lo lee lo cree completo.
* **Los dos textos aprobados**, puestos literales:
  * subtitulo → *Tus trabajos: los que vienen de un presupuesto aceptado, y los que abres tu.*
  * vacio → *Todavia no tienes ningun trabajo. Se crean solos cuando un cliente acepta un
    presupuesto, o los abres tu desde aqui.*

El estado vacio viejo mandaba ESPERAR a un presupuesto **teniendo al lado el boton para abrir uno**:
la pantalla se contradecia a si misma. Eso ya no pasa.

## 4-bis · 🔴 SCRUM-411 pidio QUITAR el export, y aqui esa es la respuesta equivocada

El trinquete de huerfanos cazo `TIPOS_INTERVENCION` —hoy solo lo leen su propio modulo y su
test— y propuso quitarle el `export`. **No se ha hecho, y merece quedar escrito por que.**

El consumidor real es **SCRUM-652**, que se esta construyendo en otra sesion. Si encuentra la
constante sin exportar, la salida facil es declarar su propia lista — que es EXACTAMENTE lo que
el fundador prohibio: dos listas para el mismo hecho se separan, y entonces un parte afirma sobre
un Trabajo una palabra que el Trabajo no admite.

Asi que se DECLARA en `tests/_huerfanos-declarados.mjs` (categoria `VOCABULARIO_DEL_MODULO`), que
es justo el caso para el que ese fichero existe: *«en una base viva se escribe un export antes que
su consumidor constantemente»*. **La linea se borra el dia que SCRUM-652 lo consuma**, y entonces
el propio guard avisa de que ya no es huerfano.

## 5 · Hallazgos de otros carriles (regla 9) — reportados, no tocados

1. **`scrum642-tramos-del-arranque` es VERDE aislado y ROJO dentro de la suite.** No es mio
   (`git diff origin/main` vacio) y tres pasadas aisladas dan `exit=0`. **Es la enfermedad exacta
   de SCRUM-520**: un aserto que mide reloj de pared y cae cuando la maquina esta cargada. La
   forma de cerrarlo ya esta escrita en `docs/master/SCRUM-520.md`: medir el hecho, no el reloj.
2. **La lista de main tiene un desorden propio y anterior a este merge**: `quoteSuplido.js` va
   antes de `quotesDetailView.js`. No lo arreglo aqui.
