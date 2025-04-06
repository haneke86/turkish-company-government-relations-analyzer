import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import axios from 'axios';
import puppeteer from 'puppeteer';
import cheerio from 'cheerio';
import { v4 as uuidv4 } from 'uuid';
import FirecrawlApp from '@mendable/firecrawl-js';
import { LowSync } from 'lowdb';
import { JSONFileSync } from 'lowdb/node';

// Setup ES modules __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Turkish News Sources Configuration
const NEWS_SOURCES = {
  'hurriyet': {
    name: 'Hürriyet',
    baseUrl: 'https://www.hurriyet.com.tr',
    searchUrl: 'https://www.hurriyet.com.tr/arama/',
    selectors: {
      searchInput: 'input[name="query"]',
      searchButton: 'button[type="submit"]',
      resultList: '.searchResults .item',
      title: 'h3.title a',
      date: '.date',
      summary: '.spot',
      content: '.news-content p'
    },
    dateFormat: 'DD.MM.YYYY'
  },
  'milliyet': {
    name: 'Milliyet',
    baseUrl: 'https://www.milliyet.com.tr',
    searchUrl: 'https://www.milliyet.com.tr/arama/',
    selectors: {
      searchInput: 'input#search',
      searchButton: 'button.searchButton',
      resultList: '.archive-list .list-item',
      title: 'h3 a',
      date: '.date',
      summary: '.spot',
      content: '.article-content p'
    },
    dateFormat: 'DD.MM.YYYY'
  },
  'cumhuriyet': {
    name: 'Cumhuriyet',
    baseUrl: 'https://www.cumhuriyet.com.tr',
    searchUrl: 'https://www.cumhuriyet.com.tr/arama',
    selectors: {
      searchInput: 'input[name="query"]',
      searchButton: 'button.search-button',
      resultList: '.search-list .item',
      title: 'h3.title a',
      date: '.date',
      summary: '.summary',
      content: '.news-text p'
    },
    dateFormat: 'DD.MM.YYYY'
  },
  'sabah': {
    name: 'Sabah',
    baseUrl: 'https://www.sabah.com.tr',
    searchUrl: 'https://www.sabah.com.tr/arama',
    selectors: {
      searchInput: 'input[name="q"]',
      searchButton: 'button.btn-search',
      resultList: '.search-results .result-item',
      title: 'h3 a',
      date: '.date',
      summary: '.summary',
      content: '.article-body p'
    },
    dateFormat: 'DD.MM.YYYY'
  },
  'haberturk': {
    name: 'HaberTürk',
    baseUrl: 'https://www.haberturk.com',
    searchUrl: 'https://www.haberturk.com/arama',
    selectors: {
      searchInput: 'input[name="q"]',
      searchButton: 'button[type="submit"]',
      resultList: '.haberler .haber',
      title: 'h2 a',
      date: '.date',
      summary: '.spot',
      content: '.news-content p'
    },
    dateFormat: 'DD.MM.YYYY'
  },
  'sozcu': {
    name: 'Sözcü',
    baseUrl: 'https://www.sozcu.com.tr',
    searchUrl: 'https://www.sozcu.com.tr/arama/',
    selectors: {
      searchInput: 'input[name="s"]',
      searchButton: 'button[type="submit"]',
      resultList: '.news-list-item',
      title: 'h3 a',
      date: '.date',
      summary: '.spot',
      content: '.content p'
    },
    dateFormat: 'DD.MM.YYYY'
  },
  't24': {
    name: 'T24',
    baseUrl: 'https://t24.com.tr',
    searchUrl: 'https://t24.com.tr/arama',
    selectors: {
      searchInput: 'input[name="q"]',
      searchButton: 'button.search-button',
      resultList: '.search-results .search-item',
      title: 'h3 a',
      date: '.date',
      summary: '.summary',
      content: '.article-body p'
    },
    dateFormat: 'DD.MM.YYYY'
  },
  'dunya': {
    name: 'Dünya',
    baseUrl: 'https://www.dunya.com',
    searchUrl: 'https://www.dunya.com/arama',
    selectors: {
      searchInput: 'input[name="word"]',
      searchButton: 'button.search-button',
      resultList: '.search-items .item',
      title: 'h3 a',
      date: '.date',
      summary: '.summary',
      content: '.article-content p'
    },
    dateFormat: 'DD.MM.YYYY'
  },
  'bloomberght': {
    name: 'Bloomberg HT',
    baseUrl: 'https://www.bloomberght.com',
    searchUrl: 'https://www.bloomberght.com/arama',
    selectors: {
      searchInput: 'input[name="q"]',
      searchButton: 'button[type="submit"]',
      resultList: '.search-item',
      title: 'h3 a',
      date: '.date',
      summary: '.summary',
      content: '.article-body p'
    },
    dateFormat: 'DD.MM.YYYY'
  }
};

