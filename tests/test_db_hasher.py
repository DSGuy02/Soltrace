import pytest
from soltrace.db_hasher import (
    canonical_json_bytes,
    compute_record_hash,
    compute_db_state_seal,
    diff_records,
    format_db_attestation
)

def test_canonical_json_bytes_ordering():
    # Order of keys in Python dictionaries should not affect canonical representation
    d1 = {"b": 2, "a": 1, "c": [3, 2, 1]}
    d2 = {"a": 1, "c": [3, 2, 1], "b": 2}
    assert canonical_json_bytes(d1) == canonical_json_bytes(d2)

def test_compute_record_hash_stability():
    table = "assets"
    rec_id = "SRV-001"
    data1 = {"hostname": "node-1.ie.dc", "ip": "10.0.1.5", "cores": 64}
    data2 = {"cores": 64, "ip": "10.0.1.5", "hostname": "node-1.ie.dc"}
    
    hash1 = compute_record_hash(table, rec_id, data1)
    hash2 = compute_record_hash(table, rec_id, data2)
    assert hash1 == hash2
    assert len(hash1) == 64  # SHA-256 hex string

def test_compute_record_hash_sensitivity():
    table = "assets"
    rec_id = "SRV-001"
    data1 = {"hostname": "node-1.ie.dc", "ip": "10.0.1.5"}
    data2 = {"hostname": "node-1.ie.dc", "ip": "10.0.1.6"} # changed IP
    
    hash1 = compute_record_hash(table, rec_id, data1)
    hash2 = compute_record_hash(table, rec_id, data2)
    assert hash1 != hash2

def test_state_seal_chaining():
    table = "ipam"
    rec_id = "SUBNET-10"
    data = {"cidr": "10.240.0.0/16", "vlan": 100}
    
    seal1 = compute_db_state_seal(table, rec_id, data, prev_seal="GENESIS", timestamp="2026-09-26T12:00:00Z", operator="deji")
    seal2 = compute_db_state_seal(table, rec_id, data, prev_seal=seal1, timestamp="2026-09-26T13:00:00Z", operator="deji")
    
    assert seal1 != seal2
    assert len(seal1) == 64
    assert len(seal2) == 64

def test_diff_records():
    original = {
        "status": "active",
        "ip": "10.0.0.1",
        "owner": "eng-team",
        "decommissioned": False
    }
    tampered = {
        "status": "decommissioned", # modified
        "ip": "10.0.0.1",
        "decommissioned": True,     # modified
        "backdoor_user": "rogue"    # added
        # 'owner' removed
    }
    
    diff = diff_records(original, tampered)
    assert diff["has_changes"] is True
    assert "status" in diff["modified"]
    assert diff["modified"]["status"]["before"] == "active"
    assert diff["modified"]["status"]["after"] == "decommissioned"
    assert "backdoor_user" in diff["added"]
    assert "owner" in diff["removed"]

def test_format_db_attestation():
    att = format_db_attestation(
        table="dcim_device",
        record_id="SRV-99",
        state_seal="a"*64,
        action="CREATE",
        operator="admin",
        timestamp="2026-09-26T12:00:00Z",
        record_hash="b"*64
    )
    assert att["proto"] == "soltrace/db/v1"
    assert att["tbl"] == "dcim_device"
    assert att["id"] == "SRV-99"
    assert att["seal"] == "a"*64
    assert att["rec_sha"] == "b"*16
