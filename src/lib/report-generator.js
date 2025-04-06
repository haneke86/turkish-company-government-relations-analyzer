import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { LowSync } from 'lowdb';
import { JSONFileSync } from 'lowdb/node';
import { CompanyAnalyzer } from './company-analyzer.js';

// Setup ES modules __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * ReportGenerator sınıfı, şirket analiz sonuçlarına dayanarak
 * farklı formatlarda raporlar oluşturur.
 */
export class ReportGenerator {
  constructor() {
    // Path to data directory
    this.dataDir = path.join(dirname(dirname(__dirname)), 'data');
    this.reportsDir = path.join(this.dataDir, 'reports');
    
    // Initialize CompanyAnalyzer for accessing company data
    this.companyAnalyzer = new CompanyAnalyzer();
  }
  
  /**
   * Initialize the ReportGenerator
   */
  async initialize() {
    // Create reports directory if it doesn't exist
    await fs.mkdir(this.reportsDir, { recursive: true });
    
    // Initialize CompanyAnalyzer
    await this.companyAnalyzer.initialize();
    
    console.log('ReportGenerator başlatıldı.');
  }
  
  /**
   * Belirli bir şirket için rapor oluşturur
   * @param {string} companyName - Rapor oluşturulacak şirket adı
   * @param {Object} options - Rapor seçenekleri
   * @returns {Promise<string|Object>} - Oluşturulan rapor (format seçeneğine göre string veya object)
   */
  async generateReport(companyName, options = {}) {
    const { format = 'text', language = 'tr' } = options;
    
    // Get company data from CompanyAnalyzer
    const companyData = await this.companyAnalyzer.getCompanyData(companyName);
    
    if (!companyData) {
      throw new Error(`"${companyName}" şirketi için analiz verisi bulunamadı.`);
    }
    
    // Generate report based on format
    let report;
    switch (format) {
      case 'json':
        report = this.generateJsonReport(companyData, language);
        break;
      case 'markdown':
        report = this.generateMarkdownReport(companyData, language);
        break;
      case 'text':
      default:
        report = this.generateTextReport(companyData, language);
        break;
    }
    
    // Save report to file if needed
    await this.saveReport(companyName, report, format);
    
    return report;
  }
  
  /**
   * JSON formatında rapor oluşturur
   * @private
   * @param {Object} companyData - Şirket analiz verisi
   * @param {string} language - Rapor dili (tr veya en)
   * @returns {Object} - JSON formatında rapor
   */
  generateJsonReport(companyData, language = 'tr') {
    // JSON report is basically the company data with some formatting
    const report = {
      companyName: companyData.companyName,
      relationScore: companyData.relationScore,
      summary: companyData.summary,
      keyEvents: companyData.keyEvents,
      keyPeople: companyData.keyPeople,
      governmentConnections: companyData.governmentConnections,
      akpConnections: companyData.akpConnections,
      newsCount: companyData.newsCount,
      analyzedAt: companyData.analyzedAt,
      reportGeneratedAt: new Date().toISOString()
    };
    
    // Add language localization if needed
    if (language === 'en') {
      report.language = 'en';
      // Translate fields to English if needed
      // This would be expanded in a real implementation
    } else {
      report.language = 'tr';
    }
    
    return report;
  }
  
