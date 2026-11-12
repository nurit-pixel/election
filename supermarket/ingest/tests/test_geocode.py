from ingest import geocode


def test_store_queries_priority():
    assert geocode.store_queries("בן יהודה 79", "תל אביב - יפו") == [
        ("בן יהודה 79, תל אביב - יפו", "address"),
        ("בן יהודה, תל אביב - יפו", "street"),
        ("תל אביב - יפו", "city")]


def test_city_already_in_address_is_not_repeated():
    assert geocode.store_queries("הרצל 5 חיפה", "חיפה")[0] == ("הרצל 5 חיפה", "address")


def test_city_only():
    assert geocode.store_queries(None, "מיתר") == [("מיתר", "city")]


def test_no_city_means_no_query():
    # אותו רחוב קיים בערים רבות, ולכן כתובת בלי עיר לא נשלחת
    assert geocode.store_queries("רחוב אחד העם 19", None, "אחד העם") == []
    assert geocode.store_queries(None, None) == []


def test_city_inferred_from_store_name():
    assert geocode.infer_city("טבריה תחתית") == "טבריה"
    assert geocode.infer_city("נהריה") == "נהריה"
    assert geocode.infer_city("יוחננוף ישן") is None
    assert geocode.store_queries("יהודה הלוי 113", None, "טבריה תחתית")[0] == (
        "יהודה הלוי 113, טבריה", "address")


def test_simplify_address():
    assert geocode.simplify_address("רח' גוט לוין 48") == "גוט לוין 48"
    assert geocode.simplify_address("רח.משה שפירא 28") == "משה שפירא 28"
    assert geocode.simplify_address("שד' מנחם בגין 2") == "שדרות מנחם בגין 2"
    assert geocode.simplify_address("בזק 1 פינת ברקן") == "בזק 1"
    assert geocode.simplify_address("האומן,15") == "האומן 15"
    assert geocode.street_only("אבן גבירול157") == "אבן גבירול"
    assert geocode.store_queries("רח' גוט לוין 48", "חיפה") == [
        ("רח גוט לוין 48, חיפה", "address"), ("גוט לוין 48, חיפה", "address"),
        ("גוט לוין, חיפה", "street"), ("חיפה", "city")]
