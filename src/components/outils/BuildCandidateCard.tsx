import { ArrowLeftRight, CheckCircle2 } from 'lucide-react';
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
  // La paire d'artéfacts retenue POUR CE BUILD.
  //
  // ⚠️ **Elle varie désormais d'une carte à l'autre**, contrairement à ce que
  // ce champ portait à l'origine (les artéfacts équipés, identiques partout).
  // Deux builds voisins n'appellent pas les mêmes artéfacts, et ce sont ces
  // pièces-là qui ont servi à calculer `candidate.stats` — montrer autre chose
  // afficherait des stats et un équipement qui ne vont pas ensemble.
  artifacts: ArtifactDetail[];
  // La paire de CE build n'a pas encore été calculée : celle affichée est la
  // paire supposée, commune. Dit explicitement plutôt que laissé croire.
  paireProvisoire?: boolean;
  metric: RuneMetric;
  // Identité de la pièce actuellement ouverte, PARTAGÉE entre tous les
  // résultats affichés — voir OptimizerSection.tsx / useOptimizerState.ts.
  // ⚠️ **UNE seule clé pour les runes ET les artéfacts**, partagée entre
  // TOUTES les cartes : c’est la seule forme qui garantit qu’un seul détail
  // reste ouvert. Deux états, même bien synchronisés, se désynchronisent au
  // premier chemin oublié — c’est précisément ce qui laissait un artéfact
  // ouvert quand on cliquait une rune.
  openDetailKey: string | null;
  onToggleDetail: (key: string) => void;
  // Dégâts du sort visé pour CE candidat, quand l'objectif « Dégâts réels »
  // est actif — `undefined` sinon. ⚠️ Calculé par le PARENT (qui détient le
  // sort résolu et l'adversaire) plutôt que reconstruit ici : cette carte
  // n'a aucune raison de connaître le modèle de dégâts, et le parent trie
  // déjà sur exactement la même valeur.
  // ⚠️ `delta` : l'écart avec le build de référence, fourni SEULEMENT quand
  // cette carte est celle qu'on compare. Sur la même prop que la valeur qu'il
  // qualifie, pour qu'on ne puisse pas afficher l'un sans l'autre.
  degatsReels?: { total: number; partPvCible: number; delta?: number };
  // Les PV EFFECTIFS de ce candidat — la valeur qui l'a classé quand
  // l'objectif ou le tri courant est « PV effectifs ». `undefined` sinon.
  // ⚠️ Même raison que `degatsReels` d'être calculée par le PARENT : c'est le
  // chiffre qui ORDONNE les cartes, il doit venir de la même source que le
  // tri, jamais d'une formule recopiée ici.
  pvEffectifs?: { total: number; delta?: number };
  // Écart d'efficience/score total avec la référence — la ligne de mesure en
  // tête de carte est toujours affichée, donc son écart aussi quand on compare.
  metricDelta?: number;
  // Bouton « Valider » (Lot 2 — réservation des 6 runes de CE build, voir
  // spec/outils/optimizer/historique-import-monstres-a-optimiser.md).
  // `undefined` : aucun bouton — cas d'un monstre non réellement possédé
  // (repli stats de base, voir OptimizerSection.tsx), rien à réserver sur un
  // exemplaire qui n'existe pas dans le compte.
  onValidate?: () => void;
  /**
   * Ce candidat est-il DÉJÀ le build validé pour ce monstre ? Comparaison
   * faite par le parent (voir `EtatValidation`, OptimizerSection.tsx).
   *
   * - `'non'` — rien de réservé pour ces runes : « Valider ce build ».
   * - `'oui'` — mêmes runes ET même paire : bouton désactivé, « Validé ».
   * - `'artefacts'` — mêmes runes, PAIRE DIFFÉRENTE : bouton ACTIF,
   *   « Valider les artéfacts ».
   *
   * ⚠️ **Le troisième état n'est pas un raffinement.** Sans lui, un candidat
   * aux mêmes runes mais aux artéfacts différents affichait « Validé » et
   * n'offrait plus rien : l'utilisateur voyait des stats qui ne sont pas
   * celles réservées, sans aucun moyen de les valider. Un artéfact entre dans
   * les statistiques du monstre — deux paires, deux builds.
   */
  validated?: 'non' | 'oui' | 'artefacts';
  // ⚠️ **Une rune de ce build est DÉJÀ RÉSERVÉE** pour un autre monstre de la
  // liste active : le bouton reste AFFICHÉ mais désactivé, et dit pourquoi.
  // Le retirer laisserait croire que ce build n'est pas validable du tout,
  // alors qu'il le redeviendra dès qu'on libère la rune. `null` = aucun
  // conflit. Le texte nomme le monstre concerné, comme le fait la fiche.
  conflit?: string | null;
  /**
   * Ouvre/ferme la comparaison de CE build avec la référence. `undefined` :
   * pas de bouton — aucun monstre résolu, donc aucune référence à comparer.
   */
  onCompare?: () => void;
  /**
   * L'écart, statistique par statistique, entre ce build et la référence —
   * fourni SEULEMENT quand cette carte est celle qu'on compare.
   *
   * ⚠️ **Calculé par le PARENT**, comme `degatsReels` juste au-dessus et pour
   * la même raison : la référence est la fiche affichée, donc le build validé
   * quand il en existe un, et cette carte n'a aucune raison de savoir
   * comment cette résolution se fait.
   */
  comparaison?: { key: string; label: string; suffix: string; delta: number }[];
}

