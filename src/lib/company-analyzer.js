import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { LowSync } from 'lowdb';
import { JSONFileSync } from 'lowdb/node';
import { NewsManager } from './news-manager.js';
import natural from 'natural';
import axios from 'axios';

// Setup ES modules __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Turkish stopwords
const TURKISH_STOPWORDS = [
  'acaba', 'altı', 'altmış', 'ama', 'ancak', 'arada', 'artık', 'asla', 'aslında', 'aşağı', 
  'ayrıca', 'bana', 'bazen', 'bazı', 'bazıları', 'belki', 'ben', 'benden', 'beni', 'benim', 
  'beş', 'bile', 'bilhassa', 'bin', 'bir', 'biraz', 'birçoğu', 'birçok', 'biri', 'birisi', 
  'birkaç', 'birşey', 'biz', 'bizden', 'bize', 'bizi', 'bizim', 'böyle', 'böylece', 'bu', 
  'buna', 'bunda', 'bundan', 'bunlar', 'bunları', 'bunların', 'bunu', 'bunun', 'burada', 
  'bütün', 'çoğu', 'çoğunu', 'çok', 'çünkü', 'da', 'daha', 'dahi', 'dan', 'de', 'defa', 
  'değil', 'diğer', 'diğeri', 'diğerleri', 'diye', 'doksan', 'dokuz', 'dolayı', 'dolayısıyla', 
  'dört', 'e', 'elbette', 'elli', 'en', 'fakat', 'falan', 'felan', 'filan', 'gene', 'gibi', 
  'görece', 'göre', 'hala', 'halde', 'halen', 'hangi', 'hangisi', 'hani', 'hatta', 'hem', 
  'henüz', 'hep', 'hepsi', 'her', 'herhangi', 'herkes', 'herkese', 'herkesi', 'herkesin', 
  'hiç', 'hiçbir', 'hiçbiri', 'i', 'için', 'içinde', 'iki', 'ile', 'ilgili', 'ise', 'işte', 
  'kaç', 'kadar', 'kendi', 'kendine', 'kendini', 'kendisi', 'kendisine', 'kendisini', 
  'kez', 'ki', 'kim', 'kime', 'kimi', 'kimin', 'kimisi', 'kırk', 'madem', 'mi', 'mı', 'mu', 
  'mü', 'nasıl', 'ne', 'neden', 'nedenle', 'nerde', 'nerede', 'nereye', 'nesi', 'neyse', 
  'niçin', 'nin', 'nın', 'niye', 'nun', 'nün', 'o', 'öbür', 'olan', 'olarak', 'oldu', 
  'olduğu', 'olduğunu', 'olduklarını', 'olmadı', 'olmadığı', 'olmak', 'olması', 'olmayan', 
  'olmaz', 'olsa', 'olsun', 'olup', 'olur', 'olursa', 'oluyor', 'on', 'ön', 'ona', 
  'önce', 'ondan', 'onlar', 'onlara', 'onlardan', 'onları', 'onların', 'onu', 'onun', 
  'orada', 'öte', 'ötürü', 'otuz', 'öyle', 'oysa', 'pek', 'rağmen', 'sana', 'sanki', 
  'sanki', 'şayet', 'şekilde', 'sekiz', 'seksen', 'sen', 'senden', 'seni', 'senin', 
  'şey', 'şeyden', 'şeye', 'şeyi', 'şeyler', 'şimdi', 'siz', 'sizden', 'size', 'sizi', 
  'sizin', 'son', 'sonra', 'şöyle', 'şu', 'şuna', 'şunda', 'şundan', 'şunlar', 'şunu', 
  'şunun', 'ta', 'tabii', 'tam', 'tamam', 'tamamen', 'tarafından', 'tüm', 'tümü', 'u', 
  'ü', 'üç', 'un', 'ün', 'up', 'üzere', 'var', 'vardı', 've', 'veya', 'ya', 'ya da', 
  'yani', 'yapacak', 'yapılan', 'yapılması', 'yapıyor', 'yapmak', 'yaptı', 'yaptığı', 
  'yaptığını', 'yaptıkları', 'ye', 'yedi', 'yerine', 'yetmiş', 'yi', 'yı', 'yine', 
  'yirmi', 'yoksa', 'yu', 'yüz', 'zaten', 'zira'
];

