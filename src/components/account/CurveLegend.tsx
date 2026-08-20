import { X } from 'lucide-react';
import ZoneCliquable from '../../ui/ZoneCliquable';
import BoutonIcone from '../../ui/BoutonIcone';

// Une entrée de légende : le nom et la couleur d'une courbe, plus son éventuel
// retrait. Le retrait est ABSENT pour « Moi » et les potentiels (qui ne se
// retirent pas), PRÉSENT pour une courbe importée.
export interface EntreeLegende {
  name: string;
  color: string;
  onRetirer?: () => void;
}

// Légende SOUS le graphe, en rangée horizontale : point de couleur + nom.
// Cliquer un nom masque/affiche sa courbe ; la croix retire une courbe importée.
//
// ⚠️ **Partagée par les onglets Courbes et Comparaison.** Les deux affichaient
// la même pastille, écrite deux fois à la main — celle de Comparaison sans le
// soin responsive de l'autre. Une seule source évite qu'elles redivergent.
//
// ⚠️ **Chaque pastille est une `ZoneCliquable` (surface nue), pas un `Bouton`.**
// Une légende n'est pas une rangée de boutons encadrés — juste des noms qu'on
// éteint.
//
// ⚠️ **`data-cible-fine` la SORT de la règle tactile globale (40 px)** — et non
// un `min-h-0`, qui ne suffit pas : la règle vit HORS `@layer` (index.css), donc
// elle bat toute classe utilitaire quelle que soit la spécificité. La cible fait
// déjà toute la largeur de son texte, on ne la rate pas même à ~28 px de haut,
// et trois lignes de légende n'ont pas à peser 120 px. C'est la même exemption
// que les boutons du graphe (voir CurveChart), sans le `cible-tactile` qui leur
// rend une zone de 44 px : ici la largeur du texte suffit.
export default function CurveLegend({
  entrees,
  masquees,
  onBascule,
}: {
  entrees: EntreeLegende[];
  masquees: Set<string>;
  onBascule: (name: string) => void;
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
      {entrees.map(({ name, color, onRetirer }) => {
        const off = masquees.has(name);
        return (
          <span key={name} className="flex items-center gap-1.5">
            <ZoneCliquable
              onClick={() => onBascule(name)}
              title={off ? 'Afficher cette courbe' : 'Masquer cette courbe'}
              aria-pressed={!off}
              data-cible-fine
              className="flex items-center gap-2 rounded px-1.5 py-1
                         font-mono text-micro transition-colors hoverable:bg-panel2 sm:text-xs"
            >
              <span
                className="inline-block h-1.5 w-3 flex-none rounded-full transition"
                style={{ background: color, opacity: off ? 0.3 : 1 }}
              />
              <span
                className={`truncate font-semibold transition ${
                  off ? 'text-ink-dim line-through' : 'text-ink'
                }`}
              >
                {name}
              </span>
            </ZoneCliquable>
            {onRetirer && (
              <BoutonIcone
                onClick={onRetirer}
                icone={<X size={13} />}
                libelle="Retirer cette courbe"
                ton="danger"
                taille="serre"
              />
            )}
          </span>
        );
      })}
    </div>
  );
}
