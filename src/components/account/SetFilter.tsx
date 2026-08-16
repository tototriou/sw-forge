import { useMemo } from 'react';
import { X } from 'lucide-react';
import { RuneDetail, RUNE_SETS } from '../../types';
import RuneIcon from '../RuneIcon';

// Colorisation DORÉE des symboles de set dans les barres de filtre. Les PNG du
// jeu sont multicolores : alignés par vingt-cinq ils font une rangée bruyante où
// rien ne ressort. Ramenés à une seule teinte, la barre se lit comme une frise
// et seul l'état actif se détache.
//
// ⚠️ **Un FILTRE CSS, pas un masque.** Masquer l'alpha du PNG remplit le glyphe
// d'aplat : on perd tout le relief interne et l'icône paraît floue à 18 px. Le
// filtre, lui, conserve la luminance d'origine — donc le dessin reste net.
// Même technique que `RARITY_FILTER` (voir lib/effects.ts).
const OR = (clair: boolean) =>
  `sepia(1) saturate(3.2) hue-rotate(-12deg) brightness(${clair ? 1.15 : 0.95}) contrast(1.05)`;

// Filtre multi-sélection par set de runes, **icônes seules**.
//
// Règle d'interface (voir ../../spec/compte/runes.md) : partout où l'on filtre
// sur les sets, on montre **l'icône du jeu sans le nom**. Les icônes sont
// reconnues d'un coup d'œil par n'importe quel joueur, alors que les libellés
// alignés sur une ligne font un mur de texte et limitent le nombre de sets
// visibles sans défilement. Le nom reste en infobulle et en `aria-label`.
export default function SetFilter({
  runes,
  value,
  onChange,
  label = 'Sets',
}: {
  runes: RuneDetail[];
  value: Set<string>;
  onChange: (next: Set<string>) => void;
  label?: string;
}) {
  // Seulement les sets réellement présents dans l'inventaire : proposer un
  // filtre qui ne peut rien renvoyer n'aide personne.
  const present = useMemo(() => {
    const s = new Set(runes.map((r) => r.set));
    return RUNE_SETS.filter((rs) => s.has(rs.key));
  }, [runes]);

  const toggle = (key: string) => {
    const next = new Set(value);
    next.has(key) ? next.delete(key) : next.add(key);
    onChange(next);
  };

  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="label mr-1">{label}</span>
      {/* Une SEULE barre continue plutôt que des boutons détachés : les symboles
          se lisent comme une rangée d'icônes du jeu, et l'ensemble tient sur une
          ligne même avec 25 sets. Seul l'état actif porte un cadre. */}
      <div className="flex flex-wrap items-center gap-0.5 rounded-lg border border-border bg-panel p-1 coarse:gap-1">
        {present.map((s) => {
          const active = value.has(s.key);
          return (
            <button
              key={s.key}
              onClick={() => toggle(s.key)}
              title={s.label}
              aria-label={s.label}
              aria-pressed={active}
              // ⚠️ `data-cible-fine` : la règle tactile globale (40 px) ne
              // s'applique pas à cette GRILLE. Vingt-six sets à 40 px feraient
              // quatre lignes de pastilles avant le premier résultat — la
              // liste qu'on vient filtrer se retrouvait hors écran.
              // ⚠️ Elles ne grossissent PAS non plus au doigt : c'est
              // l'ESPACEMENT entre cibles alignées qui évite d'activer le
              // voisin, pas leur taille. L'icône de set est reconnaissable à
              // 28 px, c'est ce qui compte ici.
              data-cible-fine
              className={`flex items-center justify-center w-7 h-7 rounded-md border transition select-none
                ${
                  // ⚠️ Fond seul (voir spec/shared/design.md). La bordure reste
                  // TRANSPARENTE et non `border`, comme au repos : ces pastilles
                  // n'ont pas de contour, en faire apparaître un à la sélection
                  // ajouterait un second marqueur — c'est le fond qui parle.
                  active
                    ? 'bg-accent-soft border-transparent'
                    : 'border-transparent opacity-50 hoverable:opacity-100 hoverable:bg-panel2'
                }`}
            >
              <RuneIcon setKey={s.key} size={18} filter={OR(active)} />
            </button>
          );
        })}
      </div>
      {/* Réinitialisation : même gabarit que les pastilles de set (32 px, même
          rayon, même bordure) pour ne pas casser la rangée, mais sans fond actif
          et virant au rouge au survol — c'est une action, pas un set de plus. */}
      {value.size > 0 && (
        <button
          onClick={() => onChange(new Set())}
          title="Effacer le filtre de sets"
          className="ml-1 flex h-8 items-center gap-1 rounded-md border border-border bg-panel px-2.5
                     text-micro font-semibold text-ink-dim transition
                     hoverable:border-fire/60 hoverable:text-fire"
        >
          <X size={12} className="flex-none" /> tout
        </button>
      )}
    </div>
  );
}
