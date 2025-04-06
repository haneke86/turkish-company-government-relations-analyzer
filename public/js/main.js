/**
 * Turkish Company Government Relations Analyzer
 * Main JavaScript File
 */

// Global variables for pagination
let currentPage = 1;
let companiesPerPage = 9;
let totalCompanies = 0;
let allCompanies = [];

// Document ready
document.addEventListener('DOMContentLoaded', function() {
    // Navigation
    document.getElementById('nav-companies').addEventListener('click', function(e) {
        e.preventDefault();
        showSection('companies');
        setActiveNav(this);
        loadCompanies();
    });
    
    document.getElementById('nav-analyze').addEventListener('click', function(e) {
        e.preventDefault();
        showSection('analyze');
        setActiveNav(this);
    });
    
    document.getElementById('nav-search').addEventListener('click', function(e) {
        e.preventDefault();
        showSection('search');
        setActiveNav(this);
    });
    
    document.getElementById('nav-about').addEventListener('click', function(e) {
        e.preventDefault();
        showSection('about');
        setActiveNav(this);
    });
    
    // Load companies on page load
    loadCompanies();
    
    // Analyze form submission
    document.getElementById('analyze-form').addEventListener('submit', function(e) {
        e.preventDefault();
        analyzeCompany();
    });
    
    // Search form submission
    document.getElementById('search-form').addEventListener('submit', function(e) {
        e.preventDefault();
        searchNews();
    });
    
    // Generate report button
    document.getElementById('generate-report').addEventListener('click', function() {
        generateReport();
    });
    
    // Company filter input
    document.getElementById('company-filter').addEventListener('input', function() {
        filterCompanies(this.value);
    });
    
    // Filter dropdown items
    document.querySelectorAll('[data-filter]').forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const filter = this.getAttribute('data-filter');
            document.getElementById('company-filter').value = filter;
            filterCompanies(filter);
        });
    });
    
    // Sort dropdown items
    document.querySelectorAll('[data-sort]').forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const sortBy = this.getAttribute('data-sort');
            sortCompanies(sortBy);
        });
    });
    
    // Load more companies button
    document.getElementById('load-more-companies').addEventListener('click', function() {
        loadMoreCompanies();
    });
});

// Show section and hide others
function showSection(sectionName) {
    document.getElementById('companies-section').style.display = sectionName === 'companies' ? 'block' : 'none';
    document.getElementById('analyze-section').style.display = sectionName === 'analyze' ? 'block' : 'none';
    document.getElementById('search-section').style.display = sectionName === 'search' ? 'block' : 'none';
    document.getElementById('about-section').style.display = sectionName === 'about' ? 'block' : 'none';
}

// Set active navigation item
function setActiveNav(navItem) {
    document.querySelectorAll('.nav-link').forEach(item => {
        item.classList.remove('active');
    });
    navItem.classList.add('active');
}

// Show loading indicator
function showLoading() {
    document.getElementById('loading').style.display = 'flex';
}

// Hide loading indicator
function hideLoading() {
    document.getElementById('loading').style.display = 'none';
}

// Show alert message
function showAlert(message, type = 'danger') {
    const alertContainer = document.getElementById('alert-container');
    const alert = document.createElement('div');
    alert.className = `alert alert-${type} alert-dismissible fade show`;
    alert.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    alertContainer.appendChild(alert);
    
    // Remove alert after 5 seconds
    setTimeout(() => {
        alert.classList.remove('show');
        setTimeout(() => alert.remove(), 300);
    }, 5000);
}

// Load companies
function loadCompanies() {
    showLoading();
    
    // Reset pagination
    currentPage = 1;
    
    fetch('/api/companies')
        .then(response => {
            if (!response.ok) {
                throw new Error('Şirket verileri alınamadı');
            }
            return response.json();
        })
        .then(data => {
            allCompanies = data;
            totalCompanies = data.length;
            
            // Display companies
            displayCompanies(data.slice(0, companiesPerPage));
            
            // Show/hide load more button
            document.getElementById('load-more-companies').style.display = 
                data.length > companiesPerPage ? 'block' : 'none';
        })
        .catch(error => {
            console.error('Error:', error);
            showAlert('Şirket verileri yüklenirken bir hata oluştu: ' + error.message);
            document.getElementById('companies-container').innerHTML = `
                <div class="col-12 text-center py-5">
                    <div class="alert alert-danger">
                        <i class="bi bi-exclamation-triangle-fill"></i> Veri yüklenemedi. Lütfen daha sonra tekrar deneyin.
                    </div>
                </div>
            `;
        })
        .finally(() => {
            hideLoading();
        });
}

