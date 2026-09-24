import { useOutletContext, useSearchParams } from 'react-router-dom';

import ParcoursDon from '../../components/don/ParcoursDon.jsx';
import * as service from '../../services/bailleur.service.js';

/**
 * Faire un don a un projet, depuis l'espace bailleur : le parcours commun
 * (ParcoursDon), pour le projet de la publication (?projet=12).
 *
 * Le partenaire finance le projet : pas de don mensuel, mais il choisit
 * son mode de paiement. Il voit ou en est le financement -- il le voit
 * deja partout dans son espace. C'est une promesse ; l'equipe HOPE le
 * contacte pour le paiement et confirme a reception.
 */
export default function FaireUnDon() {
  const { bailleur, rafraichirCompteurs } = useOutletContext();
  const [parametres] = useSearchParams();

  return (
    <ParcoursDon
      prenom={bailleur?.prenom}
      titre="Financer ce projet"
      accroche="Choisissez le montant et le moyen de paiement : la page suivante vous guide pour régler, et l’équipe HOPE confirme votre financement à réception."
      projetImpose={parametres.get('projet')}
      avecRythme={false}
      avecFinances
      lienRetour={{ to: '/bailleur', libelle: 'Retour aux actualités' }}
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
