from app.security import hash_password, verify_password


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200 and r.json()["database"] == "ok"


def test_password_hash_is_salted_and_verifiable():
    a, b = hash_password("secret1"), hash_password("secret1")
    assert a != b and "secret1" not in a
    assert verify_password("secret1", a) and not verify_password("wrong", a)


def test_register_login_me(client):
    r = client.post("/api/auth/register", json={"email": "New.User@Example.com", "password": "pass1234"})
    assert r.status_code == 201
    body = r.json()
    assert body["user"]["email"] == "new.user@example.com" and body["user"]["role"] == "user"
    h = {"Authorization": f"Bearer {body['token']}"}
    assert client.get("/api/auth/me", headers=h).json()["email"] == "new.user@example.com"
    assert client.post("/api/auth/login", json={"email": "new.user@example.com", "password": "pass1234"}).status_code == 200


def test_register_duplicate_conflict(client):
    r = client.post("/api/auth/register", json={"email": "student@example.com", "password": "whatever1"})
    assert r.status_code == 409 and r.json()["status"] == 409


def test_register_validation(client):
    assert client.post("/api/auth/register", json={"email": "bad", "password": "123456"}).status_code == 422
    assert client.post("/api/auth/register", json={"email": "a@b.co", "password": "123"}).status_code == 422
    r = client.post("/api/auth/register", json={"email": "a@b.co"})
    assert r.status_code == 422 and "message" in r.json()


def test_cannot_choose_role_on_register(client):
    r = client.post("/api/auth/register", json={"email": "hacker@example.com", "password": "pass1234", "role": "admin"})
    assert r.status_code == 201 and r.json()["user"]["role"] == "user"


def test_wrong_password_and_unknown_user_same_message(client):
    a = client.post("/api/auth/login", json={"email": "teacher@example.com", "password": "nope"})
    b = client.post("/api/auth/login", json={"email": "ghost@example.com", "password": "nope"})
    assert a.status_code == b.status_code == 401 and a.json()["message"] == b.json()["message"]


def test_lockout_after_repeated_failures(client):
    client.post("/api/auth/register", json={"email": "lock@example.com", "password": "rightpass"})
    for _ in range(5):
        assert client.post("/api/auth/login", json={"email": "lock@example.com", "password": "bad"}).status_code == 401
    locked = client.post("/api/auth/login", json={"email": "lock@example.com", "password": "rightpass"})
    assert locked.status_code == 429  # навіть правильний пароль тимчасово не приймається


def test_protected_endpoints_need_token(client):
    for path in ("/api/auth/me", "/api/analyses", "/api/rules", "/api/stats"):
        r = client.get(path)
        assert r.status_code == 401 and r.json() == {"status": 401, "message": "Потрібна автентифікація"}


def test_invalid_token_rejected(client):
    r = client.get("/api/auth/me", headers={"Authorization": "Bearer not.a.token"})
    assert r.status_code == 401
