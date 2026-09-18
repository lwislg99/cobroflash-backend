# SCRUM-951 · El sistema del equipo, montado para dos equipos (Luis y Javier)

## SCRUM-951b · Las normas y `dos-equipos.md`

**Medido contra:** `origin/main` = `e76580b1a4067b95e6b47f93dc43d12cdfa4618b` · 2026-09-18T12:01:39Z
**Rama:** `scrum-951b-normas-dos-equipos` · **Carril:** consultoría (Sesión 0), dueña de `docs/equipo/00-normas-comunes.md` · **Encargo:** orquestador, 18-sep-2026 (paso 1 de 5)
**Solo docs.** Nada de `src/` ni `public/`. El código portable (configuración por instalación, prefijo de equipo) es **SCRUM-951a**, de la Sesión 5.

⏱ Horas de GitHub (cabecera `Date:` de `gh api -i zen`).

### Por qué

El fundador quiere que Javier trabaje EXACTAMENTE como el equipo de Luis: su orquestador, sus puestos, las
mismas normas y la misma automatización. Y decidió (18-sep ~11:50Z) que **los dos son jefes**. El problema,
medido en el paso 1a: gran parte de lo que hace funcionar al equipo vivía **solo en la memoria de una
máquina** (61 notas), que Javier no tiene; y Javier no detecta los fallos de formato ni de proceso que sí
detecta el fundador. Por eso las normas nuevas están escritas como **listas de comprobación, cada casilla
con el caso que la haría fallar**, no como consejos.

### Paso 1a · el censo de la memoria (entregado al orquestador ANTES de escribir, y aprobado)

Población: 62 ficheros = 61 notas + `MEMORY.md`, **leídas 61 de 61**; índice y carpeta casan (61 enlaces,
61 ficheros, 0 huérfanos). Clasificación: **14 universales** → al repo (este PR) · **15 ya estaban en el
repo** · **14 solo de esa máquina** (rutas, ids, traspasos) · **16 obsoletas o superadas** · **2 de proyecto,
no de equipo**. «Ya está en el repo» se comprobó con `git grep` sobre `origin/main`, frase por frase clave,
con control positivo.

### Qué cambia

| fichero | qué |
|---|---|
| `docs/equipo/orquestador.md` | **§0.0 nueva: la lista de comprobación de 10 casillas antes de CADA mensaje a un jefe** (la primera de todas), con un ejemplo que falla y el mismo corregido. **§4bis nueva: cómo entra una idea de un jefe** (6 pasos). §7: comprobar `MICROCOPY_BLOQUEADA` antes de firmar. §0, §10bis.14, §11bis y §12 al día para dos equipos y dos jefes |
| `docs/equipo/00-normas-comunes.md` | cabecera (una dueña para los dos equipos; el de Javier propone por Jira). **A13 reescrita: el ciclo del ticket** (abrir con etiqueta de equipo y de área, coger, soltar, cerrar, limpiar). **A23 nueva: cómo se escribe un guard**, 16 casillas. Añadidos en A1 (agentes en worktree fijado), A3 («no tengo X» se mide; BASE antes que mutantes), A4 (control del sufijo en su propio comando; push aparte tras `ls-remote`; cifra derivada regenerada), A6 (lista de antes de una suite completa; medir el ESTADO tras pulsar), A10 (6 frases), A14 (la hora sale de GitHub), A19 (dos equipos; los jefes), A21 (la familia de la operación que no se ejecutó) |
| `docs/equipo/dos-equipos.md` | **nuevo**: los dos jefes, los puestos de los dos equipos, **el mapa de dueños fichero a fichero sin ningún puesto repetido**, las etiquetas de Jira, cómo se coordinan dos orquestadores que no pueden hablarse, los recursos compartidos y las decisiones pendientes |
| `docs/equipo/trampas-del-entorno.md` | **nuevo**: las trampas de Windows, Git Bash, PowerShell 5.1, cmd, gh y git, que vivían en 7 notas de una sola máquina |
| `docs/equipo/prompt-tanda-orquestador.md` | **neutro**: UN solo prompt para los dos equipos; ya no manda leer memorias que solo existen en una máquina ni dice «asignado a Luis» |
| `docs/equipo/limites-del-fundador.md` | sección nueva «los límites de los DOS JEFES»; no se toca ni una línea de la «Delegación permanente» (la lee el oráculo de SCRUM-861) |

### Decisiones del orquestador que están escritas aquí (18-sep-2026, por el canal)

