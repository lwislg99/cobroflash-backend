# SCRUM-355 · H0 — Medir antes de nada

**Medido contra:** `origin/main` = `572c9414f620f70ef4e980ca4948fccbaf9c47ea` · 2026-08-07T20:02:08+01:00

**7-ago-2026** · rama `scrum-355-h0-medir` · **NO SE CONSTRUYÓ NADA**

---

# 🔴 LA RESPUESTA A LA PREGUNTA 1, EN UNA LÍNEA

> **SÍ existe firma en el aparato del profesional: el botón «Firmar aquí mismo» abre el pad de
> firma DENTRO del dashboard autenticado. El bloque H NO se para.**

`public/dashboard/js/albaranDetailView.js:348-350` · `public/dashboard/index.html:234`

---

## Chequeo de duplicados contra main (paso 0)

El mecanismo de SCRUM-388 **no está en `main`** —vive en `origin/scrum-388-censo-contra-main-rebasada-3`
y sus hermanas—, así que se hizo a mano. **SCRUM-355 estaba virgen**, comprobado por cuatro vías:

| Comprobación | Resultado |
| --- | --- |
| commits que citan `SCRUM-355` en `main` | **0** |
| commits que lo citan en **cualquier** ref | **0** |
| `docs/master/SCRUM-355.md` en `main` | **no existe** |
| ramas con `355` en el nombre | **ninguna** |

⚠️ Los ficheros `censo-*` de `main` (`scripts/censo-reparto.mjs`, `tests/_censo-*.mjs`) son censos
de **otras** cosas —reparto, configuración, cobro—. **Parecerse no es serlo**: no se han contado
como mecanismo de este ticket.

---

## P1 · ¿Quién firma un albarán y en qué aparato?

**`[MEDIDO]`** — **Existen LOS DOS flujos**, y por eso el bloque sigue en pie.

| Flujo | Dónde | Ruta que recibe la firma |
| --- | --- | --- |
| **En el aparato del PRO** (dashboard autenticado) | `albaranDetailView.js:348` → `window.openSignaturePad` (`public/dashboard/js/signaturePad.js`, cargado en `public/dashboard/index.html:234`) | `POST /admin/albaranes/:id/firmar` — `albaranes.routes.ts:638` |
| **Enlace público** por WhatsApp (firma remota, SCRUM-49) | página pública por token | `GET /:token` — `albaranPublic.routes.ts:215` · `POST /:token/firmar` — `:306` |

El código lo dice explícitamente (`albaranDetailView.js:344-347`): *«FIRMAR ES DE VERDAD AQUÍ. El
rótulo aprobado dice "aquí mismo" y tiene que ser cierto: un botón que promete firmar y te manda a
otra pantalla a buscar otro botón es peor que no tenerlo»*.

**Consecuencia para H:** el escenario del sótano es viable, porque el aparato que firma es el del
profesional — que **sí** ha visitado nuestro origen y **sí** está bajo el service worker del
dashboard. La firma remota por enlace público es el otro camino y ése sí depende del móvil del
cliente, que nunca ha visitado el origen.

## P2 · Qué móvil y qué navegador usan los pros

**`[HUECO]`** — **no se puede medir hoy, y no se estima.**

Lo medido en el código, para acotar el hueco:

* **No hay telemetría de producto** que registre navegador o sistema del profesional: cero
  analítica de terceros (`gtag`, `posthog`, `mixpanel`, `plausible`) en `public/dashboard/`.
* `navigator.userAgent` se lee en **dos** sitios y **ninguno lo persiste**: `tutorial.js:42`
  (detectar headless) y `voiceInput.js:16` (detectar iOS).
* **Sí existe una fuente potencial**: la columna `user_agent` de `legal_acceptances`
  (`prisma/schema.prisma:649`) y el evento de suscripción (`subscriptions.routes.ts:58`).
* **Y la instalación en pantalla de inicio ya se sabe detectar**, aunque no se registre:
  `voiceInput.js:19-21` (`isStandalonePWA()`, con el `navigator.standalone` de Safari iOS).

**Qué haría falta para contestarla:** (1) que existan usuarios reales —hoy **cero clientes**—,
(2) permiso para consultar la base (esta sesión tiene prohibido mirar ninguna), y (3) decidir si se
registra `display-mode` en algún evento, porque **hoy no se persiste en ninguna parte**.

