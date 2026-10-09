import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import {
  ONGLET_DU_ROLE,
  STATUTS_UTILISATEUR,
  LIBELLES_STATUT,
  useGestionUtilisateur,
} from '../../components/admin/GestionUtilisateur.jsx';
import {
  Alerte,
  Badge,
  Chargement,
  EntetePage,
  EtatVide,
  LigneFiche,
  Panneau,
  Tableau,
} from '../../components/admin/ui.jsx';
import Visage from '../../components/admin/Visage.jsx';
import BoutonMessage from '../../components/messagerie/BoutonMessage.jsx';
import { useChargement, useSoumission } from '../../hooks/useChargement.js';
import { api } from '../../services/api.js';
import * as catalogService from '../../services/catalog.service.js';
import * as consultationService from '../../services/consultation.service.js';
import * as utilisateursService from '../../services/utilisateurs.service.js';
import * as fmt from '../../utils/format.js';
import { libelleFuseau } from '../../utils/fuseaux.js';
import { nomDuPays } from '../../utils/pays.js';

const LIBELLES_ROLE = { donateur: 'Donateur', benevole: 'Bénévole', bailleur: 'Bailleur' };

const TYPES_ORGANISATION = {
  fondation_privee: 'Fondation privée',
  entreprise: 'Entreprise',
  agence_publique: 'Agence publique',
  ong: 'ONG',
  ambassade: 'Ambassade',
  autre: 'Organisation',
};
const STATUTS_ORGANISATION = {
  prospect: 'Prospect',
  actif: 'Partenaire actif',
  en_pause: 'En pause',
  termine: 'Partenariat terminé',
};
const NIVEAUX = { bronze: 'Bronze', argent: 'Argent', or: 'Or' };
const TYPES_SOUTIEN = { financier: 'Financier', competences: 'Compétences', materiel: 'Matériel' };
const STATUTS_ENGAGEMENT = { en_cours: 'En cours', finalise: 'Finalisé', suspendu: 'Suspendu', annule: 'Annulé' };
const COULEURS_ENGAGEMENT = { en_cours: 'bleu', finalise: 'vert', suspendu: 'ambre', annule: 'gris' };
const STATUTS_VERSEMENT = { attendu: 'Attendu', recu: 'Reçu', en_retard: 'En retard', annule: 'Annulé' };
const COULEURS_VERSEMENT = { attendu: 'ambre', recu: 'vert', en_retard: 'rouge', annule: 'gris' };
const MOYENS_VERSEMENT = {
  virement: 'Virement',
  cheque: 'Chèque',
  especes: 'Espèces',
  mobile_money: 'Mobile Money',
};
const STATUTS_TACHE = { a_faire: 'À faire', en_cours: 'En cours', livree: 'Livrée' };
const COULEURS_TACHE = { a_faire: 'gris', en_cours: 'bleu', livree: 'vert' };
const STATUTS_INSCRIPTION = {
  inscrit: 'Inscrit',
  confirme: 'Confirmé',
  present: 'Présent',
  absent: 'Absent',
  annule: 'Annulé',
};
const FORMATS_MISSION = { presentiel: 'Présentiel', terrain: 'Terrain', distance: 'À distance' };
const ORIGINES = { LOCAL: 'Madagascar', INTERNATIONAL: 'Étranger' };

const ouiNon = (valeur) => (valeur === true ? 'Oui' : valeur === false ? 'Non' : null);

function montants(lignes, champ) {
  const utiles = (lignes ?? []).filter((ligne) => Number(ligne[champ]) > 0);
  if (utiles.length === 0) return fmt.montant(0);
  return utiles.map((ligne) => fmt.montant(ligne[champ], ligne.devise)).join(' + ');
}

const MOMENTS = { matin: 'matin', 'apres-midi': 'après-midi', soir: 'soir', journee: 'journée' };

function disponibilites(valeur) {
  const jours = Object.entries(valeur ?? {}).filter(([, moments]) => moments?.length);
  if (jours.length === 0) return null;
  return jours
    .map(([jour, moments]) => {
      const nomDuJour = jour.charAt(0).toUpperCase() + jour.slice(1);
      return `${nomDuJour} : ${moments.map((moment) => MOMENTS[moment] ?? moment).join(', ')}`;
    })
    .join(' · ');
}