// Turkish government and AKP related keywords
const GOVERNMENT_KEYWORDS = [
  'hükümet', 'bakanlık', 'bakan', 'cumhurbaşkanı', 'başbakan', 'meclis', 'milletvekil', 
  'kamu', 'devlet', 'ihale', 'teşvik', 'destek', 'fon', 'kredi', 'vergi', 'muafiyet', 
  'imtiyaz', 'protokol', 'anlaşma', 'sözleşme', 'izin', 'ruhsat', 'yetki', 'karar', 
  'kanun', 'yönetmelik', 'tebliğ', 'genelge', 'düzenleme', 'komisyon', 'kurul', 'müdürlük',
  'bakanlığı', 'başkanlığı', 'müsteşarlık', 'genel müdürlük', 'toki', 'kik', 'hazine'
];

const AKP_KEYWORDS = [
  'akp', 'ak parti', 'adalet ve kalkınma partisi', 'erdoğan', 'recep tayyip erdoğan', 
  'rte', 'binali yıldırım', 'ahmet davutoğlu', 'partili', 'iktidar partisi', 
  'cumhur ittifakı', 'soylu', 'albayrak', 'berat albayrak', 'süleyman soylu'
];

/**
 * CompanyAnalyzer sınıfı, Türk şirketlerinin hükümet ve AKP ile ilişkilerini
 * haber verileri üzerinden analiz eder.
 */
export class CompanyAnalyzer {
  constructor() {
    // Path to data directory
    this.dataDir = path.join(dirname(dirname(__dirname)), 'data');
    this.companiesDir = path.join(this.dataDir, 'companies');

    // Database for company analyses
    this.companiesDbPath = path.join(this.dataDir, 'companies-analysis.json');
    this.companiesDb = null;

    // Initialize NewsManager for retrieving news data
    this.newsManager = new NewsManager();

    // Initialize Turkish NLP tokenizer
    this.tokenizer = new natural.WordTokenizer();
    this.stemmer = natural.PorterStemmerTr;
  }

  /**
   * Initialize the CompanyAnalyzer
   */
  async initialize() {
    // Create company directory if it doesn't exist
    await fs.mkdir(this.companiesDir, { recursive: true });

    // Initialize companies database
    try {
      await fs.access(this.companiesDbPath);
    } catch (err) {
      // File doesn't exist, create it with default data
      await fs.writeFile(
        this.companiesDbPath, 
        JSON.stringify({
          companies: [],
          metadata: {
            lastUpdated: new Date().toISOString(),
            totalCount: 0
          }
        }, null, 2)
      );
    }

    // Load database
    this.companiesDb = new LowSync(new JSONFileSync(this.companiesDbPath));
    this.companiesDb.read();

    // Ensure data structure
    if (!this.companiesDb.data || !this.companiesDb.data.companies) {
      this.companiesDb.data = { 
        companies: [],
        metadata: {
          lastUpdated: new Date().toISOString(),
          totalCount: 0
        }
      };
      this.companiesDb.write();
    }

    // Initialize NewsManager
    await this.newsManager.initialize();

    console.log(`CompanyAnalyzer başlatıldı. ${this.companiesDb.data.companies.length} şirket verisi yüklendi.`);
  }

