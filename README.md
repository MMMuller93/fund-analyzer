# Fund Manager Analytics Dashboard

## Project Overview
Interactive web dashboard for analyzing SEC-registered fund managers (advisers) and their individual funds. Visualizes Assets Under Management (AUM) trends, growth rates, and rankings from 2011-2024 using SEC Form ADV filing data.

**Live Demo:** (Will be added after Railway deployment)

---

## Tech Stack

### Frontend
- **React 18** - UI framework
- **Recharts** - Data visualization (step-style area charts)
- **Tailwind CSS** - Styling (core utilities only, no compilation)
- **Lucide React** - Icons

### Backend/Data
- **Supabase** - PostgreSQL database (hosted)
- **Express.js** - Simple static file server
- **Railway** - Deployment platform

### Data Source
- **Advisers Table** (36,926 rows): Fund manager data with AUM history
- **Funds Table** (71,290 rows): Individual fund data with GAV history

---

## Supabase Configuration

### Database Credentials
- **Project URL:** `https://iihbiatfjufnluwcgarz.supabase.co`
- **Anon Key:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpaGJpYXRmanVmbmx1d2NnYXJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2MzQzMTMsImV4cCI6MjA3NTIxMDMxM30.tuYYgpLrXHReXbu2E1GYmxVnmrX3Wqgz8a5LkutI4mM`

### Tables Structure

**Advisers Table:**
- `CRD` (INTEGER) - Primary key, unique adviser identifier
- `Adviser_Name` (TEXT) - Primary display name
- `Adviser_Entity_Legal_Name` (TEXT) - Legal entity name
- `Adviser_Entity_Legal_Name_Reported_Change` (TEXT) - Previous/alternate name
- `Type` (TEXT) - RIA, ERA, etc.
- `Total_AUM` (NUMERIC) - Latest total Assets Under Management
- `AUM_2011` through `AUM_2024` (NUMERIC) - Historical AUM by year
- Additional fields: websites, Form ADV URLs, etc.

**Funds Table:**
- `Fund_ID` (TEXT) - Unique fund identifier
- `Fund_Name` (TEXT) - Fund display name
- `Adviser_Entity_CRD` (INTEGER) - Foreign key to Advisers.CRD
- `Adviser_Entity_Legal_Name` (TEXT) - Managing adviser name
- `Latest_Gross_Asset_Value` (NUMERIC) - Most recent GAV
- `GAV_2011` through `GAV_2024` (NUMERIC) - Historical GAV by year

### Important Settings
- **RLS (Row Level Security):** DISABLED on both tables for public read access
- **Data API:** ENABLED
- **Exposed Schemas:** `public`, `graphql_public`

---

## Key Features

### 1. Header Leaderboards (Always Visible)
Three live-updating cards:
- **Largest AUM:** Top 5 by current AUM with rank and rank change
- **Highest % Growth (2y):** Top 5 by 2022-2024 growth rate
- **Largest Rank ↗ (2y):** Top 5 biggest rank improvements

### 2. Advisers Tab
- Search by adviser name (searches across all name variations)
- Click result → detailed view with:
  - Key metrics: Current AUM, 2Y growth, Type, CRD
  - Interactive chart with time filters (6M, 1Y, 2Y, 5Y, All)
  - Step-style area chart (green gradient)
  - Link to view all managed funds

### 3. Funds Tab
- Default: Table of all funds with GAV and growth (1Y, 2Y, 5Y)
- Search by fund name or adviser name
- Click row → detailed fund visualization
- Filtered view when coming from adviser detail page

### 4. Rankings Tab
- Top 100 advisers by AUM
- Sortable columns: Rank, Name, AUM, Growth, Rank Change
- Click row → jump to adviser detail view

---

## Critical Data Logic

### AUM Calculation for Advisers Without Direct Reporting
If `Advisers.Total_AUM` is NULL:
1. Sum all `Latest_Gross_Asset_Value` from linked funds (matched by CRD)
2. Use sum as `Total_AUM`
3. Calculate historical AUM by summing yearly `GAV_YYYY` across all funds
4. Ensures advisers who only report through funds appear correctly

### Growth Rate Calculations
- **Advisers 2Y Growth:** `((AUM_2024 - AUM_2022) / AUM_2022) * 100`
- **Funds:**
  - 1Y: `((GAV_2024 - GAV_2023) / GAV_2023) * 100`
  - 2Y: `((GAV_2024 - GAV_2022) / GAV_2022) * 100`
  - 5Y: `((GAV_2024 - GAV_2019) / GAV_2019) * 100`

### Rank Change Calculation
1. Sort advisers by `AUM_2024` → assign `rank_2024` (1-N)
2. Sort advisers by `AUM_2022` → assign `rank_2022` (1-N)
3. Calculate: `rank_change_2y = rank_2022 - rank_2024`
   - Positive = moved up in rankings
   - Negative = moved down

### Search Linking
Search queries check:
- **Advisers:** `Adviser_Name`, `Adviser_Entity_Legal_Name`, `Adviser_Entity_Legal_Name_Reported_Change`
- **Funds:** `Fund_Name`, `Adviser_Entity_Legal_Name`
- All searches case-insensitive with partial matching

### Fund-to-Adviser Linking
Funds linked to advisers via: `Funds.Adviser_Entity_CRD = Advisers.CRD`

---

## Local Development

### Prerequisites
- Node.js 16+ installed
- Git installed

### Setup
```bash
cd /Users/Miles/Desktop/fund-analyzer
npm install
npm start
```

Visit: `http://localhost:3000`

