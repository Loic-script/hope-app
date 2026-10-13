import { MessageFiche } from '../../components/vitrine/fiche.jsx';

export default function PageIntrouvable() {
  return (
    <MessageFiche
      titre="Page introuvable"
      texte="Cette adresse ne correspond à aucune page du site."
      retour="/"
      libelleRetour="Retour à l’accueil"
    />
  );
}
