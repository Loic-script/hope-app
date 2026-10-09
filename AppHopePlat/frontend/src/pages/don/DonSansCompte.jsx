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
import IntroductionDon from './IntroductionDon.jsx';

export const BASE_DON_INVITE = '/faire-un-don';

const NOMBRE_ETAPES = 3;

const VIDE = { informations: {}, don: {}, paiement: {} };

export default function DonSansCompte() {
  const navigate = useNavigate();
  const emplacement = useLocation();
  const reprise = emplacement.state?.reprise ?? null;

  const { donnees: options, chargement, erreur } = useChargement(() => donInviteService.options(), []);

  const [etape, setEtape] = useState(reprise ? NOMBRE_ETAPES : 0);
  const [valeurs, setValeurs] = useState(() => reprise ?? VIDE);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  function allerA(numero) {
    setEtape(numero);
    const sobre = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: sobre ? 'auto' : 'smooth' });
  }

  function retenir(cle, saisie) {
    setValeurs((precedentes) => ({ ...precedentes, [cle]: saisie }));
  }

  const modes = (options?.modesPaiement ?? []).filter((mode) => PAGES_DE_PAIEMENT[mode.cle]);
  const projets = options?.projets ?? [];
  const pays = valeurs.informations?.pays || PAYS_PAR_DEFAUT;

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

        {etape === 0 && <IntroductionDon onCommencer={() => allerA(1)} />}

        {etape > 0 && chargement && !options && (
          <p className="parcours__attente" role="status">
            Préparation de votre don…
          </p>
        )}
        {erreur && (
          <p className="parcours__alerte" role="alert">
            {erreur}
          </p>
        )}

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

        {options && etape > 0 && (
          <p className="parcours__note parcours__note--invite">
            Vous donnez régulièrement ? <Link to="/authentification">Créez un compte</Link> pour suivre vos dons et
            donner chaque mois.
          </p>
        )}
      </main>
    </div>
  );
}
