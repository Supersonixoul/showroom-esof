import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { categoriesApi } from '../api/client';
import type { Category } from '../api/types';

export function CategoriesPage() {
  const queryClient = useQueryClient();
  const { data: categories, isLoading, error } = useQuery({
    queryKey: ['categories'],
    queryFn: categoriesApi.list,
  });

  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['categories'] });

  const createMutation = useMutation({
    mutationFn: categoriesApi.create,
    onSuccess: () => {
      invalidate();
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Category> }) =>
      categoriesApi.update(id, data),
    onSuccess: () => {
      invalidate();
      resetForm();
    },
  });

  const removeMutation = useMutation({
    mutationFn: categoriesApi.remove,
    onSuccess: invalidate,
  });

  const moveMutation = useMutation({
    mutationFn: ({ id, direction }: { id: string; direction: 'up' | 'down' }) =>
      categoriesApi.move(id, direction),
    onSuccess: invalidate,
  });

  const [parentFilter, setParentFilter] = useState('');

  function resetForm() {
    setName('');
    setParentId('');
    setEditingId(null);
  }

  function startEdit(category: Category) {
    setEditingId(category.id);
    setName(category.name);
    setParentId(category.parentId ?? '');
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const data = { name, parentId: parentId || undefined };
    if (editingId) {
      updateMutation.mutate({ id: editingId, data });
    } else {
      createMutation.mutate(data);
    }
  }

  const saving = createMutation.isPending || updateMutation.isPending;
  const mutationError = createMutation.error || updateMutation.error;
  const removeError = removeMutation.error;

  function parentName(id: string | null | undefined) {
    if (!id) return '—';
    return categories?.find((c) => c.id === id)?.name ?? '—';
  }

  const reorderEnabled = parentFilter !== '';
  const displayedCategories = [...(categories ?? [])]
    .filter((c) => {
      if (parentFilter === '') return true;
      if (parentFilter === 'root') return !c.parentId;
      return c.parentId === parentFilter;
    })
    .sort((a, b) => {
      if (!reorderEnabled && a.parentId !== b.parentId) {
        return parentName(a.parentId).localeCompare(parentName(b.parentId));
      }
      return a.displayOrder - b.displayOrder;
    });

  return (
    <div>
      <div className="page-header">
        <h2>Catégories</h2>
      </div>

      {error && (
        <div className="error-banner">Impossible de charger les catégories.</div>
      )}
      {mutationError && (
        <div className="error-banner">{(mutationError as Error).message}</div>
      )}
      {removeError && (
        <div className="error-banner">{(removeError as Error).message}</div>
      )}

      <form className="form-panel" onSubmit={handleSubmit}>
        <div className="form-row">
          <label>
            Nom
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
          <label>
            Catégorie parente
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
            >
              <option value="">Aucune (racine)</option>
              {categories
                ?.filter((c) => c.id !== editingId)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </label>
        </div>
        <div className="actions">
          <button type="submit" className="primary" disabled={saving}>
            {editingId ? 'Enregistrer' : 'Ajouter'}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm}>
              Annuler
            </button>
          )}
        </div>
      </form>

      <div className="form-row" style={{ alignItems: 'flex-end' }}>
        <label>
          Regrouper par catégorie parente (pour réordonner)
          <select
            value={parentFilter}
            onChange={(e) => setParentFilter(e.target.value)}
          >
            <option value="">Toutes (tri alphabétique)</option>
            <option value="root">Racines</option>
            {categories?.map((c) => (
              <option key={c.id} value={c.id}>
                Enfants de {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {isLoading ? (
        <p className="muted">Chargement…</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Ordre</th>
              <th>Nom</th>
              <th>Parente</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {displayedCategories.map((category, index) => (
              <tr key={category.id}>
                <td>
                  <div className="reorder-buttons">
                    <button
                      type="button"
                      className="icon-btn"
                      disabled={!reorderEnabled || index === 0}
                      aria-label="Monter"
                      title="Monter"
                      onClick={() =>
                        moveMutation.mutate({
                          id: category.id,
                          direction: 'up',
                        })
                      }
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      disabled={
                        !reorderEnabled ||
                        index === displayedCategories.length - 1
                      }
                      aria-label="Descendre"
                      title="Descendre"
                      onClick={() =>
                        moveMutation.mutate({
                          id: category.id,
                          direction: 'down',
                        })
                      }
                    >
                      ↓
                    </button>
                  </div>
                </td>
                <td>{category.name}</td>
                <td className="muted">{parentName(category.parentId)}</td>
                <td>
                  <div className="actions">
                    <button onClick={() => startEdit(category)}>
                      Modifier
                    </button>
                    <button
                      className="danger"
                      onClick={() => {
                        if (
                          confirm(
                            `Supprimer la catégorie "${category.name}" ?`,
                          )
                        ) {
                          removeMutation.mutate(category.id);
                        }
                      }}
                    >
                      Supprimer
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {displayedCategories.length === 0 && (
              <tr>
                <td colSpan={4} className="muted">
                  Aucune catégorie.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
