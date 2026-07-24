export type Side="buy"|"sell";
export type OrderType="limit"|"market";
export type OrderStatus="active"|"filled"|"partial"|"canceled"|"unfilled";
export type Order={side:Side;quantity:number;price:number|null;orderType:OrderType;orderId:string;sequence:number;remaining:number;status:OrderStatus;createdAt:number};
export type Trade={price:number;quantity:number;maker:string;taker:string;sequence:number;timestamp:number;side:Side};
export type Level={price:number;quantity:number;cumulative:number;orders:number};
export type Snapshot={bids:Order[];asks:Order[];trades:Trade[];completed:Order[];canceled:Order[]};
export class MatchingEngine{
  private sequence=0;
  private tradeSequence=0;
  private orders=new Map<string,Order>();
  readonly trades:Trade[]=[];
  readonly completed:Order[]=[];
  readonly canceled:Order[]=[];
  submit(input:{side:Side;quantity:number;price?:number|null;orderType?:OrderType;orderId?:string}){
    const orderType=input.orderType??"limit";const price=input.price??null;
    if(!["buy","sell"].includes(input.side)||!Number.isInteger(input.quantity)||input.quantity<=0)throw new Error("Quantity must be a positive integer.");
    if(orderType==="limit"&&(!price||price<=0))throw new Error("Limit price must be positive.");
    const orderId=input.orderId||`ord-${String(this.sequence+1).padStart(6,"0")}`;
    if(this.orders.has(orderId)||this.completed.some(o=>o.orderId===orderId)||this.canceled.some(o=>o.orderId===orderId))throw new Error("Duplicate order ID.");
    const order:Order={side:input.side,quantity:input.quantity,price,orderType,orderId,sequence:++this.sequence,remaining:input.quantity,status:"active",createdAt:Date.now()};
    const fills:Trade[]=[];
    while(order.remaining>0){
      const resting=this.bestOpposite(order.side);if(!resting||!this.crosses(order,resting))break;
      const quantity=Math.min(order.remaining,resting.remaining);order.remaining-=quantity;resting.remaining-=quantity;
      const trade:Trade={price:resting.price as number,quantity,maker:resting.orderId,taker:order.orderId,sequence:++this.tradeSequence,timestamp:Date.now(),side:order.side};this.trades.push(trade);fills.push(trade);
      if(resting.remaining===0){resting.status="filled";this.orders.delete(resting.orderId);this.completed.push({...resting})}else resting.status="partial";
    }
    if(order.remaining>0&&orderType==="limit"){order.status=order.remaining<order.quantity?"partial":"active";this.orders.set(order.orderId,order)}
    else{order.status=order.remaining===0?"filled":"unfilled";this.completed.push({...order})}
    return {order:{...order},fills};
  }
  cancel(orderId:string){const order=this.orders.get(orderId);if(!order)return false;order.status="canceled";this.orders.delete(orderId);this.canceled.push({...order});return true}
  snapshot():Snapshot{const active=[...this.orders.values()].map(o=>({...o}));return {bids:active.filter(o=>o.side==="buy").sort((a,b)=>(b.price!-a.price!)||(a.sequence-b.sequence)),asks:active.filter(o=>o.side==="sell").sort((a,b)=>(a.price!-b.price!)||(a.sequence-b.sequence)),trades:this.trades.map(t=>({...t})),completed:this.completed.map(o=>({...o})),canceled:this.canceled.map(o=>({...o}))}}
  levels(side:Side){const orders=side==="buy"?this.snapshot().bids:this.snapshot().asks;const grouped=new Map<number,{quantity:number;orders:number}>();for(const order of orders){const value=grouped.get(order.price!)||{quantity:0,orders:0};value.quantity+=order.remaining;value.orders++;grouped.set(order.price!,value)}let cumulative=0;return [...grouped.entries()].sort((a,b)=>side==="buy"?b[0]-a[0]:a[0]-b[0]).map(([price,value])=>{cumulative+=value.quantity;return {price,quantity:value.quantity,cumulative,orders:value.orders} satisfies Level})}
  private bestOpposite(side:Side){const candidates=[...this.orders.values()].filter(order=>order.side!==side);if(!candidates.length)return undefined;return candidates.sort((a,b)=>side==="buy"?(a.price!-b.price!)||(a.sequence-b.sequence):(b.price!-a.price!)||(a.sequence-b.sequence))[0]}
  private crosses(incoming:Order,resting:Order){return incoming.orderType==="market"||(incoming.side==="buy"&&incoming.price!>=resting.price!)||(incoming.side==="sell"&&incoming.price!<=resting.price!)}
}
export function seededBook(){const engine=new MatchingEngine();[[99.75,14],[99.5,24],[99.25,30],[99,42]].forEach(([price,quantity])=>engine.submit({side:"buy",price,quantity}));[[100.25,16],[100.5,22],[100.75,34],[101,45]].forEach(([price,quantity])=>engine.submit({side:"sell",price,quantity}));return engine}
export function summarize(engine:MatchingEngine){const snapshot=engine.snapshot();const bids=engine.levels("buy"),asks=engine.levels("sell");const bestBid=bids[0]?.price??null,bestAsk=asks[0]?.price??null;return {snapshot,bids,asks,bestBid,bestAsk,spread:bestBid!==null&&bestAsk!==null?bestAsk-bestBid:null,mid:bestBid!==null&&bestAsk!==null?(bestBid+bestAsk)/2:null,lastTrade:snapshot.trades.at(-1)?.price??null,bidDepth:bids.reduce((s,l)=>s+l.quantity,0),askDepth:asks.reduce((s,l)=>s+l.quantity,0)}}
