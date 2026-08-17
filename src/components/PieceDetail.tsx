import { ReactNode, useState } from 'react';
import { RotateCw } from 'lucide-react';
import { ArtifactDetail, RuneDetail } from '../types';
import {
  formatRuneEffect,
  formatArtifactMain,
  splitArtifactSub,
  RARITY_META,
  SET_BONUS,
  RUNE_EFFECT,
  runeEfficiency,
  runeScore,
} from '../lib/effects';
import { artifactScore, artifactEfficiency } from '../lib/artifacts';
import { COMPACT, useMediaQuery } from '../hooks/useMediaQuery';
import { RUNE_METRICS, formatRuneMetric, useRuneMetric } from '../hooks/useRuneMetric';
import { ZoneCliquable } from '../ui';

// Détail d'une PIÈCE ÉQUIPÉE — une rune, un artéfact —, façon jeu.
//
// ⚠️ **UNE SEULE carte pour les deux, partout dans l'app.** Elles étaient deux
// composants indépendants, écrits à six mois d'écart, et cela se voyait dès
// qu'on les ouvrait l'une après l'autre au même endroit : la rune posait sa
// rareté et sa mesure en colonne à droite de la stat principale, l'artéfact les
// mettait sur une ligne au-DESSUS ; l'une notait « Efficience 98,4 % », l'autre
// une jauge et un nombre nu. Deux cartes de largeurs et de hauteurs
// différentes, pour la même question — « qu'est-ce que je porte à cet
// emplacement ? ».
//
// La coquille ci-dessous porte donc tout ce qui est commun : le cadre, l'en-tête
// (image, stat principale, rareté, mesure), le bloc de lignes, le pied. Ne
// restent propres à chaque pièce que **ses lignes** — la meule et la gemme d'un
// côté, les procs de l'autre — et **son pied** : le bonus de set pour une rune,
// l'attribut ou le type pour un artéfact.
//
// ⚠️ **La rune est la référence, pas l'artéfact.** Sa disposition est celle du
// jeu : la valeur qu'on vient lire occupe la ligne, la rareté et la mesure se
// rangent au bord. C'est l'artéfact qui a été aligné dessus.

export interface RareteAffichee {
  label: string;
  bg: string;
  color: string;
  // Marque posée avant le libellé — la marque « Antique » d'une rune.
  marque?: ReactNode;
  titre?: string;
}

export interface MesureAffichee {
  libelle: string;
  valeur: string;
  hint?: string;
}

