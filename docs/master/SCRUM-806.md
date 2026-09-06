# SCRUM-806 · El botón del cliente ya no lleva a la puerta del profesional

**Fecha:** 6-sep-2026 · **Carril:** producto · portal del cliente · **Gate:** sin gate
**Medido contra:** `origin/main` = `50312d327c0f7ddcf8a0670ab54c46407a7bba9d` · 2026-09-06T23:10:26+01:00
**Tanda:** TANDA_PENDIENTE

> Sale del hallazgo colateral de [SCRUM-799](SCRUM-799.md), donde se midió y **no** se arregló.
> Aquí se arregla, y lo que se toca es **adónde apunta** un enlace: ni un literal nuevo.

---

## Obligación 1 · el rojo, provocado primero — y una corrección al encargo

El encargo decía que el cliente se encontraba «un LOGIN de una aplicación que no es suya».
**Medido, es peor:** `requireAuth` no redirige a ningún login, responde JSON.

```
════ el cliente abre su portal (sin sesión) ════
   GET /cliente/<token> -> 200 text/html; charset=utf-8
   botón pintado: «📄 Ver PDF»  ->  http://localhost:4806/admin/quotes/365/pdf

════ 🔴 LO QUE VE EL CLIENTE AL PULSAR ════
   401 application/json; charset=utf-8
   cuerpo (29 bytes): "{\"error\":\"not_authenticated\"}"
   ¿es un PDF? NO 🔴
```

Veintinueve bytes de JSON, en la pantalla donde decide si firma. Ni una palabra en su idioma, ni
un botón para volver. **Y el rojo se provocó primero**, como pedía la obligación 1: se puso
`pdf_url` al valor que escribe la ruta de admin —el que deja cualquier apertura del PDF desde el
panel— y se abrió el portal sin ninguna sesión.

*Nota de seguridad de la propia medición:* el `href` lo construye el portal con `BASE_URL`, así
que el arnés **comprueba que apunta a su propio servidor local antes de seguirlo** y aborta si no.
Contra producción no se llama a nada, ni por accidente.

---

## Obligación 2 · el censo, por AST y sin lista cableada

**Por qué no se busca la cadena `/admin`:** el defecto no era un literal. Era `BASE_URL +
q.pdfUrl`, un valor que viene de la BD y que *resulta* ser una ruta de admin. Un censo de
literales no lo encontraría — o sea, **fallaría su propio control positivo**. Así que la pregunta
se dio la vuelta: ¿qué `href` del lado público **no se puede demostrar** que sean públicos?

Quién es público **se lee de `src/app.ts`**, no se escribe en el censo: la frontera es
`app.use('/admin', requireAuth)`, y todo montaje anterior es zona pública (25 montajes, 24
ficheros de router resueltos; 1 montaje queda detrás del guard y no se mira). Lo estático sale
igual, de los `express.static` del mismo fichero.

**53 `href` en el lado público. 6 no demostrables:**

| dónde | href | qué es |
|---|---|---|
| `customerPortal.routes.ts:305` | `${esc(pdfUrl)}` (presupuesto) | **el defecto de este ticket** |
| `customerPortal.routes.ts:350` | `${esc(pdfUrl)}` (factura) | el hermano — **declarado, no tocado** (abajo) |
| `payInvoice.routes.ts:132` | `${mm.href}` | **falso positivo de mi instrumento**: no sigue variables. Leídos, los cuatro valores son `/pay/card/…`, `/pay/bizum/…`, `/pay/bank/…` |
| `receipt.routes.ts:115` | `${esc(emlParam \|\| '')}` | un **parámetro de la URL** (`?eml=`) metido en un `href`. Sólo con `?mail=saved`. **NO medido** |
| `receipt.routes.ts:255` y `:261` | `${esc(reviewUrl)}` | URL de reseñas que pone el merchant. **NO medido** |

**Controles del censo:** ✅ positivo — encuentra el defecto conocido (`customerPortal.routes.ts:305`);
✅ negativo — `/pay/quote/${…}/accept` sale **público**, o sea que no marca todo lo que ve;
✅ frontera — los routers tras `requireAuth` quedaron fuera por estarlo, no por una lista.

