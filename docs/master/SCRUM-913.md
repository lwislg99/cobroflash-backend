# SCRUM-913 · Fichaje: el registro de jornada de los técnicos

**Medido contra:** `origin/main` = `bbe01631ac5fcfd3ec67272c8aed3e39c192057f` · 2026-09-21T12:28:20Z (hora de GitHub, cabecera `Date:` de `gh api -i zen`)
**Rama:** `scrum-913a-registro-jornada-requisitos-legales` · **Carril:** consultoría (Sesión 0), paso 1 del ticket · **Encargo:** orquestador, 21-sep-2026 (excepción de carril confirmada por él en el canal).

## SCRUM-913a · Paso 1: lo que dice la norma (21-sep-2026)

**Entrega:** `docs/legal/REGISTRO_JORNADA_ES.md`. Contesta, con fuente oficial y sin interpretar, lo que pedía el paso 1:
qué datos, cuánto tiempo se guardan, quién tiene acceso, si se puede modificar y cómo, teletrabajo, desplazamientos,
geolocalización y sanciones. Cada afirmación lleva su marca: 🟢 norma vigente · 🟡 criterio oficial que no obliga ·
🔴 proyecto no vigente · ⚪ la norma no lo dice.

**Lo que el paso 2 (Sesión 1) necesita saber, en cinco líneas:**

1. 🟢 Lo único que la ley exige guardar es el **horario concreto de inicio y finalización** de la jornada de cada persona trabajadora, **cada día**, durante **cuatro años** (ET art. 34.9).
2. ⚪ La ley **no dice nada** sobre corregir un asiento. Solo el **proyecto** de Real Decreto lo regula (autorización de la empresa y del trabajador, huella indeleble, discrepancia visible), y ese proyecto **no está publicado** a 21-sep-2026.
3. 🟡 Los criterios oficiales piden un sistema «fiable, inmodificable y no manipulable a posteriori, ya sea por el empresario o por el propio trabajador», accesible «en cualquier momento» a la persona trabajadora, sus representantes y la Inspección, y que la Inspección pueda pedir «impresión» o «descarga» en «formato legible y tratable».
4. 🟡 Con geolocalización, la AEPD dice que si el fin es el registro horario, la ubicación **no** puede usarse para saber dónde está la persona en cada momento, y que **no es lícito imponer al trabajador su móvil personal** para geolocalizar. Es la parte que decide el fundador (y enlaza con SCRUM-989).
5. ⚪ Desplazamientos entre clientes: la ley calla y la Guía del Ministerio solo dice que se registra «el tiempo de trabajo efectivo». Falta el convenio de cada oficio.

**Lo que no se ha podido leer** (declarado en el §10 del documento, con el motivo): la sentencia TJUE C-55/18 (EUR-Lex y Curia no sirven texto sin JavaScript; no se eludió), el dictamen del Consejo de Estado (403; no se eludió), los convenios colectivos, la jurisprudencia de desplazamientos y las páginas 1-7 y 9-11 del Criterio Técnico 101/2019 sin contrastar con la imagen.

**Cómo se midió (población y controles):**

- **Citas:** 96 citas literales en el documento, **96 de 96 halladas** en los ficheros bajados de BOE, Ministerio, Inspección y AEPD. Control negativo: una cita alterada a propósito sale «NO ENCONTRADA». Script: `docs/verificacion/comprobar-citas-registro-jornada.mjs`.
- **Real Decreto sin publicar:** barrido de los sumarios del BOE del 30-sep-2025 al 21-sep-2026 (**308** sumarios, **71.145** disposiciones, 0 errores). Controles: encuentra una resolución de jornada que existe (`BOE-A-2026-8287`) y el patrón dispara sobre dos títulos reales. Script y resultado: `docs/verificacion/barrido-boe-sumarios.mjs` y `docs/verificacion/barrido-boe-sumarios-2025-09-30_2026-09-21.json`. **Límite:** solo mira títulos.
- **CT 101/2019:** el PDF es un escaneo sin texto. Lo transcribió un subagente (16 de 16 páginas) y **yo contrasté con la imagen las páginas 8, 12, 13, 14, 15 y 16**, de donde sale toda cita del documento. Coincidieron palabra por palabra.

**Dos filas nuevas en `docs/equipo/afirmaciones-verificadas.md`:** la del mapa de «Trabajos de hoy» de SCRUM-989 (**NO ENCUENTRO ese mapa**, con su suelo: la misma búsqueda sí ve el enlace a Google Maps de `jobRailBlocks.js:86`) y la de SCRUM-913 (premisa cierta; Real Decreto digital no publicado).

**Qué NO hace esta entrega:** no toca `src/`, `public/` ni el esquema; no abre ni cierra el ticket; no diseña. El diseño y el diff de esquema aditivo (con `node scripts/preview-migracion.mjs`, que Javier aplica como ALTER) son del **paso 2, Sesión 1**. **SCRUM-913 sigue abierto.**

### Errores míos de esta entrega (A9)

- **Cinco citas mal copiadas, cazadas por el comprobador y no por mí.** En la primera pasada, de 97 citas, **12 salieron «no encontradas»**. **Siete** eran del comprobador o de su lista de fuentes (dos frases del ticket de Jira que no estaban entre las fuentes, tres citas del CT con negritas de la transcripción, una con un espacio antes de la coma en el texto del BOE y un título del barrido). **Cinco eran errores míos de copia**: junté dos frases de la Guía en una; escribí «expreso, claro e inequívoco» donde la ley dice «de forma expresa, clara e inequívoca»; puse en minúscula el «Horario» de un artículo del proyecto; escribí «tiempos de espera y de tiempos a disposición» donde el texto dice «de los tiempos de espera y de los tiempos a disposición»; y puse entre comillas, como título literal, un nombre de guía de la AEPD que no era literal. Releer a ojo no las cazó; el instrumento, sí. Por eso el comprobador se comitea.
- **Una hora con «~».** En el mensaje de bloqueo de cuentas al orquestador escribí «~12:25Z» en vez de medirla; A14 lo prohíbe. La hora real de ese mensaje era anterior a las 12:20:11 de GitHub que medí después.
- **Una transcripción de escaneo no es el original.** Delegué la lectura de un PDF de imágenes en un subagente y **no la cité hasta contrastar con la imagen** las páginas de donde salen las citas: las seis coincidieron, pero solo lo sé de esas seis.

### Fuera de esta entrega, y por qué

- **Cuentas de prueba (Verifacturamos, Holded, ServiceM8):** el clasificador de permisos denegó leer la contraseña de Verifacturamos («Real-World Transactions»); la autorización llegó reenviada por otra sesión, no escrita por el fundador en esta. **No se rodeó.** No se entró en ninguna cuenta ni se creó ninguna. Holded caduca sola a primeros de octubre. Queda en el traspaso de la Sesión 0.
- **Las tres propuestas de producto:** no entregadas (contexto medido de la sesión: **370.979 tokens**, por encima del umbral de 300k de A19). Van a la sesión de relevo, con la valoración de 913 y 989 ya hecha en las notas de la Sesión 0.
