// Migration des clés `localStorage` vers le nom SW Blacksmith — décision 66 du
// rebranding (spec/chantiers/rebranding-blacksmith.md).
//
// Les clés s'appelaient `sw-forge-…` (et `sky-arena-…` pour la toute première
// prépa RTA) ; elles s'appellent maintenant `swblacksmith-…`. Au premier
// lancement après la mise à jour, l'ancien contenu est recopié sous le nouveau
// nom, puis l'ancien est effacé.
//
// ⚠️ **Exécutée AVANT tout autre module de l'app** : c'est le premier import de
// `main.tsx`. Plusieurs modules lisent le stockage dès leur chargement
// (`usePersistence` décide à l'import si la conservation est active) — passer
// après eux, ce serait les laisser lire un stockage vide et conclure que
// l'utilisateur n'a jamais rien enregistré.
//
// ⚠️ **Jamais de perte, même en cas d'échec** : l'ancienne clé n'est effacée
// qu'une fois la nouvelle RELUE à l'identique. Si l'écriture échoue (quota), on
// libère d'abord l'ancienne puis on réessaie ; si cela échoue encore, l'ancienne
// est remise en place — elle sera reprise au lancement suivant.

export const PREFIXE_STOCKAGE = 'swblacksmith-';

// Les anciens préfixes, et ce qu'ils deviennent. `sky-arena-rta-v1` (la prépa)
// devient `swblacksmith-rta-v1` : aucune clé `sw-forge-rta-v1` n'a jamais
// existé, il n'y a donc pas de collision.
const ANCIENS_PREFIXES = ['sw-forge-', 'sky-arena-'];

// Le nouveau nom d'une ancienne clé, ou `null` si ce n'en est pas une.
export function nouvelleCle(cle: string): string | null {
  const ancien = ANCIENS_PREFIXES.find((p) => cle.startsWith(p));
  return ancien ? PREFIXE_STOCKAGE + cle.slice(ancien.length) : null;
}

export interface EtapeMigration {
  de: string;
  vers: string;
  // `copier` : la nouvelle clé n'existe pas encore. `effacer` : elle existe
  // déjà (migration faite, ou l'app a écrit depuis) — c'est ELLE qui fait foi,
  // l'ancienne n'est plus qu'un doublon périmé.
  action: 'copier' | 'effacer';
}

// Règle de migration, **pure** pour être vérifiable telle quelle.
export function planMigration(cles: string[]): EtapeMigration[] {
  const presentes = new Set(cles);
  const prises = new Set<string>();
  const plan: EtapeMigration[] = [];
  for (const de of [...cles].sort()) {
    const vers = nouvelleCle(de);
    if (!vers) continue;
    const dejaLa = presentes.has(vers) || prises.has(vers);
    plan.push({ de, vers, action: dejaLa ? 'effacer' : 'copier' });
    prises.add(vers);
  }
  return plan;
}

// Le sous-ensemble de `Storage` dont on a besoin — un faux stockage de test
// le fournit sans navigateur.
type Stockage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>;

function ecrireEtRelire(s: Stockage, cle: string, valeur: string): boolean {
  try {
    s.setItem(cle, valeur);
    return s.getItem(cle) === valeur;
  } catch {
    return false;
  }
}

// Applique le plan. Renvoie les clés migrées et celles laissées en place
// (échec d'écriture) — jamais une exception : un stockage indisponible ne doit
// pas empêcher l'app de démarrer.
export function migrerStockage(s: Stockage): { migrees: string[]; laissees: string[] } {
  const migrees: string[] = [];
  const laissees: string[] = [];
  let cles: string[];
  try {
    cles = Array.from({ length: s.length }, (_, i) => s.key(i)).filter((k): k is string => k !== null);
  } catch {
    return { migrees, laissees };
  }
  for (const { de, vers, action } of planMigration(cles)) {
    try {
      const valeur = s.getItem(de);
      if (valeur === null) continue;
      if (action === 'effacer') {
        s.removeItem(de);
        migrees.push(de);
        continue;
      }
      if (ecrireEtRelire(s, vers, valeur)) {
        s.removeItem(de);
        migrees.push(de);
        continue;
      }
      // Quota : on libère l'ancienne place, puis on réessaie. En cas de nouvel
      // échec, l'ancienne est remise — la place vient d'être libérée, elle tient.
      s.removeItem(de);
      if (ecrireEtRelire(s, vers, valeur)) {
        migrees.push(de);
      } else {
        try {
          s.removeItem(vers);
        } catch {
          /* rien à défaire */
        }
        s.setItem(de, valeur);
        laissees.push(de);
      }
    } catch {
      laissees.push(de);
    }
  }
  return { migrees, laissees };
}

// Au chargement du module — d'où sa place en tête de `main.tsx`.
try {
  if (typeof localStorage !== 'undefined') migrerStockage(localStorage);
} catch {
  /* stockage inaccessible (navigation privée, réglages) : rien à migrer */
}