Los tres últimos de la tabla **se declaran y no se tocan**: no los he medido, y registrar una
sospecha como si fuera un hallazgo es la manera de que nadie se crea el siguiente censo. `esc()`
escapa `&<>"'` y **no** filtra esquemas, así que los dos primeros merecen su propia medición.

---

## Obligación 3 · las dos salidas, y por qué la elegida es una mezcla

**Qué queda expuesto por ① — medido con marcas únicas en cada campo, no razonado:**

| campo | ¿sale en el PDF? | ¿lo enseñaba ya el portal? |
|---|---|---|
| `internalNotes` (del profesional) | **no** | no |
| `Customer.notes` (interno) | **no** | no |
| `Customer.internalRef` (interno) | **no** | no |
| `docHeaderText` / `docFooterText` | sí | no |
| NIF del cliente | sí | no |
| dirección del cliente | no | no |
| concepto de la línea | sí | sí |

✅ *Control positivo del detector:* el concepto de la línea sale en los dos sitios — si no viera
lo que sí está, la fila de los «no» no valdría nada.

**Ningún campo interno del profesional viaja dentro del PDF.** Lo que el documento añade sobre lo
que el portal ya enseñaba son los dos textos que el profesional escribió **para el documento** y
el NIF **del propio cliente**. No hay motivo para parar.

### La restricción que decidió la forma

El portal ya tiene doctrina propia y es de la casa: **SCRUM-85 y SCRUM-95 sacaron el id de los
botones** («token OPACO por presupuesto enviado — NUNCA el `quote.id`… la sexta puerta de la misma
fuga»). Una ruta `/…/:id/pdf` habría deshecho aquello para arreglar esto.

Así que la salida ① se construye **sobre el token que ya existe**: `Quote.decisionToken`,
16 bytes aleatorios, el mismo que este portal ya reparte en «Ver y responder» y que resuelve
`/pay/quote/:token`. **No se acuña ninguno nuevo**: se lee el que la fila ya tiene. Por eso ①
**no expone a nadie nuevo** — quien tiene ese token ya podía ver el presupuesto entero en la
landing de decisión.

Y donde ① no llega —un borrador que nunca se envió y por tanto no tiene token— se aplica ②: **el
botón no se pinta**. Que es mejor que pintarlo hacia un sitio donde el cliente no puede entrar.

---

## Obligación 4 · lo construido

- **`quoteDecisionLanding.routes.ts`** — `GET /pay/quote/:token/pdf`, en el router que YA resuelve
  por ese token y que YA está montado en zona pública. Arma el PDF por la **misma** puerta que la
  ruta de admin (`paramsDePresupuestoParaPdf`): si se armara por otra, serían dos documentos
  distintos con el mismo nombre.
- **`customerPortal.routes.ts`** — el botón deja de derivar de `q.pdfUrl` y apunta a
  `/pay/quote/${pdfToken}/pdf`.
- **`publicAccessDeclarations.ts`** — la ruta nueva, declarada `kind: 'token'`. No es opcional:
  lo exige SCRUM-98 y me cazó (abajo).
- **`tests/scrum243-tenencia-lectura.test.mjs`** — el censo de lecturas sin comprobación de
  merchant sube 2 → 3 en ese fichero, con el motivo escrito. También me cazó (abajo).
- **`tests/scrum806-el-pdf-del-portal.test.mjs`** — el guard (abajo).

**Ni un literal nuevo, y se declara lo que sí se ha escrito:** el botón conserva su texto
(«📄 Ver PDF»); lo único con forma de cadena que aparece son dos códigos de error que ya existen
en el repo (`not_found`, `internal_error`) y una cabecera `Content-Disposition` **idéntica** a la
que ya emite la ruta de admin para este mismo documento. Ninguna de las tres es texto que lea un
humano; si el asesor considera que la del nombre del fichero sí lo es, se quita y el navegador lo
nombra por la URL.

