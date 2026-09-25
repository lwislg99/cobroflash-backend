# Importar clientes — la pantalla ofrece el .xlsx que el servidor ya lee · SCRUM-1022c

**Aprobado por el orquestador por delegación del fundador** el 25-sep-2026 — SCRUM-1022 comentario 17016.

La delegación está en `docs/equipo/limites-del-fundador.md` §«Delegación permanente», línea
«Javier, 25-sep-2026» (SCRUM-1121, PR #1769). Los dos primeros textos los propuso J2; el tercero,
el tooltip, lo añadió el orquestador en el mismo comentario.

El comentario 17016 titula esta tanda «SCRUM-1022b». Aquí va como **1022c** porque en
`docs/master/SCRUM-1022.md` la sección «SCRUM-1022b» ya existía y es otra cosa: la construcción del
lector del 23-sep (#1723).

## Textos aprobados, literales

| Ranura | Texto aprobado |
|---|---|
| `importarSubeElFichero` | Sube el .csv o el .xlsx de tu Excel. Da igual el orden de las columnas: te diremos qué hemos entendido antes de importar nada. |
| `importarArrastra` | 📂 Arrastra tu fichero o haz click para elegirlo |
| `importarTooltipBoton` | Importar clientes desde un fichero CSV o Excel |

## Dónde se pinta cada uno

- `importarSubeElFichero` → el párrafo del primer paso del modal, `public/dashboard/js/csvImport.js`
  (`pintarElegir`). En pantalla, «.csv» y «.xlsx» van en negrita; el texto es el mismo.
- `importarArrastra` → la zona de arrastrar del mismo paso; «haz click para elegirlo» es el enlace.
- `importarTooltipBoton` → el `title` del botón «⬆ Importar CSV» de `public/dashboard/js/customersView.js`.

Con ellos cambia también el selector de ficheros: `accept=".csv,.txt"` pasa a `accept=".csv,.txt,.xlsx"`.

## Por qué cambian, y por qué NO se borra el registro del 21-sep

El registro `2026-09-21-SCRUM-985-importar-solo-csv.md` quitó «o Excel» del tooltip porque entonces
**el servidor no leía `.xlsx`**: prometerlo era mentir. Era cierto, y el guard que lo sujeta
(`tests/scrum985-…`) era correcto.

Desde SCRUM-1022 (PR #1723, 23-sep-2026) el servidor **sí** lee `.xlsx`. La pantalla lo seguía
escondiendo: el selector no lo ofrecía y sólo llegaba arrastrándolo, que en el móvil no existe. Una
función que existe y no se ve es peor que no tenerla: nadie la pide dos veces.

**Cambió la condición, no el guard.** `scrum985` se reescribe a propósito en el mismo PR, sin
relajarlo: sigue exigiendo que la pantalla no prometa más de lo que el importador lee, y ahora exige
además que las dos rutas de importar sigan mirando la firma del `.xlsx`. Si esa lectura desaparece,
el guard vuelve a caer. El registro del 21-sep se queda: es la constancia de por qué se escribió así.
