# SCRUM-424 · G3 — El bloque DÓNDE deja de ser código inalcanzable

**Fecha:** 10-ago-2026 · **Carril:** B · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `db814df3d9b438ca969bdb0ec3c5e9587159bb7e` · 2026-08-10T14:55:00+01:00

**Paso 0:** sin ramas remotas con `424`/`direccion`/`mapa`; `docs/master/SCRUM-424.md` no existía.

---

## 1 · 🔴 SCRUM-374: la lectura correcta es **(a)**, y está escrita en el propio documento

Se pedía elegir entre «su alcance era solo el sellado» y «se cerró en falso». **No hay que
interpretarlo: SCRUM-374 lo dice, y además dice por qué.** Su última sección, literal:

> ## Lo que NO se vigila, y no es olvido
>
> Que nadie ESCRIBA `Job.direccion`. El schema declara esa columna como «se llenará en la UI (tarea
> futura)», así que **el escritor legítimo está previsto: un guard que dispara contra el futuro
> previsto es un guard que alguien apaga.** (Un intento de medirlo por texto casó **lecturas** como
> escrituras — `direccion: job.direccion` no escribe nada.)

**Es (a), y está BIEN CERRADA.** Su alcance era el sellado —que `obra` dejara de depender de un
campo que nadie escribe— y lo cumplió: *«SCRUM-300 (C5) lo cambió: la obra sale de
`Albaran.lugarEntrega` y la versión del sobre subió a 2 precisamente por eso»*. **No sólo excluyó el
escritor: explicó la exclusión y dejó dicho que llegaría.** Esto es ese trabajo, no un cierre en
falso.

> **Y el matiz que lo confirma desde el otro lado:** SCRUM-374 hasta se planteó vigilar la ausencia
> de escritor y **decidió no hacerlo**, porque un guard contra algo que se va a construir muere el
> día que se construye. Si hubiera creído que el escritor era suyo, no habría escrito ese párrafo.

---

## 2 · 🔴 La consecuencia del sellado — **la premisa del ticket ha cambiado, y el riesgo real es otro**

El encargo decía: *«`buildFirmaEvidencia` sella `obra: job?.direccion || null`»*. **Hoy ya no.**
Medido en `src/modules/jobs/domain/albaran.service.ts:569-572`:

```ts
obra: obraSegunVersion(ALBARAN_CONTENIDO_VERSION_ACTUAL, {
  lugarEntrega: a.lugarEntrega ?? null,
  jobDireccion: job?.direccion || null,
}),
```

Con `ALBARAN_CONTENIDO_VERSION_ACTUAL = 2` (`:330`) y `obraSegunVersion` (`:475-481`) —*«si
`version === 1` devuelve `jobDireccion`; si no, `lugarEntrega`»*— **el sello de HOY no lee
`Job.direccion`**. Lo hizo SCRUM-300 (C5) exactamente por este motivo, y subió la versión del sobre
para poder hacerlo sin romper los viejos.

**Así que la pregunta del encargo —«¿las evidencias nuevas dejarán de parecerse a las viejas?»— ya
está contestada por C5: no.** Las nuevas no miran ese campo.

### 🔴 Pero hay un riesgo, y NO es el que el ticket temía

**Los sobres v:1 sí lo leen — y lo leen EN VIVO al verificar.** `albaranBarrido.ts:113` le pasa al
verificador `jobDireccion: job?.direccion || null`, o sea **el valor de HOY**; y la receta v:1
(`albaranVerificacion.ts:177`) hace `obra: f.jobDireccion ?? null`. **Nadie guardó una copia del
valor de aquel día.**

Cruzado con lo que midió SCRUM-374 —*«todos los albaranes firmados en v:1 se sellaron con el lugar
de obra vacío»*— sale esto:

> **El día que alguien escriba `Job.direccion` en un Trabajo con un albarán firmado en v:1,
> recalcular ese sobre daría `obra: "Calle X"` donde el hash guardado dice `null`. Resultado: «no
> coincide» sobre un albarán intacto que nadie ha tocado.**

