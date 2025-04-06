# Turkish Company Government Relations Analyzer

An application for analyzing Turkish companies' relationships with the government and AKP party based on news data from the past 20 years.

## Overview

This project helps researchers and journalists analyze the relationships between Turkish companies and the government/ruling AKP party by:

1. Collecting news articles from major Turkish news sources
2. Analyzing the content for keywords and relationships
3. Calculating relation scores based on various metrics
4. Generating comprehensive reports in Turkish 
5. Providing a user-friendly interface for exploration

## Key Features

- **News Collection**: Gathers news from multiple Turkish sources over a 20-year period
- **Automated Analysis**: Uses natural language processing to detect government and political connections
- **Relation Scoring**: Calculates objective relationship scores on a 0-10 scale
- **Turkish-language Reports**: Generates detailed reports in Turkish
- **Web Interface**: User-friendly dashboard for companies and analysis

## Technology Stack

- **Backend**: Node.js with Express
- **Web Scraping**: Puppeteer & Firecrawl
- **Data Storage**: LowDB for local storage
- **NLP**: Natural language processing specifically for Turkish language
- **UI**: Bootstrap 5 with interactive components
- **APIs**: RESTful API architecture for all functionality

## MCP Server Implementations

This project incorporates several MCP Server implementations to enhance its capabilities:

1. **Firecrawl MCP Server** - For web scraping and search:
   - Provides tools for scraping news websites
   - Handles batch processing of multiple news sources
   - Manages crawling of linked content
   - Includes search capabilities for finding relevant news

2. **Vector Search (Qdrant MCP Server)** - For semantic search:
   - Enables semantic search over embedded news content
   - Stores metadata alongside vector embeddings
   - Retrieves contextually relevant articles
   - Supports real-time updates as news becomes available

3. **Full-Text Search (Elasticsearch MCP Server)** - For text analysis:
   - Provides advanced document operations (search_documents, index_document)
   - Manages indices for different news categories
   - Supports query-based deletion for outdated news
   - Includes cluster health monitoring for scalable systems

4. **Structured Data Management (ATLAS MCP Server)** - For organizing research:
   - Implements three-tier architecture (Projects, Tasks, Knowledge)
   - Uses Neo4j graph database for relationship management
   - Provides advanced search with fuzzy matching
   - Supports deep research capabilities for related content generation

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/haneke86/turkish-company-government-relations-analyzer.git
   cd turkish-company-government-relations-analyzer
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   ```
   Then edit `.env` with your API keys and configuration settings.

4. Create necessary directories:
   ```bash
   mkdir -p data/{articles,cache,reports,companies}
   ```

5. Start the application:
   ```bash
   npm start
   ```

## Usage

### Web Interface

The web interface is available at http://localhost:3000 and provides:

- Company listing with relation scores
- Company analysis tool
- News search functionality 
- Report generation

### Command Line Tools

The project includes several task scripts:

1. **News Scraping**:
   ```bash
   npm run scrape
   ```

2. **Company Analysis**:
   ```bash
   npm run analyze
   ```

3. **Report Generation**:
   ```bash
   npm run report
   ```

4. **MCP Server**:
   ```bash
   npm run mcp
   ```

### API Endpoints

The application provides the following API endpoints:

- `GET /api/companies` - Lists all analyzed companies
- `GET /api/companies/:companyName` - Gets specific company data
- `POST /api/analyze` - Performs company analysis
- `GET /api/news/search` - Searches news articles
- `GET /api/reports/:companyName` - Generates company reports

## Project Structure

```
.
├── data/                # Storage for scraped and analyzed data
├── public/              # Web interface files
├── src/
│   ├── lib/             # Core library components
│   │   ├── news-manager.js         # News collection and management
│   │   ├── company-analyzer.js     # Company analysis engine
│   │   └── report-generator.js     # Report generation
│   │
│   ├── mcp-server/      # MCP server implementation
│   │   └── index.js     # MCP server entry point
│   │
│   └── tasks/           # CLI task scripts
│       ├── scrape-sources.js       # News scraping task
│       ├── analyze-companies.js    # Company analysis task
│       └── generate-reports.js     # Report generation task
│
├── server.js            # Main application server
└── package.json         # Project configuration
```

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Turkish news sources for providing data
- Firecrawl for web scraping capabilities
- MCP protocol for enhanced AI capabilities
