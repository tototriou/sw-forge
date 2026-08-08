# Données monstres & monstres perso (transverse)

Comment les monstres arrivent dans l'app, leur modèle, et les monstres créés à
la main.

## Modèle `Monster`

Défini dans [types.ts](src/types.ts).

```ts
interface Monster {
  id: number | string;      // string "custom-…" pour un monstre perso
  com2usId: number | null;  // = unit_master_id des exports SWEX (clé d'import)
  name: string;
  element: ElementKey;      // fire | water | wind | light | dark | unknown
  stars: number | null;        // grade obtenable (base_stars) — utilisé par le Bestiaire
  naturalStars: number | null; // rareté naturelle réelle (nat 1..5), SWARFARM natural_stars
  secondAwaken: boolean;       // monstre à second éveil (awaken_level ≥ 2)
  image: string | null;
  stats: MonsterStats;      // hp, attack, defense, speed, critRate, critDamage, resistance, accuracy
  leaderSkill: LeaderSkill | null;
}

interface LeaderSkill {
  stat: string | null;     // ex. "Attack Speed", "Attack Power"…
  amount: number;          // en %
  area: string;            // General | Element | Arena | Guild | Dungeon
  element: ElementKey | null; // null => toutes cibles
}
```

`stats.speed` = **SPD de base**, fixe dans SW ; c'est LA valeur réutilisée par
RTA et Siège.

## Origine des données (SWARFARM)

- Récupérées côté CI (Node, pas de navigateur → **pas de CORS**) par
  [fetch-monsters.mjs](scripts/fetch-monsters.mjs) depuis l'API SWARFARM
  (`/api/v2/monsters/`), paginée.
- Écrites dans `public/data/monsters.json` (`{ meta, monsters }`). Le chemin de
  sortie passe par `fileURLToPath` : sous **Windows**, `URL.pathname` donne
  `/C:/…` et `mkdir` fabriquait un `C:\C:\…` — le script se lance donc aussi en
  local, pas seulement en CI Linux.
- **Fallback démo** : si l'API échoue, un jeu de démo déterministe est généré
  (labellisé `source: 'demo'`) pour que le site reste déployable et testable.
- Rafraîchissement planifié via GitHub Actions (cron hebdo + manuel) → commit du
  JSON → redéploiement Vercel.

Normalisations notables dans le script :
- ⚠️ **PV / ATQ / DEF = `max_lvl_*`**, c'est-à-dire les stats du monstre **6★
  niveau max, nu**. Le champ `base_*` de SWARFARM est la valeur au **grade
  d'invocation** et **ne doit pas** être utilisé : ex. Trevor (nat 4, base 5) →
  `base_hp` 7 380 (en 5★) contre `max_lvl_hp` **10 050** (en 6★). Pour un
  monstre déjà base★6 (Bella, Leo), les deux champs sont identiques. Ces valeurs
  **coïncident avec le `con × 15`** lu dans les exports SWEX, ce qui rend les
  deux sources cohérentes (indispensable pour les stats recommandées du siège,
  voir [siege/recommandations.md](../siege/recommandations.md)).
- **VIT / taux crit / dégâts crit / RES / précision** ne dépendent ni du niveau
  ni des étoiles dans SW : les champs directs font foi.
- `element` mappé vers les 5 éléments (sinon `unknown`).
- `com2usId` extrait de `com2us_id` (clé de jointure avec les exports de compte).
- `leaderSkill.element = null` s'il n'y a pas d'élément (→ toutes cibles).
- `stars` = `base_stars` (grade obtenable) ; **`naturalStars` = `natural_stars`**
  (vraie rareté naturelle, distincte : ex. Racuni base_stars 4 mais nat 3, Tractor
  2A base_stars 6 mais nat 3) ; `secondAwaken` = `awaken_level ≥ 2`. Ces deux
  derniers alimentent les filtres **Nat** et **2A** de la box « Mon compte ».

## Chargement côté app

[useMonsters.ts](src/hooks/useMonsters.ts) : `fetch` de
`public/data/monsters.json` (même origine, `cache: 'no-store'`). Expose
`monsters`, `loadState` (`loading | live | demo | error`), `generatedAt`.

## Monstres perso (créés à la main)

Les tout derniers monstres sortis peuvent manquer dans SWARFARM. L'utilisateur
peut donc **créer un monstre** utilisable comme les autres, en **RTA et en Siège**.

- Hook : [useCustomMonsters.ts](src/hooks/useCustomMonsters.ts) — persiste dans
  `localStorage` (`sw-forge-custom-monsters-v1`), fusionné aux monstres officiels
  dans [App.tsx](src/App.tsx) (`allMonsters`).
- Formulaire : [CreateMonster.tsx](src/components/CreateMonster.tsx). Son bouton
  déclencheur suit le **gabarit commun** des boutons d'action (`px-3.5 py-2`,
  13 px, icône 15), pour ne pas détonner à côté de ceux de RTA et du siège.
  - Champs : **nom**, **élément**, **SPD base** (obligatoires) ; **lead optionnel**.
  - Lead : n'importe quel type de stat (Vitesse/Attaque/PV/Déf/crit/Précision/
    Résistance) + montant % + portée (Toutes cibles = `General` / Même élément =
    `Element`). Seul un lead **Vitesse** alimente le tick en siège ; les autres
    sont affichés à titre indicatif.
  - La popup se ferme au clic extérieur ou sur `Échap`.
  - Liste « Mes monstres perso » avec suppression.
- Un monstre perso a `id = "custom-…"`, `com2usId = null`, images/stats
  secondaires à `null` (seule `speed` est renseignée).
- **Disclaimer** affiché sur RTA et Siège : « Les tout derniers monstres sortis
  peuvent manquer dans les données — crée-les à la main. »

## Distinction d'affichage

- **Bestiaire** : monstres **officiels uniquement** ; filtre étoiles sur `stars`
  (grade obtenable).
- **RTA / Siège** : officiels **+** perso (`allMonsters`).
- **Mon compte** (box) : monstres du compte importé (6★) ; filtres sur
  `naturalStars` (Nat) et `secondAwaken` (2A).
