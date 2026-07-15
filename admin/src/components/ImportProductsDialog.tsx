import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import { brandsApi, categoriesApi, gammesApi, productsApi, subcategoriesApi } from '../api/client';
import type { Product } from '../api/types';

interface ParsedRow {
  reference?: string;
  name: string;
  description?: string;
  price?: number;
}

interface ImportResult {
  row: ParsedRow;
  status: 'ok' | 'error';
  message?: string;
}

function normalizeHeader(header: string): string {
  return header
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

/** Les fichiers Excel donnent déjà un `number` pour une cellule numérique.
 * Les CSV, eux, donnent une chaîne — potentiellement au format français
 * (virgule décimale, espace/espace insécable comme séparateur de milliers,
 * ex. "1 234,50"), que `Number()` seul ne sait pas interpréter. */
function parsePrice(raw: unknown): number | undefined {
  if (raw === undefined || raw === '') return undefined;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : undefined;
  const cleaned = String(raw)
    .trim()
    .replace(/[\s\u00A0]/g, '')
    .replace(',', '.');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

const REFERENCE_HEADERS = ['reference', 'ref'];
const NAME_HEADERS = ['nom', 'name'];
const DESCRIPTION_HEADERS = ['description'];
const PRICE_HEADERS = ['prix', 'price'];

function parseSheet(workbook: XLSX.WorkBook, sheetName: string): { rows: ParsedRow[]; error?: string } {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    return { rows: [], error: 'Feuille introuvable dans le classeur.' };
  }
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
  });

  if (raw.length === 0) {
    return { rows: [], error: 'Le fichier ne contient aucune ligne de données.' };
  }

  const headerMap = new Map<string, string>();
  for (const key of Object.keys(raw[0])) {
    headerMap.set(normalizeHeader(key), key);
  }
  const nameKey = NAME_HEADERS.map((h) => headerMap.get(h)).find(Boolean);
  const referenceKey = REFERENCE_HEADERS.map((h) => headerMap.get(h)).find(Boolean);
  const descriptionKey = DESCRIPTION_HEADERS.map((h) => headerMap.get(h)).find(Boolean);
  const priceKey = PRICE_HEADERS.map((h) => headerMap.get(h)).find(Boolean);

  if (!nameKey) {
    return {
      rows: [],
      error: 'Colonne "Nom" introuvable. Le fichier doit comporter au moins les colonnes Référence et Nom.',
    };
  }

  const rows: ParsedRow[] = raw
    .map((entry) => {
      const name = String(entry[nameKey] ?? '').trim();
      const reference = referenceKey ? String(entry[referenceKey] ?? '').trim() : '';
      const description = descriptionKey ? String(entry[descriptionKey] ?? '').trim() : '';
      const price = priceKey ? parsePrice(entry[priceKey]) : undefined;
      return {
        name,
        reference: reference || undefined,
        description: description || undefined,
        price,
      };
    })
    .filter((row) => row.name);

  if (rows.length === 0) {
    return { rows: [], error: 'Aucune ligne exploitable (colonne "Nom" vide sur toutes les lignes).' };
  }

  return { rows };
}

