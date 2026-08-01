/**
 * Resim yollarını/sunucu adreslerini çözümleyerek doğrudan yüklenebilir URL'ler üretir.
 */
export function resolveImageUri(
  uri: string | undefined,
  baseUrl: string,
  fullApiUrl: string
): string | undefined {
  if (!uri) return undefined;
  
  if (
    uri.startsWith('http://') ||
    uri.startsWith('https://') ||
    uri.startsWith('data:') ||
    uri.startsWith('blob:') ||
    uri.startsWith('file:')
  ) {
    return uri;
  }

  const cleanPath = uri.startsWith('/') ? uri.substring(1) : uri;

  // Case 1: Eğer yol "images/" ile başlıyorsa static dosyadır, doğrudan sunucunun ana dizininden yüklenir
  if (cleanPath.startsWith('images/')) {
    return `${baseUrl}/${cleanPath}`;
  }

  // Case 2: Sadece bir dosya adı ise veya stok klasörü altındaysa
  const filename = (cleanPath.endsWith('.jpg') || cleanPath.endsWith('.png') || cleanPath.endsWith('.jpeg'))
    ? cleanPath
    : `${cleanPath}.jpg`;

  // Dosya adının basit olması durumunda varsayılan olarak stok resimleri klasöründen yükle
  if (!filename.includes('/')) {
    return `${baseUrl}/images/stocks/${filename}`;
  }

  // Diğer durumlar için API üzerinden ViewImage yerine doğrudan static file klasöründen erişimi dene
  return `${baseUrl}/${cleanPath}`;
}
