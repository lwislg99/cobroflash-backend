# SCRUM-265 · el margen de la tanda: límites medidos, y un override que no se traga los dedazos

**Fecha:** 3-ago-2026 · **Carril:** B (tooling/QA) · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `dd61eb09b7a22121217c19dbbdd2ec13ab939873` · 2026-08-03T20:18:10+02:00
**Tanda:** 1164 tests, 1097 pass, 0 fail, 67 skipped

> **Puntos 1 y 2.** El **punto 3** —la tanda reporta su propio margen— ya está en `main` desde el
> 2-ago-2026 y su entrada vive en `docs/YAQU_MASTER.md:1199`, escrita antes de SCRUM-273. **No se
> migra** (regla de 273: el histórico se queda donde está), así que este ticket tiene su
> descripción repartida en dos sitios a propósito, no por duplicado. **Y el orden importa: el
> punto 3 es lo que hizo posible medir los puntos 1 y 2** — sin el margen en el recibo, el
> «98,3 %» de abajo no existiría como dato.

---

## PUNTO 1 · el bloque QA corría al 98,3 % de su límite

### Lo medido

Recibo de una tanda real (`.claude/evidencia-tanda.json`, 2-ago-2026):

| hijo | duración | límite | usado |
|---|---:|---:|---:|
| **qa** | **1.769.715 ms** | **1.800.000 ms** | **98,3 %** |
| bot | 68.722 ms | 300.000 ms | 22,9 % |
| a55 | 25.526 ms | 300.000 ms | 8,5 % |
| scrum180 | 229 ms | 300.000 ms | 0,1 % |

Treinta segundos de margen. Y la serie de tres tandas seguidas (medida por el fundador el 2-ago,
no por esta sesión) dice que no es un pico: **1.825,4 s — MURIÓ contra el límite** · 1.792,8 s ·
1.769,7 s. O sea que **esto ya costó una tanda entera**: un hijo muerto por reloj no es un rojo,
es una tanda **inválida** que hay que repetir — que es exactamente lo que SCRUM-197 dejó escrito
para que no se confundieran las dos cosas.

Los tres ligeros sobran de margen y **no se tocan**. El pesado no tenía margen: tenía ruido.

### Por qué 45, y no 35 ni 60

La decisión no sale del porcentaje, sale de la **asimetría de los dos errores**:

* **Corto de más** → el hijo muere por reloj, la tanda entera se tira y se repite. Ya pasó, cuesta
  ~30 min, y pasa justo cuando más prisa hay.
* **Largo de más** → un hijo *realmente* colgado tarda 15 min más en detectarse. Raro, y el coste
  está **acotado por arriba**.

Y hay una razón que **antes no existía**: desde el punto 3, el margen va en el recibo. El único
argumento para tener el límite apretado era usarlo como detector de crecimiento —«si un día muere,
es que ha crecido»—, y ese detector avisa **matando**. Ahora el porcentaje se ve en cada tanda, así
que el próximo ajuste saldrá de un número que sube y no de un cadáver. Con el detector separado del
límite, el límite puede ser generoso sin perder nada.

45 min deja el peor caso conocido en el ~66 % y **1,5× de crecimiento** antes de volver a rozarlo.
No se subió más porque **el TTL del turno se deriva de este número**, y cada minuto de más es un
minuto que un turno huérfano bloquea a las demás sesiones.

### El guard no compara la constante consigo misma

Un `assert.equal(HEAVY_MS, 45 * 60 * 1000)` copia el número en dos sitios, cambia a la vez que el
código y no dice nada nunca. El guard exige la **propiedad que hace bueno al número**: al menos un
**30 % de margen** sobre la peor duración conocida. Por eso el rojo explica qué se rompió —«el hijo
qa corre al 99,6 % de su tiempo»— en vez de qué constante no cuadra. Y hay un segundo test que fija
con números la frase «los ligeros no se tocan»; sin él eso es una opinión sobre algo que nadie
volvió a mirar.

### ⚠️ Consecuencia declarada: el TTL pasa de 45 a 55, y por eso este ticket iba DESPUÉS de 266

`ttlParaTanda(45 min)` = **55 min**. Antes, con HEAVY a 30, el derivado era `max(45, 40)` = 45, o
sea **exactamente el suelo**: la ventana de SCRUM-266 (`TTL derivado − 45 supuestos`) valía **cero**
en la configuración por defecto y solo aparecía con un override.

Con este cambio la ventana pasa a ser **10 minutos por defecto, sin ningún override**. Antes de
SCRUM-266 eso habría convertido un fallo ocasional en el régimen normal: `turno:tomar` se habría
llevado el turno de una tanda viva de forma rutinaria. La entrada de 266 lo predijo por la fórmula
y ahora está confirmado con el número. **El orden de los dos tickets no era preferencia: era
requisito**, y queda fijado en un test para que quien vuelva a tocar el límite vea la dependencia.

---

## PUNTO 2 · `GATED_CHILD_TIMEOUT_MS` ilegible se tragaba en silencio

```js
const OVERRIDE_MS = Number(process.env.GATED_CHILD_TIMEOUT_MS) || 0;
```

`Number('treinta')` es `NaN`, `NaN || 0` es `0`, y **`0` significa exactamente «no hay override»**.
Quien pedía un límite distinto se llevaba el de por defecto **sin un solo aviso**. Y el efecto es
invisible: la tanda corre, pasa, y solo se descubre si alguien se para a leer el límite anunciado
por hijo. Fail-open de manual (SCRUM-217): el valor no se entiende y en vez de parar se sigue con
otra cosa que parece razonable.

