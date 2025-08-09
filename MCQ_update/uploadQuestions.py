import requests
import json

url = "http://localhost:5000/api/uploadQuestions"
file_path = "questions.json"

try:
    with open(file_path, "r") as f:
        questions_data = json.load(f)

    response = requests.post(url, json=json.dumps(questions_data))
    print(response.json())

except Exception as e:
    print(f"An error occurred: {e}")