export function PieceDetailBox({
  icone,
  principale,
  secondaire,
  rarete,
  mesure,
  lignes,
  pied,
  resserre,
  onClick,
  ariaPressed,
  title,
  encadre = true,
}: {
  // Image de la pièce, posée à gauche de l'en-tête. Fournie par l'appelant : la
  // carte sert aussi dans un flottant où l'image est déjà à côté, sur la tuile
  // qui l'a ouvert.
  icone?: ReactNode;
  // La valeur qu'on vient lire : stat principale de la rune ou de l'artéfact.
  principale: ReactNode;
  // Sous la principale, en bleu : l'innée d'une rune. Un artéfact n'en a pas.
  secondaire?: ReactNode;
  rarete: RareteAffichee;
  mesure: MesureAffichee;
  lignes: ReactNode;
  pied?: ReactNode;
  // Rendu resserré : corps réduits, interlignes et marges rognés. Le contenu
  // reste le même — c'est la carte du jeu, et elle vaut d'être lue entière ;
  // seule la place qu'elle prend change.
  resserre: boolean;
  onClick?: (e: React.MouseEvent<HTMLElement>) => void;
  ariaPressed?: boolean;
  title?: string;
  // La carte porte-t-elle SON PROPRE cadre (bord, fond, coins arrondis) ?
  //
  // ⚠️ **`false` quand l'appelant est DÉJÀ une surface encadrée** — un
  // `Flottant`, qui pose son propre bord + fond + coins arrondis autour de son
  // contenu. Les deux cadres superposés, à des rayons différents (`rounded-xl`
  // du flottant contre `rounded-lg` ici), se lisaient comme une carte dans une
  // carte : un liseré visible à un pixel du bord, et un angle qui ne suit pas
  // l'autre. Un seul cadre à la fois — voir `DesyncBadge`, qui a posé la même
  // règle en premier. Le rembourrage passe alors au FLOTTANT (`rembourrage`),
  // pas ici : sans cadre, cette carte n'a plus de bord à en tenir éloigné.
  encadre?: boolean;
}) {
  return (
    // ⚠️ Fond OPAQUE : cette carte s'affiche aussi À PLAT dans une grille (voir
    // `encadre`), où un fond translucide laisserait voir les tuiles derrière.
    <ZoneCliquable
      // ⚠️ `imbrique` : la carte est posée DANS un flottant lui-même cliquable,
      // et un `<button>` dans un `<button>` est du HTML invalide. Sans `onClick`,
      // le composant ne prend ni rôle ni `tabIndex` — voir ZoneCliquable.
      imbrique
      onClick={onClick}
      aria-pressed={ariaPressed}
      title={title}
      className={
        encadre
          ? `rounded-lg border border-border bg-panel2 ${resserre ? 'p-2' : 'p-3'} ${
              onClick ? 'cursor-pointer transition hoverable:border-accent' : ''
            }`
          : onClick
            ? 'cursor-pointer transition'
            : ''
      }
    >
      {/* En-tête : l'image à gauche, la stat principale au centre, la rareté et
          la mesure à droite. ⚠️ Sur une seule ligne en compact : elles
          occupaient leur propre bloc en haut à droite, soit deux lignes rien que
          pour elles. */}
      <div className="flex items-start gap-2">
        {icone}
        <div className="min-w-0 flex-1">
          <div className={`font-black leading-tight text-ink ${resserre ? 'text-sm' : 'text-base'}`}>
            {principale}
          </div>
          {secondaire && (
            <div
              className={`font-semibold leading-tight text-water ${
                resserre ? 'text-micro' : 'text-sm'
              }`}
            >
              {secondaire}
            </div>
          )}
        </div>
        <div className="flex flex-none flex-col items-end">
          {/* ⚠️ En compact, la bannière perd son espacement de lettres et se
              resserre : c'est ELLE qui dictait la largeur minimale de la tuile
              (« LÉGENDAIRE » en capitales espacées), donc celle de toute la
              grille. Les couleurs et le mot restent — c'est le vocabulaire du
              jeu —, seule la place qu'ils prennent change. */}
          <span
            className={`inline-flex items-center gap-1 rounded font-bold uppercase ${
              resserre ? 'px-1.5 py-px text-micro' : 'px-2 py-0.5 text-micro tracking-wide'
            }`}
            style={{ background: rarete.bg, color: rarete.color }}
            title={rarete.titre}
          >
            {rarete.marque}
            {rarete.label}
          </span>
          {/* Mesure choisie globalement (menu ⚙) — le même libellé et la même
              couleur pour une rune et pour un artéfact. */}
          <span className="mt-0.5 font-mono text-micro tabular-nums text-ink-dim" title={mesure.hint}>
            {mesure.libelle} <b className="text-star">{mesure.valeur}</b>
          </span>
        </div>
      </div>

      {/* Lignes de la pièce : substats.
          ⚠️ Tout ALIGNÉ À GAUCHE, valeur collée à son libellé — et non la valeur
          poussée au bord droit de la case. C'est le rendu du jeu, et c'est le
          bon : « VIT +26 +5 » se lit d'un bloc, là où une valeur cadrée à droite
          oblige l'œil à traverser du vide sur chaque ligne. */}
      <div
        className={`border-t border-border/40 ${
          resserre ? 'mt-1.5 space-y-px pt-1.5' : 'mt-2 space-y-1 pt-2'
        }`}
      >
        {lignes}
      </div>

      {/* Pied : le bonus de set d'une rune, l'attribut ou le type d'un
          artéfact. Même place et même couleur dans les deux cas. */}
      {pied && (
        <div
          className={`border-t border-border/40 text-good ${
            resserre ? 'mt-1.5 pt-1.5 text-micro leading-tight' : 'mt-2 pt-2 text-xs'
          }`}
        >
          {pied}
        </div>
      )}
    </ZoneCliquable>
  );
}

// Une ligne du bloc de substats — même corps et même interligne pour les deux
// pièces, quel que soit ce qu'elle porte.
function Ligne({
  resserre,
  vise = false,
  children,
}: {
  resserre: boolean;
  // Ligne recherchée : liseré d'accent + fond léger, comme sur une tuile
  // d'artéfact. Les compensations annulent exactement le liseré, sinon la ligne
  // visée se décale par rapport aux autres.
  vise?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`flex items-start gap-1 leading-tight ${resserre ? 'text-micro' : 'text-xs'} ${
        vise ? '-mx-1 rounded border-l-2 border-accent bg-accent/[0.08] pl-[2px] pr-1' : ''
      }`}
    >
      {children}
    </div>
  );
}

// Marque « Antique » : A droit, pieds plats, barre centrale = triangle plein
// qui ne touche pas les bords. Intégrée dans la bannière de rareté.
function AncientMark({ size = 12, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className="flex-none" aria-hidden="true">
      <g stroke={color} strokeWidth="2.2" strokeLinecap="butt" strokeLinejoin="miter" fill="none">
        <path d="M12 3.5 L4.5 20.5" />
        <path d="M12 3.5 L19.5 20.5" />
        <path d="M8 14.5 H16" />
        <path d="M2.6 20.5 H7" />
        <path d="M17 20.5 H21.4" />
      </g>
      {/* triangle plein central, détaché des bords */}
      <path d="M12 8.8 L14.4 13.4 L9.6 13.4 Z" fill={color} />
    </svg>
  );
}

