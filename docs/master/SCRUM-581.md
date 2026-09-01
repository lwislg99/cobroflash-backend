# SCRUM-581 · CONT-08 · Filtros y orden: el censo que para el ticket

**Fecha:** 01-sep-2026 · **Carril:** producto (lista de clientes) · **Gate:** sin gate — no entra código

**Medido contra:** `origin/main` = `bcf30775b0e535c9c6534eb7636558b9a4200a3e` · 2026-09-01T14:18:26+01:00

**No se ha construido nada.** Se disparan **dos** condiciones de parada, no una: la del punto 4 del
encargo (los datos) y la de coordinación del punto 8 (el fichero compartido con S3).

---

## 🔴 PARADA 1 · El censo de `contact_kind`: **0 con valor, 15 en NULL**

Lectura pura sobre las dos bases alcanzables. Producción no lo es desde un árbol de trabajo
(regla 3), así que ese número **no lo tengo**.

| base | filas | con valor | **en NULL** |
|---|---|---|---|
| `acela.proxy.rlwy.net/railway` (STAGING) | 4 | **0** | **4** |
| `acela.proxy.rlwy.net/yaqu_dev_javier` (DESARROLLO) | 11 | **0** | **11** |
| | **15** | **0** | **15** |

La columna existe y está aplicada en las dos (`text`, `is_nullable=YES`, sin `column_default`), o
sea que CONT-01 (SCRUM-574) está donde tiene que estar. Lo que no hay es **ni una sola fila
declarada**.

**Consecuencia si las pestañas entraran hoy:** «Empresas» y «Personas» saldrían **vacías** y
«Todos» tendría las 15. Una función nueva que no enseña nada no es una mejora visible.

**No he inventado un valor por defecto** — ni «NULL es Persona», ni «NULL es Empresa», ni pintarlos
en una de las dos por comodidad. Es literalmente el defecto de SCRUM-615, y el propio
`switchFormaJuridica.js` ya lo tiene escrito: *«NULL significa "nadie lo ha declarado", y NO es lo
mismo que "es una persona"»*. Las salidas concebibles son decisión del fundador y del asesor.

### Un dato que ayuda a decidir: **el 0 es de partida, no permanente**

El switch **sí está construido y es alcanzable**: `public/dashboard/js/switchFormaJuridica.js`, usado
en el alta y la edición (`customersView.js`) y en la ficha (`customerDetailView.js`), y el back lo
acepta (`contactKind: z.enum(['EMPRESA','PERSONA']).nullable().optional()`). O sea que **desde hoy
un merchant puede declarar la forma jurídica**; el 0 es porque la columna es nueva y nadie ha
tocado esas 15 filas todavía, no porque no haya por dónde.

---

## 🔴 PARADA 2 · La lista y el FORMULARIO viven en el MISMO fichero

`public/dashboard/js/customersView.js` — **472 líneas** — contiene las dos cosas:

| zona | qué es | quién la tocaría |
|---|---|---|
| líneas ~77-85 | la toolbar y el buscador | **yo**, para las pestañas y el orden |
| líneas ~132-330 | el modal de alta/edición, `createField`, `fieldPhone`, `onModalSubmit` | **S3**, en CONT-05 |

S3 está vivo en el worktree `cobroflash-b3` sobre `scrum-578-duplicados-telefono`. Medido contra el
remoto: **su rama empujada sólo lleva `docs/master/SCRUM-578.md`** — todavía no ha tocado código.
Pero CONT-05 es la validación del teléfono, y `fieldPhone` está en este fichero.

Por eso **paro antes de escribir**, que es lo que pide el punto 8.

---

## Medición del punto 5 · Cómo se ordena la lista HOY

- **Ordena el SERVIDOR:** `src/modules/system/customerAdmin.ts::listCustomers` →
  `orderBy: { createdAt: 'desc' }`. Los más recientes primero.
- **El front NO ordena.** Cero `sort(` y cero `localeCompare` en `customersView.js`: pinta lo que
  llega.

🔴 **Y eso tiene una consecuencia directa sobre el control negativo del encargo.** «Con el filtro
Todos, la lista tiene que ser exactamente la de hoy» significa **`createdAt` descendente**, no A-Z.
Si el orden A-Z entrara como valor por defecto, **sería una regresión por la definición del propio
encargo**. A-Z tiene que ser una opción que el usuario elige, con el defecto actual intacto — salvo
que el fundador decida otra cosa, que es suya.

