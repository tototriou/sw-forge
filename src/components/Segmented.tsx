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
}: {
  options: { key: T; label: string; hint?: string; icon?: React.ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center gap-0.5 bg-panel2 border border-border rounded-lg p-0.5 flex-none ${className}`}
    >
      {options.map((o) => {
        const active = value === o.key;
        return (
          <button
            key={o.key}
            onClick={() => onChange(o.key)}
            title={o.hint}
            aria-pressed={active}
            className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-[11.5px] font-semibold
                        transition whitespace-nowrap ${
                          active
                            ? 'bg-accent-soft text-ink shadow'
                            : 'text-ink-dim hoverable:text-ink'
                        }`}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
