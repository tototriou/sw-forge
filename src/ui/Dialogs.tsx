import { ReactNode, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, HardDriveDownload, ShieldCheck, X } from 'lucide-react';
import { useScrollBloque } from '../hooks/useScrollBloque';
import { Bouton, BoutonIcone, Case, Champ, PiedDeDialogue } from '../ui';

/* --------------------------------------------------------------------------
 * Fenêtres modales de l'application
 * -----------------------------------------------------------------------
 *
 * ⚠️ **Aucun `confirm()` ni `prompt()` du navigateur.** La boîte native
 * s'affiche hors de la page, sans sa typographie ni ses couleurs, colle le nom
 * du site en titre, et rien n'y est habillable — au moment précis où il faut
 * distinguer clairement une action destructrice d'une action anodine. Sa
 * variante `prompt` est pire encore, surtout au tactile.
 *
 * ⚠️ **Le défaut ne perd jamais rien** : « Annuler » est le bouton mis en
 * avant et reçoit le focus, Échap et le clic à côté annulent, et l'action
 * destructrice porte la couleur d'alerte. Voir la règle générale dans
 * ../../spec/README.md.
 */

// Coquille commune : fond, centrage, fermeture au clic extérieur et à Échap.
//
// ⚠️ **Exportée** : elle porte le piège à focus, la boucle de Tab et le blocage
// du défilement (voir plus bas). Toute boîte modale de l'app passe par elle —
// une coquille recopiée ailleurs perdrait ces trois-là en silence.
export function Modale({
  onClose,
  labelledBy,
  titre,
  sousTitre,
  icone,
  actions,
  actionsEmpilees = false,
  noteFinale,
  corpsCentre = false,
  largeur = 'max-w-[400px]',
  padding = 'p-5',
  croix = false,
  ctx,
  children,
}: {
  onClose: () => void;
  labelledBy: string;
  // ⚠️ **Le titre est rendu PAR la coquille**, pas écrit dans le contenu. Chaque
  // dialogue posait son propre `<h2>`, avec sa taille et sa marge : quatre
  // écrans, quatre en-têtes légèrement différents. Il porte aussi l'`id` de
  // `labelledBy` — un lecteur d'écran annonce donc le bon titre sans que
  // l'appelant ait à faire correspondre les deux à la main.
  titre?: ReactNode;
  // Phrase sous le titre : ce que l'action implique, en une ligne ou deux.
  sousTitre?: ReactNode;
  // Pictogramme à gauche du titre — un triangle d'alerte, un disque dur.
  icone?: ReactNode;
  // Boutons d'action, posés dans le pied. ⚠️ **Toujours en bas**, jamais dans le
  // corps : sur une fiche longue, des boutons écrits dans le contenu se
  // retrouvaient au bout du défilement, là où personne ne les cherche.
  // L'ordre d'écriture est celui de PiedDeDialogue — secondaire d'abord.
  actions?: ReactNode;
  // Les boutons du pied s'EMPILENT au doigt, pleine largeur. ⚠️ Pour des
  // libellés qui sont des PHRASES et non des verbes — voir PiedDeDialogue.
  actionsEmpilees?: boolean;
  // Phrase posée SOUS les boutons, centrée et discrète.
  //
  // ⚠️ Elle ne se lit qu'APRÈS avoir vu les choix, et c'est sa place qui lui
  // donne son rôle : elle désamorce l'engagement (« tu pourras changer d'avis »).
  // Remontée au-dessus des boutons, elle devient une consigne de plus à lire
  // avant de décider — j'avais fait ce déplacement, il valait moins bien.
  noteFinale?: ReactNode;
  // Le corps GARDE sa taille et se centre, au lieu de s'étirer.
  //
  // ⚠️ Pour un contenu qui ne PEUT pas s'étirer sans devenir laid : une image,
  // une grille à pas fixe, un portrait. Le défaut est l'inverse — le corps
  // occupe toute la largeur de la boîte —, parce qu'un formulaire qui flotte à
  // gauche avec du vide à droite est presque toujours un oubli.
  corpsCentre?: boolean;
  // Élément qui donne son ACCENT CONTEXTUEL au contenu (voir `--ctx` dans
  // index.css). Posé sur la boîte, il teinte tout ce qu'elle contient : la
  // fiche d'un monstre d'eau vire au bleu sans qu'aucun de ses composants
  // n'ait à connaître son élément.
  ctx?: string | null;
  // Croix de fermeture en coin. ⚠️ Réservée aux modales qu'on **consulte**
  // (fiche d'un monstre, d'une rune) : Échap et le clic à côté ne se voient
  // pas, et rien d'autre n'y indique par où sortir.
  // ⚠️ **Pas sur les confirmations** : leur « Annuler » EST la sortie, et une
  // croix à côté ferait deux portes pour un choix qui n'en a qu'une — on
  // hésiterait sur ce que ferme la croix.
  croix?: boolean;
  // Classe de largeur — une boîte de message tient en 400 px, une liste à
  // parcourir se règle au cas par cas.
  largeur?: string;
  // Une boîte de message respire ; une liste dense se serre, sinon la marge
  // pèse plus que le contenu.
  padding?: string;
  // Facultatif : une confirmation n'a qu'un titre et une phrase, tous deux
  // rendus par l'en-tête. Sans corps, la bande n'est pas rendue du tout — un
  // conteneur vide laisserait un blanc entre le message et les boutons.
  children?: ReactNode;
}) {
  const boite = useRef<HTMLDivElement>(null);
  // ⚠️ **La modale est montée dans `<body>`, pas là où elle est écrite.**
  //
  // Sans cela, elle reste un DESCENDANT DOM de ce qui l'a ouverte — et sur
  // téléphone, ce qui l'ouvre est souvent le panneau « Options », dont le contenu
  // porte `data-tiroir`. La règle `[data-tiroir] .flex-col { align-items:
  // flex-start }` d'index.css, écrite pour aligner les boutons empilés du
  // panneau, tombait donc sur la boîte de la modale : son en-tête, son corps et
  // son pied se rétrécissaient sur leur contenu. La croix se collait au titre,
  // les champs n'atteignaient plus le bord, les boutons restaient à gauche.
  //
  // Trois symptômes, une cause — et rien dans le code de la modale ne pouvait
  // l'expliquer, puisque la règle vient d'un ancêtre. Un `position: fixed` ne
  // protège pas de cela : il détache la POSITION, pas l'héritage des sélecteurs
  // descendants.
  //
  // Le portail règle aussi deux choses au passage : plus de contexte
  // d'empilement parent qui puisse coincer le `z-index`, et plus de découpage par
  // un `overflow: hidden` d'ancêtre.
  const [cible] = useState(() => (typeof document === 'undefined' ? null : document.body));

  // La modale est toujours ouverte quand elle est montée : le verrou vaut donc
  // toute sa durée de vie.
  useScrollBloque(true);

  // ⚠️ Trois manques corrigés ICI, dans la coquille : les quatre dialogues en
  // héritent d'un coup.
  //  1. le focus REVIENT à l'élément qui a ouvert la modale — sans ça, on
  //     repartait du haut du document après avoir confirmé un effacement ;
  //  2. Tab BOUCLE dans la modale — sinon on tabulait dans la page derrière,
  //     invisible et toujours cliquable ;
  //  3. la page derrière ne DÉFILE plus (par `useScrollBloque` — voir le hook :
  //     une modale peut s'ouvrir depuis un panneau, qui bloque déjà).
  useEffect(() => {
    const ouvreur = document.activeElement as HTMLElement | null;

    // Point de départ du clavier : la BOÎTE, sauf si un contenu a déjà pris le
    // focus par `autoFocus` (le champ d'un `PromptDialog`, l'« Annuler » d'une
    // confirmation) — on ne lui vole pas.
    //
    // ⚠️ Un `autoFocus` sur un bouton posé SOUS une longue liste est à
    // proscrire : le navigateur défile jusqu'à l'élément focalisé, et la modale
    // s'ouvrait tout en bas, sur ses boutons, le contenu invisible. Focaliser le
    // conteneur donne le même point de départ sans rien faire défiler.
    if (!boite.current?.contains(document.activeElement)) {
      boite.current?.focus({ preventScroll: true });
    }
    // Le contenu défilant repart du haut : une modale rouverte gardait sinon la
    // position de défilement de la fois précédente.
    boite.current?.scrollTo?.({ top: 0 });

    const focusables = () =>
      Array.from(
        boite.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ) ?? []
      );

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const cibles = focusables();
      if (cibles.length === 0) return;
      const premier = cibles[0];
      const dernier = cibles[cibles.length - 1];
      // `activeElement` peut être hors de la boîte (premier Tab après ouverture).
      const actif = document.activeElement;
      if (e.shiftKey && (actif === premier || !boite.current?.contains(actif))) {
        e.preventDefault();
        dernier.focus();
      } else if (!e.shiftKey && actif === dernier) {
        e.preventDefault();
        premier.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      ouvreur?.focus?.();
    };
  }, [onClose]);

  if (!cible) return null;

  return createPortal(
    <div
      // ⚠️ **`z-[70]` : au-dessus de TOUT, panneaux mobiles compris.** À `z-50`,
      // une confirmation ouverte depuis le panneau d'actions (supprimer une
      // catégorie RTA, par exemple) se retrouvait DERRIÈRE lui : même niveau,
      // et le panneau monté après dans le DOM passait devant. On cliquait, rien
      // ne semblait se produire, et le geste paraissait sans confirmation.
      // Une confirmation est le dernier mot de l'interface : rien ne se met
      // devant elle.
      className="fixed inset-0 z-[70] flex items-center justify-center bg-bg/80 p-4
                 animate-[voile_150ms_var(--ease-out)]"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={boite}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        // Focalisable par programme seulement (`-1`) : la boîte est le point de
        // départ du clavier, mais elle ne doit pas s'insérer dans le cycle de
        // Tab comme un contrôle de plus.
        tabIndex={-1}
        data-ctx={ctx ?? undefined}
        onClick={(e) => e.stopPropagation()}
        // Le voile en fondu, la boîte en fondu + 8 px de montée. Un peu plus
        // lente que le voile (200 vs 150 ms) : la boîte finit APRÈS le fond
        // qu'elle recouvre, sinon elle semble arriver avant lui.
        // `focus:outline-none` : la boîte reçoit le focus initial (voir plus
        // haut), mais elle n'est pas un contrôle — l'anneau d'accent global
        // entourerait toute la modale à l'ouverture.
        // ⚠️ **`flex flex-col` et non un bloc qui défile en entier.** C'est ce
        // qui permet à l'en-tête de rester en haut et au pied en bas pendant que
        // SEUL le corps défile — sur une fiche longue, les boutons d'action
        // partaient sinon hors de l'écran, et il fallait défiler jusqu'en bas
        // pour trouver « Annuler ».
        // ⚠️ Le rembourrage passe aux TROIS BANDES et non à la boîte : sans
        // cela, le corps ne peut pas atteindre les bords quand il en a besoin
        // (une liste dont les entrées doivent toucher le cadre).
        className={`flex w-full ${largeur} max-h-[90dvh] flex-col overflow-hidden rounded-2xl
                   border border-border bg-panel shadow-glow shadow-black/60 focus:outline-none
                   animate-[dialogue_200ms_var(--ease-out)]`}
      >
        {/* ── EN-TÊTE : titre à gauche, fermeture à droite ─────────────────
            ⚠️ Toujours dans cet ordre, sur toutes les modales de l'app. On
            cherche la sortie d'une fenêtre TOUJOURS au même endroit ; une croix
            qui se déplace d'un écran à l'autre se cherche à chaque fois.
            ⚠️ `flex-none` : l'en-tête ne défile pas et ne se comprime pas. */}
        {(titre || croix) && (
          <div
            className={`flex flex-none items-start gap-3 ${padding} ${
              // Sans titre, la bande ne porte que la croix : elle n'a donc pas à
              // réserver de hauteur, et le contenu remonte contre le haut de la
              // boîte. `h-0` la fait flotter dans le rembourrage du corps.
              titre ? 'pb-2' : 'h-0 py-0'
            }`}
          >
            {icone}
            <div className="min-w-0 flex-1">
              {/* ⚠️ Le `<h2>` n'est rendu QUE s'il y a un titre : vide, il
                  porterait quand même `labelledBy`, et un lecteur d'écran
                  annoncerait un dialogue sans nom alors que le contenu a le
                  sien (la fiche d'un monstre écrit son propre titre). */}
              {titre && (
                <h2 id={labelledBy} className="text-base font-bold text-ink">
                  {titre}
                </h2>
              )}
              {sousTitre && (
                <p className="mt-1.5 text-xs leading-relaxed text-ink-dim">{sousTitre}</p>
              )}
            </div>
            {/* Croix NUE : ni cadre, ni fond — c'est le défaut de BoutonIcone.
                Encadrée, elle se lirait comme un bouton d'action de plus, au
                même rang que ce qu'on est venu lire. Le symbole se reconnaît
                seul.
                ⚠️ `-mr-1 -mt-1` : elle se pose DANS le rembourrage de la bande
                plutôt que de l'entamer, sinon le titre perd 28 px de largeur au
                profit d'un bouton qui n'en a pas besoin. */}
            {croix && (
              // ⚠️ `ml-auto` EN PLUS du `flex-1` du bloc de titre : la mise à
              // droite ne doit pas dépendre d'un voisin. Un titre absent, ou un
              // bloc qui cesserait de s'étirer, ramenait la croix contre le
              // texte — au milieu de la boîte, là où on ne la cherche pas.
              <BoutonIcone
                onClick={onClose}
                libelle="Fermer"
                icone={<X size={18} />}
                className="-mr-1 -mt-1 ml-auto flex-none hoverable:bg-transparent"
              />
            )}
          </div>
        )}

        {/* ── CORPS : le seul à défiler ────────────────────────────────────
            ⚠️ **Il prend TOUTE la largeur de la boîte.** C'est la règle qui
            manquait : les formulaires y flottaient à leur largeur naturelle,
            avec du vide à droite, parce que rien ne les forçait à s'étirer. Un
            contenu qui ne PEUT pas s'étirer (une image, une grille à pas fixe)
            se centre — d'où `items-center` sur l'axe transversal. Voir
            `corpsCentre` pour le cas où le contenu doit rester à sa taille.
            ⚠️ `pt-0` quand un en-tête existe : la bande du dessus a déjà posé
            son écart, et deux rembourrages consécutifs faisaient un blanc de
            32 px entre le titre et le premier champ. */}
        {children != null && (
        <div
          className={`flex min-h-0 flex-1 flex-col overflow-y-auto ${padding} ${
            titre || croix ? 'pt-0' : ''
          } ${actions ? 'pb-2' : ''} ${
            // ⚠️ **`items-stretch` explicite, et non un variant arbitraire.**
            // J'avais écrit `[&>*]:w-full` : Tailwind ne l'a JAMAIS émis, parce
            // qu'il lit le source comme du texte et n'y reconnaît pas `>` et `*`
            // comme des caractères de classe. La règle était morte sans que rien
            // ne le signale — vérifier dans le CSS construit, pas dans le TSX.
            // `stretch` fait le même travail et est une classe ordinaire : dans
            // un conteneur flex en colonne, les enfants prennent alors toute la
            // largeur au lieu de celle de leur contenu.
            corpsCentre ? 'items-center' : 'items-stretch'
          }`}
        >
          {children}
        </div>
        )}

        {/* ── PIED : les actions, toujours en bas ──────────────────────────
            ⚠️ `flex-none` : il reste visible quand le corps défile. C'est tout
            l'objet de la structure en trois bandes — sur une fiche longue, les
            boutons d'action se trouvaient au bout du défilement, là où
            personne ne les cherche. */}
        {/* ⚠️ `pt-0` seulement s'il y a un CORPS au-dessus : c'est lui qui a
            déjà posé l'écart. Sans corps (une confirmation, qui n'a qu'un titre
            et une phrase), le pied doit reprendre son propre rembourrage haut,
            sinon les boutons touchent le message. */}
        {actions && (
          <div className={`flex-none ${padding} ${children != null ? 'pt-0' : 'pt-3'}`}>
            <PiedDeDialogue className="mt-0" empile={actionsEmpilees}>
              {actions}
            </PiedDeDialogue>
            {noteFinale && (
              <p className="mt-2.5 text-center text-micro text-ink-dim">{noteFinale}</p>
            )}
          </div>
        )}
      </div>
    </div>,
    cible,
  );
}

