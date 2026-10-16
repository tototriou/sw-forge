import { Check } from 'lucide-react';
import { Vignette } from '../../ui';

// Un effet actif, sous forme de vignette où l'ICÔNE EST LE CONTRÔLE — pas une
// icône décorative à côté d'une case à cocher.
//
// ⚠️ Partagé par `DamageSetupCard.tsx` et « État de mon monstre » (buffs
// ATQ/DEF/VIT) : deux composants s'en servent, et le dupliquer ferait
// diverger deux rendus de la même chose.
export default function EffetVignette({
  icone,
  libelle,
  description,
  actif,
  onClick,
  etroit,
  deuxLignes = false,
}: {
  icone: string;
  libelle: string;
  description?: string;
  actif: boolean;
  onClick: () => void;
  etroit: boolean;
  // Libellé rendu sur deux lignes (le mot le plus long tient en une) au lieu
  // d'être tronqué. Les autres vignettes, au libellé court, restent à une.
  deuxLignes?: boolean;
}) {
  return (
    <Vignette
      choisi={actif}
      onClick={onClick}
      // Au format étroit, vignettes plus serrées : plus d'effets par rangée.
      largeur={etroit ? 'w-14' : 'w-16'}
      aria-label={`${libelle} — ${actif ? 'actif' : 'inactif'}`}
      // ⚠️ `libelle` est tronqué (`truncate`, `Vignette.tsx`) à cette largeur
      // fixe — « Ce sort pose le def break » devient « Ce sort... », illisible
      // sans un moyen de retrouver le texte complet. `title` affiche le
      // libellé ENTIER au survol, natif, sans changer la mise en page.
      title={description ?? libelle}
      contenu={<img src={icone} alt="" className={`h-7 w-7 transition ${actif ? '' : 'grayscale'}`} loading="lazy" />}
      // ⚠️ `Vignette` pose `truncate` (une ligne, `white-space: nowrap`) sur
      // son libellé : l'enfant rétablit le retour à la ligne, la boîte parente
      // s'allonge d'une ligne (sa hauteur est automatique) sans rien ajouter à
      // `src/ui/`.
      libelle={deuxLignes ? <span className="block whitespace-normal">{libelle}</span> : libelle}
      // ⚠️ Coche masquée au DOIGT (même raison que CategoryBar) : à cette
      // taille de vignette, un médaillon de plus dans le coin serait une
      // cible de trop à côté de la cible déjà fine du bouton lui-même — le
      // fond renforcé (`fondAppuye`) y porte seul l'état.
      fondAppuye={etroit}
      coin={
        actif && !etroit ? (
          <span className="absolute right-0.5 top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-accent">
            <Check size={9} className="text-bg" />
          </span>
        ) : undefined
      }
    />
  );
}
