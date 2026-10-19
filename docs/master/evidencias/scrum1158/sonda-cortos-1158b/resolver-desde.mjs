// --import de este fichero: un paquete desnudo que no se encuentra desde el árbol extraído se
// resuelve como si lo importara $RESOLVER_DESDE/package.json. Sin junctions (no se puede borrar
// a través de él lo que no es suyo).
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
const base = pathToFileURL(process.env.RESOLVER_DESDE.replace(/[\\/]$/, '') + '/package.json').href;
register('data:text/javascript,' + encodeURIComponent(`
export async function resolve(spec, ctx, next) {
  try { return await next(spec, ctx); }
  catch (e) {
    if (e.code !== 'ERR_MODULE_NOT_FOUND' || /^[./]|^[a-z]+:/i.test(spec)) throw e;
    return next(spec, { ...ctx, parentURL: ${JSON.stringify(base)} });
  }
}`));