  /**
   * Belirli bir şirketi analiz eder ve ilişki skorunu hesaplar
   * @param {string} companyName - Analiz edilecek şirket adı
   * @param {Object} options - Analiz seçenekleri
   * @returns {Promise<Object>} - Analiz sonucu
   */
  async analyzeCompany(companyName, options = {}) {
    const { 
      yearRange = { from: 2002, to: new Date().getFullYear() },
      includeIndividuals = true,
      detailLevel = 'detailed'
    } = options;

    console.log(`\"${companyName}\" şirketi analiz ediliyor...`);

    // Convert year range to date range
    const dateRange = {
      from: `${yearRange.from || 2002}-01-01`,
      to: yearRange.to ? `${yearRange.to}-12-31` : new Date().toISOString().split('T')[0]
    };

    // Prepare search queries
    let searchQueries = [`\"${companyName}\"`];

    // Add search queries for government and AKP relations
    const govQueries = GOVERNMENT_KEYWORDS.map(keyword => `\"${companyName}\" ${keyword}`);
    const akpQueries = AKP_KEYWORDS.map(keyword => `\"${companyName}\" ${keyword}`);

    // Combine all queries for a comprehensive search
    searchQueries = [...searchQueries, ...govQueries.slice(0, 5), ...akpQueries.slice(0, 5)];

    // Get company executives and board members if includeIndividuals is true
    let companyPeople = [];
    if (includeIndividuals) {
      try {
        // This would be a separate method to get company executives and board members
        companyPeople = await this.getCompanyPeople(companyName);
      } catch (error) {
        console.error(`Şirket yöneticileri alınırken hata: ${error.message}`);
      }
    }

    // Add prominent individuals to search queries
    if (companyPeople.length > 0) {
      const peopleQueries = companyPeople.slice(0, 3).map(person => {
        return [
          `\"${person.name}\"`,
          `\"${person.name}\" ${GOVERNMENT_KEYWORDS.slice(0, 3).join(' OR ')}`,
          `\"${person.name}\" ${AKP_KEYWORDS.slice(0, 3).join(' OR ')}`
        ];
      }).flat();

      searchQueries = [...searchQueries, ...peopleQueries];
    }

    // Collect news articles for all search queries
    let allArticles = [];
    const searchLimit = detailLevel === 'comprehensive' ? 30 : (detailLevel === 'detailed' ? 20 : 10);

    for (const query of searchQueries) {
      try {
        const articles = await this.newsManager.searchNews(query, { 
          dateRange, 
          limit: searchLimit / searchQueries.length 
        });

        // Add to allArticles, avoiding duplicates
        for (const article of articles) {
          if (!allArticles.some(existing => existing.url === article.url)) {
            allArticles.push(article);
          }
        }
      } catch (error) {
        console.error(`Haber araması yapılırken hata: ${error.message}`);
      }
    }

    // Limit the number of articles based on detailLevel
    allArticles = allArticles.slice(0, searchLimit);

    // Scrape full content for articles that don't have it yet
    for (let i = 0; i < allArticles.length; i++) {
      if (!allArticles[i].content) {
        try {
          allArticles[i] = await this.newsManager.scrapeArticleContent(allArticles[i]);
        } catch (error) {
          console.error(`Makale içeriği kazınırken hata: ${error.message}`);
        }
      }
    }

    // Analysis results
    const analysisResult = {
      id: uuidv4(),
      companyName,
      relationScore: 0,
      newsCount: allArticles.length,
      summary: '',
      keyEvents: [],
      keyPeople: [],
      governmentConnections: [],
      akpConnections: [],
      analyzedAt: new Date().toISOString()
    };

    // Calculate relation score and extract key insights
    if (allArticles.length > 0) {
      // Extract relation metrics
      const relationMetrics = this.calculateRelationMetrics(allArticles);

      // Calculate relation score (0-10)
      analysisResult.relationScore = Math.min(10, Math.round(relationMetrics.score * 10) / 10);

      // Extract key events
      analysisResult.keyEvents = this.extractKeyEvents(allArticles, relationMetrics).slice(0, 5);

      // Extract key people
      analysisResult.keyPeople = this.extractKeyPeople(allArticles, companyPeople, relationMetrics).slice(0, 5);

      // Extract government connections
      analysisResult.governmentConnections = this.extractGovernmentConnections(allArticles).slice(0, 5);

      // Extract AKP connections
      analysisResult.akpConnections = this.extractAkpConnections(allArticles).slice(0, 5);

      // Generate summary
      analysisResult.summary = await this.generateAnalysisSummary(companyName, allArticles, relationMetrics);
    } else {
      analysisResult.summary = `${companyName} için analiz edilecek haber bulunamadı.`;
    }

    // Save analysis result to database
    this.saveCompanyAnalysis(analysisResult);

    return analysisResult;
  }

