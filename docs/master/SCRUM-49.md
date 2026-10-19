# SCRUM-49 · Enviar el albarán para firmar a distancia

> El envío (plantilla `albaran_para_firmar_es`, `sendAlbaranParaFirmarWhatsApp`) es anterior a este
> registro y no tenía uno propio. Este fichero empieza con el tramo `49b`.

## SCRUM-49b · la ficha decía «enviado para firmar» aunque el WhatsApp no hubiera llegado

**Medido contra:** `origin/main` = `183895cdef71c5655a3978352b716a79e1ca2b2b` · 2026-10-18T17:59:35Z (hora de GitHub al escribir: 18:12:33Z)
A9: comprobación → `tests/scrum49b-albaran-estado-real-de-entrega.test.mjs`

Carril S1 (`src/modules/jobs/**`) · árbol `s1-49b` · rama `scrum-49b-albaran-estado-real-de-entrega`. Encargo del
orquestador (`cobroflash-backend-f3`), 18-oct-2026 ~18:00Z, tras una medida de S4. El número de ticket lo decide el
orquestador; va aquí porque es el envío de SCRUM-49.

### El defecto

`GET /admin/albaranes/:id` devolvía `enviadoParaFirma: true` con sólo mirar `enviadoParaFirmaAt`. Ese campo se
escribe ANTES de llamar a Meta (`albaranWhatsApp.service.ts`), y está bien escrito ahí: el token tiene que existir
antes del envío. Lo que estaba mal es leerlo como prueba de ENTREGA. La ruta no leía `WhatsAppMessage` ni una vez.

Medido por S4 el 18-oct: el fundador pulsó dos veces, las dos filas quedaron `failed · 131026` y la ficha decía
«enviado». El `{sent:true}` de la respuesta no es el fallo: Meta aceptó el mensaje y avisó del 131026 después, por el
webhook de estados. Al contestar el POST el fallo aún no existía.

### Qué cambia (sólo LECTURA; el envío no se toca)

- `src/modules/jobs/domain/entregaParaFirmar.ts` (nuevo): lee la última fila del envío «para firmar» del albarán y
  devuelve `{ estado, fallo, at }`:

  | `estado` | cuándo |
  | --- | --- |
  | `nunca_enviado` | sin `enviadoParaFirmaAt` (no se consulta nada) |
  | `entregado` | la última fila está `delivered` o `read` |
  | `aceptado` | la última fila está `sent`: Meta lo aceptó y aún no confirmó la entrega |
  | `fallido` | la última fila está `failed`. `fallo: 'en_el_acto'` si no tiene identificador de Meta (credenciales, baja, topes, plantilla inválida); `'despues'` si lo tiene (Meta lo aceptó y luego avisó, como el 131026) |
  | `sin_rastro` | hay marca de envío y ninguna fila que diga qué pasó (o una en `queued`) |
  | `no_se_pudo_leer` | la lectura falló |

- `albaranes.routes.ts`, `GET /:id`: añade `entregaParaFirmar`. **`enviadoParaFirma` no cambia** (dice que se
  intentó), ni `enviadoParaFirmaAt` de sitio.
- **Por qué filtra por la plantilla y no por la hora:** `relatedType: 'albaran'` lo comparten este envío y la copia
  FIRMADA (SCRUM-47, `albaran_firmado_es`). El de firmar marca todas sus filas con `albaran_para_firmar_es`, salga
  por ventana o por plantilla, y también las de fallo. Filtrar por `createdAt >= enviadoParaFirmaAt` mezclaría el
  reloj de la aplicación con el de la base.
- **Por qué no se usa `getDeliveryStatus`:** devuelve `null` tanto si no hay fila como si la lectura falla. Para un
  chip que sólo añade información vale; para decidir si se puede afirmar «enviado», no: es la familia «no pude mirar
  = no hay nada». Aquí la lectura fallida tiene su propio estado.
- Sin texto nuevo: la ruta devuelve un estado y la pantalla decide qué pinta.

### Verificado, ejecutando

- **Rojo primero:** el test sobre `dist/` de `origin/main` sin tocar (árbol aparte, `s1-49b-base`): **0 de 8**, todos
  por `entregaParaFirmar` ausente, con la ficha respondiendo 200. **Con el arreglo: 8 de 8.**
- El doble de `whatsAppMessage.findFirst` honra el `where`, el `orderBy` y el `select`. Casos: el del 18-oct (dos
  fallos en el acto), fallo después (con identificador de Meta), aceptado, entregado y leído, el último intento manda,
  la copia firmada no cuenta, una fila de otro comercio no se ve, nunca enviado (sin consulta) y lectura rota.
- **Mutantes sobre `dist/`:** sin el filtro de plantilla → cae 1 (el de la copia firmada); con el fallo siempre «en el
  acto» → cae 1 (el de después). Restaurado: 8 de 8.
- 99 ficheros de `tests/` que leen `albaranes.routes`, `/admin/albaranes`, el registro de WhatsApp o los censos:
  **952 pasan, 15 saltados**. Caían 3 antes de este registro: SCRUM-854 (faltaba esta entrada) y dos de SCRUM-411,
  porque la función pura estaba exportada sin llamador. Se le quitó el `export`.
- `tsc`: sólo el error conocido de `merchantAdmin.ts:147` (cliente de Prisma viejo; sin `prisma generate`).

### Lo que NO cubre

