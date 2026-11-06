import { useEffect, useState } from 'react';
import { Crown, Plus, RefreshCw, X } from 'lucide-react';
import type { Monster } from '../../../types';
import type { BoxItem } from '../../../lib/applyAccount';
import { Bouton, BoutonIcone, Champ, Selecteur } from '../../../ui';
import MonsterAvatar from '../../MonsterAvatar';
import MonsterGear from '../../MonsterGear';
import { useTraduction } from '../../../hooks/useLangue';
import {
  MONSTRES_MAX_EQUIPE, MONSTRES_MIN_EQUIPE, deplacerMonstre, designerLeader, etatExemplaire, etatsEquipement, modifierTextes,
  remplacerEquipement, retirerMonstre, retirerRelique,
  type EquipeEnregistree, type EtatPiece, type InventaireCompte, type MonstreEnregistre,
} from '../../../lib/equipesEnregistrees';

interface Props {
  equipe: EquipeEnregistree;
  // Pas encore enregistrée : moins de deux monstres (« Nouvelle équipe »).
  brouillon?: boolean;
  onChanger: (f: (e: EquipeEnregistree, maintenant: Date) => EquipeEnregistree) => void;
  monstreDe: (com2usId: number) => Monster | undefined;
  box: readonly BoxItem[];
  // `null` sans compte : l'équipement s'affiche tel qu'enregistré.
  inventaire: InventaireCompte | null;
  onAjouter: () => void;
}

// Un champ texte de l'équipe : saisi librement, enregistré (trimé) à la sortie.
function ChampTexte({ libelle, valeur, onValider }: { libelle: string; valeur: string; onValider: (v: string) => void }) {
  const [brouillon, setBrouillon] = useState(valeur);
  useEffect(() => setBrouillon(valeur), [valeur]);
  return (
    <label className="flex min-w-0 flex-col gap-1 text-xs text-ink-dim">
      {libelle}
      <Champ value={brouillon} onChange={(ev) => setBrouillon(ev.target.value)}
        onBlur={() => { onValider(brouillon); setBrouillon((b) => b.trim()); }} />
    </label>
  );
}

// Le détail d'une équipe : son nom, sa note et une fiche par monstre. Le même
// contenu dans la modale de l'ordinateur et le panneau du téléphone.
export default function DetailEquipe({ equipe, brouillon = false, onChanger, monstreDe, box, inventaire, onAjouter }: Props) {
  const t = useTraduction();
  const d = t.equipes.detail;
  const plein = equipe.monstres.length >= MONSTRES_MAX_EQUIPE;
  // Enregistrée, une équipe garde deux monstres : le retrait du deuxième est refusé.
  const retirable = brouillon || equipe.monstres.length > MONSTRES_MIN_EQUIPE;
  // Une grille, pas une colonne flex : dans le panneau du téléphone, une
  // colonne flex aligne ses enfants à gauche (index.css, `[data-tiroir]`) et
  // les fiches se rétrécissaient sur leur contenu.
  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ChampTexte libelle={d.nom} valeur={equipe.nom} onValider={(nom) => onChanger((e, n) => modifierTextes(e, { nom }, n))} />
        <ChampTexte libelle={d.note} valeur={equipe.note} onValider={(note) => onChanger((e, n) => modifierTextes(e, { note }, n))} />
      </div>
      {brouillon && <p role="status" className="text-xs text-ink-dim">{d.brouillon}</p>}
      {!inventaire && equipe.monstres.length > 0 && <p className="text-xs text-ink-dim">{d.sansCompte}</p>}
      {equipe.monstres.map((m, i) => (
        <FicheMonstre key={m.uid} m={m} position={i} total={equipe.monstres.length} leader={equipe.leader === m.uid} retirable={retirable}
          monstre={monstreDe(m.com2usId)} box={box} inventaire={inventaire} onChanger={onChanger} />
      ))}
      <div>
        <Bouton trait="pointille" icone={<Plus size={14} />} libelle={d.ajouter} disabled={plein}
          title={plein ? d.complet : undefined} onClick={onAjouter} />
      </div>
    </div>
  );
}

