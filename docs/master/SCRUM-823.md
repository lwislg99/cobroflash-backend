# SCRUM-823 · La escalera de acción no mira el ESTADO del trabajo

**Fecha:** 8-sep-2026 · **Rama:** `scrum-823-la-escalera-y-el-estado` · **Árbol:** `cobroflash-b21`
**Medido contra:** `origin/main` = `b521d0a7299efa22153fa776c82cd28e0f907cd9` · 2026-09-07T22:00:42+01:00

> # 🛑 NO SE CONSTRUYE. LA DEPENDENCIA DE SCRUM-816 SIGUE VIVA.
>
> **La lista NO recibe los albaranes.** Medido, no leído: se pidió `GET /admin/jobs` por su ruta
> real y `albaranes` no está entre los campos que llegan.
>
> El propio ticket lo dice y tiene razón: *«hasta que la lista reciba los albaranes, la escalera
> está tomando decisiones con menos datos en una pantalla que en la otra, y cambiarla antes sería
> construir sobre una mentira»*.
>
> Esta entrada **es la entrega**: la medición, la tabla de los cinco estados y los rótulos que
> harían falta. No es media tarea — es la tarea que se puede hacer hoy sin mentir.

---

# 🔴 OBLIGACIÓN 0 (a) · ¿HAY YA UNA RAMA CON ESTE NÚMERO?

**Se pregunta al REMOTO, no a Jira.** El estado de un ticket no sabe qué ramas existen y nunca lo
va a saber: esta casa lleva cuatro duplicados por no hacer esta consulta.

```
git ls-remote --heads origin | sed 's|.*refs/heads/||' | grep -E '^scrum-823([^0-9]|$)'
   → NINGUNA
```

⚠️ **Y se hace por NOMBRE DE RAMA, no con un `grep` suelto.** El primer intento buscó «823» en la
salida cruda y devolvió cinco ramas: las cinco eran **coincidencias en el SHA**
(`f182391fc…`, `b2316e1c03d36d0762823a…`), ninguna en el nombre. Un filtro que casa con el
identificador equivocado es peor que no filtrar: da una lista plausible que invita a parar sin
motivo. Se acota a `refs/heads/` y se ancla el número.

**No hay rama de SCRUM-823 → se sigue con el encargo.**

---

# 🔴 OBLIGACIÓN 0 (b) · ¿ESTÁ VIVA LA DEPENDENCIA?

`node scripts/censo-escalera-por-estado.mjs` — **solo lectura**, contra `DATABASE_URL_DEV`
(`acela.proxy.rlwy.net/yaqu_dev_javier`, contrastado con `exigirDestinoCorrecto` antes de abrir
nada). No lee el código y deduce: **pide la lista por su ruta real** y mira lo que llega.
Sale con **código 1** mientras la dependencia siga viva.

## La respuesta: **NO los recibe.**

```
  🔴 albaranes → NO VIAJA   ← la que decide
  🔴 invoices  → NO VIAJA
  ✔ status     → SÍ VIAJA   ← el dato por el que SCRUM-823 quiere ramificar
```

Los campos que **sí** llegan a cada fila de `GET /admin/jobs`:

```
asignados, assignedUserId, createdAt, customer, direccion, estadoCobro, hasCustomPlan, id,
importeReferencia, nextStage, notes, operario, operarioId, pendingStagesCount, quote, remaining,
scheduledAt, status, tipoOperacion, titulo, totalAceptado, totalCobrado
```

El **detalle** (`GET /admin/jobs/:id` → `serializeJobDetail`) sí manda `albaranes` **e** `invoices`.
La **lista** (`serializeJob`) no manda ninguno de los dos. Son la misma función base con dos
salidas distintas, y la escalera es la misma para las dos pantallas.

## 🔴 Y de ahí sale el hallazgo que explica la medición del ticket

La escalera tiene **cinco peldaños**, y cada uno necesita un dato. Derivado de los campos que
acaban de llegar —no de una opinión sobre el código—:

| Nivel | `kind` | Necesita | En la LISTA |
|---|---|---|---|
| 1 | `cobrar` | `status`, `remaining` | **alcanzable** |
| 2 | `recordar` | `invoices`, `customer` | 🔴 **INALCANZABLE** — no viaja `invoices` |
| 3 | `firmar` | `albaranes` | 🔴 **INALCANZABLE** — no viaja `albaranes` |
| 4 | `emitir` | `albaranes` | 🔴 **INALCANZABLE** — no viaja `albaranes` |
| 5 | `nuevo` | — | **alcanzable** |

