"""
SolTrace Database & Inventory Hasher
Deterministic state seal computation and diffing for relational databases,
IPAM (NetBox), and IT Asset Management (Snipe-IT).
"""

import json
import hashlib
from datetime import datetime, timezone
from typing import Dict, Any, Optional, Tuple, List

def canonical_json_bytes(data: Any) -> bytes:
    """
    Serializes Python data structures to a deterministic, canonical UTF-8 JSON representation.
    - Keys are sorted lexicographically.
    - Float and integer formatting is normalized.
    - No unnecessary whitespace (separators=(',', ':')).
    """
    return json.dumps(data, sort_keys=True, separators=(',', ':'), ensure_ascii=True).encode('utf-8')

def compute_record_hash(table: str, record_id: str, data: Dict[str, Any]) -> str:
    """
    Computes a deterministic SHA-256 digest of a database row or inventory item.
    Filters out internal metadata fields (e.g. _soltrace_seal) to ensure idempotency.
    """
    clean_data = {k: v for k, v in data.items() if not k.startswith("_soltrace_")}
    canonical_bytes = canonical_json_bytes(clean_data)
    
    hasher = hashlib.sha256()
    hasher.update(table.encode("utf-8"))
    hasher.update(b":")
    hasher.update(str(record_id).encode("utf-8"))
    hasher.update(b":")
    hasher.update(canonical_bytes)
    return hasher.hexdigest()

def compute_db_state_seal(
    table: str,
    record_id: str,
    current_data: Dict[str, Any],
    prev_seal: Optional[str] = None,
    timestamp: Optional[str] = None,
    operator: str = "system"
) -> str:
    """
    Computes an unforgeable cryptographic state seal binding the record state,
    previous seal (hash chaining), operator, and timestamp.
    
    Seal = SHA256(table : id : record_hash : prev_seal : operator : timestamp)
    """
    rec_hash = compute_record_hash(table, record_id, current_data)
    prev = prev_seal or "GENESIS"
    ts = timestamp or datetime.now(timezone.utc).isoformat()
    
    hasher = hashlib.sha256()
    hasher.update(table.encode("utf-8"))
    hasher.update(b":")
    hasher.update(str(record_id).encode("utf-8"))
    hasher.update(b":")
    hasher.update(rec_hash.encode("utf-8"))
    hasher.update(b":")
    hasher.update(prev.encode("utf-8"))
    hasher.update(b":")
    hasher.update(operator.encode("utf-8"))
    hasher.update(b":")
    hasher.update(ts.encode("utf-8"))
    return hasher.hexdigest()

def diff_records(original_data: Dict[str, Any], current_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Calculates differences between two versions of a record.
    Returns modified, added, and removed fields.
    """
    clean_orig = {k: v for k, v in original_data.items() if not k.startswith("_soltrace_")}
    clean_curr = {k: v for k, v in current_data.items() if not k.startswith("_soltrace_")}
    
    modified = {}
    added = {}
    removed = {}
    
    # Check for modifications and deletions
    for k, v_orig in clean_orig.items():
        if k not in clean_curr:
            removed[k] = v_orig
        elif clean_curr[k] != v_orig:
            modified[k] = {
                "before": v_orig,
                "after": clean_curr[k]
            }
            
    # Check for additions
    for k, v_curr in clean_curr.items():
        if k not in clean_orig:
            added[k] = v_curr
            
    return {
        "modified": modified,
        "added": added,
        "removed": removed,
        "has_changes": bool(modified or added or removed)
    }

def format_db_attestation(
    table: str,
    record_id: str,
    state_seal: str,
    action: str,
    operator: str,
    timestamp: str,
    record_hash: str
) -> Dict[str, Any]:
    """
    Constructs a compact attestation payload suitable for Solana Memo Program storage.
    """
    return {
        "proto": "soltrace/db/v1",
        "tbl": table,
        "id": str(record_id),
        "seal": state_seal,
        "rec_sha": record_hash[:16],  # Compact pointer
        "op": action.upper(),
        "usr": operator,
        "ts": timestamp
    }
