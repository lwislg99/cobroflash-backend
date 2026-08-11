# SCRUM-361 · H6 — La `version` que el móvil vio viaja con la firma

**Fecha:** 10-ago-2026 · **Carril:** híbrido/offline (bloque H) · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `9f6733ae6977be6e3b643a86e93d9f5ed3ab019e` · 2026-08-10T22:30:11Z

**Paso 0:** `docs/master/SCRUM-361.md` **no existía** en `main` ni en ninguna rama remota. Premisa
reconfirmada contra el `main` de ahora (los seis hechos que la sostienen, abajo).

> ✅ **GO del fundador.** Se adopta la recomendación de la sesión de medición, entera.

## 1 · La víctima, en una línea

Un cliente abre el enlace de firma, y mientras lo tiene abierto el profesional corrige una línea del
albarán desde el ordenador. El cliente firma **la pantalla que tenía**, y queda sellado un contenido
que él no vio. **La firma vale cero y parece que vale.**

Y es real, no teórico: el PATCH solo se bloquea cuando el albarán ya está **firmado**
(`albaranes.routes.ts:406`), así que uno **enviado a firmar todavía se puede editar**.

## 2 · 🔴 Lo que NO se ha hecho, y es lo más importante

**No se ha duplicado ningún hash. Ni una línea.**

H0 (`SCRUM-355` · P4) midió que `computeAlbaranContentHash` vive en el servidor y no es ejecutable
en el navegador: habría que **duplicarlo**, y dos implementaciones del mismo hash que derivan en
silencio dan conflictos falsos o —peor— **conflictos no detectados**, dentro del mecanismo que
existe precisamente para detectarlos.

**No hace falta.** El cliente no compone contenido: solo firma lo que bajó. Basta con que devuelva
el entero que vio. Hay guard que prohíbe `crypto.subtle`, `computeAlbaranContentHash`,
`contenidoCanonico`, `sha256` y `digest(` en la página pública.

## 3 · Qué entra, y es poco a propósito

| Pieza | Dónde |
| --- | --- |
| La `version` viaja al cliente | `albaranPublic.routes.ts` · `GET /:token`, en el cuerpo del `fetch` |
| Y vuelve con la firma | mismo fichero · `POST /:token/firmar` |
| La comparación | `puedeFirmarEstaVersion`, en **`albaranFirmante.ts`** |

La comparación vive en el dominio y **no en la ruta**, por lo mismo que `exigirNombreFirmante`:
firman **dos** superficies (in situ y remota), y *una comparación escrita dentro de una ruta es una
comparación que la siguiente ruta no hará*.

### 🔴 SUELO: si la versión no llega, **no se firma**

Un cliente con la página vieja en caché, o un enlace anterior a este ticket, manda la firma **sin
versión**. Eso **no es «coincide»: es «no lo sé»**, y tratarlo como coincidencia abriría por la
puerta de atrás el agujero que este ticket cierra.

> Manda la **asimetría de coste**: repetir una firma cuesta cinco minutos; sellar un contenido que
> el cliente no vio **no se deshace**.

Probado con diez formas de no-número (`undefined`, `null`, `''`, `'3'`, `NaN`, `Infinity`, `3.5`,
`{}`, `[]`, `true`), con el control de que el número bueno **sí** pasa.

## 4 · 🔴 El guard que hace segura la propuesta

Todo esto descansa en que **`Albaran.version` significa «el contenido cambió»**, y hoy es cierto
porque el único escritor que toca contenido es el PATCH. **Nada lo obligaba.**

Ahora hay un censo por AST de **todas** las escrituras de `Albaran` que cae **nombrando la ruta**
que toca contenido sin incrementar. Con:

* **suelo doble y por separado**: ficheros recorridos (>100) y escrituras encontradas (≥5) — un
  suelo agregado puede tapar otro;
* **control negativo**: una escritura de **metadatos** —estado, `pdfUrl`, token, `invoiceId`— **no
  puede** hacerlo caer, o se desactivaría al primer roce;
* **control positivo dentro del mismo test**: el PATCH tiene que salir clasificado *como contenido*,
  o el guard estaría vigilando un conjunto vacío.

Sin este guard, la propuesta es correcta hoy y **muda mañana**.

## 5 · Microcopy — aprobada, y MEDIDA en el navegador

Texto y botón **aprobados por el asesor**, literales, en su fuente única (`albaranFirmante.ts`).

**La condición era medir la caja, y se midió** con el CSS **real** de la página (extraído del propio
fichero, no copiado a mano), en un navegador:

| Pantalla | Líneas | ¿Desborda? | ¿Scroll horizontal? |
| --- | --- | --- | --- |
| 390 × 844 (iPhone) | **3** | no | no |
| 320 × 568 (el más estrecho) | **4** | no | no |