**En la lista, la escalera sólo puede contestar DOS de sus cinco respuestas.** No es que «se
equivoque»: es que los otros tres peldaños no pueden salir nunca en esa pantalla. Y como el nivel 5
es el último y no exige nada, **todo lo que no sea «terminado con saldo» cae en «+ Nuevo albarán»**.

Eso reproduce exactamente lo que midió la sesión 4 —`9 × + Nuevo albarán` y `1 × Cobrar el resto`—
y lo explica sin suponer nada. **La fila cerrada que ofrece crear un albarán no es un caso raro: es
el desenlace por defecto.**

## Lo que este entorno NO ha podido observar, dicho

🔴 Desarrollo es **demasiado fino** para reproducir la tabla completa, y se dice en vez de dar por
observado lo que no se ha visto:

- **3 Trabajos**, todos del mismo merchant, **todos en `pendiente_agendar`**. Los otros cuatro
  estados **no se han observado aquí**.
- **CERO albaranes en toda la base.** Por eso el control «¿dicen lo mismo la lista y el detalle?»
  **no discrimina en este entorno**: coinciden por fuerza, porque el detalle no puede tener nada de
  más. Coincidir aquí **no** es «están de acuerdo»: es «este entorno no puede notar la diferencia».
  La contradicción de SCRUM-829 sólo se ve donde HAYA albaranes.

El censo imprime las dos limitaciones él mismo. Un instrumento que calla su alcance se lee como si
lo hubiera medido todo.

---

# 🔴 LA DEPENDENCIA YA ESTÁ RESUELTA… EN UNA RAMA SIN MERGEAR

La misma consulta al remoto que descartó un duplicado encontró algo que cambia **cuándo** se
desbloquea esto:

```
scrum-816-lista-de-trabajos  →  4dd6baa8ba0292273be28842bcafd02eaa40f15d
   3 commits sobre main · 22 ficheros · +1817 / −61
```

**Y hace exactamente lo que le falta a la lista.** Medido sobre esa rama, sin tocarla
(`git show <sha>:src/modules/jobs/app/routes/jobs.routes.ts`): su `serializeJob` —el de la
LISTA— devuelve ahora **`albaranes` e `invoices`**, los dos que hoy no viajan.

Así que la tabla de peldaños de arriba se convierte en esto en cuanto 816 entre en `main`:

| Nivel | Hoy en `main` | Con 816 mergeado |
|---|---|---|
| 1 `cobrar` | alcanzable | alcanzable |
| 2 `recordar` | 🔴 inalcanzable | **alcanzable** |
| 3 `firmar` | 🔴 inalcanzable | **alcanzable** |
| 4 `emitir` | 🔴 inalcanzable | **alcanzable** |
| 5 `nuevo` | alcanzable | alcanzable |

## ✅ Y NO HAY SOLAPE — comprobado, no supuesto

- **816 no toca `jobNextAction.js`.** Ni un fichero de su diff lo nombra.
- Su propia entrada reparte el trabajo con estas palabras: *«**(B) — que la escalera mire también
  el estado** se va a **SCRUM-823**: eso mueve el héroe del detalle del Trabajo, que es el ticket
  B. Depende de que (A) entre primero»*, y cierra su lista de ficheros con
  *«`jobNextAction.js` — componente compartido con el detalle del Trabajo (ticket B). **Intacto**»*.

Las dos sesiones han llegado por separado al mismo reparto. **Este ticket no duplica nada, y quien
lo tome después de 816 encuentra el terreno limpio.**

⚠️ Lo que sí conviene saber: **816 sí toca `jobsView.js`** —agrupa las filas bajo cabeceras por
estado (🔨 En curso · ✅ Terminados · 🔒 Cerrados) y pinta una píldora de estado por fila—. Eso NO
es la escalera, pero cambia el contexto visual donde va a vivir la acción principal: quien
construya esta tabla debería mirar esas cabeceras antes de decidir cuánto peso necesita cada
rótulo.

---

# LA TABLA DE LOS CINCO ESTADOS

Los cinco de la FSM, cerrados en la Parte L y en `job.service.ts:9`. Para cada uno, la acción
principal que le tocaría y **si su rótulo ya existe en pantalla**.

