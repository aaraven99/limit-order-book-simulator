import json
from pathlib import Path

from lob_simulator.book import LimitOrderBook, Order


def test_shared_matching_fixture() -> None:
    fixture = json.loads((Path(__file__).parent / "fixtures" / "parity.json").read_text())
    book = LimitOrderBook()
    for action in fixture["actions"]:
        book.submit(
            Order(
                action["side"],
                action["quantity"],
                action["price"],
                order_id=action["orderId"],
            )
        )
    snapshot = book.snapshot()
    assert snapshot["trades"] == fixture["expectedTrades"]
    ask = snapshot["asks"][0]
    assert {
        "price": ask["price"],
        "remaining": ask["remaining"],
        "orderId": ask["order_id"],
    } == fixture["expectedAsk"]
