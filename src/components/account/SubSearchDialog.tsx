import { useState } from 'react';
import { Modale } from '../Dialogs';
import { BOUTON_PRIMAIRE, BOUTON_SECONDAIRE } from '../buttonStyles';
import { Critere } from './CritereCase';

// « Recherche détaillée de sous-propriétés » — la modale du JEU, reprise telle
// quelle : toutes les propriétés listées d'un coup, chacune avec sa case à
// cocher, son **Min** et son **Max**.
//
// ⚠️ Une MODALE et non quatre menus en ligne. Le jeu pose la question dans
// l'autre sens : au lieu de « quelle propriété pour la case 1 ? », il montre
// TOUTES les propriétés et on coche celles qu'on veut. On lit d'un coup ce qui
// est disponible, et on compare les bornes d'une ligne à l'autre — impossible à
// travers quatre menus déroulants qui n'en montrent qu'une à la fois.
//
// ⚠️ **Min ET Max**, pas un seuil unique. « VIT entre 25 et 37 » est la
// recherche courante quand on trie ses runes ; un seul seuil obligeait à
// parcourir tout ce qui dépasse.
export default function SubSearchDialog({
  options,
  criteres,
  max,
  onValider,
  onClose,
}: {
  // Propriétés proposées, dans l'ordre du jeu.
  options: { code: number; label: string }[];
  criteres: Critere[];
  max: number; // nombre de critères simultanés (4 : autant que de propriétés)
  onValider: (c: Critere[]) => void;
  onClose: () => void;
}) {
  // ⚠️ Brouillon LOCAL : la modale se valide par « OK » ou s'abandonne. Écrire
  // directement dans l'état de la page ferait filtrer la liste derrière à chaque
  // frappe, et « Annuler » ne voudrait plus rien dire.
  const [brouillon, setBrouillon] = useState<Critere[]>(criteres);

  const trouve = (code: number) => brouillon.find((c) => c.code === code);
  const coche = (code: number) => !!trouve(code);
  const plein = brouillon.length >= max;

  const basculer = (code: number) =>
    setBrouillon((cur) =>
      cur.some((c) => c.code === code)
        ? cur.filter((c) => c.code !== code)
        : // Au-delà du maximum, la case ne se coche pas : une rune ne porte que
          // 4 propriétés, un 5ᵉ critère ne pourrait jamais être satisfait.
          cur.length >= max
          ? cur
          : [...cur, { code, min: 0 }]
    );

  const majBorne = (code: number, champ: 'min' | 'max', valeur: number | undefined) =>
    setBrouillon((cur) => cur.map((c) => (c.code === code ? { ...c, [champ]: valeur } : c)));

  return (
    <Modale onClose={onClose} labelledBy="sub-search-titre" largeur="max-w-[560px]">
      <h2 id="sub-search-titre" className="mb-1 text-[15px] font-bold text-ink">
        Recherche détaillée de sous-propriétés
      </h2>
      <p className="mb-3 text-[12px] text-ink-dim">
        Coche les propriétés à exiger, et borne-les si tu veux.{' '}
        <b className="text-ink">{brouillon.length}/{max}</b> retenue
        {brouillon.length > 1 ? 's' : ''}.
      </p>

      <div className="flex flex-col gap-0.5">
        {options.map((o) => {
          const c = trouve(o.code);
          const actif = !!c;
          // Une case non cochée alors que le maximum est atteint : elle reste
          // VISIBLE mais grisée — on voit ce qui existe et pourquoi c'est
          // refusé, plutôt qu'une liste qui rétrécit sous le curseur.
          const bloque = !actif && plein;
          return (
            <div
              key={o.code}
              className={`flex items-center gap-2 rounded px-1.5 py-1 transition ${
                actif ? 'bg-accent-soft' : bloque ? 'opacity-40' : 'hoverable:bg-panel2'
              }`}
            >
              <label
                className={`flex min-w-0 flex-1 items-center gap-2 ${
                  bloque ? 'cursor-not-allowed' : 'cursor-pointer'
                }`}
              >
                <input
                  type="checkbox"
                  checked={actif}
                  disabled={bloque}
                  onChange={() => basculer(o.code)}
                  className="h-3.5 w-3.5 flex-none accent-accent"
                />
                <span className={`truncate text-[12px] ${actif ? 'text-ink' : 'text-ink-dim'}`}>
                  {o.label}
                </span>
              </label>

              {/* Les bornes n'apparaissent qu'une fois la propriété cochée :
                  deux champs par ligne sur 40 propriétés décochées feraient un
                  mur de saisie dont rien ne serait utilisé. */}
              {actif && (
                <div className="flex flex-none items-center gap-1">
                  <Borne
                    valeur={c!.min}
                    placeholder="Min"
                    onChange={(v) => majBorne(o.code, 'min', v ?? 0)}
                  />
                  <span className="font-mono text-[11px] text-ink-dim">~</span>
                  <Borne
                    valeur={c!.max}
                    placeholder="Max"
                    onChange={(v) => majBorne(o.code, 'max', v)}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          onClick={() => setBrouillon([])}
          disabled={brouillon.length === 0}
          className={`${BOUTON_SECONDAIRE} disabled:cursor-not-allowed disabled:opacity-30`}
        >
          Réinitialiser
        </button>
        <button onClick={onClose} className={BOUTON_SECONDAIRE}>
          Annuler
        </button>
        <button onClick={() => onValider(brouillon)} className={BOUTON_PRIMAIRE} autoFocus>
          OK
        </button>
      </div>
    </Modale>
  );
}

// Une borne. ⚠️ `type="text"` + `inputMode="numeric"` comme partout ailleurs :
// un `type="number"` garde le texte tapé et laisse traîner les zéros de tête
// (voir spec/README.md).
//
// ⚠️ Vide = `undefined` et NON 0 : « pas de plafond » n'est pas « au plus
// zéro ». C'est ce qui permet de ne borner que d'un côté.
function Borne({
  valeur,
  placeholder,
  onChange,
}: {
  valeur: number | undefined;
  placeholder: string;
  onChange: (v: number | undefined) => void;
}) {
  return (
    <input
      type="text"
      inputMode="numeric"
      value={valeur ?? ''}
      placeholder={placeholder}
      aria-label={placeholder}
      onChange={(e) => {
        const brut = e.target.value.trim();
        if (brut === '') return onChange(undefined);
        if (!/^\d+$/.test(brut)) return; // frappe invalide ignorée
        onChange(Number(brut));
      }}
      className="h-[22px] w-[52px] rounded border border-border bg-panel px-1 text-center
                 font-mono text-[11px] text-ink outline-none transition tabular-nums
                 placeholder:text-ink-dim focus:border-accent"
    />
  );
}
