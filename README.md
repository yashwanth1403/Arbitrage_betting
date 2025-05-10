# Arbitrage Betting System

A system that automatically identifies arbitrage betting opportunities by comparing odds between Melbet and Mostbet.

## Features

- Automated data fetching from Mostbet and Melbet every 20 minutes
- Match analysis for arbitrage opportunities every minute
- Email notifications when profitable opportunities are found
- RESTful API for manual control

## Setup

1. Install dependencies:

   ```
   npm install
   ```

2. Create a `.env` file in the root directory with the following content:

   ```
   # API Keys
   RESEND_API_KEY=your_resend_api_key_here

   # Notification settings
   NOTIFICATION_EMAIL=your-email@example.com

   # Server settings
   PORT=3000
   NODE_ENV=development
   ```

3. Get a Resend API key:

   - Sign up at [resend.com](https://resend.com)
   - Create an API key in your dashboard
   - Copy the key to your `.env` file

4. Start the application:
   ```
   npm start
   ```

## Cron Jobs

The system automatically runs the following tasks:

- Every 1 minute: Process existing matches for arbitrage opportunities
- Every 20 minutes: Fetch new data from betting sites and identify potential matches

## API Endpoints

- `GET /api/status`: Get current system status
- `POST /api/process-matches`: Manually trigger match processing
- `POST /api/fetch-mostbet`: Manually fetch Mostbet data
- `POST /api/fetch-melbet`: Manually fetch Melbet data
- `POST /api/match-finder`: Manually run match finder
- `POST /api/run-all`: Run the complete sequence manually
- `GET /health`: Health check endpoint

## Email Notifications

When arbitrage opportunities are found, an email will be sent to the address specified in your `.env` file with details about the opportunity.

## Deployment Instructions

### Deploying to Railway

1. Sign up for a Railway account at https://railway.app
2. Link your GitHub account to Railway
3. Create a new project in Railway and select this repository
4. Let Railway automatically deploy the project

You can also deploy using the Railway CLI:

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login to Railway
railway login

# Initialize a new project
railway init

# Deploy your project
railway up
```

## Local Development

Run the app locally:

```bash
# Install dependencies
npm install

# Start the server
npm start

# Start with auto-reload (development)
npm run dev
```

## Scheduling Jobs with External Tools

Since the application now uses an API approach instead of internal cron jobs, you can schedule jobs using external tools:

### Using cURL with cron (Linux/macOS):

```bash
# Schedule fetching data every 30 minutes
*/30 * * * * curl -X POST https://your-app-url.com/api/fetch-mostbet
*/30 * * * * curl -X POST https://your-app-url.com/api/fetch-melbet
*/30 * * * * curl -X POST https://your-app-url.com/api/match-finder

# Schedule processing every 5 minutes
*/5 * * * * curl -X POST https://your-app-url.com/api/process-matches
```

### Using Windows Task Scheduler:

Create a batch file with the following commands:

```batch
curl -X POST https://your-app-url.com/api/run-all
```

Then schedule it using Task Scheduler.

## Features

- RESTful API for all operations
- Detailed status tracking and logging
- Ability to run processes individually or in sequence
- Prevents concurrent execution of the same task
- Production-ready with health check endpoint

## License

ISC
