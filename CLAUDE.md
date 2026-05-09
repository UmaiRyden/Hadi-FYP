# Hadi FYP — AI-Based Encrypted Mobile Traffic Classifier

## Project Overview

This is a Final Year Project (FYP) that classifies encrypted mobile network traffic from Facebook, WhatsApp, YouTube, and Instagram using AI — **without decrypting any packets**. It analyzes packet-level metadata (size, timing, flow behavior) to identify which application generated the traffic.

**Core Principle:** Encrypted traffic can be classified by behavior patterns alone. No decryption is needed and user privacy is preserved.

---

## Component Status

| Component | Status | Location |
|---|---|---|
| ML Model (traffic classifier) | **Complete** | `backend/models/traffic_classifier_final.pkl` |
| ML Model (VPN detector) | **Complete** | `backend/models/vpn_classifier.pkl` |
| FastAPI Backend | **Complete** | `backend/` |
| Next.js Frontend | **Complete** | `app/` (root of this repo) |
| Flutter Mobile App | **In Progress** — structure done, no UI yet | `D:\uvPackage\traffic_classifier_app\` |

---

## Architecture

### Next.js Frontend (Complete)
- **Framework:** Next.js 15 (App Router) + React 19 + TypeScript
- **Styling:** Tailwind CSS 4 + shadcn/ui (Radix UI)
- **3D Background:** Three.js / react-three/fiber with custom GLSL shaders
- **Forms:** React Hook Form + Zod
- **Charts:** Recharts
- **Theme:** Dark, gold accent (#FFC700), custom "Sentient" font
- **API calls:** `lib/api.ts` using `fetch()`

### FastAPI Backend (Complete)
- **Framework:** FastAPI (Python)
- **PCAP Parsing:** scapy
- **Feature Extraction:** pandas + numpy
- **ML Model:** scikit-learn RandomForestClassifier
- **VPN Detection:** scikit-learn binary classifier (vpn_classifier.pkl)
- **Auth:** JWT (python-jose)
- **Database:** SQLAlchemy (SQLite for dev, PostgreSQL for prod)
- **Port:** 8000 (frontend on 3000)

### Flutter Mobile App (In Progress)
- **Location:** `D:\uvPackage\traffic_classifier_app\`
- **Framework:** Flutter 3.41.6 (Dart)
- **HTTP:** dio ^5.8.0+1
- **Charts:** fl_chart ^0.70.2
- **File picker:** file_picker ^8.1.7
- **Base URL:** `http://192.168.1.110:8000` (set in `lib/config.dart`)
- **Status:** Structure + models + API service complete, screens are empty stubs, `flutter analyze` passes with 0 issues

---

## Full System Pipeline

```
User
 │
 ▼
[1] Upload PCAP File → POST /api/classify  (or POST /api/upload for async)
 │
 ▼
[2] pcap_parser.py
    rdpcap() → group packets into bidirectional flows
    Per packet: size, timestamp, direction (fwd/bwd),
                payload_size, header_size, tcp_window
    Metadata added: flow_key = str(flow_key), source_ip = flow_key[0]
 │
 ▼
[3] feature_extractor.py
    extract_features() per flow → 18-feature vector (microseconds for IAT/Duration)
    extract_all_features() → list of feature dicts
    Returns None if flow has no forward packets
 │
 ▼
[4] classifier.py
    classify_flows_detailed():
      - Loads traffic_classifier_final.pkl (18 features, 4 classes)
      - Loads vpn_classifier.pkl (6 features, binary)
      - VPN features: Flow.Duration, Bwd.IAT.Mean, Bwd.IAT.Std, Bwd.IAT.Max, Flow.Packets.s, Flow.Bytes.s
      - Falls back to all vpn_detected=False if vpn_classifier.pkl missing
      - Returns per-flow predictions + majority-vote top-level vpn_detected
    classify_by_device():
      - Groups flows by source_ip
      - Calls classify_flows_detailed per device group
      - Returns sorted by flow_count desc
 │
 ▼
[5] JSON Response
    predicted_app, confidence, flow_count, packet_count,
    processing_time, vpn_detected (bool),
    predictions[], flows[], devices[]
```

---

## ML Model — Traffic Classifier

- **Model file:** `backend/models/traffic_classifier_final.pkl`
- **Algorithm:** RandomForestClassifier (scikit-learn)
  - `n_estimators=200`, `max_depth=15`, `random_state=42`, `class_weight='balanced'`
