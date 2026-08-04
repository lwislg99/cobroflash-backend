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
