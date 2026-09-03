# Microcopy APROBADA por el fundador, pendiente de aplicar

**Aprobada:** 17-ago-2026 (regla 30) · **Estado: aplicado todo lo de las tandas A–E.**

> ⚠️ **El sello «TODO APLICADO» se corrige el 19-ago-2026.** Era cierto para lo aprobado hasta el
> 17, y dejó de serlo el día que el fundador desaparcó parte del **Libro registro** (abajo). Un
> sello que no se revisa es la siguiente mentira de la fuente única.

> 🔴 **13 marcadores siguen vivos y NO son un descuido: son los fiscales y aparcados.** Y ojo con
> compararlo con el 38 del censo, porque **miden cosas distintas**: el censo cuenta **superficies
> pintadas** y esto cuenta **marcas escritas**. Una sola marca de `libroRegistroView` pinta **23**
> rótulos. Los dos números son correctos — si alguien ve «13» donde esperaba «38», no hay nada que
> investigar.

**Base del censo:** `origin/main` = `a241b6e48c6553e453375bf705ca76ac3045ac0d`
**De dónde salen las líneas:** `docs/CENSO_MICROCOPY_PENDIENTE.md`

> ⚠️ **Los textos van LITERALES**: tildes, mayúsculas y puntos suspensivos de **un solo carácter**
> (`…`, no `...`). Al aplicarlos se copian tal cual — retocar uno «de paso» es reabrir una
> aprobación sin que nadie se entere.
>
> ⚠️ **Las líneas son las de la base de arriba.** Si el fichero se ha movido, se localiza el rótulo
> por su contenido, **no** por el número de línea.

---

## Bloque 1 · Detalle de factura — `public/dashboard/js/invoiceDetailView.js`

| Línea | Qué es | Texto aprobado |
|---|---|---|
| 273 | Botón | `Descargar PDF` |
| 282 | Botón | `Enviar por WhatsApp` |
| 363 | Botón | `Marcar como cobrada` |
| 448 | Botón | `Ver la reclamación del banco` |
| 472 | Botón | `Cobrar por Bizum` |
| 513 | Botón | `Enviar recordatorio de pago` |
| 550 | Botón | `Emitir factura rectificativa` |
| 640 | Botón | `Volver a generar el PDF` |

## Bloque 2 · Nueva factura (modal) — `public/dashboard/js/nuevaFacturaModal.js`

| Línea | Qué es | Texto aprobado |
|---|---|---|
| 53 | Título del modal | `Nueva factura` |
| 53 | Botón ✕ | `Cerrar` |
| 44 | `aria-label` del diálogo | `Crear una factura nueva` |
| 77 | Placeholder | `Busca por nombre…` |
| 78 | `aria-label` | `Buscar cliente por nombre` |
| 85 | `aria-label` | `Cliente al que facturas` |
| 97 | Opción vacía | `Selecciona un cliente…` |
| 108 | Error | `No hemos podido cargar tus clientes. Inténtalo otra vez.` |
| 134 | Placeholder | `Trabajo o material` |
| 135 | `aria-label` | `Concepto de la línea` |
| 140 | Placeholder | `Cantidad` |
| 141 | `aria-label` | `Cantidad de unidades` |
| 146 | Placeholder | `Precio sin IVA` |
| 147 | `aria-label` | `Precio por unidad, sin IVA` |
| 152 | Placeholder | `IVA %` |
| 153 | `aria-label` | `Tipo de IVA en porcentaje` |
| 159 | `aria-label` del ✕ de la línea | `Quitar esta línea` |
| 169 | Botón | `Añadir línea` |
| 179 | Botón secundario | `Cancelar` |
| 212 | Estado del botón principal | `Emitiendo…` |
| 216 | Aviso | `Factura emitida` |
| 221 | Error | `No hemos podido emitir la factura. Inténtalo otra vez.` |

## Bloque 3 · Presupuesto

### `public/dashboard/js/quotesView.js`

| Línea | Texto aprobado |
|---|---|
| 352 | `1. Cliente` |
| 360 | `2. Líneas` |
| 368 | `3. Condiciones` |
| 376 | `4. Envío` |

### `public/dashboard/js/quoteActionsRegistry.js`

| Línea | Texto aprobado | |
|---|---|---|
| 64 | `Enviar a aprobación` | |
| 65 | `Enviar al cliente` | |
| 66 | `Aprobar` | |
| 67 | `Enviar recordatorio` | **cambiado** (era «Recordar al cliente») |
| 68 | `Crear trabajo` | |
| 69 | `Duplicar` | |
| 70 | `Descargar PDF` | **cambiado** (era «PDF») — igualado con factura |
| 71 | `Editar líneas` | |
| 72 | `Enviar por WhatsApp` | **cambiado** (era «WhatsApp») — igualado con factura |
| 73 | `Ver cliente` | |
| 74 | `Marcar como rechazado` | |
| 75 | `Borrar` | |