export function ImportProductsDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const { data: brands } = useQuery({ queryKey: ['brands'], queryFn: brandsApi.list });
  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: categoriesApi.list });

  const [brandId, setBrandId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [gammeId, setGammeId] = useState('');
  const [subcategoryId, setSubcategoryId] = useState('');
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState('');
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<ImportResult[] | null>(null);

  const { data: gammes } = useQuery({
    queryKey: ['gammes', brandId],
    queryFn: () => gammesApi.list(brandId),
    enabled: !!brandId,
  });
  const { data: subcategories } = useQuery({
    queryKey: ['subcategories', categoryId],
    queryFn: () => subcategoriesApi.list(categoryId),
    enabled: !!categoryId,
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<Product>) => productsApi.create(data),
  });

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResults(null);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const firstSheet = wb.SheetNames[0];
      setWorkbook(wb);
      setSheetNames(wb.SheetNames);
      setSelectedSheet(firstSheet);
      const { rows: parsed, error } = parseSheet(wb, firstSheet);
      setRows(parsed);
      setParseError(error ?? null);
    } catch {
      setWorkbook(null);
      setSheetNames([]);
      setSelectedSheet('');
      setRows([]);
      setParseError('Impossible de lire ce fichier. Formats acceptés : .xlsx, .xls, .csv.');
    }
  }

  function handleSheetChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const sheetName = e.target.value;
    setSelectedSheet(sheetName);
    setResults(null);
    if (!workbook) return;
    const { rows: parsed, error } = parseSheet(workbook, sheetName);
    setRows(parsed);
    setParseError(error ?? null);
  }

  async function handleImport() {
    if (!categoryId || rows.length === 0) return;
    setImporting(true);
    const outcome: ImportResult[] = [];
    for (const row of rows) {
      try {
        await createMutation.mutateAsync({
          name: row.name,
          reference: row.reference,
          description: row.description,
          price: row.price,
          brandId: brandId || null,
          categoryId,
          subcategoryId: subcategoryId || null,
          gammeId: gammeId || null,
        });
        outcome.push({ row, status: 'ok' });
      } catch (err) {
        outcome.push({ row, status: 'error', message: (err as Error).message });
      }
    }
    setResults(outcome);
    setImporting(false);
    queryClient.invalidateQueries({ queryKey: ['products'] });
  }

  const canImport = !!categoryId && rows.length > 0 && !importing;
  const successCount = results?.filter((r) => r.status === 'ok').length ?? 0;
  const errorResults = results?.filter((r) => r.status === 'error') ?? [];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="page-header">
          <h3>Importer des produits depuis un fichier Excel</h3>
          <button type="button" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>

        <p className="muted">
          Le fichier doit comporter au minimum les colonnes <strong>Référence</strong> et{' '}
          <strong>Nom</strong> (colonnes optionnelles reconnues : Description, Prix). Chaque
          produit importé sera rattaché à la catégorie choisie ci-dessous (obligatoire) et,
          le cas échéant, à la marque choisie (optionnelle).
        </p>

        <div className="form-row">
          <label>
            Marque (optionnel)
            <select
              value={brandId}
              onChange={(e) => {
                setBrandId(e.target.value);
                setGammeId('');
              }}
            >
              <option value="">Aucune</option>
              {brands?.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Gamme (optionnel)
            <select value={gammeId} onChange={(e) => setGammeId(e.target.value)} disabled={!brandId}>
              <option value="">Aucune</option>
              {gammes?.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Catégorie
            <select
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                setSubcategoryId('');
              }}
              required
            >
              <option value="" disabled>
                Choisir…
              </option>
              {categories?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Sous-catégorie (optionnel)
            <select
              value={subcategoryId}
              onChange={(e) => setSubcategoryId(e.target.value)}
              disabled={!categoryId}
            >
              <option value="">Aucune</option>
              {subcategories?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="form-row">
          <label>
            Fichier Excel (.xlsx, .xls, .csv)
            <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} />
          </label>
          {sheetNames.length > 1 && (
            <label>
              Feuille
              <select value={selectedSheet} onChange={handleSheetChange}>
                {sheetNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        {parseError && <div className="error-banner">{parseError}</div>}

        {!parseError && fileName && rows.length > 0 && !results && (
          <div className="success-banner">
            {rows.length} produit(s) détecté(s) dans « {fileName} ».
          </div>
        )}

        {results && (
          <div className={errorResults.length > 0 ? 'error-banner' : 'success-banner'}>
            {successCount} produit(s) importé(s) avec succès.
            {errorResults.length > 0 && (
              <ul>
                {errorResults.map((r, i) => (
                  <li key={i}>
                    {r.row.name} : {r.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="actions">
          <button
            type="button"
            className="primary"
            disabled={!canImport}
            onClick={handleImport}
          >
            {importing ? 'Import en cours…' : `Importer ${rows.length || ''} produit(s)`}
          </button>
          <button type="button" onClick={onClose}>
            {results ? 'Fermer' : 'Annuler'}
          </button>
        </div>
      </div>
    </div>
  );
}
