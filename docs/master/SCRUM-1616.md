# SCRUM-1616 · La provincia en pantalla y la grafía oficial de las 52 — medición y propuesta para firma

## J4 · SCRUM-1616 · la grafía contra el INE y dónde se preguntaría

**Medido contra:** `origin/main` = `77ce98573b1b5e090dfcf7754c4e7960bc63b85a` · 2026-10-27T15:28:57Z (hora de GitHub; sesión J4 `jv-j4at`, por encargo del orquestador `cobroflash-backend-8b`. Rama `scrum-1616-provincia-grafia`. Sólo lectura: no se toca código, ni esquema, ni texto de usuario)

A9: sin fallo que generalice — la medición es un cotejo de lista contra fuente y salió con su control sembrado; el hallazgo que sí generaliza (las dudas de c.19338 eran las correctas y las cuatro erróneas no estaban en la lista de dudas) es del texto escrito de memoria en 1522e, no de este tramo

**J4 propone y no construye.** De aquí no sale ninguna línea de `src/`, `public/` ni `prisma/`.

### Fuente

- **INE, «Relación de provincias con sus códigos»**: `https://www.ine.es/daco/daco42/codmun/cod_provincia.htm`, descargada el 2026-10-27 a las 15:27:26Z (cabecera `Date:` de la respuesta), 28.144 B, ISO-8859-1, sha256 `5129d5ae9739a7822f3f8d421db2463d5c2fba9ff5e061ff1de16c046d999178`. La página no lleva fecha de actualización propia.
- **BOE: NO descargado.** Las leyes que fijan las denominaciones oficiales bilingües no se han leído; la columna «oficial» es la del INE.
- **52 filas en el INE = 50 provincias + Ceuta (51) + Melilla (52).** Ceuta y Melilla cuentan: el INE les da código en la misma tabla, y la del código también las lleva (52 filas, comentario «Las 50 provincias, Ceuta y Melilla»).

### ① La grafía: código de hoy (`src/modules/auth/domain/zonaDeLaProvincia.ts`) contra el INE

Cotejo con node, fila a fila por código INE. El INE pospone el artículo para ordenar («Coruña, A»); el cotejo lo pone delante («A Coruña») y cuenta eso como la misma grafía. **Control sembrado:** cambiar `Burgos` por `Burgoss` en una copia del fichero da `09 · FALTA` y `Burgoss` como no casada; sin la siembra, 0 no casadas.

**Resultado: 48 ✅ · 4 ❌. Las 4 ❌ son bilingües oficiales de las que el código sólo lleva la mitad castellana.**