### `public/dashboard/js/quoteSuplido.js`

| Línea | Qué es | Texto aprobado |
|---|---|---|
| 44 | Etiqueta de la casilla | `Suplido (pagado por cuenta del cliente)` |
| 92 | Resumen de ajustes | `Suplido · sin IVA` |

**45-49 · aviso bajo la casilla:**

```
Lo que has pagado por cuenta del cliente y le repercutes tal cual: una tasa, un visado, una
licencia. No lleva IVA ni margen. El material que compras tú no es un suplido: ese se vende con
su IVA.
```

> ⚠️ **SIN MAYÚSCULAS en «por cuenta»** (antes iba `POR CUENTA`). Si el sitio admite negrita, que
> lleve negrita; si no, redonda. **Gritar en una pantalla no es énfasis.**

## Bloque 4 · Clientes — `public/dashboard/js/customersView.js`

| Línea | Qué es | Texto aprobado |
|---|---|---|
| 192 | Etiqueta | `Recargo de equivalencia` |
| 197 | Opción | `No consta` |
| 198 | Opción | `Sí, está en recargo` |
| 199 | Opción | `No está en recargo` |

## Bloque 5 · Configuración — `public/dashboard/js/settingsView.js`

| Línea | Qué es | Texto aprobado | |
|---|---|---|---|
| 291 | Etiqueta | `Criterio de caja` | |
| 299 | Opción | `No consta` | |
| 300 | Opción | `Sí, estoy acogido` | |
| 301 | Opción | `No estoy acogido` | |
| 405 | Etiqueta | `Retención de IRPF` | |
| 387 | Opción | `No consta` | **cambiado** (era «Sin indicar») |
| 388 | Opción | `No aplico retención` | |
| 560 | Aviso Bizum | `Sin este móvil, tu cliente no ve la opción de Bizum.` | |
| 561 | Aviso Bizum | `No hemos podido comprobar tu móvil de Bizum. Revísalo antes de cobrar por ahí.` | |
| 213 | Píldora (respaldo) | `Modo no reconocido` | |
| 219 | Detalle (respaldo) | `No hemos podido identificar qué emite esta cuenta. Escríbenos antes de emitir nada.` | |

## Bloque 6 · Facturas (lista) — `public/dashboard/js/invoicesView.js`

| Línea | Texto aprobado |
|---|---|
| 16 | `No se han podido marcar como pagadas. Vuelve a intentarlo.` |
| 18 | `Se han marcado como pagadas, pero la lista no se ha podido actualizar. Recárgala para verla al día.` |
| 172 | `+ Nueva factura` |

## Bloque 7 · Productos — `public/dashboard/js/productsView.js`

| Línea | Texto aprobado |
|---|---|
| 611 | `Con errores` |

Queda: `CSV importado. Insertados: 12 · Duplicados omitidos: 4 · Con errores: 3`

## Bloque 8 · Trabajo · revisión antes de emitir — `public/dashboard/js/jobDetailView.js`

| Línea | Qué es | Texto aprobado |
|---|---|---|
| 2432 | Rama **conforme** | `Todo listo para emitir.` |
| 2432 | Rama **no conforme** | `Revisa lo que falta antes de emitir.` |
| 2439 | Etiqueta del NIF | `NIF del cliente (se guardará en su ficha)` |
| 2461 | Error | `Escribe el NIF del cliente. Sin él no se puede emitir la factura.` |
| 2472 | Error | `No hemos podido guardar el NIF en la ficha del cliente. Inténtalo otra vez.` |

> ⚠️ Hoy las **dos ramas** de la l.2432 pintan lo mismo (`revisionInicial.decidible ? MARCA_A1 : MARCA_A1`).
> Al aplicar, cada rama lleva **su** texto: ése era el defecto.

## Bloque 9 · Exportar — `public/dashboard/js/exportView.js`

| Línea | Qué es | Texto aprobado |
|---|---|---|
| 314 | Estado del botón | `Preparando la descarga…` |
| 331 | Info (hay filas) | `Descarga lista.` |
| 334 | Error | `No hemos podido preparar la descarga. Inténtalo otra vez.` |

## Bloque 10 · Albarán · firma

| Fichero:línea | Texto aprobado |
|---|---|
| `public/dashboard/js/albaranDetailView.js:27` | `No hemos podido registrar la firma` |
| `public/dashboard/js/signaturePad.js:402` | `La firma no se ha enviado. No cierres esta pantalla: vuelve a intentarlo.` |

## Bloque 11 · `src/`

### `src/modules/jobs/domain/albaranFirmante.ts:269`

```
Sin especificar
```

