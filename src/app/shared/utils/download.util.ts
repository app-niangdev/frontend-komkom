/** Enregistre un fichier reçu de l'API (export CSV, PDF...) sous le nom donné. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  // Laisse le navigateur démarrer le téléchargement avant de libérer l'URL
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Format d'export proposé par les listes. */
export type ExportFormat = 'csv' | 'pdf';
