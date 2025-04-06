#!/usr/bin/env node

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';

// Import project components
import { NewsManager } from './src/lib/news-manager.js';
import { CompanyAnalyzer } from './src/lib/company-analyzer.js';
import { ReportGenerator } from './src/lib/report-generator.js';

// Setup ES modules __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config();

// Initialize components
const newsManager = new NewsManager();
const companyAnalyzer = new CompanyAnalyzer();
const reportGenerator = new ReportGenerator();

// Create Express app
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

// API Endpoints
app.get('/api/companies', async (req, res) => {
  try {
    const { filter, sortBy, limit } = req.query;
    const companies = await companyAnalyzer.listAnalyzedCompanies({
      filter, 
      sortBy, 
      limit: limit ? parseInt(limit) : undefined
    });
    res.json(companies);
  } catch (error) {
    console.error('Şirket listesi alınırken hata:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/companies/:companyName', async (req, res) => {
  try {
    const companyName = req.params.companyName;
    const companyData = await companyAnalyzer.getCompanyData(companyName);
    
    if (!companyData) {
      return res.status(404).json({ error: 'Şirket bulunamadı' });
    }
    
    res.json(companyData);
  } catch (error) {
    console.error('Şirket bilgisi alınırken hata:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/analyze', async (req, res) => {
  try {
    const { company, yearRange, includeIndividuals, detailLevel } = req.body;
    
    if (!company) {
      return res.status(400).json({ error: 'Şirket adı gereklidir' });
    }
    
    const analysisResult = await companyAnalyzer.analyzeCompany(company, {
      yearRange,
      includeIndividuals,
      detailLevel
    });
    
    res.json(analysisResult);
  } catch (error) {
    console.error('Analiz yapılırken hata:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/news/search', async (req, res) => {
  try {
    const { query, sources, from, to, limit } = req.query;
    
    if (!query) {
      return res.status(400).json({ error: 'Arama sorgusu gereklidir' });
    }
    
    // Format date range if provided
    let dateRange;
    if (from || to) {
      dateRange = {
        from: from || undefined,
        to: to || undefined
      };
    }
    
    // Format sources if provided
    const sourceArray = sources ? sources.split(',') : undefined;
    
    const results = await newsManager.searchNews(query, { 
      sources: sourceArray, 
      dateRange, 
      limit: limit ? parseInt(limit) : 10
    });
    
    res.json(results);
  } catch (error) {
    console.error('Haber araması yapılırken hata:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/reports/:companyName', async (req, res) => {
  try {
    const companyName = req.params.companyName;
    const format = req.query.format || 'json';
    const language = req.query.language || 'tr';
    
    const report = await reportGenerator.generateReport(companyName, {
      format,
      language
    });
    
    if (format === 'json') {
      res.json(report);
    } else {
      res.type('text/plain').send(report);
    }
  } catch (error) {
    console.error('Rapor oluşturulurken hata:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start the application
async function startApp() {
  try {
    // Create data directories if they don't exist
    const dataDir = path.join(__dirname, 'data');
    const dirs = ['articles', 'cache', 'reports', 'companies'];
    
    for (const dir of dirs) {
      try {
        await fs.mkdir(path.join(dataDir, dir), { recursive: true });
      } catch (err) {
        if (err.code !== 'EEXIST') {
          console.error(`Veri dizini oluşturulurken hata: ${err.message}`);
        }
      }
    }
    
    // Initialize components
    await newsManager.initialize();
    await companyAnalyzer.initialize();
    await reportGenerator.initialize();
    
    // Start server
    app.listen(port, () => {
      console.log(`Uygulama http://localhost:${port} adresinde çalışıyor`);
      console.log(`API endpoints:`);
      console.log(`- GET /api/companies - Tüm şirketleri listeler`);
      console.log(`- GET /api/companies/:companyName - Belirli bir şirketin bilgilerini getirir`);
      console.log(`- POST /api/analyze - Belirtilen şirketi analiz eder`);
      console.log(`- GET /api/news/search - Haber araması yapar`);
      console.log(`- GET /api/reports/:companyName - Şirket raporu oluşturur`);
    });
  } catch (error) {
    console.error('Uygulama başlatma hatası:', error);
    process.exit(1);
  }
}

// Start the application
startApp().catch(error => {
  console.error('Program çalıştırılırken hata:', error);
  process.exit(1);
});