// Confirmation générique. `destructif` change la couleur du bouton d'action ET
// l'ordre d'insistance : quand l'action détruit, c'est « Annuler » qui est mis en
// avant, pas l'inverse.
export function ConfirmDialog({
  titre,
  message,
  libelleAction = 'Confirmer',
  destructif = false,
  onConfirm,
  onCancel,
}: {
  titre: string;
  message: ReactNode;
  libelleAction?: string;
  destructif?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    // ⚠️ **PAS de croix ici, et c'est la seule exception de l'app.** Sur une
    // confirmation, « Annuler » EST la sortie : une croix à côté ferait deux
    // portes pour un choix qui n'en a qu'une, et l'on hésiterait sur ce que
    // ferme la croix — annuler, ou fermer sans répondre ? Échap et le clic à
    // côté restent disponibles, comme partout.
    <Modale
      onClose={onCancel}
      labelledBy="modale-titre"
      titre={titre}
      sousTitre={message}
      icone={
        <span
          className={`mt-0.5 flex-none rounded-lg p-2 ${
            destructif ? 'bg-bad/15 text-bad' : 'bg-warn/15 text-warn'
          }`}
        >
          <AlertTriangle size={18} />
        </span>
      }
      // ⚠️ L'ordre d'écriture donne l'action d'abord, « Annuler » ensuite —
      // donc « Annuler » à DROITE sur écran large et EN BAS sous le pouce sur
      // téléphone. C'est voulu : le défaut ne perd jamais rien (voir
      // spec/README.md), et c'est lui qui reçoit le focus initial.
      actions={
        <>
          {/* ⚠️ `plein` pour le ton neutre : c'est `bg-panel2`, la surface d'un
              bouton posé DANS un dialogue — lui-même déjà en `bg-panel`. Un fond
              `doux` s'y confondrait avec la boîte qui le porte. */}
          <Bouton
            onClick={onConfirm}
            ton={destructif ? 'danger' : 'neutre'}
            fond={destructif ? 'doux' : 'plein'}
            libelle={libelleAction}
          />
          <Bouton onClick={onCancel} autoFocus ton="accent" fond="doux" libelle="Annuler" />
        </>
      }
    />
  );
}

