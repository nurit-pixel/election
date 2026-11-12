from ingest import geocode


def test_store_queries_priority():
    assert geocode.store_queries("בן יהודה 79", "תל אביב - יפו") == [
        ("בן יהודה 79, תל אביב - יפו", "address"), ("תל אביב - יפו", "city")]


def test_city_already_in_address_is_not_repeated():
    assert geocode.store_queries("הרצל 5 חיפה", "חיפה")[0] == ("הרצל 5 חיפה", "address")


def test_missing_parts():
    assert geocode.store_queries(None, "מיתר") == [("מיתר", "city")]
    assert geocode.store_queries("מרכז מסחרי", None) == [("מרכז מסחרי", "address")]
    assert geocode.store_queries(None, None) == []


def test_store_name_used_when_city_missing():
    assert geocode.store_queries("לוחמי הגטאות 9", None, "נהריה") == [
        ("לוחמי הגטאות 9, נהריה", "address"), ("לוחמי הגטאות 9", "address"), ("נהריה", "city")]


def test_simplify_address():
    assert geocode.simplify_address("רח' גוט לוין 48") == "גוט לוין 48"
    assert geocode.simplify_address("רח.משה שפירא 28") == "משה שפירא 28"
    assert geocode.simplify_address("שד' מנחם בגין 2") == "שדרות מנחם בגין 2"
    assert geocode.simplify_address("בזק 1 פינת ברקן") == "בזק 1"
    assert geocode.simplify_address("האומן,15") == "האומן 15"
    assert geocode.store_queries("רח' גוט לוין 48", "חיפה") == [
        ("רח גוט לוין 48, חיפה", "address"), ("גוט לוין 48, חיפה", "address"), ("חיפה", "city")]
