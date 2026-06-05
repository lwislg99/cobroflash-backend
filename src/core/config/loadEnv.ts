// Carga de variables de entorno. Debe importarse ANTES que cualquier módulo
// que lea process.env (p. ej. ./core/config/env). Por eso vive en su propio
// módulo y se importa el primero en src/index.ts.
//
// .env.local tiene prioridad en desarrollo: dotenv NO pisa claves ya definidas,
// así que cargándolo primero, sus valores ganan sobre .env. En Railway no existe
// .env.local → se usan las variables inyectadas (o .env).
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();