// Saisie d'une valeur. Entrée valide, Échap annule — les deux réflexes qu'on a
// devant un champ, et que la boîte native était seule à offrir jusqu'ici.
export function PromptDialog({
  titre,
  message,
  valeurInitiale = '',
  placeholder,
  libelleAction = 'Valider',
  onValider,
  onCancel,
}: {
  titre: string;
  message?: ReactNode;
  valeurInitiale?: string;
  placeholder?: string;
  libelleAction?: string;
  onValider: (valeur: string) => void;
  onCancel: () => void;
}) {
  const [valeur, setValeur] = useState(valeurInitiale);
  const ref = useRef<HTMLInputElement>(null);

  // Sélectionner le texte proposé : on le remplace neuf fois sur dix.
  useEffect(() => {
    ref.current?.select();
  }, []);

  return (
    <Modale
      onClose={onCancel}
      labelledBy="modale-titre"
      titre={titre}
      sousTitre={message}
      croix
      // ⚠️ Ici l'ordre est l'inverse de ConfirmDialog : c'est l'ACTION qui est
      // mise en avant, parce qu'elle ne perd rien — on vient saisir une valeur,
      // pas confirmer une destruction.
      actions={
        <>
          <Bouton onClick={onCancel} fond="plein" libelle="Annuler" />
          {/* ⚠️ `form` + `id` : le bouton vit dans le PIED, hors du `<form>` qui
              est dans le corps. Cet attribut les relie — sans lui, « Valider »
              ne soumettrait rien, et seule la touche Entrée dans le champ
              marcherait encore. */}
          <Bouton
            type="submit"
            form="prompt-form"
            ton="accent"
            fond="doux"
            libelle={libelleAction}
          />
        </>
      }
    >
      <form
        id="prompt-form"
        onSubmit={(e) => {
          e.preventDefault();
          onValider(valeur);
        }}
      >
        <Champ
          ref={ref}
          value={valeur}
          onChange={(e) => setValeur(e.target.value)}
          placeholder={placeholder}
          autoFocus
        />
      </form>
    </Modale>
  );
}

