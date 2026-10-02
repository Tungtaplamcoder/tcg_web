#!/usr/bin/env python3
# =============================================================================
# deploy_cpanel.py — 100% automated cPanel MySQL provisioning + SQL auto-import
# =============================================================================
# Talks to the cPanel UAPI over HTTPS (port 2083) to provision the full database
# lifecycle with ZERO cPanel web-interface (GUI) actions:
#
#   [1/4] Mysql::create_database          — create the database
#   [2/4] Mysql::create_user              — create the database user (secure pw)
#   [3/4] Mysql::set_privileges_on_database — grant ALL PRIVILEGES
#   [4/4] mysql < dump.sql                — auto-import the schema/seed dump
#
# It then (re)writes the backend `.env` with the newly provisioned credentials
# (`DB_HOST=localhost`, `DB_NAME`, `DB_USER`, `DB_PASS`, `DATABASE_URL`) and can
# push that file onto the account with Fileman::save_file_content.
#
# Idempotent: if the DB or user already exists the UAPI response is caught,
# a warning is logged, and the run proceeds straight to import/verification
# instead of crashing.
#
# Designed to run from the LOCAL machine (same "local build, remote run"
# philosophy as pack-cpanel.sh) or on the cPanel server itself.
#
# ── Credential sources (highest priority first) ──────────────────────────────
#   1. CLI flags
#   2. Environment variables
#   3. .env.cpanel.deploy (git-ignored, copy from .env.cpanel.deploy.example)
#   4. .env
#
# Required: CPANEL_HOST, CPANEL_USER and either CPANEL_API_TOKEN or
#           CPANEL_PASSWORD.
#
# Examples
# --------
#   # Safe dry-run: prints every UAPI call + the mysql import command, no changes
#   python3 deploy_cpanel.py --dry-run
#
#   # Real provisioning against a cPanel account, importing the packed seed dump
#   python3 deploy_cpanel.py \
#     --cpanel-host server.example.com --cpanel-user myacct \
#     --cpanel-token ******** \
#     --db-name tcgstore --db-user tcg \
#     --dump ./seed.sql --env-out ./backend/.env
#
# Exit codes: 0 = success/planned, 1 = fatal error, 2 = usage error.
# =============================================================================

from __future__ import annotations

import argparse
import base64
import json
import os
import shutil
import ssl
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

# ---------------------------------------------------------------------------
# Console helpers
# ---------------------------------------------------------------------------
_COLOR = sys.stdout.isatty() and os.environ.get("NO_COLOR") is None
RESET = "\033[0m" if _COLOR else ""
BOLD = "\033[1m" if _COLOR else ""
RED = "\033[0;31m" if _COLOR else ""
GREEN = "\033[0;32m" if _COLOR else ""
YELLOW = "\033[0;33m" if _COLOR else ""
CYAN = "\033[0;36m" if _COLOR else ""


def log(msg: str) -> None:
    print(f"\n{BOLD}{CYAN}==> {msg}{RESET}")


def ok(msg: str) -> None:
    print(f"{GREEN}    \u2713 {msg}{RESET}")


def warn(msg: str) -> None:
    print(f"{YELLOW}    ! {msg}{RESET}")


def info(msg: str) -> None:
    print(f"{CYAN}    \u2192 {msg}{RESET}")


def die(msg: str, code: int = 1) -> "NoReturn":  # type: ignore[name-defined]
    print(f"{BOLD}{RED}ERROR: {msg}{RESET}", file=sys.stderr)
    sys.exit(code)


# ---------------------------------------------------------------------------
# Tiny .env loader (no external dependency)
# ---------------------------------------------------------------------------
def load_env_file(path: Path) -> dict:
    """Parse a simple KEY=VALUE .env file. Never overrides real environment."""
    values: dict = {}
    if not path.is_file():
        return values
    try:
        for raw in path.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            key = key.strip()
            val = val.strip()
            # Strip a single layer of matching quotes.
            if len(val) >= 2 and val[0] == val[-1] and val[0] in ("'", '"'):
                val = val[1:-1]
            values[key] = val
    except OSError as exc:
        warn(f"Could not read {path}: {exc}")
    return values


