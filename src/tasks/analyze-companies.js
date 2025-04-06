#!/usr/bin/env node

import { CompanyAnalyzer } from '../lib/company-analyzer.js';
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
const DEFAULT_COMPANIES = [
  // Large Turkish companies
  'Koç Holding', 'Sabancı Holding', 'Türk Hava Yolları', 'Turkish Airlines',
  'Türk Telekom', 'Turkcell', 'Ülker', 'Arçelik', 'Vestel', 'Tüpraş',
  'Zorlu Holding', 'Doğuş Holding', 'Borusan Holding', 'Anadolu Grubu',
  'Enka İnşaat', 'Eczacıbaşı Holding', 'İş Bankası', 'Garanti Bankası',
  'Akbank', 'Yapı Kredi', 'Halkbank', 'Vakıfbank', 'Ziraat Bankası'
];

// Year range defaults
const DEFAULT_YEAR_RANGE = {
  from: 2002, // AKP took power in 2002
  to: new Date().getFullYear() // Current year
};

// Detail level
const DEFAULT_DETAIL_LEVEL = 'detailed'; // 'basic', 'detailed', 'comprehensive'

// Main function
async function analyzeCompanies() {
  try {
    console.log('Şirket analizi işlemi başlatılıyor...');
    
    // Initialize CompanyAnalyzer
    const companyAnalyzer = new CompanyAnalyzer();
    await companyAnalyzer.initialize();
    
    // Parse command line arguments
    const args = process.argv.slice(2);
    const options = parseArguments(args);
    
    // Configure analysis
    const companies = options.companies || DEFAULT_COMPANIES;
    const yearRange = options.yearRange || DEFAULT_YEAR_RANGE;
    const detailLevel = options.detailLevel || DEFAULT_DETAIL_LEVEL;
    const includeIndividuals = options.includeIndividuals !== false;
    
    console.log(`Analiz edilecek şirketler: ${companies.join(', ')}`);
    console.log(`Yıl aralığı: ${yearRange.from} - ${yearRange.to}`);
    console.log(`Detay seviyesi: ${detailLevel}`);
    console.log(`Bireyleri dahil et: ${includeIndividuals ? 'Evet' : 'Hayır'}`);
    
    // Analyze each company
    const results = [];
    
    for (const companyName of companies) {
      try {
        console.log(`\n"${companyName}" analiz ediliyor...`);
        
        const result = await companyAnalyzer.analyzeCompany(companyName, {
          yearRange,
          detailLevel,
          includeIndividuals
        });
        
        console.log(`"${companyName}" analizi tamamlandı. İlişki skoru: ${result.relationScore}/10`);
        console.log(`Özet: ${result.summary}`);
        
        // Key events
        if (result.keyEvents && result.keyEvents.length > 0) {
          console.log(`\nÖnemli olaylar (${result.keyEvents.length}):`);
          result.keyEvents.forEach((event, i) => {
            console.log(`${i+1}. ${event.date}: ${event.title}`);
          });
        }
        
        // Key people
        if (result.keyPeople && result.keyPeople.length > 0) {
          console.log(`\nKilit kişiler (${result.keyPeople.length}):`);
          result.keyPeople.forEach((person, i) => {
            console.log(`${i+1}. ${person.name} - ${person.role} (İlişki: ${person.relationLevel})`);
          });
        }
        
        results.push({
          companyName: result.companyName,
          relationScore: result.relationScore,
          newsCount: result.newsCount
        });
        
      } catch (error) {
        console.error(`"${companyName}" analizi sırasında hata: ${error.message}`);
      }
    }
    
    // Sort and display results
    console.log('\n=== ANALİZ SONUÇLARI ===');
    console.log('İlişki skoruna göre sıralanmış şirketler:');
    
    results.sort((a, b) => b.relationScore - a.relationScore);
    
    results.forEach((company, i) => {
      console.log(`${i+1}. ${company.companyName}: ${company.relationScore}/10 (${company.newsCount} haber)`);
    });
    
    console.log('\nAnaliz işlemi tamamlandı.');
    
  } catch (error) {
    console.error('Analiz işlemi sırasında hata:', error);
    process.exit(1);
  }
}

// Parse command line arguments
function parseArguments(args) {
  const options = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--companies' || arg === '-c') {
      options.companies = args[++i].split(',');
    } else if (arg === '--from-year') {
      if (!options.yearRange) options.yearRange = { ...DEFAULT_YEAR_RANGE };
      options.yearRange.from = parseInt(args[++i], 10);
    } else if (arg === '--to-year') {
      if (!options.yearRange) options.yearRange = { ...DEFAULT_YEAR_RANGE };
      options.yearRange.to = parseInt(args[++i], 10);
    } else if (arg === '--detail-level' || arg === '-d') {
      options.detailLevel = args[++i];
    } else if (arg === '--no-individuals') {
      options.includeIndividuals = false;
    } else if (arg === '--file' || arg === '-f') {
      const filePath = args[++i];
      options.companies = readCompaniesFromFile(filePath);
    } else if (arg === '--help' || arg === '-h') {
      showHelp();
      process.exit(0);
    }
  }
  
  return options;
}

// Read companies from file
function readCompaniesFromFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return content.split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'));
  } catch (error) {
    console.error(`Dosya okunurken hata: ${error.message}`);
    return DEFAULT_COMPANIES;
  }
}

// Show help information
function showHelp() {
  console.log(`
Kullanım: node analyze-companies.js [seçenekler]

Seçenekler:
  --companies, -c      Analiz edilecek şirketler (virgülle ayrılmış liste)
  --file, -f           Şirket listesi içeren dosya yolu
  --from-year          Başlangıç yılı
  --to-year            Bitiş yılı
  --detail-level, -d   Detay seviyesi (basic, detailed, comprehensive)
  --no-individuals     Şirket yöneticilerini dahil etme
  --help, -h           Bu yardım bilgisini gösterir

Örnekler:
  node analyze-companies.js
  node analyze-companies.js --companies "Koç Holding,Sabancı Holding,THY" --from-year 2015 --detail-level comprehensive
  node analyze-companies.js --file companies.txt --no-individuals
  `);
}

// Run the main function
analyzeCompanies().catch(error => {
  console.error('Program çalıştırılırken hata:', error);
  process.exit(1);
});
