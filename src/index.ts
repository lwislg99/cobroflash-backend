import './core/config/loadEnv'; // PRIMERO: carga .env.local (prioridad) y .env
import { app } from './app';
import { config, warnMissingWebhookSecrets, warnEmptyOwnerEmails, assertPublicBaseUrl, assertVerifactuIdSistema } from './core/config/env';
import { startCronJobs } from './core/cron/cron';
import { assertSchemaSinDeriva } from './core/db/schemaDrift';
// SCRUM-631: el hermano del de arriba. Aquel mira TABLAS y COLUMNAS y declara que NO mira
// indices; este mira el unico indice del que depende una garantia de producto.
import { assertUnicidadDeNombre } from './core/db/unicidadNombreProducto';
// SCRUM-475: si el job que manda un aviso no queda programado, ese aviso no sale NUNCA. Consta.
import { dejarConstancia } from './modules/messaging/domain/avisoConstancia';

// SCRUM-163: PRIMERO y REVIENTA (los dos de abajo solo avisan). Una PUBLIC_BASE_URL
// invalida envenena en silencio todo enlace que se manda al cliente final; arrancar asi es
// peor que no arrancar.
assertPublicBaseUrl();
// SCRUM-217: revienta si VERIFACTU_ID_SISTEMA esta PRESENTE Y MAL (error 1177 de la AEAT, que el
// emisor no puede detectar porque solo mira que no este vacio); si falta, solo avisa — hoy las
// VERIFACTU_* van vacias a proposito y reventar por eso tumbaria produccion.
assertVerifactuIdSistema();
warnMissingWebhookSecrets(); // SCRUM-99: aviso ruidoso ANTES de escuchar, no tras el primer webhook
warnEmptyOwnerEmails(); // SCRUM-102: mismo motivo, para OWNER_EMAILS

// SCRUM-222: los cuatro de arriba miran la CONFIGURACION; este mira la BASE. Es asincrono
// (una consulta al catalogo), asi que el arranque pasa a ser una funcion en vez de una linea.
// Revienta SOLO si hay deriva de verdad; si no se pudo comprobar, avisa a gritos y arranca —
// tumbar produccion por un hipo de red seria una cura peor que la enfermedad.
async function arrancar(): Promise<void> {
  await assertSchemaSinDeriva();

  // SCRUM-631 · DESPUES del de esquema y con el mismo criterio: si falta la columna, la unicidad
  // sobre ella no significa nada, asi que el orden no es libre.
  await assertUnicidadDeNombre();

  app.listen(config.PORT, () => {
    console.log(`YaQu API listening on ${config.PUBLIC_BASE_URL}`);
    if (config.DISABLE_CRONS) {
      console.log('[cron] desactivados (DISABLE_CRONS=true)');
    } else {
      // SCRUM-475 · SE MIRA LO QUE DEVUELVE. Este era el octavo sitio del censo que perdia el
      // fallo, y su caso no es el de los otros siete: `startCronJobs` devolvia `void`, asi que
      // «nadie mira el resultado» era cierto y vacio. Lo que se perdia era otra cosa -- su ultima
      // linea AFIRMABA seis jobs registrados sin medir ninguno-, y de ahi sale este parte: si el
      // job del resumen semanal o el del ciclo de vida no queda montado, esos avisos no salen
      // NUNCA y nadie los echa de menos. Que conste al arrancar, que es cuando se puede arreglar.
      const parte = startCronJobs();
      for (const aviso of parte.avisosSinProgramar) {
        dejarConstancia(aviso, '', { error: new Error('el job que lo manda no quedo programado') });
      }
    }
  });
}

arrancar().catch((err) => {
  // El mensaje ya viene explicado desde assertSchemaSinDeriva; aqui solo se imprime y se sale
  // sin escuchar. Sin este catch seria un unhandled rejection y el motivo quedaria enterrado
  // bajo una traza.
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
