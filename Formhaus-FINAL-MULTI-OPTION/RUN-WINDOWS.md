# Run Formhaus on Windows

Open two PowerShell windows in the extracted project folder.

## 1. Start the PyTorch backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 8000
```

Check: `http://127.0.0.1:8000/health`

## 2. Start the Formhaus frontend

```powershell
npm install
npm run dev
```

Open the URL printed by Vite, normally `http://localhost:4173`.

Generate a plan once. The backend will sample a candidate pool and return **three ranked alternatives**. Select them from the 2D thumbnails; the same selected layout is used in the 3D viewer. The 3D viewer also includes Option 1 / Option 2 / Option 3 controls.
