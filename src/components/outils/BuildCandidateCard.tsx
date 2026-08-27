import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { ArtifactDetail, RuneDetail, RUNE_SETS } from '../../types';
import { BuildCandidate, candidateMetricTotal } from '../../lib/runeBuildOptim';
import { activeSets } from '../../lib/effects';
import { RuneMetric, formatRuneMetric } from '../../hooks/useRuneMetric';
import { ArtifactDetailBox, RuneDetailBox } from '../PieceDetail';
import RuneWheel from '../RuneWheel';
import ArtifactSlots from '../ArtifactSlots';
import StatPanel from '../StatPanel';
import { COMPACT, useMediaQuery } from '../../hooks/useMediaQuery';
import { Bouton, FlottantAuto } from '../../ui';

interface Props {
  rank: number;
  candidate: BuildCandidate;
  runeById: Map<number, RuneDetail>;
  // Artéfacts ACTUELLEMENT équipés sur le monstre optimisé — fixes, jamais
  // modifiés par la recherche (voir spec/outils/optimizer/ « Algorithme »).
  // Identiques d'une carte de résultat à l'autre : affichés pour la même
  // raison que « Équipement actuel » les affiche déjà, pas parce qu'ils
  // varient selon le candidat.
  artifacts: ArtifactDetail[];
  metric: RuneMetric;
  // Identité de la rune actuellement ouverte, PARTAGÉE entre tous les
  // résultats affichés (pas locale à cette carte) — voir
  // OptimizerSection.tsx / useOptimizerState.ts. Permet qu'un clic sur une
  // autre rune, même dans une autre carte, ferme le popover déjà ouvert.
  openRuneKey: string | null;
  onToggleRune: (key: string) => void;
  // Dégâts du sort visé pour CE candidat, quand l'objectif « Dégâts réels »
  // est actif — `undefined` sinon. ⚠️ Calculé par le PARENT (qui détient le
  // sort résolu et l'adversaire) plutôt que reconstruit ici : cette carte
  // n'a aucune raison de connaître le modèle de dégâts, et le parent trie
  // déjà sur exactement la même valeur.
  degatsReels?: { total: number; partPvCible: number };
  // Bouton « Valider » (Lot 2 — réservation des 6 runes de CE build, voir
  // spec/outils/optimizer/historique-import-monstres-a-optimiser.md).
  // `undefined` : aucun bouton — cas d'un monstre non réellement possédé
  // (repli stats de base, voir OptimizerSection.tsx), rien à réserver sur un
  // exemplaire qui n'existe pas dans le compte.
  onValidate?: () => void;
  // Ce candidat EST le build ACTUELLEMENT validé pour ce monstre (mêmes 6
  // runeIds, comparaison faite par le parent) — bouton désactivé, libellé
  // « Validé » plutôt que « Valider ».
  validated?: boolean;
  // ⚠️ **Une rune de ce build est DÉJÀ RÉSERVÉE** pour un autre monstre de la
  // liste active : le bouton reste AFFICHÉ mais désactivé, et dit pourquoi.
  // Le retirer laisserait croire que ce build n'est pas validable du tout,
  // alors qu'il le redeviendra dès qu'on libère la rune. `null` = aucun
  // conflit. Le texte nomme le monstre concerné, comme le fait la fiche.
  conflit?: string | null;
}

// ⚠️ Même FORME que l'affichage de l'équipement actuellement équipé (RTA/
// Siège/« Équipement actuel » de l'Optimizer) — roue de RuneWheel.tsx et
// emplacements d'ArtifactSlots.tsx, pas une rangée de cadres à plat — mais à
// une échelle réduite pour tenir dans une carte de résultat sans l'alourdir.
// ⚠️ Calibrée pour que DEUX cartes tiennent par ligne dans le conteneur
// `max-w-3xl` (768px) de OptimizerSection.tsx — voir le `minmax` du grid.
const WHEEL_SCALE = 0.45;
const ARTIFACT_SCALE = 0.45;

