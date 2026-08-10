# SCRUM-297 (A7) · Exportar evidencias de cumplimiento

**Fecha:** 7-ago-2026 · **Carril:** A (núcleo fiscal)
**Medido contra:** `origin/main` = `12adc4a08fc65022ac705b898e259a1fcbc0f596` · 2026-08-07T10:45:56+02:00
(anclado con `git ls-remote`)
**Tanda:** 2101 tests · 2028 pass · **0 fail** · 73 skipped · `npm test` **`$? = 0`**
Los tests con base (297, 389, 295, 296) contra el banco local: **`$? = 0`**

## Qué pregunta contesta, y por qué no es ninguna de las dos que ya existían

* `portabilidadCompleta.ts` → «dame **todo lo mío**» (RGPD).
* `exportData.ts` → «dame mi **actividad**».
* **A7 → «demuestra que lo que declaraste PASÓ.»**

No construye mecanismo nuevo: **junta** cinco piezas que ya estaban en main — el Libro (A6), el
modelo 303 (A5), el verificador del sello (SCRUM-369), su barrido (SCRUM-371) y el
`quoteLineIndex` que ata cada línea entregada a su línea del presupuesto (SCRUM-367). Es **lectura
pura** (regla 38): el módulo no importa `prisma`, no compone números y no sella — no es una
promesa, es que no tiene con qué, y un guard lo comprueba sobre el AST.

## El paquete

`GET /admin/evidencias.zip?year=&quarter=` (admin-only), armado con `archiver`, que ya estaba en
el proyecto — **ninguna dependencia nueva** (regla 36).

| pieza | qué demuestra |
|---|---|
| `indice.csv` | el estado de un vistazo, un asiento por fila |
| `libro-registro.csv` | lo declarado, con su trazabilidad |
| `modelo-303.csv` | las casillas, **más lo que no está en ninguna** |
| `albaranes-verificacion.csv` | el sello recalculado, con su motivo si no cuadra |
| `entregas-por-linea.csv` | lo entregado atado a la línea del presupuesto (SCRUM-367) |
| `manifiesto.json` | SHA-256 de cada fichero: nadie lo ha tocado desde que se generó |

## El estado va en el ÍNDICE, y es el valor del verificador

Quien abre un ZIP mira el índice, no las 400 filas: **un estado enterrado en la fila 287 está
declarado y no está dicho**. La columna `estado_sello` lleva **exactamente** lo que devuelve el
verificador —`cuadra`, o su motivo (`hash_no_coincide`, `sin_evidencia`, `version_no_soportada`…)—
más `sin_albaranes`, que es un hecho, no una interpretación.

**Cero prosa.** Nada de «pendiente de», nada de calendarios, nada de la AEAT (regla 26). Un guard
sin base comprueba que el índice **no inventa estados** fuera del conjunto que el verificador
produce: traducirlos a prosa nuestra sería escribir un claim fiscal sin aprobar.

## 🔴 El paquete no recalcula ni arregla nada

Si el verificador dice que un sobre no cuadra, el ZIP **lo declara**: no lo corrige, no lo oculta
y no lo deja fuera. **Un paquete de cumplimiento que esconde lo que no cuadra es peor que no
tenerlo, porque quien lo entrega cree que entrega todo.**

Lo comprueban dos tests —uno contra Postgres con un sello roto de verdad, otro sin base— y el
guard de AST prohíbe en este módulo `create/update/delete`, `$executeRaw`, `allocateInvoiceNumber`
y **`computeAlbaranContentHash`**: recalcular el hash aquí sería una **segunda receta**, la que
acusa de manipulados a documentos intactos.

## Los controles

* **SUELO — el test de este ticket.** Si el exportador no encuentra ninguna factura habiendo
  alguna, **falla**: un ZIP vacío se entrega a un asesor o a una inspección y nadie pregunta por
  qué está vacío. Y el suelo del verificador viaja al paquete: `no_se_pudo_mirar` **no** es
  `todo_cuadra`.
* **Control negativo**, dos merchants contra Postgres, sin apoyarse en el guard de SCRUM-243
  (agujero conocido, SCRUM-348): ni una factura ni un albarán del otro, **en las dos direcciones**.
* **Control positivo ①** — el asiento con presupuesto **firmado** + albarán + cobro los lleva los
  tres, con `estado_sello = cuadra` y **cero huecos**. El sello del albarán se siembra con
  `computeAlbaranContentHash`, la función del sellador: ponerlo a mano habría medido mi error.
