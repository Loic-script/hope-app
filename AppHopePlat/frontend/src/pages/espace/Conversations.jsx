import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useOutletContext, useParams, useSearchParams } from 'react-router-dom';

import Fil from '../../components/messagerie/Fil.jsx';
import { BoutonCreerGroupe } from '../../components/messagerie/Groupes.jsx';
import ListeFils from '../../components/messagerie/ListeFils.jsx';
import { espaceDe } from '../../components/messagerie/profil.js';
import { useEcranEtroit } from '../../components/messagerie/useEcranEtroit.js';
import { messageErreur } from '../../services/api.js';
import * as service from '../../services/messagerie.service.js';

/**
 * La messagerie, commune a tous les espaces.
 *
 * Tout le monde ecrit a qui il peut joindre : benevole, bailleur,
 * donateur, equipe. L'ecran ne connait pas les roles -- c'est le jeton
 * porte par le client axios qui dit qui parle, et le serveur qui decide
 * de ce qu'on voit.
 *
 * - Grand ecran : la liste a gauche, le fil a droite. Sans ?t= dans
 *   l'adresse, le plus recent s'ouvre.
 * - Telephone : un volet a la fois. La page s'ouvre sur la liste seule ;
 *   un fil s'ouvre en plein ecran, par-dessus la barre, avec son retour.
 *   Aucun fil n'est choisi par defaut -- et donc aucun n'est marque lu
 *   sans avoir ete regarde.
 */
export default function Conversations() {
  const {
    api,
    racineConversations: racine,
    cheminMessages,
    titreMessagerie = 'Messages',
    rafraichirCompteurs,
  } = useOutletContext();

  const [parametres, setParametres] = useSearchParams();
  const { id: idChemin } = useParams();
  const navigate = useNavigate();
  const etroit = useEcranEtroit();

  const [fils, setFils] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');
  const [annonce, setAnnonce] = useState('');

  // Les anciennes adresses /messages/:id menent au meme fil, sous ?t=.
  useEffect(() => {
    if (idChemin) navigate(`${cheminMessages}?t=${idChemin}`, { replace: true });
  }, [idChemin, cheminMessages, navigate]);

  const charger = useCallback(async () => {
    try {
      const { items } = await service.lister(api, racine);
      setFils(items);
      setErreur('');
    } catch (echec) {
      setErreur(messageErreur(echec, 'Impossible de charger vos conversations.'));
    } finally {
      setChargement(false);
    }
  }, [api, racine]);

  useEffect(() => {
    charger();
  }, [charger]);

  const demande = Number(parametres.get('t')) || null;
  // Sur grand ecran seulement, le plus recent s'ouvre par defaut.
  const affiche = demande ?? (etroit ? null : (fils[0]?.id ?? null));

  const ouvrir = useCallback(
    (id) => setParametres({ t: String(id) }),
    [setParametres]
  );

  const revenirALaListe = useCallback(() => setParametres({}), [setParametres]);

  /** Un fil marque lu : sa pastille s'eteint, et celle du menu suit. */
  const surLu = useCallback(
    (id) => {
      setFils((liste) => liste.map((fil) => (fil.id === id ? { ...fil, nonLus: 0 } : fil)));
      rafraichirCompteurs?.();
    },
    [rafraichirCompteurs]
  );

  const chargerJoignables = useCallback(() => service.joignables(api, racine), [api, racine]);

  async function nouvelle(personne) {
    try {
      const id = await service.ouvrir(api, racine, { type: personne.type, id: personne.id });
      await charger();
      ouvrir(id);
    } catch (echec) {
      setErreur(messageErreur(echec, 'La conversation n’a pas pu être ouverte.'));
    }
  }

  /** Le groupe quitte : retour a la liste, avec confirmation. */
  const surQuitte = useCallback(
    (nom) => {
      setParametres({});
      charger();
      setAnnonce(`Vous avez quitté le groupe « ${nom} ».`);
      setTimeout(() => setAnnonce(''), 4000);
    },
    [setParametres, charger]
  );

  const pleinEcran = etroit && affiche !== null;

  return (
    <div className={`msg-page${pleinEcran ? ' msg-page--fil-ouvert' : ''}`}>
      <header className="page-benevole__entete msg-page__entete">
        <p className="surtitre">
          <span className="trait-hope surtitre__trait" aria-hidden="true" />
          Se parler
        </p>
        <h1 className="page-benevole__titre">{titreMessagerie}</h1>
      </header>

      {erreur && (
        <p className="alerte-benevole" role="alert">
          {erreur}
        </p>
      )}

      <div className="msg">
        <ListeFils
          fils={fils}
          actif={etroit ? null : affiche}
          chargement={chargement}
          onOuvrir={ouvrir}
          onNouvelle={nouvelle}
          chargerJoignables={chargerJoignables}
          actions={
            <BoutonCreerGroupe
              api={api}
              racine={racine}
              onCree={async (id) => {
                await charger();
                ouvrir(id);
              }}
            />
          }
        />

        {affiche !== null ? (
          <Fil
            key={affiche}
            api={api}
            racine={racine}
            id={affiche}
            pleinEcran={pleinEcran}
            onRetour={revenirALaListe}
            onLu={surLu}
            onActivite={charger}
            onOuvrirFil={ouvrir}
            espace={espaceDe(cheminMessages)}
            onQuitte={surQuitte}
          />
        ) : (
          !etroit && (
            <section className="msg-fil msg-fil--vide">
              <p className="msg-fil__etat">
                {chargement ? 'Chargement…' : 'Choisissez une conversation, ou cherchez une personne pour lui écrire.'}
              </p>
            </section>
          )
        )}
      </div>

      <p className="msg-annonce" role="status" aria-live="polite">
        {annonce}
      </p>
    </div>
  );
}
