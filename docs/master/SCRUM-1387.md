# SCRUM-1387 · El catálogo del meta-guard es destino obligatorio de todo banco de mutación nuevo, y la lista de los que ya estaban fuera sólo mengua

**Medido contra:** `origin/main` = `6536e63e038ef36be9d61fc8057a649ff2af3149` · 2026-10-07T17:16:32Z
(J4 del equipo de Javier, sesión `jv-j4`, relevo de J4g; encargo del orquestador `cobroflash-backend-90`.)

A9: comprobación → `tests/scrum1387-banco-nuevo-va-al-catalogo.test.mjs`

## En corto

El ticket tiene dos mitades. **La ② está construida aquí; la ① NO, y se pasa a S3.**

- **② construida.** Un guard en la tanda hace caer a todo banco de mutación nuevo que traiga su lista propia y
  no nombre el catálogo, y el rojo dice la carpeta y el guion. Los que ya estaban fuera van en una lista
  cerrada que sólo mengua. Es lo que el fundador decidió en el comentario 18016 del ticket (2-oct-2026).
- **① NO HECHA → S3.** La salida de la pasada completa del meta-guard sigue sin decir su población.
  `scripts/meta-guard-mutaciones.mjs` es del puesto S3 (`docs/equipo/dos-equipos.md`, §3.3, decisión del 6-oct en
  SCRUM-1480, posterior al ticket), así que no se ha tocado. El parche va escrito abajo.

🔴 **Este guard corre en el check obligatorio de los dos equipos.** Un PR de cualquiera de los dos que suba un
banco con lista propia cae. No es una regla de un equipo para el otro: de los cuatro bancos que entraron después
de la decisión, dos son del equipo de Javier (uno, de este mismo puesto) y dos del de Luis.

## Lo medido

### El número del título caducó

El título dice «365 vivas · 0 mudas» y «el 10 % de los tests». Hoy:

| | cuando se escribió el ticket (1-oct, `5fb7630a`) | hoy (`6536e63e`) |
|---|---|---|
| ficheros de test | 1.189 | **1.286** |
| ficheros que declaran mutaciones | 118 | **139** (11 %) |
| declaraciones | 385 | **520** |
| línea final del meta-guard en CI | «365 vivas · 0 mudas · 0 ciegas» | «vivas 520 · mudas 0 · ciegas 0 · ficheros muertos 0» |

La línea de hoy está leída del log del job del meta-guard en `main` @ `9acfbeba61c997aa838ad2460103a219141cd293`
(job 112902590037, 7-oct 16:56Z). Cruzadas por conjunto (guard + caso que cae) con las declaraciones del árbol:
520 líneas vivas, 520 declaraciones, 0 sólo en un lado; la pareja inventada da 0 en los dos.

**«El 10 % de los tests» son ficheros, no casos.** Las 520 declaraciones nombran 483 parejas distintas de fichero y
caso (37 repiten una ya nombrada), y la tanda del obligatorio de hoy corrió 10.969 casos (job 112914859722). Lo
que el catálogo NO dice de esos casos no está medido aquí: una declaración casa su caso por un fragmento del
nombre, y cuántos fragmentos casan con más de un caso no se ha contado.

**Qué se muta.** De las 520 declaraciones, 334 mutan un fichero de `scripts/`, 56 de `public/`, 49 de `tests/`,
45 de `src/`, 26 de `.github/`, 5 de `docs/`, 3 de `dist/` y 2 de la raíz. Son 143 ficheros distintos, 23 de ellos
en `src/` y 18 en `public/`. Dos de cada tres mutaciones vigiladas son de instrumentos, no de producto.

### ① sigue sin salir

En ese log la línea de población sale **0 veces**. El rótulo existe desde SCRUM-812 (`rotuloDelCenso`) y hoy
dice (`evidencias/scrum1387/salida-solo-censo.txt`):

    censo · 139 ficheros DECLARANTES de 1286 ficheros de test (11 %) · 520 declaraciones (suelos 20 / 54)

pero sólo se imprime dentro del `if (soloCenso)`. La pasada completa, que es la que corre el CI, acaba en
«vivas N · mudas 0» sin él.

