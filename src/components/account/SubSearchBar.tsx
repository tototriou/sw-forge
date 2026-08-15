import { useState } from 'react';
import { Grid2x2, Rows2 } from 'lucide-react';
import { Critere } from './CritereCase';
import SubSearchDialog from './SubSearchDialog';

// Barre « Propriété secondaire » — la grille de rappel du JEU : deux ou quatre
// cases numérotées, chacune montrant le critère qu'elle porte
// (« VIT +25 ~ +37 »), et la bascule 2 ↔ 4 à côté.
//
// ⚠️ Les cases sont un RAPPEL, pas un formulaire. Elles ne portaient jusqu'ici
// ni les bornes ni le nombre de propriétés du jeu : quatre menus déroulants
// occupaient toute la largeur pour n'afficher que trois lettres, et un seuil
// unique ne disait pas « entre 25 et 37 ». Toute la saisie vit désormais dans la
// modale — les cases se contentent d'en montrer le résultat.
//
// Cliquer une case, vide ou pleine, ouvre la modale : c'est le seul endroit où
// l'on choisit.
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
  // Deux ou quatre cases, comme le jeu. ⚠️ Le mode ne fait que CACHER des
  // cases : les critères 3 et 4 restent posés si on repasse à 2, ils
  // réapparaissent tels quels en revenant. Les effacer ferait perdre une
  // recherche en changeant simplement de vue.
  const [large, setLarge] = useState(false);
  // ⚠️ Le mode 4 s'IMPOSE dès qu'il y a plus de deux critères : un critère
  // caché filtrerait la liste sans rien montrer à l'écran — on chercherait
  // pourquoi il manque des runes. On ne peut donc pas replier à 2 tant qu'un
  // troisième critère est posé.
  const force = criteres.length > 2;
  const visibles = large || force ? max : 2;

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
        {/* Deux par ligne, comme dans le jeu — d'où la grille 2×2 en mode 4. */}
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-1 sm:grid-cols-2">
          {Array.from({ length: visibles }, (_, i) => {
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

        {/* Bascule 2 ↔ 4 cases — les DEUX ICÔNES du jeu : deux barres empilées
            pour 2 propriétés, une grille 2×2 pour 4. Elles disent la forme de la
            grille qu'on obtient, sans un mot.
            ⚠️ L'icône montre l'état À VENIR, pas l'état courant : c'est un
            bouton, on y lit ce qu'il va faire. */}
        <button
          onClick={() => setLarge((v) => !v)}
          disabled={force}
          aria-pressed={visibles === max}
          title={
            force
              ? 'Plus de deux propriétés sont posées : la grille reste à quatre'
              : large
                ? 'Revenir à deux propriétés'
                : 'Passer à quatre propriétés'
          }
          aria-label={large ? 'Revenir à deux propriétés' : 'Passer à quatre propriétés'}
          className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded border
                     border-border bg-panel text-ink-dim transition
                     hoverable:border-accent hoverable:text-ink
                     disabled:cursor-not-allowed disabled:opacity-30"
        >
          {visibles === max ? <Rows2 size={14} /> : <Grid2x2 size={14} />}
        </button>

        {/* ⚠️ Pas de bouton « … » : les cases ouvrent déjà la modale, et un
            second déclencheur pour le même geste n'ajoutait qu'un doublon à
            côté de la bascule 2/4 — deux carrés voisins dont un seul change la
            forme de la grille. */}
      </div>

      {ouverte && (
        <SubSearchDialog
          options={options}
          criteres={criteres}
          // ⚠️ Le maximum de la modale suit le MODE : en 2 cases, cocher une 3ᵉ
          // propriété poserait un critère invisible dans la barre. La bascule
          // vers 4 est à un clic si on en veut plus.
          max={visibles}
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
