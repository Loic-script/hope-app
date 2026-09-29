import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';

import AdminLayout from '../layouts/AdminLayout.jsx';
import Redirection from '../pages/Redirection.jsx';
import Authentification from '../pages/Authentification.jsx';
import DonateurLayout from '../layouts/DonateurLayout.jsx';

/*
 * Le parcours d'accueil du donateur se charge a part : il embarque la
 * liste des pays et leurs regles de numerotation, dont aucun autre
 * ecran n'a besoin. Les autres espaces ne les telechargent pas.
 */
const ParcoursDonateur = lazy(() => import('../pages/donateur/Parcours.jsx'));
// Le paiement MVola, ouvert depuis l'etape 4 du parcours.
import RequireDonateur from './RequireDonateur.jsx';
import BenevoleLayout from '../layouts/BenevoleLayout.jsx';
import RequireBenevole from './RequireBenevole.jsx';
import BailleurLayout from '../layouts/BailleurLayout.jsx';
import RequireBailleur from './RequireBailleur.jsx';
import RequireAuth from './RequireAuth.jsx';
import ContextePaiement from '../components/paiement/ContextePaiement.jsx';
import ChargementPage from '../components/ChargementPage.jsx';

/*
 * Les pages se chargent a la demande : un donateur ne telecharge pas
 * l'espace administrateur, ni un benevole celui du bailleur. Seules la
 * porte d'entree (Authentification) et la redirection partent d'emblee.
 */
const AdminLogin = lazy(() => import('../pages/AdminLogin.jsx'));
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
const EnPreparation = lazy(() => import('../pages/vitrine/EnPreparation.jsx'));
const AccueilVitrine = lazy(() => import('../pages/vitrine/Accueil.jsx'));
const NousDecouvrir = lazy(() => import('../pages/vitrine/NousDecouvrir.jsx'));
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

/*
 * Les pages de paiement, une par moyen. Chacune se charge a part : on
 * n'embarque que celle du moyen choisi.
 */
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

/** L'attente d'une page de paiement, le temps qu'elle se charge. */
function AttentePaiement() {
  return (
    <div className="verification" role="status" aria-live="polite">
      <span className="verification__rotation" aria-hidden="true" />
      <p>Préparation du paiement…</p>
    </div>
  );
}

/**
 * Les huit pages de paiement sous une base, dans leur contexte :
 * "parcours" (le parcours d'accueil du donateur), ou l'espace d'ou l'on
 * donne. Pleine page, hors de la mise en page de l'espace.
 */
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

/**
 * Table de routage de l'application HOPE.
 *
 *   /                page d'entree : l'admin, ou les utilisateurs
 *   /authentification connexion et inscription des utilisateurs
 *   /donateur/...    espace donateur : actualites, dons, projets, profil
 *   /admin/login     connexion administrateur
 *   /benevole/...    espace benevole : projets, taches, journal
 *   /bailleur/...    espace partenaire : suivi des financements
 *   /admin/...     espace administrateur, protege par RequireAuth
 *
 * Les huit sections du menu : accueil, projets, impact, budget,
 * notifications, donateurs, messages, statistiques.
 */
/**
 * Les anciennes adresses des ecrans Donateurs, Benevoles et Bailleurs,
 * reunis dans "Utilisateurs". Les liens deja envoyes -- notifications,
 * messagerie, favoris -- menent au bon onglet, ancre comprise ; le
 * journal des dons (?onglet=dons) et l'enregistrement d'un don (?don=1)
 * menent a l'ecran des dons.
 */
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

