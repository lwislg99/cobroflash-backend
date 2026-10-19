# SCRUM-1463 · El latido dice si la cuenta QA vive y quién la renueva, y un vigía parado deja de leerse como «sin avisos»

**Rama:** `scrum-1463-latido-qa-y-vigia-callado` (sale de `scrum-1459-latido-lee-al-vigia`: mismo fichero) · **Carril:** S5 · **Fecha:** 6-oct-2026
**Medido contra:** `origin/main` = `39af736efc8ccf7d2966063561421855b3e4c4e9` · 2026-10-06T11:38:00Z (hora de GitHub)

A9: comprobación → `tests/scrum1463-latido-qa-y-vigia-callado.test.mjs`

Carril S5: `scripts/equipo/latido.mjs` y un test. No toca ningún workflow ni
`scripts/qa/sesion-panel.mjs`. Encargo del orquestador del 6-oct-2026 (~11:33Z).

## Qué arregla y qué no

Arregla que **quien llega y corre el latido lo sepa todo de golpe**: si puede mirar producción con la
cuenta QA, y si el instrumento que vigila los PR sigue vigilando.

No acorta un parón. Si nadie corre nada durante tres días, el latido sigue sin decir nada: es un
comando (ver `docs/master/SCRUM-1459.md`).

## Qué pasaba

### La cuenta QA

La sesión caducó el 3-oct a las 16:37Z y estuvo muerta hasta el 6-oct. El latido no la miraba. El
orquestador dijo durante cuatro días que la renovaba el fundador: el 2-oct a una sesión se le denegó el
permiso, y eso se leyó como «sólo puede él». La renovó el orquestador el 6-oct con un comando. Cuatro
tickets con su código en producción quedaron sin verificar ese tiempo.

`scripts/qa/sesion-panel.mjs estado` (SCRUM-1430) ya contestaba VIVA · MUERTA · NO SE PUEDE SABER, y
con MUERTA ya daba el comando. Faltaba que alguien lo corriera, y faltaba decir **quién** puede.

### El vigía callado

Con SCRUM-1459 la sección VIGÍA lee los avisos del issue. Un vigía que deja de correr no escribe
avisos, así que la sección saldría en ✅ indefinidamente: el mismo resultado para «no hay nada» y para
«nadie está mirando».

## Qué cambia

| Antes | Ahora |
|---|---|
| El latido no miraba la cuenta QA | Sección 10, **QA**, con la frase de `estado`: cuenta, y hasta cuándo |
| — | MUERTA es alerta: lleva el comando entero y «la renueva el orquestador, o cualquier sesión de esta máquina; no hace falta el fundador» |
| — | NO SE PUEDE SABER, un código sin su frase o un reventón: sección ciega (salida 2). Nunca «viva» por omisión |
| VIGÍA sólo leía comentarios | Lee además las corridas del workflow: «última pasada del vigía hace N h» delante de la línea |
| Vigía parado = ✅ | Última pasada de más de 12 h: 🔴 «el vigía NO CORRE desde hace N h y se le pide cada 3» |
| — | Última pasada terminada en otra cosa que `success`: 🔴 aunque sea reciente |
| — | Sin corridas legibles: sección ciega |

`estado` se **llama** (`ejecutar(['estado'])` importado), no se copia. Hace una petición GET a
`/admin/me` de producción con la cookie guardada, igual que el comando a mano. El latido no entra, no
renueva y no cierra sesión.

## Una corrección al encargo

El encargo pedía alertar «si el último **aviso** del vigía tiene más edad que su intervalo». Los avisos
no tienen intervalo: el vigía sólo comenta cuando la lista empeora (un PR entra, cambia de causa o cruza
24 h / 72 h / 168 h), así que entre dos avisos pueden pasar días con todo en orden. Lo que tiene
cadencia son sus **pasadas**, y eso es lo que se mide: las corridas de `vigia-atascados.yml`.

## El tope de 12 h, con su medida

El cron pide cada 3 h y GitHub lo retrasa o se lo salta.

| Ventana | Pasadas | Hueco mediano | Hueco mayor |
|---|---|---|---|
| 17 → 29-sep (SCRUM-1270, de la cabecera del workflow) | 60 | 4,9 h | 9,8 h |
| 29-sep → 6-oct (medido hoy, 30 corridas) | 30 | no calculado | 10,1 h |

