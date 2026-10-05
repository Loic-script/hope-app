import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import HopeLogo from '../../components/HopeLogo.jsx';
import { RayonsDecor } from '../../components/parcours/champs.jsx';
import { useChargement } from '../../hooks/useChargement.js';
import * as donInviteService from '../../services/donInvite.service.js';
import { PAGES_DE_PAIEMENT, pageDePaiement } from '../../utils/pagesPaiement.js';
import { devisePourPays } from '../../utils/fuseaux.js';
import { PAYS_PAR_DEFAUT } from '../../utils/pays.js';
import { EtapeAffectation, EtapeInformations, EtapePaiement } from '../donateur/Parcours.jsx';

/**
 * Faire un don sans compte, depuis le site vitrine.
 *
 * Le meme habit que le parcours d'accueil du donateur, en trois etapes :
 * qui vous etes (avec votre courriel, pour le recu), a quoi va votre
 * don, comment vous payez. Puis la page du moyen choisi -- MVola, carte,
 * virement... -- demande le montant, enregistre le don et fait payer.
 *
 * Rien n'est enregistre avant la page de paiement : les etapes se
 * gardent ici, et une page de paiement quittee par "Retour" ramene a la
 * troisieme etape avec tout ce qui a ete saisi (state.reprise).
 *
 * Les dons sans compte sont ponctuels ; pour donner chaque mois et
 * suivre ses dons, on cree un compte (lien "Se connecter").
 */

/** La base des pages de paiement de ce parcours (routes/index.jsx). */
export const BASE_DON_INVITE = '/faire-un-don';

const NOMBRE_ETAPES = 3;

const VIDE = { informations: {}, don: {}, paiement: {} };

export default function DonSansCompte() {
  const navigate = useNavigate();
  const emplacement = useLocation();
  const reprise = emplacement.state?.reprise ?? null;

  const { donnees: options, chargement, erreur } = useChargement(() => donInviteService.options(), []);

  const [etape, setEtape] = useState(reprise ? NOMBRE_ETAPES : 1);
  const [valeurs, setValeurs] = useState(() => reprise ?? VIDE);

  // La page s'ouvre en haut, meme quand on arrive du bas du site.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  /** Change d'etape en ramenant le haut de la page sous les yeux. */
  function allerA(numero) {
    setEtape(numero);
    const sobre = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: sobre ? 'auto' : 'smooth' });
  }

  function retenir(cle, saisie) {
    setValeurs((precedentes) => ({ ...precedentes, [cle]: saisie }));
  }

  // Seuls les moyens qui ont leur page se proposent : c'est elle qui
  // demande le montant et enregistre le don.
  const modes = (options?.modesPaiement ?? []).filter((mode) => PAGES_DE_PAIEMENT[mode.cle]);
  const projets = options?.projets ?? [];
  const pays = valeurs.informations?.pays || PAYS_PAR_DEFAUT;

  /** La troisieme etape franchie : la page du moyen choisi, le don en brouillon. */
  function versLaPage(mode) {
    const page = pageDePaiement(BASE_DON_INVITE, mode);
    if (!page) return;
    const { informations, don } = valeurs;
    const projet = don.affectation === 'PROJECT' ? projets.find((p) => p.id === don.projetId) : null;
    const devises = (options?.devises ?? []).map((d) => d.code);
    const devise = devisePourPays(informations.pays);
    navigate(page, {
      state: {
        brouillon: {
          mode,
          affectation: don.affectation || 'HOPE',
          projetId: don.affectation === 'PROJECT' ? don.projetId : undefined,
          projetNom: projet?.nom,
          montant: null,
          devise: devises.includes(devise) ? devise : 'MGA',
          frequence: 'ONE_TIME',
          personne: {
            prenom: informations.prenom,
            nom: informations.nom,
            email: informations.courriel,
            telephone: informations.telephone,
            ville: informations.ville,
            pays: informations.pays,
          },
          // De quoi revenir a la troisieme etape sans rien perdre.
          reprise: { ...valeurs, paiement: { mode } },
        },
      },
    });
  }

  return (
    <div className="parcours parcours--invite">
      <RayonsDecor className="parcours__rayons parcours__rayons--gauche" />
      <RayonsDecor className="parcours__rayons parcours__rayons--droite" />

      <main className="parcours__colonne">
        <Link to="/" className="parcours__quitter" aria-label="Revenir au site HOPE">
          <span aria-hidden="true">×</span>
        </Link>
        <HopeLogo className="parcours__logo" />

        {chargement && !options && (
          <p className="parcours__attente" role="status">
            Préparation de votre don…
          </p>
        )}
        {erreur && (
          <p className="parcours__alerte" role="alert">
            {erreur}
          </p>
        )}

        {/* La cle relance l'animation d'entree a chaque changement d'etape. */}
        {options && etape === 1 && (
          <EtapeInformations
            key="etape-1"
            variante="invite"
            total={NOMBRE_ETAPES}
            initiales={valeurs.informations}
            sources={[]}
            enregistrer={async (informations) => informations}
            onSuivante={(informations) => {
              retenir('informations', informations);
              allerA(2);
            }}
          />
        )}
        {options && etape === 2 && (
          <EtapeAffectation
            key="etape-2"
            etape={2}
            total={NOMBRE_ETAPES}
            initiales={valeurs.don}
            chargerProjets={async () => ({ items: projets })}
            enregistrer={async (choix) => ({ don: choix })}
            onRetour={(choix) => {
              retenir('don', choix);
              allerA(1);
            }}
            onSuivante={(reponse) => {
              retenir('don', reponse.don);
              allerA(3);
            }}
          />
        )}
        {options && etape === 3 && (
          <EtapePaiement
            key="etape-3"
            etape={3}
            total={NOMBRE_ETAPES}
            initiales={valeurs.paiement}
            pays={pays}
            modes={modes}
            enregistrer={async ({ mode }) => ({ paiement: { mode } })}
            onRetour={(choix) => {
              retenir('paiement', choix);
              allerA(2);
            }}
            onSuivante={(reponse) => {
              retenir('paiement', reponse.paiement);
              versLaPage(reponse.paiement.mode);
            }}
          />
        )}

        {options && (
          <p className="parcours__note parcours__note--invite">
            Vous donnez régulièrement ? <Link to="/authentification">Créez un compte</Link> pour suivre vos dons et
            donner chaque mois.
          </p>
        )}
      </main>
    </div>
  );
}
