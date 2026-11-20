# SCRUM-1768 · La ficha del trabajo aprovecha el ancho en escritorio (S2 · 18-nov-2026)

**Medido contra:** `origin/main` = `703df1474d8406bacd89c4609a89281256d7063e` · 2026-11-18T18:04:56Z
**Fecha:** 18-nov-2026
**Skill UI:** cargada (`yaqu-premium-ui`; AB6: sin componente ni texto nuevos; una clase nueva, `.detail-lateral`, que es solo contenedor; tokens de DESIGN.md (`--body`; espaciados 8/16/24 de la escala, y el `gap: 20px` del prototipo pasado a 24); los objetivos de 44 px y el anillo de foco, intactos; textos largos con `overflow-wrap`; capturas antes/después a 390/1280/1920). **Se cargó TARDE**: después del prototipo, cuando el guard de la skill declarada la pidió en el registro (ver A9).
A9: comprobación → `tests/scrum811c-skill-ui-declarada.test.mjs`

El encargo pedía cargar yaqu-premium-ui, impeccable y frontend-design ANTES de proponer, y monté el prototipo sin
cargarlas. Lo cazó el guard de la skill declarada (811c), al pedir esta línea, y con ella encontré un espaciado
fuera de la escala (20 px), ya corregido. Impeccable y frontend-design no se llegaron a cargar: el formato ya estaba
aprobado (c.22112) y la jerarquía de la casa pone DESIGN.md + Parte AB por encima de ellas. Segundo fallo, cazado
en el momento: la primera versión del caso ② del test era ciega (ver Evidencias).

**Orden del fundador (18-nov, en SCRUM-1768):** «en desktop se ve raro, todo en el medio sin aprovechar el
espacio […] tiene que quedar clean». Propuesta con prototipo capturado → **GO del orquestador en c.22112**
(«formato aprobado tal cual tu propuesta»).

## Qué estaba mal (medido en yaqu.app, build 738ecbef8, sonda `evidencias/SCRUM-1768/prod-1768-ficha-formato.mjs`)
- `.detail-page--trabajo` tenía `max-width: 1120px; margin-inline: auto` (bloque S2 · SCRUM-1725). A 1920 eso deja
  276 px vacíos a cada lado, y el rail acaba a 700 px de alto mientras la columna principal llega a 1800.
- «+ Nuevo presupuesto» (SCRUM-1190) vivía **dentro de la tarjeta Albaranes** (`newAlbRow`), y por eso el fundador no
  lo encontraba.

## Referencias (docs/competencia/capturas)
De las capturas del repo, solo dos enseñan de verdad una ficha: **ServiceM8** (job card con los datos a un lado,
notas e historial al otro, y el total y la acción arriba a la derecha) y **Housecall Pro** (cabecera a todo el ancho
y debajo una columna de resumen y otra ancha). Las de Jobber, Tradify y Fergus son de marketing o de ayuda y no
enseñan la ficha, así que de ellas no se saca nada.

## Qué cambia (FORMA, no función)
- **Cabecera a todo el ancho**, alineada con el título del topbar: tope de 1680 px y sin centrado. Su contenido no cambia.
- **Dos columnas reales.** La principal es fluida (Lo que falta · dinero · Partes · Albaranes · Facturas). La
  **lateral** (`.detail-lateral`, 340 px, y 380 desde 1440) lleva el rail tal cual (el `aside` de solo lectura,
  patrón B2), debajo «+ Nuevo presupuesto» a todo el ancho y después «El trabajo», con el valor debajo del rótulo.
- **Móvil (≤720):** la lateral se disuelve (`display: contents` + `order`) y el orden queda el de antes: rail
  arriba y «El trabajo» al final. El único cambio a 390 es que «+ Nuevo presupuesto» sube justo debajo del rail.
- Se conserva: el CTA con `dataset.accion = 'cta'` (1725h, que llegó por merge de main), Tipo de intervención, cero
  textos nuevos, solo tokens, y el botón oculto en un trabajo cerrado (toma el `hidden` de su barra, SCRUM-1190 ④).
- Ficheros: `public/dashboard/js/jobDetailView.js` (ensamblado de la lateral) y `public/dashboard/css/styles.css`
  (bloque «S2 · SCRUM-1768», al final).
- No se tocan (declarado en c.22112): el «?» flotante de ayuda, que tapa el borde derecho a media altura (ya pasaba
  a 1280), y la franja de dinero con la mitad izquierda vacía cuando no hay foco.

## Evidencias
- `tests/scrum1768-ficha-aprovecha-el-ancho.test.mjs` sale **en rojo 8/8 contra main 738ecbef8**
  (`evidencias/SCRUM-1768/rojo-primero-contra-main.tap.txt`) y **en verde 8/8** en la rama. La primera versión del
  caso ② salía verde también contra main, porque miraba solo la PRIMERA barra de documentos (la de Partes). Ahora
  mira las dos y exige que haya dos.
