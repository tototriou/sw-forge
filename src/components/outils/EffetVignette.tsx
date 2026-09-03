import { Check } from 'lucide-react';
import { Vignette } from '../../ui';

// Un effet actif, sous forme de vignette où l'ICÔNE EST LE CONTRÔLE — pas une
// icône décorative à côté d'une case à cocher.
//
// ⚠️ Extrait de `DamageSetupCard.tsx`, où il était local, quand les buffs
// ATQ/DEF/VIT ont rejoint « État de mon monstre » : deux composants s'en
// servent désormais, et le dupliquer aurait fait diverger deux rendus de la
// même chose.
export default function EffetVignette({
  icone,
  libelle,
  actif,
  onClick,
  etroit,
}: {
  icone: string;
  libelle: string;
  actif: boolean;
  onClick: () => void;
  etroit: boolean;
}) {
  return (
    <Vignette
      choisi={actif}
      onClick={onClick}
      largeur="w-16"
      aria-label={`${libelle} — ${actif ? 'actif' : 'inactif'}`}
      // ⚠️ `libelle` est tronqué (`truncate`, `Vignette.tsx`) à cette largeur
      // fixe — « Ce sort pose le def break » devient « Ce sort... », illisible
      // sans un moyen de retrouver le texte complet. `title` affiche le
      // libellé ENTIER au survol, natif, sans changer la mise en page.
      title={libelle}
      contenu={<img src={icone} alt="" className={`h-7 w-7 transition ${actif ? '' : 'grayscale'}`} loading="lazy" />}
      libelle={libelle}
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