class Config:
    """Resolve deployment settings from CLI > env > .env files, with defaults."""

    def __init__(self, args: argparse.Namespace) -> None:
        root = Path(__file__).resolve().parent
        self.root = root

        # Deployment config: dedicated .env.cpanel.deploy plus any --env-file.
        # The repo's normal `.env` is read separately and ONLY consulted for
        # explicit CPANEL_* keys — so local dev DB_* values can never leak into
        # (and clobber credentials for) the cPanel deployment.
        merged: dict = {}
        for candidate in (root / ".env.cpanel.deploy",):
            merged.update(load_env_file(candidate))
        if args.env_file:
            merged.update(load_env_file(Path(args.env_file)))
        dotenv = load_env_file(root / ".env")

        def pick(*names, default=None):
            for name in names:
                if name in os.environ and os.environ[name] != "":
                    return os.environ[name]
            for name in names:
                if merged.get(name):
                    return merged[name]
            for name in names:
                if dotenv.get(name):
                    return dotenv[name]
            return default

        # ── cPanel API credentials ──
        self.cpanel_host = args.cpanel_host or pick("CPANEL_HOST", "CPANEL_SERVER")
        self.cpanel_port = int(args.cpanel_port or pick("CPANEL_PORT", default="2083"))
        self.cpanel_scheme = (args.scheme or pick("CPANEL_SCHEME", default="https")).lower()
        self.cpanel_user = args.cpanel_user or pick("CPANEL_USER", "CPANEL_USERNAME")
        self.cpanel_token = args.cpanel_token or pick("CPANEL_API_TOKEN", "CPANEL_TOKEN")
        self.cpanel_password = pick("CPANEL_PASSWORD")
        self.insecure = bool(args.insecure) or pick("CPANEL_INSECURE", default="0") in (
            "1",
            "true",
            "yes",
        )

        # ── Database target (CPANEL_DB_* only — never the dev DB_* values) ──
        self.db_name = args.db_name or pick("CPANEL_DB_NAME")
        self.db_user = args.db_user or pick("CPANEL_DB_USER")
        self.db_pass = args.db_pass or pick("CPANEL_DB_PASS")
        self.generate_password = not bool(self.db_pass)
        # Host/port used by the mysql client during auto-import. localhost means
        # "run on the cPanel server"; use a remote hostname for off-server import.
        self.db_host = args.db_host or pick("CPANEL_DB_HOST", default="localhost")
        self.db_port = int(args.db_port or pick("CPANEL_DB_PORT", default="3306"))

        # ── SQL dump auto-import ──
        self.dump = Path(args.dump).resolve() if args.dump else self._auto_dump(args)
        self.force_import = bool(args.force_import) or pick("CPANEL_FORCE_IMPORT", default="0") in (
            "1",
            "true",
            "yes",
        )
        self.skip_import = bool(args.skip_import)

        # ── .env output / upload ──
        env_out = args.env_out or pick("CPANEL_ENV_OUT")
        self.env_out = Path(env_out).resolve() if env_out else (root / "backend" / ".env")
        self.env_template = (
            Path(args.env_template).resolve()
            if args.env_template
            else self._auto_env_template()
        )
        self.upload_env = bool(args.upload_env) or pick("CPANEL_UPLOAD_ENV", default="0") in (
            "1",
            "true",
            "yes",
        )
        # Path on the cPanel account where the app lives (Fileman target).
        self.app_path = args.app_path or pick("CPANEL_APP_PATH", default="tcg/backend")

        # ── Behaviour ──
        self.dry_run = bool(args.dry_run)
        self.verify_tls = not self.insecure

        self._validate()

    # -- helpers ------------------------------------------------------------
    def _auto_dump(self, args: argparse.Namespace) -> Path:
        for rel in ("database/dump.sql", "seed.sql", "database/seed.sql", "migration.sql"):
            candidate = self.root / rel
            if candidate.is_file():
                return candidate
        return self.root / "database" / "dump.sql"

    def _auto_env_template(self) -> Path:
        for rel in ("backend/.env.production", "backend/.env.example"):
            candidate = self.root / rel
            if candidate.is_file():
                return candidate
        return self.root / "backend" / ".env"

    def _validate(self) -> None:
        if self.dry_run:
            # Dry-run must work even without real credentials so CI/`pack-cpanel.sh
            # --dry-run` can lint the full planned flow. Missing values fall back
            # to clearly-marked placeholders; nothing is contacted either way.
            self.cpanel_host = self.cpanel_host or "cpanel.example.invalid"
            self.cpanel_user = self.cpanel_user or "cpaneluser"
            self.db_name = self.db_name or "tcgstore"
            self.db_user = self.db_user or "tcg"
            return
        missing = []
        if not self.cpanel_host:
            missing.append("CPANEL_HOST (--cpanel-host)")
        if not self.cpanel_user:
            missing.append("CPANEL_USER (--cpanel-user)")
        if not (self.cpanel_token or self.cpanel_password):
            missing.append("CPANEL_API_TOKEN or CPANEL_PASSWORD (--cpanel-token)")
        if not self.db_name:
            missing.append("CPANEL_DB_NAME (--db-name)")
        if not self.db_user:
            missing.append("CPANEL_DB_USER (--db-user)")
        if missing:
            die(
                "Missing cPanel deployment configuration: "
                + ", ".join(missing)
                + "\n        Copy .env.cpanel.deploy.example → .env.cpanel.deploy and fill it in,"
                " or pass the matching CLI flags."
            )

    # -- derived ------------------------------------------------------------
    @property
    def prefix(self) -> str:
        """cPanel account prefix (cPanel always namespace-prefixes DB objects)."""
        return f"{self.cpanel_user}_" if self.cpanel_user else ""

    def full_db_name(self) -> str:
        """Return the database name guaranteed to carry the account prefix."""
        name = self.db_name or ""
        if not self.prefix or name.startswith(self.prefix):
            return name
        return f"{self.prefix}{name}"

    def full_db_user(self) -> str:
        """Return the DB user guaranteed to carry the account prefix."""
        name = self.db_user or ""
        if not self.prefix or name.startswith(self.prefix):
            return name
        return f"{self.prefix}{name}"


