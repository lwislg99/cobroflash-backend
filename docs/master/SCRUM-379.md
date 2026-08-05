# SCRUM-379 · La recarga que nadie esperaba — el silencio que hacía repetir la acción

**Fecha:** 6-ago-2026 · **Carril:** A (UI) · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `68a5bfcc19a5fc27dd82a6e1ab06c0cf80d390bd` · 2026-08-06T00:25:00+01:00
**Tanda:** 1849 tests, 1782 pass, 0 fail (el resto, gateados a staging)

## El defecto, y por qué NO es SCRUM-375

En los cinco sitios de la ficha del albarán:

```js
const recargar = () => renderAlbaranDetailView(…)   // async
…
recargar()                                          // ← SIN await
```

Sin `await`, el rechazo **no entra en el `catch`**: se va como promesa sin gestionar.

| | Qué lee el profesional |
|---|---|
| **375** | algo **FALSO** — «no se han podido marcar» cuando sí se marcaron |
| **379** | **NADA**. Hace la acción, la escritura ocurre, la pantalla no cambia — y lo natural es que la **repita** |

## LA MEDICIÓN, HECHA ANTES DE TOCAR NADA: ¿qué pasa si repite?

**Ninguno numera ni emite factura** — verificado en la fuente: `allocateAlbaranNumber` solo lo
llaman el alta (`jobs.routes.ts:674`) y duplicar (`albaranes.routes.ts:591`). Pero **tres de los
cinco dejan rastro que no se deshace**:

| Botón | Endpoint | Repetir |
|---|---|---|
| `btnEmitir` | `/:id/emitir` | **Inocuo** — idempotencia **explícita**: `if (estado === 'emitido') return res.json(…)` |
| `btnEnviarFirmar` | `/:id/enviar-para-firmar` | 🔴 segundo WhatsApp al cliente |
| `btnFirmarAqui` | `/:id/firmar` | **Inocuo en datos** — 409, no sobrescribe la firma |
| `btnWhatsApp` | `/:id/enviar-whatsapp` | 🔴 segundo WhatsApp con el PDF |
| `btnFoto` | `/:id/fotos` | 🔴 `attachment.create` sin dedupe: foto duplicada |

### ① Lo que HABRÍA SIDO PEOR, y por qué vale la pena escribirlo

`sendAlbaranParaFirmarWhatsApp` hace `const token = albaran.firmaToken || crypto.randomBytes(16)…`
(`albaranWhatsApp.service.ts:132`): **reutiliza** el token. Por eso repetir el envío **no rompe el
enlace que el cliente ya tiene**.

> **Si lo regenerara, este ticket sería otro y más grave**: cada repetición invalidaría el enlace
> anterior, y el cliente que hubiera abierto el primer WhatsApp se encontraría un enlace muerto sin
> que nadie —ni él ni el pro— supiera por qué. Un «lo que habría sido peor» medido vale tanto como
> el defecto: dice de qué depende que la gravedad sea ésta y no otra, y avisa al que un día piense
> en rotar ese token.

### ② J6 es un TOPE, no un dedupe: un WhatsApp de más **y uno de menos**

`WA_CUSTOMER_DAILY_CAP` (**3** por defecto, `env.ts:92`) cuenta plantillas por cliente y día. No
compara contenido, así que **el duplicado sale**. Y la consecuencia que no había visto nadie:

> El envío repetido **quema una de las tres plazas del día de ese cliente**. Así que no es «un
> WhatsApp de más»: es un WhatsApp de más **y uno de menos** — el siguiente envío legítimo a ese
> mismo cliente (su factura, el aviso de otra obra) puede quedar **bloqueado** por culpa de una
> repetición que causó una recarga fallida horas antes. El daño se cobra tarde y en otro sitio.

### ③ «Inocuo en datos» no es inocuo: el caso de la firma

El 409 protege el dato, no la escena. Sin aviso, el pro vuelve a pulsar «Firmar aquí mismo», **le
pide al cliente que firme por segunda vez delante de él**, y al terminar lee «Este albarán ya está
firmado». Ningún dato roto y **la peor escena de las cinco**. El ticket no da por bueno «inocuo»
solo porque los datos aguanten.

