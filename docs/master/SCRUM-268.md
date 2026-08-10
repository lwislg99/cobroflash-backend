# SCRUM-268 · TURNO-4: ceder es un acto distinto de soltar

**Fecha:** 4-ago-2026 · **Carril:** B (tooling) · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `fed079eaa94931aa9893ef91df59c7a2011898c0` · 2026-08-04T14:23:05+02:00
**Tanda:** 1243 tests, 1176 pass, 0 fail, 67 skipped

## El defecto

El turno solo sabía decir **ocupado** y **libre**. Una cola acordada entre personas —«cuando
acabes me lo pasas»— no existía en ningún sitio que una máquina pudiera leer, así que soltar
abría una **carrera**, y la carrera la gana quien pregunta más veces por segundo. Ya pasó: un
bucle esperador se llevó el turno que otra sesión acababa de ceder a mano.

Y **perdió en silencio**: desde fuera, «se lo llevó un `while`» no se distingue de «lo pillé yo
primero». No hay error, no hay aviso, y la cola acordada simplemente no ocurre.

```
soltar = «he terminado, queda libre para quien lo pille»
ceder  = «he terminado y es TUYO, no de quien pase antes»
```

## Se puede expresar con lo que ya hay, y meter un campo en la marca sería PEOR

La pregunta del ticket era si hacía falta un campo nuevo. **No**, y no es una comodidad: es la
decisión que hace seguro el arreglo.

`RE_LOCK` está **anclado**, y un marcador que no case EXACTAMENTE se ignora → el turno se lee como
**LIBRE**. Si la cesión llevara gramática nueva en la marca, el código anterior —y hay árboles a
más de cien commits de `main`, uno corriendo mientras se escribe esto— vería un turno cedido como
libre: **sería más robable que uno normal**. Exactamente al revés de lo que hace falta.

**Ceder = escribir el marcador a nombre del destinatario.** Un `lock:<dueño>@<ISO>` normal y
corriente:

* el código viejo ve «tomado» y se aparta;
* el nuevo compara con `esMiTurno` y **solo entra el destinatario**, adoptándolo — el mecanismo
  que SCRUM-253 ya construyó.

El bucle esperador pierde **por construcción**, no por llegar tarde.

Lo único nuevo vive en el **contexto**, que es advisory: la etiqueta y la ventana. Y esa asimetría
es la correcta — si el contexto se pierde, queda un lock normal del destinatario: **se pierde la
etiqueta, nunca la protección**.

**Lo único que se añadió a la gramática es un valor:** `cedido`, en el vocabulario CERRADO
`TIPOS_EJECUCION`. Estaba congelado por un assert de SCRUM-232, así que el cambio **salió en rojo
y obligó a declararlo** — que es exactamente para lo que se congeló. Cero campos nuevos.

## Si nadie la recoge

La ventana se publica como el **compromiso de SCRUM-249**, así que no hubo que inventar nada:
pasada la ventana, `decidirVigencia` la ve VENCIDA y el turno vuelve al común. Una cesión sin
recoger caduca **antes** que el TTL (30 min por defecto frente a 45), no después.

Y si el contexto se vuelve ilegible, se cae al **TTL supuesto**: más tarde, nunca antes. El
degradado empuja siempre hacia esperar de más, que es el lado barato del error.

## Mi observación de SCRUM-258: **entra**, y la medición es la que lo decide

Quedó declarada allí sin arreglar: *«adoptar y soltar no son simétricos — si tomas el turno para
20 min y lanzas una tanda por el medio, te quedas sin turno al acabar»*.

Sola es una molestia. **Con la cesión dentro es un agujero:** A cede a B, B corre **una** tanda, y
la tanda suelta el turno que acaban de cederle — la cola vuelve a ser una carrera justo después de
haberla respetado. Por eso entra aquí y no queda fuera: sin ella, ceder dura lo que tarde el
destinatario en lanzar su primera tanda.

`debeSoltarAlTerminar({ adoptado })` vive aparte y pura porque el runner es un script: importarlo
desde un test lanzaría una tanda.

## Los guards, derivados

* **Toda escritura del turno ocurre dentro de la sección crítica.** Es *el* guard del ticket:
  ceder es leer-decidir-escribir sobre **dos** objetos (marcador y contexto), y contra un bucle que
  sondea varias veces por segundo eso solo es seguro serializado por el advisory lock. Una
  escritura fuera devuelve la carrera por la puerta de atrás — el esperador se cuela entre el
  «¿es mío?» y el «toma». Se recorre el módulo entero por AST; no se nombra ninguna función.
* **Ceder nunca degrada a soltar**: dentro del cuerpo de `cederLock` (encontrado por AST, no por
  líneas) ninguna escritura lleva el marcador libre. Si lo llevara, la cesión sería un soltar con
  el mensaje cambiado.