Los **88 caracteres** salen completos. **No se trunca.**

Va en un **aviso propio** (`.status-aviso`, hermana de `.status-ok`: mismo radio, mismo padding,
mismo centrado, solo cambia el tono) y **no** en la línea roja de error: el asesor prohibió que
sonara a fallo del programa, y **el color es parte del texto**. Se **retira el botón de firmar** —
dejarlo activo invitaría a reintentar lo mismo, que es justo lo que no debe pasar.

## 6 · Verificación

| | Qué | |
| --- | --- | --- |
| **🔴 EL TEST** | se abre el enlace, el albarán cambia, se firma con la vieja → **no se sella nada** y sale el mensaje aprobado | ✅ |
| **🔴 CONTROL POSITIVO 2** | **sin cambios de por medio, la firma funciona igual que hoy**. Un mecanismo que bloquea siempre no protege: estorba, y acaba desactivado | ✅ |
| **CONTROL NEGATIVO** | una escritura de **metadatos** no impide firmar ni hace caer el guard | ✅ |
| **SUELO** | la versión que no llega **no se firma** | ✅ |
| Microcopy | es la aprobada, y **no** contiene «error», «caducada», «conflicto», «reintenta», «token»… | ✅ |

### Los rojos por el mecanismo — cada uno con post-condición en disco

| Mutación | Cae diciendo |
| --- | --- |
| se quita la comparación | *«el servidor NO compara la versión recibida con la de ahora. La manda el cliente y nadie la mira»* |
| la versión ausente se da por buena | *«se acepta firmar con version=undefined contra la v:3 real. “No sé qué vio el cliente” se está leyendo como “vio lo mismo”»* |
| una ruta edita contenido sin incrementar | *«UNA RUTA EDITA EL CONTENIDO DEL ALBARÁN SIN INCREMENTAR `version`: · albaranes.routes.ts:489»* (+1 test) |
| se reformula el texto aprobado | *«el texto no es el aprobado por el asesor. Reformularlo es cambio de máster»* |

### 🔴 Tres veces el escáner fui yo, y las tres quedan escritas

1. **El criterio de «toca contenido» miraba solo el literal del `data:`.** El PATCH escribe
   `{ ...data, version: … }` y rellena `data.lineas` más arriba, así que **la única escritura que
   importa salía clasificada como metadatos**: el guard habría vigilado todo menos lo que importa.
2. **Dos post-condiciones de mis propias ediciones fallaron** —una por 3 ocurrencias donde esperaba
   1, otra por un escapado que se comió una barra— y las dos **evitaron dejar el fichero a medias**.
3. **El guard del hash cayó sobre mi propio comentario** que explica por qué no se duplica. Es el
   defecto de SCRUM-349, que ya ha mordido cuatro veces. **La casa ya tenía herramienta**
   (`leerFuente`, SCRUM-193): gana ella.

## 7 · Lo que NO se ha tocado

El sellado, las recetas y el verificador —**ningún hash**, y los 9 vectores congelados de
`scrum369` siguen verdes—; **qué bloquea el PATCH** (que un albarán enviado a firmar se pueda
editar es un hallazgo aparte y otra decisión); la cola y el encolado (H3); la precarga (SCRUM-458);
`prisma/schema.prisma`; y `public/`.

**Esta fase EVITA el conflicto en el momento de firmar.** Resolver conflictos ya ocurridos —los
cuatro casos de la tabla del ticket original— es otra fase.

---

# FASE 2 — el otro lado de la misma puerta: al EDITAR

**Medido contra:** `origin/main` = `f546e27b1be450bdcc4aef7cfe97b169b2e9892f` · 2026-08-11T22:22:27+02:00

**11-ago-2026** · sesión 2 · La fase 1 (arriba) **no se toca**: es historia y sigue siendo verdad.

## 0 · El paso 0 encontró la fase 1 entera, y eso cambió el ticket

La sesión arrancó con el encargo de construir «el detector de conflictos» del caso móvil-sin-red.
El paso 0 lo paró, y las tres medidas que lo pararon quedan escritas porque **el ticket que se iba a
construir no era el que hacía falta**:

1. **La rama `scrum-361-h6-version-al-firmar` ya estaba en `main`** (`merge-base --is-ancestor`
   pasa; último commit `a758d902`, Javier Pereira Fernández, 10-ago-2026 23:31:44 +0100). No se
   encontró por el número: se encontró por CONTENIDO, con `git log --all -S`.
2. **La pregunta que decidía la fase ya estaba contestada** en esta misma entrada (§2), con GO del
   fundador: el hash **no se duplica**. Construir «una implementación en navegador + un test
   cruzado» habría duplicado trabajo decidido **y** peleado contra el guard de la fase 1.