Es el mismo daño que el propio `obraSegunVersion` avisa para el otro eje (*«verificar un documento
v:1 con la regla de v:2 daría "no coincide" sobre un albarán intacto"»*), con otro disparador: **no
cambia la regla, cambia el dato que la regla lee.**

**Sí importa, y decide la forma de esta tarea:** el escritor **se niega** en ese caso. No es un
detalle defensivo — sin él, esta tarea rompería firmas emitidas en silencio.

---

## 3 · De dónde sale la dirección: **se teclea**. Y no es una preferencia

Se midió antes de proponer, que es lo que pedía el encargo:

| Candidato | Medido | Veredicto |
| --- | --- | --- |
| **Heredarla del cliente** | `Customer` **no tiene** dirección: ni `address`, ni `city`, ni `postal` (modelo entero leído) | **imposible: no existe** |
| **Heredarla del presupuesto** | `Quote` tampoco la tiene | **imposible** |
| **Derivarla de `Albaran.lugarEntrega`** | existe y sí se escribe… pero es **de un albarán**, y un Trabajo puede tener varios con lugares distintos | **descartada**: habría que elegir uno, y elegir por el sistema adónde conduces al profesional es justo lo que no se puede hacer |
| **Tecleada** | — | **la única** |

**No hay precedencia que definir porque no hay segunda fuente.** Y aunque `Customer` la tuviera,
sería la dirección **fiscal** de quien paga, no la de la obra — SCRUM-300 ya tuvo que separarlas
para el albarán (*«el lugar del trabajo puede no ser el domicilio de quien paga»*). El propio
`bloqueDonde` ya lo llevaba escrito antes de esta tarea: **un enlace a mapa que lleva al sitio
equivocado es peor que no tenerlo, porque el que no existe no se sigue.**

---

## 4 · Lo construido

**El patrón es el de SCRUM-317 (G2) uno a uno**, y por el mismo motivo: allí `titulo` existía en el
modelo desde SCRUM-10 y ninguna ruta lo escribía; *«abrirlo aquí es todo lo que hacía falta — cero
cambios de schema»*.

| Fichero | Qué |
| --- | --- |
| `src/modules/jobs/domain/jobDireccion.ts` | **nuevo** · normalizador (vacío → `null`, tope 300) + el criterio de la regla 29 |
| `src/modules/jobs/app/routes/jobs.routes.ts` | `PATCH /admin/jobs/:id` acepta `direccion`, con el corte de la regla 29 **antes** del `update` |
| `public/dashboard/js/jobDetailView.js` | el campo «Dirección de la obra» en «Datos», al lado del nombre |
| `public/dashboard/js/jobRailBlocks.js` | rótulo aprobado **«Abrir en mapa»** en vez del marcador |
| `tests/scrum424-donde-tiene-dato.test.mjs` | **nuevo** · 7 tests |
| `tests/scrum402-marcador-no-se-pinta.test.mjs` | censo **−1**: `jobRailBlocks.js` sale de la tabla |

**Cero schema** (regla 3 intacta: el campo existe desde SCRUM-10). **No es admin-only**, igual que
`titulo` y por lo mismo: adónde se va a trabajar es un dato operativo, no una bandera fiscal ni de
dinero, y el técnico que está en la obra es quien mejor lo sabe.

**El campo va en «Datos», NO en el rail.** El rail es contexto de solo lectura (patrón B2, regla 4)
y su propio guard de SCRUM-318 prohíbe que cree un `input`. Hay un test que lo vuelve a comprobar
desde este ticket.

### El criterio de la regla 29 se PREGUNTA, no se codifica

```ts
export function versionLeeJobDireccion(version: number | null | undefined): boolean {
  const SONDA_JOB = ' sonda:job.direccion';
  const SONDA_ALB = ' sonda:albaran.lugarEntrega';
  return obraSegunVersion(version, { jobDireccion: SONDA_JOB, lugarEntrega: SONDA_ALB }) === SONDA_JOB;
}
```

**Un `v === 1` escrito hoy se quedaría ciego** el día que exista una v:3 que vuelva a leer el
Trabajo — y ese día el guard estaría verde mientras rompe firmas. Preguntándole a la función que de
verdad decide, esto no puede envejecer: si la receta cambia, la respuesta cambia con ella. Y el
criterio es **el mismo que usa el verificador** (`recomputarHashDeEvidencia` también saca la versión
del sobre guardado): un guard que mirase otra versión protegería lo que no toca.

> **Nota de alcance (regla 38):** `obraSegunVersion` se **importa y se llama**. No se ha modificado
> ni una línea del sellado, de la huella ni del camino de emisión.

---

## 5 · Verificación — las cinco que pedía el ticket, y las cuatro pruebas de rojo

| | Qué | Resultado |
| --- | --- | --- |
| **R1** | positivo: Trabajo **con** dirección pinta el bloque, y el `href` lleva **a esa** dirección | ✅ |
| **R1b** | el rótulo es «Abrir en mapa» y ya no es un marcador | ✅ |
| **R2** | negativo: sin dirección (`null`/`undefined`/`''`/`'   '`) **no** hay bloque ni enlace — y el normalizador tampoco cae a nada | ✅ |
| **R3** | rojo por el mecanismo: se quita la escritura → cae | ✅ |
| **R4** | **regla 29**: una firma v:1 se detecta; una v:2 y una sin firmar, no | ✅ |
| **R4b** | la ruta corta **antes** del `update` y consulta **por merchant** (regla 2) | ✅ |
| **SUELO** | si no encuentra `bloqueDonde`, o si el recorte de texto sale vacío, **falla declarándose ciego** | ✅ |

### Las cuatro mutaciones, sobre código ya commiteado

| Mutación | Cae | Diciendo |
| --- | --- | --- |
| quitar la ranura `direccion` del PATCH | **R3** | *«EL BLOQUE DÓNDE HA VUELTO A SER INALCANZABLE … código construido, probado y muerto»* |
| quitar el guard de la regla 29 (dejando el import) | **R4b** | *«EL PATCH YA NO COMPRUEBA LAS FIRMAS … el hash simplemente deja de cuadrar el día que alguien mire»* |
| dejar ciega la sonda de versión | **R4** | *«la sonda dice que un sobre v:1 NO lee `Job.direccion` … dejaría pasar justo el caso que rompe firmas»* |
| devolver el marcador al rótulo | **R1b** + el trinquete de **SCRUM-402** (*«jobRailBlocks.js (+1)»*) | — |

### 🔴 Un guard flojo que cazó la segunda mutación, y se afiló

La prueba de rojo de R4b **falló mal la primera vez**: al quitar la llamada dejando el `import`, la
aserción principal —`/albaranesConFirmaQueDependeDelTrabajo/`— **seguía pasando**, porque el nombre
aparece también en la cabecera. El rojo salía por el suelo, con un mensaje que **culpa al escáner**.

**Un guard que manda a arreglar el test cuando lo roto es el código es peor que no tenerlo.**
Arreglado: se busca la **llamada** (`…(`), no el nombre. Y se volvió a mutar para comprobar que
ahora el rojo nombra el defecto de verdad.

> (El mismo error, en su versión inocente, ya había salido antes: el recorte de los 500 caracteres
> anteriores medía el `import` y daba rojo con el código correcto. **El primer sospechoso de un rojo
> raro es el escáner**, y las dos veces lo fue.)

---

## 6 · Microcopy — dos aprobados, uno **todavía pendiente por una medición**

* ✅ **«Abrir en mapa»** — aprobado por el asesor el 10-ago-2026 (regla 30), del diseño del bloque G.
  Puesto, y descontado del censo de SCRUM-402.
* ✅ **«Dirección de la obra»** y su placeholder — aprobados por el asesor el 10-ago-2026, mismo
  trato que «Nombre del trabajo» de SCRUM-317: etiqueta de formulario, no copy de producto.
* ⏸️ **El mensaje del 409 de la firma sellada — SIGUE CON MARCADOR.** El asesor lo condicionó a una
  medición, y la medición **no da un sí ni un no limpios**. Ver §6.1.

### 6.1 · 🔴 ¿Puede el profesional escribir `Albaran.lugarEntrega` desde la UI? — **NO al crear; SÍ al editar**

La condición del asesor era binaria: si existe ese camino, el mensaje lleva salida («puedes ponerla
en el lugar de entrega del próximo albarán»); si no, va sin ella. **Medido en la ranura y en la
pantalla, por separado, como se pidió — y el resultado se parte en dos:**

| | Ranura en la ruta | Campo en la pantalla | ¿Se guarda? |
| --- | --- | --- | --- |
| **Crear** albarán (`POST /admin/jobs/:id/albaranes`) | **NO existe**: el `create` escribe `merchantId, jobId, numero, modoValoracion, lineas, notas` y nada más (`jobs.routes.ts:734-743`) | **SÍ se pinta** — es el mismo componente `buildAlbEditor` (`jobDetailView.js:2156-2175`) | 🔴 **NO** |
| **Editar** albarán (`PATCH /admin/albaranes/:id`) | **SÍ** — `albaranes.routes.ts:483-485`, `normalizarLugarEntrega` | el mismo campo | ✅ **SÍ**, mientras no esté `firmado` (`:406-408`) |

Los rótulos **sí están servidos y aprobados** (`ALBARAN_ROTULOS.lugarEntrega = 'Lugar de entrega'`,
asesor 5-ago-2026, vía `/admin/me`), así que el bloque se pinta de verdad: la respuesta no es «no se
ve el campo».

### 🔴 Y de paso sale un defecto que NO es de este ticket (regla 37: se reporta, no se arregla)

**Al CREAR un albarán, el «Lugar de entrega» se teclea y se descarta en silencio.** El editor es el
mismo para crear y para editar, pero las dos ramas no mandan lo mismo (`jobDetailView.js:2232-2236`):

```js
if (onGuardar) {
  await onGuardar({ lineas: out, notas: notas.value, modoValoracion: modo }); // ← CREAR: sin lugarEntrega
} else {
  await apiRequest(`/admin/albaranes/${alb.id}`, { method: 'PATCH', body: JSON.stringify(body) }); // ← EDITAR: body SÍ lo lleva
}
```

`body` sí incluye `lugarEntrega` (`:2223`), pero la rama de creación no usa `body`: pasa un objeto
propio de tres campos. Y aunque lo pasara, **el POST no lo aceptaría**. El profesional escribe la
dirección de la obra al crear el parte, pulsa guardar, y no se guarda nada — sin error.

**No se arregla aquí:** es otro carril (albaranes / C), toca una ruta que no es la de esta tarea, y
no bloquea nada de lo construido. **Carril C · siguiente acción concreta:** aceptar `lugarEntrega` y
`fechaEntrega` en `POST /admin/jobs/:id/albaranes` y pasarlos desde `onGuardar`, o —si se prefiere
no ampliar el POST— no pintar los dos campos en el modo creación. **Gate:** ninguno; cero schema.

### Los dos textos del asesor, y por qué no elijo

* **Con salida** — *«… Puedes ponerla en el lugar de entrega del próximo albarán.»*
* **Sin salida** — el mismo texto sin esa frase.

**La salida que promete la primera es cierta, pero no por donde el profesional la buscaría:** tiene
que crear el albarán, volver a abrirlo y editarlo, porque al crearlo lo que teclee se pierde. Decir
«ponla en el próximo albarán» a alguien que va a intentarlo en la pantalla de creación es mandarlo a
un sitio donde lo va a intentar y va a fallar **sin que nadie se lo diga**.

**Es microcopy y es del asesor (regla 30): el marcador se queda y no se pinta aprobado.** Las dos
salidas que veo, para que decida con el dato delante: **(1)** aprobar la versión *sin salida* hoy y
la *con salida* el día que el defecto de arriba se cierre; **(2)** aprobar la *con salida* ya y
cerrar el defecto en el mismo lote, para que la frase sea cierta por el camino evidente.

### 6.2 · El trinquete de SCRUM-402 sigue vigilando lo que sale del censo — **comprobado**

Preguntaba el asesor si borrar `jobRailBlocks.js` de `CENSO` lo dejaba fuera del radar, como el
guard de destino de SCRUM-418 que deja pasar la clave que no conoce. **No lo deja:** `censoActual()`
**enumera el directorio** y la rama `nuevos` de R4 caza cualquier fichero con marcadores que no esté
en la tabla — al revés que un guard que solo recorre una lista blanca.

Ya lo había demostrado la prueba de rojo de R1b sin buscarlo (devolver el marcador al rótulo produjo
*«HAY MARCADORES NUEVOS QUE PUEDEN PINTARSE: jobRailBlocks.js (+1)»*), pero eso era un efecto
lateral de otra mutación. **Se deja escrito como test propio**: `SCRUM-402 · R4b`, que comprueba la
clasificación de un fichero desconocido con marcador **con la misma expresión que usa R4**, y lleva
suelo para que no valga si `jobRailBlocks.js` volviera a la tabla.

---

## 7 · Lo que no se ha tocado

`prisma/schema.prisma` · el sellado, la huella y `contenidoCanonico` · el camino de emisión (leído,
nunca modificado — regla 38) · el mecanismo de firma · los otros cuatro bloques del rail · ningún
`.env` · ninguna base de datos.
