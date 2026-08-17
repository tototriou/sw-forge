import { useState } from 'react';
import { ConfirmDialog, Modale } from '../ui/Dialogs';
import { Plus, X, Wand2 } from 'lucide-react';
import { ELEMENTS, ElementKey, Monster } from '../types';
import { CustomLead } from '../hooks/useCustomMonsters';
import ElementIcon from './ElementIcon';
import NumberField from '../ui/NumberField';
import { Bouton, BoutonIcone, Champ, Selecteur } from '../ui';

const ELEMENT_CHOICES = ELEMENTS.filter((e) => e.key !== 'unknown');

// Types de leader skill (valeurs = libellés SWARFARM).
const LEAD_STATS = [
  { value: 'Attack Speed', label: 'Vitesse' },
  { value: 'Attack Power', label: 'Attaque' },
  { value: 'HP', label: 'PV' },
  { value: 'Defense', label: 'Défense' },
  { value: 'Critical Rate', label: 'Taux crit' },
  { value: 'Critical DMG', label: 'Dégâts crit' },
  { value: 'Accuracy', label: 'Précision' },
  { value: 'Resistance', label: 'Résistance' },
];

interface Props {
  onCreate: (name: string, element: ElementKey, speed: number, lead: CustomLead | null) => void;
  customMonsters: Monster[];
  onDelete: (id: string) => void;
}

