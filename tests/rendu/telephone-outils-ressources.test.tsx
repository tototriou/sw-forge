// Tests de rendu AU TÉLÉPHONE — Speed tuning, Ressources (Bestiaire,
// Mécaniques, Nouveautés), Paramètres, Bientôt (lot 11d de la refonte
// graphique, `spec/chantiers/refonte-graphique.md` § B.11). Principe dans
// tests/rendu/outils-rendu.tsx ; rendu téléphone par `auTelephone`. Écrits
// AVANT le 11d : ils doivent rester verts sans qu'une assertion change.

import { Trophy } from 'lucide-react';
import SpeedTuningSection from '../../src/components/outils/SpeedTuningSection';
import BestiaryPage from '../../src/pages/BestiaryPage';
import MechanicsPage from '../../src/pages/MechanicsPage';
import ReleasesPage from '../../src/pages/ReleasesPage';
import SettingsPage from '../../src/pages/SettingsPage';
import ComingSoon from '../../src/pages/ComingSoon';
import type { Monster } from '../../src/types';
import { egal, faussLocalStorage, monstersJson, ok, titre } from '../outils';
import { auTelephone, boutons, rendre, texteVisible, valeurs } from './outils-rendu';

const MONSTRES = monstersJson() as Monster[];
const rien = () => {};

const dialogues = (html: string) => (html.match(/role="dialog"/g) ?? []).length;

export function testRenduTelephoneOutilsRessources() {
  titre('rendu téléphone · Speed tuning, Ressources, Paramètres, Bientôt');
  const speed = auTelephone(() => {
    faussLocalStorage({});
    return rendre(<SpeedTuningSection allMonsters={MONSTRES} siegeDefenseTeams={[]} siegeOffenseTeams={[]} />);
  });
  const ts = texteVisible(speed);
  ok(ts.startsWith('Speed tuning À chaque tick, la barre d\'action monte de vitesse × 7 %'), 'Speed tuning : titre et règle');
  ok(ts.includes('repère de speed tune 3 477 4 358 5 286 6 239'), 'Speed tuning : le repère des ticks');
  ok(valeurs(speed, 'aria-label').includes('Lead de vitesse — Ton équipe') && valeurs(speed, 'aria-label').includes('Lead de vitesse — En face'), 'Speed tuning : les deux camps et leur lead');
  ok(ts.endsWith('Ajoute au moins un monstre pour visualiser le remplissage des barres et l\'ordre de tour.'), 'Speed tuning : ce qu\'il faut faire');

  const best = auTelephone(() => {
    faussLocalStorage({});
    return rendre(<BestiaryPage monsters={MONSTRES} loadState="live" menuOuvert onFermerMenu={rien} />);
  });
  const tb = texteVisible(best);
  egal(dialogues(best), 1, 'Bestiaire : un panneau « Options »');
  ok(valeurs(best, 'aria-label').includes('Filtrer le bestiaire'), 'Bestiaire : le panneau « Filtrer le bestiaire »');
  ok(tb.includes('Filtrer le bestiaire Élément Feu Eau Vent Lumière Ténèbres Autre Étoiles 1★ 2★ 3★ 4★ 5★ 6★ Tri interne Étoiles ↓ puis nom'), 'Bestiaire : ses filtres et le tri');
  ok(valeurs(best, 'placeholder').includes('Rechercher un monstre par nom…'), 'Bestiaire : la recherche sur la page');
  ok(tb.includes('Feu 60 monstres'), 'Bestiaire : la grille par élément');

  const meca = texteVisible(auTelephone(() => rendre(<MechanicsPage />)));
  ok(meca.includes('Sommaire Vitesse de combat Barre d’action & ordre de tour'), 'Mécaniques : le sommaire');
  const nouv = texteVisible(auTelephone(() => rendre(<ReleasesPage />)));
  ok(nouv.startsWith('Nouveautés Ce qui a changé à chaque version de SW Blacksmith.') && nouv.includes('Voir les releases sur GitHub'), 'Nouveautés : titre, introduction, lien');

  const param = auTelephone(() => {
    faussLocalStorage({});
    return rendre(<SettingsPage onClearData={rien} onKeepAccount={rien} onImport={rien} accountExportedAt={null} accountName="Tototriou" />);
  });
  const tp = texteVisible(param);
  ok(tp.includes('Compte chargé Tototriou Importer un JSON'), 'Paramètres : le compte et l\'import');
  ok(tp.includes('Thème Auto Clair Sombre') && tp.includes('Mes données Garder mes données') && tp.endsWith('Mes données Tout supprimer'), 'Paramètres : réglages, puis données, jusqu\'à « Tout supprimer »');
  egal(boutons(param).length, 10, 'Paramètres : les dix boutons');

  egal(texteVisible(auTelephone(() => rendre(<ComingSoon title="Arène" icon={Trophy} />))), 'Bientôt disponible Cet outil est en cours de construction.', 'Bientôt : le message');
}
