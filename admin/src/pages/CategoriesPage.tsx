import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { categoriesApi, mediaUrl, uploadMedia } from '../api/client';
import type { Category } from '../api/types';

export function CategoriesPage() {
  const queryClient = useQueryClient();
  const { data: categories, isLoading, error } = useQuery({
    queryKey: ['categories'],
    queryFn: categoriesApi.list,
  });

  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    setImageUrl('');
    setEditingId(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function startEdit(category: Category) {
    setEditingId(category.id);
    setName(category.name);
    setParentId(category.parentId ?? '');
    setImageUrl(category.imageUrl ?? '');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = await uploadMedia(file, 'categories');
      setImageUrl(result.url);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const data = {
      name,
      parentId: parentId || undefined,
      imageUrl: imageUrl || undefined,
    };
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

  const displayedCategories = [...(categories ?? [])]
    .filter((c) => {
      if (parentFilter === '') return true;
      if (parentFilter === 'root') return !c.parentId;
      return c.parentId === parentFilter;
    })
    .sort((a, b) => {
      if (a.parentId !== b.parentId) {
        return parentName(a.parentId).localeCompare(parentName(b.parentId));
      }
      return a.displayOrder - b.displayOrder;
    });

  function isFirstInGroup(index: number) {
    if (index === 0) return true;
    return (
      displayedCategories[index - 1].parentId !==
      displayedCategories[index].parentId
    );
  }

  function isLastInGroup(index: number) {
    if (index === displayedCategories.length - 1) return true;
    return (
      displayedCategories[index + 1].parentId !==
      displayedCategories[index].parentId
    );
  }

  return (
    <div className="page-fill">
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
          <label>
            Image (optionnel)
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
            />
          </label>
        </div>
        <div className="actions">
          <button
            type="submit"
            className="primary"
            disabled={saving || uploading}
          >
            {uploading
              ? 'Envoi…'
              : editingId
                ? 'Enregistrer'
                : 'Ajouter'}
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
          Regrouper par catégorie parente
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
      </div>

      <div className="scroll-area">
      {isLoading ? (
        <p className="muted">Chargement…</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Ordre</th>
              <th>Nom</th>
              <th>Parente</th>
              <th>Image</th>
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
                      disabled={isFirstInGroup(index)}
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
                      disabled={isLastInGroup(index)}
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
                  {category.imageUrl ? (
                    <img
                      className="thumb"
                      src={mediaUrl(category.imageUrl)}
                      alt={category.name}
                    />
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
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
                <td colSpan={5} className="muted">
                  Aucune catégorie.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
      </div>
    </div>
  );
}
