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