> ⚠️ **NO inventa ninguna calidad, y es deliberado.** Ese rótulo acompaña a una **FIRMA**: una
> etiqueta inventada afirmaría en qué calidad firmó alguien —dueño, encargado, inquilino— sin
> saberlo. Es el sitio donde una etiqueta falsa es peor que ninguna.

### `src/modules/jobs/domain/jobDireccion.ts:50`

```
No se puede añadir la dirección a este trabajo: tiene un albarán ya firmado que la lleva dentro
de su firma. Cambiarla dejaría esa firma sin poder verificarse.
```

Es la propuesta que ya estaba escrita en el código. Se aprueba **tal cual**.

### `src/modules/exports/domain/portabilidadCompleta.ts:201` — `LEEME.txt` del ZIP

```
Tus datos de YaQu
=================

Este ZIP contiene una copia de tus datos en YaQu, en ficheros CSV que puedes abrir con
cualquier hoja de cálculo.

Lo has descargado tú desde tu panel, y nadie más lo recibe.

Dentro hay un CSV por cada tipo de dato. La primera fila de cada uno son los nombres de
las columnas.

Para qué usamos tus datos, quién los recibe y cuánto tiempo los guardamos, lo tienes
explicado en nuestra política de privacidad: yaqu.app/privacidad
```

> 🔴 **DECISIÓN, y no es de redacción: el LÉEME NO copia el aviso del art. 15.** Apunta a la
> política de privacidad. Duplicar ahí las finalidades, los destinatarios y los plazos crearía
> **DOS FUENTES del mismo hecho legal**, y el día que una cambie la otra miente. Es el canon de la
> casa aplicado a un texto jurídico.
>
> 🔴 **Y NO se enumeran los CSV.** Si algún día se quiere una lista, se **DERIVA** de los ficheros
> que el ZIP mete de verdad. Una lista escrita a mano es la siguiente que se queda vieja.

---

## Criterios con los que se aprobó (17-ago-2026)

Se conservan porque **la lista de textos envejece y el criterio no**:

1. **Misma acción, mismas palabras.** Una acción que existe en dos pantallas se dice igual en las
   dos. De ahí los tres cambios del registro de acciones del presupuesto.
2. **Los tres selectores de estado fiscal comparten forma y palabras.** Recargo de equivalencia,
   criterio de caja y retención de IRPF tienen la misma terna —no consta · sí · no— y la dicen
   igual. Si uno dijera «Sin indicar» y otro «No consta», alguien leería que son estados distintos,
   y este producto lleva un mes separando «no lo ha dicho» de «dice que no».
3. **No se grita.** Nada de MAYÚSCULAS para enfatizar dentro de una frase.

---

## Lo que sigue SIN aprobar

| Dónde | Estado |
|---|---|
| `src/modules/system/domain/puertaClienteReal.ts:153` | Aviso interno. **Pendiente de leer la propuesta** |
| Los **38 fiscales y legales** | Van por otra vía; varios los dictamina el asesor |

---

## Addendum · aprobaciones POSTERIORES a este fichero (17-ago-2026)

🔴 **Este fichero es la fuente única y estaba TRES aprobaciones por detrás.** Llegaron en los
encargos de las tandas B y C, después de escribirlo, y nunca se anotaron aquí. Se añaden para que
«gana el fichero» siga siendo cierto — una fuente única que no se actualiza deja de serlo, y quien
la lea creerá que lo que falta no está aprobado.

### `exportView.js:330` — estado vacío del libro · **APLICADO**

```
No hay facturas en este periodo.
```

> 🔴 **La segunda línea queda RETIRADA** (decisión del fundador, 17-ago-2026). Decía «Cambia las
> fechas o emite una factura y vuelve a intentarlo.» y no se aplica **ni se aplicará**: `infoLibro`
> es el `textContent` de un párrafo, y meterla exigiría `white-space: pre-line` con su propio rojo.
> **Pagar un mecanismo por un adorno es pagar de más.** El texto aprobado es UNA sola frase.

### `puertaClienteReal.ts:153` — las DOS formas · **APLICADO 17-ago-2026**

**FORMA 1 · apertura**

```
🔴 HA ENTRADO EL PRIMER CLIENTE REAL — {motivo}.
Estas decisiones se tomaron dando por hecho que no lo habría. Revísalas:
  · {cláusula 1}
  · {cláusula 2}
  · {cláusula 3}
  · {cláusula 4}
```

**FORMA 2 · recordatorio** — construida: `debeAvisar()` devuelve ahora `dia` y `apertura` como
datos, en vez de dejar el día incrustado en su frase de diagnóstico.

```
🔴 LA PUERTA DE CLIENTE REAL SIGUE ABIERTA — día {N} — {motivo}.
Estas decisiones seguían dando por hecho que no había ningún cliente real, y siguen
sin revisar:
  · {cláusula 1}
  · {cláusula 2}
  · {cláusula 3}
  · {cláusula 4}
```