* **El runner consulta si debe soltar** en vez de soltar siempre. Sin esto, el arreglo de la
  asimetría se deshace con una línea: la función pura seguiría verde en sus tests y el runner
  soltaría igual.

## Verificado en rojo

* **Ceder degrada a soltar** (escribe `MARCADOR`) → caen cinco, encabezados por **EL CASO REAL**:
  el esperador se lleva el turno recién cedido. Es el defecto original, reproducido.
* **La cesión no publica ventana** → cae «una cesión que nadie recoge no bloquea para siempre».
* **La tanda vuelve a soltar lo adoptado** → cae la asimetría de SCRUM-258.
* **Una escritura antes de entrar en la sección crítica** → cae el guard, señalando la línea.

Las cuatro verificadas como aplicadas y compilando antes de creerme el rojo; revertidas, árbol
limpio.

**Y hay una contraprueba explícita**, no solo el rojo: un test que hace `soltar` y comprueba que el
esperador **sí** se lo lleva. Sin ella, «con ceder no se lo lleva» podría estar pasando por
cualquier otra razón.

## Lo que NO cubre — y una CORRECCIÓN a lo que afirmé ayer

* **⚠️ La cesión NO se ha observado contra staging real.** Al ir a hacerlo, el turno lo tenía otra
  sesión: `scrum-259-tenancy-aislado`, VIVO, con ~33 min por delante. No se toca. Lo verificado es
  la lógica con cliente inyectado y las tres identidades reales leídas del disco
  (`wt-268 → .d8ef48f415`, `wt-258 → .d92a7932bd`, `wt-265 → .a4ca185471`, mismo host). **Queda sin
  observar la secuencia `ceder` → el tercero rechazado → el destinatario adoptando** contra la
  base.
* **CORRECCIÓN a SCRUM-253/258.** Ayer afirmé, midiendo, que no quedaba ningún turno vivo con id
  del formato viejo y que «el conjunto se vacía solo». Hoy **sí lo hay**: el turno vigente es de
  `DESKTOP-T5MONF5.21360` —`host.PID`, formato anterior a SCRUM-253— tomado a las
  2026-08-04T12:05:33Z. La medición de ayer era correcta **en su instante**; la inferencia no lo
  era. El conjunto no se vacía solo mientras se sigan usando árboles anteriores a 253, y eso no
  depende del tiempo sino de qué código corre cada sesión.
* **Consecuencia de lo anterior, declarada:** una cesión a una sesión que corra código anterior a
  SCRUM-253 **nunca se recogerá** — esa sesión calcula su identidad como `host.PID` y jamás
  coincidirá con el `host.<token>` que se escribió a su nombre. La cesión caducará por la ventana y
  el turno volverá al común. No se pierde nada, pero la cesión no funciona hacia atrás.
* **El destinatario se nombra a mano.** `ceder --a <id>`, con el id que da `quien-soy`. Es
  deliberado: la cesión es NOMINAL, así que hace falta el nombre. Se valida la **forma**, no la
  existencia — no hay manera de saber si esa sesión existe, y no hace falta: si no llega, vence.
* **No hay cola de más de uno.** Se cede a UNA sesión. Una cola de tres pediría estructura en el
  marcador, que es justo lo que aquí se descarta por peligroso.

## Ficheros

* `scripts/_staging-lock.mjs` — `cederLock()` nueva; `debeSoltarAlTerminar()`; `cedido` en el
  vocabulario cerrado; `lineasDeContexto` lo describe sin fingir que hay algo corriendo.
* `scripts/turno-staging.mjs` — modos `ceder` y `quien-soy`; la ayuda distingue los dos verbos.
* `scripts/test-staging-gated.mjs` — no suelta lo que adoptó.
* `tests/scrum232-turno-contexto.test.mjs` — el vocabulario congelado, ahora con tres.
* `tests/scrum268-cesion.test.mjs` (11, sin gate).

---

# SCRUM-268 · Punto 3 — un guard: nadie espera el turno en un bucle y lo toma

**Fecha:** 4-ago-2026 · **Carril:** B (tooling) · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `5d0cebef4fee6f180d44e8de4f1a458f29bcd97e`
**Tanda:** 1272 tests, 1205 pass, 0 fail, 67 skipped (`npm test` con exit **0**)
**Ficheros:** `tests/_espera-automatica.mjs` (detector puro), `tests/scrum268-espera-automatica.test.mjs` (13)

## Por qué NO lo absorbe la cesión de arriba

La cesión hace que el esperador pierda **por construcción** un turno **cedido**. Pero el propio
resumen de arriba lo dice: `soltar = «he terminado, queda libre para quien lo pille»`. Contra un
turno **soltado** —el caso normal— el bucle sigue ganando siempre, porque pregunta más veces por
segundo que una persona.

