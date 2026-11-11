# Doctor Management System (Veterinary)

React.js frontend + Python (Flask) backend + MySQL database.
All data is stored in MySQL — nothing is hard-coded.

```
vet-management/
├── database/schema.sql      <- run this in MySQL Workbench
├── backend/                 <- Python Flask API
│   ├── .env                 <- PUT YOUR MYSQL USERNAME / PASSWORD HERE
│   ├── app.py  config.py  db.py  auth_utils.py  utils.py  pdf_utils.py
│   └── routes/ auth.py dashboard.py appointments.py patients.py prescriptions.py profile.py
└── frontend/                <- React (Vite) app
```

## 1. Create the database (MySQL Workbench)

1. Open MySQL Workbench and connect with your normal username/password.
2. `File > Open SQL Script…` → choose `database/schema.sql`.
3. Click the lightning-bolt (Execute). This creates the `vet_management` database and all tables.

## 2. Where to put your MySQL username and password

Open **`backend/.env`** and edit these lines:

```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root                          <- your Workbench username
DB_PASSWORD=PUT_YOUR_MYSQL_PASSWORD_HERE   <- your Workbench password
DB_NAME=vet_management
```

Also change `JWT_SECRET_KEY` to any long random string.
The values are read by `backend/config.py` and used in `backend/db.py`.

## 3. Run the backend (Python 3.10+)

```bash
cd backend
python -m venv venv
venv\Scripts\activate            # Windows      (Mac/Linux: source venv/bin/activate)
pip install -r requirements.txt
python app.py                    # runs on http://localhost:5000
```

Check it works: open http://localhost:5000/api/health → `{"status":"ok"}`.

## 4. Run the frontend (Node 18+)

```bash
cd frontend
npm install
npm run dev                      # opens http://localhost:5173
```

Vite forwards `/api` and `/uploads` to the Flask server, so no extra setup is needed.

## 5. First use

1. Open http://localhost:5173 → **Register** a doctor account, then **Login**.
2. Add a patient → add an appointment → create a prescription → download the PDF.

### Forgot password
Without e-mail settings, the reset link is **printed in the backend terminal**
(look for `[forgot-password] Reset link…`). To send real e-mails, fill in the
`SMTP_*` lines in `backend/.env` (for Gmail use an App Password).

## API overview (all under `/api`, JWT required except auth)

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/register`, `/auth/login`, `/auth/logout`, `/auth/forgot-password`, `/auth/reset-password`; `GET /auth/me` |
| Dashboard | `GET /dashboard/stats`, `/analytics?period=weekly\|monthly`, `/patient-stats`, `/recent-activities`, `/reports?period=`, `/today`, `/recent-appointments`, `/recent-patients` |
| Appointments | `GET/POST /appointments`, `GET/PUT/DELETE /appointments/<id>`, `PATCH /appointments/<id>/status`, `POST /appointments/<id>/cancel`, `GET /appointments/calendar?month=YYYY-MM` (filters: `search status visit_type date from to patient_id`) |
| Patients | `GET/POST /patients`, `GET/PUT/DELETE /patients/<id>`, `GET /patients/search?q=`, `POST /patients/<id>/image`, `GET/POST /patients/<id>/medical-history`, `GET/POST /patients/<id>/vaccinations`, `GET /patients/<id>/visits` |
| Prescriptions | `GET/POST /prescriptions`, `GET/PUT/DELETE /prescriptions/<id>`, `GET /prescriptions/history/<patient_id>`, `GET /prescriptions/medicines`, `GET /prescriptions/<id>/pdf`, `GET /prescriptions/<id>/download` |
| Profile | `GET/PUT /profile`, `POST /profile/image`, `POST /profile/change-password`, `GET /profile/account` |

## Security notes
- Passwords are stored as salted hashes (never plain text).
- JWT tokens are validated on every request; logout blacklists the token in MySQL.
- All SQL uses parameter placeholders (no string-built queries from user input).
- Each doctor only sees their own patients, appointments and prescriptions.
- Before going live: set a strong `JWT_SECRET_KEY`, run Flask behind a production server
  (e.g. gunicorn/waitress) and serve the built frontend (`npm run build`) over HTTPS.
