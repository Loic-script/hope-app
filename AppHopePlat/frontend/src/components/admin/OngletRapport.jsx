import { useState } from 'react';

import FeuilleRapport from '../FeuilleRapport.jsx';
import { Modale, ModaleConfirmation } from './forms.jsx';
import { Alerte, Chargement, EtatVide, Panneau, Tableau } from './ui.jsx';
import { useChargement, useSoumission } from '../../hooks/useChargement.js';
import { messageErreur } from '../../services/api.js';
import * as projectService from '../../services/project.service.js';
import * as fmt from '../../utils/format.js';

export default function OngletRapport({ projet }) {
  const { donnees, chargement, erreur, recharger } = useChargement(
    () => projectService.recupererRapport(projet.id),
    [projet.id]
  );
  const { envoi, erreur: erreurEnvoi, setErreur, soumettre } = useSoumission();

  const [confirmation, setConfirmation] = useState(false);
  const [succes, setSucces] = useState('');
  const [refusPdf, setRefusPdf] = useState('');
  const [pdfEnCours, setPdfEnCours] = useState(false);

  const [relu, setRelu] = useState(null);
  const [contenuRelu, setContenuRelu] = useState(null);
  const [refusRelu, setRefusRelu] = useState('');

  if (chargement) return <Chargement texte="Composition du rapport…" />;
  if (erreur) return <Alerte>{erreur}</Alerte>;
  if (!donnees) return null;

  const { rapport, bailleurs, publies } = donnees;
  const destinataires = bailleurs.map((b) => b.raisonSociale).join(', ');

  async function telechargerPdf() {
    setRefusPdf('');
    setPdfEnCours(true);
    try {
      await projectService.telechargerRapportPdf(projet.id, projet.reference);
    } catch (echec) {
      setRefusPdf(messageErreur(echec, 'Le PDF du rapport n’a pas pu être préparé.'));
    } finally {
      setPdfEnCours(false);
    }
  }

  async function envoyer() {
    setSucces('');
    const resultat = await soumettre(() => projectService.publierRapport(projet.id));
    if (!resultat) return;
    setConfirmation(false);
    const noms = resultat.destinataires.join(', ');
    setSucces(
      resultat.publies > 1
        ? `Rapport envoyé à ${resultat.publies} bailleurs : ${noms}.`
        : `Rapport envoyé à ${noms}.`
    );
    recharger();
  }

  async function relire(document) {
    setRelu(document);
    setContenuRelu(null);
    setRefusRelu('');
    try {
      setContenuRelu(await projectService.contenuRapportPublie(projet.id, document.id));
    } catch (echec) {
      setRefusRelu(messageErreur(echec, 'Le rapport n’a pas pu être ouvert.'));
    }
  }

  const colonnes = [
    {
      cle: 'titre',
      titre: 'Rapport',
      rendu: (d) => <div className="table__principal">{d.titre}</div>,
    },
    { cle: 'bailleur', titre: 'Bailleur' },
    { cle: 'publieLe', titre: 'Envoyé le', rendu: (d) => fmt.date(d.publieLe) },
    {
      cle: 'lecture',
      titre: 'Lecture',
      rendu: (d) =>
        d.nbTelechargements > 0
          ? `Consulté ${d.nbTelechargements} fois, le dernier le ${fmt.date(d.telechargeLe)}`
          : 'Pas encore consulté',
    },
    {
      cle: 'actions',
      titre: 'Actions',
      rendu: (d) => (
        <div className="cellule-actions">
          <button type="button" className="lien-action" onClick={() => relire(d)}>
            Aperçu
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      {succes && <Alerte type="succes">{succes}</Alerte>}
      {refusPdf && <Alerte>{refusPdf}</Alerte>}

      <Panneau
        titre="Rapport du projet"
        sousTitre="Composé à partir des données saisies, à la date du jour. Aucun bénéficiaire ni donateur n’y est nommé."
        actions={
          <>
            <button
              type="button"
              className="btn btn--neutre"
              onClick={telechargerPdf}
              disabled={pdfEnCours}
            >
              {pdfEnCours ? 'Préparation…' : 'Télécharger le PDF'}
            </button>
            <button
              type="button"
              className="btn btn--principal"
              onClick={() => {
                setErreur('');
                setConfirmation(true);
              }}
              disabled={bailleurs.length === 0}
              title={bailleurs.length === 0 ? 'Aucun bailleur ne finance ce projet' : undefined}
            >
              Envoyer aux bailleurs
            </button>
          </>
        }
      >
        <div className="panneau__corps">
          <p className="rapport-destinataires">
            {bailleurs.length > 0 ? (
              <>
                <span className="rapport-destinataires__libelle">
                  {bailleurs.length > 1 ? 'Destinataires' : 'Destinataire'}
                </span>
                {destinataires}
              </>
            ) : (
              'Aucun bailleur n’a encore affecté de fonds à ce projet : le rapport peut être lu et téléchargé, mais il n’y a personne à qui l’envoyer.'
            )}
          </p>

          <FeuilleRapport
            titre={rapport.titre}
            sousTitre={rapport.sousTitre}
            blocs={rapport.blocs}
            pleine
          />
        </div>
      </Panneau>

      <Panneau
        titre="Rapports envoyés"
        sousTitre="Ce que chaque bailleur a reçu, et s’il l’a consulté."
      >
        <Tableau
          colonnes={colonnes}
          lignes={publies}
          vide={
            <EtatVide
              titre="Aucun rapport envoyé"
              texte="Les rapports envoyés aux bailleurs de ce projet apparaîtront ici."
            />
          }
        />
      </Panneau>

      <ModaleConfirmation
        ouverte={confirmation}
        titre="Envoyer le rapport du jour"
        message={`Le rapport sera déposé dans l’espace de ${destinataires}. Chaque bailleur pourra le lire en ligne et le télécharger.`}
        libelleConfirmer="Envoyer"
        envoi={envoi}
        erreur={erreurEnvoi}
        onFermer={() => setConfirmation(false)}
        onConfirmer={envoyer}
      />

      <Modale
        ouverte={Boolean(relu)}
        titre={relu?.titre ?? ''}
        sousTitre={relu ? `Envoyé à ${relu.bailleur} le ${fmt.date(relu.publieLe)}` : ''}
        onFermer={() => setRelu(null)}
        large
        pied={
          <button type="button" className="btn btn--neutre" onClick={() => setRelu(null)}>
            Fermer
          </button>
        }
      >
        {refusRelu && <p className="feuille__note feuille__note--echec">{refusRelu}</p>}
        {!refusRelu && !contenuRelu && <p className="feuille__note">Ouverture du rapport…</p>}
        {contenuRelu && (
          <FeuilleRapport
            titre={contenuRelu.titre}
            sousTitre={contenuRelu.sousTitre}
            blocs={contenuRelu.blocs}
          />
        )}
      </Modale>
    </>
  );
}
