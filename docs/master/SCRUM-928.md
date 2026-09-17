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
