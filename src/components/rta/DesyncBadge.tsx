import { useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import DetailPopover from '../account/DetailPopover';
import { BoutonIcone } from '../../ui';

// Avertissement « vitesse modifiée à la main » : triangle orange, et le détail
// **au CLIC**, pas au survol.
//
// Pourquoi le clic : l'infobulle native ne s'ouvre qu'après un temps d'arrêt,
// disparaît dès qu'on bouge, et n'existe pas au tactile — or le message compte
// (il donne la valeur à remettre pour resynchroniser). Un petit panneau au clic
// se lit tranquillement et fonctionne au doigt.
export default function DesyncBadge({
  ecart,
  size = 14,
}: {
  ecart: { attendu: number; saisi: number };
  size?: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  return (
    /* ⚠️ `inline-flex` et non l'affichage `inline` par défaut d'un <span> : sur
       un élément inline, un enfant `absolute` s'ancre sur la BOÎTE DE LIGNE, et
       `top-full` se calcule sur sa hauteur — le panneau atterrissait à côté de
       l'icône au lieu d'être dessous. */
    <span ref={ref} className="relative inline-flex flex-none">
      {/* ⚠️ Ton `alerte` : sa couleur ne dit pas ce que le bouton FAIT mais
          l'état des données — d'où une teinte présente dès le repos, qui ne
          bouge pas au survol. Voir Bouton.
          ⚠️ `taille="serre"` : le badge est posé dans la ligne d'une carte de
          150 px, entre la vitesse et les icônes de set. Porté à 40 px par la
          règle tactile, il faisait déborder la ligne. */}
      <BoutonIcone
        onClick={(e) => {
          e.stopPropagation(); // sinon la carte s'ouvrirait (clic = voir les runes)
          setOpen((v) => !v);
        }}
        aria-expanded={open}
        libelle="Vitesse modifiée à la main"
        // Le panneau qui s'ouvre au clic EST l'explication : une infobulle
        // native ferait doublon, et s'afficherait par-dessus lui.
        sansInfobulle
        ton="alerte"
        taille="serre"
        icone={<AlertTriangle size={size} />}
        className="hoverable:bg-transparent"
      />

      {/* ⚠️ Placement AUTOMATIQUE (`DetailPopover`) : les cartes vont jusqu'au
          bord droit de la page, un panneau ancré en dur en sortait. Il bascule
          vers la gauche ou vers le haut selon la place disponible. */}
      <DetailPopover open={open} anchorRef={ref} width={230} height={130}>
        <div
          className="rounded-lg border border-warn/50 bg-panel p-2.5 text-left text-micro
                     leading-relaxed text-ink-dim"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="mb-1 block font-semibold text-warn">Runes plus à jour</span>
          Les runes affichées ne correspondent plus à la vitesse demandée dans l'ordre de tour : elles
          donnent <b className="text-ink">{ecart.attendu}</b> de SPD, alors qu'il en faut{' '}
          <b className="text-fire">{ecart.saisi}</b>. Cette vitesse demandée apparaît{' '}
          <b className="text-fire">en rouge</b> sur la ligne VIT de la fiche.
        </div>
      </DetailPopover>
    </span>
  );
}
