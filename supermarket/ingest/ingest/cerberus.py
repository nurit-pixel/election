"""מוריד ל-Cerberus (url.publishedprices.co.il) בממשק הווב:
GET /login -> csrftoken מתגית meta + עוגייה -> POST /login/user -> /file/json/dir -> /file/d/<שם>.
"""
from __future__ import annotations

import gzip
import io
import logging
import os
import re
import time
import zipfile

import requests

log = logging.getLogger("ingest.cerberus")

BASE_URL = "https://url.publishedprices.co.il"
USER_AGENT = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
              "(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36")
_CSRF = re.compile(r'<meta\s+name="csrftoken"\s+content="([^"]+)"')


class CerberusError(RuntimeError):
    pass


class CerberusClient:
    def __init__(self, username: str, password: str = "", path: str = "/", delay: float = 1.0):
        self.username, self.password, self.path, self.delay = username, password, path, delay
        self.session = requests.Session()
        self.session.headers["User-Agent"] = USER_AGENT
        self._last_request = 0.0
        self._csrf = ""

    def _request(self, method: str, url: str, **kwargs) -> requests.Response:
        wait = self.delay - (time.monotonic() - self._last_request)
        if wait > 0:
            time.sleep(wait)                       # השהיה בין בקשות
        try:
            response = self.session.request(method, BASE_URL + url, timeout=120, **kwargs)
        finally:
            self._last_request = time.monotonic()
        response.raise_for_status()
        return response

    def _token(self, html: str) -> str:
        match = _CSRF.search(html)
        if not match:
            raise CerberusError("לא נמצא csrftoken בדף")
        return match.group(1)

    def login(self) -> None:
        token = self._token(self._request("GET", "/login").text)
        response = self._request(
            "POST", "/login/user",
            data={"r": "", "username": self.username, "password": self.password, "csrftoken": token},
        )
        if "/login" in response.url:
            raise CerberusError(f"ההתחברות נכשלה עבור {self.username}")
        self._csrf = self._token(response.text)

    def list_files(self, search: str = "") -> list[str]:
        response = self._request(
            "POST", "/file/json/dir",
            data={"sEcho": 1, "iColumns": 5, "iDisplayStart": 0, "iDisplayLength": 100000,
                  "sSearch": search, "cd": self.path, "csrftoken": self._csrf},
        )
        try:
            rows = response.json()["aaData"]
        except (ValueError, KeyError) as exc:
            raise CerberusError("רשימת הקבצים לא התקבלה (ייתכן שההתחברות פגה)") from exc
        return [r["name"] for r in rows if r.get("type") == "file" and r.get("size", 1) > 0]

    def download(self, name: str, dest_dir: str) -> str:
        """מוריד קובץ, פותח דחיסה ושומר כ-XML. מחזיר את הנתיב."""
        path = self.path.rstrip("/") + "/" + name
        content = self._request("GET", "/file/d" + path).content
        if content[:2] == b"\x1f\x8b":
            content = gzip.decompress(content)
        elif content[:2] == b"PK":
            with zipfile.ZipFile(io.BytesIO(content)) as archive:
                content = archive.read(archive.namelist()[0])
        if b"<" not in content[:200]:
            raise CerberusError(f"{name}: התוכן שהתקבל אינו XML")
        os.makedirs(dest_dir, exist_ok=True)
        target = os.path.join(dest_dir, re.sub(r"(\.(xml|gz|zip))+$", "", name, flags=re.I) + ".xml")
        with open(target, "wb") as f:
            f.write(content)
        return target