Los `{motivo}` aprobados son **exactamente dos** y no se inventan más:

```
hay un merchant con suscripción de Stripe
hay más merchants que cuentas de prueba declaradas
```

Las cuatro `CLAUSULAS_DEPENDIENTES` quedan aprobadas **literales**, y la corrección del 10-ago de la
cuarta se queda **en su comentario**: la cláusula dice el hecho, el comentario dice su media verdad.
Son dos cosas y se leen distinto.


---

## Addendum · Libro registro — desaparcado EN PARTE (19-ago-2026) · **APLICADO**

`public/dashboard/js/libroRegistroView.js`. Se aprueban **11 ranuras y dos valores de estado**. El
resto de la pantalla **sigue marcado**, y el porqué está en la sección de abajo.

| Ranura | Línea | Texto aprobado |
|---|---|---|
| `titulo` | 46 | `Libro registro de facturas expedidas` |
| `menu` | 47 | ~~`Libro registro`~~ → **RETIRADO el 19-ago-2026**, ver abajo |
| `recuento` | 49 | `{N} facturas` — **«facturas», no «asientos»** |
| `colNumero` | 61 | `Número` |
| `colFecha` | 62 | `Fecha` |
| `colTipo` | 63 | `Tipo` — **solo la CABECERA** |
| `colBase` | 64 | `Base` |
| `colCuota` | 65 | `IVA` |
| `colTotal` | 66 | `Total` |
| `colEstado` | 67 | `Estado` |
| `trazaCobro` | 72 | `Cobro` |

**Valores de la columna Estado** (antes se veían en inglés, crudos de la base):

```
paid     → Cobrada
pending  → Pendiente
```

### ⛔ Lo que SIGUE marcado en esta pantalla, y por qué

* **Los VALORES de la columna «Tipo»** (`F1`, `JUST`). `F1` es el código de tipo de factura de la
  AEAT y `JUST` es nuestro: qué lee ahí un profesional es una decisión **FISCAL**, del asesor.
  ⚠️ Nunca llevaron marcador — se pintan crudos desde `libroRegistro.ts:204`. Se dejan igual y el
  motivo queda escrito en `libroRegistroView.js`, junto a donde se pintan.
* **`annulled`**, tercer estado real de una factura (`rectificabilidad.ts:41`). **No aprobado**: se
  sigue viendo en crudo a propósito. Traducirlo por analogía sería inventarse microcopy fiscal.
* **Doce ranuras más** que no estaban en la lista aprobada: `error`, `vacioDeVerdad`, `descuadre`,
  `avisoIlegibles`, `avisoAjenas`, `avisoSinNumero`, `colTrazas`, `trazaPresupuestoFirmado`,
  `trazaPresupuestoSinFirmar`, `trazaAlbaran`, `trazaNoSellado` y `sinTrazas`.


---

## Addendum · Libro registro, segunda tanda (19-ago-2026) · **APLICADO**

### Tres decisiones más

| Ranura | Línea | Texto aprobado |
|---|---|---|
| `trazaPresupuestoFirmado` | 69 | `Presupuesto firmado` |
| `trazaPresupuestoSinFirmar` | 70 | `Presupuesto sin firmar` |
| Estado `annulled` | tabla `ESTADO_VISIBLE` | `Anulada` |

**Los dos chips se aprueban POR SEPARADO y no se colapsan:** «firmado» y «sin firmar» no son el
mismo hecho, y el libro existe justamente para no confundirlos.

**`annulled` completa los tres estados.** Medido: son los únicos tres que puede tener una factura
(`pending`, `paid`, `annulled`) y el libro **no filtra** por estado — `libroRegistro.repo.ts:81`
solo lo selecciona. `already_paid` no cuenta: es un campo de respuesta de la API, y lo dice
`librosAeat.ts:88`. La tabla **sigue dejando pasar en crudo** cualquier valor futuro.

### 🔴 Aprobación RETIRADA: `menu` = «Libro registro»

**Retirada el 19-ago-2026**, un día después de aprobarse. Gana el rótulo del **asesor**, aprobado el
10-ago: **`Libro de registro`**. Se anota en vez de borrarse porque **una aprobación retirada tiene
fecha** — y sin este renglón, dentro de un mes nadie sabría que hubo dos.

El **título de pantalla** no cambia: sigue siendo `Libro registro de facturas expedidas`.


---

## Addendum · Libro registro, tanda final (19-ago-2026) · **APLICADO**

Las **cinco últimas del fundador**. Se aprobaron **tal como estaban**: solo se les quitó el
marcador, el texto no cambió ni una letra.

