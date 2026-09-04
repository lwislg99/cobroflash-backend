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
