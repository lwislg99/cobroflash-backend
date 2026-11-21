# SCRUM-1784a · Varios técnicos por trabajo: YA existe desde el 2-sep; capturas para el fundador con el código real de main

**Medido contra:** `origin/main` = `fea1c00078654d8d617af055de94f2b627df07ce` · 2026-11-21T03:53:14Z

A9: aviso → cicatriz J2 «un clic que falla dentro de un catch mudo produce una captura igual a la anterior: la pestaña El trabajo se buscó con el rol button (es tab) y la captura 5 salió idéntica a la 4, y la 4 salió a mitad de un fundido de entrada» — no se pudo comprobar: el guion de capturas vive en evidencias y ningún test lo ejecuta, así que no hay guard que pueda cazar un clic tragado; lo que sí queda es que el propio guion ya no traga nada: cada paso exige su bloque visible y sin animaciones, o lanza

Carril J2 (solo documentos y evidencias: nada en `src/`, `public/` ni `prisma/`). Encargo del orquestador J (`cobroflash-backend-87`), 21-nov-2026. Sesiones `jv-j2dn` (medición y primeras capturas) y `jv-j2do` (relevo: captura 5, revisión de las 10 y este registro), rama `scrum-1784a-relevo-j2do`. La hora del ancla es la cabecera `Date:` de GitHub (`gh api -i zen`).

## 1 · La medición (SCRUM-1784 c.22258, jv-j2dn)

La orden del fundador pedía poder asignar un trabajo a varios técnicos. **Eso ya está construido y en producción desde el 2-sep-2026** (SCRUM-650 y SCRUM-727b). Las piezas, con su ruta en main, están en la tabla de c.22258: la tabla N:M `job_assignees`, la escritura en `src/modules/jobs/domain/asignacionDeTrabajo.ts`, el filtro de los tres ejes en `jobs.routes.ts`, el selector de la ficha en `public/dashboard/js/jobAsignados.js`, y la columna, las casillas y el filtro de la lista en `public/dashboard/js/jobsView.js`. Por eso no hay ni borrador, ni DDL, ni código: solo capturas de lo que hay, para que el fundador diga si es lo que pedía.

## 2 · Las capturas (SCRUM-1784 c.22270)

Están en `docs/master/evidencias/SCRUM-1784/`, en escritorio (1440×900) y en móvil (390×844). Todas llevan el pie «SCRUM-1784 · código real de main fea1c0007 con datos de ejemplo, no la app viva».

| captura | qué enseña |
| --- | --- |
| `1-lista-*` | la lista de Trabajos, cada fila con sus técnicos («Israel Gómez, Miguel Sanz, J…», «Sin asignar»…), y el filtro «Todos los técnicos» |
| `2-lista-casillas-*` | el desplegable de la fila «Comunidad Alcalá 120» abierto, con 3 casillas y 3 marcadas |
| `3-lista-filtro-tecnico-*` | el filtro en «Israel Gómez»: solo quedan sus dos trabajos |
| `4-ficha-*` | la ficha «Reforma de baño completa» con sus pestañas |
| `5-ficha-quien-ejecuta-*` | la pestaña «El trabajo» con la línea «Quién lo ejecuta» abierta y 3 de 3 casillas marcadas |

**Cómo se hicieron:** el código de `public/` de main se sirvió en estático en 127.0.0.1:5784. Playwright, por el MCP, lanzó `guion/capturas.js` en un contexto nuevo con `serviceWorkers: 'block'`: el service worker del panel cachea `/admin/*` y se salta las rutas. Las respuestas de `/admin/*` las da el propio guion con datos de ejemplo. Resultado de la última pasada:

- 10 capturas hechas;
- `patches=[]` (ninguna escritura sobre un trabajo);
- 0 peticiones fuera de 127.0.0.1;
- 2 `POST /admin/entorno`, que manda el panel al arrancar y que contestó el guion, sin servidor detrás.

La maqueta de la primera pasada (`maqueta-api.js`) se ha BORRADO: `capturas.js` ya no la usaba (lleva la suya dentro, con `serviceWorkers: 'block'`) y `tests/scrum1233g-banco-bloquea-el-sw.test.mjs` la daba en rojo por llamar a `.route(` sin abrir su contexto.

**Corrección a c.22258 y al encargo:** en la ficha, el selector ya no lleva el título «Quién ejecuta este trabajo». Desde SCRUM-917g se pinta con `sinTitulo: true` (`public/dashboard/js/jobDetailView.js:1522`), y el rótulo que se ve es el de la línea, «Quién lo ejecuta» (`public/dashboard/js/jobTrabajoPlegable.js:36`).

## 3 · Los errores, y en qué orden se cazaron

1. **jv-j2dn**: la captura 5 era idéntica a la 4. El guion buscaba la pestaña con `getByRole('button')`, pero es `role="tab"` (`jobDetailView.js:90`), y el clic iba dentro de un `.catch(() => {})`.
2. **jv-j2do, al mirar las capturas**: la 4 salía desvaída, a mitad del fundido de entrada, y la 2 abría la fila de un solo técnico.

Se arreglaron los dos en el guion. Cada paso espera su bloque visible (`exige`) y que no quede ninguna animación corriendo (`quieta`); si no, lanza con el nombre de la captura. Las 10 se revisaron una por una con el visor de imágenes, después de la última pasada.

## 4 · Lo que NO se ha medido

- No se ha abierto yaqu.app (sin credenciales, y el encargo lo prohíbe).
- No se ha comprobado si asignar a un técnico le manda un aviso: sigue como lo dejó c.22258.
- En `4-ficha-movil`, la tarjeta «Cliente» sale a media anchura. Así lo pinta el código de main con estos datos; no se ha investigado, y es del carril S2/S4.

## 5 · Aceptación → dónde se ve

| aceptación (literal) | dónde se ve |
| --- | --- |
| «cuando tengas el borrador enseñamelo con playwrith para aprobartelo» | `docs/master/evidencias/SCRUM-1784/` (10 PNG) y SCRUM-1784 c.22270. No es un borrador: es lo que ya existe en main |
| aprobación del fundador | NO HECHO → el fundador, con las preguntas de c.22258 y c.22270 |
