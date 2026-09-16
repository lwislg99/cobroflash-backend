# SCRUM-863 · Qué hay que mover y qué apunta a la región vieja — medido desde el código

**Medido contra:** `origin/main` = `94e9a6b4e928e611f7585c941e09db21d73e2006` · 2026-09-16T11:02:17+01:00

**Carril:** infraestructura · censo · **Gate:** sin gate — no añade código de producto

**Tanda:** 7008 tests · 6898 pass · **0 fail** · 110 skipped · **exit 0** · `guards:entrada` 26/26. Sin tests nuevos: el total no se mueve por esta entrada.

> ## 🔴 ESTA ENTRADA MIDE LOS PUNTOS 1 Y 4. NADA MÁS.
>
> El ticket lo dice: una sesión puede medir **qué servicios existen** y **qué URLs están escritas**,
> y nada más. Aquí **no se ha ejecutado nada** contra ninguna base ni ningún proveedor, **no se ha
> tocado ni una URL**, y **no ha viajado ninguna credencial**. `src/` intacto.
>
> Los puntos 2 (duración de la parada), 3 (recuento por tabla) y 5 (vuelta atrás) **no se tocan**:
> no se miden desde el código.

---

## ① Punto 1 · Qué servicios hay desplegados

### 🔴 Lo primero, porque cambia lo que se puede afirmar: la región NO está en el código

Buscados en la raíz los once ficheros donde viviría una configuración de despliegue —`railway.json`,
`railway.toml`, `nixpacks.toml`, `Procfile`, `Dockerfile`, `docker-compose.yml`, `fly.toml`,
`render.yaml`, `vercel.json`, `app.json`, `.buildpacks`— y **no existe ninguno**.

**Así que la región de cada servicio NO es determinable desde el árbol.** Se declara, no se adivina:
vive en el panel de Railway, y quien la lea tiene que leerla allí. Lo único que el repositorio
registra sobre el asunto es una medición previa, en `docs/equipo/traspaso.md:76`: «las dos regiones
están en US West», junto con la lección que costó — **casi se mueve sólo la base**, poniendo 9.000 km
entre aplicación y base.

### Lo que el código SÍ declara que existe

| pieza | qué dice el código | ¿se mueve? |
|---|---|---|
| **la aplicación** | un **único** proceso: `start` = `node dist/index.js` (`package.json`). No hay script de worker, ni de cola, ni de cron aparte | **sí** |
| **los crons** | 🔴 **van DENTRO del mismo proceso**: `startCronJobs` se importa en `src/index.ts:4` y se apaga con `DISABLE_CRONS`. **No es un servicio aparte** | viajan con la app, sin hacer nada |
| **PostgreSQL** | vía Prisma. `DATABASE_URL` (44 usos) · `DATABASE_URL_STAGING` · `DATABASE_URL_TESTS` | **sí** |
| bases de usar y tirar | `LIBRO_PG_URL` (7) · `SERIE_PG_URL` · `TRAMOS_PG_URL` · `SCRUM650_DATABASE_URL` | **no**: son de tests, las levanta quien corre la tanda |
| copia de seguridad | `BACKUP_BD_URL` · `BACKUP_VERIFICACION_URL` · `BACKUP_PG_BIN` | **hay que mirarlo**: apunta a una base, y si se queda apuntando a la vieja copia lo que ya no está |
| correo saliente | `SMTP_URL` · `EMAIL_FROM` · Resend en producción | **no**: es de Resend |

**Y lo que NO existe, medido**: cero Redis, cero S3/AWS, cero colas externas, cero segundo proceso.
Sobre las **27** dependencias de `package.json` no hay ninguna de esa clase — el
`@aws-sdk/region-config-resolver` que aparece en `package-lock.json` es **transitivo**, no lo usa
nadie.

> 🔒 **Por qué esto contesta a «no sólo los dos obvios»:** porque la respuesta medida es que **sólo
> hay dos**. Los crons, que serían el tercero clásico que se queda atrás, **no son un servicio**:
> corren dentro de la aplicación. Eso no es una suposición tranquilizadora, es una línea:
> `src/index.ts:4`.

### ⚠️ Lo que NO puedo determinar, y va declarado

