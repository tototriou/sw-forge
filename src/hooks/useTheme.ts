import { useSyncExternalStore } from 'react';

// Thème de l'application : **Forge** (sombre) ou **Atelier** (clair).
// Voir spec/shared/design.md.
//
// ⚠️ TROIS états, pas un interrupteur. Un binaire clair/sombre force à choisir
// une valeur qui cesse alors de suivre le système : quelqu'un dont le téléphone
// bascule en sombre le soir perdrait ce comportement sans l'avoir demandé.
export type ThemeChoice = 'auto' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_CHOICES: { key: ThemeChoice; label: string; hint: string }[] = [
  { key: 'auto', label: 'Auto', hint: 'Suit le thème de ton navigateur' },
  { key: 'light', label: 'Clair', hint: 'Atelier — fond clair, encre froide' },
  { key: 'dark', label: 'Sombre', hint: 'Forge — fond profond, accent cuivre' },
];

// **Persisté** dans `localStorage`, même si la conservation est refusée : c'est
// un RÉGLAGE, pas une donnée de l'utilisateur — au même titre que la mesure de
// score ou le choix de conservation lui-même. Un thème oublié à chaque visite
// serait un bug, pas une protection. Voir spec/README.md § Persistance.
const STORAGE_KEY = 'sw-forge-theme-v1';

function load(): ThemeChoice {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'light' || v === 'dark' ? v : 'auto';
  } catch {
    return 'auto';
  }
}

let current: ThemeChoice = load();
const listeners = new Set<() => void>();

// Media query gardée en module : elle sert à résoudre `auto` ET à réagir quand
// le système bascule pendant que la page est ouverte.
const mql = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null;

export function resolveTheme(choice: ThemeChoice = current): ResolvedTheme {
  if (choice !== 'auto') return choice;
  return mql?.matches ? 'dark' : 'light';
}

// Pose l'attribut lu par index.css. ⚠️ En `auto` on RETIRE l'attribut plutôt que
// d'écrire la valeur résolue : c'est la media query qui décide, et l'absence
// d'attribut est justement ce que `:root:not([data-theme='light'])` attend.
function apply(choice: ThemeChoice) {
  const root = document.documentElement;
  if (choice === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', choice);
}

export function setTheme(choice: ThemeChoice) {
  if (choice === current) return;
  current = choice;
  try {
    localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    /* stockage indisponible : le thème vaut pour la session */
  }
  apply(choice);
  for (const l of listeners) l();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useTheme(): ThemeChoice {
  return useSyncExternalStore(subscribe, () => current, () => current);
}

// Le thème RÉELLEMENT appliqué, `auto` résolu. Utile aux rares endroits qui
// doivent adapter autre chose qu'une couleur (une image, un mode de rendu).
export function useResolvedTheme(): ResolvedTheme {
  return useSyncExternalStore(
    (l) => {
      const un = subscribe(l);
      mql?.addEventListener('change', l);
      return () => {
        un();
        mql?.removeEventListener('change', l);
      };
    },
    () => resolveTheme(),
    () => 'light' as ResolvedTheme
  );
}

// ⚠️ En mode `auto`, un basculement système doit se voir SANS rechargement.
// Sans ce réveil, quelqu'un dont l'OS passe en sombre le soir garderait Atelier
// jusqu'au prochain F5.
if (mql) {
  mql.addEventListener('change', () => {
    if (current === 'auto') for (const l of listeners) l();
  });
}
