# Arbitrage Cron Job Setup

This document provides instructions on how to set up and run the cron jobs for the arbitrage system.

## Overview

The cron scheduler automates the following tasks:

- **Every 1 minute**: Runs the `process-matches.js` script to check for arbitrage opportunities
- **Every 20 minutes**: Runs the data fetching and match finding sequence:
  1. `fetchMostbetData.js` - Fetches updated match data from Mostbet
  2. `fetchMelbetData.js` - Fetches updated match data from Melbet
  3. `matchFinder.js` - Finds matching matches between the two platforms

When arbitrage opportunities are detected, email notifications are automatically sent using the Resend API.

## Email Notification Setup

1. Sign up for a free account at [resend.com](https://resend.com)
2. Create an API key in your Resend dashboard
3. Add the following to your `.env` file:
   ```
   RESEND_API_KEY=your_resend_api_key_here
   NOTIFICATION_EMAIL=your-email@example.com
   ```

## Setup Instructions

### Method 1: Using npm script (for development)

1. Install dependencies:

   ```
   npm install
   ```

2. Run the cron scheduler directly:

   ```
   npm run cron
   ```

3. The script will continue running until you terminate it (Ctrl+C)

### Method 2: Using PM2 (for production on Linux/macOS/Windows)

PM2 is a process manager for Node.js applications that helps keep applications alive, reload them without downtime, and manage application logs.

1. Install PM2 globally:

   ```
   npm install -g pm2
   ```

2. Install dependencies for this project:

   ```
   npm install
   ```

3. Start the cron scheduler with PM2:

   ```
   pm2 start cron-scheduler.js --name arbitrage-cron
   ```

4. To check status:

   ```
   pm2 status
   ```

5. To view logs:

   ```
   pm2 logs arbitrage-cron
   ```

6. To restart the scheduler:

   ```
   pm2 restart arbitrage-cron
   ```

7. To stop the scheduler:

   ```
   pm2 stop arbitrage-cron
   ```

8. To ensure PM2 restarts on system reboot:

   ```
   pm2 startup
   ```

   (follow the instructions provided by this command)

9. Save the current PM2 process list:
   ```
   pm2 save
   ```

### Method 3: Using Windows Task Scheduler (for Windows)

For Windows users, you can use the built-in Task Scheduler to run these scripts at specified intervals:

1. Run the included `windows-task-setup.bat` script as Administrator, which will set up all necessary tasks:

   ```
   Right-click on windows-task-setup.bat and select "Run as administrator"
   ```

   This will create the following scheduled tasks:

   - ArbitrageProcess: Runs process-matches.js every 1 minute
   - ArbitrageFetchMostbet: Runs fetchMostbetData.js every 20 minutes
   - ArbitrageFetchMelbet: Runs fetchMelbetData.js every 20 minutes
   - ArbitrageMatchFinder: Runs matchFinder.js every 20 minutes

2. To verify tasks:

   ```
   schtasks /query /tn "Arbitrage*"
   ```

3. To delete tasks:
   ```
   schtasks /delete /tn "ArbitrageProcess" /f
   schtasks /delete /tn "ArbitrageFetchMostbet" /f
   schtasks /delete /tn "ArbitrageFetchMelbet" /f
   schtasks /delete /tn "ArbitrageMatchFinder" /f
   ```

**Note**: The tasks are set to run as SYSTEM user. If you want to run them under your user account, modify the bat file to use `/ru USER /rp PASSWORD` instead of `/ru SYSTEM`.

## Modifying the Schedule

### For Method 1 and 2 (Node.js cron):

To modify the schedule, edit the cron patterns in `cron-scheduler.js`. The current patterns are:

- `* * * * *` - every 1 minute (for process-matches.js)
- `*/20 * * * *` - every 20 minutes (for data fetching scripts)

### For Method 3 (Windows Task Scheduler):

Edit the `windows-task-setup.bat` file and change the `/mo` parameter value for the desired schedule, then re-run the batch file.

### Cron Pattern Reference

- `* * * * *` - every minute
- `*/5 * * * *` - every 5 minutes
- `*/20 * * * *` - every 20 minutes
- `0 * * * *` - every hour at minute 0
- `0 */2 * * *` - every 2 hours

For more information on cron patterns, visit [crontab.guru](https://crontab.guru/).
