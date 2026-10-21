import { useContext, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { SetDeplieContext } from './setDeplie';
import SetComboPicker from '../../SetComboPicker';
import RuneIcon from '../../../RuneIcon';
import { SelecteurMultiple } from '../../../../ui';
import { RUNE_SETS } from '../../../../types';
import { runeSetIconFilter, setsCost } from '../../../../lib/effects';

export interface SetDeRunesCompactProps {
  setPickerSectionRef: RefObject<HTMLDivElement>;
  setPickerInvalid: boolean;
  comboSets: string[];
  onChangeSets: (next: string[]) => void;
}

// Le set de runes recherché, au bureau, en forme compacte, sans le titre
// « Critères de recherche » du téléphone (le panneau de la colonne situe la
// section), section des essentiels sans cadre (le panneau de la colonne le
// porte) : une liste fermée sur les sets choisis ; ouverte, la grille d'ajout
// du téléphone (`SetComboPicker`, telle quelle : jetons, retrait, deux
// groupes, « Plus de place »), en flottant — rien ne bouge dessous.
//
// ⚠️ **Une liste, pas deux** (principal · secondaire) : le choix est un
// multiensemble (deux fois le même set), que la grille sait dire et une case
// par set non. `SelecteurMultiple` en prend la surface (axe `surface`).
//
// ⚠️ **Le message « Sélectionne au moins un set… » se met à droite du titre**,
// sur sa ligne : pas de ligne réservée sous la liste (décision de
// l'utilisateur), et rien ne bouge quand il paraît. Le compte « n/6 runes »
// n'y figure que déplié ; replié, la liste fermée suffit et la grille ouverte
// porte son propre compte.
//
// ⚠️ **La rangée des jetons est réservée** (`reserverJetons`) : vide, elle a
// déjà la hauteur d'un jeton, et le premier set choisi ne fait plus descendre
// la grille sous le pointeur.
//
// ⚠️ **Déplié ou compact, selon la place** : la page (`SetDeplieContext`) dit
// `deplie` quand la première colonne tient sans défiler une fois la grille
// du téléphone dépliée à la place de la liste. Elle décide sur la hauteur
// disponible, jamais sur un clic ni sur ce qui est choisi : la forme ne change
// donc pas sous le pointeur. Le set mesure ici, sur deux copies invisibles
// (liste fermée, grille vide), ce que le dépli ajoute (`reporterEcart`) —
// indépendant des sets choisis, donc sans oscillation.
//
// ⚠️ **La liste reste ouverte pendant la composition** (après un set de 4, il
// reste un set de 2 à choisir) : elle ne se ferme d'elle-même qu'au choix qui
// remplit les six emplacements, sinon au clic ailleurs ou à Échap.
export default function SetDeRunesCompact({ setPickerSectionRef, setPickerInvalid, comboSets, onChangeSets }: SetDeRunesCompactProps) {
  const [ouvert, setOuvert] = useState(false);
  const page = useContext(SetDeplieContext);
  const copieGrille = useRef<HTMLDivElement>(null);
  const copieListe = useRef<HTMLDivElement>(null);
  const reporterEcart = page?.reporterEcart;
  useLayoutEffect(() => {
    const grille = copieGrille.current, liste = copieListe.current;
    if (!reporterEcart || !grille || !liste || typeof ResizeObserver === 'undefined') return;
    const mesurer = () => reporterEcart(grille.getBoundingClientRect().height - liste.getBoundingClientRect().height);
    mesurer();
    const obs = new ResizeObserver(mesurer);
    obs.observe(grille);
    obs.observe(liste);
    return () => obs.disconnect();
  }, [reporterEcart]);
  const deplie = page?.deplie === true;
  const noms = comboSets.map((key) => RUNE_SETS.find((s) => s.key === key)?.label ?? key);
  const changer = (next: string[]) => {
    onChangeSets(next);
    if (setsCost(next) >= 6 && setsCost(next) > setsCost(comboSets)) setOuvert(false);
  };
  return (
    <section aria-label="Critères de recherche">
      <div
        ref={setPickerSectionRef}
        className={setPickerInvalid ? 'rounded-lg border border-bad bg-bad/15 p-2 -m-2 transition' : 'transition'}
      >
        <div className="mb-1.5 flex items-baseline justify-between gap-2">
          <p className="label flex-none">Set de runes recherché</p>
          {setPickerInvalid ? (
            <span className="min-w-0 text-right text-micro font-semibold text-bad">Sélectionne au moins un set avant de lancer la recherche.</span>
          ) : deplie ? (
            <span className="text-micro tabular-nums text-ink-dim">{setsCost(comboSets)}/6 runes</span>
          ) : null}
        </div>
        {deplie ? (
          <div className="max-w-md"><SetComboPicker sets={comboSets} onChange={onChangeSets} reserverJetons /></div>
        ) : (
        <SelecteurMultiple
          libelle="Set de runes recherché"
          vide="Aucun"
          resume={
            comboSets.length > 0
              ? {
                  texte: noms.join(', '),
                  visuel: comboSets.map((key, i) => (
                    <span key={`${key}-${i}`} className="flex flex-none items-center gap-1 text-ink">
                      <RuneIcon setKey={key} size={18} filter={runeSetIconFilter(false)} />
                      <span className="truncate">{noms[i]}</span>
                    </span>
                  )),
                }
              : undefined
          }
          ouvert={ouvert}
          onOuvertChange={setOuvert}
          surface={<SetComboPicker sets={comboSets} onChange={changer} reserverJetons />}
        />
        )}
      </div>
      {/* Les deux copies invisibles de la mesure : hauteur nulle, hors de
          l'arbre d'accessibilité, sans focus ni clic (`invisible`). Leur
          largeur est celle de la vraie, la section. */}
      {page && (
        <div aria-hidden className="pointer-events-none h-0 overflow-hidden">
          <div className="invisible">
            <div ref={copieGrille} className="max-w-md"><SetComboPicker sets={[]} onChange={() => {}} reserverJetons /></div>
            <div ref={copieListe}>
              <SelecteurMultiple libelle="Set de runes recherché" vide="Aucun" surface={null} />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
