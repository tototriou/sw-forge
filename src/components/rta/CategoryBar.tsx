import { useEffect, useRef, useState } from 'react';
import { Plus, Pencil, Trash2, Check, X, Eye, EyeOff } from 'lucide-react';
import { Monster } from '../../types';
import MonsterAvatar from '../MonsterAvatar';
import { RtaCategory, UseRtaCategories, MAX_CATEGORIES_PER_MONSTER } from '../../hooks/useRtaCategories';
import { ConfirmDialog } from '../Dialogs';
import { useRecalageEcran } from '../../hooks/useRecalageEcran';
import { useMediaQuery, SOUS_LG } from '../../hooks/useMediaQuery';
import MobileSheet from '../MobileSheet';

// Palette FERMÉE plutôt qu'un sélecteur de couleur libre : le contrôle natif
// (`<input type="color">`) est un composant du système, hors charte, et un choix
// libre laisse composer des teintes trop proches — indistinguables sur l'anneau.
// Ces douze-là sont franches et se séparent bien sur fond sombre.
const PALETTE = [
  '#e8593d', '#f2884c', '#f2c24c', '#a8d84a',
  '#5edb8f', '#4ad8d8', '#3fa9f5', '#5b78e0',
  '#a15fe0', '#c79bff', '#ff8fc7', '#8890b8',
];

function nextColor(used: string[]): string {
  return PALETTE.find((c) => !used.includes(c.toLowerCase())) ?? PALETTE[0];
}

// « #rrggbb » + opacité → rgba(), pour teinter un fond sans écraser le texte.
function withAlpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

interface Props {
  cats: UseRtaCategories;
  monsters: Monster[]; // monstres présents sur la page (prépa RTA)
}

