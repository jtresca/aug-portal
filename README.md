# First Moon Games - Instant Play Portal

The official instant-play portal for First Moon Games. This platform handles game distribution, integrated SDK communication, and player analytics.

## Features
- **Instant Play WebGL Support**: Optimized for loading high-performance games (like Boat Attack) directly in the browser.
- **Integrated SDK Bridge**: Handles IAP, Rewarded Ads, and Identity management within the local game context.
- **Dynamic Asset Injection**: Auto-generated mock data for development combined with real database support for production games.
- **Analytics Tracking**: Server-side session tracking and play statistics.

## Prerequisites
Before you begin, ensure you have the following installed:
- **Node.js** (v18.0.0 or higher)
- **npm** (comes with Node.js)
- **PostgreSQL** (v14 or higher)

## Local Setup

### 1. Clone the Repository
```bash
git clone https://github.com/jtresca/aug-portal.git
cd aug-portal
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration
Create a `.env` file in the root directory and populate it with the following keys:

```env
# Database Configuration
DB_USER=your_pg_user
DB_HOST=localhost
DB_NAME=aug_portal
DB_PASSWORD=your_pg_password
DB_PORT=5432

# Session & Auth
SESSION_SECRET=your_secret_key_here
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Optional: Third Party Integrations
BREVO_API_KEY=your_brevo_key
```

### 4. Database Setup
Initialize the database schema using the provided SQL file or helper scripts:

```bash
# Using the helper script
node apply_schema.js

# OR manually via psql
psql -d aug_portal -f schema.sql
```

## Running the Application

### Development Mode
Start the local server:
```bash
node server.js
```
The portal will be available at **[http://localhost:3000](http://localhost:3000)**.

## Project Structure
- `/public`: Frontend assets (HTML, CSS, JS).
- `/games_local`: Locally hosted WebGL game builds (e.g., Boat Attack).
- `/unity-sdk`: Integration libraries for Game Engines.
- `server.js`: Main Express application and API routing.
- `schema.sql`: PostgreSQL database definitions.

## Key Assets
- **Boat Attack**: High-resolution tiles and compressed previews are located in `/games_local/Boat-Attack/`.
- **Branding**: Logo and SVG assets are in `/public/images/`.

## License
© 2026 First Moon Games. All rights reserved.
