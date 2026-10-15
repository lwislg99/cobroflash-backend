# SCRUM-1144 · «Elegir un sitio guardado» bajo la dirección de la obra (presupuesto y Trabajo)

**Medido contra:** `origin/main` = `73e41ab00f727fae5c6c8f1715d6eb6749133502` · 2026-10-15T15:50:21Z (`Date:` de GitHub)
**Skill UI:** cargada · `yaqu-premium-ui`: sin tokens nuevos, `.btn-ghost.btn-sm` del inventario, 44 px opt-in (patrón SCRUM-962), estados vacío y error, foco con `--ring`.
A9: comprobación → `tests/scrum1144-selector-sitio-guardado.test.mjs`

**El error mío, contado.** Construí primero sólo el presupuesto y lo di por completo con 9 de 9 en verde. El
enunciado dice «presupuesto/trabajo», y la ficha del Trabajo tiene su propio campo «Dirección de la obra»
(`jobDetailView.js`, S2). Lo vi al releer el enunciado antes de escribir este registro. El control pasó entonces a
`sitiosGuardados.montarSelector` para que las dos pantallas monten el mismo, y el test tiene dos casos del Trabajo.
El segundo error lo cazó un guard: el test preguntaba «¿consta en alguna ficha?», la forma débil que prohíbe
SCRUM-1306. Ahora pregunta por SU ficha.

Carril S2 · árbol `s2-1144` · rama `scrum-1144-selector-sitio-guardado`. Partido de SCRUM-1014: el servidor
(`CustomerSite` y `GET /admin/customers/:id/sites`, con tenencia merchant+cliente) ya estaba en producción, y
ninguna pantalla lo leía.

## Qué cambia (solo front, sin servidor y sin ALTER)

| pieza | dónde | conducta |
|---|---|---|
| el control | `public/dashboard/js/sitiosGuardados.js`, `montarSelector` | botón «Elegir un sitio guardado» y su lista. Pide los sitios **al pulsar**, nunca antes. Cada sitio es un botón con su nombre y, debajo, su dirección. Pulsar uno escribe esa dirección en el campo y cierra la lista |
| qué se escribe | `componerDireccionSitio`, `textoParaElCampo` | calle · CP · población · provincia · país, sin trozos vacíos (el mismo orden que `componerDireccionFacturacion`). Un sitio sin dirección escribe su **nombre**, lo único obligatorio de un sitio. Uno sin nada que escribir no se ofrece |
| el presupuesto | `quotesView.js` | debajo del campo libre de «Dirección de la obra». Como vive en su mismo envoltorio, sólo existe con «Personalizada», el único modo en el que el texto viaja. Elegir hace lo mismo que teclear: previsualización y borrador |
| el Trabajo | `jobDetailView.js` | debajo de «Dirección de la obra» del bloque «Datos». Elegir escribe y deja el foco; **se guarda al salir del campo, por el mismo `blur` que lo tecleado**: un solo camino de guardado. Sin cliente no se pinta |
| los tres estados | los dos | con sitios, la lista; sin sitios, «Este cliente no tiene sitios guardados todavía.»; si la carga falla, «No se pudieron cargar los sitios guardados. Inténtalo de nuevo.» al lado del botón (`role="alert"`) y el botón otra vez activo |
| la lista es de UN cliente | `quotesView.js` | al cambiar de cliente o de modo se cierra, y una respuesta que llega tarde no pinta |

**P2/DOC-12 intacto** (`docs/master/SCRUM-602.md`): nada se rellena solo. Con un cliente que tiene sitios y el modo
«Personalizada», el campo sigue vacío y la lista ni se ha pedido hasta que el profesional pulsa.

**Textos:** los tres, firmados por el ORQUESTADOR por delegación, no por el fundador: c.17121 (botón y vacío) y
c.19789 (el error; el comentario explica por qué lo firma él: es la forma ya firmada de la casa sobre un sujeto
nuevo, y cabe «Inténtalo de nuevo» porque es un fallo de carga). Ficha: `docs/microcopy/2026-10-15-SCRUM-1144-selector-sitio-guardado.md`.

**Una decisión mía, declarada:** en el Trabajo, elegir NO guarda por su cuenta: escribe y espera al `blur`, como el
texto tecleado. Si se prefiere que elegir guarde al momento, es un cambio de una línea (`alElegir`).