  /**
   * Analiz edilmiş şirketleri listeler
   * @param {Object} options - Listeleme seçenekleri
   * @returns {Promise<Array>} - Şirket listesi
   */
  async listAnalyzedCompanies(options = {}) {
    const { filter, sortBy = 'name', limit = 20 } = options;

    // Read the companies database
    this.companiesDb.read();

    // Filter companies if a filter is provided
    let companies = [...this.companiesDb.data.companies];

    if (filter) {
      // Convert filter to lowercase for case-insensitive matching
      const filterLower = filter.toLowerCase();

      // Apply different filters based on the filter string
      if (filterLower.includes('yüksek ilişki') || filterLower.includes('high relation')) {
        companies = companies.filter(company => company.relationScore >= 7);
      } else if (filterLower.includes('orta ilişki') || filterLower.includes('medium relation')) {
        companies = companies.filter(company => company.relationScore >= 4 && company.relationScore < 7);
      } else if (filterLower.includes('düşük ilişki') || filterLower.includes('low relation')) {
        companies = companies.filter(company => company.relationScore < 4);
      } else {
        // Text-based filtering on company name and summary
        companies = companies.filter(company => {
          return company.companyName.toLowerCase().includes(filterLower) || 
                 (company.summary && company.summary.toLowerCase().includes(filterLower));
        });
      }
    }

    // Sort companies based on sortBy parameter
    switch (sortBy) {
      case 'relationScore':
        companies.sort((a, b) => b.relationScore - a.relationScore);
        break;
      case 'newsCount':
        companies.sort((a, b) => b.newsCount - a.newsCount);
        break;
      case 'lastAnalyzed':
        companies.sort((a, b) => new Date(b.analyzedAt) - new Date(a.analyzedAt));
        break;
      case 'name':
      default:
        companies.sort((a, b) => a.companyName.localeCompare(b.companyName, 'tr'));
        break;
    }

    // Limit the number of results
    companies = companies.slice(0, limit);

    // Format results
    return companies.map(company => ({
      name: company.companyName,
      relationScore: company.relationScore,
      newsCount: company.newsCount,
      summary: company.summary,
      lastAnalyzed: new Date(company.analyzedAt).toISOString().split('T')[0]
    }));
  }

  /**
   * Belirli bir şirketin analiz verilerini getirir
   * @param {string} companyName - Şirket adı
   * @returns {Promise<Object|null>} - Şirket analiz verisi
   */
  async getCompanyData(companyName) {
    // Normalize company name to handle case insensitivity
    const normalizedName = companyName.toLowerCase();

    // Read the companies database
    this.companiesDb.read();

    // Find company by name (case insensitive)
    const company = this.companiesDb.data.companies.find(
      company => company.companyName.toLowerCase() === normalizedName
    );

    if (!company) {
      return null;
    }

    return company;
  }

  /**
   * Şirket yöneticileri ve yönetim kurulu üyelerini getirir
   * @private
   * @param {string} companyName - Şirket adı
   * @returns {Promise<Array>} - Şirket ilgili kişileri
   */
  async getCompanyPeople(companyName) {
    // This would typically involve a lookup in a database or web scraping
    // For now, return an empty array
    // In a real implementation, this would return company executives and board members
    return [];
  }

  /**
   * Haber makalelerinden ilişki metriklerini hesaplar
   * @private
   * @param {Array} articles - Haber makaleleri
   * @returns {Object} - İlişki metrikleri
   */
  calculateRelationMetrics(articles) {
    // Initialize metrics
    const metrics = {
      governmentMentionCount: 0,
      akpMentionCount: 0,
      totalWordCount: 0,
      score: 0,
      sentimentScore: 0,
      topKeywords: {}
    };

    // Process each article
    for (const article of articles) {
      const content = (article.title + ' ' + (article.content || '') + ' ' + (article.summary || '')).toLowerCase();

      // Count government keywords
      GOVERNMENT_KEYWORDS.forEach(keyword => {
        const keywordLower = keyword.toLowerCase();
        const regex = new RegExp(`\\\\b${keywordLower}\\\\b`, 'g');
        const count = (content.match(regex) || []).length;
        metrics.governmentMentionCount += count;

        // Update top keywords
        if (count > 0) {
          metrics.topKeywords[keywordLower] = (metrics.topKeywords[keywordLower] || 0) + count;
        }
      });

      // Count AKP keywords
      AKP_KEYWORDS.forEach(keyword => {
        const keywordLower = keyword.toLowerCase();
        const regex = new RegExp(`\\\\b${keywordLower}\\\\b`, 'g');
        const count = (content.match(regex) || []).length;
        metrics.akpMentionCount += count;

        // Update top keywords
        if (count > 0) {
          metrics.topKeywords[keywordLower] = (metrics.topKeywords[keywordLower] || 0) + count;
        }
      });

      // Count words
      const words = this.tokenizer.tokenize(content).filter(word => !TURKISH_STOPWORDS.includes(word.toLowerCase()));
      metrics.totalWordCount += words.length;

      // Simple sentiment analysis (can be improved with more sophisticated techniques)
      // Placeholder for a more advanced sentiment analysis
      metrics.sentimentScore += 0; // Neutral sentiment as default
    }

    // Calculate relation score (0-1 scale)
    // Formula: (governmentMentions + 2*akpMentions) / totalWords, with normalization
    if (metrics.totalWordCount > 0) {
      const rawScore = (metrics.governmentMentionCount + 2 * metrics.akpMentionCount) / metrics.totalWordCount;
      metrics.score = Math.min(1, rawScore * 10); // Normalize to a 0-1 scale
    }

    // Convert topKeywords to a sorted array
    metrics.topKeywords = Object.entries(metrics.topKeywords)
      .sort((a, b) => b[1] - a[1])
      .map(([keyword, count]) => ({ keyword, count }));

    return metrics;
  }

