# SCRUM-1650 · Lectores que pintaban el cliente VIVO donde el documento lo lleva congelado

Partición de SCRUM-1595 (los 5 sitios LIBRES de la medida de S1 en SCRUM-1595 c.21337). Este tramo
construye **2 de los 5**; los otros 3 se paran por el matiz del propio ticket (abajo).

## 2026-11-03 · Listado de albaranes y buscador leen lo congelado

**Medido contra:** `origin/main` = `70eefc40cba2eb9636992b733223bf1555c1755f` · 2026-11-03T07:43:06Z (hora de GitHub, `api.github.com/zen`)

A9: comprobación → `tests/scrum1650-listado-y-buscador-leen-el-cliente-congelado.test.mjs`

### ① Qué se ha construido

| # (c.21337) | sitio | qué cambia |
|---|---|---|
| 1 | `albaranesListado.ts` (columna «cliente») + los dos `select` de `albaranes.routes.ts` (admin y técnico) | pide `customerName`/`customerLegalName` y pinta con `clienteDelDocumento`; borrador (columnas a NULL) → ficha de hoy, como antes |
| 7 | `search.routes.ts` (facturas) | pide `customerName` y pinta `customer.name` con `clienteDelDocumento`; la columna cruda no viaja, la forma de la respuesta no cambia. Se sigue BUSCANDO por la ficha viva (eso es encontrar, no pintar: clase c de 1576) |

- Sin esquema, sin ALTER, sin texto nuevo. Nada del camino de emisión: en `albaranes.routes.ts` sólo
  se tocan los `select` del listado (`GET /`), y en la MISMA línea que ya existía, para no mover los
  números de línea del resto del fichero.
- El tipo `LectorListado` exige las dos columnas: un lector que no las pida no compila.

### ② Lo que NO se ha construido, y por qué (los 3 restantes alimentan al FIRMANTE)

El ticket dice: «Si el arreglo cambia de dónde sale el nombre PRECARGADO del firmante, eso toca lo
que se sella: se para y se pregunta antes de construir esa línea». Medido hoy, eso no le pasa sólo
al #3:

| # | sitio | por qué se para |
|---|---|---|
| 2 | `albaranes.routes.ts` `GET /:id` → `customer.name` | la pantalla de firma presencial lo usa como sugerencia del firmante: `albaranDetailView.js:780` (`firmante: { sugerencia: alb.customer.name }`) → `signaturePad.js:120` lo escribe en el campo del nombre |
| 3 | `albaranPublic.routes.ts` `loadContext` | `firmanteCamposHtml(customerName)` (:291) precarga el firmante; y sólo cambiar el saludo haría que la página dijera un nombre y su PDF (#4 de 1595, STOP, lee la ficha viva) otro |
| 4 | `precarga.service.ts` (`clienteNombre`) | su propio comentario: «es la sugerencia de un toque del firmante (SCRUM-300)» |

La medida de c.21337 sólo vio el matiz en el #3. **Los tres esperan la misma respuesta:** ¿el nombre
sugerido al firmante sale del albarán congelado o de la ficha de hoy?

### ③ Pruebas

- Test nuevo, por las rutas reales de `dist/` con el `select` proyectado como Prisma (lo que no se
  pide no viaja): listado como admin y como técnico (los dos lectores) y buscador.
- **Control positivo:** sin el arreglo en `src/` (stash + build), **3/3 rojos** con su mensaje;
  con el arreglo, 3/3 verdes.
- **Mutante** en `dist` (`delDocumento?.legalName || customer?.legalName || …`: la razón social de
  hoy colándose por el hueco de un congelado sin ella): cae el caso del albarán A-2 en los dos roles.
- Vecinos: scrum301, 1483, 1489, 1576, 1576b, 729, 577 → 79 tests, 78 ok, 0 fallos, 1 salto
  declarado (scrum1489 «CON BASE», sin `LIBRO_PG_URL`: corre en el obligatorio del CI).

## 2026-11-10 · Tramo b — la sugerencia del firmante sale de lo congelado (#2, #3, #4)

**Medido contra:** `origin/main` = `d7fb55ea19b825a26f89bf5b4765c2557eeb3a71` · 2026-11-10T16:55Z (hora de GitHub, cabecera `Date:` de `api.github.com/zen`)

A9: comprobación → `tests/scrum1650b-la-sugerencia-del-firmante-sale-de-lo-congelado.test.mjs`

**El GO.** Los tres sitios de este tramo estaban parados (§② de arriba) porque alimentan el nombre
que se le PROPONE al firmante, y ese nombre acaba sellado en «Firmado por». El fundador lo autorizó
el 10-nov-2026 en la sesión del orquestador: a la pregunta «El arreglo: que ese nombre salga de lo
que quedó CONGELADO en el albarán al emitirlo. Como toca lo que acaba sellado en un documento
firmado, la norma de la casa exige tu OK explícito. ¿Lo doy?» eligió «Sí, adelante (Recomendado)».
Localizador: respuesta a AskUserQuestion («OK albarán»), turno `type:user` de la transcripción
`ed676fd1-feb4-4658-bda2-01f4bf9fb3fc.jsonl` del orquestador, sello local 2026-11-10T16:55:24Z;
S1 lo leyó en la transcripción antes de construir. **Alcance del GO:** ese cambio y nada más del
camino de sellado.

### ① Qué se ha construido

| # (c.21337) | sitio | qué cambia |
|---|---|---|
| 2 | `albaranes.routes.ts` `GET /:id` | `customer.name` sale de `clienteDelDocumento(albaran, ficha)`. `id` y `puedeRecibirWhatsApp` siguen saliendo de la ficha: son a QUIÉN se escribe hoy, no lo que el documento lleva escrito. El fichero **no cambia de número de líneas** (el import se amplía en su misma línea): hay anclas por línea hacia él |
| 3 | `albaranPublic.routes.ts` `GET /:token` | `customerName` (saludo, «Gracias, …» y el valor precargado de `firmanteCamposHtml`) sale de `clienteDelDocumento`. Saludo y sugerencia siguen siendo LA MISMA variable: separarlos haría que la página dijera dos nombres |
| 4 | `precarga.service.ts` `construirPaquetePrecarga` | el `select` pide `customerName`/`customerLegalName`; `clienteNombre` sale de `clienteDelDocumento`. Sin columna ni ficha, la cadena vacía de antes |

- Un albarán anterior al escritor (columnas a NULL) cae a la ficha de hoy: es la excepción DECLARADA
  de `clienteCongelado.ts`, y la regla se llama, no se copia. Un borrador lleva las columnas a NULL
  y en la ficha (`GET /:id`) sigue enseñando la ficha de hoy, como antes; la página pública y la
  precarga sólo atienden albaranes `emitido`.
- No se toca el POST de la firma: el nombre sellado es el que MANDA el firmante. Sin esquema, sin
  ALTER, sin texto nuevo, sin nada del camino de emisión (`emitInvoice` de `albaranes.routes.ts`
  no se toca, y la línea del import cambia sólo para añadir un nombre).

### ② Lo que queda leyendo la ficha viva (NO tocado, y por qué)

| sitio | por qué no |
|---|---|
| PDF del albarán, `albaran.service.ts:642` y `:801` | #4 de SCRUM-1595 (STOP): entrada de lo sellado. **Consecuencia que hay que saber:** si se renombra la ficha entre la emisión y la firma, ahora la página dice el nombre del albarán y el PDF dice el de hoy. Antes decían los dos el de hoy (los dos mal, pero iguales). Se cierra con ese #4, no aquí |
| WhatsApp del albarán, `albaranWhatsApp.service.ts:51` y `:122` (variable `customerName` de la plantilla) | fuera de los 5 de este ticket; carril S1, pero toca un envío a Meta (plantillas = STOP AA1.4). Se anota, no se arregla de paso |

### ③ Pruebas

- Test nuevo: las rutas y el servicio REALES de `dist/` con la base doblada, y el `select`
  proyectado como Prisma. Cinco casos: #3 congelado y anterior, #2 congelado y anterior, #4 los dos.
- **Control positivo:** con los tres ficheros de `src/` como en `origin/main` (build), **3 rojos**
  (los tres congelados), cada uno con su mensaje; los 2 controles «anterior al escritor», verdes.
  Con el arreglo, 5/5.
- **Mutante** en `dist` (quitar `customerName` del `select` de la precarga, que es justo el olvido
  que el doble proyectado tiene que cazar): cae el #4.
- Vecinos (77 ficheros que nombran estos tres ficheros, `clienteCongelado` o 1650): 638 tests,
  636 ok, 0 fallos, 2 saltos declarados (scrum127 y scrum49, sin `QA_DB_TEST` ni `LIBRO_PG_URL`:
  corren en el obligatorio del CI; scrum49 es la firma remota de punta a punta).


---

## Tramo c · PDF y WhatsApp del albarán leen lo congelado — S1, 10-nov-2026

**Rama:** `scrum-1650c-pdf-y-whatsapp-leen-lo-congelado` · base `origin/main` @ `d4ecb38a8`.

### ⓪ La firma, leída en la transcripción (no en el resumen)

- **Sí del fundador**, LITERAL: «si firmo todo dale que mas falta que te diga». Transcripción del
  orquestador `ed676fd1-feb4-4658-bda2-01f4bf9fb3fc.jsonl`, línea 54744, `2026-11-10T17:31:49.539Z`,
  uuid `5e195baf-b306-4147-8967-b6dd11aea3ea`, `origin.kind: "human"`, `humanTurn: true`.
- **Mensaje al que responde** (línea 54716, `17:29:38.750Z`, uuid `cf45697e…`), su pie, literal:
  «① extender tu «sí» de hoy al PDF y al WhatsApp del albarán (mismo arreglo, dos sitios más)».
- Registro de la firma: SCRUM-1656 c.21408 punto ⑤. La rectificación c.21411 anula el máster y el
  flag, **no** este punto (lo dice ella misma: el mensaje contestado SÍ contenía las tres pendientes).

### ① Lo construido (sólo la FUENTE del nombre; plantilla de Meta, canal y texto intactos)

| # | sitio | qué cambia |
|---|---|---|
| 1 | `albaran.service.ts` `ensureAlbaranPdf` (lectura de `:801`, uso en el `contenidoSegunVersion`) | **sin firmar** (`evidenciaFirma.v` ausente): el cliente del papel sale de `clienteDelDocumento` (`legalName \|\| name` del albarán). **Firmado**: manda el sobre, como antes — v:3 su bloque congelado, v:1/v:2 las fuentes vivas con que se sellaron (su hash se recalcula con ellas) |
| 2 | `albaranWhatsApp.service.ts` `sendAlbaranFirmadoWhatsApp` (`:51`) | `select` pide `customerName`; «Hola {{1}}» sale de `clienteDelDocumento(...).name` |
| 3 | `albaranWhatsApp.service.ts` `sendAlbaranParaFirmarWhatsApp` (`:122`) | igual, para la plantilla **y** para el texto de ventana (`nombreCliente`, misma función: dos nombres en el mismo envío serían el defecto otra vez) |

- Columnas a NULL (anterior al escritor) → ficha de hoy: la excepción DECLARADA de
  `clienteCongelado.ts`, llamada, no copiada. El fallback `'cliente'` de siempre, sin tocar.
- El **número** sigue saliendo de la ficha (`canalDeWhatsApp`): el GO es el nombre.
- Sin esquema, sin ALTER, sin texto nuevo, sin tocar `whatsappTemplates.ts` (J2) ni `whatsapp.ts` (J2).

### ② Lo que NO se ha tocado, y por qué — 🔴 premisa del encargo corregida

| sitio | por qué no |
|---|---|
| `albaran.service.ts:642` (`buildFirmaEvidencia`) | **No es el PDF: es el contenido SELLADO de la firma** (`cliente` del bloque congelado v:3 y del hash). Su comentario (SCRUM-577) y `scrum371` lo sujetan al barrido (`albaranBarrido.ts`) con el MISMO texto, y `scrum577` fija que sigue sin unificar. La firma cubre «PDF y WhatsApp»; el sello es otro asunto y otra decisión |
| `taxId` del cliente en el PDF (`customer: { taxId }`) | el GO es el nombre; SCRUM-452 lo declara vivo a propósito (el sello no lo nombra) |

**Consecuencia que hay que saber** (la deja abierta el `:642`): si se renombra la ficha ENTRE la
emisión y la firma, el PDF sin firmar, la página pública (1650b) y los dos WhatsApp dicen el
nombre del albarán; al firmar, el sello v:3 congela el nombre de la ficha de ESE momento y el PDF
firmado imprime ése. Cerrarlo es cambiar la fuente del sellador (y el barrido a la vez): pide su
propio GO.

### ③ Pruebas

- Test nuevo `tests/scrum1650c-pdf-y-whatsapp-del-albaran-leen-lo-congelado.test.mjs`: el servicio
  REAL de `dist/` con la base doblada (`_envio-doblado.mjs`, `select` proyectado) y Meta en dry-run.
  Se mira lo que de verdad se pasa al emisor (`sendWhatsAppTemplate` / `sendWhatsAppWindowFirst`,
  envueltos y llamados de verdad: los guards corren) y el TEXTO del PDF real (`_pdf-texto.mjs`).
  Seis casos: 2 WA congelado, 2 WA/PDF anterior al escritor, PDF sin firmar congelado, y PDF de un
  firmado v:1 (sigue imprimiendo lo vivo).
- **Control positivo (rojo primero):** con `src/` como en `origin/main`, **3 rojos** por su motivo
  (los tres enseñan la ficha de hoy); los 3 controles, verdes. Con el arreglo, 6/6.
- **Mutantes en `dist`** (con BASE sin mutar en verde, 6/6): `select` sin `customerName` → caen los
  2 WA · PDF congelado también firmado → cae el v:1 · PDF sin el arreglo → cae el sin firmar.
- Tanda completa: la mató la MEMORIA de la máquina a 4.656 ok / 68 saltos. 8 `not ok`: 5 a nivel de FICHERO (1571c, 1589, 1596b, 1598, 1599g), los cinco VERDES aislados después (procesos muertos por la memoria, no fallos); y 3 ajenos, ninguno importa lo tocado: `scrum1266b` (vista del parte en vm, `partes.routes` no importa `albaran.service` ni `albaranWhatsApp`; NUEVO, no es de los conocidos de SCRUM-1655), `scrum1321` 1b (SCRUM-1655) y `scrum1540` (clon de git sin fetch, entorno). Vecinos aislados, verdes: scrum577 9/9 · scrum371 16/16 · scrum1650b 5/5 · scrum1632c 8/8. El resto lo mira el obligatorio del CI.