| Estado | Acción principal que le tocaría | Rótulo | ¿Existe hoy? |
|---|---|---|---|
| `pendiente_agendar` | **Agendar** — sin fecha no hay nada que entregar | `Agendar` | ✅ **sí**, en el «⋯» de la lista (`jobsView.js:752`) |
| `agendado` | **Empezar** — tiene fecha; lo siguiente es ponerse | `▶ Empezar` | ✅ **sí** (`jobsView.js:755`). `Reagendar` también existe (`:752`) como alternativa |
| `en_curso` | **la escalera de albaranes de HOY** (nuevo → emitir → firmar) | `+ Nuevo albarán` · `Emitir albarán` · `Enviar para firmar` | ✅ **sí**, son los niveles 3/4/5 de la propia escalera |
| `terminado` | **Cobrar el resto** si queda saldo; si no queda, **Cerrar trabajo** | `💰 Cobrar el resto (…)` · `Cerrar trabajo` | ✅ **sí** — nivel 1 de la escalera y `jobsView.js:769` |
| `cerrado` | **NINGUNA** | — | ✅ no hace falta ninguno: la escalera **ya sabe devolver `null`** (nivel 6) |

## 🔴 Lo que esta tabla dice, y es lo que abarata el ticket

**Cuatro de los cinco estados no estrenan ni una palabra.** Los rótulos ya están en pantalla, en el
mismo «⋯» de la misma lista; lo que cambia es **cuál sube a acción principal**, no qué dice.

Y el quinto —`cerrado`— tampoco: la acción correcta es **no ofrecer ninguna**, y para eso la
escalera ya tiene su nivel 6.

⚠️ **Dos coherencias medidas, no supuestas:**

- `puedeCerrarTrabajo(job)` es exactamente `job.status === 'terminado'`
  (`jobsCierreTrabajo.js:94-96`). Así que proponer «Cerrar trabajo» como acción principal de
  `terminado` **no inventa una transición**: es la que la FSM ya permite ahí y sólo ahí.
- `▶ Empezar` sólo se ofrece hoy si `status === 'agendado'`, y `Agendar`/`Reagendar` sólo en
  `pendiente_agendar`/`agendado`. La tabla **no amplía** dónde se puede hacer cada cosa: sube a
  primaria lo que ya estaba permitido en ese estado.

---

# LOS RÓTULOS QUE HARÍAN FALTA · descritos, NO escritos

## Sólo hay UNO, y hoy **no se puede encender**

**La ranura:** el estado `terminado` tiene un caso que la tabla de arriba no cubre — cuando el
trabajo está terminado, **no** queda saldo pendiente, pero hay **partes con líneas sin valorar**.
Ahí ni «Cobrar el resto» ni «Cerrar trabajo» son lo siguiente: lo siguiente es poner precio.

**Qué haría falta:** un rótulo para esa acción principal, en el mismo tono breve e imperativo que
`Agendar` y `▶ Empezar`, que mande al profesional a valorar lo que sus técnicos han apuntado.

⛔ **NO SE ESCRIBE, y no sólo por la regla 30.** Está **medido** que hoy no tendría con qué
encenderse:

- `sinValorar` se calcula **únicamente** en `GET /admin/partes/oficina/pendientes`
  (`partes.routes.ts:173`), y lo consume **sólo** `parteOficinaView.js:50`.
- La lista de Trabajos **no pide esa ruta** y **no recibe ese dato** por ninguna otra vía.

**Firmar un rótulo que no tiene con qué encenderse es peor que no tenerlo**: quedaría aprobado, sin
usarse, y el día que alguien lo cablee nadie recordaría bajo qué condición se aprobó.

🔴 Y ojo con el atajo: el ticket avisa de que «con partes sin valorar» **no es un estado de la
fila** — es una condición **por línea de un parte**. Meterlo como sexto estado sería inventar un
estado (regla 27). La FSM tiene cinco y son cerrados.

## Lo que NO hace falta firmar

Los ocho rótulos de la tabla —`Agendar`, `Reagendar`, `▶ Empezar`, `+ Nuevo albarán`,
`Emitir albarán`, `Enviar para firmar`, `💰 Cobrar el resto (…)`, `Cerrar trabajo`— **ya están en
pantalla con ese literal exacto**. Subirlos a acción principal no estrena texto y no toca
`SIN_APROBAR`.

---

# ⛔ LO QUE NO SE HA HECHO, Y POR QUÉ

