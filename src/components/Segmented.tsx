// Contrôle générique à **choix unique** : des options côte à côte dans un même
// cadre, dont une seule est enfoncée.
//
// ⚠️ À préférer à une rangée de pastilles quand les options **s'excluent**. Des
// pastilles indépendantes se lisent comme des filtres cumulables : rien dans
// leur forme ne dit qu'en activer une désactive les autres. Le cadre commun le
// dit sans un mot.
//
// Il vivait dans [SettingsMenu.tsx](src/components/SettingsMenu.tsx), qui a été
// le premier à en avoir besoin ; il en a été **remonté** au deuxième usage
// plutôt que recopié — deux copies auraient divergé, comme les chips d'élément
// avant [elementStyles.ts](src/components/elementStyles.ts).
export default function Segmented<T extends string>({
  options,
  value,
  onChange,
  className = '',
  size = 'sm',
}: {
  options: { key: T; label: string; hint?: string; icon?: React.ReactNode; suffix?: React.ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
  // 'lg' : chaque option se partage la largeur à égalité, sur une seule
  // ligne bien visible — pour un choix structurant (peu d'options, chacune
  // méritant d'être lue d'un coup d'œil), pas un réglage secondaire.
  size?: 'sm' | 'lg';
}) {
  return (
    <div
      className={`flex items-center ${size === 'lg' ? 'w-full gap-0' : 'gap-0.5 flex-none'} bg-panel2 border border-border rounded-lg p-0.5 ${className}`}
    >
      {options.map((o, i) => {
        const active = value === o.key;
        return (
          <div key={o.key} className={`flex items-stretch ${size === 'lg' ? 'flex-1' : 'flex-none'}`}>
            {/* ⚠️ Élément à part, PAS un `border-l` posé sur le bouton
                arrondi : un `border-l` sur un `rounded-md` se courbe aux
                coins au lieu de rester droit. Un trait dédié, sans rayon,
                reste rigoureusement vertical sur toute la hauteur
                (`self-stretch`). Toujours dessiné, même entre deux cases
                adjacentes dont l'une est sélectionnée. */}
            {size === 'lg' && i > 0 && <span className="w-px self-stretch bg-border" />}
            <button
              onClick={() => onChange(o.key)}
              title={o.hint}
              aria-pressed={active}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md font-semibold
                          transition whitespace-nowrap ${
                            size === 'lg' ? 'px-2 py-1.5 text-xs' : 'px-2 py-1 text-micro'
                          } ${
                            // ⚠️ Le fond SEUL marque le cran posé — pas d'ombre
                            // en plus, elle faisait décoller le bouton de son
                            // propre cadre : deux signaux pour un seul état, et
                            // une élévation qui ne veut rien dire ici (le cran
                            // ne flotte pas au-dessus du contrôle qui le
                            // contient). Voir spec/shared/design.md.
                            active
                              ? 'bg-accent-soft text-ink'
                              : 'text-ink-dim hoverable:text-ink'
                          }`}
            >
              {o.icon}
              {o.label}
              {/* Après le libellé : un effectif se lit APRÈS ce qu'il compte
                  (« Importées 3 »), là où une icône se lit avant. */}
              {o.suffix}
            </button>
          </div>
        );
      })}
    </div>
  );
}
