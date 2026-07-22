FROM python:3.11-slim

WORKDIR /app

# System deps for PyMuPDF, Pillow, pytesseract
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 libglib2.0-0 tesseract-ocr \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
# --default-timeout/--retries: the torch CPU wheel is ~180MB and pip's default
# read timeout (15s) can trip on slow/flaky connections mid-download.
RUN pip install --no-cache-dir --default-timeout=180 --retries 10 -r requirements.txt

COPY . .

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