// Bouton + formulaire pour créer un monstre perso (nom, élément, SPD de base).
export default function CreateMonster({ onCreate, customMonsters, onDelete }: Props) {
  // ⚠️ La suppression d'un monstre créé à la main demande une CONFIRMATION : il
  // n'existe nulle part ailleurs. Contrairement à un monstre du jeu, qu'on
  // retrouve dans les données, celui-ci part avec son nom, son élément et sa
  // vitesse — il faut le ressaisir en entier.
  const [suppressionAConfirmer, setSuppressionAConfirmer] = useState<
    { id: string; nom: string } | null
  >(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [element, setElement] = useState<ElementKey>('fire');
  const [speed, setSpeed] = useState('');
  const [leadStat, setLeadStat] = useState('');
  const [lead, setLead] = useState('');
  const [scope, setScope] = useState<'General' | 'Element'>('General');
  // ⚠️ **Trente lignes retirées ici** en passant à `Modale` : deux refs, un hook
  // de recalage à l'écran, et un écouteur de clic extérieur doublé d'un écouteur
  // d'Échap. Tout cela servait à rattraper une popup ancrée qui sortait de
  // l'écran ou se faisait clipper par le panneau d'où elle sortait. Une modale
  // ne s'ancre à rien : elle porte déjà sa fermeture au clic extérieur, à Échap,
  // son piège à focus et son blocage du défilement.

  const speedNum = Number(speed);
  const valid = name.trim().length > 0 && speed !== '' && Number.isFinite(speedNum) && speedNum > 0;

  function submit() {
    if (!valid) return;
    const leadNum = Number(lead);
    const leadObj: CustomLead | null =
      leadStat !== '' && lead !== '' && Number.isFinite(leadNum) && leadNum > 0
        ? { stat: leadStat, amount: leadNum, area: scope }
        : null;
    // ⚠️ Le nom TRIMÉ : la validation portait déjà sur `name.trim()`, mais on
    // stockait le brut — un monstre pouvait s'appeler « Chloé  », impossible à
    // distinguer de « Chloé » à l'écran et pourtant différent partout ailleurs.
    onCreate(name.trim(), element, speedNum, leadObj);
    setName('');
    setSpeed('');
    setLeadStat('');
    setLead('');
  }

  // ⚠️ **Un seul formulaire pour les deux contenants.** Il était écrit DEUX
  // FOIS, une fois dans le panneau mobile et une fois dans la popup de bureau —
  // quarante lignes identiques, et le genre de duplication qui ne se voit pas :
  // on ne teste jamais les deux largeurs à la fois, donc un champ ajouté d'un
  // côté manque de l'autre sans que rien ne le signale. Même trajet que le
  // formulaire de catégorie (voir CategoryBar).
  const formulaire = (
    <>
      <Champ
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nom du monstre"
        className="mb-2 compact:py-2.5"
      />

      <div className="mb-2.5 flex gap-2">
        <Selecteur
          value={element}
          onChange={(e) => setElement(e.target.value as ElementKey)}
          pleineLargeur={false}
          className="flex-1 compact:py-2.5 compact:text-base"
        >
          {ELEMENT_CHOICES.map((el) => (
            <option key={el.key} value={el.key}>
              {el.label}
            </option>
          ))}
        </Selecteur>
        {/* La valeur est stockée en TEXTE ici (champ libre du formulaire) :
            on convertit aux bornes du composant. */}
        <NumberField
          value={speed === '' ? null : Number(speed)}
          allowEmpty
          min={0}
          width="w-16"
          placeholder="SPD"
          ariaLabel="Vitesse de base"
          onChange={(v) => setSpeed(v == null ? '' : String(v))}
        />
      </div>

      {/* Lead (optionnel). Affiché en Siège ; seul un lead de vitesse alimente le tick. */}
      <Selecteur
        value={leadStat}
        onChange={(e) => setLeadStat(e.target.value)}
        title="Type de lead (optionnel)"
        className="mb-2.5"
      >
        <option value="">Lead : aucun</option>
        {LEAD_STATS.map((s) => (
          <option key={s.value} value={s.value}>
            Lead {s.label}
          </option>
        ))}
      </Selecteur>

      {leadStat !== '' && (
        <div className="mb-2.5 flex gap-2">
          <NumberField
            value={lead === '' ? null : Number(lead)}
            allowEmpty
            min={0}
            max={100}
            width="w-14"
            placeholder="%"
            ariaLabel="Valeur du lead en %"
            onChange={(v) => setLead(v == null ? '' : String(v))}
          />
          <Selecteur
            value={scope}
            onChange={(e) => setScope(e.target.value as 'General' | 'Element')}
            title="Portée du lead"
            pleineLargeur={false}
            className="flex-1"
          >
            <option value="General">Toutes cibles</option>
            <option value="Element">Même élément</option>
          </Selecteur>
        </div>
      )}

    </>
  );

  // ⚠️ L'action vit dans le PIED de la modale, pas au bout du formulaire : la
  // liste des monstres perso s'affiche en dessous, et « Créer » s'y retrouvait
  // au milieu du contenu — au-dessus d'une liste de dix monstres, on ne le
  // trouvait plus.
  // ⚠️ **PAS de `pleineLargeur`** : le pied taque ses boutons à DROITE, et un
  // bouton étiré occupe toute la largeur — il ne peut donc plus l'être. La
  // pleine largeur revient d'elle-même sous `sm`, où le pied s'empile.
  const actionCreer = (
    <Bouton
      onClick={submit}
      disabled={!valid}
      ton="accent"
      fond="doux"
      trait="aucun"
      icone={<Plus size={14} />}
      libelle="Créer"
    />
  );

  // Liste des monstres déjà créés, partagée elle aussi par les deux contenants.
  const listePerso = customMonsters.length > 0 && (
    <div className="mt-3 border-t border-border pt-2.5">
      <span className="label">Mes monstres perso</span>
      <ul className="mt-1.5 flex max-h-40 flex-col gap-1 overflow-y-auto">
        {customMonsters.map((m) => (
          <li key={m.id} className="flex items-center gap-2 text-xs">
            <ElementIcon element={m.element} size={15} className="flex-none" />
            <span className="flex-1 truncate">{m.name}</span>
            <span className="font-mono text-ink-dim">SPD {m.stats.speed ?? '—'}</span>
            <BoutonIcone
              onClick={() => setSuppressionAConfirmer({ id: String(m.id), nom: m.name })}
              libelle={`Supprimer ${m.name}`}
              taille="serre"
              ton="danger"
              icone={<X size={13} />}
            />
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    // ⚠️ Plus de `<div className="relative">` : il ancrait la popup, qui n'existe
    // plus. Une modale se pose par rapport à l'ÉCRAN, et un conteneur inutile
    // dans une grille d'actions y occupe une cellule pour rien.
    <>
      {/* ⚠️ Même gabarit (`taille="md"`) que les autres boutons d'action de RTA
          et du siège : ils se retrouvent côte à côte dans le panneau mobile, et
          celui-ci y paraissait rabougri à côté d'eux.
          ⚠️ Deux longueurs : dans le panneau mobile ce bouton occupe une cellule
          d'un tiers de 348 px, où « Créer un monstre » passe à la ligne.
          `aria-label` et l'infobulle portent la phrase entière. */}
      <Bouton
        onClick={() => setOpen((o) => !o)}
        aria-label="Créer un monstre"
        title="Créer un monstre qui n'existe pas dans les données chargées"
        icone={<Wand2 size={15} />}
        libelle="Créer un monstre"
        libelleCourt="Monstre"
      />

      {/* ⚠️ **Une MODALE, et la même aux deux formats.** Ce formulaire vivait
          dans deux contenants distincts — un panneau montant au doigt, une popup
          ancrée à la souris — avec deux en-têtes différents et aucune des deux
          grammaires de l'app.
          La popup ancrée était de surcroît le mauvais objet : posée en
          `absolute` dans le flux, elle se retrouvait CLIPPÉE dès qu'on ouvrait
          le formulaire depuis le panneau « Options », qui défile — on n'en
          voyait qu'une bande. Il avait fallu un hook de recalage pour la
          rattraper à la mesure.
          Une modale ne s'ancre à rien : elle se pose au centre de l'ÉCRAN, hors
          du flux de la page. Le problème disparaît au lieu d'être corrigé, et
          les deux formats reçoivent le même objet — titre à gauche, croix à
          droite, actions en bas. */}
      {open && (
        <Modale
          onClose={() => setOpen(false)}
          labelledBy="creer-monstre-titre"
          titre="Nouveau monstre"
          largeur="max-w-[340px]"
          croix
          actions={actionCreer}
        >
          {formulaire}
          {listePerso}
        </Modale>
      )}

      {/* ⚠️ Hors des deux blocs conditionnels : le même dialogue sert la popup
          de bureau ET le panneau mobile, qui affichent chacun leur liste. */}
      {suppressionAConfirmer && (
        <ConfirmDialog
          titre={`Supprimer ${suppressionAConfirmer.nom} ?`}
          message="Ce monstre a été créé à la main : il n'existe pas dans les données du jeu et devra être ressaisi en entier. Les équipes qui l'utilisaient perdent leur emplacement."
          libelleAction="Supprimer"
          destructif
          onCancel={() => setSuppressionAConfirmer(null)}
          onConfirm={() => {
            onDelete(suppressionAConfirmer.id);
            setSuppressionAConfirmer(null);
          }}
        />
      )}
    </>
  );
}
