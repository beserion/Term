/**
 * Türkçe ve İngilizce büyük/küçük harf karakter duyarlılığını ortadan kaldırarak
 * metinleri normalize eder.
 */
export function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .replace(/İ/g, 'i')
    .replace(/I/g, 'i') // hem noktalı i/İ hem de noktasız ı/I karakterlerini 'i'ye eşitliyoruz
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/Ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/Ü/g, 'u')
    .replace(/ç/g, 'c')
    .replace(/Ç/g, 'c')
    .replace(/ş/g, 's')
    .replace(/Ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/Ğ/g, 'g')
    .toLowerCase()
    .trim();
}

/**
 * Arama terimlerindeki her bir kelimenin, hedef metin içinde sırasından bağımsız olarak
 * yer alıp almadığını kontrol eder.
 * Örn: "Grill electric" kelimeleri "Electric Grill" metnini eşleştirir.
 */
export function flexMatch(target: string, query: string): boolean {
  if (!query) return true;
  if (!target) return false;

  const normalizedTarget = normalizeText(target);
  const queryWords = normalizeText(query).split(/\s+/).filter(Boolean);

  // Aranan her bir kelimenin hedef metinde geçtiğini doğrula
  return queryWords.every(word => normalizedTarget.includes(word));
}
