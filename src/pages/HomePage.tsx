import { useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { motion } from 'framer-motion';
import {
  BookOpen,
  Swords,
  Users,
  ArrowRight,
  Castle,
  Trophy,
  UserRound,
  Calculator,
  Lightbulb,
  Tag,
  LayoutGrid,
  Upload,
  Download,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Gem,
  Timer,
} from 'lucide-react';
import ElementIcon from '../components/ElementIcon';
import { ElementKey } from '../types';
import { RELEASES, libelleVersion } from '../data/releases';
import { Bouton } from '../ui';
import {
  COULEUR_SECTION,
  COULEUR_RTA_SUB,
  COULEUR_SIEGE_SUB,
  COULEUR_COMPTE_SUB,
  TEINTE_CLAIRE,
} from '../data/couleursSection';

const ELEMENT_ORDER: ElementKey[] = ['fire', 'water', 'wind', 'light', 'dark'];
const SW_EXPORTER = 'https://github.com/Xzandro/sw-exporter';

// ⚠️ La MÊME courbe que le reste de l'app (`--ease-out` de index.css), écrite
// ici en points de Bézier : Framer ne lit pas les variables CSS dans `ease`.
// L'`'easeOut'` natif qui était posé là est plus mou — la page d'accueil
// démarrait sur une courbe que rien d'autre n'utilise.
// Voir la section « Mouvement » de spec/shared/design.md.
const EASE_OUT = [0.23, 1, 0.32, 1] as const;

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } },
};
const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE_OUT } },
};

// Carte de l'accueil — le gabarit de la refonte graphique (lot 5) : fond de
// panneau, contour discret, rayon 12 ; au survol, le fond s'appuie et le
// contour se précise. ⚠️ Plus de soulèvement : la carte dit « cliquable » par
// son fond, comme les entrées du menu. La COULEUR, elle, reste (voir `Tuile`
// et `Halo`).
const CARTE = 'rounded-xl border border-border-soft bg-panel';
const CARTE_LIEN = `${CARTE} transition-colors hoverable:border-border hoverable:bg-panel2`;

// Ce que l'accueil sait de l'état local du joueur. Tout vient de `App` : ce sont
// les mêmes états que les pages outils, sans calcul ni stockage supplémentaire.
export interface HomeStats {
  rta: number; // monstres en prépa RTA
  defense: number; // équipes de siège en défense
  offense: number; // équipes de siège en offense
  recos: number; // recommandations enregistrées
}

interface Props {
  stats: HomeStats;
  onImport: (text: string) => void;
}

