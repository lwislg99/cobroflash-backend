# SCRUM-505 · El guard de RGPD vigila COLUMNAS, no CONTENIDOS

**Fecha:** 15-sep-2026 · **Carril:** RGPD · supresión · **Gate:** medición + guard (las 15 decisiones NO son de esta sesión)

**Medido contra:** `origin/main` = `42dff0218ec6bf5bafabc258b76b616e3080b62c` · 2026-09-15T14:29:50Z
**Rama:** `scrum-505-el-guard-que-mira-dentro`
**Preámbulo (A1):** `prisma generate` rc=0 · `npm run build` rc=0 ·
`git rev-list --count HEAD..origin/main` = **0** al ramificar.

> **Obligación 0:** sin rama remota, sin commit en `main`, sin expediente → causa **(a)**.
> Y la prueba directa: `CAMPOS_PERSONALES` (`src/modules/system/domain/anonimizarMerchant.ts:36`)
> **es un mapa modelo → nombres de columna**. Sigue mirando la etiqueta.
>
> ⛔ **Esta tanda mide y construye el guard. NO anonimiza ningún dato existente** ni decide
> ninguna de las quince: *«cada una es una decisión con base legal, no una tarea de sesión»*,
> y el ticket dice que **las deciden los dos fundadores**.
> ⛔ Todo el corpus es **fabricado**: ni producción, ni staging, ni un dato real de nadie.

---

## 1 · Es el mismo mecanismo, por tercera vez hoy

| ticket | de qué derivaba la identidad | qué no veía |
|---|---|---|
| SCRUM-854 | el **nombre de la rama** | el trabajo que viajaba dentro del PR |
| SCRUM-857 | íd., ampliado al asunto del commit | los tickets citados sólo de pasada |
| **SCRUM-505** | el **nombre de la columna** | **el dato personal escrito dentro del texto** |

> 🔒 **Un guard que mira la etiqueta no ve el contenido.**

---

## 2 · 🔴 EL TAMAÑO REAL NO ES 15: SON 128 CAMPOS DE TEXTO LIBRE

El **15** del ticket es el número de la familia *«la columna ES un dato personal»*. La otra
familia —*«texto libre que PUEDE contener uno»*— **no estaba contada**, y es la que el guard no
sabe mirar. Censado sobre el **DMMF** (no sobre el texto del `schema.prisma`: entre el fichero y
lo que la aplicación ve hay un `generate` que puede no haberse corrido):

```
MODELOS: 30
CAMPOS String: 195
  · de forma CERRADA (id, token, hash, url, estado…): 67
  · 🔴 TEXTO LIBRE: 128   <- el tamano real

DE ESOS 128:  cubiertos hoy por CAMPOS_PERSONALES: 11  ·  🔴 SIN CUBRIR: 117
```

**Control positivo:** los tres que el ticket nombra (`job.notes`, `quote.internalNotes`,
`expense.notes`) salen los tres. Si no salieran, el número no valdría.

### ⚠️ Y ese 117 está inflado — se dice en vez de defenderlo

Incluye campos de conjunto cerrado que el nombre no delata: `plan`, `country`, `ivaModo`,
`vfEstado`, `connectStatus`, `itemKind`… Afinarlo exigiría clasificar campo a campo **cuáles
admiten texto escrito por una persona**, y eso es exactamente lo que el propio ticket dice del
vocabulario jurídico: *«es una calificación, no una propiedad del texto»*.

> 🔴 **Por eso el detector no clasifica campos: mira el contenido de todos.** Si la pregunta «¿en
> cuál podría caber un dato personal?» no se puede derivar, la salida no es adivinarla — es no
> necesitar contestarla.

---

## 3 · El criterio se eligió MIDIENDO la tasa, no por intuición

*Un guard demasiado amplio acaba relajado.* Corpus fabricado: **25 textos de obra legítimos** (con
importes, NIF, fechas, referencias catastrales, números de factura y medidas — lo que más se
parece a un dato personal sin serlo) y **6 con un dato escondido**.

```
🔴 TASA DE FALSOS POSITIVOS:  1 de 25  =  4,0 %
     🔴 «Pedido 987654321 del proveedor…» -> telefono

TASA DE FALSOS NEGATIVOS:     0 de 6   =  0,0 %
SUELO: el detector ve 6 de 6 con dato dentro, así que una tasa baja significa algo.
```

### El único falso positivo es INHERENTE, y por eso queda fijado en un test

`987654321` es un número de pedido **y** tiene exactamente la forma de un móvil español (9
dígitos, empieza por 9). **No es arreglable con una expresión mejor**: las dos cosas son
indistinguibles sin saber qué significa el campo. Queda fijado en el control ⑤ para que, si algún
día deja de dispararse, alguien vaya a mirar si fue una mejora o un agujero.

