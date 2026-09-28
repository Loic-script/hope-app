import { useEffect, useRef, useState } from 'react';

import * as fmt from '../utils/format.js';
import { montantInitial, montantSaisi, usePromesseDon } from './usePromesseDon.js';

/**
 * Le paiement mobile, commun a MVola et a Orange Money : chaque
 * operateur a son habit (sa page), la mecanique est la meme.
 *
 *   1. le montant, et le numero qui paiera ;
 *   2. l'envoi, depuis le code USSD de l'operateur, vers le numero de
 *      HOPE ; puis la reference que l'operateur renvoie par SMS ;
 *   3. le recu, et la suite.
 *
 * Le telephone n'est pas debite par la plateforme : le payeur envoie
 * lui-meme, et l'equipe rapproche la reference de son releve avant de
 * confirmer. Aucun code secret n'est jamais demande.
 *
 * Qui paie et pour quel don : usePromesseDon, qui lit le
 * ContextePaiement (parcours d'accueil ou espace).
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

/**
 * @param {{ mode: string, numeroValide: RegExp, messageNumero: string,
 *           cleCompte: 'mvola'|'orangeMoney' }} operateur
 *   mode : la cle du moyen ("mvola", "orange_money") ; numeroValide :
 *   le numero national sans 0 ("341234567") ; cleCompte : ou lire le
 *   compte de HOPE dans les coordonnees de paiement.
 */
export function usePaiementMobile({ mode, numeroValide, messageNumero, cleCompte }) {
  const promesse = usePromesseDon(mode);
  const { profil, personne, coordonnees, montantPrevu, devisePrevue } = promesse;

  const [temps, setTemps] = useState('montant');
  const [montant, setMontant] = useState('');
  const [numero, setNumero] = useState('');
  const [reference, setReference] = useState('');
  const [soumis, setSoumis] = useState(false);
  const titre = useRef(null);

  // Une fois charge : le numero du payeur s'il est chez cet operateur,
  // et le montant du don prepare s'il est en ariary.
  useEffect(() => {
    if (!profil) return;
    const national = String(personne.telephone ?? '')
      .replace(/\D/g, '')
      .replace(/^261/, '')
      .replace(/^0/, '');
    setNumero((n) => n || (numeroValide.test(national) ? national : ''));
    setMontant((m) => m || montantInitial(montantPrevu, devisePrevue));
    // Seulement au chargement.
  // Pre-remplissage a l'arrivee des donnees : volontairement pas a chaque saisie.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profil]);

  // A chaque temps, le titre reprend le focus : un lecteur d'ecran
  // annonce ou l'on est, le clavier repart du haut.
  useEffect(() => {
    if (profil) titre.current?.focus();
  }, [temps, profil]);

  const somme = montantSaisi(montant);

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
    promesse.setRefus('');
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
    if (erreurs.reference) return;
    const cree = await promesse.promettre({
      montant: Math.round(somme),
      devise: 'MGA',
      referencePaiement: reference.trim(),
      numeroPayeur: `+261${numero}`,
    });
    if (cree) allerA('merci');
  }

  return {
    profil,
    compte: coordonnees?.plateformes?.[cleCompte] ?? null,
    erreurChargement: promesse.erreurChargement,
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
    envoi: promesse.envoi,
    refus: promesse.refus,
    don: promesse.don,
    titre,
    beneficiaire: promesse.beneficiaire,
    erreurs,
    validerMontant,
    declarer,
    quitter: promesse.quitter,
    libelleSuite: promesse.libelleSuite,
    libellePlusTard: promesse.libellePlusTard,
  };
}
