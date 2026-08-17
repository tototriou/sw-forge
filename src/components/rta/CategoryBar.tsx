import { useEffect, useRef, useState } from 'react';
import { Plus, Pencil, Trash2, Check, X, Eye, EyeOff } from 'lucide-react';
import { Monster } from '../../types';
import MonsterAvatar from '../MonsterAvatar';
import { RtaCategory, UseRtaCategories, MAX_CATEGORIES_PER_MONSTER } from '../../hooks/useRtaCategories';
import { ConfirmDialog } from '../Dialogs';
import { useRecalageEcran } from '../../hooks/useRecalageEcran';
import { useMediaQuery, SOUS_LG } from '../../hooks/useMediaQuery';
import MobileSheet from '../MobileSheet';
import { Bouton, BoutonGroupe, BoutonIcone, Champ, Flottant, Vignette } from '../../ui';

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
             donnaient une rangée en dents de scie. C'est `BoutonGroupe` qui la
             tient désormais, avec la même structure que la pilule de lead SPD de
             l'ordre de tour. */
          <div key={c.id} className="relative">
            <BoutonGroupe
              actif={openId === c.id}
              onClick={() => setOpenId((o) => (o === c.id ? null : c.id))}
              aria-expanded={openId === c.id}
              title="Choisir les monstres de cette catégorie"
              icone={
                <span
                  className="h-2.5 w-2.5 flex-none rounded-full"
                  style={{ backgroundColor: c.color }}
                />
              }
              libelle={c.label}
              actions={
                <>
                  <BoutonIcone
                    onClick={() => setEditId((e) => (e === c.id ? null : c.id))}
                    libelle={`Éditer ${c.label}`}
                    taille="serre"
                    icone={<Pencil size={11} />}
                  />
                  <BoutonIcone
                    onClick={() => setASupprimer({ id: c.id, label: c.label })}
                    libelle={`Supprimer ${c.label}`}
                    taille="serre"
                    ton="danger"
                    icone={<Trash2 size={11} />}
                  />
                </>
              }
            />

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
          {/* ⚠️ Le POINTILLÉ dit « contenant pas encore rempli » — c'est ce qui
              distingue « ajouter » des catégories déjà là, sans un mot de plus.
              C'est une prop du composant, pas un bouton d'un autre genre : il
              partage donc la hauteur de ses voisins de rangée. */}
          <BoutonGroupe
            onClick={() => setCreating((v) => !v)}
            aria-expanded={creating}
            pointille
            fond="vide"
            icone={<Plus size={12} />}
            libelle="Catégorie"
            className="font-normal hoverable:bg-panel2"
          />
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
            {/* ⚠️ Ton `danger` : elle décoche d'un coup ce qu'on a coché un
                monstre à la fois. Le ton porte l'avertissement, la confirmation
                porte le reste. */}
            {countOf(open) > 0 && (
              <Bouton
                ton="danger"
                fond="vide"
                taille="xs"
                forme="pilule"
                onClick={() => setViderAConfirmer({ id: open.id, label: open.label, n: countOf(open) })}
                title="Retirer tous les monstres de cette catégorie"
                icone={<X size={11} />}
                libelle="Tout décocher"
                className="ml-auto h-6"
              />
            )}
            <BoutonIcone
              onClick={() => setOpenId(null)}
              libelle="Fermer"
              icone={<X size={14} />}
              className={countOf(open) > 0 ? '' : 'ml-auto'}
            />
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
                  <Vignette
                    key={id}
                    onClick={() => cats.toggleMember(open.id, id)}
                    disabled={bloque}
                    choisi={dedans}
                    teinte={open.color}
                    // ⚠️ Fond plus soutenu sous `lg`, où la coche ne s'affiche
                    // pas : il y porte seul l'état de sélection.
                    fondAppuye={surMobile}
                    title={
                      bloque
                        ? `${m.name} — déjà ${MAX_CATEGORIES_PER_MONSTER} catégories (maximum)`
                        : dedans
                          ? `Retirer ${m.name} de « ${open.label} »`
                          : `Ajouter ${m.name} à « ${open.label} »`
                    }
                    // ⚠️ Pas de pastille d'élément ici, mais le NOM sous le
                    // portrait : l'élément ne se distingue que par sa couleur,
                    // illisible pour un daltonien. Le nom, lui, identifie le
                    // monstre quelle que soit la vision des couleurs.
                    contenu={<MonsterAvatar monster={m} size={36} element={false} />}
                    libelle={m.name}
                    // ⚠️ Coche masquée SOUS `lg` seulement : 12 px posés dans le
                    // coin d'un portrait de 36, elle en masquait un bout au
                    // doigt, là où le fond teinté et le liseré disent déjà la
                    // sélection. Sur bureau elle reste — rien ne l'y gênait.
                    coin={
                      dedans && !surMobile ? (
                        <span
                          className="absolute right-0.5 top-0.5 flex h-3 w-3 items-center justify-center rounded-full"
                          style={{ backgroundColor: open.color }}
                        >
                          <Check size={8} className="text-bg" />
                        </span>
                      ) : undefined
                    }
                  />
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
// ⚠️ **Ce n'est plus qu'un RÉGLAGE de [BoutonGroupe](../../ui/BoutonGroupe.tsx),
// pas un composant.** Il en dessinait un second, avec ses propres classes — d'où
// des rangées en dents de scie dès qu'il voisinait une pilule de catégorie. Il
// ne reste ici que ce qui est propre au SENS de ces trois interrupteurs ; tout
// le dessin vient de la librairie.
//
// Deux écarts subsistent entre les formats, et ils sont réels :
//
// - **Le sens de l'accent s'inverse.** Sur bureau il marque l'état MASQUÉ (la
//   chose coupée ressort, celle qu'on voit s'efface) ; au doigt il marque l'état
//   affiché. Sur un écran large on embrasse la rangée d'un regard et l'inversion
//   se rattrape ; sur trois pastilles serrées, elle se lit à l'envers.
// - **Une PUCE plutôt qu'un œil barré au doigt.** Ce pictogramme demande de se
//   rappeler s'il montre l'état courant ou l'action à venir. À 12 px sur un
//   téléphone, l'ambiguïté ne se lève plus ; un point plein ou creux se lit sans
//   être interprété.
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
  // ⚠️ **UN SEUL composant pour les deux formats**, avec deux réglages qui
  // diffèrent — et non deux écritures. Les deux se ramènent à un `BoutonGroupe`,
  // donc la hauteur, la pression au clic et `aria-pressed` viennent du même
  // endroit ; seuls la DÉCORATION et le SENS de l'accent changent.
  //
  // ⚠️ `actif={!actif}` sur bureau, et c'est tout l'écart : l'accent y marque
  // l'état MASQUÉ (la chose coupée ressort, celle qu'on voit s'efface). Sur un
  // écran large on embrasse la rangée d'un regard et l'inversion se rattrape ;
  // sur trois pastilles serrées au doigt, elle se lit à l'envers — d'où le sens
  // droit en mobile. C'est une inversion de la VALEUR passée, pas un drapeau
  // ajouté au composant partagé : lui n'a rien à savoir de cette convention.
  return (
    <BoutonGroupe
      actif={surMobile ? actif : !actif}
      onClick={onToggle}
      title={actif ? titreActif : titreInactif}
      libelle={libelle}
      // Une PUCE au doigt plutôt qu'un œil barré : ce pictogramme demande de se
      // rappeler s'il montre l'état courant ou l'action à venir. À 12 px sur un
      // téléphone, l'ambiguïté ne se lève plus ; un point plein ou creux se lit
      // sans être interprété.
      puce={surMobile}
      icone={surMobile ? undefined : actif ? <Eye size={12} /> : <EyeOff size={12} />}
      // Premier des trois : sur bureau il porte le `ml-auto` qui pousse le
      // groupe à droite de la rangée des catégories.
      className={!surMobile && premier ? 'ml-auto' : ''}
    />
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
  // Sur la surface FLOTTANTE, pas sur le formulaire : voir plus bas.
  const ref = useRef<HTMLDivElement>(null);
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
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(label, color);
      }}
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
        {/* ⚠️ Le grossissement au doigt (16 px, contre le zoom iOS à la mise au
            point) vit dans [Champ](../../ui/Champ.tsx), pas ici : c'est un piège
            de plateforme, pas une décision de ce formulaire. */}
        <Champ
          autoFocus
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Striper, Lead SPD…"
          maxLength={24}
          // ⚠️ `pleineLargeur={false}` avec `flex-1` : les deux ensemble
          // (`w-full` et `flex-1`) se contredisent dans un conteneur flex, et le
          // champ refusait de rétrécir sous son contenu.
          pleineLargeur={false}
          className="flex-1 py-1 text-xs compact:py-2.5"
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
        <Bouton
          type="submit"
          ton="accent"
          fond="doux"
          disabled={!label.trim()}
          taille="sm"
          libelle="Valider"
          className="flex-1 compact:w-full compact:py-3 compact:text-sm"
        />
        {/* ⚠️ Sans fond ni trait : l'action à côté de « Valider » ne doit pas lui
            disputer le regard — elle est là pour être trouvée, pas pour être
            proposée. */}
        <Bouton
          fond="vide"
          trait="aucun"
          taille="sm"
          onClick={onClose}
          libelle="Annuler"
          className="compact:w-full compact:py-2.5"
        />
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

  // ⚠️ La popup est ancrée à gauche d'un bouton dont la position dépend du
  // nombre de catégories et de la largeur de leurs noms : elle sortait de
  // l'écran dès que ce bouton se trouvait sur la droite, d'où le recalage. Le
  // panneau montant, lui, n'a pas de position à corriger.
  // ⚠️ `ref` sur le FLOTTANT et non sur le formulaire : c'est la surface
  // visible qu'on mesure pour le recalage, et c'est elle dont on teste si le
  // clic est tombé dedans. Posée sur le formulaire, la bordure et le
  // rembourrage échappaient aux deux — un clic sur le bord de la popup la
  // refermait.
  return (
    <Flottant ref={ref} largeur="w-[220px]" rembourrage="sm" style={recalage}>
      {formulaire}
    </Flottant>
  );
}
