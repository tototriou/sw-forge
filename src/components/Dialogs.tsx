import { ReactNode, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, HardDriveDownload, ShieldCheck } from 'lucide-react';
import { BOUTON_DESTRUCTIF, BOUTON_PRIMAIRE, BOUTON_SECONDAIRE } from './buttonStyles';

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
function Modale({
  onClose,
  labelledBy,
  children,
}: {
  onClose: () => void;
  labelledBy: string;
  children: ReactNode;
}) {
  const boite = useRef<HTMLDivElement>(null);

  // ⚠️ Trois manques corrigés ICI, dans la coquille : les quatre dialogues en
  // héritent d'un coup.
  //  1. le focus REVIENT à l'élément qui a ouvert la modale — sans ça, on
  //     repartait du haut du document après avoir confirmé un effacement ;
  //  2. Tab BOUCLE dans la modale — sinon on tabulait dans la page derrière,
  //     invisible et toujours cliquable ;
  //  3. la page derrière ne DÉFILE plus.
  useEffect(() => {
    const ouvreur = document.activeElement as HTMLElement | null;
    const scrollAvant = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

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
      document.body.style.overflow = scrollAvant;
      ouvreur?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={boite}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[400px] rounded-2xl border border-border bg-panel p-5 shadow-glow shadow-black/60"
      >
        {children}
      </div>
    </div>
  );
}

// ⚠️ Ces trois classes ont été REMONTÉES dans buttonStyles.ts au deuxième
// usage plutôt que recopiées ailleurs. C'est là que vit la pression au clic.
const BOUTON_NEUTRE = BOUTON_PRIMAIRE;

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
    <Modale onClose={onCancel} labelledBy="modale-titre">
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 flex-none rounded-lg p-2 ${
            destructif ? 'bg-fire/15 text-fire' : 'bg-warn/15 text-warn'
          }`}
        >
          <AlertTriangle size={18} />
        </span>
        <div>
          <h2 id="modale-titre" className="text-[15px] font-bold text-ink">
            {titre}
          </h2>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-dim">{message}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button onClick={onConfirm} className={destructif ? BOUTON_DESTRUCTIF : BOUTON_SECONDAIRE}>
          {libelleAction}
        </button>
        <button onClick={onCancel} autoFocus className={BOUTON_NEUTRE}>
          Annuler
        </button>
      </div>
    </Modale>
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
    <Modale onClose={onCancel} labelledBy="modale-titre">
      <h2 id="modale-titre" className="text-[15px] font-bold text-ink">
        {titre}
      </h2>
      {message && <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-dim">{message}</p>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onValider(valeur);
        }}
      >
        <input
          ref={ref}
          value={valeur}
          onChange={(e) => setValeur(e.target.value)}
          placeholder={placeholder}
          autoFocus
          className="mt-3 w-full rounded-lg border border-border bg-panel2 px-3 py-2 text-[13px] text-ink
                     outline-none focus:border-accent"
        />
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onCancel} className={BOUTON_SECONDAIRE}>
            Annuler
          </button>
          <button type="submit" className={BOUTON_NEUTRE}>
            {libelleAction}
          </button>
        </div>
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
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 p-4 backdrop-blur-sm"
      onClick={onDismiss}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="keep-account-titre"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[420px] rounded-2xl border border-border bg-panel p-5 shadow-glow shadow-black/60"
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex-none rounded-lg bg-panel2 p-2 text-star">
            <HardDriveDownload size={18} />
          </span>
          <div>
            <h2 id="keep-account-titre" className="text-[15px] font-bold text-ink">
              Garder tes données sur cet appareil ?
            </h2>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-dim">
              Ton compte, ta prépa RTA, tes équipes de siège et tes recommandations seront encore là
              à ta prochaine visite, sans rien redéposer.
            </p>
            <p className="mt-2 text-[12.5px] font-semibold leading-relaxed text-star">
              Recommandé : sans ça, tu perds tout ton travail en fermant l'onglet.
            </p>
          </div>
        </div>

        <p className="mt-3 flex items-start gap-2 rounded-lg border border-border bg-panel2 px-3 py-2 text-[11.5px] leading-relaxed text-ink-dim">
          <ShieldCheck size={14} className="mt-[1px] flex-none text-good" />
          <span>
            Tout reste <b className="text-ink">dans ton navigateur</b>, sur cet ordinateur. Rien
            n'est envoyé nulle part, et rien n'est partagé.
          </span>
        </p>

        {/* La case s'applique aux DEUX réponses, et seulement à cette session. */}
        <label className="mt-3.5 flex cursor-pointer select-none items-center gap-2 text-[11.5px] text-ink-dim">
          <span
            className={`flex h-[15px] w-[15px] flex-none items-center justify-center rounded border transition
              ${nePlusMontrer ? 'border-star bg-star text-bg' : 'border-border bg-panel2'}`}
          >
            {nePlusMontrer && <Check size={11} strokeWidth={3} />}
          </span>
          <input
            type="checkbox"
            className="sr-only"
            checked={nePlusMontrer}
            onChange={(e) => setNePlusMontrer(e.target.checked)}
          />
          Ne plus me montrer pendant cette session
        </label>

        <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            onClick={() => onChoose(false, nePlusMontrer)}
            className="rounded-lg border border-border bg-panel2 px-3.5 py-2 text-[12.5px] font-semibold
                       text-ink-dim transition hoverable:text-ink"
          >
            Non, ne rien garder de mes informations
          </button>
          <button
            onClick={() => onChoose(true, nePlusMontrer)}
            autoFocus
            className="rounded-lg bg-accent-soft px-3.5 py-2 text-[12.5px]
                       font-semibold text-ink shadow transition hoverable:brightness-110"
          >
            Garder mes données (recommandé)
          </button>
        </div>

        <p className="mt-2.5 text-center text-[11px] text-ink-dim">
          Tu pourras changer d'avis à tout moment dans les réglages ⚙.
        </p>
      </div>
    </div>
  );
}
