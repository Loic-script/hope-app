import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { IconePlus } from '../../components/admin/AdminIcons.jsx';
import {
  CompteDonateurModale,
  DonModale,
  DonateurModale,
} from '../../components/admin/modales.jsx';
import {
  Alerte,
  Badge,
  BarreOutils,
  EntetePage,
  EtatVide,
  Onglets,
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

const FILTRES_DONATEURS = [
  { valeur: 'TOUS', label: 'Tous' },
  { valeur: 'AVEC', label: 'Avec compte' },
  { valeur: 'SANS', label: 'Sans compte' },
];

const FILTRES_DONS = [
  { valeur: 'TOUS', label: 'Tous' },
  { valeur: 'PROJECT', label: 'Affectés' },
  { valeur: 'HOPE', label: 'Pour HOPE' },
  { valeur: 'MONTHLY', label: 'Mensuels' },
];

/**
 * Ecran Donateurs.
 *
 * Deux vues : la liste des donateurs, distinguant ceux qui disposent d'un
 * compte de ceux qui donnent ponctuellement, et le journal des dons reçus.
 */
export default function DonorsPage() {
  const [parametres, setParametres] = useSearchParams();
  // ?onglet=dons permet d'arriver directement sur le journal des dons,
  // par exemple depuis une notification.
  const [ongletActif, setOngletActif] = useState(
    () => new URLSearchParams(window.location.search).get('onglet') ?? 'donateurs'
  );

  const [recherche, setRecherche] = useState('');
  const [rechercheAppliquee, setRechercheAppliquee] = useState('');
  const [filtreDonateurs, setFiltreDonateurs] = useState('TOUS');
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

  const {
    donnees: donateurs,
    chargement: chargementDonateurs,
    erreur,
    recharger: rechargerDonateurs,
  } = useChargement(
    () =>
      donorService.lister({
        account: filtreDonateurs === 'TOUS' ? undefined : filtreDonateurs,
        search: rechercheAppliquee || undefined,
      }),
    [filtreDonateurs, rechercheAppliquee]
  );

  const {
    donnees: dons,
    chargement: chargementDons,
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
  const synthese = donateurs?.summary;

  function apresEnregistrement() {
    fermer();
    rechargerDonateurs();
    rechargerDons();
  }

  const [envoi, setEnvoi] = useState(false);
  const [messageEcheances, setMessageEcheances] = useState('');

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
        titre="Donateurs"
        accroche="Ceux qui soutiennent HOPE : donateurs réguliers avec un compte, donateurs ponctuels, et donateurs à l’étranger."
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
            <button type="button" className="btn btn--neutre" onClick={() => ouvrir('donateur')}>
              Nouveau donateur
            </button>
            <button type="button" className="btn btn--principal" onClick={() => ouvrir('don')}>
              <IconePlus />
              Enregistrer un don
            </button>
          </>
        }
      />

      {erreur && <Alerte>{erreur}</Alerte>}

      {synthese && (
        <div className="resume-financier" style={{ marginBottom: '18px' }}>
          <div className="resume-financier__bloc">
            <p className="resume-financier__libelle">Donateurs</p>
            <p className="resume-financier__valeur">{fmt.nombre(synthese.total)}</p>
          </div>
          <div className="resume-financier__bloc">
            <p className="resume-financier__libelle">Avec un compte</p>
            <p className="resume-financier__valeur">{fmt.nombre(synthese.avecCompte)}</p>
            <p className="resume-financier__detail">Donateurs réguliers, suivis dans leur espace</p>
          </div>
          <div className="resume-financier__bloc">
            <p className="resume-financier__libelle">Sans compte</p>
            <p className="resume-financier__valeur">{fmt.nombre(synthese.sansCompte)}</p>
            <p className="resume-financier__detail">Dons ponctuels ou mensuels sans espace</p>
          </div>
          <div className="resume-financier__bloc">
            <p className="resume-financier__libelle">Depuis l’étranger</p>
            <p className="resume-financier__valeur">{fmt.nombre(synthese.internationaux)}</p>
            <p className="resume-financier__detail">
              {fmt.nombre(synthese.locaux)} à Madagascar
            </p>
          </div>
        </div>
      )}

      {messageEcheances && <Alerte type="info">{messageEcheances}</Alerte>}

      <Onglets
        onglets={[
          { cle: 'donateurs', label: 'Donateurs', compteur: liste.length },
          { cle: 'dons', label: 'Dons reçus', compteur: dons?.items?.length ?? 0 },
        ]}
        actif={ongletActif}
        onChange={setOngletActif}
      />

      {/* ================= Donateurs ================= */}
      {ongletActif === 'donateurs' && (
        <Panneau serre>
          <BarreOutils
            recherche={recherche}
            onRecherche={setRecherche}
            placeholder="Rechercher un nom, une organisation, une ville…"
            filtres={FILTRES_DONATEURS}
            filtreActif={filtreDonateurs}
            onFiltre={setFiltreDonateurs}
            compteur={`${fmt.nombre(liste.length)} donateur(s)`}
          />

          <Tableau
            chargement={chargementDonateurs}
            lignes={liste}
            colonnes={[
              {
                cle: 'displayName',
                titre: 'Donateur',
                rendu: (donateur) => (
                  <div>
                    <div className="table__principal">{donateur.displayName}</div>
                    <div className="table__secondaire">
                      {[donateur.city, donateur.country].filter(Boolean).join(', ') ||
                        'Localisation inconnue'}
                      {donateur.email ? ` · ${donateur.email}` : ''}
                    </div>
                  </div>
                ),
              },
              {
                cle: 'hasAccount',
                titre: 'Compte',
                rendu: (donateur) =>
                  donateur.hasAccount ? (
                    <div>
                      <Badge
                        valeur={donateur.accountStatus}
                        libelles={libelles.accountStatus}
                        couleur={donateur.accountStatus === 'ACTIVE' ? 'vert' : 'gris'}
                      />
                      <div className="table__secondaire">
                        Compte n° {donateur.accountId} · {fmt.date(donateur.accountCreatedAt)}
                      </div>
                    </div>
                  ) : (
                    <span style={{ color: 'var(--admin-texte-faible)' }}>Sans compte</span>
                  ),
              },
              {
                cle: 'origin',
                titre: 'Localisation',
                rendu: (donateur) => (
                  <Badge
                    valeur={donateur.origin}
                    libelles={libelles.donorOrigin}
                    couleur={donateur.origin === 'INTERNATIONAL' ? 'violet' : 'bleu'}
                  />
                ),
              },
              {
                cle: 'donationsCount',
                titre: 'Dons',
                aligne: 'droite',
                rendu: (donateur) => (
                  <div>
                    <strong>{fmt.nombre(donateur.donationsCount)}</strong>
                    {donateur.monthlyDonationsCount > 0 && (
                      <div className="table__secondaire">
                        dont {donateur.monthlyDonationsCount} mensuel(s)
                      </div>
                    )}
                  </div>
                ),
              },
              {
                cle: 'donationsTotal',
                titre: 'Total donné',
                aligne: 'droite',
                rendu: (donateur) => fmt.montant(donateur.donationsTotal),
              },
              {
                cle: 'lastDonationAt',
                titre: 'Dernier don',
                rendu: (donateur) =>
                  donateur.lastDonationAt ? fmt.date(donateur.lastDonationAt) : '—',
              },
              {
                cle: 'actions',
                titre: 'Actions',
                aligne: 'droite',
                rendu: (donateur) => (
                  <div className="cellule-actions">
                    <button
                      type="button"
                      className="lien-action"
                      onClick={() => ouvrir('don', donateur)}
                    >
                      Don
                    </button>
                    <button
                      type="button"
                      className="lien-action"
                      onClick={() => ouvrir('donateur', donateur)}
                    >
                      Modifier
                    </button>
                    {!donateur.hasAccount && (
                      <button
                        type="button"
                        className="lien-action"
                        onClick={() => ouvrir('compte', donateur)}
                      >
                        Ouvrir un compte
                      </button>
                    )}
                  </div>
                ),
              },
            ]}
            vide={
              <EtatVide
                titre="Aucun donateur enregistré"
                texte="Ajoutez un donateur pour pouvoir lui rattacher les dons qu’il verse à HOPE."
                
              />
            }
          />
        </Panneau>
      )}

      {/* ================= Dons reçus ================= */}
      {ongletActif === 'dons' && (
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
      )}

      <DonateurModale
        ouverte={modale.nom === 'donateur'}
        donateur={modale.cible}
        libelles={libelles}
        onFermer={fermer}
        onEnregistre={apresEnregistrement}
      />

      <CompteDonateurModale
        ouverte={modale.nom === 'compte'}
        donateur={modale.cible}
        onFermer={fermer}
        onEnregistre={apresEnregistrement}
      />

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
    </>
  );
}
