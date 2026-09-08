# SCRUM-727 · el vigía deja constancia de cada ejecución, también de los verdes

**Medido contra:** `origin/main` = `cb9b858bb25db5c0ce03abd60465a50b51b33a9a` · 2026-09-04T16:51:08+01:00

## El caso, y no es preventivo

El 4-sep-2026 el vigía cantó **24,9 h y 9 commits de hueco**. El hueco se cerró solo y **no se
pudo decir por qué**: no había historial con el que comparar. Los verdes no dejaban rastro — el
título se imprimía en el log del job y ahí se quedaba, y la anotación de GitHub sólo se emite
cuando la salida **no** es 0.

> «Ha pasado dos veces» y «lo vemos venir» son cosas distintas, y la diferencia es tener el
> primero anotado cuando llega el segundo.

## PASO 0 — medido antes de escribir una línea

**a) ¿Dónde escribe hoy, y quién lo lee?** Sólo `console.log` al log del job, más una anotación
`::error` / `::warning` **condicionada a `v.salida !== 0`**. No hay artefacto, ni fichero, ni
resumen. Un verde no deja absolutamente nada.

**b) ¿Cuántas veces corre?** Dos sitios: el programado (`vigia-despliegue.yml`, cron `0 */2 * * *`
= **12/día**) y el job informativo de `ci.yml`, que corre en cada `pull_request` y en cada `push`
a `main`. Medido sobre los últimos 30 días: **1.950 commits, 813 merges, 17 días con actividad** —
o sea del orden de **48 ejecuciones de PR por día activo**, más las 12 programadas. Ese número es
justo el que descarta un fichero acumulativo en el repositorio.

**c) ¿El test del vigía sigue absolviéndolo?** Sí, y hay más de lo que ya sabíamos — medido con
una mutación, no leído: ver «Hallazgo» al final.

**MECANISMO: existe, y se le da superficie.** `scripts/guards-visuales.mjs:423` ya escribe en
`$GITHUB_STEP_SUMMARY` con su `try/catch` y su motivo escrito («el resumen es un extra: si no se
puede escribir, el código de salida sigue siendo el bueno»). Y el propio vigía ya declara que su
anotación reutiliza ese idioma: *«igual que hace `guards-visuales` (mismo mecanismo, no uno
nuevo)»*. Aquí no nace un canal: se extiende el que hay.

## Dónde se escribe, y por qué NO es un fichero del repositorio

Un fichero al que todas las ramas añaden es el defecto de SCRUM-709: chocó siete veces en dos
días. Con ~60 ejecuciones por día activo sería un conflicto constante, y además el workflow
programado declara `permissions: contents: read` y `main` está protegida — no puede escribir en el
repositorio ni aunque quisiéramos.

**El renglón va a dos sitios, los dos ya existentes:**

1. **La salida estándar**, siempre. Es lo que queda en el log del job y lo que se ve en local.
2. **`$GITHUB_STEP_SUMMARY`**, cuando lo hay: se lee en la página de la ejecución sin abrir el
   log. Es **por ejecución**, así que no acumula, no se ordena y no puede chocar con nadie.

El **historial** es la lista de ejecuciones del workflow, con un renglón legible en cada una.

## El renglón

```
vigía · 2026-03-04T15:00:00Z · atrasado · prod=dddddddd · main=eeeeeeee · hueco=24.9h · commits=9
```

Los cinco datos que pedía el encargo —commit de producción, commit de `main`, hueco en horas,
hueco en commits y el veredicto—, más la fecha y, cuando falta alguna magnitud, el **motivo**.

### 🔴 «NO SUPE MIRAR» no se pierde

SCRUM-716 costó un ticket entero por colapsar «no se pudo resolver `main`» en «al día». El
veredicto se escribe **tal cual** (`v.veredicto`, la misma constante que el vigía ya decidió), y
lo que no se pudo medir se escribe **`?`, nunca `0`**:

| ejecución | renglón |
|---|---|
| al día, sin hueco | `… · al-dia · prod=aaaaaaaa · main=aaaaaaaa · hueco=0.0h · commits=0` |
| ciego, `main` no resuelve | `… · no-supe-mirar · prod=ffffffff · main=? · hueco=? · commits=? · motivo=no se pudo resolver \`main\` en este repositorio.` |

`0` es una **medición**: dice que no hay hueco. `?` dice que **no se sabe**. Confundirlos es la
avería que esta casa arrastra, y el guard la vigila **en las dos direcciones**.

> El **motivo** no sale sólo en los ciegos, y eso lo cazó el propio banco al pintar los siete
> casos: «producción corre un commit que no está en `main`» es **`atrasado` con las dos magnitudes
> en `?`**, y sin motivo ese renglón es indistinguible de un atraso que no se pudo medir. Ahora el
> motivo va **siempre que falte una magnitud**.

