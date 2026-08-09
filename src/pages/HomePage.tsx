import { motion } from 'framer-motion';
import {
  BookOpen,
  Swords,
  ArrowRight,
  Zap,
  Filter,
  Layers,
  Castle,
  Trophy,
  Users,
  UserRound,
  Boxes,
  Gauge,
  Calculator,
  Lightbulb,
  Tag,
  Sparkles,
  Wrench,
} from 'lucide-react';
import { ElementKey } from '../types';
import ElementIcon from '../components/ElementIcon';

const ELEMENT_ORDER: ElementKey[] = ['fire', 'water', 'wind', 'light', 'dark'];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};
const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};

export default function HomePage() {
  return (
    <motion.div variants={container} initial="hidden" animate="show" className="pt-6">
      {/* Hero */}
      <section className="text-center pt-8 pb-4">
        <motion.p
          variants={item}
          className="font-mono text-[12px] tracking-[0.28em] uppercase text-ink-dim mb-4"
        >
          Summoners War · Boîte à outils
        </motion.p>

        <motion.h1
          variants={item}
          className="font-display font-black text-[clamp(44px,9vw,96px)] leading-[0.95] title-gradient mb-5"
        >
          SW&nbsp;Forge
        </motion.h1>

        <motion.p
          variants={item}
          className="mx-auto max-w-2xl text-ink-dim text-[16px] leading-relaxed"
        >
          Explore le bestiaire complet et prépare tes équipes de Real Time Arena :
          classe tes monstres par set de runes, ajuste tes vitesses et visualise
          l'ordre de tour en un coup d'œil.
        </motion.p>

        {/* Bandeau d'éléments animé */}
        <motion.div variants={item} className="flex items-center justify-center gap-5 mt-8">
          {ELEMENT_ORDER.map((el, i) => (
            <motion.div
              key={el}
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut', delay: i * 0.18 }}
            >
              <ElementIcon
                element={el}
                size={40}
                className="drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)]"
              />
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* Cartes des outils */}
      <div className="grid md:grid-cols-2 gap-5 mt-8">
        <ToolCard
          href="#/rta"
          icon={Swords}
          accent="#A15FE0"
          title="RTA — Préparation"
          desc="Sélectionne tes monstres, classe-les par set de runes en drag & drop, et lis l'ordre de tour recalculé selon les leads de vitesse. Importe même ta box depuis un export de compte."
          features={[
            { icon: Layers, label: 'Sections de runes en drag & drop' },
            { icon: Zap, label: 'Ordre de tour, leads SPD & import' },
          ]}
          cta="Préparer mes équipes"
        />
        <ToolCard
          href="#/siege"
          icon={Castle}
          accent="#E4463A"
          title="Siège"
          desc="Compose tes équipes, offense et défense, et vérifie les speed tune de tes équipes."
          features={[
            { icon: Users, label: 'Équipes défense & offense' },
            { icon: Zap, label: 'Vérif des SPD & ticks 239 / 286' },
            { icon: Lightbulb, label: 'Recommandations de decks à partager' },
          ]}
          cta="Préparer mes équipes de siège"
        />
        <ToolCard
          href="#/arene"
          icon={Trophy}
          accent="#F2C24C"
          title="Arène"
          desc="Préparation des équipes d'arène classique (offense et défense)."
          features={[{ icon: Swords, label: 'Offense & défense classique' }]}
          cta="Bientôt disponible"
          soon
        />
        <ToolCard
          href="#/compte"
          icon={UserRound}
          accent="#5EDB8F"
          title="Mon compte"
          desc="Explore tout ton compte importé : ta box de monstres 6★, ton inventaire de runes et d'artéfacts, avec le résumé chiffré et l'analyse d'efficience."
          features={[
            { icon: Boxes, label: 'Box 6★, runes & artéfacts' },
            { icon: Gauge, label: 'Résumé, efficience & optimisation' },
          ]}
          cta="Explorer mon compte"
        />
        <ToolCard
          href="#/bestiary"
          icon={BookOpen}
          accent="#2FA0E0"
          title="Bestiaire"
          desc="Recherche par nom, filtre par élément et par étoiles naturelles. Toutes les stats de base à portée de main."
          features={[
            { icon: Filter, label: 'Filtres élément & étoiles' },
            { icon: Zap, label: 'Stats de base (vitesse…)' },
          ]}
          cta="Ouvrir le bestiaire"
        />
        <ToolCard
          href="#/mecaniques"
          icon={Calculator}
          accent="#8890B8"
          title="Mécaniques"
          desc="La documentation des mécaniques de jeu : vitesse de combat, barre d'action, équation des dégâts, facteur de défense et variance."
          features={[
            { icon: Zap, label: "Vitesse, barre d'action & ticks" },
            { icon: Swords, label: 'Dégâts, crit & facteur de défense' },
          ]}
          cta="Consulter les mécaniques"
        />
        <ToolCard
          href="#/releases"
          icon={Tag}
          accent="#C79BFF"
          title="Nouveautés"
          desc="Ce qui a changé à chaque version : nouveautés, corrections et détail des mises à jour du site."
          features={[
            { icon: Sparkles, label: 'Journal des versions' },
            { icon: Wrench, label: 'Corrections et calculs revus' },
          ]}
          cta="Voir les nouveautés"
        />
      </div>
    </motion.div>
  );
}

interface ToolCardProps {
  href: string;
  icon: typeof BookOpen;
  accent: string;
  title: string;
  desc: string;
  features: { icon: typeof BookOpen; label: string }[];
  cta: string;
  soon?: boolean;
}

function ToolCard({ href, icon: Icon, accent, title, desc, features, cta, soon }: ToolCardProps) {
  return (
    <motion.a
      href={href}
      variants={item}
      whileHover={{ y: -6 }}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
      className={`group relative overflow-hidden rounded-2xl border border-border bg-panel p-6 flex flex-col ${
        soon ? 'opacity-80' : ''
      }`}
      style={{ minHeight: 260 }}
    >
      {/* Halo d'accent */}
      <div
        className="pointer-events-none absolute -top-16 -right-16 w-48 h-48 rounded-full opacity-20 blur-2xl transition-opacity group-hover:opacity-40"
        style={{ background: accent }}
      />

      {soon && (
        <span className="absolute top-4 right-4 rounded-full border border-border bg-panel2 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-dim">
          Bientôt
        </span>
      )}

      <div
        className="flex items-center justify-center w-14 h-14 rounded-xl mb-4"
        style={{ background: `linear-gradient(135deg, ${accent}, transparent)`, border: `1px solid ${accent}55` }}
      >
        <Icon size={26} style={{ color: accent }} />
      </div>

      <h2 className="font-display text-[26px] tracking-wide mb-2">{title}</h2>
      <p className="text-ink-dim text-[14px] leading-relaxed mb-4">{desc}</p>

      <ul className="space-y-1.5 mb-6">
        {features.map((f, i) => {
          const F = f.icon;
          return (
            <li key={i} className="flex items-center gap-2 text-[13px] text-ink-dim">
              <F size={14} style={{ color: accent }} />
              {f.label}
            </li>
          );
        })}
      </ul>

      <span
        className="mt-auto inline-flex items-center gap-2 text-[14px] font-semibold transition-colors"
        style={{ color: accent }}
      >
        {cta}
        <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
      </span>
    </motion.a>
  );
}
