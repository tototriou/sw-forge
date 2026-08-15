import { X } from 'lucide-react';

// Un critère de recherche : une propriété et un seuil « au moins ».
//
// ⚠️ Les critères sont ORDONNÉS, et cet ordre est celui du **tri** : le premier
// classe la liste, le deuxième départage les ex æquo, et ainsi de suite —
// exactement comme la recherche détaillée du jeu. Ce n'est donc pas une simple
// liste de cases à cocher : la position de chaque critère porte du sens.
export interface Critere {
  code: number;
  min: number; // seuil en unité de la propriété (%, ou points pour les stats plates)
}

// Une case de la grille : le rang (= priorité de tri), la propriété, le seuil.
//
// Écrit pour les artéfacts, **remonté** ici au deuxième usage (les runes) plutôt
// que recopié — deux copies auraient divergé, comme les chips d'élément avant
// `elementStyles.ts`. Le seul point qui différait est le NOM d'une propriété :
// il est donc passé en paramètre (`nomDe`).
export default function CritereCase({
  rang,
  critere,
  options,
  nomDe,
  pasSeuil = 1,
  onChange,
}: {
  rang: number;
  critere: Critere | null;
  // Propriétés dans l'ordre du jeu.
  options: { code: number; label: string }[];
  // Libellé d'un code — la table diffère entre runes et artéfacts.
  nomDe: (code: number) => string;
  // Pas d'incrément du seuil. 1 convient aux propriétés en %, qui sont la
  // quasi-totalité ; les stats plates (PV, ATQ) se règlent au clavier.
  pasSeuil?: number;
  onChange: (c: Critere | null) => void;
}) {
  const pose = !!critere && critere.code > 0;
  // ⚠️ La propriété choisie est retirée des options (elle est « prise »), il
  // faut donc la réinjecter — sans quoi le `select` afficherait du vide sur un
  // critère pourtant posé.
  const manque = pose && !options.some((o) => o.code === critere!.code);

  return (
    /* ⚠️ AUCUN cadre ici : le `select` porte déjà sa propre bordure, et
       l'envelopper dans une boîte bordée faisait « carte dans carte ». La ligne
       n'est qu'une rangée de contrôles alignés. */
    <div className="flex min-h-[28px] items-center gap-1.5">
      {/* Le rang dit la PRIORITÉ DE TRI, pas un emplacement.
          ⚠️ Un CHIFFRE, pas un glyphe cerclé (➊➋) : à cette taille le cercle
          se refermait sur le chiffre et le rendait illisible. */}
      <span
        className={`w-3 flex-none text-center font-mono text-[12px] font-bold leading-none ${
          pose ? 'text-accent' : 'text-ink-dim opacity-60'
        }`}
        title={`${rang}${rang === 1 ? 'ᵉʳ' : 'ᵉ'} critère de tri`}
      >
        {rang}
      </span>

      {/* C'est LUI qui porte la bordure — le seul élément encadré de la ligne.
          Elle passe à l'accent quand un critère est posé. */}
      <select
        value={pose ? critere!.code : ''}
        onChange={(e) => {
          const code = Number(e.target.value);
          onChange(code ? { code, min: critere?.min ?? 0 } : null);
        }}
        className={`min-w-0 flex-1 cursor-pointer rounded border bg-panel px-1.5 py-1 text-[11px]
                    outline-none transition [&>option]:bg-panel [&>option]:text-ink ${
                      pose
                        ? 'border-accent text-ink'
                        : 'border-border text-ink-dim hoverable:border-accent hoverable:text-ink'
                    }`}
      >
        <option value="">Choisir une propriété…</option>
        {/* La propriété posée, réinjectée en tête quand elle a été retirée des
            options disponibles. */}
        {manque && <option value={critere!.code}>{nomDe(critere!.code)}</option>}
        {/* Dans l'ordre de la recherche détaillée du jeu. */}
        {options.map((o) => (
          <option key={o.code} value={o.code}>
            {o.label}
          </option>
        ))}
      </select>

      {/* Seuil « au moins » — n'a de sens qu'une fois la propriété choisie.
          ⚠️ Le « ≥ » est indispensable : « 25 » seul ne dit pas si c'est un
          minimum, un maximum ou la valeur exacte. */}
      {pose && (
        <div className="flex flex-none items-center gap-px">
          <span className="mr-0.5 font-mono text-[10px] text-ink-dim">≥</span>
          {/* Cibles de 18px : un glyphe nu était trop petit pour être visé
              franchement, surtout au doigt. */}
          <button
            onClick={() => onChange({ ...critere!, min: Math.max(0, critere!.min - pasSeuil) })}
            className="h-[18px] w-[18px] rounded bg-panel2 text-[12px] leading-none text-ink-dim
                       transition hoverable:bg-accent-soft hoverable:text-ink"
            title="Diminuer le minimum"
          >
            −
          </button>
          {/* ⚠️ `type="text"` + `inputMode="numeric"`, jamais `type="number"` —
              même règle que NumberField, et pour une raison de plus ici : sur un
              champ numérique le navigateur garde le TEXTE tapé tel quel. Taper
              « 015 » donnait bien `15` dans l'état, mais comme la valeur ne
              changeait pas au caractère suivant, React ne réécrivait pas le DOM
              et le « 0 » de tête restait affiché. En `text`, la valeur rendue
              est toujours celle de l'état — le zéro disparaît à la frappe.
              La frappe non numérique est simplement ignorée. */}
          <input
            type="text"
            inputMode="numeric"
            value={critere!.min}
            onChange={(e) => {
              const brut = e.target.value.trim();
              if (brut === '') return onChange({ ...critere!, min: 0 });
              if (!/^\d+$/.test(brut)) return; // frappe invalide ignorée
              onChange({ ...critere!, min: Number(brut) });
            }}
            className="h-[18px] w-[36px] rounded bg-panel2 text-center font-mono text-[10.5px]
                       text-ink outline-none tabular-nums"
            title="Minimum exigé"
          />
          <button
            onClick={() => onChange({ ...critere!, min: critere!.min + pasSeuil })}
            className="h-[18px] w-[18px] rounded bg-panel2 text-[12px] leading-none text-ink-dim
                       transition hoverable:bg-accent-soft hoverable:text-ink"
            title="Augmenter le minimum"
          >
            +
          </button>
          <button
            onClick={() => onChange(null)}
            className="ml-1 text-ink-dim transition hoverable:text-fire"
            title="Retirer ce critère"
          >
            <X size={12} />
          </button>
        </div>
      )}
    </div>
  );
}
