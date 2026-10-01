# SCRUM-1394 · El censo de bancos de mutación fuera del catálogo, subido y re-anclado: hoy son 18 de 29, y «fuera» dice menos de lo que parece

**Medido contra:** `origin/main` = `b3b40554ed5441c285c780590a98d1665636e778` · 2026-10-01T18:30:20Z
(J6 del equipo de Javier, sesión `jv-j6k`, relevo de J6j; encargo del orquestador `cobroflash-backend-5b`. El censo
lo construyó J6i y lo inventarió J6j; aquí se sube, se le cambian los controles y se vuelve a correr.)

A9: aviso → A10 «Una red de seguridad que no caza tiene el mismo aspecto que una que no tuvo nada que cazar.» — no se pudo comprobar: los dos censos de este ticket ya juzgan sus controles y salen CIEGO si fallan, pero viven en evidencias y no en la tanda; el siguiente censo que imprima su control sin juzgarlo no lo hereda

## En corto

Es subir y medir: no se toca el meta-guard, ni su catálogo, ni ningún guard, techo o workflow. No decide si el
catálogo debe ser el destino obligatorio de las mutaciones (SCRUM-1387 ②): le da el número a quien decide.

⚠️ **El cruce es una heurística de TEXTO, no AST**: un banco es «una carpeta de evidencias con algún fichero con
`mut` en el nombre», y está «fuera» si su guion no nombra el catálogo. Puede perder bancos que se llamen de otra
forma y contar carpetas que no lo son. Ningún número de aquí se lee sin esa frase al lado.

| | J6i (catálogo de 118 guards · 385 declaraciones) | hoy, sobre `b3b40554` (121 · 413) |
|---|---|---|
| carpetas con banco de mutación | 24 | **29** |
| lista propia, fuera del catálogo | 17 | **18** |
| toman las del test (catálogo) | 4 | 7 |
| sólo salidas, sin guion en git | 3 | 4 |

La línea que sale siempre, también con cero (`salida-bancos.txt`):

    29 bancos mirados · 18 fuera del catálogo   (población: 91 ficheros de evidencias con «mut» en el nombre, en 29 carpetas · catálogo: 121 guards, 413 declaraciones · de los 18: 7 con lista reconocida y ningún test suyo en el catálogo, 9 sin entradas reconocidas, 5 con algún test suyo en el catálogo)

Las cinco carpetas nuevas desde la medición de J6i: `scrum1338` (fuera), `scrum1341` (sólo salidas), y `SCRUM-1386`,
`scrum1336` y `scrum1343`, que toman las del test. De las 24 de entonces, ninguna cambió de clase.

## ① Los dos controles de `censo.mjs` no valían, y sólo se sabía de uno

El censo traía dos controles escritos dentro. Los dos se IMPRIMÍAN; ninguno se juzgaba.

- **El positivo había caducado**, y estaba avisado en el ticket: decía que SCRUM-1345 sale «C2» porque `scrum976`
  no declara. Hoy `scrum976` declara 6 (las de SCRUM-1386) y SCRUM-1345 sale «C1». Sus seis mutaciones siguen sin
  estar en el catálogo: lo que cambió es el test al que apuntan, no ellas.
- **El negativo nunca fue verdad.** Decía «SCRUM-1327 (sé que está DENTRO: su test declara)», y su test,
  `tests/scrum1327-el-veredicto-no-se-decide-a-mano.test.mjs`, no declara ninguna mutación: cero menciones de la
  constante, y ningún commit de su historia la añadió ni la quitó. El censo lo clasificaba «B» —lo contrario de lo
  que su propia línea decía saber— ya en la salida de J6i (`salida-censo-j6i-5fb7630a.txt`, penúltima línea), y
  como el control no juzgaba, salió así sin que nada lo señalara.

Ahora los dos se juzgan, y si uno no da lo que se sabe de él el censo sale 2 con la palabra CIEGO:

| control | ticket | se espera | por qué se sabe |
|---|---|---|---|
| positivo | SCRUM-1327 | B (fuera) | tiene test propio y ese test no declara nada |
| negativo | SCRUM-1336 | A (dentro) | su test propio declara las suyas |

Vistos fallar: en una copia con la clase esperada del positivo cambiada, `censo.mjs` sale 2; en una copia de
`bancos.mjs` que espera fuera al banco de dentro, sale 2. Sin cambiar, los dos salen 0.

Con el censo re-anclado, sobre 953 registros de los que 304 AFIRMAN mutaciones (una línea que habla de mutar y trae
una cuenta o un resultado): A 82 · B 186 · C1 13 · C2 16 · C3 7. La lista entera está en `salida-censo.txt`.

## ② Qué dice «fuera» y qué no

