import { useSyncExternalStore } from 'react';
import { ChoixLangue, ETIQUETTE, LANGUE_SOURCE, Langue, estUneLangue, resoudreLangue } from '../i18n/langue';
import { DICTIONNAIRES, type Dictionnaire } from '../i18n';

// Langue de l'interface : le réglage « Langue » des Paramètres.
// Voir docs/02-app/transverse/feat-langues.md.
//
// ⚠️ TROIS états, comme le thème : « Auto » suit le navigateur et doit rester
// un choix explicite. Un binaire français/anglais figerait la langue de
// quelqu'un qui n'a rien choisi.

// **Persisté** même si la conservation est refusée : c'est un RÉGLAGE, pas une
// donnée de l'utilisateur (docs/02-app/transverse/feat-import-compte/persistance.md).
export const CLE_LANGUE = 'swblacksmith-langue-v1';

function charger(): ChoixLangue {
  try {
    const v = localStorage.getItem(CLE_LANGUE);
    return estUneLangue(v) ? v : 'auto';
  } catch {
    return 'auto';
  }
}

// Les langues préférées du navigateur. ⚠️ Sans `document` (rendu serveur des
// tests, Worker), aucune : Node expose un `navigator` dont la langue est celle
// de la machine, qui rendrait les tests différents d'un poste à l'autre.
function languesDuNavigateur(): readonly string[] {
  if (typeof document === 'undefined' || typeof navigator === 'undefined') return [];
  return navigator.languages?.length ? navigator.languages : [navigator.language];
}

let choix: ChoixLangue = charger();
let langue: Langue = resoudreLangue(choix, languesDuNavigateur());
const abonnes = new Set<() => void>();

// `<html lang>` : lecteurs d'écran, césure, correcteur du navigateur.
function appliquer() {
  if (typeof document !== 'undefined') document.documentElement.lang = ETIQUETTE[langue].split('-')[0];
}
appliquer();

function recalculer() {
  const avant = langue;
  langue = resoudreLangue(choix, languesDuNavigateur());
  appliquer();
  if (langue !== avant) for (const a of abonnes) a();
}

export function setChoixLangue(nouveau: ChoixLangue) {
  if (nouveau === choix) return;
  choix = nouveau;
  try {
    localStorage.setItem(CLE_LANGUE, nouveau);
  } catch {
    /* stockage indisponible : la langue vaut pour la session */
  }
  recalculer();
  // Le réglage lui-même a changé, même si la langue résolue est la même
  // (« Auto » → « Français » sur un navigateur en français).
  for (const a of abonnes) a();
}

function abonner(a: () => void) {
  abonnes.add(a);
  return () => abonnes.delete(a);
}

// ⚠️ En « Auto », un changement de langue du navigateur se voit SANS
// rechargement, comme un basculement de thème du système.
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('languagechange', () => {
    if (choix === 'auto') recalculer();
  });
}

// Le rendu serveur (les tests) n'a pas de navigateur : « Auto » y donne la
// langue SOURCE, un choix explicite reste ce choix.
const langueServeur = (): Langue => (choix === 'auto' ? LANGUE_SOURCE : choix);

export function useChoixLangue(): ChoixLangue {
  return useSyncExternalStore(abonner, () => choix, () => choix);
}

// La langue RÉELLEMENT affichée, « Auto » résolu.
export function useLangue(): Langue {
  return useSyncExternalStore(abonner, () => langue, langueServeur);
}

// Les textes de l'interface dans la langue affichée.
export function useTraduction(): Dictionnaire {
  return DICTIONNAIRES[useLangue()];
}
