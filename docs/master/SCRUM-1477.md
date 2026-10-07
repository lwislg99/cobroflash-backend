# SCRUM-1477 · «Meta dijo que no» y «Meta no contestó» ya no se devuelven igual

**Medido contra:** `origin/main` = `b2188ed995843fa9eb01e371f5033974dd2897b6` · 2026-10-07T16:53:39Z

A9: comprobación → `tests/scrum124-r28-graph-facebook-guard.test.mjs`

Sesión J2 (`jv-j2`, relevo de J2f), por encargo del orquestador del equipo de Javier
(`cobroflash-backend-90`). El ticket lo abrió S1 del equipo de Luis desde SCRUM-1465.

Se toca: `src/integrations/whatsapp.ts` (carril J2), dos ficheros nuevos de `tests/`, el banco
de mutaciones, este registro y su carpeta de evidencias. **No se toca** ningún guard, ninguna
lista, ningún texto que vea el usuario, el diccionario `src/lib/sendOutcome.ts` ni ningún fichero
de otro carril.

## ① Qué pasaba, ejecutado

Los siete envíos que llaman a Meta (`sendWhatsAppTemplate`, `Text`, `Buttons`, `List`, `CtaUrl`,
`Document`, `LocationRequest`) acababan su `catch` con la misma línea, y esa línea no decía qué
había pasado. Medido sobre `f9b4074d`, con el laboratorio de ④, 7 envíos por caso:

| Qué hace Meta | Qué devolvían los 7 | ¿Salió el mensaje? |
|---|---|---|
| contesta 400 | `{ ok: false, error: <objeto de Meta> }` | no |
| contesta 500 | `{ ok: false, error: <objeto de Meta> }` | no se sabe |
| no contesta y vence el plazo | `{ ok: false, error: 'timeout of … exceeded' }` | no se sabe |
| recibe el envío y corta | `{ ok: false, error: 'socket hang up' }` | no se sabe |

Salida literal: `docs/master/evidencias/SCRUM-1477/laboratorio-antes-f9b4074d.txt`.

Dos cosas que el ticket no traía y salieron de ejecutarlo:

- **Un 5xx llega como OBJETO, igual que un 4xx.** El ticket proponía que quien llama distinguiera
  por la forma de `error` (objeto = Meta dijo que no). Con un 500 eso habría dicho «no ha salido»
  de un mensaje que pudo salir.
- **Hay un tercer caso en el mismo `catch`:** el freno de SCRUM-180 (`asegurarSalidaAMetaPermitida`)
  LANZA dentro del `try`, antes de que salga nada. Ahí se sabe que el mensaje no ha salido.

## ② Quién lee lo que devuelve un envío (medido ANTES de decidir dónde va el nombre)

Por `grep` sobre los 18 ficheros de `src/` que nombran un envío; es lectura, no AST:

| Quién | Carril | Qué hace con `reason` |
|---|---|---|
| `maintenance.service.ts` (propuesta de mantenimiento) | S1 | lo ESCRIBE en una nota: «WA al pro falló (`reason` o `meta_error`)» |
| `sendQuote.service.ts` | S1 | deja pasar cinco motivos con nombre; el resto lo convierte en `whatsapp_send_failed` |
| `albaranWhatsApp.service.ts`, `jobs.routes.ts` | S1 | si está en el diccionario lo usa; si no, `whatsapp_send_failed` |
| `invoicesAdmin.routes.ts` | J1 | lo mismo |
| `invoiceReminder.service.ts` | J2 | sólo lo escribe en el log |
| `tests/scrum1436-ventana-abierta-envio-fallido.test.mjs` | J2 | exige `reason === undefined` cuando falla el freno de salida |

`reason` lo leen otros carriles, y uno lo escribe tal cual. **Por eso el nombre NO va en
`reason`.** Va en un campo nuevo, `desenlace`, que hoy no lee nadie: quien no lo lea recibe lo
mismo que antes. `error` tampoco cambia.

## ③ Qué se ha construido

