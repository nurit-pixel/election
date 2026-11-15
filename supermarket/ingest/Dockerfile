FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY ingest ./ingest
COPY tests ./tests
# תהליך רקע: בקשות מהאפליקציה, geocoding והריצה הלילית. בעדיפות נמוכה (nice), כדי שטעינת מחירים
# כבדה לא תאט את האפליקציה עצמה
CMD ["nice", "-n", "15", "python", "-m", "ingest", "worker"]