## Anotar no es decidir

`constanciaDeEjecucion` es **pura** —ni red, ni git, ni reloj de pared: la fecha sale del
`ahoraEpoch` que ya se inyecta— y **recibe** el veredicto ya tomado. El guard lo comprueba en las
nueve ejecuciones del banco: ni el veredicto ni los datos de entrada cambian al anotarlos, y
`process.exit(v.salida)` sigue saliendo de `v.salida`.

Y el reparto es el mismo de `anuncio()` en `guards-visuales.mjs`: **el que formatea no escribe, y
el que escribe no decide**.

## Lo que se vigila, y lo que se vio en ROJO

Nueve casos en `tests/scrum727-constancia-del-vigia.test.mjs`. Las mutaciones, todas revertidas
con post-condición (`Buffer.compare` contra los bytes de disco — SCRUM-570) y `git status` limpio:

| mutación | quién la caza, y qué dice |
|---|---|
| se quita el `console.log(constancia.renglon)` | 🔴 *ejecutado de verdad* — «el vigía ha dejado **0** renglones en su salida, y tiene que dejar UNO por ejecución» |
| la constancia se mete dentro de `if (v.salida !== 0)` | 🔴 *se escribe SIEMPRE* — «LA CONSTANCIA CUELGA DE ALGO: `if (v.salida !== 0)`» |
| lo no medido se escribe `0.0h` en vez de `?` | 🔴 *un cero MEDIDO y un «no se sabe»* — «no escribe «?» en el hueco que no pudo medir» |
| el registro llama «al-dia» a lo que no supo mirar | 🔴 **dos** a la vez: *no colapsa los tres veredictos* («EL REGISTRO NO DISTINGUE LOS TRES VEREDICTOS») y *ejecutado de verdad* |
| se le quita el `try` a la escritura del resumen | 🔴 *el resumen usa el mecanismo que ya existe* — «NO está dentro de un `try`» |

**Control negativo:** el **aviso** (`::error` / `::warning`) **sigue siendo condicional**, y el
guard lo exige. Avisar de un verde doce veces al día es ruido, y el ruido apaga los avisos. Anotar
y avisar son cosas distintas; este control impide «arreglar» el ticket haciendo que todo grite.

**Suelo:** el censo de ejecuciones registradas exige **≥ 8 ejecuciones** en el banco y **un
renglón por cada una**. Si devolviera cero, cualquier «todas dejan renglón» sería verdad por falta
de casos.

**Y ejercitado de verdad**, no sólo formateado: se ejecuta el vigía como subproceso contra una URL
que rechaza la conexión, y se comprueba que deja **un** renglón en la salida, que dice
`no-supe-mirar`, que el código de salida sigue siendo `2` y que **el mismo renglón** aparece en el
fichero de `$GITHUB_STEP_SUMMARY`.

En vivo contra producción, el 4-sep-2026 a las 15:39 UTC — **el verde deja renglón, que es el
ticket entero**:

```
producción dice 792a14a7 · `main` está en 792a14a7 · sin hueco
vigía · 2026-09-04T15:39:49Z · al-dia · prod=792a14a7 · main=792a14a7 · hueco=0.0h · commits=0
```

## Ficheros

| fichero | qué cambia |
|---|---|
| `scripts/_vigilante-de-despliegue.mjs` | **+** `constanciaDeEjecucion`, `MARCA_CONSTANCIA`, `SIN_MEDIR`. Puro. No toca el veredicto |
| `scripts/vigilante-de-despliegue.mjs` | escribe el renglón **fuera de todo `if`** y lo manda al resumen del job |
| `tests/scrum727-constancia-del-vigia.test.mjs` | **nuevo** · los nueve casos |

**Ningún YAML cambia**: `$GITHUB_STEP_SUMMARY` lo define Actions solo. No se toca el veredicto, ni
el `exit code`, ni el `continue-on-error` del job, ni `.github/workflows/`.

## Dos trinquetes saltaron, y los dos tenían razón

No se les puso excepción a ninguno: un trinquete que salta pide una decisión, no una lista más
ancha.

* **SCRUM-226** cazó un `--url` en el `argv` de mi subproceso. Ese guard no tiene lista de
  excepciones **a propósito** —«que lo seguro no dispare sin lista es lo que lo hace un guard y no
  una lista de los que hoy fallan»—, y mi URL de bucle local no es una credencial pero **el patrón
  sí es el prohibido**. El test pasa a escribir un arrancador de usar y tirar que fija su propio
  `process.argv` y luego importa el vigía: así la URL **no viaja en el `argv` de ningún proceso**,
  que es exactamente la propiedad que aquel guard protege. `ps` sólo vería `node …/arranca.mjs`.
