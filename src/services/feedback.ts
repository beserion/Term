import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';

// Sentetik sesler için ufak bir yardımcı sınıf (Alternatif olarak yerel MP3 dosyaları da yüklenebilir)
// Biz expo-av ile kısa bip sesleri simüle edemiyoruz, yerel dosya gerekir veya basit haptics ile yetiniriz.
// Şimdilik sadece Haptics kullanalım ve Audio alt yapısını hazırlayalım.
// İleride ses dosyası eklenebilirse: 
// const { sound } = await Audio.Sound.createAsync(require('../../assets/success.mp3'));

export const FeedbackService = {
  /** Başarılı bir ürün eklendiğinde/toplandığında çalışır */
  playSuccess: async () => {
    try {
      // Hafif ve kısa bir titreşim
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Gelecekte eklenecek ses kodu (Örn: İnce kısa bip)
      // const { sound } = await Audio.Sound.createAsync(require('../../assets/success.mp3'));
      // await sound.playAsync();
    } catch (error) {
      console.log('Feedback error:', error);
    }
  },

  /** Hatalı barkod okutulduğunda veya limit aşıldığında çalışır */
  playError: async () => {
    try {
      // Ağır ve güçlü bir titreşim
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      
      // Gelecekte eklenecek ses kodu (Örn: Kalın uzun bip)
      // const { sound } = await Audio.Sound.createAsync(require('../../assets/error.mp3'));
      // await sound.playAsync();
    } catch (error) {
      console.log('Feedback error:', error);
    }
  },

  /** Sadece bilgi (Örn: Barkod tarandı, miktar bekleniyor) */
  playLightImpact: async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {}
  },
  
  /** Önemli bilgi veya uyarı (Siparişin yarısı tamamlandı vb) */
  playHeavyImpact: async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } catch (error) {}
  }
};
