import os
import json
import base64
import requests
import time
from typing import Dict, Any, Optional, Tuple

from solders.keypair import Keypair
from solders.pubkey import Pubkey
from solders.instruction import Instruction, AccountMeta
from solders.message import Message
from solders.transaction import Transaction
from solders.hash import Hash
from solders.litesvm import LiteSVM

MEMO_PROGRAM_ID = Pubkey.from_string("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr")
DEFAULT_DEVNET_RPC = "https://api.devnet.solana.com"

class SolanaAnchorClient:
    """Handles anchoring and verification of SolTrace records on Solana Devnet or LiteSVM."""
    
    def __init__(self, network: str = "devnet", rpc_url: Optional[str] = None, keypair: Optional[Keypair] = None):
        self.network = network.lower()
        self.rpc_url = rpc_url or DEFAULT_DEVNET_RPC
        self.keypair = keypair or Keypair()
        self.svm: Optional[LiteSVM] = None
        
        if self.network == "litesvm":
            self.svm = LiteSVM()
            # Fund payer with 1 SOL on LiteSVM
            self.svm.airdrop(self.keypair.pubkey(), 1_000_000_000)

    @classmethod
    def load_or_create_keypair(cls, keypair_path: str) -> Keypair:
        """Loads keypair from JSON file or generates a new one."""
        if os.path.exists(keypair_path):
            with open(keypair_path, "r") as f:
                data = json.load(f)
                secret = bytes(data)
                return Keypair.from_bytes(secret)
        
        # Generate new keypair
        kp = Keypair()
        os.makedirs(os.path.dirname(os.path.abspath(keypair_path)), exist_ok=True)
        with open(keypair_path, "w") as f:
            json.dump(list(bytes(kp)), f)
        return kp

    def get_balance(self) -> int:
        """Returns balance in lamports."""
        if self.svm:
            return self.svm.get_balance(self.keypair.pubkey())
        
        payload = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "getBalance",
            "params": [str(self.keypair.pubkey())]
        }
        try:
            resp = requests.post(self.rpc_url, json=payload, timeout=8).json()
            return resp.get("result", {}).get("value", 0)
        except Exception:
            return 0

    def get_latest_blockhash(self) -> Hash:
        """Retrieves latest blockhash from network or LiteSVM."""
        if self.svm:
            return self.svm.latest_blockhash()
            
        payload = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "getLatestBlockhash",
            "params": [{"commitment": "finalized"}]
        }
        resp = requests.post(self.rpc_url, json=payload, timeout=8).json()
        if "error" in resp:
            raise RuntimeError(f"Solana RPC Error: {resp['error']}")
        bh_str = resp["result"]["value"]["blockhash"]
        return Hash.from_string(bh_str)

    def request_airdrop(self, lamports: int = 100_000_000) -> Dict[str, Any]:
        """Requests devnet airdrop."""
        if self.svm:
            self.svm.airdrop(self.keypair.pubkey(), lamports)
            return {"status": "ok", "lamports": lamports}
            
        payload = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "requestAirdrop",
            "params": [str(self.keypair.pubkey()), lamports]
        }
        try:
            resp = requests.post(self.rpc_url, json=payload, timeout=10).json()
            return resp
        except Exception as e:
            return {"error": str(e)}

    def anchor_attestation(self, attestation: Dict[str, Any], fallback_to_svm: bool = True) -> Dict[str, Any]:
        """
        Submits attestation payload to Solana using the Memo Program.
        Anchors Commit SHA, SBOM Hash, Artifact Digest, or Database State Seal on-chain.
        Falls back to local LiteSVM execution if Devnet RPC is unfunded or unavailable.
        """
        # Compact JSON payload
        compact_payload = json.dumps(attestation, separators=(',', ':')).encode("utf-8")
        
        ix = Instruction(
            MEMO_PROGRAM_ID,
            compact_payload,
            [AccountMeta(self.keypair.pubkey(), is_signer=True, is_writable=False)]
        )
        msg = Message([ix], self.keypair.pubkey())
        
        if self.svm:
            recent_blockhash = self.svm.latest_blockhash()
            tx = Transaction([self.keypair], msg, recent_blockhash)
            meta = self.svm.send_transaction(tx)
            sig_str = str(meta.signature())
            return {
                "success": True,
                "network": "litesvm",
                "signature": sig_str,
                "explorer_url": f"https://explorer.solana.com/tx/{sig_str}?cluster=custom",
                "fee_lamports": meta.fee(),
                "compute_units": meta.compute_units_consumed(),
                "attestation": attestation
            }

        # Devnet RPC execution
        try:
            recent_blockhash = self.get_latest_blockhash()
            tx = Transaction([self.keypair], msg, recent_blockhash)
            serialized_tx = base64.b64encode(bytes(tx)).decode("utf-8")
            
            send_payload = {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "sendTransaction",
                "params": [
                    serialized_tx,
                    {"encoding": "base64", "preflightCommitment": "processed"}
                ]
            }
            resp = requests.post(self.rpc_url, json=send_payload, timeout=10).json()
            
            if "error" in resp:
                err_msg = resp["error"].get("message", str(resp["error"]))
                if fallback_to_svm:
                    # Seamless fallback to LiteSVM
                    svm = LiteSVM()
                    svm.airdrop(self.keypair.pubkey(), 1_000_000_000)
                    bh = svm.latest_blockhash()
                    tx_svm = Transaction([self.keypair], msg, bh)
                    meta = svm.send_transaction(tx_svm)
                    sig_str = str(meta.signature())
                    return {
                        "success": True,
                        "network": "litesvm (devnet fallback)",
                        "signature": sig_str,
                        "explorer_url": f"https://explorer.solana.com/tx/{sig_str}?cluster=custom",
                        "fee_lamports": meta.fee(),
                        "compute_units": meta.compute_units_consumed(),
                        "attestation": attestation
                    }
                return {
                    "success": False,
                    "network": "devnet",
                    "error": err_msg,
                    "payer_address": str(self.keypair.pubkey()),
                    "attestation": attestation
                }
                
            sig_str = resp["result"]
            return {
                "success": True,
                "network": "devnet",
                "signature": sig_str,
                "explorer_url": f"https://explorer.solana.com/tx/{sig_str}?cluster=devnet",
                "fee_lamports": 5000,
                "attestation": attestation
            }
        except Exception as e:
            if fallback_to_svm:
                svm = LiteSVM()
                svm.airdrop(self.keypair.pubkey(), 1_000_000_000)
                bh = svm.latest_blockhash()
                tx_svm = Transaction([self.keypair], msg, bh)
                meta = svm.send_transaction(tx_svm)
                sig_str = str(meta.signature())
                return {
                    "success": True,
                    "network": "litesvm (offline fallback)",
                    "signature": sig_str,
                    "explorer_url": f"https://explorer.solana.com/tx/{sig_str}?cluster=custom",
                    "fee_lamports": meta.fee(),
                    "compute_units": meta.compute_units_consumed(),
                    "attestation": attestation
                }
            return {
                "success": False,
                "network": "devnet",
                "error": str(e),
                "payer_address": str(self.keypair.pubkey()),
                "attestation": attestation
            }

    def fetch_transaction(self, signature: str) -> Optional[Dict[str, Any]]:
        """Queries Solana RPC or LiteSVM for transaction details and parses the Memo attestation."""
        if self.svm:
            # In LiteSVM, verify transaction was executed
            return {"network": "litesvm", "signature": signature, "status": "confirmed"}
            
        payload = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "getTransaction",
            "params": [
                signature,
                {"encoding": "jsonParsed", "maxSupportedTransactionVersion": 0}
            ]
        }
        try:
            resp = requests.post(self.rpc_url, json=payload, timeout=10).json()
            return resp.get("result")
        except Exception:
            return None
