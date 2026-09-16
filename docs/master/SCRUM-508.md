# SCRUM-508 · Los cinco emisores que faltaban dejan fila

**Fecha:** 13-ago-2026 · **Carril:** infraestructura de envío · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `81be77352de2e4ce7f35bab9ddd6bd9247d75e74` · 2026-08-12T13:58:04+01:00

> Cierra el hueco que declaró SCRUM-501 al entregarse. **Cero líneas de `prisma/schema.prisma` y de
> `public/`.**

## 1 · La víctima

`email_messages` ya se escribía, pero **solo desde `email.service`**. La tabla iba a estar medio
llena, y quien la consultara creería estar viendo todos los envíos.

> 🔴 Una constancia parcial que no dice que es parcial es peor que no tenerla.

## 2 · PASO 0

`main` = `e18b0005` **antes** del `fetch` y `81be7735` **después**. `docs/master/SCRUM-508.md` **no
existía**. Y SCRUM-501 **sí está en `main`** (`registroDeEnvios.ts` presente), así que se construye
encima de lo mergeado y no de mi rama de ayer.

Censo por CONTENIDO, con control positivo de los dos instrumentos:

| Qué | Resultado |
| --- | --- |
| llamadas a `registrarEnvio` en `main:src/` | **5**, todas dentro del emisor único — el camino de escritura no se ha duplicado |
| quién pasa `registro:` (el contexto que hace posible la fila) | **1 fichero**, `email.service`, con dos sitios |
| **control positivo**: todas las llamadas al emisor único | **7 en 6 ficheros** — el patrón sí encuentra los demás emisores |
| `git log --all -S "registro: {"` sobre los cinco | **ningún commit, en ninguna rama** |
| **control positivo del método `-S`** — el mismo sobre `email.service` | encuentra `7817c307` (SCRUM-501): discrimina |

**La premisa se sostiene:** los cinco seguían mandando correo sin dejar fila.

**Rama viva del otro carril, comprobada y no tocada:** `scrum-475-firma-del-webhook` · `8d229e79` ·
**Luis** · 12-ago 13:38 +0200. `registroDeEnvios.ts` aparecía en el diff contra `main`, y **medido:
no existe en su rama** — es deriva de base (su rama es anterior a mi merge), no solape. Ninguno de mis
seis ficheros se toca con los suyos.

## 3 · Qué entra

Los cinco, por el **mismo camino** de SCRUM-501 — no uno parecido:

| Emisor | Clase | Coste real |
| --- | --- | --- |
| `soporteAdmin.routes` | `soporte` | **una línea**: tenía `merchantId` en mano, cero llamadores |
| `weeklyDigest.service` | `digest` | `merchantId` por parámetro, **un** llamador interno |
| `lifecycle.service` | `lifecycle` | `merchantId` por parámetro, **siete** llamadas internas |
| `auth.service` | `magic_link` **y** `invitacion` | dos clases: no son el mismo correo — uno devuelve a su cuenta a quien ya la tiene, el otro mete a alguien nuevo en la de otro |
| `merchantNotifications` | `aviso_pro` | **el único que obligó a tocar fuera**: 3 firmas + sus 4 rutas |

### Por qué `merchantNotifications` era el caro, y por qué no se paró

Solo recibía **el CORREO del profesional**, y un correo no identifica una cuenta. Así que `merchantId`
sube por las tres firmas exportadas hasta sus cuatro rutas (`psp`, `quotes`, `quotesAdmin`,
`whatsappIncoming`). **Medido antes de tocar**: los cuatro tienen `merchantId` a mano
(`updated.merchantId`, `quote.merchantId`, `req.merchantId`), así que son cuatro líneas y no medio
árbol. Y **el compilador nombró los cuatro exactos** — no hubo que buscarlos.

El encargo preveía pararlo si arrastraba demasiado. No hizo falta: **los cinco entran**.

### 🔴 El vocabulario de clases, CERRADO

Con `kind` como cadena libre, seis emisores escribiendo su literal a mano son seis oportunidades de
que dos digan lo mismo con palabras distintas — y entonces *«¿se le envió el digest?»* depende de
acertar cómo lo escribió cada uno. Ahora es un tipo: **un valor mal escrito no compila.** Una
divergencia imposible gana a una vigilada, y no hace falta guard nuevo.

