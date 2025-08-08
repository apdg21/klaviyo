let rawDataCache = null;

// Helper function to parse percentage strings (e.g., "61.57%" → 0.6157)
function parsePercentage(value) {
    if (typeof value === 'string' && value.endsWith('%')) {
        return parseFloat(value.replace('%', '')) / 100 || 0;
    }
    return parseFloat(value) || 0;
}

// Helper function to parse Send Time (e.g., "2/26/2025 9:00" → Date object)
function parseSendTime(value) {
    if (!value) return null;
    try {
        const [datePart, timePart] = value.split(' ');
        const [month, day, year] = datePart.split('/');
        const date = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')} ${timePart}`);
        if (isNaN(date.getTime())) throw new Error('Invalid date');
        return date;
    } catch (e) {
        console.error('Error parsing Send Time:', value, e);
        return null;
    }
}

document.getElementById('csvUpload').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    const loadingIndicator = document.getElementById('loadingIndicator');
    loadingIndicator.style.display = 'block';
    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
            console.log('Papa Parse Complete:', results); // Debug log
            if (results.errors.length > 0) {
                console.error('CSV Parsing Errors:', results.errors);
                alert('Error parsing CSV: ' + results.errors[0].message);
                loadingIndicator.style.display = 'none';
                return;
            }
            rawDataCache = results.data;
            console.log('Raw Data Cache:', rawDataCache); // Debug log
            if (!rawDataCache || rawDataCache.length === 0) {
                alert('No valid data found in the CSV.');
                loadingIndicator.style.display = 'none';
                return;
            }
            loadingIndicator.style.display = 'none';
            // Process data immediately if no date filters are set
            const startDate = document.getElementById('startDate').value;
            const endDate = document.getElementById('endDate').value;
            if (!startDate && !endDate) {
                processData(rawDataCache);
            } else {
                filterAndProcessData();
            }
        },
        error: function(error) {
            console.error('Papa Parse Error:', error);
            alert('Error parsing CSV: ' + error.message);
            loadingIndicator.style.display = 'none';
        }
    });
});

document.getElementById('filterButton').addEventListener('click', filterAndProcessData);

function filterAndProcessData() {
    if (!rawDataCache) {
        alert('Please upload a Klaviyo CSV file first.');
        return;
    }
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const loadingIndicator = document.getElementById('loadingIndicator');
    loadingIndicator.style.display = 'block';

    const filteredData = rawDataCache.filter(row => {
        const sendDate = parseSendTime(row['Send Time']);
        console.log('Send Date Parsed:', sendDate, 'for row:', row); // Debug log
        const matchesStart = !startDate || (sendDate && sendDate >= new Date(startDate));
        const matchesEnd = !endDate || (sendDate && sendDate <= new Date(endDate));
        return sendDate && matchesStart && matchesEnd;
    });

    loadingIndicator.style.display = 'none';
    if (filteredData.length === 0) {
        alert('No data matches the selected date range.');
        return;
    }

    processData(filteredData);
}

