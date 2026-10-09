import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';

import AdminLayout from '../layouts/AdminLayout.jsx';
import Redirection from '../pages/Redirection.jsx';
import Authentification from '../pages/Authentification.jsx';
import DonateurLayout from '../layouts/DonateurLayout.jsx';

const ParcoursDonateur = lazy(() => import('../pages/donateur/Parcours.jsx'));
const DonSansCompte = lazy(() => import('../pages/don/DonSansCompte.jsx'));
import RequireDonateur from './RequireDonateur.jsx';
import BenevoleLayout from '../layouts/BenevoleLayout.jsx';
import RequireBenevole from './RequireBenevole.jsx';
import BailleurLayout from '../layouts/BailleurLayout.jsx';
import RequireBailleur from './RequireBailleur.jsx';
import RequireAuth from './RequireAuth.jsx';
import ContextePaiement from '../components/paiement/ContextePaiement.jsx';
import ChargementPage from '../components/ChargementPage.jsx';

const AdminLoginSuccess = lazy(() => import('../pages/AdminLoginSuccess.jsx'));
const AdminHome = lazy(() => import('../pages/admin/AdminHome.jsx'));
const BeneficiariesPage = lazy(() => import('../pages/admin/BeneficiariesPage.jsx'));
const BeneficiairePage = lazy(() => import('../pages/admin/BeneficiairePage.jsx'));
const BudgetPage = lazy(() => import('../pages/admin/BudgetPage.jsx'));
const DonsPage = lazy(() => import('../pages/admin/DonsPage.jsx'));
const ImpactPage = lazy(() => import('../pages/admin/ImpactPage.jsx'));
const NotificationsPage = lazy(() => import('../pages/admin/NotificationsPage.jsx'));
const ProjectDetailPage = lazy(() => import('../pages/admin/ProjectDetailPage.jsx'));
const ProjectFormPage = lazy(() => import('../pages/admin/ProjectFormPage.jsx'));
const ProjectsPage = lazy(() => import('../pages/admin/ProjectsPage.jsx'));
const TachesPage = lazy(() => import('../pages/admin/TachesPage.jsx'));
const ProofDetailPage = lazy(() => import('../pages/admin/ProofDetailPage.jsx'));
const ProofsPage = lazy(() => import('../pages/admin/ProofsPage.jsx'));
const ActualitesDonateur = lazy(() => import('../pages/donateur/Actualites.jsx'));
const FaireUnDon = lazy(() => import('../pages/donateur/FaireUnDon.jsx'));
const MesDons = lazy(() => import('../pages/donateur/MesDons.jsx'));
const ProfilDonateur = lazy(() => import('../pages/donateur/Profil.jsx'));
const ProjetDonateur = lazy(() => import('../pages/donateur/ProjetDetail.jsx'));
const ProjetsDonateur = lazy(() => import('../pages/donateur/Projets.jsx'));
const ConversationsEspace = lazy(() => import('../pages/espace/Conversations.jsx'));
const NotificationsEspace = lazy(() => import('../pages/espace/NotificationsEspace.jsx'));
const MesTaches = lazy(() => import('../pages/benevole/MesTaches.jsx'));
const ProjetDetail = lazy(() => import('../pages/benevole/ProjetDetail.jsx'));
const FaireUnDonBenevole = lazy(() => import('../pages/benevole/FaireUnDon.jsx'));
const ProjetsBenevole = lazy(() => import('../pages/benevole/Projets.jsx'));
const MonJournal = lazy(() => import('../pages/benevole/MonJournal.jsx'));
const BenevolesAnnuaire = lazy(() => import('../pages/benevole/Benevoles.jsx'));
const ProfilBenevole = lazy(() => import('../pages/benevole/ProfilBenevole.jsx'));
const CompleterProfil = lazy(() => import('../pages/benevole/CompleterProfil.jsx'));
const MonProfil = lazy(() => import('../pages/benevole/MonProfil.jsx'));
const VueDensemble = lazy(() => import('../pages/benevole/VueDensemble.jsx'));
const OrganisationBailleur = lazy(() => import('../pages/bailleur/Organisation.jsx'));
const PaiementsBailleur = lazy(() => import('../pages/bailleur/Paiements.jsx'));
const ProjetsBailleur = lazy(() => import('../pages/bailleur/Projets.jsx'));
const ProjetBailleur = lazy(() => import('../pages/bailleur/ProjetDetail.jsx'));
const FaireUnDonBailleur = lazy(() => import('../pages/bailleur/FaireUnDon.jsx'));
const RapportsBailleur = lazy(() => import('../pages/bailleur/Rapports.jsx'));
const AccueilBailleur = lazy(() => import('../pages/bailleur/Accueil.jsx'));
const SettingsPage = lazy(() => import('../pages/admin/SettingsPage.jsx'));
const AuditPage = lazy(() => import('../pages/admin/AuditPage.jsx'));
const ProfilUtilisateurPage = lazy(() => import('../pages/admin/ProfilUtilisateurPage.jsx'));
const UtilisateursPage = lazy(() => import('../pages/admin/UtilisateursPage.jsx'));
const StatisticsPage = lazy(() => import('../pages/admin/StatisticsPage.jsx'));
const PublicationsPage = lazy(() => import('../pages/admin/PublicationsPage.jsx'));
const VitrineLayout = lazy(() => import('../layouts/VitrineLayout.jsx'));
const AccueilVitrine = lazy(() => import('../pages/vitrine/Accueil.jsx'));
const NousDecouvrir = lazy(() => import('../pages/vitrine/NousDecouvrir.jsx'));
const NosRealisations = lazy(() => import('../pages/vitrine/NosRealisations.jsx'));
const Realisation = lazy(() => import('../pages/vitrine/Realisation.jsx'));
const Actualites = lazy(() => import('../pages/vitrine/Actualites.jsx'));
const Actualite = lazy(() => import('../pages/vitrine/Actualite.jsx'));
const SEngager = lazy(() => import('../pages/vitrine/SEngager.jsx'));
const Contact = lazy(() => import('../pages/vitrine/Contact.jsx'));
const VerifierCourriel = lazy(() => import('../pages/MotDePasse.jsx').then((m) => ({ default: m.VerifierCourriel })));
const PolitiqueConfidentialite = lazy(() =>
  import('../pages/Legal.jsx').then((m) => ({ default: m.PolitiqueConfidentialite }))
);
const ConditionsUtilisation = lazy(() =>
  import('../pages/Legal.jsx').then((m) => ({ default: m.ConditionsUtilisation }))
);
const MotDePasseOublie = lazy(() => import('../pages/MotDePasse.jsx').then((m) => ({ default: m.MotDePasseOublie })));
const ReinitialiserMotDePasse = lazy(() =>
  import('../pages/MotDePasse.jsx').then((m) => ({ default: m.ReinitialiserMotDePasse }))
);

