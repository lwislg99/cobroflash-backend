# SCRUM-1231 · El logo es una imagen subida, no una dirección que elige el profesional

**Medido contra:** `origin/main` = `64dc3211d039cedece0cccf9fa3fcaf7d491319d` · 2026-10-01T13:01:52Z

A9: aviso → cicatriz S1 «Un mutante que rompe la sintaxis del fichero muere igual que uno que funciona.» — no se pudo comprobar: el mutante se fabrica a mano en cada tanda y no pasa por ningún guard

Sesión S1 (`s1-1octd`, relevo de `s1-1octc`) · carril: `src/core/validation/schemas.ts` y `src/app.ts`
(S1 por `dos-equipos.md` §3) · rama `scrum-1231-logo-solo-imagen-subida`.

## El defecto, y si existía HOY (PASO 0)

`merchantProfileUpdateSchema.logoUrl` era un `union` de dos ramas: `z.string().url()` y el data-URI de
la imagen subida. Seis páginas públicas pintan ese valor en un `<img src>` (Bizum, selector de pago,
albarán, portal, aceptación del presupuesto y perfil público): el navegador del **cliente final** iba
a un servidor elegido por el profesional. Decisión de Javier (28-sep-2026): solo imagen subida.

Comprobado contra `origin/main` antes de tocar: el `union` seguía ahí (se había movido de la línea
472 a la 457; el contenido, igual).

Las tres preguntas del PASO 0 del ticket:

| Pregunta | Medido |
|---|---|
| ¿Hay merchants con URL externa guardada? | **NO MEDIDO**: ningún árbol de trabajo tiene la base de producción (regla 3). Por eso el arreglo no depende de la respuesta (abajo). La consulta, para quien sí la tiene: contar `Merchant` cuyo `logoUrl` no empieza por `data:image/png`, `jpeg`, `jpg` ni `webp` |
| ¿Qué ofrece la pantalla? | `settingsView.js` ya NO tiene campo de pegar enlace: el `input` es `hidden` y solo lo rellena «Subir logo». **`public/admin.html` SÍ** conserva un campo de texto «Logo (URL opcional)» que hace `PUT /admin/merchant`: desde este cambio, una URL escrita ahí da 400. Reportado, no tocado |
| ¿Algo depende de que sea una URL? | No. Los seis `<img>` aceptan un data-URI, y `loadLogoBuffer` (PDF) ya trata `data:` |

## Lo que el ticket no decía, y salió al medir

1. **`z.string().url()` no era «http(s)».** Acepta cualquier esquema. Por esa rama entraba un `data:`
   de cualquier tipo y tamaño —saltándose el tope de 1,5M de la otra rama— y un `javascript:`.
2. **La cuenta demo guarda un `data:image/svg+xml`**, sembrado por `scripts/seed-demo.mjs` sin pasar
   por el esquema. Entraba por la rama `url()`. Configuración manda `logoUrl` **siempre**, con lo que
   cargó: quitar la rama sin más habría dejado a la demo (y a cualquier logo heredado) con un 400 al
   guardar **cualquier** ajuste — el defecto de SCRUM-1161 otra vez. Es el punto 1 del PASO 0, y por
   eso el arreglo tiene dos mitades.

## Arreglo

- `schemas.ts`: `logoUrl` queda en la rama del data-URI (`png`, `jpeg`/`jpg`, `webp`, ≤ 1,5M). Fuera el `union`.
- `schemas.ts`: `sinLogoHeredadoIntacto(body, logoGuardado)`. Un `logoUrl` **idéntico** al guardado se
  lee como «no lo ha tocado» y se retira del cuerpo: ni se valida ni se escribe. No acepta nada nuevo.
- `app.ts`, `PUT /admin/merchant`: si el esquema rechaza **por el logo**, lee `logoUrl` de la fila de
  `req.merchantId` y reintenta con el cuerpo sin el heredado intacto. El camino normal no hace ni una
  consulta más.

Sin texto nuevo en pantalla: el 400 es el `validation_error` de siempre.

## Test — `tests/scrum1231-logo-solo-imagen-subida.test.mjs` (7 casos)

Control positivo (las cuatro extensiones subidas entran, `null` quita el logo) · 7 formas de «no es
una imagen subida», ninguna entra · el tope no se rodea · el heredado intacto no tumba el guardado y
no se reescribe · cambiar a otra URL externa se rechaza · la función no muta ni toca lo ajeno · la
ruta usa las dos piezas y lee por `req.merchantId`.

Mutantes sobre `dist`, con la BASE sin mutar primero (7 ok, 0 fallos):

