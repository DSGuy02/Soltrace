import os
import hashlib
import subprocess
import json
from typing import Dict, Any, Optional, List

def get_git_metadata(repo_path: str = ".") -> Dict[str, str]:
    """Extracts git commit metadata if within a git repository."""
    meta = {
        "commit": "unknown",
        "branch": "unknown",
        "author": "unknown",
        "tree": "unknown",
        "clean": "true"
    }
    try:
        commit = subprocess.check_output(
            ["git", "rev-parse", "HEAD"], cwd=repo_path, stderr=subprocess.DEVNULL
        ).decode().strip()
        branch = subprocess.check_output(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"], cwd=repo_path, stderr=subprocess.DEVNULL
        ).decode().strip()
        author = subprocess.check_output(
            ["git", "log", "-1", "--format=%an <%ae>"], cwd=repo_path, stderr=subprocess.DEVNULL
        ).decode().strip()
        tree = subprocess.check_output(
            ["git", "rev-parse", "HEAD^{tree}"], cwd=repo_path, stderr=subprocess.DEVNULL
        ).decode().strip()
        status = subprocess.check_output(
            ["git", "status", "--porcelain"], cwd=repo_path, stderr=subprocess.DEVNULL
        ).decode().strip()
        
        meta["commit"] = commit
        meta["branch"] = branch
        meta["author"] = author
        meta["tree"] = tree
        meta["clean"] = "true" if not status else "false"
    except Exception:
        # Fallback if git is not initialized or in CI detached head
        pass
    return meta

def hash_file(filepath: str) -> str:
    """Computes SHA-256 hash of a single file."""
    sha = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            sha.update(chunk)
    return sha.hexdigest()

def compute_artifact_hash(artifact_path: str) -> str:
    """Computes deterministic SHA-256 digest of an artifact file or directory."""
    if not os.path.exists(artifact_path):
        raise FileNotFoundError(f"Artifact path not found: {artifact_path}")
    
    if os.path.isfile(artifact_path):
        return hash_file(artifact_path)
    
    # If directory, compute sorted composite hash
    sha = hashlib.sha256()
    for root, dirs, files in sorted(os.walk(artifact_path)):
        # Skip .git and hidden folders
        dirs[:] = [d for d in dirs if not d.startswith(".")]
        for file in sorted(files):
            if file.startswith("."):
                continue
            full_path = os.path.join(root, file)
            rel_path = os.path.relpath(full_path, artifact_path)
            sha.update(rel_path.encode("utf-8"))
            with open(full_path, "rb") as f:
                while chunk := f.read(65536):
                    sha.update(chunk)
    return sha.hexdigest()

def compute_sbom_hash(project_path: str = ".") -> Dict[str, Any]:
    """
    Scans project dependency manifests to construct a deterministic Software Bill of Materials (SBOM) hash.
    Supports Python (requirements.txt, pyproject.toml, Pipfile), Node.js (package.json, package-lock.json),
    Rust (Cargo.lock, Cargo.toml), and Go (go.mod, go.sum).
    """
    manifest_names = [
        "requirements.txt", "pyproject.toml", "Pipfile.lock", "Pipfile",
        "package-lock.json", "package.json", "yarn.lock", "pnpm-lock.yaml",
        "Cargo.lock", "Cargo.toml",
        "go.mod", "go.sum"
    ]
    
    detected_manifests = []
    hasher = hashlib.sha256()
    
    for fname in manifest_names:
        fpath = os.path.join(project_path, fname)
        if os.path.exists(fpath) and os.path.isfile(fpath):
            file_sha = hash_file(fpath)
            detected_manifests.append({
                "manifest": fname,
                "sha256": file_sha,
                "size_bytes": os.path.getsize(fpath)
            })
            hasher.update(fname.encode("utf-8"))
            hasher.update(file_sha.encode("utf-8"))
            
    if not detected_manifests:
        # Default placeholder if no standard manifest is detected
        composite_sbom = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" # empty sha256
    else:
        composite_sbom = hasher.hexdigest()
        
    return {
        "sbom_digest": composite_sbom,
        "manifests": detected_manifests
    }

def compute_state_seal(commit_sha: str, sbom_digest: str, artifact_digest: str, timestamp: str) -> str:
    """
    Computes the canonical SolTrace state seal.
    A composite SHA-256 hash sealing Commit + Dependencies (SBOM) + Artifact Binary + Timestamp.
    """
    payload = f"soltrace:v1|{commit_sha}|{sbom_digest}|{artifact_digest}|{timestamp}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()