// Display companies in the container
function displayCompanies(companies) {
    const container = document.getElementById('companies-container');
    
    if (currentPage === 1) {
        container.innerHTML = '';
    }
    
    if (companies.length === 0) {
        container.innerHTML = `
            <div class="col-12 text-center py-5">
                <div class="alert alert-info">
                    <i class="bi bi-info-circle-fill"></i> Hiç şirket bulunamadı.
                </div>
            </div>
        `;
        return;
    }
    
    companies.forEach(company => {
        // Determine badge class based on relation score
        let badgeClass = 'badge-low';
        if (company.relationScore >= 7) {
            badgeClass = 'badge-high';
        } else if (company.relationScore >= 4) {
            badgeClass = 'badge-medium';
        }
        
        const companyCard = document.createElement('div');
        companyCard.className = 'col-md-4';
        companyCard.innerHTML = `
            <div class="card h-100">
                <div class="card-body">
                    <h5 class="card-title">${company.name}</h5>
                    <div class="d-flex align-items-center mb-3">
                        <div class="me-2">İlişki Skoru:</div>
                        <span class="badge ${badgeClass} ms-auto">${company.relationScore}/10</span>
                    </div>
                    <p class="card-text">${company.summary.substring(0, 150)}${company.summary.length > 150 ? '...' : ''}</p>
                </div>
                <div class="card-footer d-flex justify-content-between align-items-center">
                    <small class="text-muted">Analiz: ${company.lastAnalyzed}</small>
                    <button class="btn btn-sm btn-outline-danger view-company" data-company="${company.name}">
                        Detaylar
                    </button>
                </div>
            </div>
        `;
        container.appendChild(companyCard);
        
        // Add event listener to view button
        companyCard.querySelector('.view-company').addEventListener('click', function() {
            const companyName = this.getAttribute('data-company');
            viewCompanyDetails(companyName);
        });
    });
}

// Load more companies
function loadMoreCompanies() {
    currentPage++;
    const startIndex = (currentPage - 1) * companiesPerPage;
    const endIndex = startIndex + companiesPerPage;
    
    const nextCompanies = allCompanies.slice(startIndex, endIndex);
    displayCompanies(nextCompanies);
    
    // Hide button if no more companies
    if (endIndex >= totalCompanies) {
        document.getElementById('load-more-companies').style.display = 'none';
    }
}

// Filter companies
function filterCompanies(filterText) {
    const filteredCompanies = allCompanies.filter(company => {
        if (!filterText) return true;
        
        // Handle special filters
        if (filterText === 'yüksek ilişki') {
            return company.relationScore >= 7;
        } else if (filterText === 'orta ilişki') {
            return company.relationScore >= 4 && company.relationScore < 7;
        } else if (filterText === 'düşük ilişki') {
            return company.relationScore < 4;
        }
        
        // Text-based filtering
        return company.name.toLowerCase().includes(filterText.toLowerCase()) || 
               company.summary.toLowerCase().includes(filterText.toLowerCase());
    });
    
    // Reset pagination and display filtered companies
    currentPage = 1;
    displayCompanies(filteredCompanies.slice(0, companiesPerPage));
    totalCompanies = filteredCompanies.length;
    
    // Update load more button
    document.getElementById('load-more-companies').style.display = 
        filteredCompanies.length > companiesPerPage ? 'block' : 'none';
}

// Sort companies
function sortCompanies(sortBy) {
    let sortedCompanies = [...allCompanies];
    
    switch (sortBy) {
        case 'relationScore':
            sortedCompanies.sort((a, b) => b.relationScore - a.relationScore);
            break;
        case 'name':
            sortedCompanies.sort((a, b) => a.name.localeCompare(b.name));
            break;
        case 'lastAnalyzed':
            sortedCompanies.sort((a, b) => new Date(b.lastAnalyzed) - new Date(a.lastAnalyzed));
            break;
    }
    
    // Reset pagination and display sorted companies
    currentPage = 1;
    displayCompanies(sortedCompanies.slice(0, companiesPerPage));
    allCompanies = sortedCompanies;
    
    // Update load more button
    document.getElementById('load-more-companies').style.display = 
        allCompanies.length > companiesPerPage ? 'block' : 'none';
}

// View company details
function viewCompanyDetails(companyName) {
    // Switch to analyze section
    showSection('analyze');
    setActiveNav(document.getElementById('nav-analyze'));
    
    // Set company name in form
    document.getElementById('company-name').value = companyName;
    
    // Submit form to analyze the company
    analyzeCompany();
}

