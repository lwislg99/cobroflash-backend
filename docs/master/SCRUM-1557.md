# SCRUM-1557 · `contexto <nombre>` aparta los restos muertos (cara 3b de SCRUM-1095)

**Medido contra:** `origin/main` = `73e41ab00f727fae5c6c8f1715d6eb6749133502` · 2026-10-15T16:08:15Z

Sesión 5, 15-oct-2026.

A9: comprobación → `scripts/meta-guard-mutaciones.mjs`

*(La A9 la añade el relevo, 15-oct ~16:35Z: el CI de #2484 cayó por faltar esta línea. El fallo que generaliza es el
de abajo —una mutación que tumbaba el CONTROL y no el test que decía—, y lo para el meta-guard: corre cada mutación
de `MUTACIONES_QUE_ME_TUMBAN` y exige que caiga el test que nombra su `cae`.)*

## Qué cambia
- `scripts/equipo/sesion.mjs`: nueva `elegirParaContexto({ nombre, agentes, job })`, exportada, que pasa por
  `repartirPorNombre`, igual que `lanzar`, `relevar`, `parar` y `olvidar`. `leerContexto` la usa con el
  `estadoDeJob` de siempre. El criterio se **reutiliza**, no se copia (aceptación 3).
- Con una viva (con pid) y un resto muerto (sin pid y con `state.json` terminal) se mide la viva. Con dos que
  cuentan sale `NO-PUDE-MIRAR`, nombrando las dos. Sin pid y con un `state.json` ilegible o no terminal, cuenta
  como viva. El texto ya no llama «vivas» a lo que se cuenta: «sesiones que no se pueden dar por muertas».
- ⛔ No cambia nada en `lanzar`, `parar`, `olvidar` ni `relevar`. `relevar` llama a `leerContexto` para
  fechar el último turno, y ahora también ve a la viva cuando tiene una muerta al lado.

## Tests: `tests/scrum1557-contexto-aparta-los-restos.test.mjs`, 10/10
- Los casos de la aceptación 1-3, sus controles y uno que compara `elegirParaContexto` con `repartirPorNombre`
  sobre los mismos casos.
- Aceptación 5: ata el «motivo desconocido» de SCRUM-1095 (`decidirLanzar` con una bloqueada sin `waitingFor`),
  con un control que comprueba que un `waitingFor` de verdad sí se usa.
- **Rojo visto** (aceptación 4), aplicando las dos `MUTACIONES_QUE_ME_TUMBAN` una a una y restaurando:
  · volver al filtro solo por nombre → caen 3 (el de la viva con la muerta, el de solo restos y el de criterio común);
  · volver a `espera ${v.waitingFor || 'algo interactivo'}` → cae el test de 1095.
  Mi primera versión de la segunda mutación estaba mal: con el operador coma tumbaba el CONTROL y no el test que
  debía. Se rehízo para que fuera el defecto original.
- `scrum836` (anclas y `cae` de las mutaciones): las dos mías pasan. Su único rojo en este árbol viene de
  `scrum608`, porque el árbol no tiene `dist`. No es de este diff.

## No comprobado
- No he corrido la suite completa. Este árbol no tiene `dist` y la mayoría de los rojos locales son
  `ERR_MODULE_NOT_FOUND`. El juez es el CI.
- **La copia instalada** (`%LOCALAPPDATA%\yaqu-equipo\sesion.mjs`) **no se ha tocado.** La puerta de integridad
  exige que sea idéntica a `origin/main`: al mergear esto, `sesion.mjs` responderá `ALTERADO` hasta que el
  orquestador la reinstale.
- No he reproducido el defecto contra la copia instalada (lo hizo S0 el 14-oct, en el banco descrito en el ticket):
  el rojo de aquí es el de las mutaciones sobre la función.