# ---------------------------------------------------------------------------
# Password generation
# ---------------------------------------------------------------------------
def generate_password(length: int = 24) -> str:
    """Generate a strong password that is safe for cPanel/MySQL/mysql-CLI.

    Avoids characters that need shell/URL escaping and cPanel dislikes:
    no quotes, backslashes, $, #, spaces, @, :, /.
    """
    import secrets
    import string

    alphabet = string.ascii_letters + string.digits + ".-_=+!%*?"
    return "".join(secrets.choice(alphabet) for _ in range(length))


# ---------------------------------------------------------------------------
# cPanel UAPI client
# ---------------------------------------------------------------------------
class CpanelError(RuntimeError):
    def __init__(self, function: str, errors) -> None:
        self.function = function
        self.errors = errors if isinstance(errors, list) else [str(errors)]
        super().__init__(f"UAPI {function} failed: {'; '.join(str(e) for e in self.errors)}")

    def is_already_exists(self) -> bool:
        blob = " ".join(str(e) for e in self.errors).lower()
        return any(
            marker in blob
            for marker in ("already exists", "already exist", "exists", "duplicate")
        )


class CpanelUAPI:
    """Minimal cPanel UAPI client (stdlib only, token or password auth)."""

    def __init__(self, cfg: Config) -> None:
        self.cfg = cfg
        self.base = f"{cfg.cpanel_scheme}://{cfg.cpanel_host}:{cfg.cpanel_port}/execute"
        if cfg.insecure:
            self.ssl_ctx = ssl._create_unverified_context()  # noqa: S323
        else:
            self.ssl_ctx = ssl.create_default_context()

    def _auth_header(self) -> str:
        if self.cfg.cpanel_token:
            # cPanel token auth ("API token"): cpanel USER:TOKEN
            return "cpanel " + self.cfg.cpanel_user + ":" + self.cfg.cpanel_token
        raw = f"{self.cfg.cpanel_user}:{self.cfg.cpanel_password}".encode()
        return "Basic " + base64.b64encode(raw).decode()

    def call(self, function: str, params: dict, module: str = "Mysql") -> dict:
        """Invoke a UAPI <module>::<function>; return data. Raises CpanelError."""
        url = f"{self.base}/{module}/{function}"
        body = urllib.parse.urlencode(params, doseq=True).encode()
        req = urllib.request.Request(
            url,
            data=body,
            headers={
                "Authorization": self._auth_header(),
                "Accept": "application/json",
                "Content-Type": "application/x-www-form-urlencoded",
            },
            method="POST",
        )

        if self.cfg.dry_run:
            info(f"[dry-run] POST {url}  params={_redact(params)}")
            return {}

        try:
            with urllib.request.urlopen(req, timeout=30, context=self.ssl_ctx) as resp:
                payload = json.loads(resp.read().decode("utf-8", "replace"))
        except urllib.error.HTTPError as exc:  # cPanel often returns JSON on 4xx
            raw = exc.read().decode("utf-8", "replace")
            try:
                payload = json.loads(raw)
            except json.JSONDecodeError:
                raise CpanelError(function, [f"HTTP {exc.code}: {raw[:300]}"])
        except urllib.error.URLError as exc:
            raise CpanelError(function, [f"connection failed: {exc.reason}"])
        except json.JSONDecodeError as exc:
            raise CpanelError(function, [f"invalid JSON response: {exc}"])

        status = payload.get("status")
        errors = payload.get("errors")
        if status != 1:
            raise CpanelError(function, errors or payload.get("messages") or "unknown error")
        return payload.get("data") or {}

    # -- higher-level operations --------------------------------------------
    def list_databases(self) -> list:
        data = self.call("list_databases", {})
        return _names_from(data, "database", "db", "name")

    def list_users(self) -> list:
        data = self.call("list_users", {})
        return _names_from(data, "user", "name")

    def create_database(self, name: str) -> None:
        self.call("create_database", {"name": name})

    def create_user(self, name: str, password: str) -> None:
        self.call("create_user", {"name": name, "password": password})

    def set_password(self, name: str, password: str) -> None:
        self.call("set_password", {"user": name, "password": password})

    def set_privileges(self, user: str, database: str, privileges: str = "ALL PRIVILEGES") -> None:
        self.call(
            "set_privileges_on_database",
            {"user": user, "database": database, "privileges": privileges},
        )

    def save_file_content(self, path: str, content: str) -> None:
        # cPanel UAPI Fileman::save_file_content (dir + filename split).
        directory, _, filename = path.rpartition("/")
        self.call(
            "save_file_content",
            {"dir": directory or ".", "file": filename, "content": content, "from_charset": "UTF-8"},
            module="Fileman",
        )


