import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {title:"Deadlock • Road to Eternus",description:"Your training curriculum, hero practice, and progress journal."};
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="en"><body>{children}</body></html> }