`email.service` se unifica también: sus literales de ayer pasan a salir de la misma fuente.

## 4 · 🔴 El censo pasa de 1 a 6, y dice DE DÓNDE VINO CADA UNO

| | |
| --- | --- |
| **antes** | 1 (`email.service`, de SCRUM-501) |
| **después** | **6** — el de ayer + **los cinco de este ticket** |
| sin fila | **0** |
| indirectas (el AST no puede afirmarlo) | **0** |
| escritores de la tabla | **1**, el repositorio |

Un censo que sube tiene que decir de dónde vino lo que subió, igual que uno que baja tiene que decir
a dónde fue. Sin esa mitad, «se ha cableado» y «el censo ha cambiado de criterio» dan el mismo 6, y
está en un aserto: 1 de partida + 5 nuevos = los 6 que hay.

### La categoría INDIRECTO, y por qué existe

El censo tiene un tercer cubo para lo que el AST **no puede afirmar**: un objeto que llega por
variable o por `...spread`. Salió con **una**: `auth.service` pasaba el contexto por `...params`. Se
hizo **explícito** — un censo que adivina no vale, y hacerlo visible costaba una línea; el TIPO sigue
siendo lo que lo hace obligatorio. Las tres categorías suman el total, y hay aserto de que suman.

## 5 · 🔴 Otra vez: una mutación destapó un verde falso en MI PROPIO censo

La primera versión contaba que la propiedad `registro` **existiera**. Se mutó `weeklyDigest` a
`registro: null` —que es exactamente cómo un emisor dejaría de dejar fila, porque `registrarEnvio` lo
trata como `sin_contexto` y no escribe nada— y **el censo siguió diciendo 6**.

> **Atado a la FORMA en vez de al HECHO, dentro del censo que vigila justo eso.** Es la tercera vez
> esta semana que un rojo por mutación me caza un guard mío que ya daba verde en todo lo demás, y la
> tercera que la lectura no lo habría visto.

Ahora mira el **VALOR**: un `null` o un `undefined` explícitos cuentan como SIN fila, y el caso está
fijado en la autoprueba con su motivo escrito.

## 6 · Verificación

| | Qué | |
| --- | --- | --- |
| **🔴 AUTOPRUEBA** | el censo clasifica sobre fuente sintético: contexto puesto, ausente, abreviado, por referencia, `null`, `undefined`, spread, variable, y un comentario que lo nombra | ✅ |
| **SUELO** | si el censo ve menos de 7 llamadas → **ESCÁNER CIEGO**; y las categorías suman su total | ✅ |
| **🔴 CONTROL POSITIVO** | cada una de las **nueve** clases escribe EXACTAMENTE UNA fila, con su `kind` y su `provider_id` | ✅ |
| **🔴 UN SOLO CAMINO** | un único escritor de la tabla, derivado por AST | ✅ |
| **🔴 CONTROL NEGATIVO** | si la escritura revienta, **ninguna** de las nueve clases deja de mandar. Vuelto a probar, no citado: ahora hay cinco emisores más colgando de esa invariante | ✅ |
| **🔴 RGPD** | ninguna clase deja la dirección fuera de `to_email` — el defecto que destapó mi propio test ayer, comprobado para las nueve | ✅ |
| **Semántica de fallo** | los cuatro `sendEmail` que se tocaron **siguen lanzando**, con aserto propio porque este ticket tocó justo esas firmas | ✅ |
| Guard de SCRUM-501 | **12/12**, sin tocar | ✅ |
| Guard de «una sola llamada a Resend» (fase 1) | **7/7**, sin tocar | ✅ |

### Los dos rojos por MUTACIÓN — commiteado en verde antes, con post-condición

Las dos mutan **el valor**, no la estructura (`tsc` en 0: miden el defecto, no un error de sintaxis),
con respaldo del fichero y post-condición de que la mutación llegó y de que el árbol volvió idéntico.

