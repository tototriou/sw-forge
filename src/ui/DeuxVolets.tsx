import { ReactNode, useEffect } from 'react';
import { Group, Panel, Separator, useGroupRef } from 'react-resizable-panels';

// Deux zones côte à côte et le séparateur qu'on glisse entre elles — l'écran
// partagé (docs/02-app/transverse/feat-navigation/ecran-partage.md).
//
// ⚠️ **Le glisser vient de react-resizable-panels**, pas d'un code maison :
// bornes, clavier (flèches sur le séparateur), rôle `separator` et ses
// attributs ARIA, double-clic qui ramène au 50/50. Ce composant n'y ajoute que
// le dessin, en tokens.
//
// ⚠️ **Les minimums sont en PIXELS** (`minGauche`, `minDroite`) : c'est la
// largeur sous laquelle la page de chaque côté ne se lit plus, quelle que soit
// la fenêtre. Le séparateur bute dessus.
//
// ⚠️ **La taille est CONTRÔLÉE** (`taille`, en pourcentage de la zone de
// gauche) : l'appelant la garde, et la change aussi quand il inverse les deux
// côtés. Seul un geste de l'utilisateur la remonte (`onTaille`), jamais un
// recalcul de la librairie au montage ou à un redimensionnement de fenêtre.

export interface DeuxVoletsProps {
  gauche: ReactNode;
  droite: ReactNode;
  minGauche: number;
  minDroite: number;
  taille: number;
  onTaille: (taille: number) => void;
  /** Nom du séparateur pour un lecteur d'écran (et infobulle). */
  libelleSeparateur: string;
  className?: string;
}

export default function DeuxVolets({
  gauche,
  droite,
  minGauche,
  minDroite,
  taille,
  onTaille,
  libelleSeparateur,
  className = '',
}: DeuxVoletsProps) {
  const groupe = useGroupRef();

  // Une taille changée par l'appelant (inversion des côtés) est appliquée ;
  // celle qui vient du glisser y est déjà, à l'arrondi près.
  useEffect(() => {
    const g = groupe.current;
    if (!g) return;
    const actuelle = g.getLayout().gauche;
    if (actuelle === undefined || Math.abs(actuelle - taille) > 0.5) {
      g.setLayout({ gauche: taille, droite: 100 - taille });
    }
  }, [groupe, taille]);

  return (
    <Group
      groupRef={groupe}
      orientation="horizontal"
      defaultLayout={{ gauche: taille, droite: 100 - taille }}
      onLayoutChanged={(layout, meta) => {
        if (meta.isUserInteraction && layout.gauche !== undefined) onTaille(layout.gauche);
      }}
      className={className}
    >
      <Panel id="gauche" minSize={minGauche} defaultSize="50%" className="flex min-w-0">
        {gauche}
      </Panel>
      {/* ⚠️ La zone saisissable fait 12 px, le trait 1 : un trait seul serait
          impossible à attraper, une barre de 12 px pèserait autant qu'un
          contour de plus entre deux volets déjà cadrés. */}
      <Separator
        aria-label={libelleSeparateur}
        title={libelleSeparateur}
        className="group relative flex w-3 flex-none justify-center focus-visible:outline-none"
      >
        <span
          aria-hidden
          className="h-full w-px bg-border-soft transition-colors
                     group-data-[separator=hover]:bg-accent group-data-[separator=active]:bg-accent
                     group-data-[separator=focus]:bg-accent"
        />
        <span
          aria-hidden
          className="absolute top-1/2 left-1/2 h-8 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full
                     border border-border bg-panel2 transition-colors
                     group-data-[separator=active]:border-accent group-data-[separator=focus]:border-accent"
        />
      </Separator>
      <Panel id="droite" minSize={minDroite} defaultSize="50%" className="flex min-w-0">
        {droite}
      </Panel>
    </Group>
  );
}
