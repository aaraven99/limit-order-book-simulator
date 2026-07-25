import type {Metadata} from "next";import "./globals.css";
export const metadata:Metadata={title:"Market Microstructure Monitor | Aarav Shah",description:"Real provider-reported intraday OHLCV monitoring with no generated depth or fills.",openGraph:{title:"Market Microstructure Monitor",description:"Inspect real intraday market bars without synthetic fallback data.",type:"website"}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