/**
 * NewsManager sınıfı, Türkçe haber kaynaklarından veri toplamak ve analiz etmek için kullanılır.
 * Haber arama, veri kazıma ve önbellekleme gibi işlemleri yönetir.
 */
export class NewsManager {
  constructor() {
    // Path to data directory
    this.dataDir = path.join(dirname(dirname(__dirname)), 'data');
    this.articlesDir = path.join(this.dataDir, 'articles');
    this.cacheDir = path.join(this.dataDir, 'cache');
    
    // Database for articles
    this.articlesDbPath = path.join(this.dataDir, 'news-articles.json');
    this.articlesDb = null;
    
    // Initialize Firecrawl client if API key is available
    this.firecrawlClient = process.env.FIRECRAWL_API_KEY 
      ? new FirecrawlApp({
          apiKey: process.env.FIRECRAWL_API_KEY,
          ...(process.env.FIRECRAWL_API_URL ? { apiUrl: process.env.FIRECRAWL_API_URL } : {}),
        })
      : null;
  }
  
  /**
   * Initialize the NewsManager
   */
  async initialize() {
    // Create directories if they don't exist
    await fs.mkdir(this.articlesDir, { recursive: true });
    await fs.mkdir(this.cacheDir, { recursive: true });
    
    // Initialize articles database
    try {
      await fs.access(this.articlesDbPath);
    } catch (err) {
      // File doesn't exist, create it with default data
      await fs.writeFile(
        this.articlesDbPath, 
        JSON.stringify({
          articles: [],
          metadata: {
            lastUpdated: new Date().toISOString(),
            totalCount: 0
          }
        }, null, 2)
      );
    }
    
    // Load database
    this.articlesDb = new LowSync(new JSONFileSync(this.articlesDbPath));
    this.articlesDb.read();
    
    // Ensure data structure
    if (!this.articlesDb.data || !this.articlesDb.data.articles) {
      this.articlesDb.data = { 
        articles: [],
        metadata: {
          lastUpdated: new Date().toISOString(),
          totalCount: 0
        }
      };
      this.articlesDb.write();
    }
    
    console.log(`NewsManager başlatıldı. ${this.articlesDb.data.articles.length} haber makalesi yüklendi.`);
  }
  
  /**
   * Haber kaynaklarında arama yapar
   * @param {string} query - Arama sorgusu
   * @param {object} options - Arama seçenekleri
   * @param {string[]} options.sources - Arama yapılacak kaynaklar
   * @param {object} options.dateRange - Tarih aralığı
   * @param {number} options.limit - Maksimum sonuç sayısı
   * @returns {Promise<Array>} - Haber makalelerini içeren dizi
   */
  async searchNews(query, options = {}) {
    const { sources = [], dateRange, limit = 10 } = options;
    
    console.log(`Haber araması: "${query}", Kaynaklar: ${sources.length > 0 ? sources.join(', ') : 'Tümü'}`);
    
    // First, search local database
    const localResults = this.searchLocalDatabase(query, { sources, dateRange, limit });
    
    // If we have enough results from local database, return them
    if (localResults.length >= limit) {
      return localResults.slice(0, limit);
    }
    
    // Otherwise, search online
    let onlineResults = [];
    
    // If we have Firecrawl client, use it for online search
    if (this.firecrawlClient) {
      try {
        onlineResults = await this.searchWithFirecrawl(query, { sources, dateRange, limit: limit - localResults.length });
      } catch (error) {
        console.error('Firecrawl ile haber araması yapılırken hata:', error);
        // Fall back to puppeteer scraping if Firecrawl fails
        onlineResults = await this.searchWithPuppeteer(query, { sources, dateRange, limit: limit - localResults.length });
      }
    } else {
      // Use puppeteer for scraping if Firecrawl is not available
      onlineResults = await this.searchWithPuppeteer(query, { sources, dateRange, limit: limit - localResults.length });
    }
    
    // Merge results, remove duplicates and limit
    const combinedResults = [...localResults];
    
    // Add only new results that don't exist in local results
    for (const article of onlineResults) {
      if (!combinedResults.some(local => local.url === article.url)) {
        combinedResults.push(article);
      }
      
      // Break if we have enough results
      if (combinedResults.length >= limit) {
        break;
      }
    }
    
    // Store new articles in the database
    for (const article of onlineResults) {
      if (!this.articlesDb.data.articles.some(existing => existing.url === article.url)) {
        this.addArticleToDatabase(article);
      }
    }
    
    return combinedResults.slice(0, limit);
  }
  