- **Classes (4):** FACEBOOK, INSTAGRAM, WHATSAPP, YOUTUBE
- **Train/test split:** 80/20 stratified

### Training Dataset (`filtered_dataset_train.csv`)
- **Source:** Unicauca-Version2-87Atts dataset (CICFlowMeter features)
- **Total rows:** 66,041
- **Class distribution:**

| Class | Rows | Note |
|---|---|---|
| YOUTUBE | 30,000 | Capped from 170,781 via random_state=42 sampling |
| FACEBOOK | 29,033 | Full |
| WHATSAPP | 4,593 | Full |
| INSTAGRAM | 2,415 | Full |

- **Class imbalance handling:** `class_weight='balanced'` in RandomForest
- **Zero-variance columns dropped (11):** Protocol, Bwd.PSH.Flags, Fwd.URG.Flags, Bwd.URG.Flags, CWE.Flag.Count, Fwd.Avg.Bytes.Bulk, Fwd.Avg.Packets.Bulk, Fwd.Avg.Bulk.Rate, Bwd.Avg.Bytes.Bulk, Bwd.Avg.Packets.Bulk, Bwd.Avg.Bulk.Rate

### 18 Features (in exact model order)

| # | Feature | Description |
|---|---|---|
| 1 | `Bwd.IAT.Total` | Sum of backward inter-arrival times (µs) |
| 2 | `Avg.Fwd.Segment.Size` | Mean TCP payload size of forward packets |
| 3 | `Fwd.Packet.Length.Mean` | Mean total length of forward packets |
| 4 | `Init_Win_bytes_forward` | TCP window size of first forward packet |
| 5 | `Destination.Port` | Destination port of the flow |
| 6 | `Fwd.Header.Length` | Total IP+TCP header bytes (forward direction) |
| 7 | `Bwd.IAT.Max` | Max backward inter-arrival time (µs) |
| 8 | `Bwd.IAT.Std` | Std deviation of backward inter-arrival times (µs) |
| 9 | `Total.Length.of.Fwd.Packets` | Sum of forward payload bytes |
| 10 | `Subflow.Fwd.Bytes` | Forward bytes in subflow (= Total.Length.of.Fwd.Packets) |
| 11 | `Source.Port` | Source port of the flow |
| 12 | `Bwd.IAT.Mean` | Mean backward inter-arrival time (µs) |
| 13 | `Fwd.Packet.Length.Max` | Max total length of forward packets |
| 14 | `Fwd.IAT.Total` | Sum of forward inter-arrival times (µs) |
| 15 | `Flow.Duration` | Time from first to last packet (µs) |
| 16 | `Flow.Bytes.s` | Total bytes / flow duration in seconds |
| 17 | `Flow.Packets.s` | Total packets / flow duration in seconds |
| 18 | `Down.Up.Ratio` | Backward packets / forward packets |

### Final Metrics (92.65% overall accuracy)

| Class | Precision | Recall | F1 |
|---|---|---|---|
| FACEBOOK | 96.19% | 95.20% | **95.69%** |
| YOUTUBE | 92.96% | 93.80% | **93.38%** |
| INSTAGRAM | 86.68% | 71.43% | **78.32%** |
| WHATSAPP | 72.97% | 80.20% | **76.41%** |

**Confusion Matrix:**

| Actual \ Predicted | FACEBOOK | INSTAGRAM | WHATSAPP | YOUTUBE |
|---|---|---|---|---|
| FACEBOOK | 5528 | 40 | 47 | 192 |
| INSTAGRAM | 36 | 345 | 24 | 78 |
| WHATSAPP | 18 | 8 | 737 | 156 |
| YOUTUBE | 165 | 5 | 202 | 5628 |

---

## ML Model — VPN Detector

- **Model file:** `backend/models/vpn_classifier.pkl`
- **Algorithm:** scikit-learn binary classifier
- **Accuracy:** 85.27%, ROC-AUC: 93.07%
- **Features (6, subset of the 18 above):**
  `Flow.Duration`, `Bwd.IAT.Mean`, `Bwd.IAT.Std`, `Bwd.IAT.Max`, `Flow.Packets.s`, `Flow.Bytes.s`
- **Training data:** ARFF file (VPN vs non-VPN traffic dataset)
- **Graceful fallback:** If pkl is missing at startup, all flows return `vpn_detected=false`

