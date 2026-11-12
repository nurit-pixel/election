from decimal import Decimal

from ingest import normalize

CHAIN = "SHUFERSAL"


def raw(**overrides):
    row = {
        "itemcode": "7290000042015", "itemtype": "1", "itemname": "חלב 3% 1 ליטר",
        "manufacturename": "תנובה", "unitqty": "ליטר", "quantity": "1.00",
        "unitofmeasure": "ליטר", "bisweighted": "0", "itemprice": "7.10",
        "unitofmeasureprice": "7.10", "allowdiscount": "1",
        "priceupdatetime": "2026-09-30T08:54:00",
    }
    row.update(overrides)
    return row


def test_regular_item():
    r = normalize.price_row(raw(), CHAIN)
    assert r["barcode"] == "7290000042015"
    assert r["internal_chain"] == ""
    assert r["price"] == Decimal("7.10")
    assert r["is_weighted"] is False
    assert r["price_update_time"].hour == 8


def test_weighted_item_keeps_per_kg_price():
    r = normalize.price_row(raw(bisweighted="1", itemprice="12.90"), CHAIN)
    assert r["is_weighted"] is True
    assert r["price"] == Decimal("12.90")


def test_internal_code_is_scoped_to_chain():
    r = normalize.price_row(raw(itemtype="0", itemcode="123"), CHAIN)
    assert r["internal_chain"] == CHAIN


def test_leading_zeros_stripped_from_barcode():
    assert normalize.price_row(raw(itemcode="0000040084107"), CHAIN)["barcode"] == "40084107"


def test_rows_without_price_or_code_are_dropped():
    assert normalize.price_row(raw(itemprice=""), CHAIN) is None
    assert normalize.price_row(raw(itemprice="0"), CHAIN) is None
    assert normalize.price_row(raw(itemcode=None), CHAIN) is None


def test_store_number_normalization():
    assert normalize.store_number("001") == "1"
    assert normalize.store_number("756") == "756"
    assert normalize.store_number("000") == "0"
    assert normalize.store_row({"storeid": "007", "storename": " שלי ", "city": "nan"}) == {
        "chain_id": None, "store_id": "7", "sub_chain_id": None, "sub_chain_name": None,
        "name": "שלי", "address": None, "city": None, "zip_code": None, "store_type": None,
    }


def test_city_code_is_translated_to_name():
    assert normalize.city_name("5000") == "תל אביב - יפו"
    assert normalize.city_name("0070") == "אשדוד"
    assert normalize.city_name("חיפה") == "חיפה"
    assert normalize.city_name("0") is None
    row = normalize.store_row({"storeid": "1", "chainid": "7290027600007", "city": "6300",
                               "address": "סירקין 17"})
    assert (row["city"], row["chain_id"]) == ("גבעתיים", "7290027600007")
