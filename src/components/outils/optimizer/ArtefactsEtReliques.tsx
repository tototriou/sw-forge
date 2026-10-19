import GameIcon from '../../GameIcon';
import HelpPopover from '../../HelpPopover';
import { Interrupteur, Selecteur } from '../../../ui';
import { ARTIFACT_KINDS, type ArtifactKind } from '../../../types';
import { LARGEUR_LIBELLE_LISTE, LARGEUR_SELECTEUR_LISTE } from './constantes';
import { ArtifactMainChoice, type RelicUniqueChoice } from '../../../hooks/useOptimizerState';
import { ARTIFACT_MAIN_OPTIONS } from '../../../lib/runeBuildOptim';
import ArtifactLinesEditor from '../ArtifactLinesEditor';
import Relique from './Relique';
import { type Dispatch, type SetStateAction, type ReactNode } from 'react';
import { type LigneVerrouillee } from '../../../lib/artifactOptim';

export interface ArtefactsEtReliquesProps {
  optimiserArtefacts: boolean;
  setOptimiserArtefacts: Dispatch<SetStateAction<boolean>>;
  artifactMainByKind: Partial<Record<ArtifactKind, ArtifactMainChoice>>;
  setArtifactMainByKind: Dispatch<SetStateAction<Partial<Record<ArtifactKind, ArtifactMainChoice>>>>;
  lignesVerrouillees: LigneVerrouillee[];
  setLignesVerrouillees: Dispatch<SetStateAction<LigneVerrouillee[]>>;
  diagnosticVerrous: { code: number; min: number; auMieux: number; atteint: boolean; }[] | null;
  sortesFigees: ArtifactKind[];
  blocArtefactsSeuls: ReactNode;
  relicMainChoice: ArtifactMainChoice;
  setRelicMainChoice: Dispatch<SetStateAction<ArtifactMainChoice>>;
  relicUniqueChoice: RelicUniqueChoice;
  setRelicUniqueChoice: Dispatch<SetStateAction<RelicUniqueChoice>>;
  relicMinUpgrade: number;
  setRelicMinUpgrade: Dispatch<SetStateAction<number>>;
}

