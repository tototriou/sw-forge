// Rendre la main à la boucle d'événements d'un Worker (ou de la page) entre
// deux tranches de calcul. Neutre : ni `self`, ni `worker_threads`.
//
// `MessageChannel` plutôt que `setTimeout(0)` : des rappels `setTimeout`
// enchaînés sont ramenés à 4 ms minimum au-delà de cinq imbrications
// (spécification HTML ; Chromium, Worker compris), soit ~3,6 % du temps d'un
// Worker qui cède toutes les 100 ms ; un message de canal n'est pas bridé, et
// laisse passer un message déjà arrivé (l'arrêt manuel). Repli `setTimeout`
// quand `MessageChannel` manque. Le port se ferme à la réception : un port
// ouvert tiendrait la boucle d'événements de Node en vie.

type FabriqueCanal = new () => MessageChannel;

export function cederLaMain(
  fabrique: FabriqueCanal | null = typeof MessageChannel === 'function' ? MessageChannel : null
): Promise<void> {
  return new Promise<void>((resolve) => {
    if (!fabrique) {
      setTimeout(resolve, 0);
      return;
    }
    const canal = new fabrique();
    canal.port1.onmessage = () => {
      canal.port1.close();
      resolve();
    };
    canal.port2.postMessage(null);
  });
}
