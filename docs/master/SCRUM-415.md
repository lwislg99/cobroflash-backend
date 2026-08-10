# SCRUM-415 — el guard de evidencias vuelve a verde: la fixture declaraba una versión y sellaba con otra

**Medido contra:** `origin/main` = `50dcbc0be142e120683ecd19dfefed4ff2e6d95c` · 2026-08-10T14:48:36+01:00

**Fecha:** 10-ago-2026 ·
**Tanda:** 2474 tests · 2400 pass · **0 fail** · 74 skipped · `npm test` **`$? = 0`**
(así corre el CI: sin `LIBRO_PG_URL`, los dos tests de A7 se SALTAN)
**Tanda con banco:** `LIBRO_PG_URL` puesto → 2474 · **2407 pass** · **0 fail** · 67 skipped ·
**`$? = 0`**. Los siete que dejan de saltarse incluyen los dos de A7: es la única tanda en la que
este ticket queda realmente medido.

`tests/scrum297-evidencias-postgres.test.mjs` llevaba **rojo en `main`**, con el peor mensaje
posible para un paquete de cumplimiento: *«el sello del albarán sale como `hash_no_coincide`»*
sobre un albarán intacto. Lo detectó SCRUM-244 como hallazgo de otro carril y lo dejó reportado
sin tocar.

## La causa, y por qué el producto no tiene la culpa

C5 (SCRUM-300) subió el sobre del sello de albarán a **v:2** y dejó escrita la regla dura: la
versión **se LEE del dato**, nunca se supone. La fixture de A7 escribía:

```js
evidenciaFirma: { v: 1, canal: 'in_situ', hashAlg: 'sha256',
                  contentHash: computeAlbaranContentHash(fuentes) }   // ← sin versión
```

**DECLARA v:1 y SELLA con el defecto del sellador.** Mientras v:1 fue la única versión, los dos
eran el mismo número y nadie lo notó. En cuanto el defecto pasó a v:2, el sobre quedó declarando
una versión y llevando el hash de otra, y el verificador recalculó —correctamente— con la regla
de v:1.

> **El verificador está bien. El despacho por versión está bien. Mentía la fixture.**

## La pregunta que decidía el arreglo: ¿v:1 era intención o arrastre?

Si la fixture quería probar v:1, se sella con v:1 y se acabó. Si lo heredó, hay que subirla a v:2
**y añadir un caso de v:1**. **Es arrastre**, y está medido — no deducido del tono:

| evidencia | qué dice |
|---|---|
| `git show b312260d:src/…/albaran.service.ts` | cuando se escribió la fixture, `computeAlbaranContentHash` tenía **UN SOLO parámetro**: ni siquiera aceptaba `version` |
| el canónico de ese árbol | llevaba `v: 1` **fijo**, y `v: 2` no aparecía ni una vez |
| `git merge-base --is-ancestor b312260d f6901fb4` | la fixture es **ancestro** del commit que introdujo v:2 |
| `docs/master/SCRUM-297.md` | *«**Sin caso de sobres v:2** (no existen aún)»* — hueco **declarado** por su autor |
| el mismo doc | *«cuando C5 entre hay que añadirlo **aquí y en el barrido a la vez**»* |
| los otros dos sobres del fichero | también `v: 1`, uniformemente: el número es la época, no una elección por caso |

Cuando se escribió, **v:1 era la única versión que existía**: no había nada de lo que ser
«retro». Y el propio ticket dejó anotado que el caso de v:2 faltaba.

### Por eso NO se arregla con `computeAlbaranContentHash(fuentes, 1)`

SCRUM-244 lo propuso como «arreglo de una línea». Devuelve el verde, y deja el paquete **sin
ejercitar nunca contra la BD la versión con la que se firma de verdad** — justo el hueco que 297
había declarado. Es la opción cómoda: la que confunde «el test ya no se queja» con «esto está
comprobado».

## Qué se hizo

* El **asiento completo pasa a v:2** y estrena las cuatro columnas de C5 (`lugarEntrega`,
  `fechaEntrega`, `firmadoPorNombre`, `firmadoPorCalidad`).
