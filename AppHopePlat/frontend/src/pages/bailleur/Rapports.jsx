import { useState } from 'react';

import { useChargement } from '../../hooks/useChargement.js';
import { messageErreur, urlMedia } from '../../services/api.js';
import * as service from '../../services/bailleur.service.js';
import * as fmt from '../../utils/format.js';
import { EntetePage, Panneau, Pastille, TYPES_DOCUMENT } from './composants.jsx';

/** Les trois onglets demandes, sur le champ "type". */
const ONGLETS = [
  { cle: 'rapport_impact', label: 'Rapports d’impact' },
  { cle: 'justificatif_financier', label: 'Justificatifs financiers' },
  { cle: 'tous', label: 'Tous' },
];

/**
 * Rapports et justificatifs.
 *
 * Chaque telechargement est enregistre : HOPE sait ainsi si ses
 * rapports sont reellement lus. Le compteur affiche sur chaque ligne
 * est celui du bailleur, pas un total global.
 */
export default function Rapports() {
  const [onglet, setOnglet] = useState('rapport_impact');
  const { donnees, chargement, erreur, recharger } = useChargement(
    () => service.documents(onglet === 'tous' ? {} : { type: onglet }),
    [onglet]
  );

  const [envoi, setEnvoi] = useState(false);
  const [refus, setRefus] = useState('');
  const [message, setMessage] = useState('');

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
        accroche="Les pièces produites par HOPE sur l’emploi de vos financements."
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
                    {document.nbPages && ` · ${document.nbPages} pages`}
                    {document.engagementIntitule && ` · ${document.engagementIntitule}`}
                  </p>

                  <p className="document__lecture">
                    {document.nbTelechargements === 0
                      ? 'Pas encore consulté'
                      : `Consulté ${document.nbTelechargements} fois — la dernière le ${fmt.date(document.telechargeLe)}`}
                  </p>
                </div>

                <button
                  type="button"
                  className="bouton-bailleur bouton-bailleur--discret"
                  onClick={() => telecharger(document)}
                  disabled={envoi}
                >
                  Télécharger
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panneau>
    </>
  );
}