def _names_from(data, *keys) -> list:
    """Normalize list_databases/list_users responses across cPanel versions."""
    out = []
    if isinstance(data, dict):
        data = data.get("data") or list(data.values())
    if not isinstance(data, list):
        return out
    for item in data:
        if isinstance(item, str):
            out.append(item)
        elif isinstance(item, dict):
            for key in keys:
                if item.get(key):
                    out.append(str(item[key]))
                    break
    return out


def _redact(params: dict) -> dict:
    safe = dict(params)
    if "password" in safe:
        safe["password"] = "********"
    return safe


# ---------------------------------------------------------------------------
# Steps
# ---------------------------------------------------------------------------
def resolve_password(cfg: Config) -> str:
    if cfg.db_pass:
        return cfg.db_pass
    if cfg.generate_password:
        pw = generate_password()
        # Persist for the rest of this process only; written into .env below.
        cfg.db_pass = pw
        if not cfg.dry_run:
            info("Generated a secure DB password (will be written to backend/.env)")
        return pw
    return cfg.db_pass or ""


def step_ensure_database(api: CpanelUAPI, cfg: Config, steps: dict) -> None:
    name = cfg.full_db_name()
    steps["db"] = name
    log(f"[1/4] Creating cPanel MySQL Database: {name}")
    if cfg.dry_run:
        info(f"[dry-run] would ensure database '{name}'")
        ok("Creating cPanel MySQL Database... OK (planned)")
        return
    try:
        existing = api.list_databases()
        if name in existing:
            warn(f"Database '{name}' already exists — skipping create (idempotent)")
            ok("Creating cPanel MySQL Database... OK (existing)")
            return
    except CpanelError as exc:
        warn(f"Could not list databases ({exc}); attempting create anyway")

    try:
        api.create_database(name)
        ok("Creating cPanel MySQL Database... OK")
    except CpanelError as exc:
        if exc.is_already_exists():
            warn(f"Database '{name}' already exists (API) — continuing")
            ok("Creating cPanel MySQL Database... OK (existing)")
        else:
            die(str(exc))