| Ranura | Línea | Texto aprobado |
|---|---|---|
| `error` | 50 | `No se ha podido cargar el libro. Vuelve a intentarlo.` |
| `vacioDeVerdad` | 52 | `Todavía no has emitido ninguna factura.` |
| `colTrazas` | 68 | `De dónde viene y dónde acabó` |
| `trazaAlbaran` | 71 | `Albarán` — el número se concatena al pintar (`:328`), así que lo aprobado, `Albarán {número}`, es el RESULTADO |
| `sinTrazas` | 74 | `Factura suelta` |

### Los dos criterios, anotados junto a las ranuras porque alguien los rediscutirá

* **`colTrazas` se queda con su frase larga** porque es la **única cabecera de esa tabla que no es
  un término fiscal**. Las otras siete —Número, Fecha, Tipo, Base, IVA, Total, Estado— las impone
  la norma; ésta no.
* **`Factura suelta` se aprueba** porque **ya es el vocabulario del propio código**
  (`facturaSuelta.ts`, `modoDocumentoSuelto`). Un sinónimo nuevo habría creado dos nombres para el
  mismo hecho — exactamente el defecto que apareció con el rótulo del menú.

### 🔴 Las cinco que NO se aprueban: están en el asesor, no aquí

`descuadre` · `avisoIlegibles` · `avisoAjenas` · `avisoSinNumero` · `trazaNoSellado`.

**Siguen marcadas** y se han escrito como preguntas en **`docs/legal/PREGUNTAS_ASESOR.md`, punto
21**, cada una con la condición exacta que la dispara, lo que se pinta hoy y qué tiene que decidir.
No se reescriben ni se aprueban hasta que haya respuesta.

⚠️ **Medido:** las cinco solo se pintan en **condiciones de excepción**. Ninguna aparece en un libro
que cuadra.

---

## Addendum · Dictado sin conexión (2-sep-2026) · **APLICADA**

**Medido contra:** `origin/main` = `4b3865f8`. Con ese árbol quedan **44 marcas vivas** en
`public/` + `src/` (el «13» de la cabecera es otra foto, anclada a `a241b6e4`; no se toca).

**SCRUM-654** dejó el aviso con marcador porque el texto no estaba firmado. **SCRUM-674 lo aprueba
y lo aplica en el mismo acto.**

| Ranura | Fichero · línea | Texto aprobado |
|---|---|---|
| `AVISO_SIN_CONEXION` | `public/dashboard/js/voiceInput.js`:51 | `El dictado necesita conexión — escribe el trabajo y listo` |

**Va sin marcador y con la raya larga (`—`), un solo carácter.** Se copia literal.

**Por qué dice las DOS cosas.** Que hace falta conexión *y* que puede escribirlo a mano. Un aviso
que solo da la mala noticia deja al técnico parado delante del móvil. Y la coletilla «escribe el
trabajo y listo» es la que **ya usan los otros dos avisos del mismo fichero**: misma situación,
mismas palabras. Estrenar una redacción aquí daría dos formas de decir lo mismo en una pantalla.

**Lo que arregla no es el texto, es el silencio.** Antes de SCRUM-654 el fallo de red del dictado
era **MUDO**: el micro se apagaba sin decir nada y el profesional no sabía si había fallado él o la
aplicación. Un defecto mudo ni siquiera se puede reportar.

✅ **Aplicada en código Y anotada aquí en el mismo commit**, y `voiceInput.js` **sale del censo** de
`tests/scrum402-marcador-no-se-pinta.test.mjs` — la entrada se **borra**, no se pone a 0: un 0
declararía que el fichero se vigila y tiene cero marcas, y lo cierto es que ya no hay nada que
vigilar (precedente SCRUM-424/405).

---

## Addendum · Parte dictado (2-sep-2026) · **DOS APLICADAS, UNA PARADA**

**Medido contra:** `origin/main` = `78f008cb1aa42678a2db06b1ac31193bf57d205a` · 2026-09-02T19:08:09+02:00

**SCRUM-683** dejó tres frases propuestas. El fundador las **reescribió y aprobó** el 2-sep para que
suenen como el resto de la casa: cortas, con **raya larga** y terminando **en la acción**. El patrón
es el del aviso ya aprobado en `voiceInput.js:51` — «El dictado necesita conexión — escribe el
trabajo y listo». «No hemos entendido» sonaba a excusa nuestra.

| Ranura | Fichero · línea | Texto aprobado | Estado |
|---|---|---|---|
| `dictado_vacio` | `src/modules/jobs/domain/parteDictado.ts` · `AVISOS_DEL_DICTADO` | `No se ha entendido el dictado — vuelve a dictar o escríbelo a mano` | ✅ **APLICADA** |
| `sin_lineas_reconocidas` | `src/modules/jobs/domain/parteDictado.ts` · `AVISOS_DEL_DICTADO` | `No se ha podido sacar ninguna línea — escríbelas tú` | ✅ **APLICADA** |
| `cantidadesRetiradas` | — | `Faltan las cantidades — ponlas tú` | 🔴 **APROBADA, NO APLICADA** |

