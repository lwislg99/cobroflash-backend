# SCRUM-1155 (920f) · el alta de gasto rediseñada, foto primero

**Aprobado por el orquestador por delegación del fundador** el 2026-09-20 — SCRUM-920 comentario
15992 (los literales del alta), con los 9 motivos de descarte firmados el 2026-09-21 — SCRUM-920
comentario 16175 (junto con SCRUM-912/920h). Construido en SCRUM-1155, un mes después de firmarse.

## Los literales, tal cual se pintan

`public/dashboard/js/expensesView.js`, modal de alta/edición (`openExpenseModal`):

1. «1 · La foto del ticket»
2. «Hazla ahora, que el papel lo tienes delante. Lo demás lo puedes rellenar luego.»
3. «Haz la foto del ticket»
4. «📷 Hacer foto»
5. «Elegir foto o archivo»
6. «Ahora no tengo el ticket»
7. «Foto guardada»
8. «Si no se lee bien, repítela.»
9. «Verla»
10. «Quitarla»
11. «2 · Qué es y cuánto»
12. «✓ Con esto ya se guarda. Lo de abajo es opcional.»
13. «3 · Datos de la factura del proveedor»
14. «Opcional»
15. «Guardamos la foto como tu copia. Los datos fiscales salen de los campos de abajo.» (F1;
    reemplaza «…de los campos de arriba» de SCRUM-324 porque la foto sube al paso 1)

Y los 9 motivos de descarte de la lectura (`MOTIVOS_DESCARTE_TEXTO`), firmados en el comentario
16175 — ver el propio código, que los cita tal cual.

## Qué cambió

El modal de alta reordena la foto AL PRINCIPIO (antes iba al final) y añade dos botones —«📷 Hacer
foto» (con `capture="environment"`, abre la cámara en móvil) y «Elegir foto o archivo»— donde antes
había un único `<input type="file">` plano. El botón «Leer el ticket» de SCRUM-1038 se reconcilia
aquí: sigue siendo el ÚNICO mecanismo de lectura, solo cambia de sitio (junto a la foto) y ahora lo
alimenta cualquiera de los dos file inputs.

El desplegable de «Tipo de IVA» se amplía de `[21,10,4,0]` a `[0,2,4,5,10,21]` — decisión de
producto ya tomada el 21-sep-2026 (comentario 16175 punto 3), aplicada aquí.

Los 9 motivos de descarte de la lectura (por qué un campo llegó vacío) se pintan por primera vez
bajo el campo correspondiente, en vez de perderse en silencio.

## Lo que NO se construyó, a propósito

`proveedorNombre` (el servidor ya lo lee y lo manda en la propuesta) no se pinta en ningún sitio:
mostrarlo necesita un texto nuevo sin firmar todavía (regla 30). Se deja explícitamente sin
construir en vez de inventarse una frase.