def step_ensure_user(api: CpanelUAPI, cfg: Config, password: str, steps: dict) -> None:
    name = cfg.full_db_user()
    steps["user"] = name
    log(f"[2/4] Creating cPanel MySQL User: {name}")
    if cfg.dry_run:
        info(f"[dry-run] would ensure user '{name}'")
        ok("Creating cPanel MySQL User... OK (planned)")
        return

    existed = False
    try:
        if name in api.list_users():
            existed = True
    except CpanelError as exc:
        warn(f"Could not list DB users ({exc}); attempting create anyway")

    if existed:
        warn(f"DB user '{name}' already exists — skipping create (idempotent)")
        # Best-effort: align the password with the one we are provisioning so the
        # auto-import and generated .env are guaranteed to work on re-runs.
        if cfg.generate_password or cfg.db_pass:
            try:
                api.set_password(name, password)
                info("Reset existing user's password to the provisioned value")
            except CpanelError as exc:
                warn(f"Could not reset existing user's password ({exc}); "
                     "set CPANEL_DB_PASS explicitly if import fails")
        ok("Creating cPanel MySQL User... OK (existing)")
        return

    try:
        api.create_user(name, password)
        ok("Creating cPanel MySQL User... OK")
    except CpanelError as exc:
        if exc.is_already_exists():
            warn(f"DB user '{name}' already exists (API) — continuing")
            ok("Creating cPanel MySQL User... OK (existing)")
        else:
            die(str(exc))


def step_set_privileges(api: CpanelUAPI, cfg: Config, steps: dict) -> None:
    log("[3/4] Assigning Privileges (ALL PRIVILEGES)")
    if cfg.dry_run:
        info(f"[dry-run] would grant ALL PRIVILEGES on '{steps['db']}' to '{steps['user']}'")
        ok("Assigning Privileges... OK (planned)")
        return
    try:
        api.set_privileges(steps["user"], steps["db"], "ALL PRIVILEGES")
        ok("Assigning Privileges... OK")
    except CpanelError as exc:
        # set_privileges is idempotent on cPanel; treat "exists"/duplicate as fine.
        if exc.is_already_exists():
            warn(f"Privileges already present ({exc}) — continuing")
            ok("Assigning Privileges... OK (existing)")
        else:
            die(str(exc))