const PAGES_DE_PAIEMENT = {
  mvola: lazy(() => import('../pages/donateur/PaiementMvola.jsx')),
  'orange-money': lazy(() => import('../pages/donateur/PaiementOrangeMoney.jsx')),
  carte: lazy(() => import('../pages/donateur/PaiementCarte.jsx')),
  virement: lazy(() => import('../pages/donateur/PaiementVirement.jsx')),
  depot: lazy(() => import('../pages/donateur/PaiementDepot.jsx')),
  especes: lazy(() => import('../pages/donateur/PaiementEspeces.jsx')),
  'virement-international': lazy(() => import('../pages/donateur/PaiementInternational.jsx')),
  plateforme: lazy(() => import('../pages/donateur/PaiementPlateforme.jsx')),
};

function AttentePaiement() {
  return (
    <div className="verification" role="status" aria-live="polite">
      <span className="verification__rotation" aria-hidden="true" />
      <p>Préparation du paiement…</p>
    </div>
  );
}

function routesPaiement(base, espace) {
  return Object.entries(PAGES_DE_PAIEMENT).map(([chemin, Page]) => (
    <Route
      key={`${espace}-${chemin}`}
      path={`${base}/${chemin}`}
      element={
        <Suspense fallback={<AttentePaiement />}>
          <ContextePaiement espace={espace}>
            <Page />
          </ContextePaiement>
        </Suspense>
      }
    />
  ));
}

function VersUtilisateurs({ onglet }) {
  const { search, hash } = useLocation();
  const parametres = new URLSearchParams(search);
  if (onglet === 'donateurs' && parametres.get('don') === '1') {
    return <Navigate to="/admin/dons?don=1" replace />;
  }
  if (onglet === 'donateurs' && parametres.get('onglet') === 'dons') {
    return <Navigate to="/admin/dons" replace />;
  }
  return <Navigate to={`/admin/utilisateurs?onglet=${onglet}${hash}`} replace />;
}

