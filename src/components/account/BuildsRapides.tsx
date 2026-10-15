import { useMemo, useState } from 'react';
import { RuneDetail } from '../../types';
import { BuildRapide, VIT_BASE_REFERENCE, buildsLesPlusRapides, cleCombo } from '../../lib/buildsRapides';
import { useBuildsRapides } from '../../hooks/useBuildsRapides';
import { COMPACT, useMediaQuery } from '../../hooks/useMediaQuery';
import { useStickyState } from '../../hooks/useStickyState';
import { Bouton, FlottantAuto } from '../../ui';
import RuneWheel from '../RuneWheel';
import { RuneDetailBox } from '../PieceDetail';
import SymbolesCombo, { nomCombo } from '../SymbolesCombo';
import DialogueBuildsRapides from '../DialogueBuildsRapides';
import { Panel, fmt } from './SummaryBits';

// La roue à l'échelle des cartes de résultat de l'Optimizer.
const ECHELLE_ROUE = 0.45;

// Une case du détail Base / Runes. Le bonus Swift n'a pas de case (demandé) :
// il reste compris dans la VIT totale.
function Part({ libelle, valeur }: { libelle: string; valeur: string }) {
  return (
    <div className="flex flex-col items-center rounded border border-border-soft bg-panel2 px-1 py-0.5">
      <span className="text-nano text-ink-dim">{libelle}</span>
      <span className="font-mono text-micro tabular-nums text-ink">{valeur}</span>
    </div>
  );
}

function CarteBuild({
  rang,
  build,
  cle,
  ouverte,
  onBasculer,
  detailEnLigne,
}: {
  rang: number;
  build: BuildRapide;
  cle: string;
  ouverte: string | null;
  onBasculer: (cle: string) => void;
  // Le détail d'une rune SOUS la roue (au doigt), au lieu d'un flottant ancré
  // à la rune.
  detailEnLigne: boolean;
}) {
  const cleRune = (slot: number) => `${cle}-r${slot}`;
  const runeOuverte: RuneDetail | undefined = build.runes.find((r) => ouverte === cleRune(r.slot));
  return (
    <div
      // ⚠️ `relative z-10` quand le détail flottant est ouvert : sinon une carte
      // voisine, plus loin dans le DOM, passerait devant (BuildCandidateCard).
      className={`rounded-xl border border-border bg-panel2 p-2 ${
        runeOuverte ? 'relative z-10' : ''
      }`}
    >
      <div className="flex items-center gap-2">
        <RuneWheel
          runes={build.runes}
          scale={ECHELLE_ROUE}
          isSelected={(r) => ouverte === cleRune(r.slot)}
          onSelectRune={(r) => onBasculer(cleRune(r.slot))}
          renderOverlay={
            detailEnLigne
              ? undefined
              : (r, _i, ancre) => (
                  <FlottantAuto ouvert={ouverte === cleRune(r.slot)} ancre={ancre} largeur={260} hauteur={320} rembourrage="md">
                    <RuneDetailBox rune={r} encadre={false} />
                  </FlottantAuto>
                )
          }
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-baseline justify-between gap-1">
            <span className="font-mono text-xs font-bold text-star">#{rang}</span>
            <span className="font-mono text-nano text-ink-dim" title="Efficience moyenne des 6 runes">
              Eff. {fmt(build.effMoyenne)} %
            </span>
          </div>
          <p className="leading-none">
            <span className="font-display text-2xl tabular-nums text-ink">{build.total}</span>{' '}
            <span className="label">VIT</span>
          </p>
          <div className="grid grid-cols-2 gap-1">
            <Part libelle="Base" valeur={String(VIT_BASE_REFERENCE)} />
            <Part libelle="Runes" valeur={`+${build.vitRunes}`} />
          </div>
        </div>
      </div>
      {detailEnLigne && runeOuverte && (
        <div className="mt-2">
          {/* Resserrée aussi à la souris : elle tient dans la largeur de la carte. */}
          <RuneDetailBox rune={runeOuverte} compact />
        </div>
      )}
    </div>
  );
}