3. **El caso del móvil sin red NO TIENE SUJETO todavía.** `colaDeFirmas.js` encola **firmas**, no
   ediciones: la búsqueda de `PATCH` en `colaDeFirmas.js`, `almacenLocal.js` y `estadoFirma.js` sale
   **vacía**. Hoy no se puede editar un albarán sin red, así que no hay dos versiones que detectar.

Lo que **sí** estaba abierto, y es lo que construye esta fase, salió de esa misma medición.

## 1 · La víctima, en una línea

Dos pestañas, o dos personas del mismo equipo, abren el mismo albarán. Una corrige una línea y
guarda. La otra guarda después, con lo que tenía en pantalla. **El trabajo de la primera desaparece
y nadie se entera.**

Y era real, no teórico: el PATCH hacía `version: { increment: 1 }` **a ciegas**. El único acierto de
`req.body?.version` en todo `src/` estaba en el camino público de firma — es decir, en el camino del
profesional **el último que escribe ganaba, en silencio**. El `AuditLog` lo anotaba como
`de v:3 a v:4`, igual que una edición normal, así que ni siquiera quedaba la sospecha. Y no hay
historial de filas del que recuperarlo (decisión del fundador, ALBARAN-6).

## 2 · Qué entra, y es poco a propósito

| Pieza | Dónde |
| --- | --- |
| La comparación | `puedeEditarEstaVersion`, en **`albaranEdicion.ts`** (fichero nuevo) |
| El rechazo | `albaranes.routes.ts` · `PATCH /:id`, **antes** de validar líneas y fechas |
| La versión viaja con el guardado | `public/dashboard/js/jobDetailView.js` · el cuerpo del PATCH |

La comparación vive en el dominio y **no en la ruta**, por lo mismo que `exigirNombreFirmante` y que
`puedeFirmarEstaVersion`: *una comparación escrita dentro de una ruta es una comparación que la
siguiente ruta no hará*.

No se añade ningún campo al front: `serializeAlbaran` **ya mandaba** `version`
(`albaran.service.ts:725`). Y `prisma/schema.prisma` **no se toca**: `Albaran.version` ya existía.

### 🔴 Se comprueba ANTES de escribir, y el orden se MIDE

Una comparación escrita después del `update` no protege de nada. El test lee la posición de las dos
cosas en el fichero y **exige que la comparación vaya delante** — no se fía de que se lea bien.

## 3 · 🔴 La decisión que sostiene todo: DELEGA, no reimplementa

La pregunta que hay que contestar al editar es **literalmente la misma** que contestó la fase 1:
*¿la versión que traes es la que hay ahora, sabiendo que «no traes ninguna» NO es «traes la buena»?*

Había dos formas de tenerla en los dos sitios:

| | |
| --- | --- |
| **Reimplementarla** | dos funciones que hoy dicen lo mismo y mañana se separan sin que nadie lo note. Haría falta un guard que las compare |
| **Delegar en la fase 1** | una sola implementación. No hay nada que comparar porque no hay dos cosas |

**Se delega.** Una divergencia **imposible** gana a una divergencia **vigilada**. No se ha tocado
`albaranFirmante.ts` —el mecanismo de firma se LEE, modificarlo es STOP (regla 38)— y no hacía
falta: importar es leer.

> **🔴 Y esto NO lo habría cazado el comportamiento. Medido, no argumentado.** Con la comparación
> reimplementada a mano y compilada, **los cuatro tests de comportamiento siguen en verde** (1, 2, 3
> y 4 de la tabla de abajo): el día de la bifurcación las dos implementaciones todavía coinciden, y
> solo se separan después. El único que cae es el guard de delegación. Un guard que solo mide
> comportamiento habría dado el visto bueno a la bifurcación **el día exacto en que se introduce**.

## 4 · 🔴 EL SUELO: si la versión no llega, no se escribe

Un dashboard viejo en la caché del service worker, o un cliente de API anterior a esta fase, manda
el PATCH **sin versión**. Eso **no es «coincide»: es «no sé qué estaba viendo»**, y tratarlo como
coincidencia abriría por la puerta de atrás el agujero que esta fase cierra.

> Manda la misma asimetría de coste que en la fase 1: un guardado rechazado cuesta recargar y
> repetir; **una edición pisada no se deshace, y encima parece que se guardó.**

Probado con diez formas de no-número (`undefined`, `null`, cadena vacía, `'3'`, `NaN`, `Infinity`,
`3.5`, `{}`, `[]`, `true`), con el control —dentro del mismo test— de que el número bueno **sí** pasa.

**Consecuencia declarada, no descubierta:** mientras un navegador conserve el JS anterior a esta
fase, sus ediciones se rechazan hasta que recargue. Es el lado seguro del error, y es el que se
elige.

## 5 · El código de error, y la microcopy que NO se ha escrito

