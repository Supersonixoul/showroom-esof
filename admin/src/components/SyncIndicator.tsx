import { useQuery } from '@tanstack/react-query';
import { catalogApi } from '../api/client';

export function SyncIndicator() {
  const { data, isError, isFetching } = useQuery({
    queryKey: ['catalog-full-check'],
    queryFn: catalogApi.full,
    refetchInterval: 30_000,
  });

  if (isError) {
    return <span className="sync sync--error">API injoignable</span>;
  }

  if (!data) {
    return <span className="sync sync--pending">Connexion…</span>;
  }

  return (
    <span className="sync sync--ok">
      {isFetching ? 'Synchronisation…' : 'API connectée'} ·{' '}
      {new Date(data.syncedAt).toLocaleTimeString('fr-FR')}
    </span>
  );
}
