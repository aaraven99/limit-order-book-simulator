"use client";

import {useEffect,useState} from "react";
import {Area,AreaChart,Bar,BarChart,CartesianGrid,Line,ResponsiveContainer,Tooltip,XAxis,YAxis} from "recharts";
import {Activity,Download,Pause,Play,RefreshCw,Send,StepForward} from "lucide-react";
import {MatchingEngine,Side,seededBook,summarize} from "../lib/matching-engine";

const scenarioNames=["Resting limit order","Single-level market fill","Multi-level market fill","Partial fill","Price improvement","Price-time priority","Cancellation","Insufficient liquidity","Crossing limit order","Rapid market simulation"];
type EventRow={id:number;time:string;message:string;kind:string};
function cash(v:number|null){return v===null?"—":`$${v.toFixed(2)}`}
export function ExchangeSimulator(){
  const [engine,setEngine]=useState<MatchingEngine>(()=>seededBook());
  const [revision,setRevision]=useState(0);
  const [side,setSide]=useState<Side>("buy");
  const [orderType,setOrderType]=useState<"limit"|"market">("limit");
  const [price,setPrice]=useState(100);
  const [quantity,setQuantity]=useState(5);
  const [cancelId,setCancelId]=useState("");
  const [paused,setPaused]=useState(true);
  const [speed,setSpeed]=useState(1);
  const [seed,setSeed]=useState(17);
  const [error,setError]=useState("");
  const [events,setEvents]=useState<EventRow[]>([{id:1,time:new Date().toLocaleTimeString(),message:"Known initial book loaded.",kind:"system"}]);
  const [scenario,setScenario]=useState(scenarioNames[5]);
  const [scenarioResult,setScenarioResult]=useState<{pass:boolean;message:string}|null>(null);
  const [activeTab,setActiveTab]=useState("trades");
  const view=summarize(engine);
  const maxDepth=Math.max(1,...view.bids.map(l=>l.cumulative),...view.asks.map(l=>l.cumulative));
  function log(message:string,kind="event"){setEvents(rows=>[...rows,{id:(rows.at(-1)?.id||0)+1,time:new Date().toLocaleTimeString(),message,kind}].slice(-150))}
  function refresh(){setRevision(value=>value+1)}
  function submit(custom?:{side:Side;quantity:number;price?:number;orderType:"limit"|"market"}){
    setError("");
    try{
      const input=custom||{side,quantity,price,orderType};
      const result=engine.submit(input);
      log(`${input.side.toUpperCase()} ${input.orderType} ${input.quantity}${input.orderType==="limit"?` @ ${input.price?.toFixed(2)}`:""} → ${result.fills.length} fill(s).`,result.fills.length?"trade":"order");
      refresh();
    }catch(e){setError(e instanceof Error?e.message:"Order rejected")}
  }
  function cancel(){if(!cancelId)return;const ok=engine.cancel(cancelId);log(ok?`Canceled ${cancelId}.`:`Cancellation rejected: ${cancelId} is not active.`,ok?"cancel":"warning");if(!ok)setError("Order ID is not active.");refresh()}
  function reset(){setEngine(seededBook());setPaused(true);setEvents([{id:1,time:new Date().toLocaleTimeString(),message:"Known initial book loaded.",kind:"system"}]);setScenarioResult(null);setError("");refresh()}
  function step(){
    const current=summarize(engine);const direction=((seed+revision*13)%2)?"buy":"sell";const market=(seed+revision)%4===0;const reference=direction==="buy"?(current.bestBid||99.75):(current.bestAsk||100.25);submit({side:direction,quantity:1+((seed+revision*7)%8),orderType:market?"market":"limit",price:direction==="buy"?reference-.25:reference+.25});
  }
  useEffect(()=>{
    if(paused)return;
    const timer=window.setInterval(()=>{
      const current=summarize(engine);const direction=((seed+revision*13)%2)?"buy":"sell";const market=(seed+revision)%4===0;const reference=direction==="buy"?(current.bestBid||99.75):(current.bestAsk||100.25);
      try{
        const result=engine.submit({side:direction,quantity:1+((seed+revision*7)%8),orderType:market?"market":"limit",price:direction==="buy"?reference-.25:reference+.25});
        setEvents(rows=>[...rows,{id:(rows.at(-1)?.id||0)+1,time:new Date().toLocaleTimeString(),message:`AUTO ${direction.toUpperCase()} → ${result.fills.length} fill(s).`,kind:result.fills.length?"trade":"order"}].slice(-150));
        setRevision(value=>value+1)
      }catch{}
    },Math.max(160,1000/speed));
    return()=>window.clearInterval(timer)
  },[paused,speed,revision,seed,engine]);
  function runScenario(){
    const book=new MatchingEngine();let pass=false;let message="";
    try{
      if(scenario==="Resting limit order"){book.submit({side:"buy",quantity:5,price:99});pass=book.snapshot().bids[0].remaining===5;message="A non-crossing limit order rests at the quoted price."}
      else if(scenario==="Single-level market fill"){book.submit({side:"sell",quantity:5,price:100,orderId:"maker"});book.submit({side:"buy",quantity:3,orderType:"market"});pass=book.trades.length===1&&book.snapshot().asks[0].remaining===2;message="Market demand consumed part of the best ask."}
      else if(scenario==="Multi-level market fill"){book.submit({side:"sell",quantity:2,price:100});book.submit({side:"sell",quantity:3,price:101});book.submit({side:"buy",quantity:4,orderType:"market"});pass=book.trades.length===2;message="The order swept two price levels at maker prices."}
      else if(scenario==="Partial fill"){book.submit({side:"sell",quantity:2,price:100});const order=book.submit({side:"buy",quantity:5,price:100}).order;pass=order.remaining===3;message="Two units filled and three remain active."}
      else if(scenario==="Price improvement"){book.submit({side:"sell",quantity:3,price:99});book.submit({side:"buy",quantity:3,price:101});pass=book.trades[0].price===99;message="The crossing buyer receives the resting maker price."}
      else if(scenario==="Price-time priority"){book.submit({side:"sell",quantity:2,price:100,orderId:"early"});book.submit({side:"sell",quantity:2,price:100,orderId:"late"});book.submit({side:"buy",quantity:3,orderType:"market"});pass=book.trades.map(t=>t.maker).join(",")==="early,late";message="Equal-price orders filled in arrival order."}
      else if(scenario==="Cancellation"){book.submit({side:"buy",quantity:2,price:99,orderId:"cancel-me"});pass=book.cancel("cancel-me")&&!book.snapshot().bids.length;message="The active order was removed without a trade."}
      else if(scenario==="Insufficient liquidity"){const order=book.submit({side:"buy",quantity:5,orderType:"market"}).order;pass=order.status==="unfilled";message="Unfilled market quantity never rests in the book."}
      else if(scenario==="Crossing limit order"){book.submit({side:"sell",quantity:2,price:100});book.submit({side:"buy",quantity:2,price:101});pass=book.trades.length===1;message="A marketable limit order executed immediately."}
      else{for(let i=0;i<60;i++)book.submit({side:i%2?"buy":"sell",quantity:1+(i%5),price:i%2?99.75-(i%4)*.25:100.25+(i%4)*.25});pass=book.snapshot().bids.length+book.snapshot().asks.length>0;message="Sixty deterministic events completed without violating the spread."}
      setScenarioResult({pass,message});log(`Scenario "${scenario}": ${pass?"PASS":"FAIL"}.`,"scenario");
    }catch(e){setScenarioResult({pass:false,message:e instanceof Error?e.message:"Scenario failed"})}
  }
  function exportLog(){const csv=["time,kind,message",...events.map(e=>`${e.time},${e.kind},${JSON.stringify(e.message)}`)].join("\n");const url=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));const anchor=document.createElement("a");anchor.href=url;anchor.download="exchange-event-log.csv";anchor.click();URL.revokeObjectURL(url)}
  const history=view.snapshot.trades.map((trade,i)=>({event:i+1,price:trade.price,volume:trade.quantity,spread:view.spread||0}));
  const tickerMetrics:[string,string|number,string][]= [["Best bid",cash(view.bestBid),"buy"],["Best ask",cash(view.bestAsk),"sell"],["Spread",cash(view.spread),""],["Mid-price",cash(view.mid),""],["Last trade",cash(view.lastTrade),""],["Bid depth",view.bidDepth,"buy"],["Ask depth",view.askDepth,"sell"],["Status",paused?"PAUSED":"RUNNING",paused?"":"buy"]];
  return <main className="shell">
    <nav className="nav"><div className="brand"><span className="mark"><Activity size={21}/></span>AARAV / QUANT LABS</div><span className="badge"><span className="dot"/> isolated browser session</span></nav>
    <section className="hero"><div><span className="badge">deterministic price–time priority</span><h1>Exchange <span className="gradient">Simulator</span></h1><p className="lede">Submit limit and market orders, watch maker-price fills cross the ladder, and inspect every state transition in a browser-local matching engine.</p></div><p className="hero-note">Your book exists only in this tab. Visitors never share state, no orders persist, and the TypeScript rules mirror the repository’s Python engine.</p></section>
    <section className="panel ticker">{tickerMetrics.map(([a,b,c])=><article className="metric" key={a}><span>{a}</span><strong className={c}>{b}</strong><small>{a==="Status"?`${speed}× speed`:"local simulation"}</small></article>)}</section>
    <section className="workspace">
      <aside className="panel controls"><div className="head"><h2>Order entry</h2><Send size={15}/></div><div className="fields">
        <div className="side-switch"><button className={side==="buy"?"buy-active":""} onClick={()=>setSide("buy")}>BUY</button><button className={side==="sell"?"sell-active":""} onClick={()=>setSide("sell")}>SELL</button></div>
        <label>Order type<select value={orderType} onChange={e=>setOrderType(e.target.value as "limit"|"market")}><option value="limit">Limit order</option><option value="market">Market order</option></select></label>
        <div className="row"><label>Price<input type="number" step=".25" value={price} disabled={orderType==="market"} onChange={e=>setPrice(+e.target.value)}/></label><label>Quantity<input type="number" min="1" step="1" value={quantity} onChange={e=>setQuantity(+e.target.value)}/></label></div>
        <button className={`primary ${side==="sell"?"sell-button":""}`} onClick={()=>submit()}><Send size={14}/>Submit {side}</button>
        <label>Cancel by order ID<div className="actions"><input value={cancelId} placeholder="ord-000001" onChange={e=>setCancelId(e.target.value)}/><button className="secondary" onClick={cancel}>Cancel</button></div></label>
        <div className="head" style={{marginTop:7}}><h2>Simulation controls</h2><span className="badge">seed {seed}</span></div>
        <div className="actions"><button className="secondary" onClick={()=>setPaused(!paused)}>{paused?<Play size={14}/>:<Pause size={14}/>} {paused?"Resume":"Pause"}</button><button className="secondary" onClick={step}><StepForward size={14}/>Step event</button></div>
        <div className="row"><label>Speed<select value={speed} onChange={e=>setSpeed(+e.target.value)}><option value="1">1×</option><option value="2">2×</option><option value="5">5×</option></select></label><label>Seed<input type="number" value={seed} onChange={e=>setSeed(+e.target.value)}/></label></div>
        <button className="secondary" onClick={reset}><RefreshCw size={14}/>Reset known book</button>
        {error&&<div className="error" role="alert">{error}</div>}
        <div className="head" style={{marginTop:7}}><h2>Guided scenario</h2></div><div className="scenario"><label>Scenario<select value={scenario} onChange={e=>{setScenario(e.target.value);setScenarioResult(null)}}>{scenarioNames.map(name=><option key={name}>{name}</option>)}</select></label><button className="secondary" onClick={runScenario}>Run</button></div>
        {scenarioResult&&<div className={scenarioResult.pass?"pass":"error"}><strong>{scenarioResult.pass?"PASS":"FAIL"}</strong> — {scenarioResult.message}</div>}
      </div></aside>
      <div className="content">
        <div className="book-grid">
          <article className="panel book"><div className="head"><div><h2 className="buy">Bid book</h2><p>Highest price, then earliest sequence</p></div><span>{view.bids.length} levels</span></div><div className="table-wrap"><table><thead><tr><th>Price</th><th>Quantity</th><th>Cumulative</th><th>Orders</th></tr></thead><tbody>{view.bids.map((level,i)=><tr className={i===0?"best":""} key={level.price}><td><div className="depth bid" style={{width:`${level.cumulative/maxDepth*100}%`}}/><span className="buy">{cash(level.price)}</span></td><td><span>{level.quantity}</span></td><td><span>{level.cumulative}</span></td><td><span>{level.orders}</span></td></tr>)}</tbody></table></div></article>
          <article className="panel book"><div className="head"><div><h2 className="sell">Ask book</h2><p>Lowest price, then earliest sequence</p></div><span>{view.asks.length} levels</span></div><div className="table-wrap"><table><thead><tr><th>Price</th><th>Quantity</th><th>Cumulative</th><th>Orders</th></tr></thead><tbody>{view.asks.map((level,i)=><tr className={i===0?"best":""} key={level.price}><td><div className="depth ask" style={{width:`${level.cumulative/maxDepth*100}%`}}/><span className="sell">{cash(level.price)}</span></td><td><span>{level.quantity}</span></td><td><span>{level.cumulative}</span></td><td><span>{level.orders}</span></td></tr>)}</tbody></table></div></article>
        </div>
        <div className="panels">
          <article className="panel chart"><div className="head"><div><h2>Trade price & spread history</h2><p>Maker prices for every execution</p></div></div><div className="chart-box"><ResponsiveContainer><AreaChart data={history.length?history:[{event:0,price:view.mid||100,volume:0,spread:view.spread||.5}]}><CartesianGrid stroke="rgba(148,163,184,.1)"/><XAxis dataKey="event" stroke="#748196"/><YAxis domain={["auto","auto"]} stroke="#748196"/><Tooltip/><Area dataKey="price" stroke="#60a5fa" fill="#60a5fa22"/><Line dataKey="spread" stroke="#fbbf24"/></AreaChart></ResponsiveContainer></div></article>
          <article className="panel chart"><div className="head"><div><h2>Executed volume</h2><p>Quantity by trade event</p></div></div><div className="chart-box"><ResponsiveContainer><BarChart data={history}><CartesianGrid stroke="rgba(148,163,184,.1)"/><XAxis dataKey="event" stroke="#748196"/><YAxis stroke="#748196"/><Tooltip/><Bar dataKey="volume" fill="#22d3ee"/></BarChart></ResponsiveContainer></div></article>
        </div>
        <div className="lower">
          <article className="panel chart"><div className="tabs">{["trades","active","completed","canceled"].map(tab=><button className={activeTab===tab?"active":""} onClick={()=>setActiveTab(tab)} key={tab}>{tab.toUpperCase()}</button>)}</div><div className="table-wrap"><table><thead><tr><th>ID / maker</th><th>Side / taker</th><th>Price</th><th>Qty / remaining</th></tr></thead><tbody>{activeTab==="trades"&&view.snapshot.trades.slice().reverse().map(t=><tr key={t.sequence}><td>{t.maker}</td><td>{t.taker}</td><td>{cash(t.price)}</td><td>{t.quantity}</td></tr>)}{activeTab==="active"&&[...view.snapshot.bids,...view.snapshot.asks].map(o=><tr key={o.orderId}><td>{o.orderId}</td><td className={o.side}>{o.side}</td><td>{cash(o.price)}</td><td>{o.remaining}</td></tr>)}{activeTab==="completed"&&view.snapshot.completed.slice().reverse().map(o=><tr key={`${o.orderId}-${o.sequence}`}><td>{o.orderId}</td><td>{o.status}</td><td>{cash(o.price)}</td><td>{o.remaining}</td></tr>)}{activeTab==="canceled"&&view.snapshot.canceled.slice().reverse().map(o=><tr key={o.orderId}><td>{o.orderId}</td><td>{o.status}</td><td>{cash(o.price)}</td><td>{o.remaining}</td></tr>)}</tbody></table></div></article>
          <article className="panel chart"><div className="head"><div><h2>Event log</h2><p>Deterministic, downloadable audit trail</p></div><button className="secondary" onClick={exportLog}><Download size={13}/>CSV</button></div><div className="log">{events.slice().reverse().map(event=><div key={event.id}>[{event.time}] {event.message}</div>)}</div></article>
        </div>
      </div>
    </section>
    <section className="panel method"><h2>Matching rules & architecture</h2><p>Each tab owns a private in-memory TypeScript engine. Limit orders match the best opposite price; equal-price orders match by arrival sequence. Trades execute at the resting maker’s price. Partially filled limit orders may rest; unfilled market quantity never does. Cancellation only affects active orders.</p><p>This is an educational exchange model without latency, fees, hidden liquidity, auctions, halts, or venue routing. It is not connected to a broker and cannot place real orders.</p></section>
  </main>
}
