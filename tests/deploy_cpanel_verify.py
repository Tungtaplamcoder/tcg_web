#!/usr/bin/env python3
# =============================================================================
# tests/deploy_cpanel_verify.py — end-to-end verification for deploy_cpanel.py
# =============================================================================
# Proves the automated cPanel database lifecycle works end to end WITHOUT a real
# cPanel account, by combining:
#
#   * a real MariaDB container (mariadb:11.4) as the backing database, and
#   * a mock cPanel UAPI HTTP server that actually provisions DB objects in that
#     MariaDB (create_database / create_user / set_privileges_on_database /
#     list_databases / list_users / set_password).
#
# It then runs the REAL deploy_cpanel.py against the mock and asserts:
#   1. The four lifecycle steps run and report OK.
#   2. The SQL dump is auto-imported (27 tables from the init migration).
#   3. backend `.env` is generated with the provisioned credentials.
#   4. A second run is idempotent: "already exists" is handled gracefully,
#      the import is skipped (tables present), and nothing crashes.
#
# Usage:  python3 tests/deploy_cpanel_verify.py
# Exit:   0 = all assertions pass, 1 = failure (details printed).
# =============================================================================

import json
import os
import re
import socket
import subprocess
import sys
import tempfile
import threading
import time
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEPLOY = ROOT / "deploy_cpanel.py"
DUMP = ROOT / "backend/prisma/migrations/20260907081641_init_mariadb/migration.sql"

CONTAINER = "tcg-cpanel-verify-db"
DB_PORT = 13307
ROOT_PASS = "verifyrootpass"
CPANEL_USER = "verifyacct"
DB_SUFFIX = "store"
USER_SUFFIX = "app"
FULL_DB = f"{CPANEL_USER}_{DB_SUFFIX}"
FULL_USER = f"{CPANEL_USER}_{USER_SUFFIX}"

GREEN = "\033[0;32m"
RED = "\033[0;31m"
YELLOW = "\033[0;33m"
CYAN = "\033[0;36m"
BOLD = "\033[1m"
NC = "\033[0m"

FAILURES = []


def check(condition: bool, label: str) -> None:
    if condition:
        print(f"{GREEN}  \u2713 {label}{NC}")
    else:
        print(f"{RED}  \u2717 {label}{NC}")
        FAILURES.append(label)


def sh(cmd, **kw):
    return subprocess.run(cmd, capture_output=True, text=True, **kw)


def mysql(sql: str) -> subprocess.CompletedProcess:
    return sh([
        "mysql", f"--host=127.0.0.1", f"--port={DB_PORT}",
        "-uroot", f"-p{ROOT_PASS}", "--batch", "-N", "-e", sql,
    ])


