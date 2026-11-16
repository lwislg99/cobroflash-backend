# SCRUM-1719 · Un cliente que ya está de baja y escribe BAJA otra vez → silencio

**Medido contra:** `origin/main` = `2c52196fddfdee2f2875c38d51642785d2566812` · 2026-11-12T17:55:11Z

A9: comprobación → `tests/scrum1719-baja-repetida-silencio.test.mjs`

J2 (sesión `jv-j2c2`, equipo de Javier), por encargo del orquestador. Es la parte ① de SCRUM-1513. GO de Javier
en SCRUM-1719 c.21766: con `waOptOut` ya puesto, ni aviso al profesional ni texto al cliente; la primera BAJA,
igual que antes. Sin texto nuevo y sin envío nuevo (regla 28: sólo quita envíos). Carril J2
(`node scripts/carriles.mjs de` → J2). El hook de arranque dijo «SIN IDENTIDAD» (SCRUM-1498); se siguió.

## Lo que cambia

`src/modules/whatsappBot/app/routes/whatsappIncoming.routes.ts`, `handleOptOutRequest`: la consulta de clientes
lee también `waOptOut`. Si TODAS las fichas de ese número ya lo tenían, sale sin escribir ni enviar nada. Si no,
todo sigue como antes, salvo que el aviso se manda sólo a los negocios con alguna ficha que aún no tenía la baja
(con dos negocios y uno ya enterado, el ya enterado no recibe un segundo aviso). Un número que no es cliente de
nadie sigue recibiendo la respuesta de siempre.

## Lo medido

- **PASO 0:** sin commits, rama ni PR de 1719 (`git log --grep`, `ls-remote`, `gh pr list`). El código de main
  seguía avisando y contestando sin leer `waOptOut`.
- **Corrección a la descripción del ticket:** «120 BAJA = 120 avisos» ya no es lo que pasa en main. Desde
  SCRUM-1509h hay un límite de `ENTRANTES_POR_HORA` = 20 entrantes por número y hora: de 120 BAJA llegan 20 al
  manejador, y sobre main salen **20 avisos y 20 textos**, no 120. El defecto seguía; la cifra, no.
- **Rojo primero**, sobre `2c52196fd` sin el arreglo: 3 de 5 casos caen (20 avisos en vez de 0; 20 tras la
  primera en vez de 1; 2 avisos en vez de 1 con dos negocios); los dos controles pasan. Salida:
  `docs/master/evidencias/SCRUM-1719/rojo-sobre-main.salida.txt`.
- **Con el arreglo:** 5 de 5. El caso de 120 BAJA declara su población (100 descartadas por el límite, 20 al
  manejador) para que un banco que no llega al manejador no se lea como silencio.
- **Mutaciones** (`MUTACIONES_QUE_ME_TUMBAN` del test, aplicadas con un guion de un solo uso que recompila con
  `tsc --noCheck` y restaura byte a byte): quitar la lectura de `waOptOut` → caen 3; quitar sólo la salida en
  silencio → caen 2. Las dos cazadas. Salida: `docs/master/evidencias/SCRUM-1719/mutaciones.salida.txt`.
  NO se corrió `scripts/meta-guard-mutaciones.mjs` entero (lo corre CI).
- `tsc -p .` con tipos: salida 0.
- Tanda local dirigida: los 41 ficheros de `tests/` que nombran `whatsappIncoming`, `handleOptOut` o `waOptOut`, más
  13 guards (scrum553, 237, 976, 1387, 1387d, 1387f, 1177, 1415, 411, 700, 719, 737, 747): 458 casos, 447 pasan,
  0 caen, 11 saltados (gateados por base; ninguno es de 1719). **Suite entera local: NO CORRIDA** (cola de CI
  saturada; manda el obligatorio).

## Lo que queda sin medir, dicho

- Dos BAJA del mismo número **a la vez** pueden leer las dos `waOptOut = false` y avisar las dos: el arreglo lee y
  luego escribe, no es atómico. No medido.
- `docs/master/evidencias/SCRUM-1509d/avisos.cjs` (casos R3/R4) esperaba 10 avisos por 10 BAJA; con este cambio
  ese guion histórico ya no cuadra en esos dos casos. No lo corre ningún test; no se ha tocado.
- Nada en yaqu.app: no hay forma de mandar una BAJA de un cliente ya dado de baja sin un número real.
