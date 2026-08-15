import { Monster } from '../types';

// Portrait d'une paire de COLLABORATION : les deux visages sur une seule image,
// séparés verticalement — le monstre d'origine à gauche, son jumeau à droite.
//
// ⚠️ **Un seul rendu pour la carte ET la fiche.** Les deux en avaient chacun un,
// et un `clip-path` recopié aurait divergé au premier ajustement — c'est
// exactement ce qui était arrivé aux cartes du bestiaire et de la box avant
// `MonsterCard`. Seule la taille change, et elle vient du conteneur.
//
// ⚠️ La seconde image est **posée par-dessus et découpée**, plutôt que deux
// moitiés accolées : chaque portrait garde ainsi son cadrage d'origine, là où
// deux moitiés écraseraient les visages.
//
// ⚠️ Les `object-position` sont **tirés vers l'extérieur** (30 % / 70 %) : les
// portraits SW centrent le visage, et n'en garder que la moitié le couperait
// en deux.
export default function CollabPortrait({
  monster,
  jumeau,
  onError,
}: {
  monster: Monster;
  // Absent (ou sans image) : portrait ordinaire, non découpé.
  jumeau?: Monster | null;
  // La carte s'en sert pour retomber sur les initiales quand l'image casse.
  onError?: () => void;
}) {
  const partage = Boolean(jumeau?.image);

  return (
    <>
      <img
        src={monster.image!}
        alt={monster.name}
        loading="lazy"
        onError={onError}
        className="h-full w-full object-cover"
        style={partage ? { objectPosition: '30% center' } : undefined}
      />
      {partage && (
        <>
          <img
            src={jumeau!.image!}
            alt={jumeau!.name}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
            style={{
              clipPath: 'polygon(50% 0, 100% 0, 100% 100%, 50% 100%)',
              objectPosition: '70% center',
            }}
          />
          {/* Trait de séparation : sans lui, deux portraits sombres se fondent
              l'un dans l'autre et la coupe ne se lit plus. */}
          <span
            aria-hidden
            className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-white/50"
          />
        </>
      )}
    </>
  );
}
