# SCRUM-1658 · PILOTO-1 · Recorrido medido de TRABAJOS y PARTES (390 y 1280)

**Medido contra:** `origin/main` = `d7fb55ea19b825a26f89bf5b4765c2557eeb3a71` · 2026-11-10T16:46:13Z (cabecera `Date` del servidor de yaqu.app en el login QA, menos 24 h de su caducidad) · árbol `.claude/worktrees/scrum-1658-recorrido-trabajos-partes`

**Puesto:** S4 · **Fecha:** 10-nov-2026, de 16:46Z a ~17:20Z (hora del servidor, cabecera `Date` del login QA) ·
**Base:** `origin/main` = `d7fb55ea19b825a26f89bf5b4765c2557eeb3a71` (producción = main; no hay merges desde el 3-nov) ·
**Skill UI:** no cargada · sólo se mide y se abren tickets: no se toca `public/` en esta rama.

Sólo medir. No se ha construido nada: no hay ningún cambio de código en esta rama.

## Cómo se midió

- Cuenta QA en yaqu.app (merchant 46, plan Pro, `country: ES`), sesión de `scripts/qa/sesion-panel.mjs login`.
- Banco `docs/master/evidencias/SCRUM-1658/banco/`: `playwright-core` directo + `chrome-headless-shell` 1223,
  `serviceWorkers: 'block'`, 390×844 (móvil, táctil, 2x) y 1280×800. Cada paso deja captura PNG y un `.txt`
  con el texto de la página, lo pulsable con su tamaño, desbordes, lo que mide menos de 44 px y el log.
- Lo que el banco no veía (estado guardado) se leyó con `GET` del mismo `sesion-panel.mjs`.

## Datos de prueba creados (todos en QA, merchant 46)

| qué | id | nota |
|---|---|---|
| cliente «Marta Prieto (PILOTO-1 QA)» | #86 | inventado; con dirección; **sin teléfono ni correo** (nada se le puede enviar) |
| trabajo | #79 | creado → agendado (12-nov 09:00 Madrid) → en curso → terminado → **cerrado** |
| parte PT-2026-005 | #13 | horas, 6 líneas por dictado, datos, firmado por técnico y por cliente en el panel |
| albarán AB260007 | #52 | **emitido con 0 líneas — sin querer** (ver «Error mío»); «Enviar para firmar» dio 409, no salió nada |
| invitación de equipo | — | rechazada con 409 por el plan; iba a un buzón del propio fundador |

## Lo que NO se pudo medir

- **Asignar operario**: el plan de la cuenta QA es de 1 usuario (SCRUM-1678). La vista del OPERARIO tampoco:
  `test-login` sólo abre sesión de dueños de merchant (`auth.routes.ts`), y un operario entra por invitación.
- El dictado con el micrófono real: se tecleó el texto (la pantalla dice «Usa el micrófono de tu teclado»), así
  que lo medido es «Ordenar en líneas», no el reconocimiento de voz.

## Tickets abiertos (15) — etiquetas `piloto-1` + equipo + área del arreglo

| ticket | pantalla | P | carril (fichero) |
|---|---|---|---|
| SCRUM-1662 | Trabajo nuevo → ficha | P0 | S1 (`trabajoDirecto.ts:136`) |
| SCRUM-1670 | Trabajo nuevo → ficha / parte | P0 | S1 |
| SCRUM-1671 | Ficha del trabajo | P0 | S1 → S2 |
| SCRUM-1672 | Ficha del trabajo | P0 | S2 (`jobDetailView.js`) |
| SCRUM-1673 | Ficha del trabajo / albarán | P0 | S1 (`albaranes.routes.ts`) |
| SCRUM-1674 | Parte | P0 | S1 (`partes.routes.ts`) |
| SCRUM-1675 | Parte · dictado | P0 | S4 (`parteDetailView.js`) |
| SCRUM-1676 | Parte · firmas | P0 | S4 |
| SCRUM-1677 | Parte firmado | P0 | S4 |
| SCRUM-1678 | Equipo | P0 | J3 (`teamView.js`) + plan: fundador |
| SCRUM-1679 | Lista de trabajos | P1/P2 | S4 (`jobsView.js`) |
| SCRUM-1680 | Ficha del trabajo + Partes por valorar | P1/P2 | S2 |
| SCRUM-1681 | Modales Agendar / Cerrar / Trabajo nuevo | P1/P2 | S2 (`styles.css:4324`) |
| SCRUM-1682 | Parte · dictado | P1 | S1 (`src/modules/ai/`) |
| SCRUM-1683 | Parte · unidades y firma | P1/P2 | S4 |

15 tickets: SCRUM-1662 y SCRUM-1670 a 1683. SCRUM-1678 lleva `equipo-javier` porque cruza al otro equipo; los
otros 14, `equipo-luis`.

Carril contrastado con `node scripts/carriles.mjs de <fichero>` para los doce ficheros nombrados.

## Las dos preguntas, por pantalla (resumen)

