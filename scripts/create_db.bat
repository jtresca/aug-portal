@echo off
SET DB_NAME=anime_universe_db
SET DB_USER=postgres
:: This points one level up to find the schema file
SET SCHEMA_PATH=..\schema.sql

echo ⛩️  Initializing Anime Universe Games Database from Scripts...

:: 1. Create the Database
psql -U %DB_USER% -c "CREATE DATABASE %DB_NAME%;"

:: 2. Run the Schema file
if exist %SCHEMA_PATH% (
    psql -U %DB_USER% -d %DB_NAME% -f %SCHEMA_PATH%
) else (
    echo ❌ Error: schema.sql not found at %SCHEMA_PATH%
)

echo ✅ Database Setup Complete!
pause