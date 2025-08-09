let timeLeft = 0;
let currentQuestionIndex = 0;
let timerInterval;
let questionInterval;
let firstLoad = true;
let isPaused = false;
let isExamCompleted = false;
let questionsCache = null;

async function fetchStartTest() {
    try {
        const response = await fetch('/api/startTest');
        const data = await response.text();
        console.log(data);
    } catch (error) {
        console.log("Error Start test", error);
        return "Error";
    }
}

async function fetchTime() {
    try {
        const response = await fetch('/api/getTime');
        const data = await response.text();
        console.log("Get Time :", data);
        document.getElementById('timer').innerText = `Time Left: ${parseInt(data)} sec`;
    } catch (error) {
        console.log("Error fetching Time", error);
        return currentTime;
    }
}

async function fetchCurrentQuestion() {
    try {
        const response = await fetch('/api/currentQuestion');
        const data = await response.text();
        console.log("current question Index : ", data);
        return parseInt(data);
    } catch (error) {
        console.error("Error fetching current question:", error);
        return currentQuestionIndex;
    }
}

async function fetchQuestions() {
    try {
        const response = await fetch('/api/questions');
        const data = await response.json();
        console.log("Fetched questions:", data);
        return data;
    } catch (error) {
        console.error("Error fetching questions:", error);
        return null;
    }
}

async function loadQuestion() {
    try {
        const questionIndex = await fetchCurrentQuestion();

        if (!questionsCache || questionIndex !== currentQuestionIndex) {
            questionsCache = await fetchQuestions();
        }

        if (!questionsCache || !Array.isArray(questionsCache)) {
            console.error("Invalid question data:", questionsCache);
            return;
        }

        if (questionIndex >= questionsCache.length) {
            // Exam is completed
            isExamCompleted = true;
            document.getElementById('question').innerText = "Congratulations on Completing the Exam!";
            document.getElementById('options').innerHTML = "<h3>Thank you for your hard work and participation. You did an amazing job! Keep smiling and best of luck for your future endeavors!</h3>";
            document.getElementById('timer').style.display = "none";
            document.getElementById('pauseButton').style.display = "none";
            document.getElementById('resumeButton').style.display = "none";
            document.getElementById('restartButton').style.display = "block";
            document.getElementById('cancelButton').style.display = "block";
            document.getElementById('viewResultsButton').style.display = "block";
            document.getElementById('userBubblesContainer').style.display = 'none'; // Hide bubbles on completion

            clearInterval(questionInterval);
            clearInterval(timerInterval);
            return;
        }

        // Update question on first load or if the question index has changed
        if (firstLoad || questionIndex !== currentQuestionIndex) {
            firstLoad = false;
            currentQuestionIndex = questionIndex;

            const question = questionsCache[currentQuestionIndex];
            const choices = [question.choiceA, question.choiceB, question.choiceC, question.choiceD, question.choiceE]
                .filter(choice => choice && choice !== "null");

            document.getElementById('question').innerText = `Question ${currentQuestionIndex + 1}: ${question.question}`;
            const optionsContainer = document.getElementById('options');
            optionsContainer.innerHTML = '';

            const optionLabels = ['A)', 'B)', 'C)', 'D)', 'E)'];
            choices.forEach((choice, index) => {
                const button = document.createElement('button');
                button.innerText = `${optionLabels[index]}: ${choice}`;
                button.classList.add('option-btn');
                button.onclick = () => selectAnswer(index + 1);
                optionsContainer.appendChild(button);
            });
            
            // Clear existing bubbles and fetch new ones
            document.getElementById('userBubblesContainer').innerHTML = '';
            fetchAndDisplayResponses();
        }
    } catch (error) {
        console.error("Error loading question:", error);
    }
}

// Add this new function to fetch and display the user bubbles
async function fetchAndDisplayResponses() {
    try {
        const response = await fetch('/api/getResponsesForCurrentQuestion');
        if (response.ok) {
            const deviceIDs = await response.json();
            const container = document.getElementById('userBubblesContainer');
            container.innerHTML = ''; // Clear old bubbles
            if (deviceIDs.length > 0) {
                deviceIDs.forEach(id => {
                    const bubble = document.createElement('div');
                    bubble.classList.add('user-bubble');
                    // Truncate the device ID for a cleaner look
                    bubble.textContent = id.substring(6, 10);
                    container.appendChild(bubble);
                });
            }
        }
    } catch (error) {
        console.error("Error fetching current responses:", error);
    }
}
function selectAnswer(answer) {
    const deviceID = getDeviceID();
    const data = {
        deviceID: deviceID,
        answer: answer
    };

    fetch('/api/submitResponse', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    })
    .then(response => response.text())
    .then(data => {
        console.log('Response submitted:', data);
        fetchAndDisplayResponses(); // Call the new function to update the bubbles
    })
    .catch((error) => {
        console.error('Error submitting response:', error);
    });
}

function pauseTest() {
    isPaused = true;
    document.getElementById('pauseButton').style.display = "none";
    document.getElementById('resumeButton').style.display = "block";
    fetch('/api/pause');
}

function resumeTest() {
    isPaused = false;
    document.getElementById('pauseButton').style.display = "block";
    document.getElementById('resumeButton').style.display = "none";
    fetch('/api/continue');
}

function startExam() {
    isExamCompleted = false;
    questionsCache = null;
    sessionStorage.setItem("examStarted", "true");
    window.location.href = "main.html";
    fetchStartTest();
}

function restartExam() {
    isExamCompleted = false;
    questionsCache = null;
    sessionStorage.setItem("examStarted", "true");
    window.location.href = "main.html";
    fetchStartTest();
}

function cancelExam() {
    isExamCompleted = true;
    questionsCache = null;
    sessionStorage.removeItem("examStarted");
    clearInterval(questionInterval);
    clearInterval(timerInterval);
    fetch('/api/resetExam', { method: 'POST' })
        .then(response => response.text())
        .then(data => {
            console.log(data);
            window.location.href = "/";
        })
        .catch(error => {
            console.error('Error resetting exam:', error);
        });
}

function viewResults() {
    window.location.href = "results.html";
}

window.onload = () => {
    if (sessionStorage.getItem("examStarted") === "true") {
        if (!isExamCompleted) {
            loadQuestion();
            timerInterval = setInterval(fetchTime, 1000);
            questionInterval = setInterval(loadQuestion, 2000);
        }
    }
};
