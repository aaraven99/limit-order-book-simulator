"""Read a real top-of-book quote without claiming exchange depth."""

from __future__ import annotations

import json
import os
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

import yfinance as yf
from dotenv import load_dotenv


def _load_environment() -> None:
    here = Path(__file__).resolve()
    for candidate in (here.parents[3] / ".env", here.parents[4] / ".env"):
        if candidate.exists():
            load_dotenv(candidate, override=False)


def latest_quote(ticker: str) -> dict[str, object]:
    """Return an Alpaca IEX quote, or a yfinance last-trade fallback."""
    _load_environment()
    symbol = ticker.upper()
    key, secret = os.getenv("ALPACA_API_KEY"), os.getenv("ALPACA_SECRET_KEY")
    if os.getenv("MARKET_DATA_PROVIDER", "").lower() == "alpaca" and key and secret:
        request = Request(
            f"https://data.alpaca.markets/v2/stocks/{symbol}/quotes/latest?{urlencode({'feed': os.getenv('ALPACA_FEED', 'iex')})}",
            headers={"APCA-API-KEY-ID": key, "APCA-API-SECRET-KEY": secret},
        )
        try:
            with urlopen(request, timeout=10) as response:  # nosec B310
                quote = json.load(response)["quote"]
            return {
                "symbol": symbol,
                "bid": quote["bp"],
                "ask": quote["ap"],
                "timestamp": quote["t"],
                "source": "alpaca-iex",
            }
        except Exception as error:
            raise RuntimeError(f"Alpaca quote unavailable: {error}") from error
    bars = yf.Ticker(symbol).history(period="1d", interval="1m", prepost=True)
    if bars.empty:
        raise RuntimeError("No current quote returned by yfinance")
    return {
        "symbol": symbol,
        "last": float(bars["Close"].iloc[-1]),
        "timestamp": bars.index[-1].isoformat(),
        "source": "yfinance-last-trade",
    }