// ⚠️ Même FORME que l'affichage de l'équipement actuellement équipé (RTA/
// Siège/« Équipement actuel » de l'Optimizer) — roue de RuneWheel.tsx et
// emplacements d'ArtifactSlots.tsx, pas une rangée de cadres à plat — mais à
// une échelle réduite pour tenir dans une carte de résultat sans l'alourdir.
// ⚠️ Calibrée pour que DEUX cartes tiennent par ligne dans le conteneur
// `max-w-3xl` (768px) de OptimizerSection.tsx — voir le `minmax` du grid.
/**
 * Un écart avec le build de référence, sous la valeur qu'il qualifie.
 *
 * ⚠️ Un seul composant pour les trois (dégâts, PV effectifs, efficience) :
 * trois rendus séparés auraient divergé de couleur ou de format au premier
 * ajustement, et c'est précisément la comparaison entre eux qui compte.
 * ⚠️ Un écart NUL s'affiche, en gris — même raison que dans la grille de
 * comparaison des stats : une valeur absente se lirait « non comparée ».
 */
function Delta({ valeur, suffixe = '' }: { valeur: number; suffixe?: string }) {
  const arrondi = Math.round(valeur * 10) / 10;
  return (
    <span
      className={`font-mono text-nano tabular-nums ${
        arrondi > 0 ? 'text-good' : arrondi < 0 ? 'text-bad' : 'text-ink-dimmer'
      }`}
    >
      {arrondi > 0 ? '+' : ''}
      {arrondi.toLocaleString('fr-FR')}
      {suffixe}
    </span>
  );
}

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
  openDetailKey,
  onToggleDetail,
  degatsReels,
  paireProvisoire,
  onValidate,
  conflit,
  validated,
  onCompare,
  comparaison,
  pvEffectifs,
  metricDelta,
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

  // ⚠️ Les artéfacts avaient ici un état LOCAL, au motif qu'ils étaient
  // « identiques d'une carte à l'autre, donc pas besoin d'un état partagé ».
  // La prémisse a cessé d'être vraie (chaque build porte SA paire), et elle ne
  // couvrait de toute façon pas le cas rune↔artéfact, ouvert dès l'origine :
  // deux états distincts laissaient les DEUX popovers affichés.
  //
  // ⚠️ Les deux sortes partagent donc une clé, préfixée pour rester
  // distinguables : `a<kind>` pour un artéfact, `r<slot>` pour une rune. Sans
  // préfixe, l'ancien format `<candidateKey>-<slot>` ne se relisait pas.
  const cleArtefact = (kind: string) => `${candidateKey}-a${kind}`;
  const cleRune = (slot: number) => `${candidateKey}-r${slot}`;
  const detailOuvertIci = openDetailKey?.startsWith(`${candidateKey}-`) ?? false;

  // ⚠️ Même bascule flottant (souris) / en ligne (doigt) que MonsterGear.tsx —
  // voir sa justification. Le flottant, à taille fixe (260×320), débordait de
  // l'écran sur une carte de résultat déjà compacte en mobile.
  const auDoigt = useMediaQuery(COMPACT);
  const suffixe = detailOuvertIci ? openDetailKey!.slice(candidateKey.length + 1) : null;
  const openArtifact = suffixe?.startsWith('a') ? artifacts.find((a) => a.kind === suffixe.slice(1)) : undefined;
  const openRuneSlot = suffixe?.startsWith('r') ? Number(suffixe.slice(1)) : null;
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
        detailOuvertIci ? 'relative z-10' : ''
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <span className="font-mono text-xs font-bold text-star">#{rank}</span>
        <span className="flex flex-col items-end">
          <span className="font-mono text-xs text-ink-dim">
            {metric === 'eff' ? 'Efficience moyenne' : 'Score moyen'} : {formatRuneMetric(liveTotal / 6, metric)}
          </span>
          {/* L'écart avec la référence, SOUS la valeur qu'il qualifie
              (demande explicite) — jamais à côté, où il se lirait comme une
              seconde mesure. */}
          {metricDelta != null && <Delta valeur={metricDelta / 6} suffixe={metric === 'eff' ? ' %' : ''} />}
        </span>
      </div>

      {/* ⚠️ Même traitement que les dégâts, et pour la même raison : c'est le
          chiffre qui a CLASSÉ ce candidat quand on optimise la survie. Sans
          lui, on triait par PV effectifs sans jamais voir la valeur triée —
          signalé à l'usage. */}
      {pvEffectifs && (
        <p className="mb-2 flex flex-wrap items-baseline justify-between gap-x-2 rounded-lg border border-border-soft bg-panel2 px-2 py-1">
          <span className="text-micro text-ink-dim">PV effectifs</span>
          <span className="flex flex-col items-end">
            <span className="font-mono text-sm font-bold text-star">
              {Math.round(pvEffectifs.total).toLocaleString('fr-FR')}
            </span>
            {pvEffectifs.delta != null && <Delta valeur={pvEffectifs.delta} />}
          </span>
        </p>
      )}

      {/* ⚠️ Le chiffre qui a servi à CLASSER ce candidat passe devant la
          mesure par rune : quand on optimise des dégâts, c'est lui qu'on
          compare d'une carte à l'autre. La part des PV de la cible le rend
          lisible sans calcul mental (« ça tue ou pas »), le seul rôle des PV
          adverses saisis — ils n'entrent jamais dans le classement. */}
      {degatsReels && (
        <p className="mb-2 flex flex-wrap items-baseline justify-between gap-x-2 rounded-lg border border-border-soft bg-panel2 px-2 py-1">
          <span className="text-micro text-ink-dim">Dégâts</span>
          <span className="flex flex-col items-end">
            <span className="font-mono text-sm font-bold text-star">
              {Math.round(degatsReels.total).toLocaleString('fr-FR')}
              <span className="ml-1.5 font-normal text-micro text-ink-dim">
                {degatsReels.partPvCible >= 100 ? 'tue la cible' : `${Math.round(degatsReels.partPvCible)} % des PV`}
              </span>
            </span>
            {degatsReels.delta != null && <Delta valeur={degatsReels.delta} />}
          </span>
          {/* ⚠️ **Rangée TOUJOURS présente** — la place est réservée d’avance
              (spec/shared/design.md). Rendue conditionnellement, elle faisait
              varier la hauteur de la carte, et comme la file sert les builds au
              fil de l’eau, TOUTE la grille se réorganisait à chaque paire
              trouvée. L’espace insécable tient la hauteur quand il n’y a rien à
              dire — un espace ordinaire s’effondrerait.

              ⚠️ **Il y avait ici un « +X % grâce aux artéfacts ». RETIRÉ, et
              pas réparé.** Il comparait la paire retenue à la paire SUPPOSÉE —
              celle que le moteur postule pendant qu’il classe les builds. C’est
              un détail d’implémentation : personne n’a de raison de savoir
              qu’elle existe, encore moins d’en vouloir un pourcentage.
              Signalé à l’usage (« je ne sais pas ce qu’il est censé
              représenter »), et c’était le bon diagnostic — le corriger aurait
              donné un nombre exact et toujours incompréhensible.

              ⚠️ Une comparaison n’a de sens que si sa RÉFÉRENCE se nomme.
              Celle qui se nomme — « par rapport aux artéfacts que ce monstre
              porte aujourd’hui » — vit dans « Meilleurs artéfacts pour ce
              build » (OptimizerSection.tsx), où les deux termes partagent le
              même build. Ici, le total affiché inclut DÉJÀ la paire retenue, et
              cette paire est montrée juste à côté : la carte se suffit. */}
          <span className="w-full text-right text-micro text-ink-dimmer">
            {paireProvisoire ? 'artéfacts pas encore optimisés' : ' '}
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
            isSelected={(a) => openDetailKey === cleArtefact(a.kind)}
            onSelectArtifact={(a) => onToggleDetail(cleArtefact(a.kind))}
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
                      ouvert={openDetailKey === cleArtefact(a.kind)}
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
            isSelected={(r) => openDetailKey === cleRune(r.slot)}
            onSelectRune={(r) => onToggleDetail(cleRune(r.slot))}
            renderOverlay={
              auDoigt
                ? undefined
                : (r, _i, anchorRef) => (
                    <FlottantAuto
                      ouvert={openDetailKey === cleRune(r.slot)}
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
      {(onValidate || onCompare) && (
        // ⚠️ Les deux boutons SE PARTAGENT la largeur (demande explicite) :
        // `flex` + `flex-1` sur chacun, plutôt que deux `pleineLargeur`
        // empilés. La carte garde ainsi la même hauteur qu'avec un seul
        // bouton — une rangée de plus par carte se paie sur toute la grille
        // de résultats.
        <div className="mt-2.5 flex items-stretch gap-2">
          {onCompare && (
            <Bouton
              onClick={onCompare}
              ton={comparaison ? 'accent' : 'neutre'}
              fond={comparaison ? 'doux' : 'vide'}
              taille="sm"
              icone={<ArrowLeftRight size={14} />}
              libelle="Comparer"
              className="flex-1"
            />
          )}
          {onValidate && (
            <Bouton
              onClick={onValidate}
              // ⚠️ Seul `'oui'` désactive. `'artefacts'` reste ACTIF : c'est
              // précisément l'état où il reste quelque chose à valider.
              disabled={validated === 'oui' || !!conflit}
              title={conflit ?? undefined}
              // Le ton « déjà réservé » ne vaut que pour l'identité complète —
              // sinon la carte se lirait comme terminée alors qu'elle attend
              // une action.
              //
              // ⚠️ **`alerte` pour « Valider les artéfacts », et c'est son sens
              // exact** : ce ton « ne dit rien de l'ACTION, il signale l'état
              // des DONNÉES » (voir Bouton.tsx). Ici la donnée signalée est
              // « ce que cette carte montre n'est pas ce qui est réservé ».
              // Sans lui, la carte se confondait avec toutes les autres cartes
              // non validées, alors que c'est la seule où il reste un écart à
              // combler.
              //
              // ⚠️ Un SEUL contour : `trait` vaut `plein` par défaut, donc le
              // bouton en porte déjà un — le ton en change la couleur, il n'en
              // superpose pas un second.
              ton={validated === 'oui' ? 'accent' : validated === 'artefacts' ? 'alerte' : 'neutre'}
              fond={validated === 'oui' || validated === 'artefacts' ? 'doux' : 'plein'}
              taille="sm"
              icone={validated === 'oui' ? <CheckCircle2 size={14} /> : undefined}
              libelle={
                validated === 'oui'
                  ? 'Validé'
                  : conflit
                    ? 'Rune déjà réservée'
                    : validated === 'artefacts'
                      ? 'Valider les artéfacts'
                      : 'Valider ce build'
              }
              className="flex-1"
            />
          )}
        </div>
      )}

      {/* ⚠️ L'écart contre le build de RÉFÉRENCE — la fiche affichée, donc le
          build validé quand il en existe un. S'affiche SOUS les boutons : au
          clic, rien de ce qui précède ne bouge (spec/shared/design.md).
          ⚠️ Les écarts NULS sont montrés aussi, en gris. Ne garder que les
          stats qui changent ferait une liste dont la longueur varie d'une
          carte à l'autre, et laisserait croire qu'une stat absente n'a pas été
          comparée. */}
      {comparaison && (
        <div className="mt-2 grid grid-cols-[repeat(auto-fit,minmax(72px,1fr))] gap-x-2 gap-y-0.5 rounded border border-border-soft bg-panel2 px-2 py-1.5">
          {comparaison.map((s) => (
            <div key={s.key} className="flex items-baseline justify-between gap-1">
              <span className="text-nano text-ink-dim">{s.label}</span>
              <span
                className={`font-mono text-nano tabular-nums ${
                  s.delta > 0 ? 'text-good' : s.delta < 0 ? 'text-bad' : 'text-ink-dimmer'
                }`}
              >
                {s.delta > 0 ? '+' : ''}
                {Math.round(s.delta).toLocaleString('fr-FR')}
                {s.suffix}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
