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
