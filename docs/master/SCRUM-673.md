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
lento — la cura que SCRUM-520 rechazó. Es la **tercera** aparición de la misma enfermedad
(SCRUM-520, SCRUM-671 y ésta). Lo que cambia aquí no es el número: es que **un arranque lento deja
de ser un veredicto**.

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