**Van sin corchete de marcador y con la raya larga (`—`), un solo carácter.** Se copian literales, y
hay un test que las compara con `===` (`tests/scrum683-parte-dictado.test.mjs`): un retoque «de
paso» reabre una aprobación sin que nadie se entere.

**Por qué las dos primeras suenan parecidas y NO lo son.** En `dictado_vacio` el dictado no se
entendió, y **volver a dictar puede funcionar**. En `sin_lineas_reconocidas` el texto se entendió y
aun así no salió ninguna línea: repetir no arregla nada, así que la única salida que sirve es
escribirlas. Cada una nombra la acción que resuelve SU caso; darles la misma coletilla mandaría al
técnico a repetir algo que ya se sabe que no va a funcionar.

**El texto vive junto al código que lo produce** (`AVISOS_DEL_DICTADO`), no dentro de la pantalla:
el módulo es dominio puro y **todavía no tiene pantalla**. Poniéndolo aquí, quien la construya lo
**copia** en vez de volver a escribirlo — un texto aprobado que se reteclea deja de ser el aprobado.

### 🔴 Por qué la tercera se para, y es una medición

El fundador aprobó el **plural** dando por hecho que el aviso es un **resumen**, y pidió
expresamente parar si se pinta **por línea**. Medido sobre el árbol:

* `cantidadesRetiradas` es un **array con una entrada por línea**, y cada entrada lleva su propia
  `descripcion` (`parteDictado.ts`, `interface CantidadRetirada`).
* **Puede traer exactamente una.** Comprobado ejecutándolo, no razonándolo:

  ```
  sanearDictadoDelParte([{descripcion:'Disco duro', unds:1}], 'Sustituir el disco duro')
    → cantidadesRetiradas.length = 1   ·   [{"descripcion":"Disco duro","propuesta":1}]
  ```

Con una sola línea, «Faltan las cantidades» **no concuerda ni siquiera como resumen**. Y hoy **nadie
lo pinta**: el módulo no tiene consumidor, así que no hay pantalla donde ver la concordancia — que
es justo lo que el fundador dijo que no aprueba a ciegas.

**No se elige un singular por él y no se aplica el plural «a ver qué pasa».** Queda aquí, aprobado y
sin aplicar, hasta que decida — y hay un aserto que cae si alguien lo aplica sin esa decisión.

---

## Addendum · Dirección de facturación del cliente (2-sep-2026) · **APROBADAS, NO APLICADAS**

**Medido contra:** `origin/main` = `354fdca362063a79a928ed5df7c5120363d64c0b` · 2026-09-02T18:33:54+01:00

**SCRUM-579 (CONT-06).** Las cinco etiquetas del formulario de cliente
(`public/dashboard/js/customersView.js`, el modal «Nuevo cliente» / «Editar cliente»). El fundador
las firmó el 2-sep **literales y sin variantes**.

| Ranura | Texto aprobado |
|---|---|
| calle | `Dirección` |
| población | `Población` |
| código postal | `Código postal` |
| provincia | `Provincia` |
| país | `País` |

**Orden en pantalla, aprobado:** `Dirección` · `Población` · `Código postal` · `Provincia` · `País`.

### 🔴 Es «Dirección» A SECAS, y esto queda escrito porque yo propuse otra cosa

La propuesta que salió de este carril era **«Dirección (calle y número)»**, y **NO es la aprobada**.
Se anota en vez de borrarse, por el mismo motivo que la aprobación retirada del menú del libro: sin
este renglón, dentro de un mes alguien vuelve a añadir el paréntesis creyendo que aclara.

Regla 30, aplicada a estas cinco: **no se abrevia** («CP» no vale), **no se reordena**, y **no se le
añaden paréntesis ni aclaraciones**. Si alguien cree que hace falta la aclaración, **se pide**; no se
añade.

### Por qué van SIN marcador, y por qué se pidió la aprobación antes que el código

**Producción despliega en cuanto se mergea.** Un `[PENDIENTE microcopy oficial]` en estos cinco
rótulos no habría sido una nota interna: lo habría visto un profesional en su pantalla **a los cinco
minutos** del merge, cinco veces en el mismo formulario. Por eso la aprobación se pidió **antes** del
PR de código y no después — y por eso este ticket entrega sin una sola marca.

### Estado: aprobadas y todavía sin pintar

