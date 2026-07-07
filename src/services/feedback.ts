import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';

const scanSoundFile = require('../../assets/sounds/scan.wav');
const successSoundFile = require('../../assets/sounds/success.wav');
const errorSoundFile = require('../../assets/sounds/error.wav');

// Expo Audio'nun sessiz modda da çalışmasını sağla
Audio.setAudioModeAsync({
  playsInSilentModeIOS: true,
  shouldRouteThroughEarpieceAndroid: false,
}).catch(() => {});

async function playSound(source: any) {
  try {
    const { sound } = await Audio.Sound.createAsync(source);
    await sound.playAsync();
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        sound.unloadAsync().catch(() => {});
      }
    });
  } catch (error) {
    console.log('Audio playback error:', error);
  }
}

export const FeedbackService = {
  /** Başarılı bir ürün eklendiğinde/toplandığında çalışır */
  playSuccess: async () => {
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await playSound(successSoundFile);
    } catch (error) {
      console.log('Feedback error:', error);
    }
  },

  /** Hatalı barkod okutulduğunda veya limit aşıldığında çalışır */
  playError: async () => {
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      await playSound(errorSoundFile);
    } catch (error) {
      console.log('Feedback error:', error);
    }
  },

  /** Sadece bilgi (Örn: Barkod tarandı, miktar bekleniyor) */
  playLightImpact: async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await playSound(scanSoundFile);
    } catch (error) {}
  },
  
  /** Önemli bilgi veya uyarı (Siparişin yarısı tamamlandı vb) */
  playHeavyImpact: async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } catch (error) {}
  }
};