// Analyze company
function analyzeCompany() {
    const companyName = document.getElementById('company-name').value.trim();
    
    if (!companyName) {
        showAlert('Lütfen bir şirket adı girin.');
        return;
    }
    
    showLoading();
    
    // Get form values
    const yearFrom = document.getElementById('year-from').value;
    const yearTo = document.getElementById('year-to').value;
    const detailLevel = document.getElementById('detail-level').value;
    const includeIndividuals = document.getElementById('include-individuals').checked;
    
    // Prepare request body
    const requestBody = {
        company: companyName,
        yearRange: {
            from: parseInt(yearFrom),
            to: parseInt(yearTo)
        },
        detailLevel: detailLevel,
        includeIndividuals: includeIndividuals
    };
    
    // Make API request
    fetch('/api/analyze', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Analiz yapılırken bir hata oluştu.');
        }
        return response.json();
    })
    .then(data => {
        displayAnalysisResult(data);
    })
    .catch(error => {
        console.error('Error:', error);
        showAlert('Analiz işlemi sırasında bir hata oluştu: ' + error.message);
    })
    .finally(() => {
        hideLoading();
    });
}

// Display analysis result
function displayAnalysisResult(result) {
    // Show result section
    document.getElementById('analysis-result').style.display = 'block';
    
    // Update summary tab
    document.getElementById('result-company-name').textContent = result.companyName;
    document.getElementById('result-score').textContent = `${result.relationScore}/10`;
    document.getElementById('result-score-bar').style.width = `${result.relationScore * 10}%`;
    document.getElementById('result-score-bar').setAttribute('aria-valuenow', result.relationScore);
    document.getElementById('result-summary').textContent = result.summary;
    document.getElementById('result-news-count').textContent = result.newsCount;
    document.getElementById('result-date').textContent = new Date(result.analyzedAt).toLocaleDateString('tr-TR');
    
    // Update events tab
    const eventsContainer = document.getElementById('result-events');
    if (result.keyEvents && result.keyEvents.length > 0) {
        eventsContainer.innerHTML = '';
        result.keyEvents.forEach(event => {
            const eventItem = document.createElement('li');
            eventItem.className = 'list-group-item';
            eventItem.innerHTML = `
                <div class="d-flex justify-content-between align-items-center">
                    <strong>${event.date}</strong>
                    <a href="${event.url}" target="_blank" class="btn btn-sm btn-outline-secondary">Kaynak: ${event.source}</a>
                </div>
                <h5 class="mt-2">${event.title}</h5>
                <p>${event.description || ''}</p>
            `;
            eventsContainer.appendChild(eventItem);
        });
    } else {
        eventsContainer.innerHTML = '<li class="list-group-item text-center">Önemli olay bulunamadı</li>';
    }
    
    // Update people tab
    const peopleContainer = document.getElementById('result-people');
    if (result.keyPeople && result.keyPeople.length > 0) {
        peopleContainer.innerHTML = '';
        result.keyPeople.forEach(person => {
            // Determine relation level badge
            let badgeClass = 'bg-secondary';
            if (person.relationLevel === 'Yüksek') {
                badgeClass = 'bg-danger';
            } else if (person.relationLevel === 'Orta') {
                badgeClass = 'bg-warning text-dark';
            }
            
            const personItem = document.createElement('li');
            personItem.className = 'list-group-item d-flex justify-content-between align-items-center';
            personItem.innerHTML = `
                <div>
                    <strong>${person.name}</strong>
                    <div>${person.role}</div>
                </div>
                <span class="badge ${badgeClass}">${person.relationLevel}</span>
            `;
            peopleContainer.appendChild(personItem);
        });
    } else {
        peopleContainer.innerHTML = '<li class="list-group-item text-center">Kilit kişi bulunamadı</li>';
    }
    
    // Update government connections tab
    const governmentContainer = document.getElementById('result-government');
    if (result.governmentConnections && result.governmentConnections.length > 0) {
        governmentContainer.innerHTML = '';
        result.governmentConnections.forEach(connection => {
            const connectionItem = document.createElement('li');
            connectionItem.className = 'list-group-item d-flex justify-content-between align-items-center';
            connectionItem.innerHTML = `
                <div>${connection.entity}</div>
                <span class="badge bg-primary rounded-pill">${connection.count} haberde geçiyor</span>
            `;
            governmentContainer.appendChild(connectionItem);
        });
    } else {
        governmentContainer.innerHTML = '<li class="list-group-item text-center">Hükümet bağlantısı bulunamadı</li>';
    }
    
    // Update AKP connections tab
    const akpContainer = document.getElementById('result-akp');
    if (result.akpConnections && result.akpConnections.length > 0) {
        akpContainer.innerHTML = '';
        result.akpConnections.forEach(connection => {
            const connectionItem = document.createElement('li');
            connectionItem.className = 'list-group-item d-flex justify-content-between align-items-center';
            connectionItem.innerHTML = `
                <div>${connection.entity}</div>
                <span class="badge bg-danger rounded-pill">${connection.count} haberde geçiyor</span>
            `;
            akpContainer.appendChild(connectionItem);
        });
    } else {
        akpContainer.innerHTML = '<li class="list-group-item text-center">AKP bağlantısı bulunamadı</li>';
    }
    
    // Scroll to result
    document.getElementById('analysis-result').scrollIntoView({ behavior: 'smooth' });
}

