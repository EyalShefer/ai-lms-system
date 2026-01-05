@echo off
echo ========================================
echo  Enabling Vertex AI for ai-lms-pro
echo ========================================
echo.

echo Step 1: Setting project...
call gcloud config set project ai-lms-pro

echo.
echo Step 2: Enabling Vertex AI API...
call gcloud services enable aiplatform.googleapis.com

echo.
echo Step 3: Verifying Vertex AI is enabled...
call gcloud services list --enabled --filter="name:aiplatform.googleapis.com"

echo.
echo ========================================
echo  Vertex AI Setup Complete!
echo ========================================
echo.
echo You can now deploy the Cloud Function:
echo   cd functions
echo   firebase deploy --only functions:generateGemini3Infographic
echo.
pause
