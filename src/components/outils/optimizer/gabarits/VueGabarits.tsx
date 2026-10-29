import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { GABARITS } from './registre';
import type { ContexteGabarits, Gabarit } from './types';

// La vue de développement des gabarits de l'Optimizer : chaque boîte de la
// refonte du bureau, seule, à sa largeur déclarée, dans chacun de ses états,
// nourrie par l'état réel et le compte importé. Ouverte par
// `#/outils/optimizer/gabarits`, en développement seulement (`OutilsPage`).
// Fiche : docs/03-developpeur/vue-des-gabarits.md.
//
// ⚠️ **Elle ne modifie jamais l'Optimizer** : voir `inertes.ts`.
//
// ⚠️ **Rien n'y est tassé** : chaque état se rend dans un cadre sans largeur
// imposée ; la boîte porte sa largeur déclarée, et la vue affiche la taille
// réelle mesurée et ce qui déborde. Un contenu qui ne tient pas se voit.
export default function VueGabarits({ ctx, gabarits = GABARITS }: { ctx: ContexteGabarits; gabarits?: Gabarit[] }) {
  return (
    <div data-vue-gabarits className="space-y-10 pb-16">
      <header className="space-y-1">
        <h1 className="text-lg font-bold text-ink">Gabarits de l&apos;Optimizer</h1>
        <p className="max-w-3xl text-sm text-ink-dim">
          Vue de développement : chaque boîte de la refonte du bureau, seule, à sa largeur, dans chacun de ses états.
          Les gestes agissent sur une copie locale ; rien n&apos;est écrit dans l&apos;Optimizer.
        </p>
      </header>
      {gabarits.map((g) => (
        <section key={g.id} data-gabarit={g.id} data-largeur={g.largeur} aria-labelledby={`gabarit-${g.id}`} className="space-y-3">
          <div className="space-y-1">
            <h2 id={`gabarit-${g.id}`} className="text-base font-bold text-ink">{g.nom}</h2>
            <p className="text-xs text-ink-dim">
              Déclarée : {g.elastique ? `élastique, ${g.largeur} px de large au moins` : `${g.largeur} px de large`}, ≈ {g.hauteurEstimee} px de haut · {g.composant}
            </p>
            <p className="text-xs text-ink-dim">Téléphone : {g.telephone}</p>
          </div>
          <div className="max-w-3xl rounded-lg border border-border-soft bg-panel2 px-3 py-2">
            <p className="text-xs font-semibold text-ink">Ce qui change de comportement</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-ink-dim">
              {g.changements.map((c) => <li key={c}>{c}</li>)}
            </ul>
          </div>
          <div className="flex flex-wrap items-start gap-x-8 gap-y-6">
            {g.etats.map((e) => (
              <figure key={e.id} data-etat={e.id} data-largeur={e.largeur ?? g.largeur} className="space-y-1.5">
                <figcaption className="text-xs font-semibold text-ink-dim">
                  {e.nom}{e.largeur != null && e.largeur !== g.largeur ? ` · montré à ${e.largeur} px` : ''}
                </figcaption>
                <Mesure largeur={e.largeur ?? g.largeur}>{e.rendu(ctx)}</Mesure>
              </figure>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

// La taille réelle de la boîte, et ce qui déborde de sa largeur déclarée.
function Mesure({ largeur, children }: { largeur: number; children: ReactNode }) {
  const cadre = useRef<HTMLDivElement>(null);
  const [mesure, setMesure] = useState<{ l: number; h: number; deborde: number } | null>(null);
  useLayoutEffect(() => {
    const boite = cadre.current?.firstElementChild as HTMLElement | null;
    if (!boite) return;
    const relever = () => setMesure({ l: Math.round(boite.offsetWidth), h: Math.round(boite.offsetHeight), deborde: Math.max(0, boite.scrollWidth - boite.clientWidth) });
    relever();
    const observateur = new ResizeObserver(relever);
    observateur.observe(boite);
    return () => observateur.disconnect();
  }, []);
  return (
    <div className="space-y-1">
      <div ref={cadre} data-cadre-gabarit className="w-max"><div style={{ width: largeur }}>{children}</div></div>
      <p data-mesure className={`text-micro ${mesure && (mesure.deborde > 0 || mesure.l > largeur) ? 'font-semibold text-bad' : 'text-ink-dimmer'}`}>
        {mesure ? `Réel : ${mesure.l} × ${mesure.h} px${mesure.deborde > 0 ? ` · le contenu déborde de ${mesure.deborde} px` : ''}` : 'Réel : non mesuré'}
      </p>
    </div>
  );
}