  /**
   * Haber makalelerinden önemli olayları çıkarır
   * @private
   * @param {Array} articles - Haber makaleleri
   * @param {Object} metrics - İlişki metrikleri
   * @returns {Array} - Önemli olaylar
   */
  extractKeyEvents(articles, metrics) {
    // Sort articles by date (most recent first)
    const sortedArticles = [...articles].sort((a, b) => new Date(b.date) - new Date(a.date));

    // Extract key events from highest relevance articles
    const keyEvents = [];

    for (const article of sortedArticles) {
      // Skip if we already have enough key events
      if (keyEvents.length >= 10) {
        break;
      }

      const content = article.content || article.summary || '';
      const containsGovKeywords = GOVERNMENT_KEYWORDS.some(keyword => 
        content.toLowerCase().includes(keyword.toLowerCase())
      );

      const containsAkpKeywords = AKP_KEYWORDS.some(keyword => 
        content.toLowerCase().includes(keyword.toLowerCase())
      );

      // If the article mentions government or AKP, extract it as a key event
      if (containsGovKeywords || containsAkpKeywords) {
        keyEvents.push({
          date: article.date,
          title: article.title,
          description: article.summary || this.generateEventDescription(article),
          source: article.source,
          url: article.url
        });
      }
    }

    return keyEvents;
  }

  /**
   * Haber makalelerinden anahtar kişileri çıkarır
   * @private
   * @param {Array} articles - Haber makaleleri
   * @param {Array} companyPeople - Şirket ilişkili kişiler
   * @param {Object} metrics - İlişki metrikleri
   * @returns {Array} - Anahtar kişiler
   */
  extractKeyPeople(articles, companyPeople, metrics) {
    // Combine all article content
    const allContent = articles.map(article => {
      return (article.title + ' ' + (article.content || '') + ' ' + (article.summary || '')).toLowerCase();
    }).join(' ');

    // Count mentions of company people
    const peopleMentions = {};

    // Count mentions of provided company people
    companyPeople.forEach(person => {
      const nameRegex = new RegExp(`\\\\b${person.name.toLowerCase()}\\\\b`, 'g');
      const count = (allContent.match(nameRegex) || []).length;

      if (count > 0) {
        peopleMentions[person.name] = {
          name: person.name,
          role: person.role || 'Bilinmiyor',
          relationLevel: 'Düşük', // Default
          mentionCount: count
        };
      }
    });

    // Extract additional people from content (politicians, government officials, etc.)
    // This is a simplified approach and could be improved with NER
    const politicianNames = [
      'erdoğan', 'recep tayyip erdoğan', 'binali yıldırım', 'ahmet davutoğlu', 
      'berat albayrak', 'süleyman soylu', 'mehmet şimşek', 'mevlüt çavuşoğlu', 
      'hulusi akar', 'fahrettin koca', 'abdulhamit gül', 'bekir bozdağ'
    ];

    politicianNames.forEach(name => {
      const nameRegex = new RegExp(`\\\\b${name.toLowerCase()}\\\\b`, 'g');
      const count = (allContent.match(nameRegex) || []).length;

      if (count > 0 && !peopleMentions[name]) {
        peopleMentions[name] = {
          name: name,
          role: 'Siyasetçi/Bürokrat',
          relationLevel: count > 5 ? 'Yüksek' : (count > 2 ? 'Orta' : 'Düşük'),
          mentionCount: count
        };
      }
    });

    // Convert to array and sort by mention count
    return Object.values(peopleMentions)
      .sort((a, b) => b.mentionCount - a.mentionCount);
  }

