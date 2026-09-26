"""
SolTrace Local Registry & State Store
Maintains a local verifiable index of anchored database records, their Solana transaction signatures,
and historical state transitions.
"""

import os
import json
import sqlite3
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List

DEFAULT_DB_PATH = ".soltrace/ledger.db"

class SolTraceLedger:
    """SQLite-backed local ledger index for fast query, history tracking, and tamper verification."""
    
    def __init__(self, db_path: str = DEFAULT_DB_PATH):
        self.db_path = db_path
        os.makedirs(os.path.dirname(os.path.abspath(self.db_path)), exist_ok=True)
        self._init_db()

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        with self._get_connection() as conn:
            conn.execute("""
            CREATE TABLE IF NOT EXISTS records (
                table_name TEXT NOT NULL,
                record_id TEXT NOT NULL,
                current_seal TEXT NOT NULL,
                record_hash TEXT NOT NULL,
                data_json TEXT NOT NULL,
                last_signature TEXT NOT NULL,
                last_updated TEXT NOT NULL,
                operator TEXT NOT NULL,
                PRIMARY KEY (table_name, record_id)
            )
            """)
            
            conn.execute("""
            CREATE TABLE IF NOT EXISTS audit_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                table_name TEXT NOT NULL,
                record_id TEXT NOT NULL,
                action TEXT NOT NULL,
                state_seal TEXT NOT NULL,
                prev_seal TEXT,
                record_hash TEXT NOT NULL,
                data_json TEXT NOT NULL,
                signature TEXT NOT NULL,
                network TEXT NOT NULL,
                explorer_url TEXT,
                operator TEXT NOT NULL,
                timestamp TEXT NOT NULL
            )
            """)
            conn.commit()

    def get_latest_record(self, table_name: str, record_id: str) -> Optional[Dict[str, Any]]:
        with self._get_connection() as conn:
            cursor = conn.execute(
                "SELECT * FROM records WHERE table_name = ? AND record_id = ?",
                (table_name, str(record_id))
            )
            row = cursor.fetchone()
            if not row:
                return None
            res = dict(row)
            res["data"] = json.loads(res["data_json"])
            return res

    def save_attestation(
        self,
        table_name: str,
        record_id: str,
        action: str,
        state_seal: str,
        record_hash: str,
        data: Dict[str, Any],
        signature: str,
        network: str,
        explorer_url: str,
        operator: str,
        timestamp: str,
        prev_seal: Optional[str] = None
    ):
        data_json = json.dumps(data, sort_keys=True)
        rec_id_str = str(record_id)
        
        with self._get_connection() as conn:
            # Insert audit history event
            conn.execute("""
            INSERT INTO audit_events (
                table_name, record_id, action, state_seal, prev_seal, record_hash,
                data_json, signature, network, explorer_url, operator, timestamp
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                table_name, rec_id_str, action.upper(), state_seal, prev_seal, record_hash,
                data_json, signature, network, explorer_url, operator, timestamp
            ))
            
            # Upsert current record pointer
            conn.execute("""
            INSERT INTO records (
                table_name, record_id, current_seal, record_hash, data_json,
                last_signature, last_updated, operator
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(table_name, record_id) DO UPDATE SET
                current_seal = excluded.current_seal,
                record_hash = excluded.record_hash,
                data_json = excluded.data_json,
                last_signature = excluded.last_signature,
                last_updated = excluded.last_updated,
                operator = excluded.operator
            """, (
                table_name, rec_id_str, state_seal, record_hash, data_json,
                signature, timestamp, operator
            ))
            conn.commit()

    def get_history(self, table_name: str, record_id: str) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            cursor = conn.execute("""
            SELECT * FROM audit_events
            WHERE table_name = ? AND record_id = ?
            ORDER BY id ASC
            """, (table_name, str(record_id)))
            
            rows = cursor.fetchall()
            history = []
            for r in rows:
                item = dict(r)
                item["data"] = json.loads(item["data_json"])
                history.append(item)
            return history
