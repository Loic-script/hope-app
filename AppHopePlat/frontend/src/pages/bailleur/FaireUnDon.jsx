import { useOutletContext, useSearchParams } from 'react-router-dom';

import ParcoursDon from '../../components/don/ParcoursDon.jsx';
import * as service from '../../services/bailleur.service.js';

/**
 * Faire un don depuis l'espace bailleur : le parcours commun (ParcoursDon).
 *
 * Depuis le menu, il commence par la destination : un don non affecte
 * (HOPE l'emploie ou le besoin est le plus grand) ou affecte a un projet
 * choisi ; puis le mode de paiement. Depuis une publication
 * (?projet=12), le projet est deja choisi.
 *
 * Le partenaire finance le projet : pas de don mensuel, mais il choisit
 * son mode de paiement. Il voit ou en est le financement -- il le voit
 * deja partout dans son espace. C'est une promesse ; l'equipe HOPE le
 * contacte pour le paiement et confirme a reception.
 */
export default function FaireUnDon() {
  const { bailleur, rafraichirCompteurs } = useOutletContext();
  const [parametres] = useSearchParams();
  const projet = parametres.get('projet');

  return (
    <ParcoursDon
      prenom={bailleur?.prenom}
      titre={projet ? 'Financer ce projet' : 'Faire un don'}
      accroche={
        projet
          ? 'Choisissez votre moyen de paiement : la page suivante vous guide pour le montant et le règlement, et l’équipe HOPE confirme votre financement à réception.'
          : 'Choisissez d’abord la destination de votre don — affecté à un projet ou non affecté —, puis votre moyen de paiement. L’équipe HOPE confirme à réception.'
      }
      projetImpose={projet}
      etiquettesDestination={{ HOPE: 'Don non affecté', PROJECT: 'Don affecté' }}
      destinationDabord
      avecRythme={false}
      avecFinances
      lienRetour={{ to: '/bailleur', libelle: 'Retour à l’accueil' }}
      onEnvoye={rafraichirCompteurs}
      chargerOptions={async () => {
        const options = await service.optionsDon();
        return { modes: options.modesPaiement ?? [], devises: options.devises ?? [] };
      }}
      chargerProjets={async () =>
        (await service.projets()).map((p) => ({
          id: p.id,
          nom: p.name,
          image: p.photoUrl,
          lieu: p.location,
          categorie: p.categorie,
          devise: p.currency ?? 'MGA',
          taux: p.tauxFinancement,
          restant: Math.max(0, Number(p.requiredBudget ?? 0) - Number(p.montantFinance ?? 0)),
          atteint: p.status !== 'IN_PROGRESS' || Number(p.tauxFinancement) >= 100,
        }))
      }
      envoyer={service.faireUnDon}
      payer="/bailleur/payer"
    />
  );
}
