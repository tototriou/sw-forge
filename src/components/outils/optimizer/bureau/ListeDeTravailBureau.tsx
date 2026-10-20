import { type ReactNode } from 'react';
import MonsterAvatar from '../../../MonsterAvatar';
import MonstresDeLaListe, { type MonstresDeLaListeProps } from '../MonstresDeLaListe';
import { type Monster } from '../../../../types';

// Largeur de la colonne des essentiels (docs/02-app/optimizer/ecran/README.md,
// « Mise en page d'ensemble »), commune à la liste et au set de runes.
export const LARGEUR_ESSENTIELS = 548;

export interface ListeDeTravailBureauProps {
  // « Liste active » ▾ · « Importer une équipe » : `SelecteurListes` et
  // `OptimizerImportButton`, tels quels.
  listes: ReactNode;
  // « Rechercher un monstre… » : `MonsterSourcePicker` en mode bestiaire, tel quel.
  recherche: ReactNode;
  monstreActif: Monster | null;
  liste: MonstresDeLaListeProps;
}

// La liste de travail des essentiels, au bureau : « Ajouter un monstre à la
// liste », la recherche du monstre et le monstre actif sur la rangée du titre
// de la carte de la liste ; les membres prennent leur hauteur jusqu'à 308 px,
// puis défilent. Le téléphone garde « Monstre & équipement ».
//
// ⚠️ **Le monstre actif tient sa place, vide ou non** : choisir un monstre ne
// déplace ni le champ ni la liste (un clic ne déplace jamais ce qu'on vient de
// cliquer).
export default function ListeDeTravailBureau({ listes, recherche, monstreActif, liste }: ListeDeTravailBureauProps) {
  return (
    <section aria-label="Liste de travail" style={{ width: LARGEUR_ESSENTIELS }}>
      {listes}
      <div className="mt-2">
        <MonstresDeLaListe
          {...liste}
          enTete={
            <>
              <div className="min-w-0 flex-1">{recherche}</div>
              <div data-monstre-actif className="flex h-8 w-[132px] flex-none items-center gap-2">
                {monstreActif && (
                  <>
                    <MonsterAvatar monster={monstreActif} size={28} />
                    <span className="min-w-0 line-clamp-1 text-[13px] font-semibold" title={monstreActif.name}>
                      {monstreActif.name}
                    </span>
                  </>
                )}
              </div>
            </>
          }
        />
      </div>
    </section>
  );
}
