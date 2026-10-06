# SCRUM-1282 · `sesion.mjs contexto` acepta los nombres con los que trabaja el equipo (primera parte, antes de la A19)

**Rama:** `scrum-1282-lista-blanca-sesion` · **Carril:** S5 · automatización (s5-29d) · **Fecha:** 29-sep-2026
**Medido contra:** `origin/main` = `f9b5cdbf74901a1a7dd34d7caa27596628827328` · 2026-09-29T17:28:50Z

## Qué pasaba

`sesion.mjs contexto <nombre>` da la magnitud buena para decidir un relevo: input + cache_read +
cache_creation del último turno del jsonl. Pero estaba **inservible**. Pasaba por la lista blanca del
equipo (`orquestador`, `sesion-0..5`) y rechazaba con NOMBRE-NO-PERMITIDO los nombres con los que se
trabaja de verdad. Por eso todas las sesiones restaban a mano. **Una herramienta que existe y no se
puede usar es igual que no tenerla.**

## El cambio

`contexto` **solo lee**: busca el nombre por `===` en `claude agents --json` y lee un jsonl. Ya no pasa
por la lista blanca y le basta una FORMA de nombre segura (`validarNombreDeLectura`: letras, números,
`.`, `_` y `-`, hasta 64, sin empezar por signo). La lista blanca estricta **se queda** en lanzar,
relevar, parar y olvidar, que son las acciones que actúan sobre procesos. Se distingue por lo que hace
la orden, no por quién la pide.

## Medido, con las funciones del módulo sobre las sesiones vivas (29-sep-2026)

| nombre | antes | ahora | contexto del último turno |
|---|---|---|---|
| `s5-29d` | NOMBRE-NO-PERMITIDO | ok | 258.528 tokens · 285 turnos |
| `cobroflash-backend-57` (orquestador) | NOMBRE-NO-PERMITIDO | ok | **646.130 tokens · 4.169 turnos** |
| `s3-29e` | NOMBRE-NO-PERMITIDO | ok | 105.898 tokens · 22 turnos |
| `../x`, `--help` | rechazado | rechazado (NOMBRE-INVALIDO) | — |

**Es la primera vez que se mide el contexto del orquestador.** Hasta hoy era imposible, porque la
herramienta rechazaba nuestros propios nombres, y los relevos se decidían con una resta hecha a mano
sobre un número que nadie había validado. La cifra de `s5-29d` cuadra con «15M − restantes»
(259.539) a unos mil tokens.

⚠️ El cambio llega a la copia **instalada** cuando se mergea: la puerta de integridad compara esa copia
con `origin/main`.

`tests/scrum1282-contexto-nombres-de-hoy.test.mjs`: los nombres de hoy se aceptan, lo que no tiene
forma de nombre se rechaza (control positivo), la lista blanca de las acciones que actúan no cambia,
y la acción `contexto` usa la validación de lectura. Tiene dos mutaciones, las dos comprobadas en rojo.

## Lo que falta de este ticket (sin empezar)

**La A19 reescrita con esta magnitud.** La medición de s5-29c (comentario 17569) corrige la premisa:
«15M − restantes» **no** es consumo acumulado. En su sesión coincidía con la ocupación de ventana, y el
acumulado de sus 288 turnos habría sido de decenas de millones. 🔴 **Queda ABIERTO, y la norma tiene
que decirlo: no se sabe qué hace ese contador DESPUÉS de una compactación.** Es una sola medida, y sin
compactación por medio.

---

# SCRUM-1282 · segunda parte: la ocupación sale del LATIDO, leída desde un árbol

**Rama:** `scrum-1282b-ocupacion-en-el-latido` · **Carril:** S5 (s5-1octc) · **Fecha:** 1-oct-2026
**Medido contra:** `origin/main` = `64dc3211d039cedece0cccf9fa3fcaf7d491319d` · 2026-10-01T12:55:00Z

A9: comprobación → `tests/scrum1350-latido.test.mjs`