  /**
   * Markdown formatında rapor oluşturur
   * @private
   * @param {Object} companyData - Şirket analiz verisi
   * @param {string} language - Rapor dili (tr veya en)
   * @returns {string} - Markdown formatında rapor
   */
  generateMarkdownReport(companyData, language = 'tr') {
    const titles = language === 'tr' ? {
      reportTitle: 'Şirket Hükümet İlişkileri Analiz Raporu',
      summary: 'Özet',
      relationScore: 'İlişki Skoru',
      keyEvents: 'Önemli Olaylar',
      keyPeople: 'Kilit Kişiler',
      governmentConnections: 'Hükümet Bağlantıları',
      akpConnections: 'AKP Bağlantıları',
      newsCount: 'İncelenen Haber Sayısı',
      analyzedAt: 'Analiz Tarihi',
      reportDate: 'Rapor Tarihi'
    } : {
      reportTitle: 'Company Government Relations Analysis Report',
      summary: 'Summary',
      relationScore: 'Relation Score',
      keyEvents: 'Key Events',
      keyPeople: 'Key People',
      governmentConnections: 'Government Connections',
      akpConnections: 'AKP Connections',
      newsCount: 'Number of News Articles Analyzed',
      analyzedAt: 'Analysis Date',
      reportDate: 'Report Date'
    };
    
    // Build markdown report
    let report = `# ${titles.reportTitle}: ${companyData.companyName}\n\n`;
    
    // Add summary
    report += `## ${titles.summary}\n\n`;
    report += `${companyData.summary}\n\n`;
    
    // Add relation score
    report += `## ${titles.relationScore}\n\n`;
    report += `**${companyData.relationScore}/10**\n\n`;
    
    // Add key events
    report += `## ${titles.keyEvents}\n\n`;
    if (companyData.keyEvents && companyData.keyEvents.length > 0) {
      companyData.keyEvents.forEach(event => {
        report += `- **${event.date}**: ${event.title}\n`;
        if (event.description) {
          report += `  ${event.description}\n`;
        }
        report += `  [${event.source}](${event.url})\n\n`;
      });
    } else {
      report += language === 'tr' ? 'Önemli olay bulunamadı.\n\n' : 'No key events found.\n\n';
    }
    
    // Add key people
    report += `## ${titles.keyPeople}\n\n`;
    if (companyData.keyPeople && companyData.keyPeople.length > 0) {
      companyData.keyPeople.forEach(person => {
        report += `- **${person.name}**: ${person.role} (${language === 'tr' ? 'İlişki' : 'Relation'}: ${person.relationLevel})\n`;
      });
      report += '\n';
    } else {
      report += language === 'tr' ? 'Kilit kişi bulunamadı.\n\n' : 'No key people found.\n\n';
    }
    
    // Add government connections
    report += `## ${titles.governmentConnections}\n\n`;
    if (companyData.governmentConnections && companyData.governmentConnections.length > 0) {
      companyData.governmentConnections.forEach(connection => {
        report += `- **${connection.entity}** (${connection.count} ${language === 'tr' ? 'haberde geçiyor' : 'mentions'})\n`;
      });
      report += '\n';
    } else {
      report += language === 'tr' ? 'Hükümet bağlantısı bulunamadı.\n\n' : 'No government connections found.\n\n';
    }
    
    // Add AKP connections
    report += `## ${titles.akpConnections}\n\n`;
    if (companyData.akpConnections && companyData.akpConnections.length > 0) {
      companyData.akpConnections.forEach(connection => {
        report += `- **${connection.entity}** (${connection.count} ${language === 'tr' ? 'haberde geçiyor' : 'mentions'})\n`;
      });
      report += '\n';
    } else {
      report += language === 'tr' ? 'AKP bağlantısı bulunamadı.\n\n' : 'No AKP connections found.\n\n';
    }
    
    // Add metadata
    report += `---\n\n`;
    report += `${titles.newsCount}: ${companyData.newsCount}\n\n`;
    report += `${titles.analyzedAt}: ${new Date(companyData.analyzedAt).toLocaleDateString(language === 'tr' ? 'tr-TR' : 'en-US')}\n\n`;
    report += `${titles.reportDate}: ${new Date().toLocaleDateString(language === 'tr' ? 'tr-TR' : 'en-US')}\n`;
    
    return report;
  }
  
