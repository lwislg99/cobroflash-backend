export function normalizePhone(input?: string | null): string {
    if (!input) return '';
    let p = String(input).trim();
    p = p.replace(/[\s\-()]/g, '');
    if (p.startsWith('+')) p = p.slice(1);
    if (p.startsWith('00')) p = p.slice(2);
    if (!/^\d{8,15}$/.test(p)) return '';
    return p;
  }
  
  export type QuoteLine = { concept: string; qty: number; price: number; tax?: number };
  
  export function calcTotal(lines: QuoteLine[]): number {
    const sum = lines.reduce((acc, l) => acc + l.qty * l.price * (1 + (l.tax ?? 0)), 0);
    return Math.round(sum * 100) / 100;
  }
  
  export function makeReference() {
    const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `CF-${ymd}-${rand}`;
  }
  
  // nextInvoiceNumber() (aleatorio) eliminado en Sprint SPAIN: los números de
  // factura los asigna SIEMPRE modules/invoicing/domain/invoiceNumber.service.ts
  // (serie anual correlativa por merchant: 2026-CF-001).

  // Extrae el id numérico real de un parámetro de ruta, tolerando URLs "sucias".
  // El botón URL dinámica de WhatsApp puede dejar el placeholder sin sustituir
  // (p. ej. "{{1}}23" en vez de "23"); aquí quitamos primero cualquier "{{...}}"
  // (que contiene su propio dígito) y luego nos quedamos solo con los dígitos.
  // Devuelve NaN si no queda ningún dígito.
  export function parseNumericId(raw: unknown): number {
    const digits = String(raw ?? '')
      .replace(/\{\{.*?\}\}/g, '')  // fuera placeholders tipo {{1}}
      .replace(/\D/g, '');          // solo dígitos
    return digits ? Number(digits) : NaN;
  }

  // HTML escape
  export function esc(v?: string | number | null) {
    return String(v ?? '').replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'} as any)[s]);
  }
  