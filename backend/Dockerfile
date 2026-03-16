FROM python:3.10-slim

# Create the user first
RUN useradd -m -u 1000 user

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy your actual backend code AND give ownership to the new user
COPY --chown=user:user . .

# Hugging Face Spaces require running on port 7860
EXPOSE 7860

# Switch to the non-root user
USER user

# Run the app with Gunicorn
CMD ["gunicorn", "-b", "0.0.0.0:7860", "app:app", "--timeout", "120", "--workers", "1", "--threads", "4"]