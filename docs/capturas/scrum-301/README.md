# SCRUM-301 (C1) · capturas del listado global de albaranes (AB6)

**Medido contra:** `origin/main` = `56874623baa406a0e8e38b93c236f7a4740b1e6a` · 2026-08-05T16:38:08+01:00

Producidas con un **banco aislado** (puppeteer-core sobre el Edge instalado + servidor estático
efímero sirviendo `public/`). Se carga el **dashboard REAL** —su `index.html`, sus 40+ scripts, su
CSS y su sidebar— y se sustituye **solo la puerta de red**. Se entra por el menú, pulsando la
entrada nueva, como entraría el profesional. **Sin BD, sin auth, sin servidor de la app, sin
producción.** El banco no se commitea: vivió en el scratchpad.

> **La red se sustituye ANTES de que corra un solo script.** Sin sesión, `app.js` hace
> `window.location = /login.html`: la primera tanda murió con «Execution context was destroyed».

## 🔴 Lo que encontró la captura y el suelo NO

La segunda tanda salió **con el modal de onboarding tapando la pantalla entera**, y el suelo la dio
por buena: comprobaba que la tarjeta computa fondo, que hay 5 filas y 4 pestañas —todo cierto, todo
**detrás** del modal—. Lo que no comprobaba era que la vista **se viera**.

Es la misma familia que la lección de SCRUM-350 (una captura sin CSS es una captura de otra cosa),
con una vuelta más: aquí el CSS estaba bien y **el objeto fotografiado no era el que se creía**.
Ahora el suelo también falla si hay un `.modal-overlay` / `#onboarding-backdrop` visible.

## Las cuatro capturas

| Fichero | Qué enseña |
| --- | --- |
| `scrum301-listado-1280.png` | Escritorio: sección propia en el menú, 4 pestañas con contador (todos 5 · borrador 1 · emitido 2 · firmado 2), buscador, filtro de facturación y la tabla. |
| `scrum301-listado-390.png` | Móvil 390 (gama media): la tabla en modo tarjetas (`table--cards-mobile`). |
| `scrum301-error-1280.png` | **La captura que sostiene el ticket**: con la consulta caída NO hay pestañas, NO hay contadores y NO hay ceros — solo el aviso en rojo. |
| `scrum301-vacio-1280.png` | Cero albaranes de verdad: pestañas a 0 y estado vacío. Es el contraste del anterior: el mismo número con significado opuesto, y se distinguen en pantalla. |

## ⚠️ Lo que se ve raro y por qué: el marcador de microcopy

Todo rótulo nuevo lleva `[PENDIENTE microcopy oficial]` delante (regla 30, patrón de SCRUM-286). Es
deliberado y se nota: **en escritorio el prefijo empuja las columnas `Cliente`, `Trabajo` y `Estado`
fuera del ancho visible** (siguen accesibles con el scroll horizontal de `.table-scroll`).

Eso incluye la columna `Trabajo`, que es la ventaja del ticket. **No es un defecto de maquetación:
es el coste del marcador**, y desaparece en cuanto el asesor apruebe los textos —con los rótulos
definitivos (`Nº · Emisión · Entrega · Cliente · Trabajo · Estado`) las seis columnas caben de
sobra. La propuesta de copy va en la entrada del registro.

## Checklist AB6

| Punto | Estado |
| --- | --- |
| Contraste AA · foco visible · targets ≥44 px | ✅ componentes existentes (`data-card-tab`, `input`, `table`), sin CSS nuevo |
| `aria-label` en buscador y filtro | ✅ |
| Capturas antes/después | ⚠️ **no hay «antes»**: la sección no existía |
| Estados empty / error / loading | ✅ vacío y error capturados; *loading* es el subtítulo «Cargando…» (sin skeleton: la carga es una sola petición) |
| Textos largos | ✅ el propio marcador ES el caso de texto largo, y está fotografiado |
| Importes grandes | n/a — este listado no enseña importes |
| **Matriz Android gama media / iPhone / tablet (V0-5)** | 🕳️ **HUECO DECLARADO**: solo se ha medido 390 px en Edge de escritorio. Ni dispositivo real, ni iOS, ni tablet. |
| Merchant sin logo / cliente sin WhatsApp / demo con marca de agua | n/a en esta pantalla |
