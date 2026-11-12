"""רישום הרשתות ומקור ההורדה של כל אחת.

source="library"  – הורדה עם il-supermarket-scraper.
source="cerberus" – מוריד משלנו (cerberus.py) מול url.publishedprices.co.il בממשק הווב.
                    הספרייה ניגשת לרשתות האלה ב-FTP; הממשק הווב עובד גם מאחורי פרוקסי HTTPS.
בשני המקרים הפענוח נעשה עם il_supermarket_parsers לפי key.
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class Chain:
    key: str                 # שם ה-scraper וה-parser בספריות OpenIsraeliSupermarkets
    name: str
    source: str = "library"
    username: str = ""       # Cerberus בלבד
    password: str = ""
    path: str = "/"
    is_pharm: bool = False


def _cerberus(key, name, username, password="", path="/"):
    return Chain(key, name, "cerberus", username, password, path)


_ALL = [
    Chain("SHUFERSAL", "שופרסל"),
    _cerberus("RAMI_LEVY", "רמי לוי", "RamiLevi"),
    _cerberus("YOHANANOF", "יוחננוף", "yohananof"),
    _cerberus("OSHER_AD", "אושר עד", "osherad"),
    Chain("VICTORY_NEW_SOURCE", "ויקטורי"),
    Chain("YAYNO_BITAN_AND_CARREFOUR", "קרפור / יינות ביתן / מגה"),
    Chain("HAZI_HINAM", "חצי חינם"),
    _cerberus("TIV_TAAM", "טיב טעם", "TivTaam"),
    Chain("MAHSANI_ASHUK_NEW_SOURCE", "מחסני השוק"),
    _cerberus("FRESH_MARKET_AND_SUPER_DOSH", "פרש מרקט / סופר דוש", "freshmarket"),
    _cerberus("KESHET", "קשת טעמים", "Keshet"),
    _cerberus("STOP_MARKET", "סטופ מרקט", "Stop_Market"),
    _cerberus("DOR_ALON", "דור אלון", "doralon"),
    _cerberus("YELLOW", "יילו", "Paz_bo", "paz468"),
    _cerberus("SALACH_DABACH", "סאלח דבאח", "SalachD", "12345"),
    _cerberus("SUPER_YUDA", "סופר יודה", "yuda_ho", "Yud@147", "/Yuda"),
    _cerberus("POLIZER", "פוליצר", "politzer"),
    Chain("HET_COHEN_NEW_SOURCE", "ח. כהן"),
    Chain("BAREKET", "סופר ברקת"),
    Chain("KING_STORE", "קינג סטור"),
    Chain("MAAYAN_2000", "מעיין 2000"),
    Chain("NETIV_HASED", "נתיב החסד"),
    Chain("MESHMAT_YOSEF_1", "משנת יוסף"),
    Chain("MESHMAT_YOSEF_2", "משנת יוסף (קיי.טי.)"),
    Chain("SHEFA_BARCART_ASHEM", "שפע ברכת השם"),
    Chain("SHUK_AHIR", "שוק העיר"),
    Chain("SUPER_SAPIR", "סופר ספיר"),
    Chain("ZOL_VEBEGADOL", "זול ובגדול"),
    Chain("CITY_MARKET_KIRYATGAT", "סיטי מרקט קרית גת"),
    Chain("CITY_MARKET_SHOPS", "סיטי מרקט"),
    Chain("WOLT", "וולט מרקט"),
    Chain("SUPER_PHARM", "סופר-פארם", is_pharm=True),
    Chain("GOOD_PHARM", "גוד פארם", is_pharm=True),
]

CHAINS: dict[str, Chain] = {c.key: c for c in _ALL}
