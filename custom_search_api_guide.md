# 📄 Google Custom Search API with Node.js (Quick Setup Guide)

## 🔧 Prerequisites

- Active **Google Cloud Project**
- Billing enabled
- Node.js environment

---

## ✅ Step 1: Enable API in GCP

1. Go to: [Custom Search API in GCP](https://console.cloud.google.com/apis/library/customsearch.googleapis.com)
2. Click **Enable**
3. Go to **APIs & Services > Credentials**
4. Click **Create Credentials > API Key**
5. (Optional) Restrict your API key for security

---

## 🔍 Step 2: Create a Programmable Search Engine (CSE)

1. Go to: [Programmable Search Control Panel](https://programmablesearchengine.google.com/controlpanel)
2. Click **Add** > enter a dummy site (e.g., `example.com`)
3. After creating:
   - Go to **Setup > Basics**
   - Set to **“Search the entire web but emphasize included sites”**
   - Remove all listed sites
4. Enable image search if needed
5. Copy the **Search Engine ID (cx)**

---

## 🔑 You Should Now Have:

- `GOOGLE_API_KEY` (from GCP)
- `GOOGLE_CSE_ID` (from CSE setup)

---

## 💻 Step 3: Node.js Setup

```bash
npm install axios dotenv
```

`.env`:
```
GOOGLE_API_KEY=your_api_key_here
GOOGLE_CSE_ID=your_cse_id_here
```

```js
// index.js
require('dotenv').config();
const axios = require('axios');

const search = async (query) => {
  const res = await axios.get('https://www.googleapis.com/customsearch/v1', {
    params: {
      key: process.env.GOOGLE_API_KEY,
      cx: process.env.GOOGLE_CSE_ID,
      q: query,
      num: 5
    }
  });
  res.data.items.forEach(item => {
    console.log(`${item.title}: ${item.link}`);
  });
};

search('Node.js tutorial');
```

---

## 📈 Quotas & Pricing

- **100 free queries/day**
- **$5 per 1000 queries** after that
- Max 10,000 queries/day
- Max 10 results per query, 100 total per search

---

## 🔐 Authentication

- API Key (no OAuth needed)
- Keep it secure (server-side only)

---

## 📚 Docs

- [API Reference](https://developers.google.com/custom-search/v1/reference/rest)
- [Quota Info](https://developers.google.com/custom-search/v1/overview)
