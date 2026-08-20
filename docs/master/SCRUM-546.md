# SCRUM-546 · dos guards de navegador sobre la misma página: medidos antes de decidir

**Medido contra:** `origin/main` = `6ec0e44fc2c79f926dcbef5da6b8615af24034eb` · 2026-08-20T03:23:02+01:00

**20-ago-2026** · **Carril:** tooling / landing · **Gate:** el censo y los guards van fuera de `npm test`

**LA VÍCTIMA:** dos guards escritos con dos días de diferencia levantan navegador sobre la misma
página, y ninguno de los dos encargos sabía del otro. *Dos guards que miden lo mismo no se quedan
iguales: se desincronizan, y cuando uno cae y el otro no ante el mismo defecto, el que sobra es el
que alguien desactiva.*

---

## ① El conflicto, y su resolución

`package.json` chocó en el bloque de guards: `guard:cls-barra-anuncio` (SCRUM-544, esta rama) y
`guard:primera-pantalla` (SCRUM-331, ya en `main`) aterrizaron en el mismo punto.

**Resuelto conservando los dos**: los cuatro elementos —los dos `//comentario` y los dos comandos—
quedan en el fichero, con una línea añadida a cada comentario que dice que el otro existe y por qué,
citando este ticket. **JSON válido**, comprobado con `JSON.parse`.

**Y el merge no tocó nada más:** el único fichero en conflicto fue `package.json`.
`public/index.html` automergeó limpio conservando las dos partes —la reserva `.announce[hidden]` de
esta rama y lo que entró en `main` con F4, F7, SCRUM-541 y SCRUM-537— con **0 marcadores de
conflicto**.

## ② La tabla de solape, con tiempos

| | `guard:primera-pantalla` | `guard:cls-barra-anuncio` |
|---|---|---|
| **coste** | **6,2 s** | **15,9 s** |
| cargas | 2 casos × 2 anchos = **4** | 3 casos × 2 anchos = **6** |
| casos del contador | vendidas · roto | vendidas · **cero** · roto |
| **JUZGA** (hace fallar) | que con la fuente **rota** no se pinte ningún número · que haya **un** solo héroe visible · scroll horizontal | el **salto**: falla si el CLS pasa de 0,1 · scroll horizontal |
| mide pero **no** juzga | CLS · LCP/FCP · objetivos táctiles | — |
| suelo propio | Edge inalcanzable → CIEGO | **no leer el CLS → «NO SUPE MIRAR» (código 2)** |
| solo lo tiene éste | objetivos táctiles · conteo de héroes visibles | el caso **`cero`** · el desglose de saltos |

**Lo compartido, medido de sus propias descripciones:** Edge vía puppeteer-core · 4G emulada · 360 y
390 px · servidor propio con el `http` de Node · los dos sirven `/public/founding-status` roto.

## ③ La decisión: SE QUEDAN LOS DOS — y el motivo no es que se parezcan

**Juzgan cosas distintas: uno el DATO y otro el SALTO.** Fusionarlos daría un guard que falla por
una y se lee como si fallara por la otra — que es exactamente lo que el encargo prohibía.

**Y no es una opinión: se comprobó inyectando los dos defectos POR SEPARADO**, con la rama ya
commiteada en `6bd8e017` y el árbol limpio.

| inyección | `guard:cls-barra-anuncio` | `guard:primera-pantalla` |
|---|---|---|
| **① se quita la reserva del CLS** | 🔴 **cae (exit 1)** nombrando el CLS: `vendidas 360 px · CLS 0.386` · `390 px · 0.108` · `cero 360 px · 0.133` | 🟢 verde (exit 0) |
| **② con la fuente rota, la barra se enseña igual** | 🟢 verde (exit 0) | 🔴 **cae (exit 1)**: `control negativo · escasez de plazas: 🔴 VISIBLE con la fuente rota: «·quedan – plazas»` |

**Cada defecto lo caza uno solo, y lo nombra.** Un guard fusionado habría dado un rojo para los dos
casos y habría perdido justo esa información. Las dos inyecciones revertidas con la edición
inversa; los dos guards verdes otra vez.

## ④ 🔴 Y el solape destapó un defecto en uno de los dos — es lo que más vale del ticket

`guard:primera-pantalla` servía, en su caso «la fuente responde», **`{seatsLeft: 7}` SIN el campo
`taken`**. Y la landing solo pinta la escasez si `taken > 0` (`pintarPlazas`).

**Consecuencia: la escasez tampoco salía en el caso vivo.** Su control negativo comparaba **OCULTA
contra OCULTA**, así que **habría pasado en verde con el detector roto** — el guard no podía
distinguir «lo oculta bien» de «no sé mirar». Le faltaba el control positivo, y nadie lo habría
visto sin poner los dos guards uno al lado del otro.

**Arreglado a coste cero:** ahora sirve una venta real (`taken: 2`, quedan 18) y **exige que el
número SE VEA** — mismos dos casos, mismas cuatro cargas, 6,2 s igual. Medido después:
`control positivo · escasez con la fuente viva: VISIBLE con número ✔ («·quedan 18 plazas»)`.

## ⑤ El número que le faltaba a SCRUM-522

`npm run censo:guards-navegador` — **medido hoy, no estimado:**

> ### SIETE guards de navegador · **45,9 s en serie** · los siete en verde

| guard | s |
|---|---|
| `guard:cls-barra-anuncio` | **15,9** |
| `guard:contraste` | 7,5 |
| `guard:vias-de-cobro` | 6,4 |
| `guard:primera-pantalla` | **6,2** |
| `guard:aviso-bizum` | 4,9 |
| `guard:caja-avisos` | 2,9 |
| `guard:a11y-comparativa` | 2,2 |

**Los dos de este ticket suman 22,1 s: el 48 % del total.** Y `cls-barra-anuncio` es el más caro de
los siete, por más del doble que el segundo — es el precio de medir tres casos en vez de dos, y
queda dicho para que quien lo revise sepa qué está pagando.

🔸 **Y son SIETE, no seis.** El encargo hablaba de seis: SCRUM-541 añadió `guard:a11y-comparativa`
mientras esto se escribía. **Es exactamente el motivo por el que hacía falta un censo** — la cuenta
de memoria caducó en dos días.

**El censo (`scripts/censo-guards-navegador.mjs`):** la autoridad es `package.json`, **no** el
directorio, porque *lo que existe es lo que alguien puede ejecutar*; un fichero que nadie declara no
es un guard, es código. **SUELO:** si un `guard:*` declarado no tiene su fichero en el disco, **falla
declarándose CIEGO** en vez de dar un total más bajo — un total que no cuadra con lo declarado se
lee como «cuestan poco», que es la conclusión contraria a la verdad.

## ⑥ Ficheros

`package.json` (resolución + las dos referencias cruzadas + el censo) ·
`scripts/censo-guards-navegador.mjs` (nuevo) · `scripts/guard-primera-pantalla.mjs` (el control
positivo que le faltaba).

**Lo que NO se toca:** ninguno de los otros cinco guards de navegador · el texto de la barra ·
`founding.ts` · la landing (más allá de lo que ya traía el merge).

## ⑦ Tanda

**3.765 tests · 3.688 pass · 0 fail · 77 skipped.**