| Mutación | Cae diciendo |
| --- | --- |
| `weeklyDigest` pasa `registro: null` | *«HAY EMISORES QUE MANDAN CORREO SIN DEJAR FILA: weeklyDigest.service.ts … la tabla queda MEDIO LLENA, y quien la consulte creerá estar viendo todos los envíos»* |
| `weeklyDigest` escribe su propia fila con `prisma.emailMessage.create` | *«HAY MÁS DE UN CAMINO PARA ESCRIBIR LA FILA: registroDeEnvios.ts:176 · weeklyDigest.service.ts:69»* — con fichero y línea de la segunda forma |

## 7 · Dos guards ajenos vuelven a corregirme, y los dos tienen razón

* **SCRUM-409** salta con un `merchantId: 1` que estaba en **fuente sintético** de mi autoprueba: lee
  el `1` como el merchant DEMO. Falso positivo suyo —ese `1` no es ningún merchant, es un ejemplo—
  pero mi valor era arbitrario: **7**, y queda dicho en el fuente. Su fichero no se toca.
* **SCRUM-337** exige rehacer las cinco huellas del ciclo de vida, **por segundo día consecutivo**.
  Mirado antes de tocarlas: lo único que cambia en cada bloque es **un argumento** —`m.id`— y ningún
  asunto, cuerpo, botón ni condición se mueve. Comprobado filtrando el diff por `wrap(`, `label:`,
  `url:`, `age >=`, `isTrial`, `quoteCount` y `recent ===`: solo salen las siete líneas del
  `sendEmail`. El motivo queda escrito junto a las huellas.

## 8 · Números

| | tests | pass | fail | skipped |
| --- | --- | --- | --- | --- |
| **línea base** — el conjunto de tests **de `main`** sobre este árbol, medida aparte | 3.586 | 3.509 | **0** | 77 |
| **después** — la tanda entera de esta rama | 3.595 | 3.518 | **0** | 77 |
| diferencia | **+9** | **+9** | 0 | **0** |

Los **+9 son exactamente** los de `tests/scrum508-los-cinco-dejan-fila.test.mjs`. Ni un salto nuevo.

**El ABSOLUTO caduca cuando su objeto se mueve; el DELTA sobrevive:** `main` se mueve cada pocos
minutos, así que los totales de mañana serán otros — el **+9** no.

* `npm run guards:entrada` — 4 guards · 17 tests · 0 fallos.

## 9 · Lo que NO se ha tocado

`prisma/schema.prisma` · ningún backfill · ninguna base de datos · el receptor del webhook y toda
`scrum-475-firma-del-webhook` · los textos de ningún correo · la semántica de fallo de los emisores ·
`CAMPOS_PERSONALES`, `ORDEN_BORRADO_MERCHANT` y `barridoDemo` · `public/` y el vocabulario de
`paid_via`.

## 10 · Huecos declarados

* **`lifecycle` escribe un solo `kind` para sus siete correos** (bienvenida, día 3/7/12, prueba
  expirada, inactivo, primer pago). La fila dice que se mandó *un* correo del ciclo de vida, no
  **cuál**. Distinguirlos pediría meter un compuesto en `kind` —y ese es un acuerdo con quien lo
  consuma, no una decisión de este ticket—. Hoy `Merchant.lifecycleEmailsSent` sigue registrando qué
  se marcó como enviado, así que el dato no se pierde: solo no está en la fila.
* **`related_type`/`related_id` siguen nulos en los cinco.** Ninguno entrega un documento: el digest
  es un resumen, el enlace de acceso no tiene documento, y el aviso al profesional habla de una
  factura o un presupuesto pero no los ADJUNTA. Poner una relación ahí sería inventarla.
* **`customerId` va nulo en los cinco**, y es correcto: los cinco escriben AL PROFESIONAL o a alguien
  de su equipo, nunca a un cliente.
* 🔸 **Nada verificado contra una base.** El cliente de Prisma se inyecta; que los seis `INSERT`
  funcionen contra Postgres —y en particular que `updated_at` se rellene— no lo prueba esta tanda. Es
  el mismo hueco que declaró SCRUM-501 y sigue abierto.
* **La fila no se lee desde ninguna pantalla.** Escribirla era esto; consultarla —«¿se le envió la
  factura F-2026-014?»— no tiene superficie todavía.
