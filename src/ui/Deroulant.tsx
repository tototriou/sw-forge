import { ReactNode, useEffect, useId, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import Bouton from './Bouton';
import Flottant from './Flottant';

// DÉROULANT : un bouton qui dit un réglage et sa valeur (« Set · Swift,
// Violent ▾ »), et qui ouvre sous lui un panneau où l'on change cette valeur.
// Refonte graphique, lot 8a (décision 20) : les filtres des runes passent de
// rangées d'icônes à des menus compacts, comme la maquette (`.fbtn` + `.menu`).
//
// ⚠️ **Ce n'est pas un `Menu`.** Un menu liste des ACTIONS et se referme dès
// qu'on en choisit une ; un déroulant porte un RÉGLAGE, souvent à choix
// multiples (plusieurs sets), et reste ouvert tant qu'on règle. Il se referme
// au clic dehors, à Échap, ou en rappuyant sur son bouton.
//
// ⚠️ **Composé de la librairie** (`Bouton` + `Flottant`), pas un contrôle
// maison : le bouton a le gabarit `sm` des boutons à cadre, le panneau celui
// de `Flottant`. Le contenu est celui de l'appelant — les filtres existants,
// avec leurs propres boutons, libellés et états.
//
// ⚠️ **Le panneau reste dans le DOM, fermé** (`hidden`), comme celui de
// `Menu` : un contrôle ne quitte jamais le DOM selon l'état de l'écran
// (spec/shared/design.md), et les tests de rendu retrouvent ainsi chaque
// filtre.

export interface DeroulantProps {
  // Le nom du réglage, atténué devant sa valeur (« Set », « Emplacement »).
  intitule: string;
  // La valeur courante, résumée : icônes, noms, « Tous »…
  resume: ReactNode;
  // Le panneau : le contrôle qui change la valeur.
  children: ReactNode;
  // Largeur du panneau. Défaut : à sa taille de contenu.
  largeur?: string;
  // Infobulle du bouton (la valeur complète quand le résumé l'abrège).
  title?: string;
}

export default function Deroulant({ intitule, resume, children, largeur = 'w-max', title }: DeroulantProps) {
  const [ouvert, setOuvert] = useState(false);
  const racine = useRef<HTMLDivElement>(null);
  const declencheur = useRef<HTMLButtonElement>(null);
  const id = useId();

  // Ouvert : un clic dehors referme.
  useEffect(() => {
    if (!ouvert) return;
    const dehors = (e: PointerEvent) => {
      if (!racine.current?.contains(e.target as Node)) setOuvert(false);
    };
    document.addEventListener('pointerdown', dehors);
    return () => document.removeEventListener('pointerdown', dehors);
  }, [ouvert]);

  return (
    <div
      ref={racine}
      className="relative flex-none"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && ouvert) {
          e.preventDefault();
          setOuvert(false);
          declencheur.current?.focus();
        }
      }}
    >
      <Bouton
        ref={declencheur}
        taille="sm"
        onClick={() => setOuvert((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={ouvert}
        aria-controls={id}
        title={title}
        libelle={
          <span className="inline-flex items-center gap-1.5">
            <span className="font-medium text-ink-dim">{intitule}</span>
            {resume}
            <ChevronDown size={14} className="text-ink-dimmer" aria-hidden />
          </span>
        }
      />
      <Flottant
        rembourrage="sm"
        largeur={largeur}
        role="dialog"
        aria-label={intitule}
        className={ouvert ? '' : 'hidden'}
      >
        <div id={id}>{children}</div>
      </Flottant>
    </div>
  );
}