Doce horas queda por encima de todo lo medido. Con el cron retrasándose más, daría falsos avisos; con
un vigía que muere, tarda hasta 12 h en decirlo.

## Medido después

`node scripts/equipo/latido.mjs`, 6-oct-2026 ~11:37Z:

```
🔴 VIGÍA · última pasada del vigía hace 2.2 h (success) · issue #1241 · 43 comentarios, 43 son avisos del vigía · 43 sin leer (3 con algún PR aún abierto, …)
✅ QA · sesión de la cuenta QA: VIVA — GET /admin/me → 200 (luisdragonball+qa@gmail.com); según su fichero caduca el 2026-10-07T11:34:39Z, dentro de 23 h 57 min (hora del servidor).
```

Coste: una llamada más a `gh` en VIGÍA (1,7 s la sección) y 0,2 s la de QA. El latido entero, 26,5 s.

El caso MUERTA y el caso «vigía parado» no se han visto en vivo: hoy la cuenta está viva y el vigía
corre. Están en el test, con las frases reales de `estado`.

## Tests

`tests/scrum1463-latido-qa-y-vigia-callado.test.mjs` → 8 de 8. Con los otros cinco del latido: 83 de 83.

Mutaciones, con la base sin mutar en 8/8 primero. Doce de doce mueren:

| Mutación | Caen |
|---|---|
| M1 · QA muerta no es alerta | 1 |
| M2 · QA muerta no dice quién la renueva | 1 |
| M3 · «no se puede saber» se da por viva | 1 |
| M4 · salir 0 basta para VIVA, diga lo que diga | 1 |
| M5 · salir 1 basta para MUERTA | 1 |
| M6 · el vigía parado no alerta | 2 |
| M7 · una pasada fallida cuenta como que miró | 1 |
| M8 · sin corridas se da por bueno | 2 |
| M9 · una corrida en cola cuenta como terminada | 2 |
| M10 · la ceguera de la pasada no ciega la sección | 1 |
| M11 · la alerta de la pasada no llega a la sección | 1 |
| M12 · el tope sube a una semana | 3 |

## Lo que se pidió y NO se ha construido aquí

**«Que el latido cuente los tickets En curso que ya están enteros en `main`».**

- El latido no tiene credenciales de Jira, y ningún guion del repositorio las tiene (buscado en
  `scripts/`: cero). Dárselas sería un secreto nuevo, descartado ese mismo día.
- El cruce ya existe: `scripts/abierto-con-trabajo-en-main.mjs` (SCRUM-1259). Recibe una foto de los
  tickets abiertos (el JSON del conector de Jira o un TSV), exige que no tenga más de 12 h y dice cuáles
  tienen su trabajo en `main`. Es lo que el orquestador hizo a mano sobre 40 tickets.
- No se ha corrido hoy: no hay foto.

Devuelto al orquestador con dos salidas (A: no tocar el latido · B: que lea una foto en una ruta
fija, descartada porque saldría 2 casi siempre). **Decidido por él el 6-oct (~11:44Z): la A, más un
puntero.**

### El puntero

El latido imprime en cada pasada, antes del veredicto, una línea fija:

```
ℹ️ JIRA · el cruce «tickets abiertos con su trabajo ya en main» NO lo hace el latido: no tiene credenciales de Jira. Saca la foto con el conector (…) y corre: node scripts/abierto-con-trabajo-en-main.mjs --jira <foto.json …> · la foto vale 12 h (…) · «con trabajo en main» NO es «terminado» · esto es un puntero, no una medición: no cuenta para la salida
```

- No es una sección: no alerta, no ciega y no cambia la salida.
- No afirma nada sobre Jira. Convierte «acordarse de correr el cruce» en «leerlo».
- El test comprueba que el comando señalado existe y sigue aceptando `--jira` y el tope de 12 h: un
  puntero a un comando que cambió es peor que no tenerlo.
- El comando real lleva `--jira` delante de la foto (el encargo lo citaba sin él).

## Lo que sigue sin mirar

- QUÉ cuenta es la guardada frente a la que se necesita. La sección dice el correo; si hace falta otra
  (el 6-oct dos sesiones anotaron que la cookie era de `demo@yaqu.app` y no de la cuenta QA), lo ve
  quien lee.
