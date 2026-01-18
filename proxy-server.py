#!/usr/bin/env python3
"""
Simple CORS proxy server for ESPN API
Runs on localhost:8001
"""

from http.server import HTTPServer, BaseHTTPRequestHandler
import urllib.request
import urllib.parse
import json
import sys

class CORSProxyHandler(BaseHTTPRequestHandler):
    def _set_cors_headers(self):
        """Set CORS headers for all responses"""
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        self.send_header('Access-Control-Max-Age', '3600')

    def do_GET(self):
        # Extract ESPN URL from query parameter
        if '?url=' in self.path:
            encoded_url = self.path.split('?url=', 1)[1]
            espn_url = urllib.parse.unquote(encoded_url)

            try:
                # Fetch from ESPN
                print(f"Proxying request to: {espn_url}")

                req = urllib.request.Request(
                    espn_url,
                    headers={'User-Agent': 'Mozilla/5.0'}
                )

                with urllib.request.urlopen(req) as response:
                    data = response.read()

                    # Send response with CORS headers FIRST
                    self.send_response(200)
                    self._set_cors_headers()
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()

                    self.wfile.write(data)
                    print(f"✓ Successfully proxied {len(data)} bytes")

            except Exception as e:
                print(f"✗ Error proxying request: {e}")
                self.send_response(500)
                self._set_cors_headers()
                self.send_header('Content-Type', 'text/plain')
                self.end_headers()
                self.wfile.write(f"Proxy error: {str(e)}".encode())
        else:
            self.send_response(400)
            self._set_cors_headers()
            self.send_header('Content-Type', 'text/plain')
            self.end_headers()
            self.wfile.write(b"Missing 'url' parameter")

    def do_OPTIONS(self):
        # Handle preflight CORS requests
        self.send_response(200)
        self._set_cors_headers()
        self.end_headers()

    def log_message(self, format, *args):
        # Suppress default logging (we'll do our own)
        pass

def run_server(port=8001):
    server_address = ('', port)
    httpd = HTTPServer(server_address, CORSProxyHandler)

    print("=" * 60)
    print("NFL API Proxy Server")
    print("=" * 60)
    print(f"✓ Server running on http://localhost:{port}")
    print(f"✓ Proxying ESPN API requests")
    print()
    print("Keep this terminal window open while using the app.")
    print("Press Ctrl+C to stop the server.")
    print("=" * 60)
    print()

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n\n✓ Server stopped.")
        sys.exit(0)

if __name__ == '__main__':
    run_server()
