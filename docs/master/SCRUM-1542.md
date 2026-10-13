# SCRUM-1542 · El vigía del despliegue midió MAL: producción iba 59 segundos por detrás, no 95,8 h. Medido y SIN arreglar

**Medido contra:** `origin/main` = `9308125e7c7885fb9568fcd633ad8dc1fa021eba` · 2026-10-13T13:00Z

A9: aviso → A10 «Una fecha de commit dice cuándo se escribió, no cuándo entró.» — no se pudo comprobar: lo que lo impediría es un test que compare la cifra del vigía con la hora de entrada por primer padre, y eso exige tocar el vigía, que es carril de S5; este PR sólo trae medición

Carril: **J2 escribe sólo `docs/`** (este registro, su carpeta de evidencias y una línea en A10, la
excepción de `dos-equipos.md` §3.4). El ticket lleva `equipo-luis`, `area-s5` y
`medido-por-equipo-javier`: **el arreglo es de S5 y NO está escrito.** No se ha tocado el vigía, ningún
script suyo, ningún workflow, nada de `src/` ni de producción.

Dos sesiones, y se dice cuál hizo qué:

- **La medición es de `jv-j2j`** (13-oct-2026, 13:00Z, sobre el `main` del ancla) y vive entera en Jira,
  **comentario 19386 de SCRUM-1542: es lo primero que hay que leer.** Todas las cifras de abajo son suyas
  salvo las marcadas «relectura».
- **El registro lo escribe `jv-j2k`**, relevo acotado. No ha vuelto a medir contra la red. Lo que sí hizo:
  copiar los guiones y los datos, **volver a correr cinco de los seis guiones desde su sitio sobre los datos
  ya bajados** (13-oct, entre 13:11Z y 13:15Z, con `origin/main` ya en
  `6f61841b5c6bb90ac2a0124fe4e37178efdf763c`) y cotejar las cifras. De ese cotejo sale **una corrección**
  al comentario 19386 (apartado «Lo que la relectura corrige»).

## El titular

**Es la lectura ② del ticket: el vigía midió mal.** El 13-oct a las 11:38:12Z dijo «20 commits y 95,8 h
por detrás». **Producción iba 59 segundos por detrás.**

**La cifra es la EDAD DEL COMMIT MÁS VIEJO de la rama recién mergeada, no el tiempo que ese trabajo
lleva en `main` sin desplegar.** El vigía calcula `ahora − min(%ct)` sobre TODOS los commits de
`prod..main` (`scripts/vigilante-de-despliegue.mjs`), y ese conjunto incluye los commits de dentro de
las ramas, que llevan la fecha en que se ESCRIBIERON. Mide cuándo se escribió, no cuándo entró.

El caso, commit a commit:

