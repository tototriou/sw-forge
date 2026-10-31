import { Combine, CopyPlus } from 'lucide-react';
import { Modale, Option } from '../../ui';
import type { Reco, RecoPayload } from '../../types';
import { apercuFusion, type BilanFusion } from '../../lib/recoFusion';

// Choix posé à l'import quand le fichier complète une recommandation qu'on a
// déjà : la fusionner, ou l'ajouter à part comme avant. Spec :
// docs/02-app/siege/feat-recommandations/persistance-et-partage.md § Fusion.
//
// ⚠️ **Aucune des deux réponses ne perd rien** : ajouter à part ne touche à
// rien, fusionner n'ajoute que ce qui manque (decks nouveaux, défenses
// nouvelles) sans rien retirer ni réécrire. « Fusionner » vient en premier et
// reçoit le focus : c'est la raison de la question — un fichier republié de
// semaine en semaine accumulerait sinon les doublons.
//
// AVEC la croix et sans « Annuler » : un dialogue de CHOIX dont les options sont
// les actions (docs/03-developpeur/interface/librairie-ui/modales-et-panneaux.md),
// comme ChoixExportSiege. La croix ferme sans rien importer.

type Paire = { entrante: RecoPayload; existante: Reco };

// Espaces insécables : un guillemet ne se retrouve jamais seul en bout de ligne.
// Écrites par leur code : un caractère invisible dans le source se confond avec
// une espace ordinaire (et ESLint le refuse).
const INSECABLE = String.fromCharCode(0xa0);
const nom = (r: { name: string }) => `«${INSECABLE}${r.name || 'Recommandation'}${INSECABLE}»`;

export function titreChoixFusion(paires: Paire[]): string {
  return paires.length === 1
    ? 'Ce fichier complète une de tes recommandations'
    : 'Ce fichier complète tes recommandations';
}

// Le sous-titre et les options, rendus à part de la coquille : la `Modale` se
// monte dans `<body>` et ne rend rien côté serveur, ses tests de rendu passent
// par ces deux-là.
export function SousTitreFusion({ paires }: { paires: Paire[] }) {
  return (
    <>
      {paires.map(({ entrante, existante }, i) => (
        <span key={i} className="block">
          {nom(entrante)} prolonge ta recommandation <b className="text-ink">{nom(existante)}</b>.
        </span>
      ))}
      {/* Dire ce qui n'est PAS touché : sans cette ligne, on ferme par
          précaution un choix qu'on voulait faire. (Pas en `noteFinale` : elle
          se pose sous des boutons d'action, que ce dialogue n'a pas.) */}
      <span className="mt-1.5 block">Dans les deux cas, rien de ce que tu as n'est retiré ni réécrit.</span>
    </>
  );
}

export function OptionsFusion({
  une,
  apercu,
  onChoisir,
}: {
  une: boolean;
  apercu: BilanFusion;
  onChoisir: (fusionner: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Option
        onClick={() => onChoisir(true)}
        // Repère du banc d'affichage : le nom accessible d'une Option porte
        // toute sa description, chiffres compris.
        data-choix-fusion="fusionner"
        autoFocus
        icone={<Combine size={16} />}
        titre={une ? 'Fusionner dans la recommandation existante' : 'Fusionner dans les recommandations existantes'}
        description={`${apercuFusion(apercu)} Tes builds, tes consignes et tes retouches restent tels quels.`}
      />
      <Option
        onClick={() => onChoisir(false)}
        data-choix-fusion="a-part"
        icone={<CopyPlus size={16} />}
        titre="Ajouter à part"
        description={
          une
            ? 'Le fichier devient une recommandation de plus, à côté de la tienne.'
            : 'Chaque recommandation du fichier vient en plus, à côté des tiennes.'
        }
      />
    </div>
  );
}

export default function ChoixFusionRecos({
  paires,
  apercu,
  onChoisir,
  onAnnuler,
}: {
  // Chaque recommandation du fichier qui en complète une existante.
  paires: Paire[];
  // Ce que ferait la fusion (calculé d'avance, rien n'est encore écrit).
  apercu: BilanFusion;
  onChoisir: (fusionner: boolean) => void;
  onAnnuler: () => void;
}) {
  return (
    <Modale
      onClose={onAnnuler}
      labelledBy="fusion-recos-titre"
      largeur="max-w-[480px]"
      croix
      titre={titreChoixFusion(paires)}
      sousTitre={<SousTitreFusion paires={paires} />}
    >
      <OptionsFusion une={paires.length === 1} apercu={apercu} onChoisir={onChoisir} />
    </Modale>
  );
}