  /**
   * Haber makalelerinden hükümet bağlantılarını çıkarır
   * @private
   * @param {Array} articles - Haber makaleleri
   * @returns {Array} - Hükümet bağlantıları
   */
  extractGovernmentConnections(articles) {
    // Extract government connections from articles
    const connections = [];

    // Key government entities to look for
    const governmentEntities = [
      'Cumhurbaşkanlığı', 'Başbakanlık', 'Hazine ve Maliye Bakanlığı', 'Sanayi ve Teknoloji Bakanlığı',
      'Ticaret Bakanlığı', 'Ulaştırma ve Altyapı Bakanlığı', 'Enerji ve Tabii Kaynaklar Bakanlığı',
      'TOKİ', 'KİK', 'Varlık Fonu', 'TMSF', 'Merkez Bankası', 'TÜBİTAK'
    ];

    // Extract connections from articles
    for (const article of articles) {
      const content = (article.title + ' ' + (article.content || '') + ' ' + (article.summary || '')).toLowerCase();

      for (const entity of governmentEntities) {
        if (content.includes(entity.toLowerCase())) {
          // Check if this entity is already in connections
          const existingIndex = connections.findIndex(conn => conn.entity.toLowerCase() === entity.toLowerCase());

          if (existingIndex >= 0) {
            // Increment count and add article if not already in list
            connections[existingIndex].count++;

            if (!connections[existingIndex].articles.some(a => a.url === article.url)) {
              connections[existingIndex].articles.push({
                title: article.title,
                date: article.date,
                url: article.url
              });
            }
          } else {
            // Add new connection
            connections.push({
              entity: entity,
              count: 1,
              type: 'Hükümet Kurumu',
              articles: [{
                title: article.title,
                date: article.date,
                url: article.url
              }]
            });
          }
        }
      }
    }

    // Sort by count and return
    return connections.sort((a, b) => b.count - a.count);
  }

  /**
   * Haber makalelerinden AKP bağlantılarını çıkarır
   * @private
   * @param {Array} articles - Haber makaleleri
   * @returns {Array} - AKP bağlantıları
   */
  extractAkpConnections(articles) {
    // Extract AKP connections from articles
    const connections = [];

    // Key AKP entities and people to look for
    const akpEntities = [
      'AKP', 'AK Parti', 'Adalet ve Kalkınma Partisi', 'Erdoğan', 'Recep Tayyip Erdoğan',
      'Binali Yıldırım', 'Ahmet Davutoğlu', 'Berat Albayrak', 'Süleyman Soylu',
      'AKP Genel Merkezi', 'Cumhur İttifakı'
    ];

    for (const entity of akpEntities) {
            if (content.includes(entity.toLowerCase())) {
              // Check if this entity is already in connections
              const existingIndex = connections.findIndex(conn => conn.entity.toLowerCase() === entity.toLowerCase());

              if (existingIndex >= 0) {
                // Increment count and add article if not already in list
                connections[existingIndex].count++;

                if (!connections[existingIndex].articles.some(a => a.url === article.url)) {
                  connections[existingIndex].articles.push({
                    title: article.title,
                    date: article.date,
                    url: article.url
                  });
                }
              } else {
                // Add new connection
                connections.push({
                  entity: entity,
                  count: 1,
                  type: 'AKP İlişkisi',
                  articles: [{
                    title: article.title,
                    date: article.date,
                    url: article.url
                  }]
                });
              }
            }
          }
        }

