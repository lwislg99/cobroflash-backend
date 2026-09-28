# Importar clientes — los rótulos del desplegable de columnas · SCRUM-1136

**Aprobado por el orquestador por delegación del fundador** el 28-sep-2026 — SCRUM-1136 comentario 17445.

La delegación está en `docs/equipo/limites-del-fundador.md` §«Delegación permanente». Los siete
primeros los propuso J2 reutilizando literales ya aprobados en otras pantallas; el octavo lo firmó
el orquestador desde cero, en lugar del «País» a secas que proponía J2.

## Textos aprobados, literales

| Campo | Texto aprobado | Procedencia |
|---|---|---|
| `mobile` | Móvil (WhatsApp) | firmado por el fundador el 7-sep-2026 (SCRUM-590) |
| `taxId` | NIF/CIF | chip de la ficha 360 del cliente |
| `tags` | Etiquetas | columna de la lista de clientes |
| `billingAddress` | Dirección | aprobados el 2-sep-2026 (regla 30, SCRUM-579) |
| `billingCity` | Población | ídem |
| `billingPostalCode` | Código postal | ídem |
| `billingProvince` | Provincia | ídem |
| `billingCountry` | País (código, ej. ES) | nuevo, firmado en el mismo comentario |

## Dónde se pinta

Las opciones del `<select>` de cada columna en el paso «Esto es lo que hemos entendido» del modal
de importar (`public/dashboard/js/csvImport.js`, `pintarMapeo`). Las cuatro de antes —Nombre,
Teléfono, Email, Notas— no cambian.

## Por qué el país lleva el formato en el rótulo

El servidor exige el código ISO de 2 letras y rechaza la fila si no. Un CSV que diga «España» en
esa columna —lo normal— haría fallar TODAS las filas, y el profesional se enteraría después. El
rótulo lo evita antes de importar. El texto de rechazo por fila («País debe ser el código ISO de 2
letras (ej. ES)») no cambia.
