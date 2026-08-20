import { ReactNode, useEffect, useRef, useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { BoutonIcone, FlottantAuto } from '../ui';
import MobileSheet from '../ui/MobileSheet';
import { useMediaQuery, SOUS_LG } from '../hooks/useMediaQuery';

// Bouton d'aide « ? » + son texte, sur DEUX supports selon le format — le patron
// né dans RunesCurve (Mon compte → Courbes), généralisé ici pour qu'un même
// besoin d'aide ne se réécrive plus à la main à chaque page.
//
// ⚠️ **Deux supports pour le même texte.** Une aide fait souvent une demi-page :
// ancrée à un petit bouton, une bulle flottante descend sous le bas de l'écran
// sur téléphone et ses dernières lignes passent derrière la barre d'onglets. Sous
// `lg` elle devient donc un PANNEAU MONTANT (`MobileSheet`), le composant que
// l'app emploie partout ailleurs pour ça ; à la souris, une bulle ancrée
// (`FlottantAuto`, qui mesure la place et choisit son côté).
//
// ⚠️ **Rien d'écrit à la main ici** : le bouton est un `BoutonIcone` (cadre, zone
// tactile, état actif sont ses axes), la bulle un `FlottantAuto` (bord, ombre et
// `z-index` lui appartiennent — jamais un `<div absolute z-…>` maison). C'est ce
// que la version manuscrite réécrivait un contrôle à la fois, chaque fois un peu
// différemment. Voir spec/shared/librairie-ui.md.
export default function HelpPopover({
  title,
  children,
  ariaLabel,
  width = 340,
}: {
  // Titre du panneau : sert de titre au panneau montant, d'en-tête à la bulle, et
  // de libellé au bouton faute d'`ariaLabel`.
  title: string;
  children: ReactNode;
  // Libellé du BOUTON quand il diffère du titre du panneau (« Comment lire ce
  // graphe ? » sur le bouton, « À quoi sert ce graphe ? » en en-tête).
  ariaLabel?: string;
  width?: number;
}) {
  const [open, setOpen] = useState(false);
  const auDoigt = useMediaQuery(SOUS_LG);
  const ref = useRef<HTMLDivElement>(null);

  // Ferme la bulle au clic à l'extérieur.
  // ⚠️ Popover SEULEMENT : le panneau montant a son propre voile et sa croix, et
  // cet écouteur l'aurait refermé au premier appui à l'intérieur.
  useEffect(() => {
    if (!open || auDoigt) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, auDoigt]);

  return (
    <div ref={ref} className="relative">
      <BoutonIcone
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        libelle={ariaLabel ?? title}
        icone={<HelpCircle size={14} />}
        cadre
        forme="pilule"
        zoneEtendue
        actif={open}
      />

      {/* À la SOURIS : bulle ancrée au bouton, qui choisit son côté. */}
      <FlottantAuto ouvert={open && !auDoigt} ancre={ref} largeur={width} hauteur={420}>
        <div className="text-xs leading-relaxed text-ink-dim">
          <p className="text-ink font-semibold mb-1">{title}</p>
          {children}
        </div>
      </FlottantAuto>

      {/* AU DOIGT : panneau montant, pleine largeur, défilant, au-dessus des onglets. */}
      <MobileSheet ouvert={open && auDoigt} onFermer={() => setOpen(false)} titre={title}>
        <div className="text-xs leading-relaxed text-ink-dim">{children}</div>
      </MobileSheet>
    </div>
  );
}
