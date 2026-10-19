import GameIcon from '../../GameIcon';
import { type ReactNode } from 'react';

export interface MonstreEquipementProps {
  monstreEtListe: ReactNode;
  exemplaireEtFiche: ReactNode;
  monstreEquipementTelephone: ReactNode;
}

export default function MonstreEquipement({ monstreEtListe, exemplaireEtFiche, monstreEquipementTelephone }: MonstreEquipementProps) {
  return (
    <div className="rounded-xl border border-border bg-panel p-3 xl:col-span-2 xl:row-start-1">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-6 w-6 flex-none items-center justify-center rounded-md border border-border-soft bg-panel2">
          <GameIcon name="monster" size={15} />
        </div>
        <p className="text-[13.5px] font-bold text-ink">Monstre &amp; équipement</p>
      </div>
      {/* ⚠️ Bureau et mobile ont des dispositions RÉELLEMENT DIFFÉRENTES
          ici, une par bloc `hidden`/`lg:hidden`, pas l'une déclinée de
          l'autre (voir docs/02-app/optimizer/) : recherche +
          puces CÔTE À CÔTE avec zones C/D en encarts fixes sur bureau,
          contre 3 blocs empilés avec un dépliement propre chacun au
          doigt. La fiche (zone E) a deux `<MonsterGear>`, un par format (ici,
          et dans le bloc 3 du téléphone), branchés sur le MÊME état
          (`selectionFiche`) — son contenu ne change pas entre les deux
          formats. */}
      {/* ⚠️ Carte en PLEINE LARGEUR — nécessaire pour que la fiche
          stats/artéfacts/roue/relique, déplacée ici SOUS les puces
          (colonne de droite), tienne sur une seule ligne sans repasser à
          la ligne (gabarit réel : ~200px stats + ~60px artéfacts + ~210px
          roue + ~60px relique).
          ⚠️ **`lg:grid-cols-[1.35fr_1fr]`, PAS `lg:grid-cols-2`** (demande
          explicite) : la séparation entre « Monstre à optimiser » et
          « Exemplaire » s'aligne ainsi avec celle des deux colonnes
          PRINCIPALES de la grille (`xl:grid-cols-[1.35fr_1fr]`, voir le
          commentaire d'ouverture de la grille) — un seul ratio de
          colonnes pour tout l'écran, pas deux proportions différentes
          qui se contrediraient visuellement l'une sous l'autre. */}
      <div className="hidden lg:grid lg:grid-cols-[1.35fr_1fr] lg:items-start lg:gap-6">
        {/* Zone A (recherche — résout une ESPÈCE dans tout le bestiaire,
            possédée ou non) + liste active
            + zone C (monstres de cette liste), à GAUCHE. */}
        {monstreEtListe}

        {/* Zone B (les 4 puces — choisissent l'EXEMPLAIRE de l'espèce
            déjà choisie à gauche dans un « contenu » précis) + zone D
            (désambiguïsation
            d'exemplaire, en `Flottant` sous les puces — ex. 2 équipes de
            siège) + fiche, à DROITE. */}
        {exemplaireEtFiche}
      </div>

      {/* Mobile : 3 blocs empilés, chacun son propre
          dépliement — pas les zones fixes ci-dessus. */}
      {monstreEquipementTelephone}
    </div>
  );
}