Sobre acentos y mayúsculas: hoy no se plantea porque no hay orden alfabético. Cuando entre, el
criterio medible es `localeCompare` con locale `es` y `sensitivity: 'base'`, que es lo que pone
«Álvarez» junto a «alvarez» donde el usuario los busca. No lo he construido.

---

## El copy: **no hay texto aprobado que reusar**

El punto 6 invita a reusar si ya existe algo equivalente aprobado. Lo he buscado y **no lo hay**:

- Las etiquetas del switch de CONT-01 son
  `'[PENDIENTE microcopy oficial] Empresa'` / `'[PENDIENTE microcopy oficial] Persona'`
  (`switchFormaJuridica.js`, constante `MARCADOR`). Llevan el marcador: **no son copy aprobado**,
  son copy pendiente bajo los cuatro criterios que el fundador fijó.
- El único texto aprobado de esta pantalla es el placeholder del buscador
  («Buscar por nombre, teléfono o email…»), que no sirve para pestañas ni para orden.

Reusar esas etiquetas sería **heredar el marcador**, no reusar copy aprobado. Es una decisión, no un
atajo, y no la tomo.

---

## Pendiente de CONT-07, declarado

**Filtrar por tag NO entra** y no se ha construido «preparado por si acaso». Depende de **CONT-07
(SCRUM-580)**, que no está hecho. Queda colgado de ese ticket.

---

## Lo que hace falta para desbloquear

1. **Qué hacen las pestañas con los 15 NULL** — decisión del fundador y del asesor. Con el número
   delante: tercera pestaña, que sólo salgan en «Todos», o esperar a que haya datos.
2. **El copy** de las pestañas y del desplegable de orden (regla 30).
3. **Confirmación de que S3 no está escribiendo en `customersView.js`**, o repartir el fichero.

Con eso, lo que queda es una tarde: el orden es independiente de `contact_kind` y no está bloqueado
por datos, sólo por copy.

---

## Estado del árbol

- **Suite: total 4103 · pass 4024 · fail 0 · skipped 79** (67 `QA_DB_TEST`, 9 `LIBRO_PG_URL`,
  1 `BOT_SUITE_TEST`, 1 `A55_DB_TEST`, 1 EPERM de Windows) — medida en esta rama, no heredada de
  un informe anterior: `main` se ha movido desde el último recuento.
- `npm run guards:entrada` en verde.
- **No se ha modificado ningún fichero de producto.**

---

# SCRUM-581 · APÉNDICE · Construido: pestañas y orden

**Fecha:** 01-sep-2026 · **Carril:** producto · **Gate:** sin gate — corre en `npm test`

**Medido contra:** `origin/main` = `d695ead49969337baa2165fbbd8a2dde4e0cc515` · 2026-09-01T14:29:14+01:00

Con las tres decisiones del asesor tomadas sobre el censo de arriba.

## 📌 La consecuencia asumida, escrita donde se pidió

**Mientras haya NULLs, «Empresas» + «Personas» NO suma «Todos».** Está decidido así (los NULL salen
sólo en «Todos», sin tercera pestaña) y es visible. Hoy son **15 de 15**. Explicarlo en pantalla, si
se quiere, es microcopy del fundador — no mío.

**Y no hay valor por defecto.** El filtro compara con `===` y no lleva **ni un `||` ni un `??`** para
que una fila «caiga en algún sitio». Una fila sin declarar no aparece en ninguna de las dos, y es
correcto: es `resolveTipoDestinatario` lo que NO se repite (SCRUM-615).

## Dónde vive la decisión

`public/dashboard/js/filtroClientes.js` — **sin DOM**, para que esta pantalla tenga red en
`npm test`. Los nueve guards de navegador **no cubren el dashboard** (SCRUM-628) y aquí sólo se han
usado como **no-regresión de la landing**: 9 verdes, puerta con código 0.

## El orden: **en cliente**, y por qué

Se ordena **en el cliente**, sobre el lote que ya llegó. Tres motivos, en orden de peso:

1. **El defecto sigue siendo literalmente el del servidor.** `RECIENTES` no reordena nada: devuelve
   lo que mandó `listCustomers` (`orderBy: { createdAt: 'desc' }`). Si el orden se hubiera movido al
   servidor, el «defecto de hoy» pasaría a depender de código nuevo.
2. **No añade una ida a la red** por cambiar de pestaña o de orden.
3. **No toca `customerAdmin.ts`**, que es zona de servidor fuera del reparto de este ticket.

