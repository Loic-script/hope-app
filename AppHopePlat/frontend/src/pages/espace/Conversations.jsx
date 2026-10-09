import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useOutletContext, useParams, useSearchParams } from 'react-router-dom';

import Fil from '../../components/messagerie/Fil.jsx';
import { BoutonCreerGroupe } from '../../components/messagerie/Groupes.jsx';
import ListeFils from '../../components/messagerie/ListeFils.jsx';
import { espaceDe } from '../../components/messagerie/profil.js';
import { useEcranEtroit } from '../../components/messagerie/useEcranEtroit.js';
import { messageErreur } from '../../services/api.js';
import * as service from '../../services/messagerie.service.js';

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
  const affiche = demande ?? (etroit ? null : (fils[0]?.id ?? null));

  const ouvrir = useCallback(
    (id) => setParametres({ t: String(id) }),
    [setParametres]
  );

  const revenirALaListe = useCallback(() => setParametres({}), [setParametres]);

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
  const groupesPermis = !/^\/(donateur|bailleur)\//.test(cheminMessages ?? '');

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
            groupesPermis && (
              <BoutonCreerGroupe
                api={api}
                racine={racine}
                onCree={async (id) => {
                  await charger();
                  ouvrir(id);
                }}
              />
            )
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
