# Lo que quedaba sin ticket en la matriz, convertido — J5, primera sesión

21-sep-2026 15:14Z (hora de GitHub) · medido sobre `origin/main` = `92100e4fc018e59a948a0e9fccd898ae2d613963`
· J5 · **no toca `src/` ni `public/`, no abre cuentas de prueba, no toca `docs/competencia/capturas/`**
(el equipo de Luis la trabaja hoy en el PR #1590).

## El encargo y lo que ya no hacía falta

El encargo era convertir `docs/competencia/` en propuestas priorizadas. **Antes de proponer nada, medí
qué de eso ya estaba hecho** (`dos-equipos.md` §6, PASO 0): `docs/competencia/propuestas-priorizadas-21sep.md`
(SCRUM-906l, S0, commit `899938eb`) ya había convertido el **top-3** de la matriz en tickets — comentario en
**SCRUM-914**, ticket nuevo **SCRUM-993**, aviso urgente en **SCRUM-920** — y dejaba explícito lo que
quedaba: 7 entradas de la matriz "sin re-medir hoy" más 3 candidatas "fuera del top 3". Sin esa lectura
habría propuesto tres veces lo mismo.

**Búsqueda por CONTENIDO en Jira, no por número** (como pide `puesto-j5.md`): encontré que **§10.2**
("que el presupuesto llegue a quien decide") **ya tenía ticket** — **SCRUM-969**, abierto el 20-sep,
que el propio orquestador de Luis **aparcó hoy a las 09:21** con motivo escrito (coste de mensajes, tamaño
grande, la única prueba de Holded es su documentación, no su pantalla). No se repite: ya está decidido.

## Los seis que quedaban de verdad sin ticket

Verifiqué cada uno contra el código de hoy (no solo contra lo que decía la matriz) antes de escribirlo:

| ticket | qué | tamaño | bloqueo |
|---|---|---|---|
| **SCRUM-1022** | Leer un `.xlsx` de verdad al importar clientes (hoy solo CSV) | MEDIANO | dependencia nueva, regla 36 |
| **SCRUM-1018** | Portal del cliente: quién va a ir y en qué franja horaria | MEDIANO | la foto del técnico es dato personal de un empleado — decide un jefe; la franja y el nombre, no |
| **SCRUM-1017** | Bandeja de entrada de gastos (que el OCR fallido no borre el ticket) | GRANDE | espera a SCRUM-971 y SCRUM-920 (en curso) |
| **SCRUM-1020** | Fotos del cliente juntas, con miniaturas | GRANDE (corregido; no es PEQUEÑO) | SCRUM-980 (Finalizada) ya cubrió la parte barata sin fotos |
| **SCRUM-1019** | Pegatina QR en el equipo del cliente | MEDIANO | SCRUM-914 (Equipos) no existe todavía — no se empieza antes |
| **SCRUM-1021** | Suscripción de calendario (webcal) por profesional | MEDIANO | posible choque con la matriz X1 del máster ("JOB-1 cubre") — pregunta abierta al fundador dentro del ticket |

Los seis llevan `competencia` + la etiqueta de equipo/área de quien los construiría (`dos-equipos.md` §3):
1017, 1019, 1020, 1021 → `equipo-luis` + `area-s1` (viven en el servidor común); 1018, 1022 → `equipo-javier`
+ `area-j2` (portal de cliente y CSV de clientes son terreno de J2).

## El orden, con el filtro de hoy

El filtro que pidió el orquestador en cada propuesta: **¿esto acerca a tener clientes pagando?** Con
`INVOICING_ES_ENABLED` en OFF desde hoy (enmienda de SCRUM-612, PR #1593) y SIF-1 como prioridad
absoluta, **ninguno de los seis toca facturación ni cobro** — los seis van **detrás** de SIF-1 sin
excepción. Entre ellos:

1. **SCRUM-1022** (.xlsx) — el único que acerca directamente: reduce la fricción del momento exacto en
   que un profesional decide probar YaQu en vez de quedarse donde está.
2. **SCRUM-1018** (quién va a ir) — menos visitas falladas es trabajo cerrado antes, y cerrado antes es
   facturado antes en cuanto SIF-1 lo permita.
3. **SCRUM-1017** (bandeja de gastos) — retención/calidad, no adquisición; sirve al rediseño de Gastos
   ya en curso.
4. **SCRUM-1020** (fotos juntas) — pulido de CRM; 980 ya cubrió lo barato.
5. **SCRUM-1019** (QR del equipo) — depende de un modelo que aún no existe (914).
6. **SCRUM-1021** (calendario webcal) — la de menor prioridad: un solo competidor la respalda, y puede
   que el máster ya la dé por cubierta.

No se ordenaron por lo llamativas que son: se ordenaron por lo que cada una tarda en convertirse en un
euro, con la pregunta escrita dentro de cada ticket, no dejada para quien lo lea.

## Lo que NO miré

- **No toqué `docs/competencia/capturas/`** ni tomé capturas nuevas: el equipo de Luis las trabaja hoy
  (PR #1590, SCRUM-1002 y sus tickets hijos 1003-1014, todos posteriores a este recorrido y sobre
  competidores distintos — Contasimple, Tradify, FacturaDirecta por dentro — que no se solapan con esta
  lista, verificado por contenido).
- **No re-medí las 5 entradas de la matriz que `propuestas-priorizadas-21sep.md` marcó como "no
  re-medidas hoy"** y que no entraron en el top-3 ni en esta lista (§10.2 ya resuelto arriba;
  §11.4.1/§14.3.1/§14.3.2/§15.3.1/§15.3.3/§16.4.1/§16.4.3/candidata-A ya tenían ticket, contado en la
  tabla original). Quedan exactamente cero pendientes de la matriz sin ticket ni decisión, salvo estos seis.
- **No entré en ninguna cuenta de prueba** (A19: no está autorizado en esta sesión).
- **No construí nada**: ni un prototipo, ni una línea de `src/` o `public/` — el puesto no lo hace.

## Cómo se midió (reproducible)

```text
git worktree add <ruta> origin/main -b scrum-competencia-j5-propuestas   -> aislado del árbol compartido
grep -rn "prisma.attachment.create" src                                  -> 2 sitios: quote_request, albaran
grep -in "xlsx|exceljs|papaparse|csv-parse" package.json public/dashboard/js/csvImport.js -> 0
grep -n "asignado|teamMember" src/modules/system/app/routes/customerPortal.routes.ts       -> 0
grep -n "router\.\(get\|post\)" src/modules/system/app/routes/customerPortal.routes.ts     -> 2 rutas (:token, :token/quote-request)
```

Origen de cada propuesta: `docs/competencia/matriz.md` §11.4.2, §12.3.2, §13.3.2, §13.3.3 (+ corrección
§14.2), §15.3.2, §16.5-B.
