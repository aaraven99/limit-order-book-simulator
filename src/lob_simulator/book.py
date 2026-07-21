from __future__ import annotations

from dataclasses import asdict, dataclass, field
from itertools import count


@dataclass
class Order:
    side: str
    quantity: int
    price: float | None = None
    order_type: str = "limit"
    order_id: str = ""
    sequence: int = 0
    remaining: int = field(init=False)

    def __post_init__(self) -> None:
        if (
            self.side not in {"buy", "sell"}
            or self.quantity <= 0
            or self.order_type not in {"limit", "market"}
        ):
            raise ValueError("invalid order")
        if self.order_type == "limit" and (self.price is None or self.price <= 0):
            raise ValueError("limit price must be positive")
        self.remaining = self.quantity


class LimitOrderBook:
    def __init__(self) -> None:
        self._sequence = count(1)
        self._orders: dict[str, Order] = {}
        self.trades: list[dict[str, object]] = []

    def submit(self, order: Order) -> list[dict[str, object]]:
        order.sequence = next(self._sequence)
        order.order_id = order.order_id or f"ord-{order.sequence:06d}"
        while (
            order.remaining
            and (resting := self._best_opposite(order)) is not None
            and self._crosses(order, resting)
        ):
            quantity = min(order.remaining, resting.remaining)
            order.remaining -= quantity
            resting.remaining -= quantity
            trade = {
                "price": resting.price,
                "quantity": quantity,
                "maker": resting.order_id,
                "taker": order.order_id,
            }
            self.trades.append(trade)
            if resting.remaining == 0:
                del self._orders[resting.order_id]
        if order.remaining and order.order_type == "limit":
            self._orders[order.order_id] = order
        return (
            self.trades[-1:] if self.trades and self.trades[-1]["taker"] == order.order_id else []
        )

    def cancel(self, order_id: str) -> bool:
        return self._orders.pop(order_id, None) is not None

    def snapshot(self) -> dict[str, object]:
        bids = sorted(
            (asdict(o) for o in self._orders.values() if o.side == "buy"),
            key=lambda o: (-o["price"], o["sequence"]),
        )
        asks = sorted(
            (asdict(o) for o in self._orders.values() if o.side == "sell"),
            key=lambda o: (o["price"], o["sequence"]),
        )
        return {"bids": bids, "asks": asks, "trades": self.trades}

    def _best_opposite(self, order: Order) -> Order | None:
        candidates = [o for o in self._orders.values() if o.side != order.side]
        if not candidates:
            return None
        return (
            min(candidates, key=lambda o: (o.price, o.sequence))
            if order.side == "buy"
            else max(candidates, key=lambda o: (o.price, -o.sequence))
        )

    @staticmethod
    def _crosses(incoming: Order, resting: Order) -> bool:
        return (
            incoming.order_type == "market"
            or (incoming.side == "buy" and incoming.price >= resting.price)
            or (incoming.side == "sell" and incoming.price <= resting.price)
        )
