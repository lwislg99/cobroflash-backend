# SCRUM-1812 · `trampas-del-entorno.md` §7: el reaper solo mata en segundo plano, y la receta de 600 s en primer plano lleva allí

**Medido contra:** `origin/main` = `8e0d408168865aab0c7862d7c004cf864450aa71` · 2026-11-24T09:53:34Z (cabecera `Date:` de `gh api -i zen`)

A9: sin fallo que generalice — es una corrección de papel, y su texto sale de fuentes que ya están en el árbol: la cabecera del runner, `CLAUDE.md` y los registros 1244, 1743, 850 y 824. No he medido nada nuevo.

**Puesto:** S0 · **Rama:** `scrum-1812-trampas-seccion-7` · el fichero es de S0 (`node scripts/carriles.mjs de docs/equipo/trampas-del-entorno.md` → S0).
**Encargo y firma:** mensaje del orquestador `cobroflash-backend-41` del 24-nov-2026 a S0, después del acuse de SCRUM-1809: «SCRUM-1812 (tu carril, docs) … reescribir §7 con la práctica vigente … Es un doc interno de equipo (no texto de usuario): mi firma c.21978 te cubre; cita este mensaje en el registro». Lo pide SCRUM-1743 §③ y §④, que propone este hijo.

## Qué cambia en la §7

1. **El apartado del reaper** (antes en las líneas 140-152, el texto de SCRUM-1254, 14-oct) se reescribe:
   - Dice **solo**: el reaper actúa sobre shells `backgrounded`, con la versión del binario donde se leyó (2.1.325, jv-j6ef; 2.1.327 en la sesión de SCRUM-1743). Viene de la cabecera de `scripts/tanda-entera-por-tramos.mjs`.
   - Dice que **un comando en primer plano que pasa de 600 s va al segundo plano**. Fuentes: SCRUM-1244c, cabecera del runner, y `docs/equipo/cicatrices/J6.md` (23-oct, SCRUM-1218f).
   - Quita la receta «tanda en PRIMER PLANO con `timeout` de 600.000», que era la que llevaba al reaper, y deja escrito que antes estaba, con la fecha.
   - Pone la práctica que sigue hoy la casa (`CLAUDE.md`, «Comandos»): la tanda entera por tramos, un `--tramo` por comando, con `--resumen` (SCRUM-1244c/1743, `TOPE_MS` = 540 000). La tanda dirigida, con el TAP a un fichero fuera del árbol y leído en un segundo comando (SCRUM-850 y SCRUM-824).
   - Quita la advertencia deducida y nunca medida («sólo si no hay otras sesiones…»). Quita también «una orden en primer plano tiene un tope de 10 min: si se agota, no hay veredicto», que era falsa: si se agota, el comando no se para, va al segundo plano.
2. **El apartado de la lista de ficheros expandida** gana una frase: el TAP anterior se borra antes (SCRUM-1245, `CLAUDE.md`).

El resto de la §7 (Sensor de almacenamiento, servidor en segundo plano, Postgres compartido, `spawnSync` con ~800 ficheros) no se toca: nada de lo medido después lo contradice.

## Qué corrí

- `git grep` de `trampas-del-entorno` en `tests/`: ningún test lee la §7 (los que citan el fichero miran la §10).
- Guards de registro sobre este fichero: los decide el CI. Es papel y no he corrido la suite.
