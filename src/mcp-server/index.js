#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  Tool,
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import FirecrawlApp from '@mendable/firecrawl-js';
import PQueue from 'p-queue';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { CompanyAnalyzer } from '../lib/company-analyzer.js';
import { NewsManager } from '../lib/news-manager.js';
import { ReportGenerator } from '../lib/report-generator.js';

// Setup ES modules __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

// Initialize components
const companyAnalyzer = new CompanyAnalyzer();
const newsManager = new NewsManager();
const reportGenerator = new ReportGenerator();

// Initialize Firecrawl client for web scraping
const firecrawlClient = new FirecrawlApp({
  apiKey: process.env.FIRECRAWL_API_KEY || '',
  ...(process.env.FIRECRAWL_API_URL ? { apiUrl: process.env.FIRECRAWL_API_URL } : {}),
});

// Server initialization
const server = new Server(
  {
    name: 'turkish-news-analyzer',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      logging: {},
    },
  }
);

// Tool definitions
const SEARCH_NEWS_TOOL = {
  name: 'search_turkish_news',
  description: 'Türkçe haber kaynaklarında belirli anahtar kelimeler, şirketler veya tarih aralıklarına göre arama yapar.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Arama sorgusu (şirket adı, kişi, olay vb.)',
      },
      sources: {
        type: 'array',
        items: { type: 'string' },
        description: 'Arama yapılacak haber kaynakları (Örn: ["Hürriyet", "Milliyet", "Cumhuriyet"])',
      },
      dateRange: {
        type: 'object',
        properties: {
          from: { type: 'string', description: 'Başlangıç tarihi (YYYY-MM-DD formatında)' },
          to: { type: 'string', description: 'Bitiş tarihi (YYYY-MM-DD formatında)' }
        },
        description: 'Tarih aralığı',
      },
      limit: {
        type: 'number',
        description: 'Maksimum sonuç sayısı',
      }
    },
    required: ['query'],
  },
};

const ANALYZE_COMPANY_TOOL = {
  name: 'analyze_company_relations',
  description: 'Belirtilen şirketin hükümet ve AKP ile ilişkilerini haberlere dayanarak analiz eder.',
  inputSchema: {
    type: 'object',
    properties: {
      company: {
        type: 'string',
        description: 'Analiz edilecek şirket adı',
      },
      yearRange: {
        type: 'object',
        properties: {
          from: { type: 'number', description: 'Başlangıç yılı' },
          to: { type: 'number', description: 'Bitiş yılı' }
        },
        description: 'Analiz edilecek yıl aralığı',
      },
      includeIndividuals: {
        type: 'boolean',
        description: 'Şirket sahiplerini/yöneticilerini analize dahil et',
      },
      detailLevel: {
        type: 'string',
        enum: ['basic', 'detailed', 'comprehensive'],
        description: 'Analiz detay seviyesi',
      }
    },
    required: ['company'],
  },
};

const GENERATE_REPORT_TOOL = {
  name: 'generate_company_report',
  description: 'Belirtilen şirket için hükümet ilişkileri analiz raporu oluşturur.',
  inputSchema: {
    type: 'object',
    properties: {
      company: {
        type: 'string',
        description: 'Rapor oluşturulacak şirket adı',
      },
      format: {
        type: 'string',
        enum: ['text', 'markdown', 'json'],
        description: 'Rapor formatı',
      },
      language: {
        type: 'string',
        enum: ['tr', 'en'],
        description: 'Rapor dili (varsayılan: tr)',
      }
    },
    required: ['company'],
  },
};

const LIST_COMPANIES_TOOL = {
  name: 'list_analyzed_companies',
  description: 'Analiz edilmiş şirketleri listeler ve isteğe bağlı olarak filtreleme imkanı sunar.',
  inputSchema: {
    type: 'object',
    properties: {
      filter: {
        type: 'string',
        description: 'Filtreleme kriteri (örn: "yüksek ilişki", "düşük ilişki")',
      },
      sortBy: {
        type: 'string',
        enum: ['name', 'relationScore', 'newsCount', 'lastAnalyzed'],
        description: 'Sıralama kriteri',
      },
      limit: {
        type: 'number',
        description: 'Maksimum sonuç sayısı',
      }
    },
  },
};

// Register tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    SEARCH_NEWS_TOOL,
    ANALYZE_COMPANY_TOOL,
    GENERATE_REPORT_TOOL,
    LIST_COMPANIES_TOOL,
  ],
}));

