// Tests de rendu — Ressources (Bestiaire, Mécaniques, Nouveautés), Paramètres
// et « Bientôt disponible ». Principe dans tests/rendu/outils-rendu.tsx : on
// vérifie que chaque fonctionnalité et chaque information sont présentes,
// jamais l'apparence. Écrits AVANT le lot 10 de la refonte graphique
// (`spec/chantiers/refonte-graphique.md` § B.5 à B.10) : ils doivent rester
// verts sans qu'une assertion change.
//
// ⚠️ Aucun chiffre qui bouge avec les données : le nombre de monstres suit
// `monsters.json`, les versions suivent `data/releases.ts`. Les attendus en
// sont DÉDUITS, pas recopiés.

import { Trophy } from 'lucide-react';
import BestiaryPage from '../../src/pages/BestiaryPage';
import MechanicsPage from '../../src/pages/MechanicsPage';
import ReleasesPage from '../../src/pages/ReleasesPage';
import SettingsPage from '../../src/pages/SettingsPage';
import ComingSoon from '../../src/pages/ComingSoon';
import { RELEASES, libelleVersion } from '../../src/data/releases';
import { sansDoublonDeCollab, sansDoublonDeTransformation } from '../../src/lib/monsterForms';
import type { Monster } from '../../src/types';
import { egal, faussLocalStorage, monstersJson, ok, titre } from '../outils';
import { boutons, rendre, texteVisible, valeurs } from './outils-rendu';

const MONSTRES = monstersJson() as Monster[];
const rien = () => {};

const rendreBestiaire = () => {
  faussLocalStorage({});
  return rendre(<BestiaryPage monsters={MONSTRES} loadState="live" menuOuvert={false} onFermerMenu={rien} />);
};
const rendreParametres = (compte: string | null) => {
  faussLocalStorage({});
  return rendre(
    <SettingsPage onClearData={rien} onKeepAccount={rien} onImport={rien} accountExportedAt={null} accountName={compte} />,
  );
};

export function testRenduBestiaire() {
  titre('rendu · Bestiaire');
  const html = rendreBestiaire();
  const t = texteVisible(html);
  const b = boutons(html);
  ok(valeurs(html, 'placeholder').includes('Rechercher un monstre par nom…'), 'la recherche par nom');
  // ⚠️ Lot 10 : « contient » au lieu de « commence par » — l'en-tête
  // « Bestiaire » précède désormais les filtres ; leur suite, tri compris, ne
  // change pas.
  ok(t.includes('Élément Feu Eau Vent Lumière Ténèbres Autre Étoiles 1★ 2★ 3★ 4★ 5★ 6★ Tri interne'), 'les filtres : élément, étoiles, tri');
  for (const f of ['Feu', 'Eau', 'Vent', 'Lumière', 'Ténèbres', 'Autre', '1★', '2★', '3★', '4★', '5★', '6★'])
    ok(b.some((x) => x.texte === f), `filtre « ${f} »`);
  ok(t.includes('Tri interne Étoiles ↓ puis nom Étoiles ↑ puis nom Nom (A→Z)'), 'les trois tris');
  // Le total de référence, dédupliqué comme l'écran le fait.
  const total = sansDoublonDeCollab(sansDoublonDeTransformation(MONSTRES)).length;
  const pages = Math.ceil(total / 60);
  ok(t.includes(`${total} monstres / ${pages}`), 'le compte, puis la pagination');
  egal(b.filter((x) => x.ariaLabel === 'Page suivante').length, 2, 'pagination en haut et en bas');
  ok(b.some((x) => x.ariaLabel === 'Page précédente' && x.desactive), 'pas de page précédente sur la première');
  ok(valeurs(html, 'aria-label').includes('Aller à la page'), 'saisie directe du numéro de page');
  ok(t.includes('Feu 60 monstres'), 'la première page groupe par élément, avec son compte');
  ok(valeurs(html, 'title').includes('Voir la fiche de Bellenus'), 'chaque carte ouvre la fiche du monstre');
  ok(t.includes('Aragorn, Night Fang'), 'une carte de collaboration porte ses deux noms');
}

export function testRenduMecaniques() {
  titre('rendu · Mécaniques');
  const html = rendre(<MechanicsPage />);
  const t = texteVisible(html);
  const b = boutons(html);
  ok(t.startsWith('Mécaniques du jeu Les formules qui régissent Summoners War'), 'le titre et l\'introduction');
  ok(t.includes('Ce sont des modèles communautaires (prédictifs, pas le code du jeu) — très précis mais indicatifs.'), 'la réserve sur les modèles');
  const sommaire = ['Vitesse de combat', 'Barre d’action & ordre de tour', 'Équation finale des dégâts', 'Facteur de défense', 'Coups critiques', 'Variance', 'Cas particuliers'];
  egal(b.map((x) => x.texte), sommaire, 'le sommaire, une entrée cliquable par section');
  for (const f of [
    'Vitesse = ⌈ Base × (1 + Σ%vitesse) + Σvitesse_plate ⌉ × Slow × BuffVit',
    'ΔATB par tick = Vitesse_combat × 7 / 100',
    'Dégâts = ( Mult × Crit × DMG% × FacteurDéf × Variance + Additionnel ) × Réductions',
    'FacteurDéf = 1000 / (1140 + 3.5 × DEF)',
    'Mise à l’échelle sur stats : ±2.8 % → [0.972 , 1.028]',
  ]) ok(t.includes(f), `formule « ${f.slice(0, 40)}… »`);
  ok(t.endsWith('Ces effets ne sont pas modélisés dans SW Forge (qui se concentre sur la vitesse, les ticks et les runes).'), 'ce qui n\'est pas modélisé');
}

