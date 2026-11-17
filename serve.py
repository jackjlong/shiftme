"""Serve Shift Ledger on a stable local address so browser data persists."""

from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import sys
import webbrowser


PORT = 8765
ROOT = Path(__file__).resolve().parent


def main():
    handler = partial(SimpleHTTPRequestHandler, directory=str(ROOT))
    try:
        server = ThreadingHTTPServer(("127.0.0.1", PORT), handler)
    except OSError:
        print(f"Port {PORT} is already in use. If Shift Ledger is already open, use http://127.0.0.1:{PORT}/ in the same browser. Otherwise close the other server and retry.")
        return 1

    url = f"http://127.0.0.1:{PORT}/"
    print(f"Shift Ledger is running at {url}")
    print("Keep this Terminal window open while using the ledger. Press Control-C to stop it.")
    webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
