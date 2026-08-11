import { ReactNode } from 'react';

// Doc de mécaniques de jeu (Summoners War). Formules issues des modèles
// communautaires (swcalc.cz, swarfarm) — valeurs prédictives, pas le code source.

const TOC: { id: string; label: string }[] = [
  { id: 'vitesse', label: 'Vitesse de combat' },
  { id: 'atb', label: 'Barre d’action & ordre de tour' },
  { id: 'degats', label: 'Équation finale des dégâts' },
  { id: 'defense', label: 'Facteur de défense' },
  { id: 'crit', label: 'Coups critiques' },
  { id: 'variance', label: 'Variance' },
  { id: 'specifiques', label: 'Cas particuliers' },
];

function goTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 rounded-2xl border border-border bg-panel/50 p-5">
      <h2 className="font-display text-[22px] tracking-wide mb-3">{title}</h2>
      <div className="space-y-3 text-[14px] leading-relaxed text-ink-dim">{children}</div>
    </section>
  );
}

// Bloc de formule (mono, défilable en X sur mobile).
function F({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-panel2 px-3.5 py-2.5">
      <code className="font-mono text-[13px] text-ink whitespace-pre">{children}</code>
    </div>
  );
}

// Terme mis en avant dans le texte.
function K({ children }: { children: ReactNode }) {
  return <span className="font-mono text-[12.5px] text-ink">{children}</span>;
}

