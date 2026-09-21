import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { IconePlus } from '../../components/admin/AdminIcons.jsx';
import { ModaleConfirmation } from '../../components/admin/forms.jsx';
import { DonModale } from '../../components/admin/modales.jsx';
import {
  Alerte,
  Badge,
  BarreOutils,
  EntetePage,
  EtatVide,
  Panneau,
  Tableau,
} from '../../components/admin/ui.jsx';
import { useChargement } from '../../hooks/useChargement.js';
import { messageErreur } from '../../services/api.js';
import * as catalogService from '../../services/catalog.service.js';
import * as donationService from '../../services/donation.service.js';
import * as donorService from '../../services/donor.service.js';
import * as fundService from '../../services/fund.service.js';
import * as fmt from '../../utils/format.js';

const FILTRES_DONS = [
  { valeur: 'TOUS', label: 'Tous' },
  { valeur: 'PROJECT', label: 'Affectés' },
  { valeur: 'HOPE', label: 'Pour HOPE' },
  { valeur: 'MONTHLY', label: 'Mensuels' },
];

/**
 * Ecran "Dons recus" : le journal de tous les dons, affectes ou non,
 * ponctuels ou mensuels.
 *
 * Il vivait dans l'ancien ecran Donateurs ; les donateurs ont rejoint
 * l'ecran Utilisateurs, et le journal a gardé son ecran. C'est ici qu'on
 * enregistre un don, qu'on encaisse une echeance, et qu'on genere les
 * echeances du mois des dons mensuels.
 */