function processData(rawData) {
    const dailyData = {}, weeklyData = {}, monthlyData = {}, trendData = {}, growthData = {}, seasonalData = {};
    console.log('Processing Data with', rawData.length, 'rows'); // Debug log

    rawData.forEach((row, index) => {
        console.log('Processing row', index, ':', row); // Debug log
        const sendDate = parseSendTime(row['Send Time']);
        if (!sendDate) {
            console.warn('Invalid Send Time in row', index, ':', row['Send Time']);
            return;
        }
        const dateString = sendDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        const weekStart = getWeekStartDate(sendDate);
        const weekString = `${weekStart.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} - ${new Date(weekStart.setDate(weekStart.getDate() + 6)).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
        const monthString = sendDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        const yearMonth = `${sendDate.getFullYear()}-${(sendDate.getMonth() + 1).toString().padStart(2, '0')}`;
        const month = sendDate.toLocaleDateString('en-US', { month: 'long' });
        const campaignName = row['Campaign Name'] || 'Unknown';
        const revenue = parseFloat(row['Revenue']) || 0;
        const openRate = parsePercentage(row['Open Rate']);
        const clickRate = parsePercentage(row['Click Rate']);
        const conversionRate = parsePercentage(row['Placed Order Rate']);
        const recipients = parseFloat(row['Total Recipients']) || 0;
        const opens = parseFloat(row['Unique Opens']) || 0;
        const clicks = parseFloat(row['Unique Clicks']) || 0;
        const sendDays = row['Send Weekday'] || 'Unknown';
        const listSegment = row['List'] || 'Unknown';

        if (isNaN(openRate) || isNaN(clickRate) || isNaN(conversionRate)) {
            console.warn('Invalid rate values in row', index, ':', { openRate, clickRate, conversionRate });
            return;
        }

        if (!dailyData[dateString]) {
            dailyData[dateString] = { openRateSum: 0, clickRateSum: 0, conversionRateSum: 0, revenueSum: 0, count: 0, sendTime: sendDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }), campaigns: {} };
        }
        dailyData[dateString].openRateSum += openRate;
        dailyData[dateString].clickRateSum += clickRate;
        dailyData[dateString].conversionRateSum += conversionRate;
        dailyData[dateString].revenueSum += revenue;
        dailyData[dateString].count++;
        if (!dailyData[dateString].campaigns[campaignName]) {
            dailyData[dateString].campaigns[campaignName] = { subject: row['Subject'] || 'Unknown', count: 0, openRateSum: 0, clickRateSum: 0, conversionRateSum: 0, revenueSum: 0, sendDays, listSegment };
        }
        dailyData[dateString].campaigns[campaignName].count++;
        dailyData[dateString].campaigns[campaignName].openRateSum += openRate;
        dailyData[dateString].campaigns[campaignName].clickRateSum += clickRate;
        dailyData[dateString].campaigns[campaignName].conversionRateSum += conversionRate;
        dailyData[dateString].campaigns[campaignName].revenueSum += revenue;

        if (!weeklyData[weekString]) {
            weeklyData[weekString] = { openRateSum: 0, clickRateSum: 0, conversionRateSum: 0, revenueSum: 0, count: 0 };
        }
        weeklyData[weekString].openRateSum += openRate;
        weeklyData[weekString].clickRateSum += clickRate;
        weeklyData[weekString].conversionRateSum += conversionRate;
        weeklyData[weekString].revenueSum += revenue;
        weeklyData[weekString].count++;

        if (!monthlyData[monthString]) {
            monthlyData[monthString] = { openRateSum: 0, clickRateSum: 0, conversionRateSum: 0, revenueSum: 0, count: 0 };
        }
        monthlyData[monthString].openRateSum += openRate;
        monthlyData[monthString].clickRateSum += clickRate;
        monthlyData[monthString].conversionRateSum += conversionRate;
        monthlyData[monthString].revenueSum += revenue;
        monthlyData[monthString].count++;

        if (!trendData[yearMonth]) {
            trendData[yearMonth] = { revenueSum: 0, recipientsSum: 0, opensSum: 0, clicksSum: 0, count: 0 };
        }
        trendData[yearMonth].revenueSum += revenue;
        trendData[yearMonth].recipientsSum += recipients;
        trendData[yearMonth].opensSum += opens;
        trendData[yearMonth].clicksSum += clicks;
        trendData[yearMonth].count++;

        if (!growthData[campaignName]) {
            growthData[campaignName] = { revenueSum: 0, recipientsSum: 0, count: 0 };
        }
        growthData[campaignName].revenueSum += revenue;
        growthData[campaignName].recipientsSum += recipients;
        growthData[campaignName].count++;

        if (!seasonalData[sendDays]) {
            seasonalData[sendDays] = { revenueSum: 0, count: 0 };
        }
        seasonalData[sendDays].revenueSum += revenue;
        seasonalData[sendDays].count++;
        if (!seasonalData[month]) {
            seasonalData[month] = { revenueSum: 0, count: 0 };
        }
        seasonalData[month].revenueSum += revenue;
        seasonalData[month].count++;
    });

    // Log data structures to debug empty Growth and Seasonal data
    console.log('Processed Daily Data:', dailyData);
    console.log('Processed Growth Data:', growthData);
    console.log('Processed Seasonal Data:', seasonalData);

    const dailyOutput = [['Date Sent', 'Campaign Name', 'Subject', 'Open Rate', 'Click Rate', 'Conversion Rate', 'Send Time', 'Send Days', 'List / Segment', 'Revenue']];
    for (const date in dailyData) {
        for (const campaignName in dailyData[date].campaigns) {
            const campaign = dailyData[date].campaigns[campaignName];
            dailyOutput.push([
                date,
                campaignName,
                campaign.subject,
                ((campaign.openRateSum / campaign.count) * 100).toFixed(2) + '%',
                ((campaign.clickRateSum / campaign.count) * 100).toFixed(2) + '%',
                ((campaign.conversionRateSum / campaign.count) * 100).toFixed(2) + '%',
                dailyData[date].sendTime,
                campaign.sendDays,
                campaign.listSegment,
                campaign.revenueSum.toFixed(2)
            ]);
        }
    }

    const weeklyOutput = [['Week', 'Open Rate', 'Click Rate', 'Conversion Rate', 'Total Revenue']];
    for (const week in weeklyData) {
        weeklyOutput.push([
            week,
            ((weeklyData[week].openRateSum / weeklyData[week].count) * 100).toFixed(2) + '%',
            ((weeklyData[week].clickRateSum / weeklyData[week].count) * 100).toFixed(2) + '%',
            ((weeklyData[week].conversionRateSum / weeklyData[week].count) * 100).toFixed(2) + '%',
            weeklyData[week].revenueSum.toFixed(2)
        ]);
    }

    const monthlyOutput = [['Month', 'Open Rate', 'Click Rate', 'Conversion Rate', 'Total Revenue']];
    for (const month in monthlyData) {
        monthlyOutput.push([
            month,
            ((monthlyData[month].openRateSum / monthlyData[month].count) * 100).toFixed(2) + '%',
            ((monthlyData[month].clickRateSum / monthlyData[month].count) * 100).toFixed(2) + '%',
            ((monthlyData[month].conversionRateSum / monthlyData[month].count) * 100).toFixed(2) + '%',
            monthlyData[month].revenueSum.toFixed(2)
        ]);
    }

    const trendOutput = [['Month', 'Total Revenue', 'Average Recipients', 'Average Opens', 'Average Clicks']];
    const sortedMonths = Object.keys(trendData).sort();
    for (const month of sortedMonths) {
        const count = trendData[month].count;
        trendOutput.push([
            month,
            trendData[month].revenueSum.toFixed(2),
            (count > 0 ? trendData[month].recipientsSum / count : 0).toFixed(0),
            (count > 0 ? trendData[month].opensSum / count : 0).toFixed(0),
            (count > 0 ? trendData[month].clicksSum / count : 0).toFixed(0)
        ]);
    }

    const growthOutput = [['Campaign Name', 'Total Revenue', 'Average Recipients']];
    if (Object.keys(growthData).length === 0) {
        growthOutput.push(['No Data', '0.00', '0']);
    } else {
        for (const campaign in growthData) {
            const count = growthData[campaign].count;
            growthOutput.push([
                campaign,
                growthData[campaign].revenueSum.toFixed(2),
                (count > 0 ? growthData[campaign].recipientsSum / count : 0).toFixed(0)
            ]);
        }
    }

    const seasonalOutput = [['Period', 'Average Revenue']];
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    let hasSeasonalData = false;
    days.forEach(day => {
        const data = seasonalData[day];
        const avgRevenue = data ? (data.revenueSum / data.count).toFixed(2) : '-';
        if (data && data.count > 0) hasSeasonalData = true;
        seasonalOutput.push([day, avgRevenue]);
    });
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    months.forEach(month => {
        const data = seasonalData[month];
        const avgRevenue = data ? (data.revenueSum / data.count).toFixed(2) : '-';
        if (data && data.count > 0) hasSeasonalData = true;
        seasonalOutput.push([month, avgRevenue]);
    });
    if (!hasSeasonalData) {
        seasonalOutput.push(['No Data', '0.00']);
    }

    try {
        renderTables({ daily: dailyOutput, weekly: weeklyOutput, monthly: monthlyOutput, trend: trendOutput, growth: growthOutput, seasonal: seasonalOutput });
    } catch (e) {
        console.error('Error rendering tables:', e);
        alert('Error displaying data: ' + e.message);
    }
}

function getWeekStartDate(date) {
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(date.setDate(diff));
}

function renderTables(data) {
    const tables = {
        dailyTable: { data: data.daily, chartId: null },
        weeklyTable: { data: data.weekly, chartId: null },
        monthlyTable: { data: data.monthly, chartId: null },
        trendTable: { data: data.trend, chartId: 'trendChart' },
        growthTable: { data: data.growth, chartId: 'growthChart' },
        seasonalTable: { data: data.seasonal, chartId: 'seasonalChart' }
    };

    for (const [tableId, { data: tableData, chartId }] of Object.entries(tables)) {
        const container = document.getElementById(tableId);
        if (!container) {
            console.error('Container not found:', tableId);
            continue;
        }
        container.innerHTML = createTableHtml(tableData);

        if ($.fn.DataTable.isDataTable(`#${tableId} table`)) {
            $(`#${tableId} table`).DataTable().destroy();
        }
        $(`#${tableId} table`).DataTable({
            paging: true,
            searching: true,
            ordering: true,
            order: [],
            lengthMenu: [10, 25, 50, 100],
            scrollX: true // Enable horizontal scrolling for wide tables
        });

        if (chartId) {
            const chartData = {
                labels: tableData.slice(1).map(row => row[0]),
                datasets: []
            };
            if (tableId === 'trendTable') {
                chartData.datasets.push({
                    label: 'Total Revenue',
                    data: tableData.slice(1).map(row => parseFloat(row[1])),
                    borderColor: '#3a86ff',
                    backgroundColor: 'rgba(58, 134, 255, 0.2)',
                    fill: true
                });
                new Chart(document.getElementById(chartId), {
                    type: 'line',
                    data: chartData,
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                            y: { beginAtZero: true, title: { display: true, text: 'Revenue' } },
                            x: { title: { display: true, text: 'Month' } }
                        }
                    }
                });
            } else if (tableId === 'growthTable') {
                chartData.datasets.push({
                    label: 'Total Revenue',
                    data: tableData.slice(1).map(row => parseFloat(row[1])),
                    backgroundColor: '#3a86ff'
                });
                new Chart(document.getElementById(chartId), {
                    type: 'bar',
                    data: chartData,
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                            y: { beginAtZero: true, title: { display: true, text: 'Revenue' } },
                            x: { title: { display: true, text: 'Campaign' } }
                        }
                    }
                });
            } else if (tableId === 'seasonalTable') {
                chartData.labels = tableData.slice(8, 20).map(row => row[0]);
                chartData.datasets.push({
                    label: 'Average Revenue',
                    data: tableData.slice(8, 20).map(row => parseFloat(row[1]) || 0),
                    backgroundColor: '#3a86ff'
                });
                new Chart(document.getElementById(chartId), {
                    type: 'bar',
                    data: chartData,
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                            y: { beginAtZero: true, title: { display: true, text: 'Revenue' } },
                            x: { title: { display: true, text: 'Month' } }
                        }
                    }
                });
            }
        }
    }
}

function createTableHtml(data) {
    if (!data || data.length === 0) return '<p>No data available.</p>';
    let html = '<div class="table-responsive"><table class="table table-bordered table-striped">';
    html += '<thead><tr>';
    data[0].forEach(header => html += `<th>${header}</th>`);
    html += '</tr></thead><tbody>';
    for (let i = 1; i < data.length; i++) {
        html += '<tr>';
        data[i].forEach(cell => html += `<td>${cell}</td>`);
        html += '</tr>';
    }
    html += '</tbody></table></div>';
    return html;
}