| INE | Código hoy | Forma oficial (INE) | ✅/❌ | Cooficial |
| --- | --- | --- | --- | --- |
| 01 | Álava | Araba/Álava | ❌ | sí |
| 02 | Albacete | Albacete | ✅ | |
| 03 | Alicante | Alicante/Alacant | ❌ | sí |
| 04 | Almería | Almería | ✅ | |
| 05 | Ávila | Ávila | ✅ | |
| 06 | Badajoz | Badajoz | ✅ | |
| 07 | Illes Balears | Balears, Illes | ✅ (artículo delante) | sí |
| 08 | Barcelona | Barcelona | ✅ | |
| 09 | Burgos | Burgos | ✅ | |
| 10 | Cáceres | Cáceres | ✅ | |
| 11 | Cádiz | Cádiz | ✅ | |
| 12 | Castellón | Castellón/Castelló | ❌ | sí |
| 13 | Ciudad Real | Ciudad Real | ✅ | |
| 14 | Córdoba | Córdoba | ✅ | |
| 15 | A Coruña | Coruña, A | ✅ (artículo delante) | sí |
| 16 | Cuenca | Cuenca | ✅ | |
| 17 | Girona | Girona | ✅ | sí |
| 18 | Granada | Granada | ✅ | |
| 19 | Guadalajara | Guadalajara | ✅ | |
| 20 | Gipuzkoa | Gipuzkoa | ✅ | sí |
| 21 | Huelva | Huelva | ✅ | |
| 22 | Huesca | Huesca | ✅ | |
| 23 | Jaén | Jaén | ✅ | |
| 24 | León | León | ✅ | |
| 25 | Lleida | Lleida | ✅ | sí |
| 26 | La Rioja | Rioja, La | ✅ (artículo delante) | |
| 27 | Lugo | Lugo | ✅ | |
| 28 | Madrid | Madrid | ✅ | |
| 29 | Málaga | Málaga | ✅ | |
| 30 | Murcia | Murcia | ✅ | |
| 31 | Navarra | Navarra | ✅ | |
| 32 | Ourense | Ourense | ✅ | sí |
| 33 | Asturias | Asturias | ✅ | |
| 34 | Palencia | Palencia | ✅ | |
| 35 | Las Palmas | Palmas, Las | ✅ (artículo delante) | |
| 36 | Pontevedra | Pontevedra | ✅ | |
| 37 | Salamanca | Salamanca | ✅ | |
| 38 | Santa Cruz de Tenerife | Santa Cruz de Tenerife | ✅ | |
| 39 | Cantabria | Cantabria | ✅ | |
| 40 | Segovia | Segovia | ✅ | |
| 41 | Sevilla | Sevilla | ✅ | |
| 42 | Soria | Soria | ✅ | |
| 43 | Tarragona | Tarragona | ✅ | |
| 44 | Teruel | Teruel | ✅ | |
| 45 | Toledo | Toledo | ✅ | |
| 46 | Valencia | Valencia/València | ❌ | sí |
| 47 | Valladolid | Valladolid | ✅ | |
| 48 | Bizkaia | Bizkaia | ✅ | sí |
| 49 | Zamora | Zamora | ✅ | |
| 50 | Zaragoza | Zaragoza | ✅ | |
| 51 | Ceuta | Ceuta | ✅ | |
| 52 | Melilla | Melilla | ✅ | |

**Las siete dudas de c.19338 ①** (Bizkaia, Girona, A Coruña, Gipuzkoa, Illes Balears, Ourense, Lleida): **las siete coinciden con el INE**. Las cuatro ❌ no estaban en esa lista de dudas.

⚠️ **Consecuencia en el servidor si se pintan las formas dobles:** `zonaDeAlta` compara el nombre «plano» (sin tildes ni mayúsculas). Si la pantalla manda `Valencia/València`, sale `valencia/valencia` y hoy **no casa → `provincia_desconocida`**. Pintar la forma oficial obliga a tocar la tabla (J3).

### ② Dónde se pregunta — rutas leídas con `git ls-tree origin/main`, carril con `node scripts/carriles.mjs de`

| Pantalla | Ruta real | Carril | Hoy pregunta provincia | Lo que importa |
| --- | --- | --- | --- | --- |
| Registro | `public/register.html` | J3 | ❌ (pregunta País: MX, CO, ES, AR, PE, CL) | **La ruta está CERRADA** desde el 8-oct (`auth.routes.ts:44`, SCRUM-1515): contesta 409 `registration_closed` a todo. Una pregunta aquí no la leería nadie. |
| Alta real | `src/modules/auth/app/cli/altaDeMerchant.ts` | J3 | ✅ `--provincia`, obligatoria con ES | Es el **único** llamador de `registerMerchant` en `src/` (barrido de `merchant.create(`: los otros tres están en `scripts/` de siembra y medición). Todo comercio ES nacido desde 1522e ya tiene zona. |
| Arranque guiado | `public/dashboard/js/onboardingView.js` | J3 | ❌ | El país sólo se ENSEÑA (SCRUM-1536g, decisión (a)). El comercio ya existe cuando llega aquí. |
| Ajustes | `public/dashboard/js/settingsView.js` | J3 (contenedor) | ❌ | País sólo se LEE (SCRUM-1536g). La pregunta foral sí está (línea 338). |
| Validación | `src/core/validation/schemas.ts` | **S1 (equipo de Luis)** | ❌ | `merchantProfileUpdateSchema` no admite ni `provincia` ni `timezone`. |