## Se arreglan LOS CINCO, también los dos inocuos

El coste marginal de los dos inocuos es cero y el beneficio es que **el patrón deja de existir en
el fichero**. Dejar dos sitios con el patrón malo mantiene vivo el ejemplo a copiar — que es
exactamente cómo llegó a estar en cinco.

## Dos cosas que la medición destapó y el enunciado no nombraba

**① `renderAlbaranDetailView` NO lanzaba cuando fallaba su propio GET.** Lo capturaba y pintaba «No
se pudo cargar el albarán». Ése es el camino de fallo **más probable** de una recarga, y tampoco
resolvía el defecto: el mensaje habla de la LECTURA y le calla al profesional lo único que necesita
saber —que su acción salió—, así que **también le hace repetir**. Ahora quien refresca pasa el
aviso que corresponde (`opciones.avisoSiNoCarga`); la carga inicial conserva el suyo.

**② `setStatus` escribía en el `page` del cierre léxico.** Una recarga empieza por
`container.innerHTML = ''`, que deja huérfano el `page` de la invocación anterior. El aviso se
pintaba sin error **en un nodo desconectado**: existía y nadie lo veía. El mismo silencio que este
ticket cierra, escondido dentro del mecanismo con el que se avisa de él. Ahora escribe en la ficha
que está en pantalla.

## Los tres rojos

| # | Qué se rompe | Qué cae |
|---|---|---|
| 1 | La recarga vuelve a `recargar()` sin `await` ni gestión | 🔴 **(c)** «UNA PROMESA RECHAZADA SE HA PERDIDO» |
| 2 | El decisor calla cuando la recarga falla | 🔴 **(a)** «la escritura ocurrió… y la pantalla no dice NADA» |
| 3 | Una escritura fallida devuelve el «Hecho» | 🔴 **(b)** «UNA ESCRITURA QUE FALLÓ ESTÁ DICIENDO “Hecho”» |

> 🔴 **CON EL ROJO 1 PUESTO, (a) Y (b) SEGUÍAN VERDES.** Ésa es toda la razón de que (c) exista:
> **mirar el mensaje comprueba que alguien dijo algo; armar `unhandledRejection` comprueba que la
> promesa no se perdió.** Son dos preguntas distintas y solo la segunda es la causa raíz. Un
> arreglo que pintara el aviso y siguiera soltando el rechazo por otro sitio pasaría (a) y (b).

El (c) tiene su **suelo**: se suelta un rechazo a propósito y se comprueba que el manejador lo caza
— sin eso, «no se perdió nada» y «no supe mirar» se escriben igual. Y se espera tres vueltas de
`setImmediate` antes de mirar: un `unhandledRejection` se emite cuando el micro-tick acaba sin
manejador, así que mirar pronto diría que no se perdió nada.

## Lo que vigila la FORMA (para que el patrón no vuelva)

Cinco llamadas, todas con `await`, ninguna dentro del `try` de la escritura (eso sería reintroducir
375), y **cero llamadas crudas a `recargar()`** fuera del refresco que las gestiona. Todo por AST:
un `grep` casaría el comentario que explica la prohibición.

## Lo que NO cubre

- **La foto duplicada sobrevive al arreglo.** Con el aviso, el pro deja de repetir; pero las
  duplicadas que ya existan siguen sin poder borrarse — hoy **no hay borrado de fotos** en el
  producto (`attachments.routes.ts` solo expone `GET /:id`). Es **SCRUM-382**, y su pregunta
  decisiva no es de interfaz: *¿las fotos entran en el contenido canónico que sella
  `buildFirmaEvidencia`?* Si entran, borrar una es alterar un documento firmado y no se hace ni
  para arreglarlo; si no entran, el borrado es legítimo pero el documento y su evidencia dicen
  cosas distintas. **Se mide antes de decidir. No se ha tocado aquí.**
- **Verificación en `yaqu.app`: pendiente del merge** (el deploy es el merge del PR).

Ficheros: `public/dashboard/js/albaranDetailView.js` (el decisor, el refresco y los cinco sitios) ·
`tests/scrum379-recarga-sin-await.test.mjs` (11, nuevo).