function VersNosProjets() {
  const { id } = useParams();
  return <Navigate to={`/nos-projets/${id}`} replace />;
}

export default function AppRoutes() {
  return (
    <Suspense fallback={<ChargementPage />}>
    <Routes>
      <Route element={<VitrineLayout />}>
        <Route path="/" element={<AccueilVitrine />} />
        <Route path="/nous-decouvrir" element={<NousDecouvrir />} />
        <Route path="/nos-projets" element={<NosRealisations />} />
        <Route path="/nos-projets/:id" element={<Realisation />} />
        <Route path="/nos-realisations" element={<Navigate to="/nos-projets" replace />} />
        <Route path="/nos-realisations/:id" element={<VersNosProjets />} />
        <Route path="/actualites" element={<Actualites />} />
        <Route path="/actualites/:id" element={<Actualite />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/s-engager" element={<SEngager />} />
      </Route>
      <Route path="/espaces" element={<Redirection />} />
      <Route path="/admin/login" element={<Navigate to="/authentification?type=aucun" replace />} />

      <Route
        path="/faire-un-don"
        element={
          <Suspense
            fallback={
              <div className="verification" role="status" aria-live="polite">
                <span className="verification__rotation" aria-hidden="true" />
                <p>Préparation de votre don…</p>
              </div>
            }
          >
            <DonSansCompte />
          </Suspense>
        }
      />
      {routesPaiement('/faire-un-don', 'invite')}

      <Route path="/authentification" element={<Authentification />} />
      <Route path="/mot-de-passe-oublie" element={<MotDePasseOublie />} />
      <Route path="/reinitialiser-mot-de-passe" element={<ReinitialiserMotDePasse />} />
      <Route path="/verifier-courriel" element={<VerifierCourriel />} />
      <Route path="/confidentialite" element={<PolitiqueConfidentialite />} />
      <Route path="/conditions-utilisation" element={<ConditionsUtilisation />} />

      <Route element={<RequireDonateur />}>
        <Route element={<DonateurLayout />}>
          <Route path="/donateur" element={<ActualitesDonateur />} />
          <Route path="/donateur/faire-un-don" element={<FaireUnDon />} />
          <Route path="/donateur/mes-dons" element={<MesDons />} />
          <Route path="/donateur/projets" element={<ProjetsDonateur />} />
          <Route path="/donateur/projets/:id" element={<ProjetDonateur />} />
          <Route path="/donateur/messages" element={<ConversationsEspace />} />
          <Route path="/donateur/messages/:id" element={<ConversationsEspace />} />
          <Route path="/donateur/notifications" element={<NotificationsEspace />} />
          <Route path="/donateur/profil" element={<ProfilDonateur />} />
        </Route>
        <Route
          path="/donateur/completer-profil"
          element={
            <Suspense
              fallback={
                <div className="verification" role="status" aria-live="polite">
                  <span className="verification__rotation" aria-hidden="true" />
                  <p>Préparation de votre espace…</p>
                </div>
              }
            >
              <ParcoursDonateur />
            </Suspense>
          }
        />
        {routesPaiement('/donateur/completer-profil', 'parcours')}
        {routesPaiement('/donateur/payer', 'donateur')}
      </Route>

      <Route path="/benevole/login" element={<Navigate to="/authentification" replace />} />
      <Route path="/benevole/inscription" element={<Navigate to="/authentification" replace />} />
      <Route path="/bailleur/login" element={<Navigate to="/authentification" replace />} />
      <Route path="/bailleur/inscription" element={<Navigate to="/authentification" replace />} />

      <Route element={<RequireBailleur />}>
        <Route
          path="/bailleur/declarer-organisation"
          element={<Navigate to="/bailleur/organisation" replace />}
        />

        {routesPaiement('/bailleur/payer', 'bailleur')}

        <Route element={<BailleurLayout />}>
          <Route path="/bailleur" element={<AccueilBailleur />} />
          <Route path="/bailleur/paiements" element={<PaiementsBailleur />} />
          <Route path="/bailleur/partenariat" element={<Navigate to="/bailleur/paiements" replace />} />
          <Route path="/bailleur/rapports" element={<RapportsBailleur />} />
          <Route path="/bailleur/projets" element={<ProjetsBailleur />} />
          <Route path="/bailleur/projets/:id" element={<ProjetBailleur />} />
          <Route path="/bailleur/faire-un-don" element={<FaireUnDonBailleur />} />
          <Route path="/bailleur/preuves" element={<Navigate to="/bailleur" replace />} />
          <Route path="/bailleur/preuves/:id" element={<Navigate to="/bailleur" replace />} />
          <Route path="/bailleur/actualites" element={<Navigate to="/bailleur" replace />} />
          <Route path="/bailleur/organisation" element={<OrganisationBailleur />} />
          <Route path="/bailleur/notifications" element={<NotificationsEspace />} />
          <Route path="/bailleur/messages" element={<ConversationsEspace />} />
          <Route path="/bailleur/messages/:id" element={<ConversationsEspace />} />
        </Route>
      </Route>

      <Route path="/benevole/completer-profil" element={<CompleterProfil />} />

      <Route element={<RequireBenevole />}>
        {routesPaiement('/benevole/payer', 'benevole')}

        <Route element={<BenevoleLayout />}>
          <Route path="/benevole" element={<VueDensemble />} />
          <Route path="/benevole/projets" element={<ProjetsBenevole />} />
          <Route path="/benevole/projets/:id" element={<ProjetDetail />} />
          <Route path="/benevole/faire-un-don" element={<FaireUnDonBenevole />} />
          <Route path="/benevole/actualites" element={<Navigate to="/benevole" replace />} />
          <Route path="/benevole/missions" element={<Navigate to="/benevole/taches" replace />} />
          <Route
            path="/benevole/missions/:id"
            element={<Navigate to="/benevole/taches" replace />}
          />
          <Route path="/benevole/taches" element={<MesTaches />} />
          <Route path="/benevole/journal" element={<MonJournal />} />
          <Route path="/benevole/benevoles" element={<BenevolesAnnuaire />} />
          <Route path="/benevole/benevoles/:id" element={<ProfilBenevole />} />
          <Route path="/benevole/profil" element={<MonProfil />} />
          <Route path="/benevole/notifications" element={<NotificationsEspace />} />
          <Route path="/benevole/messages" element={<ConversationsEspace />} />
          <Route path="/benevole/messages/:id" element={<ConversationsEspace />} />
        </Route>
      </Route>

      <Route element={<RequireAuth />}>
        <Route path="/admin/login-success" element={<AdminLoginSuccess />} />

        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<AdminHome />} />

          <Route path="/admin/projects" element={<ProjectsPage />} />
          <Route path="/admin/taches" element={<TachesPage />} />
          <Route path="/admin/projects/new" element={<ProjectFormPage />} />
          <Route path="/admin/projects/:id" element={<ProjectDetailPage />} />

          <Route path="/admin/beneficiaries" element={<BeneficiariesPage />} />
          <Route path="/admin/beneficiaries/:id" element={<BeneficiairePage />} />

          <Route path="/admin/proofs" element={<ProofsPage />} />
          <Route path="/admin/proofs/:id" element={<ProofDetailPage />} />
          <Route path="/admin/projects/:id/edit" element={<ProjectFormPage />} />

          <Route path="/admin/impact" element={<ImpactPage />} />
          <Route path="/admin/budget" element={<BudgetPage />} />
          <Route path="/admin/notifications" element={<NotificationsPage />} />
          <Route path="/admin/utilisateurs" element={<UtilisateursPage />} />
          <Route path="/admin/utilisateurs/:genre/:id" element={<ProfilUtilisateurPage />} />
          <Route path="/admin/dons" element={<DonsPage />} />
          <Route path="/admin/donors" element={<VersUtilisateurs onglet="donateurs" />} />
          <Route path="/admin/conversations" element={<ConversationsEspace />} />
          <Route path="/admin/conversations/:id" element={<ConversationsEspace />} />
          <Route path="/admin/volunteers" element={<VersUtilisateurs onglet="benevoles" />} />
          <Route path="/admin/funders" element={<VersUtilisateurs onglet="bailleurs" />} />
          <Route path="/admin/actualites" element={<PublicationsPage />} />
          <Route path="/admin/statistics" element={<StatisticsPage />} />
          <Route path="/admin/settings" element={<SettingsPage />} />
          <Route path="/admin/audit" element={<AuditPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
    </Suspense>
  );
}