  /**
   * Düz metin formatında rapor oluşturur
   * @private
   * @param {Object} companyData - Şirket analiz verisi
   * @param {string} language - Rapor dili (tr veya en)
   * @returns {string} - Düz metin formatında rapor
   */
  generateTextReport(companyData, language = 'tr') {
    const titles = language === 'tr' ? {
      reportTitle: 'Şirket Hükümet İlişkileri Analiz Raporu',
      summary: 'Özet',
      relationScore: 'İlişki Skoru',
      keyEvents: 'Önemli Olaylar',
      keyPeople: 'Kilit Kişiler',
      governmentConnections: 'Hükümet Bağlantıları',
      akpConnections: 'AKP Bağlantıları',
      newsCount: 'İncelenen Haber Sayısı',
      analyzedAt: 'Analiz Tarihi',
      reportDate: 'Rapor Tarihi'
    } : {
      reportTitle: 'Company Government Relations Analysis Report',
      summary: 'Summary',
      relationScore: 'Relation Score',
      keyEvents: 'Key Events',
      keyPeople: 'Key People',
      governmentConnections: 'Government Connections',
      akpConnections: 'AKP Connections',
      newsCount: 'Number of News Articles Analyzed',
      analyzedAt: 'Analysis Date',
      reportDate: 'Report Date'
    };
    
    // Build text report
    let report = `${titles.reportTitle}: ${companyData.companyName}\n`;
    report += `${'='.repeat(titles.reportTitle.length + companyData.companyName.length + 2)}\n\n`;
    
    // Add summary
    report += `${titles.summary}:\n`;
    report += `${'-'.repeat(titles.summary.length + 1)}\n`;
    report += `${companyData.summary}\n\n`;
    
    // Add relation score
    report += `${titles.relationScore}: ${companyData.relationScore}/10\n\n`;
    
    // Add key events
    report += `${titles.keyEvents}:\n`;
    report += `${'-'.repeat(titles.keyEvents.length + 1)}\n`;
    if (companyData.keyEvents && companyData.keyEvents.length > 0) {
      companyData.keyEvents.forEach(event => {
        report += `* ${event.date}: ${event.title}\n`;
        if (event.description) {
          report += `  ${event.description}\n`;
        }
        report += `  Kaynak: ${event.source} (${event.url})\n\n`;
      });
    } else {
      report += language === 'tr' ? 'Önemli olay bulunamadı.\n\n' : 'No key events found.\n\n';
    }
    
    // Add key people
    report += `${titles.keyPeople}:\n`;
    report += `${'-'.repeat(titles.keyPeople.length + 1)}\n`;
    if (companyData.keyPeople && companyData.keyPeople.length > 0) {
      companyData.keyPeople.forEach(person => {
        report += `* ${person.name}: ${person.role} (${language === 'tr' ? 'İlişki' : 'Relation'}: ${person.relationLevel})\n`;
      });
      report += '\n';
    } else {
      report += language === 'tr' ? 'Kilit kişi bulunamadı.\n\n' : 'No key people found.\n\n';
    }
    
    // Add government connections
    report += `${titles.governmentConnections}:\n`;
    report += `${'-'.repeat(titles.governmentConnections.length + 1)}\n`;
    if (companyData.governmentConnections && companyData.governmentConnections.length > 0) {
      companyData.governmentConnections.forEach(connection => {
        report += `* ${connection.entity} (${connection.count} ${language === 'tr' ? 'haberde geçiyor' : 'mentions'})\n`;
      });
      report += '\n';
    } else {
      report += language === 'tr' ? 'Hükümet bağlantısı bulunamadı.\n\n' : 'No government connections found.\n\n';
    }
    
    // Add AKP connections
    report += `${titles.akpConnections}:\n`;
    report += `${'-'.repeat(titles.akpConnections.length + 1)}\n`;
    if (companyData.akpConnections && companyData.akpConnections.length > 0) {
      companyData.akpConnections.forEach(connection => {
        report += `* ${connection.entity} (${connection.count} ${language === 'tr' ? 'haberde geçiyor' : 'mentions'})\n`;
      });
      report += '\n';
    } else {
      report += language === 'tr' ? 'AKP bağlantısı bulunamadı.\n\n' : 'No AKP connections found.\n\n';
    }
    
    // Add metadata
    report += `---\n`;
    report += `${titles.newsCount}: ${companyData.newsCount}\n`;
    report += `${titles.analyzedAt}: ${new Date(companyData.analyzedAt).toLocaleDateString(language === 'tr' ? 'tr-TR' : 'en-US')}\n`;
    report += `${titles.reportDate}: ${new Date().toLocaleDateString(language === 'tr' ? 'tr-TR' : 'en-US')}\n`;
    
    return report;
  }
  
  /**
   * Raporu dosyaya kaydeder
   * @private
   * @param {string} companyName - Şirket adı
   * @param {string|Object} report - Oluşturulan rapor
   * @param {string} format - Rapor formatı
   */
  async saveReport(companyName, report, format) {
    try {
      // Generate filename based on company name and format
      const formattedName = companyName.replace(/\s+/g, '-').toLowerCase();
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `${formattedName}_report_${timestamp}.${format === 'json' ? 'json' : (format === 'markdown' ? 'md' : 'txt')}`;
      
      // Full path to save the report
      const filePath = path.join(this.reportsDir, filename);
      
      // Save the report
      if (format === 'json') {
        await fs.writeFile(filePath, JSON.stringify(report, null, 2));
      } else {
        await fs.writeFile(filePath, report);
      }
      
      console.log(`Rapor başarıyla kaydedildi: ${filePath}`);
    } catch (error) {
      console.error(`Rapor kaydedilirken hata: ${error.message}`);
    }
  }
}
