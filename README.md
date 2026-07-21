# Limit Order Book Simulator

![Generated order-book depth demonstration](assets/portfolio-preview.png)

A deterministic price-time-priority matching engine with a small Flask API for order-entry demonstrations.

```bash
pip install -e . pytest ruff
lob-simulator
curl -X POST http://localhost:8000/orders -H "Content-Type: application/json" -d '{"side":"buy","quantity":10,"price":100}'
pytest && ruff check . && ruff format --check .
```

The in-memory API is for simulation, not exchange connectivity. Market orders only consume available liquidity and never rest.

This project is intended for educational and research purposes only. It does not provide investment advice, and its outputs should not be used as the sole basis for financial decisions. Historical performance and simulated results do not guarantee future performance.

MIT License. Author: Aarav Shah.
