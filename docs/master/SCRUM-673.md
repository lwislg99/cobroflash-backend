# SCRUM-673 · Un arranque lento no produce un veredicto

**Medido contra:** `origin/main` = `4b3865f8201fe24fe367f45c4f6fba34933a1de0` · 2026-09-02T12:00:00+02:00
**Rama:** `scrum-673-arranque-no-produce-veredicto` · **Ninguna base tocada.**

## Qué hecho vigila el mecanismo nuevo, en una frase

> **Que un guard de navegador solo emita veredicto cuando ha llegado a MIRAR** — y que si no llegó,
> lo diga: rojo con NO MEDIDO, nunca silencio y nunca «no hay defectos».

## PARTE A · el tope no se sube; se deja de tratar un arranque lento como un veredicto

**Tres intentos con topes crecientes** (30/60/90 s con la base de hoy). Solo si fallan **los tres**
hay veredicto, y es rojo diciendo **NO MEDIDO**.

El número sale de lo medido: el mismo guard, el mismo binario y la misma máquina arrancaron en
**0,3 / 12,9 / 38,2 s** en tandas distintas. Eso no es el navegador, es **la carga del runner**. Y el
tope estaba **por debajo de un arranque que la propia máquina demostró sano ese día** —
`guard:caja-avisos`, 38,2 s, **verde**, en la misma tirada y en serie.

**Por qué no 60.000:** sería cambiar un número por otro y esperar que el runner no vuelva a ir
lento — la cura que SCRUM-520 rechazó. Lo que cambia aquí no es el número: es que **un arranque
lento deja de ser un veredicto**.

### ⚠️ ENMIENDA DEL FUNDADOR: NO es la misma enfermedad que scrum351 y scrum642

Lo dijo él y lo corrige de su propia entrada, y es una distinción que **cambia dónde se busca la
cura**:

- **`scrum351` y `scrum642` JUZGAN una duración**: comparan un tiempo medido contra un umbral. Se
  curan cambiando **qué se mide**.
- **`guard:contraste` NO juzga ninguna duración: SE QUEDA SIN PLAZO.** Es otra familia — el censo la
  llama **grupo 2**, 45 líneas en el repo.

El síntoma que sufre el fundador es el mismo —un veredicto que depende de la carga— **pero la cura
no lo es**. Aplicar la receta de la primera familia aquí habría llevado al sitio equivocado.

### Y los DOS plazos, que están en dos ficheros distintos

| plazo | dónde | qué es |
|---|---|---|
| **30.000 ms** | `_navegador.mjs:142` (`TOPE_ARRANQUE_POR_DEFECTO`) | **el del ARRANQUE — es el que tumbó el CI, y es el que se toca aquí** |
| 240.000 ms | `guards-visuales.mjs:49` (`TOPE_MS`) | el total por guard, en el `spawnSync` de la puerta |
| 15.000 ms + `setTimeout(600)` por ruta | `guard-contraste.mjs:278-279` | los de la COMPROBACIÓN, **no se tocan en este ticket** |

⚠️ **Una coordenada de la enmienda, corregida midiendo:** el tope de 30.000 del arranque **no está
en `guards-visuales.mjs`**, está en `_navegador.mjs:142`. Lo que vive en `guards-visuales.mjs` es el
otro, el de 240.000. La distinción de fondo —son dos plazos distintos en dos ficheros distintos— se
sostiene entera.

El peor caso queda **acotado**: si nada arranca, para en 180 s y lo dice.

## PARTE B · el informe se contradecía a sí mismo, y de dónde salía el 0,3 s

`leerArranque` usaba **`.find()`**: se quedaba con la **primera** marca `⟦arranque⟧` y **tiraba las
siguientes en silencio**.

**De ahí salía el «0,3 s»: era el arranque de un intento ANTERIOR, no el del que falló.** Un guard
que arrancó bien y después murió emitía dos marcas, y la tabla pintaba
`└ arranque COMPLETA · proceso+ws 0.3 s` **debajo de una fila que decía NO ARRANCA**. Quien leyera
solo el desglose concluía que había arrancado bien.

**Reproducido antes de tocar nada**, con esas dos líneas exactas: `total 0.3 · desenlace COMPLETA`.
Después del arreglo, las mismas dos dan `total 30 · CORTADA · 2 intentos`.

Ahora se lee la **última** —el desenlace de un arranque es el último emitido— y los intentos **se
cuentan**: la línea dice «3 intentos» en vez de tirarlos. Un arranque que necesitó reintentar es un
runner cargado, y esa señal es la que hay que **ver acumularse antes** de que vuelva a tumbar el CI.

> **Y las dos partes están acopladas:** sin arreglar B, el reintento de A dejaría la tabla congelada
> para siempre en el primer intento fallido. B no es un extra: es condición de A.