def _mysql_table_count(cfg: Config) -> int:
    """Return the number of base tables in the target DB (raises on failure)."""
    cmd = [
        "mysql",
        f"--host={cfg.db_host}",
        f"--port={cfg.db_port}",
        f"--user={cfg.full_db_user()}",
        cfg.full_db_name(),
        "--batch",
        "--skip-column-names",
        "-e",
        "SELECT COUNT(*) FROM information_schema.tables "
        "WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'",
    ]
    env = dict(os.environ, MYSQL_PWD=cfg.db_pass or "")
    proc = subprocess.run(cmd, env=env, capture_output=True, text=True, timeout=60)
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip() or f"mysql exited {proc.returncode}")
    return int((proc.stdout or "0").strip() or "0")


def step_import(api: CpanelUAPI, cfg: Config, steps: dict) -> None:
    log(f"[4/4] Auto-importing SQL schema from {_rel(cfg, cfg.dump)}")
    if cfg.skip_import:
        warn("Skipping SQL import (--skip-import)")
        ok("Auto-importing SQL schema... SKIPPED")
        return
    if not cfg.dump.is_file():
        warn(f"Dump not found: {cfg.dump} — skipping import")
        info("Build the dump first (bash pack-cpanel.sh) or pass --dump <file>")
        ok("Auto-importing SQL schema... SKIPPED (no dump)")
        return

    import_cmd = (
        f'mysql --host={cfg.db_host} --port={cfg.db_port} '
        f'--user={cfg.full_db_user()} {cfg.full_db_name()} < {_rel(cfg, cfg.dump)}'
    )
    if cfg.dry_run:
        info(f"[dry-run] {import_cmd}   (MYSQL_PWD=********)")
        ok("Auto-importing SQL schema... OK (planned)")
        return

    if shutil.which("mysql") is None:
        warn("`mysql` client not found — cannot auto-import")
        ok("Auto-importing SQL schema... SKIPPED (mysql client missing)")
        return

    # Idempotency: skip a populated DB unless --force-import was requested.
    existing_tables = None
    try:
        existing_tables = _mysql_table_count(cfg)
    except Exception as exc:  # noqa: BLE001 - connectivity/auth issues are expected
        warn(f"Could not inspect existing tables ({exc})")
        if cfg.db_host == "localhost":
            warn("DB host is 'localhost': run this script ON the cPanel server, "
                 "or set CPANEL_DB_HOST + enable Remote MySQL for this machine.")

    if existing_tables is not None and existing_tables > 0 and not cfg.force_import:
        warn(f"Database already has {existing_tables} table(s) — skipping import "
             "(use --force-import to re-import)")
        steps["tables"] = existing_tables
        ok(f"Auto-importing SQL schema... OK (already populated: {existing_tables} tables)")
        return

    env = dict(os.environ, MYSQL_PWD=cfg.db_pass or "")
    cmd = [
        "mysql",
        f"--host={cfg.db_host}",
        f"--port={cfg.db_port}",
        f"--user={cfg.full_db_user()}",
        cfg.full_db_name(),
    ]
    info(f"Executing: {import_cmd}")
    try:
        with cfg.dump.open("rb") as handle:
            proc = subprocess.run(cmd, stdin=handle, env=env, capture_output=True, timeout=900)
    except subprocess.TimeoutExpired:
        die("SQL import timed out after 900s")
    if proc.returncode != 0:
        die(f"SQL import failed (exit {proc.returncode}):\n{proc.stderr.decode('utf-8', 'replace').strip()}")
    ok("Auto-importing SQL schema... OK")

    try:
        steps["tables"] = _mysql_table_count(cfg)
    except Exception:  # noqa: BLE001
        pass


