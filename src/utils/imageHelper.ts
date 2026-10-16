const DEFAULT_ORIGIN = 'https://api.blackskyqore.com';

/**
 * Resim yollarını/sunucu adreslerini çözümleyerek doğrudan yüklenebilir URL'ler üretir.
 */
export function resolveImageUri(
  uri: string | undefined,
  baseUrl?: string,
  fullApiUrl?: string
): string | undefined {
  if (!uri || typeof uri !== 'string') return undefined;
  const trimmed = uri.trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return undefined;
  if (trimmed.toLowerCase().includes('nophoto')) return undefined;

  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('file:')
  ) {
    return trimmed;
  }

  // Güvenli baseUrl tespiti
  let origin = DEFAULT_ORIGIN;
  if (baseUrl && typeof baseUrl === 'string' && baseUrl.trim().length > 0 && baseUrl !== 'undefined') {
    origin = baseUrl.trim().replace(/\/+$/, '').replace(/\/api$/, '');
  } else if (fullApiUrl && typeof fullApiUrl === 'string' && fullApiUrl.trim().length > 0) {
    origin = fullApiUrl.trim().replace(/\/+$/, '').replace(/\/api$/, '');
  }

  const cleanPath = trimmed.startsWith('/') ? trimmed.substring(1) : trimmed;

  // Case 1: Eğer yol "images/" veya "uploads/" ile başlıyorsa static dosyadır
  if (cleanPath.startsWith('images/') || cleanPath.startsWith('uploads/')) {
    return `${origin}/${cleanPath}`;
  }

  // Case 2: Sadece bir dosya adı ise
  const filename = (cleanPath.endsWith('.jpg') || cleanPath.endsWith('.png') || cleanPath.endsWith('.jpeg') || cleanPath.endsWith('.webp'))
    ? cleanPath
    : `${cleanPath}.jpg`;

  if (!filename.includes('/')) {
    return `${origin}/images/stocks/${filename}`;
  }

  return `${origin}/${cleanPath}`;
}