- **No se ha tocado `jobNextAction.js`.** Construir la ramificación por estado ahora significa
  escribirla sobre una lista a la que le faltan dos de los tres datos que la escalera mira. Sería
  cablear una decisión correcta encima de una entrada incompleta.
- **No se ha pintado la acción a mano en la lista** para esquivar la escalera. Lo prohíbe el guard
  de **SCRUM-366** —cualquier fichero de `dashboard/js` que pinte `btn-primary` y hable con
  `/admin/jobs/` tiene que llamar a la escalera— y ese guard **es correcto y no se toca**.
- **No se ha tocado `serializeJob`** para meterle los albaranes: eso **es SCRUM-816**, y lo está
  haciendo otra sesión ahora mismo. Dos sesiones escribiendo la misma función es cómo se pierde una
  de las dos.
- **Ni un rótulo nuevo.** Ver arriba.
- **Ni schema, ni staging, ni producción.** Nada de eso entra aquí.

---

# EL ③, PARA CUANDO SCRUM-816 ATERRICE

0. **Antes de nada, la consulta al remoto** por NOMBRE de rama. El estado de Jira no sabe qué
   ramas existen y nunca lo va a saber.
1. **Re-correr este censo.** Si dice `✅ La lista YA recibe los albaranes`, la dependencia está
   resuelta y el ticket se puede construir. Es la misma orden que decidió hoy, y decide igual
   mañana sin que nadie tenga que acordarse del contexto. **Lo que lo pondrá en verde es el merge
   de `scrum-816-lista-de-trabajos` (`4dd6baa8`)**, no un cambio de este ticket.
2. Ramificar `jobNextAction` **por `job.status`** antes de los peldaños de albarán, con la tabla de
   arriba.
3. **El rojo, corrido:** hoy una fila `cerrado` ofrece «+ Nuevo albarán». Después, no. Hace falta
   un entorno **con** filas cerradas — en dev no hay ninguna.
4. **El positivo enumerado:** los cinco estados dan su acción, uno a uno, **en la lista y en el
   detalle**. Es donde se ve si la escalera sigue siendo una sola.
5. **El negativo:** el guard de SCRUM-366 sigue verde **y sigue pudiendo caer**. Si el arreglo lo
   apaga, está mal.
6. **La coherencia:** lista y detalle dicen lo mismo del mismo Trabajo — y ese control **sólo
   discrimina donde haya albaranes**, como quedó dicho arriba.

---

# 🕳️ Huecos declarados

1. **La tabla de los cinco estados NO se ha ejercitado contra datos reales de los cinco.** En
   desarrollo sólo existe `pendiente_agendar`. Lo observado es un estado de cinco; el resto de la
   tabla es una propuesta razonada sobre la FSM y sobre los rótulos que existen, no una medición.
2. **El control lista-vs-detalle no discrimina en este entorno** (cero albaranes). Se dice en la
   propia salida del censo.
3. **Nada de esto se ha medido en staging ni en producción**, que es donde la sesión 4 vio las diez
   filas. Fuera del encargo.
4. **La acción de `terminado` tiene una tercera rama sin rótulo** (partes sin valorar) que no se
   puede construir hasta que ese dato viaje. **No lo trae SCRUM-816**: comprobado sobre su rama,
   añade `albaranes` e `invoices`, y no `sinValorar`, que vive en otra ruta y de otro módulo.
5. **La rama de 816 se ha MEDIDO, no ejecutado.** Se leyó su `serializeJob` con `git show`; no se
   ha hecho `checkout`, ni se ha corrido su tanda, ni se ha vuelto a pasar el censo contra ella.
   Que esos campos viajen **de verdad** por HTTP es de su sesión, no de ésta.


---
---

# SESIÓN 4 · LA CONSTRUCCIÓN, YA CON (A) DENTRO

**Medido contra:** `origin/main` = `a44ecb8df3fcb9ae009ed980235f808cc526ab47` · 2026-09-08T09:54:01+02:00
**Rama:** `scrum-823-la-escalera-mira-el-estado`, partida de `scrum-816-lista-de-trabajos-al-dia`

> 🔴 **LA ENTRADA DE ARRIBA NO SE TOCA.** Es el PASO 0 de otra sesión, que **paró con razón**: en
> `origin/main` la dependencia sigue viva. Esta sección se añade debajo porque parte de un árbol
> distinto —la rama de 816 ya certificada, donde `serializeJob` sí manda `albaranes` e
> `invoices`—, no porque aquella medición haya caducado.
>
> Su hueco declarado nº 5 decía: *«la rama de 816 se ha MEDIDO, no ejecutado»*. **Aquí se ha
> ejecutado**: se ha hecho `checkout` de ella, se ha corrido su tanda y se ha montado en navegador.

