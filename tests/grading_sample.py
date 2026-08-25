# Sample grading-style test (Python), based on the course document.
# Fill in a, b, c, d with your four Railway (or local) base URLs.
#
# a = logs-service
# b = users-service
# c = costs-service
# d = about-service
#
# Usage:
#   python tests/grading_sample.py
#   (then enter an output filename when prompted)

import requests
import sys

filename = input("filename=")

# The first will handle the logs. (a)
# The second will handle all user-related tasks. (b)
# The third will handle all cost-related tasks. (c)
# The fourth will handle any admin-related tasks (e.g. developers details) (d)

a = "https://logs-service-production-9f45.up.railway.app"
b = "https://users-service-production-9a37.up.railway.app"
c = "https://costs-service-production.up.railway.app"
d = "https://about-service-production.up.railway.app"

output = open(filename, "w", encoding="utf-8")
sys.stdout = output

print("a=" + a)
print("b=" + b)
print("c=" + c)
print("d=" + d)
print()

print("testing getting the about")
print("-------------------------")
try:
    url = d + "/api/about/"
    data = requests.get(url)
    print("url=" + url)
    print("data.status_code=" + str(data.status_code))
    print(data.content)
    print("data.text=" + data.text)
    print(data.json())
except Exception as e:
    print("problem")
    print(e)
print("")

print()
print("testing getting the report - 1")
print("------------------------------")
try:
    url = c + "/api/report/?id=123123&year=2026&month=1"
    data = requests.get(url)
    print("url=" + url)
    print("data.status_code=" + str(data.status_code))
    print(data.content)
    print("data.text=" + data.text)
except Exception as e:
    print("problem")
    print(e)
print("")

print()
print("testing adding cost item")
print("----------------------------------")
try:
    url = c + "/api/add/"
    data = requests.post(
        url,
        json={"userid": 123123, "description": "milk 9", "category": "food", "sum": 8},
    )
    print("url=" + url)
    print("data.status_code=" + str(data.status_code))
    print(data.content)
except Exception as e:
    print("problem")
    print(e)
print("")

print()
print("testing getting the report - 2")
print("------------------------------")
try:
    url = c + "/api/report/?id=123123&year=2026&month=5"
    data = requests.get(url)
    print("url=" + url)
    print("data.status_code=" + str(data.status_code))
    print(data.content)
    print("data.text=" + data.text)
except Exception as e:
    print("problem")
    print(e)
print("")

output.close()
