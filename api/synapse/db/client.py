"""
Prisma client singleton.
SHARED — do not edit without a PR.

Both student and teacher query modules import `get_client()` from here.
"""
from __future__ import annotations
import os
from prisma import Prisma

# Global Prisma client instance
_client = Prisma()

def get_client() -> Prisma:
    """Return the global Prisma client."""
    return _client

def get_anon_client() -> Prisma:
    """Return the global Prisma client (auth handled elsewhere if needed)."""
    return _client
