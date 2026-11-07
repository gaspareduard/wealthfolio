"""Verify the built web server refreshes periodically without progress toasts."""

import argparse
import base64
import http.client
import json
import time
import urllib.error
import urllib.request
import uuid

from encryption_smoke import docker, make_request


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--image", required=True)
    args = parser.parse_args()
    name = "wf-refresh-smoke-" + uuid.uuid4().hex[:12]
    volume = name + "-data"
    deadline = time.monotonic() + 220
    try:
        docker("run", "-d", "--name", name, "-v", f"{volume}:/data",
               "--read-only", "--tmpfs", "/tmp:size=64M",
               "--security-opt", "no-new-privileges:true",
               "-e", "WF_SECRET_KEY=" + base64.b64encode(b"a" * 32).decode(),
               "-e", "WF_AUTH_REQUIRED=false",
               "-e", "WF_LISTEN_ADDR=0.0.0.0:8088",
               "-p", "127.0.0.1::8088", args.image)
        port = json.loads(docker("inspect", name))[0]["NetworkSettings"]["Ports"]["8088/tcp"][0]["HostPort"]
        origin = f"http://127.0.0.1:{port}"
        request = make_request(origin)
        health_deadline = min(deadline, time.monotonic() + 30)
        while time.monotonic() < health_deadline:
            try:
                request("/api/v1/healthz")
                break
            except (OSError, urllib.error.URLError, http.client.HTTPException):
                time.sleep(0.5)
        else:
            raise AssertionError("Server health timeout")

        # Profile access starts its worker and an immediate startup update.
        # Ignore that update if it races the SSE subscription; periodic work
        # starts after 120 seconds and must recur a minute later.
        profile_started = time.monotonic()
        request("/api/v1/settings", timeout=20)
        completions = []
        forbidden = {"market:sync-start", "portfolio:update-start",
                     "market:sync-error", "portfolio:update-error"}
        stream_request = urllib.request.Request(
            origin + "/api/v1/events/stream", headers={"Accept": "text/event-stream"}
        )
        # Server keepalives arrive every 15 seconds, bounding stalled reads.
        with urllib.request.urlopen(stream_request, timeout=25) as stream:
            assert stream.headers.get_content_type() == "text/event-stream"
            while time.monotonic() < deadline:
                line = stream.readline()
                assert line, "SSE stream ended before two periodic updates"
                now = time.monotonic()
                if now - profile_started < 110 or not line.startswith(b"event:"):
                    continue
                event = line.partition(b":")[2].strip().decode()
                assert event not in forbidden, f"Unexpected background event: {event}"
                if event == "portfolio:update-complete":
                    completions.append(now)
                    print(f"Observed periodic completion {len(completions)}", flush=True)
                    if len(completions) == 2:
                        gap = completions[1] - completions[0]
                        assert 55 <= gap <= 85, f"Wrong refresh interval: {gap:.2f}s"
                        print(f"PASS quiet periodic portfolio refresh: gap={gap:.2f}s", flush=True)
                        return
            raise AssertionError("Timed out waiting for two periodic portfolio updates")
    except Exception:
        print(docker("logs", name, check=False), flush=True)
        raise
    finally:
        docker("rm", "-f", name, check=False)
        docker("volume", "rm", volume, check=False)


if __name__ == "__main__":
    main()
