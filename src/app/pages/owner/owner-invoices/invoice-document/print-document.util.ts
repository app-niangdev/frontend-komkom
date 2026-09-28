/** Format de page du document imprimé. */
export type PrintFormat = 'a4' | 'ticket';

const PAGE_RULES: Record<PrintFormat, string> = {
  a4: '@page { size: A4; margin: 14mm; }',
  ticket: '@page { size: 80mm auto; margin: 3mm; }'
};

/**
 * Imprime un élément seul, dans une iframe cachée qui reprend les feuilles de style de la page :
 * l'impression ne dépend ni de la mise en page de l'application ni des fenêtres ouvertes.
 */
export function printElement(element: HTMLElement, format: PrintFormat, title: string): void {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;
  if (!doc || !win) {
    iframe.remove();
    return;
  }

  // <base> : feuilles de style et logo en chemin relatif se résolvent comme dans l'application
  const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
    .map((node) => node.outerHTML)
    .join('\n');

  doc.open();
  doc.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><base href="${escapeHtml(document.baseURI)}"><title>${escapeHtml(title)}</title>${styles}
    <style>${PAGE_RULES[format]} html, body { background: #fff !important; margin: 0; padding: 0; height: auto; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }</style></head>
    <body>${element.outerHTML}</body></html>`);
  doc.close();

  const cleanup = () => setTimeout(() => iframe.remove(), 500);
  win.addEventListener('afterprint', cleanup, { once: true });

  // Attend les images (logo) avant d'ouvrir la boîte d'impression
  const images = Array.from(doc.images);
  Promise.all(
    images.map((img) => (img.complete ? Promise.resolve() : new Promise((resolve) => ((img.onload = img.onerror = resolve)))))
  ).then(() => {
    win.focus();
    win.print();
    // Navigateurs sans « afterprint » : retrait différé
    setTimeout(cleanup, 60_000);
  });
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
}
