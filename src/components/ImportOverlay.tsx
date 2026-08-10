import { useState } from 'react';
import { Check, HardDriveDownload, Loader2, ShieldCheck } from 'lucide-react';

/* --------------------------------------------------------------------------
 * Attente pendant le traitement de l'export
 * ----------------------------------------------------------------------- */

// ⚠️ Un export pèse 5 à 8 Mo : entre le dépôt du fichier et l'affichage, le
// navigateur est **bloqué** le temps du parse et du mapping. Sans repère visuel,
// l'app paraît figée et on reclique — ce qui relance tout.
//
// L'overlay est **modal et non fermable** : il ne dure qu'un instant, et rien
// d'utile ne peut être fait pendant.
export function ImportSpinner() {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 backdrop-blur-sm"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-panel px-8 py-6 shadow-glow shadow-black/60">
        <Loader2 size={28} className="animate-spin text-star" />
        <p className="text-[13.5px] font-semibold text-ink">Analyse de ton compte…</p>
        <p className="text-[11.5px] text-ink-dim">Tout se passe dans ton navigateur.</p>
      </div>
    </div>
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
          <ShieldCheck size={14} className="mt-[1px] flex-none text-emerald-400" />
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
                       text-ink-dim transition hover:text-ink"
          >
            Non, ne rien garder de mes informations
          </button>
          <button
            onClick={() => onChoose(true, nePlusMontrer)}
            autoFocus
            className="rounded-lg bg-gradient-to-br from-[#3a4270] to-[#272e52] px-3.5 py-2 text-[12.5px]
                       font-semibold text-ink shadow transition hover:brightness-110"
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
