// Translation script using Google Cloud Translation API
const fs = require('fs');
const path = require('path');
const https = require('https');

const GOOGLE_API_KEY = process.env.GOOGLE_TRANSLATE_API_KEY || '';

const LANGUAGES = {
  sw: 'sw',     // Swahili
  id: 'id',     // Indonesian
  hi: 'hi',     // Hindi
  tl: 'tl',     // Tagalog
  am: 'am',     // Amharic
  rw: 'rw',     // Kinyarwanda
};

async function translateText(text, targetLang) {
  if (!GOOGLE_API_KEY) {
    throw new Error('GOOGLE_TRANSLATE_API_KEY not set in environment');
  }

  const url = `https://translation.googleapis.com/language/translate/v2?key=${GOOGLE_API_KEY}`;
  
  // Escape special characters for JSON
  const escapedText = text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  
  const data = JSON.stringify({
    q: escapedText,
    target: targetLang,
    format: 'text',
  });

  return new Promise((resolve, reject) => {
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
      },
    };

    const req = https.request(url, options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(body);
          if (result.data && result.data.translations) {
            resolve(result.data.translations[0].translatedText);
          } else {
            reject(new Error(`Translation failed: ${body}`));
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function translateObject(obj, targetLang, path = '') {
  const result = {};
  
  for (const [key, value] of Object.entries(obj)) {
    const currentPath = path ? `${path}.${key}` : key;
    
    if (typeof value === 'object' && !Array.isArray(value)) {
      result[key] = await translateObject(value, targetLang, currentPath);
    } else if (Array.isArray(value)) {
      result[key] = [];
      for (let i = 0; i < value.length; i++) {
        if (typeof value[i] === 'string') {
          process.stdout.write(`  ${currentPath}[${i}]...`);
          result[key][i] = await translateText(value[i], targetLang);
          console.log(' ✓');
        } else {
          result[key][i] = value[i];
        }
      }
    } else if (typeof value === 'string') {
      // Skip translation for placeholder variables like {points}, {name}, etc.
      if (value.includes('{') && value.includes('}')) {
        result[key] = value;
        console.log(`  ${currentPath}... (skipped - has variables)`);
      } else {
        process.stdout.write(`  ${currentPath}...`);
        result[key] = await translateText(value, targetLang);
        console.log(' ✓');
      }
    } else {
      result[key] = value;
    }
  }
  
  return result;
}

async function generateTranslations() {
  if (!GOOGLE_API_KEY) {
    console.error('ERROR: GOOGLE_TRANSLATE_API_KEY environment variable not set.');
    console.error('\nTo use Google Translate API:');
    console.error('1. Go to https://console.cloud.google.com/');
    console.error('2. Enable Cloud Translation API');
    console.error('3. Create an API key');
    console.error('4. Run: export GOOGLE_TRANSLATE_API_KEY="your-key-here"');
    console.error('5. Then run this script again\n');
    process.exit(1);
  }

  const enPath = path.join(__dirname, '../messages/en.json');
  const enContent = JSON.parse(fs.readFileSync(enPath, 'utf8'));
  
  console.log('Starting translation of ChatRewards to 6 languages...\n');
  
  for (const [code, langCode] of Object.entries(LANGUAGES)) {
    const langName = {
      sw: 'Swahili',
      id: 'Indonesian',
      hi: 'Hindi',
      tl: 'Tagalog',
      am: 'Amharic',
      rw: 'Kinyarwanda',
    }[code];
    
    console.log(`\n📝 Translating to ${langName} (${code})...`);
    
    try {
      const translated = await translateObject(enContent, langCode);
      
      const outputPath = path.join(__dirname, `../messages/${code}.json`);
      fs.writeFileSync(outputPath, JSON.stringify(translated, null, 2));
      
      console.log(`✅ ${langName} translation complete!\n`);
    } catch (error) {
      console.error(`❌ Failed to translate ${langName}:`, error.message);
    }
  }
  
  console.log('\n🎉 All translations complete!');
  console.log('Cost: ~$0.02 per language = ~$0.12 total\n');
}

generateTranslations().catch(console.error);