**El parche, para S3** (en el bloque principal, justo después del `console.log` de «vivas … · ficheros muertos …»;
las cinco variables ya están calculadas más arriba, antes del `if (soloCenso)`):

    for (const linea of rotuloDelCenso({
      poblacion, declarantes: guardsConDeclaracion, declaraciones, titulados, tituladosQueDeclaran,
    })) console.log(linea);

No cambia ningún veredicto ni ningún código de salida: imprime. Las palabras del rótulo ya se las exige
`tests/scrum812…` a esa misma función; lo que hoy no comprueba nadie es que la pasada completa la llame.
No se ha probado el parche: no se ha aplicado.

### ② no existía, y mientras tanto entraron más

Buscado en `tests/` y `scripts/` algo que nombre los bancos o el censo de SCRUM-1394: nada (dos ficheros casan
con otra frase del patrón y no tienen que ver).

El censo de SCRUM-1394 (`docs/master/evidencias/SCRUM-1394/bancos.mjs`, sin tocar), re-corrido:

| | el fundador decidió con (1-oct, `7c85e366`) | hoy (`6536e63e`) |
|---|---|---|
| carpetas con banco | 31 | **42** |
| fuera del catálogo | 18 | **23** |

Fechada cada una de las 23 por el primer commit de `main` que metió en su carpeta un fichero con «mut» en el
nombre, contra la hora del comentario 18016 (2026-10-02T02:10:21Z). Salida en
`evidencias/scrum1387/salida-fechas.txt`; suma 23 de 23, 0 sin fecha:

- **18** ya estaban en la medida de SCRUM-1394.
- **1** entró entre esa medida y la decisión: `scrum1344` (1-oct 19:03Z).
- **4 entraron DESPUÉS de la decisión**, que es lo que «obligatorio hacia adelante» venía a impedir:
  `scrum1395` (6-oct 14:49Z, de este puesto), `SCRUM-1486` (6-oct 19:02Z, S3), `SCRUM-876f` (7-oct 15:49Z) y
  `scrum1392` (7-oct 17:05Z).

⚠️ **La lista empieza en 23, no en los 18 que el fundador tuvo delante.** La forma que firmó no cambia —una lista
que sólo mengua—; el número sí, porque entre la decisión y el guard pasaron cinco días.

## Lo construido

- `tests/_catalogo-obligatorio.mjs` — la definición (la misma del censo de SCRUM-1394), las dos mitades del
  juicio y la lista `FUERA_DECLARADOS` con su techo.
- `tests/scrum1387-banco-nuevo-va-al-catalogo.test.mjs` — cinco casos: tres sobre un árbol fabricado en
  memoria, el del árbol real y el de la forma de la lista. Declara tres mutaciones en el catálogo.
- `docs/master/evidencias/scrum1387/banco-mutaciones.mjs` — el guard visto en rojo. Toma las mutaciones del test
  con el lector del meta-guard: no trae lista propia, así que el guard no lo cuenta fuera.

Cada entrada de la lista lleva las tres cosas del comentario 18016:

- **motivo**: `anterior` (ya estaba en `main` al decidirse: 19) o `posterior` (entró después: 4).
- **quién la retira**: el puesto del área del ticket, leída de sus etiquetas de Jira el 7-oct-2026. En 8 de las
  23 el ticket no lleva etiqueta de área (SCRUM-864 con sus dos carpetas, 876, 920, 933, 1326, 1392 y 1395) y la
  entrada lo dice así; no se ha puesto ningún puesto que Jira no diga. En las carpetas con letra (`864c`, `876f`,
  `908c`) se leyó el ticket del número.
- **desde**: la fecha en que entró en la lista (2026-10-07). **No es un plazo**: el comentario 18016 no fija
  ninguno.

### Visto en rojo

`evidencias/scrum1387/salida-banco.txt`, con el árbol comiteado antes (`4c10ce5c`) y comprobado limpio después:

| fila | qué se hace | resultado |
|---|---|---|
| BASE | nada | 5 pasan, 0 caen |
| M1 | nada está fuera nunca | cae su caso (y otros 3) |
| M2 | lo sin declarar deja de salir | cae su caso |
| M3 | lo que sobra deja de salir | cae su caso |
| NUEVO | una carpeta fabricada con un guion de lista propia en `docs/master/evidencias/` | cae el caso del árbol, y el rojo nombra la carpeta y el guion |
| SIN GUION | a esa carpeta se le deja sólo una salida | vuelve a pasar |