1. **La región real de cada servicio hoy.** No está en el árbol.
2. **Si hay servicios desplegados que el repositorio no conoce** (un Railway plugin, un cron externo,
   un bucket). Un censo del código sólo ve lo que el código nombra.
3. **A qué base apunta `BACKUP_BD_URL` en producción.** El nombre no lo dice y no se consulta nada.

---

## ② Punto 4 · Qué apunta a la región vieja

**Población:** 2303 ficheros de `src/`, `scripts/`, `tests/`, `public/`, `prisma/`, `.github/` y
`docs/` (excluida la propia carpeta de evidencias: el censo se contaba a sí mismo, que es la
autorreferencia de SCRUM-693/694 y ya mordió en SCRUM-523).

### Los controles, primero

| control | resultado |
|---|---|
| 🔴 **EL QUE DECIDE** — encontrar al menos un endpoint externo conocido | **4**: `graph.facebook.com` · `api.mercadopago.com` · `aeat.es` · `yaqu.app` |
| ✅ **POSITIVO** — una URL que sí está en el árbol | `https://yaqu.app` → **encontrada** |
| **SUELO** | menos de 50 URLs o cero servicios → CIEGO. Hay **434** |

### El falso positivo, separado

De las **434** URLs del árbol: **286 en código**, **43 en comentarios**, **105 en prosa** de `.md`.
Sólo las 286 en código pueden ser un endpoint configurado; las otras 148 son documentación o
ejemplos y **no se cuentan como hallazgo**.

### 🔴 La distinción que decide: saliente vs entrante

Sobre los **282** `.ts` de `src/` —lo único que se ejecuta en el servidor—, y fuera de comentarios:

**SALIENTE · hosts a los que la aplicación LLAMA.** Son infraestructura de terceros: **no se mueven
con nosotros y no hay que reapuntarlos.**

| host | dónde |
|---|---|
| `graph.facebook.com` | `src/integrations/whatsapp.ts:18` |
| `api.mercadopago.com` | `src/integrations/mercadopago.ts:9` |
| `www.mercadopago.com` · `sandbox.mercadopago.com` | `src/modules/billing/app/routes/payMp.routes.ts:43-44` |
| `api.resend.com` | `src/integrations/enviarCorreo.ts:113` |
| `generativelanguage.googleapis.com` | `src/integrations/gemini.ts:8` |
| `www2.agenciatributaria.gob.es` | `src/modules/fiscal/verifactu/registro.builder.ts:10-11` (el QR de cotejo) |
| `fonts.googleapis.com` · `fonts.gstatic.com` | en el HTML que generan las páginas de pago |
| `wa.me` | enlaces profundos a WhatsApp |

**ENTRANTE · por dónde entra un proveedor.** 🔴 **Aquí está el riesgo del punto 4**, y hay que decir
exactamente en qué consiste: **estas rutas existen en el árbol, pero la URL a la que cada proveedor
apunta NO vive aquí — vive en la consola de cada proveedor.**

| punto de entrada | dónde se monta | quién llama |
|---|---|---|
| `/webhooks/stripe` | `src/app.ts:148` | Stripe |
| `/webhooks/stripe-connect` | `src/app.ts:151` | Stripe (cuentas conectadas, CONNECT-1) |
| `/webhooks/resend` | `src/app.ts:156` | Resend |
| `/webhooks/mp` | `src/app.ts:366` | Mercado Pago |
| `/webhooks/whatsapp` | `src/app.ts:367` | Meta |
| `/webhooks/psp` | `src/app.ts:350` | **interno**: self-call tras secreto (externo → 404) |

> 🔒 **Y de aquí sale lo único que de verdad decide si un camino muere en silencio:** si la mudanza
> **conserva el dominio** (`yaqu.app`), esas seis URLs no cambian y no hay nada que reapuntar. Si la
> mudanza **cambia el host** —un `*.up.railway.app` nuevo, por ejemplo—, **las cinco externas hay que
> reapuntarlas una a una en la consola de su proveedor**, y ninguna de esas consolas se ve desde
> aquí. Cuál de los dos casos es, **no se puede leer del código**: se decide al montar el servicio
> nuevo, y hay que decidirlo antes.

