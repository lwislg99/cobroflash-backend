> ⚠️ Escrito bajo el protocolo anterior. Las reglas de proceso vigentes están en `docs/ASESOR.md`, que manda sobre lo que diga este documento.

# SESION_ACTUAL_SCRUM-55.md — Brief
**SCRUM-55 · SEGURIDAD · Auditoría completa de rutas `/admin` + red fail-closed**
Carril B (Javier) · Fase F2 · **Absorbe SCRUM-54** (decisión del fundador).
Estado: **v1.0 — alcance y orden aprobados por el fundador.**

---

## 1. El problema de fondo (no son tres rutas)

**124 rutas bajo `/admin`. 79 llegan a un Operario sin ninguna declaración de rol.** Las tres que confirmamos en producción eran la punta.

Y la causa raíz no es el descuido: **nada obliga a declarar rol**. La tabla S1 dice *"ruta nueva = declara rol mínimo; default Admin-only"*, pero eso hoy **no lo hace cumplir nada**. Por eso el fallo es reproducible: la ruta 125 también va a nacer abierta.

> **La frase que resume el ticket** (del recon): *"No es que faltara criterio: faltaba quien lo aplicara."* La regla de que emitir factura es solo-admin estaba escrita en un comentario, en el mismo fichero, al lado de una ruta desprotegida.

---

## 2. Decisiones del fundador (cerradas)

**D1 — SCRUM-54 se absorbe aquí. NO se reabre** (`ASESOR.md §4.1`). Su fix se aplicó por error a `consolidar-albaranes` (que cita *"S1/SCRUM-54"* en su comentario) mientras `collect-rest` se quedó abierta. Luis comenta en la 54; el cierre real ocurre aquí.

**D2 — Las tres rutas dudosas son ADMIN-ONLY**, confirmado:
- `POST /admin/quotes/:id/invoice` — emitir factura es dinero.
- `POST /admin/jobs/:id/collect-rest` — mismo caso (era el objetivo original de SCRUM-54).
- `DELETE /admin/customers/:id` — irreversible y arrastra el historial del cliente.

> *"Si algún flujo real de un técnico las necesitara, se escala al admin; no se baja el permiso."*

**D3 — El test fail-closed corre en `npm test` NORMAL, sin gate.** Motivo: A12.4 solo corre en `test:staging` y **ya se cayó entera sin que nadie se enterara**. Una red que solo funciona en staging no es una red.

**D4 — Orden:** primero **Nivel 1 (dinero/fiscal) + el test**. El resto de las 79, después, por tandas.

---

## 3. ⚠️ La tensión a resolver en el PLAN (decisión de diseño, repórtala)

D4 dice "el resto por tandas", pero **el test falla si alguna ruta no está declarada**. O se clasifican las 79 ahora, o el test no puede mergearse verde. Dos caminos:

**(a) Clasificar las 79 en este PR.** Es lo que proponía el recon. La mayoría son ✅ Técnico obvias (albaranes, quotes ver/enviar, search, attachments). Más trabajo de golpe, pero deja la red completa desde el día uno.

**(b) Lista de "pendiente de clasificar" que mengua por tandas.** El test pasa hoy con las 79 ahí dentro, y cada tanda las va sacando. Encaja con D4.

**⚠️ El riesgo de (b):** una lista de pendientes que nunca mengua es solo una forma de tener el test en verde sin hacer nada — exactamente el patrón que este ticket combate. Si se elige (b), la lista debe ser **visiblemente temporal**: comentario con fecha, y valorar que el test avise (o falle) si sigue teniendo entradas pasada una fecha.

**Recomendación del asesor: (a) si el volumen es asumible**, porque cierra el problema entero. Si al clasificarlas ves que hay muchas dudosas que necesitan decisión de producto, entonces (b) con la lista bien marcada. **Mídelo y decide en el PLAN.**

---

## 4. Alcance V1

### A) La red fail-closed (lo más valioso — D3)
Tres piezas, del recon:
1. **Marcar `requireRole`** (`authMiddleware.ts:35`): hoy devuelve una arrow anónima, indistinguible de cualquier middleware. Añadir `fn.__requiredRole = role`. **Una línea.**
2. **Registrar los montajes explícitamente.** Express 5 **no guarda el prefijo**: en una capa de router `layer.path` es `undefined` y `layer.matchers` son funciones opacas (verificado). No se puede reconstruir `/admin/metrics` desde el stack. → tabla de montajes exportada desde `app.ts`, o helper `mountAdmin(prefix, gates, router)`. Determinista, sin depender de internals.
3. **El test de enumeración:**
   - Recorre `app.router.stack` (Express 5; `app._router` **ya no existe** — cualquier receta de Express 4 devuelve `undefined`).
   - Cada ruta `/admin` debe estar en **exactamente uno** de dos sitios: declara `requireRole`, o está en una lista explícita de visibles para Técnico **con motivo, una línea por entrada**.
   - Ni lo uno ni lo otro → **falla nombrando método y path**.
   - **Segundo assert, dirección contraria:** toda entrada de las listas debe corresponder a una ruta montada de verdad → mata `billing/summary` y cualquier entrada muerta futura.
   - **Sin BD, sin servidor**: solo importa `dist/app.js` e inspecciona. Por eso puede correr en `npm test`.

