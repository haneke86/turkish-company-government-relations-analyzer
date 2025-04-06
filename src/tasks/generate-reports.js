#!/usr/bin/env node

import { ReportGenerator } from '../lib/report-generator.js';
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

// Main function
async function generateReports() {
  try {
    console.log('Rapor oluşturma işlemi başlatılıyor...');
    
    // Initialize ReportGenerator and CompanyAnalyzer
    const reportGenerator = new ReportGenerator();
    const companyAnalyzer = new CompanyAnalyzer();
    
    await reportGenerator.initialize();
    await companyAnalyzer.initialize();
    
    // Parse command line arguments
    const args = process.argv.slice(2);
    const options = parseArguments(args);
    
    // Configure report generation
    const companies = options.companies;
    const format = options.format || 'markdown';
    const language = options.language || 'tr';
    const generateAll = options.all || false;
    const filter = options.filter;
    
    // Get companies to report on
    let companiesToReport = [];
    
    if (generateAll) {
      // Get all analyzed companies
      const allCompanies = await companyAnalyzer.listAnalyzedCompanies({
        filter,
        sortBy: 'relationScore',
        limit: 100
      });
      
      companiesToReport = allCompanies.map(company => company.name);
      
      if (companiesToReport.length === 0) {
        console.log('Analiz edilmiş şirket bulunamadı.');
        return;
      }
      
      console.log(`Toplam ${companiesToReport.length} şirket için rapor oluşturulacak.`);
    } else if (companies && companies.length > 0) {
      // Use the specified companies
      companiesToReport = companies;
      console.log(`${companiesToReport.length} şirket için rapor oluşturulacak: ${companiesToReport.join(', ')}`);
    } else {
      console.log('Rapor oluşturulacak şirket belirtilmedi. --all veya --companies seçeneğini kullanın.');
      showHelp();
      return;
    }
    
    console.log(`Rapor formatı: ${format}`);
    console.log(`Rapor dili: ${language === 'tr' ? 'Türkçe' : 'İngilizce'}`);
    
    // Generate reports for each company
    const results = [];
    
    for (const companyName of companiesToReport) {
      try {
        console.log(`\n"${companyName}" için rapor oluşturuluyor...`);
        
        const report = await reportGenerator.generateReport(companyName, {
          format,
          language
        });
        
        // For JSON format, print relationScore
        if (format === 'json') {
          console.log(`İlişki skoru: ${report.relationScore}/10`);
        }
        
        results.push({
          companyName,
          success: true
        });
        
        console.log(`"${companyName}" raporu başarıyla oluşturuldu.`);
        
      } catch (error) {
        console.error(`"${companyName}" raporu oluşturulurken hata: ${error.message}`);
        
        results.push({
          companyName,
          success: false,
          error: error.message
        });
      }
    }
    
    // Print results summary
    console.log('\n=== RAPOR OLUŞTURMA SONUÇLARI ===');
    console.log(`Toplam: ${results.length}`);
    console.log(`Başarılı: ${results.filter(r => r.success).length}`);
    console.log(`Başarısız: ${results.filter(r => !r.success).length}`);
    
    // List unsuccessful reports if any
    const failedReports = results.filter(r => !r.success);
    if (failedReports.length > 0) {
      console.log('\nBaşarısız raporlar:');
      failedReports.forEach((result, i) => {
        console.log(`${i+1}. ${result.companyName}: ${result.error}`);
      });
    }
    
    console.log('\nRapor oluşturma işlemi tamamlandı.');
    
  } catch (error) {
    console.error('Rapor oluşturma işlemi sırasında hata:', error);
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
    } else if (arg === '--format' || arg === '-f') {
      options.format = args[++i];
    } else if (arg === '--language' || arg === '-l') {
      options.language = args[++i];
    } else if (arg === '--all' || arg === '-a') {
      options.all = true;
    } else if (arg === '--filter') {
      options.filter = args[++i];
    } else if (arg === '--file') {
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
    return [];
  }
}

// Show help information
function showHelp() {
  console.log(`
Kullanım: node generate-reports.js [seçenekler]

Seçenekler:
  --companies, -c     Rapor oluşturulacak şirketler (virgülle ayrılmış liste)
  --all, -a           Tüm analiz edilmiş şirketler için rapor oluştur
  --format, -f        Rapor formatı (text, markdown, json) (varsayılan: markdown)
  --language, -l      Rapor dili (tr, en) (varsayılan: tr)
  --filter            Şirketleri filtrelemek için kullanılır (--all ile birlikte)
  --file              Şirket listesi içeren dosya yolu
  --help, -h          Bu yardım bilgisini gösterir

Örnekler:
  node generate-reports.js --companies "Koç Holding,Sabancı Holding,THY" --format markdown
  node generate-reports.js --all --format json --language en
  node generate-reports.js --all --filter "yüksek ilişki"
  node generate-reports.js --file companies.txt --format text
  `);
}

// Run the main function
generateReports().catch(error => {
  console.error('Program çalıştırılırken hata:', error);
  process.exit(1);
});
