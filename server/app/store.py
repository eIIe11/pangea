"""SQLite persistence for users, passkeys and TOTP secrets.

One file, no ORM: the whole dataset is a handful of rows for a single operator, and a
schema this small is easier to audit than a migration stack.
"""

import base64
import sqlite3
import time
from dataclasses import dataclass
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    display_name  TEXT NOT NULL,
    totp_secret   TEXT,
    totp_verified INTEGER NOT NULL DEFAULT 0,
    created_at    INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS credentials (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id),
    public_key TEXT NOT NULL,
    sign_count INTEGER NOT NULL,
    label      TEXT NOT NULL,
    created_at INTEGER NOT NULL
);
"""


@dataclass(frozen=True)
class User:
    id: str
    display_name: str
    totp_secret: str | None
    totp_verified: bool


@dataclass(frozen=True)
class Credential:
    id: bytes
    user_id: str
    public_key: bytes
    sign_count: int
    label: str


def _b64(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode().rstrip('=')


def _unb64(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + '=' * (-len(value) % 4))


class Store:
    def __init__(self, path: Path | str) -> None:
        self._db = sqlite3.connect(path, check_same_thread=False)
        self._db.row_factory = sqlite3.Row
        self._db.executescript(SCHEMA)
        self._db.commit()

    def close(self) -> None:
        self._db.close()

    def user_count(self) -> int:
        return int(self._db.execute('SELECT count(*) AS n FROM users').fetchone()['n'])

    def upsert_user(self, user_id: str, display_name: str) -> User:
        self._db.execute(
            'INSERT INTO users (id, display_name, created_at) VALUES (?, ?, ?)'
            ' ON CONFLICT(id) DO UPDATE SET display_name = excluded.display_name',
            (user_id, display_name, int(time.time())),
        )
        self._db.commit()
        user = self.user(user_id)
        assert user is not None
        return user

    def user(self, user_id: str) -> User | None:
        row = self._db.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()
        if row is None:
            return None
        return User(
            id=row['id'],
            display_name=row['display_name'],
            totp_secret=row['totp_secret'],
            totp_verified=bool(row['totp_verified']),
        )

    def set_totp_secret(self, user_id: str, secret: str) -> None:
        self._db.execute(
            'UPDATE users SET totp_secret = ?, totp_verified = 0 WHERE id = ?', (secret, user_id)
        )
        self._db.commit()

    def mark_totp_verified(self, user_id: str) -> None:
        self._db.execute('UPDATE users SET totp_verified = 1 WHERE id = ?', (user_id,))
        self._db.commit()

    def add_credential(self, credential: Credential) -> None:
        self._db.execute(
            'INSERT INTO credentials (id, user_id, public_key, sign_count, label, created_at)'
            ' VALUES (?, ?, ?, ?, ?, ?)',
            (
                _b64(credential.id),
                credential.user_id,
                _b64(credential.public_key),
                credential.sign_count,
                credential.label,
                int(time.time()),
            ),
        )
        self._db.commit()

    def credentials(self, user_id: str) -> list[Credential]:
        rows = self._db.execute(
            'SELECT * FROM credentials WHERE user_id = ?', (user_id,)
        ).fetchall()
        return [
            Credential(
                id=_unb64(row['id']),
                user_id=row['user_id'],
                public_key=_unb64(row['public_key']),
                sign_count=row['sign_count'],
                label=row['label'],
            )
            for row in rows
        ]

    def credential(self, credential_id: bytes) -> Credential | None:
        row = self._db.execute(
            'SELECT * FROM credentials WHERE id = ?', (_b64(credential_id),)
        ).fetchone()
        if row is None:
            return None
        return Credential(
            id=_unb64(row['id']),
            user_id=row['user_id'],
            public_key=_unb64(row['public_key']),
            sign_count=row['sign_count'],
            label=row['label'],
        )

    def bump_sign_count(self, credential_id: bytes, sign_count: int) -> None:
        self._db.execute(
            'UPDATE credentials SET sign_count = ? WHERE id = ?', (sign_count, _b64(credential_id))
        )
        self._db.commit()
