import Segmented from '../../../ui/Segmented';
import { Flottant } from '../../../ui';
import MonsterGear, { type Selected } from '../../MonsterGear';
import { useCallback, useLayoutEffect, useRef, useState, type RefObject, type ReactNode } from 'react';
import { type ExclusionSource } from '../../../lib/optimizerExclusion';
import { type Monster, type GearSet } from '../../../types';
import { EMPTY_GEAR } from './constantes';

export interface ExemplaireEtFicheProps {
  zoneDRef: RefObject<HTMLDivElement>;
  sourceOptions: { label: string; disabled: boolean; key: ExclusionSource; }[];
  matchesValidatedBuild: boolean;
  unowned: boolean;
  gearSource: ExclusionSource;
  pickSource: (source: ExclusionSource) => void;
  allSourcesEmpty: boolean;
  zoneDOpen: boolean;
  zoneDList: ReactNode;
  validatedBadge: ReactNode;
  selected: { monster: Monster; gear: GearSet; } | null;
  selectionFiche: Selected;
  setSelectionFiche: (s: Selected) => void;
  relicUsageById: Record<number, number>;
  validateBuildButton: ReactNode;
}

// La fiche dépliée la plus large : panneau de statistiques (200) + écart (8) +
// artéfacts, roue et relique (356 mesurés avec une relique ATQ ou DEF à deux
// chiffres ; 352 sans relique ou en PV). ⚠️ **Le pli se décide sur cette
// largeur, jamais sur la fiche affichée** : sur la fiche affichée, changer
// d'exemplaire (une relique plus étroite) déplierait ou replierait la fiche
// sans que la place change, et ce qui la suit (« Rechercher », les
// résultats) sauterait de la hauteur d'une rangée sous le clic.
const FICHE_DEPLIEE_LA_PLUS_LARGE = 564;

type Largeurs = { place: number; deplie: number; replie: number };

export default function ExemplaireEtFiche({ zoneDRef, sourceOptions, matchesValidatedBuild, unowned, gearSource, pickSource, allSourcesEmpty, zoneDOpen, zoneDList, validatedBadge, selected, selectionFiche, setSelectionFiche, relicUsageById, validateBuildButton }: ExemplaireEtFicheProps) {
  // ⚠️ **Un seul état, garde d'égalité** (même raison que la mesure de
  // MonsterGear) : la boîte de la fiche change de largeur, la fiche se
  // remesure, et seul un état inchangé arrête la boucle. La place est celle
  // de cette section, que la largeur de la boîte ne change pas : aucune
  // oscillation possible.
  const racineRef = useRef<HTMLDivElement>(null);
  const [largeurs, setLargeurs] = useState<Largeurs | null>(null);
  const majLargeurs = useCallback((partiel: Partial<Largeurs>) => {
    setLargeurs((prev) => {
      const suivant = { place: 0, deplie: 0, replie: 0, ...prev, ...partiel };
      return prev && prev.place === suivant.place && prev.deplie === suivant.deplie && prev.replie === suivant.replie ? prev : suivant;
    });
  }, []);
  useLayoutEffect(() => {
    const racine = racineRef.current;
    if (!racine) return;
    const verifier = () => majLargeurs({ place: racine.clientWidth });
    verifier();
    const ro = new ResizeObserver(verifier);
    ro.observe(racine);
    return () => ro.disconnect();
  }, [majLargeurs]);
  // La largeur de la fiche telle qu'affichée : dépliée là où la plus large
  // tient, sa rangée la plus large sinon (la boîte plus étroite que la fiche
  // dépliée la fait passer à la ligne). Inconnue avant la première mesure :
  // `w-fit`, la largeur de la fiche dépliée.
  const largeurFiche = largeurs && largeurs.place > 0 && largeurs.deplie > 0
    ? (largeurs.place >= Math.max(FICHE_DEPLIEE_LA_PLUS_LARGE, largeurs.deplie) ? largeurs.deplie : largeurs.replie)
    : null;
  return (
    <div ref={racineRef} className="flex flex-col gap-3">
      <div ref={zoneDRef} className="relative">
        <p className="label mb-1.5">Exemplaire</p>
        {/* ⚠️ Puce individuellement grisée si l'espèce n'est PAS
            possédée dans CETTE source précise, tout le contrôle grisé
            si elle ne l'est dans AUCUNE des 4 — voir l'axe `disabled` par option, ajouté à
            Segmented.tsx pour ce cas précis. ⚠️ **`value={null}`
            quand le build VALIDÉ est ACTUELLEMENT affiché**
            (`matchesValidatedBuild`, PAS `ownValidatedBuild` seul —
            la bascule « voir le runage réellement porté »,
            `showRealGear`, peut en montrer l'équipement réel, qui
            LUI reste la source réelle d'une puce) **ou quand
            `sourceSelector` est `unowned`** (monstre non possédé,
            demande explicite) : dans les deux cas, aucune puce ne
            doit s'allumer — voir l'axe `value: T | null` ajouté à
            Segmented.tsx pour ce cas précis. */}
        <Segmented
          options={sourceOptions}
          value={matchesValidatedBuild || unowned ? null : gearSource}
          onChange={pickSource}
          disabled={allSourcesEmpty}
          size="lg"
        />
        {zoneDOpen && (
          <Flottant aria-label="Choisir l'exemplaire" rembourrage="aucun" className="max-h-[300px] overflow-y-auto">
            {zoneDList}
          </Flottant>
        )}
      </div>
      {/* La fiche sans encadré : « Exemplaire » est une section du panneau de
          la colonne de droite (docs/02-app/optimizer/ecran/README.md,
          « Panneaux et sections »). Le panneau de statistiques, cliquable,
          et l'emplacement de relique, objet du jeu, gardent leur contour.
          ⚠️ Boîte à la largeur de la fiche TELLE QU'AFFICHÉE (centrée) :
          « Valider ce build », pleine largeur, va du bord gauche du panneau
          de statistiques au bord droit de la relique, fiche dépliée ; d'un
          bord à l'autre de sa rangée la plus large, fiche repliée (décision
          de l'utilisateur), jamais au-delà. `max-w-full` laisse la fiche se
          réduire comme avant quand la place manque. */}
      <div data-fiche-optimizer className={`mx-auto max-w-full ${largeurFiche == null ? 'w-fit' : ''}`} style={largeurFiche == null ? undefined : { width: largeurFiche }}>
        {validatedBadge}
        <MonsterGear
          gear={selected?.gear ?? EMPTY_GEAR}
          selection={selectionFiche}
          onSelectionChange={setSelectionFiche}
          relicUsageById={relicUsageById}
          onLargeursNaturelles={majLargeurs}
        />
        {validateBuildButton}
      </div>
    </div>
  );
}
