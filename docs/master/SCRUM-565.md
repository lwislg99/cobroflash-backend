# SCRUM-565 · el cierre de los encargos deja de depender de que la sesión se dé cuenta

**Medido contra:** `origin/main` = `164d092dc8e955aa1b01ce254133a24553ce91d9` · 2026-08-20T22:22:51+01:00

> **20-ago-2026 · proceso. No toca producto, ni copy, ni schema, ni el camino de emisión. Cero
> dependencias nuevas.**

## ⓪ Lo primero: este encargo llegó ENTERO, y su cabecera NO cuadra

El marcador `=== FIN DEL ENCARGO ===` llegó. Contrastando la cabecera con lo recibido:

| declara | hay | |
|---|---|---|
| 4 puntos de alcance | 4 | ✅ |
| 4 prohibiciones | **5** | 🔴 |
| 1 suelo | 1 | ✅ |
| 17 líneas de restricciones | 17 | ✅ |

**El encargo no está cortado; el recuento de la cabecera está mal.** Se declara y no se ajusta en
silencio — y resulta que este desajuste es lo que enseñó cómo tenía que ser el mecanismo (§②).

## ① El hecho: NO HE PODIDO REPRODUCIR EL CORTE

Con esas palabras, como pide la ficha. Lo medible desde aquí son los encargos que ha recibido
**esta** sesión, leídos del transcript:

```
20 encargos · de 1.957 a 10.631 caracteres (11.596 bytes el mayor)
ninguno cortado
ninguno termina en una frontera redonda (4096 / 8192 / 10000)
caracteres de control raros (fuera de \n y \t) ....... NINGUNO
U+FFFD (señal de codificación rota) .................. 0
```

- **Hipótesis de longitud**: sin apoyo, y además el corpus pone un **suelo**: 11.596 bytes
  llegaron íntegros, así que un límite por longitud está por encima de eso.
- **Hipótesis del carácter**: sin apoyo — ni un control raro en 21 mensajes.
- **Hipótesis del canal de pegado**: **no medible desde aquí.** Soy el extremo que recibe; el
  mensaje llega ya montado y no puedo enviarme uno por el mismo canal.

Y el corte que originó el ticket **le llegó a S3, no a mí**: no está en mi transcript. No puedo
medir lo que no me llegó.

> 🔴 **Y por eso el marcador se pone igualmente**, que es lo que manda el suelo de la ficha: el
> coste de ponerlo es cero y el de no tenerlo ya está medido — una vez, y se salvó por disciplina.

## ② El cierre comprobable, y las DOS respuestas que no son la misma

`npm run comprobar:encargo <fichero>` — lo corre **la sesión que recibe**, que es el único
extremo que ve lo que llegó.

| veredicto | qué significa | ¿parar? |
|---|---|---|
| **TRUNCADO** | trae cabecera y **no** termina en el marcador | **SÍ** (sale con 1) |
| **DISCREPANCIA** | el marcador está y un recuento no cuadra | no: **declarar y preguntar** |
| **SIN_CIERRE** | ni cabecera ni marcador (formato anterior) | no: *no se puede comprobar* |
| **COMPLETO** | marcador presente y los cuatro recuentos cuadran | no |

**Por qué «falta el marcador» es prueba dura:** el truncamiento se lleva **el final**, y la
cabecera va arriba — sobrevive. Un mensaje que anuncia un cierre y no lo trae es un mensaje al que
le falta texto.

**Por qué un desajuste de recuento NO lo es:** la cabecera la escribe una persona. Y no es
hipotético: **en el estreno del formato decía 4 prohibiciones habiendo 5** (§⓪). Un comprobador
que tratara eso como truncamiento habría mandado parar un encargo completo **en su primer uso**, y
una alarma que salta sin motivo es la que alguien desactiva.

Los cuatro recuentos se **derivan** del cuerpo recibido —puntos numerados de `## ALCANCE`, líneas
`⛔`, encabezados `## SUELO`, viñetas de primer nivel del bloque de seguridad— y no de una segunda
cifra escrita a mano, que sería el mismo problema con otro nombre.

## ③ El control que decide — y el defecto que encontró en mi propio comprobador

Se corta **el encargo real de este ticket**, extraído del transcript (el texto que llegó, no una
copia reescrita), por seis sitios:

```
① el encargo ENTERO                                → DISCREPANCIA ✅ no lo llama truncado
   cortado a media frase en el punto 3 (el caso real) → TRUNCADO · parar=true
   cortado justo antes del bloque de seguridad        → TRUNCADO · parar=true
   cortado a media lista de restricciones             → TRUNCADO · parar=true
   cortado un carácter antes del marcador             → TRUNCADO · parar=true
   cortado a la mitad del marcador                    → TRUNCADO · parar=true
   cortado dejando sólo la cabecera                   → TRUNCADO · parar=true
② la CLI sobre el cortado → exit 1  ✅   ③ sobre el entero → exit 0  ✅
```

