# Lets the gateway's tests import backend/red_flags.py, which the extension
# shares with the website's own scoring.
import os
import sys

_BACKEND = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if _BACKEND not in sys.path:
    sys.path.insert(0, _BACKEND)
