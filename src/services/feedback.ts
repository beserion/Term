import * as Haptics from 'expo-haptics';
import { createAudioPlayer } from 'expo-audio';

const scanSoundFile = require('../../assets/sounds/scan.wav');
const successSoundFile = require('../../assets/sounds/success.wav');
const errorSoundFile = require('../../assets/sounds/error.wav');

let scanPlayer: any = null;
let successPlayer: any = null;
let errorPlayer: any = null;

try {
  scanPlayer = createAudioPlayer(scanSoundFile);
  successPlayer = createAudioPlayer(successSoundFile);
  errorPlayer = createAudioPlayer(errorSoundFile);
} catch (e) {
  console.log('Error creating audio players:', e);
}

async function playSound(player: any) {
  if (!player) return;
  try {
    await player.seekTo(0);
    await player.play();
  } catch (error) {
    console.log('Audio playback error:', error);
  }
}

export const FeedbackService = {
  /** Başarılı bir ürün eklendiğinde/toplandığında çalışır */
  playSuccess: async () => {
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await playSound(successPlayer);
    } catch (error) {
      console.log('Feedback error:', error);
    }
  },

  /** Hatalı barkod okutulduğunda veya limit aşıldığında çalışır */
  playError: async () => {
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      await playSound(errorPlayer);
    } catch (error) {
      console.log('Feedback error:', error);
    }
  },

  /** Sadece bilgi (Örn: Barkod tarandı, miktar bekleniyor) */
  playLightImpact: async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await playSound(scanPlayer);
    } catch (error) {}
  },
  
  /** Önemli bilgi veya uyarı (Siparişin yarısı tamamlandı vb) */
  playHeavyImpact: async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } catch (error) {}
  }
};