// ── Rune ────────────────────────────────────────────────────────────────────

export function RuneDetailBox({
  rune,
  icone,
  compact,
  cherches,
  encadre = true,
}: {
  rune: RuneDetail;
  icone?: ReactNode;
  // ⚠️ **Par défaut, AU DOIGT.** La carte s'ouvre sous une rune du siège ou de
  // la prépa RTA, écrans où elle est déjà le troisième niveau de détail : en
  // pleine taille elle y occupait un demi-écran. Les tuiles de liste passent
  // `true` explicitement, la fiche d'un monstre `false` — un appel explicite
  // l'emporte toujours.
  compact?: boolean;
  // Codes recherchés → la ligne correspondante est surlignée (écho du filtre).
  cherches?: Set<number>;
  // Voir `PieceDetailBox` : `false` dans un `Flottant`, qui pose déjà le sien.
  encadre?: boolean;
}) {
  const auDoigt = useMediaQuery(COMPACT);
  const resserre = compact ?? auDoigt;
  const rarity = RARITY_META[rune.rarity] ?? RARITY_META[1];
  const bonus = SET_BONUS[rune.set];
  const ancient = rune.rank > 10;
  const metric = useRuneMetric();
  const metricHint = RUNE_METRICS.find((m) => m.key === metric)?.hint;

  // ── Détail / total, au clic ─────────────────────────────────────────────
  //
  // Le jeu montre « VIT +26 +5 » : la valeur d'origine et ce que la meule a
  // ajouté. C'est ce qu'il faut pour juger une rune — mais pas pour la comparer
  // à un minimum, où seul le TOTAL compte. Un clic bascule donc entre les deux
  // lectures, sur toute la carte.
  //
  // ⚠️ Le total prend la couleur du BONUS (orange), pas celle de la base : il
  // n'est plus la valeur d'origine, et le garder en blanc laisserait croire
  // qu'on lit toujours la base. La couleur dit « ce nombre inclut la meule ».
  const [total, setTotal] = useState(false);
  // Une rune sans aucune meule n'a rien à basculer : les deux lectures y sont
  // identiques, et un clic sans effet se lit comme un défaut.
  const aDeLaMeule = rune.subs.some((s) => (s.grind ?? 0) > 0);

  return (
    <PieceDetailBox
      icone={icone}
      resserre={resserre}
      encadre={encadre}
      principale={formatRuneEffect(rune.main)}
      secondaire={rune.innate ? formatRuneEffect(rune.innate) : undefined}
      rarete={{
        label: rarity.label,
        bg: rarity.bg,
        color: rarity.color,
        marque: ancient ? <AncientMark size={resserre ? 10 : 12} color={rarity.color} /> : undefined,
        titre: ancient ? 'Rune antique' : undefined,
      }}
      mesure={{
        libelle: metric === 'eff' ? 'Efficience' : 'Score SW',
        valeur: formatRuneMetric(metric === 'eff' ? runeEfficiency(rune) : runeScore(rune), metric),
        hint: metricHint,
      }}
      // ⚠️ `stopPropagation` : dans un flottant, le clic de la zone environnante
      // referme la surface. Sans ça, basculer les valeurs fermait le détail
      // qu'on est en train de lire.
      onClick={
        aDeLaMeule
          ? (e) => {
              e.stopPropagation();
              setTotal((v) => !v);
            }
          : undefined
      }
      ariaPressed={aDeLaMeule ? total : undefined}
      title={
        aDeLaMeule
          ? total
            ? 'Voir le détail (valeur d’origine + meule)'
            : 'Voir les valeurs totales, meule comprise'
          : undefined
      }
      lignes={rune.subs.map((s, i) => {
        const def = RUNE_EFFECT[s.code];
        const label = def
          ? def.label.endsWith('%')
            ? def.label.slice(0, -1)
            : def.label
          : `#${s.code}`;
        const suffix = def?.suffix ?? '';
        const grind = s.grind ?? 0;
        const base = s.value - grind;
        return (
          <Ligne key={i} resserre={resserre} vise={cherches?.has(s.code) ?? false}>
            {total ? (
              // Cumulé. ⚠️ En ORANGE (la couleur du bonus) dès qu'une meule
              // entre dedans : le nombre n'est plus la valeur d'origine, et le
              // laisser en blanc ferait croire qu'on lit toujours la base.
              <span className={grind > 0 ? 'font-semibold text-orange-400' : 'text-ink'}>
                {label} {s.value}
                {suffix}
              </span>
            ) : (
              <>
                <span className="text-ink">
                  {label} {base}
                  {suffix}
                </span>
                {grind > 0 && (
                  <span className="font-semibold text-orange-400">
                    +{grind}
                    {suffix}
                  </span>
                )}
              </>
            )}
            {s.enchant && <RotateCw size={11} className="flex-none text-orange-400" />}
          </Ligne>
        );
      })}
      pied={bonus ? `${bonus.pieces} Set : ${bonus.label}` : undefined}
    />
  );
}