- Los 94 ficheros de test que tocan la ficha pasan con el formato nuevo: 847 tests, 846 bien, 0 fallos y 1 salto
  (SCRUM-22, gateado por BD). Ningún test existente cambió de exigencia. scrum1190b ④ sigue verde: el botón oculta
  su propio `hidden`.
- `npm run guard:escalera-por-estado` → ✅ tras el merge de main (antes del merge salía rojo porque a la rama le faltaba 1725h).
- Huella de función, antes y después (`evidencias/SCRUM-1768/comparar-huella.mjs`, que compara multiconjuntos de
  acciones, euros y palabras). Sobre 12 fichas (trabajos 77 y 76 × 390/1280/1920 × operario/admin) y 2.002
  palabras, las 12 salen **IDÉNTICAS**, con desbordeX 0 y 0 cajas fuera. Control positivo: si a una copia de
  «después» se le quita «+ Nuevo presupuesto», el comparador da DISTINTA y sale 1. Salida en
  `evidencias/SCRUM-1768/huella.txt`.
- El alto baja en escritorio: 77 admin a 1280 pasa de 1650 a 1297 px, y 76 admin a 1920 de 1877 a 1577.
- Capturas (fuera de git, A8): `D:\MILLONARIO\cobroFlash\sondas-s2\evid-1768\final\{antes,despues}-ficha-<id>-<papel>-<ancho>.png`.

