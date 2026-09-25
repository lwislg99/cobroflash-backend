# SCRUM-1114 · No era la base: eran 150 milisegundos. Era el correo

**Medido contra:** `origin/main` = `6bbe1b4d98e18fd3f5f2fdedd4823d1e24a951b5` · 2026-09-25T14:29:56Z

25-sep-2026 · Lo construye **el orquestador** (A13). Cierra la incógnita que SCRUM-1112 dejó
abierta a propósito.

## 🟢 La medición, con el instrumento de SCRUM-1112 puesto

```
[14:22:43.130Z] === SCRUM-1109 · aviso programado de acreditación INVOICING_ES ===
[14:22:43.132Z] destino · [DATABASE_URL_PROD_RO] → autorack.proxy.rlwy.net/railway
[14:22:43.190Z] ① midiendo · conectando y consultando
[14:22:43.340Z] ① medido · filas: ?
[14:22:43.341Z] ② enviando aviso · a destinatario configurado
✔ [YaQu · SCRUM-1097] limpio — 0/12 merchant(s) ES acreditados · aviso NO ENTREGADO
  (⏱ se agotaron 20s en la etapa «envio») — un 0 sin aviso entregado se trata como CIEGO
```

**La base tardó 150 milisegundos.** Los tres cuelgues —27 min, 15 min y **1 h 46**— eran el
**correo**, enteros. SCRUM-1112 dijo *«no se sabe todavía dónde se colgaba; lo que se ha
construido es el instrumento que lo dirá»*. Lo dijo a la primera ejecución.

🟢 **Y el guard de SCRUM-1109 se portó:** midió `0/12` y, como el aviso no salió, **no cantó
«limpio»** — lo trató como CIEGO. Es exactamente lo que pedía: un cero medido y un cero por
ceguera no salen iguales.

## La causa: el único sitio de la casa que sale por SMTP

`src/integrations/enviarCorreo.ts` —el camino de la casa— **prefiere Resend por HTTPS**
(`POST https://api.resend.com/emails`) y sólo cae a SMTP si no hay clave. En producción YaQu
manda por Resend.

Este script usaba `nodemailer.createTransport(process.env.SMTP_URL)` **a pelo**, y
`validarConfiguracion` **exigía** `SMTP_URL`. La palabra «resend» no aparecía ni una vez.
**El cron era el único que salía por SMTP, y el único que se colgaba.**

## ⛔ Lo que NO se ha hecho, aunque era lo primero que uno piensa

**No se reusa `enviarPorResend` de la casa.** Llama a `registrarEnvio(...)`, que hace un
`INSERT` de constancia — y la credencial de este cron es `yaqu_lectura`, **de solo lectura**.
Importarla habría cambiado un cuelgue por un fallo de permisos, y el log habría dicho otra cosa
distinta de la verdad.

Aquí va un `POST` directo, **sin tocar la base**.

## Lo que se ha hecho

- **`crearTransportadorResend(apiKey, { peticion })`** — con la **misma forma** que el de
  nodemailer (`sendMail({from, to, subject, text})`), para que `ejecutarPasada` **no se entere**
  de por dónde sale el correo. Su firma no cambia y sus once casos siguen valiendo tal cual.
- **`peticion` se inyecta en los tests:** el caso no toca la red, y de paso esquiva la aserción
  de libuv que `fetch()` dispara en Windows (SCRUM-100/560/809).
- **`validarConfiguracion` acepta cualquiera de los dos**, y cuando no hay ninguno **nombra los
  dos**. Decir sólo «falta `SMTP_URL`» mandaba a configurar justo el canal que se cuelga.
- **La traza dice POR CUÁL sale** (`canal del aviso · Resend (HTTPS)` / `SMTP (caída…)`), que es
  lo que no se sabía mirando un log.

## 🔴 Un cambio de contrato, DECLARADO en vez de colado

El hueco de `validarConfiguracion` se llamaba `'SMTP_URL'` y ahora se llama
`'SMTP_URL o RESEND_API_KEY'`. **Eso rompe una aserción que existía**, y el test se ha
actualizado **con el motivo escrito dentro**, no ajustado en silencio para que pasara. Se añaden
además los casos del canal nuevo, que antes no existían.

## Verificado EN ROJO, con el árbol comprobado al restaurar

**① Si el mensaje de error llevara la clave:**

```
AssertionError: la clave se coló: Resend respondió 422 con
  CLAVE-SECRETA-QUE-NO-DEBE-SALIR: {"message":"from no validado"}
```

Importa porque **un error acaba en un log de Railway**. El caso existe para eso.

**② Si el destinatario viajara suelto en vez de en lista:**

```
actual:   { from: 'a@b.c', to: 'd@e.f',   subject: 'S', text: 'T' }
expected: { from: 'a@b.c', to: [ 'd@e.f' ], subject: 'S', text: 'T' }
```

Importa porque **mandarlo suelto no falla de forma visible: simplemente no llega**, y el
síntoma sería otra vez «no me ha llegado el correo».

**El árbol se comprobó por CONTENIDO tras cada mutación** (`sha256` idéntico, `8bcf0ab88b3c9d43`
antes y después): una pasada que muta y muere se salta su propia limpieza.

## Un defecto propio, del control de este mismo trabajo

El control que comprobaba «los tests no llaman a `fetch` de verdad» **saltó sobre mi propio
comentario** —la palabra `fetch()` entre comillas invertidas—, no sobre una llamada. **Medía la
palabra, no el código.**

Corregido filtrando las líneas de comentario, y conservando **las dos señales** (sin llamada
real **y** mencionado en un comentario): juntas demuestran que el filtro filtra. Una sola de
ellas no distingue «no hay llamadas» de «mi patrón no casa con nada».

## ⚠️ Suelo: la causa del cuelgue de SMTP NO está medida

Lo medido es que **SMTP agota 20 s desde dentro de Railway**. Que Railway **bloquee** la salida
por los puertos de SMTP es una **hipótesis** — no se ha comprobado desde dentro del contenedor,
y **no se escribe en ningún sitio como si fuera un hecho**.

No hace falta resolverla para arreglar esto: se sale por el canal que ya funciona en producción.

⚠️ **Y esto no queda probado hasta que llegue un correo.** Los tests prueban la forma de la
petición, el manejo del rechazo y que la clave no se filtra. **Que Resend entregue de verdad
desde Railway lo dice el primer aviso que llegue**, no esta tanda.

## Acción del fundador

Añadir **`RESEND_API_KEY`** al servicio cron de Railway (la misma del backend). Sin ella el
script sigue cayendo a SMTP — y ahora, al menos, lo dice en 20 segundos y **nombra el canal**.

## ⛔ Lo que este ticket NO toca

- ⛔ No toca `src/` ni el camino de emisión. Es `scripts/`.
- ⛔ No cambia la firma de `ejecutarPasada` ni ninguno de sus casos.
- ⛔ No es un envío automático nuevo (regla 28): es **el mismo aviso por otro canal**.
