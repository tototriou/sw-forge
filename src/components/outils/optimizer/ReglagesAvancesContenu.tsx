import Segmented from '../../../ui/Segmented';
import { SLOT_FILTER_PRESETS, type SlotFilterPresetKey } from '../../../lib/runeBuildOptim';
import { formatBig } from '../../../lib/formatBig';
import HelpPopover from '../../HelpPopover';
import { Interrupteur } from '../../../ui';
import { Target } from 'lucide-react';
import { type Dispatch, type SetStateAction, type RefObject } from 'react';

export interface ReglagesAvancesContenuProps {
  slotFilterPreset: SlotFilterPresetKey;
  handleSlotFilterPresetChange: (preset: SlotFilterPresetKey) => void;
  dansPanneau: boolean;
  estimate: { perSlot: number[]; product: number; } | null;
  exhaustiveSearch: boolean;
  setExhaustiveSearch: Dispatch<SetStateAction<boolean>>;
  diagnoseBlockingEnabled: boolean;
  setDiagnoseBlockingEnabled: Dispatch<SetStateAction<boolean>>;
  adaptiveTrancheWeighting: boolean;
  setAdaptiveTrancheWeighting: Dispatch<SetStateAction<boolean>>;
  optimiserArtefacts: boolean;
  verifierToutesLesCombinaisons: boolean;
  setVerifierToutesLesCombinaisons: Dispatch<SetStateAction<boolean>>;
  interrupteurResPrePanneauRef: RefObject<HTMLDivElement>;
  interrupteurResPreBureauRef: RefObject<HTMLDivElement>;
  attentionResPre: number | null;
  compterAurasResPre: boolean;
  setCompterAurasResPre: Dispatch<SetStateAction<boolean>>;
  // Dans la page de bureau : les sets d'aura des autres monstres se saisissent
  // dans la colonne « Aura, exclusion, avancés », plus dans « État de mon
  // monstre » (réduit aux buffs et au lead). Absent : le texte du téléphone.
  bureau?: boolean;
}

