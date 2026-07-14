# NIFTY Option Chain Analysis

A React + Vite dashboard for visualizing live NIFTY option chain data in a simple table view. The app collects values during the market session, shows the latest open interest metrics, and lets you export the collected data as CSV or Excel.

## Features

- Live option chain dashboard
- Real-time session tracking
- Market open/close behavior based on weekdays and market hours
- Next market open display
- CSV and Excel export for collected data
- Vercel-ready frontend deployment
- AI-powered features are planned for future implementation and are not part of the current app yet

## Tech Stack

- React
- Vite
- Tailwind CSS
- XLSX for Excel export

## Project Structure

- `src/` – frontend React components and UI
- `public/` – static assets
- `vite.config.js` – Vite configuration and API proxy setup

## Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Open the local app in your browser.

## Environment Variable

If your frontend uses a deployed backend, set this environment variable:

```bash
VITE_API_BASE_URL=https://fastapi-deployment-ashy.vercel.app
```

## Deployment on Vercel

1. Connect your GitHub repository to Vercel.
2. Set the project root to the frontend folder containing this app.
3. Add the environment variable above if needed.
4. Deploy the project.

## Notes

This repository currently contains the frontend only. The FastAPI backend is deployed separately on Vercel in another repository and is connected to this frontend using the environment variable above.
