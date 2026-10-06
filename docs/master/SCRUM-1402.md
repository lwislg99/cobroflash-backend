# SCRUM-1402 · El webhook de Stripe ya no escribe un plan que no existe, y lo dice · CRUCE DE CARRIL en UN fichero: `tests/scrum815-idempotencia-del-webhook.test.mjs` es compartido con el equipo de Luis (sección Ⓚ)

**Medido contra:** `origin/main` = `6aaec0dc8f0267518a50f626299ae901f81e2ae1` · 2026-10-06T13:26:13Z

A9: comprobación → `tests/scrum1402-plan-inexistente-no-se-escribe.test.mjs`

Sesión J5d, por encargo del orquestador del equipo de Javier (`cobroflash-backend-90`). Ticket de
`area-j5`; lo puso «En curso» el orquestador el 6-oct-2026. El ticket no trae su lista bajo la palabra
«Aceptación»: el orquestador aceptó por mensaje que la aceptación son los puntos ①–⑤ de «Lo que pide»
más las consecuencias que fija el comentario 18019.

## Ⓐ La decisión, y dónde se puede leer

SCRUM-1402, comentario 18019 (2-oct-2026), publicado por el orquestador con la respuesta literal del
fundador: **«1-Ok A»**. Opción A: se **rechaza** el cambio de plan y el merchant se queda con el que
tenía. El mismo comentario fija cuatro cosas que mandan al construir, y las cuatro están hechas así:

| lo que dice el comentario 18019 | cómo queda |
|---|---|
| ① y ② se miden ANTES de construir | sección Ⓑ |
| el rechazo es RUIDOSO: valor entre comillas, merchant y planes que existen, con la forma de SCRUM-1342 | `planQueExiste`, en la ruta; sale en las tres puertas, impago incluido |
| la lista se DERIVA de `src/core/entitlements.ts` | la ruta importa `PLANES_CONOCIDOS`; un guard por AST lo sujeta |
| un plan legítimo se activa exactamente igual | sección Ⓓ |

## Ⓑ ① y ②: quién escribe `metadata.plan`

Medido por lectura de los caminos, sobre el ancla. Población: los sitios de `src/` y `scripts/` que
llaman a la API de Stripe (`checkout`, `subscriptions`, `customers`, `billingPortal`, `prices`,
`products`, `paymentIntents`): 15 llamadas en 7 ficheros, 0 sin mirar.

- **El único sitio del código que pone `metadata.plan`** es el checkout propio
  (`POST /admin/billing/checkout`, en `subscriptions.routes.ts`): lo pone en la sesión y en la
  suscripción, y el valor solo puede ser `founding` o un `id` de su lista `PLANS`, que hoy tiene uno:
  `pro`. Cualquier otro valor recibe un 400 `invalid_plan` antes de llegar a Stripe.
- La otra sesión de Checkout que crea el código (`payCard.routes.ts`, el cobro de una factura) es
  `mode: 'payment'` y no lleva `plan`. El portal de Stripe se abre sin metadatos. Los dos guiones de
  precios (`scripts/setup-stripe-prices.mjs`, `scripts/migrate-stripe-prices-live.mjs`) crean precios,
  no suscripciones.

**Para `pro` y `founding`, por tanto, esto es un cinturón de seguridad, y baja de prioridad**: el
código propio no puede mandar un valor de fuera de la lista. No se infla.

**Y el otro lado, que va junto:**

- `equipo` **no puede salir de nuestro código**: no está en `PLANS` y ninguna ruta lo pone. Es «oferta
  manual» (Parte W1 del máster). Si llega por el webhook es porque alguien lo escribió a mano en
  Stripe. **No consta** en `docs/` ningún procedimiento que diga cómo se activa Equipo, ni por Stripe ni
  por la base. No digo que no exista: digo que no lo he encontrado escrito.
- La firma del webhook se verifica, así que un tercero no puede inyectar un evento; y el cliente no
  puede editar los metadatos de su suscripción. Lo que queda es el panel o la API de Stripe con la
  clave de la cuenta. **Qué hay hoy en ese panel no lo he medido ni lo puedo medir**: esta sesión no
  toca claves.