  /**
   * Yerel veritabanında haber araması yapar
   * @private
   */
  searchLocalDatabase(query, { sources = [], dateRange, limit = 10 }) {
    // Convert query to lowercase for case-insensitive search
    const searchTerms = query.toLowerCase().split(/\s+/);
    
    const results = this.articlesDb.data.articles.filter(article => {
      // Check if the article source is in the requested sources (if specified)
      if (sources.length > 0 && !sources.includes(article.source)) {
        return false;
      }
      
      // Check if the article date is in the requested date range (if specified)
      if (dateRange) {
        const articleDate = new Date(article.date);
        
        if (dateRange.from && new Date(dateRange.from) > articleDate) {
          return false;
        }
        
        if (dateRange.to && new Date(dateRange.to) < articleDate) {
          return false;
        }
      }
      
      // Match search terms in title, content, or summary
      const articleText = (
        (article.title || '') + ' ' + 
        (article.content || '') + ' ' + 
        (article.summary || '')
      ).toLowerCase();
      
      // All terms must be found
      return searchTerms.every(term => articleText.includes(term));
    });
    
    // Sort by date (newest first) and limit results
    return results
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, limit);
  }
  
  /**
   * Firecrawl API ile haber araması yapar
   * @private
   */
  async searchWithFirecrawl(query, { sources = [], dateRange, limit = 10 }) {
    // Build search query with source and date filters
    let searchQuery = query;
    
    // Add source filters
    if (sources.length > 0) {
      searchQuery += ' site:' + sources.map(source => {
        // Map source name to domain
        const sourceObj = Object.values(NEWS_SOURCES).find(s => s.name.toLowerCase() === source.toLowerCase());
        if (sourceObj) {
          return new URL(sourceObj.baseUrl).hostname;
        }
        return source;
      }).join(' OR site:');
    } else {
      // If no specific sources, limit to Turkish news domains
      searchQuery += ' site:' + Object.values(NEWS_SOURCES).map(source => {
        return new URL(source.baseUrl).hostname;
      }).join(' OR site:');
    }
    
    // Add date filters
    if (dateRange) {
      if (dateRange.from) {
        searchQuery += ` after:${dateRange.from}`;
      }
      
      if (dateRange.to) {
        searchQuery += ` before:${dateRange.to}`;
      }
    }
    
    // Add language filter
    searchQuery += ' lang:tr';
    
    // Search with Firecrawl
    const response = await this.firecrawlClient.search(searchQuery, {
      limit: limit,
      scrapeOptions: {
        formats: ['markdown'],
        onlyMainContent: true
      }
    });
    
    if (!response.success) {
      throw new Error(response.error || 'Firecrawl araması başarısız oldu');
    }
    
    // Format results
    return response.data.map(result => {
      const domain = new URL(result.url).hostname;
      
      // Find source from domain
      const source = Object.values(NEWS_SOURCES).find(source => {
        return domain.includes(new URL(source.baseUrl).hostname);
      });
      
      return {
        id: uuidv4(),
        title: result.title || 'Başlıksız Haber',
        url: result.url,
        date: this.extractDateFromText(result.markdown) || new Date().toISOString().split('T')[0],
        source: source ? source.name : domain,
        summary: result.description || this.extractSummary(result.markdown),
        content: result.markdown || '',
        scraped: true,
        scrapedAt: new Date().toISOString()
      };
    });
  }
  
  /**
   * Puppeteer ile haber kaynaklarını kazıyarak arama yapar
   * @private
   */
  async searchWithPuppeteer(query, { sources = [], dateRange, limit = 10 }) {
    // Determine which sources to scrape
    let sourcesToScrape = Object.values(NEWS_SOURCES);
    
    if (sources.length > 0) {
      sourcesToScrape = sourcesToScrape.filter(source => 
        sources.some(name => source.name.toLowerCase() === name.toLowerCase())
      );
    }
    
    // Limit to first 3 sources for performance reasons if not specified
    if (sources.length === 0) {
      sourcesToScrape = sourcesToScrape.slice(0, 3);
    }
    
    // Launch browser
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
      const results = [];
      
      // Loop through sources and scrape
      for (const source of sourcesToScrape) {
        // Skip if we already have enough results
        if (results.length >= limit) {
          break;
        }
        
        console.log(`Kaynakta arama yapılıyor: ${source.name}`);
        
        try {
          const page = await browser.newPage();
          await page.setViewport({ width: 1280, height: 800 });
          
          // Navigate to search page
          await page.goto(source.searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
          
          // Enter search query
          await page.type(source.selectors.searchInput, query);
          await page.click(source.selectors.searchButton);
          
          // Wait for results
          await page.waitForSelector(source.selectors.resultList, { timeout: 10000 });
          
          // Get search results
          const articles = await page.evaluate((selectors) => {
            const results = [];
            const items = document.querySelectorAll(selectors.resultList);
            
            for (let i = 0; i < items.length; i++) {
              const item = items[i];
              
              const titleEl = item.querySelector(selectors.title);
              const dateEl = item.querySelector(selectors.date);
              const summaryEl = item.querySelector(selectors.summary);
              
              if (titleEl) {
                results.push({
                  title: titleEl.textContent.trim(),
                  url: titleEl.href,
                  date: dateEl ? dateEl.textContent.trim() : '',
                  summary: summaryEl ? summaryEl.textContent.trim() : ''
                });
              }
            }
            
            return results;
          }, source.selectors);
          
          // Transform results
          for (const article of articles) {
            // Skip if we already have enough results
            if (results.length >= limit) {
              break;
            }
            
            // Format date
            let formattedDate = article.date;
            try {
              formattedDate = this.formatDate(article.date, source.dateFormat);
            } catch (e) {
              // If date formatting fails, use current date
              formattedDate = new Date().toISOString().split('T')[0];
            }
            
            // Apply date range filter
            if (dateRange) {
              const articleDate = new Date(formattedDate);
              
              if (dateRange.from && new Date(dateRange.from) > articleDate) {
                continue;
              }
              
              if (dateRange.to && new Date(dateRange.to) < articleDate) {
                continue;
              }
            }
            
            results.push({
              id: uuidv4(),
              title: article.title,
              url: article.url,
              date: formattedDate,
              source: source.name,
              summary: article.summary,
              content: '', // Content will be scraped later if needed
              scraped: false,
              scrapedAt: null
            });
          }
          
          await page.close();
        } catch (error) {
          console.error(`${source.name} kaynağında arama yapılırken hata:`, error);
          // Continue with next source if one fails
          continue;
        }
      }
      
      return results.slice(0, limit);
    } finally {
      await browser.close();
    }
  }
  
  /**
   * Haber makalesinin içeriğini kazır
   */
  async scrapeArticleContent(article) {
    // If article is already scraped, return it
    if (article.scraped && article.content) {
      return article;
    }
    
    console.log(`Makale içeriği kazınıyor: ${article.title}`);
    
    // Find source configuration
    const sourceConfig = Object.values(NEWS_SOURCES).find(source => 
      source.name === article.source
    );
    
    if (!sourceConfig) {
      throw new Error(`Kaynak yapılandırması bulunamadı: ${article.source}`);
    }
    
    // Use Firecrawl if available
    if (this.firecrawlClient) {
      try {
        return await this.scrapeWithFirecrawl(article, sourceConfig);
      } catch (error) {
        console.error('Firecrawl ile içerik kazınırken hata:', error);
        // Fall back to puppeteer
        return await this.scrapeWithPuppeteer(article, sourceConfig);
      }
    } else {
      // Use puppeteer for scraping
      return await this.scrapeWithPuppeteer(article, sourceConfig);
    }
  }
  
  /**
   * Firecrawl ile makale içeriğini kazır
   * @private
   */
  async scrapeWithFirecrawl(article, sourceConfig) {
    const response = await this.firecrawlClient.scrapeUrl(article.url, {
      formats: ['markdown'],
      onlyMainContent: true,
      waitFor: 2000
    });
    
    if (!response.success || !response.markdown) {
      throw new Error(response.error || 'İçerik kazıma başarısız oldu');
    }
    
    // Update article with content
    const updatedArticle = {
      ...article,
      content: response.markdown,
      scraped: true,
      scrapedAt: new Date().toISOString()
    };
    
    // Add or update in database
    this.addArticleToDatabase(updatedArticle);
    
    return updatedArticle;
  }
  
  /**
   * Puppeteer ile makale içeriğini kazır
   * @private
   */
  async scrapeWithPuppeteer(article, sourceConfig) {
    // Launch browser
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 800 });
      
      // Navigate to article
      await page.goto(article.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      
      // Extract content
      const content = await page.evaluate((selector) => {
        const contentElements = document.querySelectorAll(selector);
        return Array.from(contentElements).map(el => el.textContent.trim()).join('\n\n');
      }, sourceConfig.selectors.content);
      
      // Update article with content
      const updatedArticle = {
        ...article,
        content,
        scraped: true,
        scrapedAt: new Date().toISOString()
      };
      
      // Add or update in database
      this.addArticleToDatabase(updatedArticle);
      
      return updatedArticle;
    } finally {
      await browser.close();
    }
  }
  
  /**
   * Metinden tarih bilgisini çıkarır
   * @private
   */
  extractDateFromText(text) {
    if (!text) return null;
    
    // Turkish date formats regex
    const datePatterns = [
      // DD.MM.YYYY
      /(\d{1,2})\.(\d{1,2})\.(\d{4})/,
      // DD/MM/YYYY
      /(\d{1,2})\/(\d{1,2})\/(\d{4})/,
      // DD-MM-YYYY
      /(\d{1,2})-(\d{1,2})-(\d{4})/,
      // DD Ay YYYY (e.g., 15 Ocak 2020)
      /(\d{1,2})\s+(Ocak|Şubat|Mart|Nisan|Mayıs|Haziran|Temmuz|Ağustos|Eylül|Ekim|Kasım|Aralık)\s+(\d{4})/i,
      // YYYY-MM-DD (ISO)
      /(\d{4})-(\d{1,2})-(\d{1,2})/
    ];
    
    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match) {
        try {
          if (pattern.source.startsWith('(\\d{4})')) {
            // ISO format YYYY-MM-DD
            const [, year, month, day] = match;
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
          } else if (pattern.source.includes('Ocak|Şubat')) {
            // Turkish month names
            const [, day, monthName, year] = match;
            const monthNames = {
              'ocak': '01', 'şubat': '02', 'mart': '03', 'nisan': '04',
              'mayıs': '05', 'haziran': '06', 'temmuz': '07', 'ağustos': '08',
              'eylül': '09', 'ekim': '10', 'kasım': '11', 'aralık': '12'
            };
            
            const month = monthNames[monthName.toLowerCase()];
            return `${year}-${month}-${day.padStart(2, '0')}`;
          } else {
            // DD.MM.YYYY or similar
            const [, day, month, year] = match;
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
          }
        } catch (e) {
          console.error('Tarih dönüştürme hatası:', e);
          continue;
        }
      }
    }
    
    return null;
  }
  
  /**
   * Metinden özet çıkarır
   * @private
   */
  extractSummary(text, maxLength = 200) {
    if (!text) return '';
    
    // Get first paragraph
    const paragraphs = text.split(/\n\s*\n/);
    let summary = paragraphs[0];
    
    // If first paragraph is too short, include the second one
    if (summary.length < 100 && paragraphs.length > 1) {
      summary += ' ' + paragraphs[1];
    }
    
    // Truncate if too long
    if (summary.length > maxLength) {
      summary = summary.substring(0, maxLength - 3) + '...';
    }
    
    return summary;
  }
  
  /**
   * Tarih formatlar
   * @private
   */
  formatDate(dateStr, inputFormat) {
    if (!dateStr) return null;
    
    // Handle different date formats
    if (inputFormat === 'DD.MM.YYYY') {
      const match = dateStr.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
      if (match) {
        const [, day, month, year] = match;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
    }
    
    // Default: try to parse with Date
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
    
    return null;
  }
  
  /**
   * Makaleyi veritabanına ekler
   * @private
   */
  addArticleToDatabase(article) {
    // Check if article already exists
    const existingIndex = this.articlesDb.data.articles.findIndex(existing => 
      existing.url === article.url
    );
    
    if (existingIndex >= 0) {
      // Update existing article
      this.articlesDb.data.articles[existingIndex] = {
        ...this.articlesDb.data.articles[existingIndex],
        ...article,
        updatedAt: new Date().toISOString()
      };
    } else {
      // Add new article
      this.articlesDb.data.articles.push({
        ...article,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      
      // Update metadata
      this.articlesDb.data.metadata.totalCount++;
    }
    
    // Update last updated timestamp
    this.articlesDb.data.metadata.lastUpdated = new Date().toISOString();
    
    // Save to database
    this.articlesDb.write();
  }
}