`ERROR_ALBARAN_CAMBIADO_AL_EDITAR = 'albaran_cambiado_al_editar'`. Comprobable por igualdad, que es
como lo mirará el front — **nunca por el texto**. Es hermano de `albaran_cambiado` (fase 1) y se
distingue de él a propósito: la acción que le toca al front es otra.

**🔴 La respuesta va SIN `message`, y es deliberado.** El texto que lee el PROFESIONAL lo aprueba el
asesor (regla 30) y **no está aprobado**. El dashboard cae a su texto de siempre —«No se pudo
guardar el albarán.»—, que es **cierto**: no se guardó. Un test exige que `message` siga sin existir,
para que nadie cuele por aquí un texto sin aprobar.

### PROPUESTA de microcopy — PARA, no se implementa

Para cuando el asesor la vea. Lo difícil: decirle al profesional que su trabajo **no** se ha
guardado sin que suene a fallo del programa, y **sin sugerirle que lo vuelva a pegar encima**.

> *«Otra persona ha guardado cambios en este albarán mientras lo tenías abierto. Vuelve a abrirlo
> para ver cómo está ahora.»*

Queda **sin implementar** hasta que se apruebe.

## 6 · Verificación

| | Qué | |
| --- | --- | --- |
| **🔴 EL TEST QUE DECIDE** | dos ediciones a la vez → la segunda **rechaza**, y nada se pierde | ✅ |
| **🔴 CONTROL POSITIVO** | con la versión al día se guarda **igual que hoy**, sin fricción | ✅ |
| **🔴 SUELO** | sin versión **no se escribe** (10 formas + control de que la buena pasa) | ✅ |
| **ORDEN** | la comparación va **antes** del incremento, medido por posición | ✅ |
| **UNA SOLA REGLA** | `puedeEditarEstaVersion` delega; no hay segunda implementación (AST) | ✅ |
| **REGRESIÓN** | el camino de firma pública **no cambia**: su comparación y sus 5 prohibiciones de hash siguen | ✅ |

### Los rojos por el mecanismo — cada uno probado EN ROJO, con su post-condición

| Mutación | Cae diciendo |
| --- | --- |
| se quita la comparación del PATCH | *«UNA EDICIÓN PISA A OTRA EN SILENCIO: el PATCH no compara la versión que trae el editor»* |
| se mueve la comparación detrás del `update` | *«la comparación está DESPUÉS de la escritura: para cuando se comprueba, la edición de la otra persona ya se ha perdido»* |
| se reimplementa la comparación | *«`puedeEditarEstaVersion` YA NO DELEGA … ahora hay DOS reglas de versión en el árbol»* |
| el dashboard deja de mandar la versión | *«el editor del dashboard NO manda la versión que abrió»* |
| la versión ausente se da por buena | *«se acepta escribir con version=undefined contra la v:3 real»* |
| el mecanismo bloquea siempre | *«con la MISMA versión (v:1) no deja guardar … este mecanismo se desactivará al primer roce»* |

Los tests: `tests/scrum361-version-al-editar.test.mjs`.

## 7 · Lo que NO se ha tocado

El sellado, las recetas, el verificador y `albaranFirmante.ts` —**ningún hash, y ninguna línea del
mecanismo de firma**—; `prisma/schema.prisma`; el guard de la página pública, que sigue prohibiendo
`crypto.subtle`, `computeAlbaranContentHash`, `sha256` y `digest(`; la cola y el encolado (H3); el
almacén local (H5); y la resolución de conflictos ya ocurridos.

**Sigue abierto y es otro carril:** que un albarán **enviado a firmar** todavía se pueda editar (§7
de la fase 1). Esta fase no lo cambia — solo hace que dos editores no se pisen.

## 8 · Huecos declarados

* **No se ha verificado en `yaqu.app`**, ni en navegador. Lo construido se prueba con la suite; el
  camino real —dos pestañas de verdad contra producción— **no se ha ejercitado**.
* **La microcopy está propuesta, no aprobada**, así que hoy el profesional lee «No se pudo guardar
  el albarán.»: cierto, pero no le dice que fue otra persona.
* **Hallazgo de otro carril (regla 37), NO arreglado:** diez ficheros de `public/dashboard/js/`
  tienen el blob guardado en **CRLF** mientras el `core.autocrlf=true` del Git de Windows normaliza
  a LF al commitear. Resultado: cualquier cambio de una línea en uno de ellos produce un diff del
  fichero entero — ya pasó en `9c2c69ef` (SCRUM-446), **5144 líneas**. Aquí se ha evitado guardando
  ese fichero con su formato original, así que el diff son 9 líneas y no 5147. Arreglarlo de verdad
  es una normalización que toca ficheros de otras tareas y merece su propio ticket.
