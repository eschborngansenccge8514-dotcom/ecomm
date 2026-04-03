const { GoogleGenAI } = require('@google/genai');
const fs = require('fs');
const path = require('path');

// Load environment variables from the dashboard app
require('dotenv').config({ path: path.join(__dirname, '../../../apps/dashboard/.env.local') });

// Initialize with your Google AI API Key
const client = new GoogleGenAI({
  apiKey: process.env.GOOGLE_AI_API_KEY
});

const docs = [
  { file: 'lhdn-implementation-phases.md', label: 'LHDN e-Invoice Guideline - Implementation' },
  { file: 'lhdn-faq.md',                   label: 'LHDN e-Invoice FAQ' }
];

async function main() {
  if (!process.env.GOOGLE_AI_API_KEY) {
    console.error('❌ Missing GOOGLE_AI_API_KEY in your environment.');
    process.exit(1);
  }

  console.log('🚀 Initializing MerchantMind LHDN Knowledge Base...');

  // 1. Create the File Search Store (Corpus)
  const store = await client.fileSearchStores.create({
    displayName: 'MerchantMind LHDN Knowledge'
  });

  const storeId = store.name; // This is the 'fileSearchStores/xxx' string
  console.log('✅ Store Created:', storeId);

  // 2. Upload and Add Documents
  for (const doc of docs) {
    const filePath = path.join(__dirname, '../docs', doc.file);
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️ Skipping missing file: ${doc.file}`);
      continue;
    }

    console.log(`📤 Uploading and Indexing ${doc.label}...`);
    
    try {
      const fileData = fs.readFileSync(filePath);
      
      // Correct method: uploadToFileSearchStore with explicit mimeType
      let operation = await client.fileSearchStores.uploadToFileSearchStore({
        fileSearchStoreName: storeId,
        file:                 fileData,
        config: {
          displayName: doc.label,
          mimeType:    'text/markdown'
        }
      });

      // Wait for indexing to complete
      while (!operation.done) {
        process.stdout.write('.');
        await new Promise(r => setTimeout(r, 4000));
        // Refresh operation status
        operation = await client.operations.get({ name: operation.name });
      }

      console.log(`\n✅ Success: ${doc.label}`);
    } catch (err) {
      console.error(`\n❌ Failed to upload ${doc.label}:`);
      console.error(err.message || err);
      if (err.response) {
        try {
          const body = await err.response.text();
          console.error('API Error details:', body);
        } catch (e) {
          console.error('Could not read error response body');
        }
      }
      break;
    }
  }

  console.log('\n✨ DONE! Copy the ID below to your .env.local file:');
  console.log('--------------------------------------------------');
  console.log(`GEMINI_FILE_SEARCH_STORE_ID=${storeId}`);
  console.log('--------------------------------------------------');
}

main().catch(console.error);
