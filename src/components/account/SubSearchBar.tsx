import { useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { Critere } from './CritereCase';
import SubSearchDialog from './SubSearchDialog';

// Barre « Propriété secondaire » — la grille de rappel du JEU : quatre cases
// numérotées, chacune montrant le critère qu'elle porte (« VIT +25 ~ +37 »), et
// un bouton « … » qui ouvre la recherche détaillée.
//
// ⚠️ Les cases sont un RAPPEL, pas un formulaire. Elles ne portaient jusqu'ici
// ni les bornes ni le nombre de propriétés du jeu : quatre menus déroulants
// occupaient toute la largeur pour n'afficher que trois lettres, et un seuil
// unique ne disait pas « entre 25 et 37 ». Toute la saisie vit désormais dans la
// modale — les cases se contentent d'en montrer le résultat.
//
// Cliquer n'importe où (une case, vide ou pleine, ou le « … ») ouvre la modale :
// c'est le seul endroit où l'on choisit.
export default function SubSearchBar({
  options,
  criteres,
  max,
  nomDe,
  onChange,
}: {
  options: { code: number; label: string }[];
  criteres: Critere[];
  max: number;
  nomDe: (code: number) => string;
  onChange: (c: Critere[]) => void;
}) {
  const [ouverte, setOuverte] = useState(false);

  // Résumé d'un critère, dans la langue du jeu : « VIT +25 ~ +37 », « VIT +25 »
  // si rien n'est plafonné, « VIT » si aucune borne n'est posée.
  const resume = (c: Critere) => {
    const nom = nomDe(c.code);
    if (!c.min && c.max == null) return nom;
    if (c.max == null) return `${nom} +${c.min}`;
    if (!c.min) return `${nom} ≤ ${c.max}`;
    return `${nom} +${c.min} ~ +${c.max}`;
  };

  return (
    <>
      <div className="flex items-start gap-1.5">
        {/* Grille 2×2 comme dans le jeu : quatre cases, deux par ligne. */}
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-1 sm:grid-cols-2">
          {Array.from({ length: max }, (_, i) => {
            const c = criteres[i];
            return (
              <button
                key={i}
                onClick={() => setOuverte(true)}
                title={c ? 'Modifier la recherche' : 'Choisir une propriété'}
                className={`flex min-h-[26px] items-center gap-1.5 rounded border px-1.5 py-0.5 text-left
                            transition ${
                              c
                                ? 'border-accent bg-accent-soft'
                                : 'border-border bg-panel hoverable:border-accent'
                            }`}
              >
                {/* Le numéro : il dit la PRIORITÉ DE TRI, comme dans le jeu. */}
                <span
                  className={`w-3 flex-none text-center font-mono text-[11px] font-bold ${
                    c ? 'text-accent' : 'text-ink-dim opacity-60'
                  }`}
                >
                  {i + 1}
                </span>
                <span
                  className={`min-w-0 flex-1 truncate font-mono text-[11px] ${
                    c ? 'text-ink' : 'text-ink-dim'
                  }`}
                >
                  {c ? resume(c) : '—'}
                </span>
              </button>
            );
          })}
        </div>

        {/* Le « … » du jeu : c'est LUI qui porte l'intention « ouvrir la
            recherche détaillée ». Les cases y mènent aussi, mais un bouton
            dédié le dit sans qu'on ait à deviner qu'une case est cliquable. */}
        <button
          onClick={() => setOuverte(true)}
          title="Recherche détaillée de sous-propriétés"
          aria-label="Recherche détaillée de sous-propriétés"
          className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded border
                     border-border bg-panel text-ink-dim transition
                     hoverable:border-accent hoverable:text-ink"
        >
          <MoreHorizontal size={14} />
        </button>
      </div>

      {ouverte && (
        <SubSearchDialog
          options={options}
          criteres={criteres}
          max={max}
          onValider={(c) => {
            onChange(c);
            setOuverte(false);
          }}
          onClose={() => setOuverte(false)}
        />
      )}
    </>
  );
}
