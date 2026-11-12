FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY ingest ./ingest
COPY tests ./tests
# שלב 1: הרצה ידנית. הריצה הלילית תתווסף בשלב 7.
CMD ["python", "-m", "ingest", "run", "--chain", "SHUFERSAL"]
