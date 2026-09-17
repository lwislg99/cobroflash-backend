# SCRUM-928 · punto 2 · `guards:entrada` decía «0 tests» con el color puesto

**Fecha:** 17-sep-2026 · **Carril:** S5 · automatización
**Medido contra:** `origin/main` = `6775cd9cb7b9b8226b6721a72f9f05357bc127ff` · 2026-09-17T18:25:34Z
**Rama:** `scrum-928-guards-entrada-color` · **Worktree:** `wt-839f`
**Horas:** de GitHub (cabecera `Date` de `gh api -i zen`).

**Reparto del ticket.** SCRUM-928 tiene dos sitios con el mismo defecto. El **punto 1**
(`scripts/tanda-con-veredicto.mjs`, que convierte una tanda VERDE en exit 4 y por tanto deja `npm test` en rojo con el
árbol sano) es de la **Sesión 3**. Esta entrega es **solo el punto 2**, `scripts/guards-entrada.mjs`. Aquí no se toca el
envoltorio, ni los tests de 853c/858b del punto 3.

## ① El defecto

`guards-entrada.mjs` comprueba, además de que los guards existan, que **hayan corrido**: lee el recuento que imprime el
runner de node («ℹ tests 26») y para si es menor que el mínimo. Ese recuento se leía con una expresión anclada al final
de línea. Cuando el entorno trae color, el runner escribe

    \x1b[34mℹ tests 26\x1b[39m

y el `\x1b[39m` del final impide que el ancla `\s*$` case. Sin coincidencia, el recuento se toma como 0 y el comando
sale 1 diciendo «solo se ejecutaron 0 tests» **con los 26 en verde**.

Es un rojo MENTIROSO, que es la peor clase: no dice «tengo color», dice «tus guards no han corrido», y manda a quien lo
lee a buscar un guard roto que no existe. Le costó tiempo a S0, S3 y S5 el mismo día.

## ② PASO 0 · el defecto existe HOY

Mismo árbol (`6775cd9c`), sin tocar nada, cambiando **solo** la variable de entorno:

| entorno | salida | exit |
|---|---|---|
| `FORCE_COLOR=0` | `✓ 4 guards de entrada en verde (26 tests)` | **0** |
| `FORCE_COLOR=3` | `🔴 solo se ejecutaron 0 tests entre 4 ficheros` | **1** |

Node v24.8.0. La diferencia es una variable, no una rama: **es del instrumento**.

## ③ Por qué el arreglo va en el LECTOR y no en quien llama

Medido el 17-sep por el orquestador con la S3, en un chat recién lanzado: una sesión arrancada con
`FORCE_COLOR=0 claude --bg …` **sigue trayendo `FORCE_COLOR=3` en su entorno**. El prefijo en la orden de lanzamiento no
limpia el entorno del proceso, así que la trampa **no se esquiva lanzando bien**.

    🔒 Un arreglo que depende de que todo el mundo invoque bien no es un arreglo.

## ④ Qué cambia

- **`scripts/guards-entrada.mjs`:**
  - el recuento sale a una función exportada `recuentoDeTests(salida)`, que **quita los códigos ANSI antes de leer** y
    **conserva el ancla**;
  - el cuerpo pasa a `main()`, que solo corre cuando se le llama como comando
    (`pathToFileURL(process.argv[1]).href === import.meta.url`, el patrón que ya usan los `censo-*`). Sin eso,
    importarlo para probar el lector lanzaría 23 s de guards y un `process.exit(1)` suyo mataría a quien lo importa.
- **`tests/scrum928-guards-entrada-recuento-con-color.test.mjs`:** el guard, 4 tests.

**No se afloja la expresión, se limpia la entrada.** Quitar el ancla habría puesto el verde igual y más barato; es
justo el arreglo que deja el suelo sin suelo, porque entonces el recuento puede salir del número que lleve dentro el
nombre de un test. Lo que mide el guard y su umbral (`MINIMO = 4`) no cambian.

## ⑤ El rojo, en DOS pasos

Primero se extrajo la función **sin arreglarla** y se corrió el guard contra ella:

    ✖ ① el recuento se lee igual con color que sin él
      AssertionError: con color se leía 0 y el comando salía 1 con «0 tests» aunque todo pasara
        actual: 0, expected: 26

Un rojo por «no existe ese export» —que es lo que dio la primera pasada— solo habría probado que faltaba una función,
no que el test caza el defecto.

## ⑥ Mutantes

| mutante | ¿muere? |
|---|---|
| quitar `.replace(ANSI, '')` | ✅ sí — es el rojo de ⑤, `actual: 0, expected: 26` |
| aflojar la expresión a `/\btests\s+(\d+)/`, sin ancla | 🔴 **SOBREVIVÍA** hasta corregir el guard |

🔴 **El segundo mutante es el hallazgo del punto, y sale de PROBARLO, no de leerlo.** El caso de suelo original usaba
líneas donde «tests» NO iba seguido de un número (`ℹ pass 26`, `… 99 tests de otra suite`), así que la expresión
aflojada las descartaba igual y **el mutante pasaba en verde**. Hizo falta un número pegado a la palabra —
`✔ repite los tests 3 veces seguidas (1.2ms)`— para distinguir las dos versiones.

    🔒 Un caso de suelo que no se prueba contra el mutante que dice parar no está vigilando: está acompañando.

## ⑦ El guard no se cree su propia transcripción del ANSI

Además de fijar la conducta sobre cadenas escritas a mano (①), **ejecuta el runner de node de verdad con el color
forzado** y le pasa su salida real al lector (②). Si una versión de node cambia cómo colorea esa línea, el caso de
cadena seguiría en verde sobre texto histórico y éste se pondría rojo. Un test que solo comprueba mi transcripción del
ANSI mide mi memoria, no el runner.

⚠️ **Trampa medida al escribirlo, cazada por el control positivo y no por el resultado.** `NODE_TEST_CONTEXT` **se
hereda**: el `node --test` hijo, lanzado desde dentro de un test, cambia a un reporter serializado y **no escribe nada
por stdout**. La primera versión de ② medía una salida VACÍA, con lo que `recuentoDeTests` daba 0 tanto roto como
arreglado —habría pasado por un test y no lo era—. Lo delató la aserción que exige ver un `\x1b[` en la salida ANTES de
medirla. En el spawn se borra esa variable.

## ⑦bis · Un byte de escape se coló LITERAL en el código, y casi entra así

Al escribir `const ANSI = /\[…/` la secuencia se guardó como el **byte 0x1B de verdad**, no como
sus seis caracteres. Funciona igual —el guard estaba en verde— y por eso es peligroso: un byte de control invisible en
un `.mjs` sobrevive mientras nadie normalice el fichero, y desaparece sin ruido en cuanto alguien lo haga.

No lo encontró una revisión: **lo delató un `git diff`**, donde la línea salía como `/\[[0-9;]*[A-Za-z]/` —sin el
escape— porque la consola se comía el byte al pintarlo. Se comprobó con `String.fromCharCode(27)` sobre el fichero, que
es lo único que lo distingue de verdad, y aparecía uno en cada fichero: el script y el test. Los dos pasan a la
secuencia escapada; el comportamiento no cambia y la verificación de ⑧ se repitió entera después.

    🔒 Lo que no se ve en un diff no se revisa. Un carácter de control en el código fuente se escribe escapado,
       aunque las dos formas funcionen.

## ⑧ Verificación por efecto

Sobre el árbol ya arreglado:

| comprobación | resultado |
|---|---|
| `node --test tests/scrum928-guards-entrada-recuento-con-color.test.mjs` | 4 tests, 4 pass, 0 fail · exit **0** |
| `node scripts/guards-entrada.mjs` con `FORCE_COLOR=3` (el que fallaba) | `✓ 4 guards de entrada en verde (26 tests)` · exit **0** |
| `node scripts/guards-entrada.mjs` con `FORCE_COLOR=0` (que no se rompa lo que iba) | `✓ 4 guards de entrada en verde (26 tests)` · exit **0** |

## ⑨ Lo que NO se ha mirado

- El punto 1 del ticket (`tanda-con-veredicto.mjs`) y el punto 3 (los tests de 853c y 858b): son de la S3 y no se han
  tocado. Mientras el punto 1 no entre, `npm test` **sigue dando rojo con el árbol sano si hay color en el entorno** —
  este arreglo no lo cubre.
- No se ha censado si hay un tercer sitio que lea salida con color (el vigía, el avisador). Queda dicho, no medido.

**Tests declarados:** `tests/scrum928-guards-entrada-recuento-con-color.test.mjs`.

---

## SCRUM-928b · punto 1 · el envoltorio de `npm test` leía el recuento con el color puesto

**Medido contra:** `origin/main` = `8b3f26d2cc3a3d1d1de03e1119a38dc0c94d97d7` · 2026-09-17T19:11:17Z (hora de GitHub; las mediciones son de los minutos anteriores, misma máquina)
**Rama:** `scrum-928b-el-veredicto-que-el-color-tapa` · **Carril:** Sesión 3 (instrumentos) · **Reparto del orquestador:** el punto 1 es de la S3 porque entregó el envoltorio en SCRUM-858b; `scripts/guards-entrada.mjs` es del punto 2 (S5) y **aquí no se toca**. Esto cierra el hueco que la sección ⑨ de arriba deja dicho.

### ① PASO 0 · el defecto existe HOY, y con una tanda de UN test basta

El envoltorio sobre una tanda sana de un solo test que pasa, con la cobaya FUERA del árbol:

| `FORCE_COLOR` | exit del envoltorio | «TANDA SIN RESUMEN» |
|---|---|---|
| ausente | 0 | no |
| `0` | 0 | no |
| `3` | **4** | **sí** |

Las dos primeras filas no son adorno: son el control positivo del arreglo, y son las que prohíben «arreglarlo» aflojando el umbral. De paso desmienten una frase que yo mismo había puesto en el enunciado del ticket y que **nadie había medido**: `FORCE_COLOR=0` **sí** apaga el color. Contando bytes `ESC` en la salida de `node -e "console.log(7)"`: ausente 0 · `0` 0 · `1` 2 · `3` 2 · `false` 0 · vacío 0. Node no distingue `0` de ausente, así que el defecto del lanzador no es «el 0 no sirve»: es que **el 0 no llega**.

### ② Los bytes, que son los que deciden el arreglo — y DOS ESC distintos, no uno

```
sin color   E2 84 B9 20 74 65 73 74 73 20 31                                  «ℹ tests 1»
con color   1B 5B 33 34 6D  E2 84 B9 20 74 65 73 74 73 20 31  1B 5B 33 39 6D
            ESC[34m         «ℹ tests 1»                       ESC[39m
```

El reporter pinta la línea **entera**: un `ESC` delante del glifo y otro detrás del número. El glifo y los dígitos no cambian. Probando cada regex contra cada forma de la cadena:

| caso | `RESUMEN` (envoltorio, punto 1) | el lector de `guards-entrada` (punto 2) |
|---|---|---|
| sin color | casa | casa |
| solo `ESC` delante | **NO casa** | casa |
| solo `ESC` detrás | casa | **NO casa** |
| los dos (lo real) | **NO casa** | **NO casa** |

🔴 **Son dos defectos con el mismo síntoma y anclas opuestas.** A este envoltorio lo rompe el `ESC` de DELANTE (el `\s*` de `RESUMEN` no se traga un `ESC`); al lector del punto 2 lo rompe el de DETRÁS (su `[^\n]*` sí absorbe el de delante, y lo que no casa es el `\s*$` final contra `ESC[39m`).

⚠️ **Y esto costó una corrección en caliente.** El enunciado del ticket llevaba MI explicación del punto 2 —«tras `tests ` viene un ESC y no un dígito»—, que es **falsa**. Si la S5 hubiera sembrado su rojo con el `ESC` sólo delante, su regex **habría seguido casando y el rojo no se habría encendido**: un guard en verde sobre el defecto vivo. Se avisó por el canal a las 18:56Z, antes de que empujara. La lección no es sobre el color:

    🔒 Un mecanismo leído no es un mecanismo medido. Un regex se prueba contra la cadena real, no se interpreta
       mirándolo — y menos para decirle a otro dónde tiene que sembrar su rojo.

### ③ Qué cambia

Una función que quita las secuencias CSI **y se usa sólo para LEER**:

- `const CSI = /\[[0-9;?]*[ -\/]*[@-~]/g;` y `sinColor(s)`, aplicada al probar `RESUMEN` sobre la cola.
- Se quitan las secuencias CSI **completas**, no sólo las de color: un reporter que mueva el cursor partiría el ancla igual.
- **Lo que se IMPRIME sigue pasando tal cual, byte a byte.** La limpieza no toca la salida; eso lo exige 858b y se comprueba con una aserción de igualdad exacta sobre el stdout, con color y sin él.
- **No cambia el umbral ni lo que se exige:** un recuento a medias (`tests` sin número) sigue sin valer, y una tanda que de verdad no lo emite sigue saliendo con 4.

### ④ El rojo primero, y lo que lo hace un rojo y no una casualidad

Contra el árbol SIN arreglar (commit `d69a80f1`, el test solo): **5 casos · 3 pass · 2 fail · exit 1**.

| caso | sin arreglo | con arreglo |
|---|---|---|
| SUELO · el envoltorio existe, `npm test` pasa por él, y node SÍ colorea | ✔ | ✔ |
| 🔴 EL CONTROL QUE DECIDE · una tanda sana con el recuento coloreado sale con 0 | **✖ (salió 4)** | ✔ |
| 🔴 una tanda DE VERDAD con `FORCE_COLOR=3` | **✖ (salió 4)** | ✔ |
| ✅ POSITIVO · sin color, mismo veredicto y salida byte a byte | ✔ | ✔ |
| 🔴 NEGATIVO · sin recuento de verdad sigue saliendo 4, con color y sin él | ✔ | ✔ |

Los tres que pasan **ya pasaban antes del arreglo**, que es lo que los hace controles y no consecuencias de él. Y el SUELO lleva dentro la cláusula que impide que este fichero sea una tautología: comprueba que **este** node mete códigos de color, y si dejara de meterlos grita «NO PUDE MIRAR» en vez de pasar en verde sobre un defecto que ya no puede ver. El caso de la tanda de verdad hace lo mismo con su cobaya: exige ver un `ESC` en la salida ANTES de juzgar el código de salida.

### ⑤ Mutantes, los dos declarados y los dos ejecutados

| mutante | qué apaga | tumba | medido |
|---|---|---|---|
| `RESUMEN.test(sinColor(cola))` → `RESUMEN.test(cola)` | la limpieza | «EL CONTROL QUE DECIDE» | ✔ 5 · 3 pass · **2 fail** |
| `sinColor = (s) => s.replace(CSI, '')` → `(s) => ''` | la limpieza se come el recuento | «✅ POSITIVO» | ✔ 5 · 2 pass · **3 fail** |

El segundo es el que vigila el arreglo por el otro lado: una limpieza demasiado ancha convierte todo en «sin resumen». Los dos van en `MUTACIONES_QUE_ME_TUMBAN`.

### ⑥ El byte de escape LITERAL, otra vez, y en otra sesión

Al escribir el regex, `` se guardó como **el byte 0x1B de verdad** en vez de sus seis caracteres. Funcionaba —los 11 tests en verde— y por eso es peligroso. Lo delató leer el fichero y ver la línea como `/\[[0-9;?]*…/`, sin el escape, porque el visor se come el byte al pintarlo; se confirmó contando bytes 0x1B sobre el fichero (1 antes, 0 después) y se pasó a la forma escapada, repitiendo la verificación entera.

🔴 **Lo que hay que quedarse no es el error, es que somos dos:** la sección ⑦bis de arriba cuenta EXACTAMENTE el mismo accidente en la S5, el mismo día, en otro fichero y sin que ninguna de las dos supiera de la otra. Dos veces es un patrón, no un descuido, y la causa es del entorno de edición, no de quien escribe.

    🔒 Lo que no se ve en un diff no se revisa.

### ⑦ Verificación por efecto, sobre el árbol ya arreglado

| comprobación | resultado |
|---|---|
| `node --test` de `scrum928b` + `scrum858b` (el fichero que el arreglo no podía romper) | 11 tests · 10 pass · **0 fail** · 1 salto declarado · exit **0** |
| `scrum853c` + `scrum858b` con `FORCE_COLOR=3` | 15 · 12 pass · **2 fail** (antes 3) · exit 1 — ver ⑧ |
| `npm test` completo, sin color, sobre el merge de `8b3f26d2` | 7.429 tests · 7.318 pass · **0 fail** · 111 saltos · exit **0** · 406,7 s |
| `npm run guards:entrada`, sin color, con esta entrada ya escrita | 4 guards · 26 tests · 26 pass · **0 fail** · exit **0** |

Los **111 saltos** son los mismos 111 que la tanda anterior de esta sesión: esta entrada no ha callado ningún test. Y la suite pasa POR el envoltorio que se acaba de tocar, así que su exit 0 es también una comprobación del arreglo sobre 7.429 tests reales y no sólo sobre la cobaya de un test.

⚠️ **Orden de las pasadas, declarado:** el mutante ① se midió sobre la versión con el byte 0x1B crudo y el ② sobre la ya escapada (⑥ pasó por medio). Las dos cadenas que se declaran son idénticas en ambas versiones y los 11 tests salieron verdes en las dos, pero la pasada de los dos mutantes juntos sobre el árbol final es la del meta-guard en CI, no ésta.

### ⑧ Lo que este arreglo NO quita, medido en vez de supuesto

De los **3** rojos que el color provocaba, éste quita **1**: el de `scrum858b` («una tanda sana sale IGUAL que sin envoltorio, y con 0»). Los **2** de `scrum853c` **siguen**, y era predecible porque **no pasan por el envoltorio**: ahí el ANSI viaja DENTRO de un valor que el test compara como cadena (`'1212|DIRTY|\x1B[33m1\x1B[39m||null'`, el amarillo que node le pone a un número al formatearlo). Es un **tercer sitio**, en el paso que produce esa línea, y es el punto 3 del ticket: no se ha tocado, y **no se ha tocado tampoco el test para que pase**.

Los dos casos son «🔴 SUELO · el paso de REUNIR, con todo bien, deja una línea completa por PR» y «🔴 FECHA · si no se puede leer cuándo se empujó, no se inventa un NaN». Se nombran por identidad a propósito: entre la primera medición y ésta se movieron de las líneas 215 y 245 a la 214 y la 244, porque `8db2059e` (SCRUM-864c) quitó una línea del fichero por medio.

    🔒 Referenciar por posición caduca. Referenciar por identidad no.

Tampoco se ha censado si hay un CUARTO sitio que lea salida con color (el vigía, el avisador): queda dicho y no medido, igual que lo dejó el punto 2.

### ⑨ Errores propios de la tanda, que son todos de la misma familia

Tres veces, en una sola tanda, una operación **no se ejecutó y el resultado se leyó igual que un éxito**:

1. El banco del color, escrito como `.cmd`, llamaba a `npm run build` **sin `call`**. En cmd, `npm` es `npm.cmd`: sin `call` transfiere el control y el script muere ahí. Dos celdas no corrieron y **el job salió 0**.
2. Al corregirlo, un **guion largo en un comentario `rem`** corrompió el script entero: los dos ficheros eran LF sin BOM, pero el que funcionaba tenía 0 bytes >127 y el roto tenía 3. cmd lee por offset y se comía los 2 primeros caracteres de cada línea (`"tlocal"`, `"t"`, `"m"`). **También salió 0.**
3. `[IO.File]::ReadAllText('scripts/…')` resuelve contra el cwd del PROCESO, no contra la ubicación de PowerShell: leyó fuera del worktree, la mutación no se aplicó, y la línea de traza dijo «MUTANTE puesto» con el `git diff` vacío.

Ninguno lo cazó el código de salida. Los tres los cazó **el testigo que faltaba** en el log —la línea de POBLACIÓN y el `EXIT=`— y, en el tercero, un `git diff --numstat` impreso al lado de la afirmación. Es A21 aplicada al banco en vez de a la cobaya:

    🔒 Un instrumento que sale 0 sin haber medido nada se lee exactamente igual que uno que ha medido y no ha
       encontrado nada. La única diferencia la pone un testigo.

**Tests declarados:** `tests/scrum928b-el-veredicto-que-el-color-tapa.test.mjs`.