export default function DonsPage() {
  const [parametres, setParametres] = useSearchParams();

  const [recherche, setRecherche] = useState('');
  const [rechercheAppliquee, setRechercheAppliquee] = useState('');
  const [filtreDons, setFiltreDons] = useState('TOUS');
  const [modale, setModale] = useState({ nom: null, cible: null });

  const ouvrir = (nom, cible = null) => setModale({ nom, cible });
  const fermer = () => setModale({ nom: null, cible: null });

  // Ouverture directe depuis l'action rapide de l'accueil.
  useEffect(() => {
    if (parametres.get('don') === '1') {
      ouvrir('don');
      setParametres({}, { replace: true });
    }
  }, [parametres, setParametres]);

  useEffect(() => {
    const minuterie = setTimeout(() => setRechercheAppliquee(recherche.trim()), 300);
    return () => clearTimeout(minuterie);
  }, [recherche]);

  // Les fiches donateurs : la fenetre d'enregistrement d'un don y choisit
  // le donateur.
  const { donnees: donateurs, recharger: rechargerDonateurs } = useChargement(
    () => donorService.lister({}),
    []
  );

  const {
    donnees: dons,
    chargement: chargementDons,
    erreur,
    recharger: rechargerDons,
  } = useChargement(
    () =>
      donationService.lister({
        allocation: ['PROJECT', 'HOPE'].includes(filtreDons) ? filtreDons : undefined,
        frequency: filtreDons === 'MONTHLY' ? 'MONTHLY' : undefined,
        search: rechercheAppliquee || undefined,
        pageSize: 150,
      }),
    [filtreDons, rechercheAppliquee]
  );

  const { donnees: catalogue } = useChargement(() => catalogService.recuperer(), []);
  const { donnees: fonds } = useChargement(() => fundService.etat(), []);

  const libelles = catalogue?.labels ?? {};
  const liste = donateurs?.items ?? [];

  function apresEnregistrement() {
    fermer();
    rechargerDonateurs();
    rechargerDons();
  }

  const [envoi, setEnvoi] = useState(false);
  const [messageEcheances, setMessageEcheances] = useState('');
  const [aEncaisser, setAEncaisser] = useState(null);

  /**
   * Confirme la reception d'une echeance.
   *
   * Rien n'a ete preleve : c'est l'administrateur qui atteste que l'argent
   * est arrive. Le don entre alors dans les totaux du fonds et du projet.
   */
  async function encaisser() {
    setEnvoi(true);
    try {
      await donationService.changerStatut(aEncaisser.id, 'RECEIVED');
      setAEncaisser(null);
      rechargerDons();
      rechargerDonateurs();
    } catch (echec) {
      setMessageEcheances(messageErreur(echec, 'Encaissement impossible.'));
    } finally {
      setEnvoi(false);
    }
  }

  /**
   * Cree les occurrences du mois pour les dons mensuels.
   * Aucun argent n'est preleve : elles arrivent en attente d'encaissement.
   */
  async function genererEcheances() {
    setEnvoi(true);
    setMessageEcheances('');
    try {
      const resultat = await donationService.genererEcheancesMensuelles();
      setMessageEcheances(resultat.message);
      rechargerDons();
    } catch (echec) {
      setMessageEcheances(messageErreur(echec, 'Génération impossible.'));
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <>
      <EntetePage
        fil={[{ label: 'Utilisateurs', to: '/admin/utilisateurs?onglet=donateurs' }, { label: 'Dons reçus' }]}
        titre="Dons reçus"
        accroche="Chaque don versé à HOPE : affecté à un projet ou laissé au fonds HOPE, ponctuel ou mensuel."
        actions={
          <>
            <button
              type="button"
              className="btn btn--neutre"
              onClick={genererEcheances}
              disabled={envoi}
              title="Crée les occurrences du mois pour les dons mensuels, en attente d’encaissement. Aucun prélèvement n’est effectué."
            >
              Échéances du mois
            </button>
            <button type="button" className="btn btn--principal" onClick={() => ouvrir('don')}>
              <IconePlus />
              Enregistrer un don
            </button>
          </>
        }
      />

      {erreur && <Alerte>{erreur}</Alerte>}

      {messageEcheances && <Alerte type="info">{messageEcheances}</Alerte>}

      {/* ================= Journal ================= */}
      <Panneau serre>
        <BarreOutils
          recherche={recherche}
          onRecherche={setRecherche}
          placeholder="Rechercher une référence, un donateur, un projet…"
          filtres={FILTRES_DONS}
          filtreActif={filtreDons}
          onFiltre={setFiltreDons}
          compteur={`${fmt.nombre(dons?.items?.length ?? 0)} don(s)`}
        />

        <Tableau
          chargement={chargementDons}
          lignes={dons?.items ?? []}
          colonnes={[
            {
              cle: 'reference',
              titre: 'Don',
              rendu: (don) => (
                <div>
                  <div className="table__principal">{don.reference}</div>
                  <div className="table__secondaire">{fmt.date(don.receivedAt)}</div>
                </div>
              ),
            },
            {
              cle: 'donorName',
              titre: 'Donateur',
              rendu: (don) => (
                <div>
                  <div>{don.donorName}</div>
                  <div className="table__secondaire">
                    {libelles.donorOrigin?.[don.donorOrigin] ?? don.donorOrigin}
                    {don.fromAccount ? ' · a un compte' : ''}
                  </div>
                </div>
              ),
            },
            {
              cle: 'allocation',
              titre: 'Destination',
              rendu: (don) =>
                don.allocation === 'PROJECT' ? (
                  <div>
                    <Badge valeur="PROJECT" libelles={{ PROJECT: 'Affecté' }} couleur="violet" />
                    <div className="table__secondaire">
                      <Link className="table__lien" to={`/admin/projects/${don.projectId}`}>
                        {don.projectName}
                      </Link>
                    </div>
                  </div>
                ) : (
                  <Badge valeur="HOPE" libelles={{ HOPE: 'Fonds HOPE' }} couleur="bleu" />
                ),
            },
            {
              cle: 'frequency',
              titre: 'Fréquence',
              rendu: (don) => (
                <Badge
                  valeur={don.frequency}
                  libelles={libelles.donationFrequency}
                  couleur={don.frequency === 'MONTHLY' ? 'violet' : 'gris'}
                />
              ),
            },
            {
              cle: 'paymentMethod',
              titre: 'Paiement',
              rendu: (don) => (
                <div>
                  <div>{don.paymentMethod ?? '—'}</div>
                  {don.paymentReference && (
                    <div className="table__secondaire">{don.paymentReference}</div>
                  )}
                </div>
              ),
            },
            {
              cle: 'amount',
              titre: 'Montant',
              aligne: 'droite',
              rendu: (don) => <strong>{fmt.montant(don.amount, don.currency)}</strong>,
            },
            {
              cle: 'status',
              titre: 'Statut',
              rendu: (don) => <Badge valeur={don.status} libelles={libelles.donationStatus} />,
            },
            {
              cle: 'encaisser',
              titre: '',
              rendu: (don) =>
                don.status === 'PENDING' ? (
                  <button type="button" className="lien-action" onClick={() => setAEncaisser(don)}>
                    Encaisser
                  </button>
                ) : null,
            },
          ]}
          vide={
            <EtatVide
              titre="Aucun don enregistré"
              texte="Enregistrez un don reçu par Mobile Money, virement, carte ou espèces."
              action={
                <button
                  type="button"
                  className="btn btn--principal"
                  onClick={() => ouvrir('don')}
                >
                  <IconePlus />
                  Enregistrer un don
                </button>
              }
            />
          }
        />
      </Panneau>

      <DonModale
        ouverte={modale.nom === 'don'}
        donateurs={liste}
        donateurVerrouille={modale.nom === 'don' ? modale.cible : null}
        projets={fonds?.projects ?? []}
        libelles={libelles}
        moyensPaiement={catalogue?.paymentMethods ?? {}}
        devises={catalogue?.currencies ?? ['MGA']}
        onFermer={fermer}
        onEnregistre={apresEnregistrement}
      />
      <ModaleConfirmation
        ouverte={aEncaisser !== null}
        titre="Marquer ce don comme reçu ?"
        message={
          aEncaisser
            ? `${aEncaisser.reference} — ${fmt.montant(aEncaisser.amount, aEncaisser.currency)} de ${aEncaisser.donorName}. Il comptera alors dans les totaux.`
            : ''
        }
        onFermer={() => setAEncaisser(null)}
        onConfirmer={encaisser}
        envoi={envoi}
        libelleConfirmer="Marquer comme reçu"
      />

    </>
  );
}
