import { SlidersHorizontal } from 'lucide-react';
import { type ReactNode } from 'react';

export interface CriteresRechercheProps {
  setDeRunes: ReactNode;
  statPrincipaleImposee: ReactNode;
  conditions: ReactNode;
}

// Le titre de la carte, exporté pour la forme de bureau des essentiels
// (`bureau/SetDeRunesCompact.tsx`) : un seul dessin.
export function TitreCriteresRecherche({ className }: { className: string }) {
  return (
    <div className={`${className} flex items-center gap-2`}>
      {/* Curseurs de réglage, colorés (accent) — plus parlant qu'une
          cible générique pour « plusieurs critères ajustables », et
          distinct du `Target` déjà utilisé plus bas pour un réglage
          précis (« Prioriser les stats les plus difficiles »). */}
      <div className="flex h-6 w-6 flex-none items-center justify-center rounded-md border border-accent/40 bg-accent-soft">
        <SlidersHorizontal size={13} className="text-accent" />
      </div>
      <p className="text-[13.5px] font-bold text-ink">Critères de recherche</p>
    </div>
  );
}

export default function CriteresRecherche({ setDeRunes, statPrincipaleImposee, conditions }: CriteresRechercheProps) {
  return (
    <div className="rounded-xl border border-border bg-panel p-3 xl:col-start-1 xl:row-start-2 xl:row-span-4">
      <TitreCriteresRecherche className="mb-3" />
      {/* ⚠️ **Deux colonnes** (demande explicite) : Set de runes recherché
          + Statistique principale imposée à GAUCHE (les deux contraintes
          qui portent sur les runes elles-mêmes), Artéfacts + Conditions à
          DROITE — vérifié sur un écran réel (capture d'écran) qu'il reste
          assez de place pour « Objectif de recherche » à côté, malgré la
          carte élargie par cette deuxième colonne. `items-start` : la
          colonne la plus courte ne s'étire pas à la hauteur de l'autre.
          Sous `lg`, retour à l'empilement (ordre du DOM inchangé : Set,
          Statistique principale, Artéfacts, Conditions). */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
      {/* ⚠️ **Trait vertical entre les deux colonnes** (demande explicite,
          capture d'écran à l'appui) — `lg:border-r` posé sur la colonne de
          GAUCHE uniquement (pas de `border-l` en plus sur la droite : deux
          traits à 1 px l'un de l'autre se liraient comme un contour flou,
          voir docs/03-developpeur/interface/). `lg:pr-6` : le trait respire du même
          écart que `lg:gap-6` sur le conteneur, sans quoi il collerait au
          texte de gauche. UNIQUEMENT à partir de `lg` — sous ce seuil, les
          deux « colonnes » s'empilent (`flex-col`), un trait vertical n'y
          aurait aucun sens. */}
      <div className="lg:border-r lg:border-border-soft lg:pr-6">
    {/* ⚠️ `max-w-md` — SEUL rempart (la carte elle-même n'a pas de
        `w-fit`, voir le commentaire d'ouverture de cette carte) : sans lui, ce
        bloc se laisserait pousser jusqu'à la largeur disponible de la
        piste de grille, beaucoup plus large que ce set n'en a besoin. */}
    {setDeRunes}

    {/* ⚠️ Trait horizontal entre Set de runes recherché et Statistique
        principale imposée (demande explicite) — `mt-4 border-t pt-4`
        remplace le `space-y-4` qu'avait le conteneur parent (sinon la
        marge automatique ET la bordure s'additionneraient, doublant
        l'écart visuel). */}
    {statPrincipaleImposee}
      </div>

      <div>
    {/* ⚠️ Le bloc « Artéfacts » vivait ICI, en tête de cette colonne, au-
        dessus de Conditions. Déplacé dans sa PROPRE carte (colonne 2,
        rangée 2 — voir plus bas) : son interrupteur « Ignorer les
        statistiques » masquait sélecteurs et lignes verrouillées d'un coup,
        ce qui faisait REMONTER Conditions sous le doigt. Cette colonne ne
        porte donc plus que Conditions, et le trait qui les séparait a
        disparu avec lui — un trait en TÊTE de colonne, sans rien au-dessus,
        ne sépare plus rien. */}
    {conditions}

      </div>
      </div>
    </div>
  );
}
