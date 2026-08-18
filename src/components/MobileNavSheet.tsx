import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import MobileSheet from '../ui/MobileSheet';
import { SidebarGroupe, SidebarLien, SidebarSection } from './Sidebar';

// Choix de la SOUS-SECTION sur téléphone — le second niveau de navigation.
//
// ⚠️ **Toucher une section n'ouvre pas une page, il ouvre ce panneau.** C'est la
// même règle que la barre latérale (« la barre navigue SEULE ») portée au
// format tactile : on choisit d'abord OÙ, la page ne change qu'ensuite. Sans
// lui, « Compte » menait droit à l'inventaire de monstres et les dix autres vues
// n'étaient atteignables que par des rangées d'onglets posées dans la page —
// une par écran, chacune avec son rendu, invisibles tant qu'on n'y était pas.
//
// ⚠️ **DEUX TEMPS quand la section a des groupes** : on choisit d'abord
// l'inventaire (Monstres · Runes · Artéfacts), puis sa vue. Les dix
// destinations de « Mon compte » ont d'abord été posées à plat, groupes et
// intitulés compris : c'est la liste de la barre latérale, qui tient sur un
// écran de bureau haut de 900 px et pas dans un panneau qui s'arrête au tiers
// de l'écran. On y défilait pour trouver, alors que les trois inventaires
// suffisent à s'orienter.
//
// ⚠️ **Un seul temps quand il n'y a rien à trancher.** « Siège » n'a qu'un
// groupe, sans intitulé : ses trois vues s'affichent directement. Faire choisir
// un groupe unique ajoute un geste sans rien donner à décider — la même règle
// qui laisse « Outils » en simple lien dans la barre d'onglets.
//
// ⚠️ **Il monte du BAS, sous le doigt qui l'a demandé.** Son déclencheur est un
// onglet de la barre du bas ; un menu qui surgirait en haut de l'écran
// obligerait à refaire le lien entre les deux à chaque fois — et le haut d'un
// téléphone tenu à une main est hors d'atteinte du pouce.
//
// ⚠️ **Les mêmes `SidebarSection` que la barre latérale**, pas une seconde
// liste. Une liste parallèle aurait divergé au premier écran ajouté, et le
// manque serait passé inaperçu : on ne cherche pas ce dont on ignore
// l'existence. C'est déjà la règle de `SidebarSearch`.
export default function MobileNavSheet({
  section,
  onFermer,
}: {
  // `null` = aucun panneau ouvert. La section vient du rendu courant, jamais
  // d'un objet mémorisé — voir `Sidebar`, où un objet figé au clic laissait le
  // surlignage en arrière d'une navigation.
  section: SidebarSection | null;
  onFermer: () => void;
}) {
  // Le groupe ouvert, par son TITRE. ⚠️ Le titre et non l'objet, pour la même
  // raison que partout ailleurs dans la navigation : un objet mémorisé se fige
  // à l'instant du clic et cesse de suivre les rendus suivants.
  const [groupeOuvert, setGroupeOuvert] = useState<string | null>(null);

  // ⚠️ On repart du PREMIER temps à chaque ouverture, et à chaque changement de
  // section. Rouvrir « Compte » sur les vues de Runes parce qu'on y était la
  // fois d'avant ferait apparaître une liste dont le titre ne dit pas d'où elle
  // sort — et « Siège » aurait hérité d'un groupe qui n'est pas le sien.
  useEffect(() => setGroupeOuvert(null), [section?.titre]);

  const groupes = section?.groupes ?? [];
  // Y a-t-il un groupe à CHOISIR ? Il en faut plusieurs, et qu'ils soient
  // nommés : un groupe sans intitulé n'est pas une destination, c'est juste une
  // façon de ranger la liste.
  const aDesGroupes = groupes.length > 1 && groupes.every((g) => g.titre);
  const groupeCourant = aDesGroupes
    ? (groupes.find((g) => g.titre === groupeOuvert) ?? null)
    : null;

  return (
    <MobileSheet
      ouvert={section !== null}
      onFermer={onFermer}
      // Le titre suit le temps où l'on est : « Mon compte », puis « Runes ».
      // C'est la seule chose qui dise ce qu'on est en train de choisir.
      titre={groupeCourant?.titre ?? section?.titre ?? ''}
      // ⚠️ Re-mesure de la hauteur au changement de temps. Figée sur le premier
      // (trois inventaires), les sept vues de Runes se seraient lues en défilant
      // dans une fenêtre trois fois trop courte. Voir MobileSheet.
      mesureCle={groupeCourant?.titre ?? ''}
      // ⚠️ **La barre d'onglets reste visible sous le panneau.** Le panneau
      // d'actions la recouvre à dessein — elle mène ailleurs, or on règle la
      // page où l'on est. Ici c'est l'inverse : ce panneau EST la navigation.
      // La masquer retirerait de l'écran la section où l'on se trouve et le
      // moyen d'en changer, au moment précis où l'on navigue — et le
      // déclencheur qu'on vient de toucher disparaîtrait sous son propre
      // résultat.
      surLesOnglets
    >
      {section && (
        <nav className="flex flex-col gap-0.5" aria-label={`Vues de ${section.titre}`}>
          {/* ── Second temps : les vues du groupe choisi ─────────────────── */}
          {groupeCourant ? (
            <>
              {/* ⚠️ Le RETOUR en tête, comme dans la barre latérale : on est
                  descendu d'un niveau, il faut pouvoir remonter sans refermer
                  le panneau et le rouvrir. Un `<button>` — il ne va nulle
                  part. */}
              <button
                type="button"
                onClick={() => setGroupeOuvert(null)}
                // ⚠️ `w-full` explicite : un `<button>` ne s'étire pas comme un
                // `<a>`, et toute cible de ce panneau prend TOUTE la largeur —
                // c'est une liste qu'on vise du pouce, pas une rangée de
                // pastilles. Même règle que les entrées de la barre latérale.
                className="group mb-1 flex w-full min-h-[44px] items-center gap-1.5 rounded-lg px-2
                           text-sm text-ink-dim transition-colors hoverable:bg-panel2"
              >
                <ChevronLeft
                  size={16}
                  className="flex-none transition-transform group-hoverable:-translate-x-0.5"
                />
                {section.titre}
              </button>
              {groupeCourant.liens.map((l) => (
                <LienNav key={l.key} lien={l} onFermer={onFermer} />
              ))}
            </>
          ) : aDesGroupes ? (
            /* ── Premier temps : les inventaires ────────────────────────── */
            groupes.map((g) => (
              <EntreeGroupe
                key={g.titre}
                groupe={g}
                onOuvrir={() => setGroupeOuvert(g.titre!)}
                onFermer={onFermer}
              />
            ))
          ) : (
            /* ── Un seul temps : la section n'a rien à trancher (Siège) ─── */
            groupes.flatMap((g) =>
              g.liens.map((l) => <LienNav key={l.key} lien={l} onFermer={onFermer} />)
            )
          )}
        </nav>
      )}
    </MobileSheet>
  );
}