Son dos mitades distintas del mismo ticket: **la cesión protege el turno prometido; este guard
impide que el esperador exista en el repo.** Ninguna sustituye a la otra.

## El incidente

Un esperador en segundo plano consultaba `turno:estado` cada 60 s. En el intento 8 vio LIBRE y
**tomó** el turno (`DESKTOP-T5MONF5.22844`, 14:01:05Z), quedándose con lo que un humano acababa de
ceder a otra sesión.

> **cualquier automatismo que espere y tome gana siempre a un humano que espera y decide**

## Qué se prohíbe: la COMPOSICIÓN, no cada mitad

Esperar **mirando** es legítimo; adquirir **una vez** es legítimo (es lo que hacen el CLI y el
runner, fuera de todo bucle). **Reintentar hasta conseguirlo** es lo que gana siempre al humano.

Por eso `refrescarLock` **no** cuenta como adquisición: medido, el runner adquiere fuera de todo
bucle y dentro solo refresca. Quien refresca ya tiene el turno; no compite por él. Confundirlos
habría puesto en rojo al runner legítimo.

**Tras el merge de la cesión se volvió a medir:** la adopción del destinatario pasa por
`adquirirLock` (que ahora consulta `esMiTurno` por dentro) y `cederLock` **entrega**, no toma. La
cesión **no abrió ninguna vía de adquisición nueva**, así que el único símbolo vigilado sigue
cubriéndolas todas.

## AST, no texto — y el segundo motivo es el que decide

1. Un `grep` no distingue «llamada **dentro** de un bucle» de «llamada y, aparte, un bucle».
2. **Un guard de texto se caza a sí mismo** en el comentario que explica la prohibición
   (SCRUM-176/168/3). Aquí ni se plantea: el código escrito dentro de una cadena **no produce nodos
   de bucle**, así que los casos de prueba viven en el propio fichero del guard sin denunciarlo.
   **La inmunidad es estructural, no una excepción.**

**Censo derivado del árbol** (`scripts/`, `tests/`, `src/` → 434 ficheros), jamás una lista a mano:
la lista a mano no avisa de lo que le falta.

## El SUELO, y por qué no es decorativo

«No hay esperador» y «no supe mirar» son **el mismo número** y significan lo contrario. Tres
asserts lo separan: el censo recorrió ≥100 ficheros, el detector **ve** ≥50 bucles reales, y **ve**
≥1 adquisición real.

**Demostrado, no argumentado.** Con el detector cegado (`LOOPS → false`) **y un esperador real
presente en el repo**, el test del repo dio **VERDE mintiendo** y lo cazó el suelo:
`🔴 el detector solo vio 0 bucles en 434 ficheros`.

## Un falso positivo real, cazado y corregido

La primera versión marcó `tests/scrum188-turno-staging.test.mjs:246`, que recorre una **tabla de
casos** contra un cliente falso para comprobar que `adquirirLock` **se niega**. Eso no espera: itera
fixtures. **Un guard que tumba lo legítimo no distingue, y uno que no distingue se acaba
desactivando.**

Un esperador se reconoce porque **su continuación depende de obtener el turno**: **duerme** entre
intentos · **corta** el flujo (`break`/`return`) · su **condición** está atada a algo que el cuerpo
asigna. La tabla no tiene ninguna. El caso real queda como **control negativo, no como excepción**.

## Qué cubre

Las **dos vías** de adquirir: en proceso (`adquirirLock`) y por **subproceso** (spawn del CLI en
modo `tomar`, o del runner). La forma **evasiva** (`const x = adquirir(); if (x)`). Y la
**indirección dentro del fichero**, por punto fijo sobre las funciones locales.

## Cobertura: medida, no supuesta

Nace de una lección reciente — **SCRUM-253 se cerró con la suite en verde y ningún test ejecutaba
su CLI**, así que su `ReferenceError` viajó a `main` sin que nada lo delatara (lo arregló SCRUM-258).
Por eso aquí no basta con ver verde. Medido **sobre esta misma base**:

```
node --test --experimental-test-coverage tests/scrum268-espera-automatica.test.mjs
  _espera-automatica.mjs | 100.00 líneas | 96.64 ramas | 96.00 funcs
```

## Límites declarados

- **Fuera del repo no se ve.** El esperador del incidente era un comando en segundo plano, no un
  fichero commiteado. Ningún guard de ficheros lo habría parado y este tampoco pararía al siguiente.
  Esa superficie necesita un hook `PreToolUse` y **no está construida**.
- **La indirección entre ficheros no se sigue** (bucle en A, adquisición en B).
- **La recursión con `setTimeout` que se auto-reprograma** no se detecta como repetición.
- Un bucle que adquiriera **sin dormir, sin cortar y sin condición atada** no caería — pero eso no
  es un esperador, es un bucle infinito de adquisiciones: un fallo distinto y ruidoso.