| Mutante | Resultado |
|---|---|
| M1 · vuelve la rama `url()` (lo que hay en `main`) | 3 ok, **4 caen** |
| M2 · nunca se retira el heredado | 5 ok, **2 caen** |
| M3 · se retira aunque no coincida | 5 ok, **2 caen** |

## El error propio

El primer M1 lo escribí mal y **rompía la sintaxis** de `schemas.js`: salió `not ok 1` a nivel de
fichero, 0 casos corridos. Leído deprisa es «el mutante muere». No medía nada: lo delató que `ok=0`.
Rehecho con el `union` de verdad. De ahí la cicatriz.

## De paso, en este PR (no es de este ticket)

- La lección y las cicatrices de SCRUM-1355 que quedaron fuera del repo: apéndice `SCRUM-1355b` y
  `docs/equipo/cicatrices/S1.md`.
- Una frase en A10, a petición del orquestador (medida por S2 en yaqu.app, presupuesto #203): «El
  `updatedAt` de una fila no es la versión de un trozo de esa fila». Las notas de un presupuesto se
  autoguardan y mueven el `updatedAt` de la fila, así que «Guardar plan» devolvía un 409 «versión
  superada» por la nota de la propia persona. Aviso de diseño para las 21 escrituras sin versión del
  censo de SCRUM-1285c; aquí no se cambia código por ello.

## Suelos

- ⚠️ **La ruta no se ejecuta en el test**: `app.ts` arranca el servidor entero. Se prueban sus dos
  piezas y, sobre el código sin comentarios, que la ruta las usa. La ruta de verdad se mira en
  yaqu.app tras el despliegue.
- ⚠️ **Esto cierra la ENTRADA, no lo ya guardado.** Un merchant con una URL externa guardada la sigue
  sirviendo en las seis páginas hasta que suba una imagen o se limpie la fila. Cuántos son, no medido
  (arriba). Las seis páginas son de varios carriles (S1, J2, J3): reportado en el ticket.
- Tanda **dirigida**, no completa: 11 ficheros, 100 casos, 0 fallos, 1 salto. El juez es el CI.

## SCRUM-1231b · `public/admin.html` pierde el campo «Logo (URL opcional)» (9-oct-2026)

**Medido contra:** `origin/main` = `85d8d01e64196569928b523c9074542d6ffbbd0a` · 2026-10-09T10:21:11Z
A9: sin fallo que generalice — el cambio es retirar un campo y lo midió la misma sonda antes y después; el único rojo de la tanda dirigida fue `scrum811c` pidiendo esta entrada, que es para lo que está.
**Rama:** `scrum-1231b-admin-sin-campo-de-logo` · commit del arreglo `704db561f33d60976eb2b04d97027c99ab3c6cc3`.
**Sesión:** S2 (`s2-9oct`, tercera tanda) · carril: `public/admin.html` es S2 (`node scripts/carriles.mjs de public/admin.html`; lo corrigió S1 en el ticket, c.18713). **Skill UI:** cargada (`yaqu-premium-ui`). Sección AÑADIDA: lo de S1, arriba, no se toca.

Es el «resto 2» que S1 dejó nombrado: la entrada del servidor quedó cerrada el 2-oct, y esta página
seguía ofreciendo pegar un enlace. `admin.html` es la consola interna (sin ruta desde el panel; la
sirve yaqu.app a quien tenga sesión).

### PASO 0 — qué pasa HOY si alguien usa ese campo (yaqu.app, build `85d8d01e`, cuenta QA)

La pregunta del encargo era ésa, porque de la respuesta dependía retirarlo o cambiarlo. Sonda
`docs/master/evidencias/SCRUM-1231/sonda-1231b-admin-logo.mjs`. **Los `PUT` de la página no salen
nunca:** la sonda pasa el cuerpo por el mismo esquema que el servidor (`dist` de `85d8d01e`, con la
lógica de `app.ts`) y contesta ella. Aparte, tres `PUT` directos al servidor de verdad, de una sola
clave, para atar ese veredicto a producción.

| lo que se hace | lo que viaja en `logoUrl` | servidor | lo que dice la página |
|---|---|---|---|
| se pega `https://example.com/logo.png` y se guarda | la URL | **400** | «Error al guardar cambios del merchant» |
| **se guarda sin tocar el campo** (la cuenta no tiene logo) | **`''`** (cadena vacía) | **400** | «Error al guardar cambios del merchant» |

Directos al servidor real: `{logoUrl: ''}` → **400** (`validation_error`) · `{logoUrl: 'https://example.com/logo.png'}`
→ **400** · **control positivo** `{}` → **200** (no cambia ningún campo; sin él, dos 400 no dirían
nada del logo). Al acabar, el logo de la cuenta QA sigue como estaba (`null`).

**Lo que eso decide:** el campo no puede guardar nada —una URL no entra desde SCRUM-1231, y nadie
escribe a mano un `data:` de un megabyte— y además, por viajar siempre, **tumbaba el guardado de todo
el formulario a quien no tiene logo**. Leído, no medido: tampoco es de ahora, porque `''` no es una
URL y la rama `url()` de antes de SCRUM-1231 tampoco la habría dejado pasar.
Se retira; no hay nada que cambiar por otra cosa. El logo se sube desde Configuración, que ya lo hace.

Para aislar el logo, la sonda rellena en la página (sin que salga nada) los cuatro campos que la
cuenta QA tiene vacíos; así el único motivo del 400 es `logoUrl`. Con la cuenta tal cual, el esquema
da 400 por cinco campos a la vez (ver «de paso»).

### El arreglo — tres retiradas en `public/admin.html`, ningún texto nuevo

El `form-row` del campo (etiqueta, `input` y marcador) · la línea que lo rellenaba al cargar · la
clave `logoUrl` del cuerpo del `PUT`. Sin la clave, el servidor no toca el logo guardado (ausente =
no se toca), sea una imagen subida o una URL heredada.

### Antes y después, misma sonda y mismos datos

| | cuerpo del `PUT` | veredicto del esquema | lo que dice la página |
|---|---|---|---|
| **ANTES** · `admin.html` de producción | lleva `logoUrl: ''` | 400 por `logoUrl` | «Error al guardar cambios del merchant» |
| **DESPUÉS** · `admin.html` de la rama servido | `logoUrl` NO VIAJA | lo aceptaría | «Cambios guardados correctamente» |

El «después» lo contesta la sonda (200) porque el `PUT` no sale: **el guardado real no se ha hecho.**
Salidas: `evidencias/SCRUM-1231/salida-1231b-antes-produccion.txt`, `salida-1231b-despues-rama.txt`
y `salida-1231b-despues-rama-sin-rellenar.txt`.

### Lo que lo vigila

`tests/scrum1231b-admin-sin-campo-de-logo.test.mjs` (3 casos; el HTML sin comentarios y el script por
AST): el formulario del perfil no tiene ningún control ni etiqueta de logo · el `payload` de
`saveMerchant` no lleva `logoUrl` · todo `getElementById('…')` del script existe en el marcado (quitar
un campo y dejar la línea que lo lee revienta al ejecutarse, no al cargar el fichero). Control
positivo, dos mutantes con su `git diff --numstat`: el `admin.html` de `origin/main` (`12 3`) tumba
los dos primeros; el campo fuera pero con la línea que lo lee (`1 0`) tumba el tercero. Rama: 3 de 3.

**¿Existía ya «la otra mitad»? No.** `tests/scrum1231-logo-solo-imagen-subida.test.mjs` (S1) ata el
ESQUEMA del servidor; no mira ninguna pantalla. Ningún test nombraba `merchant-logoUrl`. El test
nuevo mira SÓLO `admin.html`: Configuración (`settingsView.js`) no la he vuelto a medir; S1 la leyó
el 1-oct (campo oculto que sólo rellena «Subir logo»).

### Corrido en local, con su población

- Los 50 ficheros de `tests/` que leen HTML, marcadores o microcopy entre los 224 que
  `tests:que-cubren` selecciona para `public/admin.html`, más los dos que la nombran: 515 tests,
  514 pasan; el que cayó es `scrum811c`, que pedía esta entrada (se repite abajo, ya escrita).
- **La suite completa no se ha corrido en local** (memoria de la máquina). La corre el obligatorio.

### Lo que NO se ha hecho, dicho

- **Contar las URL externas ya guardadas en producción.** No es de una sesión: es la SELECT de
  c.18713, de quien tenga la base. Este cambio no las toca ni las cuenta.
- **El guardado real desde la página desplegada.** Pendiente tras el despliegue: la sonda sin
  argumento sobre yaqu.app → «hayCampo: false» y `logoUrl` «NO VIAJA».
- **De paso, sin arreglar y sin ticket** (mismo formulario, mi carril): la página manda `''` en cada
  campo vacío y el servidor rechaza cada una (`legalName`, `taxId`, `address`, `whatsappPhone`, y el
  prefijo de serie). Con la cuenta QA tal cual, el guardado sigue dando 400 después de este cambio,
  ya sin el logo entre los motivos. Configuración trata los cuatro primeros (y el nombre) como obligatorios y lo
  dice antes de guardar (`settingsView.js:1154`); aquí la página sólo dice «Error al guardar cambios del merchant». Arreglarlo es decir
  QUÉ falta, y eso es texto que ve el usuario: pide firma. No tiene víctima fuera de la consola.