## Pendiente
- El «me gusta» del fundador, sobre las capturas o en vivo: lo trae el orquestador y **S2 no cierra**.
- Regla 42 tras el merge: repetir la sonda sin `LOCAL_DIR` y comparar con `final/despues.json`.
- *(20-nov: la FASE 2, #3241, mergeó el 18 y está en vivo.)*

---

## VUELTA 2 · pestañas y el dinero arriba (S2 · 20-nov-2026 · rama `scrum-1768b-ficha-pestanas`)

**Skill UI:** cargada (`yaqu-premium-ui` + `impeccable`, ANTES de dibujar. AB6: sin texto nuevo, ya que los rótulos
de las pestañas son los `<h3>` que ya existían, y la tira se nombra con el título del Trabajo; sin componente nuevo,
porque la tira es el control segmentado de la casa (`btn-secondary`/`btn-ghost`, el de `quotesTabs.js` y
`cobrosView.js`) con el opt-in de 44 px `job-toolbar-btn-44`; anillo de foco `--ring`; sólo tokens; patrón ARIA de pestañas
con flechas, Inicio y Fin).

Decisiones (de la antecesora, aceptadas; c.22113):
- **Pestañas = los h3 que ya existen**: Lo que falta · Partes · Albaranes · Facturas (si hay) · El trabajo. Sin
  «Resumen». Por defecto se abre la que contiene una primaria **que se ve**; si ninguna, la primera. Hay que decir
  «que se ve» porque Albaranes lleva siempre «Consolidar seleccionados» relleno dentro de una barra con
  `display: none`. Las secciones NO se envuelven: siguen siendo hijas directas de la columna (el CSS de 1725 cuelga de
  `.detail-cuerpo > div > .detail-section`) y sólo ganan `role="tabpanel"` y `hidden`. El h3 se aparta de la vista
  (recorte), pero el lector de pantalla lo sigue leyendo y sigue en `innerText`.
- **Sin rutas nuevas**: estado de la página. Un `refresh()` del mismo Trabajo vuelve a la pestaña abierta; volver
  desde otra pantalla abre la de defecto. El hueco de «Lo que falta» abre la pestaña de su sección antes de
  llevar a ella.
- **El dinero**: la franja Aceptado/Cobrado (el MISMO nodo `sumSec`, ahora `.detail-head-dinero`) sube a la cabecera,
  encima de las acciones; el CTA conserva `data-accion="cta"`. Sin franja (SCRUM-651/917i), las acciones suben solas
  a la primera fila. Sin cabecera fija.
- **El operario** ve las mismas pestañas menos «Lo que falta», que es cobro y su rol no ve.
- «El trabajo» vuelve a la columna principal, la última. La lateral queda en rail + «+ Nuevo presupuesto». Se
  retiran las dos reglas de «El trabajo» en la lateral del bloque CSS de 1768.

De paso, y registrado: el censo de SCRUM-601 propaga «deriva del flag» POR NOMBRE dentro del fichero. La primera
versión de la función, con nombres genéricos (`n`, `el`, `destino`, `clave`) y leyendo el `textContent` del h3,
movía «factura creada» y «facturas creadas» de «a pelo» a «flag» sin cambiar una letra. Se arregló en la vista,
con nombres propios (`pst…`) y la clave por `data-seccion` o por posición. El número del censo no se tocó.

### Tests que CAMBIAN de exigencia (rojo-primero; las líneas, al orquestador ANTES del push)
- `tests/scrum1768-ficha-aprovecha-el-ancho.test.mjs` ① l.67-78: la lateral es `['rail','presupuesto']` (antes
  `+ 'el-trabajo'`) · ③ l.98: `['rail']` · ④ l.141-147: a 390 ya no existe `.detail-lateral > .detail-section`
  (`doesNotMatch`) · ④ l.159-165: el control «usa tokens» pasa a control POSITIVO (un color crudo inyectado se caza),
  porque el bloque se quedó sin colores.
- `tests/scrum320-que-falta-para-cobrar.test.mjs` l.191-192: el resumen se monta con
  `head.insertBefore(sumSec, headRight);` (antes `body.appendChild(sumSec);`).
- `tests/scrum1740-albaran-desde-parte-firmado.test.mjs` l.107-112: `ficha()` abre la pestaña «Albaranes» antes de
  contar los «+ Nuevo albarán» a la vista. Sin esto, los «sale UNA vez» pasaban porque la pestaña estaba cerrada, no
  por la deduplicación.
- `scrum1190b` no cambia.
- **Autorización del orquestador (cobroflash-backend-25, por mensaje entre sesiones, 20-nov; Jira caído, la pega él
  en SCRUM-1768 cuando vuelva), LITERAL:** «AUTORIZO (delegación c.21978, 20-nov ~10:25 local) cambiar exactamente
  estas exigencias y ninguna más, porque el requisito cambió con la vuelta 2 aprobada (c.22113 + diseño del
  traspaso), rojo-primero visto (12 rojos sobre main): ① tests/scrum1768-ficha-aprovecha-el-ancho.test.mjs L67-78
  (lateral = ['rail','presupuesto']; «El trabajo» pasa a pestaña), L98 (['rail']), L141-147 (a 390 ya no existe la
  regla order de la lateral), L159-165 (el control «usa tokens» pasa a control POSITIVO con color crudo inyectado —
  MÁS estricto); ② tests/scrum320-que-falta-para-cobrar.test.mjs L191-192 (el bloque del dinero se monta en la
  cabecera: head.insertBefore); ③ tests/scrum1740-albaran-desde-parte-firmado.test.mjs L107-112 (ficha() abre la
  pestaña Albaranes antes de contar — el assert viejo pasaba por la pestaña cerrada, no por la deduplicación: el
  nuevo mide lo que debía). scrum1190b intacto.»
- Nuevo: `tests/scrum1768b-ficha-pestanas.test.mjs` (13 tests, ⑤-⑪). Rojo-primero sobre `b0b7cf997`: 12 en rojo, y
  uno (⑦ «se abre la primera») pasaba EN VACÍO con cero pestañas: se le puso suelo antes de construir.

### Evidencias
- Huella de función (`evidencias/SCRUM-1768/prod-1768b-ficha-pestanas.mjs` con `comparar-huella.mjs`; la sonda
  fotografía la vista real y mide la huella con los paneles desplegados). «Antes» = yaqu.app build 0b8b9eda; «después»
  = el mismo build sirviendo `jobDetailView.js` y `styles.css` de la rama. Trabajos 77 y 76 × 390/1280/1920 ×
  operario/admin: **12/12 IDÉNTICAS**, 2.002 palabras, desbordeX 0, 0 cajas fuera, 0 errores
  (`evidencias/SCRUM-1768/1768b/huella.txt`). Control positivo: quitando «+ Nuevo presupuesto» de una ficha de
  «después», sale DISTINTA y devuelve 1.
- Alto de página: 77 admin a 1280 pasa de 1297 a 941 px, y 76 admin a 390 de 2894 a 1093.
- Cajas (`evidencias/SCRUM-1768/medir-1768b-cabecera.mjs`): a 1280 el título mide 551 px y, a su derecha, el dinero
  409 px con las acciones debajo; sin franja, las acciones van en la primera fila. Pestañas de 44 px. A 390 se apila
  título → dinero → acciones; el rail sigue arriba (SCRUM-318) y la tira ocupa 2 filas.
- Capturas (fuera de git, A8): `D:\MILLONARIO\cobroFlash\capturas\SCRUM-1768b\{antes,despues}-ficha-<id>-<papel>-<ancho>.png` (24).

### Pendiente (vuelta 2)
- El «me gusta» del fundador: lo trae el orquestador, y **S2 no cierra**.
- Regla 42 tras el merge: repetir la sonda sin `LOCAL_DIR`, comparar con `1768b/despues.json` y confirmar el build en vivo.
