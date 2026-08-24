import { useLayoutEffect, useRef, useState } from 'react';
import { Ban } from 'lucide-react';
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

  // ── Mise à l'échelle du groupe artéfacts + roue + relique ─────────────
  // ⚠️ **Sur la largeur RÉELLEMENT reçue, pas sur le type de pointeur.**
  // L'adaptation de ce groupe n'a longtemps eu qu'un seul ressort : `COMPACT`
  // (`pointer: coarse`) réduisait artéfacts et roue à 0,72 au doigt — une
  // question de POINTEUR, jamais de place. Même classe de défaut que le
  // `dense` des `Segmented` piloté par un seuil de FENÊTRE (voir
  // Segmented.tsx) : ni le pointeur ni la fenêtre ne disent quoi que ce soit
  // de la largeur d'un CONTENEUR.
  //
  // ⚠️ **`transform: scale()` et non le prop `scale` d'ArtifactSlots/RuneWheel.**
  // Deux raisons. 1) Le prop change la taille de LAYOUT : une fois réduit, le
  // groupe ne déborde plus, donc on repasserait à l'échelle 1, donc il
  // déborderait de nouveau — l'oscillation que `Segmented` évite avec une
  // copie de mesure, ici impossible sans dupliquer roue et images. Un
  // `transform` ne touche PAS au layout : `offsetWidth` reste la largeur
  // naturelle, la mesure est donc stable par construction. 2) Il met à
  // l'échelle TOUT le groupe d'un coup — y compris le rembourrage et le texte
  // de la relique, que le prop `scale` ne sait pas atteindre (il ne va qu'aux
  // deux composants qui l'exposent).
  const racineRef = useRef<HTMLDivElement>(null);
  const statPanelRef = useRef<HTMLDivElement>(null);
  const groupeRef = useRef<HTMLDivElement>(null);
  // ⚠️ **UN SEUL état, et une garde d'égalité qui renvoie `prev` à
  // l'identique** — indispensable, pas une optimisation. La boîte de réserve
  // (plus bas) prend la largeur qu'on calcule ici, ce qui change la largeur
  // de CONTENU de la carte parente, donc la place disponible, donc la
  // mesure : la boucle est réelle. Elle CONVERGE (chaque tour réduit l'écart,
  // 3 à 4 tours suffisent), mais seulement si un état inchangé cesse de
  // provoquer un rendu — trois `useState` séparés, ou un objet reconstruit à
  // chaque mesure, tourneraient sans fin même une fois la valeur stabilisée.
  // L'arrondi de l'échelle sert le même but : sans lui, deux mesures
  // équivalentes à 10⁻¹⁵ près relanceraient un tour.
  const [mesure, setMesure] = useState<{ w: number; h: number; s: number } | null>(null);

  useLayoutEffect(() => {
    const racine = racineRef.current;
    const groupe = groupeRef.current;
    if (!racine || !groupe) return;
    const verifier = () => {
      // ⚠️ `offsetWidth`/`offsetHeight` et NON `getBoundingClientRect()` : le
      // premier rend la boîte de LAYOUT, insensible au `transform` qu'on
      // applique nous-mêmes juste en dessous — le second l'inclurait, et la
      // mesure se mordrait la queue.
      const naturelW = groupe.offsetWidth;
      const naturelH = groupe.offsetHeight;
      // ⚠️ **Deux façons de calculer la place disponible, format par format —
      // demande explicite au doigt (« la fiche de stats, les artéfacts, les
      // runes ainsi que la relique tiennent alignés ensemble »), jamais
      // touché sur bureau (voir CLAUDE.md, deux formats de premier rang).
      // - **Bureau (inchangé)** : la largeur de la RACINE entière. Un groupe
      //   trop large pour tenir à côté du panneau de stats passe à la ligne
      //   suivante (le VRAI `flex-wrap` du navigateur en décide, pas ce
      //   calcul), où il reçoit alors toute la largeur de la racine —
      //   comparer à la racine couvre donc les deux cas (côte à côte, ou
      //   passé à la ligne) d'une seule mesure.
      // - **Au doigt** : la largeur de la racine MOINS le panneau de stats
      //   (largeur FIXE, jamais réduite — voir StatPanel.tsx) et l'écart
      //   entre les deux (`gap-2` du conteneur, 8px). Comparer à la racine
      //   entière, comme au bureau, aurait laissé le groupe s'afficher à sa
      //   taille naturelle (elle tient dans la racine PLEINE largeur) sans
      //   jamais tenir compte de la place déjà prise par le panneau de
      //   stats sur LA MÊME ligne — le vrai `flex-wrap` l'aurait alors
      //   renvoyé à la ligne suivante, l'empêchant justement de rester
      //   aligné avec panneau/artéfacts/roue/relique.
      const dispo = auDoigt ? racine.clientWidth - (statPanelRef.current?.offsetWidth ?? 0) - 8 : racine.clientWidth;
      if (naturelW <= 0 || dispo <= 0) return;
      // ⚠️ **Formule CONTINUE, sans branche — un saut entre deux calculs
      // (« serré à côté » / « repli pleine largeur ») a été tenté puis
      // RETIRÉ : signalé en usage réel comme un comportement de SACCADE.
      // Cause : si le ratio `dispo/naturelW` frôle le seuil du saut, un écart
      // de mesure d'à peine 1px (arrondi de `offsetWidth`) suffit à faire
      // basculer d'un côté puis de l'autre du seuil — chaque bascule change
      // la présentation du groupe (minuscule ↔ pleine taille + passé à la
      // ligne), donc la HAUTEUR de la racine, donc redéclenche l'observateur
      // sur cette même hauteur : un aller-retour sans fin, pas un cas rare.
      // Un simple `Math.max` (plancher) est CONTINU — jamais deux branches de
      // calcul qui se disputent le même seuil, jamais de saut.
      const s = Math.round(Math.max(auDoigt ? 0.55 : 0, Math.min(1, dispo / naturelW)) * 1000) / 1000;
      setMesure((prev) =>
        prev && prev.w === naturelW && prev.h === naturelH && prev.s === s ? prev : { w: naturelW, h: naturelH, s }
      );
    };
    verifier();
    const ro = new ResizeObserver(verifier);
    ro.observe(racine);
    ro.observe(groupe);
    return () => ro.disconnect();
  }, [auDoigt]);

  // ⚠️ À l'échelle 1 (le cas de très loin le plus courant), AUCUN style n'est
  // posé : le rendu reste alors strictement identique à ce qu'il était avant
  // l'ajout de cette mesure.
  const reduit = mesure !== null && mesure.s < 1;

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
    <div ref={racineRef} className="flex flex-row flex-wrap items-center justify-center gap-2">
      {/* Panneau de stats — voir StatPanel.tsx (base+bonus ↔ total au clic,
          largeur fixe pour ne jamais déplacer artéfacts/roue/relique).
          ⚠️ **Reste sur la MÊME ligne qu'artéfacts/roue/relique, même au
          doigt** (demande explicite : « la fiche de stats, les artéfacts,
          les runes ainsi que la relique tiennent alignés ensemble pour
          gagner de l'espace ») — le groupe voisin s'adapte à la place
          restante APRÈS ce panneau (voir la mesure ci-dessus), plutôt que
          l'inverse : ce panneau ne rétrécit JAMAIS (largeur fixe
          délibérée), c'est lui qui fixe la contrainte. `ref` : sert à
          mesurer sa largeur réelle pour le calcul ci-dessus plutôt que de
          recopier sa constante ici, qui pourrait diverger un jour. */}
      <div ref={statPanelRef} className="flex-none">
        <StatPanel stats={stats} spdCible={spdCible} />
      </div>

      {/* ⚠️ Artéfacts, roue et relique sur UNE SEULE ligne, quelle que soit la
          largeur : ce sont les trois faces d'un même équipement. Séparés, on
          perd la vue d'ensemble qu'on vient chercher. */}
      {/* ⚠️ **Un SEUL groupe insécable** (`flex-none`, aucun `flex-wrap` à
          l'intérieur) — artéfacts, roue ET relique. Le `contents` du bureau
          en faisait trois items INDÉPENDANTS du conteneur `flex-wrap`
          ci-dessus : dans une colonne étroite, la roue puis la relique
          passaient seules à la ligne suivante, et la relique pouvait finir
          hors du champ visible (signalé en usage réel — « les reliques ont
          disparu » : elles n'avaient pas disparu des DONNÉES, seulement du
          cadre). Groupés, ils se déplacent ensemble ou pas du tout, ce que
          disait déjà l'intention d'origine juste au-dessus. */}
      {/* ⚠️ Boîte qui RÉSERVE la place du groupe à l'échelle appliquée. Un
          `transform` ne change pas la boîte de layout : sans elle, un groupe
          réduit laisserait derrière lui le vide de sa taille pleine. Aucun
          style tant que rien n'est réduit (voir `reduit`). */}
      <div
        className="flex-none"
        style={
          reduit
            ? { width: Math.round(mesure!.w * mesure!.s), height: Math.round(mesure!.h * mesure!.s) }
            : undefined
        }
      >
      <div
        ref={groupeRef}
        // `origin-top-left` : le groupe réduit reste calé sur le coin de la
        // boîte ci-dessus, dont les dimensions sont calculées depuis ce même
        // coin — un `transform-origin` centré l'en décalerait de la moitié de
        // ce qu'il a perdu.
        //
        // ⚠️ **Plus de `compact:w-full`** — cette classe forçait le groupe à
        // occuper toute la largeur de sa propre ligne, EXACTEMENT ce qui
        // l'empêchait de rester à côté du panneau de stats au doigt. La mise
        // à l'échelle ci-dessus s'en charge désormais.
        style={reduit ? { transform: `scale(${mesure!.s})`, transformOrigin: 'top left' } : undefined}
        className="flex flex-none items-center justify-center gap-2 compact:gap-1.5"
      >
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
          facile à rendre — le contenu, lui, ne se réduit pas.
          ⚠️ **Emplacement TOUJOURS affiché**, grisé quand le monstre n'a pas de
          relique — jamais absent (demande explicite) : même principe que
          `ArtifactSlots` (toujours 2 emplacements, un vide grisé à l'icône
          `Ban`) et la roue de runes (toujours rendue, même à 0 rune). Sans
          relique, la case n'a rien à ouvrir : pas de `ZoneCliquable`/
          `FlottantAuto`, juste un cadre statique. */}
      {gear.relic ? (
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
      ) : (
        <div
          title="Aucune relique équipée"
          className="rounded-lg border border-border bg-panel/60 px-2.5 py-2 text-center opacity-40 compact:px-1.5 compact:py-1.5"
        >
          <div className="label">Relique</div>
          <div className="mt-0.5 flex items-center justify-center">
            <Ban size={16} className="text-ink-dim compact:hidden" />
            <Ban size={13} className="hidden text-ink-dim compact:block" />
          </div>
        </div>
      )}
      </div>
      </div>

      {/* Au DOIGT : le détail sur sa propre ligne, sous la roue — voir plus
          haut. La souris, elle, le reçoit dans un flottant ancré à la pièce. */}
      {auDoigt && detail && <div className="mx-auto w-full max-w-[280px]">{detail}</div>}
    </div>
  );
}
