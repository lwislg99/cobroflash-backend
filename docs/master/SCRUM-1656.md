# SCRUM-1656 · PILOTO-1 · sprint paraguas — registro

**Medido contra:** `origin/main` = `d04e5f12409d6ddf47900946f1d92f774d84dfbf` · 2026-11-10T17:46:04Z (cabecera `Date:` de GitHub; el reloj local va +6 min 30 s)
A9: sin fallo que generalice — la única discrepancia (el comentario de Jira parecía anterior al sí) era el reloj local adelantado, ya registrado en la memoria del equipo, y se resolvió midiéndolo antes de aplicar

Fichero nuevo: en `origin/main` no existía `docs/master/SCRUM-1656.md`, ni en ninguna rama remota.

## Apéndice · 10-nov-2026 · S0 · cambio de máster PILOTO-1 aplicado

### La firma, con su localizador

- **Pregunta:** AskUserQuestion «Master» del orquestador, transcripción `ed676fd1-feb4-4658-bda2-01f4bf9fb3fc`,
  línea 54814 (uuid `ca087147-e99b-4dd5-bb85-8b6240da39d0`). Literal: «S0 me paró con razón: tu «firmo todo»
  cubría los textos, pero meter el sprint PILOTO-1 en el master es un cambio de master y necesita su propio sí
  explícito. Lo que entraría: ① el sprint PILOTO-1 tal como te lo resumí (piloto real usando presupuestos,
  trabajos, partes y albaranes; sin facturas ni cobros hasta VeriFactu; pulido pantalla a pantalla); ② la lista
  de correos invitados para el alta (vacía = el registro sigue cerrado como hoy; con correos = solo esos pueden
  darse de alta; se quita el día del go-live). ¿Lo meto en el master?»
- **Respuesta del fundador:** línea 54815 (uuid `47b44fcd-173c-428d-82b0-4754f0815bfe`), la que contesta a ESA
  pregunta (`tool_use_id` de la 54814): «Sí, mételo (Recomendado)».
- **Hora:** la transcripción marca 17:40:57Z y 17:45:45Z con el reloj local, que va +6 min 30 s (medido contra
  `gh api -i zen`). Real: ~17:34Z la pregunta y ~17:39Z el sí. El comentario de Jira que la recoge, SCRUM-1656
  c.21411 («RECTIFICACIÓN + FIRMA NUEVA»), es de 17:40:03Z, 48 s después.
- **Alcance medido:** el mensaje contestado nombra el sprint PILOTO-1 Y la lista de correos invitados. Cubre la
  fila de U1, la subsección U1.1b y la fila del flag en la Parte P. No cubre nada más: ni textos, ni código, ni
  el alta. La firma anterior que se leía como si lo cubriera (c.21408, «si firmo todo») queda sin efecto para el
  máster (c.21411 ①).

### Qué se ha aplicado (borrador de SCRUM-1657 c.21384 §② + c.21395 + c.21398, copiado)

| sitio en `docs/YAQU_MASTER.md` | qué entra | de qué comentario |
| --- | --- | --- |
| Parte U, tabla de U1, tras la fila 7 | fila `1c` PILOTO-1 | c.21384; «Done» con el cambio de c.21395; «Flags» con el de c.21398 |
| Parte U, subsección nueva `### U1.1b · PILOTO-1`, antes de `### U1.2` | Alcance · Tareas (P1-0 de c.21395, flag de c.21398, P1-1..P1-4) · Done · Rollback · No es | c.21384 + c.21395 + c.21398 |
| Parte P, tabla de flags, tras `MERCHANT_DELETE_ENABLED` | fila `REGISTRATION_INVITED_EMAILS` | c.21398 |

### Ajustes mínimos, declarados (el borrador no encajaba literal)

1. **Fila de la Parte P: el borrador trae 5 columnas y la tabla tiene 7** (Flag · Scope · Default · Activa ·
   Desbloquea · Depende de · Rollback). Las dos que faltaban se rellenan con frases del MISMO borrador, sin
   texto nuevo:
   - «Activa» = «solo el fundador (variable de entorno de Railway)» ← «La pone y la quita SOLO el fundador»
     y «variable de entorno de Railway» (c.21398).
   - «Depende de» = «SCRUM-1685 (J3)» ← «La construcción es SCRUM-1685 (J3)» (c.21398).
   - «Rollback» junta el «Rollback» de U1.1b («vaciar la variable → la puerta vuelve a estar cerrada, sin
     desplegar nada») con la quinta columna del borrador («se retira en el go-live»).
2. **P1-0.** En c.21384 la P1-0 iba dentro de la línea «Tareas: P1-0 … · P1-1 … · P1-4 …». c.21395 la
   sustituye por un párrafo propio, y c.21398 pone el bloque del flag «tras P1-0». Queda: «Tareas:» → P1-0
   → bloque del flag → la línea con P1-1..P1-4.
3. **«Se añade a Done: …sin ninguna fila escrita por nosotros en su nombre» (c.21395)** no dice a cuál de
   los dos «Done» va. Lo pongo en el «Done:» de U1.1b, que es el que lleva esa etiqueta y el que viene en
   c.21395 justo después de la P1-0. Si iba a la columna «Done» de la fila 1c, se mueve sin firma nueva.
4. **Formato:** las citas de Jira (`>`) se quitan; las viñetas «·» del bloque del flag pasan a lista `-`; la
   negrita de «Alcance (regla 24, medido en SCRUM-1657 sobre `d7fb55ea1`):», partida en la exportación de
   Jira, se cierra después de los dos puntos. Ninguna palabra cambia.

### Lo que NO hace este cambio

- No construye la puerta con invitación: eso es SCRUM-1685 (equipo de Javier, J3), que se desbloquea cuando
  este PR entre en `main`.
- No pone la variable en Railway. La pone el fundador (Parte P, flag global = stop condition AA1.4).
- No toca código, ni textos que vea el usuario, ni `INVOICING_ES_ENABLED`.
