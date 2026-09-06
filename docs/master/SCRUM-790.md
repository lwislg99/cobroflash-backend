# SCRUM-790 · el «8 %» que ya no describía nada — y el censo que no puede medir lo que se le pide

**Fecha:** 6-sep-2026 · **Carril:** instrumentación (guards de navegador) · **Gate:** sin gate
**Medido contra:** `origin/main` = `ff4e1c4a14f474d0fb4095cb0643e069388e4935` · 2026-09-06T13:40:05+01:00
**Tanda:** 5674 tests, 5582 pass, 0 fail, 92 skipped (salida 0)

> **Documentación e instrumentación. No se toca ningún guard, no se retira ninguno, y el único
> cambio de código es el texto de dos `//comentarios` de `package.json`.**

---

## ① La frase, y de dónde salía

`package.json` decía, en el `//guards` de SCRUM-548 y otra vez en `//censo:guards-navegador`, que
el total del censo **varía un porcentaje de un dígito entre dos pasadas en la misma máquina
(medido)**. Esa frase es la razón por la que esta casa acepta comparar dos totales.

Rastreada hasta su origen: sale de **DOS medidas** — 54 s y 49,6 s en dos pasadas seguidas
(`tests/scrum548-peaje-package-json.test.mjs`). **Dos muestras no son una dispersión: son una
diferencia.** El propio comentario que la contenía ya avisaba, en la misma frase, de que un guard
individual se movía casi un tercio.

## ② La medición: CINCO pasadas seguidas, misma máquina, sin tocar una línea

`npm run censo:guards-navegador` completo, cinco veces, nada más corriendo, sin editar nada entre
pasadas. **Doce** guards de navegador en las cinco.

```
totales   152,6 s · 179,2 s · 64,1 s · 200,0 s · 100,0 s
mínimo     64,1 s
máximo    200,0 s
amplitud  135,9 s — el máximo es un 212 % mayor que el mínimo
```

**Y no es un guard lento: se mueven TODOS.** Por eso la causa es común (la máquina), no un guard
concreto — es la misma señal que apareció el primer día, cuando once guards cayeron a la vez.

| guard | mín → máx | sube |
|---|---|---|
| `a11y-landing` | 2 → 26,8 s | +1240 % |
| `caja-avisos` | 3 → 30,1 s | +903 % |
| `aviso-bizum` | 4,8 → 43,9 s | +815 % |
| `a11y-comparativa` | 2,2 → 17,1 s | +677 % |
| `caja-documento-suelto` | 3,3 → 23,8 s | +621 % |
| `caja-semaforo` | 2,9 → 17,4 s | +500 % |
| `caja-datos-del-cliente` | 4,9 → 28,3 s | +478 % |
| `objetivo-tactil` | 4,2 → 22,8 s | +443 % |
| `vias-de-cobro` | 6,4 → 25 s | +291 % |
| `contraste` | 7,3 → 27,9 s | +282 % |
| `primera-pantalla` | 6 → 11,8 s | +97 % |
| `cls-barra-anuncio` | 16,1 → 22,3 s | +39 % |

> ⚠️ **Lo que esta medición NO puede ver:** de qué depende. El censo lanza cada guard con
> `spawnSync` y **no reenvía su línea `⟦arranque⟧`**, así que desde aquí no se puede separar el
> arranque del navegador del trabajo de comprobación. Queda declarado, no supuesto.

## ③ 🔴 EL CONTROL QUE DECIDE: el censo no puede medir un aumento de coste

Lo que importa no es si el número baila, sino si **sirve para lo que se usa**: saber si algo
subió de coste. Se midió un guard solo, cinco veces, y luego se le **duplicó el trabajo de
verdad** — los anchos que mide, de dos a cuatro, o sea el doble de navegaciones y el doble de
mediciones. No un `sleep`: el mismo trabajo, hecho el doble de veces.

```
ANTES     12,6 · 17,4 · 14,3 · 11,5 · 6,8   →  banda  6,8 – 17,4 s
DESPUÉS   11,9 · 14,6 · 15,3 ·  9,5 · 9,2   →  banda  9,2 – 15,3 s
```

**La banda del doble de trabajo cae DENTRO de la de antes**, y su máximo es incluso *más bajo*.
Duplicar el trabajo de un guard es invisible en su propio tiempo — y mucho más en el total.

**Conclusión:** el total del censo sirve para saber **qué hay** y que se paga en conjunto. **No
sirve para comparar dos pasadas ni para detectar que algo encareció.** La frase retirada decía lo
contrario, y dos sesiones lo hicieron hoy apoyándose en ella: una leyó un 57,2 → 55,8 s como
«dentro del margen», y con esta dispersión ese razonamiento no sostiene ni «subió» ni «no subió».

*(El guard mutado se restauró byte a byte, comprobado con `sha256sum -c`.)*

## ④ Qué se cambia

**Se RETIRA la cifra, no se corrige.** Es la doctrina del propio comentario que la contenía («no
escribas aquí un número que caduca con el commit de otro»): una dispersión medida un martes no es
una propiedad de la máquina. La ironía era que esa frase se saltaba su propia regla.

En su lugar, en los dos sitios, queda **la advertencia de no comparar**, que es lo que alguien
necesita leer *antes* de comparar, y el puntero a esta entrada, que sí lleva fecha.

🔴 **La cifra retirada no se reproduce en `package.json`**, a propósito: escribirla dejaría otra
vez ahí el tipo de número que ese punto prohíbe. Es la lección de SCRUM-737, que se cazó a sí
mismo al copiar la frase que explicaba.

## ⑤ Lo que NO se hizo, y por qué

**No se añadió un guard que prohíba escribir una dispersión en un `//comentario`.** Se midió antes
de decidir: `CIFRAS_QUE_CADUCAN` (SCRUM-548) caza recuentos de guards y totales en segundos —
comprobado con control positivo— y **el porcentaje pasaba limpio**, en la misma frase que prohibía
los números que caducan. Una regla nueva para porcentajes cazaría también a
`//guards:visuales`, que cita un reparto de tiempo medido (arranque contra comprobación). Ese
texto es de otro carril y retirarlo no es de este ticket, así que la regla dejaría `main` en rojo.

**Queda propuesto, con su dato:** o se retira también ese reparto —que es del mismo tipo: una
proporción de tiempos medida un día— y entonces la regla entra limpia, o se decide conservarlo y
la regla se escribe para no cazarlo. **Es decisión del asesor, no mía.**

---

**Tanda:** 5674 tests · 5582 pass · 0 fail · 92 skipped · salida 0, tras mezclar `main`, sin tocar ningún guard.