La rama sale de la de SCRUM-1357 (#2084), no de `main`: las dos tocan `scripts/equipo/latido.mjs`.

## Qué pasaba

La primera parte dejó `sesion.mjs contexto` usable. Pero esa orden es de la copia INSTALADA, y su
puerta de integridad la para (`ALTERADO`) en cuanto `sesion.mjs` cambia en `main` y nadie refresca la
instalación. El 1-oct pasó al entrar #2002: todo el equipo se quedó sin la cifra a la vez. s5-1octb lo
curó refrescando la copia; es cura de un día, y volverá a pasar con #2090 (SCRUM-1364), que toca ese
fichero.

## El cambio

`latido.mjs` gana la sección **7 · CONTEXTO**. Importa de `sesion.mjs` sólo sus funciones puras
(`contextoDelJsonl`, `buscarJsonl`, el umbral de la A19 y los estados terminales) y lee el jsonl de
cada sesión viva del registro de trabajos. **La puerta de integridad no se toca**: sigue guardando
lanzar, relevar, parar y olvidar. Esto sólo lee.

| Caso | Qué dice |
|---|---|
| Sesión viva (no terminal, con actividad en 24 h) | su ocupación, en la población de la sección |
| Por encima de 200k (umbral de la A19) | aviso: «se releva AL TERMINAR su entrega», con los minutos desde su último turno |
| Viva y sin jsonl, o ilegible | la sección sale `NO PUDE MIRAR` (salida 2) y enseña las que sí leyó. No es cero |
| Viva y sin ningún turno todavía | se nombra; no es ceguera |
| Transcript reciente (60 min) que no es de un trabajo de fondo | sale como `(sin trabajo de fondo: <8 del id>)`. El orquestador es uno de esos |

## Medido contra las sesiones reales (1-oct-2026, ~12:50Z)

| Sesión | Ocupación |
|---|---|
| (sin trabajo de fondo: ed676fd1) | 421k |
| s3-1octd | 409k |
| s0-1oct | 349k |
| s1-1octc | 297k |
| s2-1octb | 245k |
| s5-1octc (esta) | 244k |
| s1-1octd | 136k |
| s4-1octc | 121k |

Control de la cifra: el contador de esta sesión marcaba 14.757.954 restantes de 15.000.000, o sea
242k, en el turno anterior al que leyó el latido (244k). Coinciden.

## Comprobado

| Qué | Resultado |
|---|---|
| Dirigida `tests/scrum1350-latido.test.mjs` | 26 tests, 26 pasan (22 de antes + 4 nuevos) |
| Mutación: el aviso por umbral nunca salta | caen 3 |
| Mutación: una sesión sin jsonl se salta en silencio | cae el CIEGO |
| Mutación: se miran también las terminadas | cae el de ocupación |
| Mutación: «no pude leer» devuelve `null` en vez de `undefined` | cae el de disco |

Las cuatro aplicadas a mano y restauradas. No he corrido la tanda completa en local (memoria).

## Lo que NO he comprobado, y límites

- **El orquestador sale sin nombre.** No es un trabajo de fondo, así que el registro no sabe cómo se
  llama: aparece por los 8 primeros caracteres de su sesión. Quien lea tiene que saber cuál es el suyo.
- **Lo de que la cifra BAJA al compactar** está probado con un jsonl fabricado (965k → 75k manda el
  último), no observando una compactación real desde el latido. Lo medido en real es del orquestador
  (5 compactaciones), no mío.
- **Con el umbral en 200k, hoy avisan 6 de 8.** El latido sale 1 casi siempre por esta sección. Si el
  umbral de la A19 ya no es el que se usa con opus, eso es texto de la A19 (S0), no de aquí: el latido
  lee `UMBRAL_CONTEXTO` de `sesion.mjs` y cambiará con él.
- Los transcripts sueltos se buscan sólo en las carpetas donde ya hay un trabajo de fondo.

## Mis errores

1. Lancé seis ediciones seguidas sobre un fichero que no había leído en ese árbol (lo había leído en
   otro). Fallaron las seis sin tocar nada; las repetí tras leerlo.

## Lo que sigue faltando de este ticket

El texto de la A19 con esta magnitud. Es de S0 (`00-normas-comunes.md`).

---

# SCRUM-1282 · tercera parte: lo que le faltaba al texto de la A19 (S0)

**Rama:** `scrum-1282c-a19-contador-compactacion-latido` · **Carril:** S0 (`00-normas-comunes.md`; sesión `s0-6octd`) · **Fecha:** 6-oct-2026
**Medido contra:** `origin/main` = `6aaec0dc8f0267518a50f626299ae901f81e2ae1` · 2026-10-06T13:28:17Z

A9: aviso → A10 «Una salida recortada para leerla cómoda es media salida: el corte cae donde no estabas mirando.» — no se pudo comprobar: el recorte lo pone a mano quien lee, en una orden de consola de un solo uso; no hay fichero del repositorio donde un test lo pueda ver.

## Lo que NO había que arreglar

El título del ticket dice que la A19 nombra una magnitud equivocada. **No es así.** La casilla 1 ya definía
la suma correcta (`input_tokens` + `cache_read_input_tokens` + `cache_creation_input_tokens` del último
mensaje), que es la que la S5 midió dos veces. Este puesto afirmó lo contrario el 6-oct por buscar una
palabra en vez de leer la norma, y lo retiró (Jira, comentario 18367).

## Lo que sí faltaba, y entra aquí

Tres cosas en la casilla 1 y una frase en «Cuándo se releva». Todas salen de mediciones de la S5 (Jira,
comentarios 17886 y 17901):

| qué dice ahora la A19 | de dónde sale |
|---|---|
| «15.000.000 − restantes» es una lectura válida de esa suma: la sigue a menos del 0,3 % | 2 de 2: 805 de 327.605 (29-sep) y 373 de 235.014 (1-oct) |
| No es el consumo acumulado | en la única sesión donde se sumó (1-oct, 42 turnos): 7.528.215 frente a 235.014, 32 veces más |
| Desde fuera se lee en el latido, sección CONTEXTO; `sesion.mjs contexto` responde `ALTERADO` cuando un PR toca ese fichero | segunda parte de este registro (#2091) |
| Una sesión que ha compactado lo dice al dar su cifra, y se releva en el siguiente punto limpio | 5 compactaciones de una transcripción: de 861-967k a 69-81k en las 4 con un turno válido detrás |
| Queda sin medir el contador visto desde dentro de una sesión recién compactada | una sesión del otro equipo leyó 6.108 (comentario 17573); ninguna nuestra lo ha cruzado con su jsonl |

## Lo que NO entra: el número

**Los umbrales (200k al entregar, 500k a mitad) no se tocan en este PR.** El 6-oct el orquestador propuso
500k y 800k, y lo paró él mismo: es una decisión de coste y es del fundador. La norma y la constante de
`sesion.mjs` tienen que cambiar juntas, y el gemelo de código es SCRUM-1479 (S5). **Ninguno de los dos
tickets se cierra sin el otro.**

Lo que este PR sí deja escrito en la A19, con su fecha, es lo medido para decidir:

| | 6-oct-2026 |
|---|---|
| sesiones con algún turno ese día (UTC) | 21 |
| pasaron de 200k · de 500k · de 800k | 18 · 3 · 2 |
| una sesión arranca en | ~66-70k |
| pasa de 200k en su llamada | 11 a 44, en las 17 que nacieron ese día (la otra venía de antes, ya por encima) |
| Σ de contexto simulado al relevar a 200k · 500k · 800k (S5, 21 sesiones, Σ 412,3 M) | −49,7 % · −5,8 % · −2,3 % |
| lo mismo, recontado por S0 una hora después (22 sesiones, Σ 448,8 M) | −50,2 % · −5,3 % · −2,1 % |

La simulación es la de SCRUM-1070 (`node scripts/equipo/gasto-arranque.mjs vivas --horas 24 --simular <n>`).
Suma contexto, no coste, y supone que una sesión relevada arranca en 85k.

## Dónde vive el 200k (para quien cambie el número)

Leído sitio a sitio en `origin/main`. De S0: `00-normas-comunes.md`, A19 (tres veces) y A25 (dos). De S5:
`scripts/equipo/sesion.mjs:99`, `scripts/equipo/gasto-arranque.mjs:647`,
`docs/equipo/orquestador-autonomo.md:85-89` y tres tests (`scrum899c:157`, `scrum1070:22`,
`scrum1350:450-451`). Del orquestador: `docs/equipo/orquestador.md:105`.

## Mis errores

1. **Leí media línea y la conté entera.** Miré `docs/master/SCRUM-1070.md:49` recortada a 260 caracteres
   para que cupiera en pantalla. Entera dice que el 200k de la norma fue «decisión del orquestador» **y**
   que la constante de `sesion.mjs` llevó «autorización escrita del fundador». El corte caía justo antes de
   la segunda mitad, y con la primera escribí en SCRUM-1479 que un test atribuía mal el número. Lo cazó la
   S5. Corregido en el ticket.
2. **Conté 42 sesiones donde había 21.** La misma carpeta de transcripciones entraba dos veces, con
   distinta mayúscula en la ruta. Lo vi en las filas repetidas, no en el total.
3. **Puse la hora a ojo tres veces** en notas de Jira (13:35Z, 13:25Z y 13:45Z cuando eran 13:16Z, 13:19Z
   y 13:27Z). La hora buena es la que marca Jira en cada una.

---

# SCRUM-1282 · cuarta parte: el número (500k al entregar, 800k a mitad) — ESCRITO Y SIN EMPUJAR (S0)

**Medido contra:** `origin/main` = `78426f7ad5d75af2f43ebb553eb5fe7604f2eafc` · 2026-10-06T17:38:02Z

A9: aviso → cicatriz S0 «Un comando que se cita en una norma se copia de la terminal donde corrió: cité el simulador de relevo sin su número, y así no arranca.» — no se pudo comprobar: ningún test ejecuta los comandos que una norma cita en prosa

⏳ **Este commit NO se empuja solo y NO se empuja todavía.** Dos motivos, y los dos constan:

1. **Es una decisión de coste y el fundador no la ha dicho de primera mano.** El orquestador de Luis la tomó el
   6-oct (SCRUM-1479, comentario 18480) diciendo que el fundador se la había delegado. `limites-del-fundador.md`
   deja el coste fuera de su delegación, y una autorización contada por otra sesión no se hereda (A19). La S5
   paró su mitad por lo mismo, y yo la mía: mi orden de arranque decía de la nota de la A19 «no la cambies».
2. **Entra junto con su gemelo de código**, SCRUM-1479 (la constante de `sesion.mjs`, `gasto-arranque.mjs`, tres
   tests y `orquestador-autonomo.md`, de la S5). Ningún test ata el texto de la norma a la constante
   (`scrum1070`, `scrum1350` y `scrum899c` no leen `00-normas-comunes.md`), así que dos PR podrían entrar con
   minutos de diferencia. Acordado con la S5: fusiona esta rama LOCAL en la suya y empuja una vez. Ese PR lleva
   dos tickets en una rama, y se declara.

Antes de empujar hay que completar, en la A19, la línea «⏳ Quién lo autorizó»: quién, dónde y a qué hora.

## Qué cambia en `docs/equipo/00-normas-comunes.md`

- A19: 200k → **500k** en «cuándo se releva», en la casilla 3 y en «cuándo no se releva»; 500k → **800k** en
  «en mitad de una entrega» y en su excepción.
- A19: sale la nota «en revisión» del 6-oct y entra la medición, el coste y el motivo, fechados, con el comando
  entero para recalcularlo.
- A19: la frase «el latido no avisa de este caso», con su ticket (SCRUM-1484, abierto hoy para la S5).
- A19: por qué son dos números.
- A25: su línea del relevo dice 500k y 800k, y conserva lo medido el 21-sep como historia.

## Un tercer sitio que NO es mío y sigue diciendo 200k

`docs/equipo/orquestador.md:105` (lo apunté en la tercera parte, «Dónde vive el 200k»). Es del orquestador de
Luis. Si la norma y la constante entran sin esa línea, quedan dos textos de acuerdo y uno que los desmiente. No
lo toco: se lo digo, y o lo cambia él o lo autoriza por escrito para el mismo PR.

## Lo medido, y con qué

| qué | cifra | instrumento |
|---|---|---|
| sesiones por encima de 200k y de 500k, ~13:20Z | 18 y 3 de 21 | la S5, `gasto-arranque.mjs vivas` (SCRUM-1479, comentario 18416) |
| ídem y por encima de 800k, ~17:15Z, MÁXIMO del día | 26, 5 y 2 de 32 | script de la S0 sobre los jsonl del día; NO está en git |
| turno en que una sesión cruza 200k | del 10 al 44, mediana 20, sobre 25 | el mismo script |
| simulación a 200k, 500k y 800k, ~13:20Z, 21 sesiones, Σ 412,3 M | 207,2 M · 388,6 M · 403,4 M | la S5 |
| ídem, 17:37Z, 31 sesiones, Σ 586,6 M | 301,5 M · 554,1 M · 577,3 M | `node scripts/equipo/gasto-arranque.mjs vivas --horas 30 --simular <umbral>`, corrido tres veces por la S0 |

**Dos cifras que parecían contradecirse y no:** «2 de 21 por encima de 800k» (S0, máximo del día) y «1 de 21»
(S5, último turno). Una sesión pasó de 800k, compactó y acabó por debajo. La norma lleva las dos con lo que mide
cada una.

**Lo que NO está en git:** el script del recuento por máximo del día vive fuera del árbol. La norma da como
comando de recálculo el de la S5, que sí está en `main`.

## Mis errores

- La nota que entró esta mañana (tercera parte) citaba `gasto-arranque.mjs vivas --simular` sin umbral. Así no
  arranca: `--simular` exige el número. Lo copié de un comentario de Jira y no lo corrí. Corregido aquí.
- Puse tres horas a ojo en mensajes de esta tarde (17:20Z, 17:25Z, 17:30Z con GitHub en 17:15-17:17Z). El
  «recuento de 17:25Z» es de ~17:15Z, y así va escrito.
