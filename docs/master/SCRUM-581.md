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
