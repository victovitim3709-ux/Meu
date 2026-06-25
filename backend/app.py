import os
import uuid
import base64
from datetime import datetime
from functools import wraps

from flask import Flask, request, jsonify, session, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__, static_folder="../frontend/dist", static_url_path="/")

app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "dev-secret-change-me")
app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get(
    "DATABASE_URL", "sqlite:///local.db"
).replace("postgres://", "postgresql://")
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["SESSION_COOKIE_SECURE"] = os.environ.get("FLASK_ENV") == "production"

CORS(app, supports_credentials=True, origins=os.environ.get("ALLOWED_ORIGINS", "*").split(","))

db = SQLAlchemy(app)


# ── Models ──────────────────────────────────────────────────────────────────

class User(db.Model):
    __tablename__ = "users"
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    is_admin = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            "id": self.id,
            "username": self.username,
            "isAdmin": self.is_admin,
            "createdAt": self.created_at.isoformat(),
        }


class Cadastro(db.Model):
    __tablename__ = "cadastros"
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    numero_processo = db.Column(db.String(50))
    data_distribuicao = db.Column(db.String(30))
    valor = db.Column(db.String(50))
    autor = db.Column(db.String(200))
    cpf_autor = db.Column(db.String(20))
    reu = db.Column(db.String(200))
    cnpj_reu = db.Column(db.String(20))
    materia = db.Column(db.Text)
    advogado = db.Column(db.String(200))
    grupo = db.Column(db.String(100))
    concluido = db.Column(db.Boolean, default=False)
    concluido_em = db.Column(db.String(50))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    created_by = db.Column(db.String(36), db.ForeignKey("users.id"))

    def to_dict(self):
        return {
            "id": self.id,
            "numeroProcesso": self.numero_processo,
            "dataDistribuicao": self.data_distribuicao,
            "valor": self.valor,
            "autor": self.autor,
            "cpfAutor": self.cpf_autor,
            "reu": self.reu,
            "cnpjReu": self.cnpj_reu,
            "materia": self.materia,
            "advogado": self.advogado,
            "grupo": self.grupo,
            "concluido": self.concluido,
            "concluidoEm": self.concluido_em,
            "createdAt": self.created_at.isoformat(),
        }


class Recibo(db.Model):
    __tablename__ = "recibos"
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    nome = db.Column(db.String(200))
    numero_processo = db.Column(db.String(50))
    data_distribuicao = db.Column(db.String(30))
    advogado = db.Column(db.String(200))
    grupo = db.Column(db.String(100))
    pdf_data = db.Column(db.Text)  # base64
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    created_by = db.Column(db.String(36), db.ForeignKey("users.id"))

    def to_dict(self, include_pdf=False):
        d = {
            "id": self.id,
            "nome": self.nome,
            "numeroProcesso": self.numero_processo,
            "dataDistribuicao": self.data_distribuicao,
            "advogado": self.advogado,
            "grupo": self.grupo,
            "createdAt": self.created_at.isoformat(),
        }
        if include_pdf:
            d["pdfData"] = self.pdf_data
        return d


# ── Helpers ──────────────────────────────────────────────────────────────────

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if "user_id" not in session:
            return jsonify({"error": "Não autenticado"}), 401
        return f(*args, **kwargs)
    return decorated


def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if "user_id" not in session:
            return jsonify({"error": "Não autenticado"}), 401
        user = User.query.get(session["user_id"])
        if not user or not user.is_admin:
            return jsonify({"error": "Sem permissão"}), 403
        return f(*args, **kwargs)
    return decorated


def current_user():
    return User.query.get(session.get("user_id"))


# ── Auth routes ───────────────────────────────────────────────────────────────

@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.json or {}
    user = User.query.filter_by(username=data.get("username", "").strip()).first()
    if not user or not user.check_password(data.get("password", "")):
        return jsonify({"error": "Usuário ou senha incorretos"}), 401
    session["user_id"] = user.id
    return jsonify({"user": user.to_dict()})


