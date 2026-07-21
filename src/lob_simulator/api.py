from flask import Flask, jsonify, request

from .book import LimitOrderBook, Order
from .market import latest_quote

app, book = Flask(__name__), LimitOrderBook()


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/orders")
def submit():
    try:
        payload = request.get_json(force=True)
        book.submit(Order(**payload))
        return jsonify(book.snapshot()), 201
    except (TypeError, ValueError) as error:
        return {"error": str(error)}, 400


@app.delete("/orders/<order_id>")
def cancel(order_id: str):
    return {"cancelled": book.cancel(order_id)}


@app.get("/book")
def snapshot():
    return jsonify(book.snapshot())


@app.get("/trades")
def trades():
    return jsonify(book.trades)


@app.get("/market/<ticker>")
def market(ticker: str):
    try:
        return jsonify(latest_quote(ticker))
    except RuntimeError as error:
        return jsonify({"error": str(error)}), 503


def main() -> None:
    app.run(port=8000, debug=True)