* **SCRUM-702** subió de **11 a 12**, declarado en su propio tope como pide su mensaje de fallo.
  La nueva dependencia es al revés del defecto que vigila: el test **fija** `GITHUB_ACTIONS` en el
  entorno del subproceso en vez de heredarlo, para que el vigía recorra el mismo camino en CI y en
  el portátil —anotación incluida—. No condiciona ningún aserto.

## Huecos declarados

* **El historial es la lista de ejecuciones del workflow**, no una tabla única. Comparar dos
  ejecuciones separadas por días sigue siendo abrir dos páginas — mejor que abrir dos logs y
  buscar, pero no es un panel. Y los logs de Actions caducan (90 días por defecto). Acumular en un
  solo sitio pediría permiso de escritura y un fichero compartido: es el defecto de SCRUM-709 y no
  se hace aquí.
* GitHub no garantiza la puntualidad de `schedule` y lo desactiva en repositorios parados 60 días
  — hueco ya declarado en `docs/master/SCRUM-677.md`. Esto no lo arregla: un renglón que no se
  escribe porque el job no corrió sigue sin existir.

## Hallazgo — medido, no leído, y de otro carril

`tests/scrum677b-el-vigia-esta-cableado.test.mjs` **no caza** que al job del vigía se le quite su
`continue-on-error`. Su recorte del job es
`CI.slice(i, CI.indexOf('\n  ', i + 200) === -1 ? CI.length : CI.length)` — **las dos ramas del
ternario dan `CI.length`**, así que lee hasta el final del fichero y se conforma con el
`continue-on-error: true` del job siguiente (`constancia-del-alter`). **Comprobado con una
mutación**: se lo quité al job del vigía y el guard siguió **verde**. El día que alguien lo
convierta en bloqueante, el candado que impide arreglar el problema mergeando se cierra sin que
ningún guard lo diga. No se toca aquí: es de otro carril.

---

# SCRUM-727b · la lista de Trabajos es una lista, y dice quién la ejecuta

**Medido contra:** `origin/main` = `1304643497934441f88950e441182b7e344dbb57` · 2026-09-04T19:11:47+02:00
**Medido en:** host `DESKTOP-T5MONF5` · rama `scrum-727-lista-de-trabajos`
**Carril:** front (lista) + un campo aditivo en el serializer de lista

> ⚠️ **Este fichero lo abrió la sesión de Javier** para el vigía de despliegue, y su contenido de
> arriba no se toca ni una palabra. El ticket es el mismo número, el trabajo es otro; se anexa
> aquí porque el guard de SCRUM-273 exige un fichero por ticket, como hizo la sesión 3 con
> SCRUM-710c.

## PASO 0 — el barrido de las cuatro hermanas

No era «fea»: era **la única que no era una lista**. Medido, no opinado:

| vista | `table-scroll` | `table--cards-mobile` | `col-hide-mobile` | `<thead>` |
|---|---|---|---|---|
| Clientes | 1 | 1 | 0 | 1 |
| Presupuestos | 1 | 1 | 2 | 1 |
| Albaranes | 1 | 3 | 1 | 1 |
| Facturas | 1 | 1 | 4 | 1 |
| **Trabajos** | **0** | **0** | **0** | **0** |

Así que no se estrena componente: se copia el que existe, con sus clases de celda, que son las que
la hoja convierte en card por debajo de 640 px.

## El dato que faltaba, y por qué `assignedUserId` no valía

El serializer de lista devolvía 19 claves y ninguna era `asignados`. Lo único que viajaba era
`assignedUserId`, **el espejo del PRIMER asignado** — la columna escalar «solo sabe guardar uno»
(`asignacionDeTrabajo.ts`). 🔒 **Un Trabajo con tres técnicos que enseña uno no está incompleto:
está mintiendo con cara de estar bien**, y desde la pantalla no hay forma de notarlo.

Se añade `asignados` **en lote**: una consulta con `in` sobre los ids de la página, agrupada
después. La objeción que el propio código dejó escrita —«sería una consulta por Trabajo, el N+1
que SCRUM-58 quitó midiendo 2910 ms contra 1270»— era correcta, y se cumple en vez de discutirla.
`assignedUserId` **no se toca ni se retira**: aditivo, como los ALTER. Cero cambios en el esquema:
el dato ya existía, solo que no se pedía.

## Lo que casi se pierde por el camino

- **Los grupos.** Su cabecera lleva el importe de «Terminados» y su salvedad, que son microcopy
  aprobada (SCRUM-428). Una tabla admite varios `<tbody>`: se agrupa sin dejar de ser una fila por
  trabajo.