### 🔴 Lo que cazó, y era grave

La primera versión buscaba el marcador **en todo el texto**. Y la cabecera **lo cita**:

> «Si no ves «=== FIN DEL ENCARGO ===» al final, PARA Y DILO.»

Lo encontraba en el **carácter 144 de 5.130** y daba por completo un encargo cortado. Es decir:
**aprobaba cualquier encargo truncado del formato nuevo** —que son todos los que traen cabecera—,
inútil exactamente en el caso para el que existe. Es la trampa de la autorreferencia otra vez: el
documento contiene su propio marcador.

Ahora se compara la **última línea no vacía** con `===`, no con `includes`. «El marcador aparece»
y «el mensaje termina en el marcador» son afirmaciones distintas, y sólo la segunda prueba algo.

### Y el falso positivo del otro lado, tapado

Los encargos anteriores a hoy no llevan cierre y **están enteros**. Sin cabecera ni marcador el
veredicto es `SIN_CIERRE`, que no es «completo» sino «no hay con qué comprobarlo».

### 🛑 Lo que este control NO prueba, dicho con esas palabras

**No prueba que una sesión pare.** Eso es comportamiento del modelo, no código: lo verificable
dentro del repo es que el mecanismo da el veredicto correcto y que la regla está escrita donde se
carga siempre. Para cerrar ese hueco haría falta algo que esta sesión no puede montar:

- que el encargo llegue por un canal que el repo pueda leer (un fichero en la rama, un issue), en
  vez de pegado en el chat — entonces el comprobador podría correr **antes** de que la sesión lea
  nada; o
- una prueba con sesión real: enviar a propósito un encargo cortado y registrar si para. Es un
  experimento del asesor, no un test.

## ④ Dónde vive la regla: `cerebro-yaqu`, y el argumento es decisivo

**Una skill propia hay que INVOCARLA.** Y quien recibe un encargo truncado no tiene ningún motivo
para invocarla: el encargo cortado no la pide — precisamente porque le falta el final. La única
regla que sirve aquí es la que se carga **sin que nadie la elija**, y ésa es `cerebro-yaqu`.

Va **corta y arriba del todo** (16 líneas, antes de «Al arrancar»), porque se carga en cada sesión
y cada línea se paga. El detalle vive en el script y aquí.

**Leída antes de tocarla, como pedía la ficha.** Lo que arregló SCRUM-538 (`d12118e3`) fue que la
skill ordenaba escribir en `YAQU_MASTER.md`, que el guard de SCRUM-273 **bloquea en CI**: la skill
que se carga en toda sesión mandaba justo lo que el CI rechaza, y costó un PR en rojo el 17-ago.
La regla nueva no manda hacer nada que ninguna herramienta rechace.

> ⚠️ Y un hallazgo al mirarla: **`cerebro-yaqu` no la vigilaba ningún test.** La skill que gobierna
> todas las sesiones se podía vaciar sin que nada se quejara. Ahora hay un caso que exige que sus
> cinco piezas sigan puestas — y por eso mismo la regla nueva no depende sólo de que alguien la
> respete.

## Verificación

- **Control positivo**: el encargo íntegro **no** sale como truncado, ni el del formato viejo.
  Sin eso, un comprobador que dijera «TRUNCADO» a todo pasaría los seis cortes igual.
- **Los cuatro recuentos se ejercitan por separado**: se mueve cada uno y tiene que salir su
  desajuste. Si `cuenta` devolviera el número de la cabecera, todo saldría COMPLETO y el contraste
  no existiría.
- **Las continuaciones sangradas no se cuentan** como restricciones: inflarían el número y harían
  saltar la alarma en un encargo íntegro.
- **Suite:** `3930 tests · 3853 pass · 0 fail · 77 skipped`.
- **CRLF**: `cerebro-yaqu/SKILL.md` tenía 71 CR — **el fichero entero, no mis 16 líneas**: la copia
  de trabajo ya los traía de agosto y tocarlo lo destapó. Quitados byte a byte con node; el diff
  contra `origin/main` queda en `+16/-0`.

## Lo que queda anotado y NO es de este ticket

- **SCRUM-567**: el censo de SCRUM-553 cuenta un HTML literal dentro de un `.replace()` como
  extractor. Tercera vez. No se ha tocado.
- El PR de **SCRUM-522** sigue abierto esperando merge. No se ha re-tocado.

## Ficheros

| fichero | qué |
|---|---|
| `scripts/comprobar-encargo.mjs` | el comprobador, con sus cuatro veredictos (nuevo) |
| `.claude/skills/cerebro-yaqu/SKILL.md` | la regla, arriba del todo, donde se carga siempre |
| `package.json` | `comprobar:encargo` + su `//comentario` |
| `tests/scrum565-encargo-completo.test.mjs` | 12 tests |