# ---------------------------------------------------------------------------
# Mock cPanel UAPI server
# ---------------------------------------------------------------------------
class MockCpanelHandler(BaseHTTPRequestHandler):
    calls: list = []

    def log_message(self, *args):  # silence
        pass

    # -- helpers ------------------------------------------------------------
    def _reply(self, status: int, errors=None, data=None) -> None:
        body = json.dumps({"status": status, "errors": errors, "data": data}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _params(self) -> dict:
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length).decode() if length else ""
        return {k: v[-1] for k, v in urllib.parse.parse_qs(raw).items()}

    # -- routing ------------------------------------------------------------
    def do_POST(self):
        match = re.match(r"^/execute/(\w+)/(\w+)$", self.path)
        if not match:
            self._reply(0, ["unknown endpoint"])
            return
        module, function = match.groups()
        params = self._params()
        MockCpanelHandler.calls.append((module, function, params))
        handler = getattr(self, f"uapi_{function}", None)
        if handler is None:
            self._reply(0, [f"unsupported UAPI {module}::{function}"])
            return
        handler(params)

    # -- Mysql::* -----------------------------------------------------------
    def uapi_list_databases(self, _):
        proc = mysql("SELECT SCHEMA_NAME FROM information_schema.SCHEMATA "
                     "WHERE SCHEMA_NAME NOT IN ('mysql','information_schema','performance_schema','sys')")
        dbs = [l for l in proc.stdout.splitlines() if l.strip()]
        self._reply(1, data=dbs)

    def uapi_list_users(self, _):
        proc = mysql("SELECT User FROM mysql.user WHERE User <> 'root' AND User <> 'mariadb.sys'")
        users = [l for l in proc.stdout.splitlines() if l.strip()]
        self._reply(1, data=users)

    def uapi_create_database(self, p):
        name = p.get("name", "")
        exists = mysql(f"SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='{name}'")
        if exists.stdout.strip():
            self._reply(0, [f"The database name already exists: {name}"])
            return
        proc = mysql(f"CREATE DATABASE `{name}` CHARACTER SET utf8mb4")
        if proc.returncode != 0:
            self._reply(0, [proc.stderr.strip()])
        else:
            self._reply(1, data=None)

    def uapi_create_user(self, p):
        name, password = p.get("name", ""), p.get("password", "")
        exists = mysql(f"SELECT User FROM mysql.user WHERE User='{name}'")
        if exists.stdout.strip():
            self._reply(0, [f"The user already exists: {name}"])
            return
        sql = (
            f"CREATE USER '{name}'@'localhost' IDENTIFIED BY '{password}'; "
            f"CREATE USER '{name}'@'%' IDENTIFIED BY '{password}';"
        )
        proc = mysql(sql)
        self._reply(1, data=None) if proc.returncode == 0 else self._reply(0, [proc.stderr.strip()])

    def uapi_set_password(self, p):
        name, password = p.get("user", ""), p.get("password", "")
        sql = (
            f"ALTER USER '{name}'@'localhost' IDENTIFIED BY '{password}'; "
            f"ALTER USER '{name}'@'%' IDENTIFIED BY '{password}';"
        )
        proc = mysql(sql)
        self._reply(1, data=None) if proc.returncode == 0 else self._reply(0, [proc.stderr.strip()])

    def uapi_set_privileges_on_database(self, p):
        user, db, priv = p.get("user", ""), p.get("database", ""), p.get("privileges", "ALL PRIVILEGES")
        sql = (
            f"GRANT {priv} ON `{db}`.* TO '{user}'@'localhost'; "
            f"GRANT {priv} ON `{db}`.* TO '{user}'@'%'; FLUSH PRIVILEGES;"
        )
        proc = mysql(sql)
        self._reply(1, data=None) if proc.returncode == 0 else self._reply(0, [proc.stderr.strip()])


def free_port() -> int:
    sock = socket.socket()
    sock.bind(("127.0.0.1", 0))
    port = sock.getsockname()[1]
    sock.close()
    return port


# ---------------------------------------------------------------------------
# MariaDB container lifecycle
# ---------------------------------------------------------------------------
def start_mariadb() -> None:
    sh(["docker", "rm", "-f", CONTAINER])
    proc = sh([
        "docker", "run", "-d", "--name", CONTAINER,
        "-p", f"{DB_PORT}:3306",
        "-e", f"MARIADB_ROOT_PASSWORD={ROOT_PASS}",
        "mariadb:11.4",
    ])
    if proc.returncode != 0:
        raise RuntimeError(f"docker run failed: {proc.stderr.strip()}")
    for _ in range(60):
        if mysql("SELECT 1").returncode == 0:
            return
        time.sleep(1)
    raise RuntimeError("MariaDB did not become reachable")


def stop_mariadb() -> None:
    sh(["docker", "rm", "-f", CONTAINER])


def table_count() -> int:
    proc = mysql(f"SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='{FULL_DB}'")
    try:
        return int(proc.stdout.strip() or "0")
    except ValueError:
        return -1


# ---------------------------------------------------------------------------
# Test run
# ---------------------------------------------------------------------------
def run_deploy(http_port: int, env_out: Path, extra=None):
    cmd = [
        sys.executable, str(DEPLOY),
        "--scheme", "http", "--cpanel-host", "127.0.0.1", "--cpanel-port", str(http_port),
        "--cpanel-user", CPANEL_USER, "--cpanel-token", "verify-token",
        "--db-name", DB_SUFFIX, "--db-user", USER_SUFFIX,
        "--db-host", "127.0.0.1", "--db-port", str(DB_PORT),
        "--dump", str(DUMP), "--env-out", str(env_out),
        "--env-template", str(ROOT / "backend/.env.production"),
    ]
    if extra:
        cmd += extra
    return sh(cmd)


