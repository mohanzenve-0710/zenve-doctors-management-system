import os


from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.exceptions import HTTPException

from config import Config
from routes.appointments import appointments_bp
from routes.auth import auth_bp
from routes.dashboard import dashboard_bp
from routes.patients import patients_bp
from routes.prescriptions import prescriptions_bp
from routes.profile import profile_bp
from utils import AppJSONProvider


def create_app():
    app = Flask(__name__)
    app.config["MAX_CONTENT_LENGTH"] = Config.MAX_CONTENT_LENGTH
    app.json = AppJSONProvider(app)
    CORS(app, resources={r"/api/*": {"origins": Config.CORS_ORIGINS}})
    @app.route("/")
    def home():
        return jsonify({
        "message": "Vet Management System API is running",
        "status": "success"
    })
    for sub in ("pets", "doctors"):
        os.makedirs(os.path.join(Config.UPLOAD_FOLDER, sub), exist_ok=True)

    for bp in (auth_bp, dashboard_bp, appointments_bp, patients_bp, prescriptions_bp, profile_bp):
        app.register_blueprint(bp)

    @app.get("/api/health")
    def health():
        return jsonify({"status": "ok"})

    @app.get("/uploads/<path:filename>")
    def uploads(filename):
        return send_from_directory(Config.UPLOAD_FOLDER, filename)

    @app.errorhandler(HTTPException)
    def http_error(e):
        message = "File too large (max 5 MB)" if e.code == 413 else e.description
        return jsonify({"error": message}), e.code

    @app.errorhandler(Exception)
    def server_error(e):
        app.logger.exception(e)
        return jsonify({"error": "Something went wrong on the server. Check the backend terminal."}), 500

    return app


app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