/* --------------------------------------------------------------------------
 * Le choix de conservation, posé une fois, à la fin du premier import
 * ----------------------------------------------------------------------- */

// ⚠️ **Pourquoi une question explicite plutôt qu'un réglage silencieux.**
// La conservation vivait dans le menu ⚙, désactivée par défaut, et ne portait que
// sur le compte : on importait, on rechargeait, et le compte avait disparu
// **alors que la prépa RTA et les équipes de siège étaient toujours là**. Deux
// régimes de mémoire dans le même outil, jamais expliqués, réglés dans un menu
// que personne n'ouvre. Le réglage vaut désormais pour TOUT (voir
// usePersistence) et la question est posée à voix haute.
//
// La question est donc posée **au moment où elle a un sens** : juste après
// l'import, quand l'utilisateur vient de voir ses données arriver.
//
// Trois points à ne jamais retirer du texte :
//  - **la recommandation** — sans elle, on répond au hasard : l'utilisateur n'a
//    aucun moyen de savoir ce qu'il perd en refusant ;
//  - **« dans ton navigateur »** — c'est l'objection immédiate (« mes données
//    partent où ? »), et la réponse doit être dans la fenêtre, pas ailleurs ;
//  - **« tu pourras changer d'avis »** — sans ça, la question devient un
//    engagement, et on répond non par prudence.
//
// ⚠️ Aucune des deux réponses ne détruit quoi que ce soit : refuser garde le
// compte pour la session en cours. Fermer sans répondre n'enregistre RIEN — on
// redemandera au prochain import plutôt que d'interpréter un silence.
//
// ⚠️ **La question revient à chaque import**, sauf case cochée — et la case ne
// vaut que pour la **session en cours**. Un choix pris une fois pour toutes
// vieillit mal : on accepte la conservation chez soi, puis on ouvre le site sur
// un poste partagé sans que rien ne le rappelle. La case évite d'être resollicité
// quand on enchaîne plusieurs fichiers, sans faire taire la question pour
// toujours : la garantie est « au moins une fois par session ».
export function KeepAccountDialog({
  onChoose,
  onDismiss,
}: {
  onChoose: (keep: boolean, nePlusMontrer: boolean) => void;
  onDismiss: () => void;
}) {
  const [nePlusMontrer, setNePlusMontrer] = useState(false);
  // ⚠️ La coquille commune, alors que ce dialogue en réécrivait une à trois
  // lignes d'ici. Il perdait ainsi le piège à focus, le retour du focus à
  // l'ouvreur, Échap et le blocage du défilement — sur la seule fenêtre de l'app
  // qui pose une question de CONSERVATION DES DONNÉES, c'est-à-dire celle qu'il
  // faut le moins pouvoir contourner par accident.
  // ⚠️ Son voile portait en plus un `backdrop-blur-sm` que les autres n'ont pas.
  // Écart abandonné : la spec ne prévoit qu'un fondu (voir design.md), et un
  // seul dialogue floutant le fond se lisait comme un objet d'une autre nature.
  return (
    // ⚠️ **PAS de croix**, comme les confirmations : cette fenêtre pose une
    // question dont les deux réponses sont des boutons. Une croix serait une
    // troisième issue, dont on ne saurait pas si elle vaut « non » — alors
    // qu'elle n'enregistre RIEN et redemande au prochain import.
    <Modale
      onClose={onDismiss}
      labelledBy="keep-account-titre"
      largeur="max-w-[420px]"
      titre="Garder tes données sur cet appareil ?"
      sousTitre={
        <>
          Ton compte, ta prépa RTA, tes équipes de siège et tes recommandations seront encore là à
          ta prochaine visite, sans rien redéposer.
          <span className="mt-2 block font-semibold text-star">
            Recommandé : sans ça, tu perds tout ton travail en fermant l'onglet.
          </span>
        </>
      }
      icone={
        <span className="mt-0.5 flex-none rounded-lg bg-panel2 p-2 text-star">
          <HardDriveDownload size={18} />
        </span>
      }
      // ⚠️ EMPILÉS au doigt : ces deux libellés sont des phrases, pas des
      // verbes. Taqués en rangée ils se serraient et se repliaient au milieu
      // d'un mot — c'est ce qui rendait cette fenêtre moins lisible qu'avant.
      actionsEmpilees
      // ⚠️ SOUS les boutons, et centrée. Je l'avais remontée dans le corps :
      // elle y devenait une consigne de plus à lire avant de choisir, alors que
      // son rôle est de désamorcer l'engagement une fois les choix sous les yeux.
      // Sans elle, on répond « non » par prudence.
      noteFinale="Tu pourras changer d'avis à tout moment dans les réglages ⚙."
      actions={
        <>
          <Bouton
            onClick={() => onChoose(false, nePlusMontrer)}
            fond="plein"
            taille="sm"
            libelle="Non, ne rien garder de mes informations"
          />
          <Bouton
            onClick={() => onChoose(true, nePlusMontrer)}
            autoFocus
            ton="accent"
            fond="doux"
            trait="aucun"
            taille="sm"
            libelle="Garder mes données (recommandé)"
          />
        </>
      }
    >
      <p className="flex items-start gap-2 rounded-lg border border-border bg-panel2 px-3 py-2 text-micro leading-relaxed text-ink-dim">
        <ShieldCheck size={14} className="mt-[1px] flex-none text-good" />
        <span>
          Tout reste <b className="text-ink">dans ton navigateur</b>, sur cet ordinateur. Rien
          n'est envoyé nulle part, et rien n'est partagé.
        </span>
      </p>

      {/* La case s'applique aux DEUX réponses, et seulement à cette session.
          ⚠️ Ton `star` : elle accompagne la réponse recommandée, dont elle
          reprend la couleur — la même que celle du paragraphe au-dessus. */}
      <Case
        libelle="Ne plus me montrer pendant cette session"
        ton="star"
        checked={nePlusMontrer}
        onChange={(e) => setNePlusMontrer(e.target.checked)}
        className="mt-3.5"
      />

    </Modale>
  );
}
