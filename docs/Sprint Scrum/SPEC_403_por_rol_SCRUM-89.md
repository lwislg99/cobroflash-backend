# SPEC_403_por_rol_SCRUM-89.md — Especificación

**SCRUM-89 · El Operario ve acciones que no puede ejecutar (403 crudo tras SCRUM-55)**
Spec del carril B (Javier) · **ejecuta el carril A (Luis)** · Fase F2

> Reglas de proceso vigentes: `docs/ASESOR.md`. Microcopy: regla 30 — el texto de esta spec
> es el CANÓNICO aprobado por el fundador; no se improvisa otro al implementar.

---

## 1. Por qué esta spec la escribe un carril y la ejecuta el otro

El recon es del carril B (dueño del ticket), pero **todos los ficheros a tocar son del carril A**:
`jobDetailView.js` y `jobsView.js` (ASESOR.md §4.2), y `api.js`, que es zona compartida.

Además `jobDetailView.js` lo está reescribiendo **SCRUM-31** (rediseño). Meter una segunda mano ahí
es pedir un conflicto. Por eso: **la spec es del carril B, la ejecución es del carril A.**

---

## 2. Prioridad: ALTA

Elevada desde High por decisión del fundador, y el motivo importa más que la etiqueta:

> «Confirmar Bizum es el MOMENTO DEL COBRO. Un operario que marca un cobro recibido y se come un
> 403 no sabe si el dinero quedó registrado.»

No es una molestia de UX. Es **ambigüedad sobre dinero real**: el operario ha visto el Bizum en su
móvil, pulsa «confirmar», recibe `API 403: forbidden` y no puede saber si el sistema anotó el cobro
o no. La respuesta correcta —«esto lo hace el administrador»— convierte un estado ambiguo en una
instrucción clara.

---

## 3. Microcopy CANÓNICO (regla 30 — literal, no orientativo)

```
Esta acción es solo para administradores.
Pídeselo a quien gestiona la cuenta.
```

**Regla del fundador que lo gobierna, y que aplica más allá de este ticket:**

> Un error dice **qué puede hacer la persona**, no qué falló técnicamente.

`API 403: forbidden` describe el sistema. «Pídeselo a quien gestiona la cuenta» describe la salida.
El operario no ha hecho nada mal y el texto no debe sugerir lo contrario: no dice «no tienes
permiso» ni «acceso denegado» — dice de quién es esa acción y a quién acudir.

---

## 4. Ocultar vs. deshabilitar — la distinción que ordena todo

> **«No puedes» ≠ «no es para ti».**

| | Qué se hace | Por qué |
|---|---|---|
| **DESHABILITAR con explicación** | Acciones **de su flujo** que no son de su rol | El operario trabaja en ese trabajo: cobrar el resto, confirmar el Bizum y consolidar albaranes forman parte de lo que él vive a diario. Esconderlas le oculta el estado real del trabajo. Debe **verlas, entender que existen y saber a quién pedírselas**. |
| **OCULTAR** | Lo que **no le corresponde en absoluto** | Métricas, exports, informes, planes, equipo. No son parte de su trabajo; enseñárselas deshabilitadas es ruido y le hace sentir vigilado o limitado sin motivo. |

Deshabilitar sin explicación está **prohibido**: un botón gris y mudo es peor que el 403, porque no
da ni siquiera un camino. Si se deshabilita, se acompaña del microcopy de §3 (tooltip, `title`, o
texto junto al botón — decisión de implementación, ver §7).

---

## 5. Inventario verificado (`main` = 75fb218, 23-jul-2026)

⚠️ Las líneas se movieron con SCRUM-31; estas están **reverificadas hoy**. Si SCRUM-31 sigue vivo al
implementar, **volver a localizar por patrón** (`grep` de la ruta), no por número de línea.

### 5.1 DESHABILITAR (de su flujo, no de su rol)

| CTA | Fichero | Ruta gateada |
|---|---|---|
| **💰 Cobrar el resto** | `jobsView.js:214` **y** `jobDetailView.js:212` | `POST /admin/jobs/:id/collect-rest` |
| **Consolidar albaranes** | `jobDetailView.js:551` | `POST /admin/jobs/:id/consolidar-albaranes` |
| **Confirmar Bizum** ⚠️ | `jobDetailView.js:1026` | `POST /admin/charges/:id/confirm-bizum` |
| Marcar factura PAGADA | `jobDetailView.js:1000` | `PUT /admin/invoices/:id/status` |
| Anomalía de importe | `jobDetailView.js:994` | `POST /admin/invoices/:id/payment-anomaly` |
| Recordar pago | `jobDetailView.js:218` y `:1041` | `POST /admin/invoices/:id/send-reminder` |
| Reenviar por WhatsApp | `jobDetailView.js:1053` | `POST /admin/invoices/:id/resend-whatsapp` |

**Tres hallazgos que el ticket original no recogía:**

1. **«Cobrar el resto» está en DOS ficheros** (lista y detalle), no solo en el detalle. Arreglar uno
   deja el otro roto.