### B) Nivel 1 — dinero/fiscal (D4: primero)
| Ruta | Fichero:línea | Por qué |
|---|---|---|
| `POST /admin/charges/:id/confirm-bizum` | `chargesAdmin.routes.ts:15` | Marca un cobro como **pagado** y dispara la cadena post-pago |
| `POST /admin/quotes/:id/invoice` | `quotesAdmin.routes.ts:123` | **Emite factura** (D2) |
| `POST /admin/jobs/:id/collect-rest` | `jobs.routes.ts:383` | Factura del resto + `payment_request` (D2, era SCRUM-54) |
| `POST /admin/invoices/:id/regenerate-pdf` | `invoicesAdmin.routes.ts:606` | Reescribe el PDF de una factura emitida (**regla 29**) |
| `GET /admin/reports/vat` | `reports.routes.ts:193` | IVA trimestral = "datos fiscales", ❌ explícito en S1 |

### C) Los 3 gates inline → `requireRole`
`app.ts:272` · `quotesAdmin.routes.ts:394` · `jobs.routes.ts:462`. Son **invisibles a cualquier enumeración**, así que la red no los ve. Convertirlos los hace visibles y unifica el idioma.

> 🔴 **Y arregla el sentido del de `jobs.routes.ts:462`**: usa `=== 'tecnico'` (**denylist**) en vez de `!== 'admin'` (**allowlist**). Hoy da igual porque el tipo solo admite `admin|tecnico`, pero es **fail-open**: el día que exista un tercer rol, pasa. Ese es justo el error que este ticket combate.

### D) Preferir montaje por router
Dato del recon: los **4 routers con gate en el montaje tienen 0 agujeros**; los que gatean ruta a ruta tienen agujeros **en las rutas añadidas después**. Donde el router entero sea admin-only (`/admin/reports`, `/admin/expenses`), gatear **en el montaje**, no ruta a ruta: cierra de golpe y protege las futuras.

---

## 5. Fuera de V1
- Los Niveles 2 y 3 (metrics, expenses, products, templates, providers, customers/import) → **tandas siguientes** (D4).
- No se toca schema, ni dinero en producción, ni copy.

---

## 6. STOP conditions
- 🛑 Zona roja: `app.ts`, `adminOnlyRoutes.ts`, `authMiddleware.ts` y varios routers del carril A → **anunciar en el ticket** antes de commitear. Este PR toca muchos ficheros ajenos: la lista completa, en el aviso.
- 🛑 **El riesgo real de este PR es funcional, no técnico:** alguna ruta que un Operario usa hoy y que S1 dice que no debería. Si al clasificar aparece una que huela a flujo de campo real → **PARA y reporta**, no la cierres por tu cuenta.
- 🛑 Nada de tocar lógica fiscal: solo el **gate** de `reports/vat`, no su contenido.

---

## 7. Tests
- **El test de enumeración** (§4.A) — es el entregable, no un extra. Debe **fallar de verdad**: pruébalo quitando un gate a propósito y confirma que se pone rojo. Un test que no has visto fallar no sabes si funciona.
- **A12.4 se queda como está** (`tenancy-permisos.test.mjs:136`): sigue siendo la comprobación de **comportamiento** (403 real con sesión de técnico). El nuevo garantiza que **su lista sea completa**, que es lo que hoy nadie garantiza. Son complementarios.
- **Verificación de las 5 rutas de Nivel 1**: sesión de Operario → **403** en cada una. Incluida `collect-rest`, que es la evidencia que le faltó a SCRUM-54.
- Datos efímeros propios. Avisar antes de usar staging.

---

## 8. Definición de Hecho
- `npm run build` + `npm test` (con el test nuevo) + gateados contra staging en verde.
- Las 5 rutas de Nivel 1 → 403 verificado con sesión de Operario real.
- PR con la lista completa de ficheros tocados anunciada en el ticket; lo revisa Luis; mergeas y cierras tú.
- En el cierre: dejar escrito **cuántas rutas quedan sin clasificar** y en qué tanda van. Que nadie lea "auditoría completa" y crea que están las 124.
- **SCRUM-54 se cierra de verdad aquí** (con la evidencia del 403 que nunca tuvo).