* Se **añade un asiento v:1** con su propia factura (`…-003`) y **sin `lugarEntrega`** — un v:1
  es anterior a que esa columna existiera; ponérsela lo volvería un v:1 imposible que ya no
  representa a la población que dice representar. Las dos versiones conviven y **las dos cuadran**,
  que es exactamente lo que el despacho por versión promete y hasta ahora nadie comprobaba contra
  Postgres.
* `sellar(version, fuentes)` hace **imposible** el fallo original: de un único parámetro salen a
  la vez el `v:` del sobre y la versión del sellado, y `obra` la resuelve `obraSegunVersion` en
  vez de escribirse a mano (era eso lo que ataba el caso a v:1 sin decirlo).
* El CSV de verificación se afirma **por `version_sobre`**: «dos sobres cuadran» no distingue dos
  versiones de la misma repetida.

## El rojo ya no es mudo

Antes decía solo `hash_no_coincide`: verdad, y no sirve. Manda a quien lo lee a sospechar del
verificador, del contenido o de la fixture sin distinguir cuál, y **localizar que la causa era la
versión costó reconstruir el razonamiento entero**. Ahora el hash guardado se prueba contra cada
versión soportada **y las dos fuentes de `obra`** —el fallo histórico sellaba en v:2 con la `obra`
de v:1, así que probar solo «cada versión con su propia columna» no lo habría reproducido— y se
distinguen tres causas:

1. **discrepancia de versión** → la nombra con los dos números;
2. **receta congelada tocada** → el sellador reproduce el hash y el verificador no: los dos
   testigos discrepan, y el mensaje manda al diff de `albaranVerificacion.ts`;
3. **contenido cambiado** → dice que ahí no hay discrepancia de versión.

## Verificado en rojo — por el mecanismo, y con la inyección comprobada EN DISCO

Cada inyección se escribe con un script que **detecta** el salto de línea del fichero y **relee
del disco** para confirmar que llegó: un rojo que sale verde porque la mutación nunca se escribió
es indistinguible de un rojo superado.

| inyección | `$?` | lo que dijo |
|---|---|---|
| **el bug literal de `main`**: declara `v:1`, sella con el defecto | 1 | *«DISCREPANCIA DE VERSIÓN: el sobre DECLARA v:1 pero su contentHash se SELLÓ con v:2 —tomando «obra» de `Job.direccion`—… El verificador está BIEN… Lo que miente es la FIXTURE»* |
| **la inversa**: sella `v:1`, declara `v:2` | 1 | *«DISCREPANCIA DE VERSIÓN: el sobre DECLARA v:2 pero su contentHash se SELLÓ con v:1…»* |
| **interrogar al caso nuevo**: romper la receta de **v:1** (una clave de más en el canónico compilado) | 1 | *«la versión NO es el problema: el SELLADOR sí reproduce este hash en v:1… y aun así el VERIFICADOR dice que no cuadra… o alguien ha tocado la receta de v:1 —CONGELADA justo para que esto no pase—»* |

La tercera es la que demuestra que el asiento v:1 **no es decorativo**: caza una rotura de la
receta congelada, que es la población que nunca se había ejercitado contra la BD. Y el
diagnóstico **discrimina** — no grita «versión» cuando la versión no es la causa.

**Retrocompatibilidad medida:** `tests/scrum369-verificador-sello.test.mjs` **20/20**, incluidos
*«los vectores de v:1 siguen CONGELADOS»* y *«v:1 y v:2 NO son intercambiables»*.

## Lo que NO se ha tocado (regla 38)

**El diff es UN SOLO fichero de tests.** No se toca el verificador, ni el despacho por versión de
C5, ni `computeAlbaranContentHash`, ni el camino de emisión. Los `import` de
`obraSegunVersion`, `ALBARAN_CONTENIDO_VERSION_ACTUAL` y `versionesSoportadas` son **exports
públicos ya existentes** y se usan solo para LEER.

## Lo que NO cubre — declarado

* **Sigue gateado por `LIBRO_PG_URL`**: sin banco, los dos tests se saltan y el CI no los ejecuta.
  Este ticket devuelve el verde y añade la cobertura de v:2, **no** desgatea el fichero — eso es
  infraestructura de CI y es otro ticket.