El formulario **aún no existe**: SCRUM-579 está parado a propósito en el orden de migración
—① decisión → ② `ALTER` en las TRES bases → ③ un solo PR con schema + código + tests—, y a fecha de
esta anotación el `ALTER` está **sólo en `yaqu_dev_javier`** (medido: DEV 5/5, STAGING 0/5).

Se anotan aquí **ahora** y no cuando se pinten, porque un texto aprobado que se reteclea semanas
después deja de ser el aprobado. Quien construya el formulario **copia de esta tabla**.

⚠️ Y al aplicarlas va **un aserto que las compare con `===`**, como el de
`tests/scrum683-parte-dictado.test.mjs`: un retoque «de paso» reabre una aprobación sin que nadie se
entere.
## Addendum · Parte dictado, la tercera (2-sep-2026) · **APLICADA, en SINGULAR**

**Medido contra:** `origin/main` = `a5aef1b9bbd2570eccbde82b407c9d3675192c2d` · 2026-09-02T19:32:31+02:00

Cierra la fila que el addendum anterior dejó como **APROBADA, NO APLICADA**. Aquella entrada no se
reescribe —es un registro fechado y era cierto—: se cierra desde aquí.

| Ranura | Fichero · línea | Texto aprobado | Estado |
|---|---|---|---|
| `cantidadesRetiradas` | `src/modules/jobs/domain/parteDictado.ts` · `AVISOS_DEL_DICTADO` | `Falta la cantidad — ponla tú` | ✅ **APLICADA** |

**Va sin corchete de marcador y con la raya larga (`—`), un solo carácter.** Comparada con `===` en
`tests/scrum683-parte-dictado.test.mjs`.

### Por qué cambió de plural a singular: lo decidió el dato

El fundador lo aprobó primero como **«Faltan las cantidades — ponlas tú»**, dando por hecho que era
un **resumen**, y pidió expresamente parar si se pintaba **por línea**. Se midió antes de aplicarlo:

* `cantidadesRetiradas` es un array con **una entrada por línea**, cada una con su `descripcion`.
* **Puede traer exactamente una**, comprobado ejecutándolo:

  ```
  sanearDictadoDelParte([{descripcion:'Disco duro', unds:1}], 'Sustituir el disco duro')
    → cantidadesRetiradas.length = 1   ·   [{"descripcion":"Disco duro","propuesta":1}]
  ```

Con una sola línea el plural no concordaba **ni como resumen**. Se paró y se dijo; el fundador
aprobó el **singular por línea**. El aviso se pinta **una vez en cada línea** a la que le falta la
cantidad.

> ⚠️ **Un resumen sería un texto DISTINTO.** Si algún día hace falta además un «3 líneas sin
> cantidad», se pide y se aprueba entonces: **no se deriva de éste poniéndolo en plural**. Hay un
> aserto en el test que cae si el plural vuelve por su cuenta.

---

## Addendum · Condiciones del presupuesto (3-sep-2026) · **APLICADAS**

**Medido contra:** `origin/main` = `948e63980491950d313356977e61493f14f9888e` · 2026-09-03T11:54:28+02:00

**SCRUM-656 fase B** propuso ocho rótulos con marcador. El fundador los aprobó **cambiando uno** y
se aplican en el mismo acto. Son rótulos de **nuestra** pantalla (Configuración → Facturación); el
texto que ve el cliente en el PDF lo escribe el merchant y no se toca desde aquí.

| Ranura | Fichero | Texto aprobado |
|---|---|---|
| `clausulasTitulo` | `public/dashboard/js/settingsView.js` · `TX` | `Condiciones del presupuesto` |
| `clausulasPista` | ídem | `Se escriben una vez y salen en todos tus presupuestos.` |
| `clausulaTitulo` | ídem | `Título (GARANTÍA, ALCANCE…)` |
| `clausulaTexto` | ídem | `Texto de la condición` |
| `clausulaQuitar` | ídem | `Quitar` |
| `clausulaAnadir` | ídem | `Añadir condición` |
| `clausulasVacio` | ídem | `Todavía no has escrito ninguna condición.` |
| `clausulasIlegibles` | ídem | `No se han podido leer tus condiciones — no se ha guardado nada` |

**Van sin corchete de marcador.** Se copian literales: los puntos suspensivos de `GARANTÍA, ALCANCE…`
son **un solo carácter** (`…`), y la raya del último es la larga (`—`), también uno.

### 🔴 El único que cambió, y por qué

Se propuso **«No hemos podido leer tus condiciones. No se ha guardado nada.»** y el fundador lo dejó
en **«No se han podido leer tus condiciones — no se ha guardado nada»**.

> **La voz de la casa no dice «no hemos podido»: suena a excusa nuestra.**

Es la **misma corrección** que se hizo el 2-sep en los avisos del dictado, donde «No hemos entendido»
pasó a «No se ha entendido». Y como allí: raya larga, y termina en el hecho que le importa al
profesional —que no se ha guardado nada—, no en nosotros.

