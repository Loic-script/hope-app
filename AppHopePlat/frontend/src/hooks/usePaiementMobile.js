import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';

import { messageErreur } from '../services/api.js';
import * as donateurService from '../services/donateur.service.js';
import * as fmt from '../utils/format.js';

/**
 * Le paiement mobile du parcours donateur, commun a MVola et a Orange
 * Money : chaque operateur a son habit (sa page), la mecanique est la
 * meme.
 *
 *   1. le montant, et le numero qui paiera ;
 *   2. l'envoi, depuis le code USSD de l'operateur, vers le numero de
 *      HOPE ; puis la reference que l'operateur renvoie par SMS ;
 *   3. le recu, et la suite du parcours.
 *
 * Le telephone n'est pas debite par la plateforme : le donateur envoie
 * lui-meme, et l'equipe rapproche la reference de son releve avant de
 * confirmer. Aucun code secret n'est jamais demande.
 */

/** Le parcours d'accueil, ou l'on revient une fois le paiement fait. */
export const PARCOURS = '/donateur/completer-profil';

/** Les montants proposes d'un geste, en ariary. */
export const MONTANTS_RAPIDES = [5000, 10000, 25000, 50000, 100000];
const MONTANT_MINIMUM = 1000;
const MONTANT_MAXIMUM = 50000000;

/** Les trois temps de la page. */
export const TEMPS = ['montant', 'envoi', 'merci'];

/** Une reference de transaction : "MP241112.0547.A92041", "2609241234567". */
const REFERENCE = /^[A-Za-z0-9][A-Za-z0-9.-]{3,39}$/;

/** "0341234567" -> "034 12 345 67", comme on le lit sur un SMS. */
export function numeroLisible(numero) {
  const chiffres = String(numero ?? '').replace(/\D/g, '');
  const national = chiffres.startsWith('261') ? `0${chiffres.slice(3)}` : chiffres;
  if (national.length !== 10) return national;
  return `${national.slice(0, 3)} ${national.slice(3, 5)} ${national.slice(5, 8)} ${national.slice(8)}`;
}

/** Un montant saisi "25 000" -> 25000, ou null. */
function montantSaisi(texte) {
  const chiffres = String(texte ?? '').replace(/\D/g, '');
  return chiffres ? Number.parseInt(chiffres, 10) : null;
}

/**
 * @param {{ mode: string, numeroValide: RegExp, messageNumero: string,
 *           chargerCompte: () => Promise<object> }} operateur
 *   mode : la cle du moyen ("mvola", "orange_money") ; numeroValide :
 *   le numero national sans 0 ("341234567") ; chargerCompte : le compte
 *   de HOPE chez l'operateur.
 */
export function usePaiementMobile({ mode, numeroValide, messageNumero, chargerCompte }) {
  const navigate = useNavigate();
  const { rafraichir } = useOutletContext() ?? {};

  const [profil, setProfil] = useState(null);
  const [compte, setCompte] = useState(null);
  const [projets, setProjets] = useState([]);
  const [erreurChargement, setErreurChargement] = useState('');

  const [temps, setTemps] = useState('montant');
  const [montant, setMontant] = useState('');
  const [numero, setNumero] = useState('');
  const [reference, setReference] = useState('');
  const [soumis, setSoumis] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [refus, setRefus] = useState('');
  const [don, setDon] = useState(null);
  const titre = useRef(null);

  useEffect(() => {
    let annule = false;
    Promise.all([donateurService.recupererProfil(), chargerCompte(), donateurService.listerProjets()])
      .then(([lu, operateur, liste]) => {
        if (annule) return;
        // La page n'a de sens qu'apres le choix de ce moyen a l'etape 4.
        if (lu.paiement?.mode !== mode || lu.etapeSuivante < 5) {
          navigate(PARCOURS, { replace: true });
          return;
        }
        setProfil(lu);
        setCompte(operateur);
        setProjets(liste?.items ?? []);
        // Le numero du profil, s'il est chez cet operateur.
        const national = String(lu.informations?.telephone ?? '')
          .replace(/\D/g, '')
          .replace(/^261/, '')
          .replace(/^0/, '');
        setNumero(numeroValide.test(national) ? national : '');
      })
      .catch((echec) => {
        if (!annule) setErreurChargement(messageErreur(echec, 'La page de paiement n’a pas pu être préparée.'));
      });
    return () => {
      annule = true;
    };
    // L'operateur ne change pas pendant la vie de la page.
  }, [navigate, mode]);

  // A chaque temps, le titre reprend le focus : un lecteur d'ecran
  // annonce ou l'on est, le clavier repart du haut.
  useEffect(() => {
    if (profil) titre.current?.focus();
  }, [temps, profil]);

  const somme = montantSaisi(montant);
  const beneficiaire = useMemo(() => {
    if (!profil) return '';
    if (profil.don?.affectation !== 'PROJECT') return 'Les projets de HOPE';
    const projet = projets.find((p) => Number(p.id) === Number(profil.don?.projetId));
    return projet?.nom ?? 'Le projet choisi';
  }, [profil, projets]);

  const erreurs = {
    montant:
      somme === null
        ? 'Indiquez le montant de votre don.'
        : somme < MONTANT_MINIMUM
          ? `Au moins ${fmt.montant(MONTANT_MINIMUM)}.`
          : somme > MONTANT_MAXIMUM
            ? `Au plus ${fmt.montant(MONTANT_MAXIMUM)}.`
            : '',
    numero: numeroValide.test(numero) ? '' : messageNumero,
    reference: REFERENCE.test(reference.trim()) ? '' : 'Recopiez la référence reçue par SMS (lettres et chiffres).',
  };

  function allerA(prochain) {
    setSoumis(false);
    setRefus('');
    setTemps(prochain);
    const sobre = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: sobre ? 'auto' : 'smooth' });
  }

  function validerMontant(evenement) {
    evenement.preventDefault();
    setSoumis(true);
    if (erreurs.montant || erreurs.numero) return;
    allerA('envoi');
  }

  async function declarer(evenement) {
    evenement.preventDefault();
    setSoumis(true);
    setRefus('');
    if (erreurs.reference) return;

    setEnvoi(true);
    try {
      const reponse = await donateurService.faireUnDon({
        affectation: profil.don?.affectation || 'HOPE',
        projetId: profil.don?.affectation === 'PROJECT' ? profil.don.projetId : undefined,
        montant: String(somme),
        devise: 'MGA',
        mode,
        // Le premier don ; la frequence se choisit a l'etape suivante.
        frequence: 'ONE_TIME',
        referencePaiement: reference.trim(),
        numeroPayeur: `+261${numero}`,
      });
      setDon(reponse.don);
      await rafraichir?.();
      allerA('merci');
    } catch (echec) {
      setRefus(messageErreur(echec, 'Votre don n’a pas pu être enregistré. Réessayez.'));
    } finally {
      setEnvoi(false);
    }
  }

  /** Revenir au parcours : a l'etape 4, ou a la suite. */
  function quitter(etape) {
    navigate(PARCOURS, { replace: true, state: etape ? { etape } : undefined });
  }

  return {
    profil,
    compte,
    erreurChargement,
    temps,
    indice: TEMPS.indexOf(temps),
    allerA,
    montant,
    setMontant,
    somme,
    numero,
    setNumero,
    reference,
    setReference,
    soumis,
    envoi,
    refus,
    don,
    titre,
    beneficiaire,
    erreurs,
    validerMontant,
    declarer,
    quitter,
  };
}
