# HOPE — Hope for a Better Life

Plateforme de dons et de suivi d'activités pour l'association HOPE
(Madagascar) : accompagnement des orphelins, des mères célibataires et
des familles vulnérables.

## Organisation des branches

| Branche   | Rôle                                              |
|-----------|---------------------------------------------------|
| `main`    | Branche de référence. Reste stable.               |
| `dev`     | Branche d'intégration, issue de `main`.           |
| `hopeapp` | Développement de l'application, issue de `dev`.   |

> Le code de la plateforme se trouve sur la branche **`hopeapp`**,
> dans le dossier `AppHopePlat/`.

## Pile technique

- **Backend** — Node.js, Express, PostgreSQL (`pg`, sans ORM)
- **Frontend** — React, Vite, CSS
- **Sécurité** — mots de passe hachés avec bcrypt, authentification JWT

## Configuration

Les fichiers `.env` ne sont **jamais** versionnés : ils contiennent le
mot de passe PostgreSQL et le secret JWT. Se reporter aux fichiers
`.env.example` de chaque sous-projet.
