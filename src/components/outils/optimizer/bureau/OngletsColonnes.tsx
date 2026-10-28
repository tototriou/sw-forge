import { Bouton } from '../../../../ui';
import { type ColonneRepliable } from '../../../../lib/optimizerColonnes';

export const LARGEUR_ONGLETS = 340;

export const ONGLETS_COLONNES: { colonne: ColonneRepliable; libelle: string }[] = [
  { colonne: 'artefacts', libelle: 'Artéfacts et relique' },
  { colonne: 'complements', libelle: 'Aura, exclusion, avancés' },
];

export interface OngletsColonnesProps {
  // Les colonnes affichées (`colonnesAffichees`, src/lib/optimizerColonnes.ts).
  affichees: Record<ColonneRepliable, boolean>;
  onBasculer: (colonne: ColonneRepliable) => void;
}

// Le contrôle à onglets des deux colonnes repliables du bureau : aucune, l'une,
// l'autre, ou les deux là où elles tiennent. Ce qu'un clic ouvre ou ferme se
// décide dans `basculerColonne` ; chaque onglet est un `Bouton` à deux états
// (`aria-pressed`).
//
// ⚠️ **Immobile** : les deux libellés ne changent jamais, donc ni leur largeur
// ni leur place ; la colonne s'ouvre ailleurs, jamais à la place du contrôle.
export default function OngletsColonnes({ affichees, onBasculer }: OngletsColonnesProps) {
  return (
    <div role="group" aria-label="Colonnes repliables" style={{ width: LARGEUR_ONGLETS }} className="flex gap-2">
      {ONGLETS_COLONNES.map((o) => (
        <Bouton key={o.colonne} libelle={o.libelle} actif={affichees[o.colonne]} onClick={() => onBasculer(o.colonne)} />
      ))}
    </div>
  );
}