- **La pantalla** (`albaranDetailView.js`, que no pinte la píldora si la última falló) es de **S4**, y espera a esto.
- **El texto de «no llegó, reenvíalo»** lo pide el orquestador al fundador aparte. No hay texto nuevo aquí.
- **No medido en yaqu.app.** Se mira cuando entre en `main`, con un albarán de la cuenta QA.
- Si el ÚLTIMO intento no dejó fila (el registro de WA-0b es «fire-and-forget» y puede fallar), se lee la del intento
  anterior. Y una reserva que se quedó en `queued` no lleva todavía el documento (SCRUM-1513), así que no se ve desde
  el albarán: sale `sin_rastro` si no hay otra fila.

## SCRUM-49c · la ficha del albarán expone su credencial de firma (para copiar el enlace)

**Medido contra:** rama `scrum-49b-albaran-estado-real-de-entrega` = `1233bdb8186846c9f16a283667e7a686c3b1ba74`
(apilada: toca el mismo bloque de respuesta que 49b), sobre `origin/main` `183895cd` · hora de GitHub al escribir: 18:33:53Z
A9: comprobación → `tests/scrum49c-albaran-expone-enlace-de-firma.test.mjs`

Carril S1 · árbol `s1-49c` · rama `scrum-49c-albaran-expone-enlace-de-firma`. Encargo del orquestador, 18-oct-2026,
tras una medida de S4.

### Qué faltaba

La barra de «copiar el enlace» no se podía pintar en la ficha del albarán: ningún campo llevaba `firmaToken`.
El presupuesto y la factura sí exponen el suyo (`quote.payToken`, `invoice.payToken`) y la pantalla compone el
enlace. Con esto, además, la página pública de firma se puede alcanzar desde el panel, que es lo que dejó
`privacidad:92` de SCRUM-1236 como «ni falso ni comprobado».

### Qué cambia

- `albaranes.routes.ts`, `GET /:id`: añade `firmaToken` (o `null`). Es la misma credencial que ya viaja dentro del
  WhatsApp «para firmar»; la página pública es `/albaran/<token>`.
- **Sólo en la ficha y NO en `serializeAlbaran`**, a propósito: la ficha ya pasó por tenencia y por «es suyo»
  (SCRUM-467). Las listas y las demás respuestas que usan el serializador no la llevan.
- **Sólo se LEE.** El token lo crea el primer envío para firmar; antes de eso, `null`. La ficha no lo genera.
- El envío no se toca.

### Verificado, ejecutando

- **Rojo primero**, con el test sobre el `dist/` de 49b: caen los 3 casos que piden el campo, y pasan los 2
  invariantes (técnico ajeno → 404 sin el token en el cuerpo; `serializeAlbaran` sin el token), que ya se cumplían
  y tienen que seguir cumpliéndose. **Con el cambio: 5 de 5**, y 49b sigue 8 de 8.
- 93 ficheros de `tests/` que leen la ruta del albarán, `firmaToken` o los censos: **825 pasan, 0 caen, 14 saltados**.
- `tsc`: sólo el error conocido de `merchantAdmin.ts:147`.

### Lo que NO cubre

- La pantalla (la barra de copiar en `albaranDetailView.js`) es de **S4**.
- No medido en yaqu.app.

## SCRUM-49d · la píldora «enviado para firmar» sólo sale si Meta lo aceptó o lo entregó

**Medido contra:** `origin/main` = `cd85e34b1e5bfaf561f010f550296bd94b659e75` (prod servía ese mismo SHA, `/version`)
· hora de GitHub al escribir: 2026-10-19T06:40:20Z
A9: comprobación → `tests/scrum49d-pildora-solo-si-llego.test.mjs`

Carril S4 · árbol `s4-49d` · rama `scrum-49d-pildora-solo-si-llego`. Encargo del orquestador, 19-oct-2026: la mitad
de pantalla de 49b.

**Skill UI:** no cargada · a propósito: no cambia ningún estilo, ningún texto ni ningún componente: sólo DEJA de
pintarse una píldora que ya existía, cuando lo que dice es falso.

### Lo que había en yaqu.app (sólo GET, cuenta QA)

| albarán | `entregaParaFirmar` | píldoras que pinta la ficha |
|---|---|---|
| #46 AB260001, `emitido` | `fallido` · `en_el_acto` · 2026-10-18T18:09:53Z | `emitido` · **`enviado para firmar`** |

La píldora salía de `enviadoParaFirma`, que sale de `enviadoParaFirmaAt`, y esa marca se escribe ANTES de llamar a
Meta. Los dos intentos del 18-oct quedaron en `failed` y la ficha seguía diciendo «enviado para firmar».

### Qué cambia

`albaranDetailView.js`, cabecera de la ficha: la píldora exige además `entregaParaFirmar.estado` ∈ {`entregado`,
`aceptado`}. Con `fallido` (en el acto o después), `sin_rastro`, `no_se_pudo_leer`, o si el servidor no trae el
campo, **no sale nada**. Sin texto nuevo: quitar una afirmación falsa no necesita firma (regla 39). Decirle al
profesional que NO llegó sí sería texto nuevo, y no se ha escrito.

### Verificado, ejecutando

- **Rojo primero:** el test contra el `albaranDetailView.js` de `origin/main` cae en 5 de 8 (los cinco casos que no
  deben pintar), y los 3 que ya se cumplían pasan (`entregado`, `aceptado`, y sin intento). **Con el cambio, 8 de 8.**
- Suelo del test: la píldora del ESTADO tiene que salir siempre; sin ella, «no sale la de enviado» no probaría nada.

### Lo que falta

- **VISTO en yaqu.app tras el merge:** la ficha del #46 tiene que pasar de `emitido · enviado para firmar` a sólo
  `emitido`. Hay que mirarlo ANTES de firmar el #46 en obra (lo pide `privacidad:92` de SCRUM-1236): firmado,
  deja de tener la píldora por otro motivo y la medida ya no distinguiría nada.
