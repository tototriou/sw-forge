import { Analytics as VercelAnalytics } from '@vercel/analytics/react';

// Mesure d'audience Vercel Web Analytics : sans cookie, limitée aux pages
// visitées. Aucune donnée de compte n'y passe — l'export SWEX est lu dans la
// page et les états vivent dans le `localStorage`.

// Le site est en **routage par hash** (`#/siege/defense`). Or la mesure se fait
// sur le CHEMIN : sans retouche, toutes les visites seraient comptées sur « / »
// et les statistiques ne diraient rien. On réécrit donc l'URL pour que la route
// du hash devienne le chemin.
function hashVersLeChemin(url: string): string {
  try {
    const u = new URL(url);
    const route = u.hash.replace(/^#\/?/, '');
    u.hash = '';
    u.pathname = `/${route}`;
    return u.toString();
  } catch {
    return url; // URL inattendue : on n'invente rien, on laisse tel quel
  }
}

export default function Analytics() {
  return (
    <VercelAnalytics
      beforeSend={(event) =>
        event.type === 'pageview' ? { ...event, url: hashVersLeChemin(event.url) } : event
      }
    />
  );
}