export default function AppRoutes() {
  return (
    <Suspense fallback={<ChargementPage />}>
    <Routes>
      {/* ----- Le site vitrine, public ----- */}
      <Route element={<VitrineLayout />}>
        <Route path="/" element={<AccueilVitrine />} />
        <Route path="/nous-decouvrir" element={<NousDecouvrir />} />
        <Route path="/nos-realisations" element={<EnPreparation titre="Nos réalisations" />} />
        <Route path="/actualites" element={<EnPreparation titre="Actualités" />} />
        <Route path="/contact" element={<EnPreparation titre="Contact" />} />
        <Route path="/s-engager" element={<EnPreparation titre="S’engager" />} />
      </Route>
      {/* Le choix de l'espace (administration ou utilisateurs), qui etait a la racine. */}
      <Route path="/espaces" element={<Redirection />} />
      <Route path="/admin/login" element={<AdminLogin />} />

      {/* ----- Porte unique des utilisateurs ----- */}
      <Route path="/authentification" element={<Authentification />} />
      {/* Le mot de passe oublie : demander un lien, puis en choisir un nouveau. */}
      <Route path="/mot-de-passe-oublie" element={<MotDePasseOublie />} />
      <Route path="/reinitialiser-mot-de-passe" element={<ReinitialiserMotDePasse />} />
      <Route path="/verifier-courriel" element={<VerifierCourriel />} />
      {/* Les textes legaux, publics. */}
      <Route path="/confidentialite" element={<PolitiqueConfidentialite />} />
      <Route path="/conditions-utilisation" element={<ConditionsUtilisation />} />

      {/* ----- Espace donateur ----- */}
      <Route element={<RequireDonateur />}>
        <Route element={<DonateurLayout />}>
          {/* La page d'entree : le fil d'actualite, et l'invitation a donner. */}
          <Route path="/donateur" element={<ActualitesDonateur />} />
          <Route path="/donateur/faire-un-don" element={<FaireUnDon />} />
          <Route path="/donateur/mes-dons" element={<MesDons />} />
          <Route path="/donateur/projets" element={<ProjetsDonateur />} />
          <Route path="/donateur/projets/:id" element={<ProjetDonateur />} />
          {/* La messagerie et les notifications communes aux espaces. */}
          <Route path="/donateur/messages" element={<ConversationsEspace />} />
          <Route path="/donateur/messages/:id" element={<ConversationsEspace />} />
          <Route path="/donateur/notifications" element={<NotificationsEspace />} />
          <Route path="/donateur/profil" element={<ProfilDonateur />} />
        </Route>
        {/* Le parcours d'accueil, ouvert des l'inscription. */}
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
        {/* Le moyen de paiement choisi a l'etape 4, puis la suite du parcours. */}
        {routesPaiement('/donateur/completer-profil', 'parcours')}
        {/* "Faire un don" dans l'espace : le paiement par le moyen choisi. */}
        {routesPaiement('/donateur/payer', 'donateur')}
      </Route>

      {/*
        * Les anciennes adresses d'acces par espace menent desormais a la
        * porte unique. Les liens et favoris deja donnes continuent de
        * fonctionner, et il n'y a plus deux facons de s'inscrire.
        */}
      <Route path="/benevole/login" element={<Navigate to="/authentification" replace />} />
      <Route path="/benevole/inscription" element={<Navigate to="/authentification" replace />} />
      <Route path="/bailleur/login" element={<Navigate to="/authentification" replace />} />
      <Route path="/bailleur/inscription" element={<Navigate to="/authentification" replace />} />

      <Route element={<RequireBailleur />}>
        {/* L'organisation nait avec le compte : ce formulaire n'existe
            plus. Un favori ou un lien deja envoye mene a la fiche, dans
            les parametres du compte. */}
        <Route
          path="/bailleur/declarer-organisation"
          element={<Navigate to="/bailleur/organisation" replace />}
        />

        {routesPaiement('/bailleur/payer', 'bailleur')}

        <Route element={<BailleurLayout />}>
          <Route path="/bailleur" element={<AccueilBailleur />} />
          <Route path="/bailleur/paiements" element={<PaiementsBailleur />} />
          {/* L'ancienne page Partenariat : un favori y mene encore. */}
          <Route path="/bailleur/partenariat" element={<Navigate to="/bailleur/paiements" replace />} />
          <Route path="/bailleur/rapports" element={<RapportsBailleur />} />
          <Route path="/bailleur/projets" element={<ProjetsBailleur />} />
          {/* La fiche d'un projet : ce qu'il est, son financement, son impact. */}
          <Route path="/bailleur/projets/:id" element={<ProjetBailleur />} />
          {/* Le bouton "Faire un don" d'une publication : financer ce projet. */}
          <Route path="/bailleur/faire-un-don" element={<FaireUnDonBailleur />} />
          {/* Les preuves terrain ont quitte l'espace bailleur. Une ancienne
              adresse -- un favori, une notification deja envoyee -- mene
              au tableau de bord plutot qu'a une page blanche. */}
          <Route path="/bailleur/preuves" element={<Navigate to="/bailleur" replace />} />
          <Route path="/bailleur/preuves/:id" element={<Navigate to="/bailleur" replace />} />
          {/* Les actualites ont rejoint la page d'entree. Les notifications
              deja envoyees menent encore ici : l'adresse y renvoie. */}
          <Route path="/bailleur/actualites" element={<Navigate to="/bailleur" replace />} />
          <Route path="/bailleur/organisation" element={<OrganisationBailleur />} />
          <Route path="/bailleur/notifications" element={<NotificationsEspace />} />
          <Route path="/bailleur/messages" element={<ConversationsEspace />} />
          {/* La conversation a son adresse : sur un telephone,
              c'est une page a elle, et le lien se partage. */}
          <Route path="/bailleur/messages/:id" element={<ConversationsEspace />} />
        </Route>
      </Route>

      {/*
        La fiche du benevole se remplit AVANT que HOPE ne valide le
        compte : c'est elle qui permet de decider. La route est donc hors
        de la garde de l'espace -- le jeton limite remis a l'inscription
        n'ouvre rien d'autre, et le serveur le verifie.
      */}
      <Route path="/benevole/completer-profil" element={<CompleterProfil />} />

      <Route element={<RequireBenevole />}>
        {routesPaiement('/benevole/payer', 'benevole')}

        <Route element={<BenevoleLayout />}>
          <Route path="/benevole" element={<VueDensemble />} />
          {/* L'entree de l'espace : ce que HOPE mene, puis les taches
              qu'il y a a y prendre. */}
          <Route path="/benevole/projets" element={<ProjetsBenevole />} />
          <Route path="/benevole/projets/:id" element={<ProjetDetail />} />
          {/* Le bouton "Faire un don" d'une publication. */}
          <Route path="/benevole/faire-un-don" element={<FaireUnDonBenevole />} />
          {/* Les actualites ont rejoint la page d'entree : une ancienne
              adresse y mene. */}
          <Route path="/benevole/actualites" element={<Navigate to="/benevole" replace />} />
          {/* Les missions ont ete retirees : l'espace ne propose plus que
              des taches. Les anciennes adresses -- dans un favori, ou dans
              une notification deja envoyee -- menent aux taches plutot
              qu'a une page blanche. */}
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
          {/* Communs aux espaces : le meme ecran, servi par le client
              axios que la coque fournit. */}
          <Route path="/benevole/notifications" element={<NotificationsEspace />} />
          <Route path="/benevole/messages" element={<ConversationsEspace />} />
          {/* La conversation a son adresse : sur un telephone,
              c'est une page a elle, et le lien se partage. */}
          <Route path="/benevole/messages/:id" element={<ConversationsEspace />} />
        </Route>
      </Route>

      <Route element={<RequireAuth />}>
        {/* Page de verification de bout en bout, conservee depuis l'etape 1. */}
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
          {/* Donateurs, benevoles et bailleurs : un seul ecran, trois
              onglets, et le profil de chacun. Le journal des dons a gardé
              le sien. */}
          <Route path="/admin/utilisateurs" element={<UtilisateursPage />} />
          <Route path="/admin/utilisateurs/:genre/:id" element={<ProfilUtilisateurPage />} />
          <Route path="/admin/dons" element={<DonsPage />} />
          <Route path="/admin/donors" element={<VersUtilisateurs onglet="donateurs" />} />
          {/* La messagerie commune : l'equipe y est un participant
              comme un autre. Le courrier des donateurs garde son ecran. */}
          <Route path="/admin/conversations" element={<ConversationsEspace />} />
          {/* La conversation a son adresse : sur un telephone,
              c'est une page a elle, et le lien se partage. */}
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
