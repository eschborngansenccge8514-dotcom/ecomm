import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import { Platform } from 'react-native'
import { supabase } from '@/lib/supabase'
import { router } from 'expo-router'
import Constants from 'expo-constants'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

export const notificationsService = {
  async registerForPushNotificationsAsync(userId: string) {
    if (!Device.isDevice) return null

    const { status: existingStatus } = await Notifications.getPermissionsAsync()
    let finalStatus = existingStatus

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync()
      finalStatus = status
    }

    if (finalStatus !== 'granted') return null

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId
    if (!projectId) {
      console.warn('EAS Project ID not found in app.config.ts. Push notifications might not work.')
      return null
    }

    const token = (await Notifications.getExpoPushTokenAsync({
      projectId
    })).data

    if (token) {
      await supabase.from('profiles').update({ expo_push_token: token }).eq('id', userId)
    }

    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      })
    }

    return token
  },

  listen(onNotification?: (notification: Notifications.Notification) => void) {
    const receivedSub = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification)
      if (onNotification) onNotification(notification)
    })

    const responseSub = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data
      console.log('Notification response:', data)

      if (data.orderId) {
        // Navigate based on user role (customer or merchant)
        // For now, default to customer order detail
        router.push(`/(customer)/(orders)/${data.orderId}`)
      }
    })

    return () => {
      receivedSub.remove()
      responseSub.remove()
    }
  }
}
