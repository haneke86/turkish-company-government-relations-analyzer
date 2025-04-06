# Türk Şirketleri Hükümet İlişkileri Analiz Sistemi

Bu proje, son 20 yıldaki (özellikle son 10 yıl) haber kaynaklarını kullanarak Türk şirketlerinin hükümet ve AKP ile olan ilişkilerini analiz eden bir araçtır.

## Proje Özeti

Bu uygulama, Türk şirketlerinin hükümet ve iktidar partisi AKP ile olan ilişkilerini değerlendirmek için haber kaynaklarındaki verileri analiz eder. Uygulama, Model Context Protocol (MCP) sunucusunu kullanarak büyük dil modellerini (LLM) haber verilerine bağlar ve şirketlerin politik ilişkilerini puanlamak için gelişmiş doğal dil işleme teknikleri kullanır.

### Temel Özellikler

- **Haber Toplama**: Türkçe haber kaynaklarından otomatik veri toplama
- **Metin Analizi**: Haberlerde şirket-hükümet ilişkilerini belirlemek için NLP analizi
- **İlişki Puanlama**: Şirketlerin hükümet/AKP ile ilişkilerini derecelendirme sistemi
- **Raporlama**: Türkçe kapsamlı şirket analiz raporları oluşturma
- **MCP Entegrasyonu**: LLM modelleri ile entegrasyon için Model Context Protocol desteği

## Kurulum

1. Projeyi klonlayın:
   ```bash
   git clone https://github.com/haneke86/turkish-company-government-relations-analyzer.git
   cd turkish-company-government-relations-analyzer
   ```

2. Bağımlılıkları yükleyin:
   ```bash
   npm install
   ```

3. `.env` dosyasını oluşturun ve gerekli API anahtarlarını ekleyin:
   ```
   OPENAI_API_KEY=your_openai_key
   FIRECRAWL_API_KEY=your_firecrawl_key
   NEWS_API_KEY=your_news_api_key
   ```

4. Veri dizinlerini oluşturun:
   ```bash
   mkdir -p data/articles data/cache data/reports data/companies
   ```

## Kullanım

### MCP Sunucusunu Başlatma

```bash
npm run mcp
```

### Haber Kaynaklarından Veri Toplama

```bash
npm run scrape
```

### Şirket Analizini Çalıştırma

```bash
npm run analyze --company="ŞirketAdı"
```

### Tüm Şirketler için Rapor Oluşturma

```bash
npm run report
```

## MCP Sunucusu ile Claude Kullanımı

Claude Desktop veya diğer MCP uyumlu istemcilerle kullanmak için `claude_desktop_config.json` dosyanıza aşağıdaki yapılandırmayı ekleyin:

```json
{
  "mcpServers": {
    "turkish-news-analyzer": {
      "command": "node",
      "args": ["path/to/src/mcp-server/index.js"],
      "env": {
        "OPENAI_API_KEY": "your_openai_key",
        "FIRECRAWL_API_KEY": "your_firecrawl_key"
      }
    }
  }
}
```

## Veri Kaynakları

Uygulama aşağıdaki Türkçe haber kaynaklarını kullanır:

- Hürriyet
- Milliyet
- Cumhuriyet
- Sabah
- HaberTürk
- Sözcü
- T24
- Dünya
- Ekonomist
- Bloomberg HT

## Lisans

MIT
