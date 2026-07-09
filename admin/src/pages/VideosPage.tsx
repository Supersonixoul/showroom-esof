import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { mediaUrl, uploadMedia, videosApi } from '../api/client';
import type { PromoVideo } from '../api/types';

export function VideosPage() {
  const queryClient = useQueryClient();
  const { data: videos, isLoading, error } = useQuery({
    queryKey: ['videos'],
    queryFn: videosApi.list,
  });

  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['videos'] });

  const createMutation = useMutation({
    mutationFn: videosApi.create,
    onSuccess: () => {
      invalidate();
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<PromoVideo> }) =>
      videosApi.update(id, data),
    onSuccess: () => {
      invalidate();
      resetForm();
    },
  });

  const removeMutation = useMutation({
    mutationFn: videosApi.remove,
    onSuccess: invalidate,
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      videosApi.update(id, { isActive }),
    onSuccess: invalidate,
  });

  function resetForm() {
    setTitle('');
    setUrl('');
    setEditingId(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function startEdit(video: PromoVideo) {
    setEditingId(video.id);
    setTitle(video.title);
    setUrl(video.url);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = await uploadMedia(file, 'promo-videos');
      setUrl(result.url);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const data = { title, url };
    if (editingId) {
      updateMutation.mutate({ id: editingId, data });
    } else {
      createMutation.mutate(data);
    }
  }

  const saving = createMutation.isPending || updateMutation.isPending;
  const mutationError = createMutation.error || updateMutation.error;

  return (
    <div>
      <div className="page-header">
        <h2>Vidéos promotionnelles</h2>
      </div>

      {error && (
        <div className="error-banner">Impossible de charger les vidéos.</div>
      )}
      {mutationError && (
        <div className="error-banner">{(mutationError as Error).message}</div>
      )}

      <form className="form-panel" onSubmit={handleSubmit}>
        <div className="form-row">
          <label>
            Titre
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </label>
          <label>
            Fichier vidéo
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={handleFileChange}
            />
          </label>
          <label>
            URL
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Uploadée automatiquement ou saisie manuellement"
              required
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

      {isLoading ? (
        <p className="muted">Chargement…</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Titre</th>
              <th>Statut</th>
              <th>Position</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {videos?.map((video) => (
              <tr key={video.id}>
                <td>
                  <a href={mediaUrl(video.url)} target="_blank" rel="noreferrer">
                    {video.title}
                  </a>
                </td>
                <td>
                  <span className={video.isActive ? 'tag' : 'muted'}>
                    {video.isActive ? 'Actif' : 'Inactif'}
                  </span>
                </td>
                <td className="muted">{video.position}</td>
                <td>
                  <div className="actions">
                    <button onClick={() => startEdit(video)}>Modifier</button>
                    <button
                      onClick={() =>
                        toggleActiveMutation.mutate({
                          id: video.id,
                          isActive: !video.isActive,
                        })
                      }
                    >
                      {video.isActive ? 'Désactiver' : 'Activer'}
                    </button>
                    <button
                      className="danger"
                      onClick={() => {
                        if (confirm(`Supprimer la vidéo "${video.title}" ?`)) {
                          removeMutation.mutate(video.id);
                        }
                      }}
                    >
                      Supprimer
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {videos?.length === 0 && (
              <tr>
                <td colSpan={4} className="muted">
                  Aucune vidéo.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
