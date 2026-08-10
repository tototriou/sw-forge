import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BookOpen,
  Swords,
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
} from 'lucide-react';
import ElementIcon from '../components/ElementIcon';
import { ElementKey } from '../types';
import { RELEASES } from '../data/releases';

const ELEMENT_ORDER: ElementKey[] = ['fire', 'water', 'wind', 'light', 'dark'];
const SW_EXPORTER = 'https://github.com/Xzandro/sw-exporter';

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } },
};
const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};

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
export default function HomePage({ stats, onImport }: Props) {
  const derniere = RELEASES[0];
  const aDesDonnees = stats.rta > 0 || stats.defense > 0 || stats.offense > 0 || stats.recos > 0;
  // Le bouton du dernier appel ouvre le sélecteur de fichier, comme la zone de
  // dépôt du héros — même `onImport`, donc un seul chemin d'import.
  const ctaRef = useRef<HTMLInputElement>(null);

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="pt-4">
      {/* ---- Héros : promesse à gauche, action à droite ------------------- */}
      <header className="grid lg:grid-cols-[1.1fr_0.9fr] gap-8 items-center pt-6 pb-10">
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

          <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-ink-dim">
            Runes, RTA, siège, analyse de compte. Importe ton export SWEX et tout est calculé{' '}
            <b className="text-ink">dans ton navigateur</b>.
          </p>

          {/* Vague d'éléments centrée sous le texte : alignée à gauche, elle
              pendait sous le dernier paragraphe sans rien équilibrer. */}
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
        <motion.section variants={item} className="pb-10">
          {/* ⚠️ Titre NEUTRE : ce bloc apparaît dès le premier import, pas
              seulement au retour. « Reprends où tu en étais » accueillait donc
              un débutant en lui parlant d'un passé qu'il n'a pas. */}
          <SectionTitle icon={LayoutGrid} title="Ton espace" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            <Resume href="#/rta" icon={Swords} accent="#A15FE0" value={stats.rta} unit={stats.rta > 1 ? 'monstres' : 'monstre'} label="Prépa RTA" />
            <Resume href="#/siege/defense" icon={Castle} accent="#E4463A" value={stats.defense} unit={stats.defense > 1 ? 'équipes' : 'équipe'} label="Défense de siège" />
            <Resume href="#/siege/offense" icon={Swords} accent="#F2884C" value={stats.offense} unit={stats.offense > 1 ? 'équipes' : 'équipe'} label="Offense de siège" />
            <Resume href="#/siege/recommandations" icon={Lightbulb} accent="#5EDB8F" value={stats.recos} unit={stats.recos > 1 ? 'recos' : 'reco'} label="Recommandations" />
          </div>
        </motion.section>
      )}

      <Separator />

      {/* ---- Comment ça marche -------------------------------------------- */}
      <motion.section variants={item} id="comment" className="py-12">
        <h2 className="font-display text-[26px] tracking-wide mb-6">Comment ça marche</h2>
        <div className="grid md:grid-cols-3 gap-2.5">
          <Etape
            n="01"
            icon={Download}
            accent="#8b92e0"
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
      <motion.section variants={item} id="features" className="py-12">
        <h2 className="font-display text-[26px] tracking-wide mb-6">Fonctionnalités</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          <Feature href="#/rta" icon={Swords} accent="#A15FE0" kicker="RTA" title="Préparation RTA" body="Classe ta box par set en glisser-déposer et lis l'ordre de tour recalculé selon les leads." />
          <Feature href="#/siege/defense" icon={Castle} accent="#E4463A" kicker="Siège" title="Défenses et offenses" body="Compose tes équipes et vérifie tes speed tune sur les ticks 239 et 286." />
          <Feature href="#/siege/recommandations" icon={Lightbulb} accent="#5EDB8F" kicker="Partage" title="Recommandations" body="Décris tes decks, partage-les en JSON, et vois ce que ton compte peut jouer." />
          <Feature href="#/compte/runes" icon={UserRound} accent="#4AD8D8" kicker="Compte" title="Analyse de runes" body="Résumé chiffré, efficience ou score SW, courbes et optimisation gemme + meule." />
          <Feature href="#/bestiary" icon={BookOpen} accent="#2FA0E0" kicker="Données" title="Bestiaire" body="Recherche et filtres par élément et étoiles naturelles, stats de base à portée de main." />
          <Feature href="#/mecaniques" icon={Calculator} accent="#8890B8" kicker="Doc" title="Mécaniques" body="Vitesse de combat, barre d'action, équation des dégâts et facteur de défense." />
          <Feature href="#/releases" icon={Tag} accent="#C79BFF" kicker="Suivi" title="Nouveautés" body="Ce qui change à chaque version : ajouts, corrections et calculs revus." />
          <Feature href="#/arene" icon={Trophy} accent="#F2C24C" kicker="Arène" title="Arène classique" body="Préparation des équipes d'offense et de défense." soon />
        </div>
      </motion.section>

      {/* ---- Dernier appel -------------------------------------------------- */}
      <motion.section variants={item} className="py-12 max-w-xl">
        <h2 className="font-display text-[26px] tracking-wide">Prêt à préparer tes équipes ?</h2>
        <p className="mt-2 text-[14.5px] leading-relaxed text-ink-dim">
          Importe ton fichier SWEX et retrouve ta box, tes runes, ta prépa RTA et tes équipes de siège
          en quelques secondes.
        </p>
        {/* ⚠️ Il ouvre le sélecteur de fichier, il ne renvoie PAS à la zone de
            dépôt. C'était un lien `#depot` : avec le routage par hash il ne
            faisait rien de visible, et un bouton d'appel à l'action qui ne
            déclenche rien est pire que pas de bouton du tout. */}
        <button
          onClick={() => ctaRef.current?.click()}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-gradient-to-br from-[#3a4270] to-[#272e52]
                     border border-[#4a52a0] px-4 py-2.5 text-[14px] font-semibold text-ink
                     transition hover:border-[#5b63b8]"
        >
          <Upload size={15} /> Importer mon compte
        </button>
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
        className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-border
                   bg-panel/50 px-4 py-3 transition hover:border-[#4a52a0]"
      >
        <span className="rounded-full bg-star/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-star">
          v{derniere.version}
        </span>
        <span className="text-[13.5px] text-ink">{derniere.title}</span>
        <span className="ml-auto inline-flex items-center gap-1 text-[12.5px] text-ink-dim">
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
                  rounded-2xl border border-dashed p-8 text-center transition ${
                    survol
                      ? 'border-[#5b63b8] bg-panel2'
                      : 'border-border bg-panel hover:border-[#4a52a0] hover:bg-panel2/60'
                  }`}
    >
      <Upload size={30} className="text-[#8b92e0]" />
      <div className="font-display text-[16px] tracking-wide text-ink">
        Dépose ton fichier .json ici
      </div>
      <div className="text-[13px] text-ink-dim">ou clique pour parcourir</div>
      <span className="mt-1 rounded-full border border-border bg-panel2 px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-dim">
        Export SWEX (.json)
      </span>
      <span className="mt-1 inline-flex items-center gap-1.5 text-[11.5px] text-ink-dim">
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
  return <div className="h-px bg-border" />;
}

function SectionTitle({ icon: Icon, title }: { icon: typeof BookOpen; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-2.5">
      <Icon size={15} className="text-ink-dim" />
      <h2 className="font-display text-[17px] tracking-wide">{title}</h2>
    </div>
  );
}

// Tuile de reprise : le CHIFFRE d'abord, parce que c'est lui qu'on vient
// vérifier ; le lien mène directement dans la bonne sous-section.
function Resume({
  href,
  icon: Icon,
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
    <motion.a
      href={href}
      whileHover={{ y: -3 }}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
      className={`rounded-xl border border-border bg-panel p-3 transition hover:border-[#4a52a0] ${
        value === 0 ? 'opacity-60' : ''
      }`}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <Icon size={13} style={{ color: accent }} />
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-dim">{label}</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="font-mono text-[24px] font-black leading-none text-ink">{value}</span>
        <span className="text-[11.5px] text-ink-dim">{unit}</span>
      </div>
    </motion.a>
  );
}

// Étape mise en carte : un numéro nu au-dessus d'un paragraphe se lisait comme
// une note de bas de page. Le cadre, le numéro en pastille et l'icône colorée en
// font une séquence qu'on suit du regard.
function Etape({
  n,
  icon: Icon,
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
    <div className="relative overflow-hidden rounded-xl border border-border bg-panel p-4">
      <div
        className="pointer-events-none absolute -top-12 -right-12 w-28 h-28 rounded-full opacity-15 blur-2xl"
        style={{ background: accent }}
      />
      <div className="flex items-center gap-2.5">
        <span
          className="flex h-8 w-8 flex-none items-center justify-center rounded-lg font-mono text-[12px] font-bold text-ink"
          style={{ background: `linear-gradient(135deg, ${accent}44, transparent)`, border: `1px solid ${accent}66` }}
        >
          {n}
        </span>
        <Icon size={17} style={{ color: accent }} />
      </div>
      <h3 className="mt-2.5 font-display text-[16px] tracking-wide">{title}</h3>
      <p className="mt-1.5 text-[13px] leading-relaxed text-ink-dim">{desc}</p>
      {lien && (
        <a
          href={lien.href}
          target="_blank"
          rel="noreferrer"
          className="mt-1.5 inline-flex items-center gap-1 text-[13px] text-[#8b92e0] transition hover:text-ink"
        >
          {lien.label} <ExternalLink size={11} />
        </a>
      )}
    </div>
  );
}

// Carte de fonctionnalité : compacte (kicker · titre · une phrase). Les grandes
// cartes de 260 px repoussaient tout le reste de la page hors de l'écran.
function Feature({
  href,
  icon: Icon,
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
    <motion.a
      href={href}
      whileHover={{ y: -4 }}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
      className={`group relative overflow-hidden rounded-xl border border-border bg-panel p-4
                  transition hover:border-[#4a52a0] ${soon ? 'opacity-70' : ''}`}
    >
      <div
        className="pointer-events-none absolute -top-10 -right-10 w-28 h-28 rounded-full opacity-15 blur-2xl transition-opacity group-hover:opacity-30"
        style={{ background: accent }}
      />
      <Icon size={20} style={{ color: accent }} />
      <div className="mt-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-dim">
        {kicker}
        {soon && ' · bientôt'}
      </div>
      <div className="mt-0.5 text-[14px] font-semibold text-ink">{title}</div>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-dim">{body}</p>
    </motion.a>
  );
}