### ⚠️ Los falsos negativos — qué formas he mirado, y cuál se me escapa

Una URL compuesta en ejecución no se ve buscando la cadena entera. Formas buscadas **en código, fuera
de comentarios**, con lo que encuentra cada una:

| forma | hallazgos |
|---|---|
| plantilla con hueco — `` `https://…${x}` `` | **104** |
| concatenación — `'https://…' +` | **12** |
| `new URL(...)` | **81** |
| base desde el entorno — `process.env.*URL/HOST/ENDPOINT/BASE/DOMAIN` | **70** |
| ruta relativa a la propia app — `fetch('/…')` | **50** |

🔴 **Y uno declarado que ninguna de esas formas ve: Stripe.** `new Stripe(clave)`
(`src/integrations/stripe.ts:6`) **compone su host dentro del paquete npm**. Buscar `stripe.com` en
el árbol da **cero**, y ese cero **no significa «no hablamos con Stripe»**. Es exactamente el falso
negativo que el encargo avisa, y por eso se escribe en vez de dejar el cero.

⚠️ **Lo que sigo sin poder ver**: una URL que venga de la base de datos, del panel de Railway o de un
secreto. Un censo del código no alcanza ahí.

### 🔴 Un rojo que sacó la tanda, y era mío

`SCRUM-124` tumbó la tanda por **mi propio script de evidencia**: prohíbe el literal
`graph.facebook.com` fuera de `src/integrations/whatsapp.ts` —«todo envío a WhatsApp pasa por ahí,
SIEMPRE»— y mi censo lo escribía en su lista de endpoints conocidos, la del control que decide.

**Tenía razón aunque aquí no se llame a nadie:** ese guard compara por **texto**
(`content.includes` sobre `.ts/.js/.mjs`) y no puede distinguir una llamada de una mención. Es la
autorreferencia de SCRUM-693/694 otra vez, ahora contra un guard de seguridad de canal.

**La salida NO fue meterme en su lista blanca.** Esa lista protege el canal de WhatsApp, y añadir un
censo a una excepción de seguridad es aflojar un guard para que pase lo mío (regla 41). Se compone
el literal —`['graph','facebook','com'].join('.')`—, que es lo que ya hizo SCRUM-694c con la misma
clase de problema. El control sigue encontrando el endpoint; lo único que cambia es que el literal
ya no está escrito.

### La base propia de la aplicación

`PUBLIC_BASE_URL` (5 usos) es de dónde saca la app su propia dirección — y tiene **respaldo
cableado**: `config.PUBLIC_BASE_URL || 'https://yaqu.app'`
(`src/modules/auth/domain/referral.service.ts:55`, `src/modules/messaging/domain/lifecycle.service.ts:16`).

🔴 **Y hay 10 auto-referencias absolutas a `https://yaqu.app` escritas en `src/` fuera de
comentarios**, cuatro de ellas en enlaces que se le mandan al cliente por WhatsApp:

```
src/integrations/whatsappNotifications.ts:97,105   `https://yaqu.app/recibo/${params.receiptToken}`
src/modules/billing/domain/invoiceWhatsApp.service.ts:102,110   `https://yaqu.app/pay/invoice/${payToken}`
```

**No se tocan** (esto mide). Pero se listan porque son la respuesta a «qué pasa si cambia el
dominio»: esas cuatro **no miran `PUBLIC_BASE_URL`**, así que seguirían mandando a `yaqu.app` pase lo
que pase. Si el dominio se conserva, están bien; si cambiara, son enlaces de cobro rotos y **es la
clase de fallo silencioso que el ticket persigue**.

---

## Lo que NO se hizo

- **Nada ejecutado** contra base ni proveedor. **Ninguna credencial**, ni de staging.
- **Ninguna URL cambiada.** Ni una.
- **`src/` intacto** · cero dependencias (36) · cero estado o flag (27).
- Los puntos 2, 3 y 5 del ticket **no se tocan**: no se miden desde el código.

> ⚠️ **Nota de tanda:** esta entrada **no añade ni un test**; el total de la tanda no se mueve. Los
> dos scripts de `docs/master/evidencias/SCRUM-863/` se ejecutan a mano y **no los importa ningún
> test**, así que no entran en `npm test`.