def main() -> int:
    if not DEPLOY.is_file():
        print(f"{RED}deploy_cpanel.py not found at {DEPLOY}{NC}")
        return 1

    print(f"{BOLD}{CYAN}== deploy_cpanel.py end-to-end verification =={NC}")
    print(f"    dump: {DUMP.relative_to(ROOT)}")
    start_mariadb()

    http_port = free_port()
    server = ThreadingHTTPServer(("127.0.0.1", http_port), MockCpanelHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    print(f"{CYAN}    mock cPanel UAPI on http://127.0.0.1:{http_port}{NC}")

    tmp = Path(tempfile.mkdtemp(prefix="tcg-cpanel-verify-"))
    env_out = tmp / ".env"

    try:
        # ── Run 1: full fresh provisioning + import ──
        print(f"\n{BOLD}[Run 1] Fresh provisioning + auto-import{NC}")
        r1 = run_deploy(http_port, env_out, ["--force-import"])
        print(r1.stdout)
        if r1.stderr.strip():
            print(r1.stderr)

        check(r1.returncode == 0, "deploy_cpanel.py exited 0")
        for label in (
            "Creating cPanel MySQL Database... OK",
            "Creating cPanel MySQL User... OK",
            "Assigning Privileges... OK",
            "Auto-importing SQL schema... OK",
        ):
            check(label in r1.stdout, f"logged: {label}")

        functions = [f for _, f, _ in MockCpanelHandler.calls]
        check("create_database" in functions, "UAPI create_database called")
        check("create_user" in functions, "UAPI create_user called")
        check("set_privileges_on_database" in functions, "UAPI set_privileges_on_database called")

        count = table_count()
        check(count == 27, f"SQL dump imported into {FULL_DB} (tables={count}, expected 27)")

        check(env_out.is_file(), "backend .env generated")
        env_text = env_out.read_text() if env_out.is_file() else ""
        check(f"DB_NAME={FULL_DB}" in env_text, f".env has DB_NAME={FULL_DB}")
        check(f"DB_USER={FULL_USER}" in env_text, f".env has DB_USER={FULL_USER}")
        check("DB_HOST=localhost" in env_text, ".env has DB_HOST=localhost")
        check("DATABASE_URL=mysql://" in env_text, ".env has a composed DATABASE_URL")

        # ── Run 2: idempotency (existing DB/user, populated tables) ──
        print(f"\n{BOLD}[Run 2] Re-run (idempotency){NC}")
        before = len(MockCpanelHandler.calls)
        r2 = run_deploy(http_port, env_out)
        print(r2.stdout)
        if r2.stderr.strip():
            print(r2.stderr)

        check(r2.returncode == 0, "second run exited 0 (did not crash)")
        lower = r2.stdout.lower()
        check("already exists" in lower, "existing DB/user handled gracefully (warning)")
        check("already populated" in lower or "skipping import" in lower,
              "import skipped because tables already present")
        check(table_count() == 27, "table count unchanged after re-run (27)")
        check(len(MockCpanelHandler.calls) > before, "second run exercised the UAPI again")

        # ── Run 3: dry-run safety ──
        print(f"\n{BOLD}[Run 3] --dry-run makes no changes{NC}")
        r3 = run_deploy(http_port, tmp / "dry.env", ["--dry-run"])
        check(r3.returncode == 0, "dry-run exited 0")
        check(not (tmp / "dry.env").exists(), "dry-run did not write the .env file")
        check("DRY-RUN" in r3.stdout, "dry-run banner printed")

    finally:
        server.shutdown()
        stop_mariadb()

    print(f"\n{BOLD}{'=' * 50}{NC}")
    if FAILURES:
        print(f"{RED}{BOLD}\u2717 {len(FAILURES)} check(s) failed:{NC}")
        for f in FAILURES:
            print(f"{RED}   - {f}{NC}")
        return 1
    print(f"{GREEN}{BOLD}\u2713 All checks passed — cPanel DB lifecycle is fully automated{NC}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