// Catégories libres de la prépa RTA : créer, éditer, et affecter des monstres.
// Cliquer une catégorie ouvre en dessous la liste des monstres de la page ; on
// les sélectionne au clic. Voir ../../spec/rta/categories.md.
export default function CategoryBar({ cats, monsters }: Props) {
  const [openId, setOpenId] = useState<string | null>(null); // catégorie dépliée
  const [editId, setEditId] = useState<string | null>(null); // catégorie en édition
  const [creating, setCreating] = useState(false);
  const [aSupprimer, setASupprimer] = useState<{ id: string; label: string } | null>(null);
  // ⚠️ « Tout décocher » demande une CONFIRMATION : il retire d'un coup ce qu'on
  // a coché un monstre à la fois, et il n'y a pas d'annulation.
  const [viderAConfirmer, setViderAConfirmer] = useState<
    { id: string; label: string; n: number } | null
  >(null);
  // ⚠️ La refonte de cette barre ne vise QUE le téléphone : le rendu de bureau
  // reste celui d'avant, à l'identique. Ce qui change tient à la place et au
  // doigt — un écran large n'a ni l'une ni l'autre contrainte, et déplacer ses
  // repères aurait changé ce qui n'était pas en cause.
  const surMobile = useMediaQuery(SOUS_LG);

  const open = cats.categories.find((c) => c.id === openId) ?? null;
  // Effectif AFFICHÉ = membres réellement présents dans la prépa. Un monstre
  // retiré de la page garde son appartenance (il peut revenir), mais le compter
  // donnerait une pastille qui ne correspond à rien à l'écran.
  const presents = new Set(monsters.map((m) => String(m.id)));
  const countOf = (c: RtaCategory) => c.members.filter((id) => presents.has(id)).length;

  return (
    <div className="mt-4">
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="label mr-1">
          Catégories
        </span>

        {cats.categories.map((c) => (
          /* Pilule : point de couleur, nom, puis édition et suppression.
             ⚠️ **Tous les éléments de la barre font la même hauteur (`h-7`)** —
             pilules, bouton d'ajout, interrupteur. Des hauteurs différentes
             donnaient une rangée en dents de scie.
             Le cadre porte le style et les boutons sont transparents à
             l'intérieur : aucune couture entre eux, et pas de bouton imbriqué
             dans un bouton (HTML invalide). */
          <div key={c.id} className="relative">
            <div
              className={`inline-flex h-7 items-center gap-1.5 rounded-full border pl-2.5 pr-1 transition ${
                openId === c.id
                  ? 'border-accent bg-panel2'
                  : 'border-border bg-panel hoverable:border-accent'
              }`}
            >
              <button
                onClick={() => setOpenId((o) => (o === c.id ? null : c.id))}
                aria-expanded={openId === c.id}
                title="Choisir les monstres de cette catégorie"
                className="flex h-full items-center gap-1.5 text-xs font-semibold text-ink"
              >
                <span
                  className="w-2.5 h-2.5 rounded-full flex-none"
                  style={{ backgroundColor: c.color }}
                />
                {c.label}
              </button>
              <button
                onClick={() => setEditId((e) => (e === c.id ? null : c.id))}
                title="Renommer / changer la couleur"
                aria-label={`Éditer ${c.label}`}
                // ⚠️ `data-cible-fine`, et SANS zone étendue : ces deux boutons
                // sont posés DANS une pilule de 28 px et collés l'un à l'autre.
                // Portés à 40 px par la règle tactile, ils la débordaient ;
                // dotés d'une cible de 44 px, ils se chevaucheraient et on
                // supprimerait la catégorie en voulant l'éditer.
                data-cible-fine
                className="flex items-center justify-center w-5 h-5 rounded-full text-ink-dim transition hoverable:text-ink hoverable:bg-black/25"
              >
                <Pencil size={11} />
              </button>
              <button
                onClick={() => setASupprimer({ id: c.id, label: c.label })}
                title="Supprimer la catégorie"
                aria-label={`Supprimer ${c.label}`}
                data-cible-fine
                className="flex items-center justify-center w-5 h-5 rounded-full text-ink-dim transition hoverable:text-fire hoverable:bg-black/25"
              >
                <Trash2 size={11} />
              </button>
            </div>

            {editId === c.id && (
              <CategoryPopover
                initial={c}
                onClose={() => setEditId(null)}
                onSubmit={(label, color) => {
                  cats.rename(c.id, label, color);
                  setEditId(null);
                }}
              />
            )}
          </div>
        ))}

        <div className="relative">
          <button
            onClick={() => setCreating((v) => !v)}
            aria-expanded={creating}
            className="flex h-7 items-center gap-1 rounded-full border border-dashed border-border
                       bg-transparent px-2.5 text-xs text-ink-dim transition
                       hoverable:text-ink hoverable:border-accent hoverable:bg-panel2"
          >
            <Plus size={12} /> Catégorie
          </button>
          {creating && (
            <CategoryPopover
              initial={{ label: '', color: nextColor(cats.categories.map((x) => x.color.toLowerCase())) }}
              onClose={() => setCreating(false)}
              onSubmit={(label, color) => {
                cats.add(label, color);
                setCreating(false);
              }}
            />
          )}
        </div>

        {/* Sur BUREAU seulement : poussés à droite de cette rangée, comme
            avant la refonte mobile. */}
        {!surMobile && (
          <>
          <InterrupteurAffichage
            actif={cats.showSpeeds}
            onToggle={() => cats.setShowSpeeds(!cats.showSpeeds)}
            libelle="Vitesses"
            titreActif="Masquer les vitesses sur les cartes"
            titreInactif="Réafficher les vitesses sur les cartes"
            surMobile={surMobile}
            premier
          />
          <InterrupteurAffichage
            actif={cats.markDesync}
            onToggle={() => cats.setMarkDesync(!cats.markDesync)}
            libelle="Modifiés"
            titreActif="Ne plus signaler les monstres dont les runes ne suivent plus la vitesse demandée"
            titreInactif="Signaler en orange les monstres dont les runes ne suivent plus"
            surMobile={surMobile}
          />
          {/* ⚠️ Toujours affiché, même sans aucune catégorie : les trois
              interrupteurs forment un groupe fixe. Un bouton qui apparaît et
              disparaît fait sauter la rangée et donne l'impression d'un
              réglage qu'on aurait perdu. */}
          <InterrupteurAffichage
            actif={cats.visible}
            onToggle={() => cats.setVisible(!cats.visible)}
            libelle="Catégories"
            titreActif="Masquer les couleurs sur les cartes et l’ordre de tour"
            titreInactif="Réafficher les couleurs"
            surMobile={surMobile}
          />
          </>
        )}
      </div>

      {/* ⚠️ **Rangée propre SOUS `lg` seulement.** Sur téléphone, la rangée des
          catégories comptait déjà quatre éléments avant eux : les interrupteurs
          y passaient à la ligne dès qu'une catégorie de plus existait, et se
          retrouvaient un coup à droite, un coup en dessous.
          Au-dessus de `lg` ils restent poussés à DROITE de cette rangée, comme
          avant — la largeur y suffit. */}
      {surMobile && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <InterrupteurAffichage
            actif={cats.showSpeeds}
            onToggle={() => cats.setShowSpeeds(!cats.showSpeeds)}
            libelle="Vitesses"
            titreActif="Masquer les vitesses sur les cartes"
            titreInactif="Réafficher les vitesses sur les cartes"
            surMobile={surMobile}
            premier
          />
          <InterrupteurAffichage
            actif={cats.markDesync}
            onToggle={() => cats.setMarkDesync(!cats.markDesync)}
            libelle="Modifiés"
            titreActif="Ne plus signaler les monstres dont les runes ne suivent plus la vitesse demandée"
            titreInactif="Signaler en orange les monstres dont les runes ne suivent plus"
            surMobile={surMobile}
          />
          {/* ⚠️ Toujours affiché, même sans aucune catégorie : les trois
              interrupteurs forment un groupe fixe. Un bouton qui apparaît et
              disparaît fait sauter la rangée et donne l'impression d'un
              réglage qu'on aurait perdu. */}
          <InterrupteurAffichage
            actif={cats.visible}
            onToggle={() => cats.setVisible(!cats.visible)}
            libelle="Catégories"
            titreActif="Masquer les couleurs sur les cartes et l’ordre de tour"
            titreInactif="Réafficher les couleurs"
            surMobile={surMobile}
          />
        </div>
      )}

      {/* Panneau d'affectation : tous les monstres de la page. */}
      {open && (
        <div
          // Le panneau se pose au lieu de surgir : il s'ouvre SOUS la rangée de
          // catégories et pousse le contenu, un apparaître sec fait sauter la
          // page. Pas de `scale` — il arrive à sa taille définitive.
          className="mt-2 rounded-xl border p-3 animate-[apparition_180ms_var(--ease-out)]"
          style={{
            borderColor: withAlpha(open.color, 0.5),
            // Le panneau reprend la teinte de la catégorie ouverte : on sait
            // toujours dans laquelle on est en train de cocher.
            backgroundColor: withAlpha(open.color, 0.07),
          }}
        >
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="w-2.5 h-2.5 rounded-full flex-none" style={{ backgroundColor: open.color }} />
            <span className="text-sm font-semibold text-ink">{open.label}</span>
            <span className="font-mono text-micro text-ink-dim">
              {countOf(open)} monstre{countOf(open) > 1 ? 's' : ''}
            </span>
            {countOf(open) > 0 && (
              <button
                onClick={() => setViderAConfirmer({ id: open.id, label: open.label, n: countOf(open) })}
                className="ml-auto flex h-6 items-center gap-1 rounded-full border border-border bg-panel
                           px-2 text-micro text-ink-dim transition hoverable:border-fire/60 hoverable:text-fire"
                title="Retirer tous les monstres de cette catégorie"
              >
                <X size={11} /> Tout décocher
              </button>
            )}
            <button
              onClick={() => setOpenId(null)}
              className={`${countOf(open) > 0 ? '' : 'ml-auto '}text-ink-dim hoverable:text-ink transition`}
              title="Fermer"
              aria-label="Fermer"
            >
              <X size={14} />
            </button>
          </div>

          {monsters.length === 0 ? (
            <p className="text-xs text-ink-dim">
              Aucun monstre dans ta prépa : ajoute-en d'abord ci-dessus.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {monsters.map((m) => {
                const id = String(m.id);
                const dedans = open.members.includes(id);
                // Plafond atteint ailleurs : on montre le monstre mais on
                // explique pourquoi il est refusé, plutôt que de le cacher.
                const bloque = !dedans && !cats.canAssign(id);
                return (
                  <button
                    key={id}
                    onClick={() => cats.toggleMember(open.id, id)}
                    disabled={bloque}
                    aria-pressed={dedans}
                    title={
                      bloque
                        ? `${m.name} — déjà ${MAX_CATEGORIES_PER_MONSTER} catégories (maximum)`
                        : dedans
                          ? `Retirer ${m.name} de « ${open.label} »`
                          : `Ajouter ${m.name} à « ${open.label} »`
                    }
                    className={`relative flex w-[72px] flex-col items-center gap-1 rounded-lg px-1 py-1.5 transition ${
                      bloque
                        ? 'opacity-25 cursor-not-allowed'
                        : dedans
                          ? ''
                          : 'opacity-70 hoverable:opacity-100 hoverable:bg-panel2'
                    }`}
                    // ⚠️ Fond plus soutenu sous `lg`, où la coche ne s'affiche
                    // pas : il y porte seul l'état de sélection.
                    style={
                      dedans
                        ? {
                            boxShadow: `0 0 0 1.5px ${open.color}`,
                            backgroundColor: withAlpha(open.color, surMobile ? 0.28 : 0.2),
                          }
                        : undefined
                    }
                  >
                    {/* ⚠️ Pas de pastille d'élément ici, mais le NOM sous le
                        portrait : l'élément ne se distingue que par sa couleur,
                        illisible pour un daltonien. Le nom, lui, identifie le
                        monstre quelle que soit la vision des couleurs. */}
                    <MonsterAvatar monster={m} size={36} element={false} />
                    <span className="w-full truncate text-center text-micro leading-tight text-ink-dim">
                      {m.name}
                    </span>
                    {/* ⚠️ Coche masquée SOUS `lg` seulement : 12 px posés dans
                        le coin d'un portrait de 36, elle en masquait un bout au
                        doigt, là où le fond teinté et le liseré disent déjà la
                        sélection. Sur bureau elle reste — rien ne l'y gênait. */}
                    {dedans && !surMobile && (
                      <span
                        className="absolute top-0.5 right-0.5 flex items-center justify-center w-3 h-3 rounded-full"
                        style={{ backgroundColor: open.color }}
                      >
                        <Check size={8} className="text-bg" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {viderAConfirmer && (
        <ConfirmDialog
          titre={`Retirer les ${viderAConfirmer.n} monstres de « ${viderAConfirmer.label} » ?`}
          message="La catégorie reste, mais elle se vide. Les monstres ne sont pas retirés de ta prépa — c'est leur appartenance à cette catégorie qui part, et elle se recoche un monstre à la fois."
          libelleAction="Tout retirer"
          destructif
          onCancel={() => setViderAConfirmer(null)}
          onConfirm={() => {
            cats.clearMembers(viderAConfirmer.id);
            setViderAConfirmer(null);
          }}
        />
      )}

      {aSupprimer && (
        <ConfirmDialog
          titre={`Supprimer la catégorie « ${aSupprimer.label} » ?`}
          message="Elle disparaît de la barre et des anneaux de couleur. Les monstres qui la portaient ne sont pas retirés de ta prépa."
          libelleAction="Supprimer"
          destructif
          onCancel={() => setASupprimer(null)}
          onConfirm={() => {
            cats.remove(aSupprimer.id);
            if (openId === aSupprimer.id) setOpenId(null);
            setASupprimer(null);
          }}
        />
      )}
    </div>
  );
}

// Interrupteur d'affichage : « ce que la page montre », pas « ce que le bouton
// fait ». Les trois de la barre RTA en sont des instances — ils étaient trois
// copies du même bouton, à trois endroits, avec les mêmes vingt lignes.
//
// ⚠️ **Deux rendus, et celui de BUREAU est l'ancien, inchangé** : œil ouvert /
// barré, accent sur l'état masqué, poussé à droite de la rangée des catégories.
// Ce n'est pas qu'il soit meilleur — c'est qu'il n'était pas en cause. La
// refonte visait le téléphone ; changer le bureau au passage aurait déplacé les
// repères de quelqu'un qui ne demandait rien.
//
// Sous `lg`, deux écarts que la petite taille rend nécessaires :
//
// - **L'accent marque l'état ACTIF.** Il est posé sur l'état masqué dans la
//   version de bureau : la chose coupée ressort, celle qu'on voit s'efface. Sur
//   un écran large on embrasse la rangée d'un regard et l'inversion se
//   rattrape ; sur trois pastilles serrées, elle se lit à l'envers.
// - **Une PUCE plutôt qu'un œil barré.** Ce pictogramme demande de se rappeler
//   s'il montre l'état courant ou l'action à venir. À 12 px sur un téléphone,
//   l'ambiguïté ne se lève plus ; un point plein ou creux se lit sans être
//   interprété.
export function InterrupteurAffichage({
  actif,
  onToggle,
  libelle,
  titreActif,
  titreInactif,
  surMobile,
  premier = false,
}: {
  actif: boolean;
  onToggle: () => void;
  libelle: string;
  titreActif: string;
  titreInactif: string;
  surMobile: boolean;
  // Premier des trois : sur bureau il porte le `ml-auto` qui pousse le groupe à
  // droite de la rangée des catégories.
  premier?: boolean;
}) {
  return (
    <button
      onClick={onToggle}
      aria-pressed={actif}
      title={actif ? titreActif : titreInactif}
      // ⚠️ `data-hauteur-fixe` : la hauteur est dessinée ici, le panneau mobile
      // ne doit pas la remplacer par son minimum (voir index.css).
      data-hauteur-fixe
      className={`flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs transition
        ${!surMobile && premier ? 'ml-auto' : ''}
        ${
          surMobile
            ? actif
              ? 'select-none border-accent bg-accent-soft font-semibold text-ink'
              : 'select-none border-border bg-panel text-ink-dimmer hoverable:border-accent hoverable:text-ink-dim'
            : actif
              ? 'border-border bg-panel text-ink-dim hoverable:text-ink hoverable:border-accent'
              : // Fond seul — voir spec/shared/design.md.
                'border-border bg-accent-soft text-ink'
        }`}
    >
      {surMobile ? (
        // Puce pleine quand la chose est affichée, creuse quand elle est coupée.
        // `border-current` : elle emprunte la couleur du texte, donc elle suit
        // l'état sans qu'on ait à le déclarer deux fois.
        <span
          aria-hidden
          className={`h-2 w-2 flex-none rounded-full border border-current transition ${
            actif ? 'bg-current' : 'bg-transparent'
          }`}
        />
      ) : actif ? (
        <Eye size={12} />
      ) : (
        <EyeOff size={12} />
      )}
      {libelle}
    </button>
  );
}

// Saisie d'une catégorie : titre + couleur.
//
// ⚠️ **Deux contenants selon la largeur, un seul formulaire.**
//
// - Au-dessus de `lg` : une **popup ancrée** à la pilule qu'on édite. On voit
//   la rangée derrière, on sait sur quoi on agit, et la souris est déjà là.
// - En dessous : un **panneau montant** (`MobileSheet`), comme partout ailleurs
//   dans l'app sur téléphone. Une popup ancrée y était le mauvais objet : elle
//   s'ouvre là où le doigt a tapé — souvent en haut de l'écran, hors de portée
//   du pouce pour la valider — et flotte hors de tout cadre, d'où les
//   débordements qu'il a fallu rattraper à la mesure. Le panneau, lui, arrive
//   sous le pouce et occupe une largeur connue.
//
// ⚠️ Le formulaire est le **même JSX** dans les deux cas. Deux copies auraient
// divergé au premier champ ajouté — et c'est le genre de divergence qu'on ne
// voit pas, puisqu'on ne teste jamais les deux largeurs à la fois.
function CategoryPopover({
  initial,
  onSubmit,
  onClose,
}: {
  initial: { label: string; color: string };
  onSubmit: (label: string, color: string) => void;
  onClose: () => void;
}) {
  const [label, setLabel] = useState(initial.label);
  const [color, setColor] = useState(initial.color);
  const ref = useRef<HTMLFormElement>(null);
  const surMobile = useMediaQuery(SOUS_LG);
  // Popup ancrée seulement : le panneau montant occupe une largeur connue et
  // n'a rien à recaler.
  const { style: recalage } = useRecalageEcran(ref, !surMobile);

  // Fermeture au clic extérieur et à Échap, comme les autres menus de l'app.
  // ⚠️ Le clic extérieur ne vaut QUE pour la popup : le panneau montant a son
  // propre voile, qui ferme déjà au clic — écouter en plus fermerait deux fois,
  // et le clic sur le voile aurait traversé jusqu'au formulaire.
  useEffect(() => {
    if (surMobile) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onEsc);
    };
  }, [onClose, surMobile]);

  const formulaire = (
    <form
      ref={ref}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(label, color);
      }}
      // ⚠️ La popup est ancrée à gauche d'un bouton dont la position dépend du
      // nombre de catégories et de la largeur de leurs noms : elle sortait de
      // l'écran dès que ce bouton se trouvait sur la droite, d'où le recalage.
      // Le panneau montant, lui, n'a pas de position à corriger.
      className={
        surMobile
          ? ''
          : `absolute z-30 left-0 top-full mt-1.5 w-[220px]
             rounded-xl border border-border bg-panel p-2.5 shadow-glow shadow-black/60`
      }
      style={surMobile ? undefined : recalage}
    >
      <div className="flex items-center gap-1.5">
        {/* ⚠️ Masquée au doigt : la palette juste en dessous montre déjà la
            couleur choisie, d'un cadre autour de sa case. Deux rappels de la
            même chose à 40 px l'un de l'autre, dont un qui rogne la largeur du
            champ qu'on vient remplir. */}
        <span
          className="w-4 h-4 rounded-full flex-none border border-black/30 compact:hidden"
          style={{ backgroundColor: color }}
          aria-hidden
        />
        <input
          autoFocus
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Striper, Lead SPD…"
          maxLength={24}
          // ⚠️ Plus haut et plus grand au doigt : c'est le champ qu'on vient
          // remplir, et sous 16 px iOS zoome dessus à la mise au point — un zoom
          // dont la page ne revient pas seule.
          className="min-w-0 flex-1 rounded-md border border-border bg-panel2 px-2 py-1 text-xs
                     text-ink outline-none placeholder:text-ink-dim focus:border-accent
                     compact:px-3 compact:py-2.5 compact:text-base"
        />
      </div>

      {/* ⚠️ Palette à SIX colonnes partout, mais des cases plus hautes au doigt
          (voir plus bas) : douze couleurs en deux rangées se comparent d'un coup
          d'œil, là où trois rangées de quatre obligeraient à balayer. */}
      <div className="mt-2 grid grid-cols-6 gap-1 compact:mt-3 compact:gap-1.5">
        {PALETTE.map((c) => {
          const actif = c.toLowerCase() === color.toLowerCase();
          return (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              aria-label={`Couleur ${c}`}
              aria-pressed={actif}
              // ⚠️ 44 px de haut au doigt contre 24 à la souris : douze cases
              // côte à côte, une erreur de visée choisit la voisine et il faut
              // recommencer. C'est la cible tactile pleine, la hauteur étant
              // écrite en dur ici et non héritée de la règle globale.
              className={`flex items-center justify-center rounded-md transition
                h-6 compact:h-11 ${
                actif
                  ? 'ring-2 ring-ink ring-offset-2 ring-offset-panel'
                  : 'opacity-80 hoverable:opacity-100 hoverable:-translate-y-px'
              }`}
              style={{ backgroundColor: c }}
            >
              {actif && <Check size={12} className="text-bg drop-shadow" />}
            </button>
          );
        })}
      </div>

      {/* ⚠️ Dans le panneau, « Valider » occupe TOUTE la largeur et « Annuler »
          passe dessous, en retrait. C'est l'action qu'on vient faire : elle se
          place là où le pouce tombe, et rien à côté d'elle ne peut être touché
          par erreur. En popup les deux restent sur une ligne — la souris vise au
          pixel, et la hauteur y coûte plus qu'elle ne rapporte. */}
      <div className="mt-2.5 flex items-center gap-1.5
                      compact:mt-4 compact:flex-col-reverse compact:gap-2">
        <button
          type="submit"
          disabled={!label.trim()}
          className="flex-1 rounded-md bg-accent-soft px-2 py-1 text-xs font-semibold
                     text-ink transition disabled:opacity-40
                     compact:w-full compact:rounded-lg compact:py-3 compact:text-sm"
        >
          Valider
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-border px-2 py-1 text-xs text-ink-dim
                     transition hoverable:text-ink hoverable:border-accent
                     compact:w-full compact:border-transparent compact:py-2.5"
        >
          Annuler
        </button>
      </div>
    </form>
  );

  // ⚠️ Sur téléphone, le formulaire arrive dans le panneau montant de l'app —
  // le même objet que les filtres et les actions, ouvert au même endroit. Une
  // popup ancrée y était le mauvais geste : elle s'ouvre là où le doigt a tapé,
  // souvent hors de portée du pouce pour la valider.
  if (surMobile) {
    return (
      <MobileSheet
        ouvert
        centre
        onFermer={onClose}
        titre={initial.label ? 'Modifier la catégorie' : 'Nouvelle catégorie'}
      >
        {formulaire}
      </MobileSheet>
    );
  }

  return formulaire;
}