```ts
export type DesenlaceDeMeta = 'rechazado' | 'sin_respuesta' | 'no_enviado';
```

| `desenlace` | Cuándo | ¿Salió? |
|---|---|---|
| `rechazado` | Meta contestó un 4xx (menos el 408) | no |
| `sin_respuesta` | plazo vencido, conexión cortada, 5xx o 408 | no se sabe |
| `no_enviado` | la petición no llegó a salir: el freno de SCRUM-180 | no |

Los nombres son los de `src/modules/fiscal/verifactu/sif.client.ts` (SCRUM-1112), que ya separa
lo mismo hacia la AEAT. No hay vocabulario nuevo.

Todo lo que no es un «no» claro cae en `sin_respuesta`. Es el criterio del comentario 18357 de
SCRUM-1465: entre decir «no sabemos» de más y decir «no ha salido» de un mensaje que salió, se
elige lo primero, porque lo segundo acaba en un mensaje duplicado a un cliente.

**El envío por ventana (`sendWhatsAppWindowFirst`) también lo sube**, y tiene una regla propia
porque puede hacer DOS intentos (el texto de ventana y, si falla, la plantilla):

- con `sinPlantilla`, devuelve el desenlace del texto fallido. El `reason` que puso SCRUM-1436
  (`whatsapp_send_failed`) no cambia;
- con plantilla detrás, **si el texto quedó `sin_respuesta` el conjunto dice `sin_respuesta`**,
  aunque Meta rechace después la plantilla o la pare un tope. Ese texto pudo salir.

## ④ Cómo se ha medido: el laboratorio

Desde un proceso de test el `catch` sólo se alcanza por el freno de SCRUM-180: con dry-run el
envío vuelve antes de llamar, y sin él el interceptor lanza. **Ese freno no se ha tocado.**

`tests/_meta-de-laboratorio.mjs` se lanza como proceso aparte (no es de test), con el entorno
construido a mano, y sustituye el transporte de axios por uno que desvía TODA petición a
`127.0.0.1` y un puerto efímero. No resuelve ningún nombre y no sabe dónde está Meta. Lo que
corre es `dist/`, axios y su transporte HTTP de verdad.

Después del cambio, 11 casos, 7 envíos cada uno más dos envíos por ventana
(`docs/master/evidencias/SCRUM-1477/laboratorio-despues.txt`):

| Caso | Los 7 envíos |
|---|---|
| 200 | 7 de 7 salen, sin `desenlace` |
| 400, 401, 429 | 7 de 7 `rechazado` |
| 408, 500, 503 | 7 de 7 `sin_respuesta` |
| sin respuesta, corte | 7 de 7 `sin_respuesta` |

El `no_enviado` se ejecuta dentro del propio test, que sí es un proceso de test: 7 de 7.

**Límite del laboratorio:** el plazo real es de 10 s. El laboratorio comprueba que cada envío lo
PIDE (10.000 ms en las 7) y lo acorta a 300 ms cuando el servidor no va a contestar. Nada de
esto habla con Meta: que un 4xx suyo signifique siempre «no ha salido» es lo que dice su API.

## ⑤ El test y su banco

`tests/scrum1477-meta-dijo-que-no-o-no-contesto.test.mjs`: 16 casos, 16 pasan.

- 9 por el laboratorio (uno por respuesta de Meta) y 4 por ventana;
- 1 en el proceso de test (`no_enviado`);
- 2 por AST: los `catch` que envuelven una llamada a Meta son 9. Siete son los envíos, que tienen
  que ser los mismos siete que ejercita el laboratorio y devolver la misma línea. Los otros dos
  son de `markInboundRead`, que marca como leído y no devuelve resultado: van declarados aparte,
  con su motivo, y el test cae si empiezan a devolver algo.

`tests/banco-scrum1477/mutar.mjs`: 16 mutaciones (15 que deben caer y un control). **15 caen, el
control queda mudo, 0 ciegas** (`docs/master/evidencias/SCRUM-1477/banco-de-mutaciones.txt`).