| pantalla | ① ¿se entiende sin explicar? | ② ¿profesional? |
|---|---|---|
| Lista de trabajos | a medias: la tarjeta no dice qué trabajo es | sí, salvo la tarjeta-título vacía |
| Trabajo nuevo | sí; falla lo que pasa DESPUÉS (descripción escondida, tipo perdido) | sí |
| Ficha del trabajo | no: sin fecha agendada, sin el parte, albarán/parte sin explicar, no se cierra desde ella | sí |
| Agendar / Cerrar | sí | **no**: 0 px de relleno |
| Equipo | no: el límite del plan llega tras rellenar | sí |
| Parte (rellenar) | casi: el dictado funciona y es lo mejor del recorrido; pierde lo dictado al recargar | sí a 390; a 1280 sin contenedor |
| Parte (firmar) | no: la firma irreversible es la primaria en vacío; Confirmar mudo | botones de 30 px |
| Parte firmado | no: no hay nada que pulsar | sí |
| Partes por valorar | no: sin cliente, «6 ⚬» | sí |

## Lista ÚNICA de textos propuestos (regla 39 — SIN APLICAR, para la firma)

Ninguno está en el código. Cada uno nombra el ticket que lo necesita.

| # | dónde | texto propuesto | ticket |
|---|---|---|---|
| T1 | Ficha del trabajo, cabecera, trabajo agendado | «Cita: jue 12 nov, 09:00» | SCRUM-1672 |
| T2 | Ficha del trabajo, subtítulo (fecha de alta) | «Abierto el 10 nov» | SCRUM-1672 |
| T3 | Parte, cabecera (todos los estados) | «← Trabajo: {cliente}» | SCRUM-1677 |
| T4 | Parte firmado, acción | «Volver al trabajo» | SCRUM-1677 |
| T5 | Parte, firma con el parte vacío (si hace falta decirlo) | «Apunta primero lo que has hecho: al firmar ya no se puede cambiar.» | SCRUM-1676 |
| T6 | Parte, firmas | «Firmado por {nombre} el {dd/mm/aaaa} a las {hh:mm}» | SCRUM-1683 |
| T7 | Parte, unidad del desplazamiento | «Desplazamiento (min)» | SCRUM-1683 |
| T8 | Parte, columna de mano de obra | «Horas» (en lugar de «UNDS» en ese bloque) | SCRUM-1683 |
| T9 | Modal de firma del cliente, encima de las opciones | «¿Quién firma?» | SCRUM-1683 |
| T10 | Modal de firma, junto a «Confirmar firma» apagado | «Falta: {elegir quién firma · el nombre · la firma}» | SCRUM-1683 |
| T11 | Parte, ayuda de las horas | «Pulsa «Ahora» al llegar y al irte.» (sustituye «La hora se elige, no se escribe.») | SCRUM-1683 |
| T12 | Cerrar trabajo con albarán emitido sin firmar | «Este trabajo tiene {n} albarán sin firmar. Si lo cierras, se queda así.» | SCRUM-1681 |
| T13 | Equipo, antes del formulario con plan de 1 usuario | «Tu plan es para ti solo. Para añadir operarios, escríbenos y te activamos el plan Equipo.» | SCRUM-1678 |
| T14 | Equipo, rol | «Operario — hace partes y presupuestos y apunta gastos; no toca la configuración» | SCRUM-1678 |
| T15 | Ficha del trabajo, bajo los dos botones de documento | «Parte: lo que se ha hecho, para tu oficina. Albarán: lo que firma el cliente al entregar.» | SCRUM-1680 |
| T16 | Vocabulario: «técnico» (parte) / «operario» (Equipo) / «responsable» (ficha) | UNA palabra para la persona que va a la obra: **«operario»** en las tres | SCRUM-1683, 1680 |

T15 es la decisión de producto que pide SCRUM-1680 punto 3: si el fundador ve otra frontera entre parte y albarán,
el texto cambia con ella.

## Error mío (A9)

El paso «avanzar estados» de mi banco (`banco/a15-estados.mjs`) pulsaba la acción primaria de la ficha en bucle.
Tras «▶ Empezar» la primaria pasó a «+ Nuevo albarán», luego «Crear albarán» (en un modal), luego «Emitir
albarán», y luego «Enviar para firmar». Resultado: el albarán AB260007 (#52) **emitido con cero líneas** en la
cuenta QA. El envío dio 409 porque el cliente #86 no tiene teléfono: no salió nada. No es documento fiscal; se
queda como está (no se toca más) y es la prueba de SCRUM-1673. **Causa:** escribí un bucle que pulsa «lo que
toque» en vez de una lista cerrada de botones esperados. **Lo que lo habría evitado:** que el bucle comprobara el
rótulo contra la lista de lo que quería pulsar y parara en cualquier otro.

A9: aviso → cicatriz S4 «mi banco de QA pulsaba la acción primaria en bucle para avanzar un trabajo y encadenó crear y EMITIR un albarán vacío (AB260007, cuenta QA)» — no se pudo comprobar: el banco vive fuera de la tanda de tests

## Evidencias

`docs/master/evidencias/SCRUM-1658/capturas/` (27 PNG + el `.txt` de cada paso) y `banco/` (los scripts). No se
sube la captura del aviso del plan de Equipo (`07-equipo-enviada`): lleva un correo real en el campo; el script que
la hizo lee el correo de una variable.