🔴 **La ruta nueva HEREDA SCRUM-799:** regenera el PDF en cada apertura, igual que la de admin.
Eso está medido y su salida es del fundador; aquí no se ha tocado ese mecanismo.

---

## Los tres controles

```
════ 🔴 EL QUE DECIDE — el cliente, sin sesión ════
   botón: «📄 Ver PDF» -> /pay/quote/b91af5ffcaa9b7a086cc96cf6d03bba9/pdf
   ✅ el enlace YA NO apunta a /admin
   ✅ el enlace NO lleva el id del presupuesto (SCRUM-95)
   pulsa -> 200 application/pdf · 1953 bytes
   ✅ el cliente RECIBE UN PDF (los dos sentidos pegados)
   ✅ y es SU documento (sale «Cliente A» dentro)

════ ✅ EL POSITIVO — el profesional autenticado ════
   GET /admin/quotes/367/pdf -> 200 application/pdf · 1953 bytes
   ✅ el profesional sigue viendo su PDF igual
   ✅ y es EL MISMO DOCUMENTO que recibe el cliente (mismo texto), no otro parecido

════ 🔴 EL DE SEGURIDAD — manda sobre los otros dos ════
   ✅ B tiene token tras abrir SU portal (si no, el control de fuga no compara nada)
   ✅ el id de OTRO merchant a mano  (/pay/quote/370/pdf) -> 404 sin PDF
   ✅ el id PROPIO a mano            (/pay/quote/369/pdf) -> 404 sin PDF
   ✅ un token inventado de 32 hex -> 404 sin PDF
   ✅ el token de A con un byte cambiado -> 404 sin PDF
   ✅ enumerando ids 1..40 salen 0 PDFs
   ✅ el token de B sirve el de B (es de su dueño: así debe ser)
   ✅ y el portal de A NO contiene el token ni el nombre de B por ningún lado
```

**El de seguridad se hizo con DOS merchants de verdad**, porque un control de fuga con uno solo no
compara nada. «Cambiar el id a mano» no es que esté prohibido: es que **no hay id que cambiar** —
`parseToken` deja pasar los dígitos (son hex), la consulta busca por `decisionToken`, y ninguno de
los 40 ids probados devuelve un solo byte de PDF.

*Confesión del arnés:* la primera pasada dio ese último bloque en rojo. No era el código: era que
el presupuesto de B **nunca había tenido token** porque nadie había abierto su portal, así que mi
control comparaba contra `null`. Se acuña como en el flujo real —abriendo el portal de B— y
entonces la comparación significa algo. Un rojo por el motivo equivocado vale tan poco como un
verde.

---

## DOS guards de la casa me cazaron, y los dos tenían razón

Ninguno de los dos falló por el arreglo: fallaron por lo que el arreglo **no declaraba**. Abrir
superficie pública nueva tiene dos peajes en esta casa, y me cobraron los dos.

### ① SCRUM-98 — la categoría de acceso

```
tests/scrum98-public-access-fail-closed.test.mjs:116
  actual: [ 'GET /pay/quote/:token/pdf' ]
  expected: []
```

SCRUM-98 es la red fail-closed de la superficie pública: **toda ruta montada antes de
`requireAuth` tiene que declarar su categoría de acceso**, y la mía no existía en
`publicAccessDeclarations.ts`. Nació justo de esto —«las seis puertas de la misma fuga se
descubrieron por tropiezo porque esa pregunta no tenía dueño»— y ha hecho exactamente su trabajo
sobre mí. Declarada como `kind: 'token'` / `Quote.decisionToken`, junto a las otras cuatro de la
familia, el guard vuelve a verde y dice: *«sin pendientes: toda la superficie pública está
clasificada»*.

### ② SCRUM-243 — la lectura sin comprobación de merchant

Y en la tanda siguiente saltó el otro:

```
✖ SCRUM-243 · las 44 excepciones SIN RED no crecen en silencio
  🔴 HAN APARECIDO LECTURAS SIN NINGUNA COMPROBACIÓN DE MERCHANT:
      src/modules/system/app/routes/quoteDecisionLanding.routes.ts (censo 2 → ahora 3)
```