export default function ArtefactsEtReliques({ optimiserArtefacts, setOptimiserArtefacts, artifactMainByKind, setArtifactMainByKind, lignesVerrouillees, setLignesVerrouillees, diagnosticVerrous, sortesFigees, blocArtefactsSeuls, relicMainChoice, setRelicMainChoice, relicUniqueChoice, setRelicUniqueChoice, relicMinUpgrade, setRelicMinUpgrade }: ArtefactsEtReliquesProps) {
  return (
    <div className="rounded-xl border border-border bg-panel p-3 xl:col-start-2 xl:row-start-2">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {/* Même gabarit d'en-tête que les autres cartes (icône encadrée 6×6
            + titre 13,5 px) : `GameIcon name="artifact"` existait déjà et
            n'était pas utilisé ici — pas une icône de plus à inventer. */}
        <div className="flex h-6 w-6 flex-none items-center justify-center rounded-md border border-border-soft bg-panel2">
          <GameIcon name="artifact" size={15} />
        </div>
        {/* ⚠️ Titre étendu à la relique (voir le bloc « Relique »
            ci-dessous) : le titre suit l'interrupteur, qui porte déjà les
            deux mots — à confirmer par l'utilisateur au premier rendu. */}
        <p className="text-[13.5px] font-bold text-ink">Artéfacts et reliques</p>
        <HelpPopover title="Artéfacts et reliques">
          <b className="text-ink">« Libre »</b> cherche parmi tous tes artéfacts équipables ; une{' '}
          <b className="text-ink">principale</b> restreint la recherche à ceux qui la portent.{' '}
          <b className="text-ink">« Comme équipé »</b> conserve la pièce entière portée sur le
          build affiché ci-dessus, sans rien chercher.
          <br />
          <br />
          La paire retenue suit le <b className="text-ink">tri</b> affiché — trier par PV effectifs ne choisit
          pas les mêmes artéfacts que trier par dégâts.
        </HelpPopover>
        {/* `ml-auto` plutôt qu'un `justify-between` sur la rangée : le titre
            et son aide restent collés, l'interrupteur part à droite — même
            lecture qu'avant, dans le gabarit d'en-tête de carte. */}
        <div className="ml-auto flex items-center gap-1.5">
          <span className="text-xs font-semibold text-ink-dim">Activer l&apos;optimisation d&apos;artéfacts et reliques</span>
          <HelpPopover title="Activer l&apos;optimisation d&apos;artéfacts et reliques">
            Activé (défaut), chaque build reçoit la meilleure paire d&apos;artéfacts ET la meilleure relique
            parmi les tiennes, selon les réglages ci-dessous.
            <br />
            <br />
            Désactivé, le monstre <b className="text-ink">garde les artéfacts et la relique qu&apos;il porte</b>,
            statistiques comprises — on cesse simplement d&apos;en chercher d&apos;autres. Utile pour composer un
            runage autour des pièces déjà en place.
          </HelpPopover>
          <Interrupteur
            actif={optimiserArtefacts}
            onChange={setOptimiserArtefacts}
            aria-label="Activer l'optimisation d'artéfacts et reliques"
          />
        </div>
      </div>
      {/* Rangée Attribut/Type — la relique a rejoint le bas de la carte
          (le bloc Relique
          FERME la carte, plus de variante `xl:border-l`, voir plus bas). */}
      {optimiserArtefacts && (
        <div className="flex flex-wrap gap-3">
          {ARTIFACT_KINDS.map(({ key, label }) => (
            <div key={key} className="flex items-center gap-1.5">
              <span className={`text-xs text-ink ${LARGEUR_LIBELLE_LISTE}`}>{label}</span>
              {/* ⚠️ **`'libre'`, parce que c'est ce que le MOTEUR fait**
                  d'une clé absente (`candidatsParSorte`, artifactOptim.ts).
                  Ce sélecteur affichait le choix de garder la pièce portée tant
                  qu'aucun choix n'avait été fait, pendant que la recherche
                  cherchait librement : l'écran annonçait le contraire de ce
                  qui se passait, et tout ce qui se fiait à cet affichage
                  (les emplacements « figés », donc l'éditeur de verrous)
                  raisonnait sur un état faux. Le défaut se lit désormais au
                  même endroit pour tout le monde. */}
              <Selecteur
                value={String(artifactMainByKind[key] ?? 'libre')}
                onChange={(e) => {
                  const raw = e.target.value;
                  const next: ArtifactMainChoice =
                    raw === 'equipped' || raw === 'libre' ? raw : (Number(raw) as 100 | 101 | 102);
                  setArtifactMainByKind((prev) => ({ ...prev, [key]: next }));
                }}
                taille="sm"
                surface="panel2"
                pleineLargeur={false}
                className={LARGEUR_SELECTEUR_LISTE}
              >
                {/* ⚠️ « Comme équipé » (décision de l'utilisateur, qui l'a
                    préféré à « Garder l'artéfact équipé », trop long pour une
                    liste étroite) : ce choix conserve la PIÈCE entière — le
                    pool tombe à un seul candidat, l'exemplaire porté avec ses
                    quatre sous-propriétés (voir `candidatsParSorte`,
                    artifactOptim.ts). Posé au milieu de trois statistiques
                    principales, il peut se lire « la principale, comme
                    équipé » : les entrées qui filtrent par principale disent
                    « Principale … », et l'aide de la carte dit qu'il garde la
                    pièce entière. */}
                <option value="equipped">Comme équipé</option>
                {/* ⚠️ « Libre » n’a de sens qu’avec une recherche d’artéfacts : il n’a
                    été ajouté qu’une fois celle-ci construite, pour ne pas laisser
                    une option morte dans le sélecteur. */}
                <option value="libre">Libre</option>
                {ARTIFACT_MAIN_OPTIONS.map((o) => (
                  <option key={o.code} value={o.code}>
                    {o.label}
                  </option>
                ))}
                {/* ⚠️ Pas de « Aucun ». Retiré : vider UN emplacement pendant
                    que l'autre cherche ne correspond à rien en jeu, et « ne
                    pas compter les artéfacts » se dit d'un seul geste avec
                    l'interrupteur ci-dessus, pour les deux à la fois.
                    L'emplacement peut toujours RESTER vide si la recherche
                    n'a rien de mieux à y mettre — c'est l'imposer par sorte
                    qui n'avait pas de sens. */}
              </Selecteur>
            </div>
          ))}
        </div>
      )}
      {/* Sous les sélecteurs, et jamais au-dessus : les lignes
          verrouillées se lisent comme un raffinement du choix de pièce, pas
          comme une condition indépendante. Masqué avec le reste quand les
          artéfacts sont ignorés — un verrou n'aurait alors aucun effet, et
          une saisie sans effet est pire qu'une saisie absente. */}
      {optimiserArtefacts && (
        <div className="mt-3">
          <ArtifactLinesEditor
            lignes={lignesVerrouillees}
            onChange={setLignesVerrouillees}
            diagnostic={diagnosticVerrous}
            figees={sortesFigees}
          />
        </div>
      )}
      {/* ⚠️ **Le résultat rejoint ses commandes.** « Meilleurs artéfacts pour
          ce build » vivait sous la fiche d'équipement, avec une raison qui
          TIENT TOUJOURS : la fiche montre l'équipement RÉEL, on n'y
          substitue pas une proposition. Elle est satisfaite autrement — la
          fiche dit ce qu'on PORTE, cette carte voisine ce qu'on DEVRAIT
          porter, et elles restent côte à côte sous « Exemplaire ». Laisser
          les réglages ici et le résultat là-bas aurait séparé la cause de
          son effet.
          ⚠️ Rendu UNE seule fois désormais : il était interpolé deux fois
          (branche bureau et branche téléphone de « Monstre & équipement »),
          alors qu'un grep de son libellé n'en montrait qu'une — cette carte
          n'a pas de jumelle masquée. */}
      {blocArtefactsSeuls}
      {/* ⚠️ **Relique — ferme la carte, PAS une carte propre** (les variantes à droite de la rangée Attribut/Type, ou
          en carte à part, sont écartées). Trait horizontal sous « Meilleurs artéfacts », un seul
          contour, puis le sous-titre et sa rangée — même JSX pour les deux
          formats, ordinateur et téléphone : la rangée se replie seule via
          `flex-wrap` comme la rangée Attribut/Type juste au-dessus. Même
          interrupteur que les listes d'artéfacts : masqué
          avec elles plutôt que grisé à part — pas de carte séparée à
          expliquer, donc pas de texte « Coupée avec… ». */}
      {optimiserArtefacts && (
        <Relique
          relicMainChoice={relicMainChoice}
          setRelicMainChoice={setRelicMainChoice}
          relicUniqueChoice={relicUniqueChoice}
          setRelicUniqueChoice={setRelicUniqueChoice}
          relicMinUpgrade={relicMinUpgrade}
          setRelicMinUpgrade={setRelicMinUpgrade}
        />
      )}
    </div>
  );
}