// Un inventaire, au premier temps.
//
// ⚠️ **Un groupe à VUE UNIQUE mène directement à elle** (« Monstres » n'a que
// « Ma box ») : il devient un lien, sans chevron. Le faire ouvrir un second
// temps d'un seul choix demanderait deux gestes pour un endroit unique.
function EntreeGroupe({
  groupe,
  onOuvrir,
  onFermer,
}: {
  groupe: SidebarGroupe;
  onOuvrir: () => void;
  onFermer: () => void;
}) {
  // Le groupe où l'on se trouve : celui qui contient la vue courante. Il porte
  // le même marqueur que les destinations — sans lui, le premier temps ne
  // disait pas dans quel inventaire on était déjà.
  const actif = groupe.liens.some((l) => l.actif);
  const seule = groupe.liens.length === 1 ? groupe.liens[0] : null;
  if (seule) {
    // Le libellé reste celui du GROUPE (« Monstres »), pas celui de la vue :
    // c'est la liste des inventaires qu'on lit, et « Ma box » n'y aurait pas
    // le même sens que ses deux voisins.
    return <LienNav lien={{ ...seule, label: groupe.titre! }} onFermer={onFermer} />;
  }
  return (
    <button
      type="button"
      onClick={onOuvrir}
      // Cible PLEINE HAUTEUR (44 px) : une liste qu'on vise du pouce.
      className={`group relative flex min-h-[44px] w-full items-center gap-2.5 rounded-lg px-3
                  text-left text-sm transition-colors ${
                    actif ? 'text-ink' : 'text-ink-dim hoverable:bg-panel2'
                  }`}
    >
      {/* Même marqueur unique que les destinations, sur un calque en `absolute`
          pour ne pas décaler le libellé de 1 px. */}
      <span
        aria-hidden
        className={`absolute inset-0 rounded-lg border border-ctx bg-ctx-soft transition-opacity ${
          actif ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <span className="relative flex-none">{groupe.icone}</span>
      <span className="relative">{groupe.titre}</span>
      {/* Le chevron dit la seule chose utile : « il y a un niveau en dessous ».
          Même rôle que dans la barre latérale. */}
      <ChevronRight
        size={15}
        aria-hidden
        className="relative ml-auto flex-none text-ink-dimmer transition-transform
                   group-hoverable:translate-x-0.5"
      />
    </button>
  );
}

// Une destination — au premier ou au second temps, le même rendu.
function LienNav({ lien, onFermer }: { lien: SidebarLien; onFermer: () => void }) {
  return (
    <a
      href={lien.hash}
      // ⚠️ Le panneau se ferme au CHOIX : c'est lui qui fait changer la page,
      // donc c'est lui qui a fini le geste.
      onClick={onFermer}
      aria-current={lien.actif ? 'page' : undefined}
      // ⚠️ Cible PLEINE HAUTEUR (44 px) : c'est une liste qu'on vise du pouce,
      // pas une rangée de pastilles serrées. La règle tactile s'applique ici
      // sans exception.
      // ⚠️ `w-full` : toute cible de ce panneau prend TOUTE la largeur.
      className={`relative flex w-full min-h-[44px] items-center gap-2.5 rounded-lg px-3 text-sm
                  transition-colors ${
                    lien.actif ? 'text-ink' : 'text-ink-dim hoverable:bg-panel2'
                  }`}
    >
      {/* Marqueur d'état UNIQUE de l'app : contour d'accent + fond très léger
          (spec/shared/design.md). Posé sur un calque en `absolute` comme dans la
          barre latérale — sur l'entrée elle-même, il décalerait le libellé de
          1 px à chaque changement de vue. */}
      <span
        aria-hidden
        className={`absolute inset-0 rounded-lg border border-ctx bg-ctx-soft transition-opacity ${
          lien.actif ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <span className="relative flex-none">{lien.icon}</span>
      <span className="relative">{lien.label}</span>
    </a>
  );
}