Mi `findUnique({ where: { decisionToken } })` no filtra por `merchantId`. **Es legítimo y es la
misma categoría que las otras dos del mismo fichero** —quien abre esto no tiene sesión ni la
tendrá: es el cliente final desde su enlace— pero el guard no exige que sea ilegítimo, exige que
sea una **decisión escrita**. Que es exactamente lo que faltaba. El censo sube 2 → 3 con su
motivo, y el motivo cita la medición: cuatro formas de intentar alcanzar otra fila, las cuatro a
404, y 0 PDFs enumerando 40 ids.

Los dos guards son la misma idea aplicada dos veces: **una superficie pública nueva no se cuela
por ser correcta; hay que declararla.** Y los dos me cazaron a mí, no a un tercero.

### Y una tercera lección, de mi propio arnés

Esa tanda la lancé como `npm test | tail -12`. El código de salida de una tubería es el del
ÚLTIMO comando, así que la consola me dijo **`exited with code 0`** mientras dentro había un test
en rojo. Estuve a un renglón de cantar un verde que no existía. Las tandas de aquí en adelante se
corren redirigiendo a fichero y guardando `$?` aparte.

---

## El guard, y la prueba de que muerde

`tests/scrum806-el-pdf-del-portal.test.mjs`, 3 tests, dentro de `npm test` (mira la FORMA: el
200 exige servidor y base, y eso vive en la suite gateada).

```
[sin tocar]  VERDE ✅
[con la forma VIEJA] ROJO ✅ (el guard muerde)
   y lo DICE: el botón vuelve a salir de la columna `pdfUrl`, que la escribe la ruta de ADMIN:
[restaurado] byte a byte: si ✅
[tras restaurar] VERDE ✅
```

Su **suelo** es el botón de la FACTURA, que sigue derivando de `inv.pdfUrl`: sirve de control
positivo del extractor y, si algún día se arregla, el suelo se pondrá rojo — que es exactamente
cuándo queremos enterarnos.

---

## Lo que NO se ha corrido, y por qué

La suite gateada tiene un test vecino de esto —`A12.5d: regeneración on-demand (R8) ·
/admin/quotes/:id/pdf responde PDF SIEMPRE`— que en `npm test` sale **saltado**
(`# sin QA_DB_TEST=1`). Correrlo es `npm run test:staging:gated`, o sea **staging**, y eso está
prohibido en este encargo. Así que **no se ha corrido y se dice**, en vez de dejar que su salto
pase por verde. Su sujeto es la ruta de ADMIN, que este ticket no toca; el camino del cliente sí
se probó, con servidor y base de dev, en los tres controles de arriba.

---

## Lo que queda declarado y NO se toca

- **El botón «📄 Descargar factura» del mismo portal** sigue igual. Servirle esa factura al cliente
  pasa por `ensureInvoicePdf`, que es **camino de emisión** y está en la mesa del fundador
  (SCRUM-762). Existe ya una ruta pública de recibo (`/recibo/:token/pdf`) que podría ser la
  salida, pero elegirla es de quien tenga el 762 delante.
- **`P1-PORTAL-PDF` en `docs/BUGS.md`** se registró en la rama de SCRUM-799, que aún no está
  mezclada; por eso aquí no aparece y no se marca. Quien mezcle el segundo, que lo tache.
- Los dos `href` del recibo que el censo marcó: declarados arriba, **no medidos**.

## Prohibiciones del encargo, respetadas

- No se ha tocado el mecanismo de regeneración del PDF (SCRUM-799) ni la firma (SCRUM-805).
- `prisma/schema.prisma` intacto: esto no necesita ninguna columna.
- Ningún literal nuevo — con las tres cadenas técnicas declaradas arriba.
- Nada contra staging ni producción: todo en dev, con el guard de destino diciendo `cuadra`, y el
  arnés abortando si el enlace apunta fuera de su propio servidor. Base de dev igual antes y
  después en las tres pasadas (15 presupuestos → 15, 14 clientes → 14, 6 merchants → 6).
