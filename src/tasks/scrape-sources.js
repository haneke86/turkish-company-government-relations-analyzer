#!/usr/bin/env node

import { NewsManager } from '../lib/news-manager.js';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Setup ES modules __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config();

// Configuration
const DEFAULT_KEYWORDS = [
  // Large Turkish companies
  'Koç Holding', 'Sabancı Holding', 'Türk Hava Yolları', 'Turkish Airlines',
  'Türk Telekom', 'Turkcell', 'Ülker', 'Arçelik', 'Vestel', 'Tüpraş',
  'Zorlu Holding', 'Doğuş Holding', 'Borusan Holding', 'Anadolu Grubu',
  'Enka İnşaat', 'Eczacıbaşı Holding', 'İş Bankası', 'Garanti Bankası',
  'Akbank', 'Yapı Kredi', 'Halkbank', 'Vakıfbank', 'Ziraat Bankası',
  
  // Government contract keywords
  'kamu ihalesi', 'devlet ihalesi', 'hazine garantisi', 'kamu özel işbirliği',
  'KÖİ projesi', 'yap işlet devret', 'teşvik', 'vergi muafiyeti', 
  'kamu bankası kredisi', 'kamu arazisi tahsisi', 'devlet desteği'
];

// Sources to scrape
const DEFAULT_SOURCES = [
  'Hürriyet', 'Milliyet', 'Cumhuriyet', 'Sabah', 'HaberTürk',
  'Sözcü', 'T24', 'Dünya', 'Bloomberg HT'
];

// Date range defaults
const DEFAULT_DATE_RANGE = {
  from: '2002-01-01', // AKP took power in 2002
  to: new Date().toISOString().split('T')[0] // Today
};

// Main function
async function scrapeNewsSources() {
  try {
    console.log('Türk haber kaynaklarını tarama işlemi başlatılıyor...');
    
    // Initialize NewsManager
    const newsManager = new NewsManager();
    await newsManager.initialize();
    
    // Parse command line arguments
    const args = process.argv.slice(2);
    const options = parseArguments(args);
    
    // Configure scraping
    const keywords = options.keywords || DEFAULT_KEYWORDS;
    const sources = options.sources || DEFAULT_SOURCES;
    const dateRange = options.dateRange || DEFAULT_DATE_RANGE;
    const limit = options.limit || 20;
    
    console.log(`Aranacak anahtar kelimeler: ${keywords.join(', ')}`);
    console.log(`Kaynaklar: ${sources.join(', ')}`);
    console.log(`Tarih aralığı: ${dateRange.from} - ${dateRange.to}`);
    console.log(`Her arama için maksimum sonuç: ${limit}`);
    
    // Scrape news for all keywords
    let totalArticles = 0;
    let newArticles = 0;
    
    for (const keyword of keywords) {
      try {
        console.log(`"${keyword}" için haber araması yapılıyor...`);
        
        const articles = await newsManager.searchNews(keyword, {
          sources,
          dateRange,
          limit
        });
        
        console.log(`"${keyword}" için ${articles.length} haber bulundu.`);
        totalArticles += articles.length;
        
        // Scrape full content for articles that don't have it yet
        let newArticlesForKeyword = 0;
        for (let i = 0; i < articles.length; i++) {
          if (!articles[i].content) {
            try {
              console.log(`${i+1}/${articles.length}: "${articles[i].title}" için içerik kazınıyor...`);
              await newsManager.scrapeArticleContent(articles[i]);
              newArticlesForKeyword++;
            } catch (error) {
              console.error(`Makale içeriği kazınırken hata: ${error.message}`);
            }
          }
        }
        
        newArticles += newArticlesForKeyword;
        console.log(`"${keyword}" için ${newArticlesForKeyword} yeni haber içeriği kazındı.`);
        
      } catch (error) {
        console.error(`"${keyword}" araması sırasında hata: ${error.message}`);
      }
    }
    
    console.log(`\nTarama işlemi tamamlandı.`);
    console.log(`Toplam bulunan haber sayısı: ${totalArticles}`);
    console.log(`Yeni kazınan içerik sayısı: ${newArticles}`);
    
  } catch (error) {
    console.error('Tarama işlemi sırasında hata:', error);
    process.exit(1);
  }
}

// Parse command line arguments
function parseArguments(args) {
  const options = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--keywords' || arg === '-k') {
      options.keywords = args[++i].split(',');
    } else if (arg === '--sources' || arg === '-s') {
      options.sources = args[++i].split(',');
    } else if (arg === '--from') {
      if (!options.dateRange) options.dateRange = { ...DEFAULT_DATE_RANGE };
      options.dateRange.from = args[++i];
    } else if (arg === '--to') {
      if (!options.dateRange) options.dateRange = { ...DEFAULT_DATE_RANGE };
      options.dateRange.to = args[++i];
    } else if (arg === '--limit' || arg === '-l') {
      options.limit = parseInt(args[++i], 10);
    } else if (arg === '--help' || arg === '-h') {
      showHelp();
      process.exit(0);
    }
  }
  
  return options;
}

// Show help information
function showHelp() {
  console.log(`
Kullanım: node scrape-sources.js [seçenekler]

Seçenekler:
  --keywords, -k     Aranacak anahtar kelimeler (virgülle ayrılmış liste)
  --sources, -s      Haber kaynakları (virgülle ayrılmış liste)
  --from             Başlangıç tarihi (YYYY-MM-DD formatında)
  --to               Bitiş tarihi (YYYY-MM-DD formatında)
  --limit, -l        Her arama için maksimum sonuç sayısı
  --help, -h         Bu yardım bilgisini gösterir

Örnekler:
  node scrape-sources.js
  node scrape-sources.js --keywords "Koç Holding,Sabancı Holding,THY" --sources "Hürriyet,Milliyet" --from 2020-01-01 --limit 30
  `);
}

// Run the main function
scrapeNewsSources().catch(error => {
  console.error('Program çalıştırılırken hata:', error);
  process.exit(1);
});