| qué | valor | de dónde sale |
|---|---|---|
| producción decía | `38de705e` | log del job 115272657889 |
| ese commit quedó vivo | 11:36:29Z | despliegue de Railway en la API de GitHub, `SUCCESS` |
| `main` estaba en | `f7a4c816` | log del job |
| merges que le faltaban a producción | **2** (#2373 a las 11:37:13Z y #2340 a las 11:37:42Z) | `git log --first-parent` |
| commits que contó el vigía | 20 | los 2 merges más los 18 de dentro de las ramas |
| el commit que dio las 95,8 h | `a25c04ec6`, escrito el 9-oct 11:51Z en la rama de #2340 | `git log --format=%ct` |
| hueco real | **59 s** | 11:38:12 menos 11:37:13 |
| el despliegue de ese merge | creado 11:37:19Z, `SUCCESS` 11:39:28Z | API de despliegues |

## Cómo se separó: dos vías ajenas al propio vigía

Es lo que da valor a la medición. El ticket pedía una pata que no dependiera de cuántas veces se repite
el síntoma, y son dos:

1. **`git log --first-parent prod..main`**: cuándo ENTRÓ cada cosa en `main` (la hora del merge la pone
   GitHub; el push directo está bloqueado).
2. **Los despliegues que Railway le cuenta a la API de GitHub**: cuándo quedó VIVA cada cosa.

**Población: 105 ejecuciones del vigía con log leído**, del 6-oct 03:33Z al 13-oct 12:39Z (75 del job
de CI y 30 del programado; 105 de 105 con su renglón de constancia; ningún log por debajo de 1.000 B).
78 sin hueco y **27 con hueco**.

| sobre las 27 con hueco | cuántas |
|---|---|
| el recálculo reproduce la cifra del vigía (a 0,1 h y con el mismo nº de commits) | **27 de 27** |
| el vigía infla más de 1 h sobre el hueco real | **8 de 27** |
| hueco real de más de 6 h (el margen del vigía) | **0 de 27** |
| hueco real máximo | **1,4 min** (7-oct 16:37Z) |

Las 8 infladas (vigía → real): 4,0 h → 19 s · 3,9 h → 67 s · 10,1 h → 15 s · 1,1 h → 45 s ·
5,6 h → 18 s · 1,1 h → 19 s · 4,8 h → 71 s · 95,8 h → 59 s. La de 5,6 h (8-oct 07:46Z) se quedó a
24 minutos de cruzar el margen con un hueco real de 18 segundos.

**Retraso real de producción en la semana, sin usar el vigía:** 188 commits de primer padre y 188
despliegues (185 `SUCCESS`, 1 `FAILURE`, 2 en curso al medir). Sobre los **186** con «vivo» medido:
**mediana 2,1 min**, p90 3,7 min, **máximo 16,6 min**, ninguno por encima de 30 min. El único
despliegue fallido (`944cc64f`, 13-oct 04:56Z) lo tapó el siguiente en minutos.

## El verde NO estaba fijado

El ticket suponía «verde por diseño, porque el job se llama (informativo)». **Medido: no.** El paso
salió `success` porque el guion salió con **código 0**, por la rama `DESPLIEGA` del ritmo
(`salidaConRitmo`: «RETRASADO, PERO DESPLEGANDO», producción había pasado de `9358f02b` a `38de705e`).

**El job SABE ponerse rojo:** el 7-oct a las 06:25Z el mismo job salió con **código 1** y GitHub lo
marcó `failure` (job 112661659895), con el run entero en `success`. `continue-on-error` no fija el
verde: hace que ese rojo no tiña el run.

Aquel rojo del 7-oct fue, además, una **falsa alarma**: dijo «CONGELADA, 10,1 h» con un hueco real de
15 s. No la recibió nadie: el job de CI no abre Issue.

## 🔴 Lo más importante: el vigía SÍ avisó una vez, era VERDAD, y no llegó a nadie

Historia entera del programado: **213 ejecuciones** desde el 2-sep (207 `success`, 5 `failure`, 1 manual).

- **Del 24-sep 22:46Z al 25-sep 14:49Z: 4 rojos «PRODUCCIÓN CONGELADA», y eran verdad.** Hubo
  **24,5 h sin un despliegue bueno** (del 24-sep 16:12:01Z al 25-sep 16:40:37Z). El primer rojo llegó a
  las 6,5 h reales: con un margen de 6 h, a tiempo.
- **Pero la cifra era falsa también ahí.** Dijo 177,0 · 180,4 · 187,4 y 193,0 h. **El hueco real era
  6,5 · 9,9 · 16,9 y 22,6 h.**
- **Y no llegó a nadie.** El aviso por Issue de SCRUM-1123 (entró el 26-sep) **no ha disparado NUNCA**:
  **0 Issues con la marca** `vigia-despliegue:produccion-congelada` **sobre 2.382 filas** de la API
  (2 Issues y 2.380 PR). Control positivo: 2 Issues cualesquiera vistas. Control de cero: la marca
  escrita al revés da 0. Desde que ese aviso existe, el programado no ha salido con código 1 ni una
  vez: **ese camino no se ha visto funcionar en producción.**
- El quinto `failure` (30-sep) es ceguera, no aviso: `/version` no respondió, código 2.

### ⚠️ Las «193 h» y SCRUM-1122: qué está medido y qué NO

**Medido:** la cifra «193,0 h» sale en el **log del run 36150030935** (25-sep 14:49Z), y el comentario
de `.github/workflows/vigia-despliegue.yml` (línea 159 en el `main` de la relectura) la repite como
«SCRUM-1122: 193 h de hueco». **Esa cifra del log es la misma inflación**: el hueco real en ese
instante eran 22,6 h.

**🔴 NO medido: el ticket SCRUM-1122 no lo ha leído nadie**, ni `jv-j2j` ni `jv-j2k`. Este registro
**no dice que ese ticket esté mal**. Dice que la cifra del log lo está, que el comentario del workflow
la cita, y que el ticket está sin leer.

## El segundo defecto: el ritmo SÍ casa instantes distintos

Dentro de un run no hay carrera: las dos lecturas (`GET https://yaqu.app/version` y `origin/main`) van
separadas unos 3 s. El defecto de arriba es de MAGNITUD, no de instantes.

**El de instantes está en el ritmo** (`scripts/_ritmo-de-despliegue.mjs`): compara la producción de
AHORA con una lectura **en caché de la última ejecución PROGRAMADA**, y de aquella lectura sólo lee
`prod=`: **ni su hora ni su `main`**. A las 11:38Z comparó con una lectura de las 08:37Z. No comprueba
que el hueco existiera ya entonces.

Hacia qué lado cae cada uno: la cifra sólo puede **inflar** (el merge de primer padre está en el
conjunto, así que el mínimo nunca es posterior a él); el ritmo empuja hacia el **silencio** (con un
«atrasado» falso por rama vieja casi siempre producción ha cambiado desde la última lectura
programada, y sale 0). El resultado del 13-oct fue un verde que imprime 95,8 h: enseña a no leer la
cifra. *Razonado y NO medido:* en una parada real que empiece justo después de un despliegue, la
primera ejecución programada tras el margen saldría 0 y cantaría en la siguiente.

## De paso: el programado no corre 12 veces al día

El cron pide una ejecución cada 2 h. **Medido: 5,2 al día** (212 ejecuciones `schedule` en 40,4 días).
Desde el 6-oct, 30 ejecuciones; entre dos consecutivas, mínimo 3,2 h, **mediana 6,2 h, máximo 11,3 h**;
17 de 29 huecos pasan de 6 h. Por qué GitHub lo ejecuta a menos de la mitad: sin medir.

## Lo que la relectura corrige

**El comentario 19386 dice «22 despliegues fallidos seguidos». Los datos dicen otra cosa**, y se
escribe lo que dicen los datos (`salida-g-cotejo.txt`, sobre `despl-sep.json`):

- **22 es el total de despliegues fallidos de la ventana 23..26-sep** (134 despliegues: 112 buenos y
  22 fallidos), repartidos en **6 rachas**.
- **La racha seguida es de 17**, del 24-sep 16:15:39Z al 25-sep 16:22:34Z. Las otras cinco rachas son
  de 1 fallido cada una (25-sep 16:41Z, 17:29Z, 17:38Z y 18:34Z, y 26-sep 12:10Z).
- **Las 24,5 h sin despliegue bueno no cambian**: salen de las horas de los `SUCCESS`, no del recuento.

El comentario de Jira no se ha editado: es de otra sesión. La corrección se le ha dicho al orquestador.

Y dos cifras que la relectura da distintas **porque `main` se movió**, no porque la medición estuviera
mal: `d-real.mjs` mide hasta `origin/main`, que entre las dos pasadas avanzó un merge. Relectura: 189
commits de primer padre (eran 188), 3 sin despliegue bueno posterior (eran 2), y el control sembrado da
188 merges y 170,3 h (eran 187 y 169,9). Las cifras que importan no se mueven: 186 con «vivo» medido,
mediana 2,1, p90 3,7 y máximo 16,6 min.

## Aceptación → dónde se ve

El ticket no trae una lista bajo la palabra «Aceptación»; trae cuatro puntos bajo «Qué hay que hacer».
Son éstos:

| lo que pedía el ticket | dónde se ve |
|---|---|
| ① Leer el vigía y decir QUÉ compara | comentario 19386 de SCRUM-1542, punto ①; arriba, «El titular» y «El segundo defecto» |
| ② Averiguar por qué sale VERDE con ese número | comentario 19386, punto ②; `docs/master/evidencias/SCRUM-1542/leido.json` (el paso y el código de salida de cada job) |
| ③ Medir si producción estaba al día, por una vía independiente del vigía | `docs/master/evidencias/SCRUM-1542/hueco.json` y `salida-c-relectura.txt` (27 de 27) |
| ④ Decidir qué debe hacer al detectar retraso | NO HECHO → es del fundador; el arreglo de la magnitud y del ritmo, de S5 (el propio SCRUM-1542, `area-s5`). Lo medido para decidir: el único aviso real no llegó a nadie |

## Las evidencias, y lo que NO corre tal cual

Carpeta `docs/master/evidencias/SCRUM-1542/`. **Los seis guiones, `leido.json` y `hueco.json` son de
`jv-j2j`**: se copiaron sin tocar desde su árbol `.claude/worktrees/j2j-1542-vigia` (rama
`scrum-1542-el-vigia-que-no-avisa`, sin ningún commit), donde estaban sin seguimiento de git. El
sha256 de los ocho coincide en su árbol, en su carpeta temporal y en esta copia.

| fichero | de quién | ¿corre desde aquí? |
|---|---|---|
| `a-bajar.mjs <desde ISO> <dir>` | j2j | **NO se ha vuelto a correr.** Baja de la red los runs, los jobs y los logs; hoy bajaría otra ventana. Escribe `<dir>/jobs.json` y `<dir>/logs/` |
| `b-leer.mjs <dir>` | j2j | Arranca, pero **necesita `<dir>/jobs.json` y `<dir>/logs/`, que NO están en el repo.** Relectura sobre una copia de los logs: sale 0 y regenera `leido.json` idéntico (`salida-b-relectura.txt`) |
| `c-hueco.mjs <dir> <repo> <despl.json>` | j2j | **Sí**, con `<dir>` = una carpeta con `leido.json` y el tercer argumento = `despl.json`. Sale 0 y regenera `hueco.json` idéntico (`salida-c-relectura.txt`). ⚠️ Escribe `hueco.json` en `<dir>` |
| `d-real.mjs <repo> <despl.json> <desdeSha>` | j2j | **Sí**, con `despl.json` y `0dbf8eae`. Mide hasta `origin/main`: la población crece con cada merge (`salida-d-relectura.txt`) |
| `e-historia.mjs` (sin argumentos) | j2j | **NO corre tal cual.** Lee `prog-todos.json` e `issues.json` por NOMBRE RELATIVO al directorio de trabajo, y ninguno de los dos está en el repo (2,8 y 10,7 MB). Lanzado desde la raíz del repo sale con código 1 (`ENOENT`). Relectura con el directorio de trabajo en una copia de esos dos ficheros: sale 0 (`salida-e-relectura.txt`). ⚠️ Escribe `prog-rojos.json` donde se lance |
| `f-sep.mjs <repo> <despl-sep.json>` | j2j | **Sí**, con `despl-sep.json`. Sale 0 (`salida-f-relectura.txt`) |
| `leido.json`, `hueco.json` | j2j | las dos salidas de la medición: 105 lecturas y 27 con hueco |
| `despl.json`, `despl-sep.json` | j2j, rescatados por j2k de su carpeta temporal | lo que devolvió `docs/master/evidencias/SCRUM-1393/despliegues.mjs`: 188 despliegues desde el 6-oct y 667 desde el 23-sep. Sin ellos `c`, `d` y `f` no corren sin volver a la red |
| `g-cotejo.mjs <dir>`, `salida-g-cotejo.txt` | j2k | lee `hueco.json`, `despl.json` y `despl-sep.json` ya comiteados; no mide nada nuevo. De aquí sale la racha de 17 |
| `salida-{b,c,d,e,f}-relectura.txt` | j2k | la salida de cada relectura del 13-oct |

Los argumentos con que `jv-j2j` lanzó cada guion se leyeron en su transcripción, no se dedujeron.

## No disponible, y no medido

- **Los logs NO están en el repo**: 105 de octubre (3,8 MB) y 5 de los rojos de septiembre. Al escribir
  esto seguían en la carpeta temporal del trabajo `76f6caa6`, que se borra con él. No se comitean: son
  3,8 MB de salida de CI. Se volverían a bajar con `a-bajar.mjs`, mientras GitHub los conserve.
- **`prog-todos.json` e `issues.json` tampoco** (13,4 MB entre los dos): sin ellos `e-historia.mjs` no
  se puede repetir desde el repo. Sus cifras (213 ejecuciones, 5,2 al día, 0 Issues sobre 2.382 filas)
  quedan en `salida-e-relectura.txt`.
- **El ticket SCRUM-1122, sin leer** (arriba).
- Nada anterior al 6-oct en el job de CI, ni los verdes del programado anteriores a esa fecha: de la
  historia vieja sólo se leyeron los 5 `failure`. **Si hubo más paradas reales que el vigía dejó pasar
  en verde antes del 6-oct, no se sabe.**
- Los despliegues de antes del 23-sep. Si hubo efecto visible para usuarios el 24–25 sep.
- No se ejecutó el vigía ni sus tests: todo es lectura. No se ha comprobado que la propuesta de abajo
  no rompa los tests actuales del vigía.

## Propuesta para S5 (no construida)

1. **La magnitud:** fechar el hueco con el commit más antiguo de `git log --first-parent prod..main`,
   no con el de todo el rango. Sobre las 27 lecturas da de 0,1 a 1,4 min donde hoy da hasta 95,8 h, y
   en los 4 rojos reales de septiembre da de 6,5 a 22,6 h: sigue cantando cuando toca. Supuesto que
   hay que declarar: vale porque todo entra en `main` por merge de PR.
2. **El ritmo:** que la lectura anterior aporte también su hora y su `main`, y que «congelado» exija
   que lo que falta ya estuviera en `main` en aquella lectura.
3. **Qué hace al detectar** es del fundador (punto ④ del ticket).

## Errores propios

De `jv-j2j`, contados por ella en el comentario 19386: buscó el caso en un run cancelado que daba
«0 jobs»; midió su contexto tarde (187.210 con la medición ya hecha); y empezó por
`vigia-despliegue.yml` cuando el job «(informativo)» vive en `ci.yml`.

De `jv-j2k`:

1. **Le pasé un guion a node por bash con `node -e` y bash se comió las barras invertidas**: el guion
   no arrancó (`Unterminated regexp literal`). Falló en alto y no dio ningún número. Es la cicatriz de
   J2 del 1-oct y del 8-oct, por tercera vez, con las dos líneas leídas diez minutos antes. Lo rehice
   con la herramienta de ficheros.
2. La frase de A10 me llegó en la ficha sin tildes («cuando se escribio, no cuando entro»). No está en
   Jira para copiarla byte a byte: **las tildes las he puesto yo**, y lo digo.
3. El hook de arranque dijo «SIN IDENTIDAD» (SCRUM-1498). Seguí, porque el encargo es sólo `docs/`.
