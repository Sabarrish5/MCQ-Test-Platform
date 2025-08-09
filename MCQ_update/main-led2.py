import json
import time
import threading
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import csv

import sys
import fake_rpi
sys.modules['RPi'] = fake_rpi.RPi
sys.modules['RPi.GPIO'] = fake_rpi.RPi.GPIO

import RPi.GPIO as GPIO
import atexit

app = Flask(__name__)
CORS(app)

# Global variables
currentQuestionIndex = 0
quizComplete = False
testBegin = False
testPaused = False
lastQuestionTime = 0
currentTime = 0
questionDuration = 10 * 1000
examDuration = 0
pausedTimeRemaining = 0

questions = []
responses = {}

class Question:
    def __init__(self, questionId, question, choices, examDuration, class_, grade, subject, questionnaireId=None):
        self.questionId = questionId
        self.question = question
        self.choices = choices
        self.examDuration = examDuration
        self.class_ = class_
        self.grade = grade
        self.subject = subject
        self.questionnaireId = questionnaireId

class Response:
    def __init__(self, deviceID, answer):
        self.deviceID = deviceID
        self.answer = answer

def fetch_questions_from_terminal():
    global questions, examDuration, questionDuration
    # ... (same as before)

def print_responses_to_terminal():
    global responses, questions
    # ... (same as before)

@app.route('/')
def serve_index():
    return send_from_directory('.', 'index.html')

@app.route('/main.html')
def serve_main():
    return send_from_directory('.', 'main.html')

@app.route('/results.html')
def serve_results():
    return send_from_directory('.', 'results.html')

@app.route('/style.css')
def serve_style():
    return send_from_directory('.', 'style.css')

@app.route('/main.js')
def serve_main_js():
    return send_from_directory('.', 'main.js')

@app.route('/results.js')
def serve_results_js():
    return send_from_directory('.', 'results.js')

@app.route('/vidya-shakti.png')
def serve_logo():
    return send_from_directory('.', 'vidya-shakti.png')

@app.route('/api/currentQuestion', methods=['GET'])
def get_current_question():
    global currentQuestionIndex
    return jsonify(currentQuestionIndex)

@app.route('/api/getTime', methods=['GET'])
def get_time():
    global currentTime
    return jsonify(currentTime)

@app.route('/api/startTest', methods=['GET'])
def start_test():
    global quizComplete, testBegin, testPaused, lastQuestionTime, currentTime, currentQuestionIndex, responses
    if quizComplete:
        currentQuestionIndex = 0
        quizComplete = False
        responses.clear()
    testBegin = True
    testPaused = False
    lastQuestionTime = time.time() * 1000
    currentTime = questionDuration / 1000
    return jsonify("Test Started")

@app.route('/api/pause', methods=['GET'])
def pause_test():
    global testPaused, currentTime, pausedTimeRemaining
    testPaused = True
    pausedTimeRemaining = currentTime
    return jsonify("Test Paused")

@app.route('/api/continue', methods=['GET'])
def continue_test():
    global testPaused, lastQuestionTime, questionDuration, pausedTimeRemaining
    testPaused = False
    lastQuestionTime = (time.time() * 1000) - (questionDuration - (pausedTimeRemaining * 1000))
    return jsonify("Test Continued")

@app.route('/api/resetExam', methods=['POST'])
def reset_exam():
    global currentQuestionIndex, quizComplete, testBegin, testPaused, lastQuestionTime, currentTime, responses
    currentQuestionIndex = 0
    quizComplete = False
    testBegin = False
    testPaused = False
    lastQuestionTime = 0
    currentTime = 0
    responses.clear()
    return jsonify("Exam reset successfully")

@app.route('/api/questions', methods=['GET'])
def get_questions():
    global questions
    question_list = []
    for q in questions:
        question_list.append({
            "questionId": q.questionId,
            "question": q.question,
            "choiceA": q.choices[0],
            "choiceB": q.choices[1],
            "choiceC": q.choices[2],
            "choiceD": q.choices[3],
            "class": q.class_,
            "topic": q.grade,
            "subject": q.subject,
            "examDuration": q.examDuration,
            "questionnaireId": q.questionnaireId
        })
    return jsonify(question_list)