- Los 12 choques del mapa de ficheros (contenedores comunes con dueño y bloque marcado; A5 igual para los dos
  equipos; RGPD por sujeto; ci.yml y vigías de la S5, guards nuevos de J6, bancos de la S3; una sola dueña de
  las normas; `traspaso-javier.md`).
- A13 «asignado al JEFE del equipo que lo trabaja», no «a quien lo trabaja»: las sesiones no tienen cuenta de
  Jira.
- Los puestos J1-J6 (aprobados por el fundador ~12:30Z), y sus consecuencias en S0, S1 y S2.
- Las etiquetas `equipo-*` y `area-*`, y la metodología de tickets «como departamentos».

### Medido para escribirlo

- **Por contenido, donde el nombre engañaba:** `envioDelDocumento.ts` lo importan cobros, trabajos y facturas,
  **no** presupuestos → J1, no S1. Todo el RGPD que hay hoy en código (supresión, anonimizado, borrado,
  portabilidad) es **del MERCHANT** (SCRUM-244) → J3; la supresión del cliente final no existe.
  `switchFormaJuridica.js` es «este contacto es empresa o persona» → J2, no un ajuste fiscal.
  **`stripe.routes.ts` es UN webhook para pagos del cliente y para la suscripción a YaQu**: choque nuevo,
  queda como decisión pendiente.
- **Jira:** las 14 etiquetas nuevas (`equipo-luis`, `equipo-javier`, `area-s0` … `area-j6`) están en **0**
  tickets; control: la misma consulta con `sesion-J1` da 10. Las etiquetas viejas `sesion-J1`, `sesion-J2`,
  `sesion-L1` … `sesion-L4` están en **22** tickets de agosto con otro significado, y NO se reutilizan.
- **Turno de staging:** es un advisory lock de Postgres (`scripts/_staging-lock.mjs:307`), así que vale entre
  máquinas.
- **Contra casos reales:** el censo de los 80 tickets abiertos que hizo el orquestador (18-sep ~11:58Z) casa
  cada ticket con un área. Sus cuatro huecos quedan escritos: infraestructura → S5 y canal de WhatsApp → J2
  (decididos por el orquestador), el ALTER → Javier como jefe, y la gestoría → pendiente. De ahí sale también
  el «estado desfasado» de A13 (774, 779 y 864 en «Acción del fundador» sin esperarle).
- **Los nombres de fichero que cita `dos-equipos.md` existen** (110 citados, sobre 3.260 del árbol): los únicos
  que no, son los ficheros nuevos y las plantillas (`puesto-jN.md`, `traspaso-javier.md`…), y un nombre falso
  de control sale marcado.
- **Instrumentos que leen estos ficheros (A12):** `scripts/_invocaciones-de-la-tanda.mjs` lee los bloques ```
  de `00-normas-comunes.md` (no se añade ninguno: su población no cambia) y el oráculo de microcopy lee
  `limites-del-fundador.md` («Delegación permanente», sin tocar). Tests que los leen, corridos sobre la rama:
  `scrum861`, `scrum850`, `scrum850b`, `scrum711` → **29 tests · 29 pass · 0 fail**, exit 0.
- Bytes de control (A22) y CR en los 6 ficheros: **0 y 0**.

### Lo que NO se ha hecho, y por qué

- **Ningún guard nuevo.** El PR es solo de docs, como pedía el encargo. Las listas llevan su caso que falla
  escrito, pero **nada las comprueba solo**. Propuesta para después: un comprobador del mensaje al jefe
  (`¿termina en «Para ti»?`, `¿hay jerga en la prosa?`) con sus casos en rojo.
- **SCRUM-243:** su medición del 30-jul (403 lecturas, «196 filtran / 45 sin red») solo existe en la memoria de
  la máquina de Luis; no hay `docs/master/SCRUM-243.md`. **Pendiente**, sin abrir frente (orden del orquestador).
- **Las fichas de los puestos J1-J6** no se escriben aquí: cada puesto escribe la suya en su primera tanda.
- `CLAUDE.md` y `.claude/**` no se tocan (derivados del máster, regla 35).

### Errores propios

- En el primer mensaje de choques di una **población de 327 ficheros sin contarla**. Contada, eran 405. Lo
  corregí en el mensaje siguiente; los choques no cambiaban.
- Escribí «21 tickets» con las etiquetas viejas; contados en Jira eran **22**. Corregido antes del commit.
- Un comando de PowerShell con `'\]\('` lo paró el hook; no se ejecutó nada. Rehecho con un `.mjs`.
