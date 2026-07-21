from lob_simulator.book import LimitOrderBook, Order


def test_price_time_priority_and_partial_fill() -> None:
    book = LimitOrderBook()
    book.submit(Order("sell", 3, 101))
    book.submit(Order("sell", 4, 100))
    book.submit(Order("buy", 5, 102))
    assert [(t["price"], t["quantity"]) for t in book.trades] == [(100, 4), (101, 1)]
    assert book.snapshot()["asks"][0]["remaining"] == 2


def test_market_order_does_not_rest_and_cancellation() -> None:
    book = LimitOrderBook()
    book.submit(Order("buy", 2, 99))
    assert book.cancel("ord-000001")
    book.submit(Order("buy", 2, order_type="market"))
    assert not book.snapshot()["bids"]
