// Global variable to store fetched analysis data
let examAnalysisData = null;
let myChart = null; // To hold the Chart.js instance

window.onload = async () => {
    // Fetch data when the page loads
    await fetchAnalysisData();
    // Display group performance by default
    if (examAnalysisData) {
        showGroupPerformance();
    }
};

async function fetchAnalysisData() {
    try {
        const response = await fetch('/api/getJsonData');
        if (!response.ok) {
            throw new Error('Failed to fetch analysis data.');
        }
        examAnalysisData = await response.json();
    } catch (error) {
        console.error('Error fetching analysis data:', error);
        document.getElementById('analysisDisplayArea').innerHTML = `<p style="color: red;">Error: ${error.message}</p>`;
    }
}

function showGroupPerformance() {
    const displayArea = document.getElementById('analysisDisplayArea');
    if (!examAnalysisData || examAnalysisData.error) {
        displayArea.innerHTML = `<p style="color: red;">${examAnalysisData ? examAnalysisData.error : 'No analysis data available.'}</p>`;
        return;
    }

    const groupPerformance = examAnalysisData.group_performance;
    let html = '<h3>Group Performance</h3>';
    html += `<ul>`;
    html += `<li><strong>Number of Students Attended:</strong> ${groupPerformance.num_students_attended}</li>`;
    html += `<li><strong>Expected Responses:</strong> ${groupPerformance.expected_responses}</li>`;
    html += `<li><strong>Received Responses:</strong> ${groupPerformance.received_responses}</li>`;
    html += `<li><strong>Missed Responses:</strong> ${groupPerformance.missed_responses}</li>`;
    html += `</ul>`;

    // Add canvas for pie chart
    html += `<div id="groupChartContainer"><canvas id="groupPieChart"></canvas></div>`;
    displayArea.innerHTML = html;

    // Render Pie Chart
    if (myChart) {
        myChart.destroy();
    }

    const ctx = document.getElementById('groupPieChart').getContext('2d');
    myChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: ['Received Responses', 'Missed Responses'],
            datasets: [{
                data: [groupPerformance.received_responses, groupPerformance.missed_responses],
                backgroundColor: [
                    'rgba(75, 192, 192, 0.6)',
                    'rgba(255, 99, 132, 0.6)'
                ],
                borderColor: [
                    'rgba(75, 192, 192, 1)',
                    'rgba(255, 99, 132, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'top',
                },
                title: {
                    display: true,
                    text: 'Response Overview'
                }
            }
        }
    });
}

function showIndividualPerformance() {
    const displayArea = document.getElementById('analysisDisplayArea');
    if (!examAnalysisData || examAnalysisData.error) {
        displayArea.innerHTML = `<p style="color: red;">${examAnalysisData ? examAnalysisData.error : 'No analysis data available.'}</p>`;
        return;
    }

    if (myChart) {
        myChart.destroy();
        myChart = null;
    }

    const individualPerformance = examAnalysisData.individual_performance;
    let html = '<h3>Individual Performance</h3>';

    if (Object.keys(individualPerformance).length === 0) {
        html += '<p>No individual responses recorded.</p>';
    } else {
        for (const deviceId in individualPerformance) {
            if (individualPerformance.hasOwnProperty(deviceId)) {
                html += `<h4>Device ID: ${deviceId}</h4>`;
                html += '<table><thead><tr><th>Question ID</th><th>Answer</th></tr></thead><tbody>';
                const responses = individualPerformance[deviceId];
                for (const questionId in responses) {
                    if (responses.hasOwnProperty(questionId)) {
                        html += `<tr><td>${questionId}</td><td>${responses[questionId]}</td></tr>`;
                    }
                }
                html += '</tbody></table>';
            }
        }
    }
    displayArea.innerHTML = html;
}
