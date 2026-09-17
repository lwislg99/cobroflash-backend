# `tests/banco-scrum911/` — el recorrido de MANT-1 en STAGING (SCRUM-911)

⚠️ **Esto NO entra en `npm test` y no debe entrar.** Cada script habla con **staging** (base y API),
necesita el **turno** y lee un fichero de secretos que vive FUERA del repositorio. Un banco así
dentro de la suite sería un test que depende de una máquina compartida, o sea un rojo que no es de
nadie. Se corre a mano, con turno, y deja su veredicto en `paso*.json`.

El expediente con lo que midió está en [`docs/master/SCRUM-911.md`](../../docs/master/SCRUM-911.md).

## Antes de correr nada

1. `../../e2e-staging-secret.txt` (fuera del repo) con `E2E_TEST_LOGIN_SECRET` y
   `DATABASE_URL_STAGING`. **Ningún script imprime la URL ni el secreto** (regla 9).
2. `dist/` compilado del MISMO árbol: los tramos 2 y 3 importan el servicio y el cliente de Prisma
   del `dist` para correr el ciclo del cron en local. `_entorno.mjs` deriva la raíz de su propia
   ubicación, así que **no hay rutas absolutas**: mide el árbol en el que está.
3. **Turno de staging**, siempre. El merchant QA 2 es un fixture **compartido** y otras sesiones lo
   usan el mismo día.
4. `FORCE_COLOR=0`: con color, `scripts/guards-entrada.mjs` dice «0 tests» y sale 1 aunque todo pase.

## Orden

```
node turno.mjs tomar --ref scrum-911-mant-staging --minutos 90
node estado.mjs                  # solo lectura: cómo está staging AHORA
node paso1-alta.mjs              # enciende merchant 2 · presupuesto · sugerencia · alta del plan
node paso2-ciclo.mjs             # el ciclo del cron con `now` SIMULADO
node paso3-botones.mjs           # Aprobar / Posponer / Cancelar, y el teléfono ajeno
node paso4-api-y-ficha.mjs       # la API que pinta las pantallas
node paso4b-ficha360.mjs         # la ficha 360 (`/admin/customers/:id/detail`)
node paso5-pantalla.mjs          # el navegador de verdad (Edge headless)
node paso5b-ficha-y-borrador.mjs # remedición de los dos puntos que paso5 miró mal
node restaurar.mjs               # devuelve merchant 2 a `merchant2-antes.json`
node limpiar.mjs                 # quita lo fabricado a mano; deja la evidencia
node turno.mjs soltar
```

`censo-kpi-mantenimientos.mjs` es aparte y no toca staging: recorre el árbol por AST buscando quién
importa o llama a un símbolo. Lleva **control positivo** — pásale `runMaintenanceProposals` y tiene
que encontrarle los llamadores; si no, el censo está ciego y su «no hay llamador» no vale nada.

## Las tres cosas que este banco hace y conviene no deshacer

🔒 **`merchant2-antes.json` no se sobreescribe.** En una segunda pasada el estado «antes» ya es el
encendido: guardarlo perdería el original para siempre. El fixture es de todos.

🔒 **El `now` va por PARÁMETRO, y las fechas de la base no se tocan.** Mover `nextDueAt` a mano en un
fixture compartido es ensuciarlo, y además mediría otra cosa: lo que el cron hace con una fecha, no
lo que hace con el reloj.

🔒 **El ciclo es GLOBAL, así que hay una PUERTA antes de cada llamada.** `runMaintenanceProposals`
recorre todos los merchants; con un `now` a un año vista barrería planes ajenos y les mandaría una
propuesta de verdad. Los scripts **abortan** si a ese `now` hay algún plan activo vencido que no sea
suyo. Saltó dos veces durante el recorrido del 17-sep, con restos de los propios tramos anteriores:
la puerta no es decorativa.

🔒 **Y nada sale a Meta.** Los tramos que ejercitan envíos comprueban **en runtime** que
`config.WHATSAPP_PHONE_NUMBER_ID` y `WHATSAPP_TOKEN` están vacíos, y **abortan** si no lo están.
Sin credenciales los senders devuelven `not_configured` sin tocar la red (`whatsapp.ts:632`). Ojo:
`salidaAMetaBloqueada` **no** protege aquí — solo corta en procesos de test (`--test` /
`NODE_TEST_CONTEXT`), y esto se corre con `node` a secas.
