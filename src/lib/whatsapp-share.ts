import { registerPlugin } from '@capacitor/core';

interface WhatsAppSharePlugin {
  shareFile(options: {
    phone: string;
    filePath: string;
    mimeType?: string;
  }): Promise<void>;
}

const WhatsAppShare = registerPlugin<WhatsAppSharePlugin>('WhatsAppShare');

export { WhatsAppShare };