---

## API Endpoints

| Method | Endpoint | Type | Description |
|---|---|---|---|
| POST | `/api/classify` | Synchronous | Upload PCAP → full result in one response |
| POST | `/api/upload` | Async | Upload PCAP → returns job_id |
| GET | `/api/result/{job_id}` | Async poll | Poll job status + retrieve result |
| GET | `/api/performance` | — | Model accuracy, precision, recall, F1, confusion matrix |
| POST | `/api/auth/signup` | — | Register new user |
| POST | `/api/auth/login` | — | Login, returns JWT token |

### `POST /api/classify` — Full Response Shape
```json
{
  "predicted_app": "WHATSAPP",
  "confidence": 76.4,
  "flow_count": 12,
  "packet_count": 340,
  "processing_time": 1.02,
  "vpn_detected": false,
  "predictions": [
    { "app": "WHATSAPP",   "confidence": 76.4 },
    { "app": "FACEBOOK",   "confidence": 12.1 },
    { "app": "YOUTUBE",    "confidence": 8.3  },
    { "app": "INSTAGRAM",  "confidence": 3.2  }
  ],
  "flows": [
    {
      "flow_key": "('192.168.1.1', 443, '10.0.0.1', 52341, 'TCP')",
      "predicted_app": "WHATSAPP",
      "confidence": 93.1,
      "vpn_detected": false,
      "features": { "Bwd.IAT.Total": 402290.0, "Flow.Duration": 11558260.0 }
    }
  ],
  "devices": [
    {
      "source_ip": "192.168.1.5",
      "flow_count": 8,
      "predicted_app": "WHATSAPP",
      "confidence": 81.2,
      "predictions": [
        { "app": "WHATSAPP", "confidence": 81.2 },
        { "app": "FACEBOOK", "confidence": 10.5 }
      ]
    }
  ]
}
```

### `POST /api/upload` → `GET /api/result/{job_id}` — Async Shape
```json
{ "job_id": 42 }

{
  "job_id": 42,
  "status": "extracting",
  "progress": 40,
  "original_filename": "capture.pcap",
  "predicted_app": null,
  "confidence": null,
  "flow_count": null,
  "packet_count": null,
  "processing_time": null,
  "predictions": null,
  "error_message": null
}
```
Status values: `pending` → `parsing` → `extracting` → `classifying` → `completed` | `failed`

---

## Backend Structure

```
backend/
├── main.py                           # FastAPI app, CORS, router registration
├── train_model.py                    # Retrain — reads filtered_dataset_train.csv
├── requirements.txt
├── routers/
│   ├── upload.py                     # POST /api/classify (sync) + POST /api/upload (async)
│   ├── analysis.py                   # GET /api/result/{job_id}
│   ├── auth.py                       # POST /api/auth/login, /signup
│   └── performance.py                # GET /api/performance
├── services/
│   ├── pcap_parser.py                # parse_pcap() — scapy, bidirectional flows
│   ├── feature_extractor.py          # extract_features(), extract_all_features()
│   └── classifier.py                 # classify_flows_detailed(), classify_by_device()
├── models/
│   ├── db_models.py                  # SQLAlchemy ORM: User, AnalysisJob, AnalysisResult
│   ├── traffic_classifier_final.pkl  # 18-feature, 4-class traffic classifier
│   ├── vpn_classifier.pkl            # 6-feature binary VPN detector
│   └── model_metrics.json            # Accuracy, F1, confusion matrix snapshot
├── schemas/
│   └── schemas.py                    # Pydantic: ClassifyResponse, FlowResult, DeviceResult, etc.
└── database.py                       # SQLite connection + session
```

---

## Next.js Frontend Pages (All Built)

| Route | Purpose |
|---|---|
| `/` | Landing page — hero, how it works, metrics |
| `/dashboard` | Upload PCAP — "Run Analysis" (sync) or "Live Analysis" (async) buttons |
| `/processing` | Animated 4-stage progress (parse→group→extract→classify), then redirects to /result |
| `/result` | Confidence BarChart, per-device table (expandable), per-flow table (max 20, show-all toggle), VPN badge |
| `/live` | Real-time polling (500ms) + animated bar chart growth (150ms), stage dots, result card on completion |
| `/performance` | Model accuracy, precision, recall, F1, confusion matrix |
| `/login` | User login |
| `/signup` | User registration |