## Ⓒ El rojo primero

`docs/master/evidencias/scrum1402/rojo-antes.txt`: el test sobre el código sin tocar (commit
`150c19eb3`, el primero de la rama). **12 casos · 7 pasan · 5 caen.** Por el router de producción, con
el evento firmado y la base doblada, los nueve valores inventados se escribían en `Merchant.plan` tal
cual: **9 de 9** en el checkout, 36 de 36 en la suscripción activa y 18 de 18 en el impago. Entre ellos
`constructor`, `toString` y `__proto__`, los que antes de SCRUM-1342 dejaban la cuenta sin límite de
usuarios. Pasan los que tienen que pasar siempre: los planes legítimos por las tres puertas, la
cancelación y la idempotencia.

## Ⓓ El arreglo

Un solo fichero de `src/`: `src/modules/billing/app/routes/stripe.routes.ts`. Una función,
`planQueExiste`, que pregunta a `PLANES_CONOCIDOS` y, si el plan no está, avisa y devuelve `false`. La
llaman las **tres** escrituras que copiaban `metadata.plan`: `checkout.session.completed` y, en
`customer.subscription.updated|created`, la rama activa y la del impago.

Lo que hace un rechazo: **en ese evento no se escribe nada en la fila del merchant.** Y sale un
`console.warn` como éste (es un log, no un texto que vea el usuario):

    [stripe] ⚠️ plan desconocido "Equipo" (merchant 12) en checkout.session.completed evt_…: NO se cambia
    el plan, el merchant se queda con el que tenía. Hay que mirarlo a mano en Stripe: puede haber un
    pago sin plan activado. Los planes que existen: trial, pro, founding, equipo.

**El positivo que manda**, medido y no supuesto: `trial`, `pro`, `founding` y `equipo` se escriben
byte a byte igual que antes por las tres puertas (4 casos en el checkout, 16 en la suscripción activa,
8 en el impago), con su premio al referido y su correo, y sin un solo aviso.

Lo que no se toca: la idempotencia por `event.id` (hay un caso que lo fija), las dos puertas de
cancelación (escriben el literal `trial`, no lo que llega, y siguen aplicándose venga el plan que
venga), `prisma/schema.prisma`, `src/core/entitlements.ts`, ningún límite de ningún plan, ninguna ruta
nueva, ningún texto de pantalla y nada de la emisión fiscal. No hay CHECK en la base.

## Ⓔ Tres consecuencias de «no se escribe nada», dichas una a una

Las vio el orquestador antes de empujar y las aceptó por mensaje; la tercera la sube al fundador.

1. **A Stripe se le contesta 200 y el evento queda procesado.** Un 400 le haría reintentar tres días
   algo que no va a cambiar. El aviso sale igual.
2. **En el checkout no salen ni el premio al referido ni el correo de primer pago.** No se ha activado
   nada, así que no se anuncia nada.
3. **Un impago (`past_due`, `unpaid`) que llega con un plan que no existe tampoco se marca.** Es
   consecuencia mecánica de la opción A. La alternativa —marcar el impago sin tocar el plan— no está en
   el comentario 18019 y no se ha construido. La frase para el fundador: *«Si la suscripción de un
   merchant lleva en Stripe un nombre de plan que no existe y ese merchant deja de pagar, YaQu no se
   entera del impago: no le sale el aviso de pago pendiente y conserva el plan que tuviera. Lo único
   que queda es una línea en el log. ¿Lo dejamos así, o el impago se marca aunque el plan no se toque?»*

## Ⓕ Lo que la decisión NO resuelve

**Ninguna de las dos salidas devuelve el dinero.** Si llega un pago con un plan que no existe, alguien
ha pagado algo que no se le ha dado, y eso lo resuelve el fundador a mano, caso por caso. El código no
lo adivina y no intenta compensarlo: lo único que hace es dejar de callarlo.