export default function MechanicsPage() {
  return (
    <div className="mt-4">
      <header>
        <h1 className="font-display font-black text-[clamp(28px,4vw,42px)] title-gradient mb-1.5">
          Mécaniques du jeu
        </h1>
        <p className="text-ink-dim text-[14.5px] leading-relaxed max-w-2xl">
          Les formules qui régissent Summoners War : vitesse et ordre de tour, et l&apos;équation
          complète des dégâts. Ce sont des <b className="text-ink">modèles communautaires</b>
          (prédictifs, pas le code du jeu) — très précis mais indicatifs.
        </p>
      </header>

      {/* Sommaire */}
      <nav className="mt-5 rounded-2xl border border-border bg-panel p-4">
        <div className="label mb-2">
          Sommaire
        </div>
        <ol className="grid sm:grid-cols-2 gap-x-6 gap-y-1 list-decimal list-inside">
          {TOC.map((t) => (
            <li key={t.id} className="text-[13.5px] text-ink-dim">
              <button onClick={() => goTo(t.id)} className="text-left hoverable:text-ink transition">
                {t.label}
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <div className="mt-5 flex flex-col gap-4">
        <Section id="vitesse" title="Vitesse de combat">
          <p>
            La vitesse effective d&apos;un monstre en combat se calcule à partir de sa vitesse de
            base, des bonus en pourcentage (additifs entre eux) et des bonus plats :
          </p>
          <F>{'Vitesse = ⌈ Base × (1 + Σ%vitesse) + Σvitesse_plate ⌉ × Slow × BuffVit'}</F>
          <ul className="list-disc list-inside space-y-1">
            <li>
              <K>Σ%vitesse</K> = totem de guilde (+15 %) + lead + autres effets % (additifs).
            </li>
            <li>
              <K>Σvitesse_plate</K> = vitesse des runes (+ artefacts / autres bonus plats).
            </li>
            <li>
              <K>BuffVit</K> : buff de vitesse d&apos;attaque = <K>⌊30 × (1 + effet/100)⌋</K> % (la
              potence est tronquée vers le bas), appliqué en <K>× (1 + buff%/100)</K>.
            </li>
            <li>
              <K>Slow</K> = 0,7 si le monstre est ralenti, sinon 1.
            </li>
          </ul>
          <p className="text-[13px]">
            La vitesse ne dépend pas du niveau ni des étoiles : elle est fixe par monstre.
          </p>
        </Section>

        <Section id="atb" title="Barre d'action & ordre de tour">
          <p>
            À chaque « tick » d&apos;horloge, la barre d&apos;action (ATB) de chaque monstre monte
            de <b className="text-ink">7 % de sa vitesse de combat</b> :
          </p>
          <F>{'ΔATB par tick = Vitesse_combat × 7 / 100'}</F>
          <ul className="list-disc list-inside space-y-1">
            <li>Un monstre agit dès que sa barre d&apos;action atteint 100.</li>
            <li>En cas d&apos;égalité de barre, le plus rapide passe ; à vitesse égale, l&apos;ordre suit la séquence de placement.</li>
            <li>
              Plus la vitesse est haute, plus la barre se remplit vite → c&apos;est toute la logique
              du « speed tuning » : atteindre un <b className="text-ink">tick</b> précis pour passer
              avant/après une cible.
            </li>
          </ul>
        </Section>

        <Section id="degats" title="Équation finale des dégâts">
          <p>L&apos;ordre de calcul complet d&apos;un coup :</p>
          <F>{'Dégâts = ( Mult × Crit × DMG% × FacteurDéf × Variance + Additionnel ) × Réductions'}</F>
          <ul className="list-disc list-inside space-y-1.5">
            <li>
              <b className="text-ink">Mult</b> — mise à l&apos;échelle de base : Σ (stat × coefficient
              de la compétence) sur ATQ / DEF / PV / VIT. Les buffs multiplient la stat (ATQ ×1,5 ;
              DEF ×1,7).
            </li>
            <li>
              <b className="text-ink">Crit</b> — terme de dégâts critiques (voir plus bas) :
              <F>{'Crit = 1 + skillups + DMGcrit_runes + DMGcrit_arti + bonus − DMGcrit_subie'}</F>
            </li>
            <li>
              <b className="text-ink">DMG%</b> — bonus multiplicatif :
              <F>{'DMG% = 1 + dégâts_élément(arti) + co-op + autres'}</F>
            </li>
            <li>
              <b className="text-ink">FacteurDéf</b> — mitigation par la défense (voir section dédiée).
            </li>
            <li>
              <b className="text-ink">Variance</b> — aléa par coup (voir section dédiée).
            </li>
            <li>
              <b className="text-ink">Additionnel</b> — dégâts fixes / dégâts en % d&apos;une stat.
              Les dégâts fixes suivent DMG% mais <b className="text-ink">ne peuvent pas crit</b> :
              <F>{'Additionnel = Σ [ stat × fixe × (1 + DMG%) + stat × add_stat ]'}</F>
            </li>
            <li>
              <b className="text-ink">Réductions</b> — en toute fin : réductions additives (artefacts,
              passifs, − Mirinae/Branding) puis multiplicatives (reflect, Camilla S3…). Les passifs de
              réduction <b className="text-ink">ne se cumulent pas</b> (seul le plus fort s&apos;applique).
            </li>
          </ul>
        </Section>

        <Section id="defense" title="Facteur de défense">
          <p>La défense de la cible réduit les dégâts selon :</p>
          <F>{'FacteurDéf = 1000 / (1140 + 3.5 × DEF)'}</F>
          <F>{'DEF = Défense × (1 − Ignore%) × Dbreak      Dbreak = 0.3 si def break, sinon 1'}</F>
          <ul className="list-disc list-inside space-y-1">
            <li>L&apos;ignore défense réduit la DEF effective mais n&apos;annule pas le plancher de la formule.</li>
            <li>À DEF = 0, le facteur vaut ~0,877 (pas 1,0) — même sans défense, il reste une légère mitigation.</li>
          </ul>
        </Section>

        <Section id="crit" title="Coups critiques">
          <p>
            Un coup critique multiplie les dégâts par le terme <K>Crit</K>. Le taux de crit (chance)
            et les dégâts crit (multiplicateur) sont deux choses distinctes :
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li><b className="text-ink">Taux crit</b> : probabilité de déclencher un crit (base + runes + lead + buffs).</li>
            <li>
              <b className="text-ink">Dégâts crit</b> : somme additive de toutes les sources (skillups,
              runes, artefacts, bonus) moins les dégâts crit encaissés réduits par la cible.
            </li>
            <li>Un coup <b className="text-ink">glancing</b> (voir élément) ne peut pas être critique.</li>
          </ul>
        </Section>

        <Section id="variance" title="Variance">
          <p>Chaque coup applique un aléa (distribution triangulaire), indépendant par « bucket » :</p>
          <F>{'Mise à l’échelle sur stats : ±2.8 %   → [0.972 , 1.028]'}</F>
          <F>{'Mise à l’échelle sur PV max : ±2.35 %  → [0.9765 , 1.0235]'}</F>
        </Section>

        <Section id="specifiques" title="Cas particuliers">
          <p>
            Beaucoup de monstres ont des mécaniques propres liées à la vitesse ou à la défense, par ex. :
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>Ignore défense conditionné à un écart de vitesse (Rigna, Birgitta, Tirsa, Agrius…).</li>
            <li>Bonus paliers de vitesse (Sonia à +50, Leah à +150…).</li>
            <li>Vol de stats basé sur une stat de base et la « knowledge » (Herteit S3).</li>
          </ul>
          <p className="text-[13px]">
            Ces effets ne sont pas modélisés dans SW Forge (qui se concentre sur la vitesse, les
            ticks et les runes).
          </p>
        </Section>
      </div>
    </div>
  );
}
