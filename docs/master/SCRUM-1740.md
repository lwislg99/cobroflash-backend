# SCRUM-1740 · el albarán que nace de un trabajo con parte FIRMADO trae sus líneas (mitad SERVIDOR)

**Medido contra:** `origin/main` = `e5145bc54e9709de09ac362a6d6c4d156bb32ac4` · 2026-11-17T17:19:39+00:00

**Forma decidida:** SCRUM-1740 c.21982 (orquestador, por la delegación general del fundador,
SCRUM-1656 c.21978). Al crear un albarán desde un trabajo cuyo último parte está FIRMADO, el
borrador nace PRE-CARGADO con las líneas de ese parte (concepto y cantidad; SIN precios — nace sin
valorar, como hoy); editable; sin parte firmado → vacío como hoy; nada se escribe en el parte; sin
esquema; sin textos. Misma puerta por rol que ya tiene el alta.

Reparto: **S1 = esta rama (el POST)**. La pantalla (usar la precarga desde la ficha y que
«+ Nuevo albarán» salga UNA vez) es de S2, en PR aparte detrás de éste.

## Qué cambia

- `src/modules/jobs/domain/albaranDesdeParte.ts` (nuevo, puro): `precargaDelParte(ultimo)` →
  `{ parteId, numero, lineas, omitidas }` o `null`. Línea de albarán escrita campo a campo:
  `concepto` = `descripcion` · `cantidad` = `unds` · `unidad` = `''` (el parte no la tiene). Cada
  línea pasa por `validarLineas` en SIN_VALORAR; la que no cabe (unds ≤ 0 o ilegibles, descripción
  vacía o > 300, más de 200) se OMITE y se cuenta.
- `POST /admin/jobs/:id/albaranes` (`jobs.routes.ts`): si el cuerpo NO trae la clave `lineas` y el
  modo es SIN_VALORAR (el de siempre), lee el último parte del trabajo (id mayor, del merchant) y
  precarga. La lectura va DESPUÉS de la puerta de pertenencia (404 al ajeno) y de la de precios
  por rol (SCRUM-1712), sin tocarlas. La respuesta añade
  `precargaDelParte: { parteId, numero, lineas: n, omitidas: n } | null`.

## Contrato (contado a S2 al casar su pantalla)

1. Sin `lineas` + SIN_VALORAR + último parte `firmado` → 201 con las líneas del parte, cero
   `precioUnitario`/`tipoIva`. Con `lineas` en el cuerpo (aunque sea `[]`) → como hoy, no se pisa.
   VALORADO → como hoy.
2. «Último parte» = el de **id mayor** del trabajo, y sólo si ESE está `firmado`. Si tras uno
   firmado hay otro en borrador → vacío. `facturado` no cuenta. **MI LECTURA** de «último»: la
   decisión no lo precisa; la alternativa (el último firmado, aunque haya un borrador después)
   precargaría líneas de una visita anterior a la que se está cerrando.
3. Hoy el front SIEMPRE manda `lineas` (`jobDetailView.js`, la hoja de alta), así que esta rama
   **no cambia nada visible** hasta que S2 haga el alta sin `lineas` en el flujo desde la ficha.

Caso raro, documentado y no arreglado: la clave de idempotencia compara `lineas`; un reintento que
cruce la firma del parte (1.ª petición sin parte firmado, reintento con él) cambia el contenido y
da el 409 `clave_reutilizada` de siempre.

## Rojo primero

`tests/scrum1740-albaran-nace-con-las-lineas-del-parte.test.mjs` — ① puro (siempre) y ② con banco
desechable (`LIBRO_PG_URL`, declarado en scrum419).

- **ROJO** (antes de tocar `src/`, banco `yaqu_1740_test` en 127.0.0.1:55740, esquema = main
  `b8fc4077c`): ① cae (el módulo no existe); ② cae con 7 fallos — el técnico y la jefa crean
  albarán **vacío** sobre un trabajo con parte firmado (el defecto de la fila 20 del H6) y no hay
  `precargaDelParte`. Lo que ya cumplía hoy pasa: vacío sin parte firmado, `lineas` explícitas
  respetadas, PATCH del borrador, 404 al técnico ajeno, fila del parte intacta.
- **VERDE** tras el cambio: 4/4.
- **Control por mutación** del «sin precios»: en `dist`, sustituir el validador por un spread que
  arrastra `precioUnitario`/`tipoIva` del parte → caen `🔴 ① control: ningún precio del parte en la
  fila del albarán` y `🔴 ② control: sin precios también para la jefa`. Recompilado después.
  (Nota: la RESPUESTA al técnico no lo cazaba sola, porque `albaranParaElRol` le quita precios;
  por eso el control mira la FILA.)

## Vecinos y guards

- 110 ficheros de test que tocan el alta / `albaranes` / `jobs.routes.ts`, con banco: **959/961**,
  2 saltos ajenos (`SERIE_PG_URL`, `TRAMOS_PG_URL`).
- Por el camino, tres rojos propios arreglados en el CÓDIGO o en su doble:
  - `scrum257` y `scrum303` invocan el handler real con un `prisma` de doble que no tenía
    `parteTrabajo` (500): el doble recibe `parteTrabajo.findFirst → null` (= sin parte, el alta de
    siempre). No se toca ninguna aserción.
  - `scrum358` busca `idempotencia }` en el cuerpo del alta: `idempotencia` sigue cerrando el objeto.
  - `scrum411` (exports sólo usados por su test, y su detector lee el nombre LOCAL de un import con
    `as`): el módulo quedó PURO, la ruta hace la lectura y llama a `precargaDelParte` sin alias.
  - `scrum237`: la negación «el ajeno no recibe Latiguillo» lleva su hermano positivo.
- `guards:entrada` 15/15 (un primer intento salió «ciego» por plazo, máquina cargada; relanzado,
  verde) · los 5 de árbol entero 38/38.

## Falta (regla 42)

Tras el merge: en yaqu.app, crear un albarán real desde un trabajo con parte firmado SIN `lineas`
→ nace con las líneas heredadas y sin precios. Hasta que S2 cablee la pantalla, se mide con la
petición directa (sesión QA). El ticket no se cierra con esta mitad: lleva también la de S2.

A9: comprobación → `tests/scrum267-ancla-de-medicion.test.mjs`