`AZ` usa `localeCompare(nombre, 'es', { sensitivity: 'base' })` — que es lo que pone «Álvarez» junto
a «alvarez», donde el usuario los busca, en vez de donde los dejaría una comparación binaria (todas
las mayúsculas delante, los acentos al final). Y **ordena una copia**: `sort` muta, y mutar el lote
haría que «Más recientes» dependiera de si alguien pulsó A-Z antes — un fallo que sólo aparece en la
segunda interacción y que nadie reproduce.

## El censo de marcadores: **16 → 17 marcas · 101 → 107 superficies**

**+1 marca, +6 superficies.** Una sola constante `MARCADOR` en `filtroClientes.js` apaga las seis:
3 pestañas, 2 órdenes y el vacío de pestaña.

⚠️ **Y lo digo, porque es el aviso de SCRUM-615:** el censo cuenta **MARCAS, no rótulos**. Las seis
ranuras comparten esa constante, así que **aprobar el texto de UNA pestaña no apaga las otras
cinco** — habría que sacar esa `palabra` por separado. Declarado en `scrum402-marcador-no-se-pinta`
para que no se descubra al aprobar el primero.

**Van con palabra de trabajo detrás** (`[PENDIENTE microcopy oficial] Empresas`), no con la marca
sola. Y aquí hay una **discrepancia con el encargo que no resuelvo en silencio**: el encargo dice
«literal, SIN palabra de trabajo», pero la regla escrita y mergeada de la casa —en
`switchFormaJuridica.js`, la puerta que el propio encargo me manda usar— dice lo contrario y explica
por qué: *«en un control de dos lados el marcador solo sería inservible: los dos lados dirían lo
mismo»*. **Con TRES pestañas el problema es peor.** He seguido la regla escrita; si el criterio es el
otro, se cambia en una línea (`etiqueta()`).

## El vacío de pestaña, que no existía

Hoy «Empresas» sale vacía **con clientes en la lista**, y el vacío que ya había dice «Añade a tu
primer cliente» — que ahí sería **falso**. El de la búsqueda tampoco vale: no se ha buscado nada.
Por eso hay una sexta ranura marcada. Es la única superficie nueva que no estaba en el encargo, y se
declara.

## Los controles

| control | resultado |
|---|---|
| **NEGATIVO** · «Todos» sin tocar el orden | la lista es **exactamente** la del servidor, mismo contenido y mismo orden |
| **EL CASO DE HOY** · 15 NULL | «Todos» los enseña · «Empresas» y «Personas» **vacías** · ninguna fila en una pestaña que no le toca |
| **ROTURA INYECTADA** · que «Empresas» devuelva también personas | **el test CAE y lo NOMBRA**: «Empresas» ha devuelto a #6 («Chus»), cuyo contactKind es `"PERSONA"` |
| **ORDEN** · acentos y mayúsculas | «Álvarez» y «alvarez» quedan juntos y primeros; `Bermúdez`, `Zorrilla` detrás |
| **NO MUTA** | `ordenar` no toca la lista de entrada |

Árbol commiteado en **`85be346a`** antes de inyectar. Reversión: `Buffer.compare(disco, testigo) === 0`.

## Cuatro redes de la casa saltaron, y se atendieron

Añadir un `<script>` al dashboard tiene tres consecuencias que la casa vigila, más el trinquete:

- **`SCRIPTS_DEL_DASHBOARD` 62 → 63.** 🔴 Es un valor **DERIVADO** y se ha **recalculado desde el
  `index.html` de esta rama** (`grep -c "<script src="` → 63), no elegido. Es exactamente la lección
  del contador: si en un merge este número saliera igual en los dos lados, git lo dejaría fuera de
  los marcadores de conflicto y nadie se enteraría. **Se vuelve a contar después de mezclar.**
- **El SHELL del service worker** (SCRUM-274) lleva ahora `filtroClientes.js`: si no, `addAll`
  —que es atómico— dejaría el dashboard sin precachear.
- **El trinquete de marcadores** (SCRUM-402), declarado arriba.

## Zona respetada

Sólo **la toolbar** y **`loadCustomers`/`pintar`**. El modal con `fieldPhone` —zona de S3 en
CONT-05— **no se ha tocado**.

## Pendiente de CONT-07

**Filtrar por tag** sigue fuera y no se ha construido «preparado por si acaso». Depende de
SCRUM-580.

## Estado del árbol

- **Suite: total 4113 · pass 4034 · fail 0 · skipped 79**, medida en esta rama.
- **9 guards de navegador verdes** — como no-regresión de la landing, nunca como prueba de esta
  pantalla.
- `npm run guards:entrada` en verde.
