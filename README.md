# Limit Order Book Simulator

[Live dashboard](https://limit-order-book-simulator-tau.vercel.app)

![Generated order-book depth demonstration](assets/portfolio-preview.png)

A deterministic price-time-priority matching engine with a Flask API and an optional real Alpaca IEX top-quote endpoint.

```bash
pip install -e . pytest ruff
lob-simulator
```

In another terminal:

```bash
curl -X POST http://localhost:8000/orders -H "Content-Type: application/json" -d '{"side":"buy","quantity":10,"price":100}'
curl http://localhost:8000/market/AAPL
pytest && ruff check . && ruff format --check .
```

To use Alpaca, create an ignored local `.env` with `MARKET_DATA_PROVIDER=alpaca`, `ALPACA_API_KEY=`, `ALPACA_SECRET_KEY=`, and `ALPACA_FEED=iex`. Without keys, `/market/<ticker>` uses the yfinance latest minute close. The in-memory API is a simulator: `/book` is not Level 2 exchange depth, even when `/market` is live. Market orders only consume available simulated liquidity and never rest.

## Complete local setup

Use Python 3.12 or later. Create a virtual environment with `python -m venv .venv`, activate it (`.venv/Scripts/Activate.ps1` on Windows or `source .venv/bin/activate` elsewhere), then install the package. Start `lob-simulator`; it listens on `http://localhost:8000`. Submit JSON orders to `POST /orders`, inspect simulated depth at `GET /book`, inspect executions at `GET /trades`, cancel a resting order with `DELETE /orders/<order_id>`, and check a live top quote at `GET /market/<ticker>`.

For Alpaca, copy the variable names above into a repository-local `.env`; never put values in a README, commit, browser client, or GitHub secret visible to a public build. The shared workspace `.env` is read only locally. `ALPACA_FEED=iex` is the appropriate free-feed setting, but it is not SIP coverage or Level 2 depth. A 503 from `/market` means the provider returned no usable quote or rejected the credentials; retry with yfinance fallback by omitting the Alpaca provider variables.

## Verification

Run `ruff check . && ruff format --check . && pytest`. The API deliberately keeps the matching engine local and deterministic: real quotes do not alter the simulated book, and submitting to this API never submits an exchange or brokerage order.

This project is intended for educational and research purposes only. It does not provide investment advice, and its outputs should not be used as the sole basis for financial decisions. Historical performance and simulated results do not guarantee future performance.

MIT License. Author: Aarav Shah.
