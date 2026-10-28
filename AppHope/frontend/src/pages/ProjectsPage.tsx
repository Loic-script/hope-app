import { Heart, Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ProjectCard } from '@/components/projects/ProjectCard';
import {
  Container,
  EmptyState,
  ErrorState,
  ProjectCardSkeleton,
  Section,
  SectionTitle,
} from '@/components/ui';
import { Button, ButtonLink } from '@/components/ui/Button';
import { useCategories, useProjects } from '@/hooks/useApi';
import { cn } from '@/utils/cn';

/**
 * LISTE DES PROJETS.
 *
 * Les filtres vivent dans l'URL : un lien vers « les projets de scolarité »
 * reste partageable, et le retour arrière du navigateur fonctionne comme
 * l'utilisateur s'y attend.
 *
 * Le filtrage est fait par le BACKEND, pas dans le navigateur : filtrer sur
 * place obligerait à télécharger tous les projets pour n'en montrer que trois,
 * et donnerait un résultat faux dès que la liste dépasse une page.
 */
export function ProjectsPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const categoryId = searchParams.get('categoryId') ?? '';
  const searchFromUrl = searchParams.get('search') ?? '';

  const [searchInput, setSearchInput] = useState(searchFromUrl);

  const { data: categories } = useCategories();

  // La recherche part 350 ms après la dernière frappe : sans cela, « scolarité »
  // déclencherait neuf requêtes au lieu d'une.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchParams(
        (params) => {
          const next = new URLSearchParams(params);
          if (searchInput.trim()) next.set('search', searchInput.trim());
          else next.delete('search');
          return next;
        },
        { replace: true },
      );
    }, 350);

    return () => window.clearTimeout(timer);
  }, [searchInput, setSearchParams]);

  const filters = {
    ...(searchFromUrl ? { search: searchFromUrl } : {}),
    ...(categoryId ? { categoryId } : {}),
    take: 40,
  };

  const { data: projects, isLoading, isError, refetch } = useProjects(filters);

  const hasActiveFilters = Boolean(categoryId || searchFromUrl);

  function selectCategory(id: string) {
    setSearchParams((params) => {
      const next = new URLSearchParams(params);
      if (id) next.set('categoryId', id);
      else next.delete('categoryId');
      return next;
    });
  }

  function clearFilters() {
    setSearchInput('');
    setSearchParams(new URLSearchParams());
  }

  return (
    <>
      <Section tone="mist" spacing="tight">
        <Container size="wide">
          <SectionTitle
            eyebrow="Nos projets"
            title="Chaque projet a un budget, des bénéficiaires et des comptes"
            description="Choisissez celui que vous souhaitez soutenir, ou laissez-nous affecter votre don là où le besoin est le plus urgent."
            as="h1"
          />
        </Container>
      </Section>

      <Section tone="white" spacing="tight">
        <Container size="wide">
          {/* --- Filtres --- */}
          <div className="mb-10 space-y-5">
            <div className="relative max-w-md">
              <label htmlFor="project-search" className="sr-only">
                Rechercher un projet
              </label>
              <Search
                className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-hope-ink-soft"
                aria-hidden="true"
              />
              <input
                id="project-search"
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Rechercher un projet, une ville…"
                className="min-h-12 w-full rounded-hope border-2 border-hope-blue-mist bg-white pr-4 pl-12 text-base text-hope-ink transition-colors placeholder:text-hope-ink-soft/60 focus:border-hope-purple focus:outline-none"
              />
            </div>

            <div>
              <h2 className="sr-only">Filtrer par catégorie</h2>
              <div className="flex flex-wrap gap-2">
                <FilterChip
                  label="Toutes les catégories"
                  isActive={categoryId === ''}
                  onClick={() => selectCategory('')}
                />
                {categories?.map((category) => (
                  <FilterChip
                    key={category.id}
                    label={category.name}
                    isActive={categoryId === category.id}
                    onClick={() => selectCategory(category.id)}
                  />
                ))}
              </div>
            </div>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="size-4" aria-hidden="true" />
                Effacer les filtres
              </Button>
            )}
          </div>

          {/* --- Résultats --- */}
          {isLoading && (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2, 3, 4, 5].map((index) => (
                <ProjectCardSkeleton key={index} />
              ))}
            </div>
          )}

          {isError && (
            <ErrorState
              title="Les projets n’ont pas pu être chargés"
              message="Le serveur est momentanément injoignable. Réessayez dans un instant."
              onRetry={() => void refetch()}
            />
          )}

          {!isLoading && !isError && projects && (
            <>
              <p className="mb-6 text-sm text-hope-ink-soft" role="status" aria-live="polite">
                {projects.length === 0
                  ? 'Aucun projet ne correspond à votre recherche.'
                  : `${projects.length} projet${projects.length > 1 ? 's' : ''} ${
                      hasActiveFilters ? 'correspondent à votre recherche' : 'en cours'
                    }`}
              </p>

              {projects.length === 0 ? (
                <EmptyState
                  title="Aucun projet ne correspond"
                  description={
                    hasActiveFilters
                      ? 'Essayez une autre catégorie, ou effacez les filtres pour voir tous les projets.'
                      : 'Nos équipes préparent les prochains projets. Un don libre nous permet d’agir dès maintenant.'
                  }
                  action={
                    hasActiveFilters ? (
                      <Button variant="outline" onClick={clearFilters}>
                        Effacer les filtres
                      </Button>
                    ) : (
                      <ButtonLink to="/donate">
                        <Heart className="size-4" aria-hidden="true" />
                        Faire un don libre
                      </ButtonLink>
                    )
                  }
                />
              ) : (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {projects.map((project) => (
                    <ProjectCard key={project.id} project={project} />
                  ))}
                </div>
              )}
            </>
          )}
        </Container>
      </Section>
    </>
  );
}

function FilterChip({
  label,
  isActive,
  onClick,
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      // aria-pressed dit à un lecteur d'écran si le filtre est actif :
      // le changement de couleur, seul, ne serait pas perceptible.
      aria-pressed={isActive}
      className={cn(
        'min-h-10 rounded-full border-2 px-4 text-sm font-medium transition-all',
        isActive
          ? 'border-hope-purple bg-hope-purple text-white'
          : 'border-hope-blue-mist bg-white text-hope-ink hover:border-hope-blue',
      )}
    >
      {label}
    </button>
  );
}
