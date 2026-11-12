"""רישום הרשתות. שלב 1: שופרסל בלבד; שאר הרשתות יתווספו בשלב 2."""
from dataclasses import dataclass


@dataclass(frozen=True)
class Chain:
    key: str          # שם ה-scraper וה-parser בספריות OpenIsraeliSupermarkets
    chain_id: str
    name: str
    is_pharm: bool = False


CHAINS: dict[str, Chain] = {
    c.key: c
    for c in [
        Chain("SHUFERSAL", "7290027600007", "שופרסל"),
    ]
}
