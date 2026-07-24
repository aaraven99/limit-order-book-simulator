import type {Metadata} from "next";import "./globals.css";
export const metadata:Metadata={title:"Exchange Simulator | Aarav Shah",description:"Browser-isolated price-time-priority limit order book and exchange simulator.",openGraph:{title:"Exchange Simulator",description:"Submit, match, and cancel orders in a deterministic local exchange.",type:"website"}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
