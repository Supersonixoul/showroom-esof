import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { professionnelsApi } from '../api/client';
import type { Professionnel } from '../api/types';
import { PasswordInput } from '../components/PasswordInput';

function conflictMessage(err: unknown, fallback: string) {
  const message = (err as Error)?.message ?? '';
  return message.startsWith('409') ? fallback : message;
}

export function ProfessionnelsPage() {
  const queryClient = useQueryClient();
  const { data: professionnels, isLoading, error } = useQuery({
    queryKey: ['professionnels'],
    queryFn: professionnelsApi.list,
  });

  const [showForm, setShowForm] = useState(false);
  const [nom, setNom] = useState('');
  const [identifiant, setIdentifiant] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [telephone1, setTelephone1] = useState('');
  const [telephone2, setTelephone2] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!successMessage) return;
    const timeout = setTimeout(() => setSuccessMessage(null), 3000);
    return () => clearTimeout(timeout);
  }, [successMessage]);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['professionnels'] });

  const createMutation = useMutation({
    mutationFn: professionnelsApi.create,
    onSuccess: () => {
      invalidate();
      setSuccessMessage('Professionnel créé.');
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<Professionnel> & { motDePasse?: string };
    }) => professionnelsApi.update(id, data),
    onSuccess: () => {
      invalidate();
      setSuccessMessage('Professionnel modifié.');
      resetForm();
    },
  });

  const removeMutation = useMutation({
    mutationFn: professionnelsApi.remove,
    onSuccess: () => {
      invalidate();
      setSuccessMessage('Professionnel désactivé.');
    },
  });

  function resetForm() {
    setShowForm(false);
    setNom('');
    setIdentifiant('');
    setMotDePasse('');
    setTelephone1('');
    setTelephone2('');
    setEditingId(null);
  }

  function openCreateForm() {
    resetForm();
    setShowForm(true);
  }

  function startEdit(pro: Professionnel) {
    setEditingId(pro.id);
    setNom(pro.nom);
    setIdentifiant(pro.identifiant);
    setMotDePasse('');
    setTelephone1(pro.telephone1);
    setTelephone2(pro.telephone2 ?? '');
    setShowForm(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editingId) {
      updateMutation.mutate({
        id: editingId,
        data: {
          nom,
          identifiant,
          telephone1,
          telephone2: telephone2 || undefined,
          ...(motDePasse ? { motDePasse } : {}),
        },
      });
    } else {
      createMutation.mutate({
        nom,
        identifiant,
        motDePasse,
        telephone1,
        telephone2: telephone2 || undefined,
      });
    }
  }

  const saving = createMutation.isPending || updateMutation.isPending;
  const mutationError = createMutation.error || updateMutation.error;
  const removeError = removeMutation.error;

  const sortedProfessionnels = [...(professionnels ?? [])].sort((a, b) =>
    a.nom.localeCompare(b.nom),
  );

  return (
    <div className="page-fill">
      <div>
        <div className="page-header">
          <h2>Professionnels</h2>
        </div>

        {error && (
          <div className="error-banner">Impossible de charger les professionnels.</div>
        )}
        {mutationError && (
          <div className="error-banner">
            {conflictMessage(mutationError, 'Cet identifiant est déjà utilisé.')}
          </div>
        )}
        {removeError && (
          <div className="error-banner">{(removeError as Error).message}</div>
        )}
        {successMessage && (
          <div className="success-banner">{successMessage}</div>
        )}

        <div className="actions">
          <button type="button" className="primary" onClick={openCreateForm}>
            + Ajouter un professionnel
          </button>
        </div>

        {showForm && (
          <form className="form-panel" onSubmit={handleSubmit}>
            <div className="form-row">
              <label>
                Nom
                <input value={nom} onChange={(e) => setNom(e.target.value)} required />
              </label>
              <label>
                Identifiant
                <input
                  value={identifiant}
                  onChange={(e) => setIdentifiant(e.target.value)}
                  required
                />
              </label>
              <label>
                Mot de passe
                <PasswordInput
                  value={motDePasse}
                  onChange={(e) => setMotDePasse(e.target.value)}
                  placeholder={
                    editingId ? 'Laisser vide pour conserver le mot de passe actuel' : ''
                  }
                  required={!editingId}
                  minLength={6}
                />
              </label>
              <label>
                Téléphone 1
                <input
                  value={telephone1}
                  onChange={(e) => setTelephone1(e.target.value)}
                  required
                />
              </label>
              <label>
                Téléphone 2 (optionnel)
                <input
                  value={telephone2}
                  onChange={(e) => setTelephone2(e.target.value)}
                />
              </label>
            </div>
            <div className="actions">
              <button type="submit" className="primary" disabled={saving}>
                {editingId ? 'Enregistrer' : 'Ajouter'}
              </button>
              <button type="button" onClick={resetForm}>
                Annuler
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="scroll-area">
        {isLoading ? (
          <p className="muted">Chargement…</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Nom</th>
                <th>Identifiant</th>
                <th>Téléphone 1</th>
                <th>Téléphone 2</th>
                <th>Actif</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sortedProfessionnels.map((pro) => (
                <tr key={pro.id}>
                  <td>{pro.nom}</td>
                  <td>{pro.identifiant}</td>
                  <td>{pro.telephone1}</td>
                  <td className="muted">{pro.telephone2 || '—'}</td>
                  <td>{pro.actif ? 'Oui' : 'Non'}</td>
                  <td>
                    <div className="actions">
                      <button onClick={() => startEdit(pro)}>Modifier</button>
                      <button
                        className="danger"
                        disabled={!pro.actif}
                        onClick={() => {
                          if (confirm(`Désactiver le professionnel "${pro.nom}" ?`)) {
                            removeMutation.mutate(pro.id);
                          }
                        }}
                      >
                        Désactiver
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {sortedProfessionnels.length === 0 && (
                <tr>
                  <td colSpan={6} className="muted">
                    Aucun professionnel.
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