function Pastilles({ valeurs }) {
  if (!valeurs?.length) return null;
  return (
    <span className="pastilles">
      {valeurs.map((valeur) => (
        <span key={valeur} className="badge badge--bleu">
          {valeur}
        </span>
      ))}
    </span>
  );
}

function Chiffre({ libelle, valeur, detail }) {
  return (
    <div className="resume-financier__bloc">
      <p className="resume-financier__libelle">{libelle}</p>
      <p className="resume-financier__valeur">{valeur}</p>
      {detail && <p className="resume-financier__detail">{detail}</p>}
    </div>
  );
}

function ChiffresDons({ dons }) {
  const nombreRecus = (dons.totaux ?? []).reduce((somme, ligne) => somme + ligne.nombre, 0);
  return (
    <div className="resume-financier profil__chiffres">
      <Chiffre
        libelle="Somme donnée"
        valeur={montants(dons.totaux, 'total')}
        detail={
          (dons.totaux ?? []).some((ligne) => Number(ligne.fondsHope) > 0)
            ? `dont ${montants(dons.totaux, 'fondsHope')} au fonds HOPE`
            : 'Dons reçus seulement'
        }
      />
      <Chiffre
        libelle="Dons"
        valeur={fmt.nombre(dons.dons.length)}
        detail={
          dons.enAttente > 0
            ? `${nombreRecus} reçu(s) · ${dons.enAttente} en attente`
            : `${nombreRecus} reçu(s)`
        }
      />
      <Chiffre
        libelle="Projets soutenus"
        valeur={fmt.nombre(new Set(dons.projets.map((p) => p.id)).size)}
        detail="par des dons affectés"
      />
      <Chiffre
        libelle="Dons mensuels"
        valeur={fmt.nombre(dons.mensuels)}
        detail={dons.mensuels > 0 ? 'Un soutien qui se renouvelle' : 'Aucun don récurrent'}
      />
    </div>
  );
}

function DonsDuDonateur({ dons, libelles, depuisUneAdresse }) {
  return (
    <>
      <Panneau titre="Projets soutenus" sousTitre="Ce que ses dons affectés ont apporté à chaque projet" serre>
        <Tableau
          lignes={dons.projets}
          cleLigne={(projet) => `${projet.id}-${projet.devise}`}
          colonnes={[
            {
              cle: 'nom',
              titre: 'Projet',
              rendu: (projet) => (
                <div>
                  <Link className="table__lien" to={`/admin/projects/${projet.id}`}>
                    {projet.nom}
                  </Link>
                  <div className="table__secondaire">{projet.reference}</div>
                </div>
              ),
            },
            { cle: 'nombre', titre: 'Dons', aligne: 'droite', rendu: (p) => fmt.nombre(p.nombre) },
            {
              cle: 'montant',
              titre: 'Somme donnée',
              aligne: 'droite',
              rendu: (p) => <strong>{fmt.montant(p.montant, p.devise)}</strong>,
            },
          ]}
          vide={
            <EtatVide
              titre="Aucun projet soutenu"
              texte="Ses dons reçus sont allés au fonds HOPE, ou il n’a pas encore donné."
            />
          }
        />
      </Panneau>

      <Panneau
        titre="Dons"
        sousTitre={
          depuisUneAdresse
            ? 'Les dons enregistrés au nom de la même adresse électronique'
            : 'Chaque don enregistré, du plus récent au plus ancien'
        }
        serre
      >
        <Tableau
          lignes={dons.dons}
          colonnes={[
            {
              cle: 'reference',
              titre: 'Don',
              rendu: (don) => (
                <div>
                  <div className="table__principal">{don.reference}</div>
                  <div className="table__secondaire">{fmt.date(don.recuLe)}</div>
                </div>
              ),
            },
            {
              cle: 'allocation',
              titre: 'Destination',
              rendu: (don) =>
                don.allocation === 'PROJECT' ? (
                  <Link className="table__lien" to={`/admin/projects/${don.projetId}`}>
                    {don.projetNom}
                  </Link>
                ) : (
                  <Badge valeur="HOPE" libelles={{ HOPE: 'Fonds HOPE' }} couleur="bleu" />
                ),
            },
            {
              cle: 'frequence',
              titre: 'Fréquence',
              rendu: (don) => (
                <Badge
                  valeur={don.frequence}
                  libelles={libelles.donationFrequency}
                  couleur={don.frequence === 'MONTHLY' ? 'violet' : 'gris'}
                />
              ),
            },
            { cle: 'moyen', titre: 'Paiement', rendu: (don) => don.moyen ?? '—' },
            {
              cle: 'montant',
              titre: 'Montant',
              aligne: 'droite',
              rendu: (don) => <strong>{fmt.montant(don.montant, don.devise)}</strong>,
            },
            {
              cle: 'statut',
              titre: 'Statut',
              rendu: (don) => <Badge valeur={don.statut} libelles={libelles.donationStatus} />,
            },
          ]}
          vide={
            <EtatVide
              titre="Aucun don enregistré"
              texte={
                depuisUneAdresse
                  ? 'Aucun don n’est enregistré au nom de cette adresse pour l’instant.'
                  : 'Les dons de ce donateur apparaîtront ici.'
              }
            />
          }
        />
      </Panneau>
    </>
  );
}

