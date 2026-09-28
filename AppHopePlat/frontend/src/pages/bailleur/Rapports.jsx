import { useState } from 'react';

import ApercuRapport from '../../components/ApercuRapport.jsx';
import { Modale } from '../../components/admin/forms.jsx';
import { useChargement } from '../../hooks/useChargement.js';
import { messageErreur, urlMedia } from '../../services/api.js';
import * as service from '../../services/bailleur.service.js';
import * as fmt from '../../utils/format.js';
import { EntetePage, Panneau, Pastille, TYPES_DOCUMENT } from './composants.jsx';
import { STATUTS_PROJET } from './Projets.jsx';
import FenetreRapportProjet from './RapportProjet.jsx';

/** Les trois onglets demandes, sur le champ "type". */
const ONGLETS = [
  { cle: 'rapport_impact', label: 'Rapports d’impact' },
  { cle: 'justificatif_financier', label: 'Justificatifs financiers' },
  { cle: 'tous', label: 'Tous' },
];

/**
 * Rapports et justificatifs.
 *
 * Deux parties. En tete, le rapport a jour de chaque projet visible :
 * compose avec les donnees du jour, il existe sans que l'equipe ait eu
 * a l'envoyer. Dessous, les documents que HOPE a adresses au bailleur.
 *
 * Chaque telechargement d'un document recu est enregistre : HOPE sait
 * ainsi si ses rapports sont reellement lus. Le compteur affiche sur
 * chaque ligne est celui du bailleur, pas un total global.
 */
