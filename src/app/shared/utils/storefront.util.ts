/** Lien de vitrine tapé librement -> format accepté par le serveur (minuscules, sans accent, tirets). */
export function toSlug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .slice(0, 60);
}

/** 221771111111 -> +221 77 111 11 11 (lecture) ; autres indicatifs : groupés par 2 après l'indicatif. */
export function formatWhatsapp(number: string | null): string {
  if (!number) {
    return '';
  }
  const match = /^(221)(\d{2})(\d{3})(\d{2})(\d{2})$/.exec(number);
  if (match) {
    return `+${match.slice(1).join(' ')}`;
  }
  return `+${number.replace(/^(\d{2,3})(\d+)$/, (_, code: string, rest: string) => `${code} ${rest.replace(/(\d{2})(?=\d)/g, '$1 ')}`)}`;
}

/** Copie dans le presse-papiers ; false si le navigateur le refuse. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
