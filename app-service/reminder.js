import { notify } from '@zos/notification'

AppService({
  onInit(param) {
    try {
      const event = JSON.parse(param || '{}')
      if (!event.prayer || !event.region) return
      notify({
        title: event.early ? '10 menit menuju ' + event.prayer : 'Waktu ' + event.prayer + ' tiba',
        content: event.region,
        actions: [],
        vibrate: 5
      })
    } catch (error) {
      console.log('Pengingat gagal: ' + error)
    }
  }
})