Y «ruidoso» es, hoy, una línea de `console.warn` en el log del servidor. Suena para quien lea ese log.
No he medido si alguien lo lee ni si hay una alerta montada encima; no he construido ninguna.

## Ⓖ Fuera de alcance, solo reportado

- **Una suscripción pagada que llega SIN `metadata.plan`** (o con él vacío) tampoco activa nada, y eso
  no lo dice nadie: ni antes ni ahora. La decisión habla del plan que no existe, no del que no viene.
  No se toca; el test lo fija como «sin cambios» y el ticket lo abre el orquestador.
- **`trial` está en la lista**, así que una suscripción activa con `metadata.plan = trial` se acepta.
  Qué límites tiene `trial` es SCRUM-1406, sin decidir; este trabajo no usa ninguno.
- Cómo se activa Equipo (sección Ⓑ) es pregunta para el fundador; la hace el orquestador.

## Ⓗ Mutaciones

Ocho declaradas en el propio test (`MUTACIONES_QUE_ME_TUMBAN`). Sonda local
`docs/master/evidencias/scrum1402/mutar.mjs`, con la base sin mutar primero; salida en
`docs/master/evidencias/scrum1402/mutaciones.txt`: **base 12 casos y 0 caen · 8 vivas · 0 mudas ·
0 ciegas, de 8.** Cubren las tres puertas sin validar, el rechazo callado, el rechazo de todo (el
arreglo peor que el defecto), la pregunta por lo que la lista hereda, la aceptación «amable» de
`Equipo` y la segunda lista copiada a mano. La red de la casa (`npm run meta:mutaciones`) no se ha
corrido en local: la corre el CI.

## Ⓘ Límites de lo medido

- El doble de la base no tiene estado. «Se queda con el que tenía» está medido como «no se escribe
  nada en su fila», no leyendo la fila después.
- El test monta el router como lo monta `src/app.ts` (misma ruta, mismo `rawBody`), pero no levanta
  `dist/app.js` entero. Que `app.ts` siga montándolo así lo cubren los tests de SCRUM-809 y SCRUM-100.
- `dist/` se emitió con `tsc --noCheck` (worktree anidado, sin cliente de Prisma propio): los tipos
  los comprueba el `build` del CI, no esta máquina.
- Nada se ha visto en `yaqu.app`: el cambio no tiene pantalla, y provocar el caso en producción sería
  mandar un evento de Stripe con dinero de verdad. No se hace.

## Ⓙ Lo corrido

Sobre la rama con `origin/main` = `6aaec0dc` ya mezclado, `dist/` emitido después del merge, y sin
`FORCE_COLOR` (comprobado en el mismo comando).

| qué | resultado |
|---|---|
| el test nuevo, solo | 12 casos · 12 pasan · 0 caen · 0 saltan |
| 30 ficheros sueltos (el nuevo, `scrum237`, `scrum976`, `scrum622`, los de registro `scrum267`/`scrum1294`/`scrum525d`/`scrum859`/`scrum1306`, `scrum921*`, `scrum710b`, `scrum850`, `scrum824`, `scrum864c`, los de `scrum815*`, `scrum475`, `scrum512`, `scrum1342`, `webhooks-idempotencia`) | 236 casos · 234 pasan · **1 cae** · 1 salta (pide `QA_DB_TEST`). El que cae es el censo de efectos de SCRUM-815: sección Ⓚ. Fue ANTES de declararlo |
| `npm run tanda:dirigida`, con turno del orquestador, 3.609 MB libres medidos justo antes | 306 ficheros de 1.248 · 2.956 casos · 2.949 pasan · **1 cae** · los 6 restantes no los desglosa el resumen (el TAP no se conservó). Terminó sola (5 min 39 s), no la mató nadie. Ya con el censo declarado |
| después de escribir este registro: el test nuevo, el de SCRUM-815 y los guards de registro y de suite (`scrum267`, `scrum1294`, `scrum525d`, `scrum921*`, `scrum710b`, `scrum859`, `scrum1306`, `scrum514`, `scrum237`, `scrum976`) | 163 casos · 163 pasan · 0 caen · 0 saltan |
| `npm run guards:entrada`, lo último | 13 guards · 158 casos · 0 caen |
| las mutaciones que OTROS tests declaran sobre el mismo fichero | 7 tests mirados, 10 mutaciones (8 de este ticket, 2 de `scrum809b`): las 10 siguen casando una sola vez |