- Que el vigía corra y no vea: una pasada `success` cuenta como «miró».
- Jira.

## 13-oct-2026 · SCRUM-1463b · CIERRES SIN CLIC (S5): el comentario de cierre escrito y el estado sin mover

**Medido contra:** `origin/main` = `c252b1315d56a1b5294ac8f80c1abbe678104dfd` · 2026-10-13T15:21:45Z

A9: comprobación → `tests/scrum1463b-cierre-sin-clic.test.mjs`

Carril S5 (`scripts/equipo/**` y un test). Rama `scrum-1463b-cierre-sin-clic`. Encargo del orquestador
del 13-oct-2026 (15:07Z), punto 2 del lote; cortado por el fin de tanda de las 15:17Z, así que entra el
guion y **no entra su fila en el latido** (abajo, «Qué le falta»). No toca `src/`, ni Jira, ni ningún
workflow. El guion **no cierra nada**: lista y calla.

### Por qué

El 13-oct-2026 el orquestador escribió dos comentarios de cierre sin mover el estado (SCRUM-1443 y
SCRUM-1528) y lo cazó el fundador preguntando. Buscando con una frase salió un tercero, SCRUM-1126.
Cerrar son dos gestos, comentar y transicionar, y el segundo dependía de acordarse.

### Lo que se midió antes de escribirlo, y cambia el encargo

El encargo traía la búsqueda por la frase «CERRADO por el orquestador», como «la frase que sólo escribo
yo al cerrar». Medido en Jira el mismo día, sobre los 16 tickets cerrados hoy más SCRUM-1126 (17 leídos
de 17):

| qué | cuánto | sobre cuánto |
|---|---|---|
| tickets con un comentario que declara el cierre | 14 | 17 (3 se cerraron sin comentario de cierre: 1482, 1366, 1372) |
| de esos 14, los que casan con la frase del encargo | 2 (997 y 1188) | 14 |
| los dos fallos que motivaron el encargo (1443 y 1528), cazados por esa frase | 0 | 2: los dos empiezan por «CIERRE ·» |
| de esos 14, los que casan con las cuatro fórmulas del guion | 13 | 14 (falta 1443: «CIERRE · … COMPLETO y VISTO EN PRODUCCIÓN») |
| abiertos que casan con la frase del encargo | 2 (1126 y 1538) | todos los abiertos del proyecto |
| de esos 2, los que llevan de verdad un comentario de cierre | 1 (1126) | 2 |

SCRUM-1538 es un falso positivo de la búsqueda: Jira no distingue mayúsculas y casó con «#2286 … cerrado
por el orquestador durante el barrido», que habla de un PR (comentario 19393). Y SCRUM-1126 no casó por
el arranque de su comentario de cierre, «CERRADO — la rama está en main», sino por otra frase del mismo
comentario, en minúsculas. La red acertó con él por casualidad.

Por eso el guion separa dos cosas. La **búsqueda** es sólo la red (cuatro fórmulas, visibles en
`FORMULAS`). Quien decide es el **comentario**: es de cierre el que EMPIEZA por CIERRE o CERRADO en
mayúsculas. Una entrega de sesión empieza por «CERRABLE» y no casa. La primera red que probé, «Lo cierro
yo» a secas, trajo cinco abiertos más (1249, 1313, 1321, 1331, 1332) y los cinco eran entregas que dicen
lo contrario, «No lo cierro yo (A13)»: la fórmula quedó entera, «Lo cierro yo, el orquestador», y con
ella los abiertos vuelven a ser 2 y la cobertura sigue en 13 de 14.

### La pasada real (13-oct-2026, 15:21Z)

Población: 2 abiertos en la foto, comentarios leídos de los dos. Control: la misma búsqueda sobre los 17
tickets de arriba devuelve 13, 12 de ellos cerrados, así que la búsqueda ve.

- **SCRUM-1126** [En curso] · 13 días desde su comentario de cierre (17592, del 29-sep) · su trabajo está
  en `main` y no hay rama suya fuera: **le falta el clic**. 4 commits suyos en `main`; 2 son del 30-sep,
  posteriores al comentario de cierre, y el ticket tiene 2 comentarios después de él. El guion lo dice y
  no lo juzga: que esos dos restos estén completos lo lee quien cierra.
