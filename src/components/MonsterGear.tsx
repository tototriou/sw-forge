import { useRef, useState } from 'react';
import { GearSet, RelicDetail } from '../types';
import { computeStats } from '../lib/stats';
import { formatRelicMain } from '../lib/effects';
import RuneWheel from './RuneWheel';
import { COMPACT, useMediaQuery } from '../hooks/useMediaQuery';
import ArtifactSlots from './ArtifactSlots';
import StatPanel from './StatPanel';
import { ArtifactDetailBox, RuneDetailBox } from './PieceDetail';
import { FlottantAuto, ZoneCliquable } from '../ui';

type Selected =
  | { kind: 'rune'; i: number }
  | { kind: 'artifact'; i: number }
  | { kind: 'relic' }
  | null;

// ⚠️ `encadre=false` dans un `Flottant`, qui pose déjà bord + fond + coins
// arrondis — voir `PieceDetailBox`, même règle.
function RelicDetailBox({ relic, encadre = true }: { relic: RelicDetail; encadre?: boolean }) {
  return (
    <div className={encadre ? 'rounded-lg border border-border bg-panel/70 p-2.5' : ''}>
      <div className="text-xs font-bold text-ink">{formatRelicMain(relic.main)}</div>
      {relic.sub && (
        <div className="text-micro text-ink-dim mt-0.5">Effet secondaire · {relic.sub.value}</div>
      )}
    </div>
  );
}

interface Props {
  gear: GearSet;
  // Vitesse de runes VISÉE, quand elle a été saisie à la main et ne correspond
  // plus à cet équipement : on l'affiche en rouge sur la ligne VIT, pour donner
  // directement la valeur à atteindre. `null` quand tout concorde.
  spdCible?: number | null;
  // ⚠️ Répercutée UNIQUEMENT sur `ArtifactSlots`/`RuneWheel` — les deux
  // composants qui l'exposent déjà nativement (voir leurs propres fichiers,
  // déjà utilisés à échelle réduite par `BuildCandidateCard.tsx`). `StatPanel`
  // reste à sa largeur FIXE (`w-[200px]`, voir son commentaire de tête) : elle
  // ne bouge JAMAIS, quel que soit l'appelant — un panneau qui rétrécirait ici
  // recréerait exactement le déplacement au clic base+bonus↔total que sa
  // largeur fixe existe pour empêcher. `undefined` = taille normale
  // (comportement historique inchangé pour RTA/Siège, seuls appelants avant
  // l'Optimizer).
  scale?: number;
}

