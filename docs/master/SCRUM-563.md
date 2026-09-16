# SCRUM-563 · El registro de lo aprobado — con el texto literal, no con una descripción

**Medido contra:** `origin/main` = `23d06e354ddd4007706785ec3f69a5417d055bd3` · 2026-08-20T20:10:00+01:00

> ⚠️ Esa hora es la del trabajo de esta rama, no una lectura de reloj — mismo criterio R14.

**20-ago-2026** · **Carril:** B (landing) · **Gate:** sin gate, corre en `npm test`

**Alcance:** un módulo, un generador, un documento generado y un test. **No se aprueba nada: se
registra lo ya decidido.** No se toca ningún `hidden`, ningún marcador, ningún texto de
`#heroe-f4`, `#gremios` ni `#comparativa`, ni `scripts/censo-anclas-bloque-f.mjs` (S1 está en
SCRUM-558), ni `scripts/censo-etiquetas-pegadas.mjs` (S1, SCRUM-553).

---

## ⓪ La aritmética, cuadrada — la mía primero

**Mi propio informe tenía un error, y no es el que se sospechaba.** Escribí *«8 nodos en
`#heroe-f4`, 13 en `#gremios`, 4 en `#comparativa`»*. Lo correcto es **3 · 13 · 4 = 20**: puse la
columna «nodos de texto» (8) donde iba la columna «fuera del esquema» (3).

🟢 **No eran los duplicados.** «Tu método actual» y «Con YaQu» aparecen dos veces en el marcado,
pero cuentan **una vez cada uno** dentro de los 20; no explican ninguna diferencia.

🟢 **Y el error se quedó en el chat: los artefactos siempre dijeron 3.**
`docs/master/SCRUM-561.md:59`, `docs/MICROCOPY_FUERA_DEL_ESQUEMA.md:142` y el trinquete de
`tests/scrum561-…:33` llevan `fuera: 3`. Nada citado en los dos tickets hay que corregirlo.

**Y la otra, la del encargo: son 41, no 42.** «Los 38 del esquema» + «los 4 de F7», pero **uno de
los cuatro de F7 ya está entre los 38**: `contacto-publico/h2#1` es un `<h2>`, o sea unidad del
esquema. Los otros tres viven en atributos. **38 + 3 = 41 textos distintos.** No falta ninguno:
sobraba un recuento.

---

## ① El defecto, en una línea

Había un documento de **propuesta** (51 textos) y marcadores que dicen «pendiente». **No había
ningún sitio que dijera «aprobado, esta fecha, ESTO exactamente».**

> No es burocracia: en un solo día hizo nacer tres tickets sobre una premisa falsa. El último
> —SCRUM-561— decía que 20 textos eran inéditos cuando los 20 estaban en un documento del árbol.

## ② Lo entregado

`scripts/_registro-de-lo-aprobado.mjs` guarda **41 entradas**: identificador derivado, **texto
literal**, vía (elemento o atributo), fecha y quién.

🔴 **El texto literal es el requisito, no un detalle.** Una descripción («el titular del héroe»)
no puede contestar *«¿este texto de hoy es el que se aprobó?»*. El texto sí, con `Buffer.compare`.

Los 41 se **generaron del marcado**, no se copiaron a mano: 41 textos con tildes y flechas
copiados a mano es la forma más fácil de meter una errata que mañana se lee como «el texto cambió».

### La caducidad es el mecanismo de SCRUM-551, copiado

Allí el registro de anclas guarda el texto de cada frase, y si alguien la reescribe **el ancla
caduca sola**. Aquí igual: la aprobación va atada al texto literal.

```
🔴 CADUCADA · gremios[fontaneria]/h3#1 — aprobado el 2026-08-20 por fundador
   se aprobó: «Fontanería»
   hoy dice : «Fontaneria»
```

Y `SIN ANCLAJE` se separa de `CADUCADA` a propósito: el texto puede seguir aprobado y ser el
**marcado** el que se movió. Mezclarlos haría que un cambio de estructura pareciera copy nuevo.

⚠️ **Escrito y no disimulado:** el identificador lleva **ordinal**, así que quitar o meter una
unidad en medio de un grupo **renumera** las siguientes y el informe habla de varias «caducadas»
cuando ha habido un corrimiento. No es un fallo del mecanismo: el ordinal es lo que distingue dos
frases idénticas en sitios distintos —«Tu método actual» está seis veces— y sin él no habría
identificador. Lo que importa es que **el cambio no pase en silencio**, y hay un test que lo
ejercita.

## ③ 🔴 Los tres estados — el tercero es el que no existía

| estado | cuándo | ejemplo medido |
|---|---|---|
| `APROBADO` | su texto está en el registro, byte a byte | «Del presupuesto al cobro, sin salir de WhatsApp.» |
| `PENDIENTE` | vive dentro de una sección con marcador | «El ERP por WhatsApp para los oficios» |
| `NI_UNA_COSA_NI_OTRA` | ni registrado ni marcado | «Seis herramientas. Una sola app.» |

⚠️ **El marcador es de la SECCIÓN**, así que alcanza a todo lo de dentro y no sólo a las unidades
del esquema. Por eso «Tu oficio» —un `<span>`— sale `PENDIENTE` y no el tercer estado. Preguntar
sólo por unidades habría reproducido el punto ciego que midió SCRUM-561.