- **SCRUM-1538** [Tareas por hacer] · sólo lo cita. No es un cierre.

### Aceptación → dónde se ve

| lo pedido | dónde se ve |
|---|---|
| ticket, días parado, y si su trabajo está en `main` o no | `scripts/equipo/cierre-sin-clic.mjs` (`filaDe`, `lineaDe`); el caso de SCRUM-1126 en el test |
| «olvidé el clic» separado de «se cerró antes de tiempo» | el test «olvidé el clic no es se cerró antes de tiempo»: lo separa una rama suya viva fuera de `main` |
| control positivo: un ticket cerrado de verdad NO sale | el test «CONTROL» (y su mutación declarada) |
| la red ancha no sirve | el test «una CITA no es un cierre», con la frase real de SCRUM-1538 |
| no cierra nada | el test «lista y calla»: el guion no nombra ninguna herramienta que escriba en Jira |
| su fila en el latido | **NO HECHO** → S5, siguiente tanda. `seccionCierres` y `leerGuardado` existen y están probadas; falta que `latido.mjs` las llame |

### Qué le falta

1. **La fila del latido.** El guion guarda su último resultado fuera del árbol (junto al libro del
   cementerio) y `seccionCierres` lo convierte en sección: en verde con su población, en rojo con una
   línea por ticket, y «no pude mirar» si la foto pasa de 12 h. Falta importarla en `latido.mjs` y
   añadirla a la lista de secciones, con la nota `NOTA_SIN_CORRER` donde nunca se haya corrido.
   ⚠️ Riesgo de esa fila, dicho antes de construirla: una vez corrido el guion en una máquina, el latido
   saldrá con «no pude mirar» (salida 2) cada vez que la foto caduque. Es lo que hace que no dependa de
   acordarse, y también es un rojo más en cada pasada si nadie rehace la foto.
2. **El guion no lee Jira.** Como el latido, no tiene credenciales: alguien con el conector hace las dos
   búsquedas (`cierre-sin-clic.mjs consultas` las da) y le pasa las respuestas. Sigue dependiendo de que
   alguien saque la foto; la fila del latido es lo que lo recordaría.
3. **No ve** un cierre escrito con otra fórmula (1 de 14 hoy), ni un ticket cerrado sin comentario.
4. **Propuesta, no construida:** leer el gesto en su origen. Los transcripts de esta máquina guardan cada
   llamada que comenta y cada llamada que transiciona; un comentario que empieza por CIERRE sin una
   transición del mismo ticket detrás es el fallo, visto en el momento, sin foto y sin Jira. No vería los
   cierres hechos desde otra máquina.

### De paso, visto y NO arreglado

`seTitulaGuard` (`scripts/meta-guard-mutaciones.mjs`) da por «guard» cualquier test cuyo título contenga
esas cinco letras, sin distinguir mayúsculas: dos títulos de este test decían «guarda» y «guardado», y el
trinquete de `tests/scrum812-el-rotulo-declara-su-poblacion.test.mjs` contó el fichero como un guard más
(33 donde el suelo dice 32). Se cambiaron los dos títulos, no el trinquete ni su número. La subcadena
sigue ahí para el siguiente que escriba «guardar» en un título: es del carril de S5 y no cabía hoy.

### Lo que no se midió

- Las mutaciones declaradas en el test (4) se corrieron a mano una vez, no por el meta-guard.
- El guion fecha con el reloj de la máquina, que hoy va unos 5 minutos por delante del de GitHub: no
  mueve una cuenta de días, y la cabecera de su informe lleva esa hora, no la de GitHub.
- Que los dos restos de SCRUM-1126 estén completos: lo afirmó el orquestador en el encargo; aquí sólo
  consta que hay commits suyos en `main` posteriores al comentario de cierre.
- La lectura de los comentarios la hicieron dos subagentes de sólo lectura (17 y 6 tickets, todos
  leídos). Las llamadas del primero se contaron: 17 lecturas y ninguna escritura. Las del segundo no.

## 14-oct-2026 · SCRUM-1463c · LA FILA DEL LATIDO (S5): los cierres sin clic salen en cada pasada