function ChiffresBenevole({ benevole }) {
  const { fiche, taches, missions, projets } = benevole;
  const enCours = taches.filter((t) => t.statut === 'en_cours').length;
  const livrees = taches.filter((t) => t.statut === 'livree').length;
  return (
    <div className="resume-financier profil__chiffres">
      <Chiffre
        libelle="Tâches"
        valeur={fmt.nombre(taches.length)}
        detail={`${enCours} en cours · ${livrees} livrée(s)`}
      />
      <Chiffre libelle="Projets" valeur={fmt.nombre(projets.length)} detail="par ses tâches et ses missions" />
      <Chiffre libelle="Missions" valeur={fmt.nombre(missions.length)} detail="inscriptions" />
      <Chiffre
        libelle="Bénévole depuis"
        valeur={fiche?.benevoleDepuis ? fmt.date(fiche.benevoleDepuis) : '—'}
        detail={fiche?.valideParHope ? 'Validé par HOPE pour le terrain' : 'Pas encore validé pour le terrain'}
      />
    </div>
  );
}

function ProfilBenevole({ benevole }) {
  const { fiche, taches, missions, projets } = benevole;

  return (
    <>
      <Panneau titre="Compétences et disponibilités">
        <dl className="fiche">
          <LigneFiche terme="Profession">{fiche?.profession}</LigneFiche>
          <LigneFiche terme="Compétences">
            <Pastilles valeurs={fiche?.competences} />
          </LigneFiche>
          <LigneFiche terme="Langues">
            <Pastilles valeurs={fiche?.langues} />
          </LigneFiche>
          <LigneFiche terme="Disponibilités">{disponibilites(fiche?.disponibilites)}</LigneFiche>
          <LigneFiche terme="Missions de terrain">{ouiNon(fiche?.accepteTerrain)}</LigneFiche>
          <LigneFiche terme="Missions à distance">{ouiNon(fiche?.accepteDistance)}</LigneFiche>
          <LigneFiche terme="Contact d’urgence">
            {[fiche?.contactUrgenceNom, fiche?.contactUrgenceTel].filter(Boolean).join(' · ') || null}
          </LigneFiche>
          <LigneFiche terme="Validé par HOPE">
            {fiche?.valideParHope ? `Oui, le ${fmt.date(fiche.valideLe)}` : 'Non'}
          </LigneFiche>
        </dl>
        {fiche?.notesInternes && (
          <div className="profil__notes">
            <p className="profil__notes-titre">Notes internes — réservées à l’équipe</p>
            <p className="bloc-texte">{fiche.notesInternes}</p>
          </div>
        )}
      </Panneau>

      <Panneau titre="Projets" sousTitre="Les projets auxquels ses tâches et ses missions appartiennent" serre>
        <Tableau
          lignes={projets}
          colonnes={[
            {
              cle: 'nom',
              titre: 'Projet',
              rendu: (p) => (
                <Link className="table__lien" to={`/admin/projects/${p.id}`}>
                  {p.nom}
                </Link>
              ),
            },
            { cle: 'taches', titre: 'Tâches', aligne: 'droite', rendu: (p) => fmt.nombre(p.taches) },
            { cle: 'missions', titre: 'Missions', aligne: 'droite', rendu: (p) => fmt.nombre(p.missions) },
          ]}
          vide={<EtatVide titre="Aucun projet" texte="Il n’a encore pris aucune tâche ni rejoint de mission." />}
        />
      </Panneau>

      <Panneau titre="Tâches" sousTitre="Ce qu’il a pris en charge, et le projet de chaque tâche" serre>
        <Tableau
          empilable
          lignes={taches}
          colonnes={[
            {
              cle: 'titre',
              titre: 'Tâche',
              rendu: (t) => (
                <div>
                  <div className="table__principal">{t.titre}</div>
                  {t.description && <div className="table__secondaire">{fmt.tronquer(t.description, 70)}</div>}
                </div>
              ),
            },
            {
              cle: 'projetNom',
              titre: 'Projet',
              rendu: (t) => (
                <Link className="table__lien" to={`/admin/projects/${t.projetId}?onglet=taches`}>
                  {t.projetNom}
                </Link>
              ),
            },
            {
              cle: 'statut',
              titre: 'Statut',
              rendu: (t) => <Badge valeur={t.statut} libelles={STATUTS_TACHE} couleur={COULEURS_TACHE[t.statut]} />,
            },
            { cle: 'echeance', titre: 'Date de fin', rendu: (t) => fmt.date(t.echeance) },
            { cle: 'priseLe', titre: 'Prise le', rendu: (t) => fmt.date(t.priseLe) },
            { cle: 'livreeLe', titre: 'Livrée le', rendu: (t) => fmt.date(t.livreeLe) },
          ]}
          vide={<EtatVide titre="Aucune tâche" texte="Les tâches qu’il prendra dans son espace apparaîtront ici." />}
        />
      </Panneau>

      {missions.length > 0 && (
        <Panneau titre="Missions" sousTitre="Les missions auxquelles il s’est inscrit" serre>
          <Tableau
            empilable
            lignes={missions}
            colonnes={[
              {
                cle: 'titre',
                titre: 'Mission',
                rendu: (m) => (
                  <div>
                    <div className="table__principal">{m.titre}</div>
                    <div className="table__secondaire">
                      {[FORMATS_MISSION[m.format], m.lieuNom].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                ),
              },
              {
                cle: 'projetNom',
                titre: 'Projet',
                rendu: (m) => (
                  <Link className="table__lien" to={`/admin/projects/${m.projetId}`}>
                    {m.projetNom}
                  </Link>
                ),
              },
              { cle: 'dateDebut', titre: 'Date', rendu: (m) => fmt.date(m.dateDebut) },
              {
                cle: 'statut',
                titre: 'Inscription',
                rendu: (m) => <Badge valeur={m.statut} libelles={STATUTS_INSCRIPTION} />,
              },
              {
                cle: 'heuresValidees',
                titre: 'Heures validées',
                aligne: 'droite',
                rendu: (m) => (m.heuresValidees != null ? `${fmt.nombre(m.heuresValidees, 1)} h` : '—'),
              },
            ]}
          />
        </Panneau>
      )}
    </>
  );
}

function ChiffresBailleur({ bailleur }) {
  const { engagements, projets, totaux } = bailleur;
  return (
    <div className="resume-financier profil__chiffres">
      <Chiffre libelle="Montant engagé" valeur={montants(totaux, 'engage')} detail="Soutiens financiers promis" />
      <Chiffre libelle="Reçu" valeur={montants(totaux, 'recu')} detail="Versements arrivés" />
      <Chiffre libelle="Affecté aux projets" valeur={montants(totaux, 'affecte')} detail="Réparti entre les projets" />
      <Chiffre
        libelle="Projets financés"
        valeur={fmt.nombre(new Set(projets.map((p) => p.id)).size)}
        detail={`${engagements.length} engagement(s)`}
      />
    </div>
  );
}

function OrganisationBailleur({ organisation }) {
  return (
    <Panneau titre="Organisation">
      <dl className="fiche">
        <LigneFiche terme="Nom de l’entreprise">{organisation.raisonSociale}</LigneFiche>
        <LigneFiche terme="Type">{TYPES_ORGANISATION[organisation.typeOrganisation] ?? organisation.typeOrganisation}</LigneFiche>
        <LigneFiche terme="Secteur">{organisation.secteur}</LigneFiche>
        <LigneFiche terme="Pays">{organisation.pays}</LigneFiche>
        <LigneFiche terme="Adresse">{organisation.adresse}</LigneFiche>
        <LigneFiche terme="Site web">
          {organisation.siteWeb && (
            <a className="table__lien" href={organisation.siteWeb} target="_blank" rel="noreferrer noopener">
              {organisation.siteWeb}
            </a>
          )}
        </LigneFiche>
        <LigneFiche terme="NIF">{organisation.nif}</LigneFiche>
        <LigneFiche terme="Partenaire depuis">{fmt.date(organisation.partenaireDepuis)}</LigneFiche>
        <LigneFiche terme="Partenariat">
          <Badge
            valeur={organisation.statut}
            libelles={STATUTS_ORGANISATION}
            couleur={organisation.statut === 'actif' ? 'vert' : 'gris'}
          />
        </LigneFiche>
        <LigneFiche terme="Niveau">{NIVEAUX[organisation.niveau]}</LigneFiche>
      </dl>
      {organisation.notesInternes && (
        <div className="profil__notes">
          <p className="profil__notes-titre">Notes internes — réservées à l’équipe</p>
          <p className="bloc-texte">{organisation.notesInternes}</p>
        </div>
      )}
    </Panneau>
  );
}

function ProfilBailleur({ bailleur }) {
  const { engagements, versements, projets } = bailleur;

  return (
    <>
      <Panneau titre="Projets financés" sousTitre="Ce que ses engagements ont affecté à chaque projet" serre>
        <Tableau
          lignes={projets}
          cleLigne={(p) => `${p.id}-${p.devise}`}
          colonnes={[
            {
              cle: 'nom',
              titre: 'Projet',
              rendu: (p) => (
                <div>
                  <Link className="table__lien" to={`/admin/projects/${p.id}?onglet=financement`}>
                    {p.nom}
                  </Link>
                  <div className="table__secondaire">{p.reference}</div>
                </div>
              ),
            },
            {
              cle: 'engagements',
              titre: 'Engagement',
              rendu: (p) => (p.engagements ?? []).join(' · '),
            },
            { cle: 'derniereAffectation', titre: 'Affecté le', rendu: (p) => fmt.date(p.derniereAffectation) },
            {
              cle: 'montant',
              titre: 'Somme financée',
              aligne: 'droite',
              rendu: (p) => <strong>{fmt.montant(p.montant, p.devise)}</strong>,
            },
          ]}
          vide={<EtatVide titre="Aucun projet financé" texte="Ses engagements n’ont encore été affectés à aucun projet." />}
        />
      </Panneau>

      <Panneau titre="Engagements" sousTitre="Ce qu’il a promis, et où en est chaque engagement" serre>
        <Tableau
          lignes={engagements}
          colonnes={[
            {
              cle: 'intitule',
              titre: 'Engagement',
              rendu: (e) => (
                <div>
                  <div className="table__principal">{e.intitule}</div>
                  <div className="table__secondaire">
                    {e.referenceConvention ? `Convention ${e.referenceConvention}` : 'Sans convention'}
                  </div>
                </div>
              ),
            },
            {
              cle: 'typeSoutien',
              titre: 'Soutien',
              rendu: (e) => <Badge valeur={e.typeSoutien} libelles={TYPES_SOUTIEN} couleur="gris" />,
            },
            {
              cle: 'montantEngage',
              titre: 'Engagé',
              aligne: 'droite',
              rendu: (e) =>
                e.typeSoutien === 'financier'
                  ? fmt.montant(e.montantEngage, e.devise)
                  : `${fmt.nombre(e.quantiteEngagee)} ${e.unite ?? ''}`,
            },
            {
              cle: 'montantRecu',
              titre: 'Reçu',
              aligne: 'droite',
              rendu: (e) => (e.typeSoutien === 'financier' ? fmt.montant(e.montantRecu, e.devise) : '—'),
            },
            {
              cle: 'montantAffecte',
              titre: 'Affecté',
              aligne: 'droite',
              rendu: (e) => (e.typeSoutien === 'financier' ? fmt.montant(e.montantAffecte, e.devise) : '—'),
            },
            {
              cle: 'periode',
              titre: 'Période',
              rendu: (e) => `${fmt.date(e.dateDebut)} → ${e.dateFin ? fmt.date(e.dateFin) : '…'}`,
            },
            {
              cle: 'statut',
              titre: 'Statut',
              rendu: (e) => (
                <Badge valeur={e.statut} libelles={STATUTS_ENGAGEMENT} couleur={COULEURS_ENGAGEMENT[e.statut]} />
              ),
            },
          ]}
          vide={<EtatVide titre="Aucun engagement" texte="Les engagements signés avec ce bailleur apparaîtront ici." />}
        />
      </Panneau>

      {versements.length > 0 && (
        <Panneau titre="Versements" sousTitre="Les tranches reçues et attendues" serre>
          <Tableau
            lignes={versements}
            colonnes={[
              {
                cle: 'engagementIntitule',
                titre: 'Versement',
                rendu: (v) => (
                  <div>
                    <div className="table__principal">
                      {v.numeroTranche ? `Tranche ${v.numeroTranche}` : 'Versement'}
                    </div>
                    <div className="table__secondaire">{v.engagementIntitule}</div>
                  </div>
                ),
              },
              { cle: 'datePrevue', titre: 'Prévu le', rendu: (v) => fmt.date(v.datePrevue) },
              { cle: 'dateRecue', titre: 'Reçu le', rendu: (v) => fmt.date(v.dateRecue) },
              { cle: 'moyen', titre: 'Moyen', rendu: (v) => MOYENS_VERSEMENT[v.moyen] ?? '—' },
              {
                cle: 'montant',
                titre: 'Montant',
                aligne: 'droite',
                rendu: (v) => <strong>{fmt.montant(v.montant, v.devise)}</strong>,
              },
              {
                cle: 'statut',
                titre: 'Statut',
                rendu: (v) => (
                  <Badge valeur={v.statut} libelles={STATUTS_VERSEMENT} couleur={COULEURS_VERSEMENT[v.statut]} />
                ),
              },
            ]}
          />
        </Panneau>
      )}
    </>
  );
}

export default function ProfilUtilisateurPage() {
  const { genre, id } = useParams();
  const [parametres] = useSearchParams();
  const navigate = useNavigate();

  const { donnees: profil, chargement, erreur, recharger } = useChargement(
    () => (genre === 'fiche' ? utilisateursService.profilFiche(id) : utilisateursService.profilCompte(id)),
    [genre, id]
  );
  const { donnees: catalogue } = useChargement(() => catalogService.recuperer(), []);
  const libelles = catalogue?.labels ?? {};
  const { soumettre, envoi, erreur: erreurConsultation, setErreur } = useSoumission();

  const roles = profil?.roles ?? [];
  const depuis = parametres.get('depuis');
  const role =
    genre === 'fiche'
      ? 'donateur'
      : (roles.find((r) => ONGLET_DU_ROLE[r] === depuis) ??
        ['donateur', 'benevole', 'bailleur'].find((r) => roles.includes(r)) ??
        'donateur');
  const onglet = ONGLET_DU_ROLE[role];

  const gestion = useGestionUtilisateur({
    onModifie: recharger,
    onStatut: recharger,
    onSupprime: () => navigate(`/admin/utilisateurs?onglet=${onglet}`, { replace: true }),
    libelles,
  });

  if (chargement && !profil) return <Chargement texte="Chargement du profil…" />;
  if (erreur) return <Alerte>{erreur}</Alerte>;
  if (!profil) return null;

  const fiche = profil.fiche;
  const compte = profil.compte;
  const organisation = profil.bailleur?.organisation;
  const personne = compte ? `${compte.prenom ?? ''} ${compte.nom ?? ''}`.trim() : '';

  const nom =
    genre === 'fiche'
      ? fiche.organizationName || `${fiche.firstName ?? ''} ${fiche.lastName ?? ''}`.trim()
      : role === 'bailleur'
        ? organisation?.raisonSociale || personne
        : role === 'donateur'
          ? profil.donateur?.parcours?.nomStructure || personne
          : personne;

  const statut =
    genre === 'fiche'
      ? fiche.compteStatut === 'ACTIVE'
        ? 'fiche_compte'
        : fiche.compteStatut === 'SUSPENDED'
          ? 'fiche_suspendue'
          : 'fiche'
      : compte.statut;

  const cible = { genre, id, nom: nom || null, onglet, profil };
  const gereLAcces = genre === 'compte' && role !== 'donateur';
  const parcours = profil.donateur?.parcours;

  return (
    <>
      <EntetePage
        fil={[
          { label: 'Utilisateurs', to: `/admin/utilisateurs?onglet=${onglet}` },
          { label: nom || 'Profil' },
        ]}
        titre={nom || 'Nom à renseigner'}
        visuel={
          <Visage
            src={compte?.photoUrl ?? null}
            nom={personne || nom}
            taille="grand"
          />
        }
        accroche={
          <span className="profil__accroche">
            <Badge valeur={role} libelles={LIBELLES_ROLE} couleur="violet" />
            <Badge
              valeur={statut}
              libelles={LIBELLES_STATUT}
              couleur={STATUTS_UTILISATEUR[statut]?.couleur}
            />
            {genre === 'fiche' && <span>Donateur enregistré par l’équipe HOPE</span>}
            {role === 'bailleur' && personne && <span>Représenté par {personne}</span>}
          </span>
        }
        actions={
          <>
            {genre === 'compte' && ['actif', 'en_attente'].includes(compte.statut) && (
              <BoutonMessage
                api={api}
                racine="/admin"
                cheminMessages="/admin/conversations"
                cible={
                  role === 'bailleur' && organisation
                    ? { entreprise: organisation.id }
                    : { personne: { type: 'utilisateur', id: compte.id } }
                }
                onErreur={setErreur}
              />
            )}
            {genre === 'compte' && compte.statut === 'actif' && (
              <button
                type="button"
                className="btn btn--neutre"
                disabled={envoi}
                onClick={() =>
                  soumettre(() => consultationService.consulter(compte.id), {
                    onSucces: (session) => navigate(session.espace),
                  })
                }
              >
                Consulter son espace
              </button>
            )}
            {gereLAcces && compte.statut !== 'actif' && (
              <button
                type="button"
                className="btn btn--principal"
                onClick={() => gestion.demander('activer', cible)}
                disabled={gestion.envoi}
              >
                Activer le compte
              </button>
            )}
            {gereLAcces && compte.statut === 'actif' && (
              <button type="button" className="btn btn--neutre" onClick={() => gestion.demander('desactiver', cible)}>
                Désactiver le compte
              </button>
            )}
            <button type="button" className="btn btn--neutre" onClick={() => gestion.demander('modifier', cible)}>
              Modifier
            </button>
            <button type="button" className="btn btn--danger" onClick={() => gestion.demander('supprimer', cible)}>
              Supprimer
            </button>
          </>
        }
      />

      {(gestion.erreur || erreurConsultation) && <Alerte>{gestion.erreur || erreurConsultation}</Alerte>}

      {role === 'donateur' && <ChiffresDons dons={genre === 'fiche' ? profil : profil.donateur} />}
      {role === 'benevole' && profil.benevole && <ChiffresBenevole benevole={profil.benevole} />}
      {role === 'bailleur' && profil.bailleur && <ChiffresBailleur bailleur={profil.bailleur} />}

      {role === 'bailleur' && organisation && <OrganisationBailleur organisation={organisation} />}

      {genre === 'fiche' ? (
        <Panneau titre="Coordonnées">
          <dl className="fiche">
            <LigneFiche terme="Organisation">{fiche.organizationName}</LigneFiche>
            <LigneFiche terme="Prénom">{fiche.firstName}</LigneFiche>
            <LigneFiche terme="Nom">{fiche.lastName}</LigneFiche>
            <LigneFiche terme="Adresse électronique">{fiche.email}</LigneFiche>
            <LigneFiche terme="Téléphone">{fiche.phone}</LigneFiche>
            <LigneFiche terme="Ville">{fiche.city}</LigneFiche>
            <LigneFiche terme="Pays">{fiche.country}</LigneFiche>
            <LigneFiche terme="Origine">{ORIGINES[fiche.origin]}</LigneFiche>
            <LigneFiche terme="Enregistré le">{fmt.date(fiche.createdAt)}</LigneFiche>
            <LigneFiche terme="Compte donateur">
              {fiche.compteId
                ? `${fiche.compteStatut === 'ACTIVE' ? 'Actif' : 'Suspendu'} · ${fiche.compteEmail}`
                : 'Aucun'}
            </LigneFiche>
          </dl>
        </Panneau>
      ) : (
        <Panneau titre={role === 'bailleur' ? 'Contact' : 'Coordonnées'}>
          <dl className="fiche">
            <LigneFiche terme="Prénom">{compte.prenom || null}</LigneFiche>
            <LigneFiche terme="Nom">{compte.nom || null}</LigneFiche>
            {role === 'bailleur' && <LigneFiche terme="Fonction">{organisation?.fonction}</LigneFiche>}
            <LigneFiche terme="Adresse électronique">
              {compte.email}{' '}
              <Badge
                valeur={compte.emailVerifieLe ? 'OUI' : 'NON'}
                libelles={{ OUI: 'confirmée', NON: 'non confirmée' }}
                couleur={compte.emailVerifieLe ? 'vert' : 'ambre'}
              />
            </LigneFiche>
            <LigneFiche terme="Téléphone">{compte.telephone}</LigneFiche>
            <LigneFiche terme="Adresse">{compte.adresse}</LigneFiche>
            {role === 'donateur' && (
              <>
                <LigneFiche terme="Ville">{parcours?.ville}</LigneFiche>
                <LigneFiche terme="Pays">{parcours?.pays ? nomDuPays(parcours.pays) : null}</LigneFiche>
                <LigneFiche terme="Profession">{parcours?.profession}</LigneFiche>
              </>
            )}
            {role === 'benevole' && (
              <LigneFiche terme="Date de naissance">{compte.dateDeNaissance && fmt.date(compte.dateDeNaissance)}</LigneFiche>
            )}
            <LigneFiche terme="Inscrit le">{fmt.date(compte.creeLe)}</LigneFiche>
            <LigneFiche terme="Dernière connexion">
              {compte.derniereConnexion ? fmt.depuis(compte.derniereConnexion) : 'Jamais'}
            </LigneFiche>
            {compte.activeLe && (
              <LigneFiche terme="Compte activé">
                {fmt.date(compte.activeLe)}
                {compte.activeParLog ? ` par ${compte.activeParLog}` : ''}
              </LigneFiche>
            )}
            {roles.length > 1 && (
              <LigneFiche terme="Rôles">{roles.map((r) => LIBELLES_ROLE[r] ?? r).join(', ')}</LigneFiche>
            )}
          </dl>
        </Panneau>
      )}

      {role === 'donateur' && genre === 'compte' && parcours && (
        <>
          <Panneau titre="Profil donateur" sousTitre="Ce qu’il a indiqué dans son parcours d’accueil">
            <dl className="fiche">
              <LigneFiche terme="Type de donateur">{parcours.typeLibelle}</LigneFiche>
              <LigneFiche terme="Structure">{parcours.nomStructure}</LigneFiche>
              <LigneFiche terme="Site web">{parcours.siteWeb}</LigneFiche>
              <LigneFiche terme="Devise préférée">{parcours.devise}</LigneFiche>
              <LigneFiche terme="Langue">{parcours.langueLibelle}</LigneFiche>
              <LigneFiche terme="Fuseau horaire">
                {parcours.fuseauHoraire ? libelleFuseau(parcours.fuseauHoraire) : null}
              </LigneFiche>
              <LigneFiche terme="A connu HOPE par">{parcours.sourceLibelle}</LigneFiche>
              <LigneFiche terme="Parcours d’accueil">
                {parcours.termine ? 'Terminé' : `En cours — étape ${parcours.etapeSuivante} sur 5`}
              </LigneFiche>
            </dl>
          </Panneau>

          <Panneau titre="Intention de don" sousTitre="Comment il souhaite donner">
            <dl className="fiche">
              <LigneFiche terme="Affectation">{parcours.affectationLibelle}</LigneFiche>
              <LigneFiche terme="Projet choisi">
                {parcours.projetId && (
                  <Link className="table__lien" to={`/admin/projects/${parcours.projetId}`}>
                    {parcours.projetNom}
                  </Link>
                )}
              </LigneFiche>
              <LigneFiche terme="Mode de paiement">{parcours.modePaiementLibelle}</LigneFiche>
              <LigneFiche terme="Fréquence">{parcours.frequenceLibelle}</LigneFiche>
            </dl>
          </Panneau>
        </>
      )}

      {role === 'donateur' && (
        <DonsDuDonateur
          dons={genre === 'fiche' ? profil : profil.donateur}
          libelles={libelles}
          depuisUneAdresse={genre === 'compte'}
        />
      )}

      {role === 'benevole' && profil.benevole && <ProfilBenevole benevole={profil.benevole} />}

      {role === 'bailleur' && profil.bailleur && <ProfilBailleur bailleur={profil.bailleur} />}

      {gestion.fenetres}
    </>
  );
}