🔴 **Y lo que aparece al poder preguntar:** la mayor parte del copy **PUBLICADO** —`#como`,
`#todo`, `#precios`, `#probar`, `#faq`— es `NI_UNA_COSA_NI_OTRA`. Nadie lo aprobó y nadie lo marcó
como pendiente. **No es un fallo nuevo: es que hasta hoy no había dónde decirlo.**

```
node scripts/registro-de-lo-aprobado.mjs --estado "Seis herramientas. Una sola app."
  → NI_UNA_COSA_NI_OTRA
```

## ④ 🔴 El tercer grupo: lo que ninguna aprobación cubre — son SIETE

Cruce de las **51** entradas del documento de propuesta con el registro, por bytes:

| | |
|---|---|
| cubiertas exactamente | **28** |
| las mismas palabras, **partidas de otra manera** | **16** |
| 🔴 **sin cubrir por ninguna aprobación** | **7** |

**Ni 13 ni 23.** El «13» del encargo es un número mío leído al revés: eran los textos *aprobados
que no están en el documento*, no al contrario. Y 23 sale de no separar el segundo grupo.

Las **siete**: `F4-1` «El ERP por WhatsApp para los oficios» · `F4-4` «Probar la demo» · `F4-5`
«Empieza gratis» · `F5-1` «PROPUESTA · La diferencia» · `F5-4` «La situación» · `F6-1` «Tu
oficio» · `F6-6` «Empezar gratis →».

Son **rótulos, etiquetas de botón y cabeceras de columna** — justo lo que el esquema
`h1|h2|h3|p|li` no alcanza. **Y una de ellas dice qué ES el producto.**

Las **16 «partidas de otra manera»** no son aprobaciones que falten: las palabras están aprobadas
dentro de una unidad más larga («Tu palabra contra la suya.» vive en «Tu método actual Tu palabra
contra la suya.»). El documento separa lo que el extractor junta — territorio de SCRUM-553. Se
listan para que nadie las cuente dos veces ni las dé por inéditas.

## ⑤ Dónde vive, y por qué ahí

En un **módulo**, no en un comentario del HTML. Un comentario no lo lee ningún test — y fue justo
un comentario del HTML el que estuvo a punto de dejar mal registrado lo de F7: decía una cosa, el
encargo decía otra, y se resolvió por suerte. El módulo es la fuente; el documento
(`docs/REGISTRO_DE_MICROCOPY_APROBADA.md`) es la vista para leer, **generada**, y un test
comprueba que no se queda vieja.

⛔ **No se ha inventado ningún marcador.** No hay `data-microcopy="APROBADO"` ni nada parecido: los
estados salen del máster. Lo aprobado se sabe por el registro, y **un test vigila que no aparezca
un valor nuevo** en el marcado.

## ⑥ Verificación

**SUELO** — el registro vacío se declararía ciego («son 41»), y el generador **revienta** en vez de
escribir un documento que dijera «no hay nada aprobado».

**CALIBRACIÓN** — mi extractor y el censo de S1 devuelven los **mismos identificadores y los
mismos textos** donde se solapan (17/17). Sin eso, las comparaciones no valdrían nada.

**CONTROL POSITIVO** — sin tocar nada: **41 vigentes, 0 caducadas, 0 sin anclaje**. Si saltara con
todo sería ruido y acabaría desactivado.

**ROJO POR EL MECANISMO** — sobre `36bb96b7c85a3fef29250954bea2d07d0143a723`, con el fichero
verificado idéntico al **blob** antes de empezar:

| inyección | ¿cae? | qué dice el CLI |
|---|---|---|
| una letra («trabajo.» → «trabajos.») | 🔴 sí | `CADUCADA · comparativa[firma]/p#1 — aprobado el 2026-08-20` |
| una tilde («Fontanería» → «Fontaneria») | 🔴 sí | `CADUCADA · gremios[fontaneria]/h3#1 — …` |
| el texto de un atributo (F7-2) | 🔴 sí | `CADUCADA · contacto-publico@data-wa-etiqueta — …` |
| inventar `data-microcopy="APROBADO"` | 🔴 sí | cae el test que vigila los valores del máster |

Las cuatro veces la landing volvió **byte a byte contra el blob**, y al terminar `git status` de
la landing sale **limpio**. Nunca se usó `git checkout --`.

**Tanda completa:** **3858 tests · 3781 pass · 0 fail · 77 skipped**.

## ⑦ De camino

🟠 **El censo de SCRUM-553 volvió a contar como extractor un HTML literal** — esta vez dos, en una
línea con `.replace()` que sólo llevaba dato de prueba. **No se ha tocado su tope**: los literales
van en constantes con el motivo al lado. Es la segunda vez que aparece el mismo falso positivo, y
ya está reportado en su ticket. **Para S1: el heurístico mira el argumento de reemplazo igual que
el de búsqueda.**

## ⑧ Lo que queda abierto — no es de este ticket

⬜ **El copy publicado que es `NI_UNA_COSA_NI_OTRA`.** Ahora se puede preguntar y se puede contar.
Decidir qué se hace con él —aprobarlo, marcarlo o dejarlo— es del fundador.

⬜ **Las siete sin cubrir.** Están citadas en `docs/MICROCOPY_FUERA_DEL_ESQUEMA.md` con su texto
literal. Este ticket no las aprueba.
