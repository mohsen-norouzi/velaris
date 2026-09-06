import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'VELARIS — Beyond the horizon', description: 'Five extraordinary yacht concepts. An immersive voyage through light, form and the open sea.' };
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="en"><body>{children}</body></html>}