### Lo que este aviso vigila, que no es un detalle de estilo

Se pinta cuando `merchants.clausulas_presupuesto` trae algo que **no se puede leer**. En pantalla,
«no has escrito ninguna» y «no se han podido leer» son **la misma caja vacía** y significan lo
contrario: la segunda es un PDF saliendo **sin las condiciones que el profesional cree que lleva**, y
nadie se entera hasta que un cliente discute la garantía. Por eso el aviso existe, y por eso dice
además que **no se ha guardado nada**.

✅ **Aplicadas en código Y anotadas aquí en el mismo commit.** El bloque `TX` de `settingsView.js`
pierde su constante de marcador (`MARCA_CLAUSULAS`), que era la que factorizaba la marca para que el
censo de SCRUM-402 no se moviera: **ya no hace falta, porque ya no hay nada marcado que aprobar ahí**.

---

## Addendum · Quién ejecuta el trabajo (3-sep-2026) · **APLICADOS**

**Medido contra:** `origin/main` = `1f03815295aa3ba26920283f5daec16472d03854` · 2026-09-03T13:40:00+02:00

**SCRUM-650 (T1)** propuso cinco textos con marcador para el selector de quién ejecuta un Trabajo —
el campo «Técnico» del parte de papel de Tecnosel, donde caben tres nombres en una línea. El
fundador los aprobó **sin un solo cambio** y se aplican en el mismo acto.

| Ranura | Fichero | Texto aprobado |
|---|---|---|
| `titulo` | `public/dashboard/js/jobAsignados.js` · `TEXTOS_ASIGNADOS` | `Quién ejecuta este trabajo` |
| `vacio` | ídem | `Todavía no lo ejecuta nadie` |
| `soloAdmin` | ídem | `Solo un administrador puede cambiar quién ejecuta` |
| `sinEquipo` | ídem | `Todavía no hay empleados a los que asignar` |
| `noSeGuardo` | ídem | `No se ha podido guardar quién ejecuta este trabajo` |

**Van sin corchete de marcador y se copian literales.** Los cinco llevan tilde donde toca
(`Quién`, `Todavía`) y ninguno termina en punto: son rótulos y estados de una caja, no frases de
párrafo.

### Qué dice cada uno, y por qué el conjunto no se puede recortar

- **`titulo`** — el rótulo del bloque. Es lo único que separa esta caja del bloque RESPONSABLE del
  rail: aquél dice quién REDACTÓ el presupuesto (autoría, SCRUM-52) y éste quién lo EJECUTA
  (SCRUM-10). Sin rótulo, quien abre la pantalla no sabe cuál de las dos está marcando.
- **`vacio`** — un trabajo sin nadie asignado es **invisible para todos los técnicos**; solo lo ven
  los admin. Esa caja vacía tiene que decir qué significa.
- **`soloAdmin`** — al técnico se le enseña quién ejecuta pero no lo puede cambiar. Norma de
  SCRUM-89: un gate no deja UI huérfana, así que se dice por qué en vez de esconder el bloque.
- **`sinEquipo`** — negocio de una sola persona. **No es un fallo:** el propietario no tiene fila en
  `team_members`, así que hay un miembro y cero asignables. Un desplegable vacío no se distingue de
  uno que no cargó; este texto sí.
- **`noSeGuardo`** — el fallo al guardar. **Y sustituye a pintar el `.message` del servidor**
  (SCRUM-644): un `invalid_assignee` en pantalla es una tubería interna asomando a la interfaz.

### 🔴 El marcador se apagó de golpe, que es para lo que estaba factorizado

Los cinco salían de **una sola constante** `MARCA_ASIGNADOS`, y había un guard en
`tests/scrum650d-pantalla-asignar.test.mjs` que exigía que el literal con marcador fuera **uno**.
Por eso el censo de SCRUM-402 contaba `1` para este fichero y no `5`, y por eso aprobarlos ha sido
borrar una constante y no tocar cinco textos.

✅ **Aplicados en código Y anotados aquí en el mismo commit.**
✅ La entrada `'jobAsignados.js'` del censo de SCRUM-402 se **BORRA**, no se pone a 0 (SCRUM-424 /
SCRUM-405): `censoActual()` solo lista ficheros CON marcadores. Salir del censo **no** saca de la
vigilancia — lo fija R4b.
✅ El guard de la regla 30 se **da la vuelta, no se borra**: antes exigía que los cinco llevaran
marcador; ahora exige que digan EXACTAMENTE lo aprobado y que no quede ni rastro del `[PENDIENTE`.
Borrarlo dejaría estas cinco frases sin sujeto, y la siguiente persona que toque el módulo
retocaría una coma sin pasar por el fundador.