## PARTE C · el control positivo suspende con el mecanismo VIEJO

Se le pasa a `lanzarNavegador` un `puppeteer` de mentira que **falla una vez y arranca a la
segunda**, y se comprueba que **el navegador LLEGA a quien lo pidió** — no que exista una llamada.

**Probado quitando el mecanismo:** con `INTENTOS_DE_ARRANQUE = 1` el resultado no es un assert
fallido, es **`pass 0 · fail 1`**: `process.exit(3)` mata el proceso de prueba y el test **ni llega a
su assert**. El mecanismo viejo no puede aprobarlo de ninguna manera.

**Commit de seguridad previo a las inyecciones:** `fc2c88e9531dfb2d861cbea412ad6370307963ea`.

| inyección | resultado |
|---|---|
| `INTENTOS_DE_ARRANQUE = 1` | `pass 0 · fail 1` — el proceso muere |
| `.find()` → primera marca | `rc=1` · *«EL INFORME SE CONTRADICE A SÍ MISMO»* |

## Lo que NO se ha tocado

`guard:contraste` **no se ha desactivado, ni saltado, ni marcado skip**: corre y está **verde**.
`guards:visuales` → **rc=0, los nueve verdes**, leído entero y con su código de salida, sin tubería.

## Un guard ajeno me corrigió, y no se toca

`SCRUM-642` exige que el bloque de error explique que **el reloj lo paró el tope**, y lo comprueba
**por su texto** (`/NO es lo que tardó: es hasta dónde se miró/`). Al mover esa explicación del
intento al desenlace la partí en dos líneas y su regex dejó de casar. Es de otro carril (regla 9):
**la frase se conserva literal y en una sola línea**, y el test no se edita.

## Hueco declarado

**No se ha reproducido el fallo original en el runner de CI**, que es donde vive la causa (la carga
de la máquina). Lo medido aquí es que el mecanismo hace lo que promete —reintenta, no emite
veredicto por lentitud, y el informe deja de contradecirse—, con topes forzados a 1 ms para
provocar el corte. Que 90 s basten en el peor runner real es una apuesta acotada, no una medida.

---

## ¿Sirve esta cura para el resto del grupo 2? SÍ, pero es la FORMA lo que se transplanta

Preguntado por el fundador sobre `scrum268` (2×60.000 ms) y `bot-suite` (2×1.500 ms). Medidos:
los cuatro son `await new Promise((r) => setTimeout(r, N))` — **esperas fijas**.

**El código no se transplanta** (no arrancan un navegador). **La forma de la cura, sí**, y en ellos
vale más que aquí:

> Una espera fija es **una apuesta sobre la velocidad de la máquina**. `setTimeout(60000)` dice «a
> los 60 s ya habrá pasado», y en un runner cargado eso es **falso** — pero el test no se ralentiza:
> **sigue y comprueba algo que aún no ha ocurrido**. Es decir, un plazo vencido **sí produce
> veredicto**, y encima el equivocado.

La misma propiedad que cierra este ticket es la que los cerraría a ellos:

1. **Esperar la CONDICIÓN, no el reloj** — sondear hasta que la cosa esté, con un plazo por encima.
2. **Un plazo vencido NO produce veredicto**: se reintenta, y si se acaban los intentos se dice
   **NO MEDIDO**. Nunca «no ha pasado nada», que es lo que hoy concluyen.
3. **Una medida cortada no se imprime como completa**, y los intentos se cuentan.

Y hay una ganancia de tiempo de propina que aquí no existe: `scrum268` duerme **120 s enteros**
aunque la condición se cumpla en el primer segundo. Sondear la condición le devuelve casi dos
minutos por tanda.

**NO se han tocado** (regla 9): son de otro carril y este ticket es el arranque del navegador.

## Lo que NO puedo atribuir, y lo digo

Durante la tanda, `tests/scrum642-tramos-del-arranque.test.mjs` falló **1 de 3** veces en esta rama
(el tramo `primera-página` daba `0.1` donde su assert exige `0.0` — un salto de 100 ms). Con
`origin/main` limpio salió 5/5 verde, así que **parecía mío**.

Medido después en igualdad, **10 ejecuciones por lado: 0 rojos en mi rama y 0 en main.** No puedo
atribuir esa inestabilidad a este cambio **ni descartarla**: lo que se ve es un test sensible a
100 ms de jitter. Y tiene su ironía — **el fallo lo produjo la carga de la máquina, que es
exactamente la enfermedad que este ticket viene a curar**, esta vez en un test que juzga una
duración (familia de `scrum642`, no la mía).

**Se reporta y no se toca**: es de otro carril.
