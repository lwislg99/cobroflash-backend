# SCRUM-1552 · Reglas 43 y 44 de la Parte I: la puerta de go-live y la línea en el máster

**Medido contra:** `origin/main` = `2834ee9ed7f53a3aa33ffa22c9016072d8388819` · 2026-10-14T04:20:56Z

A9: aviso → A10 «Un registro escrito por la misma mano que aplicó el texto no es su firma: es quien lo aplicó contando que la tuvo.» — no se pudo comprobar: la autorización para colocar las dos reglas me llega por el encargo del orquestador; en Jira consta el literal de la 43 (descripción de SCRUM-1554) y el «Si me vale» de la 44 (descripción de SCRUM-1552), ambos transcritos por el orquestador, y no un comentario que autorice colocarlas en la Parte I

14-oct-2026 · **J5** (sesión `jv-j5a`, equipo de Javier), por encargo del orquestador (`cobroflash-backend-2e`).

**Carril a mano.** El hook de arranque dijo «SIN IDENTIDAD»; medido por el orquestador, es SCRUM-1549, y
se construye con su orden. Etiquetas leídas en SCRUM-1552: `aviso-a-luis`, `calidad`, `cambio-de-master`,
`decision-jefe`, `equipo-javier`, `fundador`. Ninguna de equipo-luis, `area-s*` ni `esperando-*`.

## Qué es esto

**Un cambio de máster, no un registro.** Lo autoriza el fundador según el encargo del orquestador. Toca
SOLO `docs/YAQU_MASTER.md`, Parte I:

1. Cabecera `(1-42; cerradas)` → `(1-44; cerradas)`.
2. Reglas **43** y **44**, añadidas al final de la Parte I, detrás de la 41, con el formato de la 40 y la 41
   (número, frase en negrita, debajo motivo y consecuencia).
3. Una línea de fecha, `**Proceso (14-oct-2026):**`, delante de las dos. **Es lo único que no estaba en el
   encargo literal**, y va porque sin ella la 43 y la 44 quedarían dentro del bloque «LAS TRES QUE HEREDA
   UNA EJECUCIÓN QUE NADIE REVISA», que dice «Estas tres». Es la misma forma que usan los bloques de las
   reglas 37, 38 y 42.

**Por qué detrás de la 41 y no inmediatamente detrás de la 42:** en el fichero la 42 está físicamente entre
la 37 y la 38 (el orden es 37, 42, 38, 39, 40, 41). Pegarlas a la 42 las habría metido delante de la 38.
No se ha movido ni renumerado ninguna regla existente.

**Literal de la 43:** se cita con la ortografía con que consta en Jira (descripción de SCRUM-1554:
«todavía», «están», «estarán», «día»), no con la del encargo, que venía sin tildes.

## Lo que NO se ha hecho

- **`CLAUDE.md` no se toca.** Cita el «42» en su punto 3bis (`CLAUDE.md:39-40`), pero como **número de la
  regla 42**, no como tope de la Parte I: sigue siendo cierto. No hay otra aparición de «1-42» en el
  máster ni en `CLAUDE.md`. Si `CLAUDE.md` debe reflejar las reglas nuevas, lo decide el orquestador (regla 35).
- Ninguna otra Parte del máster, ni `docs/equipo/00-normas-siempre.md`, ni camino de emisión, ni esquema,
  ni base, ni guard, ni workflow, ni texto de usuario.

## 🔴 La regla 44 no trae mecanismo

Hoy se cumple **solo si alguien escribe la línea**. Quién la escribe y cuándo está **sin decidir** en
SCRUM-1552 (punto 2 de su enunciado), y no se resuelve aquí. Tampoco se ha rellenado hacia atrás ninguna
decisión vieja: el enunciado lo prohíbe sin que el fundador diga cuáles.

## Guards que vigilan el máster, corridos

Buscados por concepto (`grep -l YAQU_MASTER tests/ scripts/`): el que vigila el recuento de reglas es
`tests/scrum637-un-numero-una-regla.test.mjs` (un número, una regla; la cabecera `(1-N)` igual al máximo
del cuerpo). `tests/scrum273-registro-por-fichero.test.mjs` solo bloquea entradas `> **✅ SCRUM-` en el
máster, y aquí no se añade ninguna. Resultados en el commit y en Jira.
