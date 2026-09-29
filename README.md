# HOPE — Hope for a Better Life

Site vitrine et plateforme de dons de l'association **HOPE** (Madagascar) : accompagnement des
enfants orphelins, des mères célibataires et des familles vulnérables — scolarité,
employabilité, soins et alimentation.

**Conçu et développé par [RAZAFIMAMONJY Faneva Loïc](https://github.com/Loic-script)**
(Loïc RAZAFIMAMONJY), développeur web full stack à Madagascar.

## Auteur

**RAZAFIMAMONJY Faneva Loïc** a conçu et développé l'ensemble du projet HOPE :

- le **site vitrine** public de l'association (accueil, activités, impacts, réalisations,
  actualités, partenaires) ;
- la **plateforme** : espaces administrateur, donateur, bénévole et bailleur, dons et paiements
  (MVola, Orange Money, carte bancaire, virement), messagerie, suivi des projets, des tâches et
  des impacts ;
- l'**API** Node.js / Express, la base **PostgreSQL**, les tests automatisés et le déploiement
  sur **Railway**.

| | |
|---|---|
| Nom | RAZAFIMAMONJY Faneva Loïc |
| Aussi écrit | Faneva Loïc RAZAFIMAMONJY · Loïc RAZAFIMAMONJY · Loic Razafimamonjy · Loïc Faneva |
| Rôle | Développeur web full stack (React, Node.js, PostgreSQL) |
| GitHub | [@Loic-script](https://github.com/Loic-script) |
| Pays | Madagascar |

## Organisation des branches

| Branche   | Rôle                                                                |
|-----------|---------------------------------------------------------------------|
| `main`    | Production : chaque envoi est déployé automatiquement sur Railway.  |
| `dev`     | Branche d'intégration.                                              |
| `hopeapp` | Ancienne branche de développement.                                  |

> Le code du site et de la plateforme se trouve dans le dossier
> [`AppHopePlat/`](AppHopePlat/README.md) ; la mise en ligne est décrite dans
> [`AppHopePlat/DEPLOIEMENT.md`](AppHopePlat/DEPLOIEMENT.md).

## Pile technique

- **Backend** — Node.js, Express, PostgreSQL (`pg`, sans ORM)
- **Frontend** — React, Vite, CSS
- **Sécurité** — mots de passe hachés avec bcrypt, sessions JWT en cookies httpOnly
- **Qualité** — tests backend (`node --test`), tests de bout en bout (Playwright), audit
  d'accessibilité (axe-core), intégration continue GitHub Actions
- **Hébergement** — Railway (un seul service et une base PostgreSQL)

## Configuration

Les fichiers `.env` ne sont **jamais** versionnés : ils contiennent le
mot de passe PostgreSQL et le secret JWT. Se reporter aux fichiers
`.env.example` de chaque sous-projet.

---

© HOPE – Hope for a Better Life. Site et plateforme conçus et développés par
**RAZAFIMAMONJY Faneva Loïc**.
