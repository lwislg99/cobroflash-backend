# SCRUM-1376 · El aviso de firma rechazada del albarán ya no queda pegado a los botones

**Medido contra:** `origin/main` = `bc8acb9c9300b121c9afad5e8fab0239851a3436` · 2026-10-01T13:44:00Z
A9: comprobación → `tests/scrum1351-viaje-firma-sin-red-albaran.test.mjs`
**Skill UI:** cargada

1-oct-2026 · **S4**. Lo vi yo mismo en yaqu.app al verificar SCRUM-1353 (captura a 390 px): el
aviso «La firma que quedó pendiente no se ha podido registrar. Vuelve a firmar el albarán.» se
pintaba suelto en la página y su borde inferior tocaba «Enviar para firmar» y «Firmar aquí mismo».

## Qué cambia

Sólo `public/dashboard/js/albaranDetailView.js`, una línea: el aviso se mete en el mismo
envoltorio que ya usa la caja «Solo en este móvil» (`cajaDeFirma`), que es el que deja aire
debajo. No hay texto nuevo, ni CSS, ni estilo en línea nuevo, ni componente nuevo: el aviso sigue
siendo `.alert warning` con `role="alert"`.

| | Antes | Ahora |
| --- | --- | --- |
| Aviso de rechazo | hijo directo de la página, sin margen | dentro del envoltorio de `cajaDeFirma` |
| Caja «Solo en este móvil» | dentro del envoltorio | igual |

## Por qué se me pasó en SCRUM-1353

Miré que el aviso salía y que el texto era el firmado. No miré dónde quedaba respecto a lo de
debajo: el banco de vistas no dibuja, y la caja de al lado, que sí tenía su separación, no me hizo
sospechar del aviso. Lo cazó la captura de producción.

## Test

`tests/scrum1351-viaje-firma-sin-red-albaran.test.mjs`, test nuevo «SCRUM-1376 · …»:
el aviso no es hermano directo de la barra de acciones y su envoltorio lleva la misma separación
que el de la caja. Suelo: la separación de referencia no está vacía (si lo estuviera, compararía
«» con «»).

- En rojo primero, contra la vista sin tocar: 13 pasan de 14, cae el nuevo por «el aviso NO es
  hermano directo de la barra de acciones».
- Con el arreglo: 14 pasan de 14.

## Límite del test

Compara el envoltorio, no píxeles: el banco no maqueta. La separación medida en el navegador se
mira en yaqu.app tras el despliegue, con el rechazo simulado por la sonda de SCRUM-1353.
