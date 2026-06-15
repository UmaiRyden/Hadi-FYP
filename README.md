# AI-Based Encrypted Mobile Traffic Classification System

Classifies encrypted mobile network traffic from **Facebook, WhatsApp, YouTube, and Instagram** using machine learning — **without decrypting any packets**. The system analyzes packet-level metadata (sizes, timing, flow behavior) to identify which application generated the traffic, preserving user privacy.

- **Frontend:** Next.js 15 (App Router) + React 19 + TypeScript + Tailwind CSS 4
- **Backend:** FastAPI (Python) + scikit-learn RandomForest + scapy
- **Models:** 18-feature, 4-class traffic classifier (92.65% accuracy) + 6-feature VPN detector

---

## Repository Structure

```
Hadi-FYP/
├── app/                 # Next.js pages (App Router): dashboard, live, result, performance, ...
├── components/          # React UI components (shadcn/ui + custom)
├── lib/                 # API client (lib/api.ts), helpers
├── hooks/               # React hooks
├── public/              # Static assets
├── styles/              # Global CSS
├── backend/             # FastAPI application
│   ├── main.py          # App entry, CORS, routers
│   ├── routers/         # API endpoints (upload, analysis, auth, performance, capture)
│   ├── services/        # pcap_parser, feature_extractor, classifier
│   ├── models/          # Trained .pkl models + metrics JSON
│   ├── requirements.txt # Python dependencies
│   ├── Procfile / nixpacks.toml / runtime.txt  # Deployment config
│   └── train_model.py   # Retrain the classifier (requires the training CSV — see Retraining)
├── package.json         # Frontend dependencies & scripts
└── next.config.mjs      # Next.js configuration
```

---

## Prerequisites

- **Node.js** 18.18+ (or 20+) and **npm**
- **Python** 3.11 (matches `backend/runtime.txt`)
- **Git**

---

## Getting Started

Clone the repository:

```bash
git clone https://github.com/UmaiRyden/Hadi-FYP.git
cd Hadi-FYP
```

The project has two parts — the **backend** (FastAPI) and the **frontend** (Next.js). Run the backend first, then the frontend.

### 1. Backend (FastAPI)

```bash
cd backend

# Create and activate a virtual environment
python -m venv venv
# Windows (PowerShell):
venv\Scripts\Activate.ps1
# macOS / Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run the API (serves on http://localhost:8000)
uvicorn main:app --reload --port 8000
```

The API is now available at **http://localhost:8000**. Interactive API docs: **http://localhost:8000/docs**.

The trained models (`models/traffic_classifier_final.pkl`, `models/vpn_classifier.pkl`) ship with the repo, so no training is required to run the app.

### 2. Frontend (Next.js)

In a **second terminal**, from the repository root:

```bash
# Install dependencies
npm install

# Tell the frontend where the backend is (see "Configuration" below)
# For local development, point it at your local backend:
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local

# Run the dev server (serves on http://localhost:3000)
npm run dev
```

Open **http://localhost:3000** in your browser.

---

## Configuration

The frontend chooses its backend URL from the `NEXT_PUBLIC_API_URL` environment variable:

| Environment | `NEXT_PUBLIC_API_URL` |
|---|---|
| Local development | `http://localhost:8000` |
| Production (default if unset) | `https://hadi-fyp-production.up.railway.app` |

Set it in a `.env.local` file at the repository root for local runs. If unset, the app falls back to the deployed Railway backend.

> Note: the backend has CORS enabled for `http://localhost:3000`. If you serve the frontend from a different origin, update the CORS settings in `backend/main.py`.

---

## Available Scripts (Frontend)

| Command | Description |
|---|---|
| `npm run dev` | Start the development server (hot reload) on port 3000 |
| `npm run build` | Create an optimized production build |
| `npm run start` | Serve the production build |
| `npm run lint` | Run Next.js linting |

---

## Using the App

1. Go to the **Dashboard** and upload a `.pcap` / `.pcapng` capture file.
2. Click **Run Analysis** for live, streamed classification (`/live`), or use the standard flow to reach the **Result** page.
3. The **Result** page shows the predicted app, per-class confidence distribution, per-device and per-flow breakdowns, and VPN detection.
4. The **Performance** page shows model accuracy, precision/recall/F1, and the confusion matrix.

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/classify` | Upload a PCAP → full classification result (synchronous) |
| POST | `/api/upload` | Upload a PCAP → returns `job_id` (asynchronous) |
| GET | `/api/result/{job_id}` | Poll async job status and retrieve result |
| GET | `/api/performance` | Model metrics (accuracy, F1, confusion matrix) |
| POST | `/api/auth/signup` | Register a new user |
| POST | `/api/auth/login` | Log in, returns a JWT |

---

## Retraining the Model (optional)

The repo ships with pre-trained models, so retraining is **not** required to run the system. To retrain:

```bash
cd backend
python train_model.py
```

`train_model.py` expects the training dataset `filtered_dataset_train.csv` in the repository root. This dataset is **not** included in the repository due to its size — request it from the project owner if you need to retrain.

---

## Deployment

- **Backend** is configured for [Railway](https://railway.app) / Nixpacks via `backend/Procfile`, `backend/nixpacks.toml`, and `backend/runtime.txt`.
- **Frontend** is configured for [Vercel](https://vercel.com); set `NEXT_PUBLIC_API_URL` to your deployed backend URL in the Vercel project's environment variables.

---

## License

Academic Final Year Project — provided for the client's use.
