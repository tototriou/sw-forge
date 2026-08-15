import { useState } from 'react';
import { motion } from 'framer-motion';
import { Monster } from '../types';
import ElementIcon from './ElementIcon';
import { libelleCollab } from '../lib/collabPairs';
import CollabPortrait from './CollabPortrait';

const BORDER: Record<string, string> = {
  fire: 'hoverable:border-fire hoverable:shadow-lg hoverable:shadow-fire-glow/40',
  water: 'hoverable:border-water hoverable:shadow-lg hoverable:shadow-water-glow/40',
  wind: 'hoverable:border-wind hoverable:shadow-lg hoverable:shadow-wind-glow/40',
  light: 'hoverable:border-light hoverable:shadow-lg hoverable:shadow-light-glow/40',
  dark: 'hoverable:border-dark hoverable:shadow-lg hoverable:shadow-dark-glow/40',
  unknown: 'hoverable:border-unknown hoverable:shadow-lg hoverable:shadow-unknown-glow/40',
};

const TEXT: Record<string, string> = {
  fire: 'text-fire',
  water: 'text-water',
  wind: 'text-wind',
  light: 'text-light',
  dark: 'text-dark',
  unknown: 'text-unknown',
};

const GRADIENT: Record<string, string> = {
  fire: 'from-fire to-panel2',
  water: 'from-water to-panel2',
  wind: 'from-wind to-panel2',
  light: 'from-light to-panel2',
  dark: 'from-dark to-panel2',
  unknown: 'from-unknown to-panel2',
};

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

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
export default function MonsterCard({
  monster,
  jumeau,
  possede = true,
  jumeauPossede = true,
  onOpen,
  count,
  showStars = true,
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
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const showImage = monster.image && !imgFailed;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25 }}
      whileHover={{ y: -4 }}
      // ⚠️ `role="button"` sur le `motion.div` plutôt qu'un `<button>` autour :
      // envelopper casserait l'animation de disposition (`layout`), qui mesure
      // CET élément. Le clavier est rétabli à la main juste en dessous.
      onClick={onOpen ? () => onOpen(monster) : undefined}
      onKeyDown={
        onOpen
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onOpen(monster);
              }
            }
          : undefined
      }
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
      title={
        onOpen
          ? `Voir la fiche de ${jumeau ? libelleCollab(monster.name, jumeau.name) : monster.name}`
          : undefined
      }
      // ⚠️ Gabarit repris de la BOX du compte : portrait 64 px, `rounded-xl`,
      // padding resserré. C'est la carte la plus dense des deux, et c'est la
      // bonne référence — on parcourt des centaines de monstres, chaque pixel
      // de marge coûte une ligne de plus à faire défiler.
      className={`group relative rounded-xl border border-border bg-panel px-2 pt-3 pb-2.5 text-center
        transition-colors shadow-none ${onOpen ? 'cursor-pointer' : ''} ${BORDER[monster.element]}`}
    >
      <div className="relative w-[64px] mx-auto mb-1.5">
        <div
          className={`hex-frame w-[64px] h-[64px] p-[2px] bg-gradient-to-br ${GRADIENT[monster.element]}`}
        >
          <div className="hex-frame relative w-full h-full bg-panel2 flex items-center justify-center overflow-hidden">
            {showImage ? (
              <CollabPortrait
                monster={monster}
                jumeau={jumeau}
                possede={possede}
                jumeauPossede={jumeauPossede}
                onError={() => setImgFailed(true)}
              />
            ) : (
              <span className={`font-display font-bold text-lg ${TEXT[monster.element]}`}>
                {initials(monster.name)}
              </span>
            )}
          </div>
        </div>
        <ElementIcon
          element={monster.element}
          size={18}
          className="absolute -top-1 -right-1 drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]"
        />
        {/* Exemplaires possédés — la box seule le sait. En BAS à droite, à
            l'opposé de l'icône d'élément : les deux se chevaucheraient sur un
            portrait de cette taille. */}
        {count != null && count > 1 && (
          <span
            className="absolute -bottom-1 -right-1 flex h-5 min-w-[20px] items-center justify-center
                       rounded-full border border-accent bg-accent-soft px-1 font-mono text-[11px]
                       font-bold text-ink shadow-[0_1px_3px_rgba(0,0,0,0.6)]"
            title={`${count} exemplaires`}
          >
            ×{count}
          </span>
        )}
      </div>

      {showStars && (
        <div className="text-star text-[11px] tracking-[-1px] mb-1">
          {monster.stars ? '★'.repeat(monster.stars) : '—'}
        </div>
      )}
      {/* `line-clamp-2` : les noms longs (« Dark Cow Girl ») tiennent sur deux
          lignes au plus, sinon une carte s'allonge et déchire la rangée. */}
      {/* ⚠️ Les DEUX noms, séparés d'une virgule : « Satoru Gojo, Werner ».
          C'est la question qu'on se pose devant la carte — « lequel est-ce ? » —
          et n'en montrer qu'un obligerait à savoir de tête que l'autre existe.
          `libelleCollab` n'écrit qu'une fois les noms identiques (Vendhan). */}
      {/* ⚠️ Les deux noms restent EN PLEIN, même quand une seule face est
          possédée : ils disent ce que le monstre EST, pas ce qu'on en a. La
          moitié grisée du portrait porte déjà cette information, et ternir le
          nom par-dessus le rendait juste moins lisible. */}
      <div className="text-[12px] font-semibold leading-tight line-clamp-2">
        {jumeau ? libelleCollab(monster.name, jumeau.name) : monster.name}
      </div>
    </motion.div>
  );
}