export default function ReglagesAvancesContenu({ slotFilterPreset, handleSlotFilterPresetChange, dansPanneau, estimate, exhaustiveSearch, setExhaustiveSearch, diagnoseBlockingEnabled, setDiagnoseBlockingEnabled, adaptiveTrancheWeighting, setAdaptiveTrancheWeighting, optimiserArtefacts, verifierToutesLesCombinaisons, setVerifierToutesLesCombinaisons, interrupteurResPrePanneauRef, interrupteurResPreBureauRef, attentionResPre, compterAurasResPre, setCompterAurasResPre, bureau = false }: ReglagesAvancesContenuProps) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-3">
    {/* ⚠️ Mêmes classes de boîte que les trois groupes d'« État de mon
        monstre » (EtatMonstre.tsx) : deux façons de cadrer un groupe
        dans cet écran se liraient comme deux natures différentes. */}
    <div className="rounded-lg border border-border-soft bg-panel2 px-2 py-1.5">
      <p className="text-[11.5px] text-ink-dim mb-1">Pré-filtrage par emplacement</p>
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          options={SLOT_FILTER_PRESETS}
          value={slotFilterPreset}
          onChange={handleSlotFilterPresetChange}
          // Dans le panneau « Options » : pleine largeur, comme les autres
          // contrôles du tiroir. En ligne au bureau : serré à son contenu.
          size={dansPanneau ? 'lg' : undefined}
          className={dansPanneau ? '' : 'w-fit'}
        />
        {dansPanneau && estimate && (
          <span className="font-mono text-micro text-ink-dim">
            Pool de runes = {formatBig(estimate.perSlot.reduce((a, b) => a + b, 0))}
          </span>
        )}
      </div>
      <p className="mt-1 text-micro text-warn max-w-[280px]">
        ⚠️ {SLOT_FILTER_PRESETS.find((p) => p.key === slotFilterPreset)?.hint}
      </p>
    </div>

    {/* ⚠️ `divide-y` et non un `border-t` par interrupteur : un trait ne
        se pose qu'ENTRE deux voisins, jamais au-dessus du premier. Avec
        des bordures individuelles, le premier interrupteur portait un
        trait en tête de colonne — anodin quand tout était empilé sous le
        pré-filtrage, mais lu comme une ligne perdue une fois le groupe
        posé en colonne à côté. */}
    <div className="divide-y divide-border rounded-lg border border-border-soft bg-panel2 px-2 py-1.5">
      {/* Toggle, même patron que « Prioriser les stats les plus
          difficiles » : désactivé par défaut, lu par `handleSearch` au
          clic sur « Rechercher », jamais un bouton qui lance sa propre
          recherche. */}
      <div className="flex items-center justify-between gap-2 py-3 first:pt-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[11.5px] text-ink-dim">Rechercher jusqu'à épuisement complet</span>
          <HelpPopover title="Rechercher jusqu'à épuisement complet">
            Retire la limite de temps de 10 minutes : la recherche continue tant qu'il reste des combinaisons
            à examiner. Peut prendre très longtemps sur une recherche avec peu de conditions — le bouton{' '}
            <b className="text-ink">« Arrêter »</b> reste disponible et garde le meilleur trouvé jusque-là.
            Le plafond de 100 000 résultats collectés, lui, reste actif.
          </HelpPopover>
        </div>
        <Interrupteur
          actif={exhaustiveSearch}
          onChange={setExhaustiveSearch}
          aria-label="Rechercher jusqu'à épuisement complet"
        />
      </div>

      <div className="flex items-center justify-between gap-2 py-3">
        <div className="flex items-center gap-1.5">
          <span className="text-[11.5px] text-ink-dim">Diagnostic approfondi sur 0 résultat</span>
          <HelpPopover title="Diagnostic approfondi sur 0 résultat">
            Après une recherche à 0 résultat, identifie quelle condition posée libère le plus de candidats si
            on la retire — <b className="text-ink">un indice, pas une preuve</b>.
          </HelpPopover>
        </div>
        <Interrupteur
          actif={diagnoseBlockingEnabled}
          onChange={setDiagnoseBlockingEnabled}
          aria-label="Diagnostic approfondi sur 0 résultat"
        />
      </div>

      {/* Déplacé depuis son ancien emplacement (juste avant les
          boutons d'action) — même toggle, même logique, regroupé ici
          avec les autres réglages secondaires. */}
      <div className="flex items-center justify-between gap-2 py-3 last:pb-0">
        <div className="flex items-center gap-1.5">
          <Target size={15} className="text-ink-dim" />
          <span className="text-[11.5px] text-ink-dim">Prioriser les stats les plus difficiles</span>
          <HelpPopover title="Prioriser les stats les plus difficiles">
            Peut trouver un build qu'une recherche normale rate quand une stat est rare, au prix d'une
            recherche plus longue.
          </HelpPopover>
        </div>
        <Interrupteur
          actif={adaptiveTrancheWeighting}
          onChange={setAdaptiveTrancheWeighting}
          aria-label="Prioriser les stats les plus difficiles"
        />
      </div>

      {/* « Vérifier toutes les combinaisons trouvées » : désactivé par défaut, lu EN DIRECT par la file
          (`cibleDeLaFile`), jamais par `handleSearch` — il ne change pas
          la recherche de runes, seulement jusqu'où la file vérifie.
          MASQUÉ sans optimisation d'artéfacts : sans file, rien n'est
          vérifié, et une saisie sans effet est pire qu'une saisie
          absente (même règle que « Adapter les artéfacts et reliques
          au tri »). L'interrupteur qui le masque vit dans une autre
          carte : rien ne bouge sous le clic. */}
      {optimiserArtefacts && (
        <div className="flex items-center justify-between gap-2 py-3 last:pb-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[11.5px] text-ink-dim">Vérifier toutes les combinaisons trouvées</span>
            <HelpPopover title="Vérifier toutes les combinaisons trouvées">
              Par défaut, la vérification des artéfacts et de la relique s'arrête dès que{' '}
              <b className="text-ink">100 combinaisons sont confirmées</b> (300 quand la relique est cherchée) :
              les suivantes ne sont vérifiées que si tu ouvres leur page.
              <br />
              <br />
              Activé, toutes les combinaisons trouvées sont vérifiées, au-delà de ces confirmées : le compte
              devient complet, mais cela peut prendre plusieurs minutes.
            </HelpPopover>
          </div>
          <Interrupteur
            actif={verifierToutesLesCombinaisons}
            onChange={setVerifierToutesLesCombinaisons}
            aria-label="Vérifier toutes les combinaisons trouvées"
          />
        </div>
      )}

      {/* « Compter les effets d'auras Tolerance et Précision dans les
          conditions » (libellé de l'utilisateur) :
          activé par défaut, branché sur `compterAurasResPre`, qu'une
          recette porte déjà et que la recherche lit au clic sur
          « Rechercher » (`avecAurasConditions`).
          ⚠️ **Rendu SANS condition**, même sans aucune aura RES/PRE
          saisie : les activations Tolerance/Accuracy PROPRES d'un build
          comptent aussi, et un réglage qui apparaît et disparaît avec
          la saisie d'une autre carte ne se retrouve pas. Ce contenu est
          commun aux deux formats — le flottant du bureau et le panneau
          « Options » au doigt.
          ⚠️ EN DERNIER : la rangée conditionnelle du dessus
          (« Vérifier toutes… ») ne le décale qu'au geste d'une autre
          carte, jamais sous le clic.
          ⚠️ **Cible de l'ouverture guidée** : le
          cadre intérieur porte le surlignage d'attention, au même token
          que le rappel (`warn` / `warn-soft`). Il existe EN PERMANENCE,
          transparent : se colorer ne bouge rien. Intérieur et non sur la
          rangée elle-même, dont le trait du haut vient de `divide-y` :
          un contour posé dessus en ferait deux superposés. `-mx-1` le
          tient à 4 px du cadre de la boîte ; `px-[3px]` + 1 px de bord
          gardent le libellé aligné sur ceux du dessus, et `py-2` +
          `py-[3px]` + 1 px refont les 12 px de `py-3`. Une ref par
          surface (colonne du bureau, panneau), pour y défiler. */}
      <div className="py-2 last:pb-0">
        <div
          ref={dansPanneau ? interrupteurResPrePanneauRef : interrupteurResPreBureauRef}
          className={`-mx-1 flex items-center justify-between gap-3 rounded-md border px-[3px] py-[3px] transition-colors duration-200 ${
            attentionResPre !== null ? 'border-warn bg-warn-soft' : 'border-transparent'
          }`}
        >
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            <span className="min-w-0 text-[11.5px] text-ink-dim">
              Compter les effets d'auras Tolerance et Précision dans les conditions
            </span>
            <HelpPopover title="Compter les effets d'auras Tolerance et Précision dans les conditions">
              Activé, chaque set <b className="text-ink">Tolerance</b> ou <b className="text-ink">Accuracy</b> ajoute
              8 points de RES ou de Précision aux <b className="text-ink">minimums et aux maximums</b> de ces deux
              conditions : ceux des autres monstres, saisis dans {bureau ? '« Aura, exclusion, avancés »' : '« État de mon monstre »'}, et
              ceux que forment les runes de chaque build.
              <br />
              <br />
              Désactivé, ces deux conditions portent sur les statistiques sans aucune aura. Les dégâts et les PV
              effectifs comptent les auras dans les deux cas.
            </HelpPopover>
          </div>
          <span className="flex-none">
            <Interrupteur
              actif={compterAurasResPre}
              onChange={setCompterAurasResPre}
              aria-label="Compter les effets d'auras Tolerance et Précision dans les conditions"
            />
          </span>
        </div>
      </div>
    </div>
    </div>
  );
}
