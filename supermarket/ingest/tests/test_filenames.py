from datetime import datetime

from ingest import filenames


def test_standard_name():
    f = filenames.parse("PriceFull7290058140886-039-202611120300.gz")
    assert (f.file_type, f.chain_id, f.store_id) == ("PRICE_FULL_FILE", "7290058140886", "39")
    assert f.time == datetime(2026, 11, 12, 3, 0)


def test_shufersal_name_with_sub_chain_and_split_time():
    f = filenames.parse("PriceFull7290027600007-001-035-20261112-030000.xml")
    assert f.store_id == "35"
    assert f.time == datetime(2026, 11, 12, 3, 0)


def test_stores_file():
    f = filenames.parse("Stores7290058140886-000-20261110-050500.xml")
    assert (f.file_type, f.store_id) == ("STORE_FILE", "0")
    f = filenames.parse("Stores7290027600007-000-20261112-020.gz")
    assert f.time == datetime(2026, 11, 12)
    assert filenames.parse("StoresFull7290103152017-000-202611120005.gz").file_type == "STORE_FILE"


def test_prefixes_are_not_confused():
    assert filenames.parse("Price7290058140886-001-202611121000.gz").file_type == "PRICE_FILE"
    assert filenames.parse("PromoFull7290058140886-001-202611120300.gz").file_type == "PROMO_FULL_FILE"
    assert filenames.parse("readme.txt") is None


def test_latest_per_store():
    names = [
        "PriceFull729-001-202611110300.gz", "PriceFull729-001-202611120300.gz",
        "PriceFull729-002-202611120300.gz", "Price729-001-202611121000.gz",
        "Stores729-000-202611100500.xml", "Stores729-000-202611120500.xml",
    ]
    picked = filenames.latest_per_store(names, "PRICE_FULL_FILE", {"1"})
    assert [f.name for f in picked] == ["PriceFull729-001-202611120300.gz"]
    assert len(filenames.latest_per_store(names, "PRICE_FULL_FILE")) == 2
    assert [f.name for f in filenames.latest_per_store(names, "STORE_FILE")] == \
        ["Stores729-000-202611120500.xml"]