Cada mutación se comprobó aplicada (el ancla aparece una vez y el fichero cambia) y restaurada por contenido.

## Aceptación → dónde se ve

| aceptación | dónde se ve |
|---|---|
| ① la salida del meta-guard nombra su población, siempre | NO HECHO → S3 (el fichero es de su carril); el parche, arriba |
| ① el veredicto no cambia | NO HECHO → S3 |
| ② el catálogo es obligatorio para todo banco nuevo (c.18016 ①) | `tests/scrum1387-banco-nuevo-va-al-catalogo.test.mjs`, el caso «en el árbol» |
| ② los que ya están fuera, lista que mengua con motivo, quién y fecha (c.18016 ②) | `tests/_catalogo-obligatorio.mjs`, `FUERA_DECLARADOS` y `TECHO_DE_LA_LISTA` |
| ② el guard nombra lo que falta (c.18016 ③) | fila NUEVO de `docs/master/evidencias/scrum1387/salida-banco.txt` |

## Lo que NO sé y lo que NO cubre

- **Es la heurística de texto de SCRUM-1394.** Un banco cuyos ficheros no lleven «mut» en el nombre no existe
  para el guard, y un guion que sólo mencione el catálogo cuenta como dentro. De los 23, dos de los posteriores
  (`SCRUM-1486`, `SCRUM-876f`) tienen además algún test suyo en el catálogo: si sus mutaciones coinciden con las
  declaradas no está medido.
- **El guard lee el disco, no git.** En CI es lo mismo; en local ve también lo que aún no está añadido.
- **No se ha ejecutado ningún banco de los 23.** Si sus mutaciones siguen cayendo hoy no se sabe.
- **Los registros que afirman mutaciones no se han comprobado por efecto.** El censo de SCRUM-1394 re-corrido da
  1.049 registros, 359 que afirman mutaciones, y de ésos 251 sin ningún test en el catálogo (B 219 · C2 24 · C3 8;
  sus dos controles, juzgados, salen como se espera). Es la misma lectura de texto del ticket; la muestra por
  efecto que pedía el encargo original no se ha hecho.
- **La línea «vivas» no pierde casos por un fichero que muere a medias**, que era la duda heredada de SCRUM-1389:
  el meta-guard cuenta una viva sólo con un evento de fallo cuyo nombre contenga el fragmento declarado, y lo que
  no aparece lo cuenta como ciego o como fichero muerto. Leído del código, no provocado.
- `evidencias/scrum1387/salida-cruce-job-112902590037.txt` se guardó con el test nuevo ya en el árbol: dice 1.287
  ficheros, 140 declarantes y 523 declaraciones, y las tres «sólo en el árbol» son las de este ticket. Los números
  de `main` son los de la tabla de arriba.
- El check obligatorio de este PR y el despliegue: sin mirar al escribir esto.

## Mis errores

- Conté 521 líneas «✔» en el log del meta-guard donde había 520 vivas: mi patrón casaba también con la línea
  «✔ Generated Prisma Client». Lo delató no cuadrar con la línea final; el cruce por conjuntos ancla ya al
  principio de la línea de veredicto.
- Mi primer lector de logs salió ciego en 15 de 15 jobs (`gh` no vuelca un log con secuencias de escape sin
  `--allow-escape-sequences`) y aun así imprimió su tabla. Lo decía su propia columna «NO PUDE LEER».
- Le di al orquestador tres horas estimadas como si fueran leídas; la de GitHub iba un cuarto de hora por detrás.
- Di el contexto por primera vez a 222.097, pasado ya el aviso de 200.000.

## Reproducir

    node --test tests/scrum1387-banco-nuevo-va-al-catalogo.test.mjs
    node docs/master/evidencias/scrum1387/banco-mutaciones.mjs
    node docs/master/evidencias/SCRUM-1394/bancos.mjs . > bancos.txt
    node docs/master/evidencias/scrum1387/fechar-bancos.mjs . bancos.txt
