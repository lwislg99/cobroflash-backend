# Clientes — etiquetar la selección · SCRUM-1135

**Aprobado por el orquestador por delegación del fundador** el 28-sep-2026 — SCRUM-1135 comentario 17447.

La delegación está en `docs/equipo/limites-del-fundador.md` §«Delegación permanente». Los propuso
J2; la firma cambió uno («ya tiene 20 etiquetas» → «no caben más etiquetas»), porque el tope vive en
`MAXIMO_POR_CLIENTE` del servidor y escribirlo en el panel sería el mismo número en dos sitios.

## Textos aprobados, literales

`{n}` y `{m}` son el número de clientes: dato, no texto.

| Ranura | Texto aprobado |
|---|---|
| `anadir` | Añadir etiqueta |
| `quitar` | Quitar etiqueta |
| `campo` | Etiqueta |
| `anadidaUno` | Etiqueta añadida a 1 cliente |
| `anadidaVarios` | Etiqueta añadida a {n} clientes |
| `quitadaUno` | Etiqueta quitada de 1 cliente |
| `quitadaVarios` | Etiqueta quitada de {n} clientes |
| `yaLaTeniaUno` | 1 ya la tenía o no caben más etiquetas |
| `yaLaTeniaVarios` | {m} ya la tenían o no caben más etiquetas |
| `noLaTeniaUno` | 1 no la tenía |
| `noLaTeniaVarios` | {m} no la tenían |
| `error` | No se pudieron cambiar las etiquetas |

## Dónde se pinta

En la barra de selección de la lista de Clientes (`public/dashboard/js/customersView.js`), sólo con
uno o más clientes marcados y sólo para el rol admin. Los textos viven en
`public/dashboard/js/filtroClientes.js` (`TEXTOS_ETIQUETADO`, `resumenDelEtiquetado`). Cuando hay
clientes cambiados y sin cambiar, el aviso junta los dos textos con « · ».

## Lo que NO se pinta, a propósito

- Los motivos por cliente que devuelve el servidor (`resultados[].motivo`): son textos suyos sin firmar.
- El detalle del error de red: sería el «Failed to fetch» del navegador (SCRUM-1200).
