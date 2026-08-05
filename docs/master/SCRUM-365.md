# SCRUM-365 · La asimetría de permisos del tarifario: lo protegido era leer y lo abierto, escribir

**Fecha:** 5-ago-2026 · **Carril:** D (productos) · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `32395e21a2ccaeb0b63ebb3dbb928670b83aa6d6` · 2026-08-05T10:45:17+02:00
**Tanda:** 1544 tests, 1477 pass, 0 fail, 67 skipped

## El defecto

`GET /admin/products/export` exigía `requireRole('admin')` desde SCRUM-103. `POST /import` y
`POST /load-catalog` no exigían nada.

**Un Operario no podía exportar el catálogo, pero sí sustituirlo entero por un CSV.** Lo protegido
era leer y lo abierto era escribir, al revés de como se protege cualquier cosa.

Y detrás están los **precios**: un tarifario reescrito es cada presupuesto siguiente mal, y eso no
se ve en el momento — se ve cuando el cliente ya ha firmado.

## El criterio no se inventa: ya estaba escrito

`adminRouteDeclarations.ts` declara el default del sistema —*«ruta nueva = declara rol mínimo;
default Admin-only»*— y, en el motivo de **la única operación destructiva que un Técnico sí puede
hacer sobre productos**, escribe la frontera exacta:

> `DELETE /admin/products/:id` — **«Simétrico del alta; una línea de catálogo, NO el tarifario»**

Ésa es la línea: **línea suelta → Técnico · catálogo entero → Admin**. Este ticket solo la aplica.

Y las dos rutas ya lo proponían en su propia ficha: *«Reescribe el tarifario en bloque → admin»* e
*«Ídem, carga catálogo entero»*. Lo que las mantenía aparcadas no era una duda: era la tarea sin
hacer — exactamente lo que le pasó a `/export` en SCRUM-103.

**Por qué no las cazó el assert de SCRUM-103:** ese assert busca dudas que *citan el máster como ya
decidido*. Éstas **proponían** sin citar, así que pasaban con razón. La heurística no falló; el
caso era otro.

## El tope baja en el mismo commit

`PENDIENTE_MAX` **16 → 14**, porque el propio fichero lo exige y explica por qué:

> *«Dejarlo en 24 con 17 entradas NO pone el test en rojo: lo deja en verde con SIETE huecos libres
> para aparcar sin que nadie se entere. El ratchet no protege por existir, protege por ir
> apretado.»*

## El front, para no cambiar un agujero por un 403

Cerrar el servidor sin tocar la pantalla le habría dejado al Operario tres botones que fallan
*después* de haber hecho el trabajo — elegir el CSV, esperar, y recibir un 403.

Se vetan con los helpers de **SCRUM-89** (`lockActionForRole` + `roleLockedNote`), que ya existen,
ya están en `window` y traen **copy aprobada**: *«Solo para administradores»* y *«Esta acción es
solo para administradores. Pídeselo a quien gestiona la cuenta.»* Cero microcopy nueva.

Se **veta** en vez de ocultar a propósito: un botón que desaparece no explica nada, y quien lo
busque pensará que la pantalla está rota.

## El censo derivado (paso 3)

Barrido por AST de todos los `*.routes.ts`, con el rol declarado en línea:

```
rutas totales ... 166      escriben ... 91      leen ... 75
```

Tras el arreglo, **no queda ninguna asimetría sin declarar**. Los dos ficheros que conservan la
forma la tienen **decidida y escrita**:

* **`expenses.routes.ts`** — `GET /`, `/summary` y `/margin/:quoteId` son admin y `POST /` está
  abierta. **Es deliberado:** el fundador lo partió **por verbo** en SCRUM-107 — *«compra material
  en el almacén y lo registra desde la furgoneta»*—, y ahí está escrito. No es un hallazgo.
* **`products.routes.ts`** — lo que queda abierto es la **línea suelta** (crear, editar, borrar
  una), que es justo lo que el criterio permite. El bloque ya está cerrado.

El guard no los exime por nombre: comprueba que **su decisión esté escrita** en el registro. Una
asimetría puede ser deliberada, pero entonces tiene que constar — lo que no está escrito no se
distingue de un descuido.

### ⚠️ Punto ciego declarado del censo

No ve los gates montados con `router.use(requireRole(...))`. Hoy hay **exactamente uno**
(`team.routes.ts:27`), y **no falsea esta conclusión**: un gate de router protege el fichero
entero, así que no puede crear una asimetría ni esconderla. Si algún día se monta uno parcial,
este censo dejaría de bastar.

## Verificado en rojo

* **Vuelve la asimetría** (`/import` sin gate) → caen cuatro, encabezados por «no declara rol».
* **Cerrado de MÁS** (`requireRole('tecnico')`: nadie puede) → cae el **positivo**. Es el rojo que
  justifica que ese test exista: sin él, *cerrar bien* y *cerrar a todo el mundo* se ven idénticos
  en verde, y no se descubre hasta que un usuario real intenta importar su tarifario.
* **El tope se queda con holgura** (16 con 14 entradas) → lo caza el trinquete que ya existía, con
  su propio mensaje: *«HOLGURA en el ratchet: 14 pendientes con el tope en 16»*.

Las tres inyecciones verificadas como aplicadas y compilando; revertidas, árbol limpio.

## Lo que NO cubre

* **No se ha probado con una sesión real de Operario contra el servidor.** El negativo y el
  positivo invocan el middleware directamente con `userRole` inyectado; lo que no se verifica aquí
  es que `req.userRole` llegue bien poblado desde la sesión — eso lo sostiene `requireAuth`, que no
  toca este ticket.
* **La veta del front no se ha visto en el navegador.** Los tests leen código, no pantalla.
* **`/admin/customers/import` sigue en pendientes** (*«Alta masiva de clientes → probable admin»*).
  Tiene la misma forma que las dos de aquí, pero es de otro módulo y su duda dice «probable»: se
  reporta y no se toca.

## Ficheros

* `src/modules/products/app/routes/products.routes.ts` — `requireRole('admin')` en `/import` y
  `/load-catalog`.
* `src/core/http/adminRouteDeclarations.ts` — salen las dos entradas; `PENDIENTE_MAX` 16 → 14.
* `public/dashboard/js/productsView.js` — veta de los tres botones para el Operario.
* `tests/scrum365-permisos-tarifario.test.mjs` (7, sin gate).