function FicheMonstre({ m, position, total, leader, retirable, monstre, box, inventaire, onChanger }: {
  m: MonstreEnregistre; position: number; total: number; leader: boolean; retirable: boolean; monstre: Monster | undefined;
  box: readonly BoxItem[]; inventaire: InventaireCompte | null;
  onChanger: Props['onChanger'];
}) {
  const t = useTraduction();
  const d = t.equipes.detail;
  const nom = monstre?.name ?? String(m.com2usId);
  const exemplaire = inventaire ? etatExemplaire(m, box) : null;
  const actuel = m.unitId === null ? undefined : box.find((b) => b.key === String(m.unitId) && b.monster.com2usId === m.com2usId);
  const ecarts: string[] = [];
  if (inventaire && m.equipement) {
    const etats = etatsEquipement(m.equipement, inventaire);
    const dire = (libelle: string, etat: EtatPiece) => { if (etat !== 'identique') ecarts.push(`${libelle} : ${d.etats[etat]}`); };
    m.equipement.runes.forEach((r, k) => dire(d.rune(r.slot), etats.runes[k]));
    m.equipement.artifacts.forEach((_a, k) => dire(d.artefact(k + 1), etats.artefacts[k]));
    if (etats.relique) dire(d.relique, etats.relique);
  }
  return (
    // ⚠️ Étroit (téléphone, volet), les réglages passent sous le nom : sur une
    // ligne, ils tronquaient le nom et rejetaient la croix seule à la ligne.
    <section className="@container rounded-lg border border-border-soft bg-panel2/40 p-3" aria-label={nom}>
      <div className="flex flex-wrap items-center gap-2">
        <MonsterAvatar monster={monstre ?? null} fallback={nom} size={40} couronne={leader} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{nom}</p>
          <p className="truncate text-xs text-ink-dim">
            {d.provenance[m.provenance]}{exemplaire ? ` · ${d.exemplaire[exemplaire]}` : ''}
          </p>
        </div>
        <div className="order-1 flex basis-full items-center gap-2 @lg:order-none @lg:basis-auto">
          <Bouton taille="sm" actif={leader} icone={<Crown size={14} />} libelle={leader ? d.leader : d.designerLeader}
            title={leader ? d.retirerLeader : d.designerLeader}
            onClick={() => onChanger((e, n) => designerLeader(e, leader ? null : m.uid, n))} />
          <Selecteur taille="sm" pleineLargeur={false} surface="panel" aria-label={d.position} value={String(position)}
            onChange={(ev) => onChanger((e, n) => deplacerMonstre(e, m.uid, Number(ev.target.value), n))}>
            {Array.from({ length: total }, (_, k) => <option key={k} value={k}>{d.positionN(k + 1)}</option>)}
          </Selecteur>
        </div>
        {/* Désactivé, son infobulle dit pourquoi. */}
        <BoutonIcone libelle={retirable ? d.retirer(nom) : d.minimum} icone={<X size={14} />} disabled={!retirable}
          onClick={() => onChanger((e, n) => retirerMonstre(e, m.uid, n))} />
      </div>
      {(actuel?.gear || m.equipement?.relic) && (
        <div className="mt-2 flex flex-wrap gap-2">
          {/* N'existe que pour un exemplaire connu ET présent dans la Box. */}
          {actuel?.gear && (
            <Bouton taille="sm" icone={<RefreshCw size={14} />} libelle={d.reprendre}
              onClick={() => onChanger((e, n) => remplacerEquipement(e, m.uid, actuel.gear!, 'porte', n))} />
          )}
          {m.equipement?.relic && (
            <Bouton taille="sm" icone={<X size={14} />} libelle={d.retirerRelique}
              onClick={() => onChanger((e, n) => retirerRelique(e, m.uid, n))} />
          )}
        </div>
      )}
      {m.equipement && (
        <div className="mt-3 overflow-x-auto">
          <MonsterGear gear={m.equipement} />
        </div>
      )}
      {ecarts.length > 0 && <p className="mt-2 text-xs text-warn">{ecarts.join(' · ')}</p>}
    </section>
  );
}
