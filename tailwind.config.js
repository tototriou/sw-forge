import plugin from 'tailwindcss/plugin';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Cinzel', 'serif'],
        body: ['Inter', 'sans-serif'],
        // ⚠️ Réservée aux CHIFFRES (efficiences, vitesses, ticks, compteurs) :
        // c'est ce qui doit s'aligner en colonnes. Les libellés en capitales
        // sont en Inter — voir `label` ci-dessous.
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },

      // ⚠️ Toutes les couleurs pointent vers les variables CSS de index.css,
      // déclarées en CANAUX RGB et consommées avec `<alpha-value>`. C'est ce qui
      // fait marcher `bg-panel/50`, `bg-bg/80`, `border-fire/60` — 144 classes
      // dans l'app. Écrites `var(--panel)` en hexadécimal, Tailwind ne pouvait
      // pas composer l'opacité et n'émettait AUCUNE règle : voile de modale
      // absent, détail de rune transparent.
      // Source de vérité : spec/shared/design.md
      colors: {
        bg: 'rgb(var(--bg) / <alpha-value>)',
        panel: 'rgb(var(--panel) / <alpha-value>)',
        panel2: 'rgb(var(--panel2) / <alpha-value>)',
        border: 'rgb(var(--border) / <alpha-value>)',
        'border-soft': 'rgb(var(--border-soft) / <alpha-value>)',
        ink: 'rgb(var(--ink) / <alpha-value>)',
        'ink-dim': 'rgb(var(--ink-dim) / <alpha-value>)',
        'ink-dimmer': 'rgb(var(--ink-dimmer) / <alpha-value>)',

        // Accent UNIQUE : actif, focus, lien. Distinct de la sémantique.
        accent: 'rgb(var(--accent) / <alpha-value>)',
        'accent-soft': 'rgb(var(--accent-soft) / <alpha-value>)',

        // Sémantique : un état des DONNÉES, jamais « ceci est sélectionné ».
        good: 'rgb(var(--good) / <alpha-value>)',
        warn: 'rgb(var(--warn) / <alpha-value>)',
        bad: 'rgb(var(--bad) / <alpha-value>)',
        // Fond doux de `bad` : le pendant de `accent-soft`. Le speed tuning s'en
        // sert pour opposer « en face » à « ton équipe » d'un coup d'œil.
        'bad-soft': 'rgb(var(--bad-soft) / <alpha-value>)',

        // Éléments — vocabulaire Summoners War. Deux valeurs par élément
        // (voir design.md) : le Vent et la Lumière sont illisibles sur clair.
        fire: 'rgb(var(--el-fire) / <alpha-value>)',
        water: 'rgb(var(--el-water) / <alpha-value>)',
        wind: 'rgb(var(--el-wind) / <alpha-value>)',
        light: 'rgb(var(--el-light) / <alpha-value>)',
        dark: 'rgb(var(--el-dark) / <alpha-value>)',
        unknown: 'rgb(var(--el-unknown) / <alpha-value>)',

        // Fonds doux par élément — pour les surfaces qui portent une teinte
        // sans la crier (pastille active, en-tête d'écran).
        'fire-soft': 'rgb(var(--el-fire-soft) / <alpha-value>)',
        'water-soft': 'rgb(var(--el-water-soft) / <alpha-value>)',
        'wind-soft': 'rgb(var(--el-wind-soft) / <alpha-value>)',
        'light-soft': 'rgb(var(--el-light-soft) / <alpha-value>)',
        'dark-soft': 'rgb(var(--el-dark-soft) / <alpha-value>)',
        'unknown-soft': 'rgb(var(--el-unknown-soft) / <alpha-value>)',

        // ⚠️ Accent CONTEXTUEL : `bg-ctx`, `text-ctx`, `border-ctx`. Sa valeur
        // dépend du `data-ctx` de l'ancêtre le plus proche — l'élément du
        // monstre affiché, ou l'accent de l'app par défaut. Un composant n'a
        // donc RIEN à savoir de l'élément courant : il écrit `text-ctx`.
        ctx: 'rgb(var(--ctx) / <alpha-value>)',
        'ctx-soft': 'rgb(var(--ctx-soft) / <alpha-value>)',

        star: 'rgb(var(--star) / <alpha-value>)',
      },

      // Six paliers, plancher à 11 px. ⚠️ Ni demi-pixel, ni valeur en dessous
      // de 11 px : l'écart ne crée pas de hiérarchie, il crée du flou.
      fontSize: {
        // ⚠️ **`nano` est le cran de secours des rendus CONTRAINTS**, pas une
        // taille de l'échelle générale. Il sert aux mentions qui accompagnent
        // une valeur sans être lues pour elles-mêmes (« base 107 », un libellé
        // de pastille), là où 11 px les faisait rivaliser avec le nom du
        // monstre à côté. En dessous, on ne lit plus.
        // Trois emplois, et trois seulement : sous `compact:` (tactile), le
        // rendu ÉTROIT de la carte de pièce — la liste de runes à deux
        // colonnes sur téléphone (voir PieceDetail, `etroit`) — et
        // `Segmented` en mode `dense` (4 options à libellé long sur une
        // seule ligne, panneau mobile resserré).
        nano: ['10px', { lineHeight: '1.4' }],
        micro: ['11px', { lineHeight: '1.45' }],
        xs: ['12px', { lineHeight: '1.5' }],
        sm: ['13px', { lineHeight: '1.5' }],
        base: ['15px', { lineHeight: '1.6' }],
        lg: ['17px', { lineHeight: '1.4' }],
        xl: ['clamp(22px, 3vw, 30px)', { lineHeight: '1.15' }],
      },

      borderRadius: {
        DEFAULT: 'var(--radius)',
        lg: 'var(--radius-lg)',
      },

      transitionTimingFunction: {
        out: 'var(--ease-out)',
        'in-out': 'var(--ease-in-out)',
      },

      boxShadow: {
        glow: '0 8px 24px -8px var(--tw-shadow-color)',
      },
    },
  },
  plugins: [
    plugin(function ({ addVariant }) {
      // ⚠️ `hoverable:` remplace `hover:` sur tout ce qui est cliquable.
      // Un `hover:` nu reste allumé après un tap au tactile : on croit avoir
      // sélectionné quelque chose. Voir spec/shared/design.md.
      addVariant('hoverable', '@media (hover: hover) and (pointer: fine) { &:hover }');
      addVariant('group-hoverable', '@media (hover: hover) and (pointer: fine) { :merge(.group):hover & }');
      // Complément : ce qui doit rester visible quand il n'y a pas de survol.
      addVariant('no-hover', '@media (hover: none)');
      // ⚠️ `coarse:` = pointeur GROSSIER (doigt), pas « petit écran ». Une
      // tablette au stylet garde les tailles fines, un téléphone en paysage les
      // agrandit quand même : c'est le doigt qui est gros, pas l'écran qui est
      // petit. Même logique que `hoverable`, pour la taille des cibles.
      // Voir la règle globale des 40 px dans index.css.
      addVariant('coarse', '@media (pointer: coarse)');
      // ⚠️ `compact:` = **l'affichage resserré du tactile**, quel que soit
      // l'appareil et quelle que soit son orientation.
      //
      // C'est le POINTEUR seul qui décide, jamais la largeur. Une condition sur
      // `sm:` faisait basculer un iPhone d'un rendu à l'autre en le tournant
      // (390 px en portrait, 844 en paysage) : portraits, écarts et tailles
      // changeaient d'un quart de tour, alors que c'est le même téléphone dans
      // la même main. Une tablette, elle, a la largeur d'un bureau mais les
      // gestes d'un mobile — et donc les mêmes besoins de densité.
      //
      // Même logique que `hoverable` et `coarse` : ce n'est pas l'écran qui est
      // petit, c'est le doigt qui est gros. `coarse:` traite les CIBLES,
      // `compact:` traite la DENSITÉ — deux conséquences du même fait.
      addVariant('compact', '@media (pointer: coarse)');
    }),
  ],
};