        // Sort by count and return
        return connections.sort((a, b) => b.count - a.count);
      }

      /**
       * Haber makalesi için olay açıklaması oluşturur
       * @private
       * @param {Object} article - Haber makalesi
       * @returns {string} - Olay açıklaması
       */
      generateEventDescription(article) {
        if (!article.content) {
          return article.title;
        }

        // Extract first paragraph or first few sentences
        const paragraphs = article.content.split(/\n\s*\n/);
        let firstParagraph = paragraphs[0];

        // Limit to 200 characters
        if (firstParagraph.length > 200) {
          firstParagraph = firstParagraph.substring(0, 197) + '...';
        }

        return firstParagraph;
      }

      /**
       * Analiz özeti oluşturur
       * @private
       * @param {string} companyName - Şirket adı
       * @param {Array} articles - Haber makaleleri
       * @param {Object} metrics - İlişki metrikleri
       * @returns {Promise<string>} - Analiz özeti
       */
      async generateAnalysisSummary(companyName, articles, metrics) {
        // Basit bir özet oluştur
        let summary = '';

        // İlişki düzeyine göre giriş cümlesi oluştur
        if (metrics.score >= 0.7) {
          summary += `${companyName}, hükümet ve AKP ile yüksek seviyede ilişkiye sahip görünmektedir. `;
        } else if (metrics.score >= 0.4) {
          summary += `${companyName}, hükümet ve AKP ile orta seviyede ilişki göstermektedir. `;
        } else {
          summary += `${companyName}'nin hükümet ve AKP ile ilişkisi düşük seviyede görünmektedir. `;
        }

        // Metriklerden özet bilgiler ekle
        summary += `İncelenen ${articles.length} haberde, `;
        summary += `toplam ${metrics.governmentMentionCount} adet hükümet ile ilgili ve `;
        summary += `${metrics.akpMentionCount} adet AKP ile ilgili anahtar kelime tespit edilmiştir. `;

        // Öne çıkan anahtar kelimeleri ekle
        if (metrics.topKeywords.length > 0) {
          summary += 'En sık geçen anahtar kelimeler: ';
          summary += metrics.topKeywords.slice(0, 3).map(k => `${k.keyword} (${k.count})`).join(', ');
          summary += '. ';
        }

        // Haberlerin tarih aralığını ekle
        if (articles.length > 0) {
          const dates = articles.map(a => new Date(a.date));
          const minDate = new Date(Math.min(...dates));
          const maxDate = new Date(Math.max(...dates));

          summary += `İncelenen haberler ${minDate.toISOString().split('T')[0]} ile ${maxDate.toISOString().split('T')[0]} `;
          summary += 'tarihleri arasındaki dönemi kapsamaktadır.';
        }

        return summary;
      }

      /**
       * Şirket analiz sonucunu veritabanına kaydeder
       * @private
       * @param {Object} analysisResult - Analiz sonucu
       */
      saveCompanyAnalysis(analysisResult) {
        // Read the companies database
        this.companiesDb.read();

        // Check if company already exists in database
        const existingIndex = this.companiesDb.data.companies.findIndex(
          company => company.companyName.toLowerCase() === analysisResult.companyName.toLowerCase()
        );

        if (existingIndex >= 0) {
          // Update existing company data
          this.companiesDb.data.companies[existingIndex] = {
            ...analysisResult,
            updatedAt: new Date().toISOString()
          };
        } else {
          // Add new company data
          this.companiesDb.data.companies.push({
            ...analysisResult,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });

          // Update metadata
          this.companiesDb.data.metadata.totalCount++;
        }

        // Update last updated timestamp
        this.companiesDb.data.metadata.lastUpdated = new Date().toISOString();

        // Save to database
        this.companiesDb.write();

        // Save detailed report to a separate file
        this.saveDetailedReport(analysisResult);
      }

      /**
       * Detaylı analiz raporunu dosyaya kaydeder
       * @private
       * @param {Object} analysisResult - Analiz sonucu
       */
      async saveDetailedReport(analysisResult) {
        try {
          // Generate report filename
          const filename = `${analysisResult.companyName.replace(/\s+/g, '-').toLowerCase()}_${new Date().toISOString().split('T')[0]}.json`;
          const filePath = path.join(this.companiesDir, filename);

          // Save report to file
          await fs.writeFile(filePath, JSON.stringify(analysisResult, null, 2));

          console.log(`Detaylı analiz raporu kaydedildi: ${filePath}`);
        } catch (error) {
          console.error(`Detaylı rapor kaydedilirken hata: ${error.message}`);
        }
      }
    }