Medido sobre `origin/main` `e2be1c9fda3b5ceac853b4d376f5664ac8e4df67`, 14-oct-2026 07:54Z (`Date:` de GitHub;
el reloj de la máquina iba unos 4 min por delante). Rama `scrum-1463c-cierres-en-el-latido`.

Es lo que le faltaba a SCRUM-1463b: el guion existía y sólo avisaba si alguien se acordaba de correrlo.
Ahora `scripts/equipo/latido.mjs` lee lo que guardó `cierre-sin-clic.mjs` y lo enseña como sección 13,
«CIERRES SIN CLIC». ⛔ Lista y calla: ni el latido ni el guion cierran, transicionan ni escriben en Jira.

- Sin nada guardado en la máquina: NO hay sección y va una NOTA (`NOTA_SIN_CORRER`) que lo dice; no cuenta
  para la salida.
- Lo guardado ilegible, o una foto de Jira de más de 12 h: «NO PUDE MIRAR» y la salida del latido es 2.
  **Riesgo, declarado:** si nadie rehace la foto cada 12 h, el latido sale 2 en cada pasada por esto. Es
  la regla de la casa («no pude mirar» nunca es verde), pero un 2 permanente enseña a no leer el 2.

### La pasada real (14-oct-2026, ~07:55Z)

Foto de Jira sacada con el conector (las dos búsquedas de `cierre-sin-clic.mjs consultas`): 2 abiertos
casan, SCRUM-1126 y SCRUM-1538. Los comentarios se dictaron en TSV: el de 1126 (c.17592) y la cita de 1538
(c.19393) son los leídos el 13-oct, y su `updated` en Jira es anterior a esa lectura. Control: SCRUM-997 y
SCRUM-1528, cerrados, con las mismas fórmulas. Resultado del guion y del latido real corrido desde la rama:

    🔴 CIERRES SIN CLIC · 2 tickets abiertos casan con las fórmulas de cierre (foto de hace 0.0 h): 1 con comentario de cierre, 0 sin leer, 1 que sólo lo citan
       · SCRUM-1126 [En curso] · 14 días desde su comentario de cierre (c.17592, dictado a mano: …) · … LE FALTA EL CLIC · 4 commit(s) suyos en main, el último del 2026-09-30 · 🔴 2 de esos commits son POSTERIORES al comentario de cierre

997 y 1528 (cerrados) no salen; 1538 sale como cita, sin aviso.

### Aceptación → dónde se ve

| aceptación (literal del encargo) | dónde se ve |
|---|---|
| «Haz que `latido.mjs` llame a `cierre-sin-clic.mjs` y salga en el latido como una fila más» | `scripts/equipo/latido.mjs` (`cierresDelLatido`, sección 13) · `tests/scrum1463c-latido-cierres-sin-clic.test.mjs`, «ESCRITO NO ES CORRIENDO» |
| «Que NO cierre nada: lista y calla» | el mismo test, última aserción · `NO_CIERRA` en la población de la sección |
| «con un ticket cerrado de verdad, la fila NO lo saca» | test «CONTROL» (997 cerrado no sale) · pasada real de arriba (997 y 1528) |
| «con uno que tenga comentario de cierre y siga abierto, SÍ» | test «CONTROL» (1126 sale; 997 abierto también) · pasada real (1126) |

Mutaciones declaradas en el test: 2, corridas a mano, 2 de 2 muertas, con la base sin mutar en verde.

### De paso, medido y NO arreglado: `seTitulaGuard`

El título de un test de esta rama decía «guardado» y subió el trinquete de
`tests/scrum812-el-rotulo-declara-su-poblacion.test.mjs` a 34 (suelo 33): el mismo defecto que vio la
SCRUM-1463b. Se cambió el título. Medido sobre los 1.338 ficheros de `tests/`: por subcadena se «titulan
guard» 302; por palabra entera («guard»/«guards»), 153. De los que declaran mutaciones, 33 → 29 (el fichero de esta rama no entra en ninguna de las dos cifras).
**Arreglarlo exige BAJAR el suelo del trinquete de 33 a 29**, y eso es relajar un guard: se pide, no se
hace. Y no es sólo ruido: «guarda» en castellano a veces SÍ nombra un guard («guarda de presencia», «la
guarda va ANTES de escribir»), así que la palabra entera también se equivoca. Falta una definición, no
una expresión regular.