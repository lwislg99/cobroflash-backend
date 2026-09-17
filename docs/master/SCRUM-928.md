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

Al escribir `const ANSI = /\u001B\[…/` la secuencia se guardó como el **byte 0x1B de verdad**, no como
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

- `const CSI = /\u001B\[[0-9;?]*[ -\/]*[@-~]/g;` y `sinColor(s)`, aplicada al probar `RESUMEN` sobre la cola.
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

Al escribir el regex, `\u001B` se guardó como **el byte 0x1B de verdad** en vez de sus seis caracteres. Funcionaba —los 11 tests en verde— y por eso es peligroso. Lo delató leer el fichero y ver la línea como `/\[[0-9;?]*…/`, sin el escape, porque el visor se come el byte al pintarlo; se confirmó contando bytes 0x1B sobre el fichero (1 antes, 0 después) y se pasó a la forma escapada, repitiendo la verificación entera.

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

---

## SCRUM-928c · punto 3 · el laboratorio del vigía le pasaba su propio entorno al sujeto

**Medido contra:** `origin/main` = `fa9ff832e5d64a60ea9ef50bf863e138ef4de423` · 2026-09-17T19:38:46Z (hora de GitHub; las mediciones son de los minutos anteriores, misma máquina)
**Rama:** `scrum-928c-el-paso-que-hereda-el-color` · **Carril:** Sesión 3 (instrumentos) · **Reparto:** el punto 3 lo asignó el orquestador a la S3 a las 19:31Z, con la condición de que nadie más entre en `scrum853c` mientras. Cierra el ticket: ① y ② ya están en `main`.

### ① El defecto NO estaba donde parecía

Los dos rojos que quedaban vivían en `tests/scrum853c-el-vigia-no-se-cree-un-error.test.mjs`, que ejecuta los `run:` REALES de `.github/workflows/vigia-atascados.yml`. La tentación era arreglar el YAML —carril de la S5— o aflojar la aserción. **Ninguna de las dos.** El defecto estaba en el laboratorio: `correrPaso` construía el entorno del paso con

```js
const env = { ...process.env, /* … */ };
```

y le colaba al sujeto el `FORCE_COLOR` de quien lanzaba la tanda. El paso **no corría en el entorno que este fichero dice medir**: en GitHub Actions esa variable no existe.

    🔒 Un laboratorio que le presta su entorno al sujeto no mide el sujeto: mide la suma de los dos.

### ② PASO 0 · una sola variable, y el defecto aparece

Mismo árbol, sin tocar nada, cambiando **sólo** la variable:

| entorno | resultado de `scrum853c` |
|---|---|
| sin `FORCE_COLOR` | 9 tests · 9 pass · **0 fail** · exit 0 |
| `FORCE_COLOR=3` | 9 tests · 7 pass · **2 fail** · exit 1 |

### ③ Y eran DOS campos coloreados, no uno

El enunciado del ticket (y mi propio informe) decían que el ANSI salía en el campo de checks. Al sembrar el rojo, el mensaje del guard enseñó la línea entera:

```
1212|DIRTY|\u001B[33m1\u001B[39m|\u001B[33m2261\u001B[39m|null
```

El color va en **los checks Y en los minutos**: node pinta de amarillo todos los NÚMEROS que formatea. Eso importa porque el segundo caso comparaba los minutos con holgura (`Number(minutos)`), así que ese rojo no era «una cadena distinta»: era un `NaN` esperando. Por eso el guard nuevo no comprueba campo por campo, sino que **no haya ni un byte de escape en la línea**: un aserto por campo habría dejado pasar el campo que aún no se mira.

### ④ Qué cambia, y qué no