**Lo que esto cambia del enunciado:** con el registro cerrado y el alta por consola exigiendo provincia, **hoy no hay ningún comercio de España que pueda nacer sin zona**. La pantalla sólo hace falta para: (a) los comercios anteriores a 1522e que siguen a `NULL` (c.19297 dijo «no se tocan los NULL»), (b) quien se mude de provincia, y (c) el día que se reabra el registro. Si ninguna de las tres le importa hoy al fundador, el ticket se queda en la grafía.

**Textos firmados (c.19338) y su estado hoy:** 1 «¿Dónde trabajas?», 2 «Elige tu provincia», 6 «Elige tu provincia para continuar.» → firmados y construibles. 5 «Usaremos la hora peninsular.» → firmado, con la salvedad de c.19338 ② (se lo diría a Illes Balears, Ceuta y Melilla). 4 (hora de Canarias) → **retirado** por el fundador en SCRUM-1522 c.20850. Ninguno de los seis aparece hoy en `public/` ni `src/` (grep de «Usaremos», «Elige tu provincia», «Dónde trabajas»: 0).

**Canarias:** elegir Las Palmas o Santa Cruz de Tenerife hoy no crea el comercio: `territorioDeAlta.ts:70` lanza `territorio_excluido` con el texto firmado en SCRUM-1536 c.20225, «De momento YaQu no está disponible para trabajos en Canarias.». Las forales (01, 20, 31, 48) **no** se excluyen por provincia de trabajo, sólo por domicilio fiscal.

**Quien no es de España:** la pantalla de hoy no tiene nada que enseñarle. `zonaDeAlta` **rechaza** una provincia con otro país (decisión 3 de c.19314). Propuesta: el campo sólo se pinta con país `ES`; con otro, no se pinta ni se manda.

### ③ El servidor y el esquema (sólo leídos)

- `schemas.ts` (S1): **sin cambio** si la provincia sólo se pide en el alta. Si Ajustes la deja cambiar, `merchantProfileUpdateSchema` necesita un campo nuevo → **petición a S1 por Jira**, cruza de equipo.
- `zonaDeLaProvincia.ts` (J3): si se firman las formas dobles, la tabla tiene que aceptarlas. Propuesta más robusta: que la pantalla mande el **código INE** (`01`…`52`) y no el nombre; así la grafía que se pinta y la que se compara dejan de ser la misma cadena.
- `prisma/schema.prisma`: `Merchant` tiene `timezone` y `country`, **no tiene provincia**. Ajustes no podría ENSEÑAR la provincia elegida (de `Europe/Madrid` no se deduce cuál de las 50). Si se quiere enseñar o editar, hace falta un **ALTER aditivo** (`merchants.provincia`, texto o código INE, nulable). **Se dice y no se hace** (regla 40, A5).

### Preguntas para el fundador (✅/❌)

1. Las 48 de la tabla tal cual (con el artículo delante: A Coruña, Illes Balears, La Rioja, Las Palmas). ✅/❌
2. Las 4 bilingües con la forma doble del INE: «Araba/Álava», «Alicante/Alacant», «Castellón/Castelló», «Valencia/València». ✅/❌ (❌ = se quedan en castellano, y entonces no son la forma oficial)
3. Ceuta y Melilla en la lista. ✅/❌
4. La provincia se pregunta SÓLO en el alta (consola hoy), como el país, y no en el arranque guiado ni en Ajustes. ✅/❌
5. Si 4 es ❌: Ajustes la enseña y la deja cambiar → ALTER aditivo `merchants.provincia` + campo en `schemas.ts` (S1). ✅/❌
6. Con otro país, el campo no se pinta. ✅/❌
7. El literal 5 («Usaremos la hora peninsular.») se queda aunque lo vean Illes Balears, Ceuta y Melilla. ✅/❌

### Lo que NO he medido

Ninguna base (cuántos comercios ES siguen a `NULL`: sin medir). yaqu.app. El BOE. La tanda de tests (no hay código que probar). Si el desplegable debe ordenarse como el INE o alfabéticamente por la forma con artículo delante.
