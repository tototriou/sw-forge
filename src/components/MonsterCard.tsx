import { Fragment, memo, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Monster } from '../types';
import { libelleCollab } from '../lib/collabPairs';
import MonsterAvatar from './MonsterAvatar';

// ⚠️ **Au-delà de ce nombre de cartes, l'animation de disposition est COUPÉE.**
// Chaque carte animée est un `motion.div layout` : à chaque filtre, framer-motion
// remesure et fait glisser (FLIP) TOUTES les cartes vers leur nouvelle place.
// Délicieux sur vingt cartes, saccadé sur des centaines — la box d'un compte
// entier n'est pas paginée. Le parent compare la taille de sa grille à ce seuil
// et passe `anime={false}` au-dessus : le filtrage redevient instantané, on
// garde le fondu pour les petites listes. Voir docs/02-app/compte/.
export const SEUIL_ANIMATION_GRILLE = 48;

// ⚠️ **Une possibilité de coupure (`<wbr>`) avant chaque parenthèse**, sans
// toucher au libellé : « Homunculus(Attack) » n'a aucune espace, et un mot
// plus large que la carte serait coupé net à droite. Avec elle, « (Attack) » passe à la ligne. Le texte rendu
// (`textContent`) reste le nom du jeu, mot pour mot.
function coupableAvantParenthese(nom: string): ReactNode {
  const morceaux = nom.split('(');
  return morceaux.map((m, i) =>
    i === 0 ? m : (
      <Fragment key={i}>
        <wbr />({m}
      </Fragment>
    ),
  );
}

const BORDER: Record<string, string> = {
  fire: 'hoverable:border-fire hoverable:shadow-lg hoverable:shadow-fire-glow/40',
  water: 'hoverable:border-water hoverable:shadow-lg hoverable:shadow-water-glow/40',
  wind: 'hoverable:border-wind hoverable:shadow-lg hoverable:shadow-wind-glow/40',
  light: 'hoverable:border-light hoverable:shadow-lg hoverable:shadow-light-glow/40',
  dark: 'hoverable:border-dark hoverable:shadow-lg hoverable:shadow-dark-glow/40',
  unknown: 'hoverable:border-unknown hoverable:shadow-lg hoverable:shadow-unknown-glow/40',
};

// Carte de monstre — **la même dans le Bestiaire et dans la box du compte**.
//
// ⚠️ Les deux écrans en avaient chacun une, aux tailles et aux rayons
// différents : même monstre, deux rendus. Elles ont été fondues ici, et ce qui
// les distinguait devient des OPTIONS — les étoiles (bestiaire) et le nombre
// d'exemplaires (box). Deux copies auraient divergé au premier ajustement,
// comme les chips d'élément avant `elementStyles.ts`.
//
// ⚠️ C'est le gabarit de la **BOX** qui a été retenu, pas celui du bestiaire :
// portrait 64 px, colonnes de 104. C'est le plus dense des deux, et le bon —
// on parcourt des centaines de monstres, chaque pixel de marge coûte une ligne
// de plus à faire défiler.
const MonsterCard = memo(function MonsterCard({
  monster,
  jumeau,
  possede = true,
  jumeauPossede = true,
  onOpen,
  count,
  showStars = true,
  anime = true,
}: {
  monster: Monster;
  // Équivalent SW d'un monstre de COLLABORATION (Satoru Gojo ↔ Werner). Les
  // deux partagent une seule carte : portrait coupé verticalement, noms séparés
  // d'une virgule. Absent = monstre ordinaire, rendu inchangé.
  jumeau?: Monster | null;
  // Chacune des deux faces d'une paire est-elle DANS LA BOX ? La moitié qu'on
  // n'a pas est grisée. ⚠️ La box seule le sait — le bestiaire ignore ce qu'on
  // possède, et laisse donc les deux en couleur (défaut).
  possede?: boolean;
  jumeauPossede?: boolean;
  // Ouvre la fiche complète. Absent = carte non cliquable (aucun appelant n'est
  // dans ce cas aujourd'hui, mais la prop reste facultative pour ne pas imposer
  // une fiche à un futur usage purement décoratif).
  onOpen?: (m: Monster) => void;
  // Exemplaires possédés → bulle « ×N ». Absent ou 1 : rien. La box seule s'en
  // sert ; le bestiaire ne sait pas ce qu'on possède.
  count?: number;
  // Rangée d'étoiles sous le portrait. ⚠️ Masquée dans la box : tout y est 6★,
  // la répéter 300 fois n'apprend rien.
  showStars?: boolean;
  // Animer l'entrée et la disposition (FLIP). ⚠️ Le PARENT décide, selon la
  // taille de sa grille (voir SEUIL_ANIMATION_GRILLE) : sur des centaines de
  // cartes, le FLIP de framer-motion saccade. `false` → plus de `motion.div` du
  // tout, le survol passe en CSS.
  anime?: boolean;
}) {
  // Poignées communes aux deux rendus. ⚠️ `role="button"` porté par l'élément
  // lui-même plutôt qu'un `<button>` autour : envelopper casserait l'animation
  // de disposition (`layout`), qui mesure CET élément. Le clavier est rétabli à
  // la main.
  const handlers = {
    onClick: onOpen ? () => onOpen(monster) : undefined,
    onKeyDown: onOpen
      ? (e: React.KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpen(monster);
          }
        }
      : undefined,
    role: onOpen ? ('button' as const) : undefined,
    tabIndex: onOpen ? 0 : undefined,
    title: onOpen
      ? `Voir la fiche de ${jumeau ? libelleCollab(monster.name, jumeau.name) : monster.name}`
      : undefined,
  };

  // ⚠️ Gabarit repris de la BOX du compte : portrait 64 px, `rounded-xl`,
  // padding resserré. C'est la carte la plus dense des deux, et la bonne
  // référence — on parcourt des centaines de monstres, chaque pixel de marge
  // coûte une ligne de plus à faire défiler.
  const libelle = jumeau ? libelleCollab(monster.name, jumeau.name) : monster.name;
  // ⚠️ **Toutes les cartes ont la même hauteur, et le nom y a TOUJOURS deux
  // lignes réservées**. Un nom de deux
  // lignes (« Inosuke Hashibira, White Tiger Blade Master », ou
  // « Homunculus(Attack) » coupé avant sa parenthèse) grandissait sa carte
  // de 15 px. La hauteur est celle d'une carte à nom d'une ligne : portrait
  // et étoiles à la même place qu'avant ; les deux lignes viennent, dans cet
  // ordre, de l'interligne (15 → 13 px : à 13, le jambage d'une ligne laisse
  // 1 px à la capitale de la suivante), de la marge sous les étoiles
  // (4 → 0) et de celle du bas (10 → 3). Dans la box, sans étoiles, l'espace
  // sous le portrait passe de 6 à 4 px — la pastille « ×N » descend de 4 px
  // sous lui — et le bas de 10 à 1 px. Un nom d'une ligne garde la place de
  // la seconde : rien ne change de place d'une carte à l'autre.
  const socle = `group relative rounded-xl border border-border bg-panel px-2 pt-3 ${showStars ? 'pb-[3px]' : 'pb-px'} text-center
    shadow-none ${onOpen ? 'cursor-pointer' : ''} ${BORDER[monster.element]}`;

  const contenu = (
    <>
      {/* Exemplaires possédés : la box seule le sait. */}
      <MonsterAvatar
        monster={monster}
        gabarit="div"
        classeRacine={`w-[64px] mx-auto ${showStars ? 'mb-1.5' : 'mb-1'}`}
        classeTaille="w-[64px] h-[64px]"
        fond="bg-panel2"
        cadreRelatif
        classeInitiales="text-lg"
        tailleElement={18}
        collab={{ jumeau, possede, jumeauPossede }}
        exemplaires={count}
      />

      {showStars && (
        <div className="text-star text-micro tracking-[-1px]">
          {monster.stars ? '★'.repeat(monster.stars) : '—'}
        </div>
      )}
      {/* Deux lignes au plus (`h-[2lh]` + `overflow-hidden`) : les noms longs
          (« Dark Cow Girl ») ne doivent pas allonger la carte et déchirer la
          rangée. ⚠️ Coupé NET, sans points de suspension : `line-clamp`, en
          texte centré, pose l'ellipse une demi-ellipse trop loin (Chromium
          centre la ligne sans elle) et son dernier point était rogné. Le nom
          entier reste dans le `title` de la carte. */}
      {/* ⚠️ Les DEUX noms, séparés d'une virgule : « Satoru Gojo, Werner ».
          C'est la question qu'on se pose devant la carte — « lequel est-ce ? » —
          et n'en montrer qu'un obligerait à savoir de tête que l'autre existe.
          `libelleCollab` n'écrit qu'une fois les noms identiques (Vendhan). */}
      {/* ⚠️ Les deux noms restent EN PLEIN, même quand une seule face est
          possédée : ils disent ce que le monstre EST, pas ce qu'on en a. La
          moitié grisée du portrait porte déjà cette information, et ternir le
          nom par-dessus le rendait juste moins lisible. */}
      <div className="h-[2lh] text-xs font-semibold leading-[13px] overflow-hidden">
        {coupableAvantParenthese(libelle)}
      </div>
    </>
  );

  // ⚠️ Sans animation, PLUS de `motion.div` : le survol se fait en CSS
  // (`transition` + `hoverable:-translate-y-1`), et rien ne mesure la
  // disposition. C'est ce qui rend le filtrage instantané sur une grande grille.
  if (!anime) {
    return (
      <div {...handlers} className={`${socle} transition hoverable:-translate-y-1`}>
        {contenu}
      </div>
    );
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25 }}
      whileHover={{ y: -4 }}
      {...handlers}
      className={`${socle} transition-colors`}
    >
      {contenu}
    </motion.div>
  );
});

export default MonsterCard;
