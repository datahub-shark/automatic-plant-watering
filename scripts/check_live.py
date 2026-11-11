"""Read one service token from stdin and check deployed read-only API."""
import json
import getpass
import urllib.request

token = getpass.getpass("Service token: ").strip()
base = "https://tuoi-ca-chua-3-hang.promisinghill1.chatgpt.site/api/v1"
for path in ("/health", "/config?device_id=stm32_01"):
    req = urllib.request.Request(base + path, headers={
        "OAI-Sites-Authorization": "Bearer " + token,
    })
    with urllib.request.urlopen(req, timeout=20) as response:
        body = json.load(response)
        print(path, response.status, sorted(body.keys()))