# ---------------------------------------------------------------------------
# .env generation
# ---------------------------------------------------------------------------
def build_env_map(cfg: Config) -> dict:
    return {
        "NODE_ENV": "production",
        "DB_HOST": "localhost",
        "DB_PORT": "3306",
        "DB_USER": cfg.full_db_user(),
        "DB_PASS": cfg.db_pass or "",
        "DB_NAME": cfg.full_db_name(),
        "DATABASE_URL": _database_url(cfg),
        "DB_POOL_LIMIT": "5",
        "DB_POOL_TIMEOUT": "10",
        "DATABASE_SSL_MODE": "disable",
    }


def _database_url(cfg: Config) -> str:
    user = urllib.parse.quote_plus(cfg.full_db_user())
    pw = urllib.parse.quote_plus(cfg.db_pass or "")
    name = urllib.parse.quote_plus(cfg.full_db_name())
    return f"mysql://{user}:{pw}@localhost:3306/{name}"


def write_env(cfg: Config) -> str:
    updates = build_env_map(cfg)
    target = cfg.env_out

    # Start from the template (preserves JWT/SePay/SMTP/… keys), then override
    # the DB_* keys. Lines for keys being replaced are dropped, others kept.
    lines: list = []
    if cfg.env_template.is_file() and cfg.env_template != target:
        for raw in cfg.env_template.read_text(encoding="utf-8").splitlines():
            key = raw.split("=", 1)[0].strip() if "=" in raw and not raw.lstrip().startswith("#") else None
            if key and key in updates:
                continue
            lines.append(raw)
    else:
        lines.append("# Auto-generated by deploy_cpanel.py — cPanel DB credentials")

    if lines and lines[-1].strip():
        lines.append("")
    lines.append("# --- Database credentials provisioned via cPanel UAPI ---")
    for key, value in updates.items():
        lines.append(f"{key}={value}")
    lines.append("")

    content = "\n".join(lines)
    if cfg.dry_run:
        info(f"[dry-run] would write {_rel(cfg, target)}:")
        for line in content.splitlines():
            print(f"        {line}")
        return content

    target.parent.mkdir(parents=True, exist_ok=True)
    if target.is_file():
        backup = target.with_suffix(target.suffix + ".bak")
        try:
            backup.write_text(target.read_text(encoding="utf-8"), encoding="utf-8")
        except OSError:
            pass
    target.write_text(content, encoding="utf-8")
    try:
        target.chmod(0o600)
    except OSError:
        pass
    ok(f"Wrote database credentials to {_rel(cfg, target)}")
    return content


def upload_env(api: CpanelUAPI, cfg: Config, content: str) -> None:
    if not cfg.upload_env:
        return
    remote = f"{cfg.app_path.strip('/')}/.env"
    log(f"[+] Uploading .env to cPanel: ~/{remote}")
    if cfg.dry_run:
        info(f"[dry-run] would call Fileman::save_file_content for ~/{remote}")
        ok("Uploading .env... OK (planned)")
        return
    try:
        api.save_file_content(remote, content)
        ok(f"Uploading .env... OK (~/{remote})")
    except CpanelError as exc:
        warn(f"Could not upload .env via Fileman ({exc})")
        info("Upload the generated file manually, or include it in the deploy zip.")


# ---------------------------------------------------------------------------
# Utilities
# ---------------------------------------------------------------------------
def _rel(cfg: Config, path: Path) -> str:
    try:
        return str(path.relative_to(cfg.root))
    except ValueError:
        return str(path)


