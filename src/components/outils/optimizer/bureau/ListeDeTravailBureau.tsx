import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import MonsterAvatar from '../../../MonsterAvatar';
import MonstresDeLaListe, { type MonstresDeLaListeProps } from '../MonstresDeLaListe';
import { type Monster } from '../../../../types';

// La place de la colonne des essentiels (docs/02-app/optimizer/ecran/README.md,
// « Mise en page d'ensemble ») : son panneau en prend 540, le reste va à
// l'écart avec la colonne suivante (`RETRAIT_PANNEAU`, src/lib/optimizerColonnes.ts).
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
//
// ⚠️ **La recherche s'arrête à la droite de la liste déroulante des listes**
// (décision de l'utilisateur) : la place du monstre actif a la largeur de
// l'action qui suit la liste (« Importer une équipe », `data-action-liste`),
// lue sur la page, puisque son libellé fixe sa largeur. Avant la première
// mesure (rendu serveur), la largeur mesurée au bureau.
const LARGEUR_ACTION_LISTE_DEFAUT = 161;

export default function ListeDeTravailBureau({ listes, recherche, monstreActif, liste }: ListeDeTravailBureauProps) {
  const section = useRef<HTMLElement>(null);
  const [largeurAction, setLargeurAction] = useState(LARGEUR_ACTION_LISTE_DEFAUT);
  useLayoutEffect(() => {
    const action = section.current?.querySelector<HTMLElement>('[data-action-liste]');
    if (!action || typeof ResizeObserver === 'undefined') return;
    const lire = () => setLargeurAction(action.getBoundingClientRect().width);
    lire();
    const obs = new ResizeObserver(lire);
    obs.observe(action);
    return () => obs.disconnect();
  }, []);
  return (
    <section ref={section} aria-label="Liste de travail">
      {listes}
      <div className="mt-2">
        <MonstresDeLaListe
          {...liste}
          enTete={
            <>
              <div className="min-w-0 flex-1">{recherche}</div>
              <div data-monstre-actif style={{ width: largeurAction }} className="flex h-8 flex-none items-center gap-2">
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