@app.route("/api/auth/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"ok": True})


@app.route("/api/auth/me", methods=["GET"])
def me():
    user = current_user()
    if not user:
        return jsonify({"user": None})
    return jsonify({"user": user.to_dict()})


# ── Users routes ──────────────────────────────────────────────────────────────

@app.route("/api/users", methods=["GET"])
@admin_required
def list_users():
    users = User.query.order_by(User.created_at).all()
    return jsonify([u.to_dict() for u in users])


@app.route("/api/users", methods=["POST"])
@admin_required
def create_user():
    data = request.json or {}
    username = data.get("username", "").strip()
    password = data.get("password", "")
    if not username or not password:
        return jsonify({"error": "Preencha usuário e senha"}), 400
    if User.query.filter_by(username=username).first():
        return jsonify({"error": "Usuário já existe"}), 409
    user = User(username=username, is_admin=bool(data.get("isAdmin", False)))
    user.set_password(password)
    db.session.add(user)
    db.session.commit()
    return jsonify(user.to_dict()), 201


@app.route("/api/users/<username>", methods=["DELETE"])
@admin_required
def delete_user(username):
    u = current_user()
    if u.username == username:
        return jsonify({"error": "Não pode remover a si mesmo"}), 400
    user = User.query.filter_by(username=username).first_or_404()
    db.session.delete(user)
    db.session.commit()
    return jsonify({"ok": True})


@app.route("/api/users/<username>/password", methods=["PATCH"])
@admin_required
def update_password(username):
    data = request.json or {}
    user = User.query.filter_by(username=username).first_or_404()
    user.set_password(data.get("password", ""))
    db.session.commit()
    return jsonify({"ok": True})


# ── Cadastros routes ──────────────────────────────────────────────────────────

@app.route("/api/cadastros", methods=["GET"])
@login_required
def list_cadastros():
    cads = Cadastro.query.order_by(Cadastro.created_at.desc()).all()
    return jsonify([c.to_dict() for c in cads])


@app.route("/api/cadastros", methods=["POST"])
@login_required
def create_cadastro():
    data = request.json or {}
    c = Cadastro(
        numero_processo=data.get("numeroProcesso", ""),
        data_distribuicao=data.get("dataDistribuicao", ""),
        valor=data.get("valor", ""),
        autor=data.get("autor", ""),
        cpf_autor=data.get("cpfAutor", ""),
        reu=data.get("reu", ""),
        cnpj_reu=data.get("cnpjReu", ""),
        materia=data.get("materia", ""),
        advogado=data.get("advogado", ""),
        grupo=data.get("grupo", ""),
        created_by=session["user_id"],
    )
    db.session.add(c)
    db.session.commit()
    return jsonify(c.to_dict()), 201


@app.route("/api/cadastros/<cid>", methods=["PATCH"])
@login_required
def update_cadastro(cid):
    c = Cadastro.query.get_or_404(cid)
    data = request.json or {}
    for field, col in [
        ("numeroProcesso", "numero_processo"), ("dataDistribuicao", "data_distribuicao"),
        ("valor", "valor"), ("autor", "autor"), ("cpfAutor", "cpf_autor"),
        ("reu", "reu"), ("cnpjReu", "cnpj_reu"), ("materia", "materia"),
        ("advogado", "advogado"), ("grupo", "grupo"),
        ("concluido", "concluido"), ("concluidoEm", "concluido_em"),
    ]:
        if field in data:
            setattr(c, col, data[field])
    db.session.commit()
    return jsonify(c.to_dict())


@app.route("/api/cadastros/<cid>", methods=["DELETE"])
@login_required
def delete_cadastro(cid):
    c = Cadastro.query.get_or_404(cid)
    db.session.delete(c)
    db.session.commit()
    return jsonify({"ok": True})


# ── Recibos routes ────────────────────────────────────────────────────────────

@app.route("/api/recibos", methods=["GET"])
@login_required
def list_recibos():
    recs = Recibo.query.order_by(Recibo.created_at.desc()).all()
    return jsonify([r.to_dict() for r in recs])


@app.route("/api/recibos", methods=["POST"])
@login_required
def create_recibo():
    data = request.json or {}
    r = Recibo(
        nome=data.get("nome", ""),
        numero_processo=data.get("numeroProcesso", ""),
        data_distribuicao=data.get("dataDistribuicao", ""),
        advogado=data.get("advogado", ""),
        grupo=data.get("grupo", ""),
        pdf_data=data.get("pdfData", ""),
        created_by=session["user_id"],
    )
    db.session.add(r)
    db.session.commit()
    return jsonify(r.to_dict()), 201


@app.route("/api/recibos/<rid>/pdf", methods=["GET"])
@login_required
def get_recibo_pdf(rid):
    r = Recibo.query.get_or_404(rid)
    if not r.pdf_data:
        return jsonify({"error": "PDF não encontrado"}), 404
    return jsonify({"pdfData": r.pdf_data})


@app.route("/api/recibos/<rid>", methods=["DELETE"])
@login_required
def delete_recibo(rid):
    r = Recibo.query.get_or_404(rid)
    db.session.delete(r)
    db.session.commit()
    return jsonify({"ok": True})


# ── SPA fallback ──────────────────────────────────────────────────────────────

@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_spa(path):
    dist = os.path.join(app.static_folder)
    if path and os.path.exists(os.path.join(dist, path)):
        return send_from_directory(dist, path)
    return send_from_directory(dist, "index.html")


# ── Init ──────────────────────────────────────────────────────────────────────

def init_db():
    db.create_all()
    if not User.query.filter_by(username="admin").first():
        admin = User(username="admin", is_admin=True)
        admin.set_password("admin123")
        db.session.add(admin)
        db.session.commit()
        print("Admin criado: admin / admin123")


if __name__ == "__main__":
    with app.app_context():
        init_db()
    app.run(debug=True, port=5000)