* **Control positivo ②** — la **factura suelta** (A0.5) sale igual, con sus huecos declarados uno
  a uno (`sin_presupuesto sin_albaran sin_cobro`) y `sin_albaranes` en el estado. Es el caso que
  se olvida, y dejarlo fuera convierte el ZIP en una prueba incompleta entregada como completa.
* **Un importe ilegible sale VACÍO, nunca `0,00`** — por eso el paquete no usa el `csvNum` de
  `exportData` (hace `Number(n ?? 0)`): un cero impreso afirma que esa factura no cobró nada.

## Verificado en rojo — tres, por `$?`, comiteado antes de cada inyección

| inyección | lo que dijo |
|---|---|
| **se quita una pieza** (el CSV de entregas) | sin base: *«le faltan piezas: entregas (entregas-por-linea.csv)»* · con base: *«el paquete no lleva «entregas-por-linea.csv»»* |
| **el paquete oculta lo que no cuadra** | *«el índice dice «cuadra» de un sobre que no cuadra»* |
| **el lector deja de filtrar por merchant** | *«se ha colado un ALBARÁN del otro merchant»* |

## Dos guards ajenos me corrigieron por el camino

* **SCRUM-237** — mi negación `!todo.includes('2026-XX-')` **no tenía hermano positivo**: si yo
  hubiera escrito mal el prefijo al sembrar, habría dado verde para siempre. Ahora se comprueba
  primero que el token **es alcanzable** (el paquete del OTRO sí lo lleva) y solo después que no
  está en el mío — y de paso el control negativo quedó medido en las dos direcciones.
* **Mi propio guard se cazó a sí mismo**: la lista de métodos prohibidos marcaba
  `crypto.createHash(...).update(...)` como escritura. Arreglado mirando la **raíz** de la cadena,
  no el nombre del método — quitar `update` de la lista habría sido «arreglarlo» dejando de
  vigilar lo que vino a vigilar.

## Lo que NO cubre — declarado

* **No hay pantalla ni entrada de menú.** Solo la ruta; dónde se ofrece y con qué copy es decisión
  de producto (regla 30). El índice va **sin frase que lo enmarque**: si hace falta una, es
  microcopy y la apruebas tú.
* **El ZIP no lleva los PDF ni el XML VeriFactu.** Son las piezas que el competidor sí mete. Aquí
  entran los datos y sus checksums, no los documentos renderizados; añadirlos es otro ticket (y
  toca `ensureInvoicePdf`, que está en el camino de emisión).
* **`lugarEntrega` no se selecciona** porque **no existe todavía** en el esquema (llega con
  SCRUM-300 / C5). El barrido tampoco lo lee, y `entradaDesdeFilas` lo resuelve a `null`, que es
  lo que se selló en los sobres v:1. **Cuando C5 entre hay que añadirlo aquí y en el barrido a la
  vez**, o los sobres v:2 se declararán manipulados.
* **Solo se verifican albaranes FIRMADOS del periodo.** Un albarán en borrador no tiene sello que
  comprobar; no aparece.
* **No hay AB6** — no hay superficie visual.
* **Sin caso de sobres v:2** (no existen aún) ni de facturas rectificativas en el paquete.

## Hallazgo de otro carril, ya reportado (regla 9)

`src/modules/jobs/app/routes/jobs.routes.ts:34` importa `calcVatBreakdown` y no lo llama. Sigue
sin tocarse: es zona roja y de otro carril.

## Ficheros

* `src/modules/fiscal/evidencias/paquete.ts` (nuevo) — el constructor puro.
* `src/modules/fiscal/evidencias/paquete.repo.ts` (nuevo) — junta las cinco piezas leyendo.
* `src/modules/fiscal/evidencias/evidencias.routes.ts` (nuevo) — `GET /admin/evidencias.zip`.
* `src/app.ts` · `src/core/http/adminOnlyRoutes.ts` — montaje admin-only y su 403 ejercido.
* `tests/scrum297-evidencias-postgres.test.mjs` (2, gateado por `LIBRO_PG_URL`) ·
  `tests/scrum297-paquete-piezas.test.mjs` (8, sin gate).

---

# TRAMO 2 — el aviso convertido en mecanismo

**Fecha:** 7-ago-2026 · **Medido contra:** `origin/main` = `d9a03de5d0dbe2eb3c371379db5c6eeddd2f5cb3`
· 2026-08-07T11:25:17+02:00 (anclado con `ls-remote`; A7 ya está en main)
**Tanda:** 2122 tests · 2049 pass · **0 fail** · 73 skipped · `npm test` **`$? = 0`**