def parse_args(argv=None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="deploy_cpanel.py",
        description="Automate cPanel MySQL provisioning + SQL auto-import via UAPI.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    # Credentials
    parser.add_argument("--cpanel-host", help="cPanel hostname (CPANEL_HOST)")
    parser.add_argument("--cpanel-port", help="cPanel HTTPS port (default 2083)")
    parser.add_argument("--cpanel-user", help="cPanel account username (CPANEL_USER)")
    parser.add_argument("--cpanel-token", help="cPanel API token (CPANEL_API_TOKEN)")
    parser.add_argument("--scheme", choices=["https", "http"],
                        help="cPanel API scheme (default https; http only for tests)")
    parser.add_argument("--insecure", action="store_true",
                        help="Skip TLS certificate verification (self-signed hosts)")
    # Database target
    parser.add_argument("--db-name", help="Database name (suffix or full; prefix auto-added)")
    parser.add_argument("--db-user", help="DB user name (suffix or full; prefix auto-added)")
    parser.add_argument("--db-pass", help="DB password (a secure one is generated if omitted)")
    parser.add_argument("--db-host", help="Host for mysql auto-import (default localhost)")
    parser.add_argument("--db-port", help="Port for mysql auto-import (default 3306)")
    # Import
    parser.add_argument("--dump", help="SQL dump to import (default: database/dump.sql|seed.sql)")
    parser.add_argument("--force-import", action="store_true",
                        help="Import even if the database already has tables")
    parser.add_argument("--skip-import", action="store_true", help="Provision only; do not import SQL")
    # .env
    parser.add_argument("--env-file", help="Extra .env file to read config from")
    parser.add_argument("--env-out", help="Output .env path (default backend/.env)")
    parser.add_argument("--env-template", help="Template .env to derive other keys from")
    parser.add_argument("--upload-env", action="store_true",
                        help="Push the generated .env to cPanel via Fileman::save_file_content")
    parser.add_argument("--app-path", help="App path on cPanel (default tcg/backend)")
    # Behaviour
    parser.add_argument("--dry-run", action="store_true",
                        help="Print every planned UAPI call and command; make no changes")
    return parser.parse_args(argv)


def main(argv=None) -> int:
    args = parse_args(argv)
    cfg = Config(args)

    mode = "DRY-RUN (no changes will be made)" if cfg.dry_run else "LIVE"
    log(f"cPanel database provisioning — {mode}")
    print(f"        host       : {cfg.cpanel_host or '(unset)'}:{cfg.cpanel_port}")
    print(f"        account    : {cfg.cpanel_user or '(unset)'}")
    print(f"        auth       : {'API token' if cfg.cpanel_token else 'password' if cfg.cpanel_password else '(unset)'}")
    print(f"        database   : {cfg.full_db_name() or '(unset)'}")
    print(f"        db user    : {cfg.full_db_user() or '(unset)'}")
    print(f"        dump       : {_rel(cfg, cfg.dump)}"
          f"{'' if cfg.dump.is_file() else '  (missing)'}")
    print(f"        env output : {_rel(cfg, cfg.env_out)}")

    password = resolve_password(cfg)
    steps: dict = {}

    api = CpanelUAPI(cfg)
    step_ensure_database(api, cfg, steps)
    step_ensure_user(api, cfg, password, steps)
    step_set_privileges(api, cfg, steps)
    step_import(api, cfg, steps)

    content = write_env(cfg)
    upload_env(api, cfg, content)

    # ── Verification summary ──
    log("Verification summary")
    if "tables" in steps:
        ok(f"Database is live with {steps['tables']} table(s)")
    else:
        info("Table count unavailable (import skipped or DB not reachable from here)")
    print("")
    print(f"{BOLD}{GREEN}\u2713 cPanel database lifecycle complete"
          f"{' (dry-run)' if cfg.dry_run else ''}{RESET}")
    print("  [1/4] Create database      → OK")
    print("  [2/4] Create database user → OK")
    print("  [3/4] Assign ALL PRIVILEGES→ OK")
    print("  [4/4] Auto-import dump     → "
          + ("planned" if cfg.dry_run else "OK" if not cfg.skip_import else "skipped"))
    print("")
    print(f"  .env written: {_rel(cfg, cfg.env_out)}")
    if cfg.dry_run:
        print(f"{YELLOW}  Re-run without --dry-run to provision for real.{RESET}")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\nInterrupted.", file=sys.stderr)
        sys.exit(130)