### 🔴 Un hallazgo del propio banco: la primera medición estaba mal por MI corpus

La primera pasada dio **33 % de falsos negativos** y no era el detector: usé `telefonoDePrueba()`
—el **rango imposible** de la casa (SCRUM-262), que empieza por `34` a propósito para no
corresponder a ninguna línea real— y **por eso no tiene forma de móvil español**. Probar un
detector de móviles españoles con algo que no lo parece no prueba nada.

Corregido con una **secuencia ascendente trivial** (`612345678`), que es una *forma* y no la línea
de nadie. Y el caso del rango imposible se dejó dentro **a propósito**: su «no detectado» es
información — dice que el detector no salta sobre cualquier tirada larga de dígitos.

---

## 4 · Los controles

| # | control |
|---|---|
| ① | **SUELO**: hay formas que buscar y `CAMPOS_PERSONALES` se está leyendo de verdad |
| ② | 🔴 **EL QUE DECIDE**: un correo en `job.notes` cae, **nombrando tabla, fila y campo** |
| ③ | 🔴 **MUTACIÓN**: mirando sólo el nombre de la columna, el mismo correo es invisible |
| ④ | ✅ **POSITIVO**: los que el ticket nombra siguen sin cubrir — si uno pasara a estarlo, avisa |
| ⑤ | ✅ **NEGATIVO**: texto legítimo de obra no cae, con el falso positivo conocido fijado |
| ⑥ | el hallazgo dice **dónde** y **qué forma**, **nunca el dato** |

**⑥ no es un detalle de estilo.** Un guard que imprimiera en sus registros el correo que acaba de
encontrar lo estaría copiando a un sitio más — sería el problema que viene a resolver. El test
comprueba que el hallazgo serializado **no contiene** ni el correo ni el teléfono.

### 🔴 EL ROJO, sobre el árbol real

Apagada la mirada al contenido (`formasEnTexto` devuelve `[]`, que es el estado de partida):

```
not ok 2 - 🔴 ② un correo escondido en `job.notes` CAE, y dice dónde
    🔴 EL DEFECTO DE SCRUM-505 SIGUE: el correo escondido en un texto libre no se ve. Hallazgos: []
not ok 3 - 🔴 ③ MUTACIÓN: mirando sólo el NOMBRE de la columna, el correo es invisible
    🔴 mirando el contenido tiene que caer. Si no cae, la vía nueva no es lo que decide.
# pass 2 · fail 4
```

Fuente **restaurada byte a byte** (`Buffer.compare === 0`, 6113 = 6113).

---

## 5 · Lo que este detector NO ve, declarado

Un guard que no dice lo que se le escapa se lee como si no se le escapara nada:

* **correo enmascarado a mano** — `ana [at] obra.example`. El ticket ya avisaba de que el
  enmascarado de hoy «mide por forma». Cazarlo exigiría casar « at » entre palabras, y eso dispara
  sobre prosa normal: **se declara en vez de resolverse a medias**;
* teléfono escrito con letras;
* **nombres y apellidos** — no tienen forma reconocible, y casarlos sería adivinar;
* direcciones postales en prosa;
* un dato partido entre dos campos distintos.

---

## 6 · Lo que esta tanda NO hace, y de quién es

1. **Las quince decisiones siguen sin tomar**, y no las toma una sesión: `ANONIMIZA` / `BORRA` /
   `SE QUEDA con motivo` es una calificación con base legal. **De los dos fundadores.**
2. **No se ha anonimizado ni un dato existente.** Eso toca datos reales.
3. **El entregable que el ticket pide —atar `MERCHANT_DELETE_ENABLED` a que las quince estén
   decididas— no se ha construido**, porque el contenido de esa condición son las decisiones del
   punto 1. **Lo que este guard aporta es la mitad que faltaba para poder formularla**: para los
   campos de texto libre, el ticket dice que *«no basta con decidir: hay que decidir cómo se sabe
   que está limpio»* — y **esto es ese cómo**.
4. **El flag sigue OFF**, verificado hoy: `src/core/flags.ts:34` → `MERCHANT_DELETE_ENABLED: false`.
   El defecto no está sangrando; *el día que se encienda, sangra entero y de golpe*.

## 7 · Los bancos

`docs/master/evidencias/scrum505/censo-de-texto-libre.mjs` (+ `salida-censo.txt`) — el tamaño real,
con suelo y control positivo.
`docs/master/evidencias/scrum505/tasa-de-falsos-positivos.mjs` (+ `salida-tasa.txt`) — la tasa que
decidió el criterio, con su suelo y el control del rango imposible.
Ninguno necesita base de datos, ni red, ni credenciales.
