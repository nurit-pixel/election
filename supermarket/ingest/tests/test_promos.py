from decimal import Decimal

from ingest import normalize


def new_format(**overrides):
    row = {
        "promotionid": "0001429511", "promotiondescription": "משקאות חלב 2 ב 24",
        "promotionstartdatetime": "2026-11-02T00:00:00.000",
        "promotionenddatetime": "2026-12-12T23:59:00.000",
        "promotionstarthour": "", "promotionendhour": "", "promotiondays": "",
        "clubid": "0", "additionaliscoupon": "0",
        "groups": {"group": {"groupid": "1", "minpurchaseamount": "0.00", "promotionitems": {"promotionitem": [
            {"itemcode": "7290102398560", "itemtype": "1", "rewardtype": "10", "minqty": "2",
             "maxqty": "NO_BODY", "discountrate": "21.57", "discountedprice": "24.00"},
            {"itemcode": "7290102398614", "itemtype": "1", "rewardtype": "10", "minqty": "2",
             "maxqty": "NO_BODY", "discountrate": "22.08", "discountedprice": "24.00"},
        ]}}},
    }
    row.update(overrides)
    return row


def test_new_format_bundle():
    p = normalize.promo_row(new_format())
    assert p["promotion_id"] == "0001429511"
    assert p["clubs"] == [] and p["min_purchase"] is None and p["restricted"] is False
    assert p["end_at"].day == 12 and p["end_at"].hour == 23
    assert len(p["items"]) == 2
    item = p["items"][0]
    assert (item["barcode"], item["min_qty"], item["max_qty"], item["discounted_price"]) == (
        "7290102398560", Decimal("2"), None, Decimal("24.00"))


def test_single_item_is_a_dict_not_a_list():
    row = new_format()
    row["groups"]["group"]["promotionitems"]["promotionitem"] = {
        "itemcode": "7290011644000", "rewardtype": "3", "minqty": "1.00", "discountedprice": "12.90"}
    assert len(normalize.promo_row(row)["items"]) == 1


def test_coupons_are_skipped():
    assert normalize.promo_row(new_format(additionaliscoupon="1")) is None


def test_club_formats():
    assert normalize.clubs("0") == []
    assert normalize.clubs("0 - כלל הלקוחות") == []
    assert normalize.clubs("1 - המועדון החדש") == [(1, "המועדון החדש")]
    assert normalize.clubs("(1=מועדון חברתי|1=מועדון שיווק   השקמה)") == [(1, "מועדון חברתי")]
    assert normalize.clubs("((2=מועדון לקוחות אשראי))&(3=תווי זיכוי מימוש)") == [
        (2, "מועדון לקוחות אשראי"), (3, "תווי זיכוי מימוש")]
    assert normalize.promo_row(new_format(clubid="1 - המועדון החדש"))["clubs"] == [(1, "המועדון החדש")]


def test_min_purchase_amount_is_kept_for_notes():
    row = new_format()
    row["groups"]["group"]["minpurchaseamount"] = "249.00"
    assert normalize.promo_row(row)["min_purchase"] == Decimal("249.00")


def test_multi_group_and_time_limited_promos_are_restricted():
    row = new_format()
    row["groups"]["group"] = [row["groups"]["group"], row["groups"]["group"]]
    assert normalize.promo_row(row)["restricted"] is True
    assert normalize.promo_row(new_format(promotiondays="1,2"))["restricted"] is True
    assert normalize.promo_row(new_format(promotionstarthour="16:00:00", promotionendhour="20:00:00"))["restricted"] is True
    assert normalize.promo_row(new_format(promotionstarthour="00:00:00.000", promotionendhour="23:58:00.000"))["restricted"] is False


def test_nth_item_discount_from_description():
    assert normalize.nth_item_discount("חמאה 1+1 מועדון") == (2, Decimal(100))
    assert normalize.nth_item_discount("ציפס השני ב 50%") == (2, Decimal(50))
    assert normalize.nth_item_discount("קופון 1+3 מחיות") is None
    assert normalize.nth_item_discount("2 ב 24") is None


def test_old_flat_format():
    row = {
        "promotionid": "55", "promotiondescription": "3 ב-10", "rewardtype": "2", "minqty": "3",
        "discountedprice": "10.00", "minpurchaseamnt": "0", "promotionstartdate": "2026-11-01",
        "promotionenddate": "2026-11-30", "clubs": {"clubid": "0"},
        "promotionitems": {"item": [{"itemcode": "7290000000017", "itemtype": "1"},
                                    {"itemcode": "123", "itemtype": "0"}]},
    }
    p = normalize.promo_row(row)
    assert [i["barcode"] for i in p["items"]] == ["7290000000017", "123"]
    assert p["items"][0]["min_qty"] == Decimal("3") and p["items"][0]["discounted_price"] == Decimal("10.00")
    assert p["items"][1]["is_internal"] is True
    assert p["clubs"] == []
