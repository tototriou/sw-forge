// Les langues de l'interface, et le choix de la langue au premier lancement.
// Décision : docs/04-decisions/adr/traductions-par-dictionnaires.md.
//
// ⚠️ Pur : aucun accès au navigateur ici. Les langues préférées sont passées
// par l'appelant (`useLangue.ts`), ce qui rend la règle testable.

export const LANGUES = ['fr', 'en'] as const;
export type Langue = (typeof LANGUES)[number];

// Le RÉGLAGE : « Auto » suit le navigateur, comme le thème suit le système.
export type ChoixLangue = 'auto' | Langue;

// La langue SOURCE : celle dans laquelle les textes s'écrivent d'abord, et celle
// d'un rendu sans navigateur (rendu serveur des tests).
export const LANGUE_SOURCE: Langue = 'fr';

// La langue de repli quand aucune langue préférée n'est disponible.
export const LANGUE_DE_REPLI: Langue = 'en';

export const estUneLangue = (v: unknown): v is Langue => (LANGUES as readonly unknown[]).includes(v);

// La première langue préférée que l'app sait afficher, dans l'ordre du
// navigateur (« de-DE, fr-FR » donne le français) ; à défaut, l'anglais.
// ⚠️ Comparée par son sous-tag principal : « fr-CA », « fr-BE » et « fr » sont
// du français.
export function resoudreLangue(choix: ChoixLangue, preferees: readonly string[]): Langue {
  if (choix !== 'auto') return choix;
  for (const etiquette of preferees) {
    const principale = etiquette.toLowerCase().split('-')[0];
    if (estUneLangue(principale)) return principale;
  }
  return LANGUE_DE_REPLI;
}

// L'étiquette BCP 47 complète, pour `Intl` et `<html lang>`.
export const ETIQUETTE: Record<Langue, string> = { fr: 'fr-FR', en: 'en-US' };