**Las tres respuestas, y la tercera es la que faltaba:**

| entrada | antes | ahora |
|---|---|---|
| ausente | defecto | defecto ✅ |
| `60000` | override | override ✅ |
| `treinta`, `60_000`, `60000ms`, `0`, `-1000`, vacía | **defecto, callando** ❌ | **aborta, `exit 2`** |

**Vacío cuenta como ilegible**, y es decisión con coste: `GATED_CHILD_TIMEOUT_MS=` es un dedazo tan
probable como `=treinta`, y tratarlo como «ausente» devolvería el fail-open por la puerta de atrás
para el caso más fácil de cometer. Cuesta un `unset` cuando se hace a propósito.

**Cero y negativos también:** un límite de 0 ms mata a todos los hijos al nacer. No es lo que quería
quien lo escribió.

Se aborta **antes de tomar el turno** (`:205`, y el cliente no nace hasta `:261`): pedir la base
para correr con una configuración que no es la que se pidió sería bloquear a las demás sesiones
para nada.

---

## Dónde viven los números, y por qué se movieron

`test-staging-gated.mjs` es un **script**: importarlo desde un test lanzaría una tanda entera contra
staging. Sin poder importarlo no hay red, y un número que gobierna cuándo se mata a un hijo no puede
estar sin red. Los límites y `resolverOverride` salen a `scripts/_timeouts-tanda.mjs` — la misma
razón y el mismo patrón que `_margen-tanda.mjs` en el punto 3.

Dos guards de AST impiden que eso se deshaga solo:

* el runner **lee la variable únicamente** a través de `resolverOverride` — cualquier lectura
  directa puede volver a tragarse un ilegible;
* el runner **no puede tener copia propia** de `HEAVY_MS`/`LIGHT_MS` — con una copia local, los
  tests verdes serían sobre el módulo y la tanda seguiría muriendo a los 30 min. El verde más hueco
  que hay es el número correcto en un fichero que nadie importa.

## Verificado en rojo

* **Los dos guards estructurales, sin inyectar nada:** contra el runner sin tocar caen señalando
  `línea 192` (lectura cruda) y `LIGHT_MS (190), HEAVY_MS (191), OVERRIDE_MS (192)` (copia propia).
* **`HEAVY_MS` de vuelta a 30, inyectado:** cae el guard del margen —«el hijo qa corre al 99,6 % de
  su tiempo»— y cae también el del TTL, porque a 30 el derivado vuelve a ser exactamente el suelo.
  Ese segundo rojo es la prueba de que la dependencia con SCRUM-266 está fijada y no solo escrita.
  Verificado que la inyección se aplicó y que compila antes de creerme el rojo; revertida.
* **El punto 2, ejecutado de verdad y no solo en unitario** (la lección de SCRUM-168 que el propio
  runner cita): `GATED_CHILD_TIMEOUT_MS` con `treinta`, vacía, `60_000` y `0` → **`exit 2`** las
  cuatro, con el motivo correcto y **cero líneas de turno**: no llegó a tocar la base.

## Lo que NO cubre — y esto hay que leerlo

* **NO se ha corrido una tanda gateada real con el límite de 45.** El turno de staging lo tenía la
  sesión de `scrum-255-migrar-sondeos` (vigente, con compromiso hasta las 18:43Z). Lo verificado es
  la aritmética, el cableado y el camino de aborto; **queda sin observar el comportamiento del
  límite nuevo contra staging**. Es el hueco grande de este ticket y no se disimula.
* **El 30 % de margen es una política, no una medición.** Sale de la asimetría de arriba, no de un
  modelo del crecimiento de la suite — que no existe: solo hay **un** recibo con `margenes`, porque
  la función es del 2-ago. Con dos o tres tandas más habrá serie de verdad.
* **No se toca `LIGHT_MS`** ni el reparto de hijos: el ticket cambia un número y declara por qué los
  otros no.
* **La duración total anunciada se corrigió como literal** (`~11 min` → `~31`, en tres sitios): sale
  de sumar el recibo, no de cronometrar la tanda de hoy.

## Hallazgo, reportado y NO arreglado (regla 9 / regla 37)

El comentario del runner llevaba meses diciendo **«bloque QA (~10 min): ~3× de margen»** mientras el
bloque iba por 29,5 min. Se corrigió porque documenta la constante que este ticket cambia. **Lo que
no se ha hecho es buscar el resto de la familia**: no hay ningún mecanismo que impida que un
comentario que cita una medición envejezca en silencio, y esta sesión ya ha encontrado cuatro
mentiras del mismo número en un solo fichero. No se abre ticket porque el fundador lo prohibió
expresamente para esta tarea; queda dicho aquí.

## Ficheros

* `scripts/_timeouts-tanda.mjs` (nuevo) — `LIGHT_MS`, `HEAVY_MS`, `VAR_OVERRIDE`,
  `resolverOverride`, `limiteDe`, con el porqué medido.
* `scripts/test-staging-gated.mjs` — importa los límites; aborta con `exit 2` ante un override
  ilegible, antes de tomar el turno; corregidas las tres menciones a `~11 min`.
* `tests/scrum265-timeouts-tanda.test.mjs` (8, sin gate).