// Generate report
function generateReport() {
    const companyName = document.getElementById('result-company-name').textContent;
    
    if (!companyName) {
        showAlert('Önce bir şirket analizi yapmalısınız.');
        return;
    }
    
    showLoading();
    
    // Make API request
    fetch(`/api/reports/${encodeURIComponent(companyName)}?format=markdown&language=tr`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Rapor oluşturulurken bir hata oluştu.');
            }
            return response.text();
        })
        .then(data => {
            // Create a blob with the report data
            const blob = new Blob([data], { type: 'text/markdown' });
            const url = URL.createObjectURL(blob);
            
            // Create a temporary link and trigger download
            const a = document.createElement('a');
            a.href = url;
            a.download = `${companyName.replace(/\s+/g, '-').toLowerCase()}_rapor.md`;
            document.body.appendChild(a);
            a.click();
            
            // Clean up
            window.URL.revokeObjectURL(url);
            a.remove();
            
            showAlert('Rapor başarıyla oluşturuldu ve indirildi.', 'success');
        })
        .catch(error => {
            console.error('Error:', error);
            showAlert('Rapor oluşturulurken bir hata oluştu: ' + error.message);
        })
        .finally(() => {
            hideLoading();
        });
}

// Search news
function searchNews() {
    const query = document.getElementById('search-query').value.trim();
    
    if (!query) {
        showAlert('Lütfen bir arama sorgusu girin.');
        return;
    }
    
    showLoading();
    
    // Get form values
    const sourcesSelect = document.getElementById('search-sources');
    const sources = Array.from(sourcesSelect.selectedOptions).map(option => option.value).join(',');
    const dateFrom = document.getElementById('date-from').value;
    const dateTo = document.getElementById('date-to').value;
    const limit = document.getElementById('search-limit').value;
    
    // Build query string
    let queryParams = `query=${encodeURIComponent(query)}`;
    if (sources) queryParams += `&sources=${encodeURIComponent(sources)}`;
    if (dateFrom) queryParams += `&from=${encodeURIComponent(dateFrom)}`;
    if (dateTo) queryParams += `&to=${encodeURIComponent(dateTo)}`;
    if (limit) queryParams += `&limit=${encodeURIComponent(limit)}`;
    
    // Make API request
    fetch(`/api/news/search?${queryParams}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Haber araması yapılırken bir hata oluştu.');
            }
            return response.json();
        })
        .then(data => {
            displaySearchResults(data, query);
        })
        .catch(error => {
            console.error('Error:', error);
            showAlert('Haber araması sırasında bir hata oluştu: ' + error.message);
            document.getElementById('search-results').innerHTML = `
                <div class="alert alert-danger">
                    <i class="bi bi-exclamation-triangle-fill"></i> Arama yapılırken bir hata oluştu: ${error.message}
                </div>
            `;
        })
        .finally(() => {
            hideLoading();
        });
}

// Display search results
function displaySearchResults(results, query) {
    const container = document.getElementById('search-results');
    
    if (results.length === 0) {
        container.innerHTML = `
            <div class="alert alert-info">
                <i class="bi bi-info-circle-fill"></i> "${query}" için sonuç bulunamadı.
            </div>
        `;
        return;
    }
    
    container.innerHTML = `
        <h3>Arama Sonuçları: "${query}"</h3>
        <p class="text-muted">Toplam ${results.length} sonuç bulundu.</p>
        <div class="list-group" id="search-results-list"></div>
    `;
    
    const resultsList = document.getElementById('search-results-list');
    
    results.forEach(article => {
        const resultItem = document.createElement('a');
        resultItem.className = 'list-group-item list-group-item-action';
        resultItem.href = article.url;
        resultItem.target = '_blank';
        resultItem.innerHTML = `
            <div class="d-flex w-100 justify-content-between">
                <h5 class="mb-1">${article.title}</h5>
                <small>${new Date(article.date).toLocaleDateString('tr-TR')}</small>
            </div>
            <p class="mb-1">${article.summary || 'Özet bulunmuyor.'}</p>
            <small class="text-muted">Kaynak: ${article.source}</small>
        `;
        resultsList.appendChild(resultItem);
    });
}
