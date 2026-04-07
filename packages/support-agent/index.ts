export { runSupportAgent } from './src/orchestrator'
export { 
  createSupportSession, 
  loadSupportMessages, 
  touchSupportSession 
} from './src/memory/messages'
export { handleWhatsAppMessage } from './src/whatsapp-handler'
export { handleSupportEmailInput } from './src/email-handler'