`bancos.mjs` llama «LISTA PROPIA, fuera del catálogo» a todo guion que no nombra el catálogo: es su rama por
defecto, no «le encontré una lista». Mirando los 18 por dentro salen tres grupos, y se solapan:

- **7 con lista reconocida y ningún test suyo en el catálogo.** El estrato firme de verdad: `scrum1317`,
  `scrum1338`, `scrum1326`, `scrum1327`, `scrum1340`, `scrum920`, `scrum982`.
- **9 «sin entradas reconocidas».** El patrón que cuenta entradas busca `de:`, `busca:`, `antes:`, `quita:` o
  `desde:`, y estos guiones escriben su lista de otra forma (por `id:`, o en un JSON aparte): `SCRUM-1324`,
  `SCRUM-912`, `SCRUM-917`, `scrum1304`, `scrum1330`, `scrum1333`, `scrum864`, `scrum864c`, `scrum908c`. Los
  nueve tienen en git un guion `mut*.mjs` (listados, no leídos uno a uno); cuántas mutaciones lleva cada uno no
  está contado.
- **5 con algún test suyo, o al que apunta su guion, en el catálogo**: `SCRUM-1345`, `scrum864`, `scrum864c`,
  `scrum908c`, `scrum933`. Sus mutaciones pueden estar además declaradas allí. **Si las del banco coinciden con las
  declaradas NO está medido**: pide comparar mutación a mutación, y eso no lo hace un cruce de texto.

Así que la frase del ticket, «17 bancos cuyas mutaciones el CI no vigila», hoy se sostiene entera para 7, y para
los otros 11 dice «su guion no nombra el catálogo».

Los controles de `bancos.mjs`, también juzgados: `scrum1326` (20 mutaciones escritas en su guion, su test no
declara) tiene que salir fuera, y `scrum1331` (toma las del test) no puede salir. Si el censo nombrara a los 29
no estaría midiendo; nombra 18.

## Lo que se subió

`docs/master/evidencias/SCRUM-1394/`. Los tres guiones toman la raíz por argumento.

| fichero | qué es | respecto al de `~/yaqu-censos/j6i-1oct/s-catalogo/` |
|---|---|---|
| `censo.mjs` | registros que afirman mutaciones, cruzados con el catálogo | cambiado: sólo el bloque de controles (sha256 del original `4e9b98a7a35c8845…`) |
| `bancos.mjs` | las carpetas con banco y su clase | ampliado al final: los de fuera por nombre, controles y la línea fija (original `2b02d6224d662773…`) |
| `explorar.mjs` | tamaños de población; no concluye nada | idéntico (`8c4f16eaa35cba71…`) |
| `salida-censo-j6i-5fb7630a.txt`, `salida-bancos-j6i.txt` | las salidas de J6i, tal cual | idénticas; caducadas, se guardan como historia |
| `salida-censo.txt`, `salida-bancos.txt`, `salida-explorar.txt` | las de hoy | nuevas |

## Lo que NO sé y lo que NO cubre

- **Todo es texto.** Vale lo dicho arriba, y además: un banco cuyos ficheros no lleven `mut` en el nombre no existe
  para este censo. Cuántos hay así no está medido.
- **Lo contrario también pasa.** La carpeta `SCRUM-1391` (PR #2117, sin mergear a esta hora) trae
  `salida-mudez-mutada-copia.txt`: cuando entre, contará como un banco «sólo salidas» sin serlo. Leído del patrón,
  no ejecutado.
- **Los números caducan con cada merge.** En cuarenta minutos del 1-oct el catálogo pasó de 118 a 120 guards, y
  ahora tiene 121. Quien cite una cifra de aquí la vuelve a correr.
- **Si una mutación de un banco de fuera sigue cayendo hoy**, no se sabe: aquí no se ha ejecutado ningún banco.
- De los 123 tests que contienen el texto `MUTACIONES_QUE_ME_TUMBAN`, 121 están en el catálogo. Los otros dos
  (`scrum606-albaran-desde-presupuesto`, `scrum708-el-fichero-que-no-corre`) sólo lo mencionan, no lo exportan.

## Mis errores

- Un guion de un solo uso me imprimió `NaN` dos veces: restaba 1 a una cadena por no poner un paréntesis. Lo dijo
  su propia salida.

## Reproducir

Desde la raíz de un árbol al día:

    node docs/master/evidencias/SCRUM-1394/bancos.mjs .
    node docs/master/evidencias/SCRUM-1394/censo.mjs . --lista
    node docs/master/evidencias/SCRUM-1394/explorar.mjs .

Los dos primeros salen 2, con la palabra CIEGO, si un control ya no da lo que se sabe de él.