> **No se rellena con medias de mercado.** La cuota de iPhone en España no dice nada de NUESTROS
> usuarios, y el ticket avisa de que si la mitad van en iPhone el bloque cambia de forma entera.

## P3 · ¿Se puede crear un albarán sin red?

**`[MEDIDO]`** — **No con el diseño de hoy: el número lo asigna el servidor.**

* Creación: `POST /admin/jobs/:id/albaranes` — `jobs.routes.ts:632`.
* El número de serie se reserva **dentro de la transacción**:
  `const numero = await allocateAlbaranNumber(tx, req.merchantId!)` — `jobs.routes.ts:681` y
  `albaranes.routes.ts:626`. SCRUM-302 lo metió ahí **a propósito**, por la carrera de numeración.
* **No existe clave de idempotencia generada en el cliente**: cero `crypto.randomUUID`, cero
  `uuid`, cero `idempotenc*` en `public/dashboard/js/`. La única mención de `uuid` es un comentario
  de `semaforoFiscal.js:21` explicando por qué **no** se usó uno.

**Consecuencia:** se podría rellenar el formulario sin red, pero el albarán **no existe hasta que
el servidor le da número**, y no hay clave con la que reconciliar un envío repetido. **H3 no es
ejecutable hasta que se decida de dónde sale esa clave** — tal como el ticket anticipaba.

## P4 · Dónde vive `computeAlbaranContentHash`

**`[MEDIDO]`** — **En el servidor, y NO es ejecutable en el navegador tal cual.**

* Definición: `src/modules/jobs/domain/albaran.service.ts:459`.
* Implementación: `crypto.createHash('sha256').update(JSON.stringify(contenidoCanonico(...)))`.
* **El fichero importa `path`, `fs`, `crypto` de Node, `prisma`, `albaranesDir` y
  `generateAlbaranPdf`** (`:6-11`). Con **frontend vanilla sin bundler (regla 4)** no se puede
  importar en el navegador.
* En el navegador el equivalente sería `crypto.subtle.digest`, que es **otra API y además
  asíncrona**: no es un copiar-pegar.

**Se confirma el riesgo que el ticket señalaba como dudoso y crítico:** habría que **duplicar** la
función, y dos implementaciones del mismo hash que deriven en silencio producen conflictos falsos
o —peor— conflictos **no detectados**, en el mecanismo que existe precisamente para detectarlos.

## P5 · Qué cachea hoy el service worker

**`[MEDIDO]`** — censo **derivado** del array `SHELL` de `public/sw.js`, con suelo: el derivador
falla si no encuentra el array o si sale vacío.

* **Precache: 50 rutas** — 47 `.js`, 2 `.css`, 1 sin extensión (`/dashboard/`).
* **Rutas de datos en el precache: 0.**
* **Ninguna respuesta autenticada se cachea.** `sw.js:90-96` manda a red directa y sin caché todo
  lo que empiece por `/admin/`, `/auth/`, `/quote`, `/webhooks/`, más `/version` y `/health`.
* **Estrategia de runtime:** network-first para estáticos del propio origen; la respuesta buena
  refresca la caché y, si la red falla, se sirve lo último cacheado (`sw.js:100-123`).
* **La cabecera `Authorization` no aparece en el service worker.**
* 🔴 **IndexedDB NO EXISTE en el producto**: **cero** ficheros en `public/` y `src/` lo mencionan.

**Consecuencia:** hoy el SW sirve la **cáscara** de la aplicación sin red, pero **ningún dato**. La
cola y la resolución de conflictos que el bloque necesita son **pieza nueva entera**.

## P6 · Qué pasa hoy si firmas sin red

**`[MEDIDO en el código]` / `[HUECO en la prueba con aparato real]`**

**No falla en silencio** — el tercer caso, el peor, **no ocurre**. `albaranDetailView.js:362-369`:

```js
try {
  await apiRequest(`/admin/albaranes/${alb.id}/firmar`, { … });
} catch (e) {
  setStatus('error', 'No se pudo firmar: ' + (e?.data?.message || e.message));
  return;                       // ← no continúa, no refresca
}
```

Pero hay **dos matices medidos que el bloque debería conocer**:

1. **El mensaje no nombra la causa.** `api.js:17` hace `const res = await fetch(url, finalOptions)`
   **sin try/catch alrededor del `fetch`**, y no consulta `navigator.onLine`. Un fallo de red sube
   como `TypeError: Failed to fetch`, así que el profesional lee **«No se pudo firmar: Failed to
   fetch»** — visible, pero en inglés y sin decir que es la cobertura.
2. 🔴 **El trazo se pierde.** `signaturePad.js:276-277` hace `close(); onConfirm(dataUri, …);` — el
   modal **se cierra antes de enviar**. Si el envío falla, la firma del cliente ya no está y hay
   que **pedírsela otra vez, delante de él**. Es exactamente la escena que SCRUM-379 describe en el
   comentario de la línea siguiente: *«le pide al cliente que firme POR SEGUNDA VEZ delante de él»*.

**`[HUECO]`:** la prueba en modo avión con un aparato real y sesión iniciada **no se ha hecho** —
requiere un móvil, una sesión y un albarán. Lo de arriba es el camino leído en el código, no la
observación. **Qué haría falta:** un móvil con sesión, un albarán en borrador y modo avión.

## P7 · Qué captura el canvas de firma

**`[MEDIDO]`** — **solo la imagen del trazo.**

* Lo único que sale del pad: `const dataUri = canvas.toDataURL('image/png')` —
  `signaturePad.js:264`.
* Los eventos son `pointerdown` / `pointermove` / `pointerup` / `pointercancel`
  (`signaturePad.js:185-206`), y se usan **para pintar**.
* **No se captura presión** (cero `e.pressure`, cero `force`), **ni velocidad, ni tiempos**: no hay
  ninguna estructura que acumule puntos con marca temporal.

**El dato, sin interpretar:** se guarda una imagen PNG del trazo y nada más.
**La interpretación jurídica es del asesor** — el ticket pregunta si entra el art. 9 RGPD y esta
sesión no lo contesta.

## P8 · Sesión y borrado

**`[MEDIDO]`** — **al cerrar sesión no se purga nada del almacenamiento local.**

`app.js:436-439`, la función entera:

```js
async function logout() {
  await fetch('/auth/logout', { method: 'POST' }).catch(() => {});
  window.location.href = '/login.html';
}
```

Cero `caches.delete`, cero `indexedDB.deleteDatabase`. La caché de la cáscara **sobrevive al
logout**.

**Alcance real de eso, hoy:** limitado, porque por P5 **el SW no cachea ningún dato autenticado** —
lo que queda es HTML/CSS/JS. **Pero deja de ser inocuo en cuanto el bloque H meta datos de albarán
en el dispositivo**, que es justo lo que propone.

**`[HUECO]` — sesión caducada estando sin red:** no hay manejo explícito de `401` en
`public/dashboard/js/api.js` ni en `app.js`, así que no se puede afirmar desde el código qué ve el
profesional en ese caso. **Qué haría falta:** reproducirlo con una sesión caducada y el aparato sin
red — misma dependencia que P6.

---

## Recuento

| | |
| --- | --- |
| **`[MEDIDO]`** | **6** — P1, P3, P4, P5, P7, P8 (la parte del logout) |
| **`[HUECO]`** | **2 enteras** — P2 y la parte de prueba real de P6 · **+1 parcial**: la sesión caducada de P8 |

**Ninguna respuesta sin etiqueta.** Las tres cosas que faltan dependen de lo mismo: **usuarios
reales y un aparato con sesión**. No se han estimado.

## Lo que esto deja dicho para el resto del bloque H

Sin sacar conclusiones de diseño, que no son de este ticket:

* **H sigue existiendo** (P1), pero solo para el flujo del aparato del profesional. La firma remota
  por enlace público queda fuera de cualquier solución de sin-cobertura.
* **Tres piezas son NUEVAS, no ajustes**: IndexedDB (P5), la clave de idempotencia (P3) y un hash
  ejecutable en navegador (P4).
* **P2 puede cambiar la forma del bloque entero** y no se puede contestar hoy. El ticket dice que
  sin ese dato no se puede diseñar nada: eso queda como está.

## Lo que no se ha tocado

Nada. Ni el mecanismo de firma, ni el service worker, ni `prisma/schema.prisma`, ni el camino de
emisión. No se ha consultado ninguna base de datos. Ni una línea de producto.