### Key Frontend Files

- **`lib/api.ts`** — `classifyPcap(file)`, `uploadPcap(file)`, `getResult(jobId)` — full TypeScript interfaces for all response shapes including `vpn_detected`, `devices[]`
- **`lib/classify-store.ts`** — Module-level singleton holding in-flight `Promise<ClassifyResponse>` and filename. Used to pass the live request across Next.js client-side navigation without a global state library. Methods: `startClassify(file)`, `getClassifyPromise()`, `getClassifyFilename()`, `clearClassify()`
- **`app/dashboard/page.tsx`** — `handleRunAnalysis()` calls `startClassify()` → navigates to `/processing`; `handleLiveAnalysis()` awaits `uploadPcap()` → navigates to `/live`
- **`app/processing/page.tsx`** — Reads promise from classify-store; 4 timed stages at 1.4s intervals; on completion writes `classify_result` + `classify_filename` to localStorage
- **`app/result/page.tsx`** — Reads `classify_result` from localStorage; app colors: FACEBOOK #1877F2, YOUTUBE #FF0000, WHATSAPP #25D366, INSTAGRAM #E1306C
- **`app/live/page.tsx`** — Two intervals: poll (500ms via `getResult(jobId)`), grow (150ms incrementing bars); `isAnimationActive={false}` during growth, `{true}` + `animationDuration={900}` for final reveal

---

## Flutter Mobile App Structure

**Location:** `D:\uvPackage\traffic_classifier_app\`

```
lib/
├── config.dart                   AppConfig — baseUrl http://192.168.1.110:8000, timeouts
├── main.dart                     TrafficClassifierApp — named routes: /, /live, /result, /performance
├── models/
│   ├── models.dart               Barrel export
│   ├── prediction.dart           Prediction(app, confidence)
│   ├── flow_result.dart          FlowResult(flowKey, predictedApp, confidence, vpnDetected, features)
│   ├── device_result.dart        DeviceResult(sourceIp, flowCount, predictedApp, confidence, predictions)
│   ├── classify_response.dart    ClassifyResponse — full sync endpoint response
│   ├── analysis_result.dart      AnalysisResult + JobStatus enum (pending/parsing/extracting/classifying/completed/failed)
│   └── performance_metrics.dart  PerformanceMetrics + ConfusionMatrix
├── services/
│   └── api_service.dart          ApiService — classifyPcap / uploadPcap / getResult / getPerformance
│                                 ApiException — extracts FastAPI "detail" field from DioException
└── screens/
    ├── home_screen.dart          Stub — empty
    ├── live_screen.dart          Stub — empty
    ├── result_screen.dart        Stub — empty
    └── performance_screen.dart   Stub — empty
```

**Dependencies (pubspec.yaml):**
```yaml
dio: ^5.8.0+1
fl_chart: ^0.70.2
file_picker: ^8.1.7
cupertino_icons: ^1.0.8
```

**Build status:** `flutter analyze` → 0 issues. APK build blocked by Android SDK disk space / SDK download issue (code is correct, environment problem only).

**Next steps for Flutter:** Build UI for each screen — HomeScreen (file picker + upload), LiveScreen (polling + animated chart), ResultScreen (results + device table + VPN badge), PerformanceScreen (metrics + confusion matrix).

---

## Key Project Constraints

- **Privacy-preserving:** Never read packet payload — only metadata (sizes, timestamps, ports, TCP flags)
- **No live capture required:** Upload PCAP only
- **Academic context:** FYP — results must be measurable, repeatable, scientifically valid
- **Supervisor expects:** Confusion matrix, dataset size info, all 4 evaluation metrics

---

## Development Notes

- CORS enabled on FastAPI for `localhost:3000`
- `next.config.mjs` ignores TypeScript build errors — keep this
- To retrain from scratch: `cd backend && python train_model.py`
- IAT and Flow.Duration values in `feature_extractor.py` are in **microseconds** (matches CICFlowMeter convention used in training data)
- `Down.Up.Ratio` and `Flow.Bytes.s` are the key features separating WhatsApp (bidirectional, low throughput) from YouTube (download-dominant, high throughput)
- VPN detector uses only 6 features that overlap between our 18-feature pipeline and the training ARFF dataset
- `classify-store.ts` solves passing an in-flight fetch across Next.js client-side navigation without a global state library
