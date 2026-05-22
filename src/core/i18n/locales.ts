export interface LocaleConfig {
  // Terminología
  quote: string;          // "Presupuesto" | "Cotización"
  quotePlural: string;    // "Presupuestos" | "Cotizaciones"
  quoteArticle: string;   // "el presupuesto" | "la cotización"
  quoteNew: string;       // "Nuevo presupuesto" | "Nueva cotización"
  quoteVerb: string;      // "presupuesto" | "cotización" (minúscula)
  // Fiscal
  currency: string;       // "EUR" | "MXN" | "COP" ...
  defaultVat: number;     // 0.21 | 0.16 | 0.19 ...
  vatName: string;        // "IVA" | "IGV"
  // Formato
  dateLocale: string;     // para Intl.DateTimeFormat
}

const LOCALES: Record<string, LocaleConfig> = {
  ES: { quote: 'Presupuesto', quotePlural: 'Presupuestos', quoteArticle: 'el presupuesto', quoteNew: 'Nuevo presupuesto', quoteVerb: 'presupuesto', currency: 'EUR', defaultVat: 0.21, vatName: 'IVA', dateLocale: 'es-ES' },
  MX: { quote: 'Cotización',  quotePlural: 'Cotizaciones',  quoteArticle: 'la cotización',  quoteNew: 'Nueva cotización',  quoteVerb: 'cotización',  currency: 'MXN', defaultVat: 0.16, vatName: 'IVA', dateLocale: 'es-MX' },
  CO: { quote: 'Cotización',  quotePlural: 'Cotizaciones',  quoteArticle: 'la cotización',  quoteNew: 'Nueva cotización',  quoteVerb: 'cotización',  currency: 'COP', defaultVat: 0.19, vatName: 'IVA', dateLocale: 'es-CO' },
  AR: { quote: 'Presupuesto', quotePlural: 'Presupuestos', quoteArticle: 'el presupuesto', quoteNew: 'Nuevo presupuesto', quoteVerb: 'presupuesto', currency: 'ARS', defaultVat: 0.21, vatName: 'IVA', dateLocale: 'es-AR' },
  PE: { quote: 'Cotización',  quotePlural: 'Cotizaciones',  quoteArticle: 'la cotización',  quoteNew: 'Nueva cotización',  quoteVerb: 'cotización',  currency: 'PEN', defaultVat: 0.18, vatName: 'IGV', dateLocale: 'es-PE' },
  CL: { quote: 'Cotización',  quotePlural: 'Cotizaciones',  quoteArticle: 'la cotización',  quoteNew: 'Nueva cotización',  quoteVerb: 'cotización',  currency: 'CLP', defaultVat: 0.19, vatName: 'IVA', dateLocale: 'es-CL' },
};

const DEFAULT_LOCALE = LOCALES['ES'];

export function getLocale(country: string | null | undefined): LocaleConfig {
  return LOCALES[(country ?? '').toUpperCase()] ?? DEFAULT_LOCALE;
}

// Para el frontend — objeto seguro serializable a JSON
export function getLocaleJson(country: string | null | undefined) {
  const l = getLocale(country);
  return {
    quote:        l.quote,
    quotePlural:  l.quotePlural,
    quoteArticle: l.quoteArticle,
    quoteNew:     l.quoteNew,
    quoteVerb:    l.quoteVerb,
    currency:     l.currency,
    defaultVat:   l.defaultVat,
    vatName:      l.vatName,
    dateLocale:   l.dateLocale,
  };
}
