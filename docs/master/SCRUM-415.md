# SCRUM-415 · el guard de la RUEDA vuelve a verde, y el diagnóstico deja de mentir

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