## Las dos sesiones, y cómo se resolvieron las dos discrepancias

| Estado | Sesión previa (PASO 0) | Yo, en la primera vuelta | **Decisión del fundador (8-sep-2026)** |
|---|---|---|---|
| `pendiente_agendar` | Agendar | Agendar | **Agendar** |
| `agendado` | **▶ Empezar** | escalera de documentos | **▶ Empezar** — gana la sesión previa |
| `en_curso` | documentos | documentos | **documentos**, sin cambio |
| `terminado` | Cobrar; si no, **Cerrar trabajo** | Cobrar; si no, documentos | **documentos** — gana mi objeción |
| `cerrado` | ninguna | ninguna | **ninguna** |

### `agendado` → «▶ Empezar»: la tabla original del fundador estaba mal, y lo dice él

> *«Un trabajo agendado NO SE HA EMPEZADO, y prepararle el documento de entrega es el mismo error
> que hacerlo sin fecha, solo que más tarde. Mi tabla del 816 decía "agendado / en marcha → Nuevo
> albarán" metiendo dos cosas distintas en una fila, que es justo lo que este ticket vino a
> arreglar.»*

Y con ello, una instrucción de método que queda escrita: **si una medición tumba una decisión
firmada, gana la medición — se dice y se construye, no se para.** La primera vuelta paró por
corregir algo firmado; eso era de más.

### `terminado` sin saldo → NO se sube «Cerrar trabajo»

> 🔒 **Un acto irreversible no puede ser NUNCA la acción principal de una fila. La acción principal
> es la que se pulsa sin leer: para eso está en primaria y por eso funciona. Poner ahí lo que no
> tiene vuelta atrás es usar el mecanismo justo al revés de para lo que sirve.** (Fundador.)

Se queda en el «⋯» con su modal, que es la decisión de SCRUM-344 y sigue vigente. Y el segundo
argumento lo remata: **un terminado sin albarán todavía tiene que emitirlo**, así que la escalera
de documentos es lo correcto también por orden, no sólo por seguridad. Hay test por los dos lados:
que `cerrar` no entre en la escalera, y que un terminado sin albarán proponga emitirlo.

## Lo construido, y verificado corriendo

```
1 · cobrar    (terminado + resto)          — sin cambio
2 · recordar  (factura vieja sin pagar)    — sin cambio
2-bis · agendar   ← NUEVO, si pendiente_agendar
3/4/5 · documentos — SÓLO si agendado | en_curso | terminado
6 · nada
```

**La matriz completa** (5 estados × 4 situaciones de albarán × 2 de dinero): los casos en los que
un trabajo sin fecha o ya cerrado recibía una acción de documento pasan de **12 de 40 a 0 de 40**.

## 🔴 El riesgo que midió esta sesión antes de tocar nada

Doblando la escalera para que devolviera un `kind` que el detalle no conoce, en Edge:

```
EL DETALLE, DESPUÉS DEL CLIC:
  rótulo del botón : «Enviando…»      deshabilitado : true
  escrituras : []   avisos : []   modal : false   navegaciones : 0
```

**Un CTA muerto que afirma estar enviando algo.** Causa: `jobDetailView` **no sabía agendar** —
`scheduledAt` aparecía **0 veces** y no tenía ni una transición de estado. Es el defecto de
SCRUM-366 **en espejo**: `abrirAgendar` y `jobsModal` vivían dentro de `jobsView.js` y la otra
pantalla no podía nombrarlas. Se mudan VERBATIM a `public/dashboard/js/jobAgendar.js`.

### La verificación enumerada que pidió el fundador

`npm run guard:escalera-por-estado` — las DOS pantallas montadas, estado por estado:

```
estado              LISTA                   DETALLE
pendiente_agendar   «Agendar»               «Agendar»
agendado            «+ Nuevo albarán»       «+ Nuevo albarán»
en_curso            «+ Nuevo albarán»       «+ Nuevo albarán»
terminado           «+ Nuevo albarán»       «+ Nuevo albarán»
cerrado             (ninguna)               (ninguna)
   ✅ SUELO · los cinco estados dan 3 rótulos distintos: hay algo que comparar
② «Agendar» ejecutable en las DOS: modal ✅ campo de fecha ✅ no navegó ✅ botón no colgado ✅
③ Un Trabajo CERRADO no propone nada en ninguna (61 y 134 nodos pintados)
```