// Tool handlers
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  try {
    switch (name) {
      case 'search_turkish_news': {
        const { query, sources = [], dateRange, limit = 10 } = args;
        
        // Log request
        console.log(`[${new Date().toISOString()}] Arama isteği: "${query}", Kaynaklar: ${sources.join(', ')}`)
        
        // Search for news
        const results = await newsManager.searchNews(query, { 
          sources, 
          dateRange, 
          limit 
        });
        
        // Format results
        const formattedResults = results.map(article => (
          `Başlık: ${article.title}\n` +
          `Kaynak: ${article.source}\n` +
          `Tarih: ${article.date}\n` +
          `URL: ${article.url}\n` +
          `${article.summary ? `Özet: ${article.summary}\n` : ''}`
        )).join('\n\n');
        
        return {
          content: [{ 
            type: 'text',
            text: formattedResults || 'Arama kriterlerinize uygun haber bulunamadı.'
          }],
          isError: false,
        };
      }
      
      case 'analyze_company_relations': {
        const { company, yearRange, includeIndividuals = true, detailLevel = 'detailed' } = args;
        
        // Log analysis request
        console.log(`[${new Date().toISOString()}] Şirket analiz isteği: "${company}"`)
        
        // Run company analysis
        const analysisResult = await companyAnalyzer.analyzeCompany(company, {
          yearRange,
          includeIndividuals,
          detailLevel
        });
        
        // Format results
        let response = `## ${company} Hükümet İlişkileri Analizi\n\n`;
        
        response += `İlişki Puanı: ${analysisResult.relationScore}/10\n\n`;
        response += `Analiz Özeti: ${analysisResult.summary}\n\n`;
        
        if (analysisResult.keyEvents && analysisResult.keyEvents.length > 0) {
          response += `### Önemli Olaylar\n\n`;
          analysisResult.keyEvents.forEach(event => {
            response += `- ${event.date}: ${event.description}\n`;
          });
          response += '\n';
        }
        
        if (analysisResult.keyPeople && analysisResult.keyPeople.length > 0) {
          response += `### Kilit Kişiler\n\n`;
          analysisResult.keyPeople.forEach(person => {
            response += `- ${person.name}: ${person.role} (İlişki: ${person.relationLevel})\n`;
          });
          response += '\n';
        }
        
        response += `Analizde kullanılan haber sayısı: ${analysisResult.newsCount}\n`;
        response += `Son analiz tarihi: ${new Date().toISOString().split('T')[0]}\n`;
        
        return {
          content: [{ 
            type: 'text',
            text: response
          }],
          isError: false,
        };
      }
      
      case 'generate_company_report': {
        const { company, format = 'text', language = 'tr' } = args;
        
        // Log report request
        console.log(`[${new Date().toISOString()}] Rapor oluşturma isteği: "${company}", Format: ${format}, Dil: ${language}`)
        
        // Generate report
        const report = await reportGenerator.generateReport(company, {
          format,
          language
        });
        
        // Handle response based on format
        if (format === 'json') {
          return {
            content: [{ 
              type: 'text',
              text: JSON.stringify(report, null, 2)
            }],
            isError: false,
          };
        } else {
          return {
            content: [{ 
              type: 'text',
              text: report
            }],
            isError: false,
          };
        }
      }
      
      case 'list_analyzed_companies': {
        const { filter, sortBy = 'name', limit = 20 } = args;
        
        // List analyzed companies
        const companies = await companyAnalyzer.listAnalyzedCompanies({
          filter,
          sortBy,
          limit
        });
        
        // Format results
        let response = `## Analiz Edilmiş Şirketler\n\n`;
        
        if (companies.length === 0) {
          response += 'Henüz analiz edilmiş şirket bulunmamaktadır.';
        } else {
          companies.forEach(company => {
            response += `- **${company.name}**\n`;
            response += `  İlişki Puanı: ${company.relationScore}/10\n`;
            response += `  Analiz Tarihi: ${company.lastAnalyzed}\n`;
            response += `  Haber Sayısı: ${company.newsCount}\n\n`;
          });
        }
        
        return {
          content: [{ 
            type: 'text',
            text: response
          }],
          isError: false,
        };
      }
      
      default:
        return {
          content: [{ type: 'text', text: `Bilinmeyen araç: ${name}` }],
          isError: true,
        };
    }
  } catch (error) {
    console.error('MCP sunucu hatası:', error);
    return {
      content: [{ 
        type: 'text',
        text: `Hata: ${error.message || String(error)}`
      }],
      isError: true,
    };
  }
});

// Start the server
async function runServer() {
  try {
    console.error('Türk Haber Analiz MCP Sunucusu başlatılıyor...');
    
    // Create data directories if they don't exist
    const dataDir = path.join(dirname(dirname(__dirname)), 'data');
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
    
    const transport = new StdioServerTransport();
    await server.connect(transport);
    
    console.error('Türk Haber Analiz MCP Sunucusu stdio üzerinde çalışıyor...');
    
    // Log successful startup
    server.sendLoggingMessage({ 
      level: 'info', 
      data: 'Türk Haber Analiz MCP Sunucusu başarıyla başlatıldı'
    });
  } catch (error) {
    console.error('MCP sunucu başlatma hatası:', error);
    process.exit(1);
  }
}

runServer().catch(error => {
  console.error('Sunucu başlatma hatası:', error);
  process.exit(1);
});