En el tramo 1 dejé escrito un aviso: *«cuando C5 entre hay que añadir `lugarEntrega` aquí y en el
barrido a la vez, o los sobres v:2 se declararán manipulados»*. **Un aviso escrito en una entrada
no impide nada**: el día que C5 entre, nadie va a releer esta entrada. Esto lo convierte en rueda.

## Qué comprueba, y de dónde sale cada dato

Nada se escribe a mano — los tres extractores derivan de artefactos reales:

| dato | de dónde sale |
|---|---|
| las fuentes que el sellador mete en el hash | la **firma real** de `computeAlbaranContentHash` (AST del tipo del parámetro) |
| quién le da cada fuente al verificador | el objeto `contenido` de `entradaDesdeFilas` (AST) |
| qué columnas existen | `model Albaran` de `prisma/schema.prisma` |
| qué columnas trae el paquete | el `select` de `db.albaran.findMany` en `paquete.repo.ts` (AST) |

Y dos afirmaciones:

1. **Toda fuente del sellador la produce el adaptador.** Si el sellador gana una y nadie se la da,
   el hash se sella CON ella y se recalcula SIN ella → documentos intactos declarados manipulados.
2. **Toda columna del albarán que el adaptador vaya a leer, el paquete la selecciona** — pero
   **solo si existe en el esquema**.

## La rueda es esa condición

Hoy el adaptador ya lee `a.lugarEntrega` y la columna **no existe**: pedirla en el `select`
reventaría la consulta. Por eso no se exige… **hasta que aparezca en el esquema**. En cuanto C5 la
añada, el guard se pone rojo nombrándola, y no se apaga hasta que el paquete la seleccione.

El único hecho escrito a mano es `RENOMBRES = { obra: ['jobDireccion','lugarEntrega'] }`: la
traducción entre los dos nombres del mismo dato. No es la lista de fuentes —ésas se derivan—; es
lo que permite que el resto sea derivado, y está a la vista.

## No duplica el guard ⑥ de SCRUM-371 — MEDIDO, no supuesto

El ⑥ compara **cómo resuelve** cada fuente el adaptador frente al sellador; no lee ningún `select`
y su `PAREJAS` excluye `lugarEntrega` a propósito. Para no fiarme de la lectura, simulé C5
(la columna en el esquema) y corrí los dos:

```
con C5 simulado →  tests/scrum371-barrido-poblacion.test.mjs   $? = 0   (13 pass)
con C5 simulado →  tests/scrum297-fuentes-selladas.test.mjs    $? = 1
```

El de 371 **no lo caza**. Son dos afirmaciones distintas sobre el mismo camino y ninguna repite a
la otra.

## Verificado en rojo — los dos por `$?`

| inyección | lo que dijo |
|---|---|
| el sellador gana `coordenadasGps` en su firma | *«EL SELLADOR METE FUENTES QUE NADIE LE DA AL VERIFICADOR: coordenadasGps»* |
| **la rueda**: `lugarEntrega` aparece en el esquema (C5 simulado) | *«EL PAQUETE DE EVIDENCIAS NO SELECCIONA: lugarEntrega»* + *«SCRUM-300 (C5) ya está en el esquema…»* |

Con su suelo (si el derivador lee menos de 8 fuentes de la firma, **falla**: «cero fuentes» y «no
supe leer la firma» son el mismo verde, y aquí ese verde acusa de manipulación a documentos
intactos) y su control positivo (hoy, con las fuentes actuales, pasa, y se nombran una a una las
seis columnas que el paquete tiene que traer).

## Lo que NO cubre — declarado

* **Solo vigila el `select` DEL PAQUETE.** El `lectorPrisma` del barrido (SCRUM-371) tiene su
  propio `select` y **este guard no lo mira**: no quise duplicar el ⑥ ni meterme en su fichero
  (regla 9). Cuando C5 entre, el rojo de aquí recuerda las DOS cosas —el mensaje lo dice—, pero
  quien las ejecuta sigue siendo una persona. **Si quieres que el barrido también quede atado,
  es un ticket de una línea y va en su fichero.**
* **No comprueba que las columnas seleccionadas lleguen con valor**, solo que se pidan.
* **`RENOMBRES` es el punto ciego consciente**: si alguien renombra una fuente y actualiza ahí el
  alias sin tocar nada más, el guard sigue verde. Es el precio de que exista la traducción.

## Ficheros (tramo 2)

* `tests/scrum297-fuentes-selladas.test.mjs` (5, sin gate).
