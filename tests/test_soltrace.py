import os
import sys
import tempfile
import unittest
import json

# Add project root to sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from soltrace.hasher import (
    compute_sbom_hash,
    compute_artifact_hash,
    compute_state_seal,
    get_git_metadata
)
from soltrace.chain import (
    SolanaAnchorClient
)

class TestSolTrace(unittest.TestCase):

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.test_file = os.path.join(self.temp_dir.name, "release.bin")
        with open(self.test_file, "wb") as f:
            f.write(b"Production Container Artifact Payload v1.0.0")

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_artifact_hashing(self):
        h1 = compute_artifact_hash(self.test_file)
        self.assertEqual(len(h1), 64)
        # Verify determinism
        h2 = compute_artifact_hash(self.test_file)
        self.assertEqual(h1, h2)

    def test_sbom_manifest_detection(self):
        # Create dummy requirements.txt
        req_path = os.path.join(self.temp_dir.name, "requirements.txt")
        with open(req_path, "w") as f:
            f.write("solders==0.21.0\nsolana==0.35.0\n")
            
        sbom = compute_sbom_hash(self.temp_dir.name)
        self.assertEqual(len(sbom["sbom_digest"]), 64)
        self.assertTrue(any(m["manifest"] == "requirements.txt" for m in sbom["manifests"]))

    def test_state_seal_integrity(self):
        commit = "7f83b1652479f40268a1fed315e5a901"
        sbom = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        artifact = compute_artifact_hash(self.test_file)
        ts = "2026-09-25T12:00:00Z"
        
        seal = compute_state_seal(commit, sbom, artifact, ts)
        self.assertEqual(len(seal), 64)
        
        # Verify any change breaks the seal
        corrupted_seal = compute_state_seal("corrupted_commit", sbom, artifact, ts)
        self.assertNotEqual(seal, corrupted_seal)

    def test_solana_litesvm_onchain_anchor(self):
        client = SolanaAnchorClient(network="litesvm")
        attestation = {
            "protocol": "soltrace/v1",
            "commit": "test-commit-sha",
            "artifact_digest": compute_artifact_hash(self.test_file),
            "state_seal": "test-seal-12345"
        }
        res = client.anchor_attestation(attestation)
        self.assertTrue(res["success"])
        self.assertEqual(res["network"], "litesvm")
        self.assertTrue(len(res["signature"]) > 40)
        self.assertEqual(res["fee_lamports"], 5000)

    def test_tamper_detection(self):
        # Original hash
        original_digest = compute_artifact_hash(self.test_file)
        
        # Tamper by changing 1 byte
        with open(self.test_file, "wb") as f:
            f.write(b"Production Container Artifact Payload v1.0.0 (MODIFIED BY INTRUDER)")
            
        tampered_digest = compute_artifact_hash(self.test_file)
        self.assertNotEqual(original_digest, tampered_digest)

if __name__ == "__main__":
    unittest.main()