---

## Railway Deployment

### Option 1: GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/yourusername/fund-analyzer.git
git push -u origin main
```

Then in Railway:
1. New Project → Deploy from GitHub
2. Select your repo
3. Auto-deploys on push

### Option 2: Railway CLI
```bash
npm install -g @railway/cli
railway login
railway init
railway up
```

### Post-Deployment
- Railway provides URL: `https://your-app.railway.app`
- No environment variables needed (Supabase credentials in frontend)
- CORS works because browser makes requests directly to Supabase

---

## Project History & Context

### Problem We Solved
**Initial Approach:** Tried using Claude artifacts with uploaded CSV files
- **Issue:** Files became inaccessible after refresh
- **Issue:** Published artifacts couldn't access uploaded files
- **Issue:** CORS blocked direct Supabase API calls from artifacts

**Final Solution:** Deploy to Railway
- Static Express server hosts React app
- Browser makes Supabase API calls directly (no CORS)
- Works reliably, survives refreshes
- Can be shared via public URL

### Design Inspiration
User provided screenshots from a fintech dashboard showing:
- Clean card-based leaderboards
- Rank numbers on same line as company names
- Current rank + rank change indicators
- Step-style charts with gradient fills
- Compact, scannable data presentation

### Key Learnings
1. **Artifacts have CORS limitations** - can't fetch external APIs
2. **Supabase REST API works great** - but needs proper deployment
3. **Railway is ideal for this** - simple static hosting with zero config
4. **Column name capitalization matters** - Postgres is case-sensitive
5. **RLS must be disabled** for public read access via anon key
6. **Data API must be enabled** in Supabase settings
7. **Browser-side fetching avoids CORS** when deployed properly

---

## File Structure
```
fund-analyzer/
├── package.json          # Node dependencies
├── server.js             # Express static file server
├── .gitignore           # Git ignore rules
├── README.md            # This file
└── public/
    ├── index.html       # HTML shell
    └── app.js          # React app (needs to be created)
```

---

## Next Steps for New Claude Instance

If you need to continue this project:

1. **Check app.js exists:** `ls -la /Users/Miles/Desktop/fund-analyzer/public/app.js`
2. **If missing:** The React code is in the Claude artifact "fund-analyzer" - copy it to `public/app.js`
3. **Verify Supabase credentials** in app.js (lines 15-16)
4. **Test locally:** `npm install && npm start`
5. **Deploy to Railway** following instructions above

### Known Issues to Watch
- Search uses Supabase `ilike` operator with `%25` encoding for wildcards
- Initial data load fetches ALL advisers and funds (may be slow on first load)
- Chart time filters only work for advisers, not funds
- Max rows from Supabase API is 1000 by default (increased in settings)

### Potential Enhancements
- Add server-side caching for faster loads
- Implement pagination for large datasets
- Add export to CSV/PDF functionality
- Create admin panel for data updates
- Add authentication for private access
- Implement advanced filtering (by Type, AUM range, etc.)
- Add comparison mode (multiple advisers side-by-side)

---

## Troubleshooting

### Data Not Loading
1. Check browser console (F12) for errors
2. Verify Supabase API is enabled in project settings
3. Confirm RLS is disabled on both tables
4. Test direct API call: `curl https://iihbiatfjufnluwcgarz.supabase.co/rest/v1/Advisers?limit=1 -H "apikey: YOUR_KEY"`

### Search Not Working
1. Ensure exposed schemas include `public`
2. Check column names match exactly (case-sensitive)
3. Verify `%25` encoding in search URL

### Deployment Issues
1. Verify `package.json` has correct start script
2. Check Railway logs: `railway logs`
3. Ensure PORT environment variable is used correctly

---

## Contact & Support
- **User Location:** Miami, Florida, US
- **Data Source:** SEC Form ADV filings (fund manager regulatory data)
- **Original Google Sheets:**
  - Advisers: https://docs.google.com/spreadsheets/d/1YQ8G8aFjRUcjSb0Zz8o-ab36QzeUsSMwLzBg55blNc8
  - Funds: https://docs.google.com/spreadsheets/d/14qnuR08FVioyAJS4PemO-aaXEv2MwbOg-1dskWAkr94

---

**Last Updated:** January 2025
**Project Status:** Ready for Railway deployment (app.js needs to be added)