export function testRenduNouveautes() {
  titre('rendu · Nouveautés');
  const html = rendre(<ReleasesPage />);
  const t = texteVisible(html);
  const liens = valeurs(html, 'href');
  ok(t.startsWith('Nouveautés Ce qui a changé à chaque version de SW Forge. La version en cours est rappelée en bas de chaque page. Voir les releases sur GitHub'), 'le titre, l\'introduction, le lien GitHub');
  ok(liens.includes('https://github.com/tototriou/sw-forge/releases'), 'le lien vers toutes les releases');
  for (const r of RELEASES) ok(t.includes(`${libelleVersion(r.version)}`) && t.includes(r.title), `version ${libelleVersion(r.version)} : numéro et titre`);
  const enTete = RELEASES[0];
  if (enTete.version === null) ok(t.includes('En préparation Pas encore publiée'), 'la version en préparation, dite non publiée');
  else ok(t.includes('Version actuelle'), 'la version en tête, dite actuelle');
  const taguees = RELEASES.filter((r) => r.tag !== false && r.version !== null);
  egal(valeurs(html, 'title').filter((x) => x.startsWith('Release v')).length, taguees.length, 'un lien GitHub par version taguée, et seulement celles-là');
  ok(t.includes('Nouveau') && t.includes('Correction'), 'la nature de chaque changement');
}

export function testRenduParametres() {
  titre('rendu · Paramètres');
  const vide = rendreParametres(null);
  const avec = rendreParametres('Tototriou');
  const t = texteVisible(vide);
  const b = boutons(vide);
  // ⚠️ Lot 10 : « contient » au lieu de « commence par » — le titre
  // « Paramètres » précède désormais l'introduction ; la suite ne change pas.
  ok(t.includes('Ces réglages valent pour toute l\'application et restent sur cet appareil. Compte Aucun compte chargé Importer un JSON'), 'sans compte : « Aucun compte chargé », et l\'import');
  ok(texteVisible(avec).includes('Compte chargé Tototriou Importer un JSON'), 'avec un compte : son nom');
  ok(b.some((x) => x.texte === 'Importer un JSON' && x.title === 'Importer un export de compte SWEX (traité localement, rien n\'est envoyé)'), '« Importer un JSON », et ce qu\'il devient');
  for (const [texte, info, presse] of [
    ['Auto', 'Suit le thème de ton navigateur', true],
    // Rebranding R1 : « encre froide » et « accent cuivre » décrivaient
    // l'ancienne identité.
    ['Clair', 'Atelier — fond clair, encre chaude', false],
    ['Sombre', 'Forge — fond profond, accent braise', false],
    ['Efficience', 'Efficience communautaire (principale incluse, /2,8)', true],
    ['Score SW', 'Score affiché dans le jeu (stats secondaires uniquement)', false],
  ] as const) ok(b.some((x) => x.texte === texte && x.title === info && x.presse === presse), `« ${texte} », ce qu'il fait, son état`);
  const aria = valeurs(vide, 'aria-label');
  for (const i of ['Afficher le total au-delà de 100 % pour Taux Crit, RES et Précision', 'Toujours ajouter en face mon monstre le plus rapide', 'Garder mes données sur cet appareil'])
    ok(aria.includes(i), `interrupteur « ${i} »`);
  for (const intitule of ['Thème', 'Score', 'Overcap Taux Crit/RES/Précision', 'Adversaire de référence (speed tuning)', 'Garder mes données', 'Mes données'])
    ok(t.includes(intitule), `réglage « ${intitule} »`);
  ok(t.includes('Ces trois stats sont plafonnées à 100 % dans le jeu.') && t.includes('Sans ce réglage, il n\'est posé que si personne n\'est en face.') && t.includes('à éviter sur un ordinateur partagé.'), 'chaque réglage expliqué');
  ok(b.some((x) => x.texte === 'Tout supprimer' && x.title === 'Efface la prépa RTA, les équipes de siège, les recommandations, les monstres perso et le compte importé'), '« Tout supprimer », et ce qu\'il efface');
}

export function testRenduBientot() {
  titre('rendu · Bientôt disponible');
  const t = texteVisible(rendre(<ComingSoon title="Arène" icon={Trophy} description="Préparation des équipes d'arène classique (offense et défense)." />));
  egal(t, 'Bientôt disponible Cet outil est en cours de construction.', 'le message d\'attente');
}