// ⚠️ L'accueil est une PAGE D'ENTRÉE, pas un sommaire.
//
// Une grille de cartes identique pour tout le monde ne retient personne : le
// visiteur ne sait pas par où commencer, et l'habitué doit re-naviguer à chaque
// visite vers l'endroit qu'il ne quitte jamais. La page répond donc à deux
// publics dans cet ordre :
//
//  1. **le premier geste, tout de suite** : la zone de dépôt du fichier est
//     dans le héros. L'import était caché dans la barre de nav — le seul geste
//     qui débloque l'outil ne doit pas être à chercher ;
//  2. **« Ton espace »** : dès qu'il y a des données locales, un bandeau donne
//     les vrais chiffres et renvoie dans la sous-section exacte.
//
// Puis « comment ça marche », les fonctionnalités et un dernier appel. Le
// bandeau de version en fin de page donne la raison de revenir.
//
// ⚠️ **Refonte graphique, lot 5 — la structure est GARDÉE** (décision 10 de
// Thomas), seul le style change : cartes de la refonte, icônes dans une tuile
// À LA TEINTE de leur section (décision 3 précisée le 2026-09-25 : Thomas
// aimait les couleurs de l'accueil — elles restent ici, le menu reste neutre),
// bouton principal plein (décision 4).
export default function HomePage({ stats, onImport }: Props) {
  // ⚠️ La dernière version PUBLIÉE, pas `RELEASES[0]` : une version en
  // préparation est en tête du journal sans être en ligne. L'annoncer ici
  // promettrait au visiteur des nouveautés qu'il ne trouvera pas dans l'app.
  const derniere = RELEASES.find((r) => r.version !== null) ?? RELEASES[0];
  const aDesDonnees = stats.rta > 0 || stats.defense > 0 || stats.offense > 0 || stats.recos > 0;
  // Le bouton du dernier appel ouvre le sélecteur de fichier, comme la zone de
  // dépôt du héros — même `onImport`, donc un seul chemin d'import.
  const ctaRef = useRef<HTMLInputElement>(null);

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="pt-4">
      {/* ---- Héros : promesse à gauche, action à droite ------------------- */}
      {/* ⚠️ **Au doigt, resserré** (refonte graphique, lot 11a, décision 24) :
          la structure est gardée, seules les marges verticales et la zone de
          dépôt se tassent (`max-lg:`) — le bureau ne bouge pas. */}
      <header className="grid lg:grid-cols-[1.1fr_0.9fr] gap-8 items-center pt-6 pb-10 max-lg:gap-5 max-lg:pt-2 max-lg:pb-6">
        <motion.div variants={item} className="max-w-xl">
          {/* ⚠️ Le NOM du site reste le titre. Sur desktop la barre de nav ne
              porte pas la marque (elle n'apparaît qu'en version repliée) : sans
              ce titre, on ne sait plus sur quel site on est. L'accroche vient
              juste après, en sous-titre. */}
          <div className="flex items-center gap-3">
            <img
              src={`${import.meta.env.BASE_URL}favicon.svg`}
              alt=""
              className="w-[clamp(38px,6vw,64px)] h-[clamp(38px,6vw,64px)] flex-none drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)]"
            />
            <h1 className="font-display font-black text-[clamp(40px,7vw,76px)] leading-[0.95] title-gradient">
              SW&nbsp;Forge
            </h1>
          </div>

          <p className="mt-3 max-w-lg font-display text-[clamp(18px,2.4vw,26px)] leading-tight tracking-wide text-ink">
            La boîte à outils pour Summoners&nbsp;War.
          </p>

          <p className="mt-3 max-w-lg text-base leading-relaxed text-ink-dim">
            Runes, RTA, siège, analyse de compte. Importe ton export SWEX et tout est calculé{' '}
            <b className="text-ink">dans ton navigateur</b>.
          </p>

          {/* Vague d'éléments centrée sous le texte : alignée à gauche, elle
              pendait sous le dernier paragraphe sans rien équilibrer.
              ⚠️ Les icônes d'élément sont des RENDUS DU JEU : leur couleur
              reste, comme partout. */}
          <div className="mt-6 flex items-center justify-center gap-4">
            {ELEMENT_ORDER.map((el, i) => (
              <motion.div
                key={el}
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut', delay: i * 0.18 }}
              >
                <ElementIcon element={el} size={22} className="drop-shadow-[0_3px_8px_rgba(0,0,0,0.5)]" />
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.div variants={item}>
          <Dropzone onImport={onImport} />
        </motion.div>
      </header>

      {/* ---- Reprise (habitués) ------------------------------------------- */}
      {aDesDonnees && (
        <motion.section variants={item} className="pb-10 max-lg:pb-6">
          {/* ⚠️ Titre NEUTRE : ce bloc apparaît dès le premier import, pas
              seulement au retour. « Reprends où tu en étais » accueillait donc
              un débutant en lui parlant d'un passé qu'il n'a pas. */}
          <SectionTitle icon={LayoutGrid} title="Ton espace" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Resume href="#/rta" icon={Swords} accent={COULEUR_SECTION.rta} value={stats.rta} unit={stats.rta > 1 ? 'monstres' : 'monstre'} label="Prépa RTA" />
            <Resume href="#/siege/defense" icon={Castle} accent={COULEUR_SIEGE_SUB.defense} value={stats.defense} unit={stats.defense > 1 ? 'équipes' : 'équipe'} label="Défense de siège" />
            <Resume href="#/siege/offense" icon={Swords} accent={COULEUR_SIEGE_SUB.offense} value={stats.offense} unit={stats.offense > 1 ? 'équipes' : 'équipe'} label="Offense de siège" />
            <Resume href="#/siege/recommandations" icon={Lightbulb} accent={COULEUR_SIEGE_SUB.recos} value={stats.recos} unit={stats.recos > 1 ? 'recos' : 'reco'} label="Recommandations" />
          </div>
        </motion.section>
      )}

      <Separator />

      {/* ---- Comment ça marche -------------------------------------------- */}
      <motion.section variants={item} id="comment" className="py-12 max-lg:py-6">
        <h2 className="font-display text-[26px] tracking-wide mb-6 max-lg:mb-4">Comment ça marche</h2>
        {/* ⚠️ UNE carte, trois étapes séparées par des filets (la maquette) :
            une séquence qu'on lit de gauche à droite, pas trois cartes
            indépendantes. Empilées sous `md`, le filet passe en haut. */}
        <div className={`${CARTE} grid md:grid-cols-3`}>
          <Etape
            n="01"
            icon={Download}
            accent="#5B9DE0"
            title="Exporte ton compte"
            desc="Génère un fichier .json de ton compte avec SW Exporter, en lançant le jeu une fois."
            lien={{ href: SW_EXPORTER, label: 'SW Exporter' }}
          />
          <Etape
            n="02"
            icon={Upload}
            accent="#5EDB8F"
            title="Dépose le fichier"
            desc="Ici même, en haut de page. Rien n'est envoyé : tout se calcule dans ton navigateur."
          />
          <Etape
            n="03"
            icon={Sparkles}
            accent="#F2C24C"
            title="Prépare et optimise"
            desc="Runes, prépa RTA, équipes de siège et analyse de compte se remplissent d'un seul coup."
          />
        </div>
      </motion.section>

      <Separator />

      {/* ---- Fonctionnalités ---------------------------------------------- */}
      <motion.section variants={item} id="features" className="py-12 max-lg:py-6">
        <h2 className="font-display text-[26px] tracking-wide mb-6 max-lg:mb-4">Fonctionnalités</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Feature href="#/rta" icon={Swords} accent={COULEUR_SECTION.rta} kicker="RTA" title="Préparation RTA" body="Classe ta box par set en glisser-déposer et lis l'ordre de tour recalculé selon les leads." />
          <Feature href="#/rta/ami" icon={Users} accent={COULEUR_RTA_SUB.ami} kicker="RTA" title="Prépa d'un ami" body="Ouvre la prépa qu'un ami t'a exportée — ou son export SWEX complet — et regarde son classement, ses vitesses et son ordre de tour." />
          <Feature href="#/siege/defense" icon={Castle} accent={COULEUR_SECTION.siege} kicker="Siège" title="Défenses et offenses" body="Compose tes équipes et vérifie tes speed tune sur les ticks 239 et 286." />
          <Feature href="#/siege/recommandations" icon={Lightbulb} accent={COULEUR_SIEGE_SUB.recos} kicker="Partage" title="Recommandations" body="Décris tes decks, partage-les en JSON, et vois ce que ton compte peut jouer." />
          <Feature href="#/compte/runes" icon={UserRound} accent={COULEUR_COMPTE_SUB.runes} kicker="Compte" title="Analyse de runes" body="Résumé chiffré, efficience ou score SW, courbes, et ce que tes meules et gemmes en réserve permettent d'améliorer dès maintenant." />
          <Feature href="#/compte/artefacts" icon={Gem} accent={COULEUR_COMPTE_SUB.artefacts} kicker="Compte" title="Analyse d'artéfacts" body="Le score du jeu et l'efficience de chaque pièce, la distribution de ton stock et les propriétés que tu possèdes le plus." />
          <Feature href="#/outils/optimizer" icon={Sparkles} accent={COULEUR_SECTION.outils} kicker="Outils" title="Optimiseur de runes" body="Cherche, parmi les runes que tu possèdes déjà, la meilleure combinaison de 6 pour un monstre, un set et des minimums donnés." />
          <Feature href="#/outils/speed-tuning" icon={Timer} accent={COULEUR_SECTION.outils} kicker="Outils" title="Speed tuning" body="Tick par tick, vois quel monstre remplit sa barre d'action en premier — ton équipe et celle d'en face, pour savoir qui joue avant qui." />
          <Feature href="#/bestiary" icon={BookOpen} accent={COULEUR_SECTION.bestiary} kicker="Données" title="Bestiaire" body="Recherche et filtres par élément et étoiles naturelles, stats de base à portée de main." />
          <Feature href="#/mecaniques" icon={Calculator} accent={COULEUR_SECTION.mecaniques} kicker="Doc" title="Mécaniques" body="Vitesse de combat, barre d'action, équation des dégâts et facteur de défense." />
          <Feature href="#/releases" icon={Tag} accent={COULEUR_SECTION.releases} kicker="Suivi" title="Nouveautés" body="Ce qui change à chaque version : ajouts, corrections et calculs revus." />
          <Feature href="#/arene" icon={Trophy} accent={COULEUR_SECTION.arene} kicker="Arène" title="Arène classique" body="Préparation des équipes d'offense et de défense." soon />
        </div>
      </motion.section>

      {/* ---- Dernier appel -------------------------------------------------- */}
      <motion.section variants={item} className="py-12 max-w-xl max-lg:py-6">
        <h2 className="font-display text-[26px] tracking-wide">Prêt à préparer tes équipes ?</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-dim">
          Importe ton fichier SWEX et retrouve ta box, tes runes, ta prépa RTA et tes équipes de siège
          en quelques secondes.
        </p>
        {/* ⚠️ Il ouvre le sélecteur de fichier, il ne renvoie PAS à la zone de
            dépôt. C'était un lien `#depot` : avec le routage par hash il ne
            faisait rien de visible, et un bouton d'appel à l'action qui ne
            déclenche rien est pire que pas de bouton du tout.
            ⚠️ Le bouton PRINCIPAL de la librairie, plein (décision 4) : c'est
            le seul bouton de la page. */}
        <div className="mt-4">
          <Bouton
            ton="accent"
            fond="plein"
            icone={<Upload size={15} />}
            libelle="Importer mon compte"
            onClick={() => ctaRef.current?.click()}
          />
        </div>
        <input
          ref={ctaRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = ''; // permet de recharger le même fichier
            if (f) f.text().then(onImport);
          }}
        />
      </motion.section>

      {/* ---- Quoi de neuf : la raison de revenir ---------------------------- */}
      <motion.a
        variants={item}
        href="#/releases"
        className={`mb-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 ${CARTE_LIEN}`}
      >
        {/* ⚠️ Texte à l'ENCRE, pas à l'accent : accent sur accent/15 tombe à
            4,4:1 en Forge (3,97 au survol, sur `panel2`) ; l'encre tient
            10,3:1 au pire. Mesuré au lot 5. */}
        <span className="label rounded-full bg-accent/15 px-2 py-0.5 text-ink">
          {libelleVersion(derniere.version)}
        </span>
        <span className="text-sm font-semibold text-ink">{derniere.title}</span>
        <span className="ml-auto inline-flex items-center gap-1 text-xs text-ink-dim">
          Voir les nouveautés <ArrowRight size={13} />
        </span>
      </motion.a>
    </motion.div>
  );
}

/* ---- Briques -------------------------------------------------------------- */

// Zone de dépôt du fichier de compte, dans le héros.
//
// ⚠️ C'est le geste qui débloque tout l'outil : il ne doit pas être à chercher
// dans la barre de nav. Glisser-déposer ET clic — on ne sait pas lequel le
// visiteur tentera, et n'en proposer qu'un en laisse la moitié dehors.
function Dropzone({ onImport }: { onImport: (text: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [survol, setSurvol] = useState(false);

  const lire = (f: File | undefined | null) => {
    if (!f) return;
    f.text().then(onImport);
  };

  return (
    <div
      id="depot"
      onClick={() => ref.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setSurvol(true);
      }}
      onDragLeave={() => setSurvol(false)}
      onDrop={(e) => {
        e.preventDefault();
        setSurvol(false);
        lire(e.dataTransfer.files?.[0]);
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && ref.current?.click()}
      className={`flex min-h-[260px] cursor-pointer flex-col items-center justify-center gap-2.5
                  rounded-2xl border border-dashed p-8 text-center transition-colors max-lg:min-h-[170px] max-lg:p-5 ${
                    survol
                      ? 'border-accent bg-panel2'
                      : 'border-border bg-panel hoverable:border-accent hoverable:bg-panel2'
                  }`}
    >
      {/* La tuile d'icône des cartes, en plus grand et à l'accent : c'est
          l'action de la page. */}
      <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-border-soft bg-accent/10 text-accent">
        <Upload size={22} />
      </span>
      <div className="text-md font-semibold text-ink">Dépose ton fichier .json ici</div>
      <div className="text-sm text-ink-dim">ou clique pour parcourir</div>
      <span className="mt-1 rounded-full border border-border-soft bg-panel2 px-2.5 py-1 label">
        Export SWEX (.json)
      </span>
      <span className="mt-1 inline-flex items-center gap-1.5 text-micro text-ink-dim">
        <ShieldCheck size={12} /> lu dans la page, jamais envoyé
      </span>
      <input
        ref={ref}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = ''; // permet de recharger le même fichier
          lire(f);
        }}
      />
    </div>
  );
}

function Separator() {
  return <div className="h-px bg-border-soft" />;
}

// L'icône d'une carte, dans sa tuile — la maquette : 32 px, rayon 8, contour
// discret. ⚠️ **À la teinte de sa section** (décision 3 précisée : Thomas
// aimait les couleurs de l'accueil, qui les garde ; le menu, lui, reste
// neutre) : icône à la teinte, fond et contour de la même teinte, fondus.
// `color-mix` et non un suffixe hexa (`${accent}44`) : ça marche aussi bien
// avec une variable CSS qu'avec un hexa.
// ⚠️ **Deux valeurs de la teinte, choisies en CSS selon le thème** (lot 14) :
// la couleur d'origine en sombre, sa variante assombrie en clair
// (`TEINTE_CLAIRE`), où l'origine tombait à 1.4:1. L'élément porte
// `teinte-section` et peint avec `var(--teinte)` — voir index.css.
function varsTeinte(accent: string): CSSProperties {
  return { '--teinte-sombre': accent, '--teinte-clair': TEINTE_CLAIRE[accent] ?? accent } as CSSProperties;
}

function Tuile({ icon: Icon, accent }: { icon: typeof BookOpen; accent: string }) {
  return (
    <span
      className="teinte-section flex h-8 w-8 flex-none items-center justify-center rounded-lg border"
      style={{
        ...varsTeinte(accent),
        color: 'var(--teinte)',
        background: 'color-mix(in srgb, var(--teinte) 14%, transparent)',
        borderColor: 'color-mix(in srgb, var(--teinte) 32%, transparent)',
      }}
    >
      <Icon size={16} />
    </span>
  );
}

// Halo de la teinte, flouté dans le coin haut droit d'une carte — l'identité
// colorée des cartes de l'accueil d'avant la refonte, gardée à la demande de
// Thomas. La carte doit être `relative overflow-hidden`.
function Halo({ accent }: { accent: string }) {
  return (
    <div
      aria-hidden
      className="teinte-section pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-15 blur-2xl
                 transition-opacity group-hover:opacity-30"
      style={{ ...varsTeinte(accent), background: 'var(--teinte)' }}
    />
  );
}

function SectionTitle({ icon: Icon, title }: { icon: typeof BookOpen; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon size={15} className="text-ink-dim" />
      <h2 className="font-display text-lg tracking-wide">{title}</h2>
    </div>
  );
}

// Tuile de reprise : le CHIFFRE d'abord, parce que c'est lui qu'on vient
// vérifier ; le lien mène directement dans la bonne sous-section.
function Resume({
  href,
  icon,
  accent,
  value,
  unit,
  label,
}: {
  href: string;
  icon: typeof BookOpen;
  accent: string;
  value: number;
  unit: string;
  label: string;
}) {
  return (
    <a
      href={href}
      // ⚠️ Une valeur à 0 est ATTÉNUÉE, pas masquée : sinon la rangée saute.
      className={`flex items-center gap-3 p-3 ${CARTE_LIEN} ${value === 0 ? 'opacity-60' : ''}`}
    >
      <Tuile icon={icon} accent={accent} />
      <div className="min-w-0">
        <div className="label truncate">{label}</div>
        <div className="flex items-baseline gap-1.5">
          <span className="font-mono text-[22px] font-bold leading-tight text-ink">{value}</span>
          <span className="text-micro text-ink-dim">{unit}</span>
        </div>
      </div>
    </a>
  );
}

// Une étape de « Comment ça marche », dans la carte commune : le numéro en
// chiffres de code, la tuile d'icône, le titre, la phrase. Les étapes sont
// séparées par un filet (à gauche en colonnes, en haut une fois empilées).
// ⚠️ Chaque étape a sa couleur PROPRE, pas `var(--accent)` : les trois
// forment une séquence, elles se lisent comme trois pairs.
function Etape({
  n,
  icon,
  accent,
  title,
  desc,
  lien,
}: {
  n: string;
  icon: typeof BookOpen;
  accent: string;
  title: string;
  desc: string;
  lien?: { href: string; label: string };
}) {
  return (
    <div className="flex gap-3.5 border-t border-border-soft p-4 first:border-t-0 md:border-l md:border-t-0 md:first:border-l-0">
      <span className="teinte-section pt-2 font-mono text-xs font-bold" style={{ ...varsTeinte(accent), color: 'var(--teinte)' }}>
        {n}
      </span>
      <div className="min-w-0">
        <Tuile icon={icon} accent={accent} />
        <h3 className="mt-2.5 text-md font-semibold text-ink">{title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-ink-dim">{desc}</p>
        {lien && (
          <a
            href={lien.href}
            target="_blank"
            rel="noreferrer"
            className="mt-1.5 inline-flex items-center gap-1 text-sm text-accent transition-colors hoverable:text-ink"
          >
            {lien.label} <ExternalLink size={11} />
          </a>
        )}
      </div>
    </div>
  );
}

// Carte de fonctionnalité : compacte (kicker · titre · une phrase). Les grandes
// cartes de 260 px repoussaient tout le reste de la page hors de l'écran.
function Feature({
  href,
  icon,
  accent,
  kicker,
  title,
  body,
  soon,
}: {
  href: string;
  icon: typeof BookOpen;
  accent: string;
  kicker: string;
  title: string;
  body: string;
  soon?: boolean;
}) {
  return (
    <a
      href={href}
      className={`group relative flex flex-col overflow-hidden p-4 max-lg:p-3 ${CARTE_LIEN} ${soon ? 'opacity-70' : ''}`}
    >
      <Halo accent={accent} />
      <Tuile icon={icon} accent={accent} />
      <div className="mt-3 label">
        {kicker}
        {soon && ' · bientôt'}
      </div>
      <div className="mt-0.5 text-sm font-semibold text-ink">{title}</div>
      <p className="mt-1.5 text-xs leading-relaxed text-ink-dim">{body}</p>
    </a>
  );
}