**Probado en rojo** quitando la rama de `agendar` del detalle: cae ② nombrando el botón colgado.

**Y su suelo cazó un verde falso en la primera pasada:** el grupo «Cerrados» nace plegado, así que
③ decía «✅ sin acción principal» **porque no había fila**. Ahora se despliega con el botón del
producto antes de medir. Es el hueco nº 3 de la entrada de arriba —«un entorno con filas
cerradas»— cerrado por construcción en vez de por datos.

⛔ **El guard de SCRUM-366 no se ha tocado ni relajado**, y hay test que lo comprueba: conserva su
pertenencia estructural, no menciona `jobAgendar`, y `jobAgendar.js` no habla con `/admin/jobs/`
—el PATCH lo hace quien llama—, que es lo que lo mantiene fuera de «superficie que decide».

## «Valorar»: sigue sin poderse encender, confirmado sobre el árbol con (A)

La entrada de arriba lo midió contra `main`; aquí se ha vuelto a comprobar **con 816 dentro**:
`sinValorar` no aparece en `serializeJob`. (A) añade `albaranes` e `invoices`, no los partes.

## Los guards de la casa que reaccionaron — ninguno se relajó

| guard | qué dijo | qué se hizo |
|---|---|---|
| SCRUM-274 | el shell del SW no precachea `jobAgendar.js` | añadido a `sw.js` |
| SCRUM-412 | `btn-primary btn-sm` sin clasificar | la declaración **cambia de fichero, no de clasificación** |
| SCRUM-644 | `jobDetailView` pasaba de 11 a 12 sitios con `.message` crudo | **no se subió el techo**: los dos caminos de fallo del CTA entran por un `falloDelCta` |
| SCRUM-768/769 | `renderJobDetailView` desaparece del censo de «botón de crear» | medido: nunca tuvo uno propio (el suyo es `btn-secondary`); el censo contaba el CTA |
| SCRUM-522 | 16 → 17 guards fuera de la tanda | declarado con su motivo |

### 🔴 Dos hallazgos de instrumento, arreglados en la causa

- **SCRUM-428** preguntaba `html.indexOf('jobsView.js')` sobre el índice ENTERO, así que casó con
  un **comentario** que menciona el fichero y denunció un orden de carga que no había cambiado. Se
  ancla en `<script src=`. La trampa de auto-referencia de siempre.
- **SCRUM-817** usaba `status: 'in_progress'`, **un estado que el producto no tiene** (la FSM dice
  `en_curso`; `in_progress` no aparece ni una vez en `src/modules/jobs/` ni en el schema, y ese
  fichero era el único del árbol que lo usaba). No molestaba mientras la escalera no mirase el
  estado. Se corrige **el fixture**, no la lista de controles esperados.

## El hallazgo que se reportó SIN tocar, y que el fundador mandó cerrar aquí

La sección de Albaranes del detalle seguía ofreciendo «+ Nuevo albarán» en un Trabajo CERRADO.
Es un `btn-secondary` que **no pasa por la escalera**, así que el arreglo de arriba no lo
alcanzaba: se había arreglado lo que el producto PROPONE y quedaba abierto lo que PERMITE.

> *«Es el mismo defecto por una puerta que la escalera no vigila.»* (Fundador.)

Cabía —mismo fichero ya tocado, una condición— así que se cierra aquí. Se **oculta la barra**
en vez de deshabilitar el botón: deshabilitar sin decir por qué deja un control muerto, y
decirlo exigiría un texto que nadie ha firmado (regla 30). Y **sólo en `cerrado`**: en los
demás estados el profesional puede tener su motivo y el estado es reversible.

El guard lo mide **con control positivo**: la barra TIENE que verse en un Trabajo en curso. Sin
eso, un «no se ve» en el cerrado podría significar que la sección entera dejó de pintarse.

## Lo que NO se ha tocado

- El guard de SCRUM-366 · los niveles de dinero · el orden de la escalera.
- Los dos estados en discrepancia (`agendado`, `terminado`): esperan decisión del fundador.
- Ningún rótulo nuevo · ningún `style=` en línea · `prisma/schema.prisma` · el camino de emisión.
