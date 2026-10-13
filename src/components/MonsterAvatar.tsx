import { useState } from 'react';
import { Crown } from 'lucide-react';
import { LeaderSkill, Monster } from '../types';
import ElementIcon from './ElementIcon';
import CollabPortrait from './CollabPortrait';
import { LeadBadge } from './siege/LeadPill';

// Portrait hexagonal d'un monstre et ses pastilles en coin — LE seul endroit
// de l'app qui le dessine (hors fiche de monstre, qui a son propre cadre).
//
// Pourquoi un composant partagé : le nom NE SUFFIT PAS à identifier un monstre.
// Plusieurs entrées portent le même nom et le même élément (formes 2A, variantes
// d'un même monstre) — chercher « Tarq » en renvoie trois. Seul le portrait
// permet de choisir la bonne, donc toute liste où l'on sélectionne un monstre
// doit l'afficher. Voir ../../docs/02-app/transverse/.
//
// ⚠️ **Deux gabarits de DOM, pas un.** Les portraits factorisés ici avaient
// chacun le leur, et le DOM ne doit pas changer d'un nœud (le banc d'affichage
// lit la structure, pas seulement le pixel) :
// - `span` (défaut) : taille en style en ligne sur la racine, `title` = le nom ;
// - `div` : taille portée par le CADRE, en classes (`compact:` possible), sans
//   style en ligne ni `title` par défaut — le gabarit des cartes (box, RTA,
//   siège).
//
// ⚠️ **Repères pour le banc** : `data-portrait` sur la racine,
// `data-pastille="element|exemplaires|lead|couronne"` sur l'élément POSITIONNÉ
// de chaque pastille, jamais sur une enveloppe : en envelopper une changerait
// son bloc contenant, et donc ce que le banc mesure. Chaque pastille peut
// toucher son portrait, jamais le reste ni une autre pastille.

const GRADIENT: Record<string, string> = {
  fire: 'from-fire to-panel2',
  water: 'from-water to-panel2',
  wind: 'from-wind to-panel2',
  light: 'from-light to-panel2',
  dark: 'from-dark to-panel2',
  unknown: 'from-unknown to-panel2',
};
const TEXT: Record<string, string> = {
  fire: 'text-fire',
  water: 'text-water',
  wind: 'text-wind',
  light: 'text-light',
  dark: 'text-dark',
  unknown: 'text-unknown',
};

export function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

const OMBRE_COIN = 'drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]';

export default function MonsterAvatar({
  monster,
  fallback,
  size = 30,
  element = true,
  className = '',
  gabarit = 'span',
  classeTaille = '',
  classeRacine = 'flex-none',
  titre,
  onClick,
  classeInitiales,
  tailleElement,
  fond = 'bg-panel',
  cadreRelatif = false,
  collab,
  exemplaires,
  lead,
  tailleLead,
  couronne = false,
}: {
  monster: Monster | null;
  fallback?: string; // nom de repli quand le monstre est absent des données
  size?: number; // gabarit `span` seulement
  element?: boolean; // pastille d'élément (on la coupe si l'élément est déjà lisible ailleurs)
  className?: string; // classes ajoutées à la racine
  gabarit?: 'span' | 'div';
  classeTaille?: string; // gabarit `div` : classes de taille du cadre (`w-[50px] h-[50px] compact:…`)
  classeRacine?: string; // remplace `flex-none` sur la racine (`w-[64px] mx-auto …` d'une carte)
  // `undefined` : le nom en `span`, rien en `div` ; `null` : aucun ; texte : celui-là.
  titre?: string | null;
  onClick?: () => void;
  classeInitiales?: string; // remplace la taille de police calculée (`text-sm`…)
  tailleElement?: number; // défaut : 0,42 × `size`
  fond?: 'bg-panel' | 'bg-panel2';
  cadreRelatif?: boolean; // cadre interne `relative` (seconde moitié d'un jumeau collab)
  // Paire de collab (carte de la box ou du bestiaire) : portrait partagé, et
  // repli sur les initiales si l'image casse.
  collab?: { jumeau?: Monster | null; possede?: boolean; jumeauPossede?: boolean };
  exemplaires?: number | null; // pastille « ×N », affichée au-delà de 1
  lead?: LeaderSkill | null;
  tailleLead?: number;
  couronne?: boolean;
}) {
  const [imageCassee, setImageCassee] = useState(false);
  const nom = monster?.name || fallback || '?';
  const el = monster?.element ?? 'unknown';
  const enDiv = gabarit === 'div';
  const Balise = enDiv ? 'div' : 'span';
  const title = titre === undefined ? (enDiv ? undefined : nom) : (titre ?? undefined);

  const initialesRendues = classeInitiales ? (
    <span className={`font-display font-bold ${classeInitiales} ${TEXT[el]}`}>{initials(nom)}</span>
  ) : (
    <span className={`font-display font-bold ${TEXT[el]}`} style={{ fontSize: Math.max(7, size * 0.3) }}>
      {initials(nom)}
    </span>
  );

  let contenu: React.ReactNode;
  if (collab && monster) {
    contenu =
      monster.image && !imageCassee ? (
        <CollabPortrait
          monster={monster}
          jumeau={collab.jumeau}
          possede={collab.possede}
          jumeauPossede={collab.jumeauPossede}
          onError={() => setImageCassee(true)}
        />
      ) : (
        initialesRendues
      );
  } else {
    contenu = monster?.image ? (
      <img src={monster.image} alt={nom} className="w-full h-full object-cover" />
    ) : (
      initialesRendues
    );
  }

  return (
    <Balise
      data-portrait=""
      className={`relative ${classeRacine} ${className}`}
      style={enDiv ? undefined : { width: size, height: size }}
      title={title}
      onClick={onClick}
    >
      <Balise
        className={
          enDiv
            ? `hex-frame ${classeTaille} p-[2px] bg-gradient-to-br ${GRADIENT[el]}`
            : `hex-frame block w-full h-full p-[2px] bg-gradient-to-br ${GRADIENT[el]}`
        }
      >
        <Balise
          className={`hex-frame ${cadreRelatif ? 'relative' : ''} w-full h-full ${fond} flex items-center justify-center overflow-hidden`}
        >
          {contenu}
        </Balise>
      </Balise>
      {element && monster && (
        <ElementIcon
          element={monster.element}
          size={tailleElement ?? Math.round(size * 0.42)}
          className={`absolute -top-1 -right-1 ${OMBRE_COIN}`}
          pastille="element"
        />
      )}
      {/* En BAS à droite, à l'opposé de l'icône d'élément : les deux se
          chevaucheraient sur un portrait de cette taille. */}
      {exemplaires != null && exemplaires > 1 && (
        <span
          data-pastille="exemplaires"
          className="absolute -bottom-1 -right-1 flex h-5 min-w-[20px] items-center justify-center
                     rounded-full border border-accent bg-accent-soft px-1 font-mono text-micro
                     font-bold text-ink shadow-[0_1px_3px_rgba(0,0,0,0.6)]"
          title={`${exemplaires} exemplaires`}
        >
          ×{exemplaires}
        </span>
      )}
      {lead && <LeadBadge ls={lead} size={tailleLead} />}
      {couronne && (
        <Crown
          data-pastille="couronne"
          size={13}
          className="absolute -top-2 -left-1 text-star drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
        />
      )}
    </Balise>
  );
}