// Une combinaison trouvée : les artéfacts (fixes) et les 6 runes (sur la
// roue, façon jeu), les sets obtenus, le panneau de stats (base+bonus ↔
// total, comme la fiche pleine page) et la valeur totale dans la mesure
// choisie (Efficience ou Score SW — réglage global, voir compte/runes.md).
export default function BuildCandidateCard({
  rank,
  candidate,
  runeById,
  artifacts,
  metric,
  openRuneKey,
  onToggleRune,
  degatsReels,
  onValidate,
  conflit,
  validated,
}: Props) {
  const runes = candidate.runeIds.map((id) => runeById.get(id)).filter((r): r is RuneDetail => !!r);
  const sets = activeSets(runes.map((r) => r.set));
  // ⚠️ Une même rune peut apparaître dans PLUSIEURS candidats affichés (une
  // bonne rune revient souvent) : identifier par le seul `rune.id` ferait
  // s'ouvrir deux popovers d'un coup si cette rune figure dans deux cartes.
  // La clé combine donc la carte (runeIds du candidat) et le slot.
  const candidateKey = candidate.runeIds.join('-');
  // ⚠️ PAS `candidate.effTotal` : figé dans la mesure active au moment de la
  // recherche, il devient incohérent avec le popover d'une rune individuelle
  // (recalculé en direct) si l'utilisateur bascule Efficience ↔ Score après
  // coup sans relancer — voir runeBuildOptim.ts.
  const liveTotal = candidateMetricTotal(candidate, runeById, metric);

  // Les artéfacts sont IDENTIQUES d'une carte à l'autre (fixes) : contrairement
  // aux runes, pas besoin d'un état PARTAGÉ entre cartes pour éviter un doublon
  // de popover — un état local par carte suffit.
  const [openArtifactKind, setOpenArtifactKind] = useState<string | null>(null);
  const runeOpenHere = openRuneKey?.startsWith(`${candidateKey}-`) ?? false;

  // ⚠️ Même bascule flottant (souris) / en ligne (doigt) que MonsterGear.tsx —
  // voir sa justification. Le flottant, à taille fixe (260×320), débordait de
  // l'écran sur une carte de résultat déjà compacte en mobile.
  const auDoigt = useMediaQuery(COMPACT);
  const openArtifact = openArtifactKind ? artifacts.find((a) => a.kind === openArtifactKind) : undefined;
  const openRuneSlot = runeOpenHere ? Number(openRuneKey!.slice(candidateKey.length + 1)) : null;
  const openRune = openRuneSlot !== null ? runes.find((r) => r.slot === openRuneSlot) : undefined;

  return (
    <div
      // ⚠️ `relative` + `z-10` UNIQUEMENT quand cette carte a un popover
      // ouvert (rune ou artéfact) : sans ça, son popover flottant pouvait se
      // retrouver visuellement recouvert par une carte VOISINE de la grille
      // de résultats, plus tard dans l'ordre du DOM — même sans chevauchement
      // apparent, l'empilement par défaut suit l'ordre du DOM, pas la
      // position à l'écran.
      className={`rounded-xl border border-border bg-panel p-2.5 ${
        runeOpenHere || openArtifactKind ? 'relative z-10' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-xs font-bold text-star">#{rank}</span>
        <span className="font-mono text-xs text-ink-dim">
          {metric === 'eff' ? 'Efficience moyenne' : 'Score moyen'} : {formatRuneMetric(liveTotal / 6, metric)}
        </span>
      </div>

      {/* ⚠️ Le chiffre qui a servi à CLASSER ce candidat passe devant la
          mesure par rune : quand on optimise des dégâts, c'est lui qu'on
          compare d'une carte à l'autre. La part des PV de la cible le rend
          lisible sans calcul mental (« ça tue ou pas »), le seul rôle des PV
          adverses saisis — ils n'entrent jamais dans le classement. */}
      {degatsReels && (
        <p className="mb-2 flex flex-wrap items-baseline justify-between gap-x-2 rounded-lg border border-border-soft bg-panel2 px-2 py-1">
          <span className="text-micro text-ink-dim">Dégâts</span>
          <span className="font-mono text-sm font-bold text-star">
            {Math.round(degatsReels.total).toLocaleString('fr-FR')}
            <span className="ml-1.5 font-normal text-micro text-ink-dim">
              {degatsReels.partPvCible >= 100 ? 'tue la cible' : `${Math.round(degatsReels.partPvCible)} % des PV`}
            </span>
          </span>
        </p>
      )}

      {sets.length > 0 && (
        <p className="mb-2 flex flex-wrap items-center gap-1 text-micro text-ink-dim">
          {sets.map((key, i) => (
            <span key={`${key}-${i}`}>{RUNE_SETS.find((s) => s.key === key)?.label ?? key}</span>
          ))}
        </p>
      )}

      {/* ⚠️ Panneau de stats à GAUCHE, artéfacts + roue à DROITE — carte
          compacte, en ligne plutôt qu'empilée verticalement (demande
          explicite : « les runes et les artefacts affichés à droite de la
          fiche de statistiques »). */}
      {/* ⚠️ EN PILE sous `sm` : la table de stats, les artéfacts et la roue de
          runes tiennent sur une ligne à partir de 360 px de carte, pas en
          dessous — les trois blocs s'y écrasaient jusqu'à devenir illisibles.
          Empilés, chacun garde sa taille de lecture. */}
      <div className="flex flex-col items-center justify-center gap-2 sm:flex-row">
        <StatPanel stats={candidate.stats} />
        <div className="flex flex-none items-center gap-1">
          <ArtifactSlots
            artifacts={artifacts}
            scale={ARTIFACT_SCALE}
            isSelected={(a) => openArtifactKind === a.kind}
            onSelectArtifact={(a) => setOpenArtifactKind((cur) => (cur === a.kind ? null : a.kind))}
            // Mêmes dimensions que pour une rune : les deux cartes partagent la
            // même coquille (voir PieceDetail.tsx), donc le même encombrement.
            // ⚠️ `rembourrage="md"` + `encadre={false}` : le flottant pose déjà
            // le cadre, la carte n'a plus à poser le sien — sinon carte dans
            // une carte, à deux rayons de coin différents.
            renderOverlay={
              auDoigt
                ? undefined
                : (a, _i, anchorRef) => (
                    <FlottantAuto
                      ouvert={openArtifactKind === a.kind}
                      ancre={anchorRef}
                      largeur={260}
                      hauteur={320}
                      rembourrage="md"
                    >
                      <ArtifactDetailBox artifact={a} encadre={false} />
                    </FlottantAuto>
                  )
            }
          />
          <RuneWheel
            runes={runes}
            scale={WHEEL_SCALE}
            isSelected={(r) => openRuneKey === `${candidateKey}-${r.slot}`}
            onSelectRune={(r) => onToggleRune(`${candidateKey}-${r.slot}`)}
            renderOverlay={
              auDoigt
                ? undefined
                : (r, _i, anchorRef) => (
                    <FlottantAuto
                      ouvert={openRuneKey === `${candidateKey}-${r.slot}`}
                      ancre={anchorRef}
                      largeur={260}
                      hauteur={320}
                      rembourrage="md"
                    >
                      <RuneDetailBox rune={r} encadre={false} />
                    </FlottantAuto>
                  )
            }
          />
        </div>
      </div>

      {/* Au DOIGT : le détail sur sa propre ligne, sous artéfacts/roue — voir
          MonsterGear.tsx. Artéfact et rune peuvent être ouverts en même temps
          (états indépendants) : les deux s'empilent plutôt que de s'exclure. */}
      {auDoigt && (openArtifact || openRune) && (
        <div className="mx-auto mt-2 w-full max-w-[280px] space-y-2">
          {openArtifact && <ArtifactDetailBox artifact={openArtifact} />}
          {openRune && <RuneDetailBox rune={openRune} />}
        </div>
      )}

      {/* « Valider » (Lot 2) — réserve les 6 runes de CE build (bloquées
          pour les recherches des AUTRES monstres de « Monstres déjà runés »,
          voir OptimizerSection.tsx). Absent (`onValidate` non fourni) pour
          un monstre non réellement possédé — rien à réserver sur un
          exemplaire qui n'existe pas dans le compte. */}
      {onValidate && (
        <Bouton
          onClick={onValidate}
          disabled={validated || !!conflit}
          title={conflit ?? undefined}
          ton={validated ? 'accent' : 'neutre'}
          fond={validated ? 'doux' : 'plein'}
          taille="sm"
          pleineLargeur
          icone={validated ? <CheckCircle2 size={14} /> : undefined}
          libelle={validated ? 'Validé' : conflit ? 'Rune déjà réservée' : 'Valider ce build'}
          className="mt-2.5"
        />
      )}
    </div>
  );
}
