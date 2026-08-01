/** Une ligne du fichier Excel importé — validée finement (désignation
 * manquante, etc.) côté service pour permettre un rapport ligne par ligne
 * plutôt qu'un rejet global de la requête. */
export interface ImportProductRowDto {
  name: string;
  reference?: string;
  description?: string;
  price?: number;
}