// ── Artéfact ────────────────────────────────────────────────────────────────

// Libellé de la catégorie d'artéfact, pour la ligne du bas. Les noms du JEU :
// **Attribut** et **Type** — `element` / `archetype` ne sont que les clés des
// données com2us et ne doivent pas remonter à l'écran.
const ELEMENT_FR: Record<string, string> = {
  fire: 'Feu', water: 'Eau', wind: 'Vent', light: 'Lumière', dark: 'Ténèbres', unknown: '—',
};
const ARCHETYPE_FR: Record<string, string> = {
  attack: 'Attaque', defense: 'Défense', hp: 'PV', support: 'Support',
};
function artifactTypeLabel(a: ArtifactDetail): string {
  return a.kind === 'element'
    ? `Attribut · ${ELEMENT_FR[a.element ?? 'unknown'] ?? '—'}`
    : `Type · ${ARCHETYPE_FR[a.archetype ?? ''] ?? '—'}`;
}

export function ArtifactDetailBox({
  artifact,
  compact,
  encadre = true,
}: {
  artifact: ArtifactDetail;
  compact?: boolean;
  // Voir `PieceDetailBox` : `false` dans un `Flottant`, qui pose déjà le sien.
  encadre?: boolean;
}) {
  const auDoigt = useMediaQuery(COMPACT);
  const resserre = compact ?? auDoigt;
  const rarity = RARITY_META[artifact.rarity] ?? RARITY_META[1];
  // Réglage global (menu ⚙), partagé avec les runes — pas un état local.
  const metric = useRuneMetric();
  const metricHint = RUNE_METRICS.find((m) => m.key === metric)?.hint;

  return (
    <PieceDetailBox
      resserre={resserre}
      encadre={encadre}
      principale={formatArtifactMain(artifact.main)}
      rarete={{ label: rarity.label, bg: rarity.bg, color: rarity.color }}
      // ⚠️ Le même libellé que pour une rune (« Efficience » / « Score SW »), et
      // non une jauge muette suivie d'un nombre : les deux mesures sont la même
      // somme à un facteur près (spec/compte/calcul-artefacts.md §3), et rien ne
      // justifiait de les nommer autrement d'une pièce à l'autre. L'autre valeur
      // reste en infobulle.
      mesure={{
        libelle: metric === 'eff' ? 'Efficience' : 'Score SW',
        valeur:
          metric === 'eff'
            ? `${artifactEfficiency(artifact).toFixed(1)} %`
            : String(artifactScore(artifact)),
        hint:
          metricHint ??
          `Score ${artifactScore(artifact)} · efficience ${artifactEfficiency(artifact).toFixed(1)} %`,
      }}
      // Substats, disposés comme dans le JEU : le nombre de PROCS dans une
      // pastille à GAUCHE, puis le libellé dont la **valeur est teintée**
      // différemment du texte qui l'entoure.
      // ⚠️ Les procs sont ce qui sépare un bon artéfact d'un mauvais — deux
      // pièces aux mêmes lignes ne valent pas pareil selon où les améliorations
      // sont tombées. Sans eux, la fiche n'expliquait pas le score affiché juste
      // au-dessus.
      lignes={artifact.subs.map((s, j) => {
        const procs = s.rolls ?? 0;
        const { avant, valeur, apres } = splitArtifactSub(s);
        return (
          <Ligne key={j} resserre={resserre}>
            {/* Pastille de procs : verte dès qu'une amélioration est tombée,
                neutre à zéro — on repère les lignes travaillées d'un coup
                d'œil, sans lire les chiffres. */}
            <span
              className={`flex-none rounded px-1 font-mono text-micro font-bold tabular-nums ${
                procs > 0 ? 'bg-good/20 text-good' : 'bg-ink-dim/15 text-ink-dim'
              }`}
              title={`${procs} amélioration${procs > 1 ? 's' : ''} sur cette ligne`}
            >
              {procs}
            </span>
            <span className="flex-1 text-ink-dim">
              {avant}
              {/* La VALEUR se détache du libellé : c'est elle qu'on compare d'un
                  artéfact à l'autre, le texte ne fait que la nommer. */}
              <b className="text-ink">{valeur}</b>
              {apres}
            </span>
            {s.enchant && <RotateCw size={11} className="flex-none text-orange-400" />}
          </Ligne>
        );
      })}
      pied={artifactTypeLabel(artifact)}
    />
  );
}
