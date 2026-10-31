// Formats de nombres et de dates selon la langue de l'interface.
//
// ⚠️ La langue est un PARAMÈTRE, jamais lue ici : un composant la tient de
// `useLangue()`, et son rendu suit le changement de langue.

import { ETIQUETTE, Langue } from './langue';

// « 12 345 » en français, « 12,345 » en anglais.
export function formatNombre(n: number, langue: Langue, options?: Intl.NumberFormatOptions): string {
  return n.toLocaleString(ETIQUETTE[langue], options);
}

// « 9 août 2026 » en français, « August 9, 2026 » en anglais.
export function formatDate(date: Date | number, langue: Langue, options?: Intl.DateTimeFormatOptions): string {
  return new Date(date).toLocaleDateString(
    ETIQUETTE[langue],
    options ?? { day: 'numeric', month: 'long', year: 'numeric' }
  );
}

// Date et heure : « 9 août 2026, 14:05 ».
export function formatDateHeure(date: Date | number, langue: Langue, options?: Intl.DateTimeFormatOptions): string {
  return new Date(date).toLocaleString(ETIQUETTE[langue], options);
}