// Les builds les plus rapides du compte, par combinaison de sets (le réglage
// des Paramètres). Voir docs/02-app/compte/feat-runes/resume.md.
export default function BuildsRapides({ runes, className = '' }: { runes: RuneDetail[]; className?: string }) {
  const reglage = useBuildsRapides();
  // ⚠️ Recalculé à chaque import ou changement de réglage seulement : ~6 ms à
  // 4 000 runes et 10 builds par combinaison, mesuré — pas besoin de Worker.
  const groupes = useMemo(
    () => buildsLesPlusRapides(runes, reglage.combos, reglage.nombre),
    [runes, reglage]
  );
  // Un seul détail de rune ouvert à la fois dans tout le bloc.
  const [ouverte, setOuverte] = useState<string | null>(null);
  const basculer = (cle: string) => setOuverte((o) => (o === cle ? null : cle));
  const [dialogue, setDialogue] = useState(false);

  // ⚠️ **À partir de `xl`, TOUTES les combinaisons**, l'une sous l'autre, chacune
  // sous son titre : la largeur porte 4 à 5 cartes par ligne. **Sous `xl`, UN
  // ONGLET PAR COMBINAISON**, et seuls les builds de l'onglet choisi : 9
  // combinaisons × 5 builds à la suite y feraient trop de cartes. Jamais une
  // bande qui défile à l'horizontale (demande explicite) : la rangée d'onglets
  // passe à la ligne.
  // Un seul rendu pour les deux, basculé en CSS : chaque combinaison est écrite
  // une fois, et seules les autres que l'onglet choisi portent `hidden xl:block`.
  // L'onglet choisi survit à la navigation (`useStickyState`) ; une combinaison
  // retirée du réglage ramène au premier onglet.
  const [choisi, setChoisi] = useStickyState<string | null>('runes.buildsRapides.combo', null);
  const courant = groupes.find((g) => cleCombo(g.combo) === choisi) ?? groupes[0];

  // Au doigt, le détail d'une rune sous la roue ; à la souris, en flottant
  // (comme les cartes de l'Optimizer).
  const auDoigt = useMediaQuery(COMPACT);

  return (
    <Panel
      title="Builds les plus rapides"
      className={className}
      // La fenêtre de choix s'ouvre ICI, sur place : la même que celle des
      // Paramètres, sans quitter le Résumé.
      action={
        <Bouton
          taille="xs"
          ton="accent"
          fond="vide"
          trait="aucun"
          libelle="Choisir les combinaisons"
          onClick={() => setDialogue(true)}
        />
      }
    >
      {dialogue && <DialogueBuildsRapides onClose={() => setDialogue(false)} />}
      <p className="mb-3 text-xs leading-relaxed text-ink-dim">
        Pour chaque combinaison, le build de 6 runes le plus rapide, puis le suivant{' '}
        <b className="text-ink">sans les runes des précédents</b>. VIT d'un monstre de base{' '}
        {VIT_BASE_REFERENCE}, sans totem ni lead.
      </p>
      {!courant ? (
        <p className="text-sm text-ink-dim">Aucune combinaison choisie : ajoute-en avec « Choisir les combinaisons ».</p>
      ) : (
        <>
          {/* Des boutons À ÉTAT et non un `Segmented` : celui-ci ne passe pas à
              la ligne, et neuf combinaisons ne tiennent pas sur une rangée au
              téléphone. Chaque onglet porte la VIT de son #1 : on compare les
              combinaisons sans les ouvrir une à une. */}
          <div className="mb-3 flex flex-wrap gap-2 xl:hidden" role="group" aria-label="Combinaison affichée">
            {groupes.map(({ combo, builds }) => {
              const cle = cleCombo(combo);
              return (
                <Bouton
                  key={cle}
                  taille="sm"
                  actif={cle === cleCombo(courant.combo)}
                  onClick={() => setChoisi(cle)}
                  icone={<SymbolesCombo combo={combo} taille={14} />}
                  libelle={
                    <>
                      {nomCombo(combo)}
                      {/* La VIT du #1 se détache du nom : collée, elle se lisait
                          comme la fin du libellé. */}
                      <span className="ml-2 font-mono tabular-nums opacity-70">{builds[0]?.total ?? '—'}</span>
                    </>
                  }
                />
              );
            })}
          </div>
          <div className="flex flex-col xl:gap-4">
            {groupes.map(({ combo, builds }) => {
              const cleGroupe = cleCombo(combo);
              return (
                <section key={cleGroupe} className={cleGroupe === cleCombo(courant.combo) ? '' : 'hidden xl:block'}>
                  {/* Le titre ne sert qu'à partir de `xl` : en dessous, l'onglet
                      enfoncé nomme déjà la combinaison. */}
                  <h4 className="mb-1.5 hidden items-center gap-1.5 text-xs font-bold text-ink xl:flex">
                    <SymbolesCombo combo={combo} />
                    {nomCombo(combo)}
                  </h4>
                  {builds.length === 0 ? (
                    <p className="text-xs text-ink-dim">Aucun build possible avec tes runes.</p>
                  ) : (
                    // 228 px au plus serré : 4 cartes par ligne à 1280 px de
                    // fenêtre, 5 à 1536 (barre latérale dépliée).
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,228px),1fr))] gap-2">
                      {builds.map((b, i) => {
                        const cle = `${cleGroupe}#${i + 1}`;
                        return (
                          <CarteBuild
                            key={cle}
                            rang={i + 1}
                            build={b}
                            cle={cle}
                            ouverte={ouverte}
                            onBasculer={basculer}
                            detailEnLigne={auDoigt}
                          />
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </>
      )}
    </Panel>
  );
}