export default function MonsterGear({ gear, spdCible = null, scale }: Props) {
  const stats = computeStats(gear);
  const [sel, setSel] = useState<Selected>(null);
  const auDoigt = useMediaQuery(COMPACT);
  // Ancre du détail de la relique. Les runes et les artéfacts fournissent la
  // leur (`renderOverlay`) ; la relique est dessinée ici, elle porte donc sa
  // propre référence.
  const ancreRelique = useRef<HTMLDivElement>(null);

  const isSel = (s: Selected) =>
    !!sel &&
    !!s &&
    sel.kind === s.kind &&
    (sel.kind === 'relic' || (s as { i: number }).i === (sel as { i: number }).i);
  const toggle = (s: Exclude<Selected, null>) => setSel((cur) => (isSel(s) ? null : s));

  // ⚠️ **Deux placements du détail, selon le POINTEUR.**
  //
  // - **À la souris, il SORT DU FLUX** : un flottant ancré à la pièce. Il
  //   s'affichait en dessous, sur sa propre ligne — la carte grandissait, la
  //   grille se réorganisait, et tout ce qui entourait la pièce cliquée se
  //   déplaçait. Pire d'une pièce à l'autre : une rune à trois substats et un
  //   artéfact à quatre lignes n'ont pas la même hauteur, donc enchaîner les
  //   clics faisait respirer la page à chaque fois.
  // - **Au doigt, il reste EN LIGNE, sous la roue.** C'est déjà la bonne
  //   place : il s'insère APRÈS ce qu'on a touché, qui ne bouge donc pas. Un
  //   flottant y serait le mauvais objet — il s'ouvrirait exactement là où le
  //   doigt vient de se poser, et la main masquerait ce qu'on voulait lire.
  //
  // Voir la règle générale dans spec/shared/design.md.
  const detail =
    sel?.kind === 'rune' && gear.runes[sel.i] ? (
      <RuneDetailBox rune={gear.runes[sel.i]} />
    ) : sel?.kind === 'artifact' && gear.artifacts[sel.i] ? (
      <ArtifactDetailBox artifact={gear.artifacts[sel.i]} />
    ) : sel?.kind === 'relic' && gear.relic ? (
      <RelicDetailBox relic={gear.relic} />
    ) : null;

  return (
    <div className="flex flex-row flex-wrap items-center justify-center gap-2 compact:flex-col">
      {/* Panneau de stats — voir StatPanel.tsx (base+bonus ↔ total au clic,
          largeur fixe pour ne jamais déplacer artéfacts/roue/relique).
          ⚠️ Sur sa PROPRE ligne sous `sm`. À 200 px il occupait plus de la
          moitié des 348 px utiles et poussait la roue à la ligne suivante,
          laissant les artéfacts seuls à côté de lui : l'équipement se lisait en
          trois morceaux séparés, alors qu'on le compare d'un coup d'œil. */}
      <StatPanel stats={stats} spdCible={spdCible} />

      {/* ⚠️ Artéfacts, roue et relique sur UNE SEULE ligne, quelle que soit la
          largeur : ce sont les trois faces d'un même équipement. Séparés, on
          perd la vue d'ensemble qu'on vient chercher. Ils tiennent sur 348 px
          une fois le panneau de stats sorti de la rangée — voir les tailles
          réduites de chaque bloc sous `sm`. */}
      {/* ⚠️ **Un SEUL groupe insécable** (`flex-none`, aucun `flex-wrap` à
          l'intérieur) — artéfacts, roue ET relique. Le `contents` du bureau
          en faisait trois items INDÉPENDANTS du conteneur `flex-wrap`
          ci-dessus : dans une colonne étroite, la roue puis la relique
          passaient seules à la ligne suivante, et la relique pouvait finir
          hors du champ visible (signalé en usage réel — « les reliques ont
          disparu » : elles n'avaient pas disparu des DONNÉES, seulement du
          cadre). Groupés, ils se déplacent ensemble ou pas du tout, ce que
          disait déjà l'intention d'origine juste au-dessus. */}
      <div className="flex flex-none items-center justify-center gap-2 compact:w-full compact:gap-1.5">
      {/* Artéfacts — détail dans un flottant ANCRÉ à l'emplacement (souris) ou
          en ligne sous la roue (doigt) : voir `detail` plus haut.
          ⚠️ **`ArtifactSlots` et non une boucle sur `gear.artifacts`.** Ce
          composant affiche TOUJOURS les deux emplacements (Attribut, Type), et
          grise celui qui est vide. La boucle, elle, ne rendait que les
          artéfacts PRÉSENTS : un monstre sans artéfact de type n'en montrait
          qu'un, sans qu'on sache s'il en manquait un ou si le monstre n'en
          portait qu'un — et sans artéfact du tout, le bloc disparaissait.
          C'est le même composant que l'Optimiseur utilise déjà. */}
      <ArtifactSlots
        artifacts={gear.artifacts}
        scale={scale}
        isSelected={(_a, i) => isSel({ kind: 'artifact', i })}
        onSelectArtifact={(_a, i) => toggle({ kind: 'artifact', i })}
        // ⚠️ Aucun flottant au DOIGT : le bloc en ligne s'en charge. Rendre les
        // deux donnerait deux détails ouverts pour un seul clic.
        // ⚠️ **Mêmes dimensions que pour une rune** (260 × 320) : les deux
        // cartes ont désormais la même coquille, donc le même encombrement — un
        // flottant plus étroit pour l'artéfact recréerait la différence de
        // gabarit qu'on vient de supprimer.
        renderOverlay={
          auDoigt
            ? undefined
            : (a, i, ancre) => (
                // ⚠️ `rembourrage="md"` + `encadre={false}` : le flottant pose
                // DÉJÀ bord + fond + coins arrondis, la carte n'a plus à poser
                // les siens — sans quoi les deux cadres, à des rayons
                // différents, se lisaient comme une carte dans une carte.
                <FlottantAuto
                  ouvert={isSel({ kind: 'artifact', i })}
                  ancre={ancre}
                  largeur={260}
                  hauteur={320}
                  rembourrage="md"
                >
                  <ArtifactDetailBox artifact={a} encadre={false} />
                </FlottantAuto>
              )
        }
      />

      {/* Roue de runes — voir RuneWheel.tsx.
          ⚠️ TOUJOURS rendue, même à 0 rune — pas conditionnée sur
          `gear.runes.length > 0`. `RuneWheel` se contente de `runes.map`,
          donc un slot sans rune montre déjà juste le fond de la roue, sans
          cadre dessus : même mécanique qu'un build partiel (une rune sur
          deux, par exemple), pas un état grisé à part à inventer. Un
          monstre sans aucune rune importée doit quand même montrer le
          fond de la roue, pas rien du tout — même principe que les
          emplacements d'`ArtifactSlots` toujours affichés au-dessus. */}
      <RuneWheel
        runes={gear.runes}
        scale={scale}
        isSelected={(_r, i) => isSel({ kind: 'rune', i })}
        onSelectRune={(_r, i) => toggle({ kind: 'rune', i })}
        renderOverlay={
          auDoigt
            ? undefined
            : (r, i, ancre) => (
                <FlottantAuto
                  ouvert={isSel({ kind: 'rune', i })}
                  ancre={ancre}
                  largeur={260}
                  hauteur={320}
                  rembourrage="md"
                >
                  {/* Pleine taille : ce flottant n'existe qu'à la souris, où
                      la carte ne se resserre pas d'elle-même.
                      `encadre={false}` : voir la même remarque sur l'artéfact
                      juste au-dessus. */}
                  <RuneDetailBox rune={r} encadre={false} />
                </FlottantAuto>
              )
        }
      />

      {/* Relique à droite.
          ⚠️ La teinte `star` est le code du JEU pour ce qui a de la valeur, pas
          un accent d'interface — et la ÉQUIPEMENT échappe à la règle du contour
          unique de 1 px, qui ne vaut que pour les composants d'INTERFACE. Une
          rune, un artéfact, une relique sélectionnés se mettent en valeur comme
          dans le jeu : halo doré, éclat, liseré appuyé. Voir la roue de runes et
          les emplacements d'artéfacts, qui font de même.
          ⚠️ Resserrée sous `sm` : elle partage la rangée avec les artéfacts et
          la roue, et son rembourrage de 10 px de chaque côté était le plus
          facile à rendre — le contenu, lui, ne se réduit pas. */}
      {gear.relic && (
        // ⚠️ `relative` : c'est l'ancre du flottant, qui s'y place en `absolute`.
        // Et `z-10` quand elle est ouverte, comme les emplacements d'artéfacts —
        // sans quoi la roue juste à côté recouvrirait le détail.
        <div
          ref={ancreRelique}
          className={`relative ${isSel({ kind: 'relic' }) ? 'z-10' : ''}`}
        >
          <ZoneCliquable
            onClick={() => toggle({ kind: 'relic' })}
            title="Voir la relique"
            aria-pressed={isSel({ kind: 'relic' })}
            className={`rounded-lg border px-2.5 py-2 text-center compact:px-1.5 compact:py-1.5 ${
              isSel({ kind: 'relic' })
                ? 'border-star bg-star/10 ring-1 ring-star/50'
                : 'border-border bg-panel/60 hoverable:border-accent'
            }`}
          >
            <div className="label">Relique</div>
            <div className="mt-0.5 text-xs font-bold text-ink compact:text-micro">
              {formatRelicMain(gear.relic.main)}
            </div>
          </ZoneCliquable>
          {!auDoigt && (
            <FlottantAuto
              ouvert={isSel({ kind: 'relic' })}
              ancre={ancreRelique}
              largeur={220}
              hauteur={120}
              rembourrage="md"
            >
              <RelicDetailBox relic={gear.relic} encadre={false} />
            </FlottantAuto>
          )}
        </div>
      )}
      </div>

      {/* Au DOIGT : le détail sur sa propre ligne, sous la roue — voir plus
          haut. La souris, elle, le reçoit dans un flottant ancré à la pièce. */}
      {auDoigt && detail && <div className="mx-auto w-full max-w-[280px]">{detail}</div>}
    </div>
  );
}