* **Solo v:1 y v:2.** El día que exista un v:3, este fichero necesita su asiento: el guard
  `scrum369` obliga a que la receta exista, pero **no** obliga a que el paquete de evidencias la
  ejercite contra la BD. Queda dicho aquí porque es el mismo arrastre que causó este ticket, una
  versión más tarde.
* **No se ha tocado `docs/BUGS.md`**: no era un defecto de producto (el verificador siempre estuvo
  bien), sino de una fixture, y ya estaba reportado en `docs/master/SCRUM-244.md`.

## El CI se puso rojo por ESTA entrada, y el motivo es de proceso

Con el arreglo ya verde, el CI de la rama falló. No por la fixture: por este mismo fichero.

```
✖ SCRUM-267 · toda entrada NUEVA del registro declara contra qué main se midió, y cuándo
  actual: [ 'SCRUM-415.md — no declara «Medido contra»' ]
```

El ancla estaba escrita, pero detrás de `**Fecha:**` y partida en dos líneas, y `RE_ANCLA` la
exige **al principio de su propia línea y entera**. El guard tenía razón: un ancla que no se puede
parsear no sirve para saber si la medición caducó, que es para lo único que existe.

**Por qué no salió antes:** la última tanda completa de la sesión se corrió ANTES de escribir esta
entrada, y después de crearla se commiteó sin volver a correrla. El fallo no fue del guard ni del
entorno — **fue no repetir la tanda tras añadir el último fichero**. Reproducido en local al primer
intento, lo que además descarta que dependiera del entorno de CI.

## Ficheros

* `tests/scrum297-evidencias-postgres.test.mjs` — único fichero de código tocado.
* `docs/master/SCRUM-415.md` (nuevo) — esta entrada.

## Banco de pruebas usado

PostgreSQL 16.4 **portable** en el scratchpad (mismo procedimiento que SCRUM-296), cluster propio
en **127.0.0.1:55432**, base `yaqu_libro_test`. Esquema generado con el CLI **local** 6.18.0
—nunca `npx` (SCRUM-385)— con `migrate diff --from-empty --to-schema-datamodel`, **verificado no
vacío antes de aplicarlo**: 731 líneas, 24 `CREATE TABLE`, **cero `DROP`**. Ninguna base del
proyecto fue tocada.

---

# SCRUM-415 (2ª entrada, sesión 1) · el diagnóstico, en el PRODUCTO y no solo en el test

**Fecha:** 10-ago-2026 · **Carril:** fiscal (verificación, solo lectura) · **Gate:** los tests del
verificador corren en `npm test`; el del paquete va tras `LIBRO_PG_URL` (banco desechable)
**Medido contra:** `origin/main` = `8159ee4a200c1623493402ecca0bff57b0ca814c` · 2026-08-10T15:36:08+02:00
**Entregado:** 2026-08-10T15:36:08+02:00

## El rojo, y por qué había que quitarlo antes que nada nuevo

`tests/scrum297-evidencias-postgres.test.mjs` llevaba días en rojo. Un rojo permanente en el guard
de la rueda es la vía más rápida a que alguien lo apague — y con él se iría la protección que
impide que el paquete de evidencias **acuse de manipulados a albaranes intactos**.

## La pregunta que decidía el arreglo: ¿la fixture QUERÍA v:1, o lo heredó?

**Medido, no supuesto.** La fixture nació en `b312260d` (7-ago) con `v: 1` escrito a mano y
`computeAlbaranContentHash(fuentes)` **sin versión**. En ese árbol, `ALBARAN_CONTENIDO_VERSION_ACTUAL`
**no existe**: la constante y el despacho por versión los estrenó SCRUM-300 (`f6901fb`) **ese mismo
día, más tarde**.

Conclusión: el `1` **no fue la decisión de probar v:1** — era el único número que había. Es
arrastre. Así que, siguiendo tu criterio: **se pasa a la versión de hoy Y se añade un caso v:1.**

## Lo entregado

**① La fixture sella con la versión de HOY, tomada de la CONSTANTE.** No de un literal `2`: poner
el número a mano volvería a romperlo el día que exista v:3, que es exactamente lo que pasó aquí.
El albarán estrena los tres campos de v:2 (`lugarEntrega`, `fechaEntrega`, `firmadoPor*`) y su
`obra` sale de `lugarEntrega`, que es la fuente de v:2.

