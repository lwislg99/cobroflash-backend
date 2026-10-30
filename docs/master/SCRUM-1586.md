# SCRUM-1586 · El recordatorio de PRESUPUESTOS no reenvía si no puede guardar su candado

Abierto por J1 (equipo de Javier) el 23-oct-2026 para S1. Origen: SCRUM-1508 y SCRUM-1509.

## 2026-10-27 · Construido: reserva antes de enviar, y el tope por cliente se le aplica

**Medido contra:** `origin/main` = `a6db361ffa4871062a86b596ad2f63bc7e1a1ceb` · 2026-10-27T17:25:24Z (hora de GitHub, `gh api -i zen`)

A9: comprobación → `tests/scrum243-tenencia-lectura.test.mjs`

(Mi fallo: la primera versión escribía el candado con `where: { id }` a secas, sin `merchantId`, en
un cron que recorre todos los comercios. Lo cazó el 243. Ahora el candado filtra por los dos
(regla 2), y el doble del test lo exige.)

### ① La decisión, leída en su fuente

| qué | dónde | qué dice |
|---|---|---|
| «A + E» | SCRUM-1508 **c.20470** | donde un recordatorio depende de su anotación, ESPERA a que se guarde; si no puede anotar, se para (no reenvía). «El recordatorio de presupuestos está en un fichero de S1 (…). Se construye cada parte en su carril» |
| la forma para presupuestos | SCRUM-1509 **c.18881** | (a) pasar el cliente a `sendWhatsAppTemplate`, para que el tope por cliente y día se le evalúe; (b) que el candado NO se quede puesto cuando el envío queda bloqueado por el tope, para que se reintente |
| quién da el GO de construir | SCRUM-1509 c.20471 | «la letra está decidida, el GO de construir el envío lo da quien lo reparta con esta decisión citada» → lo repartió el orquestador del equipo de Luis citando c.20470 |

c.20470 la elige Javier: un jefe. `dos-equipos.md:28`: «Donde las normas dicen "el fundador" para
pedir un sí, vale un jefe». Carril: `node scripts/carriles.mjs de src/modules/quotes/domain/reminder.service.ts`
→ S1 (`dos-equipos.md:136`).

### ② Qué cambia en `reminder.service.ts`

- **El candado se RESERVA antes de enviar** (`updateMany` condicionado a `reminderSentAt: null`,
  con `id` y `merchantId`). Si la reserva no se escribe, **no se envía**.
- **(a)** el envío lleva `log: { customerId, relatedType: 'quote', relatedId }`: el tope por cliente
  y día (`WA_CUSTOMER_DAILY_CAP` = 3) se le aplica. Mismo mensaje, mismo destinatario.
- **(b)** si el envío lo bloquea el tope (`customer_daily_cap`, `daily_cap`, `tope_no_comprobable`),
  el candado se **libera** y la pasada siguiente lo reintenta. Si liberar también falla, se queda
  puesto y **no se reenvía** (el log lo dice).
- Una excepción (token, baja que no se pudo leer…) sale siempre ANTES de Meta: se libera y se
  reintenta.
- Sin teléfono: se marca como antes (no hay envío).

⚠️ **Una diferencia con facturas, y con la aceptación 3 del ticket leída al pie de la letra:**
el resto de fallos (la baja, el demo, sin credenciales, plantilla inválida, Meta dice que no, o
Meta no contesta) **no** liberan el candado: un intento y un aviso, como hasta hoy. Motivos:

1. **Un error de Meta sin respuesta puede haber SALIDO** (`desenlace: 'sin_respuesta'`, la propia
   `whatsapp.ts` lo trata así). Reintentarlo cada hora es el bucle de 48 en 48 por otra puerta.
2. Este cron es **horario** (facturas es diario) y su lote coge **50 sin orden**: un bloqueo que no
   se pasa solo, liberado cada hora, ocuparía el lote para siempre (el hambre de SCRUM-399) y
   escribiría un `wa_send_failed` por hora en la ficha.

c.18881 (b) habla del tope y sólo del tope: lo construido es eso. Si se quiere liberar ante más
casos, es una línea (`BLOQUEOS_DEL_TOPE`), pero es decisión de quien firmó la forma.

⚠️ **Efecto que ya declaró c.18881 (b), y que sigue:** mientras el tope bloquea, cada pasada horaria
deja un `wa_send_failed` en la ficha del cliente, hasta que el tope se libera al día siguiente.
Con el candado roto, en cambio, ahora son **0** (antes, uno por hora).

### ③ El test, rojo primero

`tests/scrum1586-recordatorio-de-presupuestos-no-reenvia.test.mjs`, la forma de `scrum1509j`: prisma
falso en memoria, WhatsApp en dry-run, 48 pasadas del cron.

| caso | `dist/` de main | arreglado |
|---|---|---|
| CONTROL · todo sano: sale 1 | ✔ (1) | ✔ (1) |
| EL ROJO · candado roto siempre | ✖ **48 de 48** | ✔ **0** |
| ① la reserva falla una vez: sin duplicado | ✖ | ✔ (1) |
| (a) con 3 plantillas hoy, no sale | ✖ (el cliente no llegaba al tope) | ✔ |
| (b) bloqueado por el tope: se libera y sale después | ✖ | ✔ (1) |
| ② excepción antes de Meta: se libera y sale después | ✖ | ✔ (1) |
| ③ tope y liberar roto: queda puesto, no se reenvía, y se dice | ✖ | ✔ (0) |
| CONTROL · cliente de baja: un intento, un aviso, no uno por hora | ✔ | ✔ |

Cuatro mutaciones en `MUTACIONES_QUE_ME_TUMBAN`, aplicadas sobre `dist/` y restauradas por hash:
enviar sin reservar · no liberar · reserva fallida «abierta» · liberar ante cualquier fallo. **Las
cuatro mueren**, cada una en su caso.

Guards que cayeron con la primera versión y se arreglaron **en el código**: `scrum243` (el `where`
sin `merchantId`, ver A9) y `scrum1452` (el `detail` del aviso se había mudado a una función nueva y
el censo lo contaba como crudo nuevo; el envío volvió al bucle, donde estaba).

### ④ Fuera

- **No visto en yaqu.app:** el recordatorio lo dispara sólo el cron, sin ruta que lo llame, y
  provocar 48 pasadas en producción no se hace. Lo que lo sostiene es el test con sus mutantes.
- Lo que el ticket deja fuera: `audit.service.ts` y la salida D. Ninguna plantilla, texto ni
  destinatario nuevo.
- Lo que c.18881 (c) avisaba («si fallan a la vez el candado y el registro de WhatsApp, siguen
  saliendo 48 de 48») ya no sale: con la reserva previa, el candado roto corta ANTES de enviar,
  esté como esté el registro. Cubierto por EL ROJO, que rompe el candado sin tocar el registro.