- **Las transiciones.** `jobDetailView.js` tiene **cero** —ni agendar, ni empezar, ni terminar, ni
  cerrar— y `scheduledAt` no aparece ni una vez: esta lista era el ÚNICO sitio del producto donde
  se agenda un Trabajo. Sacar el `datetime-local` a pelo habría borrado la función. Se van al «⋯»
  y «Agendar» abre el modal de la casa.
- **El cierre.** Se abre en el modal con `CIERRE_TEXTOS` entero y literal: cambia el sitio, no una
  palabra. Aquí el riesgo no es el clic accidental, es no entender lo que se hace.

## El candado

🔒 **Una acción que modifica datos no puede dispararse con el mismo gesto con el que se navega.**
Abrir el Trabajo es un clic en la fila; asignar es entrar en el «⋯» y confirmar en un modal, y al
guardar **dice a quién ha dejado asignado**. Dos gestos distintos, y el segundo se ve.

## Dos defectos que sólo se vieron mirando la captura

1. **Dos botones con el mismo rótulo.** `jobNextAction` devuelve `💰 Cobrar el resto (importe)`
   para un terminado con saldo — la misma cadena que el botón de ejecutar—, así que la fila sacaba
   el par: uno navegaba y otro cobraba, sin forma de distinguirlos. Se queda el que **ejecuta**.
2. **El nombre del cliente cortado a media palabra.** Medido: no se solapaba con el importe (hay
   12 px de hueco), pero la tabla hereda `white-space: nowrap` y en la card de 390 px se leía
   «Cliente con nombre largo número 24.820,50 €» como una sola cadena. En una card el nombre del
   cliente es el identificador de la fila.

## Un cambio de diseño que salió de medir, no de opinar

El filtro ofrecía sólo a los técnicos **que ya tienen trabajos**. Con eso, «¿qué tiene Nadia esta
semana?» no se podía ni preguntar — y ésa es literalmente la pregunta del ticket. Ahora ofrece a
todo el equipo: **«ninguno» también es una respuesta**.

## Controles (la suite verde no vale)

Navegador real, `page.setViewport` (nunca `--window-size`), a 390 y a 1280:

- **Cero scroll horizontal** con 19 trabajos y con 1, en los dos anchos.
- **Nada se sale del ancho**: 0 elementos.
- **Suelo de no-pérdida**: 16 filas + 3 en el grupo plegado = 19.
- 🔴 **El control que decide**: un trabajo con TRES sale «Israel, Miguel, Jesús L.»; uno con CERO
  dice «Sin asignar».
- ✅ **Positivo**: las cuatro listas hermanas, huella sha256 **idéntica** a la de antes de empezar,
  y el diff de la hoja es **101 líneas añadidas y 0 borradas** — ningún selector existente se
  modifica, así que no pueden haber cambiado.
- ✅ **Negativo del filtro**: filtrando por un técnico sin trabajos quedan **0 filas** y lo dice.
- ✅ **Negativo de la asignación**, corrido: el clic en la fila navega a `jobs-detail` y deja
  **0 PATCH**. Abrir no asigna.
- ✅ **Suelos**: con cero trabajos lo dice; con cero técnicos asignables, también.

## Tres guards que se pusieron rojos, y ninguno se relajó

- **SCRUM-344** ancló su inyección en `jobCard`, que pasó a llamarse `jobRow`. Falló **diciendo que
  no encontraba dónde inyectar** en vez de pasar en verde sin probar nada: se actualiza el ancla.
- **SCRUM-412** exigió declarar los cuatro `btn-primary btn-sm` nuevos. Declarados uno a uno, y de
  paso con nombre propio: dos se llamaban `ok` y habrían compartido clave en la lista, tapándose.
- **SCRUM-644** tiene techo 2 de `.message` crudos en este fichero y yo dejaba 3. **Un trinquete
  solo baja**: los tres caminos pasan ahora por un único punto. ⚠️ Eso reduce la superficie, no la
  cura — por esa rendija sigue pudiendo salir un identificador del servidor, y traducirlo es otro
  ticket.

## Hallazgos abiertos (regla 37)

1. **`jobCierreSection` conserva 4 `style.cssText`** heredados. No se reescribe aquí: es la UI
   aprobada del cierre y mezclarla con este ticket sería tocar dos cosas a la vez.
2. **`JOB_STATE_META.pill`** ya no lo usa nadie: los colores del estado viven ahora en la hoja. Se
   deja el dato en su sitio para no tocar una estructura que otros ficheros podrían leer.

## Cierre

`npm run build` → 0 · `npm test` **5201 tests, 0 fallos** · `guards-entrada` 4/4 ·
`guards-visuales` **9/9**. Sin dependencias nuevas. Sin un `style=` en línea en lo reescrito.