**② Un albarán v:1, sellado explícito con `computeAlbaranContentHash(fuentesV1, 1)`** y su `obra`
desde `Job.direccion`. El despacho por versión existe para que **los dos** verifiquen: los sellos
v:1 son los de producción, están firmados y **no se pueden rehacer** (regla 29). Con un solo caso,
el paquete podría estar recalculando siempre con la receta de hoy y dar verde igual — y el día que
v:1 dejara de verificar, nadie se enteraría hasta que lo mirase un inspector.

**③ El diagnóstico: motivo nuevo `hash_de_otra_version`.** Antes de acusar, el verificador prueba
las **otras** recetas; si el hash cuadra con una de ellas, el veredicto ya no es «EL CONTENIDO YA
NO ES EL QUE SE FIRMÓ» sino *«el sobre declara v:1, pero su hash es EXACTAMENTE el que da la receta
de v:2 … se corrige la VERSIÓN de la fila, nunca el hash»*.

Con dos versiones vivas, «el hash no cuadra» tiene **dos causas de gravedad opuesta**: *investiga
una falsificación* y *arregla el número de versión de esa fila*. Salían por el mismo sitio y con el
mismo texto, y eso es lo que costó media mañana.

**④ La tenencia se comprueba por NOMBRE, no solo por número.** El control decía
`albaranesExaminados === 1`; con dos albaranes míos pasa a 2, y un `2` a secas lo daría igual un
albarán mío más uno ajeno. Ahora además se comprueba que los examinados son **exactamente** los dos
míos.

## Rojos probados (por el mecanismo)

| Inyección | Cae | Lo que demuestra |
|---|---|---|
| se vuelve a poner `v: 1` sellando con el defecto (**el defecto original**) | el control del paquete, ahora diciendo `hash_de_otra_version` | el diagnóstico nombra la discrepancia de versión |
| se quita el sondeo de las otras recetas | `un sobre que declara v:1 con hash de v:2 se NOMBRA, no se acusa` | sin el sondeo vuelve el `hash_no_coincide` que acusa en falso |

Y el **control que decide**, en verde y probado: **una manipulación de verdad sigue saliendo como
`hash_no_coincide`**, con su acusación explícita intacta. Sin ese control, el motivo nuevo podría
estar tragándose también las alteraciones reales — *un verificador que suaviza las falsificaciones
es peor que no tenerlo*.

Además, el **suelo**: el recetario tiene que despachar ≥2 versiones **y** dar hashes distintos
sobre las mismas fuentes. Con una sola versión viva, «declara v:X y su hash es el de v:Y» no puede
ocurrir y todo el fichero pasaría sin medir nada.

## Lo que NO se ha tocado, dicho

- **El SELLADOR no se toca.** Todo el cambio de `src/` está en `albaranVerificacion.ts`, que
  **recalcula para comparar y nunca reescribe**. Ni un hash guardado, ni una fila sellada
  (reglas 29 y 38: leer el camino de emisión no es STOP; modificarlo sí, y aquí no se modifica).
- **Ninguna base real.** El control del paquete corre contra el banco desechable (loopback, base
  terminada en `_test`, fail-closed). El banco se reconstruyó desde `schema.prisma` con el binario
  **local** (`./node_modules/.bin/prisma`, nunca `npx` — SCRUM-385) porque iba por detrás de main.
- **El CSV de verificación NO cambia de formato.** Se valoró añadirle una columna `mensaje`, y no
  se hizo: es un entregable de cumplimiento y cambiarle las columnas es decisión tuya, no mía. El
  motivo ya nombra el caso, y el mensaje completo queda disponible para quien llame al verificador.

## Un error mío, anotado porque es el de la regla que yo mismo repito

Inyecté el rojo del verificador **antes de comitear la corrección**, y al revertir con
`git checkout --` me llevé por delante el cambio sin commitear. Tuve que reaplicarlo entero. La
regla —*la corrección se comitea ANTES de inyectar el siguiente rojo*— no es ceremonia, y esta vez
el que se la saltó fui yo.