@app.route('/api/submitResponse', methods=['POST'])
def submit_response():
    global responses, currentQuestionIndex, questions
    data = request.json
    res = Response(data['deviceID'], data['answer'])
    if questions[currentQuestionIndex].questionId not in responses:
        responses[questions[currentQuestionIndex].questionId] = []
    responses[questions[currentQuestionIndex].questionId].append(res)
    return jsonify("Response received")

@app.route('/api/getResponsesForCurrentQuestion', methods=['GET'])
def get_responses_for_current_question():
    global responses, questions, currentQuestionIndex
    if currentQuestionIndex >= len(questions):
        return jsonify([])
    current_question_id = questions[currentQuestionIndex].questionId
    return jsonify([resp.deviceID for resp in responses.get(current_question_id, [])])

@app.route('/api/uploadQuestions', methods=['POST'])
def upload_questions():
    global questions, examDuration, questionDuration
    try:
        question_data = json.loads(request.json)
        questions = []
        for q in question_data:
            question = Question(
                q["questionId"],
                q["question"],
                [q["choiceA"], q["choiceA"], q["choiceB"], q["choiceC"], q["choiceD"]],
                q["examDuration"],
                q["class"],
                q["topic"],
                q["subject"],
                q.get("questionnaireId")
            )
            questions.append(question)

        if questions:
            examDuration = int(questions[0].examDuration)
            questionDuration = examDuration * 1000
            print("Questions received successfully.")
            return jsonify({
                "status": "success",
                "message": "Questions uploaded successfully",
                "class": questions[0].class_,
                "topic": questions[0].grade,
                "subject": questions[0].subject,
                "examDuration": examDuration
            })
        
        return jsonify({"status": "error", "message": "No questions received"}), 400
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/checkQuestions', methods=['GET'])
def check_questions():
    global questions
    if questions:
        return jsonify({
            "status": "loaded",
            "class": questions[0].class_,
            "grade": questions[0].grade,
            "subject": questions[0].subject,
            "examDuration": questions[0].examDuration
        })
    else:
        return jsonify({"status": "not_loaded"})

@app.route('/api/getJsonData', methods=['GET'])
def send_response():
    global questions
    try:
        with open("sam.json", "r") as json_file:
            response_data = json.load(json_file)
        
        unique_devices = set()
        if not questions:
            if response_data:
                question_ids_in_responses = set()
                for resp in response_data:
                    question_ids_in_responses.add(resp['questionId'])
                question_count = len(question_ids_in_responses)
            else:
                question_count = 0
        else:
            question_count = len(questions)


        received_responses = len(response_data)
        
        for response in response_data:
            unique_devices.add(response['deviceId'])
        
        num_students = len(unique_devices)
        
        if num_students == 0 or question_count == 0:
            expected_responses = 0
        else:
            expected_responses = num_students * question_count
        
        missed_responses = expected_responses - received_responses
        
        analysis = {
            "individual_performance": {},
            "group_performance": {
                "num_students_attended": num_students,
                "expected_responses": expected_responses,
                "received_responses": received_responses,
                "missed_responses": missed_responses
            }
        }
        
        for response in response_data:
            device_id = response['deviceId']
            if device_id not in analysis["individual_performance"]:
                analysis["individual_performance"][device_id] = {}
            analysis["individual_performance"][device_id][response['questionId']] = response['answer']
            
        return jsonify(analysis)

    except FileNotFoundError:
        return jsonify({"error": "No data available. Please complete a test first."}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

def update_question_timer():
    global testBegin, testPaused, lastQuestionTime, currentTime, currentQuestionIndex, quizComplete, questionDuration
    while True:
        if testBegin and not testPaused:
            currentMillis = time.time() * 1000
            currentTime = (questionDuration - (currentMillis - lastQuestionTime)) / 1000
            if currentMillis - lastQuestionTime >= questionDuration:
                if currentQuestionIndex < len(questions) - 1:
                    currentQuestionIndex += 1
                    lastQuestionTime = currentMillis
                    currentTime = questionDuration / 1000
                else:
                    currentQuestionIndex += 1
                    quizComplete = True
                    testBegin = False
                    print_responses_to_terminal()
        time.sleep(1)

if __name__ == '__main__':
    threading.Thread(target=update_question_timer, daemon=True).start()
    try:
        app.run(host='0.0.0.0', port=5000)
    except Exception as e:
        print(f"Error: {e}")
    finally:
        pass