export default function Rapports() {
  const [onglet, setOnglet] = useState('rapport_impact');
  const projets = useChargement(() => service.projets(), []);
  const [rapportDe, setRapportDe] = useState(null);
  const { donnees, chargement, recharger } = useChargement(
    () => service.documents(onglet === 'tous' ? {} : { type: onglet }),
    [onglet]
  );

  const [envoi, setEnvoi] = useState(false);
  const [refus, setRefus] = useState('');
  const [message, setMessage] = useState('');

  // Le document dont on regarde l'apercu. Le lire ne compte pas comme un
  // telechargement : on vient justement voir avant de decider.
  const [apercu, setApercu] = useState(null);

  const items = donnees?.items ?? [];
  const compteurs = donnees?.counts ?? {};

  /**
   * Enregistre le telechargement puis ouvre le fichier.
   *
   * L'ordre compte : on n'ouvre qu'une fois le compteur incremente,
   * sinon un refus cote serveur laisserait croire au succes.
   */
  async function telecharger(document) {
    setEnvoi(true);
    setRefus('');
    setMessage('');
    try {
      const resultat = await service.telechargerDocument(document.id);
      recharger();
      const adresse = urlMedia(resultat.fichierUrl);
      if (adresse) window.open(adresse, '_blank', 'noopener');
    } catch (echec) {
      setRefus(messageErreur(echec, 'Le téléchargement a échoué.'));
    } finally {
      setEnvoi(false);
    }
  }

  /** Le PDF du rapport a jour d'un projet, sans ouvrir la fenetre. */
  async function telechargerRapportProjet(projet) {
    setEnvoi(true);
    setRefus('');
    setMessage('');
    try {
      await service.telechargerRapportProjet(projet.id, projet.reference);
    } catch (echec) {
      setRefus(messageErreur(echec, 'Le PDF du rapport n’a pas pu être préparé.'));
    } finally {
      setEnvoi(false);
    }
  }

  async function genererCertificat() {
    setEnvoi(true);
    setRefus('');
    setMessage('');
    try {
      const certificat = await service.genererCertificat();
      setMessage(`Certificat ${certificat.reference} généré.`);
      setOnglet('tous');
      recharger();
    } catch (echec) {
      setRefus(messageErreur(echec, 'Le certificat n’a pas pu être généré.'));
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <>
      <EntetePage
        titre="Rapports"
        accroche="Le rapport à jour de chaque projet, et les pièces que HOPE vous a adressées."
        actions={
          <button
            type="button"
            className="bouton-bailleur"
            onClick={genererCertificat}
            disabled={envoi}
          >
            {envoi ? 'Génération…' : 'Générer mon certificat de partenariat'}
          </button>
        }
      />

      {refus && <p className="alerte-bailleur">{refus}</p>}
      {message && <p className="succes-bailleur">{message}</p>}

      <Panneau
        titre="Rapports des projets"
        sousTitre="Composés avec les données du jour : financement, dépenses, actions et résultats. Aucun bénéficiaire ni donateur n’y est nommé."
      >
        {projets.erreur ? (
          <p className="alerte-bailleur">{projets.erreur}</p>
        ) : projets.chargement && !projets.donnees ? (
          <p className="vide-bailleur">Chargement…</p>
        ) : (projets.donnees ?? []).length === 0 ? (
          <p className="vide-bailleur">Aucun projet pour l’instant.</p>
        ) : (
          <ul className="documents">
            {projets.donnees.map((projet) => {
              const statut = STATUTS_PROJET[projet.status] ?? STATUTS_PROJET.IN_PROGRESS;
              return (
                <li key={projet.id} className="document">
                  <div className="document__corps">
                    <div className="document__haut">
                      <Pastille teinte={statut.teinte}>{statut.libelle}</Pastille>
                      {projet.financeParMoi && <Pastille teinte="violet">Vous financez</Pastille>}
                    </div>

                    <h3 className="document__titre">{projet.name}</h3>

                    <p className="document__meta">
                      {[projet.reference, projet.categorie, projet.location]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>

                  <div className="document__actions">
                    <button
                      type="button"
                      className="bouton-bailleur bouton-bailleur--discret"
                      onClick={() => setRapportDe(projet)}
                    >
                      Lire
                    </button>
                    <button
                      type="button"
                      className="bouton-bailleur bouton-bailleur--discret"
                      onClick={() => telechargerRapportProjet(projet)}
                      disabled={envoi}
                    >
                      Télécharger le PDF
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panneau>

      <h2 className="groupe__titre rapports-bailleur__recus">Documents reçus</h2>

      <div className="onglets-bailleur" role="tablist">
        {ONGLETS.map((o) => (
          <button
            key={o.cle}
            type="button"
            role="tab"
            aria-selected={onglet === o.cle}
            className={`onglets-bailleur__bouton${
              onglet === o.cle ? ' onglets-bailleur__bouton--actif' : ''
            }`}
            onClick={() => setOnglet(o.cle)}
          >
            {o.label}
            <span className="onglets-bailleur__compte">{compteurs[o.cle] ?? 0}</span>
          </button>
        ))}
      </div>

      <Panneau>
        {chargement && items.length === 0 ? (
          <p className="vide-bailleur">Chargement…</p>
        ) : items.length === 0 ? (
          <p className="vide-bailleur">
            Aucun document dans cette catégorie. HOPE publie ses rapports à la fin de chaque
            période de reporting.
          </p>
        ) : (
          <ul className="documents">
            {items.map((document) => (
              <li key={document.id} className="document">
                <div className="document__corps">
                  <div className="document__haut">
                    <Pastille teinte={document.type === 'rapport_impact' ? 'violet' : 'bleu'}>
                      {TYPES_DOCUMENT[document.type]}
                    </Pastille>
                    {document.genereAuto && <Pastille teinte="gris">Généré</Pastille>}
                  </div>

                  <h3 className="document__titre">{document.titre}</h3>

                  <p className="document__meta">
                    {document.periodeDebut && document.periodeFin && (
                      <>
                        Période du {fmt.date(document.periodeDebut)} au{' '}
                        {fmt.date(document.periodeFin)} ·{' '}
                      </>
                    )}
                    Publié le {fmt.date(document.publieLe)}
                    {document.nbPages &&
                      ` · ${document.nbPages} page${document.nbPages > 1 ? 's' : ''}`}
                    {document.projetNom && ` · ${document.projetNom}`}
                    {document.engagementIntitule && ` · ${document.engagementIntitule}`}
                  </p>

                  <p className="document__lecture">
                    {document.nbTelechargements === 0
                      ? 'Pas encore consulté'
                      : `Consulté ${document.nbTelechargements} fois — la dernière le ${fmt.date(document.telechargeLe)}`}
                  </p>
                </div>

                <div className="document__actions">
                  {/* Voir avant de telecharger : un rapport d'impact se
                      parcourt d'abord, et le partenaire sait alors ce
                      qu'il enregistre. */}
                  <button
                    type="button"
                    className="bouton-bailleur bouton-bailleur--discret"
                    onClick={() => setApercu(document)}
                  >
                    Aperçu
                  </button>
                  <button
                    type="button"
                    className="bouton-bailleur bouton-bailleur--discret"
                    onClick={() => telecharger(document)}
                    disabled={envoi}
                  >
                    Télécharger
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panneau>

      {/*
        * L'apercu montre le rapport lui-meme, sans ouvrir son PDF.
        * Le compteur de lecture ne bouge qu'au telechargement : il sert a
        * HOPE pour savoir si ses rapports sont vraiment lus, et un coup
        * d'oeil n'est pas une lecture.
        */}
      <Modale
        ouverte={Boolean(apercu)}
        titre={apercu?.titre ?? ''}
        sousTitre={apercu ? sousTitreApercu(apercu) : ''}
        onFermer={() => setApercu(null)}
        large
        pied={
          <>
            <button
              type="button"
              className="bouton-bailleur bouton-bailleur--discret"
              onClick={() => setApercu(null)}
            >
              Fermer
            </button>
            <button
              type="button"
              className="bouton-bailleur"
              disabled={envoi}
              onClick={() => {
                const document_ = apercu;
                setApercu(null);
                telecharger(document_);
              }}
            >
              Télécharger
            </button>
          </>
        }
      >
        {apercu && <ApercuRapport documentId={apercu.id} />}
      </Modale>

      <FenetreRapportProjet projet={rapportDe} onFermer={() => setRapportDe(null)} />
    </>
  );
}

/** Ce que rappelle l'apercu sous le titre : la nature et la periode. */
function sousTitreApercu(document) {
  const morceaux = [TYPES_DOCUMENT[document.type] ?? document.type];
  if (document.periodeDebut && document.periodeFin) {
    morceaux.push(`période du ${fmt.date(document.periodeDebut)} au ${fmt.date(document.periodeFin)}`);
  }
  if (document.nbPages) {
    morceaux.push(`${document.nbPages} page${document.nbPages > 1 ? 's' : ''}`);
  }
  return morceaux.join(' · ');
}