## Verificado, ejecutando

- `tests/scrum1144-selector-sitio-guardado.test.mjs`: **11 de 11**. Monta el editor y la ficha del Trabajo en el
  banco y PULSA: el campo vacío antes de pulsar, la petición al cliente correcto, lo escrito, el cierre, los tres
  estados, el cambio de cliente, y en el Trabajo el `PATCH /admin/jobs/42` con `{ direccion }` sólo tras el `blur`.
- **Control positivo por mutación**, con la BASE sin mutar en verde: seis mutantes y cada uno tumba SU caso
  (no cerrar al cambiar de cliente · pintar el `message` crudo · rellenar solo al cambiar de modo · no cerrar al
  elegir · botón sin cliente en el Trabajo · Trabajo sin el control).
- Lo que el cambio movió en guards ajenos, y por qué es correcto:
  - `scrum1185 ②`: `GET /admin/customers/:id/sites` pasa de `declaradas` a `retiradas` en
    `scripts/_sin-consumir-declarados.json`. El alta, la edición y el borrado se quedan: son de la ficha (J2).
  - `scrum697` / `scrum698`: el editor pasa de 256 a 258 nodos. Por identidad: el botón y la lista cerrada.
  - `scrum1306`: el test pregunta por SU ficha (ticket y ranura), no «¿consta en alguna?».

## NO hecho

- Dar de alta, corregir o borrar sitios: es la ficha del cliente (SCRUM-1146, J2). Esta pantalla sólo LEE.

## Visto en yaqu.app (s2-15oct, tramo 1144b)

**Medido contra:** `origin/main` = `310721d211be7cdd081003dc02ed987e582d7426` · 2026-10-15T16:33:40Z (`Date:` de GitHub)
A9: sin fallo que generalice — los dos rojos de la sonda eran de la SONDA (pulsaba un botón plegado y elegía cliente por un `<select>` oculto), y se corrigieron hasta pulsar como el profesional.

`yaqu.app/version` = `310721d2` (contiene el merge `d09323e9` de #2481). Cuenta QA, sonda
`D:\MILLONARIO\cobroFlash\sondas-s2\sitios-de-verdad.mjs`, chrome-headless-shell, 1280×900. Desde la página no
sale ninguna escritura (la puerta de `comun.mjs`, con control positivo). El único dato es un sitio
(«Sonda S2 · nave», C/ Sonda 1, 28001 Madrid) creado por la API en el cliente #83 del Trabajo #77, y BORRADO al
acabar: `DELETE` 204, y la lista leída aparte vuelve a tener 0 sitios. Ids creados y borrados: 1 a 5, uno por pasada.

| | lo medido, con clics reales | resultado |
|---|---|---|
| ① Trabajo #77 | «Datos» viene plegado (`details.detail-plega`): se abre por su `summary`. Botón visible, 44 px. Pulsar → la lista con el sitio («Sonda S2 · nave» + «C/ Sonda 1, 28001, Madrid, Madrid»). Elegir → el campo dice `C/ Sonda 1, 28001, Madrid, Madrid` y la lista se cierra | ✔ |
| ② Editor | cliente #83 por su botón, una línea tecleada, «Continuar» ×2, «Ajustes del documento · Cambiar» y «Personalizada» en su selector. **Antes de pulsar, el campo de la obra está VACÍO** (P2/DOC-12). Botón de 44 px. Pulsar → la lista. Elegir → el campo dice la dirección del sitio | ✔ |
| ③ Carga que falla | la sonda contesta 500 al GET de sitios: «No se pudieron cargar los sitios guardados. Inténtalo de nuevo.» al lado del botón, y el botón activo | ✔ |

Errores de página: ninguno. VEREDICTO=VERDE.

**NO medido en producción:** el GUARDADO del Trabajo (el `blur` → `PATCH /admin/jobs/77`). #77 es el fixture de S3
y no se toca: la puerta cortó ese PATCH. El guardado está medido en el banco (`scrum1144` · TRABAJO), no aquí.
**No intentado:** el estado «sin sitios» en producción (el cliente tenía 0 antes de crear el de prueba, pero no se
pulsó en ese momento), y el editor a 360 px.