Tanda dirigida en local, sobre el árbol con `main` `b2188ed9` mezclado: 149 ficheros de 1.284
(los que nombran `whatsapp.ts`, el arnés de envío o un banco, más los guards de suite), 1.671
casos, 1.656 pasan, 13 saltan y **2 caen**: los dos de `scrum245-tipo-obliga-declarar`, por lo que
se dice en ⑦. La tanda completa NO se ha corrido en local: es la del CI.

## ⑥ Contra la aceptación del ticket

| aceptación (literal) | dónde se ve |
|---|---|
| 1. Con Meta contestando un 4xx, el resultado del envío trae un motivo con nombre que dice que Meta lo rechazó. | `tests/scrum1477-meta-dijo-que-no-o-no-contesto.test.mjs`, casos «Meta contesta 400», «401» y «429» |
| 2. Con el plazo de 10 s vencido (o la red cortada), el resultado trae OTRO motivo con nombre. | el mismo fichero, casos «Meta NO contesta y vence el plazo» y «la conexión se CORTA» |
| 3. Los siete `catch` devuelven lo mismo para el mismo caso. | el mismo fichero: cada caso compara los siete, y el caso por AST los cuenta |
| 4. Avisado en SCRUM-1465 cuando esté en `main`, para que S1 separe la frase en dos con su firma. | NO HECHO → se escribe cuando este PR esté en `main`; lo hace J2 o el orquestador |

## ⑦ Lo que NO se ha hecho y lo que NO se ha medido

- **Ninguna frase cambia.** El profesional sigue leyendo «No sabemos si el WhatsApp ha salido…»
  en los tres casos. Separarla es de S1 y pide firma (SCRUM-1465).
- **Nadie lee todavía `desenlace`.** `sendQuote.service.ts` (S1) no lo sube: devuelve
  `whatsapp_send_failed` y `error`. Para que la ruta del presupuesto lo vea hay que tocar ese
  fichero, que no es de este carril.
- **No se ha distinguido «no llegó a salir» por DNS o conexión rechazada.** Van a `sin_respuesta`.
  Es impreciso del lado que no duplica.
- **No visto en yaqu.app.** No hay nada que ver: no cambia ninguna pantalla ni ninguna respuesta
  de ruta.
- **El build local es `--noCheck`.** Con el compilador completo (`tsc --noEmit`) salen 6 errores,
  ninguno en `whatsapp.ts`: son de un cliente de Prisma desfasado en este árbol
  (`invoiceStartSeq`, `llevaLibrosPorSii`). El que vale es el del CI.
- **Los dos casos de `scrum245-tipo-obliga-declarar` caen en local** por no encontrar el compilador
  en este árbol. Leen los tipos de `whatsapp.ts`: si caen en el CI, es de este PR.

## ⑧ De paso (sin ticket)

- **Medido y NO arreglado:** con la ventana abierta, si el texto queda sin respuesta, el envío
  por ventana manda la plantilla a continuación. Si la plantilla sale, contesta `ok: true` y el
  cliente puede haber recibido los dos mensajes (caso `texto-sin-respuesta-y-plantilla-200` del
  laboratorio: 2 intentos, `ok: true`, `via: 'template'`). Es así desde antes de este ticket. No
  se toca aquí: cambiarlo es decidir cuándo se manda una plantilla de pago.
- **Error mío, cazado por un guard que ya existía:** la primera versión del laboratorio comprobaba
  el destino escribiendo la dirección de Meta, y `scrum124` lo leyó como un fichero que habla con
  Meta por su cuenta. No toqué el guard: el laboratorio ya no nombra a Meta.
- **Error mío, cazado por el suelo del banco:** una mutación salió CIEGA porque leí mal un
  recuento mío (`dist/` conserva `10_000`, no `10000`). Corregida y el banco repetido entero.
- **Otra hora a ojo** en un mensaje al orquestador («~16:55Z» siendo las 16:3x). Es la sexta de
  J2; la cicatriz ya está escrita y sigue sin comprobación posible.