- `tests/scrum853c-…`: tras construir `env`, se borran **`FORCE_COLOR`, `NODE_OPTIONS` y `NODE_TEST_CONTEXT`** salvo que un `escenario` los pida a propósito (el escenario sigue mandando y se respeta).
- **NO se toca `.github/workflows/vigia-atascados.yml`** (carril S5) ni ninguna aserción. Los dos casos que fallaban no se han modificado: pasan porque el sujeto corre por fin en su entorno.
- Alcance de lo medido, declarado por variable: **`FORCE_COLOR` es lo medido aquí.** `NODE_OPTIONS` y `NODE_TEST_CONTEXT` van por el precedente **medido en SCRUM-858b** (CI del #1441: un reporter heredado le regalaba un recuento a una tanda fabricada) y **no se han vuelto a medir sobre este fichero**. El método no llega: ponerle a la tanda de fuera un `NODE_OPTIONS=--test-reporter=spec` mata al propio `node --test` que la corre (`ERR_INVALID_ARG_VALUE: '--test-reporter' must match the number of specified '--test-reporter-destination'`). Queda dicho, no medido — y el instrumento que lo intentó se declara inválido en vez de publicar su rojo como hallazgo.

### ⑤ El rojo primero, y por qué no depende del entorno de quien lo corre

El guard nuevo **pone él mismo `FORCE_COLOR=3`** y lo restaura en un `finally`, así que cae igual lo lance quien lo lance. Quitando el bloque de saneado:

```
✖ SCRUM-928c · el paso fabricado NO hereda el color del chat: su línea de estado sale sin ANSI
  AssertionError: 🔴 la línea de estado trae códigos de color: …
  estados: "1212|DIRTY|\u001B[33m1\u001B[39m|\u001B[33m2261\u001B[39m|null\n"
```

Y lleva dentro su **control anti-tautología**: antes de juzgar, lanza un hijo que SÍ hereda el entorno y exige ver un `ESC` en su salida. Si un día node deja de colorear, el caso dice «NO PUDE MIRAR» en vez de pasar en verde sobre un defecto que ya no puede ver.

No se declara mutación en `MUTACIONES_QUE_ME_TUMBAN`: la mutación sería sobre el propio fichero de test que la ejecuta, y el meta-guard no mide eso. El rojo se probó a mano, está arriba, y las tres entradas que ese array ya tenía (las del YAML) no se tocan.

### ⑥ Verificación por efecto

| comprobación | resultado |
|---|---|
| `scrum853c` **sin** color | 10 tests · 10 pass · **0 fail** · exit **0** |
| `scrum853c` con **`FORCE_COLOR=3`** (el que fallaba) | 10 tests · 10 pass · **0 fail** · exit **0** |

Con esto, de los **3** rojos que el color provocaba en la suite quedan **0**: el de `scrum858b` lo quitó 928b, y estos dos, 928c.

### ⑦ El byte 0x1B no fue un descuido: es SISTEMÁTICO, y esta sección lo midió al escribirse

La sección ⑦bis de arriba y la ⑥ de 928b lo contaban como un accidente —«se me coló uno»—. **Las dos se quedaron cortas.** Cada vez que se escribe el texto `\u001B` en un fichero desde esta herramienta, lo que aterriza en disco es **el byte 0x1B**, no sus seis caracteres. Medido hoy contando bytes con `[IO.File]::ReadAllBytes`:

| fichero | bytes 0x1B | dónde |
|---|---|---|
| `docs/master/SCRUM-928.md` antes de esta sección | **3** | 1 en ⑦bis (S5) y 2 en 928b (S3) — **las dos ya en `main`** |
| `docs/master/SCRUM-928.md` al escribir ESTA sección | **10 más** | los bloques de código y las citas de aquí mismo |
| `tests/scrum928b-…test.mjs` | **2** | la constante del escape y el regex de limpieza — **ya en `main`** |
| `tests/scrum853c-…test.mjs` | **2** | los dos `includes(…)` del guard nuevo |
| `scripts/tanda-con-veredicto.mjs` | **0** | ya corregido en 928b |

Los 17 pasan a la forma escapada, y se comprobó que el comportamiento **no cambia**: 21 tests (853c + 928b + 858b) · 20 pass · 0 fail · 1 salto · exit **0**, con `FORCE_COLOR=3` y sin él.

Y hay una prueba de que la causa es la herramienta y no el descuido: al intentar corregir ESTA sección con el editor, la operación se negó avisando de que «también probó intercambiando los escapes `\uXXXX` y sus caracteres», sin casar en ninguna de las dos formas. La transformación ocurre **en los dos sentidos**, y no se ve en el texto que uno cree estar escribiendo.

🔴 **La conclusión no es «tener más cuidado», porque el cuidado ya falló cuatro veces seguidas, dos de ellas DENTRO del párrafo que avisaba del problema.** La única defensa que funciona es un CONTEO después de cada escritura:

```powershell
([IO.File]::ReadAllBytes($f) | Where-Object { $_ -eq 27 }).Count   # tiene que ser 0
```

Ni el visor, ni la consola, ni una revisión a ojo lo ven: el byte se traga al pintarlo. Sólo lo ve quien cuenta bytes.

    🔒 Contra un fallo de la herramienta que ESCRIBE no vale releer lo escrito: hay que contar los bytes de lo que
       quedó en disco. Y una advertencia redactada con el mismo defecto que advierte no es una advertencia: es una
       demostración.

⚠️ **Uno de los 3 primeros está en una sección que no es mía** (la ⑦bis de la S5), y se dice en vez de hacerlo en silencio: es una corrección mecánica que deja esa frase diciendo lo que evidentemente quería decir, no un cambio de contenido, y es revertible en un commit si la dueña de esa sección prefiere hacerlo ella. Los 2 del fichero de test de 928b también estaban ya en `main`, y son míos.
### ⑧ Errores propios de esta parte

1. **El sitio que señalé estaba mal.** En mi informe del punto 1 escribí que los dos rojos de 853c eran «un tercer sitio, en el paso que produce esa línea», o sea en el YAML. Era falso: el paso produce lo que produce porque el laboratorio le pasa el color. El arreglo no estaba en el productor, sino en quien le fabrica el entorno. Si hubiera trabajado sobre mi propia frase, habría entrado en un fichero de otro carril a arreglar algo que no estaba roto.
2. **Conté un campo coloreado y eran dos** (③).
3. **Construí un instrumento inválido, y lo delató su FORMA de fallar, no su resultado:** el probe de `NODE_OPTIONS` salió con exit 1 y CERO recuentos, y un exit 1 sin población se parece mucho a un hallazgo.

    🔒 Un rojo sin población no es un hallazgo: es un instrumento que no llegó a arrancar.

**Tests declarados:** `tests/scrum853c-el-vigia-no-se-cree-un-error.test.mjs`.