**El único caído de la dirigida no es de este cambio:** «SCRUM-476 · SUELO: el censo de directorios
`node_modules` no puede dar cero» (`tests/scrum476-reconciliar-censos.test.mjs`). Este worktree es
anidado y no tiene `node_modules` propio —node resuelve hacia arriba—, así que ese suelo cae aquí por
la máquina. En el CI el árbol sí lo tiene. No lo he corrido en un árbol con `node_modules`: lo dirá el
obligatorio.

**No corrido:** la tanda completa (no es alcanzable en esta máquina; la da el obligatorio del CI), los
tests gateados por base (`scrum809`, `scrum340`, `scrum330`: recorren este mismo webhook contra un
Postgres; solo los ejecuta el CI) y `npm run meta:mutaciones`.

## Ⓚ El trinquete de SCRUM-815 que saltó, y lo que pide

`tests/scrum815-idempotencia-del-webhook.test.mjs`, caso «el censo de EFECTOS del manejador no crece
sin decirlo», cayó con el arreglo: cuenta por AST toda llamada no pura del manejador y `planQueExiste`
aparece tres veces. El fichero es compartido (lleva commits de los dos equipos), así que tocarlo es
cruce de carril; el orquestador lo autorizó por mensaje y avisa él al equipo de Luis.

**Lo que NO se hizo:** sacar la validación antes del corte del despacho para que el censo no la viera.
Habría dejado el guard verde sin medir nada.

**Lo que se hizo:** declararla. Una entrada, `planQueExiste: 3`, con su motivo. Ninguna otra cifra
cambia. Interrogado después: con una cuarta llamada inyectada (`git diff --numstat` 1/0), el caso
**cae** diciendo `planQueExiste: 4` contra `3`. Retirada la inyección, el árbol vuelve a ser el del
commit (0 diferencias).

**Y lo que el mensaje del guard manda hacer: releer la propuesta de columnas** (`docs/master/SCRUM-815.md`,
paso ①, §2 y §4, y el §4 del apéndice 815b). Releída con este cambio dentro:

- La propuesta **ya está aplicada** (la tabla `gateway_events` existe y el escritor está encendido para
  cinco tipos). Lo que queda por comprobar es si lo que la sostenía sigue siendo verdad.
- **El reparto de efectos no cambia:** 1 disputa, 3 salidas HTTP, 5 escrituras de plan, 1 recompensa y
  1 correo. No nace ningún efecto, y ninguno pasa de reversible a no reversible. Un rechazo solo
  **quita**: salta una escritura de plan y, en el checkout, también la recompensa y el correo.
- **El protocolo de tres pasos sigue igual:** un evento rechazado termina sin excepción, así que se
  cierra con `processed_at`; una segunda entrega del mismo evento se contesta sin trabajo. Repetirla no
  cambiaría nada: el plan seguiría sin existir.
- **Un matiz que la propuesta no contemplaba:** para ella `processed_at` puesto significa «terminó
  bien». Desde hoy también puede significar «se atendió y se rechazó». La tabla no distingue los dos:
  el rechazo consta **solo en el log**, no en `gateway_events` (`last_error` queda vacío). No he
  construido esa marca: no está en el comentario 18019.

Conclusión: **la propuesta sigue en pie.** Con ese matiz dicho.

Una cosa más, **inferida y no medida**: si alguien corrige el nombre del plan en la suscripción desde
Stripe, Stripe manda un `customer.subscription.updated` nuevo, con otro identificador, y ése sí entra y
escribe el plan. El premio al referido y el correo de primer pago no salen por ese camino.
