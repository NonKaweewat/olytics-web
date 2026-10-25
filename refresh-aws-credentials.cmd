@echo off
setlocal
title Refresh AWS Learner Lab credentials
echo.
echo Refresh AWS Academy Learner Lab credentials for profile: olytics
echo Open AWS Academy ^> AWS Details ^> Show, then paste the current values below.
echo.
set /p AWS_ACCESS_KEY_ID=AWS Access Key ID:
set /p AWS_SECRET_ACCESS_KEY=AWS Secret Access Key:
set /p AWS_SESSION_TOKEN=AWS Session Token:

aws configure set aws_access_key_id "%AWS_ACCESS_KEY_ID%" --profile olytics
aws configure set aws_secret_access_key "%AWS_SECRET_ACCESS_KEY%" --profile olytics
aws configure set aws_session_token "%AWS_SESSION_TOKEN%" --profile olytics
aws configure set region us-east-1 --profile olytics
aws configure set output json --profile olytics

echo.
echo Checking credentials...
aws sts get-caller-identity --profile olytics
if errorlevel 1 (
  echo.
  echo FAILED: Check that every value came from the current Learner Lab session.
) else (
  echo.
  echo SUCCESS: Profile olytics is ready.
)

set AWS_ACCESS_KEY_ID=
set AWS_SECRET_ACCESS_KEY=
set AWS_SESSION_TOKEN=
endlocal
echo.
pause
