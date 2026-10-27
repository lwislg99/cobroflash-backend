# El parte: Desplazamiento que la ruta rechaza por no ser un entero que quepa

Aprobado por el orquestador por delegación del fundador · SCRUM-1491 comentario 18517

Firmado el 6-oct-2026. La delegación de microcopy es la permanente de `docs/equipo/limites-del-fundador.md`.

## Texto aprobado, literal

> No se ha guardado. Desplazamiento es un número entero, como 1 o 2 — no el tiempo de viaje

## Dónde se pinta

`public/dashboard/js/parteDetailView.js`, `TEXTOS.desplazamientoEsEntero`.

En el aviso que ya existía para un campo de la cabecera que no se guarda: al pie del paso «Horas y
desplazamiento», con `role="alert"`, y traído a la vista. Sólo cambia el texto.

## En qué caso

Uno: el `PATCH` del campo falla y el error trae el código `desplazamientos_invalido`. Se decide por el código
que pone `apiRequest` en `err.code`, nunca por el mensaje del servidor.

Ese código tiene hoy dos causas en la ruta: el número no es entero (`1,5`) o no cabe en la columna
(`3000000000`). El texto dice lo que vale y no lo que falló; para el número que no cabe es impreciso, no falso.

## Las conductas que se firmaron con el texto

1. Se decide por `err.code === 'desplazamientos_invalido'`.
2. Sólo cambia el texto de ese aviso: el sitio y el traerlo a la vista quedan como estaban.
3. La casilla de Desplazamiento pasa a `inputmode="numeric"`, en el mismo cambio. Kilómetros sigue en
   `decimal`.

## Lo que no cubre

- Cualquier otro fallo de guardado de ese campo (500, sin red): sigue saliendo «No se ha podido guardar el
  cambio — vuelve a intentarlo».
- Un texto propio para el número que no cabe: pide que la ruta dé un código por causa (SCRUM-1488).
- Lo que la casilla numérica no entiende (`1e`, `-`): no llega a la ruta como rechazo. Es SCRUM-1492.