2. **«Confirmar Bizum» también está roto** y nadie lo había reportado: `/admin/charges` pasó a
   admin-only en el *mount* (`app.ts:256`), no en la ruta, así que no aparece al buscar
   `requireRole` dentro de los ficheros de charges. **Es el CTA que motiva la prioridad ALTA.**
3. **Los CTA de factura ya eran admin-only ANTES de SCRUM-55.** El operario lleva meses viéndolos
   sin que funcionen. SCRUM-55 no lo causó: lo hizo visible.

### 5.2 OCULTAR (no le corresponde)

Ya resuelto en `app.js:40-48` para nav (`nav-plans`, `nav-team`, `nav-operarios`, Configuración).
**No hay que tocarlo** — es el patrón a clonar, no a modificar.

### 5.3 Ya correcto (no tocar)

`quotesListView.js:243` ya comprueba el rol antes de pintar el CTA de aprobar presupuesto. Es el
precedente de comportamiento: **no contradecirlo**.

---

## 6. El patrón a clonar

`window.appUserRole` se fija **una vez** en `app.js:10` desde `/admin/me` y es global: cualquier
vista lo lee sin pedir nada.

```js
// app.js:40 — patrón establecido
if (window.appUserRole !== 'admin') { … }
```

Ya lo usan `app.js`, `homeView.js` y `quotesListView.js`. **`jobDetailView.js` y `jobsView.js` no lo
leen ni una vez** — de ahí el bug.

**Doctrina (comentario de SCRUM-24 en `app.js:41`, se mantiene):**

> Ocultar el nav es UX; **la seguridad real la da el 403 del backend.**

Esconder o deshabilitar botones **no sustituye** al gate de servidor: lo complementa. Nada de lo que
diga esta spec autoriza a relajar `requireRole`.

---

## 7. ⚠️ DECISIÓN PENDIENTE DE LUIS AL IMPLEMENTAR: dónde vive el texto

Hay dos sitios posibles y **hay que elegir uno**. Implementar los dos deja dos fuentes del mismo
texto que se desincronizan a la primera (regla 30).

### Opción A — el front lo resuelve (RECOMENDADA)

En `api.js`, rama hermana de la que **ya existe** para `trial_expired` (`api.js:25-32`):

```js
if (res.status === 403 && data && data.error === 'forbidden') {
  const e = new Error('Esta acción es solo para administradores. Pídeselo a quien gestiona la cuenta.');
  e.status = 403; e.data = data; e.handled = true;
  throw e;
}
```

**A favor:** no toca el middleware (zona sensible, la está tocando el carril A en otras tareas);
patrón ya establecido en el mismo fichero; **arregla los 12 sitios de golpe sin editarlos**, porque
todos leen `err.message`; y funciona como **red de seguridad** para cualquier CTA que se olvide de
deshabilitar — que siempre se escapa alguno.

### Opción B — `authMiddleware` añade `message`

`requireRole` (`authMiddleware.ts:44-52`) devuelve hoy `{ error: 'forbidden', required_role }`, **sin
`message`**. Añadirlo lo resolvería en origen.

**En contra:** mete microcopy de producto dentro de un middleware de seguridad, y obliga a tocar
`src/core/http/` — que es donde vive la red fail-closed de SCRUM-55.

### Por qué hoy sale «API 403: forbidden»

Los catch hacen `err?.data?.message || err.message`. Como `data.message` **no existe**, cae a
`err.message`, que `api.js:35` construye como `` `API ${res.status}: ${data?.error}` ``. Literalmente:

> «No se pudo generar el cobro: API 403: forbidden»

Son **12 llamadas a `showToast` con `.message`** en 8 vistas. Ninguna hay que tocar si se elige A.

---

## 8. Diseño final: DOS capas, ninguna sustituye a la otra

1. **Prevenir** — deshabilitar (§4/§5.1) para que el operario no llegue a pulsar y sepa a quién
   pedírselo.
2. **Red** — el handler de §7 para el CTA que se escape, hoy o dentro de seis meses.
3. **(Ya existe)** — el 403 del backend. Intacto. La seguridad no está aquí.

---

## 9. Verificación

- [ ] Sesión de **Operario real** (no simulada): los CTA de §5.1 se ven **deshabilitados con
      explicación**, no ausentes y no mudos.
- [ ] Los de §5.2 siguen **ocultos**.
- [ ] Forzar un 403 de rol → sale el texto de §3, **nunca** «API 403: forbidden».
- [ ] Sesión de **Admin**: todo sigue funcionando igual (sin regresión).
- [ ] `quotesListView.js:243` sigue comportándose como antes.
- [ ] `requireRole` **sin cambios** si se elige la opción A.
- [ ] Suite en verde, incluido `scrum55-admin-fail-closed.test.mjs` (los 4 del enumerador).

## 10. Fuera de alcance

- **SCRUM-104** (`clientes.csv` filtrado por fecha de alta) — otro ticket, mismo paquete.
- Revisar si algún CTA **debería** ser de operario. Esta spec **no reabre la tabla S1**: acepta el
  reparto de roles vigente y solo arregla cómo se comunica.
